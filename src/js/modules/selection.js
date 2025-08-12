// ================================
// WINNER SELECTION LOGIC
// ================================

import { UI } from './ui.js';
import { Database } from './firestore.js';
import { Lists } from './lists.js';
import { Winners } from './winners.js';
import { settings, Settings } from './settings.js'; // Import settings and Settings module
import { Animations } from './animations.js';
import { setCurrentWinners } from '../app.js';
import { getCurrentList, setCurrentList, getLastAction, setLastAction, loadHistory, updateHistoryStats } from '../app.js'; // Import central state and history functions

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
    const listId = document.getElementById('quickListSelect').value;
    const prizeId = document.getElementById('quickPrizeSelect').value;
    const winnersCount = parseInt(document.getElementById('quickWinnersCount').value);
    const selectionMode = document.getElementById('selectionMode').value;
    const delayVisualType = document.getElementById('delayVisualType').value;

    if (!listId || !prizeId) {
      UI.showToast('Please select both a list and a prize', 'warning');
      return;
    }

    if (winnersCount < 1) {
      UI.showToast('Please enter a valid number of winners', 'warning');
      return;
    }

    // Load the selected list and prize
    const list = await Database.getFromStore('lists', listId);
    const prizes = await Database.getFromStore('prizes');
    const selectedPrize = prizes.find(p => p.prizeId === prizeId);

    if (!list || !selectedPrize) {
      UI.showToast('Selected list or prize not found', 'error');
      return;
    }

    if (selectedPrize.quantity < winnersCount) {
      UI.showToast(`Not enough prizes available. Only ${selectedPrize.quantity} remaining.`, 'warning');
      return;
    }

    if (list.entries.length < winnersCount) {
      UI.showToast(`Not enough entries in list. Only ${list.entries.length} available.`, 'warning');
      return;
    }

    // Set current list for global access
    setCurrentList(list);

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
      delayPromise = delayPromise.then(() => {
        if (settings.soundDuringDelay === 'drum-roll' && preSelectionDelay > 1) {
          playSound('drumroll-stop'); // This will stop the drumroll
        }
        if (settings.soundEndOfDelay === 'sting-rimshot-drum-roll') {
          playSound('sting-rimshot');
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
    
    // Update UI and trigger webhook
    Winners.loadWinners();
    loadHistory();
    
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

  // Create winner records
  const historyId = UI.generateId(8);
  const winners = selectedEntries.map((entry, index) => ({
    winnerId: UI.generateId(),
    entryId: entry.id, // Store the list entry ID for ticket scanning
    data: entry.data, // Store all original data
    displayName: Lists.formatDisplayName(entry, getCurrentList().metadata.nameConfig),
    prize: selectedPrize.name,
    timestamp: Date.now(),
    originalEntry: entry, // Store complete entry including ID
    listId: getCurrentList().listId || getCurrentList().metadata.listId,
    position: index + 1,
    historyId: historyId,
    pickedUp: false, // Initialize pickup status
    pickupTimestamp: null
  }));

  UI.updateProgress(75, 'Saving winners...');

  // Save winners in background
  const savePromises = [];
  for (const winner of winners) {
    savePromises.push(Winners.saveWinner(winner));
  }

  // Update prize quantity
  selectedPrize.quantity -= numWinners;
  savePromises.push(Database.saveToStore('prizes', selectedPrize));

  // Save history
  const historyEntry = {
    historyId: historyId,
    listId: getCurrentList().listId || getCurrentList().metadata.listId,
    listName: getCurrentList().metadata.name,
    prize: selectedPrize.name,
    winners: winners.map(w => ({ winnerId: w.winnerId, displayName: w.displayName })),
    timestamp: Date.now()
  };
  savePromises.push(Database.saveToStore('history', historyEntry));

  // Store last action for undo
  setLastAction({
    type: 'selectWinners',
    winners: winners,
    removedEntries: selectedEntries,
    prizeId: selectedPrize.prizeId,
    prizeCount: numWinners,
    historyId: historyEntry.historyId
  });

  // Remove winners from list if setting is enabled
  if (settings.preventDuplicates) {
    const updatedList = getCurrentList();
    updatedList.entries = updatedList.entries.filter(entry =>
      !selectedEntries.some(selected => selected.id === entry.id)
    );
    if (!updatedList.listId && updatedList.metadata && updatedList.metadata.listId) {
      updatedList.listId = updatedList.metadata.listId;
    }
    setCurrentList(updatedList);
    savePromises.push(Database.saveToStore('lists', updatedList));
  }

  // Wait for all saves to complete in background
  await Promise.all(savePromises);

  UI.updateProgress(100, 'Winners selected!');
  UI.hideProgress();
  
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
      data: entry.data, // Store all original data
      displayName: Lists.formatDisplayName(entry, getCurrentList().metadata.nameConfig),
      prize: selectedPrize.name,
      timestamp: Date.now(),
      originalEntry: entry, // Store complete entry including ID
      listId: getCurrentList().listId || getCurrentList().metadata.listId,
      position: index + 1,
      historyId: historyId,
      pickedUp: false, // Initialize pickup status
      pickupTimestamp: null
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

    // Store last action for undo
    setLastAction({
      type: 'selectWinners',
      winners: winners,
      removedEntries: selectedEntries,
      prizeId: selectedPrize.prizeId,
      prizeCount: numWinners,
      historyId: historyEntry.historyId
    });

    // Remove winners from list if setting is enabled
    if (settings.preventDuplicates) {
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

    UI.updateProgress(100, 'Winners selected!');

    setTimeout(async () => {
      UI.hideProgress();
      
      // Set current winners immediately (so SMS button appears)
      setCurrentWinners(winners);
      
      await displayWinnersPublicly(winners, selectedPrize, selectionMode);

      // Update the winners list in management interface
      Winners.loadWinners();
      loadHistory(); // Call from app.js

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
  winnersGrid.innerHTML = '';
  winnersGrid.className = 'winners-grid';

  // Clear any existing animations before starting new ones
  if (Animations && Animations.clearAllAnimations) {
    Animations.clearAllAnimations();
  }

  // Trigger celebration animation immediately when reveal starts
  const celebrationAutoTrigger = document.getElementById('celebrationAutoTrigger')?.checked;
  const celebrationEffect = document.getElementById('celebrationEffect')?.value;
  
  console.log('Celebration settings:', {
    autoTrigger: celebrationAutoTrigger,
    effect: celebrationEffect,
    AnimationsAvailable: !!Animations,
    startConfettiAvailable: !!(Animations && Animations.startConfettiAnimation)
  });
  
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
  
  return new Promise((resolve) => {
    let completedWinners = 0;
    
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
  
  let cardHTML = `<div class="winner-number">${winner.position}</div>`;
  
  if (info1) {
    cardHTML += `<div class="winner-info1">${info1}</div>`;
  }
  
  if (info2) {
    cardHTML += `<div class="winner-info2">${info2}</div>`;
  }
  
  if (info3) {
    cardHTML += `<div class="winner-info3">${info3}</div>`;
  }
  
  winnerCard.innerHTML = cardHTML;
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
    // Then check in the data object where CSV fields are stored
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