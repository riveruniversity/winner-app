// Global state
let db = null;
let currentList = null;
let lastAction = null;
let csvWorker = null;
let randomWorker = null;
let settings = {
    displayDuration: 3,
    preventDuplicates: false,
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6'
};

// Web Workers Setup
function createCSVWorker() {
    const workerCode = `
        function parseCSV(csvText) {
            const lines = csvText.split('\\n').filter(line => line.trim());
            if (lines.length === 0) return { headers: [], data: [] };
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                const row = {};
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                data.push(row);
                
                // Report progress
                if (i % 1000 === 0) {
                    self.postMessage({ type: 'progress', processed: i, total: lines.length - 1 });
                }
            }
            
            return { headers, data };
        }
        
        self.onmessage = function(e) {
            if (e.data.type === 'parse') {
                try {
                    const result = parseCSV(e.data.csvText);
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

function createRandomWorker() {
    const workerCode = `
        function generateId(length = 5) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }
        
        function selectRandomWinners(entries, numWinners, seed) {
            // Use seed for reproducible randomness if needed
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
        const request = indexedDB.open('WinnerSelectionApp', 2);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Clear existing stores if they exist
            const storeNames = ['lists', 'entries', 'winners', 'prizes', 'settings', 'history'];
            storeNames.forEach(storeName => {
                if (db.objectStoreNames.contains(storeName)) {
                    db.deleteObjectStore(storeName);
                }
            });
            
            // Lists store
            const listsStore = db.createObjectStore('lists', { keyPath: 'listId' });
            
            // Entries store
            const entriesStore = db.createObjectStore('entries', { keyPath: 'id' });
            entriesStore.createIndex('listId', 'listId', { unique: false });
            
            // Winners store
            const winnersStore = db.createObjectStore('winners', { keyPath: 'winnerId' });
            
            // Prizes store
            const prizesStore = db.createObjectStore('prizes', { keyPath: 'prizeId' });
            
            // Settings store
            const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
            
            // History store for selection history
            const historyStore = db.createObjectStore('history', { keyPath: 'historyId' });
            historyStore.createIndex('listId', 'listId', { unique: false });
            historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        };
    });
}

// Utility functions
function generateId(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function showToast(message, type = 'info') {
    const bgColors = {
        success: 'linear-gradient(to right, #00b09b, #96c93d)',
        error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
        warning: 'linear-gradient(to right, #f093fb, #f5576c)',
        info: 'linear-gradient(to right, #4facfe, #00f2fe)'
    };

    Toastify({
        text: message,
        duration: 3000,
        style: {
            background: bgColors[type] || bgColors.info,
        },
        stopOnFocus: true,
    }).showToast();
}

function confirmAction(message) {
    return new Promise((resolve) => {
        const result = confirm(message);
        resolve(result);
    });
}

// Enhanced Database operations with proper async handling
function dbOperation(stores, mode, operation) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(stores, mode);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        
        try {
            const result = operation(transaction);
            if (result instanceof Promise) {
                result.then(resolve).catch(reject);
            } else {
                resolve(result);
            }
        } catch (error) {
            reject(error);
        }
    });
}

async function saveList(listData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['lists', 'entries'], 'readwrite');
        const listsStore = transaction.objectStore('lists');
        const entriesStore = transaction.objectStore('entries');
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        
        listsStore.put(listData.metadata);
        
        listData.entries.forEach(entry => {
            entriesStore.put(entry);
        });
    });
}

async function getList(listId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['lists', 'entries'], 'readonly');
        const listsStore = transaction.objectStore('lists');
        const entriesStore = transaction.objectStore('entries');
        
        const metadataRequest = listsStore.get(listId);
        
        metadataRequest.onsuccess = () => {
            const metadata = metadataRequest.result;
            if (!metadata) {
                resolve(null);
                return;
            }
            
            const entriesRequest = entriesStore.index('listId').getAll(listId);
            entriesRequest.onsuccess = () => {
                resolve({ metadata, entries: entriesRequest.result });
            };
            entriesRequest.onerror = () => reject(entriesRequest.error);
        };
        
        metadataRequest.onerror = () => reject(metadataRequest.error);
    });
}

