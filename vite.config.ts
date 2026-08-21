import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleMockApiRequest } from './server/mockServer.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'valheim-mock-server-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api/')) {
            const handled = handleMockApiRequest(req, res);
            if (handled) return;
          }
          next();
        });
      },
    },
  ],
});
