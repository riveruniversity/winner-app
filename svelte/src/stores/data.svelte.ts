import { apiClient } from '$api/client';
import type { List, Prize, Winner, HistoryEntry, LoadingState } from '$types';

// ID field mapping for each collection
const ID_FIELDS = {
	lists: 'listId',
	prizes: 'prizeId',
	winners: 'winnerId',
	history: 'historyId'
} as const;

type CollectionName = keyof typeof ID_FIELDS;

/**
 * Centralized Data Store
 * Single source of truth for all data operations using Svelte 5 runes
 */
class DataStore {
	// Reactive state using $state rune
	lists = $state<List[]>([]);
	prizes = $state<Prize[]>([]);
	winners = $state<Winner[]>([]);
	history = $state<HistoryEntry[]>([]);

	loading = $state<LoadingState>({
		lists: false,
		prizes: false,
		winners: false,
		history: false
	});

	/**
	 * Load a single collection from the API
	 */
	async load(collection: CollectionName): Promise<void> {
		this.loading[collection] = true;
		try {
			switch (collection) {
				case 'lists':
					this.lists = await apiClient.getLists();
					break;
				case 'prizes':
					this.prizes = await apiClient.getPrizes();
					break;
				case 'winners':
					this.winners = await apiClient.getWinners();
					break;
				case 'history':
					this.history = await apiClient.getHistory();
					break;
			}
		} catch (error) {
			console.error(`Error loading ${collection}:`, error);
			throw error; // Fail-fast philosophy
		} finally {
			this.loading[collection] = false;
		}
	}

	/**
	 * Load all collections in parallel
	 */
	async loadAll(): Promise<void> {
		await Promise.all([
			this.load('lists'),
			this.load('prizes'),
			this.load('winners'),
			this.load('history')
		]);
	}

	/**
	 * Save an item to a collection and reload
	 */
	async save(collection: CollectionName, item: Record<string, unknown>): Promise<void> {
		await apiClient.save(collection, item);
		await this.load(collection);
	}

	/**
	 * Delete an item from a collection and reload
	 */
	async delete(collection: CollectionName, id: string): Promise<void> {
		await apiClient.delete(collection, id);
		await this.load(collection);
	}

	/**
	 * Get an item by ID from a collection
	 */
	getById<T extends List | Prize | Winner | HistoryEntry>(
		collection: CollectionName,
		id: string
	): T | undefined {
		const idField = ID_FIELDS[collection];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const items = this[collection] as any[];
		return items.find((item) => item[idField] === id) as T | undefined;
	}

	/**
	 * Get a list by ID
	 */
	getListById(listId: string): List | undefined {
		return this.lists.find((l) => l.listId === listId);
	}

	/**
	 * Get a prize by ID
	 */
	getPrizeById(prizeId: string): Prize | undefined {
		return this.prizes.find((p) => p.prizeId === prizeId);
	}

	/**
	 * Get a winner by ID
	 */
	getWinnerById(winnerId: string): Winner | undefined {
		return this.winners.find((w) => w.winnerId === winnerId);
	}

	/**
	 * Get history entry by ID
	 */
	getHistoryById(historyId: string): HistoryEntry | undefined {
		return this.history.find((h) => h.historyId === historyId);
	}

	/**
	 * Update a winner's pickup status
	 */
	async toggleWinnerPickup(winnerId: string): Promise<void> {
		const winner = this.getWinnerById(winnerId);
		if (!winner) {
			throw new Error(`Winner ${winnerId} not found`);
		}

		const updatedWinner = {
			...winner,
			pickedUp: !winner.pickedUp,
			pickupTimestamp: !winner.pickedUp ? Date.now() : undefined,
			pickupStation: !winner.pickedUp ? 'Manual' : undefined
		};

		await this.save('winners', updatedWinner as unknown as Record<string, unknown>);
	}

	/**
	 * Update winner SMS status
	 */
	async updateWinnerSmsStatus(
		winnerId: string,
		status: 'pending' | 'sent' | 'failed' | 'none',
		messageId?: string
	): Promise<void> {
		const winner = this.getWinnerById(winnerId);
		if (!winner) {
			throw new Error(`Winner ${winnerId} not found`);
		}

		const updatedWinner = {
			...winner,
			sms: {
				status,
				messageId,
				timestamp: Date.now()
			}
		};

		await this.save('winners', updatedWinner as unknown as Record<string, unknown>);
	}
}

// Export singleton instance
export const dataStore = new DataStore();
