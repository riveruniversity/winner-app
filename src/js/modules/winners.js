// ================================
// WINNER MANAGEMENT & FILTERING
// ================================

import { Database } from './database.js';
import { DOMUtils } from './dom-utils.js';
import eventManager from './event-manager.js';
import { UI } from './ui.js';
import { clearCurrentWinners } from '../app.js';
import { Lists } from './lists.js';
import { settings } from './settings.js'; // Import settings directly
import { getCurrentList, getLastAction, setLastAction } from '../app.js'; // Import central state
import { loadHistory } from '../app.js'; // Import loadHistory from app.js

// Global state variables (will be managed by app.js eventually)
let lastAction = null; // This will eventually be managed by app.js
let currentFilteredWinners = []; // Store the currently filtered winners
let allWinners = []; // Store all winners for comparison

// Cache for loaded data to avoid redundant fetches
let winnersCache = null;
let listsCache = null;
let lastLoadTime = 0;
const CACHE_DURATION = 5000; // 5 seconds cache


async function loadWinners(winnersData = null, listsData = null) {
  try {
    let winners, lists;
    
    // Use provided data if available
    if (winnersData && listsData) {
      winners = winnersData;
      lists = listsData;
      // Update cache with provided data
      winnersCache = winners;
      listsCache = lists;
      lastLoadTime = Date.now();
    } 
    // Use cached data if recent enough
    else if (winnersCache && listsCache && (Date.now() - lastLoadTime < CACHE_DURATION)) {
      winners = winnersCache;
      lists = listsCache;
    }
    // Otherwise batch fetch both collections
    else {
      const batchResults = await Database.batchFetch([
        { collection: 'winners' },
        { collection: 'lists' }
      ]);
      winners = batchResults.winners || [];
      lists = batchResults.lists || [];
      // Update cache
      winnersCache = winners;
      listsCache = lists;
      lastLoadTime = Date.now();
    }
    
    winners = winners || [];
    allWinners = winners; // Store all winners
    const tbody = document.getElementById('winnersTableBody');

    if (!tbody) return;

    const listNameMap = {};
    lists.forEach(list => {
      const listId = list.listId;
      listNameMap[listId] = list.metadata.name;
    });

    const filterPrize = document.getElementById('filterPrize').value;
    const filterList = document.getElementById('filterList').value;
    const filterSelection = document.getElementById('filterSelection').value;
    const filterDateInput = document.getElementById('filterDate').value;

    populateWinnerFilters(winners, lists, filterPrize, filterList, filterSelection);

    const filteredWinners = winners.filter(winner => {
      const prizeMatch = !filterPrize || winner.prize === filterPrize;
      // Use stored list name first, then try to look up by ID
      const listName = winner.listName || 
                      listNameMap[winner.listId] || 
                      'Unknown';
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

    // Store the filtered winners globally
    currentFilteredWinners = filteredWinners;

    updateWinnersCountDisplay(filteredWinners.length, winners.length, filterPrize, filterList, filterSelection, filterDateInput);

    if (filteredWinners.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No winners match the current filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filteredWinners.map(winner => {
      // Display Order ID from data or use 'N/A'
      const orderId = winner.data?.orderId || winner.data?.['Order ID'] || 'N/A';
      const pickupStatus = winner.pickedUp ? 
        `<span class="badge bg-success"><i class="bi bi-check-circle-fill"></i> Picked up</span>` : 
        `<span class="badge bg-warning"><i class="bi bi-clock"></i> Pending</span>`;
      
      // Generate SMS status badge based on new structure
      let smsStatusBadge = '';
      if (winner.sms && winner.sms.status) {
        const status = winner.sms.status.toLowerCase();
        switch(status) {
          case 'delivered':
            smsStatusBadge = '<span class="badge bg-success" title="SMS Delivered"><i class="bi bi-check-circle-fill"></i> Delivered</span>';
            break;
          case 'bounced':
            smsStatusBadge = `<span class="badge bg-danger" title="SMS Bounced: ${winner.sms.error || 'Unknown'}"><i class="bi bi-x-circle-fill"></i> Bounced</span>`;
            break;
          case 'failed':
            smsStatusBadge = `<span class="badge bg-danger" title="SMS Failed: ${winner.sms.error || 'Unknown'}"><i class="bi bi-x-circle-fill"></i> Failed</span>`;
            break;
          case 'queued':
            smsStatusBadge = '<span class="badge bg-info" title="SMS Queued"><i class="bi bi-clock-fill"></i> Queued</span>';
            break;
          case 'sending':
            smsStatusBadge = '<span class="badge bg-warning" title="SMS Sending"><i class="bi bi-arrow-up-circle-fill"></i> Sending</span>';
            break;
          case 'sent':
            smsStatusBadge = '<span class="badge bg-primary" title="SMS Sent"><i class="bi bi-send-fill"></i> Sent</span>';
            break;
          default:
            smsStatusBadge = '<span class="badge bg-secondary" title="No SMS"><i class="bi bi-dash-circle"></i> Not Sent</span>';
        }
      } else {
        smsStatusBadge = '<span class="badge bg-secondary" title="No SMS"><i class="bi bi-dash-circle"></i> Not Sent</span>';
      }
      
      return `
        <tr>
          <td>
            <span class="badge bg-primary winner-id-badge">${orderId}</span>
            <button class="btn btn-sm btn-outline-secondary ms-1" onclick="Winners.showQRCode('${winner.winnerId}')" title="Show QR Code">
              <i class="bi bi-qr-code"></i>
            </button>
          </td>
          <td>${winner.displayName}</td>
          <td>${winner.prize}</td>
          <td>${new Date(winner.timestamp).toLocaleDateString()}</td>
          <td>${winner.listName || listNameMap[winner.listId] || 'Unknown'}</td>
          <td>${pickupStatus}</td>
          <td>${smsStatusBadge}</td>
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
  const listTimestampMap = {};
  lists.forEach(list => {
    const listId = list.listId || list.metadata.listId;
    listNameMap[listId] = list.metadata.name;
    listTimestampMap[list.metadata.name] = list.metadata?.timestamp || 0;
  });

  const prizes = [...new Set(winners.map(w => w.prize))].sort();
  
  // Get unique list names and sort by timestamp (most recent first)
  const uniqueListNames = [...new Set(winners.map(w => {
    // Use stored list name first, then try to look up by ID
    return w.listName || 
           listNameMap[w.listId] || 
           'Unknown';
  }))];
  const sortedListNames = uniqueListNames.sort((a, b) => {
    const timestampA = listTimestampMap[a] || 0;
    const timestampB = listTimestampMap[b] || 0;
    return timestampB - timestampA;
  });
  
  const selections = [...new Set(winners.map(w => w.historyId).filter(Boolean))];

  // Populate Prize Filter
  prizeFilter.innerHTML = '<option value="">All Prizes</option>';
  prizes.forEach(prize => {
    const count = winners.filter(w => w.prize === prize).length;
    prizeFilter.innerHTML += `<option value="${prize}">${prize} (${count})</option>`;
  });
  prizeFilter.value = selectedPrize;

  // Populate List Filter (now sorted by timestamp)
  listFilter.innerHTML = '<option value="">All Lists</option>';
  sortedListNames.forEach(listName => {
    const count = winners.filter(w => {
      const winnerListName = w.listName || 
                             listNameMap[w.listId] || 
                             'Unknown';
      return winnerListName === listName;
    }).length;
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
  UI.showConfirmationModal('Delete Winner', 'Are you sure you want to delete this winner record?', async () => {
    try {
      // Wait for deletion to complete
      await Database.deleteFromStore('winners', winnerId);
      
      // Clean up history entries that reference this winner
      const history = await Database.getFromStore('history');
      for (const entry of history) {
        if (entry.winners && entry.winners.some(w => w.winnerId === winnerId)) {
          // Remove this winner from the history entry
          entry.winners = entry.winners.filter(w => w.winnerId !== winnerId);
          if (entry.winners.length === 0) {
            // If no winners left, delete the history entry
            await Database.deleteFromStore('history', entry.historyId);
          } else {
            // Otherwise update the history entry
            await Database.saveToStore('history', entry);
          }
        }
      }
      
      // Also remove from currentWinners if present
      const { getCurrentWinners, setCurrentWinners } = await import('../app.js');
      const currentWinners = getCurrentWinners();
      if (currentWinners && currentWinners.length > 0) {
        const updatedWinners = currentWinners.filter(w => w.winnerId !== winnerId);
        if (updatedWinners.length !== currentWinners.length) {
          setCurrentWinners(updatedWinners);
          // Removed from current winners
        }
      }
      
      UI.showToast('Winner deleted successfully', 'success');
      // Clear cache to force reload
      winnersCache = null;
      listsCache = null;
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
  // Use the currently filtered winners
  const winnersToDelete = currentFilteredWinners || [];
  
  if (winnersToDelete.length === 0) {
    UI.showToast('No winners to delete in the current view', 'warning');
    return;
  }
  
  const isFiltered = winnersToDelete.length < allWinners.length;
  const title = isFiltered ? 'Clear Filtered Winners' : 'Clear All Winners';
  const message = isFiltered 
    ? `Are you sure you want to delete the ${winnersToDelete.length} filtered winner records currently displayed? This action cannot be undone.`
    : `Are you sure you want to delete ALL ${winnersToDelete.length} winner records? This action cannot be undone.`;
  
  UI.showConfirmationModal(
    title,
    message,
    async () => {
      try {
        UI.showProgress('Clearing Winners', `Preparing to remove ${winnersToDelete.length} winner records...`);
        
        // Prepare batch delete operations
        const operations = [];
        for (const winner of winnersToDelete) {
          operations.push({
            collection: 'winners',
            operation: 'delete',
            id: winner.winnerId
          });
        }
        
        UI.updateProgress(30, `Deleting ${winnersToDelete.length} winners in batch...`);
        
        // Execute batch delete
        await Database.batchSave(operations);
        
        UI.updateProgress(90, 'Finalizing...');
        UI.hideProgress();
        UI.showToast(`Successfully deleted ${winnersToDelete.length} winner records`, 'success');
        
        // Clear currentWinners array
        const { clearCurrentWinners } = await import('../app.js');
        clearCurrentWinners();
        
        // Clear cache to force reload on next access
        winnersCache = null;
        listsCache = null;
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

// Undo operations function
async function performUndoBackgroundSync(lastAction) {
  try {
    // Prepare batch operations for undo
    const operations = [];
    
    // Delete winners - batch delete operation
    for (const winner of lastAction.winners) {
      operations.push({ 
        collection: 'winners', 
        operation: 'delete',
        id: winner.winnerId 
      });
    }
    
    // Delete history entry
    operations.push({ 
      collection: 'history', 
      operation: 'delete',
      id: lastAction.historyId 
    });

    // Restore prize quantity
    const prizes = await Database.getFromStore('prizes');
    const prize = prizes.find(p => p.prizeId === lastAction.prizeId);
    if (prize) {
      prize.quantity += lastAction.prizeCount;
      operations.push({ 
        collection: 'prizes', 
        data: prize 
      });
    }

    // Restore entries to list(s) if they were removed
    const currentList = getCurrentList();
    if (settings.preventDuplicates && currentList && lastAction.removedEntries) {
      // Check if this was a combined list selection
      if (currentList.metadata?.isCombined && currentList.metadata?.sourceListIds) {
        // For combined lists, we need to restore entries to their original lists
        // Group removed entries by their original list ID
        const entriesByList = {};
        lastAction.removedEntries.forEach(entry => {
          const listId = entry.sourceListId || entry.listId || entry.metadata?.listId;
          if (listId) {
            if (!entriesByList[listId]) {
              entriesByList[listId] = [];
            }
            entriesByList[listId].push(entry);
          }
        });
        
        // Restore entries to each original list
        for (const listId of currentList.metadata.sourceListIds) {
          const list = await Database.getFromStore('lists', listId);
          if (list && entriesByList[listId]) {
            // Clean up entries before restoring - remove the sourceListId we added
            const cleanedEntries = entriesByList[listId].map(entry => {
              // Create a copy without sourceListId
              const { sourceListId, ...cleanEntry } = entry;
              return cleanEntry;
            });
            list.entries.push(...cleanedEntries);
            list.metadata.entryCount = list.entries.length; // Update count
            operations.push({ 
              collection: 'lists', 
              data: list 
            });
          }
        }
      } else {
        // Single list - fetch the actual list from database to ensure we have the right one
        const listId = currentList.listId || currentList.metadata?.listId;
        if (listId) {
          const actualList = await Database.getFromStore('lists', listId);
          if (actualList) {
            actualList.entries.push(...lastAction.removedEntries);
            actualList.metadata.entryCount = actualList.entries.length;
            operations.push({ 
              collection: 'lists', 
              data: actualList 
            });
          }
        } else {
          // Fallback to current list if no ID found
          currentList.entries.push(...lastAction.removedEntries);
          currentList.metadata.entryCount = currentList.entries.length;
          operations.push({ 
            collection: 'lists', 
            data: currentList 
          });
        }
      }
    }

    // Execute all operations in a single batch
    await Database.batchSave(operations);
    
    // Use the locally updated data for immediate UI update
    // This avoids race conditions with server processing
    const lists = await Database.getFromStore('lists');
    
    // Update UI with the correct data (prizes array with restored quantities)
    await UI.populateQuickSelects(lists, prizes);
    const { Lists } = await import('./lists.js');
    await Lists.loadLists(lists);

    // Undo sync completed
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

  // Check if SMS has been sent to these winners
  if (currentLastAction.smsSent) {
    UI.showToast(`Cannot undo selection: SMS messages have been sent to ${currentLastAction.smsSentCount} winner(s)`, 'error');
    return;
  }

  UI.showConfirmationModal(
    'Undo Last Selection',
    'Are you sure you want to undo the last winner selection? This will delete the winners, restore prize quantities, and cannot be undone.',
    async () => {
      try {
        // Perform the undo operations first and wait for them to complete
        await performUndoBackgroundSync(currentLastAction);
        
        // Then update the UI
        UI.showToast('Selection undone successfully', 'success');
        await resetToSelectionMode();
        setLastAction(null); // Clear lastAction in app.js
        
        // Update UI immediately by reloading winners
        await loadWinners();

      } catch (error) {
        console.error('Error undoing selection:', error);
        UI.showToast('Error undoing selection: ' + error.message, 'error');
      }
    }
  );
}

async function resetToSelectionMode() {
  document.getElementById('selectionControls').classList.remove('d-none');
  document.getElementById('prizeDisplay').classList.add('d-none');
  document.getElementById('winnersGrid').classList.add('d-none');
  // Hide action buttons in header
  document.getElementById('undoSelectionBtn').classList.add('d-none');
  document.getElementById('newSelectionBtn').classList.add('d-none');
  // Clear current winners and hide SMS button
  clearCurrentWinners();
  
  // Don't refresh quick selects here - it's handled by the undo sync or other operations
  // This avoids fetching incomplete data during undo operations
  
  // Only refresh lists if not called from undo (undo handles this itself)
  // Check if we're in an undo operation by seeing if performUndoBackgroundSync is in the call stack
  const isUndoOperation = new Error().stack.includes('undoLastSelection');
  if (!isUndoOperation) {
    await UI.populateQuickSelects();
    const { Lists } = await import('./lists.js');
    await Lists.loadLists();
  }
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
    const sourceListId = winner.listId;
    
    console.log('Winner restoration debug:', {
      winner,
      sourceListId,
      winnerListId: winner.listId,
      lists: lists.map(l => ({ listId: l.listId, metaListId: l.metadata?.listId, name: l.metadata?.name }))
    });
    
    const list = lists.find(l => (l.listId || l.metadata?.listId) === sourceListId);
    
    if (!list) {
      console.error('List not found! Looking for:', sourceListId);
      UI.showToast('Original list no longer exists', 'warning');
      return;
    }
    
    // Check if the entry already exists in the list (to avoid duplicates)
    const entryExists = list.entries.some(entry => 
      entry.id === winner.entryId
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
            id: winner.entryId,  // Use the original entry ID
            index: list.entries.length,
            data: winner.data  // Use the data key that contains all original info
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
    const ticketCode = winner.entryId || winnerId;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketCode)}`;
    
    const modalElement = document.getElementById('appModal');
    const modal = new bootstrap.Modal(modalElement);
    
    document.getElementById('appModalLabel').textContent = 'Winner Ticket QR Code';
    document.getElementById('appModalBody').innerHTML = `
      <div class="text-center">
        <h5>Ticket Code: <span class="badge bg-primary fs-6">${ticketCode}</span></h5>
        <img src="${qrCodeUrl}" alt="QR Code" class="img-fluid my-3" />
        <p class="text-muted">Scan this code at the prize pickup station</p>
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

// Keep for onclick handlers
window.Winners = Winners;