import express from 'express';
import type { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { DATA_DIR, isValidCollection, getKeyField, CollectionItem } from './config.js';
import { readCollection, writeCollection } from './services/collection.js';
import { getMPInstance, updateMissingIdCards, type MPInstance } from './services/mp-service.js';
import { sendMessage, getMessageReport } from './services/texting.js';
import { upload, listUploadedImages } from './services/upload.js';
import { strictLimiter } from './middleware.js';

export const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Batch endpoint for fetching multiple collections at once
apiRouter.post('/batch', async (req: Request, res: Response) => {
  try {
    const { requests } = req.body;
    if (!Array.isArray(requests)) {
      return res.status(400).json({ error: 'requests must be an array' });
    }

    const results: { [key: string]: any } = {};

    for (const request of requests) {
      const { collection, id } = request;

      if (!isValidCollection(collection)) {
        results[collection] = { error: `Invalid collection: ${collection}` };
        continue;
      }

      try {
        if (id) {
          const data = await readCollection(collection);
          const keyField = getKeyField(collection);
          const item = data.find(d => d[keyField] === id);
          results[`${collection}:${id}`] = item || null;
        } else {
          const data = await readCollection(collection);
          results[collection] = data;
        }
      } catch (error: any) {
        results[collection] = { error: error.message };
      }
    }

    res.json(results);
  } catch (error: any) {
    console.error('Error in batch endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch save endpoint for saving multiple documents at once (atomic)
apiRouter.post('/batch-save', async (req: Request, res: Response) => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'operations must be an array' });
    }

    const changes: { [collection: string]: CollectionItem[] } = {};
    const results: any[] = [];

    for (const op of operations) {
      const { collection, data, operation, id } = op;

      if (!isValidCollection(collection)) {
        return res.status(400).json({ error: `Invalid collection: ${collection}` });
      }

      const keyField = getKeyField(collection);

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

    const writeResults: { [key: string]: boolean } = {};
    for (const [collection, data] of Object.entries(changes)) {
      const success = await writeCollection(collection, data);
      writeResults[collection] = success;
      if (!success) {
        console.error(`Failed to write ${collection} - check permissions on ${DATA_DIR}/${collection}.json`);
        return res.status(500).json({
          error: `Failed to save ${collection}. Please check server logs for permission issues.`,
          writeResults
        });
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Batch save: ${operations.length} documents`);
    }
    res.json({ results, writeResults });
  } catch (error: any) {
    console.error('Batch save failed:', error.message);
    res.status(500).json({ error: `Batch save failed: ${error.message}` });
  }
});

// Get list of uploaded images
apiRouter.get('/uploaded-images', async (req: Request, res: Response) => {
  const images = await listUploadedImages();
  res.json(images);
});

// Image upload endpoint
apiRouter.post('/upload-background', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    res.json({ success: true, imagePath });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reports API Proxy endpoint
apiRouter.get('/reports-proxy/*', async (req: Request, res: Response) => {
  try {
    const reportPath = req.params[0];
    const queryString = req.url.split('?')[1] || '';

    const targetUrl = `https://tickets.revival.com/reports/${reportPath}${queryString ? '?' + queryString : ''}`;

    console.log('Proxying reports request to:', targetUrl);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': req.headers.authorization || '',
        'Accept': 'text/csv,application/csv,text/plain',
        'User-Agent': 'River-Winner-App/1.0'
      }
    });

    const body = await response.text();

    res.status(response.status);
    res.set({
      'Content-Type': response.headers.get('content-type') || 'text/csv',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type'
    });
    res.send(body);

  } catch (error: any) {
    console.error('Reports proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch report: ' + error.message });
  }
});

apiRouter.options('/reports-proxy/*', (req: Request, res: Response) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400'
  });
  res.sendStatus(204);
});

