// ================================
// PRIZES MANAGEMENT
// ================================

import { Database } from './firestore.js';
import { UI } from './ui.js';
import { settings, Settings } from './settings.js';

async function loadPrizes(prizesData = null) {
    try {
      const prizes = prizesData || await Database.getFromStore('prizes');
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

      const prizeCards = prizes.map(prize => {
        const prizeId = prize.prizeId;
        const isSelected = settings.selectedPrizeId === prizeId;
        const isAvailable = prize.quantity > 0;
        
        return `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 ${isSelected ? 'border-success border-2' : ''}">
            <div class="card-header ${isSelected ? 'bg-success bg-opacity-10' : ''}">
              <div class="d-flex justify-content-between align-items-center">
                <h5 class="card-title mb-0">${prize.name}</h5>
                <div>
                  ${isSelected ? '<span class="badge bg-success me-2"><i class="bi bi-check-circle-fill"></i> Selected</span>' : ''}
                  <span class="badge ${isAvailable ? 'bg-primary' : 'bg-secondary'}">${prize.quantity}</span>
                </div>
              </div>
            </div>
            <div class="card-body d-flex flex-column">
              ${prize.description ? `<p class="card-text text-muted small">${prize.description}</p>` : '<p class="card-text text-muted small">No description</p>'}
              <div class="mt-auto pt-3">
                <div class="d-flex justify-content-between">
                  <button class="btn btn-sm ${isSelected ? 'btn-success' : 'btn-outline-success'}" 
                          onclick="Prizes.selectPrize('${prizeId}')" 
                          ${isSelected || !isAvailable ? 'disabled' : ''}>
                    <i class="bi ${isSelected ? 'bi-check-circle-fill' : 'bi-check-circle'}"></i> ${isSelected ? 'Selected' : 'Select'}
                  </button>
                  <div>
                    <button class="btn btn-sm btn-outline-primary me-2" data-prize-id="${prizeId}" onclick="Prizes.editPrizeModal('${prizeId}')">
                      <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger" data-prize-id="${prizeId}" onclick="Prizes.deletePrizeConfirm('${prizeId}')">
                      <i class="bi bi-trash"></i> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      }).join('');

      if (gridContainer) {
        gridContainer.innerHTML = prizeCards;
      }
      
      // Backward compatibility for old container
      if (oldContainer) {
        oldContainer.innerHTML = prizes.map(prize => {
          const prizeId = prize.prizeId;
          const isSelected = settings.selectedPrizeId === prizeId;
          const isAvailable = prize.quantity > 0;
          
          return `
          <div class="card mb-3 ${isSelected ? 'border-success border-2' : ''}">
            <div class="card-header ${isSelected ? 'bg-success bg-opacity-10' : ''}">
              <div class="d-flex justify-content-between align-items-center">
                <h6 class="card-title mb-0">${prize.name}</h6>
                <div>
                  ${isSelected ? '<span class="badge bg-success me-2"><i class="bi bi-check-circle-fill"></i></span>' : ''}
                  <span class="badge ${isAvailable ? 'bg-primary' : 'bg-secondary'}">${prize.quantity}</span>
                </div>
              </div>
            </div>
            <div class="card-body d-flex flex-column">
              <p class="card-text text-muted small">
                ${prize.description || 'No description'}
              </p>
              <div class="mt-auto pt-3">
                <div class="d-flex justify-content-between">
                  <button class="btn btn-sm ${isSelected ? 'btn-success' : 'btn-outline-success'}" 
                          onclick="Prizes.selectPrize('${prizeId}')" 
                          ${isSelected || !isAvailable ? 'disabled' : ''}>
                    <i class="bi ${isSelected ? 'bi-check-circle-fill' : 'bi-check-circle'}"></i> ${isSelected ? 'Selected' : 'Select'}
                  </button>
                  <div>
                    <button class="btn btn-sm btn-outline-primary me-2" data-prize-id="${prizeId}" onclick="Prizes.editPrizeModal('${prizeId}')">
                      <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger" data-prize-id="${prizeId}" onclick="Prizes.deletePrizeConfirm('${prizeId}')">
                      <i class="bi bi-trash"></i> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        }).join('');
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

// Function to select a prize (like selecting from the setup tab)
async function selectPrize(prizeId) {
  try {
    // Get the prize to check if it's available
    const prizes = await Database.getFromStore('prizes');
    const selectedPrize = prizes.find(p => p.prizeId === prizeId);
    
    if (!selectedPrize) {
      UI.showToast('Prize not found', 'error');
      return;
    }
    
    if (selectedPrize.quantity <= 0) {
      UI.showToast('This prize is out of stock', 'warning');
      return;
    }
    
    // Update settings with the selected prize
    settings.selectedPrizeId = prizeId;
    
    // Save settings
    await Settings.saveSettings();
    
    // Update the quick select dropdown if it exists
    const quickPrizeSelect = document.getElementById('quickPrizeSelect');
    if (quickPrizeSelect) {
      quickPrizeSelect.value = prizeId;
    }
    
    // Update winners count based on prize quantity
    const quickWinnersCount = document.getElementById('quickWinnersCount');
    if (quickWinnersCount) {
      const currentCount = parseInt(quickWinnersCount.value) || 1;
      if (currentCount > selectedPrize.quantity) {
        quickWinnersCount.value = selectedPrize.quantity;
        settings.winnersCount = selectedPrize.quantity;
      }
      quickWinnersCount.max = selectedPrize.quantity;
    }
    
    // Refresh the prizes display to show the selected state
    await loadPrizes();
    
    // Update quick selects
    await UI.populateQuickSelects();
    
    // Show success message
    UI.showToast(`Prize "${selectedPrize.name}" selected (${selectedPrize.quantity} available)`, 'success');
    
    // Switch to Setup tab if not already there
    const setupTab = document.querySelector('a[href="#setup"]');
    if (setupTab && !setupTab.classList.contains('active')) {
      setupTab.click();
    }
    
  } catch (error) {
    console.error('Error selecting prize:', error);
    UI.showToast('Error selecting prize: ' + error.message, 'error');
  }
}

export const Prizes = {
  loadPrizes,
  handleAddPrize,
  showAddPrizeModal,
  editPrize,
  editPrizeModal,
  deletePrizeConfirm,
  selectPrize
};

window.Prizes = Prizes;