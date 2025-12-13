import express from 'express';
import type { Request, Response } from 'express';

import { sendMessage, getMessageReport } from '../services/texting.js';
import { strictLimiter } from '../middleware.js';

export const textingRouter = express.Router();

// Texting API endpoint
textingRouter.post('/texting', strictLimiter, async (req: Request, res: Response) => {
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
