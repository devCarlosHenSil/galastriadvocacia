/**
 * Phase 2 — consolidation of the CSS and self hosted fonts.
 *
 *   node scripts/css.mjs [--backup <backup dir>] [--out <project root>]
 *
 * The script is **offline**: every stylesheet is read from the local backup
 * of the WordPress site, and the dynamic CSS of the Kava theme is read from
 * `docs/_reference/kava-theme-dynamic.css` (committed). The Wayback snapshot
 * of the home page is only an optional fallback.
 */
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCss, copyFontAwesome5 } from './extract/lib/css.mjs';
import { buildFonts } from './extract/lib/fonts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');

const args = { backup: '..', out: '.' };
for (let i = 0; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const key = process.argv[i].slice(2);
  const value = process.argv[i + 1];
  if (value === undefined) throw new Error(`missing value for --${key}`);
  args[key] = value;
  i++;
}

const backupDir = resolve(process.cwd(), args.backup);
const outDir = resolve(process.cwd(), args.out);
const publicDir = join(outDir, 'public');

/**
 * The dynamic CSS of the Kava theme: the committed copy first, the Wayback
 * snapshot only as a fallback.
 */
let dynamicCssFile = join(PROJECT_ROOT, 'docs', '_reference', 'kava-theme-dynamic.css');
if (!existsSync(dynamicCssFile) && process.env.WAYBACK_SNAPSHOT) {
  dynamicCssFile = resolve(process.env.WAYBACK_SNAPSHOT);
}

if (!existsSync(backupDir)) {
  console.error(`the backup directory was not found: ${backupDir}`);
  process.exit(1);
}

const bundles = await buildCss({ backupDir, publicDir, dynamicCssFile });
const webfonts = await copyFontAwesome5({ backupDir, publicDir });
const fonts = await buildFonts({
  uploadsDir: join(backupDir, 'uploads'),
  publicDir,
  cacheDir: join(tmpdir(), 'galastri-fonts-cache'),
  amsterdam: true,
});

console.log(`CSS written to ${join(publicDir, 'css')}`);
for (const bundle of bundles) console.log(`  ${bundle.file.padEnd(24)} ${bundle.bytes} bytes`);
console.log(`Font Awesome 5 web fonts: ${webfonts.length}`);
console.log(`fonts.css: ${fonts.faces} @font-face rules, ${fonts.downloaded.length} downloaded files`);
