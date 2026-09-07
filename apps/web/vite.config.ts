import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/t': 'http://localhost:3001',
      '/r': 'http://localhost:3001',
    },
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['marketing.bitefordeals.com'],
    proxy: {
      '/api': 'http://localhost:3001',
      '/t': 'http://localhost:3001',
      '/r': 'http://localhost:3001',
    },
  },
});
