// ================================
// UI UTILITIES & MODALS
// ================================
import { DOMUtils } from './dom-utils.js';
import eventManager from './event-manager.js';

// ================================
// UI UTILITIES & MODALS
// ================================

import { Database } from './database.js';
import { settings } from './settings.js'; // Import settings directly

function generateId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function showToast(message, type = 'info') {
  const backgroundColor = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#06b6d4'
  };

  Toastify({
    text: message,
    duration: 3000,
    gravity: 'bottom',
    position: 'right',
    style: {
      background: backgroundColor[type] || backgroundColor.info,
    }
  }).showToast();
}

function showProgress(title, text) {
  document.getElementById('progressTitle').textContent = title;
  document.getElementById('progressText').textContent = text;
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressOverlay').classList.remove('d-none');
}

function updateProgress(percentage, text) {
  document.getElementById('progressFill').style.width = percentage + '%';
  if (text) {
    document.getElementById('progressText').textContent = text;
  }
}

function hideProgress() {
  document.getElementById('progressOverlay').classList.add('d-none');
}


function showConfirmationModal(title, message, onConfirm, options = {}) {
  // Use Alpine modal component if available
  const alpineModal = window.alpineConfirmModal;
  if (alpineModal && alpineModal.bsModal) {
    alpineModal.show({
      title,
      message,
      customContent: options.customContent || '',
      confirmText: options.confirmText || 'Confirm',
      confirmClass: options.confirmClass || 'btn-danger',
      onConfirm: async () => {
        try {
          await onConfirm();
        } catch (error) {
          console.error(`Error in confirmation modal for "${title}":`, error);
          showToast(`Operation failed: ${error.message}`, 'error');
        }
      }
    });
    return;
  }

  // Fallback to legacy DOM manipulation if Alpine not available
  const modalTitle = document.getElementById('appModalLabel');
  const modalBody = document.getElementById('appModalBody');
  const confirmBtn = document.getElementById('appModalConfirmBtn');
  const cancelBtn = document.querySelector('#appModal .modal-footer .btn-secondary');

  modalTitle.textContent = title;
  modalBody.innerHTML = `<p>${message}</p>`;
  confirmBtn.textContent = options.confirmText || 'Confirm';
  confirmBtn.className = `btn ${options.confirmClass || 'btn-danger'}`;
  confirmBtn.style.display = 'inline-block';
  cancelBtn.textContent = 'Cancel';

  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  // Handler for confirmation
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error(`Error in confirmation modal for "${title}":`, error);
      showToast(`Operation failed: ${error.message}`, 'error');
    } finally {
      window.appModal.hide();
      document.removeEventListener('keydown', keyHandler);
    }
  };

  // Keyboard event handler
  const keyHandler = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      window.appModal.hide();
      document.removeEventListener('keydown', keyHandler);
    }
  };

  newConfirmBtn.addEventListener('click', handleConfirm, { once: true });

  // Add keyboard listener when modal is shown
  document.addEventListener('keydown', keyHandler);

  // Remove keyboard listener when modal is hidden
  const modal = document.getElementById('appModal');
  modal.addEventListener('hidden.bs.modal', () => {
    document.removeEventListener('keydown', keyHandler);
  }, { once: true });

  window.appModal.show();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function populateQuickSelects(lists = null, prizes = null) {
  try {
    // Use passed data if available, otherwise fetch from database
    let listsData = lists;
    let prizesData = prizes;
    
    if (!listsData || !prizesData) {
      console.log('PopulateQuickSelects: Fetching data - lists provided:', !!lists, 'prizes provided:', !!prizes);
      // Use batch fetch for efficiency and consistency
      const batchResults = await Database.batchFetch([
        { collection: 'lists' },
        { collection: 'prizes' }
      ]);
      listsData = listsData || batchResults.lists || [];
      prizesData = prizesData || batchResults.prizes || [];
      console.log('PopulateQuickSelects: After fetch - prizes:', prizesData.map(p => ({ id: p.prizeId, name: p.name, qty: p.quantity })));
    }

    const quickListSelect = document.getElementById('quickListSelect');
    const quickPrizeSelect = document.getElementById('quickPrizeSelect');
    const quickWinnersCount = document.getElementById('quickWinnersCount');
    
    let settingsChanged = false;

    if (quickListSelect) {
      quickListSelect.innerHTML = '';
      // Sort lists by timestamp (most recent first)
      const sortedLists = [...listsData].sort((a, b) => {
        const dateA = a.metadata?.timestamp || 0;
        const dateB = b.metadata?.timestamp || 0;
        return dateB - dateA;
      });
      
      if (sortedLists.length === 0) {
        quickListSelect.innerHTML = '<div class="text-muted p-2">No lists available</div>';
      } else {
        sortedLists.forEach(list => {
          const listId = list.listId;
          // Use entries.length if entries exist (even if 0), otherwise use metadata
          const entryCount = list.entries !== undefined ? list.entries.length : (list.metadata?.entryCount || 0);
          
          const checkboxDiv = document.createElement('div');
          checkboxDiv.className = 'form-check';
          checkboxDiv.innerHTML = `
            <input class="form-check-input list-checkbox" type="checkbox" value="${listId}" id="list-${listId}" data-entry-count="${entryCount}">
            <label class="form-check-label" for="list-${listId}">
              ${list.metadata.name} <span class="text-muted">(${entryCount})</span>
            </label>
          `;
          quickListSelect.appendChild(checkboxDiv);
        });
      }
      
      // Restore selected lists from settings (now supports multiple)
      if (settings.selectedListIds && Array.isArray(settings.selectedListIds)) {
        settings.selectedListIds.forEach(listId => {
          const checkbox = quickListSelect.querySelector(`input[value="${listId}"]`);
          if (checkbox) {
            checkbox.checked = true;
          }
        });
        updateListSelectionCount();
        await updateSelectionInfo(); // Update display after restoring selections
      } else {
        console.log('No saved list selection to restore');
      }
    }

    if (quickPrizeSelect) {
      quickPrizeSelect.innerHTML = '<option value="">Select Prize...</option>';
      const availablePrizes = prizesData.filter(prize => prize.quantity > 0);
      
      availablePrizes.forEach(prize => {
        const option = document.createElement('option');
        option.value = prize.prizeId;
        option.textContent = `${prize.name} (${prize.quantity})`;
        quickPrizeSelect.appendChild(option);
      });
      
      if (settings.selectedPrizeId) {
        const prizeOption = quickPrizeSelect.querySelector(`option[value="${settings.selectedPrizeId}"]`);
        if (prizeOption) {
          quickPrizeSelect.value = settings.selectedPrizeId;
        } else {
          console.log('Saved prize selection not found in dropdown, clearing setting:', settings.selectedPrizeId);
          console.log('Options in dropdown:', Array.from(quickPrizeSelect.options).map(o => o.value));
          settings.selectedPrizeId = '';
          settingsChanged = true;
        }
      } else {
        console.log('No saved prize selection to restore');
      }
    }

    if (quickWinnersCount && settings.winnersCount) {
      quickWinnersCount.value = settings.winnersCount;
    }

    await updateSelectionInfo();
    
    // Re-setup auto-save listeners for quick select dropdowns after updating them
    if (Settings && Settings.setupQuickSetupAutoSave) {
      Settings.setupQuickSetupAutoSave();
    }
    
    // Save settings if any selections were cleared due to missing options
    if (settingsChanged && Settings && Settings.saveSettings) {
      Settings.saveSettings();
    }
  } catch (error) {
    console.error('Error populating quick selects:', error);
    showToast('Error loading selection options: ' + error.message, 'error');
  }
}

