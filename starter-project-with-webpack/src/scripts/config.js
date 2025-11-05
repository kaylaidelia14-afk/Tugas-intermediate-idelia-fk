// src/scripts/config.js
const CONFIG = {
  BASE_URL: 'https://story-api.dicoding.dev/v1',
  AUTH_TOKEN: '', // biarkan kosong, nanti pakai localStorage
  VAPID_PUBLIC_KEY: 'BDXMq-v6e3Y6Dof9ON_OZaR1xj-ydByyJLvwgVqaiGJDAm391rRNZj6eBJCkMh14_q3Cl2-tLI4Z_06ChpdFFHc', // VAPID Public Key untuk push notification
  MAP: {
    TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ATTRIBUTION: '&copy; OpenStreetMap contributors',
  },
};

// Debug: log CONFIG saat module di-load
console.log('[CONFIG] Module loaded. VAPID_PUBLIC_KEY:', CONFIG.VAPID_PUBLIC_KEY ? CONFIG.VAPID_PUBLIC_KEY.substring(0, 20) + '...' : 'MISSING');

export default CONFIG;