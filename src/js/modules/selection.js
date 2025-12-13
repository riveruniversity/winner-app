// ================================
// WINNER SELECTION LOGIC
// ================================

import { UI } from './ui.js';
import { DOMUtils } from './dom-utils.js';
import eventManager from './event-manager.js';
import { Database } from './database.js';
import { Lists } from './lists.js';
import { Winners } from './winners.js';
import { Validation } from './validation.js';
import { settings, Settings } from './settings.js'; // Import settings and Settings module
import { Animations } from './animations.js';
import { setCurrentWinners } from '../app.js';
import { getCurrentList, setCurrentList, getLastAction, setLastAction, loadHistory } from '../app.js'; // Import central state and history functions

function createRandomWorker() {
  const workerCode = `
    function generateId(length = 10) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }
    
    function selectRandomWinners(entries, numWinners, seed) {
      // Better random number generator using crypto API if available
      function getSecureRandom() {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const array = new Uint32Array(1);
          crypto.getRandomValues(array);
          return array[0] / (0xffffffff + 1);
        }
        return Math.random();
      }
      
      // Fisher-Yates shuffle for better randomization
      function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          // Use secure random for better distribution
          const j = Math.floor(getSecureRandom() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      }
      
      // First, shuffle the entire list to ensure good distribution
      const shuffledEntries = shuffleArray(entries);
      
      // Then shuffle again for extra randomness (double shuffle technique)
      const doubleShuffled = shuffleArray(shuffledEntries);
      
      // Select the first N winners from the well-shuffled list
      const selected = doubleShuffled.slice(0, Math.min(numWinners, doubleShuffled.length));
      
      // One more shuffle of the selected winners to randomize display order
      return shuffleArray(selected);
    }
    
    self.onmessage = function(e) {
      if (e.data.type === 'select') {
        try {
          const result = selectRandomWinners(e.data.entries, e.data.numWinners, e.data.seed);
          self.postMessage({ type: 'complete', result });
        } catch (error) {
          self.postMessage({ type: 'error', error: error.message });
        }
      }
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

async function handleBigPlayClick() {
  try {
    // Check if selection controls are hidden (meaning a selection has already been made)
    const selectionControls = document.getElementById('selectionControls');
    if (selectionControls && selectionControls.classList.contains('d-none')) {
      UI.showToast('Please click "New Selection" to start a fresh selection', 'warning');
      return;
    }
    
    // Get selected list IDs (now multiple)
    const selectedCheckboxes = document.querySelectorAll('#quickListSelect .list-checkbox:checked');
    const listIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    const prizeId = document.getElementById('quickPrizeSelect').value;
    const winnersCountInput = document.getElementById('quickWinnersCount').value;
    const selectionMode = document.getElementById('selectionMode').value;
    const delayVisualType = document.getElementById('delayVisualType').value;

    if (listIds.length === 0 || !prizeId) {
      UI.showToast('Please select at least one list and a prize', 'warning');
      return;
    }

    // Get total available entries first
    const selectedCheckboxesArray = Array.from(selectedCheckboxes);
    const totalAvailable = selectedCheckboxesArray.reduce((sum, cb) => {
      return sum + parseInt(cb.dataset.entryCount || 0);
    }, 0);

    // Validate winner count
    const countValidation = Validation.validateWinnerCount(winnersCountInput, totalAvailable);
    if (!countValidation.isValid) {
      UI.showToast(countValidation.error, 'warning');
      document.getElementById('quickWinnersCount').value = countValidation.value;
      return;
    }
    const winnersCount = countValidation.value;

    // Batch fetch all selected lists and prizes
    const fetchRequests = listIds.map(id => ({ collection: 'lists', id }));
    fetchRequests.push({ collection: 'prizes' });
    const batchResults = await Database.batchFetch(fetchRequests);
    
    // Get the selected prize first
    const prizes = batchResults.prizes || [];
    const selectedPrize = prizes.find(p => p.prizeId === prizeId);

    if (!selectedPrize) {
      UI.showToast('Selected prize not found', 'error');
      return;
    }
    
    // Fetch previous winners if preventSamePrize is enabled
    let samePrizeWinnerIds = new Set();
    let samePrizeExcluded = 0;
    
    if (settings.preventSamePrize) {
      const winners = await Database.getFromStore('winners');
      if (winners && Array.isArray(winners)) {
        winners.forEach(winner => {
          // Only check winners who won this specific prize
          if (winner.prize === selectedPrize.name) {
            // Use the entry ID to exclude this winner
            if (winner.entryId) {
              samePrizeWinnerIds.add(winner.entryId);
            }
          }
        });
      }
    }
    
    // Combine entries from all selected lists
    const allEntries = [];
    const entryIdSet = new Set(); // For duplicate detection
    let duplicatesRemoved = 0;
    
    for (const listId of listIds) {
      const list = batchResults[`lists:${listId}`];
      if (!list) {
        console.warn(`List ${listId} not found`);
        continue;
      }
      
      // Add entries from this list, checking for duplicates by ID
      if (list.entries && Array.isArray(list.entries)) {
        for (const entry of list.entries) {
          const entryId = entry.id || entry.data?.['Ticket Code'] || entry.data?.ticketCode;
          
          // Check for duplicates across lists
          if (entryId && entryIdSet.has(entryId)) {
            duplicatesRemoved++;
            continue; // Skip duplicate
          }
          
          // Check if this person already won this same prize (if preventSamePrize is enabled)
          if (settings.preventSamePrize && entryId && samePrizeWinnerIds.has(entryId)) {
            samePrizeExcluded++;
            continue; // Skip person who already won this prize
          }
          
          if (entryId) {
            entryIdSet.add(entryId);
          }
          // Store source list ID and name with each entry (for tracking origin)
          if (listIds.length > 1) {
            entry.sourceListId = listId;
            entry.sourceListName = list.metadata?.name || 'Unknown';
          } else {
            // Even for single list, store the info for consistency
            entry.sourceListId = listId;
            entry.sourceListName = list.metadata?.name || 'Unknown';
          }
          allEntries.push(entry);
        }
      }
    }
    
    if (allEntries.length === 0) {
      let message = 'No eligible entries found in selected lists';
      if (samePrizeExcluded > 0) {
        message += ` (${samePrizeExcluded} excluded - already won ${selectedPrize.name})`;
      }
      UI.showToast(message, 'error');
      return;
    }
    
    // Log summary for debugging (no toast shown to avoid clutter)
    if (settings.enableDebugLogs) {
      const messages = [];
      if (listIds.length > 1) {
        messages.push(`Combined ${listIds.length} lists`);
      }
      messages.push(`${allEntries.length} eligible entries`);
      if (duplicatesRemoved > 0) {
        messages.push(`${duplicatesRemoved} duplicates removed`);
      }
      if (samePrizeExcluded > 0) {
        messages.push(`${samePrizeExcluded} excluded (already won ${selectedPrize.name})`);
      }
      console.log('Selection summary:', messages.join(' • '));
    }

    if (selectedPrize.quantity < winnersCount) {
      UI.showToast(`Not enough prizes available. Only ${selectedPrize.quantity} remaining.`, 'warning');
      return;
    }

    if (allEntries.length < winnersCount) {
      UI.showToast(`Not enough entries in combined lists. Only ${allEntries.length} available.`, 'warning');
      return;
    }

    // For single list, use the original list directly; for multiple, create combined
    if (listIds.length === 1) {
      // Single list - use the original list directly
      const originalList = batchResults[`lists:${listIds[0]}`];
      originalList.entries = allEntries; // Use filtered entries (duplicates/winners removed)
      
      // Ensure the list has its ID properly set
      if (!originalList.listId) {
        originalList.listId = listIds[0];
      }
      
      // Set current list for global access
      setCurrentList(originalList);
    } else {
      // Multiple lists - create a combined list object for processing
      const firstList = batchResults[`lists:${listIds[0]}`];
      const combinedList = {
        entries: allEntries,
        metadata: {
          name: `Combined Lists (${listIds.length})`,
          entryCount: allEntries.length,
          isCombined: true,
          sourceListIds: listIds,
          // Inherit display configuration from the first list
          nameConfig: firstList?.metadata?.nameConfig,
          infoConfig: firstList?.metadata?.infoConfig
        }
      };
      
      // Set current list for global access
      setCurrentList(combinedList);
    }

    Settings.debugLog('Big play clicked, selection mode:', selectionMode, 'delay visual:', delayVisualType);
    
    // Start the delay and selection process in parallel
    await selectWinnersWithDelay(winnersCount, selectedPrize, selectionMode, delayVisualType);
  } catch (error) {
    console.error('Error in big play click:', error);
    UI.showToast('Error selecting winners: ' + error.message, 'error');
  }
}

async function selectWinnersWithDelay(numWinners, selectedPrize, selectionMode, delayVisualType) {
  try {
    Settings.debugLog('Starting parallel selection and delay process');
    
    // Get delay settings
    const preSelectionDelay = parseFloat(document.getElementById('preSelectionDelay')?.value) || 0;
    
    let winnersResult = null;
    let delayPromise = Promise.resolve();
    
    // Start pre-selection delay if configured
    if (preSelectionDelay > 0) {
      Settings.debugLog('Starting pre-selection delay:', preSelectionDelay, 'seconds with visual:', delayVisualType);
      
      // Start sound during delay if configured
      if (settings.soundDuringDelay === 'drum-roll' && preSelectionDelay > 1) {
        playSound('drum-roll');
      }
      
      if (delayVisualType === 'countdown' || delayVisualType === 'animation' || delayVisualType === 'swirl-animation' || delayVisualType === 'time-machine') {
        delayPromise = showCountdown(preSelectionDelay, delayVisualType);
      } else {
        delayPromise = Settings.showDelayDisplay(preSelectionDelay, delayVisualType);
      }
      
      // Stop delay sound and play end-of-delay sound
      delayPromise = delayPromise.then(async () => {
        if (settings.soundDuringDelay === 'drum-roll' && preSelectionDelay > 1) {
          playSound('drumroll-stop'); // This will stop the drumroll
        }
        // Add a small delay before playing the next sound to avoid conflicts
        if (settings.soundEndOfDelay === 'sting-rimshot-drum-roll') {
          // Use a promise-based delay so we wait for it before continuing
          await new Promise(resolve => setTimeout(resolve, 100));
          playSound('sting-rimshot');
          // Give the sting sound time to start before moving to reveal
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      });
    }
    
    // Start winner selection in background immediately
    const selectionPromise = performWinnerSelection(numWinners, selectedPrize, selectionMode);
    
    // Wait for both delay and selection to complete
    const [winners] = await Promise.all([selectionPromise, delayPromise]);
    winnersResult = winners;
    
    Settings.debugLog('Selection and delay completed, starting display process');
    
    // Set current winners immediately (so SMS button appears even during any display delays)
    setCurrentWinners(winnersResult);
    
    // Display winners instantly (they're already selected and saved)
    await displayWinnersPublicly(winnersResult, selectedPrize, selectionMode);
    
    // Don't reload data immediately - only load when user navigates to Winners tab
    // This avoids unnecessary network requests right after selection
    // Winners.loadWinners();  // Commented out - redundant
    // loadHistory();  // Commented out - redundant
    
    // Trigger webhook notification
    try {
      await Settings.triggerWebhook({
        event: 'winners_selected',
        winners: winnersResult,
        prize: selectedPrize,
        listId: getCurrentList().listId || getCurrentList().metadata.listId,
        listName: getCurrentList().metadata.name,
        selectionId: winnersResult[0]?.historyId
      });
    } catch (error) {
      console.error('Error triggering webhook:', error);
    }
    
  } catch (error) {
    console.error('Error in selectWinnersWithDelay:', error);
    UI.showToast('Error selecting winners: ' + error.message, 'error');
  }
}

async function performWinnerSelection(numWinners, selectedPrize, selectionMode) {
  Settings.debugLog('Starting background winner selection');
  UI.showProgress('Selecting Winners', 'Preparing random selection...');

  // Hide selection controls
  document.getElementById('selectionControls').classList.add('d-none');

  // Create and use random worker
  const randomWorker = createRandomWorker();

  const selectedEntries = await new Promise((resolve, reject) => {
    randomWorker.onmessage = function (e) {
      if (e.data.type === 'complete') {
        resolve(e.data.result);
      } else if (e.data.type === 'error') {
        reject(new Error(e.data.error));
      }
    };

    randomWorker.postMessage({
      type: 'select',
      entries: getCurrentList().entries,
      numWinners: numWinners,
      seed: Date.now()
    });
  });

  UI.updateProgress(50, 'Creating winner records...');

  // Create winner records with guaranteed unique IDs
  const historyId = UI.generateId(8);
  const timestamp = Date.now();
  const winnerIds = new Set();
  
  const winners = selectedEntries.map((entry, index) => {
    // Generate unique winner ID
    let winnerId;
    do {
      winnerId = UI.generateId();
    } while (winnerIds.has(winnerId));
    winnerIds.add(winnerId);
    
    return {
      winnerId: winnerId,
      entryId: entry.id, // Store the list entry ID for ticket scanning
      displayName: Lists.formatDisplayName(entry, getCurrentList().metadata.nameConfig),
      prize: selectedPrize.name,
      timestamp: timestamp + index, // Ensure unique timestamps
      listId: entry.sourceListId || getCurrentList().listId || getCurrentList().metadata.listId,
      listName: entry.sourceListName || getCurrentList().metadata.name, // Use entry's source list name if available
      historyId: historyId,
      pickedUp: false, // Initialize pickup status
      pickupTimestamp: null,
      // Keep all original entry data under data key
      data: entry.data
    };
  });

  UI.updateProgress(75, 'Saving winners...');

  // Update prize quantity
  selectedPrize.quantity -= numWinners;

  // Create history entry
  const historyEntry = {
    historyId: historyId,
    listId: getCurrentList().listId || getCurrentList().metadata.listId,
    listName: getCurrentList().metadata.name,
    prize: selectedPrize.name,
    winners: winners.map(w => ({ winnerId: w.winnerId, displayName: w.displayName })),
    timestamp: Date.now()
  };

  // Determine if we should remove winners from this list (needed for undo)
  // Use per-list setting if available, otherwise fall back to global setting
  const currentList = getCurrentList();
  const shouldRemoveWinners = currentList.metadata?.listSettings?.removeWinnersFromList
                            ?? settings.preventDuplicates;

  // Store last action for undo
  setLastAction({
    type: 'selectWinners',
    winners: winners,
    removedEntries: selectedEntries,
    prizeId: selectedPrize.prizeId,
    prizeCount: numWinners,
    historyId: historyEntry.historyId,
    entriesRemoved: shouldRemoveWinners // Track if entries were removed for undo
  });

  // Prepare batch operations
  const operations = [
    ...winners.map(winner => ({ collection: 'winners', data: winner })),
    { collection: 'prizes', data: selectedPrize },
    { collection: 'history', data: historyEntry }
  ];

  // Remove winners from source lists if configured
  if (shouldRemoveWinners) {
    // If it's a combined list, update each source list separately
    if (currentList.metadata?.isCombined && currentList.metadata?.sourceListIds) {
      // Group selected entries by their source list
      const entriesByList = {};
      selectedEntries.forEach(entry => {
        if (entry.sourceListId) {
          if (!entriesByList[entry.sourceListId]) {
            entriesByList[entry.sourceListId] = [];
          }
          entriesByList[entry.sourceListId].push(entry.id);
        }
      });

      // Update each source list (check per-list setting for each)
      for (const listId of currentList.metadata.sourceListIds) {
        const sourceList = await Database.getFromStore('lists', listId);
        if (sourceList && entriesByList[listId]) {
          // Check per-list setting for this source list
          const shouldRemoveFromSourceList = sourceList.metadata?.listSettings?.removeWinnersFromList
                                           ?? settings.preventDuplicates;
          if (shouldRemoveFromSourceList) {
            // Remove the winners from this list
            sourceList.entries = sourceList.entries.filter(entry =>
              !entriesByList[listId].includes(entry.id)
            );
            sourceList.metadata.entryCount = sourceList.entries.length;
            operations.push({ collection: 'lists', data: sourceList });
          }
        }
      }

      // Update the combined list in memory
      currentList.entries = currentList.entries.filter(entry =>
        !selectedEntries.some(selected => selected.id === entry.id)
      );
      setCurrentList(currentList);
    } else {
      // Single list - original logic
      const updatedList = getCurrentList();
      updatedList.entries = updatedList.entries.filter(entry =>
        !selectedEntries.some(selected => selected.id === entry.id)
      );
      if (!updatedList.listId && updatedList.metadata && updatedList.metadata.listId) {
        updatedList.listId = updatedList.metadata.listId;
      }
      setCurrentList(updatedList);
      operations.push({ collection: 'lists', data: updatedList });
    }
  }
  
  // Batch save all data in a single request
  await Database.batchSave(operations);

  UI.updateProgress(100, 'Winners selected!');
  UI.hideProgress();

  // Update Alpine store to reflect new entry counts after removing winners
  if (shouldRemoveWinners) {
    const { Lists } = await import('./lists.js');
    await Lists.loadLists();
  }

  Settings.debugLog('Background winner selection completed');
  return winners;
}

function showCountdown(delaySeconds, visualType) {
  return new Promise((resolve) => {
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownNumber = document.getElementById('countdownNumber');

    Settings.debugLog('Starting countdown with visual type:', visualType);
    
    // Show the countdown overlay first
    countdownOverlay.classList.remove('d-none');
    
    if (visualType === 'animation') {
      Settings.debugLog('Starting particle animation');
      Animations.startParticleAnimation();
    }
    else if (visualType === 'swirl-animation') {
      Settings.debugLog('Starting swirl animation');
      Animations.startSwirlAnimation();
    }
    else if (visualType === 'time-machine') {
      Settings.debugLog('Starting time machine animation');
      Animations.startTimeMachineAnimation();
    }

    let count = Math.ceil(delaySeconds);
    
    // Show countdown number for all visual types (countdown AND animations)
    countdownNumber.textContent = count;
    countdownNumber.style.display = 'block'; // Ensure it's visible

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        // Update countdown number for all visual types
        countdownNumber.textContent = count;
        
        // Only play countdown beep for countdown visual (not animations)
        if (visualType === 'countdown') {
          playSound('countdown');
        }
      } else {
        clearInterval(interval);
        if (visualType === 'animation' || visualType === 'swirl-animation' || visualType === 'time-machine') {
          Settings.debugLog('Stopping animation for type:', visualType);
          Animations.stopAnimation();
        }
        // Restore countdown number display
        countdownNumber.style.display = '';
        countdownOverlay.classList.add('d-none');
        resolve();
      }
    }, 1000);
  });
}

async function selectWinners(numWinners, selectedPrize, selectionMode) {
  try {
    UI.showProgress('Selecting Winners', 'Preparing random selection...');

    // Hide selection controls
    document.getElementById('selectionControls').classList.add('d-none');

    // Create and use random worker
    const randomWorker = createRandomWorker();

    const selectedEntries = await new Promise((resolve, reject) => {
      randomWorker.onmessage = function (e) {
        if (e.data.type === 'complete') {
          resolve(e.data.result);
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.error));
        }
      };

      randomWorker.postMessage({
        type: 'select',
        entries: getCurrentList().entries,
        numWinners: numWinners,
        seed: Date.now()
      });
    });

    UI.updateProgress(50, 'Creating winner records...');

    // Create winner records
    const historyId = UI.generateId(8);
    const winners = selectedEntries.map((entry, index) => ({
      winnerId: UI.generateId(),
      entryId: entry.id, // Store the list entry ID for ticket scanning
      displayName: Lists.formatDisplayName(entry, getCurrentList().metadata.nameConfig),
      prize: selectedPrize.name,
      timestamp: Date.now(),
      listId: getCurrentList().listId || getCurrentList().metadata.listId,
      position: index + 1,
      historyId: historyId,
      pickedUp: false, // Initialize pickup status
      pickupTimestamp: null,
      // Keep all original entry data under data key
      data: entry.data
    }));

    UI.updateProgress(75, 'Saving winners...');

    // Save winners
    for (const winner of winners) {
      await Winners.saveWinner(winner);
    }

    // Update prize quantity
    selectedPrize.quantity -= numWinners;
    await Database.saveToStore('prizes', selectedPrize);

    // Save history
    const historyEntry = {
      historyId: historyId,
      listId: getCurrentList().listId || getCurrentList().metadata.listId,
      listName: getCurrentList().metadata.name,
      prize: selectedPrize.name,
      winners: winners.map(w => ({ winnerId: w.winnerId, displayName: w.displayName })),
      timestamp: Date.now()
    };
    await Database.saveToStore('history', historyEntry);

    // Remove winners from source lists based on per-list or global setting
    const currentListSeq = getCurrentList();

    // Determine if we should remove winners from this list
    // Use per-list setting if available, otherwise fall back to global setting
    const shouldRemoveWinnersSeq = currentListSeq.metadata?.listSettings?.removeWinnersFromList
                                 ?? settings.preventDuplicates;

    // Store last action for undo
    setLastAction({
      type: 'selectWinners',
      winners: winners,
      removedEntries: selectedEntries,
      prizeId: selectedPrize.prizeId,
      prizeCount: numWinners,
      historyId: historyEntry.historyId,
      entriesRemoved: shouldRemoveWinnersSeq // Track if entries were removed for undo
    });

    if (shouldRemoveWinnersSeq) {
      // If it's a combined list, update each source list separately
      if (currentListSeq.metadata?.isCombined && currentListSeq.metadata?.sourceListIds) {
        // Group selected entries by their source list
        const entriesByList = {};
        selectedEntries.forEach(entry => {
          if (entry.sourceListId) {
            if (!entriesByList[entry.sourceListId]) {
              entriesByList[entry.sourceListId] = [];
            }
            entriesByList[entry.sourceListId].push(entry.id);
          }
        });

        // Update each source list (check per-list setting for each)
        for (const listId of currentListSeq.metadata.sourceListIds) {
          const sourceList = await Database.getFromStore('lists', listId);
          if (sourceList && entriesByList[listId]) {
            // Check per-list setting for this source list
            const shouldRemoveFromSourceList = sourceList.metadata?.listSettings?.removeWinnersFromList
                                             ?? settings.preventDuplicates;
            if (shouldRemoveFromSourceList) {
              // Remove the winners from this list
              sourceList.entries = sourceList.entries.filter(entry =>
                !entriesByList[listId].includes(entry.id)
              );
              sourceList.metadata.entryCount = sourceList.entries.length;
              await Database.saveToStore('lists', sourceList);
            }
          }
        }

        // Update the combined list in memory
        currentListSeq.entries = currentListSeq.entries.filter(entry =>
          !selectedEntries.some(selected => selected.id === entry.id)
        );
        setCurrentList(currentListSeq);
      } else {
        // Single list - original logic
        const updatedList = getCurrentList();
        updatedList.entries = updatedList.entries.filter(entry =>
          !selectedEntries.some(selected => selected.id === entry.id)
        );
        if (!updatedList.listId && updatedList.metadata && updatedList.metadata.listId) {
          updatedList.listId = updatedList.metadata.listId;
        }
        setCurrentList(updatedList);
        await Database.saveToStore('lists', updatedList);
      }
    }

    UI.updateProgress(100, 'Winners selected!');

    // Update Alpine store to reflect new entry counts after removing winners
    if (shouldRemoveWinnersSeq) {
      const { Lists } = await import('./lists.js');
      await Lists.loadLists();
    }

    setTimeout(async () => {
      UI.hideProgress();
      
      // Set current winners immediately (so SMS button appears)
      setCurrentWinners(winners);
      
      await displayWinnersPublicly(winners, selectedPrize, selectionMode);

      // Skip redundant data loading - data was just saved
      // Only load if user navigates to the Winners tab
      // This avoids unnecessary network requests
      // Winners.loadWinners();  // Not needed
      // loadHistory();  // Not needed

      // Trigger webhook notification
      try {
        await Settings.triggerWebhook({
          event: 'winners_selected',
          winners: winners,
          prize: selectedPrize,
          listId: getCurrentList().listId || getCurrentList().metadata.listId,
          listName: getCurrentList().metadata.name,
          selectionId: historyId
        });
      } catch (error) {
        console.error('Error triggering webhook:', error);
      }
    }, 500);

  } catch (error) {
    UI.hideProgress();
    console.error('Error selecting winners:', error);
    UI.showToast('Error selecting winners: ' + error.message, 'error');
    Winners.resetToSelectionMode();
  }
}


async function displayWinnersPublicly(winners, prize, selectionMode) {
  // Show prize display
  const prizeDisplay = document.getElementById('prizeDisplay');
  document.getElementById('displayPrizeName').textContent = prize.name;
  document.getElementById('displayPrizeSubtitle').textContent = `${winners.length} Winner${winners.length > 1 ? 's' : ''}`;
  prizeDisplay.classList.remove('d-none');

  // Play applause sound once at the start of winner reveal
  if (settings.soundDuringReveal === 'applause') {
    playSound('applause');
  }

  // Show winners with CSS flexbox
  const winnersGrid = document.getElementById('winnersGrid');
  // Clear grid safely
  while (winnersGrid.firstChild) {
    winnersGrid.removeChild(winnersGrid.firstChild);
  }
  winnersGrid.className = 'winners-grid';

  // Clear any existing animations before starting new ones
  if (Animations && Animations.clearAllAnimations) {
    Animations.clearAllAnimations();
  }

  // Trigger celebration animation immediately when reveal starts
  const celebrationAutoTrigger = document.getElementById('celebrationAutoTrigger')?.checked;
  const celebrationEffect = document.getElementById('celebrationEffect')?.value;
  
  // Celebration settings configured
  
  if (celebrationAutoTrigger && celebrationEffect && celebrationEffect !== 'none') {
    // Only trigger confetti if confetti is selected (not for coins-only)
    if ((celebrationEffect === 'confetti' || celebrationEffect === 'both') && Animations && Animations.startConfettiAnimation) {
      Animations.startConfettiAnimation();
    }
  }

  if (selectionMode === 'sequential' || selectionMode === 'individual') {
    await displayWinnersSequential(winners, winnersGrid);
  } else {
    await displayWinnersAllAtOnce(winners, winnersGrid);
  }

  winnersGrid.classList.remove('d-none');

  // Show action buttons in header
  document.getElementById('undoSelectionBtn').classList.remove('d-none');
  document.getElementById('newSelectionBtn').classList.remove('d-none');
}

// Display all winners at once using CSS grid
async function displayWinnersAllAtOnce(winners, winnersGrid) {
  const displayEffect = document.getElementById('displayEffect')?.value || 'fade-in';
  const celebrationAutoTrigger = document.getElementById('celebrationAutoTrigger')?.checked;
  const celebrationEffect = document.getElementById('celebrationEffect')?.value;
  const shouldShowCoins = celebrationAutoTrigger && (celebrationEffect === 'coins' || celebrationEffect === 'both');
  
  winners.forEach((winner, index) => {
    const winnerCard = createWinnerCard(winner, index);
    // Apply the selected display effect
    winnerCard.classList.add(displayEffect);
    winnersGrid.appendChild(winnerCard);
    
    // Trigger coin burst from card position after a short delay (only if coins are enabled)
    if (shouldShowCoins) {
      setTimeout(() => {
        const rect = winnerCard.getBoundingClientRect();
        const cardCenterX = rect.left + rect.width / 2;
        const cardCenterY = rect.top + rect.height / 2;
        if (Animations && Animations.createCoinBurst) {
          Animations.createCoinBurst(cardCenterX, cardCenterY);
        }
      }, 200 + index * 50); // Stagger the coin bursts
    }
  });
}

// Display winners sequentially using CSS grid
async function displayWinnersSequential(winners, winnersGrid) {
  const displayDuration = parseFloat(document.getElementById('displayDuration').value) || 0.5;
  const displayEffect = document.getElementById('displayEffect')?.value || 'fade-in';
  const celebrationAutoTrigger = document.getElementById('celebrationAutoTrigger')?.checked;
  const celebrationEffect = document.getElementById('celebrationEffect')?.value;
  const shouldShowCoins = celebrationAutoTrigger && (celebrationEffect === 'coins' || celebrationEffect === 'both');
  const stableGrid = document.getElementById('stableGrid')?.checked || false;

  return new Promise((resolve) => {
    let completedWinners = 0;

    if (stableGrid) {
      // STABLE GRID MODE: Pre-create all cards as placeholders, then reveal sequentially
      // This prevents grid layout shifting as cards are revealed
      const cards = [];

      // Step 1: Create all cards as invisible placeholders
      winners.forEach((winner, index) => {
        const winnerCard = createWinnerCard(winner, index);
        winnerCard.classList.add('winner-card-placeholder');
        winnersGrid.appendChild(winnerCard);
        cards.push(winnerCard);
      });

      // Step 2: Reveal cards one by one with animation
      cards.forEach((winnerCard, index) => {
        const delay = index * (displayDuration * 1000);

        setTimeout(() => {
          // Remove placeholder class and add reveal animation
          winnerCard.classList.remove('winner-card-placeholder');
          winnerCard.classList.add(displayEffect);

          // Trigger coin burst from card position
          if (shouldShowCoins) {
            setTimeout(() => {
              const rect = winnerCard.getBoundingClientRect();
              const cardCenterX = rect.left + rect.width / 2;
              const cardCenterY = rect.top + rect.height / 2;
              if (Animations && Animations.createCoinBurst) {
                Animations.createCoinBurst(cardCenterX, cardCenterY);
              }
            }, 300);
          }

          // Track completion
          winnerCard.addEventListener('animationend', () => {
            completedWinners++;
            if (completedWinners === winners.length) {
              resolve();
            }
          });
        }, delay);
      });
    } else {
      // ORIGINAL MODE: Add cards to DOM sequentially (grid adjusts as cards appear)
      winners.forEach((winner, index) => {
        const delay = index * (displayDuration * 1000);

        setTimeout(() => {
          const winnerCard = createWinnerCard(winner, index);
          // Apply the selected display effect
          winnerCard.classList.add(displayEffect);
          winnersGrid.appendChild(winnerCard);

          // Trigger coin burst from card position after a short delay (only if coins are enabled)
          if (shouldShowCoins) {
            setTimeout(() => {
              const rect = winnerCard.getBoundingClientRect();
              const cardCenterX = rect.left + rect.width / 2;
              const cardCenterY = rect.top + rect.height / 2;
              if (Animations && Animations.createCoinBurst) {
                Animations.createCoinBurst(cardCenterX, cardCenterY);
              }
            }, 300); // Delay to ensure card animation has started
          }

          // Listen for animation end to track completion
          winnerCard.addEventListener('animationend', () => {
            completedWinners++;
            if (completedWinners === winners.length) {
              resolve();
            }
          });
        }, delay);
      });
    }
  });
}

// Create winner card using CSS styling with new info field structure
function createWinnerCard(winner, index) {
  const winnerCard = document.createElement('div');
  winnerCard.className = 'winner-card';
  
  // Get info fields from winner data
  const info1 = getWinnerInfo1(winner);
  const info2 = getWinnerInfo2(winner);
  const info3 = getWinnerInfo3(winner);
  
  if (settings.enableDebugLogs) {
    console.log('Creating winner card:', {
      winner,
      info1,
      info2,
      info3,
      displayName: winner.displayName,
      data: winner.data
    });
  }
  
  // Build card content safely
  const numberDiv = document.createElement('div');
  numberDiv.className = 'winner-number';
  numberDiv.textContent = String(winner.position || index + 1);
  winnerCard.appendChild(numberDiv);
  
  if (info1) {
    const info1Div = document.createElement('div');
    info1Div.className = 'winner-info1';
    info1Div.textContent = info1;
    winnerCard.appendChild(info1Div);
  }
  
  if (info2) {
    const info2Div = document.createElement('div');
    info2Div.className = 'winner-info2';
    info2Div.textContent = info2;
    winnerCard.appendChild(info2Div);
  }
  
  if (info3) {
    const info3Div = document.createElement('div');
    info3Div.className = 'winner-info3';
    info3Div.textContent = info3;
    winnerCard.appendChild(info3Div);
  }
  
  return winnerCard;
}

// New info field extraction functions using configured templates
function getWinnerInfo1(winner) {
  const currentList = getCurrentList();
  const infoConfig = currentList?.metadata?.infoConfig;
  
  if (infoConfig?.info1) {
    return formatInfoTemplate(infoConfig.info1, winner);
  }
  
  // Fallback to displayName if no configuration
  return winner.displayName || '';
}

function getWinnerInfo2(winner) {
  const currentList = getCurrentList();
  const infoConfig = currentList?.metadata?.infoConfig;
  
  if (infoConfig?.info2) {
    return formatInfoTemplate(infoConfig.info2, winner);
  }
  
  // Fallback to searching common secondary fields
  const secondaryFields = ['email', 'department', 'title', 'position'];
  for (const field of secondaryFields) {
    if (winner[field]) {
      return winner[field];
    }
  }
  
  return '';
}

function getWinnerInfo3(winner) {
  const currentList = getCurrentList();
  const infoConfig = currentList?.metadata?.infoConfig;
  
  if (infoConfig?.info3) {
    return formatInfoTemplate(infoConfig.info3, winner);
  }
  
  // Fallback to searching common tertiary fields  
  const tertiaryFields = ['phone', 'id', 'employee_id', 'member_id'];
  for (const field of tertiaryFields) {
    if (winner[field]) {
      return winner[field];
    }
  }
  
  return '';
}

// Helper function to format info templates
function formatInfoTemplate(template, winner) {
  if (!template) return '';
  
  const result = template.replace(/\{([^}]+)\}/g, (match, key) => {
    const trimmedKey = key.trim();
    // First check if the key exists directly on winner (like displayName)
    if (winner[trimmedKey]) {
      return winner[trimmedKey];
    }
    
    // Check in contactInfo for common fields (new structure)
    if (winner.contactInfo) {
      if (trimmedKey === 'phoneNumber' || trimmedKey === 'phone') {
        if (winner.contactInfo.phoneNumber) return winner.contactInfo.phoneNumber;
      }
      if (trimmedKey === 'orderId' || trimmedKey === 'Order ID') {
        if (winner.contactInfo.orderId) return winner.contactInfo.orderId;
      }
      if (trimmedKey === 'email' || trimmedKey === 'orderEmail') {
        if (winner.contactInfo.email) return winner.contactInfo.email;
      }
    }
    
    // Check flattened data fields
    if (winner[trimmedKey]) {
      return winner[trimmedKey];
    }
    
    // Fallback to old structure (data field)
    if (winner.data && winner.data[trimmedKey]) {
      return winner.data[trimmedKey];
    }
    
    return '';
  }).trim();
  
  // Return empty string if result is just a dash or whitespace
  return (result === '-' || result === '' || /^\s*$/.test(result)) ? '' : result;
}

// Legacy function - will be removed once info system is fully implemented
function getWinnerDetails(winner) {
  const details = [];
  const fieldsToShow = ['email', 'phone', 'department', 'id', 'employee_id', 'member_id'];

  for (const field of fieldsToShow) {
    if (winner[field]) {
      details.push(`${field.toUpperCase()}: ${winner[field]}`);
      break;
    }
  }

  return details.length > 0 ? details[0] : 'Winner Selected';
}

// MP3 Sound Effects
let currentAudio = null; // Track currently playing audio for stopping

function playSound(type) {
  try {
    if (type === 'countdown') {
      // Keep programmatic beep for countdown as it's quick and simple
      playBeep(800, 100);
    } else if (type === 'winner' || type === 'applause') {
      playMp3Sound('applause');
    } else if (type === 'drumroll-start' || type === 'drum-roll') {
      playMp3Sound('drum-roll');
    } else if (type === 'drumroll-stop') {
      stopCurrentAudio();
    } else if (type === 'final-beat' || type === 'sting-rimshot') {
      playMp3Sound('sting-rimshot-drum-roll');
    } else {
      // Handle custom sound IDs directly
      playMp3Sound(type);
    }
  } catch (error) {
    console.warn('Could not play sound:', error);
  }
}

function playMp3Sound(soundId) {
  // Import Sounds module dynamically to avoid circular imports
  import('./sounds.js').then(({ Sounds }) => {
    const soundUrl = Sounds.getSoundUrl(soundId);
    if (!soundUrl) {
      console.warn('Sound not found:', soundId);
      return;
    }
    
    // Stop any currently playing audio
    stopCurrentAudio();
    
    const audio = new Audio(soundUrl);
    audio.volume = 0.7; // Set reasonable volume
    currentAudio = audio;
    
    audio.play().catch(error => {
      console.warn('Could not play MP3 sound:', error);
    });
    
    // Clear reference when audio ends
    audio.addEventListener('ended', () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
      // Clean up blob URL if it's a custom sound
      if (soundUrl.startsWith('blob:')) {
        URL.revokeObjectURL(soundUrl);
      }
    });
  }).catch(error => {
    console.warn('Could not load sound module:', error);
  });
}

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

// Simple beep for countdown (keep programmatic for responsiveness)
function playBeep(frequency, duration) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  } catch (error) {
    console.warn('Could not play beep:', error);
  }
}


export const Selection = {
  createRandomWorker,
  handleBigPlayClick,
  showCountdown,
  selectWinners,
  displayWinnersPublicly,
  displayWinnersAllAtOnce,
  displayWinnersSequential,
  createWinnerCard,
  getWinnerDetails,
  playSound
};

window.Selection = Selection;