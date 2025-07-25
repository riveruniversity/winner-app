const CACHE_NAME = 'winner-selection-app-v1.0.0';
const STATIC_CACHE_NAME = 'winner-app-static-v1';
const DYNAMIC_CACHE_NAME = 'winner-app-dynamic-v1';

// Files to cache immediately
const STATIC_FILES = [
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    // Bootstrap CSS
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    // Bootstrap Icons
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    // Google Fonts
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    // Toastify CSS
    'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css',
    // Bootstrap JS
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    // Toastify JS
    'https://cdn.jsdelivr.net/npm/toastify-js'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('[Service Worker] Static files cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Error caching static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            // Delete old caches that don't match current version
                            return cacheName !== STATIC_CACHE_NAME && 
                                   cacheName !== DYNAMIC_CACHE_NAME;
                        })
                        .map((cacheName) => {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip requests with cache control headers that prevent caching
    if (request.headers.get('cache-control') === 'no-cache') {
        return;
    }
    
    event.respondWith(
        handleFetch(request)
    );
});

async function handleFetch(request) {
    const url = new URL(request.url);
    
    try {
        // Strategy 1: Cache first for static files
        if (isStaticFile(request.url)) {
            return await cacheFirst(request);
        }
        
        // Strategy 2: Network first for dynamic content (CDN files)
        if (isCDNFile(request.url)) {
            return await networkFirst(request);
        }
        
        // Strategy 3: Cache first with network fallback for everything else
        return await cacheFirst(request);
        
    } catch (error) {
        console.error('[Service Worker] Fetch error:', error);
        
        // Return offline fallback for HTML pages
        if (request.destination === 'document') {
            const cache = await caches.open(STATIC_CACHE_NAME);
            return await cache.match('./index.html');
        }
        
        // For other requests, just let them fail
        throw error;
    }
}

// Cache first strategy
async function cacheFirst(request) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        console.log('[Service Worker] Serving from cache:', request.url);
        return cachedResponse;
    }
    
    console.log('[Service Worker] Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        cache.put(request, responseClone);
    }
    
    return networkResponse;
}

// Network first strategy
async function networkFirst(request) {
    try {
        console.log('[Service Worker] Network first for:', request.url);
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            const responseClone = networkResponse.clone();
            cache.put(request, responseClone);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', request.url);
        
        // Fallback to cache
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

// Helper functions
function isStaticFile(url) {
    const staticExtensions = ['.html', '.css', '.js', '.json'];
    const staticFiles = ['./index.html', './styles.css', './app.js', './manifest.json'];
    
    return staticFiles.some(file => url.includes(file)) ||
           staticExtensions.some(ext => url.endsWith(ext));
}

function isCDNFile(url) {
    const cdnDomains = [
        'cdn.jsdelivr.net',
        'fonts.googleapis.com',
        'fonts.gstatic.com'
    ];
    
    return cdnDomains.some(domain => url.includes(domain));
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Background sync for when connectivity is restored
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync triggered:', event.tag);
    
    if (event.tag === 'winner-data-sync') {
        event.waitUntil(
            syncWinnerData()
        );
    }
});

// Sync winner data when connectivity is restored
async function syncWinnerData() {
    console.log('[Service Worker] Syncing winner data...');
    
    try {
        // Open IndexedDB and check for any pending sync operations
        // This is a placeholder for future enhancement
        console.log('[Service Worker] Winner data sync completed');
    } catch (error) {
        console.error('[Service Worker] Error syncing winner data:', error);
    }
}

// Handle push notifications (future enhancement)
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push message received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'Winner Selection App notification',
        icon: './icon-192.png',
        badge: './icon-96.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Open App',
                icon: './icon-192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: './icon-192.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Winner Selection App', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification click received:', event);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        // Open the app
        event.waitUntil(
            clients.openWindow('./index.html')
        );
    }
});

// Log service worker errors
self.addEventListener('error', (event) => {
    console.error('[Service Worker] Error:', event.error);
});

// Log unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
    console.error('[Service Worker] Unhandled promise rejection:', event.reason);
});

console.log('[Service Worker] Service Worker script loaded successfully');