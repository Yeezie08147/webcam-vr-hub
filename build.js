import fs from 'fs';
import path from 'path';

const outDir = path.resolve(process.cwd(), 'dist');

console.log('🚀 Building Webcam VR Hub for Production (Lovable / Static Hosting)...');

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

const dirsToCopy = ['js', 'lib', 'games', 'css', 'assets'];
for (const dir of dirsToCopy) {
  const src = path.resolve(process.cwd(), dir);
  const dest = path.resolve(outDir, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true, force: true });
    console.log(`  ✔ Copied directory: ${dir}/ -> dist/${dir}/`);
  }
}

const filesToCopy = ['index.html', 'favicon.ico', '.nojekyll', 'README.md'];
for (const file of filesToCopy) {
  const src = path.resolve(process.cwd(), file);
  const dest = path.resolve(outDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✔ Copied file: ${file} -> dist/${file}`);
  }
}

console.log('✅ Build complete! Output ready in ./dist');
