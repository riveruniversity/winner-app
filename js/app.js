// ================================
// MAIN APPLICATION LOGIC
// ================================

import { Database } from './modules/firestore.js';
import { Settings, settings } from './modules/settings.js';
import { UI } from './modules/ui.js';
import { Lists } from './modules/lists.js';
import { Prizes } from './modules/prizes.js';
import { Winners } from './modules/winners.js';
import { Selection } from './modules/selection.js';
import { CSVParser } from './modules/csv-parser.js';
import { Export } from './modules/export.js';
import { Sounds } from './modules/sounds.js';
import { Texting } from './modules/texting.js';

// Global state variables (now truly central)
export let appModal = null;
let _currentList = null; // Internal variable
let _lastAction = null; // Internal variable
let _currentWinners = []; // Current batch of winners

// Export functions to get/set these central state variables
export function setCurrentList(list) {
  _currentList = list;
}

export function getCurrentList() {
  return _currentList;
}

export function setLastAction(action) {
  _lastAction = action;
}

export function getLastAction() {
  return _lastAction;
}

export function setCurrentWinners(winners) {
  console.log('setCurrentWinners called with:', winners);
  _currentWinners = winners;
  // Show SMS button when winners are set
  const smsBtn = document.getElementById('sendSMSBtn');
  console.log('SMS button element:', smsBtn);
  if (smsBtn && winners && winners.length > 0) {
    console.log('Showing SMS button for', winners.length, 'winners');
    smsBtn.classList.remove('d-none');
  }
}

export function getCurrentWinners() {
  return _currentWinners;
}

export function clearCurrentWinners() {
  _currentWinners = [];
  // Hide SMS button when no current winners
  const smsBtn = document.getElementById('sendSMSBtn');
  if (smsBtn) {
    smsBtn.classList.add('d-none');
  }
}

// Load data in background without blocking UI
async function loadDataInBackground() {
  try {
    // Batch fetch all collections in a single request
    const batchResults = await Database.batchFetch([
      { collection: 'lists' },
      { collection: 'prizes' },
      { collection: 'winners' },
      { collection: 'history' }
    ]);
    
    const lists = batchResults.lists || [];
    const prizes = batchResults.prizes || [];
    const winners = batchResults.winners || [];
    const history = batchResults.history || [];
    
    // Update UI components with the loaded data
    Lists.loadLists(lists); // Pass loaded data
    Prizes.loadPrizes(prizes); // Pass loaded data
    Winners.loadWinners(winners, lists); // Pass loaded data
    
    // Load history UI with already loaded data
    loadHistoryUI(history);
    updateHistoryStatsUI(history, winners);
    
    // Populate quick selects with already loaded data
    UI.populateQuickSelects(lists, prizes);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Application initialization
export async function initializeApp() {
  try {
    await Database.initDB();

    // Load settings first, then load data - this ensures proper dropdown restoration
    await Settings.loadSettings();
    Settings.setupTheme(); // Apply theme once settings are loaded
    console.log('Settings loaded:', settings);
    
    // Apply visibility settings based on loaded settings
    UI.applyVisibilitySettings();

    // Load all data once in background
    loadDataInBackground();

    // Initialize sound system
    Sounds.initSounds();

    // Initialize modal after everything else is ready
    setTimeout(() => {
      const modalElement = document.getElementById('appModal');
      if (modalElement) {
        appModal = new bootstrap.Modal(modalElement);
        window.appModal = appModal; // Make available globally
        if (settings.enableDebugLogs) { console.log('Bootstrap modal initialized and assigned to window.appModal'); }
      } else {
        console.error('Modal element #appModal not found');
      }
    }, 100);

    setupEventListeners();

    // Firestore handles sync automatically with offline persistence

  } catch (error) {
    console.error('Initialization error:', error);
    UI.showToast('Failed to initialize application: ' + error.message, 'error');
  }
}

// Event Listeners Setup
function setupEventListeners() {
  setupInterfaceToggles();
  setupQuickSelection();
  setupManagementListeners();
  setupWinnerFilters();
  setupDisplayMode();
  setupTabListeners();
}

function setupTabListeners() {
  // Ensure proper tab activation with show class
  const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
  tabButtons.forEach(button => {
    button.addEventListener('shown.bs.tab', function (event) {
      // Ensure the show class is properly applied
      const targetId = event.target.getAttribute('data-bs-target');
      const targetPane = document.querySelector(targetId);
      if (targetPane) {
        // Remove show from all panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.remove('show');
        });
        // Add show to active pane
        targetPane.classList.add('show');
      }
    });
  });

  // All data is loaded once on startup - no tab reload listeners needed
}

