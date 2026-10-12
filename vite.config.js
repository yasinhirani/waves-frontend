import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt', // never auto-reload: it would interrupt the music
        injectRegister: false, // registered by <PwaPrompt /> (useRegisterSW)
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Waves – Music',
          short_name: 'Waves',
          description: 'Stream trending songs, playlists, albums and charts.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#0b0b10',
          theme_color: '#0b0b10',
          categories: ['music', 'entertainment'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ],
          shortcuts: [{ name: 'Search', url: '/search', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          // NOTE: audio streams are deliberately NOT cached/intercepted (large + Range requests)
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.includes('/api/v1/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [200] }
              }
            },
            {
              urlPattern: ({ url }) => /\.(?:jpe?g|png|webp)$/i.test(url.pathname) && url.hostname.endsWith('saavncdn.com'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'images',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        }
      })
    ],
    server: {
      port: 5173,
      // In dev, /api/* is proxied to the Express backend (no CORS setup needed)
      proxy: { '/api': { target: env.DEV_API_PROXY || 'http://localhost:5000', changeOrigin: true } }
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            data: ['@tanstack/react-query', 'axios', 'zustand']
          }
        }
      }
    }
  };
});
