// Templates Module - Manages SMS templates
import { Database } from './database.js';
import { UI } from './ui.js';
import { Settings, settings } from './settings.js';
import eventManager from './event-manager.js';

// Get available placeholders from lists
async function getAvailablePlaceholders() {
  try {
    const fieldSet = new Set();
    
    // Always include standard placeholders
    fieldSet.add('name');
    fieldSet.add('prize');
    fieldSet.add('ticketCode');
    fieldSet.add('eventName');
    
    // Try to get fields from selected lists first
    if (settings && settings.selectedListIds && settings.selectedListIds.length > 0) {
      const lists = await Database.getFromStore('lists');
      const selectedLists = lists.filter(list => 
        settings.selectedListIds.includes(list.listId)
      );
      
      if (selectedLists.length > 0) {
        selectedLists.forEach(list => {
          if (list.entries && list.entries.length > 0) {
            const firstEntry = list.entries[0];
            if (firstEntry.data) {
              Object.keys(firstEntry.data).forEach(key => {
                fieldSet.add(key);
              });
            }
          }
        });
      }
    } else {
      // Fall back to all lists if none selected
      const lists = await Database.getFromStore('lists');
      lists.forEach(list => {
        if (list.entries && list.entries.length > 0) {
          const firstEntry = list.entries[0];
          if (firstEntry.data) {
            Object.keys(firstEntry.data).forEach(key => {
              fieldSet.add(key);
            });
          }
        }
      });
    }
    
    return Array.from(fieldSet).sort();
  } catch (error) {
    console.error('Error getting placeholders:', error);
    // Return default placeholders
    return ['name', 'prize', 'ticketCode', 'eventName'];
  }
}

// Template management functions
async function loadTemplates() {
  try {
    const templates = await Database.getFromStore('templates');
    displayTemplates(templates);
    
    // Update placeholders display
    await updatePlaceholdersDisplay();
    
    return templates;
  } catch (error) {
    console.error('Error loading templates:', error);
    UI.showToast('Failed to load templates', 'error');
    return [];
  }
}

// Update the placeholders display
async function updatePlaceholdersDisplay() {
  const placeholdersList = document.getElementById('placeholdersList');
  if (!placeholdersList) return;
  
  const placeholders = await getAvailablePlaceholders();
  
  if (placeholders.length > 0) {
    placeholdersList.innerHTML = placeholders.map(p => 
      `<code>{${p}}</code>`
    ).join(', ');
  } else {
    placeholdersList.innerHTML = '<em>No fields available</em>';
  }
}