async function getAllLists() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['lists'], 'readonly');
        const store = transaction.objectStore('lists');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function deleteList(listId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['lists', 'entries'], 'readwrite');
        const listsStore = transaction.objectStore('lists');
        const entriesStore = transaction.objectStore('entries');
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        
        listsStore.delete(listId);
        
        const entriesRequest = entriesStore.index('listId').getAll(listId);
        entriesRequest.onsuccess = () => {
            entriesRequest.result.forEach(entry => {
                entriesStore.delete(entry.id);
            });
        };
    });
}

async function saveWinner(winner) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['winners'], 'readwrite');
        const store = transaction.objectStore('winners');
        const request = store.put(winner);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllWinners() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['winners'], 'readonly');
        const store = transaction.objectStore('winners');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function deleteWinner(winnerId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['winners'], 'readwrite');
        const store = transaction.objectStore('winners');
        const request = store.delete(winnerId);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function clearAllWinners() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['winners'], 'readwrite');
        const store = transaction.objectStore('winners');
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function savePrize(prize) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['prizes'], 'readwrite');
        const store = transaction.objectStore('prizes');
        const request = store.put(prize);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllPrizes() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['prizes'], 'readonly');
        const store = transaction.objectStore('prizes');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function deletePrize(prizeId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['prizes'], 'readwrite');
        const store = transaction.objectStore('prizes');
        const request = store.delete(prizeId);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function saveSettings(settingsData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        const request = store.put({ key: 'appSettings', ...settingsData });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function loadSettings() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.get('appSettings');
        
        request.onsuccess = () => resolve(request.result || settings);
        request.onerror = () => reject(request.error);
    });
}

// History functions
async function saveHistory(historyEntry) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        const request = store.put(historyEntry);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllHistory() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const results = request.result || [];
            // Sort by timestamp descending
            results.sort((a, b) => b.timestamp - a.timestamp);
            resolve(results);
        };
        request.onerror = () => reject(request.error);
    });
}

async function getHistoryByList(listId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');
        const index = store.index('listId');
        const request = index.getAll(listId);
        
        request.onsuccess = () => {
            const results = request.result || [];
            results.sort((a, b) => b.timestamp - a.timestamp);
            resolve(results);
        };
        request.onerror = () => reject(request.error);
    });
}

