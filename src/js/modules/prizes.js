// ================================
// PRIZES MANAGEMENT
// ================================

import { Database } from './database.js';
import { DOMUtils } from './dom-utils.js';
import eventManager from './event-manager.js';
import { UI } from './ui.js';
import { settings, Settings } from './settings.js';

async function loadPrizes(prizesData = null) {
    try {
      const prizes = prizesData || await Database.getFromStore('prizes');
      const gridContainer = document.getElementById('prizesGrid');
      const noPrizesMessage = document.getElementById('noPrizesMessage');
      
      if (!gridContainer) return;

      if (prizes.length === 0) {
        if (gridContainer) gridContainer.textContent = '';
        if (noPrizesMessage) noPrizesMessage.style.display = 'block';
        return;
      }

      if (noPrizesMessage) noPrizesMessage.style.display = 'none';

      if (gridContainer) {
        // Clear existing content
        gridContainer.textContent = '';
        
        // Create prize cards using fragment for performance
        const fragment = DOMUtils.createFragment(prizes, (prize) => {
          const prizeId = prize.prizeId;
          const isSelected = settings.selectedPrizeId === prizeId;
          const isAvailable = prize.quantity > 0;
          
          // Create column container
          const col = document.createElement('div');
          col.className = 'col-md-6 col-lg-4';
          
          // Create card
          const card = document.createElement('div');
          card.className = `card h-100 ${isSelected ? 'border-success border-2' : ''}`;
          
          // Create card header
          const header = document.createElement('div');
          header.className = `card-header ${isSelected ? 'bg-success bg-opacity-10' : ''}`;
          
          const headerContent = document.createElement('div');
          headerContent.className = 'd-flex justify-content-between align-items-center';
          
          const title = document.createElement('h5');
          title.className = 'card-title mb-0';
          title.textContent = prize.name;
          
          const badges = document.createElement('div');
          if (isSelected) {
            const selectedBadge = document.createElement('span');
            selectedBadge.className = 'badge bg-success me-2';
            DOMUtils.safeSetHTML(selectedBadge, '<i class="bi bi-check-circle-fill"></i> Selected', true);
            badges.appendChild(selectedBadge);
          }
          
          const qtyBadge = document.createElement('span');
          qtyBadge.className = `badge ${isAvailable ? 'bg-primary' : 'bg-secondary'}`;
          qtyBadge.textContent = String(prize.quantity);
          badges.appendChild(qtyBadge);
          
          headerContent.appendChild(title);
          headerContent.appendChild(badges);
          header.appendChild(headerContent);
          
          // Create card body
          const body = document.createElement('div');
          body.className = 'card-body d-flex flex-column';
          
          const desc = document.createElement('p');
          desc.className = 'card-text text-muted small';
          desc.textContent = prize.description || 'No description';
          body.appendChild(desc);
          
          // Create buttons container
          const btnContainer = document.createElement('div');
          btnContainer.className = 'mt-auto pt-3';
          
          const btnRow = document.createElement('div');
          btnRow.className = 'd-flex justify-content-between';
          
          // Select button
          const selectBtn = document.createElement('button');
          selectBtn.className = `btn btn-sm ${isSelected ? 'btn-success' : 'btn-outline-success'}`;
          selectBtn.disabled = isSelected || !isAvailable;
          selectBtn.dataset.prizeId = prizeId;
          DOMUtils.safeSetHTML(selectBtn, 
            `<i class="bi ${isSelected ? 'bi-check-circle-fill' : 'bi-check-circle'}"></i> ${isSelected ? 'Selected' : 'Select'}`, 
            true
          );
          
          // Action buttons container
          const actionBtns = document.createElement('div');
          
          // Edit button
          const editBtn = document.createElement('button');
          editBtn.className = 'btn btn-sm btn-outline-primary me-2';
          editBtn.dataset.prizeId = prizeId;
          DOMUtils.safeSetHTML(editBtn, '<i class="bi bi-pencil"></i> Edit', true);
          
          // Delete button  
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn btn-sm btn-outline-danger';
          deleteBtn.dataset.prizeId = prizeId;
          DOMUtils.safeSetHTML(deleteBtn, '<i class="bi bi-trash"></i> Delete', true);
          
          actionBtns.appendChild(editBtn);
          actionBtns.appendChild(deleteBtn);
          
          btnRow.appendChild(selectBtn);
          btnRow.appendChild(actionBtns);
          btnContainer.appendChild(btnRow);
          body.appendChild(btnContainer);
          
          // Assemble card
          card.appendChild(header);
          card.appendChild(body);
          col.appendChild(card);
          
          return col;
        });
        
        gridContainer.appendChild(fragment);
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
        timestamp: Date.now()
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
    
    // Build modal content safely
    modalBody.textContent = '';
    
    // Prize Name field
    const nameDiv = document.createElement('div');
    nameDiv.className = 'mb-3';
    
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'modalPrizeName';
    nameLabel.className = 'form-label';
    nameLabel.textContent = 'Prize Name ';
    const nameRequired = document.createElement('span');
    nameRequired.className = 'text-danger';
    nameRequired.textContent = '*';
    nameLabel.appendChild(nameRequired);
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-control';
    nameInput.id = 'modalPrizeName';
    nameInput.placeholder = 'Enter prize name';
    nameInput.required = true;
    
    nameDiv.appendChild(nameLabel);
    nameDiv.appendChild(nameInput);
    
    // Quantity field
    const qtyDiv = document.createElement('div');
    qtyDiv.className = 'mb-3';
    
    const qtyLabel = document.createElement('label');
    qtyLabel.htmlFor = 'modalPrizeQuantity';
    qtyLabel.className = 'form-label';
    qtyLabel.textContent = 'Quantity ';
    const qtyRequired = document.createElement('span');
    qtyRequired.className = 'text-danger';
    qtyRequired.textContent = '*';
    qtyLabel.appendChild(qtyRequired);
    
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'form-control';
    qtyInput.id = 'modalPrizeQuantity';
    qtyInput.value = '1';
    qtyInput.min = '1';
    qtyInput.required = true;
    
    qtyDiv.appendChild(qtyLabel);
    qtyDiv.appendChild(qtyInput);
    
    // Description field
    const descDiv = document.createElement('div');
    descDiv.className = 'mb-3';
    
    const descLabel = document.createElement('label');
    descLabel.htmlFor = 'modalPrizeDescription';
    descLabel.className = 'form-label';
    descLabel.textContent = 'Description (Optional)';
    
    const descTextarea = document.createElement('textarea');
    descTextarea.className = 'form-control';
    descTextarea.id = 'modalPrizeDescription';
    descTextarea.rows = 3;
    descTextarea.placeholder = 'Enter prize description';
    
    descDiv.appendChild(descLabel);
    descDiv.appendChild(descTextarea);
    
    // Template field
    const templateDiv = document.createElement('div');
    templateDiv.className = 'mb-3';
    
    const templateLabel = document.createElement('label');
    templateLabel.htmlFor = 'modalPrizeTemplate';
    templateLabel.className = 'form-label';
    templateLabel.textContent = 'SMS Template';
    
    const templateSelect = document.createElement('select');
    templateSelect.className = 'form-select';
    templateSelect.id = 'modalPrizeTemplate';
    
    // Load templates and populate dropdown
    const { Templates } = await import('./templates.js');
    const templates = await Templates.loadTemplates();
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Use default template';
    templateSelect.appendChild(defaultOption);
    
    // Add templates
    templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.templateId;
      option.textContent = template.name;
      if (template.isDefault) {
        option.textContent += ' (Default)';
      }
      templateSelect.appendChild(option);
    });
    
    templateDiv.appendChild(templateLabel);
    templateDiv.appendChild(templateSelect);
    
    modalBody.appendChild(nameDiv);
    modalBody.appendChild(qtyDiv);
    modalBody.appendChild(descDiv);
    modalBody.appendChild(templateDiv);
    
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
      const templateId = document.getElementById('modalPrizeTemplate').value;

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
          templateId: templateId || null,
          timestamp: Date.now()
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

    // Check if modal elements exist
    if (!modalTitle || !modalBody || !confirmBtn) {
      console.error('Modal elements not found');
      UI.showToast('Error: Modal not properly initialized', 'error');
      return;
    }

    modalTitle.textContent = 'Edit Prize';
    
    // Load templates for dropdown
    const { Templates } = await import('./templates.js');
    const templates = await Templates.loadTemplates();
    
    // Build template options
    let templateOptions = '<option value="">Use default template</option>';
    templates.forEach(template => {
      const selected = prize.templateId === template.templateId ? 'selected' : '';
      const label = template.isDefault ? `${template.name} (Default)` : template.name;
      templateOptions += `<option value="${template.templateId}" ${selected}>${label}</option>`;
    });
    
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
      <div class="mb-3">
        <label for="modalPrizeTemplate" class="form-label">SMS Template</label>
        <select class="form-select" id="modalPrizeTemplate">
          ${templateOptions}
        </select>
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
      const newTemplateId = document.getElementById('modalPrizeTemplate').value;

      if (newName && newQuantity >= 0) {
        prize.name = newName;
        prize.quantity = newQuantity;
        prize.description = newDescription;
        prize.templateId = newTemplateId || null;
        await Database.saveToStore('prizes', prize);

        UI.showToast('Prize updated successfully', 'success');
        await loadPrizes();
        await UI.populateQuickSelects();
        window.appModal.hide();
      } else {
        UI.showToast('Please enter valid prize details.', 'warning');
      }
    }, { once: true });

    // Check if modal exists before showing
    if (window.appModal) {
      window.appModal.show();
    } else {
      console.error('window.appModal not initialized');
      UI.showToast('Error: Modal not properly initialized', 'error');
    }
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

