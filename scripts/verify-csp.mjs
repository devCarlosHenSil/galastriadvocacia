#!/usr/bin/env node
/**
 * The comparison of the **three** forms of the Content Security Policy
 * (SEC-42).
 *
 *   node scripts/verify-csp.mjs
 *
 * 1. `src/lib/csp.ts` — the source of truth;
 * 2. `public/_headers` — the HTTP header that the Cloudflare Pages applies;
 * 3. `docs/DEPLOY.md` — the copy of the runbook.
 *
 * The policy of the `<meta http-equiv>` (in the layout) is a **fourth** form:
 * it is identical to the header, except for the two directives that the
 * browser ignores in a `<meta>`: `frame-ancestors` and
 * `upgrade-insecure-requests`.
 *
 * The script reports the **exact** difference when they diverge.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const CSP_SOURCE = resolve(ROOT, 'src/lib/csp.ts');
const HEADERS_FILE = resolve(ROOT, 'public/_headers');
const DIST = resolve(ROOT, 'dist/index.html');
const DEPLOY = resolve(ROOT, 'docs/DEPLOY.md');

/** The directives that the browser ignores in a `<meta>`. */
const IGNORED = ['frame-ancestors', 'upgrade-insecure-requests'];

/** The 5 headers of security (SEC-43) — they have to be in the `_headers`. */
const SECURITY_HEADERS = [
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
];

/**
 * @param {string} file
 * @returns {string}
 */
function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`verify-csp: could not read ${file} (${error.message}).`);
    process.exit(1);
  }
}

const source = read(CSP_SOURCE);
const headersFile = read(HEADERS_FILE);
const html = read(DIST);
const deploy = read(DEPLOY);

// --- 1. the source of truth --------------------------------------------------
const array = /const DIRECTIVES = \[([\s\S]*?)\n\];/.exec(source)?.[1];
if (!array) {
  console.error('verify-csp: the DIRECTIVES array was not found in src/lib/csp.ts.');
  process.exit(1);
}
const directives = [...array.matchAll(/^\s*"(.*)",$/gm)].map((match) => match[1]);
if (directives.length === 0) {
  console.error('verify-csp: the DIRECTIVES array of src/lib/csp.ts is empty.');
  process.exit(1);
}
// The same construction of `src/lib/csp.ts` — the two forms come from the
// same list, so they can never drift.
const cspHeader = `${directives.join('; ')}; frame-ancestors 'none'; upgrade-insecure-requests`;
const cspMeta = directives.join('; ');

// --- 2. the `<meta http-equiv>` of the layout --------------------------------
const meta = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)?.[1];
if (!meta) {
  console.error('verify-csp: the <meta http-equiv="Content-Security-Policy"> was not found in dist/index.html.');
  process.exit(1);
}

// --- 3. the `_headers` --------------------------------------------------------
const headersCsp = /^\s*Content-Security-Policy:\s*(.+)$/m.exec(headersFile)?.[1]?.trim();
if (!headersCsp) {
  console.error('verify-csp: the Content-Security-Policy was not found in public/_headers.');
  process.exit(1);
}

// --- 4. the runbook -----------------------------------------------------------
const blocks = [...deploy.matchAll(/```[a-z]*\n([\s\S]*?)\n```/g)].map((match) => match[1]);
const block = blocks.find((text) => text.includes('Content-Security-Policy:'));
if (!block) {
  console.error('verify-csp: the block with the Content-Security-Policy was not found in docs/DEPLOY.md.');
  process.exit(1);
}
const deployCsp = /^\s*Content-Security-Policy:\s*(.+)$/m.exec(block)?.[1]?.trim();

/**
 * @param {string} policy
 * @returns {string[]} the directives
 */
function toDirectives(policy) {
  return policy
    .split(';')
    .map((directive) => directive.trim())
    .filter(Boolean);
}

/**
 * @param {string} directive
 * @param {string} name
 * @returns {boolean}
 */
const isDirective = (directive, name) => directive === name || directive.startsWith(`${name} `);

const problems = [];

/**
 * The difference between two policies, directive by directive.
 *
 * @param {string} expected
 * @param {string} actual
 * @param {string} label
 */
function compare(expected, actual, label) {
  if (expected === actual) return;
  const expectedDirectives = toDirectives(expected);
  const actualDirectives = toDirectives(actual);
  problems.push(`${label} differs from src/lib/csp.ts`);
  for (const directive of expectedDirectives) {
    if (!actualDirectives.includes(directive)) problems.push(`  only in csp.ts: ${directive}`);
  }
  for (const directive of actualDirectives) {
    if (!expectedDirectives.includes(directive)) problems.push(`  only in ${label}: ${directive}`);
  }
  if (expectedDirectives.join('; ') === actualDirectives.join('; ')) {
    problems.push(`  the difference is the order or the spacing: "${actual}"`);
  }
}

// --- the `<meta>`: the same directives, minus the two that are ignored -------
const metaDirectives = toDirectives(meta);
for (const ignored of IGNORED) {
  if (!toDirectives(cspHeader).some((directive) => isDirective(directive, ignored))) {
    problems.push(`the header does not have the directive "${ignored}"`);
  }
  if (metaDirectives.some((directive) => isDirective(directive, ignored))) {
    problems.push(`the <meta> must not have the directive "${ignored}"`);
  }
}
compare(cspMeta, meta, 'the <meta> of dist/index.html');

// --- the three forms ----------------------------------------------------------
compare(cspHeader, headersCsp, 'public/_headers');
compare(cspHeader, deployCsp ?? '', 'docs/DEPLOY.md');

// --- the 5 headers of security ------------------------------------------------
for (const header of SECURITY_HEADERS) {
  if (!new RegExp(`^\\s*${header}:`, 'm').test(headersFile)) {
    problems.push(`public/_headers does not have the header "${header}"`);
  }
  if (!deploy.includes(`${header}:`)) {
    problems.push(`docs/DEPLOY.md does not mention the header "${header}"`);
  }
}

if (problems.length > 0) {
  console.error(`verify-csp: ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `verify-csp: csp.ts, public/_headers and docs/DEPLOY.md have the same policy ` +
    `(${metaDirectives.length} directives) — and the <meta> of dist/index.html too, ` +
    `except ${IGNORED.join(' and ')}, which the browser ignores in a <meta>.`,
);
