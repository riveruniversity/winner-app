import { browser } from '$app/environment';
import { persistedState } from 'svelte-persisted-state';
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
 * Settings Store
 * All settings are persisted to localStorage using svelte-persisted-state
 */
class SettingsStore {
	// General settings
	private _preventDuplicates = persistedState('settings_preventDuplicates', false);
	private _preventSamePrize = persistedState('settings_preventSamePrize', false);
	private _hideEntryCounts = persistedState('settings_hideEntryCounts', false);
	private _enableDebugLogs = persistedState('settings_enableDebugLogs', false);
	private _enableWebhook = persistedState('settings_enableWebhook', false);
	private _webhookUrl = persistedState('settings_webhookUrl', '');

	// Theme settings
	private _fontFamily = persistedState('settings_fontFamily', 'Open Sans');
	private _primaryColor = persistedState('settings_primaryColor', '#6366f1');
	private _secondaryColor = persistedState('settings_secondaryColor', '#8b5cf6');
	private _selectionColor = persistedState('settings_selectionColor', '#10b981');
	private _backgroundType = persistedState<BackgroundType>('settings_backgroundType', 'gradient');
	private _customBackgroundImage = persistedState<string | null>(
		'settings_customBackgroundImage',
		null
	);

	// Selection display settings
	private _selectionMode = persistedState<SelectionMode>('settings_selectionMode', 'all-at-once');
	private _displayEffect = persistedState<DisplayEffect>('settings_displayEffect', 'fade-in');
	private _displayDuration = persistedState('settings_displayDuration', 0.5);
	private _stableGrid = persistedState('settings_stableGrid', false);
	private _preSelectionDelay = persistedState('settings_preSelectionDelay', 0);
	private _delayVisualType = persistedState<DelayVisualType>('settings_delayVisualType', 'none');

	// Sound settings
	private _soundDuringDelay = persistedState<SoundOption>('settings_soundDuringDelay', 'none');
	private _soundEndOfDelay = persistedState<SoundOption>('settings_soundEndOfDelay', 'none');
	private _soundDuringReveal = persistedState<SoundOption>('settings_soundDuringReveal', 'none');

	// Celebration settings
	private _celebrationEffect = persistedState<CelebrationEffect>(
		'settings_celebrationEffect',
		'confetti'
	);
	private _celebrationDuration = persistedState('settings_celebrationDuration', 4);
	private _celebrationAutoTrigger = persistedState('settings_celebrationAutoTrigger', true);

	// SMS Template
	private _smsTemplate = persistedState(
		'settings_smsTemplate',
		'Congratulations {name}! You won {prize}. Your code: {contactId}'
	);

	// Getters and setters using .current property

	get preventDuplicates() {
		return this._preventDuplicates.current;
	}
	set preventDuplicates(v: boolean) {
		this._preventDuplicates.current = v;
	}

	get preventSamePrize() {
		return this._preventSamePrize.current;
	}
	set preventSamePrize(v: boolean) {
		this._preventSamePrize.current = v;
	}

	get hideEntryCounts() {
		return this._hideEntryCounts.current;
	}
	set hideEntryCounts(v: boolean) {
		this._hideEntryCounts.current = v;
	}

	get enableDebugLogs() {
		return this._enableDebugLogs.current;
	}
	set enableDebugLogs(v: boolean) {
		this._enableDebugLogs.current = v;
	}

	get enableWebhook() {
		return this._enableWebhook.current;
	}
	set enableWebhook(v: boolean) {
		this._enableWebhook.current = v;
	}

	get webhookUrl() {
		return this._webhookUrl.current;
	}
	set webhookUrl(v: string) {
		this._webhookUrl.current = v;
	}

	get fontFamily() {
		return this._fontFamily.current;
	}
	set fontFamily(v: string) {
		this._fontFamily.current = v;
	}

	get primaryColor() {
		return this._primaryColor.current;
	}
	set primaryColor(v: string) {
		this._primaryColor.current = v;
	}

	get secondaryColor() {
		return this._secondaryColor.current;
	}
	set secondaryColor(v: string) {
		this._secondaryColor.current = v;
	}

	get selectionColor() {
		return this._selectionColor.current;
	}
	set selectionColor(v: string) {
		this._selectionColor.current = v;
	}

	get backgroundType() {
		return this._backgroundType.current;
	}
	set backgroundType(v: BackgroundType) {
		this._backgroundType.current = v;
	}

	get customBackgroundImage() {
		return this._customBackgroundImage.current;
	}
	set customBackgroundImage(v: string | null) {
		this._customBackgroundImage.current = v;
	}

	get selectionMode() {
		return this._selectionMode.current;
	}
	set selectionMode(v: SelectionMode) {
		this._selectionMode.current = v;
	}

	get displayEffect() {
		return this._displayEffect.current;
	}
	set displayEffect(v: DisplayEffect) {
		this._displayEffect.current = v;
	}