// CSV functions
function exportToCSV(data, filename) {
    if (data.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// UI functions
async function loadLists() {
    try {
        const lists = await getAllLists();
        const select = document.getElementById('currentListSelect');
        const historyFilter = document.getElementById('historyListFilter');
        const savedListsDiv = document.getElementById('savedLists');
        
        select.innerHTML = '<option value="">Select a list...</option>';
        historyFilter.innerHTML = '<option value="">All Lists</option>';
        
        if (lists.length === 0) {
            savedListsDiv.innerHTML = '<p class="text-muted">No lists saved yet</p>';
            return;
        }
        
        lists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.listId;
            option.textContent = list.name;
            select.appendChild(option);
            
            const historyOption = option.cloneNode(true);
            historyFilter.appendChild(historyOption);
        });
        
        savedListsDiv.innerHTML = lists.map(list => `
            <div class="d-flex justify-content-between align-items-center p-3 border rounded mb-2">
                <div>
                    <h6 class="mb-1">${list.name}</h6>
                    <small class="text-muted">${list.totalEntries} entries • ${new Date(list.timestamp).toLocaleDateString()}</small>
                </div>
                <button class="btn btn-outline-danger btn-sm" onclick="deleteListAction('${list.listId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading lists:', error);
        showToast('Error loading lists', 'error');
    }
}

async function loadPrizes() {
    try {
        const prizes = await getAllPrizes();
        const prizeSelect = document.getElementById('prizeSelect');
        const prizesList = document.getElementById('prizesList');
        
        prizeSelect.innerHTML = '<option value="">Select a prize...</option>';
        
        if (prizes.length === 0) {
            prizesList.innerHTML = '<p class="text-muted">No prizes added yet</p>';
            return;
        }
        
        prizes.forEach(prize => {
            if (prize.quantity > 0) {
                const option = document.createElement('option');
                option.value = prize.prizeId;
                option.textContent = `${prize.name} (${prize.quantity} available)`;
                prizeSelect.appendChild(option);
            }
        });
        
        prizesList.innerHTML = prizes.map(prize => `
            <div class="d-flex justify-content-between align-items-center p-3 border rounded mb-2">
                <div>
                    <h6 class="mb-1">${prize.name}</h6>
                    <small class="text-muted">Quantity: ${prize.quantity}</small>
                </div>
                <button class="btn btn-outline-danger btn-sm" onclick="deletePrizeAction('${prize.prizeId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading prizes:', error);
        showToast('Error loading prizes', 'error');
    }
}

async function loadWinners() {
    try {
        const winners = await getAllWinners();
        const tableBody = document.getElementById('winnersTableBody');
        
        if (winners.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No winners yet</td></tr>';
            return;
        }
        
        tableBody.innerHTML = winners.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map(winner => `
            <tr>
                <td><strong>${winner.winnerId}</strong></td>
                <td>${winner.displayName}</td>
                <td><span class="badge bg-success">${winner.prize}</span></td>
                <td>${new Date(winner.timestamp).toLocaleString()}</td>
                <td>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteWinnerAction('${winner.winnerId}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading winners:', error);
        showToast('Error loading winners', 'error');
    }
}

async function loadHistory(listFilter = '') {
    try {
        const history = listFilter ? await getHistoryByList(listFilter) : await getAllHistory();
        const winners = await getAllWinners();
        const lists = await getAllLists();
        
        // Calculate statistics
        const totalSelections = history.length;
        const totalWinners = winners.length;
        const averageWinners = totalSelections > 0 ? (totalWinners / totalSelections).toFixed(1) : 0;
        
        // Find most used prize
        const prizeCounts = {};
        history.forEach(entry => {
            prizeCounts[entry.prize] = (prizeCounts[entry.prize] || 0) + 1;
        });
        const mostUsedPrize = Object.keys(prizeCounts).length > 0 
            ? Object.keys(prizeCounts).reduce((a, b) => prizeCounts[a] > prizeCounts[b] ? a : b)
            : '-';
        
        // Update statistics
        document.getElementById('totalSelections').textContent = totalSelections;
        document.getElementById('totalWinners').textContent = totalWinners;
        document.getElementById('averageWinners').textContent = averageWinners;
        document.getElementById('mostUsedPrize').textContent = mostUsedPrize;
        
        // Update history table
        const tableBody = document.getElementById('historyTableBody');
        
        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No selection history yet</td></tr>';
            return;
        }
        
        tableBody.innerHTML = history.map(entry => {
            const list = lists.find(l => l.listId === entry.listId);
            const listName = list ? list.name : 'Unknown List';
            const winnerNames = entry.winners.map(w => w.displayName).join(', ');
            
            return `
                <tr>
                    <td>${new Date(entry.timestamp).toLocaleString()}</td>
                    <td>${listName}</td>
                    <td><span class="badge bg-primary">${entry.prize}</span></td>
                    <td><span class="badge bg-secondary">${entry.winners.length}</span></td>
                    <td>
                        <small class="text-muted" title="${winnerNames}">
                            ${winnerNames.length > 50 ? winnerNames.substring(0, 50) + '...' : winnerNames}
                        </small>
                    </td>
                    <td>
                        <button class="btn btn-outline-info btn-sm" onclick="viewHistoryDetails('${entry.historyId}')">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Error loading history', 'error');
    }
}

function updateListInfo() {
    const listInfo = document.getElementById('listInfo');
    const selectBtn = document.getElementById('selectWinnersBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    if (currentList && currentList.entries.length > 0) {
        listInfo.textContent = `${currentList.entries.length} entries available`;
        selectBtn.disabled = false;
        fullscreenBtn.disabled = false;
    } else {
        listInfo.textContent = 'No list selected';
        selectBtn.disabled = true;
        fullscreenBtn.disabled = true;
    }
}

// Action functions with Web Workers
async function uploadList() {
    const nameInput = document.getElementById('listName');
    const fileInput = document.getElementById('csvFile');
    
    if (!nameInput.value.trim()) {
        showToast('Please enter a list name', 'warning');
        return;
    }
    
    if (!fileInput.files[0]) {
        showToast('Please select a CSV file', 'warning');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Show progress
    showProgress('Uploading List', 'Reading file...');
    
    try {
        const csvText = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
        
        updateProgress(20, 'Parsing CSV data...');
        
        // Use Web Worker for CSV parsing
        csvWorker = createCSVWorker();
        
        const parseResult = await new Promise((resolve, reject) => {
            csvWorker.onmessage = (e) => {
                if (e.data.type === 'progress') {
                    const progress = 20 + (e.data.processed / e.data.total) * 60;
                    updateProgress(progress, `Processing ${e.data.processed} of ${e.data.total} entries...`);
                } else if (e.data.type === 'complete') {
                    resolve(e.data.result);
                } else if (e.data.type === 'error') {
                    reject(new Error(e.data.error));
                }
            };
            
            csvWorker.postMessage({ type: 'parse', csvText });
        });
        
        const { headers, data } = parseResult;
        
        if (data.length === 0) {
            hideProgress();
            showToast('CSV file is empty', 'error');
            return;
        }
        
        if (data.length > 20000) {
            hideProgress();
            showToast('CSV file has too many entries (max 20,000)', 'error');
            return;
        }
        
        updateProgress(85, 'Saving to database...');
        
        const listId = generateId(8);
        const listData = {
            metadata: {
                listId,
                name: nameInput.value.trim(),
                headers,
                totalEntries: data.length,
                timestamp: Date.now(),
                nameConfig: { columns: [headers[0]], delimiters: [] }
            },
            entries: data.map((row, index) => ({
                id: `${listId}_${index}`,
                listId,
                data: row
            }))
        };
        
        await saveList(listData);
        
        updateProgress(100, 'Upload complete!');
        
        setTimeout(() => {
            hideProgress();
            showToast('List uploaded successfully', 'success');
            
            nameInput.value = '';
            fileInput.value = '';
            
            loadLists();
            showNameConfig(listData.metadata);
        }, 500);
        
    } catch (error) {
        hideProgress();
        console.error('Error uploading list:', error);
        showToast('Error uploading list: ' + error.message, 'error');
    } finally {
        if (csvWorker) {
            csvWorker.terminate();
            csvWorker = null;
        }
    }
}

function showNameConfig(metadata) {
    const configDiv = document.getElementById('nameConfig');
    const selectorsDiv = document.getElementById('columnSelectors');
    const noListMessage = document.getElementById('noListMessage');
    
    configDiv.classList.remove('d-none');
    noListMessage.classList.add('d-none');
    
    selectorsDiv.innerHTML = metadata.headers.map((header, index) => `
        <div class="form-check">
            <input class="form-check-input column-checkbox" type="checkbox" value="${header}" id="col_${index}" ${index === 0 ? 'checked' : ''}>
            <label class="form-check-label" for="col_${index}">${header}</label>
            <input type="text" class="form-control form-control-sm mt-1 delimiter-input" placeholder="Delimiter (e.g., ' - ')" data-column="${header}" ${index === 0 ? 'disabled' : ''}>
        </div>
    `).join('');
    
    // Update delimiter inputs based on checkbox state
    document.querySelectorAll('.column-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const delimiter = document.querySelector(`[data-column="${this.value}"]`);
            delimiter.disabled = !this.checked || this === document.querySelector('.column-checkbox');
        });
    });
    
    // Store current metadata for saving
    configDiv.dataset.listId = metadata.listId;
}

