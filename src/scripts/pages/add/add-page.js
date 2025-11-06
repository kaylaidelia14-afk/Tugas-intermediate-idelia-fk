// src/scripts/pages/add/add-page.js
import API from '../../data/api.js';
import CONFIG from '../../config.js';
import { openDB } from '../../utils/indexeddb.js';

export default class AddPage {
  async render() {
    return `
      <section class="container">
        <h1>Tambah Story Baru</h1>
        
        <div id="addNotice" class="notice" aria-live="polite"></div>
        
        <form id="addStoryForm" class="form-add" novalidate>
          <div class="form-group">
            <label for="description">Deskripsi Story</label>
            <textarea 
              id="description" 
              name="description" 
              rows="4" 
              required 
              placeholder="Tuliskan deskripsi story Anda..."
              aria-required="true"></textarea>
          </div>
          
          <div class="form-group" style="margin-top:12px">
            <label for="photo">Foto</label>
            <input 
              type="file" 
              id="photo" 
              name="photo" 
              accept="image/*" 
              required 
              aria-required="true"
              aria-describedby="photoHelp" />
            <small id="photoHelp" style="display:block;margin-top:4px;color:#666">
              Format yang didukung: JPG, PNG, GIF. Maksimal 1MB.
            </small>
          </div>
          
          <div class="form-group" style="margin-top:12px">
            <label for="includeLocation">
              <input type="checkbox" id="includeLocation" />
              Sertakan lokasi GPS
            </label>
            <small style="display:block;margin-top:4px;color:#666">
              Centang untuk menambahkan koordinat GPS. Pilih lokasi dengan klik di peta atau gunakan GPS saat ini.
            </small>
          </div>
          
          <div id="locationPicker" style="display:none;margin-top:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <label style="font-weight:bold">Pilih Lokasi di Peta:</label>
              <button type="button" id="useCurrentLocation" style="padding:6px 12px;background:#4caf50;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">
                Gunakan Lokasi Saat Ini
              </button>
            </div>
            <div id="locationMap" style="height:300px;width:100%;border:2px solid #ddd;border-radius:8px;margin-bottom:8px"></div>
            <div id="locationInfo" style="padding:8px;background:#e3f2fd;border-radius:6px">
              <small><strong>Koordinat yang dipilih:</strong> <span id="currentLatLon">Belum dipilih. Klik di peta untuk memilih lokasi.</span></small>
            </div>
          </div>
          
          <button type="submit" id="submitBtn" style="margin-top:16px" aria-label="Simpan story baru">
            Simpan Story
          </button>
        </form>
        
        <div id="offlineStories" style="margin-top:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h2 style="margin:0">Story Offline (Belum Tersinkronisasi)</h2>
            <button 
              id="syncBtn" 
              style="padding:6px 12px;background:#6c63ff;color:#fff;border:none;border-radius:6px;cursor:pointer"
              aria-label="Sinkronisasi story offline">
              Sinkronisasi
            </button>
          </div>
          
          <!-- Filter, Sort, Search Controls -->
          <div style="margin-bottom:16px;padding:12px;background:#f5f5f5;border-radius:8px">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
              <div>
                <label for="searchOffline" style="display:block;margin-bottom:4px;font-size:14px;font-weight:bold">Cari:</label>
                <input 
                  type="text" 
                  id="searchOffline" 
                  placeholder="Cari deskripsi..." 
                  style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px"
                  aria-label="Cari story offline">
              </div>
              <div>
                <label for="sortOffline" style="display:block;margin-bottom:4px;font-size:14px;font-weight:bold">Urutkan:</label>
                <select 
                  id="sortOffline" 
                  style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px"
                  aria-label="Urutkan story offline">
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                  <option value="description-asc">Deskripsi A-Z</option>
                  <option value="description-desc">Deskripsi Z-A</option>
                </select>
              </div>
              <div>
                <label for="filterOffline" style="display:block;margin-bottom:4px;font-size:14px;font-weight:bold">Filter:</label>
                <select 
                  id="filterOffline" 
                  style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px"
                  aria-label="Filter story offline">
                  <option value="all">Semua</option>
                  <option value="with-location">Dengan Lokasi</option>
                  <option value="no-location">Tanpa Lokasi</option>
                </select>
              </div>
            </div>
            <div id="offlineStats" style="font-size:12px;color:#666;margin-top:8px"></div>
          </div>
          
          <div id="offlineList" role="list" aria-label="Daftar story offline"></div>
        </div>
      </section>
    `;
  }
  
