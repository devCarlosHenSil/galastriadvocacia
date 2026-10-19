/**
 * Self hosted fonts (R12).
 *
 * Nunito, Questrial and Qwigley are already local in the backup; Roboto and
 * Montserrat are downloaded from Google Fonts (latin subset, woff2).
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rewriteCssUrls } from './assets.mjs';

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2';

/** A modern User-Agent is required to get the woff2 files. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** The families that must be downloaded. */
export const DOWNLOADED_FONTS = [
  { family: 'Roboto', weight: 300, file: 'roboto/roboto-latin-300.woff2' },
  { family: 'Roboto', weight: 400, file: 'roboto/roboto-latin-400.woff2' },
  { family: 'Roboto', weight: 500, file: 'roboto/roboto-latin-500.woff2' },
  { family: 'Roboto', weight: 900, file: 'roboto/roboto-latin-900.woff2' },
  { family: 'Montserrat', weight: 700, file: 'montserrat/montserrat-latin-700.woff2' },
];

/**
 * @param {string} cacheDir
 * @returns {Promise<string>} the cache directory
 */
export async function ensureCache(cacheDir) {
  await mkdir(cacheDir, { recursive: true });
  return cacheDir;
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

/**
 * @param {string} url
 * @param {string} target
 * @returns {Promise<void>}
 */
async function fetchBinary(url, target) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, buffer);
}

/**
 * Download the latin subset of a family / weight.
 * @param {object} ctx
 * @param {string} ctx.cacheDir
 * @param {string} ctx.publicFontsDir
 * @param {string} ctx.family
 * @param {number} ctx.weight
 * @param {string} ctx.file the path inside `public/fonts`
 * @returns {Promise<string>} the public URL of the font file
 */
async function downloadFont(ctx) {
  const { cacheDir, publicFontsDir, family, weight, file } = ctx;
  const target = join(publicFontsDir, ...file.split('/'));
  const cached = join(cacheDir, file);

  if (existsSync(cached)) {
    await mkdir(join(target, '..'), { recursive: true });
    await copyFile(cached, target);
    return `/fonts/${file}`;
  }
  if (existsSync(target)) {
    await mkdir(join(cached, '..'), { recursive: true });
    await copyFile(target, cached);
    return `/fonts/${file}`;
  }

  const css = await fetchText(`${GOOGLE_FONTS_CSS}?family=${family}:wght@${weight}&display=swap`);
  // The "latin" subset is the last @font-face block of the response.
  const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g)];
  const latin = blocks.find((b) => b[1] === 'latin') ?? blocks[blocks.length - 1];
  if (!latin) throw new Error(`no @font-face found for ${family} ${weight}`);
  const url = /url\((['"]?)(https:[^)'"]+)\1\)/.exec(latin[2])?.[2];
  if (!url) throw new Error(`no woff2 url found for ${family} ${weight}`);

  await fetchBinary(url, cached);
  await mkdir(join(target, '..'), { recursive: true });
  await copyFile(cached, target);
  return `/fonts/${file}`;
}

/**
 * The @font-face rules of the local Elementor fonts.
 * @param {string} uploadsDir
 * @returns {Promise<string>}
 */
export async function localFontFaces(uploadsDir) {
  const cssDir = join(uploadsDir, 'elementor', 'google-fonts', 'css');
  const out = [];
  for (const name of ['questrial', 'nunito', 'qwigley']) {
    const file = join(cssDir, `${name}.css`);
    if (!existsSync(file)) continue;
    const css = await readFile(file, 'utf8');
    out.push(
      rewriteCssUrls(css, '/wp-content/uploads/elementor/google-fonts/css').trim(),
    );
  }
  return out.join('\n\n');
}

/**
 * Build `public/css/fonts.css` and copy the woff2 files.
 * @param {object} ctx
 * @param {string} ctx.uploadsDir
 * @param {string} ctx.publicDir the `public/` directory of the project
 * @param {string} ctx.cacheDir
 * @param {boolean} ctx.amsterdam include the Amsterdam TTF
 * @returns {Promise<{ faces: number, downloaded: string[] }>}
 */
export async function buildFonts(ctx) {
  const { uploadsDir, publicDir, cacheDir, amsterdam } = ctx;
  const publicFontsDir = join(publicDir, 'fonts');
  await mkdir(publicFontsDir, { recursive: true });
  await ensureCache(cacheDir);

  const downloaded = [];
  const faces = [];

  for (const font of DOWNLOADED_FONTS) {
    const url = await downloadFont({ ...ctx, publicFontsDir, ...font });
    downloaded.push(url);
    faces.push(
      [
        '@font-face {',
        `  font-family: "${font.family}";`,
        '  font-style: normal;',
        `  font-weight: ${font.weight};`,
        '  font-display: swap;',
        `  src: url("${url}") format("woff2");`,
        '}',
      ].join('\n'),
    );
  }

  if (amsterdam) {
    const src = join(uploadsDir, '2024', '12', 'Amsterdam.ttf');
    if (existsSync(src)) {
      await copyFile(src, join(publicFontsDir, 'Amsterdam.ttf'));
      faces.push(
        [
          '@font-face {',
          '  font-family: "Amsterdam";',
          '  font-style: normal;',
          '  font-weight: 400;',
          '  font-display: swap;',
          '  src: url("/fonts/Amsterdam.ttf") format("truetype");',
          '}',
        ].join('\n'),
      );
    }
  }

  const local = await localFontFaces(uploadsDir);
  const css = `/* Self hosted fonts (R12). Generated by scripts/extract/lib/fonts.mjs. */\n\n${faces.join('\n\n')}\n\n${local}\n`;
  await writeFile(join(publicDir, 'css', 'fonts.css'), css, 'utf8');
  return { faces: faces.length + (local.match(/@font-face/g) ?? []).length, downloaded };
}
