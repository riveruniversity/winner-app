// ================================
// WINNER MANAGEMENT & FILTERING
// ================================

import { Database } from './database.js';
import { DOMUtils } from './dom-utils.js';
import eventManager from './event-manager.js';
import { UI } from './ui.js';
import { clearCurrentWinners } from '../app.js';
import { Lists } from './lists.js';
import { SafeHTML } from './safe-html.js';
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

    const listNameMap = {};
    lists.forEach(list => {
      const listId = list.listId;
      listNameMap[listId] = list.metadata.name;
    });

    // Enrich winners with listName for display
    const enrichedWinners = winners.map(w => ({
      ...w,
      listName: w.listName || listNameMap[w.listId] || 'Unknown'
    }));

    // Update centralized data store - Alpine handles filtering and rendering
    if (window.Alpine) {
      const dataStore = Alpine.store('data');
      if (dataStore) {
        dataStore.winners = enrichedWinners;
      }
      // Store filtered winners for export/clear operations
      const winnersStore = Alpine.store('winners');
      if (winnersStore) {
        currentFilteredWinners = winnersStore.filtered;
      }
    }
  } catch (error) {
    console.error('Error loading winners:', error);
    UI.showToast('Error loading winners: ' + error.message, 'error');
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
      
      UI.showToast('Winner deleted', 'success');
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
        UI.showToast(`Deleted ${winnersToDelete.length} winner records`, 'success');
        
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
    
    // Reload Alpine stores with updated data
    const lists = await Database.getFromStore('lists');
    const { Lists } = await import('./lists.js');
    const { Prizes } = await import('./prizes.js');
    await Lists.loadLists(lists);
    await Prizes.loadPrizes(prizes);
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
        UI.showToast('Selection undone', 'success');
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
  
  // Only refresh Alpine stores if not called from undo (undo handles this itself)
  const isUndoOperation = new Error().stack.includes('undoLastSelection');
  if (!isUndoOperation) {
    const { Lists } = await import('./lists.js');
    const { Prizes } = await import('./prizes.js');
    await Lists.loadLists();
    await Prizes.loadPrizes();
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

          // Reload Alpine stores
          const { Lists } = await import('./lists.js');
          await Lists.loadLists();
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

    document.getElementById('viewModalLabel').textContent = 'Winner Ticket QR Code';
    document.getElementById('viewModalBody').innerHTML = `
      <div class="text-center">
        <h5>Ticket Code: <span class="badge bg-primary fs-6">${ticketCode}</span></h5>
        <img src="${qrCodeUrl}" alt="QR Code" class="img-fluid my-3" />
        <p class="text-muted">Scan this code at the prize pickup station</p>
      </div>
    `;

    window.viewModal.show();
  } catch (error) {
    console.error('Error showing QR code:', error);
    UI.showToast('Error generating QR code: ' + error.message, 'error');
  }
}

export const Winners = {
  loadWinners,
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