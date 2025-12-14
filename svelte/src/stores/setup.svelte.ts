import { browser } from '$app/environment';
import { dataStore } from './data.svelte';
import { settingsStore } from './settings.svelte';

/**
 * Helper to create a persisted state value for setup
 */
function persisted<T>(key: string, defaultValue: T): { value: T } {
	const stored = browser ? localStorage.getItem(key) : null;
	let value = $state<T>(stored ? JSON.parse(stored) : defaultValue);

	$effect(() => {
		if (browser) {
			localStorage.setItem(key, JSON.stringify(value));
		}
	});

	return {
		get value() {
			return value;
		},
		set value(v: T) {
			value = v;
		}
	};
}

/**
 * Setup Store
 * Manages the quick setup selection state with derived/computed values
 */
class SetupStore {
	// Persisted selection state
	private _selectedListIds = persisted<string[]>('setup_selectedListIds', []);
	private _selectedPrizeId = persisted<string>('setup_selectedPrizeId', '');
	private _winnersCount = persisted<number>('setup_winnersCount', 1);

	// Getters/setters for the persisted values
	get selectedListIds(): string[] {
		return this._selectedListIds.value;
	}
	set selectedListIds(value: string[]) {
		this._selectedListIds.value = value;
	}

	get selectedPrizeId(): string {
		return this._selectedPrizeId.value;
	}
	set selectedPrizeId(value: string) {
		this._selectedPrizeId.value = value;
	}

	get winnersCount(): number {
		return this._winnersCount.value;
	}
	set winnersCount(value: number) {
		this._winnersCount.value = value;
	}

	/**
	 * Computed: Calculate eligible entries from selected lists
	 * Accounts for preventSamePrize exclusions
	 */
	get eligibleEntries(): number {
		// Calculate total entries from selected lists
		let total = this.selectedListIds.reduce((sum, listId) => {
			const list = dataStore.lists.find((l) => l.listId === listId);
			return sum + (list?.entries?.length || 0);
		}, 0);

		// If preventSamePrize is enabled and a prize is selected, calculate exclusions
		if (settingsStore.preventSamePrize.value && this.selectedPrizeId) {
			const prize = dataStore.prizes.find((p) => p.prizeId === this.selectedPrizeId);
			const prizeName = prize?.name;

			if (prizeName && dataStore.winners.length > 0) {
				// Find entry IDs that already won this prize
				const samePrizeWinnerEntryIds = new Set(
					dataStore.winners
						.filter((w) => w.prize === prizeName)
						.map((w) => w.entryId)
						.filter(Boolean)
				);

				if (samePrizeWinnerEntryIds.size > 0) {
					// Recount entries excluding same-prize winners
					let eligible = 0;
					for (const listId of this.selectedListIds) {
						const list = dataStore.lists.find((l) => l.listId === listId);
						if (list?.entries) {
							for (const entry of list.entries) {
								const entryId =
									entry.id ||
									(entry.data?.['Ticket Code'] as string) ||
									(entry.data?.ticketCode as string);
								if (!entryId || !samePrizeWinnerEntryIds.has(entryId)) {
									eligible++;
								}
							}
						}
					}
					total = eligible;
				}
			}
		}

		return total;
	}

	/**
	 * Computed: Count of entries excluded due to same prize
	 */
	get excludedCount(): number {
		if (!settingsStore.preventSamePrize.value || !this.selectedPrizeId) {
			return 0;
		}

		const prize = dataStore.prizes.find((p) => p.prizeId === this.selectedPrizeId);
		const prizeName = prize?.name;

		if (!prizeName || dataStore.winners.length === 0) {
			return 0;
		}

		const samePrizeWinnerEntryIds = new Set(
			dataStore.winners
				.filter((w) => w.prize === prizeName)
				.map((w) => w.entryId)
				.filter(Boolean)
		);

		let excluded = 0;
		for (const listId of this.selectedListIds) {
			const list = dataStore.lists.find((l) => l.listId === listId);
			if (list?.entries) {
				for (const entry of list.entries) {
					const entryId =
						entry.id ||
						(entry.data?.['Ticket Code'] as string) ||
						(entry.data?.ticketCode as string);
					if (entryId && samePrizeWinnerEntryIds.has(entryId)) {
						excluded++;
					}
				}
			}
		}

		return excluded;
	}

