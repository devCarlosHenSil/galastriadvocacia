/**
 * The write allow-list of the extraction (SPEC-DATA §4.3, item 4).
 *
 * Everything the extraction writes goes through `assertWritable`: anything
 * that is not on the list is a bug and aborts the extraction (C15).
 */
import { isAbsolute, relative } from 'node:path';

/**
 * @param {string} parent
 * @param {string} child
 * @returns {boolean} true when `child` is inside `parent`
 */
export function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * The paths the extraction is allowed to write (SPEC-DATA §4.3, item 4).
 * Anything else is a bug and aborts the extraction.
 */
export const ALLOWED_WRITE_PREFIXES = Object.freeze([
  'src/',
  'public/wp-content/uploads/',
  'public/css/',
  'public/fonts/',
  'public/js/',
  'tests/fixtures/',
  'docs/_reference/',
  'docs/audit/comentarios-retidos.md',
]);

/**
 * @param {string} file the path of the file, relative to the project
 */
export function assertWritable(file) {
  const allowed = ALLOWED_WRITE_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix,
  );
  if (!allowed) {
    throw new Error(
      `the extraction tried to write outside the allow-list: ${file}\n` +
        `Allowed: ${ALLOWED_WRITE_PREFIXES.join(', ')}`,
    );
  }
}

/**
 * The path of an asset, relative to `uploads/`.
 *
 * A `..` (or a path absoluto) escreveria **fora** de
 * `public/wp-content/uploads/` — por exemplo um `public/wp-config.php`.
 *
 * @param {string} src
 */
export function assertSafeAssetPath(src) {
  if (typeof src !== 'string' || src === '') {
    throw new Error('the path of the asset is empty');
  }
  if (src.includes('..') || src.startsWith('/') || src.startsWith('\\') || /^[A-Za-z]:/.test(src)) {
    throw new Error(`the path of the asset is not safe (path traversal): ${src}`);
  }
}
