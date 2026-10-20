/**
 * The single source of truth of the patterns that must never reach the
 * repository (SEC-26, SEC-27, SEC-30, SEC-32, SEC-65, SEC-66, SEC-R-26,
 * SEC-R-27).
 *
 * This file is the only one exempt from `scripts/guard-secrets.mjs`.
 *
 * **Two tiers (S1 / SEC-R-01):**
 *
 * 1. **Shapes** — the *regexes* of the credentials. They describe the FORM of
 *    a secret, never a value. A shape can be published: it says "a token of
 *    this shape is forbidden", not "this is the token".
 * 2. **Digests** — the SHA-256 of the **live values** of the backup. A digest
 *    cannot be reversed into the value, so the guard can still recognise the
 *    value in a scanned file without the value ever being in the repository.
 *
 * **Two tiers of digests (SEC-R-26 / SEC-R-27):**
 *
 * - `HIGH_ENTROPY_DIGESTS` — the **credentials** (the password of the
 *   database, the 8 salts of the WordPress, the OAuth tokens, the API keys).
 *   They stay in the repository: a 64-character random salt cannot be
 *   recovered by brute force, so its digest is not a confirmation oracle.
 * - `PII_DIGESTS` — the **IPv4 addresses and the personal e-mail addresses**.
 *   They have **low entropy**: their digest IS a brute-forceable confirmation
 *   oracle (an IPv4 has only 2^32 possibilities). They live in
 *   `scripts/private/pii-digests.json`, a **local, git-ignored** file; the
 *   guard reads it when it exists and skips it otherwise (the CI has no local
 *   file and falls back to the shape rules).
 *
 * **Scopes:** every entry declares one.
 *
 * - `value` — the pattern matches a live credential or personal data.
 * - `name` — the pattern matches the *name* of a sensitive option
 *   (`auth_key`, `client_secret`, …). The specifications legitimately name the
 *   options they must revoke, so those patterns are **not** applied to
 *   `docs/`.
 * - `both` — applied everywhere.
 *
 * `FORBIDDEN_DOCS_PATTERNS` is **derived** from `FORBIDDEN_PATTERNS` by the
 * scope, so the profile of `docs/` can never drift from the full profile.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ label: string, scope: 'value' | 'name' | 'both', pattern: RegExp, exempt?: string[] }} Pattern
 */

/**
 * The 5 action SHAs pinned in the workflow (SEC-50).
 *
 * They are **public** (they are the commit of a public action) and they have
 * exactly 40 hexadecimal characters — the shape of a bearer token. They are
 * the **only** exception, and it is written in the pattern itself (a negative
 * lookahead), so it cannot be used to smuggle another 40-char secret (D3).
 */
export const PINNED_ACTION_SHAS = Object.freeze([
  '3d3c42e5aac5ba805825da76410c181273ba90b1', // actions/checkout v7.0.1
  '949feb2413d6458794dcd2491c4babbbce0c15c1', // actions/setup-node v7.1.0
  '45bfe0192ca1faeb007ade9deae92b16b8254a0d', // actions/configure-pages v6.0.0
  'fc324d3547104276b827a68afc52ff2a11cc49c9', // actions/upload-pages-artifact v5.0.0
  '368f82528645a54fb793d4d04e342629a3f51346', // actions/deploy-pages v5.0.1
]);

/** A negative lookahead that excludes the pinned SHAs. */
const NOT_PINNED = `(?!${PINNED_ACTION_SHAS.join('|')})`;

/**
 * Escapa um valor para o padrão.
 * @param {string} value
 * @returns {string}
 */
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Os **contactos públicos** do escritório — os valores de PII que
 * legitimamente aparecem no repositório (REV-4).
 *
 * @param {string[]} values
 * @returns {string} os valores escapados, para um lookahead negativo
 */
const notPublic = (values) => values.map(escapeRe).join('|');

/**
 * O e-mail público do escritório (o único que o site publica) e os
 * endereços de exemplo que a documentação e o formulário usam.
 */
