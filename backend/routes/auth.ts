import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';

export const authRouter = express.Router();

// Simple in-memory session store (for production, use Redis or database)
const sessions = new Map<string, { username: string; createdAt: number }>();

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

// Generate secure session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Clean expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_DURATION) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

// Login endpoint
authRouter.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    console.error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env');
    return res.status(500).json({ error: 'Server authentication not configured' });
  }

  if (username === validUser && password === validPass) {
    const token = generateSessionToken();
    sessions.set(token, { username, createdAt: Date.now() });

    // Set secure cookie
    res.cookie('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION
    });

    return res.json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// Logout endpoint
authRouter.post('/logout', (req: Request, res: Response) => {
  const token = req.cookies?.session;

  if (token) {
    sessions.delete(token);
  }

  res.clearCookie('session');
  return res.json({ success: true });
});

// Check session endpoint
authRouter.get('/session', (req: Request, res: Response) => {
  const token = req.cookies?.session;

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  const session = sessions.get(token);

  if (!session || Date.now() - session.createdAt > SESSION_DURATION) {
    sessions.delete(token);
    res.clearCookie('session');
    return res.status(401).json({ authenticated: false });
  }

  return res.json({ authenticated: true, username: session.username });
});

// Export sessions map for use in middleware
export { sessions, SESSION_DURATION };
