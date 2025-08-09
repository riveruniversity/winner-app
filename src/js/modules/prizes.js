// ================================
// PRIZES MANAGEMENT
// ================================

import { Database } from './firestore.js';
import { UI } from './ui.js';

async function loadPrizes() {
    try {
      const prizes = await Database.getFromStore('prizes');
      const gridContainer = document.getElementById('prizesGrid');
      const noPrizesMessage = document.getElementById('noPrizesMessage');
      
      // Also check for old container for backward compatibility
      const oldContainer = document.getElementById('prizesContainer');

      if (!gridContainer && !oldContainer) return;

      if (prizes.length === 0) {
        if (gridContainer) gridContainer.innerHTML = '';
        if (noPrizesMessage) noPrizesMessage.style.display = 'block';
        if (oldContainer) oldContainer.innerHTML = '<p class="text-muted">No prizes added yet.</p>';
        return;
      }

      if (noPrizesMessage) noPrizesMessage.style.display = 'none';

      const prizeCards = prizes.map(prize => `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100">
            <div class="card-header">
              <div class="d-flex justify-content-between align-items-center">
                <h5 class="card-title mb-0">${prize.name}</h5>
                <span class="badge bg-primary">${prize.quantity}</span>
              </div>
            </div>
            <div class="card-body d-flex flex-column">
              ${prize.description ? `<p class="card-text text-muted small">${prize.description}</p>` : '<p class="card-text text-muted small">No description</p>'}
              <div class="mt-auto pt-3 text-end">
                <button class="btn btn-sm btn-outline-primary me-2" data-prize-id="${prize.prizeId}" onclick="Prizes.editPrizeModal('${prize.prizeId}')">
                  <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" data-prize-id="${prize.prizeId}" onclick="Prizes.deletePrizeConfirm('${prize.prizeId}')">
                  <i class="bi bi-trash"></i> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      `).join('');

      if (gridContainer) {
        gridContainer.innerHTML = prizeCards;
      }
      
      // Backward compatibility for old container
      if (oldContainer) {
        oldContainer.innerHTML = prizes.map(prize => `
          <div class="card mb-3">
            <div class="card-header">
              <div class="d-flex justify-content-between align-items-center">
                <h6 class="card-title mb-0">${prize.name}</h6>
                <span class="badge bg-primary">${prize.quantity}</span>
              </div>
            </div>
            <div class="card-body d-flex flex-column">
              <p class="card-text text-muted small">
                ${prize.description || 'No description'}
              </p>
              <div class="mt-auto pt-3 text-end">
                <button class="btn btn-sm btn-outline-primary me-2" data-prize-id="${prize.prizeId}" onclick="Prizes.editPrizeModal('${prize.prizeId}')">
                  <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" data-prize-id="${prize.prizeId}" onclick="Prizes.deletePrizeConfirm('${prize.prizeId}')">
                  <i class="bi bi-trash"></i> Delete
                </button>
              </div>
            </div>
          </div>
        `).join('');
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

  // Show Add Prize Modal
  async function showAddPrizeModal() {
    const modalTitle = document.getElementById('appModalLabel');
    const modalBody = document.getElementById('appModalBody');
    const confirmBtn = document.getElementById('appModalConfirmBtn');

    modalTitle.textContent = 'Add New Prize';
    modalBody.innerHTML = `
      <div class="mb-3">
        <label for="modalPrizeName" class="form-label">Prize Name <span class="text-danger">*</span></label>
        <input type="text" class="form-control" id="modalPrizeName" placeholder="Enter prize name" required>
      </div>
      <div class="mb-3">
        <label for="modalPrizeQuantity" class="form-label">Quantity <span class="text-danger">*</span></label>
        <input type="number" class="form-control" id="modalPrizeQuantity" value="1" min="1" required>
      </div>
      <div class="mb-3">
        <label for="modalPrizeDescription" class="form-label">Description (Optional)</label>
        <textarea class="form-control" id="modalPrizeDescription" rows="3" placeholder="Enter prize description"></textarea>
      </div>
    `;
    
    confirmBtn.textContent = 'Add Prize';
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.style.display = 'inline-block';

    // Remove old event listeners by replacing the button
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', async () => {
      const name = document.getElementById('modalPrizeName').value.trim();
      const quantity = parseInt(document.getElementById('modalPrizeQuantity').value);
      const description = document.getElementById('modalPrizeDescription').value.trim();

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
        
        await loadPrizes();
        await UI.populateQuickSelects();
        window.appModal.hide();
      } catch (error) {
        console.error('Error adding prize:', error);
        UI.showToast('Error adding prize: ' + error.message, 'error');
      }
    }, { once: true });

    window.appModal.show();
  }

  // Edit Prize Modal (renamed from editPrize to editPrizeModal)
  async function editPrizeModal(prizeId) {
    const prizes = await Database.getFromStore('prizes');
    const prize = prizes.find(p => p.prizeId === prizeId);
    if (!prize) return;

    const modalTitle = document.getElementById('appModalLabel');
    const modalBody = document.getElementById('appModalBody');
    const confirmBtn = document.getElementById('appModalConfirmBtn');

    modalTitle.textContent = 'Edit Prize';
    modalBody.innerHTML = `
      <div class="mb-3">
        <label for="modalPrizeName" class="form-label">Prize Name <span class="text-danger">*</span></label>
        <input type="text" class="form-control" id="modalPrizeName" value="${prize.name}" required>
      </div>
      <div class="mb-3">
        <label for="modalPrizeQuantity" class="form-label">Quantity <span class="text-danger">*</span></label>
        <input type="number" class="form-control" id="modalPrizeQuantity" value="${prize.quantity}" min="0" required>
      </div>
      <div class="mb-3">
        <label for="modalPrizeDescription" class="form-label">Description (Optional)</label>
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
  
  // Keep old editPrize for backward compatibility
  async function editPrize(prizeId) {
    return editPrizeModal(prizeId);
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
  showAddPrizeModal,
  editPrize,
  editPrizeModal,
  deletePrizeConfirm
};

window.Prizes = Prizes;