// MinistryPlatform: Get events
apiRouter.post('/mp/events', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { searchTerm, daysPast, daysFuture } = req.body;

    const mp = getMPInstance();
    if (!mp) {
      return res.status(400).json({
        error: 'MinistryPlatform credentials not configured.'
      });
    }

    let filter = '';
    let eventResults: any[] = [];

    if (searchTerm) {
      filter = `Event_Title LIKE '%${searchTerm}%'`;
    } else if (daysPast !== undefined || daysFuture !== undefined) {
      const pastDays = daysPast || 7;
      const futureDays = daysFuture || 30;

      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - pastDays);
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + futureDays);

      const pastDateStr = pastDate.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      filter = `Event_Start_Date >= '${pastDateStr}' AND Event_Start_Date <= '${futureDateStr}'`;
    }

    if (filter) {
      const options = {
        select: 'Event_ID, Event_Title, Event_Start_Date',
        filter: filter,
        orderBy: 'Event_Start_Date DESC'
      };

      const result = await mp.getEvents(options);

      if (result && 'error' in result) {
        console.error('MP API Error:', result.error);
        throw new Error(result.error.message || 'Failed to fetch events');
      }

      eventResults = Array.isArray(result) ? result : [];

      if (eventResults && eventResults.length > 0) {
        console.log('Event fields available:', Object.keys(eventResults[0]));
      }
    }

    res.json({
      success: true,
      events: eventResults || [],
      count: eventResults ? eventResults.length : 0
    });

  } catch (error: any) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events: ' + error.message });
  }
});

// MinistryPlatform: Get available queries
apiRouter.get('/mp/queries', async (req: Request, res: Response) => {
  try {
    const mpConfigPath = path.join(DATA_DIR, 'mp.json');
    const mpConfig = await fs.readFile(mpConfigPath, 'utf-8');
    const config = JSON.parse(mpConfig);

    res.json({
      success: true,
      queries: config.map((q: any) => ({
        id: q.id,
        name: q.name,
        description: q.description,
        category: q.metadata?.category,
        params: q.params
      }))
    });
  } catch (error: any) {
    console.error('Error reading MP queries:', error);
    res.status(500).json({ error: 'Failed to read MP queries: ' + error.message });
  }
});

// MinistryPlatform: Execute query
apiRouter.post('/mp/execute', strictLimiter, async (req: Request, res: Response) => {
  try {
    const { queryId, params } = req.body;

    const mpConfigPath = path.join(DATA_DIR, 'mp.json');
    const mpConfig = await fs.readFile(mpConfigPath, 'utf-8');
    const config = JSON.parse(mpConfig);

    const query = config.find((q: any) => q.id === queryId);
    if (!query) {
      return res.status(404).json({ error: `Query '${queryId}' not found` });
    }

    const mp = getMPInstance();
    if (!mp) {
      return res.status(400).json({
        error: 'MinistryPlatform credentials not configured. Please add MP_USERNAME and MP_PASSWORD to .env file.'
      });
    }

    let filter = query.filter || '';
    if (query.params) {
      for (const [key, paramConfig] of Object.entries(query.params as Record<string, any>)) {
        const value = params && params[key] ? params[key] : '';

        if (value) {
          filter = filter.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
          console.log(`Replaced {{${key}}} with: ${value}`);
        } else if (paramConfig.required) {
          return res.status(400).json({
            error: `Missing required parameter: ${key}`,
            details: `The query requires ${paramConfig.label || key} to be provided`
          });
        }
      }
    }

    const tableName = query.table;
    const camelCaseTable = tableName.replace(/_([a-z])/gi, (match: string, letter: string) => letter.toUpperCase());
    const methodName = `get${camelCaseTable}` as keyof MPInstance;

    console.log(`Table: ${tableName}, Method: ${methodName}`);

    const mpMethod = mp[methodName] as any;
    if (typeof mpMethod !== 'function') {
      return res.status(400).json({ error: `Invalid table name: ${tableName} (method: ${methodName})` });
    }

    const queryOptions: any = {};
    if (query.select) queryOptions.select = query.select;
    if (filter) queryOptions.filter = filter;
    if (query.distinct) queryOptions.distinct = true;

    console.log(`Executing MP query: ${queryId}`, queryOptions);

    const results = await mpMethod(queryOptions);

    if ('error' in results) {
      console.error('MP API Error:', results.error);
      return res.status(500).json({ error: `MP API Error: ${results.error.message || 'Unknown error'}` });
    }

    const rawData = Array.isArray(results) ? results : [];

    // De-duplicate results by contactId (keep first occurrence)
    const seenContactIds = new Set<number>();
    const data = rawData.filter((record: any) => {
      const contactId = record.contactId || record.contactID;
      if (!contactId || seenContactIds.has(contactId)) {
        return false;
      }
      seenContactIds.add(contactId);
      return true;
    });

    if (rawData.length !== data.length) {
      console.log(`De-duplicated results: ${rawData.length} -> ${data.length} (removed ${rawData.length - data.length} duplicates)`);
    }

    // Process records with missing idCard
    const recordsToUpdate: Array<{ contactID: number; idCard: string }> = [];

    for (const record of data) {
      if ('idCard' in record && (record.idCard === null || record.idCard === '')) {
        const contactId = record.contactId || record.contactID;
        if (contactId) {
          const generatedIdCard = `A-${contactId}`;
          record.idCard = generatedIdCard;
          recordsToUpdate.push({ contactID: Number(contactId), idCard: generatedIdCard });
        } else {
          console.warn('Record missing contactId, cannot generate idCard:', record);
        }
      }
    }

    if (recordsToUpdate.length > 0) {
      updateMissingIdCards(mp, recordsToUpdate).catch(err => {
        console.error('Background idCard update failed:', err);
      });
    }

    res.json({
      success: true,
      data: data,
      count: data.length
    });

  } catch (error: any) {
    console.error('Error executing MP query:', error);
    res.status(500).json({ error: 'Failed to execute MP query: ' + error.message });
  }
});

