// ================================
// WINNER MANAGEMENT & FILTERING
// ================================

import { Database } from './database.js';
import { UI } from './ui.js';
import { Lists } from './lists.js';
import { settings } from './settings.js'; // Import settings directly
// import { FirebaseSync } from './firebase-sync.js'; // No longer directly imported for operations
import { getCurrentList, getLastAction, setLastAction } from '../app.js'; // Import central state
import { loadHistory } from '../app.js'; // Import loadHistory from app.js

// Global state variables (will be managed by app.js eventually)
let lastAction = null; // This will eventually be managed by app.js

async function loadWinners() {
  try {
    const winners = await Database.getAllFromStore('winners');
    const lists = await Database.getAllFromStore('lists');
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

    populateWinnerFilters(winners, lists, filterPrize, filterList, filterSelection);

    const filteredWinners = winners.filter(winner => {
      const prizeMatch = !filterPrize || winner.prize === filterPrize;
      const listName = listNameMap[winner.listId] || 'Unknown';
      const listMatch = !filterList || listName === filterList;
      const selectionMatch = !filterSelection || winner.historyId === filterSelection;
      return prizeMatch && listMatch && selectionMatch;
    });

    updateWinnersCountDisplay(filteredWinners.length, winners.length, filterPrize, filterList, filterSelection);

    if (filteredWinners.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No winners match the current filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filteredWinners.map(winner => `
      <tr>
        <td><span class="badge bg-primary">${winner.uniqueId || winner.winnerId.slice(0, 5).toUpperCase()}</span></td>
        <td>${winner.displayName}</td>
        <td>${winner.prize}</td>
        <td>${new Date(winner.timestamp).toLocaleDateString()}</td>
        <td>${listNameMap[winner.listId] || 'Unknown'}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" data-winner-id="${winner.winnerId}" onclick="Winners.deleteWinnerConfirm(this.dataset.winnerId)">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
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

function updateWinnersCountDisplay(filteredCount, totalCount, filterPrize, filterList, filterSelection) {
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
  if (filterSelection) activeFilters.push(`Selection: ${filterSelection}`);

  if (activeFilters.length > 0) {
    filterStatusElement.textContent = `Filtered by: ${activeFilters.join(', ')}`;
  } else {
    filterStatusElement.textContent = '';
  }
}

async function deleteWinnerConfirm(winnerId) {
  UI.showConfirmationModal('Delete Winner', 'Are you sure you want to delete this winner record?', async () => {
    try {
      await Database.deleteFromStore('winners', winnerId);
      await Database.queueForSync({ id: UI.generateId(), type: 'delete', collection: 'winners', documentId: winnerId });
      UI.showToast('Winner deleted successfully', 'success');
      await loadWinners();
      loadHistory(); // Call from app.js
    } catch (error) {
      console.error('Error deleting winner:', error);
      UI.showToast('Error deleting winner: ' + error.message, 'error');
    }
  });
}

async function saveWinner(winner) {
  await Database.saveToStore('winners', winner);
  // Add id property for Firebase sync (uses winnerId as the document ID)
  const winnerWithId = { ...winner, id: winner.winnerId };
  await Database.queueForSync({ id: UI.generateId(), type: 'add_update', collection: 'winners', data: winnerWithId });
}

async function getAllWinners() {
  return Database.getAllFromStore('winners');
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
          await Database.deleteFromStore('winners', winner.winnerId);
          await Database.queueForSync({ id: UI.generateId(), type: 'delete', collection: 'winners', documentId: winner.winnerId });
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
        UI.showProgress('Undoing Selection', 'Reversing last selection...');

        // Delete winners
        for (const winner of currentLastAction.winners) {
          await Database.deleteFromStore('winners', winner.winnerId);
          await Database.queueForSync({ id: UI.generateId(), type: 'delete', collection: 'winners', documentId: winner.winnerId });
        }

        // Restore prize quantity
        const prizes = await Database.getAllFromStore('prizes');
        const prize = prizes.find(p => p.prizeId === currentLastAction.prizeId);
        if (prize) {
          prize.quantity += currentLastAction.prizeCount;
          await Database.saveToStore('prizes', prize);
          await Database.queueForSync({ id: UI.generateId(), type: 'add_update', collection: 'prizes', data: prize });
        }

        // Delete history entry
        await Database.deleteFromStore('history', currentLastAction.historyId);
        await Database.queueForSync({ id: UI.generateId(), type: 'delete', collection: 'history', documentId: currentLastAction.historyId });

        // Restore entries to list if they were removed
        const currentList = getCurrentList(); // Get the currentList from app.js
        if (settings.preventDuplicates && currentList) {
          currentList.entries.push(...currentLastAction.removedEntries);
          if (!currentList.listId && currentList.metadata && currentList.metadata.listId) {
            currentList.listId = currentList.metadata.listId;
          }
          await Database.saveToStore('lists', currentList);
          await Database.queueForSync({ id: UI.generateId(), type: 'add_update', collection: 'lists', data: currentList });
        }

        UI.hideProgress();
        UI.showToast('Selection undone successfully', 'success');

        await loadWinners();
        resetToSelectionMode();
        setLastAction(null); // Clear lastAction in app.js

      } catch (error) {
        UI.hideProgress();
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
  document.getElementById('actionButtons').classList.add('d-none');
  UI.populateQuickSelects();
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
  resetToSelectionMode
};

window.Winners = Winners;