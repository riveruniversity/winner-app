// ================================
// LISTS MANAGEMENT
// ================================

// 1. Import dependencies
import { Database } from './firestore.js';
import { UI } from './ui.js';
import { settings, Settings } from './settings.js';

// 2. Define functions as standalone, not inside a closure
// Cache-first loading with real-time updates
async function loadLists() {
  const gridContainer = document.getElementById('listsGrid');
  const noListsMessage = document.getElementById('noListsMessage');
  
  // Fallback to old container for backward compatibility
  const oldContainer = document.getElementById('listsContainer');
  
  if (!gridContainer && !oldContainer) return;

  try {
    const lists = await Database.getFromStore('lists');

    if (lists.length === 0) {
      if (gridContainer) gridContainer.innerHTML = '';
      if (noListsMessage) noListsMessage.style.display = 'block';
      if (oldContainer) oldContainer.innerHTML = '<p class="text-muted">No lists uploaded yet.</p>';
      return;
    }

    if (noListsMessage) noListsMessage.style.display = 'none';

    // Ensure backward compatibility
    for (const list of lists) {
      if (!list.listId && list.metadata && list.metadata.listId) {
        list.listId = list.metadata.listId;
        await Database.saveToStore('lists', list);
      }
    }

    // Sort lists by upload date (most recent first)
    lists.sort((a, b) => {
      const dateA = a.metadata?.timestamp || 0;
      const dateB = b.metadata?.timestamp || 0;
      return dateB - dateA;
    });

    const listCards = lists.map(list => {
      const listId = list.listId || list.metadata.listId;
      const isSelected = settings.selectedListId === listId;
      
      return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 ${isSelected ? 'border-success border-2' : ''}">
          <div class="card-header ${isSelected ? 'bg-success bg-opacity-10' : ''}">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="card-title mb-0">${list.metadata.name}</h5>
              <div>
                ${isSelected ? '<span class="badge bg-success me-2"><i class="bi bi-check-circle-fill"></i> Selected</span>' : ''}
                <span class="badge bg-primary">${list.entries.length}</span>
              </div>
            </div>
          </div>
          <div class="card-body d-flex flex-column">
            <p class="card-text text-muted small">Uploaded ${new Date(list.metadata.timestamp).toLocaleDateString()}</p>
            <div class="mt-auto pt-3">
              <div class="d-flex justify-content-between">
                <button class="btn btn-sm ${isSelected ? 'btn-success' : 'btn-outline-success'}" 
                        onclick="Lists.selectList('${listId}')" 
                        ${isSelected ? 'disabled' : ''}>
                  <i class="bi ${isSelected ? 'bi-check-circle-fill' : 'bi-check-circle'}"></i> ${isSelected ? 'Selected' : 'Select'}
                </button>
                <div>
                  <button class="btn btn-sm btn-outline-primary me-2" onclick="Lists.viewList('${listId}')">
                    <i class="bi bi-eye"></i> View
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="Lists.deleteListConfirm('${listId}')">
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
      gridContainer.innerHTML = listCards;
    } else if (oldContainer) {
      // Fallback for old container
      oldContainer.innerHTML = lists.map(list => {
        const listId = list.listId || list.metadata.listId;
        const isSelected = settings.selectedListId === listId;
        
        return `
        <div class="card mb-3 ${isSelected ? 'border-success border-2' : ''}">
          <div class="card-header ${isSelected ? 'bg-success bg-opacity-10' : ''}">
            <div class="d-flex justify-content-between align-items-center">
              <h6 class="card-title mb-0">${list.metadata.name}</h6>
              <div>
                ${isSelected ? '<span class="badge bg-success me-2"><i class="bi bi-check-circle-fill"></i></span>' : ''}
                ${!settings.hideEntryCounts ? `<span class="badge bg-primary">${list.entries?.length || list.metadata?.entryCount || 0}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="card-body d-flex flex-column">
            <p class="card-text text-muted small">
              Uploaded ${new Date(list.metadata.timestamp).toLocaleDateString()}
            </p>
            <div class="mt-auto pt-3">
              <div class="d-flex justify-content-between">
                <button class="btn btn-sm ${isSelected ? 'btn-success' : 'btn-outline-success'}" 
                        onclick="Lists.selectList('${listId}')" 
                        ${isSelected ? 'disabled' : ''}>
                  <i class="bi ${isSelected ? 'bi-check-circle-fill' : 'bi-check-circle'}"></i> ${isSelected ? 'Selected' : 'Select'}
                </button>
                <div>
                  <button class="btn btn-sm btn-outline-primary me-2" onclick="Lists.viewList('${listId}')">
                    <i class="bi bi-eye"></i> View
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="Lists.deleteListConfirm('${listId}')">
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
    console.error('Error rendering lists:', error);
    UI.showToast('Error loading lists: ' + error.message, 'error');
  }
}

// Alternative: Traditional async approach (still cache-first)
async function loadListsTraditional() {
  try {
    const lists = await Database.getFromStore('lists');
    const container = document.getElementById('listsContainer');

    if (!container) return;

    if (lists.length === 0) {
      container.innerHTML = '<p class="text-muted">No lists uploaded yet.</p>';
      return;
    }

    // Ensure backward compatibility
    for (const list of lists) {
      if (!list.listId && list.metadata && list.metadata.listId) {
        list.listId = list.metadata.listId;
        await Database.saveToStore('lists', list);
      }
    }

    // Sort lists by upload date (most recent first)
    lists.sort((a, b) => {
      const dateA = a.metadata?.timestamp || 0;
      const dateB = b.metadata?.timestamp || 0;
      return dateB - dateA;
    });

    container.innerHTML = lists.map(list => `
      <div class="card mb-3">
        <div class="card-header">
          <h6 class="card-title mb-0">${list.metadata.name}</h6>
        </div>
        <div class="card-body">
          <p class="card-text">
            <small class="text-muted">
              ${!settings.hideEntryCounts ? `${list.entries.length} entries • ` : ''}
              Uploaded ${new Date(list.metadata.timestamp).toLocaleDateString()}
            </small>
          </p>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" data-list-id="${list.listId || list.metadata.listId}" onclick="Lists.viewList(this.dataset.listId)">
              <i class="bi bi-eye"></i> View
            </button>
            <button class="btn btn-outline-danger" data-list-id="${list.listId || list.metadata.listId}" onclick="Lists.deleteListConfirm(this.dataset.listId)">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading lists:', error);
    UI.showToast('Error loading lists: ' + error.message, 'error');
  }
}

async function viewList(listId) {
  try {
    const list = await Database.getFromStore('lists', listId);
    if (list) {
      const modalTitle = document.getElementById('appModalLabel');
      const modalBody = document.getElementById('appModalBody');
      const confirmBtn = document.getElementById('appModalConfirmBtn');
      const cancelBtn = document.querySelector('#appModal .modal-footer .btn-secondary');

      modalTitle.textContent = `List: ${list.metadata.name}`;
      
      // Create table view with individual record management
      const tableRows = list.entries.map((entry, index) => {
        const displayName = formatDisplayName(entry, list.metadata.nameConfig);
        const info1 = list.metadata.infoConfig?.info1 ? 
          list.metadata.infoConfig.info1.replace(/\{([^}]+)\}/g, (match, key) => entry.data[key.trim()] || '').trim() : '';
        const info2 = list.metadata.infoConfig?.info2 ? 
          list.metadata.infoConfig.info2.replace(/\{([^}]+)\}/g, (match, key) => entry.data[key.trim()] || '').trim() : '';
        
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${displayName}</td>
            <td>${info1}</td>
            <td>${info2}</td>
            <td>
              <button class="btn btn-sm btn-outline-danger" onclick="Lists.deleteListEntry('${listId}', '${entry.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');

      modalBody.innerHTML = `
        ${!settings.hideEntryCounts ? `
        <div class="mb-3">
          <strong>Total Entries:</strong> ${list.entries?.length || list.metadata?.entryCount || 0}
          ${list.metadata.skippedWinners ? `<span class="text-muted ms-2">(${list.metadata.skippedWinners} winners skipped during upload)</span>` : ''}
        </div>
        ` : ''}
        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
          <table class="table table-striped table-sm">
            <thead class="sticky-top bg-white">
              <tr>
                <th style="width: 60px;">#</th>
                <th>Name</th>
                <th>Info 1</th>
                <th>Info 2</th>
                <th style="width: 80px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="5" class="text-center text-muted">No entries in this list</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="mt-3 text-muted small">
          <i class="bi bi-info-circle"></i> Individual records can be deleted from this list. This action cannot be undone.
        </div>
      `;

      confirmBtn.style.display = 'none';
      cancelBtn.textContent = 'Close';
      
      // Make modal extra large for table view
      const modalDialog = document.querySelector('#appModal .modal-dialog');
      modalDialog.classList.add('modal-xl');
      
      window.appModal.show();
      
      // Reset modal when it's hidden
      const modalElement = document.getElementById('appModal');
      modalElement.addEventListener('hidden.bs.modal', function() {
        modalDialog.classList.remove('modal-xl');
        // Reset button states for other uses of the modal
        confirmBtn.style.display = '';
        confirmBtn.textContent = 'Confirm';
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.onclick = null;
        cancelBtn.textContent = 'Cancel';
      }, { once: true });
    }
  } catch (error) {
    console.error('Error viewing list:', error);
    UI.showToast('Error viewing list: ' + error.message, 'error');
  }
}

function deleteListConfirm(listId) {
  UI.showConfirmationModal(
    'Delete List',
    'Are you sure you want to delete this list? This action cannot be undone.',
    () => {
      try {
        Database.deleteFromStore('lists', listId); // Fire and forget
        UI.showToast('List deleted successfully', 'success');
        loadLists(); // Fire and forget
        UI.populateQuickSelects(); // Fire and forget
      } catch (error) {
        console.error('Error deleting list:', error);
        UI.showToast('Error deleting list: ' + error.message, 'error');
      }
    }
  );
}

function formatDisplayName(entry, nameConfig) {
  // New template-based format (nameConfig is a string)
  if (typeof nameConfig === 'string') {
    return nameConfig.replace(/\{([^}]+)\}/g, (match, key) => {
      return entry.data[key.trim()] || '';
    }).trim() || 'Unknown';
  }

  // Backward compatibility for old object-based format
  if (nameConfig && nameConfig.columns && nameConfig.columns.length > 0) {
    let displayName = entry.data[nameConfig.columns[0]] || '';
    for (let i = 1; i < nameConfig.columns.length; i++) {
      const delimiter = nameConfig.delimiters[i - 1] || ' ';
      const value = entry.data[nameConfig.columns[i]] || '';
      if (value) {
        displayName += delimiter + value;
      }
    }
    return displayName || 'Unknown';
  }

  // Ultimate fallback: try common name fields
  const commonFields = ['name', 'full_name', 'first_name', 'last_name'];
  for (const field of commonFields) {
    if (entry.data[field]) {
      return entry.data[field];
    }
  }
  // If no name fields found, use first available field
  const firstField = Object.keys(entry.data)[0];
  return entry.data[firstField] || 'Unknown';
}

async function deleteListEntry(listId, entryId) {
  try {
    const list = await Database.getFromStore('lists', listId);
    if (!list) {
      UI.showToast('List not found', 'error');
      return;
    }
    
    // Find and remove the entry
    const entryIndex = list.entries.findIndex(e => e.id === entryId);
    if (entryIndex === -1) {
      UI.showToast('Entry not found in list', 'error');
      return;
    }
    
    const entryName = formatDisplayName(list.entries[entryIndex], list.metadata.nameConfig);
    
    UI.showConfirmationModal(
      'Delete Entry',
      `Are you sure you want to delete "${entryName}" from this list?`,
      async () => {
        try {
          // Remove the entry from the list
          list.entries.splice(entryIndex, 1);
          
          // Update entry count in metadata
          list.metadata.entryCount = list.entries.length;
          
          // Re-index remaining entries
          list.entries.forEach((entry, index) => {
            entry.index = index;
          });
          
          // Save the updated list
          await Database.saveToStore('lists', list);
          
          UI.showToast(`Entry "${entryName}" deleted successfully`, 'success');
          
          // Refresh the modal view
          viewList(listId);
          
          // Refresh the lists display
          loadLists();
          
          // Update quick selects
          UI.populateQuickSelects();
        } catch (error) {
          console.error('Error deleting entry:', error);
          UI.showToast('Error deleting entry: ' + error.message, 'error');
        }
      }
    );
  } catch (error) {
    console.error('Error in deleteListEntry:', error);
    UI.showToast('Error: ' + error.message, 'error');
  }
}

// Function to select a list (like selecting from the setup tab)
async function selectList(listId) {
  try {
    // Update settings with the selected list
    settings.selectedListId = listId;
    
    // Save settings
    await Settings.saveSettings();
    
    // Update the quick select dropdown if it exists
    const quickListSelect = document.getElementById('quickListSelect');
    if (quickListSelect) {
      quickListSelect.value = listId;
    }
    
    // Update the current list in app.js
    const lists = await Database.getFromStore('lists');
    const selectedList = lists.find(l => (l.listId || l.metadata?.listId) === listId);
    if (selectedList) {
      // Import app.js functions
      const { setCurrentList } = await import('../app.js');
      setCurrentList(selectedList);
    }
    
    // Refresh the lists display to show the selected state
    await loadLists();
    
    // Update quick selects
    await UI.populateQuickSelects();
    
    // Show success message
    UI.showToast(`List "${selectedList?.metadata?.name}" selected`, 'success');
    
    // Switch to Setup tab if not already there
    const setupTab = document.querySelector('a[href="#setup"]');
    if (setupTab && !setupTab.classList.contains('active')) {
      setupTab.click();
    }
    
  } catch (error) {
    console.error('Error selecting list:', error);
    UI.showToast('Error selecting list: ' + error.message, 'error');
  }
}

// 3. Export the functions you want to be public
export const Lists = {
  loadLists,
  loadListsTraditional,
  viewList,
  deleteListConfirm,
  deleteListEntry,
  formatDisplayName,
  selectList
};

// 4. Assign to window for legacy inline `onclick` handlers to work during transition
window.Lists = Lists;