/**
 * Idempotency check (SPEC-DATA §6.4).
 *
 * Runs the extraction again into a temporary directory and compares the
 * SHA-256 of every produced file with the committed output.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..', '..');

/**
 * The paths the extraction writes to (SPEC-DATA §4.3, item 4). The CSS and
 * the fonts of `public/css` and `public/fonts` are produced by
 * `scripts/css.mjs` — a different step — and the layout / the scaffold page
 * are hand written.
 */
const OUTPUT_PATHS = [
  'src/content/blog',
  'src/data',
  'src/pages/politica-de-privacidade.md',
  'src/pages/politica-de-cookies-galastri-advocacia.md',
  'src/pages/politica-de-uso-de-inteligencia-artificial-galastri-advocacia.md',
  'public/wp-content/uploads',
  'tests/fixtures',
  'docs/_reference',
];

/**
 * The files of the compared directories that are **not** produced by the
 * extraction — they are references or they are produced by another step:
 *  - the dynamic CSS of the Kava theme comes from the Wayback snapshot (it
 *    is committed so that `npm run css` never needs the network);
 *  - the paths of the icons of the Font Awesome come from the plugins of
 *    the backup (`scripts/css.mjs`).
 */
const NOT_EXTRACTED = [
  'docs/_reference/kava-theme-dynamic.css',
  'src/data/fontawesome-icons.json',
  // The golden fixtures of the dynamic widgets: they are produced by
  // `npm run update-parity-fixtures` (from the build), not by the extraction.
  'tests/fixtures/nav-menu.html',
  'tests/fixtures/upk-grid.html',
  // REV-7 (E6): the SEO overrides are **written by hand** (the editor's
  // file) — the extraction merges them, it does not write them.
  'src/data/seo-overrides.json',
];

/**
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {Promise<string[]>}
 */
async function listFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const info = await stat(dir);
  if (!info.isDirectory()) return [prefix];
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out;
}

/**
 * @param {string} file
 * @returns {Promise<string>}
 */
async function sha256(file) {
  const buffer = await readFile(file);
  return createHash('sha256').update(buffer).digest('hex');
}

const tmp = await mkdtemp(join(tmpdir(), 'galastri-extract-'));
process.stdout.write(`re-running the extraction into ${tmp}\n`);

const args = process.argv.slice(2);
const child = spawn(process.execPath, [join(HERE, 'index.mjs'), '--out', tmp, ...args], {
  stdio: 'inherit',
  cwd: PROJECT_ROOT,
});
const code = await new Promise((resolvePromise) => child.on('close', resolvePromise));
if (code !== 0) {
  console.error('the second extraction failed');
  process.exit(code ?? 1);
}

/** @type {Map<string, string>} */
const committed = new Map();
/** @type {Map<string, string>} */
const fresh = new Map();

// REV-7 (E6): só se comparam os ficheiros que a **extração** escreveu (o
// relatório diz quais) — os ficheiros escritos à mão (um post novo, as
// overrides do SEO) ficam de fora da comparação.
let generated = null;
try {
  const report = JSON.parse(
    await readFile(join(PROJECT_ROOT, 'docs', '_reference', 'extract-report.json'), 'utf8'),
  );
  generated = new Set(report.writtenFiles ?? []);
} catch {
  generated = null;
}
for (const dir of OUTPUT_PATHS) {
  for (const rel of await listFiles(join(PROJECT_ROOT, dir), dir)) {
    if (NOT_EXTRACTED.includes(rel)) continue;
    if (generated && !generated.has(rel)) continue;
    committed.set(rel, await sha256(join(PROJECT_ROOT, ...rel.split('/'))));
  }
  for (const rel of await listFiles(join(tmp, dir), dir)) {
    if (NOT_EXTRACTED.includes(rel)) continue;
    if (generated && !generated.has(rel)) continue;
    fresh.set(rel, await sha256(join(tmp, ...rel.split('/'))));
  }
}

const problems = [];
for (const [file, hash] of committed) {
  if (!fresh.has(file)) problems.push(`missing in the second run: ${file}`);
  else if (fresh.get(file) !== hash) problems.push(`different content: ${file}`);
}
for (const file of fresh.keys()) {
  if (!committed.has(file)) problems.push(`not committed: ${file}`);
}

await rm(tmp, { recursive: true, force: true });

if (problems.length > 0) {
  console.error(`\n${problems.length} idempotency problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`\nIdempotency OK — ${committed.size} files identical between the two runs.`);
