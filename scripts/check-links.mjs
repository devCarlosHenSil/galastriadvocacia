#!/usr/bin/env node
/**
 * The link checker and the "no external asset" assertion (T6.1).
 *
 *   node scripts/check-links.mjs [--dist <dist dir>]
 *
 * It walks the built site, extracts every internal `href`/`src`, resolves it
 * to a file of `dist/` and reports the broken ones. It also asserts that the
 * build carries no absolute URL of the old WordPress, no Google Fonts
 * reference and no `srcset` (the responsive images were dropped on purpose).
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');

const args = { dist: 'dist' };
for (let i = 0; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const key = process.argv[i].slice(2);
  const value = process.argv[i + 1];
  if (value === undefined) throw new Error(`missing value for --${key}`);
  args[key] = value;
  i++;
}

const DIST = resolve(process.cwd(), args.dist);
if (!existsSync(DIST)) {
  console.error(`the dist directory was not found: ${DIST} — run \`npm run build\` first.`);
  process.exit(1);
}

/**
 * The strings that must NOT exist in the build (T6.1, SEC-48).
 *
 * The `og:image` / `twitter:image` are **excepted** from the absolute-upload
 * rule: the Open Graph protocol requires an **absolute** URL for the social
 * preview, and the new site serves the very same path on the same domain
 * (`https://galastriadvocacia.com.br/wp-content/uploads/…`). Every other
 * reference has to be relative.
 */
const FORBIDDEN = [
  ['galastriadvocacia.com.br/wp-content', /galastriadvocacia\.com\.br\/wp-content/],
  ['fonts.googleapis.com', /fonts\.googleapis\.com/],
  ['fonts.gstatic.com', /fonts\.gstatic\.com/],
  ['srcset=', /\ssrcset\s*=/i],
];

/**
 * The places whose absolute URL is mandatory:
 *   - the `og:image` / `twitter:image` meta tags (Open Graph / Twitter cards);
 *   - the JSON-LD blocks (schema.org — the `image` and the `url` of a node
 *     have to be absolute).
 *
 * They are removed before the scan and counted separately.
 */
const ABSOLUTE_ALLOWED = new RegExp(
  [
    '<meta\\b[^>]*(?:property|name)\\s*=\\s*["\'](?:og:image|twitter:image)["\'][^>]*>',
    '<script\\b[^>]*type\\s*=\\s*["\']application/ld\\+json["\'][^>]*>[\\s\\S]*?<\\/script>',
  ].join('|'),
  'gi',
);

/**
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {Promise<string[]>}
 */
async function listFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out;
}

/**
 * @param {string} html
 * @returns {Array<{ url: string, tag: string }>}
 */
function extractReferences(html) {
  const out = [];
  const re = /<(a|img|script|link|source|iframe)\b([^>]*)>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    for (const attribute of ['href', 'src']) {
      const found = new RegExp(`\\s${attribute}\\s*=\\s*["']([^"']+)["']`, 'i').exec(attrs);
      if (found) out.push({ url: found[1], tag: `${tag}[${attribute}]` });
    }
  }
  return out;
}

/**
 * Resolve an internal reference to a file of `dist/`.
 * @param {string} url
 * @param {string} from the page that carries the reference
 * @returns {string | null} the path relative to `dist/`, null when external
 */
