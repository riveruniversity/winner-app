import express from 'express';
import type { Request, Response } from 'express';

export const reportsProxyRouter = express.Router();

// Reports API Proxy endpoint
reportsProxyRouter.get('/reports-proxy/*', async (req: Request, res: Response) => {
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

reportsProxyRouter.options('/reports-proxy/*', (req: Request, res: Response) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400'
  });
  res.sendStatus(204);
});
