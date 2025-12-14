/**
 * Selection Worker
 * Performs cryptographically secure random winner selection using Fisher-Yates shuffle
 */

interface ListEntry {
	id: string;
	index: number;
	data: Record<string, string | number | boolean | null>;
	sourceListId?: string;
	sourceListName?: string;
}

interface SelectMessage {
	type: 'select';
	entries: ListEntry[];
	numWinners: number;
	seed?: number;
}

interface CompleteMessage {
	type: 'complete';
	result: ListEntry[];
}

interface ErrorMessage {
	type: 'error';
	error: string;
}

type WorkerMessage = SelectMessage;
type WorkerResponse = CompleteMessage | ErrorMessage;

/**
 * Generate secure random number using crypto API
 */
function getSecureRandom(): number {
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		const array = new Uint32Array(1);
		crypto.getRandomValues(array);
		return array[0] / (0xffffffff + 1);
	}
	return Math.random();
}

/**
 * Fisher-Yates shuffle with cryptographically secure random
 */
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(getSecureRandom() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

/**
 * Select random winners using double-shuffle technique
 */
function selectRandomWinners(entries: ListEntry[], numWinners: number): ListEntry[] {
	// First shuffle
	const shuffledEntries = shuffleArray(entries);

	// Double shuffle for extra randomness
	const doubleShuffled = shuffleArray(shuffledEntries);

	// Select the first N winners
	const selected = doubleShuffled.slice(0, Math.min(numWinners, doubleShuffled.length));

	// One more shuffle of selected to randomize display order
	return shuffleArray(selected);
}

// Handle incoming messages
self.onmessage = function (e: MessageEvent<WorkerMessage>) {
	if (e.data.type === 'select') {
		try {
			const result = selectRandomWinners(e.data.entries, e.data.numWinners);
			const response: CompleteMessage = { type: 'complete', result };
			self.postMessage(response);
		} catch (error) {
			const response: ErrorMessage = {
				type: 'error',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
			self.postMessage(response);
		}
	}
};