	/**
	 * Computed: Can start selection (has list and prize selected)
	 */
	get canStart(): boolean {
		return this.selectedListIds.length > 0 && !!this.selectedPrizeId;
	}

	/**
	 * Computed: Display text for selected list(s)
	 */
	get listDisplayText(): string {
		if (this.selectedListIds.length === 0) return 'Not Selected';
		if (this.selectedListIds.length === 1) {
			const list = dataStore.lists.find((l) => l.listId === this.selectedListIds[0]);
			return list?.metadata?.name || 'Unknown';
		}
		return `${this.selectedListIds.length} Lists Selected`;
	}

	/**
	 * Computed: Display text for selected prize
	 */
	get prizeDisplayText(): string {
		if (!this.selectedPrizeId) return 'Not Selected';
		const prize = dataStore.prizes.find((p) => p.prizeId === this.selectedPrizeId);
		return prize?.name || 'Not Selected';
	}

	/**
	 * Computed: Selected prize quantity
	 */
	get selectedPrizeQuantity(): number | null {
		if (!this.selectedPrizeId) return null;
		const prize = dataStore.prizes.find((p) => p.prizeId === this.selectedPrizeId);
		return prize?.quantity ?? null;
	}

	/**
	 * Computed: Winners count exceeds eligible entries
	 */
	get entriesExceeded(): boolean {
		if (this.selectedListIds.length === 0) return false;
		return this.winnersCount > this.eligibleEntries;
	}

	/**
	 * Computed: Winners count exceeds prize quantity
	 */
	get prizeQuantityExceeded(): boolean {
		const qty = this.selectedPrizeQuantity;
		if (qty === null) return false;
		return this.winnersCount > qty;
	}

	/**
	 * Computed: Has any validation warning
	 */
	get hasValidationWarning(): boolean {
		return this.entriesExceeded || this.prizeQuantityExceeded;
	}

	/**
	 * Computed: Count of selected lists that are still valid
	 */
	get validSelectedCount(): number {
		const validIds = dataStore.lists.map((l) => l.listId);
		return this.selectedListIds.filter((id) => validIds.includes(id)).length;
	}

	/**
	 * Check if a list is selected
	 */
	isListSelected(listId: string): boolean {
		return this.selectedListIds.includes(listId);
	}

	/**
	 * Toggle list selection
	 */
	toggleList(listId: string): void {
		if (this.selectedListIds.includes(listId)) {
			this.selectedListIds = this.selectedListIds.filter((id) => id !== listId);
		} else {
			this.selectedListIds = [...this.selectedListIds, listId];
		}
	}

	/**
	 * Select a list
	 */
	selectList(listId: string): void {
		if (!this.selectedListIds.includes(listId)) {
			this.selectedListIds = [...this.selectedListIds, listId];
		}
	}

	/**
	 * Deselect a list
	 */
	deselectList(listId: string): void {
		if (this.selectedListIds.includes(listId)) {
			this.selectedListIds = this.selectedListIds.filter((id) => id !== listId);
		}
	}

	/**
	 * Handle prize change - update winnersCount from prize default
	 */
	onPrizeChange(): void {
		if (this.selectedPrizeId) {
			const prize = dataStore.prizes.find((p) => p.prizeId === this.selectedPrizeId);
			if (prize?.winnersCount) {
				this.winnersCount = prize.winnersCount;
			}
		}
		this.capWinnersCount();
	}

	/**
	 * Cap winnersCount to not exceed eligibleEntries or prizeQuantity
	 */
	capWinnersCount(): void {
		// Cap to eligibleEntries if exceeded (and entries exist)
		if (this.eligibleEntries > 0 && this.winnersCount > this.eligibleEntries) {
			this.winnersCount = this.eligibleEntries;
		}
		// Cap to prize quantity if exceeded (and quantity is set)
		const prizeQty = this.selectedPrizeQuantity;
		if (prizeQty !== null && this.winnersCount > prizeQty) {
			this.winnersCount = prizeQty;
		}
	}

	/**
	 * Clear all selections
	 */
	clearSelections(): void {
		this.selectedListIds = [];
		this.selectedPrizeId = '';
		this.winnersCount = 1;
	}
}

// Export singleton instance
export const setupStore = new SetupStore();
