#!/usr/bin/env node
/**
 * The rules of redirection (REV-6 / E15 / D86 / D92).
 *
 * `src/data/redirects.json` é o **registo** das URLs que mudaram, e
 * `public/_redirects` é a **declaração** desse registo (o que *deveria*
 * redirecionar).
 *
 * ⚠️ **A execução é o próprio ficheiro `_redirects` da Cloudflare Pages** —
 * e só porque **não** há activo estático na origem. Mediu-se em produção
 * (2026-10-20): o ficheiro `public/_redirects` **não ganha** ao ficheiro
 * estático correspondente — `https://www.galastriadvocacia.com.br/home/`
 * respondeu **200** (a home servida de `/home/index.html`) e não 301. Por
 * isso o alias `/home/` **deixou de ser construído** (a página
 * `src/pages/home.astro` não existe): sem activo estático, o pedido não casa
 * com nenhum ficheiro e a regra aplica-se → 301 → `/`.
 *
 * Este script imprime as regras, verifica que o registo, a declaração e o
 * runbook estão de acordo, e — o mais importante — que a **origem da regra
 * não é uma página construída** (o invariante que mantém o 301 vivo).
 *
 *   node scripts/check-redirects.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REDIRECTS = resolve(process.cwd(), 'src/data/redirects.json');
const RULES = resolve(process.cwd(), 'public/_redirects');
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

let rules;
let deploy;
try {
  rules = readFileSync(RULES, 'utf8');
  deploy = readFileSync(DEPLOY, 'utf8');
} catch (error) {
  console.error(`check-redirects: could not read the rules or the runbook (${error.message}).`);
  process.exit(1);
}

const problems = [];

console.log('check-redirects: as regras (execução = o ficheiro `_redirects` da Cloudflare Pages):\n');
for (const [from, to] of entries) {
  // A linha da regra: `<origem>\t<destino>\t301`.
  const pattern = new RegExp(
    `^${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+301\\s*$`,
    'm',
  );
  if (!pattern.test(rules)) {
    problems.push(`the file public/_redirects does not declare the rule ${from} ${to} 301`);
  }
  console.log(`  Origem:  ${from}`);
  console.log(`  Destino: ${to}`);
  console.log('  Estado:  301 (permanente)');
  console.log('  Onde:    o ficheiro `_redirects` da Cloudflare Pages — só dispara porque não há activo estático na origem (docs/DEPLOY.md §3.1)\n');
}

// ⚠️ **O invariante que mantém a regra viva:** a regra dos `_redirects` da
// Cloudflare Pages **não** ganha ao ficheiro estático correspondente (medido
// em produção: o `/home/` respondia **200** com a home servida de
// `/home/index.html`). Por isso o alias **não é construído** — e estas duas
// asserções são o que o garante ✗.
for (const [from] of entries) {
  const slug = from.replace(/^\/|\/$/g, '');
  const source = resolve(process.cwd(), 'src', 'pages', `${slug}.astro`);
  if (existsSync(source)) {
    problems.push(
      `the page ${slug}.astro exists: the Pages _redirects does not win against the static ` +
        `asset, so the redirect ${from} would answer 200 instead of 301`,
    );
  }
  const asset = resolve(process.cwd(), 'dist', slug, 'index.html');
  if (existsSync(resolve(process.cwd(), 'dist')) && existsSync(asset)) {
    problems.push(
      `the dist has the static page ${slug}/index.html: the Pages _redirects does not win ` +
        `against the asset, so the redirect ${from} would answer 200 instead of 301`,
    );
  }
}

// O runbook tem de mencionar cada redireccionamento (o mesmo padrão do
// `verify-csp.mjs`).
for (const [from] of entries) {
  if (!deploy.includes(from)) {
    problems.push(`the runbook does not mention the redirection ${from}`);
  }
}

// E tem de dizer **onde** a regra é executada — o ficheiro `_redirects` sozinho
// não produz o 301 (medido em produção): a origem não pode ter activo
// estático.
if (!/_redirects|Single Redirect/i.test(deploy)) {
  problems.push('the runbook does not say where the rule is enforced');
}
if (!/_redirects/i.test(rules)) {
  problems.push('the file public/_redirects does not say how it is enforced');
}

if (problems.length > 0) {
  console.error(`check-redirects: ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `check-redirects: ${entries.length} redireccionamento(s) no registo, declarados em public/_redirects e documentados no runbook — e a origem **não** é uma página construída (o invariante do 301).`,
);