function applyVisibilitySettings() {
  const totalEntriesCard = document.getElementById('totalEntriesCard');
  if (totalEntriesCard) {
    totalEntriesCard.style.display = settings.hideEntryCounts ? 'none' : 'block';
  }
}

async function syncUI(lists = null, prizes = null) {
  try {
    await populateQuickSelects(lists, prizes);
    applyVisibilitySettings();
    await updateSelectionInfo();
  } catch (error) {
    console.error('Error syncing UI:', error);
    showToast('Failed to refresh the application interface.', 'error');
  }
}

async function updateSelectionInfo() {
  const quickListSelect = document.getElementById('quickListSelect');
  const quickPrizeSelect = document.getElementById('quickPrizeSelect');
  const quickWinnersCount = document.getElementById('quickWinnersCount');

  if (!quickListSelect || !quickPrizeSelect || !quickWinnersCount) return;

  // Get selected lists from checkboxes
  const selectedCheckboxes = quickListSelect.querySelectorAll('.list-checkbox:checked');
  const selectedListNames = [];
  let totalEntryCount = 0;
  
  selectedCheckboxes.forEach(checkbox => {
    const label = quickListSelect.querySelector(`label[for="${checkbox.id}"]`);
    if (label) {
      const listName = label.textContent.split(' (')[0].trim();
      selectedListNames.push(listName);
      totalEntryCount += parseInt(checkbox.dataset.entryCount || 0);
    }
  });
  
  // Update list display
  const listText = selectedListNames.length > 0 
    ? (selectedListNames.length === 1 ? selectedListNames[0] : `${selectedListNames.length} Lists Selected`)
    : 'Not Selected';
  
  const prizeOption = quickPrizeSelect.options[quickPrizeSelect.selectedIndex];
  const prizeText = prizeOption ? prizeOption.textContent.split(' (')[0] : 'Not Selected';
  const prizeNameOnly = prizeOption ? prizeOption.textContent.split(' (')[0].trim() : null;

  document.getElementById('currentListDisplay').textContent = listText;
  document.getElementById('currentPrizeDisplay').textContent = prizeText;
  document.getElementById('winnersCountDisplay').textContent = quickWinnersCount.value;

  // Calculate eligible entries (excluding same prize winners if setting is enabled)
  let eligibleEntryCount = totalEntryCount;
  let excludedCount = 0;
  
  // Check if we should filter out same prize winners
  if (settings?.preventSamePrize && prizeNameOnly && selectedCheckboxes.length > 0) {
    console.log('Checking for same prize exclusions. Prize:', prizeNameOnly, 'Setting enabled:', settings.preventSamePrize);
    try {
      // Get all winners who won this specific prize
      const winners = await Database.getFromStore('winners');
      const samePrizeWinnerIds = new Set();
      
      if (winners && Array.isArray(winners)) {
        winners.forEach(winner => {
          // Only check winners who won this specific prize
          if (winner.prize === prizeNameOnly) {
            // Use the entry ID to exclude this winner
            if (winner.entryId) samePrizeWinnerIds.add(winner.entryId);
          }
        });
        console.log('Found', samePrizeWinnerIds.size, 'previous winners of', prizeNameOnly);
      }
      
      // If we have excluded IDs, we need to fetch the actual lists to count accurately
      if (samePrizeWinnerIds.size > 0) {
        const listIds = Array.from(selectedCheckboxes).map(cb => cb.value);
        const fetchRequests = listIds.map(id => ({ collection: 'lists', id }));
        const batchResults = await Database.batchFetch(fetchRequests);
        
        let actualEligible = 0;
        for (const listId of listIds) {
          const list = batchResults[`lists:${listId}`];
          if (list && list.entries && Array.isArray(list.entries)) {
            for (const entry of list.entries) {
              const entryId = entry.id || entry.data?.['Ticket Code'] || entry.data?.ticketCode;
              if (!entryId || !samePrizeWinnerIds.has(entryId)) {
                actualEligible++;
              } else {
                excludedCount++;
              }
            }
          }
        }
        eligibleEntryCount = actualEligible;
        console.log('Eligible entries after exclusion:', actualEligible, 'Excluded:', excludedCount);
      }
    } catch (error) {
      console.error('Error calculating eligible entries:', error);
      // Fall back to total count if there's an error
    }
  }

  // Update total entries display with excluded count if applicable
  let displayText = eligibleEntryCount.toLocaleString();
  if (excludedCount > 0) {
    displayText += ` (${excludedCount} excluded)`;
    console.log('Updating display with exclusions:', displayText);
  }
  
  // Update both elements - one in setup tab, one in public view
  const totalSelectedEntries = document.getElementById('totalSelectedEntries');
  if (totalSelectedEntries) {
    totalSelectedEntries.textContent = displayText;
  }
  
  const totalEntriesDisplay = document.getElementById('totalEntriesDisplay');
  if (totalEntriesDisplay) {
    totalEntriesDisplay.textContent = displayText;
  }

  // Check if winners count exceeds available entries and add warning
  const winnersCount = parseInt(quickWinnersCount.value) || 0;
  const winnersCountDisplay = document.getElementById('winnersCountDisplay');
  
  // Show warning when winners exceed available entries (including when entries are 0)
  const showWarning = winnersCount > 0 && winnersCount > eligibleEntryCount && selectedCheckboxes.length > 0;
  
  // Debug logging
  console.log('Warning check:', {
    winnersCount,
    eligibleEntryCount,
    totalEntryCount,
    selectedLists: selectedCheckboxes.length,
    showWarning
  });
  
  if (showWarning) {
    // Add red styling when winners exceed entries
    quickWinnersCount.classList.add('border-danger', 'text-danger');
    quickWinnersCount.style.borderWidth = '2px';
    
    // Also update the display card if it exists
    if (winnersCountDisplay) {
      winnersCountDisplay.classList.add('text-danger', 'fw-bold');
      winnersCountDisplay.textContent = `${winnersCount} ⚠️`;
    }
    
    // Add a warning message if not already present
    let warningElement = quickWinnersCount.parentElement.querySelector('.winners-warning');
    if (!warningElement) {
      warningElement = document.createElement('small');
      warningElement.className = 'text-danger d-block mt-1 winners-warning';
      quickWinnersCount.parentElement.appendChild(warningElement);
    }
    
    // Update warning message based on the situation
    if (eligibleEntryCount === 0) {
      warningElement.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> No entries available`;
    } else {
      warningElement.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> Listed Participants (${eligibleEntryCount})`;
    }
  } else {
    // Remove red styling when count is valid
    quickWinnersCount.classList.remove('border-danger', 'text-danger');
    quickWinnersCount.style.borderWidth = '';
    
    if (winnersCountDisplay) {
      winnersCountDisplay.classList.remove('text-danger', 'fw-bold');
      winnersCountDisplay.textContent = winnersCount;
    }
    
    // Remove warning message
    const warningElement = quickWinnersCount.parentElement.querySelector('.winners-warning');
    if (warningElement) {
      warningElement.remove();
    }
  }
  
  // Enable play button only if at least one list and a prize are selected
  const bigPlayButton = document.getElementById('bigPlayButton');
  if (bigPlayButton) {
    bigPlayButton.disabled = selectedCheckboxes.length === 0 || !quickPrizeSelect.value;
  }
}

