// ================================
// MAIN APPLICATION LOGIC
// ================================

import { Database } from './modules/firestore-service.js';
import { Settings, settings } from './modules/settings.js';
import { UI } from './modules/ui.js';
import { Lists } from './modules/lists.js';
import { Prizes } from './modules/prizes.js';
import { Winners } from './modules/winners.js';
import { Selection } from './modules/selection.js';
import { CSVParser } from './modules/csv-parser.js';
import { Export } from './modules/export.js';

// Global state variables (now truly central)
export let appModal = null;
let _currentList = null; // Internal variable
let _lastAction = null; // Internal variable

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

// Load data in background without blocking UI
function loadDataInBackground() {
  // Fire and forget - don't await these
  Lists.loadLists();
  Prizes.loadPrizes();
  UI.syncUI();
}

// Application initialization
export async function initializeApp() {
  try {
    await Database.initDB();
    
    // Load settings in background too - don't block UI
    Settings.loadSettings().then(() => {
      Settings.setupTheme(); // Apply theme once settings are loaded
    });
    
    // Start loading everything in background, don't block UI
    loadDataInBackground();
    
    // Load other data in background too (don't await)
    Winners.loadWinners();
    loadHistory();
    updateHistoryStats();

    // Initialize modal after everything else is ready
    setTimeout(() => {
      const modalElement = document.getElementById('appModal');
      if (modalElement) {
        appModal = new bootstrap.Modal(modalElement);
        // No need to assign to window.appModal here, as it's exported
      }
    }, 100);

    setupEventListeners();
    Settings.setupTheme();

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
}

function setupInterfaceToggles() {
  const managementToggle = document.getElementById('managementToggle');
  const backToPublicBtn = document.getElementById('backToPublicBtn');
  const fullscreenToggle = document.getElementById('fullscreenToggle');

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
}

function setupQuickSelection() {
  const quickListSelect = document.getElementById('quickListSelect');
  const quickPrizeSelect = document.getElementById('quickPrizeSelect');
  const quickWinnersCount = document.getElementById('quickWinnersCount');
  const bigPlayButton = document.getElementById('bigPlayButton');
  const newSelectionBtn = document.getElementById('newSelectionBtn');
  const undoSelectionBtn = document.getElementById('undoSelectionBtn');

  if (quickListSelect) quickListSelect.addEventListener('change', UI.updateSelectionInfo);
  if (quickPrizeSelect) quickPrizeSelect.addEventListener('change', UI.updateSelectionInfo);
  if (quickWinnersCount) quickWinnersCount.addEventListener('input', UI.updateSelectionInfo);
  if (bigPlayButton) bigPlayButton.addEventListener('click', Selection.handleBigPlayClick);
  if (newSelectionBtn) newSelectionBtn.addEventListener('click', Winners.resetToSelectionMode);
  if (undoSelectionBtn) undoSelectionBtn.addEventListener('click', Winners.undoLastSelection);
}

function setupManagementListeners() {
  // CSV Upload
  const uploadBtn = document.getElementById('uploadBtn');
  const csvFileInput = document.getElementById('csvFile');
  const confirmUpload = document.getElementById('confirmUpload');
  const cancelUpload = document.getElementById('cancelUpload');

  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => csvFileInput.click());
  }
  if (csvFileInput) {
    csvFileInput.addEventListener('change', CSVParser.handleCSVUpload);
  }
  if (confirmUpload) confirmUpload.addEventListener('click', CSVParser.handleConfirmUpload);
  if (cancelUpload) cancelUpload.addEventListener('click', CSVParser.handleCancelUpload);

  // Prize Management
  const addPrizeBtn = document.getElementById('addPrizeBtn');
  if (addPrizeBtn) addPrizeBtn.addEventListener('click', Prizes.handleAddPrize);

  // Settings
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', Settings.handleSaveSettings);

  // Theme
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', Settings.toggleTheme);

  const themePresets = document.querySelectorAll('.theme-preset');
  themePresets.forEach(button => {
    button.addEventListener('click', Settings.handleThemePreset);
  });

  // Export/Import
  const exportWinnersBtn = document.getElementById('exportWinnersBtn');
  const clearWinnersBtn = document.getElementById('clearWinnersBtn');
  const backupData = document.getElementById('backupData');
  const restoreData = document.getElementById('restoreData');
  const undoLastSelection = document.getElementById('undoLastSelection');

  if (exportWinnersBtn) exportWinnersBtn.addEventListener('click', Export.handleExportWinners);
  if (clearWinnersBtn) clearWinnersBtn.addEventListener('click', Winners.clearAllWinners);
  if (backupData) backupData.addEventListener('click', Export.handleBackupData);
  if (restoreData) restoreData.addEventListener('click', Export.handleRestoreData);
  if (undoLastSelection) undoLastSelection.addEventListener('click', Winners.undoLastSelection);
}

function setupWinnerFilters() {
  const prizeFilter = document.getElementById('filterPrize');
  const listFilter = document.getElementById('filterList');
  const selectionFilter = document.getElementById('filterSelection');

  if (prizeFilter) prizeFilter.addEventListener('change', Winners.loadWinners);
  if (listFilter) listFilter.addEventListener('change', Winners.loadWinners);
  if (selectionFilter) selectionFilter.addEventListener('change', Winners.loadWinners);
}

function setupDisplayMode() {
  const displayModeSelect = document.getElementById('displayMode');
  if (displayModeSelect) {
    const durationSettings = document.getElementById('durationSettings');
    const countdownSettings = document.getElementById('countdownSettings');

    const toggleDisplaySettings = () => {
      const mode = displayModeSelect.value;
      const showSequential = mode === 'sequential';
      const showCountdown = mode === 'countdown' || mode === 'animation';

      if (durationSettings) durationSettings.style.display = showSequential ? 'block' : 'none';
      if (countdownSettings) countdownSettings.style.display = showCountdown ? 'block' : 'none';
    };

    displayModeSelect.addEventListener('change', toggleDisplaySettings);
    toggleDisplaySettings(); // Initial check
  }
}

// History Management (simplified for now)
export async function loadHistory() {
  try {
    const history = await Database.getFromStore('history');
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
    UI.showToast('Error loading history: ' + error.message, 'error');
  }
}

export async function updateHistoryStats() {
  try {
    const history = await Database.getFromStore('history');
    const winners = await Winners.getAllWinners();

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
