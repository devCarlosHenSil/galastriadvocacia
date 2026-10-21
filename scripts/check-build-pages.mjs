#!/usr/bin/env node
/**
 * A verificação da **lógica da publicação** (REV-06 / REV-07).
 *
 *   node scripts/check-build-pages.mjs
 *
 * O **build command** da Cloudflare Pages (`scripts/build-pages.mjs`) é o que
 * decide *o que se publica*: é ele que corre o gate da rotação (e que o
 * contorna com a autorização do dono, D88). Esse ficheiro **não** era
 * executado por nenhum teste — uma mudança فيه podia partir a publicação
 * (ou publicar com o gate vermelho) sem nada dar conta.
 *
 * Este script corre o build command **localmente**, com o ambiente preparado,
 * nos quatro estados que interessam:
 *
 * 1. **`CF_PAGES_BRANCH` sem `PRODUCTION_BRANCH`** → o build **aborta** (exit
 *    1): sem saber qual é a branch de produção, não se sabe o que é uma
 *    publicação — o gate falha **fechado** (SEC-N-09).
 * 2. **Pré-visualização** (outra branch) → o gate é **saltado** e o build
 *    **passa**: uma pré-visualização não é uma publicação.
 * 3. **Produção** (a branch de produção) → o gate **corre** e o resultado é o
 *    do gate (hoje: **12/12 pendentes** → exit 1).
 * 4. **O digest da evidência** → o gate aceita um sha256 em **maiúsculas**
 *    (`Get-FileHash` no Windows escreve assim) e recusa uma linha sem digest
 *    (REV-14).
 *
 * ⚠️ **Nada é publicado**: é uma invocação local com o ambiente definido —
 * o `build-pages.mjs` não faz deploy (a publicação é da Cloudflare, pelo
 * *webhook* da integração do Git) ✗.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const BUILD_PAGES = join(ROOT, 'scripts', 'build-pages.mjs');
const GATE = join(ROOT, 'scripts', 'check-rotation-gate.mjs');

/** A branch de produção (a mesma que o projecto da Cloudflare Pages tem). */
const PRODUCTION_BRANCH = 'feat/cloudflare-pages-worker';

/** Uma branch de pré-visualização (qualquer outra). */
const PREVIEW_BRANCH = 'preview-da-rotina';

const problems = [];
const ok = [];

/**
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [detail]
 */
function check(label, condition, detail = '') {
  if (condition) ok.push(label);
  else problems.push(`${label}${detail ? ' — ' + detail : ''}`);
}

/**
 * O ambiente de uma execução: o do processo, **sem** as variáveis que decidem
 * a publicação (para que o teste não dependa do ambiente de quem o corre) e
 * com as do caso ✗.
 *
 * @param {Record<string, string>} vars
 * @returns {NodeJS.ProcessEnv}
 */
function envFor(vars) {
  const env = { ...process.env };
  delete env.CF_PAGES_BRANCH;
  delete env.PRODUCTION_BRANCH;
  delete env.ROTATION_GATE;
  return { ...env, ...vars };
}

/**
 * Corre um script do projecto e devolve o estado e a saída.
 *
 * @param {string} script the path of the script
 * @param {NodeJS.ProcessEnv} env
 * @param {string[]} [args] the arguments of the script
 * @returns {{ status: number, output: string }}
 */
function run(script, env, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

// ===========================================================================
// 1. o build command sem `PRODUCTION_BRANCH` — falha fechado
// ===========================================================================
{
  const r = run(BUILD_PAGES, envFor({ CF_PAGES_BRANCH: PRODUCTION_BRANCH }));
  check(
    'sem PRODUCTION_BRANCH o build ABORTA (o gate falha fechado)',
    r.status === 1 && r.output.includes('PRODUCTION_BRANCH is not set'),
    `exit ${r.status}`,
  );
}

// ===========================================================================
// 2. a pré-visualização — o gate é saltado e o build passa
// ===========================================================================
{
  const r = run(
    BUILD_PAGES,
    envFor({ CF_PAGES_BRANCH: PREVIEW_BRANCH, PRODUCTION_BRANCH: PRODUCTION_BRANCH }),
  );
  check(
    'numa pré-visualização o gate é saltado e o build passa',
    r.status === 0 && r.output.includes('the rotation gate is SKIPPED'),
    `exit ${r.status}`,
  );
}

// ===========================================================================
// 3. a produção — o gate CORRE (e o resultado é o do gate)
// ===========================================================================
{
  const gate = run(GATE, envFor({}));
  const r = run(
    BUILD_PAGES,
    envFor({ CF_PAGES_BRANCH: PRODUCTION_BRANCH, PRODUCTION_BRANCH: PRODUCTION_BRANCH }),
  );
  check(
    'na branch de produção o gate da rotação CORRE',
    r.output.includes('o gate da rotação dos segredos (SEC-67)'),
    'o build não chegou ao gate',
  );
  check(
    'o resultado do build é o resultado do gate',
    r.status === gate.status,
    `build exit ${r.status}, gate exit ${gate.status}`,
  );
  console.log(
    `check-build-pages: o gate da rotação está ${gate.status === 0 ? 'FECHADO' : 'vermelho (12/12 pendentes)'} — ` +
      'o build de produção propaga esse estado.',
  );
}

// ===========================================================================
// 4. o digest da evidência — em maiúsculas também conta (REV-14)
// ===========================================================================
{
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  /** Uma linha da tabela do gate, fechada. */
  const row = (n, sha) =>
    `| ${n} | **Item ${n}** | print | ☑ | 2026-10-20 | Cliente | ${sha} |`;
  const header = [
    '| # | Item | Evidência | Estado | Data | Responsável | sha256 |',
    '|---|---|---|---|---|---|---|',
  ];
  const digest = 'a'.repeat(64);
  try {
    // (a) um digest em **maiúsculas** (o `Get-FileHash` do Windows) é aceito.
    const maiusculas = join(dir, 'maiusculas.md');
    writeFileSync(
      maiusculas,
      `${header.join('\n')}\n${Array.from({ length: 12 }, (_, i) => row(i + 1, digest.toUpperCase())).join('\n')}\n`,
      'utf8',
    );
    const rMaiusculas = run(GATE, envFor({}), [maiusculas]);
    check(
      'o gate aceita um sha256 em MAIÚSCULAS (o Get-FileHash do Windows)',
      rMaiusculas.status === 0,
      `exit ${rMaiusculas.status}`,
    );

    // (b) uma linha sem digest continua a ser reprovada.
    const semDigest = join(dir, 'sem-digest.md');
    const linhas = Array.from({ length: 12 }, (_, i) => row(i + 1, digest));
    linhas[6] = `| 7 | **Item 7** | print | ☑ | 2026-10-20 | Cliente | — |`;
    writeFileSync(semDigest, `${header.join('\n')}\n${linhas.join('\n')}\n`, 'utf8');
    const rSem = run(GATE, envFor({}), [semDigest]);
    check(
      'o gate reprova uma linha sem digest (e diz que o digest não distingue maiúsculas)',
      rSem.status === 1 && rSem.output.includes('64 hexadecimais'),
      `exit ${rSem.status}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (problems.length > 0) {
  console.error(`check-build-pages: ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `check-build-pages: ${ok.length} verificação(ões) OK — a lógica da publicação ` +
    '(fail-closed, pré-visualização, produção e o digest da evidência).',
);
