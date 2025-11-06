// src/scripts/data/api.js
import CONFIG from '../config.js';

const BASE = (CONFIG?.BASE_URL || 'https://story-api.dicoding.dev/v1').replace(/\/+$/, '');

async function request(path, { method = 'GET', headers = {}, body } = {}) {
  const token = CONFIG?.AUTH_TOKEN || localStorage.getItem('authToken');
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function login({ email, password }) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function register({ name, email, password }) {
  return request('/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

async function getStories({ page = 1, size = 10, location = 1 } = {}) {
  const url = new URL(`${BASE}/stories`);
  url.searchParams.set('page', page);
  url.searchParams.set('size', size);
  if (location != null) url.searchParams.set('location', location);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${CONFIG?.AUTH_TOKEN || localStorage.getItem('authToken')}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function addStory({ description, photo, lat, lon }) {
  const token = CONFIG?.AUTH_TOKEN || localStorage.getItem('authToken');
  const BASE = CONFIG?.BASE_URL || 'https://story-api.dicoding.dev/v1';
  
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

const API = { login, register, getStories, addStory };
export default API;