function displayTemplates(templates) {
  const grid = document.getElementById('templatesGrid');
  if (!grid) return;

  if (templates.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-chat-text display-1 text-muted"></i>
        <p class="text-muted mt-3">No templates yet. Click "Add Template" to create one.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = templates.map(template => `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card h-100 ${template.isDefault ? 'border-primary' : ''}">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 class="mb-0">${template.name}</h6>
          ${template.isDefault ? '<span class="badge bg-primary">Default</span>' : ''}
        </div>
        <div class="card-body">
          <p class="card-text small text-muted">${template.message}</p>
          <div class="d-flex justify-content-between mt-3">
            <button class="btn btn-sm btn-outline-primary" data-template-id="${template.templateId}" data-action="edit">
              <i class="bi bi-pencil"></i> Edit
            </button>
            ${!template.isDefault ? `
              <button class="btn btn-sm btn-outline-info" data-template-id="${template.templateId}" data-action="set-default">
                <i class="bi bi-star"></i> Set Default
              </button>
            ` : ''}
            <button class="btn btn-sm btn-outline-danger" data-template-id="${template.templateId}" data-action="delete">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  // Set up event delegation for template actions
  setupTemplateEventDelegation();
}

let templateEventCleanup = null;

function setupTemplateEventDelegation() {
  // Clean up previous delegation if it exists
  if (templateEventCleanup) {
    templateEventCleanup();
    templateEventCleanup = null;
  }
  
  const grid = document.getElementById('templatesGrid');
  if (grid) {
    templateEventCleanup = eventManager.delegate(grid, '[data-template-id]', 'click', function(e) {
      const templateId = this.dataset.templateId;
      const action = this.dataset.action;
      
      switch(action) {
        case 'edit':
          editTemplate(templateId);
          break;
        case 'delete':
          deleteTemplate(templateId);
          break;
        case 'set-default':
          setDefaultTemplate(templateId);
          break;
      }
    });
  }
}

async function showAddTemplateModal() {
  const placeholders = await getAvailablePlaceholders();
  const placeholderText = placeholders.map(p => `{${p}}`).join(', ');
  
  const modalHTML = `
    <div class="modal-header">
      <h5 class="modal-title">Add SMS Template</h5>
      <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
    </div>
    <div class="modal-body">
      <form id="templateForm">
        <div class="mb-3">
          <label for="templateName" class="form-label">Template Name</label>
          <input type="text" class="form-control" id="templateName" required>
        </div>
        <div class="mb-3">
          <label for="templateMessage" class="form-label">Message Template</label>
          <textarea class="form-control" id="templateMessage" rows="4" required></textarea>
          <div class="form-text">
            <strong>Available placeholders:</strong><br>
            ${placeholderText}
          </div>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="templateIsDefault">
          <label class="form-check-label" for="templateIsDefault">
            Set as default template
          </label>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
      <button type="button" class="btn btn-primary" id="saveTemplateBtn">Save Template</button>
    </div>
  `;

  const modalBody = document.querySelector('#appModal .modal-content');
  modalBody.innerHTML = modalHTML;

  // Show modal
  window.appModal.show();

  // Handle save
  document.getElementById('saveTemplateBtn').addEventListener('click', async () => {
    const name = document.getElementById('templateName').value.trim();
    const message = document.getElementById('templateMessage').value.trim();
    const isDefault = document.getElementById('templateIsDefault').checked;

    if (!name || !message) {
      UI.showToast('Please fill in all fields', 'warning');
      return;
    }

    const newTemplate = {
      templateId: `tmpl_${Date.now()}`,
      name,
      message,
      isDefault,
      createdAt: new Date().toISOString()
    };

    try {
      // If setting as default, unset other defaults
      if (isDefault) {
        const templates = await Database.getFromStore('templates');
        for (const tmpl of templates) {
          if (tmpl.isDefault) {
            tmpl.isDefault = false;
            await Database.saveToStore('templates', tmpl);
          }
        }
      }

      await Database.saveToStore('templates', newTemplate);
      await loadTemplates();
      UI.showToast('Template added successfully', 'success');
      window.appModal.hide();
    } catch (error) {
      console.error('Error saving template:', error);
      UI.showToast('Failed to save template', 'error');
    }
  });
}

async function editTemplate(templateId) {
  const templates = await Database.getFromStore('templates');
  const template = templates.find(t => t.templateId === templateId);
  
  if (!template) {
    UI.showToast('Template not found', 'error');
    return;
  }

  const placeholders = await getAvailablePlaceholders();
  const placeholderText = placeholders.map(p => `{${p}}`).join(', ');

  const modalHTML = `
    <div class="modal-header">
      <h5 class="modal-title">Edit SMS Template</h5>
      <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
    </div>
    <div class="modal-body">
      <form id="templateForm">
        <div class="mb-3">
          <label for="templateName" class="form-label">Template Name</label>
          <input type="text" class="form-control" id="templateName" value="${template.name}" required>
        </div>
        <div class="mb-3">
          <label for="templateMessage" class="form-label">Message Template</label>
          <textarea class="form-control" id="templateMessage" rows="4" required>${template.message}</textarea>
          <div class="form-text">
            <strong>Available placeholders:</strong><br>
            ${placeholderText}
          </div>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="templateIsDefault" ${template.isDefault ? 'checked' : ''}>
          <label class="form-check-label" for="templateIsDefault">
            Set as default template
          </label>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
      <button type="button" class="btn btn-primary" id="saveTemplateBtn">Save Changes</button>
    </div>
  `;

  const modalBody = document.querySelector('#appModal .modal-content');
  modalBody.innerHTML = modalHTML;

  // Show modal
  window.appModal.show();

  // Handle save
  document.getElementById('saveTemplateBtn').addEventListener('click', async () => {
    const name = document.getElementById('templateName').value.trim();
    const message = document.getElementById('templateMessage').value.trim();
    const isDefault = document.getElementById('templateIsDefault').checked;

    if (!name || !message) {
      UI.showToast('Please fill in all fields', 'warning');
      return;
    }

    template.name = name;
    template.message = message;
    template.isDefault = isDefault;
    template.updatedAt = new Date().toISOString();

    try {
      // If setting as default, unset other defaults
      if (isDefault) {
        const templates = await Database.getFromStore('templates');
        for (const tmpl of templates) {
          if (tmpl.templateId !== templateId && tmpl.isDefault) {
            tmpl.isDefault = false;
            await Database.saveToStore('templates', tmpl);
          }
        }
      }

      await Database.saveToStore('templates', template);
      await loadTemplates();
      UI.showToast('Template updated successfully', 'success');
      window.appModal.hide();
    } catch (error) {
      console.error('Error updating template:', error);
      UI.showToast('Failed to update template', 'error');
    }
  });
}

async function deleteTemplate(templateId) {
  const confirmed = await UI.showConfirmation(
    'Delete Template',
    'Are you sure you want to delete this template?'
  );

  if (!confirmed) return;

  try {
    await Database.deleteFromStore('templates', templateId);
    await loadTemplates();
    UI.showToast('Template deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting template:', error);
    UI.showToast('Failed to delete template', 'error');
  }
}

async function setDefaultTemplate(templateId) {
  try {
    const templates = await Database.getFromStore('templates');
    
    for (const tmpl of templates) {
      if (tmpl.templateId === templateId) {
        tmpl.isDefault = true;
      } else if (tmpl.isDefault) {
        tmpl.isDefault = false;
      }
      await Database.saveToStore('templates', tmpl);
    }

    await loadTemplates();
    UI.showToast('Default template updated', 'success');
  } catch (error) {
    console.error('Error setting default template:', error);
    UI.showToast('Failed to set default template', 'error');
  }
}

// Get the default template
async function getDefaultTemplate() {
  const templates = await Database.getFromStore('templates');
  return templates.find(t => t.isDefault);
}

// Create default template if none exists
async function ensureDefaultTemplate() {
  try {
    const templates = await Database.getFromStore('templates');
    if (templates.length === 0) {
      // Create default template
      const defaultTemplate = {
        templateId: 'tmpl_default',
        name: 'Default Winner Notification',
        message: 'Congratulations {name}! You won {prize}. Your ticket: {ticketCode}',
        isDefault: true,
        createdAt: new Date().toISOString()
      };
      await Database.saveToStore('templates', defaultTemplate);
    }
  } catch (error) {
    console.error('Error ensuring default template:', error);
  }
}

// Initialize templates module
async function initTemplates() {
  // Ensure default template exists
  await ensureDefaultTemplate();
  
  // Set up add template button
  const addBtn = document.getElementById('addTemplateBtn');
  if (addBtn) {
    addBtn.addEventListener('click', showAddTemplateModal);
  }

  // Load templates when tab is shown
  const templatesTab = document.getElementById('templates-tab');
  if (templatesTab) {
    templatesTab.addEventListener('shown.bs.tab', loadTemplates);
  }
}

// Export functions
export const Templates = {
  loadTemplates,
  showAddTemplateModal,
  editTemplate,
  deleteTemplate,
  setDefaultTemplate,
  getDefaultTemplate,
  initTemplates
};

window.Templates = Templates;