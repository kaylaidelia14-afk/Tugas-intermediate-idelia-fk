// src/scripts/pages/favorite/favorite-page.js
import { getAllFavorites, removeFavorite } from '../../utils/indexeddb.js';
import CONFIG from '../../config.js';

export default class FavoritePage {
  async render() {
    return `
      <section class="container">
        <h1>Story Tersimpan</h1>
        <p style="color:#666;margin-bottom:16px">
          Berikut adalah story yang telah Anda simpan sebagai favorit.
        </p>
        
        <div id="favoriteNotice" class="notice" aria-live="polite"></div>
        
        <!-- Filter and Sort Controls -->
        <div style="margin-bottom:16px;padding:12px;background:#f5f5f5;border-radius:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label for="searchFavorite" style="display:block;margin-bottom:4px;font-size:14px;font-weight:bold">Cari:</label>
              <input 
                type="text" 
                id="searchFavorite" 
                placeholder="Cari deskripsi..." 
                style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px"
                aria-label="Cari story favorit">
            </div>
            <div>
              <label for="sortFavorite" style="display:block;margin-bottom:4px;font-size:14px;font-weight:bold">Urutkan:</label>
              <select 
                id="sortFavorite" 
                style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px"
                aria-label="Urutkan story favorit">
                <option value="newest">Terbaru Disimpan</option>
                <option value="oldest">Terlama Disimpan</option>
                <option value="description-asc">Deskripsi A-Z</option>
                <option value="description-desc">Deskripsi Z-A</option>
              </select>
            </div>
          </div>
          <div id="favoriteStats" style="font-size:12px;color:#666;margin-top:8px"></div>
        </div>
        
        <div id="favoriteList" class="story-list" role="list" aria-label="Daftar story favorit"></div>
        
        <div id="emptyState" style="display:none;text-align:center;padding:40px;color:#999">
          <p style="font-size:48px;margin:0">📚</p>
          <p style="margin-top:16px;font-size:18px;font-weight:bold">Belum ada story yang disimpan</p>
          <p style="margin-top:8px">Kunjungi <a href="#/home">Beranda</a> untuk melihat dan menyimpan story favorit Anda.</p>
        </div>
      </section>
    `;
  }
  
