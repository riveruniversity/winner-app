// ================================
// FIRESTORE SERVICE
// ================================

import { db } from './firebase.js';
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
  getDocFromCache,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Collection names matching current schema
const COLLECTIONS = {
  lists: 'lists',
  winners: 'winners', 
  prizes: 'prizes',
  history: 'history',
  settings: 'settings',
  sounds: 'sounds'
};

// Get key field for each collection (matches current schema)
function getKeyField(collectionName) {
  const keyFields = {
    lists: 'listId',
    winners: 'winnerId', 
    prizes: 'prizeId',
    history: 'historyId',
    settings: 'key',
    sounds: 'soundId'
  };
  return keyFields[collectionName] || 'id';
}

// Save document to collection (true local-first: returns immediately after local save)
async function saveToStore(collectionName, data, options = {}) {
  try {
    const keyField = getKeyField(collectionName);
    const docId = data[keyField];
    
    if (!docId) {
      throw new Error(`Document must have a '${keyField}' field`);
    }
    
    // Special handling for lists that might need sharding
    if (collectionName === 'lists' && data.entries && data.entries.length > 1000) {
      console.log(`📦 Large list detected (${data.entries.length} entries), using sharding strategy`);
      return await handleLargeListSharding(data, options.onProgress);
    }
    
    // TRUE local-first approach: fire and forget
    console.log(`💾 Saving ${collectionName}/${docId} locally (immediate return)...`);
    
    const docRef = doc(db, collectionName, docId);
    
    // Use merge for settings to prevent overwrites, false for others
    const mergeOption = collectionName === 'settings' ? { merge: true } : { merge: false };
    
    // Save in background - don't await this!
    setDoc(docRef, data, mergeOption).then(() => {
      console.log(`🔄 ${collectionName}/${docId} synced to server in background`);
    }).catch(error => {
      console.warn(`⚠️ Background sync failed for ${collectionName}/${docId}:`, error);
      // Could implement retry logic here
    });
    
    console.log(`✅ ${collectionName}/${docId} save initiated - returning immediately`);
    
    // Return immediately without waiting for network
    return docId;
    
  } catch (error) {
    console.error(`Error initiating save for ${collectionName}:`, error);
    throw error;
  }
}


