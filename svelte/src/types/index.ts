// ================================
// Core Data Types
// ================================

export interface ListEntry {
	id: string;
	index: number;
	data: Record<string, string | number | boolean | null>;
	sourceListId?: string;
	sourceListName?: string;
}

export interface ListMetadata {
	name: string;
	entryCount: number;
	timestamp: number;
	nameConfig: string;
	infoConfig: {
		info1?: string;
		info2?: string;
		info3?: string;
	};
	idConfig: {
		column: string;
	};
	isCombined: boolean;
	sourceListIds: string[];
	isListShard: boolean;
	parentListId?: string;
	removeWinnersFromList: boolean;
	preventWinningSamePrize: boolean;
	mpSource?: {
		queryId: string;
		params: Record<string, unknown>;
	};
	lastSyncAt?: number;
	syncCount?: number;
}

export interface List {
	listId: string;
	metadata: ListMetadata;
	entries: ListEntry[];
	isSharded: boolean;
	shardIds: string[];
	totalShards?: number;
	totalEntries?: number;
}

export interface Prize {
	prizeId: string;
	name: string;
	quantity: number;
	description?: string;
	winnersCount?: number;
	timestamp: number;
	templateId?: string;
}

export interface SMSStatus {
	status: 'pending' | 'sent' | 'failed' | 'none';
	messageId?: string;
	timestamp?: number;
}

export interface Winner {
	winnerId: string;
	entryId: string;
	displayName: string;
	prize: string;
	timestamp: number;
	listId: string;
	listName: string;
	historyId: string;
	pickedUp: boolean;
	pickupTimestamp?: number;
	pickupStation?: string;
	data: Record<string, string | number | boolean | null>;
	sms?: SMSStatus;
	contactInfo?: Record<string, string>;
}

export interface HistoryEntry {
	historyId: string;
	timestamp: number;
	listId: string;
	listName: string;
	prizeId: string;
	prizeName: string;
	winnersCount: number;
	winnerIds: string[];
}

// ================================
// Settings Types
// ================================

export type SelectionMode = 'all-at-once' | 'sequential' | 'individual';
export type DisplayEffect = 'fade-in' | 'slide-up' | 'scale-in' | 'none';
export type DelayVisualType = 'none' | 'spinner' | 'countdown' | 'progress' | 'dots' | 'animation' | 'swirl-animation' | 'christmas-snow';
export type CelebrationEffect = 'confetti' | 'coins' | 'both' | 'none';
export type BackgroundType = 'gradient' | 'solid' | 'image';
export type SoundOption = 'none' | 'drum-roll' | 'countdown' | 'sting-rimshot' | string;

export interface Settings {
	// General settings
	preventDuplicates: boolean;
	preventSamePrize: boolean;
	hideEntryCounts: boolean;
	enableDebugLogs: boolean;
	enableWebhook: boolean;
	webhookUrl: string;

	// Theme settings
	fontFamily: string;
	primaryColor: string;
	secondaryColor: string;
	selectionColor: string;
	backgroundType: BackgroundType;
	customBackgroundImage: string | null;

	// Selection display settings
	selectionMode: SelectionMode;
	displayEffect: DisplayEffect;
	displayDuration: number;
	stableGrid: boolean;
	preSelectionDelay: number;
	delayVisualType: DelayVisualType;

	// Sound settings
	soundDuringDelay: SoundOption;
	soundEndOfDelay: SoundOption;
	soundDuringReveal: SoundOption;

	// Celebration settings
	celebrationEffect: CelebrationEffect;
	celebrationDuration: number;
	celebrationAutoTrigger: boolean;

	// SMS Template
	smsTemplate: string;
}

// ================================
// API Types
// ================================

export type Collection = 'lists' | 'prizes' | 'winners' | 'history' | 'settings' | 'templates' | 'archive';

export interface BatchRequest {
	collection: Collection;
	id?: string;
}

export interface BatchSaveOperation {
	collection: Collection;
	data?: Record<string, unknown>;
	operation?: 'delete';
	id?: string;
}

export interface BatchFetchResult {
	[key: string]: unknown[];
}

// ================================
// UI State Types
// ================================

export type ViewType = 'public' | 'management';
export type TabId = 'quicksetup' | 'lists' | 'prizes' | 'templates' | 'winners' | 'history' | 'queries' | 'settings';

export interface LoadingState {
	lists: boolean;
	prizes: boolean;
	winners: boolean;
	history: boolean;
}

// ================================
// Selection Types
// ================================

export interface LastAction {
	type: 'selectWinners';
	winners: Winner[];
	removedEntries: ListEntry[];
	prizeId: string;
	prizeCount: number;
	historyId: string;
	entriesRemoved: boolean;
	sourceListIds?: string[];
}

export interface RandomWorkerMessage {
	type: 'select' | 'complete' | 'error';
	entries?: ListEntry[];
	numWinners?: number;
	seed?: number;
	result?: ListEntry[];
	error?: string;
}

// ================================
// Filter Types
// ================================

export type WinnerSortField = 'date' | 'name' | 'prize' | 'list' | 'pickup' | 'sms';
export type HistorySortField = 'date' | 'list' | 'prize' | 'count';
export type SortDirection = 'asc' | 'desc';

export interface WinnerFilters {
	filterPrize: string;
	filterList: string;
	filterBatch: string;
	filterDate: string;
	sortField: WinnerSortField;
	sortDir: SortDirection;
}

export interface HistoryFilters {
	filterList: string;
	filterPrize: string;
	filterDate: string;
	sortField: HistorySortField;
	sortDir: SortDirection;
}