function setupInterfaceToggles() {
  const managementToggle = document.getElementById('managementToggle');
  const backToPublicBtn = document.getElementById('backToPublicBtn');
  const fullscreenToggle = document.getElementById('fullscreenToggle');
  const sendSMSBtn = document.getElementById('sendSMSBtn');

  if (managementToggle) {
    managementToggle.addEventListener('click', function () {
      document.getElementById('publicInterface').style.display = 'none';
      document.getElementById('managementInterface').classList.add('active');
    });
  }

  if (backToPublicBtn) {
    backToPublicBtn.addEventListener('click', function () {
      document.getElementById('managementInterface').classList.remove('active');
      document.getElementById('publicInterface').style.display = 'flex';
    });
  }

  if (fullscreenToggle) {
    fullscreenToggle.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenToggle.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
      } else {
        document.exitFullscreen();
        fullscreenToggle.innerHTML = '<i class="bi bi-fullscreen"></i>';
      }
    });
  }

  if (sendSMSBtn) {
    sendSMSBtn.addEventListener('click', function (e) {
      e.preventDefault();
      Texting.sendToCurrentWinners();
    });
  }
}

function setupQuickSelection() {
  // Quick selection fields (quickListSelect, quickPrizeSelect, quickWinnersCount) 
  // are now handled by the unified Settings.setupQuickSetupAutoSave() system

  const bigPlayButton = document.getElementById('bigPlayButton');
  const newSelectionBtn = document.getElementById('newSelectionBtn');
  const undoSelectionBtn = document.getElementById('undoSelectionBtn');

  if (bigPlayButton) bigPlayButton.addEventListener('click', Selection.handleBigPlayClick);
  if (newSelectionBtn) newSelectionBtn.addEventListener('click', Winners.resetToSelectionMode);
  if (undoSelectionBtn) undoSelectionBtn.addEventListener('click', Winners.undoLastSelection);
}

