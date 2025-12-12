// ================================
// MAIN APPLICATION LOGIC
// ================================

import { Database } from './modules/database.js';
import { DOMUtils } from './modules/dom-utils.js';
import eventManager from './modules/event-manager.js';
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
import { Reports } from './modules/reports.js';
import { MinistryPlatform } from './modules/ministryplatform.js';
import { Templates } from './modules/templates.js';
import KeyboardShortcuts from './modules/keyboard-shortcuts.js';

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
  _currentWinners = winners;
  // Show SMS button when winners are set
  const smsBtn = document.getElementById('sendSMSBtn');
  if (smsBtn && winners && winners.length > 0) {
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

    // Populate Alpine stores with loaded data (if Alpine is available)
    if (window.Alpine) {
      const listsStore = Alpine.store('lists');
      const prizesStore = Alpine.store('prizes');
      const winnersStore = Alpine.store('winners');
      if (listsStore) listsStore.setItems(lists);
      if (prizesStore) prizesStore.setItems(prizes);
      if (winnersStore) winnersStore.setItems(winners);
    }

    // Update UI components with the loaded data (pass data to avoid refetching)
    await Lists.loadLists(lists); // Pass loaded data
    await Prizes.loadPrizes(prizes); // Pass loaded data
    await Winners.loadWinners(winners, lists); // Pass loaded data

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
    
    // Apply visibility settings based on loaded settings
    UI.applyVisibilitySettings();

    // Load all data once in background
    loadDataInBackground();

    // Initialize sound system
    Sounds.initSounds();
    
    // Initialize report import functionality
    Reports.initReportImport();
    
    // Initialize keyboard shortcuts for public view
    KeyboardShortcuts.init();
    
    // Initialize prize event delegation (once)
    Prizes.initPrizeEventDelegation();
    
    // Initialize templates functionality
    Templates.initTemplates();
    
    // Initialize MinistryPlatform import functionality
    MinistryPlatform.init();

    // Initialize modal after everything else is ready
    setTimeout(() => {
      const modalElement = document.getElementById('appModal');
      if (modalElement) {
        appModal = new bootstrap.Modal(modalElement);
        window.appModal = appModal; // Make available globally
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
  setupHistoryDelegation();
}

function setupHistoryDelegation() {
  // Setup event delegation for history delete buttons (only once)
  const tbody = document.getElementById('historyTableBody');
  if (tbody) {
    eventManager.delegate(tbody, '[data-history-id]', 'click', function(e) {
      const historyId = this.getAttribute('data-history-id');
      deleteHistoryConfirm(historyId);
    });
  }
}

function setupTabListeners() {
  // Ensure proper tab activation with show class
  const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
  tabButtons.forEach(button => {
    button.addEventListener('shown.bs.tab', async function (event) {
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
      
      // Reload data for specific tabs when they are shown
      const tabId = targetId?.replace('#', '');
      switch(tabId) {
        case 'lists':
          await Lists.loadLists();
          break;
        case 'prizes':
          await Prizes.loadPrizes();
          break;
        case 'winners':
          await Winners.loadWinners();
          break;
        case 'history':
          await loadHistory();
          await updateHistoryStats();
          break;
        case 'setup':
          // Refresh quick selects to get latest lists/prizes
          await UI.populateQuickSelects();
          break;
      }
    });
  });
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
    backToPublicBtn.addEventListener('click', async function () {
      try {
        // Force reload ALL data from database to ensure everything is current
        await Settings.loadSettings();
        Settings.applyTheme();
        Settings.loadSettingsToForm();
        
        // Reload lists and prizes
        const lists = await Database.getFromStore('lists');
        const prizes = await Database.getFromStore('prizes');
        
        // Update all UI components
        await UI.populateQuickSelects(lists, prizes);
        UI.updateSelectionInfo();
        UI.applyVisibilitySettings();
        UI.updateListSelectionCount();
        
        // Reload winners
        await Winners.loadWinners();
        
        // Update history stats
        await loadHistory();
        
        // Switch to public interface
        document.getElementById('managementInterface').classList.remove('active');
        document.getElementById('publicInterface').style.display = 'flex';
      } catch (error) {
        console.error('Error refreshing data:', error);
        UI.showToast('Error refreshing data: ' + error.message, 'error');
      }
    });
  }

  if (fullscreenToggle) {
    eventManager.on(fullscreenToggle, 'click', function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        DOMUtils.safeSetHTML(fullscreenToggle, '<i class="bi bi-fullscreen-exit"></i>', true);
      } else {
        document.exitFullscreen();
        DOMUtils.safeSetHTML(fullscreenToggle, '<i class="bi bi-fullscreen"></i>', true);
      }
    });
  }
  
  // Add keyboard shortcut 'v' to toggle between views
  document.addEventListener('keydown', function(e) {
    // Only trigger if not typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.key === 'v' || e.key === 'V') {
      const publicInterface = document.getElementById('publicInterface');
      const managementInterface = document.getElementById('managementInterface');
      
      if (publicInterface && managementInterface) {
        if (managementInterface.classList.contains('active')) {
          // Switch to public view (same as clicking "Public View" button)
          if (backToPublicBtn) {
            backToPublicBtn.click();
          }
        } else {
          // Switch to management view
          publicInterface.style.display = 'none';
          managementInterface.classList.add('active');
        }
      }
    }
  });

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
  const selectAllLists = document.getElementById('selectAllLists');
  const clearAllLists = document.getElementById('clearAllLists');

  if (bigPlayButton) bigPlayButton.addEventListener('click', Selection.handleBigPlayClick);
  if (newSelectionBtn) newSelectionBtn.addEventListener('click', Winners.resetToSelectionMode);
  if (undoSelectionBtn) undoSelectionBtn.addEventListener('click', Winners.undoLastSelection);
  
  // Add Select All/Clear All functionality
  if (selectAllLists) {
    selectAllLists.addEventListener('click', () => {
      document.querySelectorAll('#quickListSelect .list-checkbox').forEach(cb => {
        cb.checked = true;
      });
      UI.updateListSelectionCount();
      UI.updateSelectionInfo(); // Update the display info
      // Save the selection
      const selectedIds = Array.from(document.querySelectorAll('#quickListSelect .list-checkbox:checked'))
        .map(cb => cb.value);
      Settings.saveSingleSetting('selectedListIds', selectedIds);
    });
  }
  
  if (clearAllLists) {
    clearAllLists.addEventListener('click', () => {
      document.querySelectorAll('#quickListSelect .list-checkbox').forEach(cb => {
        cb.checked = false;
      });
      UI.updateListSelectionCount();
      UI.updateSelectionInfo(); // Update the display info
      Settings.saveSingleSetting('selectedListIds', []);
    });
  }
  
  // Add change listener for checkboxes (using event delegation)
  const quickListSelect = document.getElementById('quickListSelect');
  if (quickListSelect) {
    quickListSelect.addEventListener('change', async (e) => {
      if (e.target.classList.contains('list-checkbox')) {
        UI.updateListSelectionCount();
        await UI.updateSelectionInfo(); // Update the display info
        // Save the selection
        const selectedIds = Array.from(document.querySelectorAll('#quickListSelect .list-checkbox:checked'))
          .map(cb => cb.value);
        Settings.saveSingleSetting('selectedListIds', selectedIds);
      }
    });
  }
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
    uploadListModalBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent anchor default behavior
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

  if (exportWinnersBtn) eventManager.on(exportWinnersBtn, 'click', Export.handleExportWinners);
  if (clearWinnersBtn) eventManager.on(clearWinnersBtn, 'click', Winners.clearAllWinners);
  if (checkSMSStatusBtn) {
    eventManager.on(checkSMSStatusBtn, 'click', async () => {
      const { Texting } = await import('./modules/texting.js');
      checkSMSStatusBtn.disabled = true;
      DOMUtils.safeSetHTML(checkSMSStatusBtn, '<i class="bi bi-arrow-clockwise spinner-border spinner-border-sm me-2"></i>Checking...', true);
      
      try {
        const count = await Texting.checkAllPendingStatuses();
        if (count > 0) {
          UI.showToast(`Checked status for ${count} pending message${count > 1 ? 's' : ''}`, 'success');
        } else {
          UI.showToast('No pending SMS messages to check', 'info');
        }
      } catch (error) {
        console.error('SMS status check error:', error);
        UI.showToast(`Error checking SMS statuses: ${error.message}`, 'error');
      } finally {
        checkSMSStatusBtn.disabled = false;
        DOMUtils.safeSetHTML(checkSMSStatusBtn, '<i class="bi bi-arrow-clockwise me-2"></i>Check SMS Status', true);
      }
    });
  }
  if (backupData) eventManager.on(backupData, 'click', Export.handleBackupData);
  if (restoreData) eventManager.on(restoreData, 'click', Export.handleRestoreData);
  if (backupOnline) eventManager.on(backupOnline, 'click', Export.handleBackupOnline);
  if (restoreOnline) eventManager.on(restoreOnline, 'click', Export.handleRestoreOnline);
  if (undoLastSelection) eventManager.on(undoLastSelection, 'click', Winners.undoLastSelection);

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

  // Debounce filter changes to avoid multiple requests
  let filterTimeout;
  const debouncedLoadWinners = () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => Winners.loadWinners(), 100);
  };

  if (prizeFilter) prizeFilter.addEventListener('change', debouncedLoadWinners);
  if (listFilter) listFilter.addEventListener('change', debouncedLoadWinners);
  if (selectionFilter) selectionFilter.addEventListener('change', debouncedLoadWinners);
  if (dateFilter) dateFilter.addEventListener('change', debouncedLoadWinners);
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
      DOMUtils.safeSetHTML(tbody, '<tr><td colspan="6" class="text-center text-muted">No selection history yet.</td></tr>', true);
      return;
    }

    // Sort by timestamp descending
    history.sort((a, b) => b.timestamp - a.timestamp);

    // Clear existing content
    tbody.textContent = '';
    
    // Create rows safely
    const fragment = DOMUtils.createFragment(history, (entry) => {
      const row = document.createElement('tr');
      
      // Create cells with sanitized content
      const cells = [
        new Date(entry.timestamp).toLocaleDateString(),
        entry.listName || 'Unknown',
        entry.prize,
        String(entry.winners.length),
        entry.winners.map(w => w.displayName).join(', ')
      ];
      
      cells.forEach(content => {
        const td = document.createElement('td');
        td.textContent = DOMUtils.sanitizeHTML(String(content));
        row.appendChild(td);
      });
      
      // Add action cell
      const actionCell = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.setAttribute('data-history-id', entry.historyId);
      DOMUtils.safeSetHTML(deleteBtn, '<i class="bi bi-trash"></i>', true);
      actionCell.appendChild(deleteBtn);
      row.appendChild(actionCell);
      
      return row;
    });
    
    tbody.appendChild(fragment);
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
      UI.showToast('History entry deleted', 'success');
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