	get displayDuration() {
		return this._displayDuration.current;
	}
	set displayDuration(v: number) {
		this._displayDuration.current = v;
	}

	get stableGrid() {
		return this._stableGrid.current;
	}
	set stableGrid(v: boolean) {
		this._stableGrid.current = v;
	}

	get preSelectionDelay() {
		return this._preSelectionDelay.current;
	}
	set preSelectionDelay(v: number) {
		this._preSelectionDelay.current = v;
	}

	get delayVisualType() {
		return this._delayVisualType.current;
	}
	set delayVisualType(v: DelayVisualType) {
		this._delayVisualType.current = v;
	}

	get soundDuringDelay() {
		return this._soundDuringDelay.current;
	}
	set soundDuringDelay(v: SoundOption) {
		this._soundDuringDelay.current = v;
	}

	get soundEndOfDelay() {
		return this._soundEndOfDelay.current;
	}
	set soundEndOfDelay(v: SoundOption) {
		this._soundEndOfDelay.current = v;
	}

	get soundDuringReveal() {
		return this._soundDuringReveal.current;
	}
	set soundDuringReveal(v: SoundOption) {
		this._soundDuringReveal.current = v;
	}

	get celebrationEffect() {
		return this._celebrationEffect.current;
	}
	set celebrationEffect(v: CelebrationEffect) {
		this._celebrationEffect.current = v;
	}

	get celebrationDuration() {
		return this._celebrationDuration.current;
	}
	set celebrationDuration(v: number) {
		this._celebrationDuration.current = v;
	}

	get celebrationAutoTrigger() {
		return this._celebrationAutoTrigger.current;
	}
	set celebrationAutoTrigger(v: boolean) {
		this._celebrationAutoTrigger.current = v;
	}

	get smsTemplate() {
		return this._smsTemplate.current;
	}
	set smsTemplate(v: string) {
		this._smsTemplate.current = v;
	}

	/**
	 * Apply theme settings to CSS variables
	 */
	applyTheme(): void {
		if (!browser) return;

		document.documentElement.style.setProperty('--bs-primary', this.primaryColor);
		document.documentElement.style.setProperty('--color-primary', this.primaryColor);
		document.documentElement.style.setProperty('--color-secondary', this.secondaryColor);
		document.documentElement.style.setProperty('--selection-color', this.selectionColor);
		document.documentElement.style.setProperty('--font-family', this.fontFamily);
		document.body.style.fontFamily = `'${this.fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
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
			preventDuplicates: this.preventDuplicates,
			preventSamePrize: this.preventSamePrize,
			hideEntryCounts: this.hideEntryCounts,
			enableDebugLogs: this.enableDebugLogs,
			enableWebhook: this.enableWebhook,
			webhookUrl: this.webhookUrl,
			fontFamily: this.fontFamily,
			primaryColor: this.primaryColor,
			secondaryColor: this.secondaryColor,
			selectionColor: this.selectionColor,
			backgroundType: this.backgroundType,
			customBackgroundImage: this.customBackgroundImage,
			selectionMode: this.selectionMode,
			displayEffect: this.displayEffect,
			displayDuration: this.displayDuration,
			stableGrid: this.stableGrid,
			preSelectionDelay: this.preSelectionDelay,
			delayVisualType: this.delayVisualType,
			soundDuringDelay: this.soundDuringDelay,
			soundEndOfDelay: this.soundEndOfDelay,
			soundDuringReveal: this.soundDuringReveal,
			celebrationEffect: this.celebrationEffect,
			celebrationDuration: this.celebrationDuration,
			celebrationAutoTrigger: this.celebrationAutoTrigger,
			smsTemplate: this.smsTemplate
		};
	}

	/**
	 * Reset all settings to defaults
	 */
	resetAll(): void {
		this._preventDuplicates.reset();
		this._preventSamePrize.reset();
		this._hideEntryCounts.reset();
		this._enableDebugLogs.reset();
		this._enableWebhook.reset();
		this._webhookUrl.reset();
		this._fontFamily.reset();
		this._primaryColor.reset();
		this._secondaryColor.reset();
		this._selectionColor.reset();
		this._backgroundType.reset();
		this._customBackgroundImage.reset();
		this._selectionMode.reset();
		this._displayEffect.reset();
		this._displayDuration.reset();
		this._stableGrid.reset();
		this._preSelectionDelay.reset();
		this._delayVisualType.reset();
		this._soundDuringDelay.reset();
		this._soundEndOfDelay.reset();
		this._soundDuringReveal.reset();
		this._celebrationEffect.reset();
		this._celebrationDuration.reset();
		this._celebrationAutoTrigger.reset();
		this._smsTemplate.reset();
	}
}

// Export singleton instance
export const settingsStore = new SettingsStore();
