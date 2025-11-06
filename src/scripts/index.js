// src/scripts/index.js
import '../styles/styles.css'; // Import CSS agar webpack bundle
import routes from './routes/routes.js';   // pastikan path ini benar
import { getActiveOutlet as _getActiveOutlet } from './routes/url-parser.js';

/* ========== UTIL: ambil container valid ========== */
function getContainer() {
  const viaHelper =
    typeof _getActiveOutlet === 'function' ? _getActiveOutlet() : null;
  const el = viaHelper || document.querySelector('#main-content');
  if (!el) throw new Error('Container #main-content tidak ditemukan');
  return el;
}

/* ========== UTIL: parser hash → path ('/' jadi '/home') ========== */
function parseRoute() {
  const raw = (window.location.hash || '').slice(1).toLowerCase(); // '#/home' → '/home'
  const seg = raw.split('/').filter(Boolean);
  const path = `/${seg[0] || ''}`;
  return path === '/' ? '/home' : path; // default route
}

/* ========== TRANSISI HALAMAN (View Transition API) ========== */
async function transitionSwap(container, nextHTML, afterMount) {
  if (!container) throw new Error('#main-content tidak ditemukan');

  // Check if View Transition API is supported
  if (!document.startViewTransition) {
    // Fallback untuk browser yang belum support View Transition API
    container.innerHTML = typeof nextHTML === 'string' ? nextHTML : (nextHTML ?? '');
    try {
      if (typeof afterMount === 'function') await afterMount();
    } finally {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    return;
  }

  // Use View Transition API
  const transition = document.startViewTransition(async () => {
    container.innerHTML = typeof nextHTML === 'string' ? nextHTML : (nextHTML ?? '');
  });

  try {
    await transition.finished;
    
    // Fokus aksesibel setelah transisi selesai
    const firstHeading = container.querySelector('h1, [role="heading"]');
    if (firstHeading) {
      firstHeading.setAttribute('tabindex', '-1');
      firstHeading.focus();
    }

    if (typeof afterMount === 'function') await afterMount();
  } finally {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

/* ========== FALLBACK PAGES ========== */
const Blank = (t) => () => `
  <section class="container">
    <h1>${t}</h1>
    <p>Halaman ini belum diimplementasikan.</p>
  </section>
`;

const NotFound = () => `
  <section class="container">
    <h1>404</h1>
    <p>Halaman tidak ditemukan.</p>
  </section>
`;

/* ========== DRAWER NAV ========== */
function initDrawer() {
  const btn = document.getElementById('drawer-button');
  const nav = document.getElementById('navigation-drawer');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => nav.classList.toggle('open'));
  nav.addEventListener('click', (e) => {
    if (e.target.matches('a[href^="#"]')) nav.classList.remove('open');
  });
  
  // Setup logout handler
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }
  
  // Update navigation based on auth status
  updateNavigation();
}

// Update navigation based on login status
function updateNavigation() {
  const token = localStorage.getItem('authToken');
  const loginNav = document.querySelector('.login-nav');
  const registerNav = document.querySelector('.register-nav');
  const logoutNav = document.querySelector('.logout-nav');
  
  if (token) {
    // User is logged in - hide login/register, show logout
    if (loginNav) loginNav.style.display = 'none';
    if (registerNav) registerNav.style.display = 'none';
    if (logoutNav) logoutNav.style.display = 'block';
  } else {
    // User is not logged in - show login/register, hide logout
    if (loginNav) loginNav.style.display = 'block';
    if (registerNav) registerNav.style.display = 'block';
    if (logoutNav) logoutNav.style.display = 'none';
  }
}

// Handle logout
function handleLogout() {
  // Clear auth token
  localStorage.removeItem('authToken');
  
  // Clear any cached user data if needed
  // sessionStorage.clear(); // Optional: clear session storage
  
  // Update navigation
  updateNavigation();
  
  // Redirect to home page
  if (location.hash !== '#/home') {
    location.hash = '#/home';
  } else {
    // Force reload if already on home
    location.reload();
  }
}

/* ========== ROUTER ========== */
let isRendering = false;
let currentRoute = null;

async function renderRoute() {
  const container = getContainer();
  const route = parseRoute();
  
  // Prevent multiple simultaneous renders
  if (isRendering && currentRoute === route) {
    console.debug('[router] Already rendering', route, '- skipping');
    return;
  }
  
  // Prevent render loop
  if (currentRoute === route && isRendering) {
    return;
  }
  
  isRendering = true;
  currentRoute = route;

  let Page = routes?.[route];

  // Handle different page types
  if (route === '/home' && typeof Page === 'function') {
    Page = new Page();
  } else if (route === '/add' && Page && typeof Page.render === 'function') {
    // AddPage is already instantiated
    Page = Page;
  } else if (route === '/favorite' && typeof Page === 'function') {
    // FavoritePage is a class, instantiate it
    Page = new Page();
  } else if (route === '/login' && typeof Page === 'function') {
    // LoginPage is async function, call it
    Page = Page;
  } else if (route === '/register' && typeof Page === 'function') {
    // RegisterPage is async function, call it
    Page = Page;
  }

  if (!Page) {
    Page = ['/about', '/add', '/favorite', '/login', '/register'].includes(route)
      ? Blank(route.replace('/', '').toUpperCase())
      : NotFound;
  }
  
  // Validate page handler
  const isValidPage = typeof Page === 'function' || (Page && typeof Page.render === 'function');
  if (!isValidPage) {
    console.warn('[router] handler tidak valid → NotFound', route, Page);
    Page = NotFound;
  }

  console.debug('[router] navigate →', route, 'handler:', Page.name || Page.constructor?.name || '(anon)');
  
  // Render page - handle both async functions and class instances
  let html;
  if (Page && typeof Page.render === 'function') {
    // Class instance with render method
    html = await Promise.resolve(Page.render());
  } else if (typeof Page === 'function') {
    // Async function (LoginPage, RegisterPage, etc)
    html = await Promise.resolve(Page());
  } else {
    html = '';
  }

  try {
    await transitionSwap(container, html, async () => {
      if (Page && typeof Page.afterRender === 'function') {
        console.debug('[router] run afterRender:', Page.name || Page.constructor?.name || '(anon)');
        try {
          await Page.afterRender();
        } catch (e) {
          console.error('[router] afterRender error:', e);
        }
      } else if (typeof Page.afterRender === 'function') {
        console.debug('[router] run afterRender:', Page.name || '(anon)');
        try {
          await Page.afterRender();
        } catch (e) {
          console.error('[router] afterRender error:', e);
        }
      } else {
        console.debug('[router] no afterRender for', route);
      }
    });
  } finally {
    isRendering = false;
    // Reset currentRoute setelah delay untuk allow navigation ke route yang sama
    setTimeout(() => {
      if (currentRoute === route) {
        currentRoute = null;
      }
    }, 1000);
  }
}

/* ========== SERVICE WORKER & PWA ========== */
async function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      // Get base path untuk GitHub Pages
      const basePath = location.pathname.split('/').slice(0, -1).join('/') || '';
      const swPath = `${basePath}/sw.js`;
      
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: basePath || '/'
      });
      console.log('[main] Service Worker registered:', registration);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[main] New service worker available');
          }
        });
      });
    } catch (error) {
      console.error('[main] Service Worker registration failed:', error);
    }
  }
}

