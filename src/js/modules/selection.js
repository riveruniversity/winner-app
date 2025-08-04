// ================================
// WINNER SELECTION LOGIC
// ================================

import { UI } from './ui.js';
import { Database } from './firestore.js';
import { Lists } from './lists.js';
import { Winners } from './winners.js';
import { settings, Settings } from './settings.js'; // Import settings and Settings module
import { Animations } from './animations.js';
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
      // Use seed for reproducible randomness if needed
      if (seed) {
        Math.seedrandom = function(seed) {
          let x = Math.sin(seed) * 10000;
          return function() {
            x = Math.sin(x) * 10000;
            return x - Math.floor(x);
          };
        };
        Math.random = Math.seedrandom(seed);
      }
      
      const available = [...entries];
      const selected = [];
      
      for (let i = 0; i < numWinners && available.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * available.length);
        selected.push(available.splice(randomIndex, 1)[0]);
      }
      
      return selected;
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

    console.log('Big play clicked, selection mode:', selectionMode, 'delay visual:', delayVisualType);
    
    // Start the delay and selection process in parallel
    await selectWinnersWithDelay(winnersCount, selectedPrize, selectionMode, delayVisualType);
  } catch (error) {
    console.error('Error in big play click:', error);
    UI.showToast('Error selecting winners: ' + error.message, 'error');
  }
}

async function selectWinnersWithDelay(numWinners, selectedPrize, selectionMode, delayVisualType) {
  try {
    console.log('Starting parallel selection and delay process');
    
    // Get delay settings
    const preSelectionDelay = parseFloat(document.getElementById('preSelectionDelay')?.value) || 0;
    
    let winnersResult = null;
    let delayPromise = Promise.resolve();
    
    // Start pre-selection delay if configured
    if (preSelectionDelay > 0) {
      console.log('Starting pre-selection delay:', preSelectionDelay, 'seconds with visual:', delayVisualType);
      
      // Start sound during delay if configured
      if (settings.soundDuringDelay === 'drum-roll' && preSelectionDelay > 1) {
        playSound('drum-roll');
      }
      
      if (delayVisualType === 'countdown' || delayVisualType === 'animation' || delayVisualType === 'swirl-animation') {
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
    
    console.log('Selection and delay completed, starting display process');
    
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
  console.log('Starting background winner selection');
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
    uniqueId: UI.generateId(5).toUpperCase(),
    ...entry.data,
    displayName: Lists.formatDisplayName(entry, getCurrentList().metadata.nameConfig),
    prize: selectedPrize.name,
    timestamp: Date.now(),
    originalEntry: entry,
    listId: getCurrentList().listId || getCurrentList().metadata.listId,
    position: index + 1,
    historyId: historyId
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
  
  console.log('Background winner selection completed');
  return winners;
}

function showCountdown(delaySeconds, visualType) {
  return new Promise((resolve) => {
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownNumber = document.getElementById('countdownNumber');

    console.log('Starting countdown with visual type:', visualType);
    
    if (visualType === 'animation') {
      console.log('Starting particle animation');
      Animations.startParticleAnimation();
    }
    else if (visualType === 'swirl-animation') {
      console.log('Starting swirl animation');
      Animations.startSwirlAnimation();
    }

    let count = Math.ceil(delaySeconds);
    countdownOverlay.classList.remove('d-none');
    countdownNumber.textContent = count;

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNumber.textContent = count;
        // Countdown beeps are part of the countdown visual, not configurable separately
        playSound('countdown');
      } else {
        clearInterval(interval);
        if (visualType === 'animation' || visualType === 'swirl-animation') {
          console.log('Stopping animation for type:', visualType);
          Animations.stopAnimation();
        }
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
      uniqueId: UI.generateId(5).toUpperCase(),
      ...entry.data,
      displayName: Lists.formatDisplayName(entry, getCurrentList().metadata.nameConfig),
      prize: selectedPrize.name,
      timestamp: Date.now(),
      originalEntry: entry,
      listId: getCurrentList().listId || getCurrentList().metadata.listId,
      position: index + 1,
      historyId: historyId
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

function adjustWinnerCardFontSize(numWinners) {
  const winnerCards = document.querySelectorAll('.winner-card');
  if (winnerCards.length === 0) return;

  // Base font sizes
  let nameFontSize = 1.5; // rem
  let detailsFontSize = 0.9; // rem

  // Adjust based on number of winners
  if (numWinners > 8) {
    nameFontSize = 1.0;
    detailsFontSize = 0.7;
  } else if (numWinners > 4) {
    nameFontSize = 1.2;
    detailsFontSize = 0.8;
  }

  winnerCards.forEach(card => {
    const nameElement = card.querySelector('.winner-name');
    const detailsElement = card.querySelector('.winner-details');
    if (nameElement) nameElement.style.fontSize = `${nameFontSize}rem`;
    if (detailsElement) detailsElement.style.fontSize = `${detailsFontSize}rem`;
  });
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
  
  winners.forEach((winner, index) => {
    const winnerCard = createWinnerCard(winner, index);
    // Apply the selected display effect
    winnerCard.classList.add(displayEffect);
    winnersGrid.appendChild(winnerCard);
  });
}

// Display winners sequentially using CSS grid
async function displayWinnersSequential(winners, winnersGrid) {
  const displayDuration = parseFloat(document.getElementById('displayDuration').value) || 0.5;
  const displayEffect = document.getElementById('displayEffect')?.value || 'fade-in';
  
  return new Promise((resolve) => {
    let completedWinners = 0;
    
    winners.forEach((winner, index) => {
      const delay = index * (displayDuration * 1000);
      
      setTimeout(() => {
        const winnerCard = createWinnerCard(winner, index);
        // Apply the selected display effect
        winnerCard.classList.add(displayEffect);
        winnersGrid.appendChild(winnerCard);
        
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
  
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    return winner[key.trim()] || '';
  }).trim();
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

// Audio cache to prevent loading the same file multiple times
const audioCache = new Map();

function loadAudio(filename) {
  if (audioCache.has(filename)) {
    return Promise.resolve(audioCache.get(filename));
  }
  
  return new Promise((resolve, reject) => {
    const audio = new Audio(`/sounds/${filename}.mp3`);
    audio.addEventListener('canplaythrough', () => {
      audioCache.set(filename, audio);
      resolve(audio);
    });
    audio.addEventListener('error', reject);
    audio.load();
  });
}

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
    }
  } catch (error) {
    console.warn('Could not play sound:', error);
  }
}

function playMp3Sound(filename) {
  loadAudio(filename).then(audio => {
    // Stop any currently playing audio
    stopCurrentAudio();
    
    // Clone the audio to allow multiple simultaneous plays if needed
    const audioClone = audio.cloneNode();
    audioClone.volume = 0.7; // Set reasonable volume
    currentAudio = audioClone;
    
    audioClone.play().catch(error => {
      console.warn('Could not play MP3 sound:', error);
    });
    
    // Clear reference when audio ends
    audioClone.addEventListener('ended', () => {
      if (currentAudio === audioClone) {
        currentAudio = null;
      }
    });
  }).catch(error => {
    console.warn('Could not load MP3 sound:', filename, error);
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