async function updateTotalEntries() {
  // This function is now handled by updateSelectionInfo() for multiple lists
  // Keeping it for backward compatibility but just call updateSelectionInfo
  await updateSelectionInfo();
}

// Promise-based confirmation modal
function showConfirmationPromise(title, message) {
  return new Promise((resolve) => {
    const modalTitle = document.getElementById('appModalLabel');
    const modalBody = document.getElementById('appModalBody');
    const confirmBtn = document.getElementById('appModalConfirmBtn');
    const cancelBtn = document.querySelector('#appModal .modal-footer .btn-secondary');

    modalTitle.textContent = title;
    modalBody.innerHTML = `<p>${message}</p>`;
    confirmBtn.textContent = 'Confirm';
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';

    // Clean up old event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Handler for confirmation
    const handleConfirm = () => {
      if (window.appModal) window.appModal.hide();
      document.removeEventListener('keydown', keyHandler);
      resolve(true);
    };

    // Handler for cancellation
    const handleCancel = () => {
      if (window.appModal) window.appModal.hide();
      document.removeEventListener('keydown', keyHandler);
      resolve(false);
    };

    // Keyboard event handler
    const keyHandler = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    };

    newConfirmBtn.onclick = handleConfirm;
    newCancelBtn.onclick = handleCancel;

    // Add keyboard listener when modal is shown
    document.addEventListener('keydown', keyHandler);

    // Remove keyboard listener when modal is hidden
    const modal = document.getElementById('appModal');
    modal.addEventListener('hidden.bs.modal', () => {
      document.removeEventListener('keydown', keyHandler);
    }, { once: true });

    if (window.appModal) window.appModal.show();
  });
}

