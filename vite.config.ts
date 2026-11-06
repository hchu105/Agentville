import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite build --mode single` bundles everything into one script so
// scripts/single.mjs can inline it into a self-contained HTML page.
// World images have to travel inside that script as data URLs.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    rollupOptions: mode === 'single' ? { output: { inlineDynamicImports: true } } : {},
  },
}))
