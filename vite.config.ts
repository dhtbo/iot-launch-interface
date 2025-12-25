import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { StepsEngine } from './services/stepsEngine';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const engine = new StepsEngine();
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      base: './',
      plugins: [
        {
          name: 'api-middleware',
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              const url = new URL(req.url || '/', `http://${req.headers.host}`);
              if (url.pathname.startsWith('/api/steps')) {
                await engine.handleNodeRequest(req, res);
                return;
              }
              next();
            });
          },
        },
        react(),
        tailwindcss()
      ],
      build: {
        chunkSizeWarningLimit: 2048,
        rollupOptions: {
          output: {
            manualChunks(id: string) {
              if (id.includes('node_modules')) {
                if (id.includes('react')) return 'react';
                if (id.includes('p5')) return 'p5';
              }
            },
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
