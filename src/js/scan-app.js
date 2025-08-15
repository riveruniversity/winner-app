// Scan App - Entry point for the QR scanner page
import { Database } from './modules/database.js';
import { Settings } from './modules/settings.js';
import { UI } from './modules/ui.js';
import { QRScanner } from './modules/qr-scanner.js';
import { Winners } from './modules/winners.js';

// Initialize the scan application
async function initializeScanApp() {
  try {
    // Initialize database
    await Database.initDB();
    
    // Load settings and apply theme
    await Settings.loadSettings();
    Settings.setupTheme();
    
    // Initialize QR Scanner
    await QRScanner.init();
    
    // Setup event listeners
    setupEventListeners();
    
    // Automatically start scanning
    setTimeout(() => {
      QRScanner.startScanning();
    }, 500);
    
    UI.showToast('Scanner ready!', 'success');
  } catch (error) {
    console.error('Scan app initialization error:', error);
    UI.showToast('Failed to initialize scanner: ' + error.message, 'error');
  }
}

function setupEventListeners() {
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.body.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      // Update icon
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.className = newTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
      }
    });
  }
  
  // Scanner controls
  const startScanBtn = document.getElementById('startScanBtn');
  const stopScanBtn = document.getElementById('stopScanBtn');
  const scanAnotherBtn = document.getElementById('scanAnotherBtn');
  
  if (startScanBtn) {
    startScanBtn.addEventListener('click', () => {
      QRScanner.startScanning();
    });
  }
  
  if (stopScanBtn) {
    stopScanBtn.addEventListener('click', () => {
      QRScanner.stopScanning();
    });
  }
  
  if (scanAnotherBtn) {
    scanAnotherBtn.addEventListener('click', () => {
      QRScanner.reset(); // This restarts the scanner for a fresh scan
    });
  }
  
  // Manual ticket code entry
  const manualTicketCode = document.getElementById('manualTicketCode');
  const manualSearchBtn = document.getElementById('manualSearchBtn');
  
  if (manualTicketCode && manualSearchBtn) {
    // Search on Enter key
    manualTicketCode.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchByTicketCode();
      }
    });
    
    manualSearchBtn.addEventListener('click', searchByTicketCode);
  }
  
  // Dismiss alert button
  const dismissAlertBtn = document.getElementById('dismissAlertBtn');
  if (dismissAlertBtn) {
    dismissAlertBtn.addEventListener('click', () => {
      QRScanner.hideNoWinnerAlert();
    });
  }
  
  // Also allow clicking the overlay to dismiss
  const alertOverlay = document.getElementById('noWinnerAlert');
  if (alertOverlay) {
    alertOverlay.addEventListener('click', (e) => {
      if (e.target === alertOverlay) {
        QRScanner.hideNoWinnerAlert();
      }
    });
  }
}

async function searchByTicketCode() {
  const ticketCode = document.getElementById('manualTicketCode').value.trim();
  
  if (!ticketCode) {
    UI.showToast('Please enter a ticket code', 'error');
    return;
  }
  
  try {
    const winnerData = await QRScanner.findWinnerByTicketCode(ticketCode);
    
    if (winnerData) {
      await QRScanner.displayWinnerInfo(winnerData);
      // Clear the input
      document.getElementById('manualTicketCode').value = '';
    } else {
      QRScanner.showNoWinnerAlert(ticketCode);
      // Clear the input
      document.getElementById('manualTicketCode').value = '';
    }
  } catch (error) {
    console.error('Error searching by ticket code:', error);
    UI.showToast('Error searching: ' + error.message, 'error');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeScanApp);

// No service worker registration for scan page
// The scanner page doesn't need offline functionality