import { browser } from '$app/environment';
import type { ViewType, TabId } from '$types';

/**
 * Helper to create a persisted state value
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
 * UI Store
 * Manages UI navigation and progress state
 */
class UIStore {
	// Persisted navigation state
	private _view = persisted<ViewType>('ui_view', 'public');
	private _currentTab = persisted<TabId>('ui_currentTab', 'quicksetup');

	// Progress overlay state (NOT persisted)
	showProgress = $state(false);
	progressTitle = $state('Processing...');
	progressText = $state('Please wait...');
	progressPercent = $state(0);

	// Getters/setters for persisted values
	get view(): ViewType {
		return this._view.value;
	}
	set view(value: ViewType) {
		this._view.value = value;
	}

	get currentTab(): TabId {
		return this._currentTab.value;
	}
	set currentTab(value: TabId) {
		this._currentTab.value = value;
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
}

// Export singleton instance
export const uiStore = new UIStore();
