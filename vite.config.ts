import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `vite build --mode single` bundles everything into one script so
// scripts/single.mjs can inline it into a self-contained HTML page.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: mode === 'single' ? { output: { inlineDynamicImports: true } } : {},
  },
}))
