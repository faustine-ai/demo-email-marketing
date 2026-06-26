import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies the API and WebSocket to the Node backend on :4100,
// so the whole app runs from http://localhost:5180 with no CORS dance.
// usePolling is needed when the source is a bind-mounted volume in Docker.
const usePolling = process.env.CHOKIDAR_USEPOLLING === 'true';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so the container's port mapping is reachable
    port: 5180,
    strictPort: true,
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': 'http://localhost:4100',
      '/ws': { target: 'ws://localhost:4100', ws: true },
    },
  },
});
