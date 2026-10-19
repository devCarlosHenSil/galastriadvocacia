/**
 * The sanitiser of the HTML of the site (SEC-R-28).
 *
 * The content of the WordPress reaches the pages through `set:html` — the
 * HTML widget, the text editor, the posts and the policies. The CSP allows
 * `'unsafe-inline'` (the styles and os scripts inline do site), so a `<script>`
 * or an `on…=` handler that survived the extraction would run.
 *
 * The sanitiser runs **at build time**, inside the extraction: the data that
 * reaches the repository is already safe, and the extraction **asserts** it
 * (no `on…=`, no `javascript:`, no `<script`, no `<iframe`).
 *
 * It is a small allow-list filter — not a full parser: the input is the
 * content of a WordPress (the client's own site), not an untrusted request.
 */
import { hasJavascriptUrl } from '../../lib/forbidden.mjs';

/** The tags that the Elementor really emits (D6: the headings are kept). */
export const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'button', 'caption', 'circle', 'code', 'col',
  'colgroup', 'dd', 'del', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'g', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'label', 'li', 'line', 'mark', 'ol', 'p',
  'path', 'polygon', 'polyline', 'pre', 'rect', 's', 'small', 'span', 'strong', 'sub', 'sup',
  'svg', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul',
]);

/** The attributes that survive. */
export const ALLOWED_ATTRIBUTES = new Set([
  'alt', 'border', 'class', 'colspan', 'color', 'cx', 'cy', 'd', 'dir', 'fill', 'fill-opacity',
  'height', 'href', 'lang', 'loading', 'r', 'rel', 'role', 'rowspan', 'rx', 'ry', 'src',
  'start', 'stroke', 'stroke-width', 'style', 'target', 'title', 'transform', 'viewbox',
  'width', 'x', 'x1', 'x2', 'y', 'y1', 'y2',
]);

/** The tags whose content is removed with them. */
const DANGEROUS = ['script', 'iframe', 'object', 'embed', 'applet', 'style', 'form', 'noscript', 'template'];

/** The tags that may carry a `data:` URL (the inline SVG of the Elementor). */
const DATA_URL_TAGS = new Set(['img', 'svg', 'div', 'figure', 'source', 'path']);

/**
 * The attributes of a tag, filtered.
 * @param {string} tag
 * @param {string} raw the attributes, as they are in the markup
 * @returns {string}
 */
function filterAttributes(tag, raw) {
  const kept = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    // The event handlers and everything that is not in the list are dropped.
    if (!ALLOWED_ATTRIBUTES.has(name)) continue;
    // D5 — the `javascript:` URLs are tested **after** the normalisation: the
    // browser decodes the entities (`javascript&colon;`) and strips the
    // control characters (`java&#9;script:`).
    if (hasJavascriptUrl(value)) continue;
    if (/^\s*data:/i.test(value) && !DATA_URL_TAGS.has(tag)) continue;
    kept.push(value === '' ? name : `${name}="${value.replace(/"/g, '&quot;')}"`);
  }
  return kept.length > 0 ? ` ${kept.join(' ')}` : '';
}

/**
 * Sanitises a fragment of HTML.
 * @param {string} html
 * @returns {string} the sanitised HTML
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string' || html === '') return html;
  let out = html;

  // 1. The dangerous elements, with their content.
  for (const tag of DANGEROUS) {
    out = out.replace(new RegExp(`<\\s*${tag}\\b[\\s\\S]*?<\\s*/\\s*${tag}\\s*>`, 'gi'), '');
    // An unclosed tag swallows the rest of the fragment — it is dropped too.
    out = out.replace(new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*$`, 'gi'), '');
  }

  // 2. The tags that are not allowed: the tag goes, the content stays.
  out = out.replace(/<\s*(\/?)([a-z][a-z0-9:-]*)\b([^>]*)>/gi, (match, slash, tag, attrs) => {
    const name = tag.toLowerCase();
    if (ALLOWED_TAGS.has(name)) {
      if (slash) return `</${name}>`;
      return `<${name}${filterAttributes(name, attrs)}>`;
    }
    return '';
  });

  // 3. The comments (they can carry a conditional comment with code).
  out = out.replace(/<!--[\s\S]*?-->/g, '');

  return out;
}

/**
 * The patterns that must not survive in the emitted content.
 * @type {Array<[string, RegExp]>}
 */
export const FORBIDDEN_IN_CONTENT = [
  ['an event handler', /\son[a-z]+\s*=/i],
  ['a javascript: URL', /javascript\s*:/i],
  ['a <script>', /<script\b/i],
  ['an <iframe>', /<iframe\b/i],
  ['an <object>', /<object\b/i],
  ['an <embed>', /<embed\b/i],
];

/**
 * Finds the forbidden patterns in a content.
 * @param {string} content
 * @returns {string[]} the labels of the patterns that were found
 */
export function findForbiddenInContent(content) {
  return FORBIDDEN_IN_CONTENT.filter(([, pattern]) => pattern.test(content)).map(([label]) => label);
}