export const PUBLIC_EMAILS = Object.freeze([
  'contato@galastriadvocacia.com.br', // o contacto do escritório (o rodapé e o formulário)
  'contato@glastriadvocacia.com.br', // a **gralha** documentada nas correcções de conteúdo
  'voce@email.com', // o valor por omissão do campo do formulário
  'x@example.com', // o exemplo da SPEC-SECURITY
  // A forma de privacidade do GitHub do dono do repositório — é **pública**
  // (é o autor de cada commit) e não é o e-mail de ninguém.
  '78239512+devCarlosHenSil@users.noreply.github.com',
  // O endereço **placeholder** do commit inicial publicado (o domínio
  // `example.com` é reservado pela RFC 2606 — não é o e-mail de ninguém).
  'carlos@example.com',
]);

/**
 * Os endereços IP que a documentação tem de citar: os do **GitHub Pages**
 * (a origem, `docs/DEPLOY.md` §2.1) e os **medidos** do proxy da Cloudflare
 * (§2.2), mais os dois loopbacks usados pelos scripts.
 */
export const PUBLIC_IPS = Object.freeze([
  '185.199.108.153',
  '185.199.109.153',
  '185.199.110.153',
  '185.199.111.153',
  '104.21.57.72',
  '172.67.161.120',
  '126.0.0.0',
  '127.0.0.1',
]);

/**
 * O telefone do escritório, nas quatro formas em que aparece (o `tel:` do
 * HTML, o rodapé, as políticas e o runbook).
 */
export const PUBLIC_PHONES = Object.freeze([
  '5511985665992',
  '+55-11-98566-5992',
  '+5511985665992',
  '+55 11 98566-5992',
]);

const NOT_PUBLIC_EMAILS = notPublic(PUBLIC_EMAILS);
const NOT_PUBLIC_IPS = notPublic(PUBLIC_IPS);
const NOT_PUBLIC_PHONES = notPublic(PUBLIC_PHONES);

/**
 * @param {string} label
 * @param {'value'|'name'|'both'} scope
 * @param {string} source
 * @param {string[]} [exempt] the files where the pattern is allowed
 * @returns {Pattern}
 */
const p = (label, scope, source, exempt) => ({ label, scope, pattern: new RegExp(source), exempt });

/**
 * The full profile — applied to the code, the assets, the tests and the root of
 * the repository.
 * @type {Pattern[]}
 */
