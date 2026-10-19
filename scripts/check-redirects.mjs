#!/usr/bin/env node
/**
 * The rules of redirection (REV-6 / E15).
 *
 * `src/data/redirects.json` é o **registo** das URLs que mudaram. O 301 real
 * é uma **Redirect Rule da Cloudflare** (o GitHub Pages não faz
 * redireccionamentos) — este script imprime a regra exacta a colar e verifica
 * que o registo e a documentação estão de acordo.
 *
 *   node scripts/check-redirects.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REDIRECTS = resolve(process.cwd(), 'src/data/redirects.json');
const DEPLOY = resolve(process.cwd(), 'docs/DEPLOY.md');

let redirects;
try {
  redirects = JSON.parse(readFileSync(REDIRECTS, 'utf8'));
} catch (error) {
  console.error(`check-redirects: could not read ${REDIRECTS} (${error.message}).`);
  process.exit(1);
}

const entries = Object.entries(redirects);
if (entries.length === 0) {
  console.error('check-redirects: the register of the redirections is empty.');
  process.exit(1);
}

const deploy = readFileSync(DEPLOY, 'utf8');
const problems = [];

/** The Cloudflare Redirect Rule of each entry. */
const rules = entries.map(([from, to]) => ({
  from,
  to,
  pattern: `https://galastriadvocacia.com.br${from}*`,
  target: `https://galastriadvocacia.com.br${to}`,
}));

console.log('check-redirects: as regras a colar na Cloudflare (Rules → Redirect Rules):\n');
for (const rule of rules) {
  console.log(`  Origem:  ${rule.pattern}`);
  console.log(`  Destino: ${rule.target}`);
  console.log('  Estado:  301 (permanente)\n');
}

// O runbook tem de mencionar cada redireccionamento (o mesmo padrão do
// `verify-csp.mjs`).
for (const rule of rules) {
  if (!deploy.includes(rule.from)) {
    problems.push(`the runbook does not mention the redirection ${rule.from}`);
  }
}

if (problems.length > 0) {
  console.error(`check-redirects: ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `check-redirects: ${entries.length} redireccionamento(s) no registo e no runbook — a regra da Cloudflare está acima.`,
);
