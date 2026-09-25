import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 8765,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
