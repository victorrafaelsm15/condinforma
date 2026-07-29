import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves this repo at /condinforma/, so only the production
  // build needs the subpath prefix — local dev stays at the root.
  base: mode === 'production' ? '/condinforma/' : '/',
  plugins: [react()],
}))