async function saveNameConfig() {
    const configDiv = document.getElementById('nameConfig');
    const listId = configDiv.dataset.listId;
    
    if (!listId) return;
    
    const selectedColumns = Array.from(document.querySelectorAll('.column-checkbox:checked')).map(cb => cb.value);
    const delimiters = [];
    
    for (let i = 1; i < selectedColumns.length; i++) {
        const delimiter = document.querySelector(`[data-column="${selectedColumns[i]}"]`).value || ' ';
        delimiters.push(delimiter);
    }
    
    try {
        // Update the list metadata
        const listData = await getList(listId);
        if (listData) {
            listData.metadata.nameConfig = { columns: selectedColumns, delimiters };
            
            const transaction = db.transaction(['lists'], 'readwrite');
            const store = transaction.objectStore('lists');
            await new Promise((resolve, reject) => {
                const request = store.put(listData.metadata);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            
            showToast('Name configuration saved', 'success');
        }
    } catch (error) {
        console.error('Error saving name config:', error);
        showToast('Error saving configuration', 'error');
    }
}

async function selectCurrentList() {
    const select = document.getElementById('currentListSelect');
    const listId = select.value;
    
    if (!listId) {
        currentList = null;
        updateListInfo();
        return;
    }
    
    try {
        currentList = await getList(listId);
        updateListInfo();
    } catch (error) {
        console.error('Error selecting list:', error);
        showToast('Error loading list', 'error');
    }
}

function formatDisplayName(entry, nameConfig) {
    if (!nameConfig || !nameConfig.columns || nameConfig.columns.length === 0) {
        return Object.values(entry.data)[0] || 'Unknown';
    }
    
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

async function selectWinners() {
    if (!currentList || currentList.entries.length === 0) {
        showToast('No list selected or list is empty', 'warning');
        return;
    }
    
    const numWinners = parseInt(document.getElementById('numWinners').value);
    const prizeSelect = document.getElementById('prizeSelect');
    const selectedPrizeId = prizeSelect.value;
    
    if (!selectedPrizeId) {
        showToast('Please select a prize', 'warning');
        return;
    }
    
    if (numWinners > currentList.entries.length) {
        showToast('Not enough entries for the requested number of winners', 'warning');
        return;
    }
    
    showProgress('Selecting Winners', 'Preparing selection...');
    
    try {
        // Get the selected prize
        const prizes = await getAllPrizes();
        const selectedPrize = prizes.find(p => p.prizeId === selectedPrizeId);
        
        if (!selectedPrize || selectedPrize.quantity < numWinners) {
            hideProgress();
            showToast('Not enough prizes available', 'warning');
            return;
        }
        
        updateProgress(25, 'Random selection in progress...');
        
        // Use Web Worker for random selection
        randomWorker = createRandomWorker();
        
        const selectedEntries = await new Promise((resolve, reject) => {
            randomWorker.onmessage = (e) => {
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
        const winners = selectedEntries.map(entry => ({
            winnerId: generateId(),
            ...entry.data,
            displayName: formatDisplayName(entry, currentList.metadata.nameConfig),
            prize: selectedPrize.name,
            timestamp: Date.now(),
            originalEntry: entry,
            listId: currentList.metadata.listId
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
        const historyEntry = {
            historyId: generateId(8),
            listId: currentList.metadata.listId,
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
            prizeId: selectedPrizeId,
            prizeCount: numWinners,
            historyId: historyEntry.historyId
        };
        
        // Remove winners from list if setting is enabled
        if (settings.preventDuplicates) {
            currentList.entries = currentList.entries.filter(entry => 
                !selectedEntries.some(selected => selected.id === entry.id)
            );
            await saveList(currentList);
        }
        
        updateProgress(100, 'Winners selected!');
        
        setTimeout(() => {
            hideProgress();
            
            // Display winners
            displayWinners(winners, selectedPrize.name);
            
            // Update UI
            loadPrizes();
            loadWinners();
            loadHistory();
            updateListInfo();
            document.getElementById('undoBtn').disabled = false;
            
            showToast(`${numWinners} winner(s) selected!`, 'success');
        }, 500);
        
    } catch (error) {
        hideProgress();
        console.error('Error selecting winners:', error);
        showToast('Error selecting winners: ' + error.message, 'error');
    } finally {
        if (randomWorker) {
            randomWorker.terminate();
            randomWorker = null;
        }
    }
}

function displayWinners(winners, prize) {
    const displayDiv = document.getElementById('winnerDisplay');
    const prizeDiv = document.getElementById('displayPrize');
    const winnersListDiv = document.getElementById('winnersList');
    
    displayDiv.classList.remove('d-none');
    prizeDiv.textContent = prize;
    
    if (winners.length === 1) {
        winnersListDiv.innerHTML = `<div class="winner-name">${winners[0].displayName}</div>`;
    } else {
        winnersListDiv.innerHTML = winners.map((winner, index) => 
            `<div class="winner-name" style="animation-delay: ${index * 0.2}s">${winner.displayName}</div>`
        ).join('');
    }
}

async function undoLastAction() {
    if (!lastAction) return;
    
    const confirmed = await confirmAction('Are you sure you want to undo the last action?');
    if (!confirmed) return;
    
    showProgress('Undoing Action', 'Reversing changes...');
    
    try {
        if (lastAction.type === 'selectWinners') {
            updateProgress(25, 'Removing winners...');
            
            // Remove winners from database
            for (const winner of lastAction.winners) {
                await deleteWinner(winner.winnerId);
            }
            
            updateProgress(50, 'Restoring prize quantity...');
            
            // Restore prize quantity
            const prizes = await getAllPrizes();
            const prize = prizes.find(p => p.prizeId === lastAction.prizeId);
            if (prize) {
                prize.quantity += lastAction.prizeCount;
                await savePrize(prize);
            }
            
            updateProgress(75, 'Restoring list entries...');
            
            // Restore entries to list if they were removed
            if (settings.preventDuplicates && currentList) {
                currentList.entries.push(...lastAction.removedEntries);
                await saveList(currentList);
            }
            
            // Remove history entry
            if (lastAction.historyId) {
                const transaction = db.transaction(['history'], 'readwrite');
                const store = transaction.objectStore('history');
                await new Promise((resolve, reject) => {
                    const request = store.delete(lastAction.historyId);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
            
            updateProgress(100, 'Undo complete!');
            
            setTimeout(() => {
                hideProgress();
                
                // Update UI
                loadPrizes();
                loadWinners();
                loadHistory();
                updateListInfo();
                
                document.getElementById('winnerDisplay').classList.add('d-none');
                document.getElementById('undoBtn').disabled = true;
                
                lastAction = null;
                showToast('Action undone successfully', 'success');
            }, 500);
        }
    } catch (error) {
        hideProgress();
        console.error('Error undoing action:', error);
        showToast('Error undoing action: ' + error.message, 'error');
    }
}

function enterFullscreen() {
    const displayDiv = document.getElementById('winnerDisplay');
    if (displayDiv.classList.contains('d-none')) {
        showToast('No winners to display', 'warning');
        return;
    }
    
    const fullscreenDiv = document.getElementById('fullscreenDisplay');
    const fullscreenPrize = document.getElementById('fullscreenPrize');
    const fullscreenWinners = document.getElementById('fullscreenWinnersList');
    
    fullscreenPrize.textContent = document.getElementById('displayPrize').textContent;
    fullscreenWinners.innerHTML = document.getElementById('winnersList').innerHTML;
    
    fullscreenDiv.classList.remove('d-none');
    
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    }
}

function exitFullscreen() {
    document.getElementById('fullscreenDisplay').classList.add('d-none');
    
    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

async function deleteListAction(listId) {
    const confirmed = await confirmAction('Are you sure you want to delete this list?');
    if (!confirmed) return;
    
    try {
        await deleteList(listId);
        await loadLists();
        
        if (currentList && currentList.metadata.listId === listId) {
            currentList = null;
            updateListInfo();
        }
        
        showToast('List deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting list:', error);
        showToast('Error deleting list', 'error');
    }
}

async function deleteWinnerAction(winnerId) {
    const confirmed = await confirmAction('Are you sure you want to delete this winner?');
    if (!confirmed) return;
    
    try {
        await deleteWinner(winnerId);
        await loadWinners();
        showToast('Winner deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting winner:', error);
        showToast('Error deleting winner', 'error');
    }
}

async function deletePrizeAction(prizeId) {
    const confirmed = await confirmAction('Are you sure you want to delete this prize?');
    if (!confirmed) return;
    
    try {
        await deletePrize(prizeId);
        await loadPrizes();
        showToast('Prize deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting prize:', error);
        showToast('Error deleting prize', 'error');
    }
}

async function addPrize() {
    const nameInput = document.getElementById('prizeName');
    const quantityInput = document.getElementById('prizeQuantity');
    
    if (!nameInput.value.trim() || !quantityInput.value) {
        showToast('Please enter prize name and quantity', 'warning');
        return;
    }
    
    try {
        const prize = {
            prizeId: generateId(8),
            name: nameInput.value.trim(),
            quantity: parseInt(quantityInput.value)
        };
        
        await savePrize(prize);
        await loadPrizes();
        
        nameInput.value = '';
        quantityInput.value = '';
        
        showToast('Prize added successfully', 'success');
    } catch (error) {
        console.error('Error adding prize:', error);
        showToast('Error adding prize', 'error');
    }
}

async function exportWinners() {
    try {
        const winners = await getAllWinners();
        if (winners.length === 0) {
            showToast('No winners to export', 'warning');
            return;
        }
        
        const exportData = winners.map(winner => ({
            ID: winner.winnerId,
            ...winner.originalEntry?.data || {},
            DisplayName: winner.displayName,
            Prize: winner.prize,
            Timestamp: new Date(winner.timestamp).toISOString()
        }));
        
        exportToCSV(exportData, `winners_${new Date().toISOString().split('T')[0]}.csv`);
        showToast('Winners exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting winners:', error);
        showToast('Error exporting winners', 'error');
    }
}

async function clearAllWinnersAction() {
    const confirmed = await confirmAction('Are you sure you want to clear all winners? This cannot be undone.');
    if (!confirmed) return;
    
    try {
        await clearAllWinners();
        await loadWinners();
        showToast('All winners cleared', 'success');
    } catch (error) {
        console.error('Error clearing winners:', error);
        showToast('Error clearing winners', 'error');
    }
}

function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', settings.primaryColor);
    root.style.setProperty('--secondary-color', settings.secondaryColor);
}

async function saveAllSettings() {
    try {
        settings.displayDuration = parseInt(document.getElementById('displayDuration').value);
        settings.preventDuplicates = document.getElementById('preventDuplicates').checked;
        settings.primaryColor = document.getElementById('primaryColor').value;
        settings.secondaryColor = document.getElementById('secondaryColor').value;
        
        await saveSettings(settings);
        applyTheme();
        showToast('Settings saved successfully', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error saving settings', 'error');
    }
}

async function loadAppSettings() {
    try {
        const savedSettings = await loadSettings();
        settings = { ...settings, ...savedSettings };
        
        document.getElementById('displayDuration').value = settings.displayDuration;
        document.getElementById('preventDuplicates').checked = settings.preventDuplicates;
        document.getElementById('primaryColor').value = settings.primaryColor;
        document.getElementById('secondaryColor').value = settings.secondaryColor;
        
        applyTheme();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function viewHistoryDetails(historyId) {
    // This could open a modal with detailed history information
    showToast('History details view - feature to be implemented', 'info');
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully');
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showProgress('Initializing App', 'Setting up database...');
        
        await initDB();
        updateProgress(25, 'Loading settings...');
        
        await loadAppSettings();
        updateProgress(50, 'Loading lists...');
        
        await loadLists();
        updateProgress(75, 'Loading data...');
        
        await loadPrizes();
        await loadWinners();
        await loadHistory();
        
        updateProgress(100, 'Ready!');
        
        setTimeout(() => {
            hideProgress();
            
            // Event listeners
            document.getElementById('uploadBtn').addEventListener('click', uploadList);
            document.getElementById('saveConfigBtn').addEventListener('click', saveNameConfig);
            document.getElementById('currentListSelect').addEventListener('change', selectCurrentList);
            document.getElementById('selectWinnersBtn').addEventListener('click', selectWinners);
            document.getElementById('undoBtn').addEventListener('click', undoLastAction);
            document.getElementById('fullscreenBtn').addEventListener('click', enterFullscreen);
            document.getElementById('addPrizeBtn').addEventListener('click', addPrize);
            document.getElementById('exportWinnersBtn').addEventListener('click', exportWinners);
            document.getElementById('clearWinnersBtn').addEventListener('click', clearAllWinnersAction);
            document.getElementById('saveSettingsBtn').addEventListener('click', saveAllSettings);
            document.getElementById('saveThemeBtn').addEventListener('click', () => {
                settings.primaryColor = document.getElementById('primaryColor').value;
                settings.secondaryColor = document.getElementById('secondaryColor').value;
                applyTheme();
                showToast('Theme applied', 'success');
            });
            
            // History filter
            document.getElementById('historyListFilter').addEventListener('change', (e) => {
                loadHistory(e.target.value);
            });
            
            // Fullscreen event listener
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement) {
                    exitFullscreen();
                }
            });
            
            showToast('App loaded successfully', 'success');
        }, 500);
        
    } catch (error) {
        hideProgress();
        console.error('Error initializing app:', error);
        showToast('Error initializing app: ' + error.message, 'error');
    }
});