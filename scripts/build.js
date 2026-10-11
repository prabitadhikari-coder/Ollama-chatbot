const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[Build] Step 1: Installing frontend dependencies...');
execSync('npm --prefix frontend install', { stdio: 'inherit' });

console.log('[Build] Step 2: Compiling TypeScript and bundling with Vite...');
execSync('npm --prefix frontend run build', { stdio: 'inherit' });

console.log('[Build] Step 3: Mirroring build output to root dist/ for Cloudflare Pages compatibility...');
const srcDist = path.join(__dirname, '..', 'frontend', 'dist');
const targetDist = path.join(__dirname, '..', 'dist');

if (fs.existsSync(srcDist)) {
  fs.cpSync(srcDist, targetDist, { recursive: true });
}

console.log('[Build] ✓ Build finished successfully! Output available in both dist/ and frontend/dist/');