export const FORBIDDEN_PATTERNS = [
  // --- the shapes of the credentials (values, never the values) --------------
  p('SEC-26 · Google OAuth client secret', 'value', 'GOC[A-Z]PX-[A-Za-z0-9_-]{8,}'),
  p('SEC-26 · Google OAuth access token', 'value', 'ya2[0-9]\\.[A-Za-z0-9_-]{8,}'),
  p('SEC-26 · Google OAuth refresh token', 'value', '1//0[A-Za-z0-9_-]{8,}'),
  p('SEC-26 · Google OAuth auth code', 'value', '4/0A[A-Za-z0-9_-]{8,}'),
  p('SEC-26 · WP-Vivid auth id', 'value', 'wpvivid-auth-[A-Za-z0-9]{8,}'),
  // REV-1 (E1): o `docs/rotation-gate.md` recebe o **sha256 da captura** de
  // cada rotação — 64 hex. O sha256 de uma captura de ecrã não é uma
  // credencial: sem esta excepção, a primeira prova colada pelo cliente
  // reprovaria a guarda, o `prebuild` reprovaria o build e o site **nunca**
  // seria publicado (os dois gates deadlockavam-se).
  p(
    'SEC-26 · session token (64 hex)',
    'value',
    '\\b[a-f0-9]{64}\\b',
    ['scripts/private/', 'docs/rotation-gate.md'],
  ),
  p('SEC-26 · API key (32 hex)', 'value', '\\b[a-f0-9]{32}\\b', ['tests/fixtures/', 'scripts/private/']),
  // SEC-50: os 5 SHAs fixados das actions são públicos e têm 40 hex — são a
  // **única** excepção e está escrita no próprio padrão (D3).
  p(
    'SEC-26 · bearer token (40 hex)',
    'value',
    `\\b${NOT_PINNED}[a-f0-9]{40}\\b`,
    ['docs/SPEC-SECURITY.md', 'scripts/verify-workflow.mjs'],
  ),
  // D14 — o token moderno da API da Cloudflare (40 alfanuméricos, sem
  // prefixo). O CSS copiado verbatim traz blobs base64 → é excepção.
  p(
    'SEC-26 · o token da API da Cloudflare (40 alfanuméricos)',
    'value',
    `\\b${NOT_PINNED}[A-Za-z0-9]{40}\\b`,
    [
      'docs/SPEC-SECURITY.md',
      'scripts/verify-workflow.mjs',
      'public/css/',
      // REV-15 (E12): o CSS **verbatim** do Elementor vive em
      // `public/wp-content/uploads/elementor/css/` (e as fontes em
      // `.../elementor/google-fonts/`) — os blobs base64 são falsos positivos.
      'public/wp-content/uploads/elementor/css/',
      'public/wp-content/uploads/elementor/google-fonts/',
      'tests/fixtures/',
      'package-lock.json',
    ],
  ),
  p('SEC-26 · a Global API Key da Cloudflare (37 hex)', 'value', '\\b[a-f0-9]{37}\\b', ['tests/fixtures/']),
  p('SEC-26 · o token do GitLab', 'value', 'glpat-[A-Za-z0-9_-]{20,}'),
  p('SEC-26 · o access key id da AWS', 'value', 'ASIA[0-9A-Z]{16}'),
  p('SEC-26 · o token do SendGrid', 'value', 'SG\\.[A-Za-z0-9_-]{20,}'),
  p('SEC-26 · a chave da Anthropic', 'value', 'sk-ant-[A-Za-z0-9_-]{20,}'),
  p('SEC-26 · Cloudflare API token', 'value', '\\bv1\\.0-[A-Za-z0-9_-]{20,}\\b'),
  p('SEC-30 · private key', 'value', '-----BEGIN [A-Z ]*PRIVATE KEY-----'),
  p('SEC-30 · JWT', 'value', 'eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}\\.'),
  p('SEC-30 · password hash (bcrypt)', 'value', '\\$wp\\$2y\\$'),
  p('SEC-30 · password hash (phpass)', 'value', '\\$P\\$[A-Za-z0-9./]{20,}'),
  p(
    'SEC-30 · cloud credentials',
    'value',
    'AKIA[0-9A-Z]{16}|sk_live_[A-Za-z0-9]{16,}|sk_test_[A-Za-z0-9]{16,}|pk_live_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|ghu_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|github_pat_[A-Za-z0-9_]{20,}',
  ),
  p('SEC-27 · spam campaigns', 'value', 'hacklinkpanel|axiebet|shbetgame|welcometos666|ketquanet'),

  // --- REV-4 (E4): as formas de PII -----------------------------------------
  // A guarda **não** tinha nenhuma regra de e-mail / IP / telefone: o único
  // mecanismo era o ficheiro local de digests, que não existe no CI. Estas
  // formas fazem o CI apanhar um e-mail, um IP ou um telefone colados por
  // engano — e deixam passar os contactos **públicos** do escritório (a
  // allow-list está em `PUBLIC_EMAILS` / `PUBLIC_IPS` / `PUBLIC_PHONES`).
  p(
    'SEC-27 · um e-mail de uma pessoa (que não é o do escritório)',
    'value',
    `(?<![A-Za-z0-9._%+-])(?!(?:${NOT_PUBLIC_EMAILS}))[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}`,
    ['tests/fixtures/'],
  ),
  p(
    'SEC-27 · um endereço IP (que não é o do GitHub Pages ou da Cloudflare)',
    'value',
    `(?<![0-9.])(?!(?:${NOT_PUBLIC_IPS}))\\b(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}\\b`,
    ['tests/fixtures/'],
  ),
  p(
    'SEC-27 · um telefone (que não é o do escritório)',
    'value',
    `(?<![0-9+])(?!(?:${NOT_PUBLIC_PHONES}))\\+?55[\\s-]?\\(?\\d{2}\\)?[\\s-]?\\d{4,5}[\\s-]?\\d{4}\\b`,
    ['tests/fixtures/'],
  ),

  // --- the names of the sensitive options -----------------------------------
  p('SEC-26 · database and WordPress', 'name', 'DB_PASSWORD|DB_USER|DB_HOST\\s*=\\s*localhost'),
  p(
    'SEC-26 · WordPress salts',
    'name',
    'auth_key|logged_in_key|secure_auth_key|nonce_key|nonce_salt|auth_salt|logged_in_salt|secure_auth_salt',
  ),
  p('SEC-26 · session tokens', 'name', 'session_tokens'),
  p('SEC-26 · other tokens', 'name', 'ea11y_client_secret|wordpress_api_key|indexnow_api_key|trustindex-google-review'),
  p(
    'SEC-26 · WP-Vivid and Elementor Connect',
    'name',
    'elementor_connect_site_key|elementor_safe_mode_token|wpvivid_upload_setting',
  ),
  p(
    'SEC-30 · comments of the database',
    'name',
    'comment_author|comment_content|akismet_as_submitted|akismet_',
  ),
  p(
    'SEC-32 · secret configuration',
    'name',
    'client_secret|secret_key|private[_-]key|\\baccess_key\\b|api[_-]?key|apiKey',
  ),
];

