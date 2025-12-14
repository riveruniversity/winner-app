import { browser } from '$app/environment';
import { dataStore } from './data.svelte';
import type {
	Winner,
	HistoryEntry,
	WinnerSortField,
	HistorySortField,
	SortDirection
} from '$types';

/**
 * Helper to create a persisted filter value
 */
function persistedFilter(key: string, defaultValue: string): { value: string } {
	const stored = browser ? localStorage.getItem(key) : null;
	let value = $state(stored ?? defaultValue);

	$effect(() => {
		if (browser) {
			localStorage.setItem(key, value);
		}
	});

	return {
		get value() {
			return value;
		},
		set value(v: string) {
			value = v;
		}
	};
}

/**
 * Winners Filter Store
 * Manages filtering and sorting for winners list
 */
class WinnersFilterStore {
	// Filter state (persisted)
	private _filterPrize = persistedFilter('winners_filter_prize', '');
	private _filterList = persistedFilter('winners_filter_list', '');
	private _filterBatch = persistedFilter('winners_filter_batch', '');
	private _filterDate = persistedFilter('winners_filter_date', '');

	// Sort state (not persisted)
	sortField = $state<WinnerSortField>('date');
	sortDir = $state<SortDirection>('desc');

	// Getters/setters
	get filterPrize(): string {
		return this._filterPrize.value;
	}
	set filterPrize(value: string) {
		this._filterPrize.value = value;
	}

	get filterList(): string {
		return this._filterList.value;
	}
	set filterList(value: string) {
		this._filterList.value = value;
	}

	get filterBatch(): string {
		return this._filterBatch.value;
	}
	set filterBatch(value: string) {
		this._filterBatch.value = value;
	}

	get filterDate(): string {
		return this._filterDate.value;
	}
	set filterDate(value: string) {
		this._filterDate.value = value;
	}

	/**
	 * Computed: Filtered and sorted winners
	 */
	get filtered(): Winner[] {
		let results = [...dataStore.winners];

		// Apply filters
		if (this.filterPrize) {
			results = results.filter((w) => w.prize === this.filterPrize);
		}
		if (this.filterList) {
			results = results.filter((w) => w.listName === this.filterList);
		}
		if (this.filterBatch) {
			results = results.filter((w) => w.historyId === this.filterBatch);
		}
		if (this.filterDate) {
			results = results.filter((w) => {
				const winnerDate = new Date(w.timestamp).toISOString().split('T')[0];
				return winnerDate === this.filterDate;
			});
		}

		// Sort
		const dir = this.sortDir === 'asc' ? 1 : -1;
		results.sort((a, b) => {
			switch (this.sortField) {
				case 'date':
					return (a.timestamp - b.timestamp) * dir;
				case 'name':
					return a.displayName.localeCompare(b.displayName) * dir;
				case 'prize':
					return a.prize.localeCompare(b.prize) * dir;
				case 'list':
					return a.listName.localeCompare(b.listName) * dir;
				case 'pickup':
					return (Number(a.pickedUp) - Number(b.pickedUp)) * dir;
				case 'sms':
					return (a.sms?.status || '').localeCompare(b.sms?.status || '') * dir;
				default:
					return 0;
			}
		});

		return results;
	}

	/**
	 * Computed: Unique prize names from all winners
	 */
	get uniquePrizes(): string[] {
		return [...new Set(dataStore.winners.map((w) => w.prize))].sort();
	}

	/**
	 * Computed: Unique list names from all winners
	 */
	get uniqueLists(): string[] {
		return [...new Set(dataStore.winners.map((w) => w.listName))].sort();
	}

	/**
	 * Computed: Unique batches with labels
	 */
	get uniqueBatches(): Array<{ id: string; label: string }> {
		const batches = new Map<string, string>();
		for (const winner of dataStore.winners) {
			if (winner.historyId && !batches.has(winner.historyId)) {
				const date = new Date(winner.timestamp).toLocaleDateString();
				batches.set(winner.historyId, `${date} - ${winner.prize}`);
			}
		}
		return Array.from(batches.entries())
			.map(([id, label]) => ({ id, label }))
			.sort((a, b) => b.id.localeCompare(a.id));
	}

