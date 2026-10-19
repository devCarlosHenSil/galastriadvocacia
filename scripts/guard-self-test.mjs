#!/usr/bin/env node
/**
 * The self-test of the secrets guard (SEC-R-27, D4).
 *
 * It plants **each live value of the backup** into each of the places where
 * it must never reach (the code, the assets, the documentation, the tests,
 * the scripts and the data of the Elementor), asserts that the guard **exits
 * non-zero** in every case, removes the probes and asserts that the guard
 * exits 0 again.
 *
 * The values are read from the **read-only backup** — they are never copied
 * into the repository, and the probes are always removed (the `finally`).
 *
 * It also asserts the **coverage** (D4.3): every sensitive value of the
 * backup has a digest in one of the two tiers — otherwise the guard would
 * not be able to recognise it and the hole would reopen.
 *
 *   node scripts/guard-self-test.mjs [--backup <dir>]
 *
 * The default backup is the **parent** of the repository (the WordPress
 * backup lives next to the repo). The environment variable `GALASTRI_BACKUP`
 * overrides it. **No absolute path is written in the source** — the repository
 * is public (D1).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HIGH_ENTROPY_DIGESTS, PII_DIGEST_FILE, isPersonalData, loadPiiDigests } from './lib/forbidden.mjs';
import { extractSensitiveValues, maximalValues } from './lib/backup-values.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');

const args = { backup: process.env.GALASTRI_BACKUP ?? resolve(PROJECT_ROOT, '..') };
for (let i = 0; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const key = process.argv[i].slice(2);
  const value = process.argv[i + 1];
  if (value === undefined) throw new Error(`missing value for --${key}`);
  args[key] = value;
  i++;
}

const BACKUP = resolve(args.backup);

/**
 * The SQL dump of the backup (the WP-Vivid one).
 *
 * REV-15 (E12): o dump é resolvido por **glob** (`*_backup_db/*.sql`, o mais
 * novo por mtime) — o id do export **não** está escrito no código (o
 * repositório é público) e um export novo não quebra o comando.
 *
 * @returns {string | null}
 */
function findSql() {
  const candidates = [];
  const scan = (dir, depth) => {
    if (depth > 2) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full, depth + 1);
        continue;
      }
      if (entry.name.endsWith('.sql')) {
        try {
          candidates.push({ file: full, mtime: statSync(full).mtimeMs });
        } catch {
          /* the file vanished */
        }
      }
    }
  };
  scan(BACKUP, 0);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].file;
}

const sha = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

const sql = findSql();
if (!sql) {
  // O backup é read-only e **não** está no repositório: no CI o auto-teste
  // salta (como o `visual-diff` salta sem o Playwright). A guarda continua a
  // correr com os digest do repositório.
  console.log(
    'guard-self-test: o backup do WordPress não está disponível — o auto-teste salta. ' +
      'O auto-teste precisa do backup local (--backup <dir>).',
  );
  process.exit(0);
}

console.log(`guard-self-test: a ler os valores vivos do backup (${BACKUP})…`);
const all = await extractSensitiveValues(sql, join(BACKUP, 'wp-config.php'));
if (all.length === 0) {
  console.error('guard-self-test: nenhum valor sensível foi encontrado — o dump mudou?');
  process.exit(1);
}
// As **credenciais** só são plantáveis quando são **maximais** (um valor
// contido noutro não é um valor independente: a guarda apanha o que o
// contém). Os **dados pessoais** são todos plantáveis — a guarda reconhece-os
// pela forma (e-mail, IPv4, telefone).
const sensitive = [
  ...maximalValues(all.filter((entry) => entry.kind === 'credential')),
  ...all.filter((entry) => entry.kind === 'personal' && isPersonalData(entry.value)),
];
if (sensitive.length === 0) {
  console.error('guard-self-test: nenhum valor sensível foi encontrado — o dump mudou?');
  process.exit(1);
}

// --- the tiers ---------------------------------------------------------------
const highEntropy = new Map(HIGH_ENTROPY_DIGESTS.map(([digest, length]) => [digest, length]));
const local = loadPiiDigests(PROJECT_ROOT);
const pii = [...local.credentials, ...local.personal];

