import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Set Content Security Policy headers to allow the app to work
app.use((req, res, next) => {
  // Only set CSP for HTML pages, not API calls
  if (!req.path.includes('/api/')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' https:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net https://*.gstatic.com; " +
      "worker-src 'self' blob:; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
      "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https:; " +
      "frame-src 'none'; " +
      "object-src 'none'; " +
      "base-uri 'self';"
    );
  }
  next();
});

// Serve static files from dist (built app)
app.use(express.static('dist'));
app.use('/testwin', express.static('dist'));

// Serve static files from public (sounds, images, etc.)
app.use(express.static('public'));
app.use('/testwin', express.static('public'));

// Handle /testwin subdirectory
app.use('/testwin', express.static('dist'));
app.use('/testwin', express.static('public'));

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    const collections = ['lists', 'winners', 'prizes', 'history', 'settings', 'sounds', 'backups'];
    for (const collection of collections) {
      const filePath = path.join(DATA_DIR, `${collection}.json`);
      await fs.writeFile(filePath, '[]', 'utf8');
    }
    console.log('Data directory initialized');
  }
}

async function readCollection(collection) {
  try {
    const filePath = path.join(DATA_DIR, `${collection}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${collection}:`, error);
    return [];
  }
}

async function writeCollection(collection, data) {
  try {
    const filePath = path.join(DATA_DIR, `${collection}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${collection}:`, error);
    return false;
  }
}

function getKeyField(collection) {
  const keyFields = {
    lists: 'listId',
    winners: 'winnerId',
    prizes: 'prizeId',
    history: 'historyId',
    settings: 'key',
    sounds: 'soundId',
    backups: 'backupId'
  };
  return keyFields[collection] || 'id';
}

