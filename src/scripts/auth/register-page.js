// src/scripts/auth/register-page.js
import CONFIG from '../config.js';

const RegisterPage = async () => {
  const html = `
    <section class="container">
      <h1>Register</h1>

      <form id="registerForm" class="form-auth" novalidate>
        <div class="form-group">
          <label for="name">Nama</label>
          <input id="name" name="name" required />
        </div>

        <div class="form-group" style="margin-top:8px">
          <label for="email">Email</label>
          <input id="email" type="email" name="email" required />
        </div>

        <div class="form-group" style="margin-top:8px">
          <label for="password">Password</label>
          <input id="password" type="password" name="password" minlength="6" required />
        </div>

        <!-- PENTING: tombol submit DI DALAM form dan type="submit" -->
        <button id="regBtn" type="submit" style="margin-top:12px">Register</button>
      </form>

      <div id="regMsg" class="auth-message" aria-live="polite" style="margin-top:10px"></div>
    </section>
  `;

  // Setup register form - pastikan hanya sekali per render
  // Reset flag berdasarkan hash route
  const currentRouteHash = location.hash;
  let lastSetupHash = null;
  let isSetup = false;
  
  const setupRegister = () => {
    // Check if already setup for this route
    if (isSetup && lastSetupHash === currentRouteHash) {
      console.log('[register] Setup already done for this route, skipping');
      return;
    }
    
    // Reset if route changed
    if (lastSetupHash !== currentRouteHash) {
      isSetup = false;
      lastSetupHash = currentRouteHash;
    }
    
    if (isSetup) {
      return;
    }
    
    isSetup = true;
    console.log('[register] Setting up form for route:', currentRouteHash);
    
    const form = document.getElementById('registerForm');
    const btn  = document.getElementById('regBtn');
    const msg  = document.getElementById('regMsg');
    if (!form || !btn || !msg) {
      isSetup = false;
      return;
    }

    // Hapus event listener lama jika ada (untuk hot reload)
    const formClone = form.cloneNode(true);
    form.parentNode.replaceChild(formClone, form);

    // Ambil element baru
    const freshForm = document.getElementById('registerForm');
    const freshBtn = document.getElementById('regBtn');
    const freshMsg = document.getElementById('regMsg');

    if (!freshForm || !freshBtn || !freshMsg) {
      isSetup = false;
      return;
    }

    freshForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = freshForm.name.value.trim();
      const email = freshForm.email.value.trim();
      const password = freshForm.password.value.trim();

      if (!name || !email || !password) { 
        freshMsg.innerHTML = '<p class="error">Semua field wajib diisi.</p>'; 
        return; 
      }
      if (password.length < 6) { 
        freshMsg.innerHTML = '<p class="error">Password minimal 6 karakter.</p>'; 
        return; 
      }

      freshBtn.disabled = true; 
      freshMsg.innerHTML = '<p style="color:#666">Mendaftarkan akun...</p>';

      // Debug log
      console.log('[register] Registering with:', { name, email, passwordLength: password.length });

      try {
        const res = await fetch(`${CONFIG.BASE_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json().catch(() => ({}));
        
        // Debug log response
        console.log('[register] Response status:', res.status);
        console.log('[register] Response headers:', res.headers);
        console.log('[register] Response data:', JSON.stringify(data, null, 2));
        
        // Check for errors
        if (!res.ok) {
          const errorMsg = data.message || data.error || `HTTP ${res.status}`;
          console.error('[register] Registration failed:', errorMsg);
          freshMsg.innerHTML = `<p class="error">Gagal register: ${errorMsg}</p>`;
          if (res.status === 400 && errorMsg.includes('email')) {
            freshMsg.innerHTML = '<p class="error">Email sudah terdaftar. Gunakan email lain atau silakan login.</p>';
          }
          freshBtn.disabled = false;
          return;
        }
        
        // Check for error in response data
        if (data.error === true || (data.message && data.message.toLowerCase().includes('error'))) {
          const errorMsg = data.message || 'Unknown error';
          console.error('[register] Registration failed (error in data):', errorMsg);
          freshMsg.innerHTML = `<p class="error">Gagal register: ${errorMsg}</p>`;
          freshBtn.disabled = false;
          return;
        }

        // Verify registration success
        // Status 201 = Created (sukses)
        // Status 200 = OK (bisa sukses jika tidak ada error)
        // Status 400+ = Error (sudah dihandle di atas)
        
        const isSuccess = res.status === 201 || 
                          (res.status === 200 && (!data || !data.error)) ||
                          (res.status < 400 && (!data || data.error !== true));
        
        console.log('[register] Registration check:', {
          status: res.status,
          hasError: data?.error,
          isSuccess: isSuccess,
          data: data
        });
        
        // Jika status OK (200-299) dan tidak ada error, anggap sukses
        // Dicoding API biasanya return status 201 untuk created
        if (res.status >= 200 && res.status < 300) {
          // Cek apakah ada error dalam response
          if (data && data.error === true) {
            const errorMsg = data.message || 'Unknown error';
            console.error('[register] Registration failed (error in response):', errorMsg);
            freshMsg.innerHTML = `<p class="error">Gagal register: ${errorMsg}</p>`;
            freshBtn.disabled = false;
            return;
          }
          
          console.log('[register] ✓ Registration SUCCESS!', data);
          
          // Tampilkan pesan sukses dengan jelas dan menonjol
          const successMsg = '<div style="color:#155724;font-weight:bold;padding:20px;background:#d4edda;border-radius:8px;border:2px solid #28a745;margin:12px 0;box-shadow:0 2px 8px rgba(0,0,0,0.1);">' +
            '<div style="font-size:20px;margin-bottom:10px;">✓ Registrasi Berhasil!</div>' +
            '<div style="font-size:14px;color:#155724;margin-top:8px;line-height:1.6;">' +
            'Email: <strong style="color:#0d47a1;font-size:16px;">' + email + '</strong><br/>' +
            'Password: <strong>' + password.length + ' karakter</strong><br/><br/>' +
            '<span style="color:#666;font-size:13px;">Mengalihkan ke halaman login dalam 2 detik...</span>' +
            '</div>' +
            '</div>';
          
          freshMsg.innerHTML = successMsg;
          
          // Pastikan pesan terlihat dengan scroll ke element
          setTimeout(() => {
            if (freshMsg) {
              freshMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          
          // Simpan email untuk autofill di login page
          sessionStorage.setItem('registeredEmail', email);
          
          // Redirect ke login dengan delay dan pastikan hanya sekali
          console.log('[register] Scheduling redirect to login in 2 seconds...');
          let redirectExecuted = false;
          const redirectTimer = setTimeout(() => {
            if (!redirectExecuted) {
              redirectExecuted = true;
              const currentHash = location.hash;
              console.log('[register] Current hash:', currentHash);
              console.log('[register] Redirecting to #/login...');
              // Force navigation dengan replace untuk menghindari history issue
              window.location.hash = '#/login';
              // Trigger hashchange manually jika tidak terpicu
              setTimeout(() => {
                if (location.hash !== '#/login') {
                  console.log('[register] Hash change not detected, forcing...');
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }
              }, 100);
            }
          }, 2000);
          
          freshBtn.disabled = false;
          return;
        }
        
        // Jika tidak sukses, tampilkan error
        console.error('[register] Registration failed. Status:', res.status, 'Data:', data);
        freshMsg.innerHTML = '<p class="error">Registrasi gagal.<br/>Status: ' + res.status + '<br/>Response: ' + JSON.stringify(data) + '<br/><br/>Cek console untuk detail lebih lanjut.</p>';
        freshBtn.disabled = false;
        return;
        
      } catch (err) {
        console.error('Register error:', err);
        freshMsg.innerHTML = `<p class="error">Gagal register: ${err.message}</p>`;
      } finally {
        freshBtn.disabled = false;
      }
    });
  };

  // Setup sekali saat page load dengan delay untuk memastikan DOM ready
  // Use requestAnimationFrame untuk memastikan DOM sudah render
  requestAnimationFrame(() => {
    setTimeout(() => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupRegister);
      } else {
        setupRegister();
      }
    }, 150);
  });

  return html;
};

export default RegisterPage;
