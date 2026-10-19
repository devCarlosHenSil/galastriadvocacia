#!/usr/bin/env node
/**
 * The generator of the digests of the **personal data** (D4).
 *
 * O digest de um IPv4 ou de um e-mail é um **oráculo de confirmação por força
 * bruta** (SEC-R-26): por isso os dados pessoais **não** vivem no repositório
 * (que é público). Este script lê o backup **read-only**, extrai os valores
 * sensíveis e escreve o ficheiro **local e git-ignored**
 * `scripts/private/pii-digests.json` com o SHA-256 de cada um.
 *
 * **Os valores nunca são escritos** — só o digest e o comprimento.
 *
 *   node scripts/generate-pii-digests.mjs [--backup <dir>]
 *
 * O valor por omissão é a pasta **pai** do repositório (o backup vive ao lado
 * do repo); a variável de ambiente `GALASTRI_BACKUP` ou a opção `--backup`
 * sobrepõem-no. **Nenhum caminho absoluto está escrito no código** — o
 * repositório é público (D1).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HIGH_ENTROPY_DIGESTS, PII_DIGEST_FILE, isPersonalData, prefixKey } from './lib/forbidden.mjs';
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
 * repositório é público).
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

const sql = findSql();
if (!sql) {
  console.error(
    `generate-pii-digests: o dump do backup não foi encontrado em ${BACKUP} — o ficheiro local não pode ser gerado.`,
  );
  process.exit(1);
}

console.log(`generate-pii-digests: a ler os valores sensíveis do backup (${BACKUP})…`);
const values = await extractSensitiveValues(sql, join(BACKUP, 'wp-config.php'));
if (values.length === 0) {
  console.error('generate-pii-digests: nenhum valor sensível foi extraído — o dump mudou?');
  process.exit(1);
}

/** The digests that are already in the repository (the high-entropy ones). */
const known = new Set(HIGH_ENTROPY_DIGESTS.map(([digest]) => digest));

/**
 * O nível **local**, em duas secções (os dois mecanismos são diferentes):
 *
 * - `credentials` — as credenciais de **baixa entropia** (REV-3 / E3: um
 *   digest de 13 caracteres é um oráculo de confirmação por força bruta e
 *   **não** pode ser publicado) → a **janela deslizante**;
 * - `personal` — os dados pessoais (e-mail, IPv4, telefone) → as **formas**.
 *
 * @type {Map<string, [number, number]>}
 */
const credentials = new Map();
const personal = new Map();
for (const { value, kind } of values) {
  if (value.length < 8) continue;
  const digest = createHash('sha256').update(value, 'utf8').digest('hex');
  if (known.has(digest)) continue;
  if (kind === 'sensitive') continue;  // nao e uma credencial
  if (kind === 'personal') {
    // Os dados pessoais **com forma** — o texto livre das submissões não é
    // digestível (e a extração nunca lê essa tabela).
    if (!isPersonalData(value)) continue;
    if (!personal.has(digest)) personal.set(digest, [value.length, 0]);
    continue;
  }
  // As credenciais de baixa entropia; as de alta entropia já estão no
  // nível do repositório.
  if (value.length >= 24) continue;
  if (!credentials.has(digest)) credentials.set(digest, [value.length, prefixKey(value)]);
}

// Os **fragmentos** de uma credencial (uma cópia parcial do valor) também
// são de baixa entropia e não podem ser publicados: usa-se o mesmo conjunto
// de comprimentos das credenciais já encontradas.
const fragmentLengths = [...new Set([...credentials.values()].map(([, length]) => length))];
for (const { value, kind } of values) {
  if (kind !== 'credential' || value.length < 12) continue;
  for (const length of fragmentLengths) {
    if (length >= value.length) continue;
    for (let i = 0; i + length <= value.length; i++) {
      const fragment = value.slice(i, i + length);
      const digest = createHash('sha256').update(fragment, 'utf8').digest('hex');
      if (known.has(digest) || credentials.has(digest)) continue;
      credentials.set(digest, [length, prefixKey(fragment)]);
    }
  }
}

const digests = new Map([...credentials, ...personal]);

if (digests.size === 0) {
  console.error('generate-pii-digests: nenhum digest novo — o ficheiro local ficaria vazio.');
  process.exit(1);
}

// --- a cobertura: nenhum valor pode ficar sem digest ------------------------
// As **credenciais** (todas) e os **dados pessoais com forma** (e-mail, IP,
// telefone). O texto livre das submissões dos formulários não é uma
// credencial nem tem forma: a extração nunca lê essa tabela, por isso não
// pode vazar por lá — e o seu digest seria um oráculo inútil.
const missing = [];
for (const { value, source, kind } of values) {
  if (value.length < 8) continue;
  if (kind !== 'credential') continue;  // so as credenciais (a chave e estrita)
  const digest = createHash('sha256').update(value, 'utf8').digest('hex');
  if (known.has(digest) || digests.has(digest)) continue;
  missing.push(`${source} (${value.length} chars)`);
}
if (missing.length > 0) {
  console.error(
    `generate-pii-digests: ${missing.length} valor(es) sensível(is) sem digest — a guarda não os reconheceria:`,
  );
  for (const entry of missing) console.error(`  - ${entry}`);
  process.exit(1);
}

const file = join(PROJECT_ROOT, ...PII_DIGEST_FILE.split('/'));
mkdirSync(dirname(file), { recursive: true });
writeFileSync(
  file,
  `${JSON.stringify(
    {
      _nota:
        'Ficheiro LOCAL e git-ignored: o nível local dos digest SHA-256 — as credenciais de BAIXA entropia (a senha e o utilizador da base de dados, as chaves de API curtas, os tokens de 10 a 16 caracteres) e os DADOS PESSOAIS do backup (os IPv4, os e-mails, os telefones). Um digest de um valor de baixa entropia é um oráculo de confirmação por força bruta (SEC-R-26 / REV-3), por isso NÃO vivem no repositório. Gerado por `npm run guard:pii-digests` a partir do backup (read-only).',
      _formato: 'credentials: [[<sha256>, <comprimento>, <chave de prefixo>]] · personal: [[<sha256>, <comprimento>]]',
      credentials: [...credentials.entries()].map(([digest, [length, key]]) => [digest, length, key]),
      personal: [...personal.entries()].map(([digest, [length]]) => [digest, length]),
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `generate-pii-digests: ${credentials.size} credencial(is) de baixa entropia + ${personal.size} dado(s) pessoal(is) ` +
    `escritos em ${PII_DIGEST_FILE} (de ${values.length} valor(es) sensíveis extraídos; ${known.size} já no nível do repositório).`,
);
