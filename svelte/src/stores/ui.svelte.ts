import { browser } from '$app/environment';
import { persistedState } from 'svelte-persisted-state';
import type { ViewType, TabId } from '$types';

/**
 * UI Store
 * Manages UI navigation and progress state
 * Uses svelte-persisted-state for localStorage persistence
 */
class UIStore {
	// Persisted navigation state
	private _view = persistedState<ViewType>('ui_view', 'public');
	private _currentTab = persistedState<TabId>('ui_currentTab', 'quicksetup');

	// Progress overlay state (NOT persisted - transient UI state)
	private _showProgress = $state(false);
	private _progressTitle = $state('Processing...');
	private _progressText = $state('Please wait...');
	private _progressPercent = $state(0);

	// Getters/setters for persisted values
	get view(): ViewType {
		return this._view.current;
	}
	set view(value: ViewType) {
		this._view.current = value;
	}

	get currentTab(): TabId {
		return this._currentTab.current;
	}
	set currentTab(value: TabId) {
		this._currentTab.current = value;
	}

	// Getters/setters for transient progress state
	get showProgress(): boolean {
		return this._showProgress;
	}
	set showProgress(value: boolean) {
		this._showProgress = value;
	}

	get progressTitle(): string {
		return this._progressTitle;
	}
	set progressTitle(value: string) {
		this._progressTitle = value;
	}

	get progressText(): string {
		return this._progressText;
	}
	set progressText(value: string) {
		this._progressText = value;
	}

	get progressPercent(): number {
		return this._progressPercent;
	}
	set progressPercent(value: number) {
		this._progressPercent = value;
	}

	/**
	 * Switch to management view
	 */
	showManagement(): void {
		this.view = 'management';
	}

	/**
	 * Switch to public view and reset tab
	 */
	showPublic(): void {
		this.view = 'public';
		this.currentTab = 'quicksetup';
	}

	/**
	 * Set the current tab
	 */
	setTab(tabId: TabId): void {
		this.currentTab = tabId;
	}

	/**
	 * Start progress overlay
	 */
	startProgress(title: string, text: string = 'Please wait...'): void {
		this.progressTitle = title;
		this.progressText = text;
		this.progressPercent = 0;
		this.showProgress = true;
	}

	/**
	 * Update progress state
	 */
	updateProgress(percent: number, text?: string): void {
		this.progressPercent = percent;
		if (text) {
			this.progressText = text;
		}
	}

	/**
	 * End progress overlay
	 */
	endProgress(): void {
		this.showProgress = false;
		this.progressPercent = 0;
	}

	/**
	 * Utility to trigger a modal by clicking its button
	 */
	openModal(buttonId: string): void {
		if (browser) {
			const button = document.getElementById(buttonId);
			if (button) {
				button.click();
			}
		}
	}

	/**
	 * Restore Bootstrap tab on management view
	 */
	async restoreTab(): Promise<void> {
		if (!browser || this.view !== 'management') return;

		// Wait for DOM to be ready
		await new Promise((resolve) => setTimeout(resolve, 100));

		const tabTrigger = document.querySelector(`[data-bs-target="#${this.currentTab}"]`);
		if (tabTrigger) {
			const bootstrap = await import('bootstrap');
			const tab = bootstrap.Tab.getOrCreateInstance(tabTrigger);
			tab.show();
		}
	}

	/**
	 * Reset navigation to defaults
	 */
	resetNavigation(): void {
		this._view.reset();
		this._currentTab.reset();
	}
}

// Export singleton instance
export const uiStore = new UIStore();
