// ================================
// LISTS MANAGEMENT
// ================================

import { Database } from './database.js';
import { UI } from './ui.js';

// Load lists - uses centralized data store
// Alpine x-for templates react automatically to store changes
async function loadLists(listsData = null) {
  try {
    if (window.Alpine) {
      const dataStore = Alpine.store('data');
      if (dataStore) {
        if (listsData) {
          // If data was passed, update centralized store directly
          dataStore.lists = listsData;
        } else {
          // Otherwise load from database
          await dataStore.load('lists');
        }
      }
    }
  } catch (error) {
    console.error('Error loading lists:', error);
    UI.showToast('Error loading lists: ' + error.message, 'error');
  }
}

async function viewList(listId) {
  try {
    const list = await Database.getFromStore('lists', listId);
    if (list) {
      const modalTitle = document.getElementById('viewModalLabel');
      const modalBody = document.getElementById('viewModalBody');

      modalTitle.textContent = `List: ${list.metadata.name}`;

      // Get all unique columns from the data (first 10 entries for performance)
      const sampleEntries = list.entries.slice(0, 10);
      const allColumns = new Set();
      sampleEntries.forEach(entry => {
        if (entry.data) {
          Object.keys(entry.data).forEach(col => allColumns.add(col));
        }
      });
      const columns = Array.from(allColumns).sort();

      // Limit columns shown in table view (show first 5 columns)
      const displayColumns = columns.slice(0, 5);

      // Create table headers
      const tableHeaders = `
        <tr>
          <th style="width: 60px;">#</th>
          <th>Display Name</th>
          ${displayColumns.map(col => `<th>${col}</th>`).join('')}
          <th style="width: 80px;">Actions</th>
        </tr>
      `;

      // Create table rows with actual data
      const tableRows = list.entries.map((entry, index) => {
        const displayName = formatDisplayName(entry, list.metadata.nameConfig);

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${displayName}</td>
            ${displayColumns.map(col => `<td>${entry.data?.[col] || ''}</td>`).join('')}
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
          <strong>Total Entries:</strong> ${list.entries !== undefined ? list.entries.length : (list.metadata?.entryCount || 0)}
          ${list.metadata.skippedWinners ? `<span class="text-muted ms-2">(${list.metadata.skippedWinners} winners skipped during upload)</span>` : ''}
        </div>
        ` : ''}
        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
          <table class="table table-striped table-sm">
            <thead class="sticky-top bg-white">
              ${tableHeaders}
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="${displayColumns.length + 3}" class="text-center text-muted">No entries in this list</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="mt-3 text-muted small">
          <i class="bi bi-info-circle"></i> Individual records can be deleted from this list. This action cannot be undone.
        </div>
      `;

      window.viewModal.show();
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
    async () => {
      try {
        // Wait for delete to complete
        await Database.deleteFromStore('lists', listId);
        UI.showToast('List deleted', 'success');
        await loadLists(); // Updates Alpine store reactively
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
          
          UI.showToast(`Entry "${entryName}" deleted`, 'success');

          // Refresh the modal view
          viewList(listId);

          // Refresh Alpine store
          loadLists();
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

// Export public functions
export const Lists = {
  loadLists,
  viewList,
  deleteListConfirm,
  deleteListEntry,
  formatDisplayName
};

// Keep for onclick handlers in Alpine templates
window.Lists = Lists;