// Track last toast time to prevent duplicates
let lastToastTime = 0;
const TOAST_DEBOUNCE_MS = 500; // Half second debounce

// Initialize event delegation once at startup
function initPrizeEventDelegation() {
  const gridContainer = document.getElementById('prizesGrid');
  if (gridContainer) {
    eventManager.delegate(gridContainer, '[data-prize-id]', 'click', function(e) {
      const prizeId = this.dataset.prizeId;
      if (this.classList.contains('btn-outline-success') || this.classList.contains('btn-success')) {
        Prizes.selectPrize(prizeId);
      } else if (this.classList.contains('btn-outline-primary')) {
        Prizes.editPrizeModal(prizeId);
      } else if (this.classList.contains('btn-outline-danger')) {
        Prizes.deletePrizeConfirm(prizeId);
      }
    });
  }
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
    
    // Save only the selected prize setting
    await Settings.saveSingleSetting('selectedPrizeId', prizeId);
    
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
        // Also save the winners count if it needs to be adjusted
        await Settings.saveSingleSetting('winnersCount', selectedPrize.quantity);
      }
      quickWinnersCount.max = selectedPrize.quantity;
    }
    
    // Refresh the prizes display to show the selected state
    await loadPrizes();
    
    // Update quick selects - this will also update the selection info
    // Note: populateQuickSelects calls updateSelectionInfo which might trigger additional saves
    await UI.populateQuickSelects();
    
    // Show success message only once with debounce to prevent duplicates
    const now = Date.now();
    if (now - lastToastTime > TOAST_DEBOUNCE_MS) {
      UI.showToast(`Prize "${selectedPrize.name}" selected (${selectedPrize.quantity} available)`, 'success');
      lastToastTime = now;
    }
    
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
  editPrizeModal,
  deletePrizeConfirm,
  selectPrize,
  initPrizeEventDelegation
};

window.Prizes = Prizes;
