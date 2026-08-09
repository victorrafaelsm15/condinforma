import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // GitHub Pages serves this repo at /condinforma/, so production builds
  // need that subpath prefix — but Vercel (and any other host serving from
  // the domain root) needs base "/", or every asset request 404s and the
  // page never even mounts (blank white screen, no error boundary can help
  // since React itself never loads). Vercel's build system always sets the
  // VERCEL env var automatically, no manual config needed on their end.
  const isVercel = Boolean(process.env.VERCEL);
  const base = mode === 'production' && !isVercel ? '/condinforma/' : '/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // injectManifest (em vez de generateSW): precisa de um service
        // worker escrito à mão (src/sw.js) pra poder ouvir o evento "sync"
        // da Background Sync API, usado pela fila offline de execuções/
        // ocorrências — o modo generateSW anterior não permite isso.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
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
        // Precache do app shell e o resto do runtime caching (Supabase
        // network-first, Google Fonts cache-first) ficam escritos à mão em
        // src/sw.js — só o glob do que entra no precache manifest continua
        // configurado aqui.
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // vite-plugin-pwa SEMPRE registra o service worker de produção
          // como script clássico (não módulo), mesmo com injectManifest —
          // "es" (o default) deixa `import.meta` sobrando no bundle, que é
          // sintaxe inválida fora de um módulo e quebra o registro
          // silenciosamente (ServiceWorker script evaluation failed).
          // "iife" faz o Rollup substituir isso por um shim compatível.
          rollupFormat: 'iife',
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
  };
})
