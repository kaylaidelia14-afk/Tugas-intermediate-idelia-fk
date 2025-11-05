import routes from '../routes/routes.js';
import { getActiveRoute } from '../routes/url-parser.js';

class App {
  #content = null;
  #drawerButton = null;
  #navigationDrawer = null;

  constructor({ navigationDrawer, drawerButton, content }) {
    this.#content = content;
    this.#drawerButton = drawerButton;
    this.#navigationDrawer = navigationDrawer;

    this._setupDrawer();
    this._setupRouting();
  }

  // === Navigasi Drawer ===
  _setupDrawer() {
    this.#drawerButton.addEventListener('click', () => {
      this.#navigationDrawer.classList.toggle('open');
    });

    document.body.addEventListener('click', (event) => {
      if (
        !this.#navigationDrawer.contains(event.target) &&
        !this.#drawerButton.contains(event.target)
      ) {
        this.#navigationDrawer.classList.remove('open');
      }

      this.#navigationDrawer.querySelectorAll('a').forEach((link) => {
        if (link.contains(event.target)) {
          this.#navigationDrawer.classList.remove('open');
        }
      });
    });
  }

  // === Routing SPA ===
  _setupRouting() {
    // Render halaman saat pertama kali load
    window.addEventListener('load', () => this.renderPage());

    // Render ulang halaman saat hash (#/login, #/home, dst) berubah
    window.addEventListener('hashchange', () => this.renderPage());
  }

  // === Render Halaman + Transisi ===
  async renderPage() {
    const url = getActiveRoute();
    const page = routes[url];

    // --- Tambahkan transisi keluar (fade out)
    this.#content.classList.add('fade-out');
    await new Promise((resolve) => setTimeout(resolve, 200));

    // --- Render halaman baru
    this.#content.innerHTML = await page.render();
    await page.afterRender();

    // --- Transisi masuk (fade in)
    this.#content.classList.remove('fade-out');
    this.#content.classList.add('fade-in');
    setTimeout(() => this.#content.classList.remove('fade-in'), 300);
  }
}

export default App;
