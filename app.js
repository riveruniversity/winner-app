// Global variables
let db;
let appModal = null;
let currentList = null;
let lastAction = null;
let settings = {
  displayMode: 'all-at-once',
  displayDuration: 3,
  countdownDuration: 5,
  preventDuplicates: false,
  enableSoundEffects: false,
  hideEntryCounts: false,
  fontFamily: 'Inter',
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  backgroundType: 'gradient',
  customBackgroundImage: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async function () {
  try {
    // Initialize other components first
    await initDB();
    await loadSettings();
    await initializeApp();
    setupEventListeners();
    setupTheme();
    
    // Initialize modal after everything else is ready
    setTimeout(() => {
      const modalElement = document.getElementById('appModal');
      if (modalElement) {
        appModal = new bootstrap.Modal(modalElement);
      }
    }, 100);
    
    showToast('Application loaded successfully!', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to initialize application: ' + error.message, 'error');
  }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Utility Functions
function generateId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function showToast(message, type = 'info') {
  const backgroundColor = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#06b6d4'
  };

  Toastify({
    text: message,
    duration: 3000,
    gravity: 'bottom',
    position: 'right',
    style: {
      background: backgroundColor[type] || backgroundColor.info,
    }
  }).showToast();
}

// Random Selection Worker
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

// Progressive Loading Functions
function showProgress(title, text) {
  document.getElementById('progressTitle').textContent = title;
  document.getElementById('progressText').textContent = text;
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressOverlay').classList.remove('d-none');
}

function updateProgress(percentage, text) {
  document.getElementById('progressFill').style.width = percentage + '%';
  if (text) {
    document.getElementById('progressText').textContent = text;
  }
}

function hideProgress() {
  document.getElementById('progressOverlay').classList.add('d-none');
}

// IndexedDB setup with proper promise handling
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WinnerSelectionApp', 3);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;

      // Create object stores
      const stores = ['lists', 'winners', 'prizes', 'history', 'settings'];

      stores.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: getKeyPath(storeName) });
          if (storeName === 'winners') {
            store.createIndex('listId', 'listId', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
          if (storeName === 'history') {
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('listId', 'listId', { unique: false });
          }
        }
      });
    };
  });
}

function getKeyPath(storeName) {
  const keyPaths = {
    lists: 'listId',
    winners: 'winnerId',
    prizes: 'prizeId',
    history: 'historyId',
    settings: 'key'
  };
  return keyPaths[storeName] || 'id';
}

