/**
 * The Content Security Policy (SEC-42).
 *
 * There are **two** forms of the same policy:
 *
 * - `CSP_HEADER` — the value of the HTTP header, injected by the Transform
 *   Rule of the Cloudflare (the GitHub Pages does not support `_headers`).
 * - `CSP_META` — the value of the `<meta http-equiv>`, the fallback of the
 *   layout. The browser ignores `frame-ancestors` and
 *   `upgrade-insecure-requests` in a `<meta>`, so they are removed.
 *
 * The two are **derived from the same list**: they can never drift.
 * `scripts/verify-csp.mjs` compares this module with the copy of
 * `docs/DEPLOY.md`.
 */
const DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // `www.gstatic.com` and `www.google.com` are needed by the reCAPTCHA of the
  // Formspree (SEC-38); `www.googletagservices.com` by the Google Tag
  // Manager.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.gstatic.com https://www.google.com https://www.googletagservices.com",
  // D20 — os handlers `on…=` em linha estão **proibidos**. O site não tem
  // nenhum (os scripts do site estão em `public/js/*.js`), por isso a
  // diretiva não quebra nada e fecha o vetor `onerror=` / `onload=` mesmo
  // com `'unsafe-inline'` no `script-src`.
  // ⚠️ `script-src-attr` NÃO bloqueia as URLs `javascript:` — isso é
  // tratado pelo sanitizador (D5) e pela guarda.
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: https://www.google.com https://maps.gstatic.com https://maps.google.com https://*.googleusercontent.com https://*.ggpht.com https://www.gstatic.com",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.google.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://formspree.io https://www.googletagservices.com",
  "frame-src 'self' https://www.google.com https://maps.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.gstatic.com",
  "form-action 'self' https://formspree.io",
];

/** The directives that the browser ignores in a `<meta>`. */
export const META_IGNORED = Object.freeze(['frame-ancestors', 'upgrade-insecure-requests']);

/** The value of the HTTP header. */
export const CSP_HEADER = `${DIRECTIVES.join('; ')}; frame-ancestors 'none'; upgrade-insecure-requests`;

/** The value of the `<meta http-equiv>`. */
export const CSP_META = DIRECTIVES.join('; ');
