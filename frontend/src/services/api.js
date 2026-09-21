import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    console.log('📤 Richiesta API:', config.method.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('❌ Errore nella richiesta:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log('📥 Risposta API:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ Errore nella risposta:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('⚠️ Il backend non è in esecuzione su localhost:5000');
    }
    if (error.response) {
      console.error('⚠️ Status:', error.response.status);
      console.error('⚠️ Data:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// ─── Auth interceptor: aggiunge il token JWT ad ogni richiesta ────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mpt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const eventService = {
  getAll: (params) => api.get('/events', { params }),
  getById: (id) => api.get(`/events/${id}`),
  getSongs: (eventId) => api.get(`/events/${eventId}/songs`),
  getSongDocuments: (eventId, songId) =>
    api.get(`/events/${eventId}/songs/${songId}/documents`),
  // Conteggio documenti SPECIFICI dell'evento, per song_id.
  // Risposta: { songId: count, ... }
  getDocumentCounts: (eventId) =>
    api.get(`/events/${eventId}/document-counts`),
  addSong: (eventId, payload) => api.post(`/events/${eventId}/songs`, payload),
  removeSong: (eventId, songId) => api.delete(`/events/${eventId}/songs/${songId}`),
};

export const songService = {
  getAll: (params) => api.get('/songs', { params }),
  getById: (id) => api.get(`/songs/${id}`),
  getDocuments: (songId) => api.get(`/songs/${songId}/documents`),
};

export const documentService = {
  getAll: (params) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  // Il backend espone /content per il binario
  contentUrl: (id) => `${API_URL}/documents/${id}/content`,
  viewUrl: (id) => `${API_URL}/documents/${id}/view`,
  // Alias usato altrove
  downloadUrl: (id) => `${API_URL}/documents/${id}/content`,
  rawUrl: (id) => `${API_URL}/documents/${id}/content`,
  // Utility per scaricare come blob (es. pulsante "download")
  download: (id) => api.get(`/documents/${id}/content`, { responseType: 'blob' }),
};

// ─── Auth service ──────────────────────────────────────────────────────
export const authService = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  me: () => api.get('/auth/me'),
  updateProfile: (payload) => api.patch('/auth/me', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/auth/reset-password', { token, new_password }),
};

// ─── Registration service (candidature) ──────────────────────────────
export const registrationService = {
  // Pubblico: conteggi slot per un event-song
  getSlotsAvailability: (eventSongId) =>
    api.get(`/registrations/slots-availability/${eventSongId}`),

  // Autenticato: crea candidatura
  create: (payload) => api.post('/registrations', payload),

  // Autenticato: le mie candidature
  getMine: () => api.get('/registrations/me'),

  // Autenticato: ritira candidatura (soft delete)
  withdraw: (id) => api.delete(`/registrations/${id}`),

  // Admin: tutte le candidature di un evento
  getByEvent: (eventId) => api.get(`/events/${eventId}/registrations`),
};

// ─── Helper: risolve eventSongId da (eventId, songId) ────────────────
export const resolveEventSongId = (eventId, songId) =>
  api.get(`/events/${eventId}/songs/${songId}/event-song-id`);

export default api;