// Database operations
async function saveToStore(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromStore(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromStore(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromStore(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Specific database functions
async function saveList(list) {
  return saveToStore('lists', list);
}

async function getList(listId) {
  return getFromStore('lists', listId);
}

async function getAllLists() {
  return getAllFromStore('lists');
}

async function deleteList(listId) {
  return deleteFromStore('lists', listId);
}

async function savePrize(prize) {
  return saveToStore('prizes', prize);
}

async function getAllPrizes() {
  return getAllFromStore('prizes');
}

async function deletePrize(prizeId) {
  return deleteFromStore('prizes', prizeId);
}

async function saveWinner(winner) {
  return saveToStore('winners', winner);
}

async function getAllWinners() {
  return getAllFromStore('winners');
}

async function deleteWinner(winnerId) {
  return deleteFromStore('winners', winnerId);
}

async function saveHistory(historyEntry) {
  return saveToStore('history', historyEntry);
}

async function getAllHistory() {
  return getAllFromStore('history');
}

async function deleteHistory(historyId) {
  return deleteFromStore('history', historyId);
}

async function saveSettings() {
  for (const [key, value] of Object.entries(settings)) {
    await saveToStore('settings', { key, value });
  }
}

async function loadSettings() {
  try {
    const savedSettings = await getAllFromStore('settings');
    for (const setting of savedSettings) {
      if (settings.hasOwnProperty(setting.key)) {
        settings[setting.key] = setting.value;
      }
    }
  } catch (error) {
    console.warn('Could not load settings:', error);
  }
}

// Application initialization
async function initializeApp() {
  await loadLists();
  await loadPrizes();
  await loadWinners();
  await loadHistory();
  await updateHistoryStats();
  await populateQuickSelects();
  applyVisibilitySettings();
}

// Apply visibility settings to interface elements
function applyVisibilitySettings() {
  // Show/hide total entries card based on setting
  const totalEntriesCard = document.getElementById('totalEntriesCard');
  if (totalEntriesCard) {
    totalEntriesCard.style.display = settings.hideEntryCounts ? 'none' : 'block';
  }
}

async function loadLists() {
  try {
    const lists = await getAllLists();
    const container = document.getElementById('listsContainer');

    if (!container) return;

    if (lists.length === 0) {
      container.innerHTML = '<p class="text-muted">No lists uploaded yet.</p>';
      return;
    }

    // Ensure backward compatibility - fix lists that don't have listId at root
    for (const list of lists) {
      if (!list.listId && list.metadata && list.metadata.listId) {
        list.listId = list.metadata.listId;
        await saveList(list);
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
            <button class="btn btn-outline-primary" onclick="viewList('${list.listId || list.metadata.listId}')">
              <i class="bi bi-eye"></i> View
            </button>
            <button class="btn btn-outline-danger" onclick="deleteListConfirm('${list.listId || list.metadata.listId}')">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading lists:', error);
    showToast('Error loading lists: ' + error.message, 'error');
  }
}

async function loadPrizes() {
  try {
    const prizes = await getAllPrizes();
    const container = document.getElementById('prizesContainer');

    if (!container) return;

    if (prizes.length === 0) {
      container.innerHTML = '<p class="text-muted">No prizes added yet.</p>';
      return;
    }

    container.innerHTML = prizes.map(prize => `
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title">${prize.name}</h6>
          <p class="card-text">
            <span class="badge bg-primary">Qty: ${prize.quantity}</span>
            ${prize.description ? `<br><small class="text-muted">${prize.description}</small>` : ''}
          </p>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="editPrize('${prize.prizeId}')">
              <i class="bi bi-pencil"></i> Edit
            </button>
            <button class="btn btn-outline-danger" onclick="deletePrizeConfirm('${prize.prizeId}')">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading prizes:', error);
    showToast('Error loading prizes: ' + error.message, 'error');
  }
}

async function loadWinners() {
  try {
    const winners = await getAllWinners();
    const tbody = document.getElementById('winnersTableBody');

    if (!tbody) return;

    if (winners.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No winners selected yet.</td></tr>';
      return;
    }

    tbody.innerHTML = winners.map(winner => `
      <tr>
        <td>${winner.displayName}</td>
        <td>${winner.prize}</td>
        <td>${new Date(winner.timestamp).toLocaleDateString()}</td>
        <td>${winner.listId || 'Unknown'}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteWinnerConfirm('${winner.winnerId}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading winners:', error);
    showToast('Error loading winners: ' + error.message, 'error');
  }
}

async function loadHistory() {
  try {
    const history = await getAllHistory();
    const tbody = document.getElementById('historyTableBody');

    if (!tbody) return;

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No selection history yet.</td></tr>';
      return;
    }

    // Sort by timestamp descending
    history.sort((a, b) => b.timestamp - a.timestamp);

    tbody.innerHTML = history.map(entry => `
      <tr>
        <td>${new Date(entry.timestamp).toLocaleDateString()}</td>
        <td>${entry.listName || 'Unknown'}</td>
        <td>${entry.prize}</td>
        <td>${entry.winners.length}</td>
        <td>${entry.winners.map(w => w.displayName).join(', ')}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteHistoryConfirm('${entry.historyId}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading history:', error);
    showToast('Error loading history: ' + error.message, 'error');
  }
}

async function populateQuickSelects() {
  try {
    const lists = await getAllLists();
    const prizes = await getAllPrizes();

    const quickListSelect = document.getElementById('quickListSelect');
    const quickPrizeSelect = document.getElementById('quickPrizeSelect');

    if (quickListSelect) {
      quickListSelect.innerHTML = '<option value="">Select List...</option>';
      lists.forEach(list => {
        const listId = list.listId || list.metadata.listId;
        const option = document.createElement('option');
        option.value = listId;
        option.textContent = settings.hideEntryCounts 
          ? list.metadata.name
          : `${list.metadata.name} (${list.entries.length} entries)`;
        quickListSelect.appendChild(option);
      });
    }

    if (quickPrizeSelect) {
      quickPrizeSelect.innerHTML = '<option value="">Select Prize...</option>';
      prizes.filter(prize => prize.quantity > 0).forEach(prize => {
        const option = document.createElement('option');
        option.value = prize.prizeId;
        option.textContent = `${prize.name} (${prize.quantity} available)`;
        quickPrizeSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error populating quick selects:', error);
    showToast('Error loading selection options: ' + error.message, 'error');
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Interface Toggle
  const managementToggle = document.getElementById('managementToggle');
  const backToPublicBtn = document.getElementById('backToPublicBtn');

  if (managementToggle) {
    managementToggle.addEventListener('click', function () {
      document.getElementById('publicInterface').style.display = 'none';
      document.getElementById('managementInterface').classList.add('active');
    });
  }

  if (backToPublicBtn) {
    backToPublicBtn.addEventListener('click', function () {
      document.getElementById('managementInterface').classList.remove('active');
      document.getElementById('publicInterface').style.display = 'flex';
    });
  }

  // Fullscreen Toggle
  const fullscreenToggle = document.getElementById('fullscreenToggle');
  if (fullscreenToggle) {
    fullscreenToggle.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        fullscreenToggle.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
      } else {
        document.exitFullscreen();
        fullscreenToggle.innerHTML = '<i class="bi bi-fullscreen"></i>';
      }
    });
  }

  // Quick Selection Updates
  const quickListSelect = document.getElementById('quickListSelect');
  const quickPrizeSelect = document.getElementById('quickPrizeSelect');
  const quickWinnersCount = document.getElementById('quickWinnersCount');

  function updateSelectionInfo() {
    const listOption = quickListSelect.options[quickListSelect.selectedIndex];
    const prizeOption = quickPrizeSelect.options[quickPrizeSelect.selectedIndex];

    const listText = listOption ? listOption.textContent.split(' (')[0] : 'Not Selected';
    const prizeText = prizeOption ? prizeOption.textContent.split(' (')[0] : 'Not Selected';

    document.getElementById('currentListDisplay').textContent = listText;
    document.getElementById('currentPrizeDisplay').textContent = prizeText;
    document.getElementById('winnersCountDisplay').textContent = quickWinnersCount.value;

    // Update total entries when list changes
    if (quickListSelect.value) {
      updateTotalEntries();
    } else {
      document.getElementById('totalEntriesDisplay').textContent = '0';
    }

    // Enable play button only if list and prize are selected
    const bigPlayButton = document.getElementById('bigPlayButton');
    if (bigPlayButton) {
      bigPlayButton.disabled = !quickListSelect.value || !quickPrizeSelect.value;
    }
  }

  async function updateTotalEntries() {
    try {
      const listId = quickListSelect.value;
      if (listId) {
        const list = await getList(listId);
        if (list) {
          document.getElementById('totalEntriesDisplay').textContent = list.entries.length;
          // Update currentList for later use
          currentList = list;
        }
      }
    } catch (error) {
      console.error('Error updating total entries:', error);
    }
  }

  if (quickListSelect) quickListSelect.addEventListener('change', updateSelectionInfo);
  if (quickPrizeSelect) quickPrizeSelect.addEventListener('change', updateSelectionInfo);
  if (quickWinnersCount) quickWinnersCount.addEventListener('input', updateSelectionInfo);

  // Big Play Button
  const bigPlayButton = document.getElementById('bigPlayButton');
  if (bigPlayButton) {
    bigPlayButton.addEventListener('click', handleBigPlayClick);
  }

  // Action Buttons
  const newSelectionBtn = document.getElementById('newSelectionBtn');
  const undoSelectionBtn = document.getElementById('undoSelectionBtn');

  if (newSelectionBtn) {
    newSelectionBtn.addEventListener('click', resetToSelectionMode);
  }

  if (undoSelectionBtn) {
    undoSelectionBtn.addEventListener('click', undoLastSelection);
  }

  // Management Event Listeners
  setupManagementEventListeners();
}

async function handleBigPlayClick() {
  try {
    const listId = document.getElementById('quickListSelect').value;
    const prizeId = document.getElementById('quickPrizeSelect').value;
    const winnersCount = parseInt(document.getElementById('quickWinnersCount').value);
    const displayMode = document.getElementById('quickDisplayMode').value;

    if (!listId || !prizeId) {
      showToast('Please select both a list and a prize', 'warning');
      return;
    }

    if (winnersCount < 1) {
      showToast('Please enter a valid number of winners', 'warning');
      return;
    }

    // Load the selected list and prize
    const list = await getList(listId);
    const prizes = await getAllPrizes();
    const selectedPrize = prizes.find(p => p.prizeId === prizeId);

    if (!list || !selectedPrize) {
      showToast('Selected list or prize not found', 'error');
      return;
    }

    if (selectedPrize.quantity < winnersCount) {
      showToast(`Not enough prizes available. Only ${selectedPrize.quantity} remaining.`, 'warning');
      return;
    }

    if (list.entries.length < winnersCount) {
      showToast(`Not enough entries in list. Only ${list.entries.length} available.`, 'warning');
      return;
    }

    // Set current list for global access
    currentList = list;

    if (displayMode === 'countdown') {
      showCountdown(winnersCount, selectedPrize);
    } else {
      await selectWinners(winnersCount, selectedPrize, displayMode);
    }
  } catch (error) {
    console.error('Error in big play click:', error);
    showToast('Error selecting winners: ' + error.message, 'error');
  }
}

function showCountdown(winnersCount, selectedPrize) {
  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownNumber = document.getElementById('countdownNumber');

  countdownOverlay.classList.remove('d-none');

  let count = settings.countdownDuration || 3;
  countdownNumber.textContent = count;

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownNumber.textContent = count;
      if (settings.enableSoundEffects) {
        playSound('countdown');
      }
    } else {
      clearInterval(interval);
      countdownOverlay.classList.add('d-none');
      selectWinners(winnersCount, selectedPrize, 'all-at-once');
    }
  }, 1000);
}

async function selectWinners(numWinners, selectedPrize, displayMode) {
  try {
    showProgress('Selecting Winners', 'Preparing random selection...');

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
        entries: currentList.entries,
        numWinners: numWinners,
        seed: Date.now()
      });
    });

    updateProgress(50, 'Creating winner records...');

    // Create winner records
    const winners = selectedEntries.map((entry, index) => ({
      winnerId: generateId(),
      ...entry.data,
      displayName: formatDisplayName(entry, currentList.metadata.nameConfig),
      prize: selectedPrize.name,
      timestamp: Date.now(),
      originalEntry: entry,
      listId: currentList.listId || currentList.metadata.listId,
      position: index + 1
    }));

    updateProgress(75, 'Saving winners...');

    // Save winners
    for (const winner of winners) {
      await saveWinner(winner);
    }

    // Update prize quantity
    selectedPrize.quantity -= numWinners;
    await savePrize(selectedPrize);

    // Save history
    const historyId = generateId(8);
    const historyEntry = {
      historyId: historyId, // Key at root level for IndexedDB
      listId: currentList.listId || currentList.metadata.listId,
      listName: currentList.metadata.name,
      prize: selectedPrize.name,
      winners: winners.map(w => ({ winnerId: w.winnerId, displayName: w.displayName })),
      timestamp: Date.now()
    };
    await saveHistory(historyEntry);

    // Store last action for undo
    lastAction = {
      type: 'selectWinners',
      winners: winners,
      removedEntries: selectedEntries,
      prizeId: selectedPrize.prizeId,
      prizeCount: numWinners,
      historyId: historyEntry.historyId
    };

    // Remove winners from list if setting is enabled
    if (settings.preventDuplicates) {
      currentList.entries = currentList.entries.filter(entry =>
        !selectedEntries.some(selected => selected.id === entry.id)
      );
      // Ensure the list has the required listId at root level
      if (!currentList.listId && currentList.metadata && currentList.metadata.listId) {
        currentList.listId = currentList.metadata.listId;
      }
      await saveList(currentList);
    }

    updateProgress(100, 'Winners selected!');

    setTimeout(() => {
      hideProgress();
      displayWinnersPublicly(winners, selectedPrize, displayMode);

      // Update the winners list in management interface
      loadWinners();
      loadHistory();
      updateHistoryStats();

      if (settings.enableSoundEffects) {
        playSound('winner');
      }
    }, 500);

  } catch (error) {
    hideProgress();
    console.error('Error selecting winners:', error);
    showToast('Error selecting winners: ' + error.message, 'error');
    resetToSelectionMode();
  }
}

function displayWinnersPublicly(winners, prize, displayMode) {
  // Show prize display
  const prizeDisplay = document.getElementById('prizeDisplay');
  document.getElementById('displayPrizeName').textContent = prize.name;
  document.getElementById('displayPrizeSubtitle').textContent = `${winners.length} Winner${winners.length > 1 ? 's' : ''}`;
  prizeDisplay.classList.remove('d-none');

  // Show winners in grid
  const winnersGrid = document.getElementById('winnersGrid');
  winnersGrid.innerHTML = '';

  winners.forEach((winner, index) => {
    const winnerCard = document.createElement('div');
    winnerCard.className = 'winner-card';

    if (displayMode === 'sequential') {
      winnerCard.style.animationDelay = `${(index + 1) * 0.5}s`;
    }

    winnerCard.innerHTML = `
      <div class="winner-number">${winner.position}</div>
      <div class="winner-name">${winner.displayName}</div>
      <div class="winner-details">${getWinnerDetails(winner)}</div>
    `;

    winnersGrid.appendChild(winnerCard);
  });

  winnersGrid.classList.remove('d-none');

  // Show action buttons
  document.getElementById('actionButtons').classList.remove('d-none');
}

function getWinnerDetails(winner) {
  // Try to show some relevant details about the winner
  const details = [];

  // Common fields to display
  const fieldsToShow = ['email', 'phone', 'department', 'id', 'employee_id', 'member_id'];

  for (const field of fieldsToShow) {
    if (winner[field]) {
      details.push(`${field.toUpperCase()}: ${winner[field]}`);
      break; // Only show first available detail
    }
  }

  return details.length > 0 ? details[0] : 'Winner Selected';
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

function resetToSelectionMode() {
  // Show selection controls
  return 'Unknown';
}

function resetToSelectionMode() {
  // Show selection controls
  document.getElementById('selectionControls').classList.remove('d-none');

  // Hide prize display and winners
  document.getElementById('prizeDisplay').classList.add('d-none');
  document.getElementById('winnersGrid').classList.add('d-none');
  document.getElementById('actionButtons').classList.add('d-none');

  // Refresh the dropdowns in case data changed
  populateQuickSelects();
}

async function undoLastSelection() {
  if (!lastAction || lastAction.type !== 'selectWinners') {
    showToast('No recent selection to undo', 'warning');
    return;
  }

  try {
    showProgress('Undoing Selection', 'Reversing last selection...');

    // Delete winners
    for (const winner of lastAction.winners) {
      await deleteWinner(winner.winnerId);
    }

    // Restore prize quantity
    const prizes = await getAllPrizes();
    const prize = prizes.find(p => p.prizeId === lastAction.prizeId);
    if (prize) {
      prize.quantity += lastAction.prizeCount;
      await savePrize(prize);
    }

    // Delete history entry
    await deleteHistory(lastAction.historyId);

    // Restore entries to list if they were removed
    if (settings.preventDuplicates && currentList) {
      currentList.entries.push(...lastAction.removedEntries);
      // Ensure the list has the required listId at root level
      if (!currentList.listId && currentList.metadata && currentList.metadata.listId) {
        currentList.listId = currentList.metadata.listId;
      }
      await saveList(currentList);
    }

    hideProgress();
    showToast('Selection undone successfully', 'success');

    // Update the winners list in management interface
    loadWinners();
    loadHistory();
    updateHistoryStats();

    // Reset interface
    resetToSelectionMode();

    // Clear last action
    lastAction = null;

  } catch (error) {
    hideProgress();
    console.error('Error undoing selection:', error);
    showToast('Error undoing selection: ' + error.message, 'error');
  }
}

// Sound Effects
function playSound(type) {
  if (!settings.enableSoundEffects) return;

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    if (type === 'countdown') {
      playBeep(audioContext, 800, 100);
    } else if (type === 'winner') {
      playChord(audioContext);
    }
  } catch (error) {
    console.warn('Could not play sound:', error);
  }
}

function playBeep(audioContext, frequency, duration) {
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
}

function playChord(audioContext) {
  const frequencies = [523.25, 659.25, 783.99]; // C, E, G
  const duration = 1000;

  frequencies.forEach(freq => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
  });
}

// Management Event Listeners
function setupManagementEventListeners() {
  // CSV Upload
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', handleCSVUpload);
  }

  // Prize Management
  const addPrizeBtn = document.getElementById('addPrizeBtn');
  if (addPrizeBtn) {
    addPrizeBtn.addEventListener('click', handleAddPrize);
  }

  // Settings
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', handleSaveSettings);
  }

  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Backup/Restore
  const backupData = document.getElementById('backupData');
  const restoreData = document.getElementById('restoreData');

  if (backupData) {
    backupData.addEventListener('click', handleBackupData);
  }

  if (restoreData) {
    restoreData.addEventListener('click', handleRestoreData);
  }

  // Preview buttons
  const confirmUpload = document.getElementById('confirmUpload');
  const cancelUpload = document.getElementById('cancelUpload');

  if (confirmUpload) {
    confirmUpload.addEventListener('click', handleConfirmUpload);
  }

  if (cancelUpload) {
    cancelUpload.addEventListener('click', handleCancelUpload);
  }

  // Save name configuration button
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', handleSaveNameConfig);
  }
}

// Global variable to store parsed CSV data for preview
let pendingCSVData = null;

// CSV Upload Handler - now shows preview first
async function handleCSVUpload() {
  const listNameInput = document.getElementById('listName');
  const csvFileInput = document.getElementById('csvFile');

  const listName = listNameInput.value.trim();
  const csvFile = csvFileInput.files[0];

  if (!listName) {
    showToast('Please enter a list name', 'warning');
    return;
  }

  if (!csvFile) {
    showToast('Please select a CSV file', 'warning');
    return;
  }

  try {
    showProgress('Processing CSV', 'Reading file...');

    const csvText = await readFileAsText(csvFile);
    const { data, errors } = parseCSV(csvText);

    if (errors.length > 0) {
      throw new Error('CSV parsing errors: ' + errors.join(', '));
    }

    if (data.length === 0) {
      throw new Error('CSV file appears to be empty');
    }

    hideProgress();

    // Store the parsed data for later use
    pendingCSVData = {
      listName: listName,
      fileName: csvFile.name,
      data: data
    };

    // Show preview of first 10 records
    showCSVPreview(data, listName);

  } catch (error) {
    hideProgress();
    console.error('CSV upload error:', error);
    showToast('Error processing CSV: ' + error.message, 'error');
  }
}

// Show CSV preview with first 10 records
function showCSVPreview(data, listName) {
  const previewCard = document.getElementById('dataPreviewCard');
  const previewHeaders = document.getElementById('previewHeaders');
  const previewBody = document.getElementById('previewBody');
  
  // Show preview card
  previewCard.style.display = 'block';
  
  // Get headers from first row
  const headers = Object.keys(data[0]);
  
  // Create table headers
  previewHeaders.innerHTML = '<tr>' + 
    headers.map(header => `<th>${header}</th>`).join('') + 
    '</tr>';
  
  // Show first 10 records (or less if fewer available)
  const previewData = data.slice(0, 10);
  
  previewBody.innerHTML = previewData.map(row => 
    '<tr>' + 
    headers.map(header => `<td>${row[header] || ''}</td>`).join('') + 
    '</tr>'
  ).join('');
  
  // Update preview title
  const previewTitle = document.querySelector('#dataPreviewCard .card-title');
  previewTitle.textContent = `Data Preview - "${listName}" (${data.length} total records, showing first ${previewData.length})`;
  
  // Show the name configuration for the uploaded data
  showNameConfiguration(headers, data[0]);
  
  // Scroll to preview
  previewCard.scrollIntoView({ behavior: 'smooth' });
  
  showToast(`Preview ready! Showing first ${previewData.length} of ${data.length} records`, 'info');
}

// Show name configuration for uploaded CSV
function showNameConfiguration(headers, firstRow) {
  const nameConfigCard = document.getElementById('nameConfigCard');
  const availableFields = document.getElementById('availableFields');
  const nameTemplateInput = document.getElementById('nameTemplate');
  const namePreview = document.getElementById('namePreview');

  nameConfigCard.style.display = 'block';
  availableFields.innerHTML = '';

  // Create clickable field buttons
  headers.forEach(header => {
    const fieldBtn = document.createElement('button');
    fieldBtn.className = 'btn btn-sm btn-outline-secondary';
    fieldBtn.textContent = header;
    fieldBtn.onclick = () => {
      const cursorPos = nameTemplateInput.selectionStart;
      const text = nameTemplateInput.value;
      const placeholder = `{${header}}`;
      nameTemplateInput.value = text.slice(0, cursorPos) + placeholder + text.slice(cursorPos);
      nameTemplateInput.focus();
      updatePreview();
    };
    availableFields.appendChild(fieldBtn);
  });

  // Set a default template
  const defaultTemplate = headers.length > 1 ? `{${headers[0]}} {${headers[1]}}` : `{${headers[0]}}`;
  nameTemplateInput.value = defaultTemplate;

  // Function to update the preview
  function updatePreview() {
    const template = nameTemplateInput.value;
    const previewText = template.replace(/\{([^}]+)\}/g, (match, key) => {
      return firstRow[key] || '';
    });
    namePreview.textContent = previewText;
  }

  // Initial preview
  updatePreview();

  // Update preview on input
  nameTemplateInput.addEventListener('input', updatePreview);
}


function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function parseCSV(csvText) {
  // Simple CSV parser
  const lines = csvText.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return { data: [], errors: ['Empty file'] };
  }

  const headers = parseCSVLine(lines[0]);
  const data = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      if (values.length > 0) {
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index]?.trim() || '';
        });
        data.push(row);
      }
    } catch (error) {
      errors.push(`Line ${i + 1}: ${error.message}`);
    }
  }

  return { data, errors };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// Prize Management
async function handleAddPrize() {
  const prizeNameInput = document.getElementById('prizeName');
  const prizeQuantityInput = document.getElementById('prizeQuantity');
  const prizeDescriptionInput = document.getElementById('prizeDescription');

  const name = prizeNameInput.value.trim();
  const quantity = parseInt(prizeQuantityInput.value);
  const description = prizeDescriptionInput.value.trim();

  if (!name) {
    showToast('Please enter a prize name', 'warning');
    return;
  }

  if (quantity < 1) {
    showToast('Please enter a valid quantity', 'warning');
    return;
  }

  try {
    const prize = {
      prizeId: generateId(),
      name: name,
      quantity: quantity,
      description: description,
      timestamp: Date.now()
    };

    await savePrize(prize);

    showToast(`Prize "${name}" added successfully`, 'success');

    // Clear form
    prizeNameInput.value = '';
    prizeQuantityInput.value = '1';
    prizeDescriptionInput.value = '';

    // Refresh displays
    await loadPrizes();
    await populateQuickSelects();

  } catch (error) {
    console.error('Error adding prize:', error);
    showToast('Error adding prize: ' + error.message, 'error');
  }
}

// Settings Management
async function handleSaveSettings() {
  try {
    // Collect settings from form
    const settingsForm = {
      displayMode: document.getElementById('displayMode')?.value || settings.displayMode,
      displayDuration: parseInt(document.getElementById('displayDuration')?.value) || settings.displayDuration,
      countdownDuration: parseInt(document.getElementById('countdownDuration')?.value) || settings.countdownDuration,
      preventDuplicates: document.getElementById('preventDuplicates')?.checked || settings.preventDuplicates,
      enableSoundEffects: document.getElementById('enableSoundEffects')?.checked || settings.enableSoundEffects,
      hideEntryCounts: document.getElementById('hideEntryCounts')?.checked || settings.hideEntryCounts,
      fontFamily: document.getElementById('fontFamily')?.value || settings.fontFamily,
      primaryColor: document.getElementById('primaryColor')?.value || settings.primaryColor,
      secondaryColor: document.getElementById('secondaryColor')?.value || settings.secondaryColor,
      backgroundType: document.getElementById('backgroundType')?.value || settings.backgroundType
    };

    // Update global settings
    Object.assign(settings, settingsForm);

    // Save to database
    await saveSettings();

    // Apply theme changes
    applyTheme();

    // Update interface based on new settings
    await populateQuickSelects();
    applyVisibilitySettings();

    showToast('Settings saved successfully', 'success');

  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Error saving settings: ' + error.message, 'error');
  }
}

// Theme Management
function setupTheme() {
  applyTheme();
  loadSettingsToForm();
}

function applyTheme() {
  const root = document.documentElement;

  root.style.setProperty('--primary-color', settings.primaryColor);
  root.style.setProperty('--secondary-color', settings.secondaryColor);
  root.style.setProperty('--font-family', settings.fontFamily);

  // Update gradient
  const gradient = `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)`;
  root.style.setProperty('--gradient-bg', gradient);

  // Apply font family
  document.body.style.fontFamily = `'${settings.fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
}

function loadSettingsToForm() {
  // Load current settings into form fields
  const settingsFields = {
    'displayMode': settings.displayMode,
    'displayDuration': settings.displayDuration,
    'countdownDuration': settings.countdownDuration,
    'preventDuplicates': settings.preventDuplicates,
    'enableSoundEffects': settings.enableSoundEffects,
    'hideEntryCounts': settings.hideEntryCounts,
    'fontFamily': settings.fontFamily,
    'primaryColor': settings.primaryColor,
    'secondaryColor': settings.secondaryColor,
    'backgroundType': settings.backgroundType
  };

  for (const [fieldId, value] of Object.entries(settingsFields)) {
    const element = document.getElementById(fieldId);
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = value;
      } else {
        element.value = value;
      }
    }
  }
}

function toggleTheme() {
  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const currentTheme = body.getAttribute('data-theme');

  if (currentTheme === 'dark') {
    body.setAttribute('data-theme', 'light');
    themeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
  } else {
    body.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
  }
}

// Backup and Restore
async function handleBackupData() {
  try {
    showProgress('Creating Backup', 'Collecting data...');

    const backupData = {
      version: '1.0',
      timestamp: Date.now(),
      lists: await getAllLists(),
      prizes: await getAllPrizes(),
      winners: await getAllWinners(),
      history: await getAllHistory(),
      settings: settings
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winner-app-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    hideProgress();
    showToast('Backup created successfully', 'success');

  } catch (error) {
    hideProgress();
    console.error('Error creating backup:', error);
    showToast('Error creating backup: ' + error.message, 'error');
  }
}

function handleRestoreData() {
  const input = document.getElementById('restoreFileInput');
  if (input) {
    input.click();
    input.onchange = processRestoreFile;
  }
}

async function processRestoreFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    showProgress('Restoring Data', 'Reading backup file...');

    const jsonText = await readFileAsText(file);
    const backupData = JSON.parse(jsonText);

    if (!backupData.version) {
      throw new Error('Invalid backup file format');
    }

    updateProgress(25, 'Restoring lists...');
    if (backupData.lists) {
      for (const list of backupData.lists) {
        await saveList(list);
      }
    }

    updateProgress(50, 'Restoring prizes...');
    if (backupData.prizes) {
      for (const prize of backupData.prizes) {
        await savePrize(prize);
      }
    }

    updateProgress(75, 'Restoring winners and history...');
    if (backupData.winners) {
      for (const winner of backupData.winners) {
        await saveWinner(winner);
      }
    }

    if (backupData.history) {
      for (const historyEntry of backupData.history) {
        await saveHistory(historyEntry);
      }
    }

    if (backupData.settings) {
      Object.assign(settings, backupData.settings);
      await saveSettings();
      applyTheme();
      loadSettingsToForm();
    }

    updateProgress(100, 'Finalizing...');

    setTimeout(async () => {
      hideProgress();
      showToast('Data restored successfully', 'success');

      // Refresh all displays
      await initializeApp();
    }, 500);

  } catch (error) {
    hideProgress();
    console.error('Error restoring data:', error);
    showToast('Error restoring data: ' + error.message, 'error');
  }

  // Clear the input
  event.target.value = '';
}

// History Stats
async function updateHistoryStats() {
  try {
    const history = await getAllHistory();
    const winners = await getAllWinners();

    const totalSelections = history.length;
    const totalWinners = winners.length;
    const averageWinners = totalSelections > 0 ? Math.round(totalWinners / totalSelections * 10) / 10 : 0;

    // Find most used prize
    const prizeCount = {};
    history.forEach(entry => {
      prizeCount[entry.prize] = (prizeCount[entry.prize] || 0) + 1;
    });

    const mostUsedPrize = Object.keys(prizeCount).reduce((a, b) =>
      prizeCount[a] > prizeCount[b] ? a : b, '-'
    );

    // Update displays
    const statsElements = {
      'totalSelections': totalSelections,
      'totalWinners': totalWinners,
      'averageWinners': averageWinners,
      'mostUsedPrize': mostUsedPrize
    };

    for (const [id, value] of Object.entries(statsElements)) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    }

  } catch (error) {
    console.error('Error updating history stats:', error);
  }
}

// Utility functions for Management
async function viewList(listId) {
  try {
    const list = await getList(listId);
    if (list) {
      // Create a modal or alert to show list details
      const entriesPreview = list.entries.slice(0, 5).map(entry =>
        Object.values(entry.data).join(', ')
      ).join('\n');

      alert(`List: ${list.metadata.name}\nEntries: ${list.entries.length}\nFirst 5 entries:\n${entriesPreview}${list.entries.length > 5 ? '\n...' : ''}`);
    }
  } catch (error) {
    console.error('Error viewing list:', error);
    showToast('Error viewing list: ' + error.message, 'error');
  }
}

// New Modal Helper Function
function showConfirmationModal(title, message, onConfirm) {
  const modalTitle = document.getElementById('appModalLabel');
  const modalBody = document.getElementById('appModalBody');
  const confirmBtn = document.getElementById('appModalConfirmBtn');
  const cancelBtn = document.querySelector('#appModal .modal-footer .btn-secondary');

  modalTitle.textContent = title;
  modalBody.innerHTML = `<p>${message}</p>`;
  confirmBtn.textContent = 'Confirm';
  confirmBtn.className = 'btn btn-danger';
  confirmBtn.style.display = 'inline-block';
  cancelBtn.textContent = 'Cancel';

  // This pattern removes old listeners and adds a new one to prevent multiple executions
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', async () => {
    try {
      await onConfirm(); // Await the async operation before hiding
    } catch (error) {
      console.error(`Error in confirmation modal for "${title}":`, error);
      showToast(`Operation failed: ${error.message}`, 'error');
    } finally {
      appModal.hide(); // Hide modal only after the operation is complete
    }
  }, { once: true });

  appModal.show();
}

async function viewList(listId) {
  try {
    const list = await getList(listId);
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

      appModal.show();
    }
  } catch (error) {
    console.error('Error viewing list:', error);
    showToast('Error viewing list: ' + error.message, 'error');
  }
}