function setupManagementListeners() {
  // CSV Upload handlers
  const csvFileInput = document.getElementById('csvFile');
  const confirmUpload = document.getElementById('confirmUpload');
  const cancelUpload = document.getElementById('cancelUpload');

  // The file input change is now triggered from the button click
  if (csvFileInput) {
    csvFileInput.addEventListener('change', async (event) => {
      await CSVParser.handleCSVUpload(event);
    });
  }
  if (confirmUpload) confirmUpload.addEventListener('click', CSVParser.handleConfirmUpload);
  if (cancelUpload) cancelUpload.addEventListener('click', CSVParser.handleCancelUpload);

  // Prize Management
  const addPrizeBtn = document.getElementById('addPrizeBtn');
  if (addPrizeBtn) addPrizeBtn.addEventListener('click', Prizes.handleAddPrize);

  // New Add Prize Modal Button
  const addPrizeModalBtn = document.getElementById('addPrizeModalBtn');
  if (addPrizeModalBtn) addPrizeModalBtn.addEventListener('click', Prizes.showAddPrizeModal);

  // Upload List Button - Opens file browser directly
  const uploadListModalBtn = document.getElementById('uploadListModalBtn');
  if (uploadListModalBtn) {
    uploadListModalBtn.addEventListener('click', () => {
      // Just trigger the file input directly - no modal needed for step 1
      const csvFileInput = document.getElementById('csvFile');
      if (csvFileInput) {
        csvFileInput.click();
      }
    });
  }


  // Settings are now auto-saved, no manual save button needed

  // Preview delay button
  const previewDelayBtn = document.getElementById('previewDelayBtn');
  if (previewDelayBtn) previewDelayBtn.addEventListener('click', Settings.testDelay);

  // Setup webhook toggle functionality
  Settings.setupWebhookToggle();

  // Setup SMS template character counter
  Settings.setupSMSTemplateCounter();
  
  // Update SMS placeholders based on selected list
  Settings.updateSMSPlaceholders();

  // Setup auto-save for quick setup fields
  Settings.setupQuickSetupAutoSave();

  // Setup auto-save for all settings fields
  Settings.setupAllSettingsAutoSave();

  // Theme
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', Settings.toggleTheme);

  const themePresets = document.querySelectorAll('.theme-preset');
  themePresets.forEach(button => {
    button.addEventListener('click', Settings.handleThemePreset);
  });

  // Sound dropdowns are already populated on init, no need to refresh on tab show

  // Celebration test button
  const testCelebrationBtn = document.getElementById('testCelebrationEffect');
  if (testCelebrationBtn) {
    testCelebrationBtn.addEventListener('click', () => {
      const celebrationEffect = document.getElementById('celebrationEffect')?.value || 'confetti';

      if (celebrationEffect === 'confetti' || celebrationEffect === 'both') {
        if (window.Animations && window.Animations.startConfettiAnimation) {
          window.Animations.startConfettiAnimation();
        } else {
          console.error('❌ Animations.startConfettiAnimation not available');
        }
      }

      if (celebrationEffect === 'coins' || celebrationEffect === 'both') {
        // Coin animation would trigger here if implemented
      }
    });
  }

  // Sound dropdowns are already populated on init, no need to refresh on tab show

  // Export/Import
  const exportWinnersBtn = document.getElementById('exportWinnersBtn');
  const clearWinnersBtn = document.getElementById('clearWinnersBtn');
  const checkSMSStatusBtn = document.getElementById('checkSMSStatusBtn');
  const backupData = document.getElementById('backupData');
  const restoreData = document.getElementById('restoreData');
  const backupOnline = document.getElementById('backupOnline');
  const restoreOnline = document.getElementById('restoreOnline');
  const undoLastSelection = document.getElementById('undoLastSelection');

  if (exportWinnersBtn) exportWinnersBtn.addEventListener('click', Export.handleExportWinners);
  if (clearWinnersBtn) clearWinnersBtn.addEventListener('click', Winners.clearAllWinners);
  if (checkSMSStatusBtn) {
    checkSMSStatusBtn.addEventListener('click', async () => {
      const { Texting } = await import('./modules/texting.js');
      checkSMSStatusBtn.disabled = true;
      checkSMSStatusBtn.innerHTML = '<i class="bi bi-arrow-clockwise spinner-border spinner-border-sm me-2"></i>Checking...';
      
      try {
        const count = await Texting.checkAllPendingStatuses();
        if (count > 0) {
          UI.showToast(`Checked status for ${count} pending message${count > 1 ? 's' : ''}`, 'success');
        } else {
          UI.showToast('No pending SMS messages to check', 'info');
        }
      } catch (error) {
        UI.showToast('Error checking SMS statuses', 'error');
      } finally {
        checkSMSStatusBtn.disabled = false;
        checkSMSStatusBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Check SMS Status';
      }
    });
  }
  if (backupData) backupData.addEventListener('click', Export.handleBackupData);
  if (restoreData) restoreData.addEventListener('click', Export.handleRestoreData);
  if (backupOnline) backupOnline.addEventListener('click', Export.handleBackupOnline);
  if (restoreOnline) restoreOnline.addEventListener('click', Export.handleRestoreOnline);
  if (undoLastSelection) undoLastSelection.addEventListener('click', Winners.undoLastSelection);

  // Clear filters button
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      document.getElementById('filterPrize').value = '';
      document.getElementById('filterList').value = '';
      document.getElementById('filterSelection').value = '';
      document.getElementById('filterDate').value = '';
      Winners.loadWinners();
    });
  }
}

