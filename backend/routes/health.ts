import express from 'express';
import type { Request, Response } from 'express';

export const healthRouter = express.Router();

// Health check endpoint
healthRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