async function deleteListConfirm(listId) {
  showConfirmationModal(
    'Delete List',
    'Are you sure you want to delete this list? This action cannot be undone.',
    async () => {
      await deleteList(listId);
      showToast('List deleted successfully', 'success');
      await loadLists();
      await populateQuickSelects();
    }
  );
}

async function editPrize(prizeId) {
  const prizes = await getAllPrizes();
  const prize = prizes.find(p => p.prizeId === prizeId);
  if (!prize) return;

  const modalTitle = document.getElementById('appModalLabel');
  const modalBody = document.getElementById('appModalBody');
  const confirmBtn = document.getElementById('appModalConfirmBtn');

  modalTitle.textContent = 'Edit Prize';
  modalBody.innerHTML = `
    <div class="mb-3">
      <label for="modalPrizeName" class="form-label">Prize Name</label>
      <input type="text" class="form-control" id="modalPrizeName" value="${prize.name}">
    </div>
  `;
  confirmBtn.textContent = 'Save Changes';
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.style.display = 'inline-block';

  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', async () => {
    const newName = document.getElementById('modalPrizeName').value.trim();
    if (newName) {
      prize.name = newName;
      await savePrize(prize);
      showToast('Prize updated successfully', 'success');
      await loadPrizes();
      await populateQuickSelects();
      appModal.hide();
    } else {
      showToast('Prize name cannot be empty.', 'warning');
    }
  }, { once: true });

  appModal.show();
}

