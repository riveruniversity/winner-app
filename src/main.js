import { initializeApp, loadHistory, updateHistoryStats, appModal, setCurrentList, setLastAction } from './js/app.js';
import { UI } from './js/modules/ui.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', async function () {
  try {
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
    
    // Initialize database and load settings are now handled within initializeApp
    
    // Initialize the app
    await initializeApp();
    
    // Setup event listeners (these are still in app.js for now)
    // setupEventListeners(); // This function is internal to app.js
    
    // Setup theme (this is still in app.js for now)
    // Settings.setupTheme(); // This function is internal to app.js
    
    // Modal initialization is handled in app.js
    
    UI.showToast('Application loaded', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    UI.showToast('Failed to initialize application: ' + error.message, 'error');
  }
});

