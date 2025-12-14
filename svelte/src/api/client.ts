import type {
	Collection,
	BatchRequest,
	BatchSaveOperation,
	BatchFetchResult,
	List,
	Prize,
	Winner,
	HistoryEntry
} from '$types';

// API base path - use relative path to work from any base URL
const API_BASE = '/api';

// Key field mapping for each collection
const KEY_FIELDS: Record<string, string> = {
	lists: 'listId',
	winners: 'winnerId',
	prizes: 'prizeId',
	history: 'historyId',
	settings: 'key',
	backups: 'backupId',
	templates: 'templateId',
	archive: 'listId'
};

function getKeyField(collection: string): string {
	return KEY_FIELDS[collection] || 'id';
}

class APIClient {
	/**
	 * Generic fetch wrapper with error handling
	 */
	private async fetch<T>(url: string, options?: RequestInit): Promise<T> {
		const response = await fetch(url, {
			headers: {
				'Content-Type': 'application/json',
				...options?.headers
			},
			...options
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Get single document or all documents from a collection
	 */
	async get<T>(collection: Collection, id?: string): Promise<T | T[] | null> {
		try {
			if (id) {
				const url = `${API_BASE}/${collection}/${id}`;
				const response = await fetch(url);

				if (response.status === 404) {
					return null;
				}

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				return response.json();
			}

			// Get all documents
			const response = await fetch(`${API_BASE}/${collection}`);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return response.json();
		} catch (error) {
			console.error(`Error getting from ${collection}:`, error);
			// Return empty array if API is unavailable - app should work with defaults
			return [];
		}
	}

	/**
	 * Get all lists
	 */
	async getLists(): Promise<List[]> {
		return (await this.get<List>('lists')) as List[];
	}

	/**
	 * Get single list by ID
	 */
	async getList(listId: string): Promise<List | null> {
		return (await this.get<List>('lists', listId)) as List | null;
	}

	/**
	 * Get all prizes
	 */
	async getPrizes(): Promise<Prize[]> {
		return (await this.get<Prize>('prizes')) as Prize[];
	}

	/**
	 * Get single prize by ID
	 */
	async getPrize(prizeId: string): Promise<Prize | null> {
		return (await this.get<Prize>('prizes', prizeId)) as Prize | null;
	}

	/**
	 * Get all winners
	 */
	async getWinners(): Promise<Winner[]> {
		return (await this.get<Winner>('winners')) as Winner[];
	}

	/**
	 * Get single winner by ID
	 */
	async getWinner(winnerId: string): Promise<Winner | null> {
		return (await this.get<Winner>('winners', winnerId)) as Winner | null;
	}

	/**
	 * Get all history entries
	 */
	async getHistory(): Promise<HistoryEntry[]> {
		return (await this.get<HistoryEntry>('history')) as HistoryEntry[];
	}

	/**
	 * Save document to collection
	 */
	async save(collection: Collection, data: Record<string, unknown>): Promise<string> {
		const keyField = getKeyField(collection);
		const docId = data[keyField] as string;

		if (!docId) {
			throw new Error(`Document must have a '${keyField}' field`);
		}

		const result = await this.fetch<{ id: string }>(`${API_BASE}/${collection}`, {
			method: 'POST',
			body: JSON.stringify(data)
		});

		return result.id || docId;
	}

	/**
	 * Delete document from collection
	 */
	async delete(collection: Collection, id: string): Promise<string> {
		const response = await fetch(`${API_BASE}/${collection}/${id}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return id;
	}

	/**
	 * Update specific fields in a winner document
	 */
	async updateWinner(winnerId: string, updateData: Partial<Winner>): Promise<Winner> {
		const existingWinner = await this.getWinner(winnerId);
		if (!existingWinner) {
			throw new Error(`Winner ${winnerId} not found`);
		}

		const updatedWinner: Winner = {
			...existingWinner,
			...updateData
		};

		await this.save('winners', updatedWinner as unknown as Record<string, unknown>);
		return updatedWinner;
	}

	/**
	 * Batch fetch multiple collections in a single request
	 */
	async batchFetch(requests: BatchRequest[]): Promise<BatchFetchResult> {
		try {
			const response = await fetch(`${API_BASE}/batch`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ requests })
			});

			if (!response.ok) {
				throw new Error(`Failed to batch fetch: ${response.statusText}`);
			}

			return response.json();
		} catch (error) {
			console.error('Error in batch fetch:', error);
			// Return empty results if API is unavailable
			const emptyResults: BatchFetchResult = {};
			requests.forEach((req) => {
				emptyResults[req.collection] = [];
			});
			return emptyResults;
		}
	}

	/**
	 * Batch save multiple documents in a single request
	 */
	async batchSave(operations: BatchSaveOperation[]): Promise<{ success: boolean }> {
		const response = await fetch(`${API_BASE}/batch-save`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ operations })
		});

		if (!response.ok) {
			throw new Error(`Failed to batch save: ${response.statusText}`);
		}

		return response.json();
	}

	/**
	 * Archive a list (save metadata to archive, delete original)
	 */
	async archiveList(listId: string): Promise<void> {
		const list = await this.getList(listId);
		if (!list) {
			throw new Error(`List ${listId} not found`);
		}

		// Create archive entry with metadata only (no entries)
		const archiveEntry = {
			listId: list.listId,
			metadata: { ...list.metadata },
			archivedAt: Date.now()
		};

		// Save to archive collection
		await this.save('archive', archiveEntry);

		// Delete original list
		await this.delete('lists', listId);
	}

	/**
	 * Save settings to backend
	 */
	async saveSettings(key: string, value: unknown): Promise<void> {
		await this.save('settings', { key, value, timestamp: Date.now() });
	}

	/**
	 * Check API health
	 */
	async checkHealth(): Promise<boolean> {
		try {
			const response = await fetch(`${API_BASE}/health`);
			return response.ok;
		} catch {
			return false;
		}
	}
}

// Export singleton instance
export const apiClient = new APIClient();
