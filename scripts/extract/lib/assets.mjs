/**
 * The asset closure and the assets manifest (SPEC-DATA §3.6).
 */
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { collectUploadPaths, isDroppedByRuling, isPluginArtifact, isThumbnail } from './urls.mjs';
import { assertSafeAssetPath, assertWritable, isInside } from './allowlist.mjs';

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

/** The directories of `uploads/` that are copied as a whole (R1 + R12). */
export const VERBATIM_DIRS = Object.freeze(['elementor/css', 'elementor/google-fonts']);

/**
 * @param {string} filePath
 * @returns {string} the mime type of a file
 */
export function mimeOf(filePath) {
  const dot = filePath.lastIndexOf('.');
  return dot === -1 ? 'application/octet-stream' : (MIME_BY_EXT[filePath.slice(dot).toLowerCase()] ?? 'application/octet-stream');
}

/**
 * Recursively list the files of a directory, sorted.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {Promise<string[]>} the paths relative to `dir`, with `/` separators
 */
export async function listFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
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
 * @param {string} filePath
 * @param {string} url
 * @returns {Promise<string>} the file content with the absolute site URLs
 *   rewritten to the public paths
 */
export async function readCssWithRewrites(filePath, url) {
  const content = await readFile(filePath, 'utf8');
  return rewriteCssUrls(content, url);
}

/**
 * Rewrite the `url()` references of a CSS file. Idempotent.
 * @param {string} css
 * @param {string} url the public URL of the CSS file (used to resolve the
 *   relative `url()` references)
 * @param {Array<[string, string]>} [replacements] extra `[from, to]` pairs
 *   applied before the generic rules
 * @returns {string}
 */
export function rewriteCssUrls(css, url, replacements = []) {
  let out = css;
  for (const [from, to] of replacements) out = out.split(from).join(to);
  // absolute site URLs
  out = out.split('https://galastriadvocacia.com.br/wp-content/').join('/wp-content/');
  out = out.split('https:\\/\\/galastriadvocacia.com.br\\/wp-content\\/').join('/wp-content/');
  // protocol relative site URLs
  out = out.split('//galastriadvocacia.com.br/wp-content/').join('/wp-content/');
  // Google Fonts
  out = out.split('//fonts.googleapis.com').join('');
  out = out.split('//fonts.gstatic.com').join('');
  out = out.split('https://fonts.googleapis.com').join('');
  out = out.split('https://fonts.gstatic.com').join('');
  // the relative references of the local font CSS files
  if (url) {
    const dir = posix.dirname(url);
    out = out.replace(/url\((['"]?)\.\.\//g, (_, quote) => `url(${quote}${dir}/`);
  }
  return out;
}

/**
 * Build the asset closure and copy it to the public directory.
 * @param {object} ctx
 * @param {string} ctx.uploadsDir the `uploads/` directory of the backup
 * @param {string} ctx.outDir the root of the project
 * @param {Array<{file: string, kind: string, paths: string[]}>} ctx.references
 * @param {Map<string, {width: number|null, height: number|null}>} ctx.attachmentSizes
 * @param {(css: string) => string} [ctx.transformCss] applied to the copied CSS
 * @returns {Promise<object>} the manifest
 */
export async function buildAssets(ctx) {
  const { uploadsDir, outDir, references, attachmentSizes } = ctx;
  const publicBase = '/wp-content/uploads/';
  const publicDir = join(outDir, 'public', 'wp-content', 'uploads');

  // The closure is exact: the directory is emptied first, so that a file that
  // is no longer referenced does not survive in `public/` (U8 changed the file
  // of the logo of the footer).
  await rm(publicDir, { recursive: true, force: true });
  await mkdir(publicDir, { recursive: true });

  /** @type {Map<string, Array<{file: string, kind: string}>>} */
  const referencedBy = new Map();
  const skipped = { thumbnails: 0, srcsetCandidates: 0, pluginArtifacts: 0, unreferenced: 0, rulingDrops: 0 };
  const missing = [];

  for (const reference of references) {
    for (const path of reference.paths) {
      if (isThumbnail(path)) {
        skipped.thumbnails++;
        continue;
      }
      if (isPluginArtifact(path)) {
        skipped.pluginArtifacts++;
        continue;
      }
      if (isDroppedByRuling(path)) {
        skipped.rulingDrops++;
        continue;
      }
      if (!existsSync(join(uploadsDir, ...path.split('/')))) {
        missing.push({ src: path, referencedBy: [reference.file] });
        continue;
      }
      if (!referencedBy.has(path)) referencedBy.set(path, []);
      referencedBy.get(path).push({ file: reference.file, kind: reference.kind });
    }
  }

  // The Elementor CSS and the local Google Fonts are copied as a whole (R1, R12).
  const verbatim = [];
  for (const dir of VERBATIM_DIRS) {
    for (const rel of await listFiles(join(uploadsDir, ...dir.split('/')))) {
      verbatim.push(`${dir}/${rel}`);
    }
  }

  const all = [...new Set([...referencedBy.keys(), ...verbatim])].sort();

  const assets = [];
  let totalBytes = 0;
  for (const src of all) {
    // C15 — o caminho do asset é validado (sem `..`, sem caminho absoluto) e
    // a escrita passa pela allow-list: um `..` no dump escreveria fora de
    // `public/wp-content/uploads/` (por exemplo um `public/wp-config.php`).
    assertSafeAssetPath(src);
    const from = join(uploadsDir, ...src.split('/'));
    const to = join(publicDir, ...src.split('/'));
    assertWritable(`public/wp-content/uploads/${src}`);
    if (!isInside(publicDir, to)) {
      throw new Error(`the asset would be written outside the uploads directory: ${src}`);
    }
    await mkdir(dirname(to), { recursive: true });
    if (src.endsWith('.css')) {
      const content = await readFile(from, 'utf8');
      const rewritten = rewriteCssUrls(content, `${publicBase}${src}`);
      await writeFile(to, rewritten, 'utf8');
    } else {
      await copyFile(from, to);
    }
    const info = await stat(to);
    const size = attachmentSizes.get(src);
    assets.push({
      src,
      dest: `${publicBase}${src}`,
      bytes: info.size,
      mime: mimeOf(src),
      width: size?.width ?? null,
      height: size?.height ?? null,
      referencedBy: referencedBy.get(src) ?? [],
      refCount: (referencedBy.get(src) ?? []).length,
    });
    totalBytes += info.size;
  }

  // Count the files of `uploads/` that were not copied.
  const uploaded = await listFiles(uploadsDir);
  for (const rel of uploaded) {
    if (all.includes(rel)) continue;
    if (isThumbnail(rel)) skipped.thumbnails++;
    else if (isPluginArtifact(rel)) skipped.pluginArtifacts++;
    else if (isDroppedByRuling(rel)) skipped.rulingDrops++;
    else skipped.unreferenced++;
  }

  const cssFiles = assets.filter((a) => a.src.endsWith('.css')).length;
  const fontFiles = assets.filter((a) => /\.(woff2?|ttf|otf)$/i.test(a.src)).length;

  return {
    meta: {
      sourceRoot: 'uploads',
      publicBase,
      totalFiles: assets.length,
      totalBytes,
      cssFiles,
      fontFiles,
    },
    assets,
    missing: missing.sort((a, b) => a.src.localeCompare(b.src)),
    skipped,
  };
}

/**
 * @param {string} projectDir
 * @returns {string[]} the files of `public/wp-content/uploads`
 */
export async function listPublicUploads(projectDir) {
  return listFiles(join(projectDir, 'public', 'wp-content', 'uploads'));
}
