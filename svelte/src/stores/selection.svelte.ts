import { browser } from '$app/environment';
import { dataStore } from './data.svelte';
import { setupStore } from './setup.svelte';
import { settingsStore } from './settings.svelte';
import type { ListEntry, Winner, HistoryEntry, LastAction } from '$types';

type SelectionPhase = 'idle' | 'delay' | 'selecting' | 'revealing' | 'complete';

/**
 * Selection Store
 * Manages the winner selection process with Web Worker
 */
class SelectionStore {
	// Selection state
	private _phase = $state<SelectionPhase>('idle');
	private _selectedWinners = $state<Winner[]>([]);
	private _revealedCount = $state(0);
	private _delayProgress = $state(0);
	private _error = $state<string | null>(null);

	// Worker reference
	private worker: Worker | null = null;

	// Last action for undo
	private _lastAction = $state<LastAction | null>(null);

	// Getters
	get phase(): SelectionPhase {
		return this._phase;
	}

	get selectedWinners(): Winner[] {
		return this._selectedWinners;
	}

	get revealedCount(): number {
		return this._revealedCount;
	}

	get delayProgress(): number {
		return this._delayProgress;
	}

	get error(): string | null {
		return this._error;
	}

	get lastAction(): LastAction | null {
		return this._lastAction;
	}

	get isSelecting(): boolean {
		return this._phase !== 'idle' && this._phase !== 'complete';
	}

	get isComplete(): boolean {
		return this._phase === 'complete';
	}

	/**
	 * Generate a unique ID
	 */
	private generateId(length = 10): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = '';
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	/**
	 * Get all eligible entries from selected lists
	 */
	private getEligibleEntries(): ListEntry[] {
		const selectedIds = setupStore.selectedListIds;
		const prizeId = setupStore.selectedPrizeId;

		let allEntries: ListEntry[] = [];

		// Collect entries from all selected lists
		for (const listId of selectedIds) {
			const list = dataStore.lists.find((l) => l.listId === listId);
			if (list?.entries) {
				// Add source info to entries
				const entriesWithSource = list.entries.map((entry) => ({
					...entry,
					sourceListId: list.listId,
					sourceListName: list.metadata.name
				}));
				allEntries = allEntries.concat(entriesWithSource);
			}
		}

		// Filter out previous winners of this prize if preventSamePrize is enabled
		if (settingsStore.preventSamePrize && prizeId) {
			const prize = dataStore.prizes.find((p) => p.prizeId === prizeId);
			if (prize) {
				const samePrizeWinnerIds = new Set(
					dataStore.winners
						.filter((w) => w.prize === prize.name)
						.map((w) => w.entryId)
						.filter(Boolean)
				);

				allEntries = allEntries.filter((entry) => {
					const entryId =
						entry.id ||
						(entry.data?.['Ticket Code'] as string) ||
						(entry.data?.ticketCode as string);
					return !entryId || !samePrizeWinnerIds.has(entryId);
				});
			}
		}

		return allEntries;
	}

	/**
	 * Start the selection process
	 */
	async startSelection(): Promise<void> {
		if (!browser) return;
		if (!setupStore.canStart) {
			throw new Error('Cannot start selection: missing list or prize');
		}

		// Reset state
		this._phase = 'idle';
		this._selectedWinners = [];
		this._revealedCount = 0;
		this._error = null;
		this._delayProgress = 0;

		const prizeId = setupStore.selectedPrizeId;
		const prize = dataStore.prizes.find((p) => p.prizeId === prizeId);
		if (!prize) {
			throw new Error('Prize not found');
		}

		// Check prize quantity
		if (prize.quantity < setupStore.winnersCount) {
			throw new Error(`Not enough prizes available. Only ${prize.quantity} remaining.`);
		}

		// Get eligible entries
		const eligibleEntries = this.getEligibleEntries();
		if (eligibleEntries.length < setupStore.winnersCount) {
			throw new Error(
				`Not enough eligible entries. Only ${eligibleEntries.length} available.`
			);
		}

		// Handle pre-selection delay
		const delayDuration = settingsStore.preSelectionDelay;
		if (delayDuration > 0) {
			this._phase = 'delay';
			await this.runDelay(delayDuration);
		}

		// Perform selection
		this._phase = 'selecting';
		const selectedEntries = await this.selectWinners(eligibleEntries, setupStore.winnersCount);

		// Create winner records
		const historyId = this.generateId();
		const timestamp = Date.now();
		const winners: Winner[] = selectedEntries.map((entry) => this.createWinnerFromEntry(entry, prize, historyId, timestamp));

		// Create history entry
		const historyEntry: HistoryEntry = {
			historyId,
			timestamp,
			listId: setupStore.selectedListIds.join(','),
			listName: setupStore.listDisplayText,
			prizeId: prize.prizeId,
			prizeName: prize.name,
			winnersCount: winners.length,
			winnerIds: winners.map((w) => w.winnerId)
		};

		// Save to database
		await this.saveResults(winners, historyEntry, prize);

		// Store for undo
		this._lastAction = {
			type: 'selectWinners',
			winners,
			removedEntries: selectedEntries,
			prizeId: prize.prizeId,
			prizeCount: setupStore.winnersCount,
			historyId,
			entriesRemoved: false,
			sourceListIds: setupStore.selectedListIds
		};

		// Set winners and start reveal
		this._selectedWinners = winners;
		this._phase = 'revealing';

		// Reveal based on mode
		await this.revealWinners();

		this._phase = 'complete';
	}

