// src/scripts/auth/login-page.js
import CONFIG from '../config.js';

const LoginPage = async () => {
  return `
    <section class="container">
      <h1>Login</h1>

      <form id="loginForm" class="form-auth" novalidate>
        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" type="email" name="email" autocomplete="email" required placeholder="Masukkan email" />
        </div>

        <div class="form-group" style="margin-top:8px">
          <label for="password">Password</label>
          <input id="password" type="password" name="password" autocomplete="current-password" required placeholder="Masukkan password" />
          <label for="togglePw" style="display:inline-flex;gap:6px;align-items:center;margin-top:6px">
            <input id="togglePw" type="checkbox" />
            <span>Tampilkan password</span>
          </label>
        </div>

        <button id="loginBtn" type="submit" style="margin-top:12px">Login</button>
      </form>

      <div id="loginMessage" class="auth-message" aria-live="polite" style="margin-top:10px"></div>
    </section>
  `;
};

/**
 * Dipanggil otomatis oleh router kamu setelah view dirender (SPA + transition).
 * - Menangani submit login
 * - Menyimpan token ke localStorage (dipakai HomePage untuk fetch API)
 * - Redirect ke #/home setelah sukses
 */
// Prevent multiple event listener registration
// Reset flag saat route berubah
let loginSetupDone = false;
let loginSetupId = null;

LoginPage.afterRender = () => {
  const form = document.getElementById('loginForm');
  const btn  = document.getElementById('loginBtn');
  const msg  = document.getElementById('loginMessage');
  const emailEl = document.getElementById('email');
  const pwEl = document.getElementById('password');
  const togglePw = document.getElementById('togglePw');

  if (!form || !btn || !msg) {
    console.warn('[login] Form elements not found');
    return;
  }

  // Check if this is a new render (different route/hash)
  const currentHash = location.hash;
  if (loginSetupId === currentHash && loginSetupDone) {
    console.log('[login] Setup already done for this route, skipping');
    return;
  }
  
  loginSetupId = currentHash;
  loginSetupDone = true;
  console.log('[login] Setting up form for route:', currentHash);

  // Clone form untuk hapus event listener lama
  const formClone = form.cloneNode(true);
  form.parentNode.replaceChild(formClone, form);
  
  // Ambil element baru
  const freshForm = document.getElementById('loginForm');
  const freshBtn = document.getElementById('loginBtn');
  const freshMsg = document.getElementById('loginMessage');
  const freshEmailEl = document.getElementById('email');
  const freshPwEl = document.getElementById('password');
  const freshTogglePw = document.getElementById('togglePw');

  if (!freshForm || !freshBtn || !freshMsg) {
    loginSetupDone = false;
    return;
  }

  // Jika sudah login, kasih info dan alihkan
  const existing = localStorage.getItem('authToken');
  if (existing) {
    freshMsg.textContent = 'Anda sudah login. Mengalihkan ke beranda…';
    setTimeout(() => { 
      if (location.hash !== '#/home') {
        location.hash = '#/home'; 
      }
    }, 250);
    loginSetupDone = false;
    return;
  }

  // Autofill email jika baru register
  const registeredEmail = sessionStorage.getItem('registeredEmail');
  if (registeredEmail && freshEmailEl && !freshEmailEl.value) {
    freshEmailEl.value = registeredEmail;
    console.log('[login] Auto-filled email from registration');
  }

  // Toggle show/hide password
  if (freshTogglePw && freshPwEl) {
    freshTogglePw.addEventListener('change', () => {
      freshPwEl.type = freshTogglePw.checked ? 'text' : 'password';
    });
  }

  freshForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = (freshEmailEl?.value || '').trim();
    const password = (freshPwEl?.value || '').trim();

    if (!email || !password) {
      freshMsg.textContent = 'Email dan password wajib diisi.';
      return;
    }

    freshBtn.disabled = true;
    freshMsg.textContent = 'Sedang login…';

    // Debug log
    console.log('[login] Attempting login with:', { email, passwordLength: password.length });

    try {
      const res = await fetch(`${CONFIG.BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      
      // Debug log response
      console.log('[login] Response status:', res.status);
      console.log('[login] Response data:', JSON.stringify(data, null, 2));
      
      // Handle 401 specifically
      if (res.status === 401) {
        const errorDetail = data.message || 'Unauthorized';
        console.error('[login] 401 Error:', errorDetail);
        console.error('[login] Email used:', email);
        console.error('[login] Password length:', password.length);
        console.error('[login] Full response:', data);
        
        // Cek apakah ini email yang baru didaftarkan
        const registeredEmail = sessionStorage.getItem('registeredEmail');
        
        if (registeredEmail === email) {
          freshMsg.innerHTML = `<p class="error"><strong>User not found</strong><br/><br/>Email: <strong>${email}</strong><br/><br/>Kemungkinan:<br/>1. Register mungkin belum selesai diproses server<br/>2. Coba tunggu beberapa detik lalu login lagi<br/>3. Atau register ulang dengan email berbeda<br/><br/><small>Cek console untuk detail response dari API</small></p>`;
        } else {
          freshMsg.innerHTML = `<p class="error"><strong>User not found</strong><br/><br/>Email <strong>${email}</strong> tidak terdaftar.<br/><br/>Silakan register terlebih dahulu.</p>`;
        }
        
        freshBtn.disabled = false;
        loginSetupDone = false; // Reset untuk retry
        return;
      }
      
      // Handle other errors
      if (!res.ok || (data && data.error === true)) {
        const errorMsg = data?.message || data?.error || `HTTP ${res.status}`;
        console.error('[login] Login failed:', errorMsg);
        freshMsg.innerHTML = `<p class="error">Error: ${errorMsg}<br/>Status: ${res.status}</p>`;
        freshBtn.disabled = false;
        loginSetupDone = false;
        return;
      }

      const token = data?.loginResult?.token;
      if (!token) {
        freshMsg.innerHTML = '<p class="error">Token tidak ditemukan pada respons. Format response mungkin berubah.</p>';
        console.error('Login response:', data);
        freshBtn.disabled = false;
        loginSetupDone = false;
        return;
      }

      // Simpan token (dipakai di HomePage untuk fetch Story API)
      localStorage.setItem('authToken', token);
      if (data?.loginResult?.name) {
        localStorage.setItem('authName', data.loginResult.name);
      }

      // Clear temporary registration data setelah login sukses
      sessionStorage.removeItem('registeredEmail');

      freshMsg.innerHTML = `<p style="color:green">Login berhasil! Selamat datang, ${data?.loginResult?.name ?? 'User'}.</p>`;
      freshForm.reset();

       // Update navigation setelah login sukses
      if (typeof window.updateNavigation === 'function') {
        window.updateNavigation();
      }

      // Redirect SPA ke Home (router + transition akan jalan)
      setTimeout(() => { 
        if (location.hash !== '#/home') {
          location.hash = '#/home'; 
        }
      }, 150);
    } catch (err) {
      console.error('Login error:', err);
      if (err.name === 'TypeError' || err.message.includes('fetch')) {
        freshMsg.innerHTML = '<p class="error">Gagal terhubung ke server. Periksa koneksi internet kamu.</p>';
      } else {
        freshMsg.innerHTML = `<p class="error">Error: ${err.message}</p>`;
      }
      loginSetupDone = false;
    } finally {
      freshBtn.disabled = false;
    }
  });
};

export default LoginPage;
