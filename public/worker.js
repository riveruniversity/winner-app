const CACHE_NAME = 'winner-selection-app-v1.1.0';
const STATIC_CACHE_NAME = 'winner-app-static-v1';
const DYNAMIC_CACHE_NAME = 'winner-app-dynamic-v1';

// Files to cache immediately (production paths)
// NOTE: Built assets (JS/CSS with hashes) are cached dynamically when requested
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './favicon.png',
  './icons/icon-192x192.svg',
  './icons/icon-512x512.svg',
  // Sound files
  './sounds/applause.mp3',
  './sounds/drum-roll.mp3', 
  './sounds/sting-rimshot-drum-roll.mp3',
  // Bootstrap CSS
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  // Bootstrap Icons
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Open+Sans:wght@300;400;600;700&family=Lato:wght@300;400;700&family=Poppins:wght@300;400;500;600;700&display=swap',
  // Toastify CSS
  'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css',
  // Bootstrap JS
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  // Toastify JS - FIXED URL
  'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.js'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(async (cache) => {
        console.log('[Service Worker] Caching static files');

        // Cache files individually to handle failures gracefully
        const cachePromises = STATIC_FILES.map(async (url) => {
          try {
            await cache.add(url);
            console.log(`[Service Worker] Cached: ${url}`);
            return { url, success: true };
          } catch (error) {
            console.warn(`[Service Worker] Failed to cache: ${url}`, error);
            return { url, success: false, error };
          }
        });

        // Also try to preload common build assets if they exist
        // This helps with initial loading in production
        const buildAssets = [
          './assets/index.js', // Common patterns
          './assets/index.css',
          './assets/css/index.css'
        ];

        const buildAssetPromises = buildAssets.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
              console.log(`[Service Worker] Preloaded build asset: ${url}`);
              return { url, success: true };
            }
            return { url, success: false, error: 'Not found' };
          } catch (error) {
            // It's okay if build assets don't exist - they'll be cached when requested
            console.log(`[Service Worker] Build asset not available: ${url}`);
            return { url, success: false, error };
          }
        });

        const [staticResults, buildResults] = await Promise.all([
          Promise.all(cachePromises),
          Promise.all(buildAssetPromises)
        ]);

        const failed = staticResults.filter(r => !r.success);
        const succeeded = staticResults.filter(r => r.success);

        console.log(`[Service Worker] Successfully cached ${succeeded.length}/${STATIC_FILES.length} static files`);

        if (failed.length > 0) {
          console.warn('[Service Worker] Failed to cache static files:', failed.map(f => f.url));

          // Don't fail installation for missing development files - they don't exist in production
          console.log('[Service Worker] Some files failed to cache, but installation will continue');
        }

        return cache;
      })
      .then(() => {
        console.log('[Service Worker] Installation completed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
        throw error; // This will prevent the service worker from installing
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

// Helper function to check if a request is for Firebase
function isFirebaseRequest(url) {
  return url.includes('firestore.googleapis.com') || url.includes('firebaseinstallations.googleapis.com');
}

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // IMPORTANT: Bypass Firebase requests immediately
  if (isFirebaseRequest(request.url)) {
    return event.respondWith(fetch(request));
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension requests
  if (request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Skip blob and data URLs
  if (request.url.startsWith('blob:') || request.url.startsWith('data:')) {
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
    console.error('[Service Worker] Fetch error for:', request.url, error);

    // Return offline fallback for HTML pages
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE_NAME);
      const fallback = await cache.match('./index.html');
      if (fallback) {
        return fallback;
      }
    }

    // For other requests, return a simple error response
    return new Response('Network error occurred', {
      status: 408,
      statusText: 'Network Error',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Cache first strategy
async function cacheFirst(request) {
  try {
    // Skip caching for chrome-extension requests
    if (request.url.startsWith('chrome-extension://')) {
      return fetch(request);
    }

    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('[Service Worker] Serving from cache:', request.url);
      return cachedResponse;
    }

    console.log('[Service Worker] Fetching from network:', request.url);
    const networkResponse = await fetch(request);

    // Cache successful responses (but not chrome-extension URLs)
    if (networkResponse.status === 200 && !request.url.startsWith('chrome-extension://')) {
      try {
        const responseClone = networkResponse.clone();
        await cache.put(request, responseClone);
        
        // Log successful caching of built assets for debugging
        if (request.url.includes('/assets/')) {
          console.log('[Service Worker] Successfully cached built asset:', request.url);
        }
      } catch (cacheError) {
        console.warn('[Service Worker] Failed to cache response for:', request.url, cacheError);
        // Continue even if caching fails
      }
    } else if (networkResponse.status !== 200) {
      console.warn('[Service Worker] Non-200 response for:', request.url, 'Status:', networkResponse.status);
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Cache first error:', error);
    throw error;
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    // Skip caching for chrome-extension requests
    if (request.url.startsWith('chrome-extension://')) {
      return fetch(request);
    }

    console.log('[Service Worker] Network first for:', request.url);
    const networkResponse = await fetch(request);

    // Cache successful responses (but not chrome-extension URLs)
    if (networkResponse.status === 200 && !request.url.startsWith('chrome-extension://')) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      const responseClone = networkResponse.clone();
      cache.put(request, responseClone);
    }

    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);

    // Skip cache fallback for chrome-extension requests
    if (request.url.startsWith('chrome-extension://')) {
      throw error;
    }

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
  const staticExtensions = ['.html', '.css', '.js', '.json', '.ico', '.png', '.svg', '.mp3'];
  const staticPaths = [
    './index.html',
    './manifest.json', 
    './favicon.ico',
    './favicon.png',
    // Assets folder (Vite builds JS/CSS here with hashes) - cache these aggressively
    './assets/',
    '/assets/', // Also match absolute paths
    './icons/',
    './sounds/'
  ];

  // Normalize URL for consistent matching
  const normalizedUrl = url.replace(/^https?:\/\/[^\/]+/, ''); // Remove domain
  
  // Check if URL matches any static path patterns
  const matchesStaticPath = staticPaths.some(path => {
    return normalizedUrl.includes(path) || url.includes(path);
  });
  
  const hasStaticExtension = staticExtensions.some(ext => normalizedUrl.endsWith(ext));
  
  // Consider files in assets folder as static (these are the built JS/CSS files)
  const isAssetFile = (normalizedUrl.includes('/assets/') || normalizedUrl.includes('./assets/')) && 
                     (normalizedUrl.includes('.js') || normalizedUrl.includes('.css'));
  
  // Debug logging for asset files
  if (isAssetFile) {
    console.log('[Service Worker] Detected asset file:', url, 'normalized:', normalizedUrl);
  }
  
  return matchesStaticPath || hasStaticExtension || isAssetFile;
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
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
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
    // This is a placeholder for future enhancement where we might
    // sync data with a backend server

    // For now, just notify that we're online
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        message: 'Data sync completed successfully'
      });
    });

    console.log('[Service Worker] Winner data sync completed');
  } catch (error) {
    console.error('[Service Worker] Error syncing winner data:', error);
  }
}