  async afterRender() {
    const form = document.getElementById('addStoryForm');
    const submitBtn = document.getElementById('submitBtn');
    const noticeEl = document.getElementById('addNotice');
    const photoInput = document.getElementById('photo');
    const includeLocationCheck = document.getElementById('includeLocation');
    const locationInfo = document.getElementById('locationInfo');
    const offlineList = document.getElementById('offlineList');
    
    if (!form || !submitBtn || !noticeEl) return;
    
    // Cek apakah sudah login
    const token = localStorage.getItem('authToken');
    if (!token) {
      noticeEl.innerHTML = '<p>Silakan <a href="#/login">login</a> terlebih dahulu untuk menambah story.</p>';
      form.style.display = 'none';
      return;
    }
    
    let currentLocation = null;
    let locationMap = null;
    let locationMarker = null;
    const currentLatLon = document.getElementById('currentLatLon');
    
    // Helper untuk update location marker
    const updateLocationMarker = (latlng) => {
      if (!locationMap) return;
      
      // Remove existing marker
      if (locationMarker) {
        locationMap.removeLayer(locationMarker);
      }
      
      // Add new marker at clicked location
      locationMarker = L.marker(latlng, {
        draggable: true,
        title: 'Lokasi yang dipilih'
      }).addTo(locationMap);
      
      // Update location when marker is dragged
      locationMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        currentLocation = { lat, lon: lng };
        if (currentLatLon) {
          currentLatLon.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
      });
      
      // Add popup
      locationMarker.bindPopup(`Lokasi: ${latlng[0].toFixed(6)}, ${latlng[1].toFixed(6)}`).openPopup();
    };
    
