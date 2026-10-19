#!/usr/bin/env node
/**
 * The visual parity check (T6.2 — the pixel diff).
 *
 *   node scripts/visual-diff.mjs [--dist <dist dir>] [--out <dir>] [--route <route>]
 *
 * It renders the built site in the three viewports of SPEC-UI §5.2 and
 * compares the result with the reference screenshots of `tests/visual/reference/`.
 * The tolerated difference is **2 %** of the pixels (SPEC-UI §5.4).
 *
 * **Playwright is OPTIONAL.** It is not a dependency of the project: without it
 * (or without a browser) the script prints a clear message and **exits 0** —
 * the pixel diff is skipped, never failed. The **mandatory** check is the
 * structural one, `npm run check-parity` (R2), which needs no browser.
 *
 * To enable the pixel diff locally:
 *
 *   npm i -D playwright && npx playwright install chromium
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');

const args = { dist: 'dist', out: 'tests/visual/current', threshold: '0.02' };
for (let i = 0; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const key = process.argv[i].slice(2);
  const value = process.argv[i + 1];
  if (value === undefined) throw new Error(`missing value for --${key}`);
  args[key] = value;
  i++;
}

const DIST = resolve(process.cwd(), args.dist);
const OUT = resolve(process.cwd(), args.out);
const REFERENCE = resolve(PROJECT_ROOT, 'tests', 'visual', 'reference');
const THRESHOLD = Number(args.threshold);

/** The viewports of SPEC-UI §5.2. */
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
];

/** The routes compared by the pixel diff. */
const ROUTES = ['/', '/blog/', '/links/'];

/**
 * @param {string} message
 * @param {number} [code]
 */
function skip(message, code = 0) {
  console.log(`visual-diff: ${message}`);
  process.exit(code);
}

if (!existsSync(DIST)) {
  console.error(`visual-diff: the dist directory was not found: ${DIST} — run \`npm run build\` first.`);
  process.exit(1);
}

// --- Playwright is optional ---------------------------------------------------
let playwright;
try {
  playwright = await import('playwright');
} catch {
  skip(
    'Playwright unavailable — skipping the pixel diff. ' +
      'The mandatory structural check is `npm run check-parity` (R2), which needs no browser. ' +
      'To enable the pixel diff: `npm i -D playwright && npx playwright install chromium`.',
  );
}

let browser;
try {
  browser = await playwright.chromium.launch();
} catch (error) {
  skip(
    `Playwright is installed but no browser could be launched (${error.message.split('\n')[0]}) — skipping the pixel diff.`,
  );
}

// --- a static server for `dist/` ---------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let file = join(DIST, decodeURIComponent(url.pathname));
  if (file.endsWith('/') || !existsSync(file)) file = join(file, 'index.html');
  if (!existsSync(file)) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  response.end(await readFile(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

// --- the comparison ------------------------------------------------------------
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  await browser.close();
  server.close();
  skip('`sharp` unavailable — the screenshots were rendered but the pixel diff cannot be computed.');
}

await mkdir(OUT, { recursive: true });
const references = existsSync(REFERENCE) ? new Set(await readdir(REFERENCE)) : new Set();

const results = [];
for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    const name = `${route.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'home'}-${viewport.name}.png`;
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    // The animations of the Elementor would make the capture unstable.
    await page.evaluate(() => {
      document.querySelectorAll('.elementor-invisible').forEach((el) => el.classList.remove('elementor-invisible'));
      window.scrollTo(0, 0);
    });
    const buffer = await page.screenshot({ fullPage: true });
    await page.close();
    await writeFile(join(OUT, name), buffer);

    if (!references.has(name)) {
      results.push({ name, ratio: null, note: 'sem referência' });
      continue;
    }
    const reference = await readFile(join(REFERENCE, name));
    const [a, b] = await Promise.all([
      sharp(buffer).raw().toBuffer({ resolveWithObject: true }),
      sharp(reference).raw().toBuffer({ resolveWithObject: true }),
    ]);
    if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
      results.push({ name, ratio: 1, note: 'dimensões diferentes' });
      continue;
    }
    let different = 0;
    for (let i = 0; i < a.data.length; i += a.info.channels) {
      if (
        Math.abs(a.data[i] - b.data[i]) > 45 ||
        Math.abs(a.data[i + 1] - b.data[i + 1]) > 45 ||
        Math.abs(a.data[i + 2] - b.data[i + 2]) > 45
      ) {
        different++;
      }
    }
    const ratio = different / (a.info.width * a.info.height);
    results.push({ name, ratio, note: ratio <= THRESHOLD ? 'ok' : 'acima do limite' });
  }
}

await browser.close();
server.close();

const withoutReference = results.filter((r) => r.ratio === null);
const failed = results.filter((r) => r.ratio !== null && r.ratio > THRESHOLD);

for (const result of results) {
  const detail = result.ratio === null ? result.note : `${(result.ratio * 100).toFixed(3)} % (${result.note})`;
  console.log(`  ${result.name.padEnd(34)} ${detail}`);
}

if (withoutReference.length === results.length) {
  console.log(
    `\nvisual-diff: ${results.length} captura(s) em ${OUT} — nenhuma referência em tests/visual/reference/ para comparar.`,
  );
  console.log('visual-diff: as capturas foram geradas; o diff de pixels fica para quando as referências existirem.');
  process.exit(0);
}

if (failed.length > 0) {
  console.error(`\nvisual-diff: ${failed.length} par(es) acima do limite de ${(THRESHOLD * 100).toFixed(0)} %:`);
  for (const result of failed) console.error(`  - ${result.name}: ${(result.ratio * 100).toFixed(3)} %`);
  process.exit(1);
}
console.log(`\nvisual-diff: ${results.length} par(es) dentro do limite de ${(THRESHOLD * 100).toFixed(0)} %.`);
