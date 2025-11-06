// src/scripts/utils/push-notification.js
import CONFIG from '../config.js';

// Debug: log CONFIG saat module di-load
console.log('[push-notification] Module loaded. CONFIG.VAPID_PUBLIC_KEY:', CONFIG.VAPID_PUBLIC_KEY ? CONFIG.VAPID_PUBLIC_KEY.substring(0, 20) + '...' : 'MISSING');

// Cache untuk menghindari fetch berulang
let vapidKeyCache = null;
let vapidKeyFetchAttempted = false;

// Flag untuk detect CORS issue - jika CORS error, skip server calls di masa depan
let corsErrorDetected = false;

// Get VAPID public key from API
export async function getVapidPublicKey() {
  // Debug: log CONFIG saat function dipanggil
  console.log('[push] getVapidPublicKey called. CONFIG:', CONFIG);
  console.log('[push] CONFIG.VAPID_PUBLIC_KEY type:', typeof CONFIG.VAPID_PUBLIC_KEY);
  console.log('[push] CONFIG.VAPID_PUBLIC_KEY value:', CONFIG.VAPID_PUBLIC_KEY);
  
  // Check config first (fastest, no network)
  if (CONFIG.VAPID_PUBLIC_KEY && CONFIG.VAPID_PUBLIC_KEY.trim() !== '') {
    console.log('[push] ✅ VAPID key found in CONFIG:', CONFIG.VAPID_PUBLIC_KEY.substring(0, 20) + '...');
    return CONFIG.VAPID_PUBLIC_KEY;
  }
  
  console.warn('[push] ❌ CONFIG.VAPID_PUBLIC_KEY is empty or undefined');
  
  // Return cached result (null if already tried and failed)
  if (vapidKeyFetchAttempted) {
    return vapidKeyCache;
  }
  
  // Mark as attempted to prevent multiple fetches
  vapidKeyFetchAttempted = true;
  
  // Try API endpoint with proper error handling
  try {
    const BASE = CONFIG.BASE_URL.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // Very short timeout
    
    try {
      // Use fetch with immediate catch to prevent console error
      const fetchPromise = fetch(`${BASE}/vapid-public-key`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        },
        // Add cache control to potentially reduce requests
        cache: 'default'
      });
      
      // Wrap in Promise.race with timeout to fail fast
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 1000)
      );
      
      const res = await Promise.race([fetchPromise.catch(() => null), timeoutPromise.catch(() => null)]);
      clearTimeout(timeoutId);
      
      if (res && res.ok) {
        try {
          const data = await res.json();
          if (data.publicKey) {
            vapidKeyCache = data.publicKey;
            return vapidKeyCache;
          }
        } catch (e) {
          // Invalid JSON - silent
        }
      }
      // If 404 or other error, cache null result
      vapidKeyCache = null;
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      // Silent - don't log, cache null
      vapidKeyCache = null;
    }
  } catch (err) {
    // Silent - all errors ignored, cache null
    vapidKeyCache = null;
  }
  
  // Return cached null if no key found
  return vapidKeyCache;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[push] Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('[push] Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

export async function subscribeToPush(registration) {
  if (!registration) {
    throw new Error('Service Worker registration not available');
  }
  
  try {
    // Get VAPID key - check CONFIG first before calling function
    let vapidPublicKey = CONFIG.VAPID_PUBLIC_KEY;
    
    if (!vapidPublicKey || vapidPublicKey.trim() === '') {
      console.log('[push] CONFIG.VAPID_PUBLIC_KEY not found, trying getVapidPublicKey()...');
      vapidPublicKey = await getVapidPublicKey();
    } else {
      console.log('[push] ✅ Using VAPID key from CONFIG directly');
    }
    
    if (!vapidPublicKey) {
      console.error('[push] ❌ VAPID public key tidak ditemukan. Pastikan CONFIG.VAPID_PUBLIC_KEY di-set di config.js');
      // Return null instead of throwing - let caller handle gracefully
      return null;
    }
    
    console.log('[push] Converting VAPID key...');
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    
    console.log('[push] Subscribing to push...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });
    
    console.log('[push] ✅ Successfully subscribed to push');
    return subscription;
  } catch (error) {
    console.error('[push] ❌ Failed to subscribe:', error);
    // Return null instead of throwing
    return null;
  }
}

export async function unsubscribeFromPush(registration) {
  if (!registration) {
    return false;
  }
  
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[push] Unsubscribed from push');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[push] Failed to unsubscribe:', error);
    return false;
  }
}

