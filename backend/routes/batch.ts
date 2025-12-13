import express from 'express';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { DATA_DIR, isValidCollection, getKeyField, CollectionItem } from '../config.js';
import { readCollection, writeCollection } from '../services/collection.js';

export const batchRouter = express.Router();

// Batch endpoint for fetching multiple collections at once
batchRouter.post('/batch', async (req: Request, res: Response) => {
  try {
    const { requests } = req.body;
    if (!Array.isArray(requests)) {
      return res.status(400).json({ error: 'requests must be an array' });
    }

    const results: { [key: string]: any; } = {};

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
batchRouter.post('/batch-save', async (req: Request, res: Response) => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'operations must be an array' });
    }

    const changes: { [collection: string]: CollectionItem[]; } = {};
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

    const writeResults: { [key: string]: boolean; } = {};
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
