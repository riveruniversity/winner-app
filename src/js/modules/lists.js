// ================================
// LISTS MANAGEMENT
// ================================

// 1. Import dependencies
import { Database } from './firestore-service.js';
import { UI } from './ui.js';

// 2. Define functions as standalone, not inside a closure
// Cache-first loading with real-time updates
async function loadLists() {
  const container = document.getElementById('listsContainer');
  if (!container) return;

  // Show loading state
  container.innerHTML = '<p class="text-muted">📦 Loading lists...</p>';

  try {
    const lists = await Database.getFromStore('lists');

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

    container.innerHTML = lists.map(list => `
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title">${list.metadata.name}</h6>
          <p class="card-text">
            <small class="text-muted">
              ${list.entries.length} entries • 
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

    container.innerHTML = lists.map(list => `
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title">${list.metadata.name}</h6>
          <p class="card-text">
            <small class="text-muted">
              ${list.entries.length} entries • 
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
      const entriesPreview = list.entries.slice(0, 10).map(entry =>
        `<li>${formatDisplayName(entry, list.metadata.nameConfig)}</li>`
      ).join('');

      modalBody.innerHTML = `
        <p><strong>Total Entries:</strong> ${list.entries.length}</p>
        <h6>First 10 Entries:</h6>
        <ul>${entriesPreview}</ul>
        ${list.entries.length > 10 ? '<p>...</p>' : ''}
      `;

      confirmBtn.style.display = 'none';
      cancelBtn.textContent = 'Close';
      window.appModal.show();
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

// 3. Export the functions you want to be public
export const Lists = {
  loadLists,
  loadListsTraditional,
  viewList,
  deleteListConfirm,
  formatDisplayName
};

// 4. Assign to window for legacy inline `onclick` handlers to work during transition
window.Lists = Lists;