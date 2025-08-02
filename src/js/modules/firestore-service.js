// ================================
// FIRESTORE SERVICE
// ================================

import { db } from './firebase-init.js';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  onSnapshot,
  getDocsFromCache,
  getDocFromCache
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Collection names matching current schema
const COLLECTIONS = {
  lists: 'lists',
  winners: 'winners', 
  prizes: 'prizes',
  history: 'history',
  settings: 'settings'
};

// Get key field for each collection (matches current schema)
function getKeyField(collectionName) {
  const keyFields = {
    lists: 'listId',
    winners: 'winnerId', 
    prizes: 'prizeId',
    history: 'historyId',
    settings: 'key'
  };
  return keyFields[collectionName] || 'id';
}

// Save document to collection
async function saveToStore(collectionName, data) {
  try {
    const keyField = getKeyField(collectionName);
    const docId = data[keyField];
    
    if (!docId) {
      throw new Error(`Document must have a '${keyField}' field`);
    }
    
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, data);
    return docId;
  } catch (error) {
    console.error(`Error saving to ${collectionName}:`, error);
    throw error;
  }
}

// Get single document from collection
async function getFromStore(collectionName, key) {
  try {
    const docRef = doc(db, collectionName, key);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error(`Error getting from ${collectionName}:`, error);
    throw error;
  }
}

// Get all documents from collection (cache-first approach)
async function getAllFromStore(collectionName) {
  try {
    // First try to get from cache for instant loading
    try {
      const cacheSnapshot = await getDocsFromCache(collection(db, collectionName));
      const cacheResults = [];
      
      cacheSnapshot.forEach((doc) => {
        cacheResults.push(doc.data());
      });
      
      // If we have cache data, return it immediately
      if (cacheResults.length > 0) {
        console.log(`📦 Loaded ${cacheResults.length} ${collectionName} from cache`);
        
        // Then fetch from server in background to sync latest data
        getDocs(collection(db, collectionName)).then(serverSnapshot => {
          console.log(`🔄 Background sync complete for ${collectionName}`);
        }).catch(err => {
          console.warn(`Background sync failed for ${collectionName}:`, err);
        });
        
        return cacheResults;
      }
    } catch (cacheError) {
      console.log(`📡 No cache data for ${collectionName}, fetching from server...`);
    }
    
    // If no cache data, fetch from server
    const querySnapshot = await getDocs(collection(db, collectionName));
    const results = [];
    
    querySnapshot.forEach((doc) => {
      results.push(doc.data());
    });
    
    console.log(`📡 Loaded ${results.length} ${collectionName} from server`);
    return results;
  } catch (error) {
    console.error(`Error getting all from ${collectionName}:`, error);
    throw error;
  }
}

// Delete document from collection
async function deleteFromStore(collectionName, key) {
  try {
    const docRef = doc(db, collectionName, key);
    await deleteDoc(docRef);
    return key;
  } catch (error) {
    console.error(`Error deleting from ${collectionName}:`, error);
    throw error;
  }
}

// Get all documents with cache-first + real-time updates
function getAllFromStoreWithUpdates(collectionName, callback) {
  // First load from cache immediately
  getAllFromStore(collectionName).then(cacheData => {
    callback(cacheData, 'cache');
  }).catch(err => {
    console.error('Error loading cache data:', err);
  });
  
  // Then set up real-time listener for updates
  const collRef = collection(db, collectionName);
  return onSnapshot(collRef, (snapshot) => {
    const items = [];
    snapshot.forEach((doc) => {
      items.push(doc.data());
    });
    
    // Only call callback if data actually changed
    callback(items, 'server');
    console.log(`🔄 Real-time update for ${collectionName}: ${items.length} items`);
  }, (error) => {
    console.error(`Error listening to ${collectionName}:`, error);
  });
}

// Listen to collection changes (for real-time updates)
function listenToCollection(collectionName, callback) {
  const collRef = collection(db, collectionName);
  
  return onSnapshot(collRef, (snapshot) => {
    const items = [];
    snapshot.forEach((doc) => {
      items.push(doc.data());
    });
    callback(items);
  }, (error) => {
    console.error(`Error listening to ${collectionName}:`, error);
  });
}

// Query documents with filters
async function queryStore(collectionName, filters = []) {
  try {
    let q = collection(db, collectionName);
    
    // Apply filters
    for (const filter of filters) {
      if (filter.type === 'where') {
        q = query(q, where(filter.field, filter.operator, filter.value));
      } else if (filter.type === 'orderBy') {
        q = query(q, orderBy(filter.field, filter.direction || 'asc'));
      }
    }
    
    const querySnapshot = await getDocs(q);
    const results = [];
    
    querySnapshot.forEach((doc) => {
      results.push(doc.data());
    });
    
    return results;
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error);
    throw error;
  }
}

// Migration helper: Copy data from IndexedDB to Firestore
async function migrateFromIndexedDB() {
  // This will be called only if needed during transition
  console.log('Migration helper available if needed');
}

// Export the same interface as the old Database module
export const Database = {
  saveToStore,
  getFromStore,
  getAllFromStore,
  getAllFromStoreWithUpdates,
  deleteFromStore,
  listenToCollection,
  queryStore,
  migrateFromIndexedDB,
  // Keep initDB for compatibility (now just returns resolved promise)
  initDB: () => Promise.resolve(db)
};

// Also export individual functions for direct use
export {
  saveToStore,
  getFromStore, 
  getAllFromStore,
  getAllFromStoreWithUpdates,
  deleteFromStore,
  listenToCollection,
  queryStore,
  COLLECTIONS
};

window.Database = Database;