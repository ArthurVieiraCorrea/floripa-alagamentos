import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api':  'http://localhost:3001',
      '/auth': 'http://localhost:3001'
    }
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/pages/landing.html'),
        app:   resolve(__dirname, 'index.html')
      }
    }
  }
});
