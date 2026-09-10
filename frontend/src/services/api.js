import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

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
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  downloadUrl: (id) => `${API_URL}/documents/${id}/download`,
  rawUrl: (id) => `${API_URL}/documents/${id}/raw`,
  viewUrl: (id) => `${API_URL}/documents/${id}/view`,
};

export default api;