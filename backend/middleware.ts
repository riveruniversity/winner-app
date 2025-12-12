import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// CORS configuration - whitelist allowed origins
const allowedOrigins = [
  'https://win.revival.com',
  'https://revival.com',
  /\.revival\.com$/,  // all revival.com subdomains
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001'
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, mobile apps)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed =>
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true
});

// Security headers (skip CSP since we have custom one below)
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false
});

// Rate limiting - general: 100 requests per minute
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting - strict: 10 requests per minute for sensitive endpoints
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests to sensitive endpoint' },
  standardHeaders: true,
  legacyHeaders: false
});

// Basic authentication middleware
export function basicAuth(req: Request, res: Response, next: NextFunction) {
  // Skip auth for health check endpoint
  if (req.path === '/api/health') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Winner App"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    console.error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env');
    return res.status(500).json({ error: 'Server authentication not configured' });
  }

  if (username === validUser && password === validPass) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Winner App"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
}

// Content Security Policy and cache headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Only set CSP for HTML pages, not API calls
  if (!req.path.includes('/api/')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' https:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net https://*.gstatic.com https://unpkg.com; " +
      "worker-src 'self' blob:; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
      "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https:; " +
      "frame-src 'none'; " +
      "object-src 'none'; " +
      "base-uri 'self';"
    );

    // Force cache refresh for HTML files to break PWA cache
    if (req.path.endsWith('.html') || req.path === '/' || req.path === '/win' || req.path === '/win/') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Clear-Site-Data', '"cache", "storage"');
    }
  }
  next();
}