/* ========== BOOTSTRAP ========== */
// Paksa #/home saat first-load agar tidak 404, lalu render.
window.addEventListener('load', async () => {
  // Register service worker
  await initServiceWorker();
  
  // Import and setup sync
  try {
    const { setupAutoSync } = await import('./utils/sync.js');
    setupAutoSync();
  } catch (err) {
    console.warn('[main] Sync setup failed:', err);
  }
  
  if (!location.hash) {
    location.replace('#/home'); // tidak menambah history
    // jika event hashchange tidak terpicu, render manual
    setTimeout(() => {
      initDrawer();
      renderRoute().catch(console.error);
    }, 0);
    return;
  }
  initDrawer();
  renderRoute().catch(console.error);
});

// Re-render saat hash berubah dengan debounce
let hashChangeTimer = null;
window.addEventListener(
  'hashchange',
  (e) => {
    const newHash = location.hash;
    console.log('[router] Hash changed:', newHash, 'from:', e.oldURL);
    
    // Reset flags untuk allow re-setup
    // (This will be handled by individual pages checking their own flags)
    
    // Update navigation on route change
    updateNavigation();
    
    // Debounce untuk menghindari multiple calls
    if (hashChangeTimer) {
      clearTimeout(hashChangeTimer);
    }
    hashChangeTimer = setTimeout(() => {
      renderRoute().catch(console.error);
      hashChangeTimer = null;
    }, 50);
  },
  { passive: true }
);

// Export updateNavigation untuk digunakan oleh halaman lain
window.updateNavigation = updateNavigation;

export { renderRoute };
