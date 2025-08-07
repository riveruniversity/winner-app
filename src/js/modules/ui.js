// ================================
// UI UTILITIES & MODALS
// ================================

// ================================
// UI UTILITIES & MODALS
// ================================

import { Database } from './firestore.js';
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
    const listsData = lists || await Database.getFromStore('lists');
    const prizesData = prizes || await Database.getFromStore('prizes');

    const quickListSelect = document.getElementById('quickListSelect');
    const quickPrizeSelect = document.getElementById('quickPrizeSelect');
    const quickWinnersCount = document.getElementById('quickWinnersCount');
    
    let settingsChanged = false;

    if (quickListSelect) {
      quickListSelect.innerHTML = '<option value="">Select List...</option>';
      listsData.forEach(list => {
        const listId = list.listId || list.metadata.listId;
        const option = document.createElement('option');
        option.value = listId;
        option.textContent = `${list.metadata.name} (${list.entries.length})`;
        quickListSelect.appendChild(option);
      });
      
      if (settings.selectedListId) {
        const listOption = quickListSelect.querySelector(`option[value="${settings.selectedListId}"]`);
        if (listOption) {
          quickListSelect.value = settings.selectedListId;
          console.log('Restored list selection:', settings.selectedListId);
        } else {
          console.log('Saved list selection not found, clearing setting:', settings.selectedListId);
          settings.selectedListId = '';
          settingsChanged = true;
        }
      } else {
        console.log('No saved list selection to restore');
      }
    }

    if (quickPrizeSelect) {
      quickPrizeSelect.innerHTML = '<option value="">Select Prize...</option>';
      prizesData.filter(prize => prize.quantity > 0).forEach(prize => {
        const option = document.createElement('option');
        option.value = prize.prizeId;
        option.textContent = `${prize.name} (${prize.quantity} available)`;
        quickPrizeSelect.appendChild(option);
      });
      
      if (settings.selectedPrizeId) {
        const prizeOption = quickPrizeSelect.querySelector(`option[value="${settings.selectedPrizeId}"]`);
        if (prizeOption) {
          quickPrizeSelect.value = settings.selectedPrizeId;
          console.log('Restored prize selection:', settings.selectedPrizeId);
        } else {
          console.log('Saved prize selection not found, clearing setting:', settings.selectedPrizeId);
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

  const listOption = quickListSelect.options[quickListSelect.selectedIndex];
  const prizeOption = quickPrizeSelect.options[quickPrizeSelect.selectedIndex];

  const listText = listOption ? listOption.textContent.split(' (')[0] : 'Not Selected';
  const prizeText = prizeOption ? prizeOption.textContent.split(' (')[0] : 'Not Selected';

  document.getElementById('currentListDisplay').textContent = listText;
  document.getElementById('currentPrizeDisplay').textContent = prizeText;
  document.getElementById('winnersCountDisplay').textContent = quickWinnersCount.value;

  // Note: Quick selection fields are now handled by unified Settings.setupQuickSetupAutoSave() system
  // This function is kept for legacy compatibility but the auto-save is handled elsewhere

  // Update total entries when list changes
  if (quickListSelect.value) {
    updateTotalEntries();
  } else {
    document.getElementById('totalEntriesDisplay').textContent = '0';
  }

  // Enable play button only if list and prize are selected
  const bigPlayButton = document.getElementById('bigPlayButton');
  if (bigPlayButton) {
    bigPlayButton.disabled = !quickListSelect.value || !quickPrizeSelect.value;
  }
}

async function updateTotalEntries() {
  try {
    const quickListSelect = document.getElementById('quickListSelect');
    const listId = quickListSelect.value;
    if (listId) {
      const list = await Database.getFromStore('lists', listId);
      if (list) {
        document.getElementById('totalEntriesDisplay').textContent = list.entries.length;
        // Update currentList for later use
        // This will be handled by app.js or a central state management
      }
    }
  } catch (error) {
    console.error('Error updating total entries:', error);
  }
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
  updateTotalEntries
};

window.UI = UI;
