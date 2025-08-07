import { initializeApp, loadHistory, updateHistoryStats, appModal, setCurrentList, setLastAction } from './js/app.js';
import { UI } from './js/modules/ui.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', async function () {
  try {
    // Initialize database and load settings are now handled within initializeApp
    
    // Initialize the app
    await initializeApp();
    
    // Setup event listeners (these are still in app.js for now)
    // setupEventListeners(); // This function is internal to app.js
    
    // Setup theme (this is still in app.js for now)
    // Settings.setupTheme(); // This function is internal to app.js
    
    // Modal initialization is handled in app.js
    
    UI.showToast('Application loaded successfully!', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    UI.showToast('Failed to initialize application: ' + error.message, 'error');
  }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/worker.js') // Path relative to server root (public/worker.js)
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
