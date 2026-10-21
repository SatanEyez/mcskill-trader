import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Загруженные картинки лежат на API, но отдаются по относительному пути.
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Socket.io для служебного чата: WebSocket + polling handshake.
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  preview: {
    port: 4173,
  },
});
