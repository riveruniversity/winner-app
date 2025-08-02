// ================================
// PRIZES MANAGEMENT
// ================================

import { Database } from './firestore-service.js';
import { UI } from './ui.js';

async function loadPrizes() {
    try {
      const prizes = await Database.getAllFromStore('prizes');
      const container = document.getElementById('prizesContainer');

      if (!container) return;

      if (prizes.length === 0) {
        container.innerHTML = '<p class="text-muted">No prizes added yet.</p>';
        return;
      }

      container.innerHTML = prizes.map(prize => `
        <div class="card mb-3">
          <div class="card-body">
            <h6 class="card-title">${prize.name}</h6>
            <p class="card-text">
              <span class="badge bg-primary">Qty: ${prize.quantity}</span>
              ${prize.description ? `<br><small class="text-muted">${prize.description}</small>` : ''}
            </p>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" data-prize-id="${prize.prizeId}" onclick="Prizes.editPrize(this.dataset.prizeId)">
                <i class="bi bi-pencil"></i> Edit
              </button>
              <button class="btn btn-outline-danger" data-prize-id="${prize.prizeId}" onclick="Prizes.deletePrizeConfirm(this.dataset.prizeId)">
                <i class="bi bi-trash"></i> Delete
              </button>
            </div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading prizes:', error);
      UI.showToast('Error loading prizes: ' + error.message, 'error');
    }
  }

  async function handleAddPrize() {
    const prizeNameInput = document.getElementById('prizeName');
    const prizeQuantityInput = document.getElementById('prizeQuantity');
    const prizeDescriptionInput = document.getElementById('prizeDescription');

    const name = prizeNameInput.value.trim();
    const quantity = parseInt(prizeQuantityInput.value);
    const description = prizeDescriptionInput.value.trim();

    if (!name) {
      UI.showToast('Please enter a prize name', 'warning');
      return;
    }

    if (quantity < 1) {
      UI.showToast('Please enter a valid quantity', 'warning');
      return;
    }

    try {
      const prizeId = UI.generateId();
      const prize = {
        prizeId: prizeId,
        name: name,
        quantity: quantity,
        description: description,
        timestamp: Date.now(),
        id: prizeId
      };

      await Database.saveToStore('prizes', prize);

      UI.showToast(`Prize "${name}" added successfully`, 'success');

      // Clear form
      prizeNameInput.value = '';
      prizeQuantityInput.value = '1';
      prizeDescriptionInput.value = '';

      // Refresh displays
      await loadPrizes();
      await UI.populateQuickSelects();

    } catch (error) {
      console.error('Error adding prize:', error);
      UI.showToast('Error adding prize: ' + error.message, 'error');
    }
  }

  async function editPrize(prizeId) {
    const prizes = await Database.getAllFromStore('prizes');
    const prize = prizes.find(p => p.prizeId === prizeId);
    if (!prize) return;

    const modalTitle = document.getElementById('appModalLabel');
    const modalBody = document.getElementById('appModalBody');
    const confirmBtn = document.getElementById('appModalConfirmBtn');

    modalTitle.textContent = 'Edit Prize';
    modalBody.innerHTML = `
      <div class="mb-3">
        <label for="modalPrizeName" class="form-label">Prize Name</label>
        <input type="text" class="form-control" id="modalPrizeName" value="${prize.name}">
      </div>
      <div class="mb-3">
        <label for="modalPrizeQuantity" class="form-label">Quantity</label>
        <input type="number" class="form-control" id="modalPrizeQuantity" value="${prize.quantity}" min="0">
      </div>
      <div class="mb-3">
        <label for="modalPrizeDescription" class="form-label">Description</label>
        <textarea class="form-control" id="modalPrizeDescription" rows="3">${prize.description || ''}</textarea>
      </div>
    `;
    confirmBtn.textContent = 'Save Changes';
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.style.display = 'inline-block';

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', async () => {
      const newName = document.getElementById('modalPrizeName').value.trim();
      const newQuantity = parseInt(document.getElementById('modalPrizeQuantity').value);
      const newDescription = document.getElementById('modalPrizeDescription').value.trim();

      if (newName && newQuantity >= 0) {
        prize.name = newName;
        prize.quantity = newQuantity;
        prize.description = newDescription;
        await Database.saveToStore('prizes', prize);

        UI.showToast('Prize updated successfully', 'success');
        await loadPrizes();
        await UI.populateQuickSelects();
        window.appModal.hide();
      } else {
        UI.showToast('Please enter valid prize details.', 'warning');
      }
    }, { once: true });

    window.appModal.show();
  }

  async function deletePrizeConfirm(prizeId) {
    UI.showConfirmationModal('Delete Prize', 'Are you sure you want to delete this prize?', async () => {
      await Database.deleteFromStore('prizes', prizeId);
      UI.showToast('Prize deleted successfully', 'success');
      await loadPrizes();
      await UI.populateQuickSelects();
    });
  }

export const Prizes = {
  loadPrizes,
  handleAddPrize,
  editPrize,
  deletePrizeConfirm
};

window.Prizes = Prizes;