async function deletePrizeConfirm(prizeId) {
  showConfirmationModal('Delete Prize', 'Are you sure you want to delete this prize?', async () => {
    await deletePrize(prizeId);
    showToast('Prize deleted successfully', 'success');
    await loadPrizes();
    await populateQuickSelects();
  });
}

async function deleteWinnerConfirm(winnerId) {
  showConfirmationModal('Delete Winner', 'Are you sure you want to delete this winner record?', async () => {
    await deleteWinner(winnerId);
    showToast('Winner deleted successfully', 'success');
    await loadWinners();
  });
}

async function deleteHistoryConfirm(historyId) {
  showConfirmationModal('Delete History Entry', 'Are you sure you want to delete this history entry?', async () => {
    await deleteHistory(historyId);
    showToast('History entry deleted successfully', 'success');
    await loadHistory();
    await updateHistoryStats();
  });
}

// Handle confirm upload after preview
async function handleConfirmUpload() {
  if (!pendingCSVData) {
    showToast('No data to upload', 'error');
    return;
  }

  try {
    showProgress('Uploading List', 'Creating list...');

    // Use saved name configuration or get current one
    const nameConfig = getNameConfiguration();

    // Create list data structure
    const listId = generateId();
    const listData = {
      listId: listId, // Key at root level for IndexedDB
      metadata: {
        listId: listId,
        name: pendingCSVData.listName,
        timestamp: Date.now(),
        originalFilename: pendingCSVData.fileName,
        entryCount: pendingCSVData.data.length,
        nameConfig: nameConfig // Save name configuration
      },
      entries: pendingCSVData.data.map((row, index) => ({
        id: generateId(),
        index: index,
        data: row
      }))
    };

    updateProgress(90, 'Saving list...');

    await saveList(listData);

    hideProgress();
    showToast(`List "${pendingCSVData.listName}" uploaded successfully with ${pendingCSVData.data.length} entries`, 'success');

    // Clear form and hide preview
    document.getElementById('listName').value = '';
    document.getElementById('csvFile').value = '';
    handleCancelUpload(); // Use cancel function to reset UI
    
    // Clear pending data
    pendingCSVData = null;

    // Refresh displays
    await loadLists();
    await populateQuickSelects();

  } catch (error) {
    hideProgress();
    console.error('Error confirming upload:', error);
    showToast('Error uploading list: ' + error.message, 'error');
  }
}

// Get name configuration from UI
function getNameConfiguration() {
  const nameTemplateInput = document.getElementById('nameTemplate');
  return nameTemplateInput.value.trim();
}

// Handle cancel upload
function handleCancelUpload() {
  // Hide preview card
  document.getElementById('dataPreviewCard').style.display = 'none';
  document.getElementById('nameConfigCard').style.display = 'none';
  
  // Clear pending data
  pendingCSVData = null;
  
  showToast('Upload cancelled', 'info');
}