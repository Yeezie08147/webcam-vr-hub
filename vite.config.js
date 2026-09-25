import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function copyStaticVrAssets() {
  return {
    name: 'copy-static-vr-assets',
    closeBundle() {
      const outDir = path.resolve(process.cwd(), 'dist');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const dirsToCopy = ['js', 'lib', 'games', 'css', 'assets'];
      for (const dir of dirsToCopy) {
        const src = path.resolve(process.cwd(), dir);
        const dest = path.resolve(outDir, dir);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true, force: true });
        }
      }
      const filesToCopy = ['index.html', 'favicon.ico', '.nojekyll'];
      for (const file of filesToCopy) {
        const src = path.resolve(process.cwd(), file);
        const dest = path.resolve(outDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [copyStaticVrAssets()],
  server: {
    port: 8765,
    host: true,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
