// ================================
// PRIZES MANAGEMENT
// ================================

import { Database } from './database.js';
import { UI } from './ui.js';
import { Validation } from './validation.js';

// Load prizes - uses centralized data store
// Alpine x-for templates react automatically to store changes
async function loadPrizes(prizesData = null) {
  try {
    if (window.Alpine) {
      const dataStore = Alpine.store('data');
      if (dataStore) {
        if (prizesData) {
          // If data was passed, update centralized store directly
          dataStore.prizes = prizesData;
        } else {
          // Otherwise load from database
          await dataStore.load('prizes');
        }
      }
    }
  } catch (error) {
    console.error('Error loading prizes:', error);
    UI.showToast('Error loading prizes: ' + error.message, 'error');
  }
}

  async function handleAddPrize() {
    const prizeNameInput = document.getElementById('prizeName');
    const prizeQuantityInput = document.getElementById('prizeQuantity');
    const prizeDescriptionInput = document.getElementById('prizeDescription');

    // Validate prize name
    const nameValidation = Validation.validateName(prizeNameInput.value, 'Prize name');
    if (!nameValidation.isValid) {
      UI.showToast(nameValidation.error, 'warning');
      prizeNameInput.value = nameValidation.value;
      return;
    }
    const name = nameValidation.value;

    // Validate quantity
    const quantityValidation = Validation.validatePrizeQuantity(prizeQuantityInput.value);
    if (!quantityValidation.isValid) {
      UI.showToast(quantityValidation.error, 'warning');
      prizeQuantityInput.value = quantityValidation.value;
      return;
    }
    const quantity = quantityValidation.value;

    // Validate description (optional, but still check length)
    const descriptionValidation = Validation.validateName(prizeDescriptionInput.value || '', 'Description');
    const description = descriptionValidation.value;

    try {
      const prizeId = UI.generateId();
      const prize = {
        prizeId: prizeId,
        name: name,
        quantity: quantity,
        description: description,
        timestamp: Date.now()
      };

      await Database.saveToStore('prizes', prize);

      UI.showToast(`Prize "${name}" added`, 'success');

      // Clear form
      prizeNameInput.value = '';
      prizeQuantityInput.value = '1';
      prizeDescriptionInput.value = '';

      // Refresh Alpine store (updates UI reactively)
      await loadPrizes();
    } catch (error) {
      console.error('Error adding prize:', error);
      UI.showToast('Error adding prize: ' + error.message, 'error');
    }
  }

  // Show Add Prize Modal
  // Open Add Prize modal via Alpine formModal
  async function showAddPrizeModal() {
    if (window.alpineFormModal) {
      await window.alpineFormModal.openPrizeForm();
    } else {
      console.error('Alpine formModal not initialized');
      UI.showToast('Error: Form modal not properly initialized', 'error');
    }
  }

  // Open Edit Prize modal via Alpine formModal
  async function editPrizeModal(prizeId) {
    const prizes = await Database.getFromStore('prizes');
    const prize = prizes.find(p => p.prizeId === prizeId);
    if (!prize) {
      UI.showToast('Prize not found', 'error');
      return;
    }

    if (window.alpineFormModal) {
      await window.alpineFormModal.openPrizeForm(prize);
    } else {
      console.error('Alpine formModal not initialized');
      UI.showToast('Error: Form modal not properly initialized', 'error');
    }
  }
  
async function deletePrizeConfirm(prizeId) {
  UI.showConfirmationModal('Delete Prize', 'Are you sure you want to delete this prize?', async () => {
    await Database.deleteFromStore('prizes', prizeId);
    UI.showToast('Prize deleted', 'success');
    await loadPrizes(); // Updates Alpine store reactively
  });
}

// Export public functions
export const Prizes = {
  loadPrizes,
  handleAddPrize,
  showAddPrizeModal,
  editPrizeModal,
  deletePrizeConfirm
};

// Keep for onclick handlers in Alpine templates
window.Prizes = Prizes;
