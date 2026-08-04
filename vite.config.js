import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // GitHub Pages serves this repo at /condinforma/, so only the production
  // build needs the subpath prefix — local dev stays at the root.
  const base = mode === 'production' ? '/condinforma/' : '/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Cond-Informa',
          short_name: 'Cond-Informa',
          description: 'Checklists digitais com QR Code para condomínios — limpeza, zeladoria e manutenção.',
          lang: 'pt-BR',
          theme_color: '#3355e8',
          background_color: '#0a0e27',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: base,
          scope: base,
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // App shell (JS/CSS/ícones/HTML) é pré-cacheado no build e servido
          // direto do cache (cache-first) — é o comportamento padrão do
          // Workbox pra assets do precache manifest.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: `${base}index.html`,
          runtimeCaching: [
            {
              // Chamadas ao Supabase (dados de condomínios/ambientes/checklists/
              // execuções): tenta a rede primeiro (dado tem que estar
              // atualizado quando há conexão), com fallback pro cache se
              // ficar offline ou a rede demorar demais.
              urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-data',
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 3 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Fontes do Google Fonts usadas no design.
              urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
  };
})
