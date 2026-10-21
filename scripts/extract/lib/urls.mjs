/**
 * URL rewriting rules (SPEC-DATA §5.1 `lib/urls.mjs`).
 *
 * The rules are applied in order and are idempotent: running them twice
 * produces exactly the same string.
 */

/**
 * O endereço canónico do site.
 *
 * ⚠️ **Decisão do dono (2026-10-20, D91):** o endereço público é
 * `https://www.galastriadvocacia.com.br` (o apex, `galastriadvocacia.com.br`,
 * deixou de ser o canónico). O `www` é o que o dono usa — e é o que o
 * sitemap, os `canonical`, o `og:url` e o JSON-LD anunciam.
 *
 * O **endereço antigo** (o apex, o do WordPress) continua a ser removido do
 * conteúdo importado — os links internos têm de ser **relativos** (`/blog/`,
 * `/#sobre`) para funcionarem em qualquer host (o canónico, a pré-visualização
 * `*.pages.dev` ou o `localhost`).
 */
export const SITE_ORIGIN = 'https://www.galastriadvocacia.com.br';

/** O endereço do WordPress antigo (o apex) — removido do conteúdo importado. */
export const LEGACY_ORIGIN = 'https://galastriadvocacia.com.br';

export const PUBLIC_UPLOADS = '/wp-content/uploads/';

/** Hosts that must never be contacted at runtime (self-hosted fonts, R12). */
const FONT_HOSTS = [
  '//fonts.googleapis.com',
  '//fonts.gstatic.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

/**
 * The internal links of the old site and their equivalent in the new one
 * (R4 — the routes are fixed by `src/data/site.json → routes`).
 *
 * The rules are applied to the quoted URLs only, so that they never touch the
 * prose of the policy pages.
 */
const INTERNAL_LINKS = [
  // `/home/#sobre` → `/#sobre` (the home is `/`, `/home/` is only an alias).
  [/(["'])\/home\/([^"']*)/g, '$1/$2'],
  // `/servicos/` never existed as a page: it is a section of the home.
  [/(["'])\/servicos\//g, '$1/#servicos'],
];

/**
 * Rewrite a single string.
 * @param {string} text
 * @param {{ keepSiteOrigin?: boolean }} [opts] `keepSiteOrigin` leaves the
 *   absolute site URLs alone (used for canonical / og:url, which must stay
 *   absolute).
 * @returns {string}
 */
export function rewriteUrls(text, opts = {}) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;

  // (4) Google Fonts references are removed — the fonts are self-hosted.
  for (const host of FONT_HOSTS) {
    out = out.split(host).join('');
  }

  if (!opts.keepSiteOrigin) {
    // Elementor escapes the slashes inside HTML strings.
    out = out.split('https:\\/\\/galastriadvocacia.com.br').join('');
    out = out.split(LEGACY_ORIGIN).join('');
    out = out.split(SITE_ORIGIN).join('');
  }

  // U17 — o alias `/home/` responde 200 com um meta-refresh para `/`: o
  // fragmento (`#anchor`) é descartado e o visitante aterra no topo da
  // página. Todos os links para o alias passam a apontar para a raiz.
  out = out.split('/home/#').join('/#');
  out = out.split('/home/').join('/');

  // (1) uploads, (2) plugins, (3) site root.
  out = out.split('wp-content/uploads/').join('/wp-content/uploads/');
  out = out.split('wp-content/plugins/').join('/wp-content/plugins/');
  out = out.split('wp-content/themes/').join('/wp-content/themes/');
  out = out.split('wp-content/elementor/').join('/wp-content/elementor/');

  // The rules above turn `/wp-content/…` into `//wp-content/…` (a
  // protocol-relative URL). Collapse it back to an absolute path.
  out = out.split('//wp-content/').join('/wp-content/');

  // The internal links of the old site.
  for (const [pattern, replacement] of INTERNAL_LINKS) {
    out = out.replace(pattern, replacement);
  }

  return out;
}

/**
 * Remove the `srcset` and `sizes` attributes from every tag of an HTML string.
 * @param {string} html
 * @returns {string}
 */
export function stripSrcset(html) {
  if (typeof html !== 'string') return html;
  return html
    .replace(/\s+srcset\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+srcset\s*=\s*'[^']*'/gi, '')
    .replace(/\s+sizes\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+sizes\s*=\s*'[^']*'/gi, '');
}

/**
 * Extract the `/wp-content/uploads/<path>` references of a string.
 * @param {string} text
 * @returns {string[]} the upload paths, without the leading `/wp-content/uploads/`
 */
export function collectUploadPaths(text) {
  if (typeof text !== 'string') return [];
  const out = new Set();
  const re = /(?:https?:)?(?:\/\/galastriadvocacia\.com\.br)?\/wp-content\/uploads\/([^"')\s]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let p = m[1].replace(/\\u0026.*$/, '').split('?')[0].split('#')[0];
    if (!p) continue;
    out.add(p);
  }
  return [...out];
}

/**
 * @param {string} path
 * @returns {boolean} true when the file name is a WordPress generated thumbnail
 */
export function isThumbnail(path) {
  return /-\d{2,4}x\d{2,4}\.(png|jpe?g|webp|gif)$/i.test(path);
}

/**
 * @param {string} path
 * @returns {boolean} true for the plugin / editor artefacts that never ship
 */
export function isPluginArtifact(path) {
  return (
    path.startsWith('rank-math/') ||
    path.startsWith('ultimate-post-kit-backups/') ||
    path.startsWith('wpforms/') ||
    path.startsWith('wpr-addons/') ||
    path.startsWith('elementor/screenshots/') ||
    /\.txt$/i.test(path)
  );
}

/**
 * @param {string} path
 * @returns {boolean} true for the assets dropped by ruling R10
 */
export function isDroppedByRuling(path) {
  const name = path.split('/').pop() ?? '';
  return (
    name.startsWith('Recesso-Art-') ||
    name.startsWith('Logo-Xentry-Labs-')
  );
}
