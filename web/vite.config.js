import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies the API and WebSocket to the Node backend on :4000,
// so the whole app runs from http://localhost:5173 with no CORS dance.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4100',
      '/ws': { target: 'ws://localhost:4100', ws: true },
    },
  },
});