// Enhanced showConfirmationModal that supports both callbacks and promises
function enhancedShowConfirmationModal(title, message, onConfirm) {
  if (!onConfirm) {
    return showConfirmationPromise(title, message);
  }
  return showConfirmationModal(title, message, onConfirm);
}

// Update the count and total entries for selected lists
function updateListSelectionCount() {
  const checkboxes = document.querySelectorAll('#quickListSelect .list-checkbox:checked');
  const selectedCount = checkboxes.length;
  const totalLists = document.querySelectorAll('#quickListSelect .list-checkbox').length;
  
  // Update count display
  const countElement = document.getElementById('selectedListsCount');
  if (countElement) {
    countElement.textContent = `${selectedCount} of ${totalLists} lists selected`;
  }
  
  // Calculate total entries and detect duplicates
  let totalEntries = 0;
  const allEntryIds = new Set();
  const duplicateIds = new Set();
  
  checkboxes.forEach(checkbox => {
    const entryCount = parseInt(checkbox.dataset.entryCount || 0);
    totalEntries += entryCount;
  });
  
  // Update total entries display
  const totalElement = document.getElementById('totalSelectedEntries');
  if (totalElement) {
    totalElement.textContent = totalEntries.toLocaleString();
  }
  
  // Note: Actual duplicate detection will happen when lists are loaded
  // This is just for UI display
  const duplicatesElement = document.getElementById('duplicatesRemoved');
  if (duplicatesElement && duplicateIds.size > 0) {
    duplicatesElement.textContent = `(${duplicateIds.size} duplicates will be removed)`;
  } else if (duplicatesElement) {
    duplicatesElement.textContent = '';
  }
}

export const UI = {
  generateId,
  showToast,
  showProgress,
  updateProgress,
  hideProgress,
  showConfirmationModal: enhancedShowConfirmationModal,
  readFileAsText,
  populateQuickSelects,
  applyVisibilitySettings,
  syncUI,
  updateSelectionInfo,
  updateTotalEntries,
  updateListSelectionCount
};

window.UI = UI;