export async function getPushSubscription(registration) {
  if (!registration) {
    return null;
  }
  
  try {
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[push] Failed to get subscription:', error);
    return null;
  }
}

export async function sendSubscriptionToServer(subscription) {
  // Skip server call jika CORS error sudah terdeteksi sebelumnya
  if (corsErrorDetected) {
    console.log('[push] ℹ️ Skipping server subscription (CORS issue detected). Push notification tetap berfungsi secara lokal.');
    return null;
  }
  
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.log('[push] ℹ️ User not authenticated, skipping server subscription');
    return null; // Return null instead of throwing - allow local subscription
  }
  
  const BASE = CONFIG.BASE_URL.replace(/\/+$/, '');
  const subscriptionJSON = subscription.toJSON();
  
  try {
    const res = await fetch(`${BASE}/stories/subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: subscriptionJSON.endpoint,
        keys: subscriptionJSON.keys,
      }),
    });
    
    if (!res.ok) {
      // Don't throw for 404 or other errors - allow local subscription to work
      const data = await res.json().catch(() => ({}));
      console.log(`[push] ℹ️ Server subscription failed (HTTP ${res.status}). Push notification tetap berfungsi secara lokal.`);
      return null; // Return null but don't throw
    }
    
    const data = await res.json().catch(() => ({}));
    console.log('[push] ✅ Subscription sent to server successfully');
    return data;
  } catch (error) {
    // Check if it's a CORS error
    const isCorsError = error.message.includes('CORS') || 
                       error.message.includes('fetch') || 
                       error.message.includes('Failed to fetch');
    
    if (isCorsError) {
      // Mark CORS error untuk skip future calls
      corsErrorDetected = true;
      console.log('[push] ℹ️ CORS error terdeteksi: Server tidak mengizinkan request dari localhost.');
      console.log('[push] ℹ️ Push notification tetap berfungsi secara lokal. Server calls akan di-skip untuk session ini.');
    } else {
      console.log('[push] ℹ️ Failed to send subscription to server:', error.message);
    }
    // Return null instead of throwing - allow local subscription to work
    return null;
  }
}

export async function removeSubscriptionFromServer() {
  // Skip server call jika CORS error sudah terdeteksi sebelumnya
  if (corsErrorDetected) {
    console.log('[push] ℹ️ Skipping server unsubscription (CORS issue detected).');
    return false;
  }
  
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.log('[push] ℹ️ User not authenticated, skipping server unsubscription');
    return false; // Return false instead of throwing
  }
  
  const BASE = CONFIG.BASE_URL.replace(/\/+$/, '');
  
  try {
    const res = await fetch(`${BASE}/stories/subscription`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!res.ok) {
      // Don't throw for 404 or other errors
      const data = await res.json().catch(() => ({}));
      console.log(`[push] ℹ️ Server unsubscription failed (HTTP ${res.status}).`);
      return false; // Return false but don't throw
    }
    
    console.log('[push] ✅ Subscription removed from server');
    return true;
  } catch (error) {
    // Check if it's a CORS error
    const isCorsError = error.message.includes('CORS') || 
                       error.message.includes('fetch') || 
                       error.message.includes('Failed to fetch');
    
    if (isCorsError) {
      // Mark CORS error untuk skip future calls
      corsErrorDetected = true;
      console.log('[push] ℹ️ CORS error terdeteksi. Server calls akan di-skip untuk session ini.');
    } else {
      console.log('[push] ℹ️ Failed to remove subscription from server:', error.message);
    }
    // Return false instead of throwing
    return false;
  }
}

