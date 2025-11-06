// src/scripts/pages/home/home-page.js
import API from '../../data/api.js'; // pastikan path ini benar
import CONFIG from '../../config.js';
import { getCachedStories, cacheStories, isFavorite, addFavorite, removeFavorite } from '../../utils/indexeddb.js';

export default class HomePage {
  async render() {
    return `
      <section class="container">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h1 style="margin:0">Daftar Story</h1>
          <button 
            id="pushToggleBtn" 
            class="push-toggle-btn" 
            aria-label="Toggle push notification"
            style="padding:8px 16px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer">
            <span id="pushToggleText">📱 Push Off</span>
          </button>
        </div>

        <div id="homeNotice" class="notice" aria-live="polite"></div>

        <!-- Peta -->
        <div id="homeMap" style="height:360px;margin:12px 0;border-radius:12px" aria-label="Peta lokasi story"></div>

        <!-- List -->
        <h2>Daftar Cerita</h2>
        <div id="storyList" class="story-list" role="list"></div>
      </section>
    `;
  }

  async afterRender() {
    const noticeEl = document.getElementById('homeNotice');
    const listEl = document.getElementById('storyList');
    const mapEl = document.getElementById('homeMap');

    // ===== 0) Cek token =====
    const token = CONFIG?.AUTH_TOKEN || localStorage.getItem('authToken');
    if (!token) {
      noticeEl.innerHTML = `
        <p>Untuk melihat data dari API, silakan <a href="#/login">login</a> terlebih dahulu.</p>
      `;
      listEl.innerHTML = '';
      mapEl.innerHTML = '<p role="alert" style="padding:8px">Peta akan tampil setelah login.</p>';
      return;
    }

    // Debug ringan supaya tahu API yang termuat
    try {
      console.debug('[home] API keys =', API && Object.keys(API || {}), 'token?', !!token);
    } catch {}

    // ===== 1) Loading =====
    noticeEl.textContent = 'Loading...';
    noticeEl.setAttribute('aria-busy', 'true');

    // ===== 2) Ambil data stories =====
    let stories = [];
    let isOffline = false;
    
    try {
      // Cek apakah offline atau online
      if (!navigator.onLine) {
        // Ambil dari cache
        const cached = await getCachedStories();
        stories = cached.map(item => {
          const { timestamp, ...story } = item;
          return story;
        });
        isOffline = true;
        if (stories.length > 0) {
          noticeEl.innerHTML = `<p style="color:orange">Mode offline: Menampilkan data cache (${stories.length} story)</p>`;
        } else {
          noticeEl.innerHTML = '<p class="error">Offline dan tidak ada data cache.</p>';
        }
      } else {
        const useAPI =
          API && typeof API.getStories === 'function';

        // fungsi helper untuk fetch langsung (fallback jika API.getStories tidak ada)
        const fetchDirect = async (opts) => {
          const base = (CONFIG?.BASE_URL || 'https://story-api.dicoding.dev/v1').replace(/\/+$/, '');
          const url = new URL(`${base}/stories`);
          url.searchParams.set('page', opts?.page ?? 1);
          url.searchParams.set('size', opts?.size ?? 9);
          if (opts?.location != null) url.searchParams.set('location', opts.location);
          const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || json.error) throw new Error(json.message || `HTTP ${res.status}`);
          return json;
        };

        // 1) coba ambil yang ada koordinat
        const get = useAPI ? API.getStories : fetchDirect;
        const { listStory: withLoc = [] } = await get({ page: 1, size: 9, location: 1 });
        stories = Array.isArray(withLoc) ? withLoc : [];

        // 2) fallback: kalau kosong, ambil tanpa filter lokasi
        if (!stories.length) {
          const { listStory: all = [] } = await get({ page: 1, size: 9, location: 0 });
          stories = Array.isArray(all) ? all : [];
        }
        
        // Cache stories untuk offline access
        if (stories.length > 0) {
          await cacheStories(stories);
        }

        noticeEl.textContent = '';
      }
    } catch (err) {
      console.error('[home] load stories error:', err);
      
      // Jika error dan offline, coba ambil dari cache
      if (!navigator.onLine || err.message.includes('fetch')) {
        try {
          const cached = await getCachedStories();
          stories = cached.map(item => {
            const { timestamp, ...story } = item;
            return story;
          });
          isOffline = true;
          if (stories.length > 0) {
            noticeEl.innerHTML = `<p style="color:orange">Koneksi bermasalah. Menampilkan data cache (${stories.length} story)</p>`;
          } else {
            noticeEl.innerHTML = `<p class="error">Gagal memuat data: ${this.#escape(err.message || 'Unknown error')}</p>`;
          }
        } catch (cacheErr) {
          noticeEl.innerHTML = `<p class="error">Gagal memuat data: ${this.#escape(err.message || 'Unknown error')}</p>`;
        }
      } else {
        noticeEl.innerHTML = `<p class="error">Gagal memuat data: ${this.#escape(err.message || 'Unknown error')}</p>`;
      }
    } finally {
      noticeEl.removeAttribute('aria-busy');
    }
    
