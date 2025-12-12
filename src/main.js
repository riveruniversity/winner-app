import { initializeApp, loadHistory, appModal, setCurrentList, setLastAction } from './js/app.js';
import { UI } from './js/modules/ui.js';
import { Settings } from './js/modules/settings.js';

// Make Settings available globally for Alpine store bridge
window.Settings = Settings;

// Wait for Alpine to be ready before initializing
function waitForAlpine() {
  return new Promise((resolve) => {
    if (window.Alpine && Alpine.store('settings')) {
      resolve();
      return;
    }
    const checkInterval = setInterval(() => {
      if (window.Alpine && Alpine.store('settings')) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 50);
  });
}

// Bridge Alpine stores with existing modules
function bridgeAlpineStores() {
  // Connect Settings store save method to actual Settings module
  const settingsStore = Alpine.store('settings');
  settingsStore.save = async (key) => {
    await Settings.saveSingleSetting(key, settingsStore[key]);
  };

  // Load server settings into Alpine store
  settingsStore.loadFromServer = async () => {
    // Settings are already loaded by initializeApp, sync to Alpine store
    const currentSettings = Settings.data;
    if (currentSettings) {
      Object.keys(currentSettings).forEach(key => {
        if (settingsStore.hasOwnProperty(key)) {
          settingsStore[key] = currentSettings[key];
        }
      });
    }
  };
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function () {
  try {
    // Wait for Alpine.js to be ready
    await waitForAlpine();

    // Initialize Bootstrap tooltips for all elements with title attribute
    const tooltipTriggerList = document.querySelectorAll('[title]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => {
      // Use bottom placement for public interface tooltips
      const isPublicInterface = tooltipTriggerEl.closest('#publicInterface');
      return new bootstrap.Tooltip(tooltipTriggerEl, {
        placement: isPublicInterface ? 'bottom' : 'top',
        trigger: 'hover focus'
      });
    });

    // Initialize the app (loads settings, database, etc.)
    await initializeApp();

    // Bridge Alpine stores with existing modules
    bridgeAlpineStores();

    // Sync loaded settings to Alpine store
    const settingsStore = Alpine.store('settings');
    if (settingsStore && settingsStore.loadFromServer) {
      await settingsStore.loadFromServer();
    }

    UI.showToast('Application loaded', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    UI.showToast('Failed to initialize application: ' + error.message, 'error');
  }
});

