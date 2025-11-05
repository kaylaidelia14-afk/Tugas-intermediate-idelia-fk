// src/scripts/utils/indexeddb.js
const DB_NAME = 'StoryAppDB';
const DB_VERSION = 2; // Increment untuk ensure favorites store dibuat

export async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      
      // Store untuk offline stories
      if (!db.objectStoreNames.contains('offlineStories')) {
        const storyStore = db.createObjectStore('offlineStories', { keyPath: 'id' });
        storyStore.createIndex('synced', 'synced', { unique: false });
        storyStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // Store untuk cached stories dari API
      if (!db.objectStoreNames.contains('cachedStories')) {
        const cacheStore = db.createObjectStore('cachedStories', { keyPath: 'id', autoIncrement: false });
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Store untuk favorite stories (bookmark) - tambah di version 2
      if (!db.objectStoreNames.contains('favorites')) {
        const favStore = db.createObjectStore('favorites', { keyPath: 'id', autoIncrement: false });
        favStore.createIndex('savedAt', 'savedAt', { unique: false });
      } else if (oldVersion < 2) {
        // Jika store sudah ada tapi index belum ada, tambahkan index
        const favStore = event.target.transaction.objectStore('favorites');
        if (!favStore.indexNames.contains('savedAt')) {
          favStore.createIndex('savedAt', 'savedAt', { unique: false });
        }
      }
    };
  });
}

export async function getAllOfflineStories() {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineStories', 'readonly');
    const store = tx.objectStore('offlineStories');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error getting offline stories:', err);
    return [];
  }
}

export async function getUnsyncedStories() {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineStories', 'readonly');
    const store = tx.objectStore('offlineStories');
    
    // Get all stories and filter for unsynced ones
    // IndexedDB getAll() on index doesn't accept boolean directly
    const allStories = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    return allStories.filter(story => story.synced === false || !story.synced);
  } catch (err) {
    console.error('Error getting unsynced stories:', err);
    return [];
  }
}

export async function markStoryAsSynced(id) {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineStories', 'readwrite');
    const store = tx.objectStore('offlineStories');
    
    // Get story first
    const story = await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (story) {
      story.synced = true;
      await new Promise((resolve, reject) => {
        const request = store.put(story);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch (err) {
    console.error('Error marking story as synced:', err);
  }
}

export async function deleteStory(id) {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineStories', 'readwrite');
    const store = tx.objectStore('offlineStories');
    
    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error deleting story:', err);
    throw err;
  }
}

export async function cacheStories(stories) {
  try {
    const db = await openDB();
    const tx = db.transaction('cachedStories', 'readwrite');
    const store = tx.objectStore('cachedStories');
    
    // Clear old cache
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Add new stories with timestamp
    const timestamp = Date.now();
    for (const story of stories) {
      await new Promise((resolve, reject) => {
        const request = store.add({ ...story, timestamp });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch (err) {
    console.error('Error caching stories:', err);
  }
}

export async function getCachedStories() {
  try {
    const db = await openDB();
    const tx = db.transaction('cachedStories', 'readonly');
    const store = tx.objectStore('cachedStories');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error getting cached stories:', err);
    return [];
  }
}

// Create operation - Add story to IndexedDB
export async function addOfflineStory(storyData) {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineStories', 'readwrite');
    const store = tx.objectStore('offlineStories');
    
    // Ensure story has required fields
    const offlineStory = {
      id: storyData.id || Date.now().toString(),
      description: storyData.description,
      photo: storyData.photo,
      photoName: storyData.photoName || 'photo.jpg',
      photoType: storyData.photoType || 'image/jpeg',
      lat: storyData.lat || null,
      lon: storyData.lon || null,
      createdAt: storyData.createdAt || new Date().toISOString(),
      synced: storyData.synced || false,
    };
    
    await new Promise((resolve, reject) => {
      const request = store.add(offlineStory);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return offlineStory;
  } catch (err) {
    console.error('Error adding offline story:', err);
    throw err;
  }
}

// ========== FAVORITES (BOOKMARK) OPERATIONS ==========

// Add story to favorites (bookmark)
export async function addFavorite(story) {
  try {
    const db = await openDB();
    
    // Ensure favorites store exists
    if (!db.objectStoreNames.contains('favorites')) {
      console.error('[indexeddb] Favorites store does not exist. DB may need upgrade.');
      throw new Error('Favorites store tidak tersedia. Silakan refresh halaman.');
    }
    
    const tx = db.transaction('favorites', 'readwrite');
    const store = tx.objectStore('favorites');
    
    const favorite = {
      id: story.id,
      name: story.name || '',
      description: story.description || '',
      photoUrl: story.photoUrl || story.photo || '',
      createdAt: story.createdAt || new Date().toISOString(),
      lat: story.lat || null,
      lon: story.lon || null,
      savedAt: new Date().toISOString(), // When user saved it
    };
    
    await new Promise((resolve, reject) => {
      const request = store.put(favorite); // Use put to allow update
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return favorite;
  } catch (err) {
    console.error('Error adding favorite:', err);
    throw err;
  }
}

// Remove story from favorites (unbookmark)
export async function removeFavorite(storyId) {
  try {
    const db = await openDB();
    
    // Check if favorites store exists
    if (!db.objectStoreNames.contains('favorites')) {
      console.warn('[indexeddb] Favorites store does not exist');
      return; // Silently return if store doesn't exist
    }
    
    const tx = db.transaction('favorites', 'readwrite');
    const store = tx.objectStore('favorites');
    
    // Wrap IDBRequest in Promise
    return new Promise((resolve, reject) => {
      const request = store.delete(storyId);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        console.error('[indexeddb] Error in removeFavorite request:', request.error);
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Error removing favorite:', err);
    throw err;
  }
}

// Check if story is favorited
export async function isFavorite(storyId) {
  try {
    const db = await openDB();
    
    // Check if favorites store exists
    if (!db.objectStoreNames.contains('favorites')) {
      return false;
    }
    
    const tx = db.transaction('favorites', 'readonly');
    const store = tx.objectStore('favorites');
    
    const favorite = await new Promise((resolve, reject) => {
      const request = store.get(storyId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return !!favorite;
  } catch (err) {
    console.error('Error checking favorite:', err);
    return false;
  }
}

// Get all favorite stories
export async function getAllFavorites() {
  try {
    const db = await openDB();
    
    // Check if favorites store exists
    if (!db.objectStoreNames.contains('favorites')) {
      console.warn('[indexeddb] Favorites store does not exist yet');
      return [];
    }
    
    const tx = db.transaction('favorites', 'readonly');
    const store = tx.objectStore('favorites');
    
    // Wrap IDBRequest in Promise
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const result = request.result;
        // Ensure result is an array
        if (!Array.isArray(result)) {
          console.warn('[indexeddb] getAllFavorites returned non-array:', typeof result, result);
          resolve([]);
        } else {
          resolve(result);
        }
      };
      
      request.onerror = () => {
        console.error('[indexeddb] Error in getAllFavorites request:', request.error);
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('Error getting favorites:', err);
    // Return empty array on any error
    return [];
  }
}

