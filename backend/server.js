import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..'); // Project root directory
const DIST_DIR = path.join(ROOT_DIR, 'dist'); // Dist folder (contains everything after build)
const DATA_DIR = path.join(ROOT_DIR, 'data'); // Data folder
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// Set Content Security Policy and cache headers
app.use((req, res, next) => {
    // Only set CSP for HTML pages, not API calls
    if (!req.path.includes('/api/')) {
        res.setHeader('Content-Security-Policy', "default-src 'self' https:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net https://*.gstatic.com https://unpkg.com; " +
            "worker-src 'self' blob:; " +
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
            "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' https:; " +
            "frame-src 'none'; " +
            "object-src 'none'; " +
            "base-uri 'self';");
        // Force cache refresh for HTML files to break PWA cache
        if (req.path.endsWith('.html') || req.path === '/' || req.path === '/win' || req.path === '/win/') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Clear-Site-Data', '"cache", "storage"');
        }
    }
    next();
});
// Serve static files from dist (includes all built assets and public files)
app.use(express.static(DIST_DIR));
app.use('/win', express.static(DIST_DIR));
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    }
    catch {
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
    }
    catch (error) {
        console.error(`Error reading ${collection}:`, error);
        return [];
    }
}
async function writeCollection(collection, data) {
    try {
        const filePath = path.join(DATA_DIR, `${collection}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    }
    catch (error) {
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
// Create API router for all API endpoints
const apiRouter = express.Router();
// Health check endpoint
apiRouter.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
// Batch endpoint for fetching multiple collections at once
apiRouter.post('/batch', async (req, res) => {
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
                }
                else {
                    // Fetch entire collection
                    const data = await readCollection(collection);
                    results[collection] = data;
                }
            }
            catch (error) {
                results[collection] = { error: error.message };
            }
        }
        res.json(results);
    }
    catch (error) {
        console.error('Error in batch endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});
// Batch save endpoint for saving multiple documents at once (atomic)
apiRouter.post('/batch-save', async (req, res) => {
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
            if (!data)
                continue;
            if (!data[keyField]) {
                data[keyField] = uuidv4();
            }
            if (!changes[collection]) {
                changes[collection] = await readCollection(collection);
            }
            const existingIndex = changes[collection].findIndex(d => d[keyField] === data[keyField]);
            if (existingIndex >= 0) {
                changes[collection][existingIndex] = data;
            }
            else {
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
    }
    catch (error) {
        console.error('Batch save failed:', error.message);
        res.status(500).json({ error: `Batch save failed: ${error.message}` });
    }
});
// Collection routes
apiRouter.get('/:collection', async (req, res) => {
    try {
        const { collection } = req.params;
        const data = await readCollection(collection);
        res.json(data);
    }
    catch (error) {
        console.error('Error in GET /:collection:', error);
        res.status(500).json({ error: error.message });
    }
});
apiRouter.get('/:collection/:id', async (req, res) => {
    try {
        const { collection, id } = req.params;
        const data = await readCollection(collection);
        const keyField = getKeyField(collection);
        const item = data.find(d => d[keyField] === id);
        if (!item) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json(item);
    }
    catch (error) {
        console.error('Error in GET /:collection/:id:', error);
        res.status(500).json({ error: error.message });
    }
});
// Reports API Proxy endpoint - to avoid CORS issues
apiRouter.get('/reports-proxy/*', async (req, res) => {
    try {
        // Extract the path after /reports-proxy/
        const reportPath = req.params[0];
        const queryString = req.url.split('?')[1] || '';
        // Build the target URL
        const targetUrl = `https://tickets.revival.com/reports/${reportPath}${queryString ? '?' + queryString : ''}`;
        console.log('Proxying reports request to:', targetUrl);
        // Forward the request to tickets.revival.com
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Authorization': req.headers.authorization || '',
                'Accept': 'text/csv,application/csv,text/plain',
                'User-Agent': 'River-Winner-App/1.0'
            }
        });
        // Get the response body
        const body = await response.text();
        // Forward the response back to the client
        res.status(response.status);
        res.set({
            'Content-Type': response.headers.get('content-type') || 'text/csv',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        });
        res.send(body);
    }
    catch (error) {
        console.error('Reports proxy error:', error);
        res.status(500).json({ error: 'Failed to fetch report: ' + error.message });
    }
});
// Handle OPTIONS requests for CORS preflight
apiRouter.options('/reports-proxy/*', (req, res) => {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400'
    });
    res.sendStatus(204);
});
// EZ Texting API endpoint
apiRouter.post('/ez-texting', async (req, res) => {
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
                }
                catch (e) {
                    responseData = responseText;
                }
                // Log result concisely
                if (ezTextingResponse.ok) {
                    console.log(`SMS sent successfully: ${responseData.id}`);
                }
                else {
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
                }
                catch (e) {
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
        }
        catch (logError) {
            console.error('Failed to save EZ Texting log:', logError);
        }
        res.json(result);
    }
    catch (error) {
        console.error('EZ Texting error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'An unexpected error occurred'
        });
    }
});
apiRouter.post('/:collection', async (req, res) => {
    try {
        const { collection } = req.params;
        const newItem = req.body;
        const keyField = getKeyField(collection);
        if (!newItem[keyField]) {
            newItem[keyField] = uuidv4();
        }
        const data = await readCollection(collection);
        if (collection === 'settings') {
            const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
            if (existingIndex >= 0) {
                data[existingIndex] = { ...data[existingIndex], ...newItem };
            }
            else {
                data.push(newItem);
            }
        }
        else {
            const existingIndex = data.findIndex(d => d[keyField] === newItem[keyField]);
            if (existingIndex >= 0) {
                data[existingIndex] = newItem;
            }
            else {
                data.push(newItem);
            }
        }
        await writeCollection(collection, data);
        res.json({ success: true, id: newItem[keyField] });
    }
    catch (error) {
        console.error('Error in POST /:collection:', error);
        res.status(500).json({ error: error.message });
    }
});
apiRouter.put('/:collection/:id', async (req, res) => {
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
    }
    catch (error) {
        console.error('Error in PUT /:collection/:id:', error);
        res.status(500).json({ error: error.message });
    }
});
apiRouter.delete('/:collection/:id', async (req, res) => {
    try {
        const { collection, id } = req.params;
        const keyField = getKeyField(collection);
        const data = await readCollection(collection);
        const index = data.findIndex(d => d[keyField] === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Not found' });
        }
        data.splice(index, 1);
        await writeCollection(collection, data);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error in DELETE /:collection/:id:', error);
        res.status(500).json({ error: error.message });
    }
});
// Mount the API router at both /api and /win/api for flexibility
// This allows the app to work from any base path
app.use('/api', apiRouter);
app.use('/win/api', apiRouter);
// Route for scanner page
app.get('/scan', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'scan.html'));
});
// Route for /win/scan
app.get('/win/scan', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'scan.html'));
});
// Route for conditions page
app.get('/conditions', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'conditions.html'));
});
// Route for /win/conditions
app.get('/win/conditions', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'conditions.html'));
});
// Handle win routes
app.get('/win/*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
});
// Catch-all route for SPA - handle both root and /win paths
app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
});
async function startServer() {
    await ensureDataDir();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Data stored in: ${DATA_DIR}`);
    });
}
startServer().catch(console.error);
//# sourceMappingURL=server.js.map