// Texting API endpoint
apiRouter.post('/texting', strictLimiter, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Texting endpoint called:', req.body.action);
  }
  try {
    const { action, data } = req.body;

    let result: any;

    switch (action) {
      case 'sendMessage':
        result = await sendMessage(data);
        break;

      case 'getMessageReport':
        result = await getMessageReport(data);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    res.json(result);

  } catch (error: any) {
    console.error('Texting error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred'
    });
  }
});

// ============================================
// GENERIC COLLECTION ROUTES - MUST BE LAST!
// ============================================

// GET all documents from a collection
apiRouter.get('/:collection', async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;

    if (!isValidCollection(collection)) {
      return res.status(400).json({ error: `Invalid collection: ${collection}` });
    }

    const data = await readCollection(collection);
    res.json(data);
  } catch (error: any) {
    console.error('Error in GET /:collection:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single document from a collection
apiRouter.get('/:collection/:id', async (req: Request, res: Response) => {
  try {
    const { collection, id } = req.params;

    if (!isValidCollection(collection)) {
      return res.status(400).json({ error: `Invalid collection: ${collection}` });
    }

    const data = await readCollection(collection);
    const keyField = getKeyField(collection);

    const item = data.find(d => d[keyField] === id);
    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(item);
  } catch (error: any) {
    console.error('Error in GET /:collection/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST new document to a collection
apiRouter.post('/:collection', async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;

    if (!isValidCollection(collection)) {
      return res.status(400).json({ error: `Invalid collection: ${collection}` });
    }

    const newItem = req.body;
    const keyField = getKeyField(collection);

    console.log(`POST /${collection}:`, { keyField, newItem });

    if (!newItem[keyField]) {
      newItem[keyField] = uuidv4();
    }

    let data: CollectionItem[];
    try {
      data = await readCollection(collection);
    } catch (readError: any) {
      console.error(`Failed to read ${collection} for POST operation:`, readError);
      return res.status(500).json({
        error: `Failed to read existing ${collection} data. Not saving to prevent data loss.`,
        details: readError.message
      });
    }

    if (collection === 'settings') {
      console.log(`Updating setting: ${newItem[keyField]} = ${JSON.stringify(newItem.value)}`);
      console.log(`Current settings count before update: ${data.length}`);

      const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
      if (existingIndex >= 0) {
        data[existingIndex] = { ...data[existingIndex], ...newItem };
      } else {
        data.push(newItem);
      }

      console.log(`Settings count after update: ${data.length}`);
    } else {
      const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
      if (existingIndex >= 0) {
        data[existingIndex] = newItem;
      } else {
        data.push(newItem);
      }
    }

    const writeSuccess = await writeCollection(collection, data);
    if (!writeSuccess) {
      return res.status(500).json({ error: `Failed to write ${collection} data` });
    }

    res.json({ success: true, id: newItem[keyField] });
  } catch (error: any) {
    console.error('Error in POST /:collection:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update document in a collection
apiRouter.put('/:collection/:id', async (req: Request, res: Response) => {
  try {
    const { collection, id } = req.params;

    if (!isValidCollection(collection)) {
      return res.status(400).json({ error: `Invalid collection: ${collection}` });
    }

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
  } catch (error: any) {
    console.error('Error in PUT /:collection/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE document from a collection
apiRouter.delete('/:collection/:id', async (req: Request, res: Response) => {
  try {
    const { collection, id } = req.params;

    if (!isValidCollection(collection)) {
      return res.status(400).json({ error: `Invalid collection: ${collection}` });
    }

    const keyField = getKeyField(collection);

    const data = await readCollection(collection);
    const index = data.findIndex(d => d[keyField] === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Not found' });
    }

    data.splice(index, 1);
    await writeCollection(collection, data);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /:collection/:id:', error);
    res.status(500).json({ error: error.message });
  }
});
