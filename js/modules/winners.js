// ================================
// WINNER MANAGEMENT & FILTERING
// ================================

window.Winners = (function() {
  
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
            <button class="btn btn-sm btn-outline-danger" onclick="Winners.deleteWinnerConfirm('${winner.winnerId}')">
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
      await Database.deleteFromStore('winners', winnerId);
      UI.showToast('Winner deleted successfully', 'success');
      await loadWinners();
    });
  }

  async function saveWinner(winner) {
    return Database.saveToStore('winners', winner);
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
            deletedCount++;
            UI.updateProgress((deletedCount / winners.length) * 100, `Deleted ${deletedCount} of ${winners.length} winners...`);
          }

          UI.hideProgress();
          UI.showToast(`Successfully cleared ${deletedCount} winner records`, 'success');
          
          await loadWinners();
          await loadHistory();
        } catch (error) {
          UI.hideProgress();
          console.error('Error clearing winners:', error);
          UI.showToast('Error clearing winners: ' + error.message, 'error');
        }
      }
    );
  }

  async function undoLastSelection() {
    if (!window.lastAction || window.lastAction.type !== 'selectWinners') {
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
          for (const winner of window.lastAction.winners) {
            await Database.deleteFromStore('winners', winner.winnerId);
          }

          // Restore prize quantity
          const prizes = await Database.getAllFromStore('prizes');
          const prize = prizes.find(p => p.prizeId === window.lastAction.prizeId);
          if (prize) {
            prize.quantity += window.lastAction.prizeCount;
            await Database.saveToStore('prizes', prize);
          }

          // Delete history entry
          await Database.deleteFromStore('history', window.lastAction.historyId);

          // Restore entries to list if they were removed
          if (window.settings.preventDuplicates && window.currentList) {
            window.currentList.entries.push(...window.lastAction.removedEntries);
            if (!window.currentList.listId && window.currentList.metadata && window.currentList.metadata.listId) {
              window.currentList.listId = window.currentList.metadata.listId;
            }
            await Database.saveToStore('lists', window.currentList);
          }

          UI.hideProgress();
          UI.showToast('Selection undone successfully', 'success');

          await loadWinners();
          resetToSelectionMode();
          window.lastAction = null;

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

  return {
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
})();