    // Handler untuk checkbox lokasi
    if (includeLocationCheck) {
      includeLocationCheck.addEventListener('change', async (e) => {
        const locationPicker = document.getElementById('locationPicker');
        const locationMapEl = document.getElementById('locationMap');
        const useCurrentLocationBtn = document.getElementById('useCurrentLocation');
        
        if (e.target.checked) {
          locationPicker.style.display = 'block';
          
          // Initialize map jika belum ada
          if (!locationMap && locationMapEl && typeof L !== 'undefined') {
            // Default center ke Indonesia atau current location jika tersedia
            const defaultCenter = [-2.5489, 118.0149]; // Indonesia center
            locationMap = L.map(locationMapEl).setView(defaultCenter, 5);
            
            L.tileLayer(
              (CONFIG?.MAP?.TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
              { maxZoom: 19, attribution: (CONFIG?.MAP?.ATTRIBUTION || '&copy; OpenStreetMap') }
            ).addTo(locationMap);
            
            // Try to get current location and center map
            try {
              const currentPos = await this.#getCurrentLocation();
              if (currentPos) {
                locationMap.setView([currentPos.lat, currentPos.lon], 13);
                currentLocation = currentPos;
                updateLocationMarker([currentPos.lat, currentPos.lon]);
                if (currentLatLon) {
                  currentLatLon.textContent = `${currentPos.lat.toFixed(6)}, ${currentPos.lon.toFixed(6)}`;
                }
              }
            } catch (err) {
              console.warn('[add] Could not get current location:', err);
            }
            
            // Add click handler untuk pilih lokasi di peta
            locationMap.on('click', (e) => {
              const { lat, lng } = e.latlng;
              currentLocation = { lat, lon: lng };
              updateLocationMarker([lat, lng]);
              if (currentLatLon) {
                currentLatLon.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
              }
            });
          }
          
          // Handler untuk tombol "Gunakan Lokasi Saat Ini"
          if (useCurrentLocationBtn) {
            // Remove old listener jika ada
            const newBtn = useCurrentLocationBtn.cloneNode(true);
            useCurrentLocationBtn.parentNode.replaceChild(newBtn, useCurrentLocationBtn);
            
            newBtn.addEventListener('click', async () => {
              try {
                const pos = await this.#getCurrentLocation();
                if (pos && locationMap) {
                  locationMap.setView([pos.lat, pos.lon], 13);
                  currentLocation = pos;
                  updateLocationMarker([pos.lat, pos.lon]);
                  if (currentLatLon) {
                    currentLatLon.textContent = `${pos.lat.toFixed(6)}, ${pos.lon.toFixed(6)}`;
                  }
                  noticeEl.textContent = '';
                }
              } catch (err) {
                noticeEl.innerHTML = `<p class="error">Gagal mengambil lokasi: ${err.message}</p>`;
              }
            });
          }
        } else {
          locationPicker.style.display = 'none';
          currentLocation = null;
          if (locationMarker) {
            locationMap.removeLayer(locationMarker);
            locationMarker = null;
          }
        }
      });
    }
    
    // Handler submit form
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const description = document.getElementById('description').value.trim();
      const photo = photoInput?.files?.[0];
      
      if (!description || !photo) {
        noticeEl.innerHTML = '<p class="error">Deskripsi dan foto wajib diisi.</p>';
        return;
      }
      
      if (photo.size > 1024 * 1024) {
        noticeEl.innerHTML = '<p class="error">Ukuran foto maksimal 1MB.</p>';
        return;
      }
      
      submitBtn.disabled = true;
      noticeEl.textContent = 'Menyimpan story...';
      noticeEl.setAttribute('aria-busy', 'true');
      
      const storyData = {
        description,
        photo,
        lat: includeLocationCheck?.checked && currentLocation ? currentLocation.lat : null,
        lon: includeLocationCheck?.checked && currentLocation ? currentLocation.lon : null,
      };
      
      // Clear location picker setelah submit
      if (locationMap && locationMarker) {
        locationMap.removeLayer(locationMarker);
        locationMarker = null;
      }
      
      try {
        // Cek koneksi online
        if (navigator.onLine) {
          await this.#saveStoryOnline(storyData);
          noticeEl.innerHTML = '<p style="color:green">Story berhasil disimpan!</p>';
          form.reset();
          locationInfo.style.display = 'none';
          currentLocation = null;
          
          // Reload offline list
          await this.#loadOfflineStories();
          
          // Redirect ke home setelah 1.5 detik
          setTimeout(() => {
            location.hash = '#/home';
          }, 1500);
        } else {
          // Simpan ke IndexedDB untuk sync nanti
          await this.#saveStoryOffline(storyData);
          noticeEl.innerHTML = '<p style="color:orange">Story disimpan offline. Akan disinkronisasi saat online.</p>';
          form.reset();
          locationInfo.style.display = 'none';
          currentLocation = null;
          await this.#loadOfflineStories();
        }
      } catch (err) {
        console.error('[add] error:', err);
        
        // Jika gagal online, simpan ke offline
        if (navigator.onLine && err.message.includes('network') || err.message.includes('fetch')) {
          try {
            await this.#saveStoryOffline(storyData);
            noticeEl.innerHTML = '<p style="color:orange">Gagal menyimpan online. Story disimpan offline untuk sinkronisasi nanti.</p>';
            form.reset();
            locationInfo.style.display = 'none';
            currentLocation = null;
            await this.#loadOfflineStories();
          } catch (offlineErr) {
            noticeEl.innerHTML = `<p class="error">Gagal menyimpan: ${err.message}</p>`;
          }
        } else {
          noticeEl.innerHTML = `<p class="error">Gagal menyimpan: ${err.message}</p>`;
        }
      } finally {
        submitBtn.disabled = false;
        noticeEl.removeAttribute('aria-busy');
      }
    });
    
    // Load offline stories
    await this.#loadOfflineStories();
    
    // Setup filter, sort, and search event listeners
    const searchInput = document.getElementById('searchOffline');
    const sortSelect = document.getElementById('sortOffline');
    const filterSelect = document.getElementById('filterOffline');
    
    const reloadOfflineStories = () => {
      this.#loadOfflineStories();
    };
    
    if (searchInput) {
      searchInput.addEventListener('input', reloadOfflineStories);
    }
    if (sortSelect) {
      sortSelect.addEventListener('change', reloadOfflineStories);
    }
    if (filterSelect) {
      filterSelect.addEventListener('change', reloadOfflineStories);
    }
    
    // Setup sync button
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        if (!navigator.onLine) {
          alert('Anda sedang offline. Sinkronisasi memerlukan koneksi internet.');
          return;
        }
        
        syncBtn.disabled = true;
        syncBtn.textContent = 'Menyinkronisasi...';
        
        try {
          const { syncOfflineStories } = await import('../../utils/sync.js');
          const result = await syncOfflineStories();
          
          if (result.success && result.synced > 0) {
            alert(`${result.synced} story berhasil disinkronisasi!`);
            await this.#loadOfflineStories();
          } else if (result.success && result.synced === 0) {
            alert('Tidak ada story yang perlu disinkronisasi.');
          } else {
            alert(`Sinkronisasi gagal: ${result.error || 'Unknown error'}`);
          }
        } catch (err) {
          console.error('Sync error:', err);
          alert(`Error: ${err.message}`);
        } finally {
          syncBtn.disabled = false;
          syncBtn.textContent = 'Sinkronisasi';
        }
      });
    }
  }
  
  async #getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung oleh browser'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        (err) => {
          reject(new Error('Tidak dapat mengambil lokasi GPS'));
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    });
  }
  
  async #saveStoryOnline({ description, photo, lat, lon }) {
    const token = localStorage.getItem('authToken');
    const BASE = CONFIG.BASE_URL.replace(/\/+$/, '');
    
    const formData = new FormData();
    formData.append('description', description);
    formData.append('photo', photo);
    if (lat != null && lon != null) {
      formData.append('lat', lat);
      formData.append('lon', lon);
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
    
    return data;
  }
  
  async #saveStoryOffline(storyData) {
    const db = await openDB();
    const tx = db.transaction('offlineStories', 'readwrite');
    const store = tx.objectStore('offlineStories');
    
    // Convert File to base64 untuk storage
    const photoBase64 = await this.#fileToBase64(storyData.photo);
    
    const offlineStory = {
      id: Date.now().toString(),
      description: storyData.description,
      photo: photoBase64,
      photoName: storyData.photo.name,
      photoType: storyData.photo.type,
      lat: storyData.lat,
      lon: storyData.lon,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    
    await store.add(offlineStory);
    return offlineStory;
  }
  
  async #loadOfflineStories() {
    const offlineList = document.getElementById('offlineList');
    if (!offlineList) return;
    
    try {
      // Use the utility function that properly handles IndexedDB queries
      const { getUnsyncedStories } = await import('../../utils/indexeddb.js');
      let stories = await getUnsyncedStories();
      
      // Apply search filter
      const searchInput = document.getElementById('searchOffline');
      const searchTerm = searchInput?.value?.toLowerCase() || '';
      if (searchTerm) {
        stories = stories.filter(story => 
          story.description?.toLowerCase().includes(searchTerm)
        );
      }
      
      // Apply location filter
      const filterSelect = document.getElementById('filterOffline');
      const filterValue = filterSelect?.value || 'all';
      if (filterValue === 'with-location') {
        stories = stories.filter(story => story.lat && story.lon);
      } else if (filterValue === 'no-location') {
        stories = stories.filter(story => !story.lat || !story.lon);
      }
      
      // Apply sorting
      const sortSelect = document.getElementById('sortOffline');
      const sortValue = sortSelect?.value || 'newest';
      stories.sort((a, b) => {
        switch (sortValue) {
          case 'newest':
            return new Date(b.createdAt) - new Date(a.createdAt);
          case 'oldest':
            return new Date(a.createdAt) - new Date(b.createdAt);
          case 'description-asc':
            return (a.description || '').localeCompare(b.description || '');
          case 'description-desc':
            return (b.description || '').localeCompare(a.description || '');
          default:
            return 0;
        }
      });
      
      // Update stats
      const statsEl = document.getElementById('offlineStats');
      if (statsEl) {
        const { getUnsyncedStories: getAllUnsynced } = await import('../../utils/indexeddb.js');
        const totalStories = await getAllUnsynced();
        statsEl.textContent = `Menampilkan ${stories.length} dari ${totalStories.length} story offline`;
      }
      
      if (stories.length === 0) {
        offlineList.innerHTML = '<p>Tidak ada story offline yang sesuai dengan filter.</p>';
        return;
      }
      
      offlineList.innerHTML = stories.map((story) => `
        <article class="offline-story-item" role="listitem" style="border:1px solid #ddd;padding:12px;margin:8px 0;border-radius:8px;background:#fff">
          <p><strong>${this.#escape(story.description)}</strong></p>
          <small>Dibuat: ${new Date(story.createdAt).toLocaleString()}</small>
          ${story.lat && story.lon ? `<small style="display:block;margin-top:4px">Lokasi: ${story.lat.toFixed(6)}, ${story.lon.toFixed(6)}</small>` : ''}
          <button 
            data-id="${story.id}" 
            class="delete-offline-btn" 
            style="margin-top:8px;padding:6px 12px;background:#dc3545;color:#fff;border:none;border-radius:4px;cursor:pointer"
            aria-label="Hapus story offline">
            Hapus
          </button>
        </article>
      `).join('');
      
      // Add delete handlers
      offlineList.querySelectorAll('.delete-offline-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (confirm('Hapus story offline ini?')) {
            try {
              const { deleteStory } = await import('../../utils/indexeddb.js');
              await deleteStory(id);
              await this.#loadOfflineStories();
            } catch (err) {
              console.error('Error deleting offline story:', err);
              alert('Gagal menghapus story');
            }
          }
        });
      });
    } catch (err) {
      console.error('Error loading offline stories:', err);
      offlineList.innerHTML = '<p>Error memuat story offline.</p>';
    }
  }
  
  #fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  #escape(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}