/**
 * The profile of `docs/` (SEC-65): the shapes and the values, but **not** the
 * names of the options. Derived from the full profile, so it can never drift.
 * @type {Pattern[]}
 */
export const FORBIDDEN_DOCS_PATTERNS = FORBIDDEN_PATTERNS.filter((entry) => entry.scope !== 'name');

/**
 * The SHA-256 digests of the **live credentials** of the backup, with the
 * length of each value.
 *
 * **The values themselves are not in this file** — only their digests, which
 * cannot be reversed (SEC-R-26: these values have enough entropy to not be a
 * brute-forceable confirmation oracle).
 *
 * The personal data (the IPv4 addresses and the e-mail addresses) is **not**
 * here: it is in `scripts/private/pii-digests.json` (local, git-ignored).
 *
 * @type {Array<[string, number]>}
 */
export const HIGH_ENTROPY_DIGESTS = [
  // --- as credenciais do backup (o digest, o comprimento e a chave de prefixo) ---
  // A chave de prefixo é o FNV-1a de 32 bits dos primeiros 8 caracteres: é o
  // pré-filtro da janela deslizante (sem ele a guarda demorava minutos).
  ['6394e813a633391a7b952850323dbb22d14e345304ad323090cbc6a86ffdb1c2', 64, 3345551663],  // nonce_key
  ['db00d9f2caf401de2ff364c56542fe2e864566ffb5ad4de6774dd326dac3b46f', 64, 1465988670],  // logged_in_key
  ['8c96d77c6a45fb0ff75e370ea8ad67d05a96e24dd6f97cd4a2acd40a0590a9c5', 64, 2377118458],  // secure_auth_key
  ['c7e1526d4fb645716736396270f152bcef07b61e0b8f6dc8e0d105d56ea8e9a2', 32, 3696553037],  // elementor_connect_site_key
  ['aaf3ab31f3253c6f6efd782d9b031b80559ee4f1644ff231b5a4c2e980f4d5e5', 64, 2852582868],  // auth_key
  ['fb7c7eec32a4b0b5e43f8f518487044e4a0f41f8c0d59ae47f64e392ed3b1cea', 32, 550663977],  // indexnow_api_key
  ['bf239f6a28a726b25d17c3e7edb1716fdc5ce630bcb5297b51338da6f36a2fd8', 588, 1227815410],  // access_token
  ['c8a3ef52b9c8354d59393382eb48508a7a9d04ae8c52ec789c131f88df96a1de', 320, 1385875349],  // refresh_token
  ['b311b52fcb4f81acecabce3e1f778b4697614d5e672bf513e91884b67cf9fe9e', 444, 1747197535],  // googlesitekit_credentials
  ['43f611dbef4c5170ac1b9a3b9eb2b4d0c70e1cd4df80a681ddc2b02d6feabe40', 296, 4206711136],  // access_token
  ['3983302cfdaf28499f357abf4b8308d395b43e2de588fa96c0c4058cc09394cf', 140, 2891630636],  // refresh_token
  ['2b20bfafc65e2414c391406d01dfdf0a2ad415c6ce22eebd6d2d81bccce3c80e', 344, 3837603518],  // access_token
  ['dff285da18e9a8cf74f7f8f2800436ce4effbd24e71a8a60c10e7af24c2e57a1', 344, 4206711136],  // access_token
  ['ef7ec7b6867ed1bf84ce2d6917ebafbbf0da1f91550594d16596c4ae662d37c1', 344, 4206711136],  // access_token
  ['a29072f11a8b8e8bb914608ef9f52ed11c26ae45e72829d16f7261ecb3776cbe', 344, 4206711136],  // access_token
  ['fdd24966307768bd792ead9f6fcc3eb3ef1b1a2461a256bfa4ac47555ccc9b6c', 344, 4206711136],  // access_token
  ['ddf9091d9ec02caa74b2ada7c1608962815cdf79d4079d5304114498a90df1b0', 35, 2019818980],  // client_secret
  ['705e4d0dcef6874c7efc1b21cafdda6996fd46fd245197faf4ead1716bc10ebd', 256, 1395694140],  // access_token
  ['6624d9ff7719c116f6e3c117768de1e86ca8067c47fc9eae1776673a0cbb57c2', 103, 4011103925],  // refresh_token
  ['9a089c55e6ac17aab9d0b72876e2a650287fca28fed9cdb006ed3d8869956399', 64, 3755830885],  // elementor_safe_mode_token
  ['94bb6e8b9d912f7629a312ab48f85bdea66dcccf367327eb274ad295efe016c2', 344, 4206711136],  // access_token
  ['23ca68b13c6361650f0dc6401c0b53b736eafa25162d82fc689a4837c7b2ccf3', 344, 4206711136],  // access_token
  ['209808e2b53c0e0d800375e6071e5000b1a8402367e7d1bafa8f19c0f419b517', 344, 4206711136],  // access_token
  ['f87ed674c6cb4327f184e066e9de7558551c86b2fdb3583d4a1801ba847c778d', 192, 458169371],  // api_key
  ['fb9c9b233b7e83509d2b66fbda9c187b34e9f975de17fec37e57921ca253d7d3', 26, 3877125135],  // ea11y_client_secret
  ['322f6e4982222f01a98693dd19dcfca7b786ea5aca79de128401734f24586c91', 30, 1924081481],  // o segredo do Elementor Connect
];

