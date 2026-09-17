import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // SoundFont (GeneralUser GS)
      '/soundfonts': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Upload documenti
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});