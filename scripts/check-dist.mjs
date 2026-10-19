#!/usr/bin/env node
/**
 * The verification of the **published artefact** (D9, D15).
 *
 * Everything else verifies the *sources*; this script verifies the `dist/` —
 * the files that are actually uploaded to the GitHub Pages. A `javascript:`
 * URL, an `onerror=` handler or a `<script>` no artefacto é um XSS
 * **publicado**, e nada o verificava.
 *
 *   node scripts/check-dist.mjs [--dist <dist dir>]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { hasJavascriptUrl, normaliseUrlValue } from './lib/forbidden.mjs';

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

/**
 * The HTML files of the artefact.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {string[]}
 */
function listHtml(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const rel = prefix ? `${prefix}/${entry}` : entry;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listHtml(full, rel));
    else if (entry.endsWith('.html')) out.push(rel);
  }
  return out;
}

/** The scripts that the site legitimately publishes. */
const ALLOWED_SCRIPT = [
  ['o JSON-LD', /type\s*=\s*["']application\/ld\+json["']/i],
  ['os scripts do site', /src\s*=\s*["']\/js\//i],
  ['o snippet do GTM', /\bgtag\s*\(/i],
  ['o carregador do AdSense', /id\s*=\s*["']adsbygoogle-loader["']/i],
  ['o carregador do AdSense (text/plain)', /type\s*=\s*["']text\/plain["']/i],
];

const problems = [];
let scanned = 0;

for (const rel of listHtml(DIST)) {
  const html = readFileSync(join(DIST, ...rel.split('/')), 'utf8');
  scanned += 1;

  // --- D15: a ordem das etiquetas ------------------------------------------
  const headEnd = html.indexOf('</head>');
  const bodyStart = html.search(/<body[\s>]/);
  const bodyEnd = html.lastIndexOf('</body>');
  const htmlEnd = html.lastIndexOf('</html>');
  if (headEnd === -1 || bodyStart === -1 || bodyEnd === -1 || htmlEnd === -1) {
    problems.push(`${rel}: as etiquetas </head>, <body>, </body> ou </html> não estão todas presentes`);
  } else if (!(headEnd < bodyStart && bodyStart < bodyEnd && bodyEnd < htmlEnd)) {
    problems.push(
      `${rel}: a ordem das etiquetas está errada (</head> ${headEnd}, <body> ${bodyStart}, </body> ${bodyEnd}, </html> ${htmlEnd})`,
    );
  }

  // --- D5: as URLs javascript: ---------------------------------------------
  for (const match of html.matchAll(/\b(?:href|src|action|xlink:href)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const value = match[2] ?? match[3] ?? '';
    if (!hasJavascriptUrl(value)) continue;
    const line = html.slice(0, match.index).split('\n').length;
    problems.push(`${rel}:${line}: uma URL javascript: — ${JSON.stringify(value.slice(0, 60))}`);
  }

  // --- os handlers on…= ------------------------------------------------------
  for (const match of html.matchAll(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)) {
    const line = html.slice(0, match.index).split('\n').length;
    problems.push(`${rel}:${line}: um handler em linha — ${JSON.stringify(match[0].trim().slice(0, 40))}`);
  }

  // --- as etiquetas perigosas -----------------------------------------------
  for (const [label, pattern] of [
    ['<iframe', /<iframe\b/i],
    ['<object', /<object\b/i],
    ['<embed', /<embed\b/i],
    ['srcdoc=', /srcdoc\s*=/i],
  ]) {
    const match = pattern.exec(html);
    if (match) {
      const line = html.slice(0, match.index).split('\n').length;
      problems.push(`${rel}:${line}: uma etiqueta perigosa — ${label}`);
    }
  }

  // --- os scripts ------------------------------------------------------------
  for (const match of html.matchAll(/<script\b[\s\S]*?(?:<\/script>|$)/gi)) {
    const script = match[0];
    if (ALLOWED_SCRIPT.some(([, pattern]) => pattern.test(script))) continue;
    const line = html.slice(0, match.index).split('\n').length;
    problems.push(`${rel}:${line}: um <script> não autorizado`);
  }

  // --- o placeholder do Formspree (D9) --------------------------------------
  for (const match of html.matchAll(/formspree\.io\/f\/([A-Za-z0-9]{8,})/gi)) {
    if (!/^[xX0_]+$/.test(match[1])) continue;
    const line = html.slice(0, match.index).split('\n').length;
    problems.push(`${rel}:${line}: o endpoint do Formspree é um placeholder — o formulário está morto`);
  }
  if (html.includes('FORM_ID')) {
    problems.push(`${rel}: o placeholder FORM_ID sobreviveu no artefacto`);
  }
}

if (problems.length > 0) {
  console.error(`check-dist: ${problems.length} problem(s) found\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nO artefacto publicado está bloqueado (D9).');
  process.exit(1);
}

console.log(
  `check-dist: ${scanned} página(s) verificadas — sem handlers, sem URLs javascript:, sem etiquetas perigosas e com a ordem das etiquetas correcta.`,
);
