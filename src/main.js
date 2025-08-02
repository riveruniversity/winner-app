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
    
    // Initialize modal after everything else is ready
    // appModal is exported from app.js, so it will be available after app.js runs its DOMContentLoaded
    // We need to ensure appModal is initialized before other modules try to use it.
    // For now, we'll keep the setTimeout here, but ideally, appModal would be initialized
    // as part of the UI module or passed around.
    setTimeout(() => {
      const modalElement = document.getElementById('appModal');
      if (modalElement) {
        // appModal is already exported from app.js, so we just need to ensure it's set up
        // and potentially assign it to window.appModal for legacy inline onclicks.
        // The actual new bootstrap.Modal(modalElement) call should happen in app.js's initializeApp or UI.js
        // For now, we'll assume app.js handles the bootstrap.Modal initialization.
        window.appModal = appModal; // Keep for now for inline onclicks
      }
    }, 100);
    
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
