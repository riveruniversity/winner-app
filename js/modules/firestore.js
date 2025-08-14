// ================================
// LOCAL JSON STORAGE SERVICE
// ================================

// Detect if we're running under a subpath
const pathname = window.location.pathname;
const API_BASE = pathname.startsWith('/testwin') ? '/testwin/api' : '/api';

// Collection names matching current schema
const COLLECTIONS = {
  lists: 'lists',
  winners: 'winners', 
  prizes: 'prizes',
  history: 'history',
  settings: 'settings',
  sounds: 'sounds',
  backups: 'backups'
};

// Get key field for each collection (matches current schema)
function getKeyField(collectionName) {
  const keyFields = {
    lists: 'listId',
    winners: 'winnerId', 
    prizes: 'prizeId',
    history: 'historyId',
    settings: 'key',
    sounds: 'soundId',
    backups: 'backupId'
  };
  return keyFields[collectionName] || 'id';
}

// Save document to collection (local-first approach with server sync)
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
    
    console.log(`💾 Saving ${collectionName}/${docId} to server...`);
    
    const response = await fetch(`${API_BASE}/${collectionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ ${collectionName}/${docId} saved to server`);
    
    return result.id || docId;
    
  } catch (error) {
    console.error(`Error saving to ${collectionName}:`, error);
    throw error;
  }
}

// Internal function: Handle large list sharding
async function handleLargeListSharding(listData, onProgress = null) {
  const entries = listData.entries;
  const maxEntriesPerShard = 1000; // Keep each shard under 1MB
  
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
    
    // Save shard to server
    const response = await fetch(`${API_BASE}/lists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shardData),
    });

    if (!response.ok) {
      console.warn(`⚠️ Shard ${shardId} save failed: HTTP ${response.status}`);
    }
    
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
  
  // Save main document to server
  const response = await fetch(`${API_BASE}/lists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mainListData),
  });

  if (!response.ok) {
    console.warn(`⚠️ Main list ${baseListId} save failed: HTTP ${response.status}`);
  }
  
  if (onProgress) {
    onProgress(100, `Complete! Saved ${entries.length} entries across ${totalShards} shards`);
  }
  
  console.log(`✅ Large list saved: ${totalShards} shards (shard-0 to shard-${totalShards-1}), ${entries.length} total entries`);
  return baseListId;
}