// Health check endpoints (must be before generic routes)
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
app.get('/testwin/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Batch endpoint for fetching multiple collections at once
app.post(['/api/batch', '/testwin/api/batch'], async (req, res) => {
  try {
    const { requests } = req.body;
    if (!Array.isArray(requests)) {
      return res.status(400).json({ error: 'requests must be an array' });
    }
    
    const results = {};
    
    for (const request of requests) {
      const { collection, id } = request;
      try {
        if (id) {
          // Fetch specific document
          const data = await readCollection(collection);
          const keyField = getKeyField(collection);
          const item = data.find(d => d[keyField] === id);
          results[`${collection}:${id}`] = item || null;
        } else {
          // Fetch entire collection
          const data = await readCollection(collection);
          results[collection] = data;
        }
      } catch (error) {
        results[collection] = { error: error.message };
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error in batch endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch save endpoint for saving multiple documents at once (atomic)
app.post(['/api/batch-save', '/testwin/api/batch-save'], async (req, res) => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'operations must be an array' });
    }
    
    // First, validate all operations and prepare the changes
    const changes = {};
    const results = [];
    
    for (const op of operations) {
      const { collection, data, operation, id } = op;
      const keyField = getKeyField(collection);
      
      // Handle delete operations
      if (operation === 'delete') {
        if (!changes[collection]) {
          changes[collection] = await readCollection(collection);
        }
        
        const deleteId = id || (data && data[keyField]);
        if (deleteId) {
          changes[collection] = changes[collection].filter(d => d[keyField] !== deleteId);
        }
        continue;
      }
      
      // Handle save/update operations
      if (!data) continue;
      
      if (!data[keyField]) {
        data[keyField] = uuidv4();
      }
      
      if (!changes[collection]) {
        changes[collection] = await readCollection(collection);
      }
      
      const existingIndex = changes[collection].findIndex(d => d[keyField] === data[keyField]);
      
      if (existingIndex >= 0) {
        changes[collection][existingIndex] = data;
      } else {
        changes[collection].push(data);
      }
      
      results.push({ success: true, id: data[keyField], collection });
    }
    
    // Now write all changes atomically - if any fails, none are saved
    for (const [collection, data] of Object.entries(changes)) {
      await writeCollection(collection, data);
    }
    
    // Log only errors or in dev mode
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Batch save: ${operations.length} documents`);
    }
    res.json({ results });
  } catch (error) {
    console.error('Batch save failed:', error.message);
    res.status(500).json({ error: `Batch save failed: ${error.message}` });
  }
});

// Support both /api and /testwin/api paths
app.get(['/api/:collection', '/testwin/api/:collection'], async (req, res) => {
  try {
    const { collection } = req.params;
    const data = await readCollection(collection);
    
    if (collection === 'lists') {
      const reconstructed = [];
      const processedIds = new Set();
      
      for (const item of data) {
        if (processedIds.has(item.listId) || item.metadata?.isListShard) {
          continue;
        }
        
        if (item.isSharded) {
          const allEntries = [];
          for (const shardId of item.shardIds || []) {
            const shard = data.find(d => d.listId === shardId);
            if (shard && shard.entries) {
              allEntries.push(...shard.entries);
            }
          }
          reconstructed.push({
            ...item,
            entries: allEntries,
            metadata: {
              ...item.metadata,
              reconstructed: true
            }
          });
        } else {
          reconstructed.push(item);
        }
        processedIds.add(item.listId);
      }
      
      res.json(reconstructed);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Error in GET /:collection:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get(['/api/:collection/:id', '/testwin/api/:collection/:id'], async (req, res) => {
  try {
    const { collection, id } = req.params;
    const data = await readCollection(collection);
    const keyField = getKeyField(collection);
    
    if (collection === 'lists') {
      const item = data.find(d => d[keyField] === id);
      
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      
      if (item.isSharded) {
        const allEntries = [];
        for (const shardId of item.shardIds || []) {
          const shard = data.find(d => d.listId === shardId);
          if (shard && shard.entries) {
            allEntries.push(...shard.entries);
          }
        }
        res.json({
          ...item,
          entries: allEntries,
          metadata: {
            ...item.metadata,
            reconstructed: true
          }
        });
      } else {
        res.json(item);
      }
    } else {
      const item = data.find(d => d[keyField] === id);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    }
  } catch (error) {
    console.error('Error in GET /:collection/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// EZ Texting API endpoint - MUST come before generic collection routes
app.post(['/api/ez-texting', '/testwin/api/ez-texting'], async (req, res) => {
  // Log only in development mode
  if (process.env.NODE_ENV !== 'production') {
    console.log('EZ Texting endpoint called:', req.body.action);
  }
  try {
    const { action, data } = req.body;
    
    // Get credentials from environment variables
    const username = process.env.EZ_TEXTING_USERNAME;
    const password = process.env.EZ_TEXTING_PASSWORD;
    
    if (!username || !password) {
      return res.status(500).json({ 
        error: 'Server configuration error: EZ Texting credentials not configured' 
      });
    }
    
    // Create auth header
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    
    // Handle different actions
    let result;
    
    switch (action) {
      case 'sendMessage':
        if (!data.message || !data.phoneNumbers) {
          throw new Error('Message and phoneNumbers are required');
        }
        
        const requestBody = {
          message: data.message,
          toNumbers: data.phoneNumbers,
          ...data.options
        };
        
        // Log SMS send in production-friendly way
        console.log(`Sending SMS to ${data.phoneNumbers.length} recipient(s)`);
        
        const ezTextingResponse = await fetch('https://a.eztexting.com/v1/messages', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        const responseText = await ezTextingResponse.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = responseText;
        }
        
        // Log result concisely
        if (ezTextingResponse.ok) {
          console.log(`SMS sent successfully: ${responseData.id}`);
        } else {
          console.error(`SMS failed: ${ezTextingResponse.status}`, responseData);
        }
        
        result = {
          success: ezTextingResponse.ok,
          statusCode: ezTextingResponse.status,
          data: responseData,
          rawResponse: responseText
        };
        break;
        
      case 'getMessageReport':
        if (!data.messageId) {
          throw new Error('messageId is required');
        }
        
        const reportResponse = await fetch(`https://a.eztexting.com/v1/message-reports/${data.messageId}`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });
        
        const reportText = await reportResponse.text();
        let reportData;
        try {
          reportData = JSON.parse(reportText);
        } catch (e) {
          reportData = reportText;
        }
        
        result = {
          success: reportResponse.ok,
          statusCode: reportResponse.status,
          data: reportData,
          rawResponse: reportText
        };
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Save the action and result to log
    try {
      const ezLog = await readCollection('ez-texting');
      const logEntry = { 
        action, 
        data, 
        result,
        timestamp: new Date().toISOString(),
        id: uuidv4() 
      };
      ezLog.push(logEntry);
      await writeCollection('ez-texting', ezLog);
    } catch (logError) {
      console.error('Failed to save EZ Texting log:', logError);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('EZ Texting error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred'
    });
  }
});

app.post(['/api/:collection', '/testwin/api/:collection'], async (req, res) => {
  try {
    const { collection } = req.params;
    const newItem = req.body;
    const keyField = getKeyField(collection);
    
    if (!newItem[keyField]) {
      newItem[keyField] = uuidv4();
    }
    
    const data = await readCollection(collection);
    
    if (collection === 'lists' && newItem.entries && newItem.entries.length > 1000) {
      const entries = newItem.entries;
      const maxEntriesPerShard = 1000;
      const baseListId = newItem.listId;
      const totalShards = Math.ceil(entries.length / maxEntriesPerShard);
      const shardIds = [];
      
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
            ...newItem.metadata,
            listId: shardId,
            parentListId: baseListId,
            isListShard: true,
            shardIndex: shardIndex,
            entriesInShard: shardEntries.length
          },
          entries: shardEntries
        };
        
        data.push(shardData);
        shardIds.push(shardId);
      }
      
      const mainListData = {
        ...newItem,
        entries: [],
        isSharded: true,
        totalShards: totalShards,
        totalEntries: entries.length,
        shardIds: shardIds
      };
      
      const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
      if (existingIndex >= 0) {
        const oldItem = data[existingIndex];
        if (oldItem.isSharded && oldItem.shardIds) {
          for (const oldShardId of oldItem.shardIds) {
            const shardIndex = data.findIndex(d => d.listId === oldShardId);
            if (shardIndex >= 0) {
              data.splice(shardIndex, 1);
            }
          }
        }
        data[existingIndex] = mainListData;
      } else {
        data.push(mainListData);
      }
    } else {
      if (collection === 'settings') {
        const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
        if (existingIndex >= 0) {
          data[existingIndex] = { ...data[existingIndex], ...newItem };
        } else {
          data.push(newItem);
        }
      } else {
        const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
        if (existingIndex >= 0) {
          data[existingIndex] = newItem;
        } else {
          data.push(newItem);
        }
      }
    }
    
    await writeCollection(collection, data);
    res.json({ success: true, id: newItem[keyField] });
  } catch (error) {
    console.error('Error in POST /:collection:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put(['/api/:collection/:id', '/testwin/api/:collection/:id'], async (req, res) => {
  try {
    const { collection, id } = req.params;
    const updateData = req.body;
    const keyField = getKeyField(collection);
    
    const data = await readCollection(collection);
    const index = data.findIndex(d => d[keyField] === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    data[index] = { ...data[index], ...updateData };
    await writeCollection(collection, data);
    
    res.json({ success: true, data: data[index] });
  } catch (error) {
    console.error('Error in PUT /:collection/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete(['/api/:collection/:id', '/testwin/api/:collection/:id'], async (req, res) => {
  try {
    const { collection, id } = req.params;
    const keyField = getKeyField(collection);
    
    const data = await readCollection(collection);
    
    if (collection === 'lists') {
      const item = data.find(d => d[keyField] === id);
      if (item && item.isSharded && item.shardIds) {
        for (const shardId of item.shardIds) {
          const shardIndex = data.findIndex(d => d.listId === shardId);
          if (shardIndex >= 0) {
            data.splice(shardIndex, 1);
          }
        }
      }
    }
    
    const index = data.findIndex(d => d[keyField] === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    data.splice(index, 1);
    await writeCollection(collection, data);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /:collection/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Testwin API routes (duplicate of main API routes)
app.get('/testwin/api/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const data = await readCollection(collection);
    
    if (collection === 'lists') {
      const reconstructed = [];
      const processedIds = new Set();
      
      for (const item of data) {
        if (processedIds.has(item.listId) || item.metadata?.isListShard) {
          continue;
        }
        
        if (item.isSharded) {
          const allEntries = [];
          for (const shardId of item.shardIds || []) {
            const shard = data.find(d => d.listId === shardId);
            if (shard && shard.entries) {
              allEntries.push(...shard.entries);
            }
          }
          reconstructed.push({
            ...item,
            entries: allEntries,
            metadata: {
              ...item.metadata,
              reconstructed: true
            }
          });
        } else {
          reconstructed.push(item);
        }
        processedIds.add(item.listId);
      }
      
      res.json(reconstructed);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Error in GET /testwin/:collection:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/testwin/api/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const data = await readCollection(collection);
    const keyField = getKeyField(collection);
    
    if (collection === 'lists') {
      const item = data.find(d => d[keyField] === id);
      
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      
      if (item.isSharded) {
        const allEntries = [];
        for (const shardId of item.shardIds || []) {
          const shard = data.find(d => d.listId === shardId);
          if (shard && shard.entries) {
            allEntries.push(...shard.entries);
          }
        }
        res.json({
          ...item,
          entries: allEntries,
          metadata: {
            ...item.metadata,
            reconstructed: true
          }
        });
      } else {
        res.json(item);
      }
    } else {
      const item = data.find(d => d[keyField] === id);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    }
  } catch (error) {
    console.error('Error in GET /testwin/:collection/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/testwin/api/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const newItem = req.body;
    const keyField = getKeyField(collection);
    
    if (!newItem[keyField]) {
      newItem[keyField] = uuidv4();
    }
    
    const data = await readCollection(collection);
    
    if (collection === 'lists' && newItem.entries && newItem.entries.length > 1000) {
      const entries = newItem.entries;
      const maxEntriesPerShard = 1000;
      const baseListId = newItem.listId;
      const totalShards = Math.ceil(entries.length / maxEntriesPerShard);
      const shardIds = [];
      
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
            ...newItem.metadata,
            listId: shardId,
            parentListId: baseListId,
            isListShard: true,
            shardIndex: shardIndex,
            entriesInShard: shardEntries.length
          },
          entries: shardEntries
        };
        
        data.push(shardData);
        shardIds.push(shardId);
      }
      
      const mainListData = {
        ...newItem,
        entries: [],
        isSharded: true,
        totalShards: totalShards,
        totalEntries: entries.length,
        shardIds: shardIds
      };
      
      const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
      if (existingIndex >= 0) {
        const oldItem = data[existingIndex];
        if (oldItem.isSharded && oldItem.shardIds) {
          for (const oldShardId of oldItem.shardIds) {
            const shardIndex = data.findIndex(d => d.listId === oldShardId);
            if (shardIndex >= 0) {
              data.splice(shardIndex, 1);
            }
          }
        }
        data[existingIndex] = mainListData;
      } else {
        data.push(mainListData);
      }
    } else {
      if (collection === 'settings') {
        const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
        if (existingIndex >= 0) {
          data[existingIndex] = { ...data[existingIndex], ...newItem };
        } else {
          data.push(newItem);
        }
      } else {
        const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
        if (existingIndex >= 0) {
          data[existingIndex] = newItem;
        } else {
          data.push(newItem);
        }
      }
    }
    
    await writeCollection(collection, data);
    res.json({ success: true, id: newItem[keyField] });
  } catch (error) {
    console.error('Error in POST /testwin/:collection:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/testwin/api/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const updateData = req.body;
    const keyField = getKeyField(collection);
    
    const data = await readCollection(collection);
    const index = data.findIndex(d => d[keyField] === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    data[index] = { ...data[index], ...updateData };
    await writeCollection(collection, data);
    
    res.json({ success: true, data: data[index] });
  } catch (error) {
    console.error('Error in PUT /testwin/:collection/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/testwin/api/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const keyField = getKeyField(collection);
    
    const data = await readCollection(collection);
    
    if (collection === 'lists') {
      const item = data.find(d => d[keyField] === id);
      if (item && item.isSharded && item.shardIds) {
        for (const shardId of item.shardIds) {
          const shardIndex = data.findIndex(d => d.listId === shardId);
          if (shardIndex >= 0) {
            data.splice(shardIndex, 1);
          }
        }
      }
    }
    
    const index = data.findIndex(d => d[keyField] === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    data.splice(index, 1);
    await writeCollection(collection, data);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /testwin/:collection/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/testwin/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Handle testwin routes
app.get('/testwin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Catch-all route for SPA - handle both root and /testwin paths
app.get('*', (req, res) => {
  // For /testwin paths, still serve the same index.html
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

async function startServer() {
  await ensureDataDir();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Data stored in: ${DATA_DIR}`);
  });
}

startServer().catch(console.error);