#!/usr/bin/env node
/**
 * The secrets guard (SEC-30).
 *
 * Scans `src/`, `public/`, `scripts/`, `tests/`, `docs/`, `.github/`,
 * `functions/` and the root of the repository and fails (exit code != 0) when
 * it finds a credential, a piece of personal data or a file of the WordPress
 * backup.
 *
 * It runs in the `prebuild` script and in the CI workflow.
 *
 * `docs/` **is** scanned with the **value profile** (SEC-65): the
 * specifications may document the *names* of the forbidden options (that is
 * their purpose) but never a live credential, a personal e-mail or an IP
 * address of the backup — see `scripts/lib/forbidden.mjs`.
 *
 * `functions/` is scanned with the **same value profile** (REV-10): the
 * Pages Function has to **name** the sensitive option it reads from the
 * environment (`RESEND_API_KEY`) — what may never reach the repository is the
 * **value** pasted next to it.
 *
 * The **personal data** (the IPv4 addresses and the e-mail addresses) is
 * recognised by the digests of `scripts/private/pii-digests.json` — a **local,
 * git-ignored** file (SEC-R-26). When the file does not exist (the CI), the
 * personal data is only caught by the shape rules.
 *
 *   node scripts/guard-secrets.mjs [--only <file>]
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_SCRIPT_FILES,
  ALLOWED_SCRIPT_MARKERS,
  CONTENT_HANDLER_PATTERN,
  CONTENT_PATTERNS,
  FORBIDDEN_DOCS_PATTERNS,
  FORBIDDEN_FILE_NAMES,
  FORBIDDEN_PATTERNS,
  HIGH_ENTROPY_DIGESTS,
  findDigestedValues,
  hasJavascriptUrl,
  loadPiiDigests,
} from './lib/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');

/**
 * The directories that are scanned (relative to the root of the repository).
 *
 * `.github` is included (D3): o workflow é onde se cola um PAT.
 *
 * `functions` is included (REV-10): a Pages Function é **código publicado** —
 * uma credencial colada no ficheiro (ou no seu README) ia para o mundo sem
 * que nada a apanhasse.
 */
const SCAN_DIRS = ['src', 'public', 'scripts', 'tests', 'docs', '.github', 'functions'];

/**
 * The files that are exempt: they contain the patterns themselves.
 *
 * - `scripts/lib/forbidden.mjs` — the list of the patterns;
 * - `scripts/guard-secrets.mjs` — the checker itself;
 * - `scripts/lib/sanitize.mjs` — the sanitiser (it names the tags it removes);
 * - `scripts/guard-self-test.mjs` — it names the options whose values it
 *   reads from the backup (it never holds a value);
 * - `scripts/check-links.mjs`, `scripts/check-parity.mjs` — they look for the
 *   tags in the built HTML;
 * - `scripts/extract/index.mjs`, `scripts/extract/lib/elementor.mjs`,
 *   `scripts/extract/lib/gutenberg.mjs` — the asserts and a limpeza do
 *   Gutenberg mencionam os padrões.
 */
const EXEMPT = [
  'scripts/lib/forbidden.mjs',
  'scripts/lib/backup-values.mjs',
  'scripts/guard-secrets.mjs',
  'scripts/extract/lib/sanitize.mjs',
  'scripts/guard-self-test.mjs',
  'scripts/check-links.mjs',
  'scripts/check-parity.mjs',
  'scripts/extract/index.mjs',
  'scripts/extract/lib/elementor.mjs',
  'scripts/extract/lib/gutenberg.mjs',
];

/**
 * The directories whose files carry HTML of the site (`set:html`) or are
 * copied verbatim into `dist/` (SEC-R-28, D16).
 */
const CONTENT_DIRS = ['src/content/', 'src/pages/', 'src/data/', 'public/', 'tests/', 'docs/', 'scripts/'];

/**
 * The files of the content profile that are the **verbatim oracle** (R2).
 */
const CONTENT_EXEMPT = ['tests/fixtures/'];

/**
 * The extensions whose files can carry HTML (the content rules apply to
 * them). O código (`.mjs`, `.js`, `.ts`) não é HTML — o `<object>` de um
 * JSDoc não é uma etiqueta (D16).
 */
