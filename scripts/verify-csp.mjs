#!/usr/bin/env node
/**
 * The comparison of the two forms of the Content Security Policy (SEC-42).
 *
 *   node scripts/verify-csp.mjs
 *
 * The policy of the `<meta http-equiv>` (in the layout) and the policy of the
 * HTTP header (in the Transform Rule of the Cloudflare, documented in
 * `docs/DEPLOY.md`) must be **identical**, except for the two directives
 * that the browser ignores in a `<meta>`: `frame-ancestors` and
 * `upgrade-insecure-requests`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(process.cwd(), 'dist/index.html');
const DEPLOY = resolve(process.cwd(), 'docs/DEPLOY.md');

/** The directives that the browser ignores in a `<meta>`. */
const IGNORED = ['frame-ancestors', 'upgrade-insecure-requests'];

let html;
let deploy;
try {
  html = readFileSync(DIST, 'utf8');
  deploy = readFileSync(DEPLOY, 'utf8');
} catch (error) {
  console.error(`verify-csp: ${error.message} (build the site first: \`npm run build\`)`);
  process.exit(1);
}

const meta = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)?.[1];
if (!meta) {
  console.error('verify-csp: the <meta http-equiv="Content-Security-Policy"> was not found in dist/index.html.');
  process.exit(1);
}

// The block of the CSP in the runbook: the lines between the first ``` of the
// section "Regra 1 — a CSP" and the closing ```.
const section = /### 3\.1[\s\S]*?```\n([\s\S]*?)\n```/.exec(deploy)?.[1];
if (!section) {
  console.error('verify-csp: the CSP block was not found in docs/DEPLOY.md.');
  process.exit(1);
}
const header = section
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .join('; ');

/**
 * @param {string} policy
 * @returns {string[]} the directives
 */
function directives(policy) {
  return policy
    .split(';')
    .map((directive) => directive.trim())
    .filter(Boolean);
}

const headerDirectives = directives(header);
const metaDirectives = directives(meta);

/**
 * @param {string} directive
 * @param {string} name
 * @returns {boolean}
 */
const isDirective = (directive, name) => directive === name || directive.startsWith(`${name} `);

const problems = [];
for (const ignored of IGNORED) {
  if (!headerDirectives.some((d) => isDirective(d, ignored))) {
    problems.push(`the header does not have the directive "${ignored}"`);
  }
  if (metaDirectives.some((d) => isDirective(d, ignored))) {
    problems.push(`the <meta> must not have the directive "${ignored}"`);
  }
}

const headerComparable = headerDirectives.filter((d) => !IGNORED.some((ignored) => isDirective(d, ignored)));
if (headerComparable.join('; ') !== metaDirectives.join('; ')) {
  problems.push('the two policies differ');
  for (const directive of headerComparable) {
    if (!metaDirectives.includes(directive)) problems.push(`  only in the header: ${directive}`);
  }
  for (const directive of metaDirectives) {
    if (!headerComparable.includes(directive)) problems.push(`  only in the <meta>: ${directive}`);
  }
}

if (problems.length > 0) {
  console.error(`verify-csp: ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `verify-csp: the two policies are identical (${metaDirectives.length} directives) ` +
    `— except ${IGNORED.join(' and ')}, which the browser ignores in a <meta>.`,
);