    // Handle story detail from URL params (from notification)
    const urlParams = new URLSearchParams(window.location.search);
    const storyId = urlParams.get('storyId');
    
    // ===== 3) Render daftar =====
    if (!stories.length) {
      listEl.innerHTML = `<p>Tidak ada data untuk ditampilkan.</p>`;
    } else {
      // Check favorite status for all stories
      const favoriteStatuses = await Promise.all(
        stories.map(story => isFavorite(story.id))
      );
      
      listEl.innerHTML = stories.map((item, idx) => {
        const isFav = favoriteStatuses[idx];
        return `
        <article class="story-item" role="listitem" data-idx="${idx}" data-story-id="${item.id || idx}" style="position:relative">
          <img src="${item.photoUrl}"
               alt="${item.name ? `${this.#escape(item.name)} - ${item.description ? this.#escape(item.description) : 'Foto story'}` : item.description ? this.#escape(item.description) : 'Foto story'}"
               loading="eager"
               decoding="async"
               style="cursor:pointer"
               onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;640&quot; height=&quot;360&quot;><rect width=&quot;100%&quot; height=&quot;100%&quot; fill=&quot;#eee&quot;/><text x=&quot;50%&quot; y=&quot;50%&quot; dominant-baseline=&quot;middle&quot; text-anchor=&quot;middle&quot; fill=&quot;#999&quot; font-size=&quot;18&quot; font-family=&quot;system-ui&quot;>No Photo</text></svg>')}';" />
          <button 
            class="bookmark-btn" 
            data-story-id="${item.id || idx}"
            data-is-favorite="${isFav}"
            aria-label="${isFav ? 'Hapus dari favorit' : 'Simpan ke favorit'}"
            style="position:absolute;top:8px;right:8px;padding:8px 12px;background:${isFav ? '#f44336' : '#4caf50'};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:16px;z-index:10;box-shadow:0 2px 4px rgba(0,0,0,0.2)"
            onclick="event.stopPropagation()">
            ${isFav ? '❤️ Favorit' : '🤍 Simpan'}
          </button>
          <div class="story-body" style="cursor:pointer">
            <h3 class="story-title">${this.#escape(item.name ?? 'Tanpa Nama')}</h3>
            <p>${this.#escape(item.description ?? '-')}</p>
            <small class="story-meta">
              ${this.#formatDate(item.createdAt)}${this.#latlonText(item.lat, item.lon)}
            </small>
          </div>
        </article>
      `;
      }).join('');
      
      // Add bookmark button handlers
      const bookmarkBtns = listEl.querySelectorAll('.bookmark-btn');
      bookmarkBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const storyId = btn.dataset.storyId;
          const isFav = btn.dataset.isFavorite === 'true';
          const story = stories.find(s => (s.id || stories.indexOf(s)).toString() === storyId.toString());
          
          if (!story) return;
          
          try {
            btn.disabled = true;
            
            if (isFav) {
              // Remove from favorites
              await removeFavorite(story.id);
              btn.dataset.isFavorite = 'false';
              btn.style.background = '#4caf50';
              btn.innerHTML = '🤍 Simpan';
              btn.setAttribute('aria-label', 'Simpan ke favorit');
            } else {
              // Add to favorites
              await addFavorite({
                id: story.id,
                name: story.name,
                description: story.description,
                photoUrl: story.photoUrl,
                createdAt: story.createdAt,
                lat: story.lat,
                lon: story.lon,
              });
              btn.dataset.isFavorite = 'true';
              btn.style.background = '#f44336';
              btn.innerHTML = '❤️ Favorit';
              btn.setAttribute('aria-label', 'Hapus dari favorit');
            }
          } catch (err) {
            console.error('Error toggling favorite:', err);
            alert(`Gagal ${isFav ? 'menghapus' : 'menyimpan'} favorit: ${err.message}`);
          } finally {
            btn.disabled = false;
          }
        });
      });
      
      // Add click handler untuk story cards (untuk map interaction)
      const storyCards = listEl.querySelectorAll('.story-item');
      storyCards.forEach(card => {
        const idx = parseInt(card.dataset.idx);
        const story = stories[idx];
        if (story && story.lat && story.lon) {
          card.addEventListener('click', () => {
            // Find corresponding marker and open popup
            const marker = map._layers[Object.keys(map._layers).find(key => {
              const layer = map._layers[key];
              return layer instanceof L.Marker && 
                     layer.getLatLng().lat === Number(story.lat) && 
                     layer.getLatLng().lng === Number(story.lon);
            })];
            if (marker) {
              marker.openPopup();
              map.flyTo([Number(story.lat), Number(story.lon)], Math.max(map.getZoom(), 11), { duration: 0.6 });
            }
          });
        }
      });
    }

    // ===== 4) Peta + marker (Leaflet) =====
    if (!window.L) {
      mapEl.innerHTML = `<p role="alert">Leaflet belum dimuat. Tambahkan CDN Leaflet JS di index.html.</p>`;
      return;
    }

    // reset node kalau pernah terpasang peta sebelumnya (SPA)
    if (mapEl._leaflet_id) mapEl.replaceWith(mapEl.cloneNode(true));
    const freshMapEl = document.getElementById('homeMap');

    const first = stories.find(s => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon)));
    const center = first ? [Number(first.lat), Number(first.lon)] : [-2.5489, 118.0149]; // Indonesia
    const map = L.map(freshMapEl).setView(center, first ? 11 : 5);

    L.tileLayer(
      (CONFIG?.MAP?.TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
      { maxZoom: 19, attribution: (CONFIG?.MAP?.ATTRIBUTION || '&copy; OpenStreetMap') }
    ).addTo(map);

    const fg = L.featureGroup().addTo(map);

    stories.forEach((s, idx) => {
      const lat = Number(s.lat), lon = Number(s.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const popup = `
        <div style="min-width:200px">
          <img src="${s.photoUrl}" alt="${s.name ? `${this.#escape(s.name)} - ${this.#escape(s.description ?? 'Foto story')}` : this.#escape(s.description ?? 'Foto story')}"
               style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px" />
          <strong>${this.#escape(s.name ?? 'Tanpa Nama')}</strong><br/>
          <span style="font-size:12px">${this.#escape((s.description ?? '').slice(0,100))}${(s.description||'').length>100?'…':''}</span><br/>
          <span style="font-size:11px;color:#666">${this.#formatDate(s.createdAt)}</span>
        </div>
      `;
      const marker = L.marker([lat, lon]).addTo(fg).bindPopup(popup);

      const card = listEl.querySelector(`[data-idx="${idx}"]`);
      if (card) {
        // Only add click handler to story-body, not the whole card (to avoid conflict with bookmark button)
        const storyBody = card.querySelector('.story-body');
        if (storyBody) {
          storyBody.addEventListener('click', () => {
            marker.openPopup();
            map.flyTo([lat, lon], Math.max(map.getZoom(), 11), { duration: 0.6 });
          });
        }
      }
    });

    if (fg.getLayers().length) map.fitBounds(fg.getBounds(), { padding: [24, 24] });
    setTimeout(() => map.invalidateSize(), 0);
    
    // Setup push notification toggle (after DOM is ready)
    await this.#setupPushToggle();
    
    // Handle story detail from URL params (from notification) - after list is rendered
    if (storyId) {
      // Scroll to story or highlight it
      setTimeout(() => {
        const storyItem = listEl.querySelector(`[data-story-id="${storyId}"]`);
        if (storyItem) {
          storyItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          storyItem.style.border = '3px solid #6c63ff';
          storyItem.style.boxShadow = '0 0 10px rgba(108, 99, 255, 0.5)';
          setTimeout(() => {
            storyItem.style.border = '';
            storyItem.style.boxShadow = '';
          }, 3000);
        }
      }, 500);
    }
  }

  async #setupPushToggle() {
    const btn = document.getElementById('pushToggleBtn');
    const text = document.getElementById('pushToggleText');
    
    if (!btn || !text) return;
    
    try {
      const {
        registerServiceWorker,
        getPushSubscription,
        subscribeToPush,
        unsubscribeFromPush,
        sendSubscriptionToServer,
        removeSubscriptionFromServer,
      } = await import('../../utils/push-notification.js');
      
      // Check if browser supports push
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        btn.disabled = true;
        text.textContent = '📱 Push Unavailable';
        btn.title = 'Browser tidak mendukung push notification';
        return;
      }
      
      let registration;
      let hasVapidKey = false;
      
      try {
        // Get service worker registration
        registration = await navigator.serviceWorker.ready;
        const subscription = await getPushSubscription(registration);
        
        // Update UI
        this.#updatePushToggleUI(subscription, text);
        
        // Check if VAPID key is available (try to get it silently)
        try {
          // Use CONFIG yang sudah di-import secara static (baris 3)
          // Debug: log CONFIG saat check
          console.log('[home] Checking VAPID key. CONFIG:', CONFIG);
          console.log('[home] CONFIG.VAPID_PUBLIC_KEY:', CONFIG.VAPID_PUBLIC_KEY);
          console.log('[home] CONFIG.VAPID_PUBLIC_KEY type:', typeof CONFIG.VAPID_PUBLIC_KEY);
          console.log('[home] CONFIG.VAPID_PUBLIC_KEY truthy?', !!CONFIG.VAPID_PUBLIC_KEY);
          
          // Check config first (faster)
          if (CONFIG.VAPID_PUBLIC_KEY && CONFIG.VAPID_PUBLIC_KEY.trim() !== '') {
            hasVapidKey = true;
            console.log('[home] ✅ VAPID key found in CONFIG:', CONFIG.VAPID_PUBLIC_KEY.substring(0, 20) + '...');
          } else {
            console.warn('[home] ⚠️ CONFIG.VAPID_PUBLIC_KEY is empty, trying utility function...');
            // Use the utility function which has caching to prevent multiple fetches
            const { getVapidPublicKey } = await import('../../utils/push-notification.js');
            const vapidKey = await getVapidPublicKey();
            hasVapidKey = !!vapidKey;
            console.log('[home] VAPID key from utility:', vapidKey ? vapidKey.substring(0, 20) + '...' : 'null');
          }
        } catch (vapidErr) {
          // Silently fail - push notification tidak tersedia
          console.error('[home] ❌ Error checking VAPID key:', vapidErr);
          hasVapidKey = false;
        }
      } catch (err) {
        console.warn('[home] Push setup error (non-critical):', err);
        // Disable button if push is not available (but keep it visible)
        btn.disabled = true;
        text.textContent = '📱 Push Unavailable';
        btn.title = 'Push notification tidak tersedia';
        return;
      }
      
      if (!registration) {
        btn.disabled = true;
        text.textContent = '📱 Push Unavailable';
        btn.title = 'Service Worker tidak tersedia';
        return;
      }
      
      // Setup click handler - allow click even if VAPID key not found yet
      // (will check again when clicked)
      const finalRegistration = registration; // Capture for closure
      
      // Enable button if VAPID key is available
      if (!hasVapidKey) {
        btn.disabled = true;
        text.textContent = '📱 Push Unavailable';
        btn.title = 'Push notification tidak tersedia. VAPID key tidak ditemukan. Silakan set CONFIG.VAPID_PUBLIC_KEY atau pastikan endpoint /vapid-public-key tersedia.';
      } else {
        btn.disabled = false; // Ensure button is enabled if VAPID key available
      }
      
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        
        try {
          // PERBAIKAN: Pastikan user sudah login sebelum subscribe
          const token = localStorage.getItem('authToken');
          if (!token) {
            alert('Anda harus login terlebih dahulu untuk mengaktifkan push notification.\n\nSilakan login terlebih dahulu.');
            btn.disabled = false;
            return;
          }
          
          const currentSubscription = await getPushSubscription(finalRegistration);
          if (currentSubscription) {
            // Unsubscribe
            await unsubscribeFromPush(finalRegistration);
            // Try to remove from server, but don't fail if it doesn't work
            await removeSubscriptionFromServer().catch(() => {
              // Ignore server errors - local unsubscribe is what matters
            });
            this.#updatePushToggleUI(null, text);
            // Tidak perlu alert, cukup update UI
          } else {
            // Request permission first
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
              btn.disabled = false;
              return;
            }
            
            // Subscribe - check VAPID key again before subscribing
            // Check CONFIG first (static import, always up-to-date)
            let vapidKey = CONFIG.VAPID_PUBLIC_KEY;
            
            if (!vapidKey) {
              // Fallback to utility function
              const { getVapidPublicKey } = await import('../../utils/push-notification.js');
              vapidKey = await getVapidPublicKey();
            }
            
            console.log('[home] VAPID key check on click:', vapidKey ? vapidKey.substring(0, 20) + '...' : 'null');
            
            if (!vapidKey) {
              alert('VAPID key tidak tersedia. Push notification tidak dapat diaktifkan.\n\nSilakan:\n1. Set CONFIG.VAPID_PUBLIC_KEY di config.js, atau\n2. Pastikan endpoint /vapid-public-key tersedia di API.');
              btn.disabled = true;
              text.textContent = '📱 Push Unavailable';
              btn.title = 'VAPID key tidak tersedia';
              return;
            }
            
            const newSubscription = await subscribeToPush(finalRegistration);
            if (newSubscription) {
              // Try to send to server, but don't fail if it doesn't work
              // Local subscription is still valid even if server endpoint fails
              await sendSubscriptionToServer(newSubscription).catch(() => {
                // Ignore server errors - local subscription is what matters
                console.warn('[home] Server subscription failed, but local subscription is active');
              });
              this.#updatePushToggleUI(newSubscription, text);
              btn.disabled = false; // Re-enable after success
            } else {
              // Subscription failed
              alert('Gagal subscribe push notification. Pastikan VAPID key valid.');
              btn.disabled = true;
              text.textContent = '📱 Push Unavailable';
              btn.title = 'Gagal subscribe push notification';
            }
          }
        } catch (err) {
          console.error('[home] Push toggle error:', err);
          // Only show alert for critical errors, not network errors
          if (err.message && !err.message.includes('fetch') && !err.message.includes('network')) {
            alert(`Error: ${err.message || 'Gagal mengubah status push notification'}`);
          } else {
            // Network errors are handled silently - subscription can still work locally
            console.warn('[home] Network error during push toggle, but operation may have succeeded locally');
          }
          btn.disabled = false;
        } finally {
          if (!btn.disabled) {
            btn.disabled = false;
          }
        }
      });
    } catch (err) {
      console.error('[home] Push setup error:', err);
      // Disable button but keep it visible
      if (btn && text) {
        btn.disabled = true;
        text.textContent = '📱 Push Unavailable';
        btn.title = 'Push notification tidak tersedia';
      }
    }
  }
  
  #updatePushToggleUI(subscription, textEl) {
    if (!textEl) return;
    if (subscription) {
      textEl.textContent = '📱 Push On';
      textEl.parentElement.style.background = '#e8f5e9';
      textEl.parentElement.style.borderColor = '#4caf50';
    } else {
      textEl.textContent = '📱 Push Off';
      textEl.parentElement.style.background = '#fff';
      textEl.parentElement.style.borderColor = '#ddd';
    }
  }
  
  #latlonText(lat, lon) {
    if (lat == null || lon == null) return '';
    const nlat = Number(lat), nlon = Number(lon);
    return (Number.isFinite(nlat) && Number.isFinite(nlon)) ? ` · (${nlat.toFixed(3)}, ${nlon.toFixed(3)})` : '';
  }
  #formatDate(d) { try { return new Date(d).toLocaleString(); } catch { return '-'; } }
  #escape(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
}