	/**
	 * Toggle sort field/direction
	 */
	toggleSort(field: WinnerSortField): void {
		if (this.sortField === field) {
			this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			this.sortField = field;
			this.sortDir = field === 'date' ? 'desc' : 'asc';
		}
	}

	/**
	 * Clear all filters
	 */
	clearFilters(): void {
		this.filterPrize = '';
		this.filterList = '';
		this.filterBatch = '';
		this.filterDate = '';
	}
}

/**
 * History Filter Store
 * Manages filtering and sorting for history list
 */
class HistoryFilterStore {
	// Filter state (persisted)
	private _filterList = persistedFilter('history_filter_list', '');
	private _filterPrize = persistedFilter('history_filter_prize', '');
	private _filterDate = persistedFilter('history_filter_date', '');

	// Sort state (not persisted)
	sortField = $state<HistorySortField>('date');
	sortDir = $state<SortDirection>('desc');

	// Getters/setters
	get filterList(): string {
		return this._filterList.value;
	}
	set filterList(value: string) {
		this._filterList.value = value;
	}

	get filterPrize(): string {
		return this._filterPrize.value;
	}
	set filterPrize(value: string) {
		this._filterPrize.value = value;
	}

	get filterDate(): string {
		return this._filterDate.value;
	}
	set filterDate(value: string) {
		this._filterDate.value = value;
	}

	/**
	 * Computed: Filtered and sorted history
	 */
	get filtered(): HistoryEntry[] {
		let results = [...dataStore.history];

		// Apply filters
		if (this.filterList) {
			results = results.filter((h) => h.listName === this.filterList);
		}
		if (this.filterPrize) {
			results = results.filter((h) => h.prizeName === this.filterPrize);
		}
		if (this.filterDate) {
			results = results.filter((h) => {
				const historyDate = new Date(h.timestamp).toISOString().split('T')[0];
				return historyDate === this.filterDate;
			});
		}

		// Sort
		const dir = this.sortDir === 'asc' ? 1 : -1;
		results.sort((a, b) => {
			switch (this.sortField) {
				case 'date':
					return (a.timestamp - b.timestamp) * dir;
				case 'list':
					return a.listName.localeCompare(b.listName) * dir;
				case 'prize':
					return a.prizeName.localeCompare(b.prizeName) * dir;
				case 'count':
					return (a.winnersCount - b.winnersCount) * dir;
				default:
					return 0;
			}
		});

		return results;
	}

	/**
	 * Computed: Unique list names from history
	 */
	get uniqueLists(): string[] {
		return [...new Set(dataStore.history.map((h) => h.listName))].sort();
	}

	/**
	 * Computed: Unique prize names from history
	 */
	get uniquePrizes(): string[] {
		return [...new Set(dataStore.history.map((h) => h.prizeName))].sort();
	}

	/**
	 * Computed: Statistics
	 */
	get stats(): { totalSelections: number; mostUsedPrize: string } {
		const history = dataStore.history;
		const prizeCount = new Map<string, number>();

		for (const h of history) {
			prizeCount.set(h.prizeName, (prizeCount.get(h.prizeName) || 0) + 1);
		}

		let mostUsedPrize = '';
		let maxCount = 0;
		for (const [prize, count] of prizeCount.entries()) {
			if (count > maxCount) {
				maxCount = count;
				mostUsedPrize = prize;
			}
		}

		return {
			totalSelections: history.length,
			mostUsedPrize
		};
	}

	/**
	 * Toggle sort field/direction
	 */
	toggleSort(field: HistorySortField): void {
		if (this.sortField === field) {
			this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			this.sortField = field;
			this.sortDir = field === 'date' ? 'desc' : 'asc';
		}
	}

	/**
	 * Clear all filters
	 */
	clearFilters(): void {
		this.filterList = '';
		this.filterPrize = '';
		this.filterDate = '';
	}
}

// Export singleton instances
export const winnersFilterStore = new WinnersFilterStore();
export const historyFilterStore = new HistoryFilterStore();
