// Service Worker untuk PWA
const CACHE_NAME = 'story-app-v1';

// Get base path dari service worker location
const getBasePath = () => {
  // Service worker file location (misal: /Tugas-intermediate-idelia-fk/sw.js)
  const swPath = self.location.pathname;
  console.log('[SW] Service Worker pathname:', swPath);
  
  // Extract base path dari path service worker
  // Jika path = /Tugas-intermediate-idelia-fk/sw.js, base = /Tugas-intermediate-idelia-fk
  if (swPath.includes('/Tugas-intermediate-idelia-fk/')) {
    return '/Tugas-intermediate-idelia-fk';
  }
  
  // Fallback: extract dari path
  const pathParts = swPath.split('/').filter(p => p && p !== 'sw.js' && p !== '');
  if (pathParts.length > 0) {
    return '/' + pathParts.join('/');
  }
  return '';
};

// App Shell - file utama yang perlu di-cache untuk offline
// Path akan di-resolve saat install event
let APP_SHELL = [];

// Install event - cache App Shell
self.addEventListener('install', (event) => {
  console.log('[SW] Install event - Caching App Shell');
  
  // Determine base path
  const basePath = getBasePath();
  console.log('[SW] Base path:', basePath);
  
  // Define App Shell files dengan base path
  const appShellFiles = [
    `${basePath}/index.html`,
    `${basePath}/app.css`,
    `${basePath}/app.bundle.js`,
    `${basePath}/favicon.png`,
    `${basePath}/images/logo.png`,
    `${basePath}/manifest.json`,
  ];
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching App Shell files:', appShellFiles);
        // Cache App Shell files dengan fetch untuk error handling yang lebih baik
        return Promise.allSettled(
          appShellFiles.map(url => {
            return fetch(url)
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                } else {
                  console.warn(`[SW] Failed to cache ${url}: HTTP ${response.status}`);
                  return null;
                }
              })
              .catch(err => {
                console.warn(`[SW] Failed to cache ${url}:`, err.message);
                // Continue even if one file fails
                return null;
              });
          })
        );
      })
      .then((results) => {
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        console.log(`[SW] App Shell cached: ${successCount}/${appShellFiles.length} files`);
      })
      .catch((err) => {
        console.error('[SW] Cache install error:', err);
      })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - Network First strategy untuk data dinamis, Cache First untuk static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // API requests - Network First dengan fallback ke cache
  if (url.pathname.startsWith('/v1/stories') || url.pathname.includes('/stories')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response untuk cache
          const responseClone = response.clone();
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline - return dari cache
          return caches.match(request).then((response) => {
            if (response) {
              return response;
            }
            // Jika tidak ada di cache, return offline response
            return new Response(
              JSON.stringify({ error: true, message: 'Offline: Data tidak tersedia' }),
              {
                headers: { 'Content-Type': 'application/json' },
              }
            );
          });
        })
    );
    return;
  }
  
  // HTML requests - Network First dengan fallback ke cached App Shell
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful HTML responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline - return cached index.html (App Shell)
          const basePath = getBasePath();
          console.log('[SW] Offline - returning cached App Shell from:', `${basePath}/index.html`);
          
          // Try multiple fallback paths
          return caches.match(`${basePath}/index.html`)
            .then((response) => {
              if (response) {
                console.log('[SW] Found cached index.html');
                return response;
              }
              // Try root path
              return caches.match(`${basePath}/`)
                .then((fallback) => {
                  if (fallback) {
                    console.log('[SW] Found cached root');
                    return fallback;
                  }
                  // Try without base path
                  return caches.match('/index.html')
                    .then((rootFallback) => {
                      if (rootFallback) {
                        console.log('[SW] Found cached root index.html');
                        return rootFallback;
                      }
                      // Last resort - return basic HTML
                      console.warn('[SW] No cached App Shell found');
                      return new Response('<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>Aplikasi sedang offline</h1><p>Silakan cek koneksi internet Anda.</p></body></html>', { 
                        status: 200,
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                      });
                    });
                });
            });
        })
    );
    return;
  }
  
  // Static assets (CSS, JS, images) - Cache First
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          }).catch(() => {
            // Ignore cache errors
          });
          return response;
        }).catch(() => {
          // Network error - return cached version if available
          return caches.match(request);
        });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Story App', body: event.data.text() };
    }
  }
  
  // Dynamic notification from server data
  const title = data.title || data.notification?.title || 'Story App';
  const body = data.body || data.notification?.body || data.message || 'Anda mendapat notifikasi baru';
  const icon = data.icon || data.notification?.icon || '/images/logo.png';
  const image = data.image || data.notification?.image;
  const badge = data.badge || '/images/logo.png';
  
  const options = {
    body: body,
    icon: icon,
    badge: badge,
    image: image, // Large image for notification
    data: data.data || data || {},
    tag: data.tag || 'story-notification',
    requireInteraction: data.requireInteraction || false,
    timestamp: data.timestamp || Date.now(),
    vibrate: data.vibrate || [200, 100, 200],
    actions: data.actions || (data.data?.storyId ? [
      {
        action: 'view',
        title: 'Lihat Detail',
        icon: '/images/logo.png',
      },
      {
        action: 'close',
        title: 'Tutup',
      },
    ] : []),
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  const data = event.notification.data;
  
  // Handle action buttons
  if (event.action === 'view' && data.storyId) {
    // Navigate to story detail
    event.waitUntil(
      clients.openWindow(`/#/home?storyId=${data.storyId}`)
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else if (data.storyId) {
    // Default click behavior - navigate to story
    event.waitUntil(
      clients.openWindow(`/#/home?storyId=${data.storyId}`)
    );
  } else {
    // Navigate to home
    event.waitUntil(
      clients.openWindow('/#/home')
    );
  }
});

