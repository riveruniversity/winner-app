// ================================
// DATABASE OPERATIONS
// ================================

let dbInstance = null;

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WinnerSelectionApp', 3);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      dbInstance = event.target.result;
      const stores = ['lists', 'winners', 'prizes', 'history', 'settings'];

      stores.forEach(storeName => {
        if (!dbInstance.objectStoreNames.contains(storeName)) {
          const store = dbInstance.createObjectStore(storeName, { keyPath: getKeyPath(storeName) });
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

async function saveToStore(storeName, data) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromStore(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromStore(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromStore(storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const Database = {
  initDB,
  saveToStore,
  getFromStore,
  getAllFromStore,
  deleteFromStore
};

window.Database = Database;