// src/scripts/pages/about/about-page.js

const AboutPage = async () => {
  return `
    <section class="container">
      <h1>Tentang Story App</h1>
      <p>Story App adalah aplikasi web untuk berbagi cerita dengan lokasi. Aplikasi ini memungkinkan pengguna untuk menambahkan cerita mereka dengan foto dan lokasi GPS.</p>
      
      <h2>Fitur Utama</h2>
      <ul style="margin-left: 20px; line-height: 1.8;">
        <li><strong>Berbagi Cerita:</strong> Tambahkan cerita dengan foto dan deskripsi</li>
        <li><strong>Lokasi GPS:</strong> Sertakan lokasi GPS untuk setiap cerita</li>
        <li><strong>Peta Interaktif:</strong> Lihat semua cerita di peta dengan markers</li>
        <li><strong>Mode Offline:</strong> Simpan cerita secara offline dan sinkronisasi saat online</li>
        <li><strong>Push Notification:</strong> Dapatkan notifikasi untuk cerita baru</li>
        <li><strong>PWA:</strong> Install aplikasi sebagai Progressive Web App</li>
      </ul>
      
      <h2>Teknologi</h2>
      <p>Aplikasi ini dibangun menggunakan teknologi web modern:</p>
      <ul style="margin-left: 20px; line-height: 1.8;">
        <li>HTML5, CSS3, JavaScript (ES6+)</li>
        <li>Webpack untuk bundling</li>
        <li>Leaflet.js untuk peta interaktif</li>
        <li>IndexedDB untuk penyimpanan offline</li>
        <li>Service Worker untuk PWA dan offline support</li>
        <li>Web Push API untuk push notifications</li>
      </ul>
    </section>
  `;
};

export default AboutPage;