// Get all entries from a potentially sharded list
async function getListWithShards(listId) {
  try {
    const response = await fetch(`${API_BASE}/lists/${listId}`);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const mainList = await response.json();
    
    // If not sharded, return as-is
    if (!mainList.isSharded) {
      return mainList;
    }
    
    // Load all shards
    console.log(`📦 Loading sharded list: ${mainList.totalShards} shards`);
    const allEntries = [];
    
    for (const shardId of mainList.shardIds) {
      const shardResponse = await fetch(`${API_BASE}/lists/${shardId}`);
      
      if (shardResponse.ok) {
        const shard = await shardResponse.json();
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
      const response = await fetch(`${API_BASE}/${collectionName}/${key}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    }
    
    // If no key provided, get all documents
    const response = await fetch(`${API_BASE}/${collectionName}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const results = await response.json();
    console.log(`📡 Loaded ${results.length} ${collectionName} from server`);
    
    return results;
    
  } catch (error) {
    console.error(`Error getting from ${collectionName}:`, error);
    throw error;
  }
}

// Delete document from collection
async function deleteFromStore(collectionName, key) {
  try {
    console.log(`🗑️ Deleting ${collectionName}/${key} from server...`);
    
    const response = await fetch(`${API_BASE}/${collectionName}/${key}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log(`✅ ${collectionName}/${key} deleted from server`);
    return key;
    
  } catch (error) {
    console.error(`Error deleting from ${collectionName}:`, error);
    throw error;
  }
}

// Listen to collection changes (polling-based since we don't have WebSocket)
function listenToCollection(collectionName, callback) {
  let intervalId;
  let lastData = null;
  
  async function pollForChanges() {
    try {
      const currentData = await getFromStore(collectionName);
      const currentDataStr = JSON.stringify(currentData);
      
      if (lastData !== currentDataStr) {
        lastData = currentDataStr;
        callback(currentData);
      }
    } catch (error) {
      console.error(`Error polling ${collectionName}:`, error);
    }
  }
  
  // Poll every 5 seconds
  intervalId = setInterval(pollForChanges, 5000);
  
  // Initial load
  pollForChanges();
  
  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

// Query documents with filters (simplified version)
async function queryStore(collectionName, filters = []) {
  try {
    // For now, get all documents and filter client-side
    // Could be enhanced to support server-side filtering
    const allData = await getFromStore(collectionName);
    
    let results = allData;
    
    // Apply filters client-side
    for (const filter of filters) {
      if (filter.type === 'where') {
        results = results.filter(item => {
          const value = item[filter.field];
          switch (filter.operator) {
            case '==':
              return value === filter.value;
            case '!=':
              return value !== filter.value;
            case '>':
              return value > filter.value;
            case '<':
              return value < filter.value;
            case '>=':
              return value >= filter.value;
            case '<=':
              return value <= filter.value;
            default:
              return true;
          }
        });
      } else if (filter.type === 'orderBy') {
        results.sort((a, b) => {
          const aVal = a[filter.field];
          const bVal = b[filter.field];
          const direction = filter.direction === 'desc' ? -1 : 1;
          
          if (aVal < bVal) return -1 * direction;
          if (aVal > bVal) return 1 * direction;
          return 0;
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error);
    throw error;
  }
}

// Update specific fields in a document
async function updateWinner(winnerId, updateData) {
  try {
    console.log(`🔄 Updating winner ${winnerId} with pickup status...`);
    
    // Get the existing winner data first
    const existingWinner = await getFromStore('winners', winnerId);
    if (!existingWinner) {
      throw new Error(`Winner ${winnerId} not found`);
    }
    
    // Merge update data with existing data
    const updatedWinner = {
      ...existingWinner,
      ...updateData
    };
    
    // Save the updated winner
    await saveToStore('winners', updatedWinner);
    
    console.log(`✅ Winner ${winnerId} updated with pickup status`);
    return updatedWinner;
  } catch (error) {
    console.error(`Error updating winner ${winnerId}:`, error);
    throw error;
  }
}

// Batch fetch multiple collections in a single request
async function batchFetch(requests) {
  try {
    console.log(`📦 Batch fetching ${requests.length} collections...`);
    
    const response = await fetch(`${API_BASE}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to batch fetch: ${response.statusText}`);
    }
    
    const results = await response.json();
    console.log(`✅ Batch fetch completed`);
    return results;
    
  } catch (error) {
    console.error('Error in batch fetch:', error);
    throw error;
  }
}

// Batch save multiple documents in a single request
async function batchSave(operations) {
  try {
    console.log(`💾 Batch saving ${operations.length} documents...`);
    
    const response = await fetch(`${API_BASE}/batch-save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operations })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to batch save: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Batch save completed`);
    return result;
    
  } catch (error) {
    console.error('Error in batch save:', error);
    throw error;
  }
}

// Export the clean API - only the essentials
export const Database = {
  saveToStore,     // Handles everything: local-first, sharding
  getFromStore,    // Universal: single docs, all docs, sharded lists - handles everything
  deleteFromStore, // Server-based deletes
  listenToCollection, // Polling-based updates
  queryStore,      // Client-side filtered queries
  updateWinner,    // Update winner pickup status
  batchFetch,      // Batch fetch multiple collections
  batchSave,       // Batch save multiple documents
  initDB: async () => {
    // Test server connectivity
    try {
        const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        console.log('✅ Server connection established');
        return true;
      }
    } catch (error) {
      console.error('❌ Server connection failed:', error);
      throw new Error('Cannot connect to server');
    }
  }
};

// Export only the core functions for direct use
export {
  saveToStore,
  getFromStore,
  deleteFromStore,
  listenToCollection,
  queryStore,
  batchFetch,
  batchSave,
  COLLECTIONS
};

window.Database = Database;