const HTML_EXTENSIONS = ['.html', '.htm', '.md', '.json', '.astro', '.svg', '.xml'];

// --- the arguments -----------------------------------------------------------
const args = { only: '' };
for (let i = 0; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const key = process.argv[i].slice(2);
  const value = process.argv[i + 1];
  if (value === undefined) throw new Error(`missing value for --${key}`);
  args[key] = value;
  i++;
}

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
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.astro') continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out;
}

/**
 * @param {string} file
 * @returns {Promise<string | null>} the content of a text file, null for a binary one
 */
async function readText(file) {
  const buffer = await readFile(file);
  if (buffer.includes(0)) return null; // binary
  return buffer.toString('utf8');
}

/**
 * Removes the **code** of a Markdown file: the fenced blocks and the inline
 * code spans. The specs legitimately document the tags (`<script>`,
 * `javascript:`) — o que está no código **não** é executado.
 *
 * @param {string} markdown
 * @returns {string}
 */
function withoutMarkdownCode(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}

const problems = [];
const scanned = [];

const files = [];
if (args.only) {
  files.push(args.only.replace(/\\/g, '/'));
} else {
  for (const dir of SCAN_DIRS) {
    for (const rel of await listFiles(join(PROJECT_ROOT, dir), dir)) files.push(rel);
  }
  // Every file of the root of the repository is scanned (SEC-30: "a raiz do
  // repo"), except the directories.
  for (const entry of await readdir(PROJECT_ROOT, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (entry.name === '.git') continue;
    files.push(entry.name);
  }
}

// D8 — as sondas do auto-teste contêm os valores vivos: nunca podem ficar na
// árvore (nem ser versionadas por um `git add .`).
if (!args.only) {
  const probes = [];
  for (const dir of SCAN_DIRS) {
    for (const rel of await listFiles(join(PROJECT_ROOT, dir), dir)) {
      if (/(^|\/)_?guard_probe/.test(rel)) probes.push(rel);
    }
  }
  if (probes.length > 0) {
    console.error(`guard-secrets: ${probes.length} sonda(s) do auto-teste na árvore — remova-as:`);
    for (const probe of probes) console.error(`  - ${probe}`);
    console.error('\nAs sondas contêm os valores vivos do backup (D8).');
    process.exit(1);
  }
}

// The digests of the live values: the credentials (in the repository) + the
// personal data (in the local, git-ignored file).
const PII_DIGESTS = loadPiiDigests(PROJECT_ROOT);
const VALUE_DIGESTS = HIGH_ENTROPY_DIGESTS;

for (const rel of files) {
  if (EXEMPT.includes(rel.split(/[\\/]/).join('/'))) continue;
  const inDocs = rel.startsWith('docs/');
  // O perfil de **valores** (o mesmo do `docs/`, SEC-65) aplica-se ao `docs/`
  // **e** à `functions/` (REV-10): os dois podem **nomear** a opção sensível
  // (`RESEND_API_KEY`) — o que não pode é o **valor** ao lado.
  const valueProfile = inDocs || rel.startsWith('functions/');

  for (const pattern of FORBIDDEN_FILE_NAMES) {
    if (pattern.test(rel.split('/').pop() ?? '')) {
      problems.push(`${rel}: the name of the file matches ${pattern}`);
    }
  }

  const content = await readText(join(PROJECT_ROOT, ...rel.split('/')));
  if (content === null) continue;
  scanned.push(rel);

  for (const entry of valueProfile ? FORBIDDEN_DOCS_PATTERNS : FORBIDDEN_PATTERNS) {
    // The exemptions are prefixes: a file, or a directory.
    if (entry.exempt?.some((prefix) => rel === prefix || rel.startsWith(prefix))) continue;
    const match = entry.pattern.exec(content);
    if (match) {
      const line = content.slice(0, match.index).split('\n').length;
      problems.push(`${rel}:${line}: ${entry.label} — ${JSON.stringify(match[0].slice(0, 40))}`);
    }
  }

  // The live values of the backup are recognised by their SHA-256 — the value
  // itself is not in the repository (SEC-R-01). The credentials are found by
  // the sliding window, the personal data by its shape (D4).
  for (const value of findDigestedValues(content, VALUE_DIGESTS, PII_DIGESTS)) {
    const line = content.slice(0, content.indexOf(value)).split('\n').length;
    problems.push(`${rel}:${line}: SEC-26 · live value of the backup (sha256) — ${JSON.stringify(value.slice(0, 8))}…`);
  }

  // The HTML of the site (the posts, the policies and the data of the
  // Elementor) is rendered with `set:html`: it may not carry a script, an
  // event handler or a `javascript:` URL (SEC-R-28, D16).
  if (
    CONTENT_DIRS.some((dir) => rel.startsWith(dir)) &&
    !CONTENT_EXEMPT.some((dir) => rel.startsWith(dir)) &&
    HTML_EXTENSIONS.some((extension) => rel.endsWith(extension))
  ) {
    // The specs document the tags dentro de código — o código não é
    // executado, por isso é removido antes do teste.
    const subject = rel.endsWith('.md') ? withoutMarkdownCode(content) : content;
    const offset = subject === content ? 0 : 0;
    for (const [label, pattern] of CONTENT_PATTERNS) {
      const match = pattern.exec(subject);
      if (match) {
        const line = content.slice(0, match.index + offset).split('\n').length;
        problems.push(`${rel}:${line}: forbidden content — ${label}`);
      }
    }
    const handler = CONTENT_HANDLER_PATTERN.exec(subject);
    if (handler) {
      const line = content.slice(0, handler.index + offset).split('\n').length;
      problems.push(`${rel}:${line}: forbidden content — an event handler (${handler[0].trim()})`);
    }
    CONTENT_HANDLER_PATTERN.lastIndex = 0;
    // D5 — o `javascript:` é testado depois da normalização (as entidades e
    // os caracteres de controlo são descodificados, como o navegador faz).
    const jsUrl = /((?:href|src|action|xlink:href|data)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))/gi;
    let urlMatch;
    while ((urlMatch = jsUrl.exec(subject)) !== null) {
      const value = urlMatch[1];
      if (!hasJavascriptUrl(value)) continue;
      const line = content.slice(0, urlMatch.index + offset).split('\n').length;
      problems.push(`${rel}:${line}: forbidden content — a javascript: URL (${JSON.stringify(value.slice(0, 40))})`);
    }
  } else if (rel.startsWith('src/')) {
    // A script is only allowed in the allowlisted layout, and only when it
    // carries one of the markers of the third parties that are kept (R13).
    // The tag is matched **without** requiring the closing tag (SEC-R-28).
    const scripts = [...content.matchAll(/<script\b[\s\S]*?(?:<\/script>|$)/gi)].map((m) => m[0]);
    for (const script of scripts) {
      // The JSON-LD is data, not code.
      if (/type\s*=\s*["']application\/ld\+json["']/.test(script)) continue;
      // The scripts of the site itself live in `public/js/`.
      const src = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/.exec(script);
      const value = src ? (src[1] ?? src[2] ?? src[3] ?? '') : '';
      if (value.includes('/js/') && !/^(https?:)?\/\//.test(value)) continue;
      if (ALLOWED_SCRIPT_FILES.includes(rel) && ALLOWED_SCRIPT_MARKERS.some((marker) => script.includes(marker))) {
        continue;
      }
      const line = content.slice(0, content.indexOf(script)).split('\n').length;
      problems.push(`${rel}:${line}: forbidden content — <script> (only the GTM / AdSense snippets are allowed)`);
    }
  }
}

if (problems.length > 0) {
  console.error(`guard-secrets: ${problems.length} problem(s) found\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nThe build is blocked (SEC-30).');
  process.exit(1);
}

const local = PII_DIGESTS.credentials.length + PII_DIGESTS.personal.length;
const pii = local > 0 ? ` (+${PII_DIGESTS.credentials.length} credencial(is) de baixa entropia e +${PII_DIGESTS.personal.length} dado(s) pessoal(is) do nivel local)` : ' (sem o ficheiro local do nivel local)';
console.log(`guard-secrets: ${scanned.length} files scanned, no secret or personal data found.${pii}`);