	/**
	 * Run the pre-selection delay with progress updates
	 */
	private async runDelay(durationSeconds: number): Promise<void> {
		const startTime = Date.now();
		const durationMs = durationSeconds * 1000;

		return new Promise((resolve) => {
			const updateProgress = () => {
				const elapsed = Date.now() - startTime;
				this._delayProgress = Math.min(1, elapsed / durationMs);

				if (elapsed < durationMs) {
					requestAnimationFrame(updateProgress);
				} else {
					this._delayProgress = 1;
					resolve();
				}
			};
			requestAnimationFrame(updateProgress);
		});
	}

	/**
	 * Select winners using the Web Worker
	 */
	private selectWinners(entries: ListEntry[], count: number): Promise<ListEntry[]> {
		return new Promise((resolve, reject) => {
			try {
				// Create worker
				this.worker = new Worker(
					new URL('../workers/selection.worker.ts', import.meta.url),
					{ type: 'module' }
				);

				this.worker.onmessage = (e) => {
					if (e.data.type === 'complete') {
						resolve(e.data.result);
					} else if (e.data.type === 'error') {
						reject(new Error(e.data.error));
					}
					this.worker?.terminate();
					this.worker = null;
				};

				this.worker.onerror = (error) => {
					reject(new Error(error.message || 'Worker error'));
					this.worker?.terminate();
					this.worker = null;
				};

				// Send selection request
				this.worker.postMessage({
					type: 'select',
					entries,
					numWinners: count
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Create a Winner record from a ListEntry
	 */
	private createWinnerFromEntry(
		entry: ListEntry,
		prize: { prizeId: string; name: string },
		historyId: string,
		timestamp: number
	): Winner {
		// Get display name from entry
		const list = dataStore.lists.find((l) => l.listId === entry.sourceListId);
		const nameConfig = list?.metadata?.nameConfig || '';

		let displayName = 'Unknown';
		if (nameConfig && entry.data) {
			// Handle template like "{First Name} {Last Name}"
			displayName = nameConfig.replace(/\{([^}]+)\}/g, (_, key) => {
				return String(entry.data?.[key.trim()] || '');
			}).trim();
		}

		// Get entry ID
		const entryId =
			entry.id ||
			(entry.data?.['Ticket Code'] as string) ||
			(entry.data?.ticketCode as string) ||
			this.generateId();

		return {
			winnerId: this.generateId(),
			entryId,
			displayName,
			prize: prize.name,
			timestamp,
			listId: entry.sourceListId || '',
			listName: entry.sourceListName || '',
			historyId,
			pickedUp: false,
			data: entry.data,
			sms: { status: 'none' }
		};
	}

	/**
	 * Save winners and history to database
	 */
	private async saveResults(
		winners: Winner[],
		historyEntry: HistoryEntry,
		prize: { prizeId: string; quantity: number }
	): Promise<void> {
		// Save winners
		for (const winner of winners) {
			await dataStore.save('winners', winner as unknown as Record<string, unknown>);
		}

		// Save history
		await dataStore.save('history', historyEntry as unknown as Record<string, unknown>);

		// Update prize quantity
		const updatedPrize = {
			...prize,
			quantity: prize.quantity - winners.length
		};
		await dataStore.save('prizes', updatedPrize as unknown as Record<string, unknown>);
	}

	/**
	 * Reveal winners based on selection mode
	 */
	private async revealWinners(): Promise<void> {
		const mode = settingsStore.selectionMode;
		const duration = settingsStore.displayDuration * 1000;
		const count = this._selectedWinners.length;

		if (mode === 'all-at-once') {
			this._revealedCount = count;
		} else {
			// Sequential or individual reveal
			for (let i = 0; i < count; i++) {
				this._revealedCount = i + 1;
				if (i < count - 1) {
					await new Promise((resolve) => setTimeout(resolve, duration));
				}
			}
		}
	}

	/**
	 * Reset selection state
	 */
	reset(): void {
		this._phase = 'idle';
		this._selectedWinners = [];
		this._revealedCount = 0;
		this._delayProgress = 0;
		this._error = null;
	}

	/**
	 * Cancel ongoing selection
	 */
	cancel(): void {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
		this.reset();
	}
}

// Export singleton instance
export const selectionStore = new SelectionStore();
