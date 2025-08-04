// Scan App - Entry point for the QR scanner page
import { Database } from './modules/firestore.js';
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
  const backToScannerBtn = document.getElementById('backToScannerBtn');
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
  
  if (backToScannerBtn) {
    backToScannerBtn.addEventListener('click', () => {
      QRScanner.reset();
      QRScanner.stopScanning();
    });
  }
  
  if (scanAnotherBtn) {
    scanAnotherBtn.addEventListener('click', () => {
      QRScanner.reset();
      QRScanner.startScanning();
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
      UI.showToast('No winner found with ticket code: ' + ticketCode, 'error');
    }
  } catch (error) {
    console.error('Error searching by ticket code:', error);
    UI.showToast('Error searching: ' + error.message, 'error');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeScanApp);

// Service Worker Registration (same as main app)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/worker.js')
      .then((registration) => {
        console.log('SW registered for scanner: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}