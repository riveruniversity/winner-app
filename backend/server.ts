import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';

import { ROOT_DIR, DIST_DIR, UPLOADS_DIR, PORT } from './config.js';
import { ensureDataDir } from './services/collection.js';
import { apiRouter } from './routes/router.js';
import {
  corsMiddleware,
  helmetMiddleware,
  generalLimiter,
  basicAuth,
  securityHeaders
} from './middleware.js';

// Load environment variables
dotenv.config();

const app = express();

// Apply middleware
app.use(corsMiddleware);
app.use(helmetMiddleware);
app.use('/api', generalLimiter);
app.use('/api', basicAuth);
app.use(express.json({ limit: '50mb' }));
app.use(securityHeaders);

// Create main router
const mainRouter = express.Router();

// Mount API router
mainRouter.use('/api', apiRouter);

// Serve uploaded images
mainRouter.use('/uploads', express.static(UPLOADS_DIR));

// Serve static files from dist
mainRouter.use(express.static(DIST_DIR));

// Route for scanner page
mainRouter.get('/scan', (req: Request, res: Response) => {
  res.sendFile(path.join(DIST_DIR, 'scan.html'));
});

// Route for conditions page
mainRouter.get('/conditions', (req: Request, res: Response) => {
  res.sendFile(path.join(ROOT_DIR, 'conditions.html'));
});

// Catch-all route for SPA
mainRouter.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Mount the main router at both root and /win paths
app.use('/', mainRouter);
app.use('/win', mainRouter);

async function startServer(): Promise<void> {
  await ensureDataDir();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
