// ================================
// WINNER MANAGEMENT & FILTERING
// ================================

import { Database } from './firestore.js';
import { UI } from './ui.js';
import { clearCurrentWinners } from '../app.js';
import { Lists } from './lists.js';
import { settings } from './settings.js'; // Import settings directly
import { getCurrentList, getLastAction, setLastAction } from '../app.js'; // Import central state
import { loadHistory } from '../app.js'; // Import loadHistory from app.js

// Global state variables (will be managed by app.js eventually)
let lastAction = null; // This will eventually be managed by app.js

async function loadWinners() {
  try {
    const winners = await Database.getFromStore('winners');
    const lists = await Database.getFromStore('lists');
    const tbody = document.getElementById('winnersTableBody');

    if (!tbody) return;

    const listNameMap = {};
    lists.forEach(list => {
      const listId = list.listId || list.metadata.listId;
      listNameMap[listId] = list.metadata.name;
    });

    const filterPrize = document.getElementById('filterPrize').value;
    const filterList = document.getElementById('filterList').value;
    const filterSelection = document.getElementById('filterSelection').value;
    const filterDateInput = document.getElementById('filterDate').value;

    populateWinnerFilters(winners, lists, filterPrize, filterList, filterSelection);

    const filteredWinners = winners.filter(winner => {
      const prizeMatch = !filterPrize || winner.prize === filterPrize;
      const listName = listNameMap[winner.listId] || 'Unknown';
      const listMatch = !filterList || listName === filterList;
      const selectionMatch = !filterSelection || winner.historyId === filterSelection;
      
      // Date filter
      let dateMatch = true;
      if (filterDateInput) {
        const winnerDate = new Date(winner.timestamp).toISOString().split('T')[0];
        dateMatch = winnerDate === filterDateInput;
      }
      
      return prizeMatch && listMatch && selectionMatch && dateMatch;
    });

    updateWinnersCountDisplay(filteredWinners.length, winners.length, filterPrize, filterList, filterSelection, filterDateInput);

    if (filteredWinners.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No winners match the current filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filteredWinners.map(winner => {
      const ticketCode = (winner.winnerId || winner.id || 'N/A').toString().slice(0, 5).toUpperCase();
      const pickupStatus = winner.pickedUp ? 
        `<span class="badge bg-success"><i class="bi bi-check-circle-fill"></i> Picked up</span>` : 
        `<span class="badge bg-warning"><i class="bi bi-clock"></i> Pending</span>`;
      
      return `
        <tr>
          <td>
            <span class="badge bg-primary">${ticketCode}</span>
            <button class="btn btn-sm btn-outline-secondary ms-1" onclick="Winners.showQRCode('${winner.winnerId}')" title="Show QR Code">
              <i class="bi bi-qr-code"></i>
            </button>
          </td>
          <td>${winner.displayName}</td>
          <td>${winner.prize}</td>
          <td>${new Date(winner.timestamp).toLocaleDateString()}</td>
          <td>${listNameMap[winner.listId] || 'Unknown'}</td>
          <td>${pickupStatus}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-info" data-winner-id="${winner.winnerId}" onclick="Winners.returnToList('${winner.winnerId}')" title="Return to List">
                <i class="bi bi-arrow-return-left"></i>
              </button>
              <button class="btn btn-outline-danger" data-winner-id="${winner.winnerId}" onclick="Winners.deleteWinnerConfirm(this.dataset.winnerId)" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading winners:', error);
    UI.showToast('Error loading winners: ' + error.message, 'error');
  }
}

function populateWinnerFilters(winners, lists, selectedPrize = '', selectedList = '', selectedSelection = '') {
  const prizeFilter = document.getElementById('filterPrize');
  const listFilter = document.getElementById('filterList');
  const selectionFilter = document.getElementById('filterSelection');

  const listNameMap = {};
  lists.forEach(list => {
    const listId = list.listId || list.metadata.listId;
    listNameMap[listId] = list.metadata.name;
  });

  const prizes = [...new Set(winners.map(w => w.prize))].sort();
  const listNames = [...new Set(winners.map(w => listNameMap[w.listId] || 'Unknown'))].sort();
  const selections = [...new Set(winners.map(w => w.historyId).filter(Boolean))];

  // Populate Prize Filter
  prizeFilter.innerHTML = '<option value="">All Prizes</option>';
  prizes.forEach(prize => {
    const count = winners.filter(w => w.prize === prize).length;
    prizeFilter.innerHTML += `<option value="${prize}">${prize} (${count})</option>`;
  });
  prizeFilter.value = selectedPrize;

  // Populate List Filter
  listFilter.innerHTML = '<option value="">All Lists</option>';
  listNames.forEach(listName => {
    const count = winners.filter(w => (listNameMap[w.listId] || 'Unknown') === listName).length;
    listFilter.innerHTML += `<option value="${listName}">${listName} (${count})</option>`;
  });
  listFilter.value = selectedList;

  // Populate Selection ID Filter
  selectionFilter.innerHTML = '<option value="">All Selections</option>';
  
  const selectionEntries = selections.map(id => {
    const winnersInSelection = winners.filter(w => w.historyId === id);
    const timestamp = winnersInSelection[0]?.timestamp;
    const prize = winnersInSelection[0]?.prize;
    const count = winnersInSelection.length;
    return {
      id,
      timestamp,
      prize,
      count,
      label: `${new Date(timestamp).toLocaleDateString()} - ${prize} (${count} winner${count > 1 ? 's' : ''})`
    };
  });

  selectionEntries.sort((a, b) => b.timestamp - a.timestamp);
  
  selectionEntries.forEach(entry => {
    selectionFilter.innerHTML += `<option value="${entry.id}">${entry.label}</option>`;
  });
  selectionFilter.value = selectedSelection;
}

function updateWinnersCountDisplay(filteredCount, totalCount, filterPrize, filterList, filterSelection, filterDate) {
  const winnersCountElement = document.getElementById('winnersCount');
  const filterStatusElement = document.getElementById('filterStatus');
  
  if (!winnersCountElement || !filterStatusElement) return;

  if (filteredCount === totalCount) {
    winnersCountElement.textContent = `Showing ${totalCount} winners`;
  } else {
    winnersCountElement.textContent = `Showing ${filteredCount} of ${totalCount} winners`;
  }

  const activeFilters = [];
  if (filterPrize) activeFilters.push(`Prize: ${filterPrize}`);
  if (filterList) activeFilters.push(`List: ${filterList}`);
  if (filterSelection) activeFilters.push(`Batch: ${filterSelection}`);
  if (filterDate) {
    const dateObj = new Date(filterDate + 'T00:00:00');
    activeFilters.push(`Date: ${dateObj.toLocaleDateString()}`);
  }

  if (activeFilters.length > 0) {
    filterStatusElement.textContent = `Filtered by: ${activeFilters.join(', ')}`;
  } else {
    filterStatusElement.textContent = '';
  }
}

async function deleteWinnerConfirm(winnerId) {
  UI.showConfirmationModal('Delete Winner', 'Are you sure you want to delete this winner record?', () => {
    try {
      Database.deleteFromStore('winners', winnerId); // Fire and forget
      UI.showToast('Winner deleted successfully', 'success');
      loadWinners(); // Fire and forget
      loadHistory(); // Fire and forget
    } catch (error) {
      console.error('Error deleting winner:', error);
      UI.showToast('Error deleting winner: ' + error.message, 'error');
    }
  });
}

async function saveWinner(winner) {
  await Database.saveToStore('winners', winner);
}

async function getAllWinners() {
  return Database.getFromStore('winners');
}

async function clearAllWinners() {
  UI.showConfirmationModal(
    'Clear All Winners',
    'Are you sure you want to delete ALL winner records? This action cannot be undone and will remove all winners from the database.',
    async () => {
      try {
        UI.showProgress('Clearing Winners', 'Removing all winner records...');
        
        const winners = await getAllWinners();
        let deletedCount = 0;

        for (const winner of winners) {
          Database.deleteFromStore('winners', winner.winnerId); // Fire and forget
          deletedCount++;
          UI.updateProgress((deletedCount / winners.length) * 100, `Deleted ${deletedCount} of ${winners.length} winners...`);
        }

        UI.hideProgress();
        UI.showToast(`Successfully cleared ${deletedCount} winner records`, 'success');
        
        await loadWinners();
        loadHistory();
      } catch (error) {
        UI.hideProgress();
        console.error('Error clearing winners:', error);
        UI.showToast('Error clearing winners: ' + error.message, 'error');
      }
    }
  );
}

// Background sync function for undo operations (fire and forget)
async function performUndoBackgroundSync(lastAction) {
  try {
    // Delete winners from database
    for (const winner of lastAction.winners) {
      await Database.deleteFromStore('winners', winner.winnerId);
    }

    // Restore prize quantity
    const prizes = await Database.getFromStore('prizes');
    const prize = prizes.find(p => p.prizeId === lastAction.prizeId);
    if (prize) {
      prize.quantity += lastAction.prizeCount;
      await Database.saveToStore('prizes', prize);
    }

    // Delete history entry
    await Database.deleteFromStore('history', lastAction.historyId);

    // Restore entries to list if they were removed
    const currentList = getCurrentList();
    if (settings.preventDuplicates && currentList && lastAction.removedEntries) {
      currentList.entries.push(...lastAction.removedEntries);
      if (!currentList.listId && currentList.metadata && currentList.metadata.listId) {
        currentList.listId = currentList.metadata.listId;
      }
      await Database.saveToStore('lists', currentList);
    }

    console.log('Undo background sync completed successfully');
  } catch (error) {
    console.error('Error in undo background sync:', error);
    // Don't show user error for background operations
    // The UI already shows success, no need to confuse user with sync errors
  }
}

async function undoLastSelection() {
  const currentLastAction = getLastAction(); // Get the current lastAction from app.js

  if (!currentLastAction || currentLastAction.type !== 'selectWinners') {
    UI.showToast('No recent selection to undo', 'warning');
    return;
  }

  UI.showConfirmationModal(
    'Undo Last Selection',
    'Are you sure you want to undo the last winner selection? This will delete the winners, restore prize quantities, and cannot be undone.',
    async () => {
      try {
        // INSTANT UI FEEDBACK - Do this first, before any database operations
        UI.showToast('Selection undone successfully', 'success');
        resetToSelectionMode();
        setLastAction(null); // Clear lastAction in app.js
        
        // Update UI immediately by reloading winners (this is fast from local cache)
        await loadWinners();

        // BACKGROUND SYNC - Do all database operations in background (fire and forget)
        // This ensures UI responds instantly while database catches up
        performUndoBackgroundSync(currentLastAction);

      } catch (error) {
        console.error('Error undoing selection:', error);
        UI.showToast('Error undoing selection: ' + error.message, 'error');
      }
    }
  );
}

function resetToSelectionMode() {
  document.getElementById('selectionControls').classList.remove('d-none');
  document.getElementById('prizeDisplay').classList.add('d-none');
  document.getElementById('winnersGrid').classList.add('d-none');
  // Hide action buttons in header
  document.getElementById('undoSelectionBtn').classList.add('d-none');
  document.getElementById('newSelectionBtn').classList.add('d-none');
  // Clear current winners and hide SMS button
  clearCurrentWinners();
  UI.populateQuickSelects();
}

async function returnToList(winnerId) {
  try {
    // Get the winner record
    const winners = await Database.getFromStore('winners');
    const winner = winners.find(w => w.winnerId === winnerId);
    
    if (!winner) {
      UI.showToast('Winner not found', 'error');
      return;
    }
    
    // Check if the original list still exists
    const lists = await Database.getFromStore('lists');
    const list = lists.find(l => (l.listId || l.metadata?.listId) === winner.listId);
    
    if (!list) {
      UI.showToast('Original list no longer exists', 'warning');
      return;
    }
    
    // Check if the entry already exists in the list (to avoid duplicates)
    const entryExists = list.entries.some(entry => 
      entry.id === winner.entryId || 
      entry.id === winner.originalEntry?.id
    );
    
    if (entryExists) {
      UI.showToast('Entry already exists in the list', 'info');
      return;
    }
    
    UI.showConfirmationModal(
      'Return to List',
      `Are you sure you want to return "${winner.displayName}" to the list "${list.metadata.name}"? They will remain in the winners list and can win again.`,
      async () => {
        try {
          // Create entry to add back to list
          const entryToRestore = {
            id: winner.originalEntry?.id || winner.entryId || UI.generateId(),
            index: list.entries.length,
            data: winner.originalEntry?.data || {
              name: winner.displayName,
              // Try to reconstruct data from winner info if available
              ...(winner.originalData || {})
            }
          };
          
          // Add entry back to the list
          list.entries.push(entryToRestore);
          
          // Update entry count in metadata
          list.metadata.entryCount = list.entries.length;
          
          // Save the updated list
          await Database.saveToStore('lists', list);
          
          UI.showToast(`"${winner.displayName}" has been returned to the list "${list.metadata.name}"`, 'success');
          
          // Update quick selects
          await UI.populateQuickSelects();
          
          // Reload winners display
          await loadWinners();
          
        } catch (error) {
          console.error('Error returning winner to list:', error);
          UI.showToast('Error returning winner to list: ' + error.message, 'error');
        }
      }
    );
  } catch (error) {
    console.error('Error in returnToList:', error);
    UI.showToast('Error: ' + error.message, 'error');
  }
}

async function showQRCode(winnerId) {
  try {
    // Get the winner record to find the actual ticket code (recordId)
    const winners = await Database.getFromStore('winners');
    const winner = winners.find(w => w.winnerId === winnerId);
    
    if (!winner) {
      UI.showToast('Winner not found', 'error');
      return;
    }
    
    // Use original entry ID if available, otherwise fall back to winnerId
    const ticketCode = winner.originalEntry?.id || winner.entryId || winnerId;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketCode)}`;
    
    const modalElement = document.getElementById('appModal');
    const modal = new bootstrap.Modal(modalElement);
    
    document.getElementById('appModalLabel').textContent = 'Winner Ticket QR Code';
    document.getElementById('appModalBody').innerHTML = `
      <div class="text-center">
        <h5>Ticket Code: <span class="badge bg-primary fs-6">${ticketCode}</span></h5>
        <img src="${qrCodeUrl}" alt="QR Code" class="img-fluid my-3" />
        <p class="text-muted">Scan this code at the prize pickup station</p>
        <button class="btn btn-primary" onclick="window.print()">
          <i class="bi bi-printer"></i> Print QR Code
        </button>
      </div>
    `;
    
    document.getElementById('appModalConfirmBtn').style.display = 'none';
    modal.show();
  } catch (error) {
    console.error('Error showing QR code:', error);
    UI.showToast('Error generating QR code: ' + error.message, 'error');
  }
}

export const Winners = {
  loadWinners,
  populateWinnerFilters,
  updateWinnersCountDisplay,
  deleteWinnerConfirm,
  saveWinner,
  getAllWinners,
  clearAllWinners,
  undoLastSelection,
  resetToSelectionMode,
  returnToList,
  showQRCode
};

window.Winners = Winners;