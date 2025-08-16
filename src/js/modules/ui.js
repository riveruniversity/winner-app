// ================================
// UI UTILITIES & MODALS
// ================================

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

function showConfirmationModal(title, message, onConfirm) {
  const modalTitle = document.getElementById('appModalLabel');
  const modalBody = document.getElementById('appModalBody');
  const confirmBtn = document.getElementById('appModalConfirmBtn');
  const cancelBtn = document.querySelector('#appModal .modal-footer .btn-secondary');

  modalTitle.textContent = title;
  modalBody.innerHTML = `<p>${message}</p>`;
  confirmBtn.textContent = 'Confirm';
  confirmBtn.className = 'btn btn-danger';
  confirmBtn.style.display = 'inline-block';
  cancelBtn.textContent = 'Cancel';

  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error(`Error in confirmation modal for "${title}":`, error);
      showToast(`Operation failed: ${error.message}`, 'error');
    } finally {
      window.appModal.hide();
    }
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
          const listId = list.listId || list.metadata.listId;
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
        updateSelectionInfo(); // Update display after restoring selections
      } else if (settings.selectedListId) {
        // Backward compatibility - convert single selection to array
        const checkbox = quickListSelect.querySelector(`input[value="${settings.selectedListId}"]`);
        if (checkbox) {
          checkbox.checked = true;
          settings.selectedListIds = [settings.selectedListId];
          settingsChanged = true;
          updateListSelectionCount();
          updateSelectionInfo(); // Update display after restoring selections
        }
      } else {
        console.log('No saved list selection to restore');
      }
    }

    if (quickPrizeSelect) {
      quickPrizeSelect.innerHTML = '<option value="">Select Prize...</option>';
      console.log('All prizes before filter:', prizesData.map(p => ({ id: p.prizeId, name: p.name, qty: p.quantity })));
      const availablePrizes = prizesData.filter(prize => prize.quantity > 0);
      console.log('Available prizes after filter (qty > 0):', availablePrizes.map(p => ({ id: p.prizeId, name: p.name, qty: p.quantity })));
      
      availablePrizes.forEach(prize => {
        const option = document.createElement('option');
        option.value = prize.prizeId;
        option.textContent = `${prize.name} (${prize.quantity} available)`;
        quickPrizeSelect.appendChild(option);
      });
      
      if (settings.selectedPrizeId) {
        console.log('Trying to restore prize:', settings.selectedPrizeId);
        const prizeOption = quickPrizeSelect.querySelector(`option[value="${settings.selectedPrizeId}"]`);
        if (prizeOption) {
          quickPrizeSelect.value = settings.selectedPrizeId;
          console.log('Restored prize selection:', settings.selectedPrizeId);
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

    updateSelectionInfo();
    
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
    updateSelectionInfo();
  } catch (error) {
    console.error('Error syncing UI:', error);
    showToast('Failed to refresh the application interface.', 'error');
  }
}

function updateSelectionInfo() {
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

  document.getElementById('currentListDisplay').textContent = listText;
  document.getElementById('currentPrizeDisplay').textContent = prizeText;
  document.getElementById('winnersCountDisplay').textContent = quickWinnersCount.value;

  // Update total entries display
  document.getElementById('totalEntriesDisplay').textContent = totalEntryCount.toLocaleString();

  // Enable play button only if at least one list and a prize are selected
  const bigPlayButton = document.getElementById('bigPlayButton');
  if (bigPlayButton) {
    bigPlayButton.disabled = selectedCheckboxes.length === 0 || !quickPrizeSelect.value;
  }
}

async function updateTotalEntries() {
  // This function is now handled by updateSelectionInfo() for multiple lists
  // Keeping it for backward compatibility but just call updateSelectionInfo
  updateSelectionInfo();
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

    newConfirmBtn.onclick = () => {
      if (window.appModal) window.appModal.hide();
      resolve(true);
    };

    newCancelBtn.onclick = () => {
      if (window.appModal) window.appModal.hide();
      resolve(false);
    };

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