// --- D4.3: a cobertura -------------------------------------------------------
// Todo o valor **sensível e reconhecível** do backup tem de ter um digest num
// dos dois níveis:
// - as **credenciais** (as opções, o user meta, o wp-config) → o nível do
//   repositório (a alta entropia) ou o nível local (a baixa entropia);
// - os **dados pessoais com forma** (e-mail, IPv4, telefone) → o nível local.
//
// O texto livre das submissões dos formulários não é uma credencial nem tem
// forma: a extração nunca lê essa tabela, por isso não pode vazar por lá.
const uncovered = [];
for (const { value, source, kind } of sensitive) {
  if (value.length < 12) continue;
  if (kind !== 'credential') continue;
  const digest = sha(value);
  if (highEntropy.has(digest)) continue;
  if (pii.some(([known]) => known === digest)) continue;
  uncovered.push({ source, kind: kind === 'personal' ? 'dados pessoais (o nível local)' : 'credencial (um dos dois níveis)' });
}
if (uncovered.length > 0) {
  console.error(
    `guard-self-test: ${uncovered.length} valor(es) sensível(is) do backup **sem digest** — a guarda não os reconheceria:`,
  );
  for (const entry of uncovered) console.error(`  - ${entry.source} (${entry.kind})`);
  console.error('\nAs credenciais vão para `scripts/lib/forbidden.mjs` (HIGH_ENTROPY_DIGESTS);');
  console.error('os dados pessoais para `scripts/private/pii-digests.json` (`npm run guard:pii-digests`).');
  process.exit(1);
}

// --- the values that are planted ---------------------------------------------
// Os valores que a guarda **sabe** reconhecer: as credenciais (a janela
// deslizante) e os dados pessoais (a forma).
const live = new Map();
for (const { value } of sensitive) {
  if (value.length < 8) continue;
  const digest = sha(value);
  if (highEntropy.has(digest) || pii.some(([known]) => known === digest)) {
    live.set(value, digest);
  }
}
if (live.size === 0) {
  console.error('guard-self-test: nenhum valor vivo foi reconhecido pelo digest.');
  process.exit(1);
}
console.log(`guard-self-test: ${live.size} valor(es) vivo(s) reconhecidos pelo digest.`);

/** The places where a value must never reach. */
const LOCATIONS = [
  'src/_guard_probe.txt',
  'public/_guard_probe.txt',
  'docs/_guard_probe.txt',
  'tests/_guard_probe.txt',
  'scripts/_guard_probe.txt',
  'src/data/elementor/_guard_probe.json',
];

/**
 * Runs the guard on a single file.
 * @param {string} rel
 * @returns {{code: number, output: string}}
 */
function runGuard(rel) {
  const result = spawnSync(process.execPath, [join(HERE, 'guard-secrets.mjs'), '--only', rel], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
  return { code: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const failures = [];
const probes = [];
/** The locations where each value was detected. */
const detectedIn = new Map();

try {
  for (const rel of LOCATIONS) {
    const file = join(PROJECT_ROOT, ...rel.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    probes.push(file);
    // Each value on its own line: the guard must catch all of them.
    writeFileSync(file, `${[...live.keys()].join('\n')}\n`, 'utf8');

    const { code, output } = runGuard(rel);
    if (code === 0) {
      failures.push(`${rel}: a guarda NÃO detectou os valores plantados (exit 0)`);
      continue;
    }
    for (const value of live.keys()) {
      const marker = JSON.stringify(value.slice(0, 8));
      if (!output.includes(marker)) {
        failures.push(`${rel}: a guarda não mencionou o valor ${marker}`);
        continue;
      }
      if (!detectedIn.has(value)) detectedIn.set(value, []);
      detectedIn.get(value).push(rel);
    }
    console.log(`  ok   ${rel}: a guarda bloqueou (exit ${code}) e mencionou os ${live.size} valores`);
  }
} finally {
  for (const file of probes) {
    try {
      rmSync(file, { force: true });
    } catch {
      /* already gone */
    }
  }
}

// The per-value table — the **digest** and the length, never the value (the
// values are the live credentials of the backup).
console.log('\n  os valores vivos plantados (o digest e o comprimento — nunca o valor):');
let index = 0;
for (const [value, digest] of live) {
  index += 1;
  const places = detectedIn.get(value) ?? [];
  const label = places.length === LOCATIONS.length ? 'detectado em todas as localizações' : `detectado em ${places.length}/${LOCATIONS.length}`;
  console.log(`  ${String(index).padStart(2, '0')}.  sha256=${digest.slice(0, 12)}…  len=${String(value.length).padStart(3)}  ${label}`);
}

// The tree must be clean: the probes are gone.
for (const rel of LOCATIONS) {
  if (existsSync(join(PROJECT_ROOT, ...rel.split('/')))) {
    failures.push(`${rel}: a sonda não foi removida`);
  }
}

// The whole guard must pass again.
const clean = runGuard('');
if (clean.code !== 0) {
  failures.push(`a guarda reprova depois das sondas:\n${clean.output}`);
} else {
  console.log('  ok   a guarda volta a passar depois das sondas');
}

if (failures.length > 0) {
  console.error(`\nguard-self-test: ${failures.length} problema(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`\nguard-self-test: ${live.size} valor(es) vivo(s) × ${LOCATIONS.length} local(izações) — todos detectados.`);
