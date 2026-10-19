/**
 * The inline SVG of the icons of the site.
 *
 * The Elementor renders the SVG icons **inline** (the CSS copied verbatim
 * selects on the `svg` element and applies the `fill` of the widget to it),
 * so the files of `public/wp-content/uploads/` are read at build time and
 * inlined in the HTML.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cache = new Map<string, string>();

/**
 * The inline SVG of an uploaded icon.
 * @param {string} url the public URL of the SVG (e.g. `/wp-content/uploads/…svg`)
 * @returns {string} the content of the file, or an empty string
 */
export function inlineSvg(url: string): string {
  if (typeof url !== 'string' || !url.endsWith('.svg')) return '';
  const cached = cache.get(url);
  if (cached !== undefined) return cached;
  const file = join(process.cwd(), 'public', ...url.split('/').filter(Boolean));
  let content = '';
  try {
    content = readFileSync(file, 'utf8').trim();
  } catch {
    content = '';
  }
  // The icons are decorative (SPEC-UI §4.4): the name of the widget is
  // already given by the label of the link.
  content = content.replace(
    /<svg\b/,
    '<svg aria-hidden="true" focusable="false"',
  );
  cache.set(url, content);
  return content;
}
