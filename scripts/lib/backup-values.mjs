/**
 * The sensitive values of the backup (D4).
 *
 * The backup (read-only) holds:
 *
 * - the **credentials** (the tokens of the Site Kit, of the Rank Math, of the
 *   WP-Vivid, the blob of the `googlesitekit_credentials`, the salts, the
 *   password of the database);
 * - the **personal data** (the e-mail addresses, the IP addresses, the form
 *   submissions of the clients).
 *
 * This module extracts them — **the values never leave this function's
 * callers** (the guard compares the SHA-256, the self-test plants them in
 * temporary probes and removes them).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { streamInserts } from '../extract/lib/sql.mjs';
import { phpUnserialize } from '../extract/lib/php.mjs';
import { isPersonalData } from './forbidden.mjs';

/**
 * The options and the meta keys whose values are **sensitive**.
 *
 * O nome é o único indício disponível no dump — o valor nunca é lido para
 * decidir.
 */
export const SENSITIVE_NAME =
  /token|secret|credential|api_key|api_secret|site_key|safe_mode|connect|sitekit|wpvivid|rank_math|oauth|password|user_email|user_login|author_email|author_ip|comment_author|email|mail/i;

/**
 * The keys whose value is a **credential** (and not a piece of junk).
 *
 * O `token` tem de ser uma palavra inteira: o `timeout` **não** é um token
 * (e o `_transient_*` do WordPress tem lots of values that are not
 * credentials).
 */
export const CREDENTIAL_KEY =
  /(^|[^a-z0-9])(token|secret|password|credential)([^a-z0-9]|$)|_key$|api_key/i;  // o 'key' solto (o hash dos assets do Elementor) nao e uma credencial

/** The tables whose values are the **personal data**. */
const PERSONAL_TABLES = new Set(['wp_users', 'wp_comments', 'wp_e_submissions', 'wp_e_submissions_values']);

/**
 * @param {any} value
 * @param {string} key the key of the value (the credential filter)
 * @param {string[]} out
 */
function collectStrings(value, key, out) {
  if (typeof value === 'string') {
    if (CREDENTIAL_KEY.test(key) || SENSITIVE_NAME.test(key)) out.push({ value, key });
    return;
  }
  if (value && typeof value === 'object') {
    for (const [innerKey, inner] of Object.entries(value)) collectStrings(inner, innerKey, out);
  }
}

/**
 * The **maximal** values: os que não estão contidos noutro valor.
 *
 * Uma estrutura serializada tem valores aninhados (o blob do Site Kit
 * dentro do JSON, o token dentro do texto). O valor que está contido noutro
 * **não é plantável** (a guarda apanha o que o contém) — por isso o
 * auto-teste planta e verifica apenas os maximais.
 *
 * @param {Array<{value: string, source: string, kind: string}>} values
 * @returns {Array<{value: string, source: string, kind: string}>}
 */
export function maximalValues(values) {
  const sorted = [...values].sort((a, b) => b.value.length - a.value.length);
  const kept = [];
  for (const entry of sorted) {
    if (kept.some((other) => other.value.includes(entry.value))) continue;
    kept.push(entry);
  }
  return kept;
}

/**
 * The digests of the **personal data** (the e-mails, the IPv4 addresses and
 * the phone numbers) — o nível local, git-ignored (D4).
 *
 * @param {Array<{value: string, source: string}>} values
 * @param {Set<string>} known the digests that are already in the repository
 * @returns {Array<[string, number]>}
 */
export function personalDataDigests(values, known = new Set()) {
  /** @type {Map<string, number>} */
  const digests = new Map();
  for (const { value } of values) {
    if (value.length < 12) continue;
    // Os **dados pessoais** têm uma forma (e-mail, IPv4, telefone) — é por
    // ela que a guarda os reconhece (D4). O resto (as mensagens do
    // formulário, por exemplo) não tem forma: a extração nunca lê a tabela
    // das submissões, por isso não pode vazar por lá.
    if (!isPersonalData(value)) continue;
    const digest = createHash('sha256').update(value, 'utf8').digest('hex');
    if (known.has(digest)) continue;
    digests.set(digest, value.length);
  }
  return [...digests.entries()];
}

/**
 * The sensitive values of the backup.
 *
 * @param {string} sqlPath the SQL dump
 * @param {string} [configPath] the `wp-config.php`
 * @returns {Promise<Array<{value: string, source: string}>>}
 */
export async function extractSensitiveValues(sqlPath, configPath) {
  const out = [];

  /**
   * @param {string} value
   * @param {string} source
   * @param {'credential'|'personal'} kind
   */
  const push = (value, source, kind) => {
    if (typeof value !== 'string' || value.length < 4) return;
    out.push({ value, source, kind });
  };

  // --- o wp-config.php ------------------------------------------------------
  if (configPath) {
    let config = '';
    try {
      config = readFileSync(configPath, 'utf8');
    } catch {
      config = '';
    }
    for (const match of config.matchAll(/define\(\s*['"]([A-Z_]+)['"]\s*,\s*['"]([^'"]*)['"]/g)) {
      // Só a **senha** é um segredo: o nome e o utilizador da base de dados
      // são públicos (o nome do sítio é o domínio) e o `localhost` não é
      // nenhum segredo — digeri-los produziria falsos positivos.
      if (match[1] !== 'DB_PASSWORD') continue;
      push(match[2], `wp-config.${match[1]}`, 'credential');
    }
  }

  // --- o dump ----------------------------------------------------------------
  for await (const { table, values } of streamInserts(sqlPath)) {
    if (table === 'wp_options') {
      const [, name, raw] = values;
      if (!name || !raw) continue;
      const found = [];
      try {
        collectStrings(phpUnserialize(raw), name, found);
      } catch {
        collectStrings(raw, name, found);
      }
      for (const entry of found) {
        // A chave do valor é o critério: `token`, `secret`, `*_key`,
        // `password` — é uma credencial. O nome da opção só é um indício
        // (e traz valores que **não** são segredos: as mensagens de revisão,
        // as estatísticas do painel).
        if (CREDENTIAL_KEY.test(entry.key)) {
          push(entry.value, `wp_options.${name}`, 'credential');
          continue;
        }
        if (SENSITIVE_NAME.test(name) && entry.value.length >= 8) {
          push(entry.value, `wp_options.${name}`, 'sensitive');
        }
      }
      continue;
    }
    if (table === 'wp_usermeta') {
      const [, , key, raw] = values;
      if (!key || !raw || !SENSITIVE_NAME.test(key)) continue;
      const found = [];
      try {
        collectStrings(phpUnserialize(raw), found);
      } catch {
        collectStrings(raw, found);
      }
      for (const value of found) push(value, `wp_usermeta.${key}`, 'credential');
      continue;
    }
    if (!PERSONAL_TABLES.has(table)) continue;
    for (const value of values) {
      if (typeof value !== 'string') continue;
      // The URLs and the contents are not personal data.
      if (/^https?:\/\//.test(value)) continue;
      push(value, table, 'personal');
    }
  }

  return out;
}
