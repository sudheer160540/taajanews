/**
 * After client build, rename index.html → template.html so hosts like Vercel
 * do not serve an empty static shell for /. All HTML routes must go through SSR.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist/client'
);
const indexPath = path.join(clientDir, 'index.html');
const templatePath = path.join(clientDir, 'template.html');

if (!fs.existsSync(indexPath)) {
  console.warn('[ssr] dist/client/index.html not found — skip template rename');
  process.exit(0);
}

fs.renameSync(indexPath, templatePath);
console.log('[ssr] Renamed index.html → template.html (forces server-side rendering)');