/**
 * The local file with the digests of the **local tier**: the personal data
 * (the IPv4 addresses, the e-mail addresses, the phone numbers) **and** the
 * credentials of **low entropy** (REV-3 / E3: a digest of a 13-character
 * secret is a brute-forceable confirmation oracle).
 *
 * It is **git-ignored**: it never reaches the public repository.
 *
 * The format is the same as the one of the table: `[digest, length,
 * prefixKey]`.
 */
export const PII_DIGEST_FILE = 'scripts/private/pii-digests.json';

/**
 * Reads the local file.
 *
 * O ficheiro tem **duas** secções porque os dois mecanismos são diferentes:
 * - `credentials` — as credenciais de baixa entropia → a **janela deslizante**;
 * - `personal` — os dados pessoais (e-mail, IPv4, telefone) → as **formas**.
 *
 * @param {string} [projectRoot]
 * @returns {{credentials: Array<[string, number, number]>, personal: Array<[string, number]>}}
 *   (vazio quando o ficheiro não existe — o CI não tem ficheiro local)
 */
export function loadPiiDigests(projectRoot) {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = projectRoot ?? resolve(here, '..', '..');
  const file = join(root, ...PII_DIGEST_FILE.split('/'));
  const empty = { credentials: [], personal: [] };
  if (!existsSync(file)) return empty;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return empty;
    const credentials = Array.isArray(parsed.credentials) ? parsed.credentials : [];
    const personal = Array.isArray(parsed.personal) ? parsed.personal : [];
    return {
      credentials: credentials
        .filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number')
        .map(([digest, length, key]) => [digest, length, key]),
      personal: personal
        .filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number')
        .map(([digest, length]) => [digest, length]),
    };
  } catch {
    return empty;
  }
}

/** @type {Map<number, Set<string>>} the digests grouped by the length of the value */
function byLength(digests) {
  const map = new Map();
  for (const entry of digests) {
    const [digest, length] = entry;
    if (!map.has(length)) map.set(length, new Set());
    map.get(length).add(digest);
  }
  return map;
}

/**
 * The **prefix key** of a value: the FNV-1a de 32 bits dos primeiros 8
 * caracteres.
 *
 * É o **pré-filtro** da janela deslizante (D4): a soma de caracteres é
 * calculada sem alocar nada e o SHA-256 completo só é calculado para os
 * candidatos cuja chave coincide — sem ele, a guarda demorava minutos.
 *
 * @param {string} value
 * @returns {number}
 */