  async afterRender() {
    const listEl = document.getElementById('favoriteList');
    const noticeEl = document.getElementById('favoriteNotice');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchFavorite');
    const sortSelect = document.getElementById('sortFavorite');
    const statsEl = document.getElementById('favoriteStats');
    
    if (!listEl) return;
    
    // Load and display favorites
    const loadFavorites = async () => {
      try {
        let favorites = await getAllFavorites();
        
        // Ensure favorites is an array
        if (!Array.isArray(favorites)) {
          console.error('[favorite] getAllFavorites returned non-array:', typeof favorites, favorites);
          favorites = [];
        }
        
        if (favorites.length === 0) {
          listEl.innerHTML = '';
          emptyState.style.display = 'block';
          if (statsEl) statsEl.textContent = '0 story tersimpan';
          return;
        }
        
        emptyState.style.display = 'none';
        
        // Filter and sort
        let filtered = Array.isArray(favorites) ? [...favorites] : [];
        
        // Search filter
        if (searchInput && searchInput.value.trim()) {
          const searchTerm = searchInput.value.trim().toLowerCase();
          filtered = filtered.filter(fav => 
            (fav.description || '').toLowerCase().includes(searchTerm) ||
            (fav.name || '').toLowerCase().includes(searchTerm)
          );
        }
        
        // Sort
        const sortValue = sortSelect?.value || 'newest';
        filtered.sort((a, b) => {
          switch (sortValue) {
            case 'newest':
              return new Date(b.savedAt) - new Date(a.savedAt);
            case 'oldest':
              return new Date(a.savedAt) - new Date(b.savedAt);
            case 'description-asc':
              return (a.description || '').localeCompare(b.description || '');
            case 'description-desc':
              return (b.description || '').localeCompare(a.description || '');
            default:
              return 0;
          }
        });
        
        // Update stats
        if (statsEl) {
          statsEl.textContent = `Menampilkan ${filtered.length} dari ${favorites.length} story tersimpan`;
        }
        
        // Render favorites
        if (filtered.length === 0) {
          listEl.innerHTML = '<p style="text-align:center;padding:20px;color:#999">Tidak ada story yang cocok dengan pencarian Anda.</p>';
          return;
        }
        
        listEl.innerHTML = filtered.map(fav => {
          const savedDate = new Date(fav.savedAt).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          
          return `
            <article class="story-card" style="margin-bottom:16px;padding:16px;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)">
              ${fav.photoUrl ? `
                <img 
                  src="${fav.photoUrl}" 
                  alt="${fav.description || 'Story image'}" 
                  style="width:100%;height:200px;object-fit:cover;border-radius:8px;margin-bottom:12px"
                  loading="lazy"
                  onerror="this.style.display='none'">
              ` : ''}
              
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div style="flex:1">
                  ${fav.name ? `<h3 style="margin:0 0 8px 0;font-size:18px">${fav.name}</h3>` : ''}
                  <p style="margin:0;color:#666;line-height:1.6">${fav.description || 'Tidak ada deskripsi'}</p>
                </div>
                <button 
                  class="unbookmark-btn" 
                  data-story-id="${fav.id}"
                  aria-label="Hapus dari favorit"
                  style="padding:8px 12px;background:#f44336;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-left:12px;white-space:nowrap">
                  ❌ Hapus
                </button>
              </div>
              
              ${fav.lat && fav.lon ? `
                <p style="margin:8px 0;font-size:12px;color:#999">
                  📍 Lokasi: ${fav.lat.toFixed(6)}, ${fav.lon.toFixed(6)}
                </p>
              ` : ''}
              
              <p style="margin:8px 0 0 0;font-size:12px;color:#999">
                Disimpan pada: ${savedDate}
              </p>
            </article>
          `;
        }).join('');
        
        // Add event listeners for unbookmark buttons
        const unbookmarkBtns = listEl.querySelectorAll('.unbookmark-btn');
        unbookmarkBtns.forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const storyId = e.target.closest('.unbookmark-btn').dataset.storyId;
            if (!storyId) return;
            
            if (confirm('Apakah Anda yakin ingin menghapus story ini dari favorit?')) {
              try {
                btn.disabled = true;
                btn.textContent = 'Menghapus...';
                
                await removeFavorite(storyId);
                
                if (noticeEl) {
                  noticeEl.innerHTML = '<p style="color:green">Story berhasil dihapus dari favorit!</p>';
                  setTimeout(() => {
                    noticeEl.innerHTML = '';
                  }, 2000);
                }
                
                // Reload favorites
                await loadFavorites();
              } catch (err) {
                console.error('Error removing favorite:', err);
                if (noticeEl) {
                  noticeEl.innerHTML = `<p class="error">Gagal menghapus dari favorit: ${err.message}</p>`;
                }
                btn.disabled = false;
                btn.textContent = '❌ Hapus';
              }
            }
          });
        });
        
      } catch (err) {
        console.error('Error loading favorites:', err);
        if (noticeEl) {
          let errorMsg = 'Gagal memuat story favorit.';
          if (err.message) {
            errorMsg += ` ${err.message}`;
          }
          if (err.message && err.message.includes('not iterable')) {
            errorMsg += '<br/><br/><small>Silakan refresh halaman untuk memperbaiki masalah ini.</small>';
          }
          noticeEl.innerHTML = `<p class="error">${errorMsg}</p>`;
        }
        // Show empty state on error
        listEl.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (statsEl) statsEl.textContent = 'Error memuat data';
      }
    };
    
    // Setup search and sort handlers
    if (searchInput) {
      searchInput.addEventListener('input', loadFavorites);
    }
    
    if (sortSelect) {
      sortSelect.addEventListener('change', loadFavorites);
    }
    
    // Initial load
    await loadFavorites();
  }
}