// Handle push notifications (future enhancement)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push message received:', event);

  let notificationData = {
    title: 'Winner Selection App',
    body: 'You have a new notification',
    icon: './images/favicon.ico',
    badge: './images/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: './images/favicon.ico'
      },
      {
        action: 'close',
        title: 'Close',
        icon: './images/favicon.ico'
      }
    ]
  };

  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received:', event);

  event.notification.close();

  if (event.action === 'open' || !event.action) {
    // Open the app
    event.waitUntil(
      clients.matchAll().then(clientList => {
        // Check if app is already open
        for (let client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // If not open, open it
        if (clients.openWindow) {
          return clients.openWindow('./index.html');
        }
      })
    );
  }
});

// Network status change handling
self.addEventListener('online', () => {
  console.log('[Service Worker] App is back online');
  // Trigger background sync
  self.registration.sync.register('winner-data-sync');
});

self.addEventListener('offline', () => {
  console.log('[Service Worker] App is now offline');
});

// Log service worker errors
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

// Log unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled promise rejection:', event.reason);
  // Prevent the default behavior (logging to console)
  event.preventDefault();
});

// Cleanup function for periodic maintenance
async function performMaintenance() {
  try {
    // Clean up old cache entries
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const requests = await cache.keys();

    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime();
          if (responseDate < oneWeekAgo) {
            await cache.delete(request);
            console.log('[Service Worker] Cleaned up old cache entry:', request.url);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Service Worker] Error during maintenance:', error);
  }
}

// Perform maintenance on install
self.addEventListener('install', (event) => {
  event.waitUntil(performMaintenance());
});

console.log('[Service Worker] Service Worker script loaded successfully');