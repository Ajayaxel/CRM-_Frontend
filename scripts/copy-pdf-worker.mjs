/**
 * Copies pdf.js's worker into public/ so it is served from our own origin.
 *
 * Bundler-specific tricks for resolving a worker URL (`?url`, import.meta.url)
 * behave differently across Next versions and fail at runtime rather than at
 * build — the conversion would simply hang the first time a customer uploaded a
 * PDF. A file at a known path cannot do that. It is copied rather than committed
 * so it always matches the installed pdfjs-dist.
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const pkg = require.resolve('pdfjs-dist/package.json');
const src = join(dirname(pkg), 'build', 'pdf.worker.min.mjs');
const outDir = join(process.cwd(), 'public');

if (!existsSync(src)) {
  console.error(`[pdf-worker] not found at ${src} — PDF letterhead conversion will not work`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, 'pdf.worker.min.mjs'));
console.log('[pdf-worker] copied to public/pdf.worker.min.mjs');