export function prefixKey(value) {
  let hash = 0x811c9dc5;
  const length = Math.min(8, value.length);
  for (let i = 0; i < length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The prefix key of a substring, sem o alocar.
 * @param {string} text
 * @param {number} start
 * @returns {number}
 */
function prefixKeyAt(text, start) {
  let hash = 0x811c9dc5;
  const end = Math.min(start + 8, text.length);
  for (let i = start; i < end; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The characters that may delimit a value. */
const ALNUM = /[0-9A-Za-z]/;

/**
 * The left edge of a candidate: the 3 characters before it must not all be
 * alphanumeric (a tolerance of ± 2 characters — the value can be glued to a
 * letter or to a digit).
 * @param {string} text
 * @param {number} start
 * @returns {boolean}
 */
function leftEdgeOk(text, start) {
  for (let d = 1; d <= 3; d++) {
    const ch = text[start - d];
    if (ch === undefined) return true;
    if (!ALNUM.test(ch)) return true;
  }
  return false;
}

/**
 * The right edge of a candidate: the 3 characters after it must not all be
 * alphanumeric.
 * @param {string} text
 * @param {number} end
 * @returns {boolean}
 */
function rightEdgeOk(text, end) {
  for (let d = 0; d < 3; d++) {
    const ch = text[end + d];
    if (ch === undefined) return true;
    if (!ALNUM.test(ch)) return true;
  }
  return false;
}

/**
 * Finds the live values of the backup in a text, by digest.
 *
 * The candidates are **not** split by a character class (a salt of the
 * WordPress has characters outside any "word" class and would be shredded):
 * for each known length L, every substring of length L whose edges are not
 * alphanumeric is a candidate — with a tolerance of ± 2 characters.
 *
 * The two tiers use **different mechanisms** (D4):
 *
 * - the **credentials** (`HIGH_ENTROPY_DIGESTS`) are random and have no
 *   shape → the sliding window;
 * - the **personal data** (`PII_DIGESTS`) has a shape (an e-mail, an IPv4, a
 *   phone) → the candidates are extracted with a regex, which is orders of
 *   magnitude faster (the window over 800 digests took minutes).
 *
 * @param {string} content
 * @param {Array<[string, number]>} [digests] the credentials (the sliding
 *   window)
 * @param {Array<[string, number]>} [piiDigests] the personal data (the shapes)
 * @returns {string[]} the values that were found (the value itself, never the
 *   digest — the caller only needs to know that it is there)
 */
export function findDigestedValues(content, digests = HIGH_ENTROPY_DIGESTS, local = { credentials: [], personal: [] }) {
  if (typeof content !== 'string' || content.length === 0) return [];
  const found = new Set();
  const localCredentials = local.credentials ?? [];
  const localPersonal = local.personal ?? [];

  // --- the credentials: the sliding window ---------------------------------
  // O nível do repositório (a alta entropia) e o nível **local** (as
  // credenciais de baixa entropia, que não podem ser publicadas) usam o
  // mesmo mecanismo.
  const lengths = byLength([...digests, ...localCredentials]);
  if (lengths.size > 0) {
    // The prefix keys, by length: o pré-filtro (D4).
    const keys = new Map();
    for (const entry of [...digests, ...localCredentials]) {
      const [, length, key] = entry;
      if (key === undefined) continue;
      if (!keys.has(length)) keys.set(length, new Set());
      keys.get(length).add(key);
    }
    // The positions where a candidate may start (computed once per file).
    const starts = [];
    for (let i = 0; i < content.length; i++) {
      if (leftEdgeOk(content, i)) starts.push(i);
    }
    for (const [length, expected] of lengths) {
      if (length > content.length) continue;
      const prefixes = keys.get(length);
      for (const start of starts) {
        const end = start + length;
        if (end > content.length) break;
        if (!rightEdgeOk(content, end)) continue;
        // O pré-filtro: sem ele, são milhões de SHA-256 (minutos).
        if (prefixes && !prefixes.has(prefixKeyAt(content, start))) continue;
        const value = content.slice(start, end);
        const digest = createHash('sha256').update(value, 'utf8').digest('hex');
        if (expected.has(digest)) found.add(value);
      }
    }
  }

  // --- the personal data: the shapes ---------------------------------------
  if (localPersonal.length > 0) {
    const expected = new Map();
    for (const [digest, length] of localPersonal) expected.set(digest, length);
    for (const candidate of extractPersonalData(content)) {
      const digest = createHash('sha256').update(candidate, 'utf8').digest('hex');
      if (expected.has(digest)) found.add(candidate);
    }
  }

  return [...found];
}

/**
 * The candidates of the **personal data**: the e-mail addresses, the IPv4
 * addresses and the phone numbers.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function extractPersonalData(content) {
  const out = [];
  for (const pattern of PERSONAL_DATA_SEARCH) {
    for (const match of String(content ?? '').matchAll(pattern)) out.push(match[0]);
  }
  return out;
}

/**
 * Tests a value for the shape of the personal data.
 * @param {string} value
 * @returns {boolean}
 */
export function isPersonalData(value) {
  return PERSONAL_DATA_PATTERNS.some((pattern) => new RegExp(pattern.source).test(value));
}

/** The shapes of the personal data (the e-mail, the IPv4, o telefone). */
const PERSONAL_DATA_PATTERNS = [
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^\(?\d{2}\)?[\s-]?9\d{4}[\s-]?\d{4}$/,
];

/**
 * The same shapes, **sem as âncoras** — para extrair os candidatos de um
 * texto maior.
 */
const PERSONAL_DATA_SEARCH = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
  /\(?\d{2}\)?[\s-]?9\d{4}[\s-]?\d{4}/g,
];

/** The file names that must never be versioned. */
export const FORBIDDEN_FILE_NAMES = [/^wp-config.*\.php$/i, /\.sql$/i, /\.zip$/i, /\.sql\.gz$/i];

/**
 * The patterns that are not allowed inside the content (SEC-30 item 3).
 *
 * They are applied to **every** file that carries HTML of the site: the
 * posts (`src/content/**`), the policies (`src/pages/**`), the data of the
 * Elementor (`src/data/**`), the assets (`public/**`), the tests, the docs
 * (sem o código inline) and the scripts (SEC-R-28, D16).
 */
export const CONTENT_PATTERNS = [
  ['<script', /<script\b/i],
  ['<iframe', /<iframe\b/i],
  ['<object', /<object\b/i],
  ['<embed', /<embed\b/i],
  ['srcdoc=', /srcdoc\s*=/i],
  ['onerror=', /\bonerror\s*=/i],
  ['onload=', /\bonload\s*=/i],
  ['onmouseover=', /\bonmouseover\s*=/i],
  ['ontoggle=', /\bontoggle\s*=/i],
];

/**
 * The content patterns that apply to the HTML of the site: the event handlers
 * (any `on…=`) and the `javascript:` URLs.
 *
 * The patterns above are a **sample** (they are the ones of the review); this
 * one is the general rule.
 */
export const CONTENT_HANDLER_PATTERN = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

/**
 * The normalisation applied **before** testing a value for `javascript:`
 * (D5).
 *
 * The browser decodes the entities and strips the control characters before
 * it evaluates the URL: `javascript&colon;alert(1)` and `java&#9;script:alert(1)`
 * are executed. The test has to see the same string the browser sees.
 *
 * @param {string} value
 * @returns {string}
 */
export function normaliseUrlValue(value) {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&colon;|&#0*58;|&#x0*3a;/gi, ':')
    .replace(/&tab;|&#0*9;|&#x0*9;/gi, '\t')
    .replace(/&newline;|&#0*10;|&#x0*a;/gi, '\n')
    .replace(/&amp;/gi, '&')
    .replace(/[\t\r\n\0]/g, '');
}

/**
 * Tests a value for a `javascript:` URL, after the normalisation.
 * @param {string} value
 * @returns {boolean}
 */
export function hasJavascriptUrl(value) {
  return /javascript\s*:/i.test(normaliseUrlValue(value));
}

/**
 * The third-party snippets that are allowed to contain a `<script>` tag
 * (SEC-44 — the Google Tag Manager and the AdSense are kept, R13).
 *
 * The guard accepts a `<script>` in `src/**` only when the file is one of
 * these and the tag itself carries one of the markers below.
 */
export const ALLOWED_SCRIPT_FILES = Object.freeze(['src/layouts/BaseLayout.astro']);

/** The markers that identify an allowed third-party snippet. */
export const ALLOWED_SCRIPT_MARKERS = Object.freeze([
  'GTM-KDNG3QWB',
  'ca-pub-5989678973778468',
  'googletagmanager.com',
  'googlesyndication.com',
  'doubleclick.net',
  'adsbygoogle',
]);
