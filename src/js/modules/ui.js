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
  const modalTitle = document.getElementById('confirmModalLabel');
  const modalBody = document.getElementById('confirmModalBody');
  const confirmBtn = document.getElementById('confirmModalConfirmBtn');
  const cancelBtn = document.querySelector('#confirmModal .modal-footer .btn-secondary');

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
  const modal = document.getElementById('confirmModal');
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

// populateQuickSelects removed - Alpine x-for handles list/prize dropdowns reactively

function applyVisibilitySettings() {
  const totalEntriesCard = document.getElementById('totalEntriesCard');
  if (totalEntriesCard) {
    totalEntriesCard.style.display = settings.hideEntryCounts ? 'none' : 'block';
  }
}

async function syncUI() {
  try {
    // Alpine stores handle list/prize data reactively
    applyVisibilitySettings();
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
  
  // Warning display is now handled by Alpine in index.html
  // Remove any old vanilla JS warnings that might exist
  const oldWarning = quickWinnersCount.parentElement.querySelector('.winners-warning');
  if (oldWarning) {
    oldWarning.remove();
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
    const modalTitle = document.getElementById('confirmModalLabel');
    const modalBody = document.getElementById('confirmModalBody');
    const confirmBtn = document.getElementById('confirmModalConfirmBtn');
    const cancelBtn = document.querySelector('#confirmModal .modal-footer .btn-secondary');

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
    const modal = document.getElementById('confirmModal');
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
  applyVisibilitySettings,
  syncUI,
  updateSelectionInfo,
  updateTotalEntries,
  updateListSelectionCount
};

window.UI = UI;