function resolveInternal(url, from) {
  if (/^(https?:)?\/\//i.test(url)) return null; // external
  if (/^(mailto:|tel:|data:|javascript:|#)/i.test(url)) return null;
  const clean = url.split('#')[0].split('?')[0];
  if (clean === '') return null;

  const base = clean.startsWith('/')
    ? clean
    : `/${relative(sep, dirname(from), clean).split(sep).join('/')}`;
  const normalised = base.replace(/\/{2,}/g, '/');

  const candidates = [normalised];
  if (normalised.endsWith('/')) candidates.push(`${normalised}index.html`);
  else candidates.push(`${normalised}/index.html`, `${normalised}.html`);

  for (const candidate of candidates) {
    const file = join(DIST, ...candidate.split('/').filter(Boolean));
    if (existsSync(file) && statSync(file).isFile()) return candidate;
  }
  return normalised; // broken
}

/**
 * The **anchor** of a reference (o `#fragment`) e o `id` que a página alvo
 * declara (REV-10 / E8).
 *
 * O `check-links` descartava o fragmento: um link para a âncora errada
 * passava em silêncio — e é exactamente o bug que o `LINK_REPAIRS` corrige na
 * fonte (`#sobre` → `/#areasdeatuacao`).
 *
 * @param {string} url
 * @returns {string} o fragmento (sem o `#`), ou ''
 */
function fragmentOf(url) {
  const at = url.indexOf('#');
  if (at === -1) return '';
  return url.slice(at + 1);
}

/**
 * Os `id`s declarados por um ficheiro HTML.
 * @param {string} file
 * @returns {Set<string>}
 */
function idsOf(file) {
  const html = readFileSync(file, 'utf8');
  const ids = new Set();
  for (const match of html.matchAll(/\sid="([^"]+)"/g)) ids.add(match[1]);
  return ids;
}

const files = await listFiles(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));

const broken = [];
const brokenAnchors = [];
let checked = 0;
for (const file of htmlFiles) {
  const html = readFileSync(join(DIST, ...file.split('/')), 'utf8');
  for (const { url, tag } of extractReferences(html)) {
    // Uma URL externa não tem âncora local (o `&#x26;` de um link do Google
    // não é um fragmento).
    if (/^(https?:)?\/\//i.test(url)) continue;
    const fragment = fragmentOf(url);
    const resolved = resolveInternal(url, file);
    if (resolved === null) {
      // Uma âncora **na própria página** (`#sobre`).
      if (fragment && fragment.length > 0) {
        const ids = idsOf(join(DIST, ...file.split('/')));
        if (!ids.has(fragment)) {
          brokenAnchors.push(`${file} → ${tag}="${url}" (a âncora #${fragment} não existe na página)`);
        }
      }
      continue;
    }
    checked++;
    const target = join(DIST, ...resolved.split('/').filter(Boolean));
    const exists =
      existsSync(target) &&
      (statSync(target).isFile() ||
        (existsSync(join(target, 'index.html')) && statSync(join(target, 'index.html')).isFile()));
    if (!exists) {
      broken.push(`${file} → ${tag}="${url}" (resolvido para ${resolved})`);
      continue;
    }
    // REV-10 (E8): a âncora tem de existir na página alvo.
    if (fragment && fragment.length > 0) {
      const page = statSync(target).isFile() ? target : join(target, 'index.html');
      if (!idsOf(page).has(fragment)) {
        brokenAnchors.push(`${file} → ${tag}="${url}" (a âncora #${fragment} não existe em ${resolved})`);
      }
    }
  }
}

const forbidden = [];
let absoluteAllowed = 0;
for (const file of files) {
  if (!/\.(html|xml|txt|json|css|js)$/i.test(file)) continue;
  const raw = readFileSync(join(DIST, ...file.split('/')), 'utf8');
  // The absolute URL of the social preview is mandatory — it is removed
  // before the scan and counted separately.
  const content = raw.replace(ABSOLUTE_ALLOWED, (tag) => {
    absoluteAllowed++;
    return '';
  });  for (const [label, pattern] of FORBIDDEN) {
    if (pattern.test(content)) forbidden.push(`${file}: ${label}`);
  }
}

// --- the fonts (DATA-R-03) -------------------------------------------------
const fontFiles = [
  'fonts/roboto/roboto-latin-300.woff2',
  'fonts/roboto/roboto-latin-400.woff2',
  'fonts/roboto/roboto-latin-500.woff2',
  'fonts/roboto/roboto-latin-900.woff2',
  'fonts/montserrat/montserrat-latin-700.woff2',
];
for (const file of fontFiles) {
  if (!existsSync(join(DIST, ...file.split('/')))) forbidden.push(`${file}: the font is missing`);
}
const fontsCssPath = join(DIST, 'css', 'fonts.css');
if (existsSync(fontsCssPath)) {
  const fontsCss = readFileSync(fontsCssPath, 'utf8');
  const faces = (fontsCss.match(/@font-face/g) ?? []).length;
  const swaps = (fontsCss.match(/font-display:\s*swap/g) ?? []).length;
  if (faces !== swaps) forbidden.push(`css/fonts.css: ${faces} @font-face and ${swaps} font-display: swap`);
  if (/fonts\.(googleapis|gstatic)\.com/.test(fontsCss)) forbidden.push('css/fonts.css: references Google Fonts');
  // Amsterdam is only present when it is referenced (R12).
  if (existsSync(join(DIST, 'fonts', 'Amsterdam.ttf')) !== fontsCss.includes('Amsterdam')) {
    forbidden.push('fonts/Amsterdam.ttf: is only present when it is referenced');
  }
} else {
  forbidden.push('css/fonts.css: is missing');
}

console.log(
  `check-links: ${htmlFiles.length} página(s), ${checked} referência(s) interna(s) verificada(s), ` +
    `${absoluteAllowed} bloco(s) com URL absoluta (Open Graph + JSON-LD — URL absoluta obrigatória).`,
);

if (forbidden.length > 0) {
  console.error(`\n${forbidden.length} ocorrência(s) proibida(s) no build:`);
  for (const line of forbidden) console.error(`  - ${line}`);
}

if (broken.length > 0) {
  console.error(`\n${broken.length} link(s) interno(s) quebrado(s):`);
  for (const line of broken) console.error(`  - ${line}`);
}

if (brokenAnchors.length > 0) {
  console.error(`\n${brokenAnchors.length} âncora(s) quebrada(s):`);
  for (const line of brokenAnchors) console.error(`  - ${line}`);
}

if (forbidden.length > 0 || broken.length > 0 || brokenAnchors.length > 0) process.exit(1);
console.log(
  `check-links: 0 link interno quebrado, 0 âncora quebrada, 0 referência externa proibida.`,
);
