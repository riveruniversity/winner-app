import express from 'express';

import { healthRouter } from './health.js';
import { authRouter } from './auth.js';
import { batchRouter } from './batch.js';
import { uploadsRouter } from './uploads.js';
import { reportsProxyRouter } from './reports-proxy.js';
import { mpRouter } from './mp.js';
import { textingRouter } from './texting.js';
import { collectionsRouter } from './collections.js';

export const apiRouter = express.Router();

// Mount all route modules
apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(batchRouter);
apiRouter.use(uploadsRouter);
apiRouter.use(reportsProxyRouter);
apiRouter.use(mpRouter);
apiRouter.use(textingRouter);

// Generic collection routes MUST be last (uses wildcard path params)
apiRouter.use(collectionsRouter);