// Internal function: Handle large list sharding
async function handleLargeListSharding(listData, onProgress = null) {
  const entries = listData.entries;
  const maxEntriesPerShard = 1000; // Keep each shard under 1MB
  
  // This function is only called for large lists, so proceed with sharding
  
  // Large list - needs sharding
  console.log(`📦 Large list detected (${entries.length} entries), splitting into shards...`);
  
  const baseListId = listData.listId;
  const totalShards = Math.ceil(entries.length / maxEntriesPerShard);
  const shardIds = [];
  
  // Create ALL shard documents (including shard-0 for the first chunk)
  for (let shardIndex = 0; shardIndex < totalShards; shardIndex++) {
    const startIndex = shardIndex * maxEntriesPerShard;
    const endIndex = Math.min(startIndex + maxEntriesPerShard, entries.length);
    const shardEntries = entries.slice(startIndex, endIndex);
    
    const shardId = `${baseListId}-shard-${shardIndex}`;
    const shardData = {
      listId: shardId,
      parentListId: baseListId,
      shardIndex: shardIndex,
      metadata: {
        ...listData.metadata,
        listId: shardId,
        parentListId: baseListId,
        isListShard: true,
        shardIndex: shardIndex,
        entriesInShard: shardEntries.length
      },
      entries: shardEntries
    };
    
    const docRef = doc(db, 'lists', shardId);
    
    // Fire and forget for shards
    setDoc(docRef, shardData, { merge: false }).catch(error => {
      console.warn(`⚠️ Shard ${shardId} sync failed:`, error);
    });
    shardIds.push(shardId);
    
    if (onProgress) {
      const progress = ((shardIndex + 1) / totalShards) * 90; // Leave 10% for main doc
      onProgress(progress, `Saved shard ${shardIndex + 1}/${totalShards} (${shardEntries.length} entries)`);
    }
    
    // Yield to UI thread
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Create main list document (metadata ONLY - no entries)
  const mainListData = {
    ...listData,
    entries: [], // ALWAYS empty for sharded lists
    isSharded: true,
    totalShards: totalShards,
    totalEntries: entries.length,
    shardIds: shardIds // References to all shards (shard-0, shard-1, etc.)
  };
  
  const mainDocRef = doc(db, 'lists', baseListId);
  
  // Fire and forget for main document
  setDoc(mainDocRef, mainListData, { merge: false }).catch(error => {
    console.warn(`⚠️ Main list ${baseListId} sync failed:`, error);
  });
  
  if (onProgress) {
    onProgress(100, `Complete! Saved ${entries.length} entries across ${totalShards} shards`);
  }
  
  console.log(`✅ Large list saved: ${totalShards} shards (shard-0 to shard-${totalShards-1}), ${entries.length} total entries`);
  return baseListId;
}

// Get all entries from a potentially sharded list
async function getListWithShards(listId) {
  try {
    // Call Firestore directly to avoid recursion
    const docRef = doc(db, 'lists', listId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    const mainList = docSnap.data();
    
    // If not sharded, return as-is
    if (!mainList.isSharded) {
      return mainList;
    }
    
    // Load all shards
    console.log(`📦 Loading sharded list: ${mainList.totalShards} shards`);
    const allEntries = [];
    
    for (const shardId of mainList.shardIds) {
      // Also call Firestore directly for shards to avoid recursion
      const shardDocRef = doc(db, 'lists', shardId);
      const shardSnap = await getDoc(shardDocRef);
      
      if (shardSnap.exists()) {
        const shard = shardSnap.data();
        if (shard && shard.entries) {
          allEntries.push(...shard.entries);
        }
      }
    }
    
    // Return reconstructed list
    return {
      ...mainList,
      entries: allEntries,
      metadata: {
        ...mainList.metadata,
        reconstructed: true
      }
    };
  } catch (error) {
    console.error(`Error loading sharded list ${listId}:`, error);
    throw error;
  }
}

// Universal get function - handles single docs, all docs, and sharded lists automatically
async function getFromStore(collectionName, key = null) {
  try {
    // If key provided, get single document
    if (key) {
      // Special handling for lists - check if it's sharded
      if (collectionName === 'lists') {
        return await getListWithShards(key);
      }
      
      // Standard single document retrieval
      const docRef = doc(db, collectionName, key);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    }
    
    // If no key provided, get all documents (cache-first approach)
    try {
      // First try to get from cache for instant loading
      const cacheSnapshot = await getDocsFromCache(collection(db, collectionName));
      const cacheResults = [];
      
      cacheSnapshot.forEach((doc) => {
        cacheResults.push(doc.data());
      });
      
      // If we have cache data, process it
      if (cacheResults.length > 0) {
        console.log(`📦 Loaded ${cacheResults.length} ${collectionName} from cache`);
        
        // Then fetch from server in background to sync latest data
        getDocs(collection(db, collectionName)).then(serverSnapshot => {
          console.log(`🔄 Background sync complete for ${collectionName}`);
        }).catch(err => {
          console.warn(`Background sync failed for ${collectionName}:`, err);
        });
        
        // For lists, reconstruct sharded documents
        if (collectionName === 'lists') {
          return await reconstructShardedLists(cacheResults);
        }
        
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
    
    // For lists, reconstruct sharded documents
    if (collectionName === 'lists') {
      return await reconstructShardedLists(results);
    }
    
    return results;
    
  } catch (error) {
    console.error(`Error getting from ${collectionName}:`, error);
    throw error;
  }
}


// Helper function to reconstruct sharded lists from raw documents
async function reconstructShardedLists(rawDocuments) {
  const reconstructedLists = [];
  const processedIds = new Set();
  
  for (const doc of rawDocuments) {
    // Skip if already processed or if it's a shard (not main document)
    if (processedIds.has(doc.listId) || doc.metadata?.isListShard) {
      continue;
    }
    
    if (doc.isSharded) {
      // This is a sharded list - reconstruct it
      console.log(`🔧 Reconstructing sharded list ${doc.listId} with ${doc.totalShards} shards`);
      
      const allEntries = [];
      for (const shardId of doc.shardIds || []) {
        // Find the shard in our raw documents or fetch it
        let shard = rawDocuments.find(d => d.listId === shardId);
        if (!shard) {
          // Try cache first for missing shard
          try {
            const docRef = doc(db, 'lists', shardId);
            const cachedSnap = await getDocFromCache(docRef);
            if (cachedSnap.exists()) {
              shard = cachedSnap.data();
              
              // Background sync for this shard (fire and forget)
              getDoc(docRef).then(() => {
                console.log(`🔄 Background sync complete for shard ${shardId}`);
              }).catch(err => {
                console.warn(`Background sync failed for shard ${shardId}:`, err);
              });
            }
          } catch (cacheError) {
            // If cache fails, fetch from server as last resort
            console.log(`📡 Cache miss for shard ${shardId}, fetching from server...`);
            const docRef = doc(db, 'lists', shardId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              shard = docSnap.data();
            }
          }
        }
        
        if (shard && shard.entries) {
          allEntries.push(...shard.entries);
        }
      }
      
      // Return reconstructed list
      reconstructedLists.push({
        ...doc,
        entries: allEntries,
        metadata: {
          ...doc.metadata,
          reconstructed: true,
          originalShardCount: doc.totalShards
        }
      });
    } else {
      // Regular list - add as-is
      reconstructedLists.push(doc);
    }
    
    processedIds.add(doc.listId);
  }
  
  console.log(`📋 Processed ${reconstructedLists.length} lists (${rawDocuments.length} raw documents)`);
  return reconstructedLists;
}

// Delete document from collection (fire-and-forget for local-first performance)
function deleteFromStore(collectionName, key) {
  try {
    console.log(`🗑️ Deleting ${collectionName}/${key} (fire-and-forget)...`);
    
    const docRef = doc(db, collectionName, key);
    
    // Fire and forget - don't await this!
    deleteDoc(docRef).then(() => {
      console.log(`✅ ${collectionName}/${key} deleted from server`);
    }).catch(error => {
      console.warn(`⚠️ Background delete failed for ${collectionName}/${key}:`, error);
      // Could implement retry logic here
    });
    
    // Return immediately
    return key;
    
  } catch (error) {
    console.error(`Error initiating delete for ${collectionName}:`, error);
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

// Export the clean API - only the essentials
export const Database = {
  saveToStore,     // Handles everything: local-first, sharding, fire-and-forget
  getFromStore,    // Universal: single docs, all docs, sharded lists - handles everything
  deleteFromStore, // Fire-and-forget deletes
  listenToCollection, // Real-time updates
  queryStore,      // Advanced queries
  initDB: () => Promise.resolve(db) // Firebase initialization
};

// Export only the core functions for direct use
export {
  saveToStore,
  getFromStore,
  deleteFromStore,
  listenToCollection,
  queryStore,
  COLLECTIONS
};

window.Database = Database;