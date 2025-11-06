// src/scripts/utils/sync.js
import { getUnsyncedStories, markStoryAsSynced, deleteStory } from './indexeddb.js';
import CONFIG from '../config.js';

export async function syncOfflineStories() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.log('[sync] No auth token, skipping sync');
    return { success: false, error: 'Not authenticated' };
  }
  
  if (!navigator.onLine) {
    console.log('[sync] Offline, skipping sync');
    return { success: false, error: 'Offline' };
  }
  
  const unsyncedStories = await getUnsyncedStories();
  if (unsyncedStories.length === 0) {
    console.log('[sync] No unsynced stories');
    return { success: true, synced: 0 };
  }
  
  console.log(`[sync] Found ${unsyncedStories.length} unsynced stories`);
  
  const BASE = CONFIG.BASE_URL.replace(/\/+$/, '');
  let syncedCount = 0;
  let failedCount = 0;
  
  for (const story of unsyncedStories) {
    try {
      // Convert base64 back to File/Blob
      const photoBlob = await base64ToBlob(story.photo, story.photoType);
      
      const formData = new FormData();
      formData.append('description', story.description);
      formData.append('photo', photoBlob, story.photoName);
      if (story.lat != null && story.lon != null) {
        formData.append('lat', story.lat);
        formData.append('lon', story.lon);
      }
      
      const res = await fetch(`${BASE}/stories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      
      // Mark as synced
      await markStoryAsSynced(story.id);
      syncedCount++;
      console.log(`[sync] Synced story ${story.id}`);
    } catch (error) {
      console.error(`[sync] Failed to sync story ${story.id}:`, error);
      failedCount++;
    }
  }
  
  return {
    success: true,
    synced: syncedCount,
    failed: failedCount,
    total: unsyncedStories.length,
  };
}

function base64ToBlob(base64, mimeType) {
  // Handle both data URL format and plain base64
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType || 'image/jpeg' });
}

// Listen for online event and sync
export function setupAutoSync() {
  window.addEventListener('online', async () => {
    console.log('[sync] Connection restored, syncing offline stories...');
    try {
      const result = await syncOfflineStories();
      if (result.success && result.synced > 0) {
        // Show notification if sync successful
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Sinkronisasi Berhasil', {
            body: `${result.synced} story berhasil disinkronisasi`,
            icon: './public/images/logo.png',
          });
        }
      }
    } catch (error) {
      console.error('[sync] Auto sync error:', error);
    }
  });
}

