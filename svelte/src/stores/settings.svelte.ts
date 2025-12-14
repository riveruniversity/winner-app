import { browser } from '$app/environment';
import { apiClient } from '$api/client';
import type {
	SelectionMode,
	DisplayEffect,
	DelayVisualType,
	CelebrationEffect,
	BackgroundType,
	SoundOption
} from '$types';

/**
 * Helper to create a persisted state value
 * Syncs to localStorage automatically via $effect
 */
function persisted<T>(key: string, defaultValue: T): { value: T } {
	// Initialize from localStorage or default
	const stored = browser ? localStorage.getItem(key) : null;
	let value = $state<T>(stored ? JSON.parse(stored) : defaultValue);

	// Sync to localStorage on changes
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
 * Settings Store
 * All settings are persisted to localStorage with automatic sync
 */
class SettingsStore {
	// General settings
	preventDuplicates = persisted<boolean>('settings_preventDuplicates', false);
	preventSamePrize = persisted<boolean>('settings_preventSamePrize', false);
	hideEntryCounts = persisted<boolean>('settings_hideEntryCounts', false);
	enableDebugLogs = persisted<boolean>('settings_enableDebugLogs', false);
	enableWebhook = persisted<boolean>('settings_enableWebhook', false);
	webhookUrl = persisted<string>('settings_webhookUrl', '');

	// Theme settings
	fontFamily = persisted<string>('settings_fontFamily', 'Open Sans');
	primaryColor = persisted<string>('settings_primaryColor', '#6366f1');
	secondaryColor = persisted<string>('settings_secondaryColor', '#8b5cf6');
	selectionColor = persisted<string>('settings_selectionColor', '#10b981');
	backgroundType = persisted<BackgroundType>('settings_backgroundType', 'gradient');
	customBackgroundImage = persisted<string | null>('settings_customBackgroundImage', null);

	// Selection display settings
	selectionMode = persisted<SelectionMode>('settings_selectionMode', 'all-at-once');
	displayEffect = persisted<DisplayEffect>('settings_displayEffect', 'fade-in');
	displayDuration = persisted<number>('settings_displayDuration', 0.5);
	stableGrid = persisted<boolean>('settings_stableGrid', false);
	preSelectionDelay = persisted<number>('settings_preSelectionDelay', 0);
	delayVisualType = persisted<DelayVisualType>('settings_delayVisualType', 'none');

	// Sound settings
	soundDuringDelay = persisted<SoundOption>('settings_soundDuringDelay', 'none');
	soundEndOfDelay = persisted<SoundOption>('settings_soundEndOfDelay', 'none');
	soundDuringReveal = persisted<SoundOption>('settings_soundDuringReveal', 'none');

	// Celebration settings
	celebrationEffect = persisted<CelebrationEffect>('settings_celebrationEffect', 'confetti');
	celebrationDuration = persisted<number>('settings_celebrationDuration', 4);
	celebrationAutoTrigger = persisted<boolean>('settings_celebrationAutoTrigger', true);

	// SMS Template
	smsTemplate = persisted<string>(
		'settings_smsTemplate',
		'Congratulations {name}! You won {prize}. Your code: {contactId}'
	);

	/**
	 * Apply theme settings to CSS variables
	 */
	applyTheme(): void {
		if (!browser) return;

		document.documentElement.style.setProperty('--bs-primary', this.primaryColor.value);
		document.documentElement.style.setProperty('--color-primary', this.primaryColor.value);
		document.documentElement.style.setProperty('--color-secondary', this.secondaryColor.value);
		document.documentElement.style.setProperty('--selection-color', this.selectionColor.value);
		document.documentElement.style.setProperty('--font-family', this.fontFamily.value);
		document.body.style.fontFamily = `'${this.fontFamily.value}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
	}

	/**
	 * Save a single setting to the backend
	 */
	async saveSingleSetting(key: string, value: unknown): Promise<void> {
		await apiClient.saveSettings(key, value);
	}

	/**
	 * Save multiple settings to the backend
	 */
	async saveMultipleSettings(settings: Record<string, unknown>): Promise<void> {
		for (const [key, value] of Object.entries(settings)) {
			await this.saveSingleSetting(key, value);
		}
	}

	/**
	 * Get all settings as a plain object
	 */
	getAllSettings(): Record<string, unknown> {
		return {
			preventDuplicates: this.preventDuplicates.value,
			preventSamePrize: this.preventSamePrize.value,
			hideEntryCounts: this.hideEntryCounts.value,
			enableDebugLogs: this.enableDebugLogs.value,
			enableWebhook: this.enableWebhook.value,
			webhookUrl: this.webhookUrl.value,
			fontFamily: this.fontFamily.value,
			primaryColor: this.primaryColor.value,
			secondaryColor: this.secondaryColor.value,
			selectionColor: this.selectionColor.value,
			backgroundType: this.backgroundType.value,
			customBackgroundImage: this.customBackgroundImage.value,
			selectionMode: this.selectionMode.value,
			displayEffect: this.displayEffect.value,
			displayDuration: this.displayDuration.value,
			stableGrid: this.stableGrid.value,
			preSelectionDelay: this.preSelectionDelay.value,
			delayVisualType: this.delayVisualType.value,
			soundDuringDelay: this.soundDuringDelay.value,
			soundEndOfDelay: this.soundEndOfDelay.value,
			soundDuringReveal: this.soundDuringReveal.value,
			celebrationEffect: this.celebrationEffect.value,
			celebrationDuration: this.celebrationDuration.value,
			celebrationAutoTrigger: this.celebrationAutoTrigger.value,
			smsTemplate: this.smsTemplate.value
		};
	}
}

// Export singleton instance
export const settingsStore = new SettingsStore();
