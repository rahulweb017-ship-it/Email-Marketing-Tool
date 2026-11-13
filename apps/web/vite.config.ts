import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// '/t' and '/r' must only match the tracking routes; a bare prefix would also
// swallow SPA pages like /templates and /register on refresh.
// xfwd passes the visitor's IP to the API (used to rate-limit public forms).
const api = { target: 'http://localhost:3001', xfwd: true };
const apiProxy = {
  '/api': api,
  '^/t/': api,
  '^/r/': api,
  '/webhooks': api,
  '/media': api,
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['marketing.bitefordeals.com'],
    proxy: apiProxy,
  },
});