function setupWinnerFilters() {
  const prizeFilter = document.getElementById('filterPrize');
  const listFilter = document.getElementById('filterList');
  const selectionFilter = document.getElementById('filterSelection');
  const dateFilter = document.getElementById('filterDate');

  if (prizeFilter) prizeFilter.addEventListener('change', () => Winners.loadWinners());
  if (listFilter) listFilter.addEventListener('change', () => Winners.loadWinners());
  if (selectionFilter) selectionFilter.addEventListener('change', () => Winners.loadWinners());
  if (dateFilter) dateFilter.addEventListener('change', () => Winners.loadWinners());
}

function setupDisplayMode() {
  // Sequential settings are now always visible in the Winner Display Effects section
  // No need to toggle visibility based on selection mode
}

// History Management (simplified for now)
// New function that only updates UI without reloading data
function loadHistoryUI(history) {
  try {
    const tbody = document.getElementById('historyTableBody');

    if (!tbody) return;

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No selection history yet.</td></tr>';
      return;
    }

    // Sort by timestamp descending
    history.sort((a, b) => b.timestamp - a.timestamp);

    tbody.innerHTML = history.map(entry => `
      <tr>
        <td>${new Date(entry.timestamp).toLocaleDateString()}</td>
        <td>${entry.listName || 'Unknown'}</td>
        <td>${entry.prize}</td>
        <td>${entry.winners.length}</td>
        <td>${entry.winners.map(w => w.displayName).join(', ')}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" data-history-id="${entry.historyId}" onclick="deleteHistoryConfirm(this.dataset.historyId)">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

// Old function kept for external calls
export async function loadHistory() {
  try {
    const history = await Database.getFromStore('history');
    loadHistoryUI(history);
  } catch (error) {
    console.error('Error loading history:', error);
    UI.showToast('Error loading history: ' + error.message, 'error');
  }
}

// New function that only updates UI without reloading data
function updateHistoryStatsUI(history, winners) {
  try {

    const totalSelections = history.length;
    const totalWinners = winners.length;
    const averageWinners = totalSelections > 0 ? Math.round(totalWinners / totalSelections * 10) / 10 : 0;

    // Find most used prize
    const prizeCount = {};
    history.forEach(entry => {
      prizeCount[entry.prize] = (prizeCount[entry.prize] || 0) + 1;
    });

    const mostUsedPrize = Object.keys(prizeCount).reduce((a, b) =>
      prizeCount[a] > prizeCount[b] ? a : b, '-'
    );

    // Update displays
    const statsElements = {
      'totalSelections': totalSelections,
      'totalWinners': totalWinners,
      'averageWinners': averageWinners,
      'mostUsedPrize': mostUsedPrize
    };

    for (const [id, value] of Object.entries(statsElements)) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    }

  } catch (error) {
    console.error('Error updating history stats:', error);
  }
}

// Old function kept for external calls
export async function updateHistoryStats() {
  try {
    const history = await Database.getFromStore('history');
    const winners = await Winners.getAllWinners();
    updateHistoryStatsUI(history, winners);
  } catch (error) {
    console.error('Error updating history stats:', error);
  }
}

export async function deleteHistoryConfirm(historyId) {
  UI.showConfirmationModal('Delete History Entry', 'Are you sure you want to delete this history entry?', async () => {
    try {
      await Database.deleteFromStore('history', historyId);
      UI.showToast('History entry deleted successfully', 'success');
      await loadHistory();
      await updateHistoryStats();
    } catch (error) {
      console.error('Error deleting history entry:', error);
      UI.showToast('Error deleting history entry: ' + error.message, 'error');
    }
  });
}

// Make function available globally for inline onclick handlers
window.deleteHistoryConfirm = deleteHistoryConfirm;
window.setCurrentWinners = setCurrentWinners; // For debugging
