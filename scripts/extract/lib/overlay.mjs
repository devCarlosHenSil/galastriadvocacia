/**
 * The application of the authored overlay of the policies (SPEC-SECURITY
 * §5.2, §5.3, §5.4).
 *
 * The overlay is data (`scripts/extract/lib/authored.mjs`); this module is the
 * mechanism. It is deterministic: the same dump always produces the same
 * document (the idempotency of §6.4).
 *
 * **A aplicação é estrita (C13):** cada `replacement` e cada `section` autoral
 * tem de ser aplicada — se o texto do dump mudar, o build **falha** em vez de
 * publicar o texto original por cima.
 */

/**
 * Substitui o corpo de uma secção, mantendo o seu título.
 *
 * O título pode ser um elemento (`<h4>3. <strong>Cookies</strong></h4>` — o
 * original do WordPress) ou uma linha simples (`3. <strong>Cookies</strong>`
 * — as secções originais das políticas, que não são headings).
 *
 * @param {string} html
 * @param {string} heading the pattern of the heading of the section
 * @param {string} content the new body of the section
 * @returns {{ html: string, found: boolean }}
 */
export function replaceSection(html, heading, content) {
  // (a) the heading is an element.
  const withTag = new RegExp(`(<h[2-6][^>]*>${heading}</h[2-6]>)([\\s\\S]*?)(?=<hr|<h[2-6]\\b|$)`, 'i');
  const tagged = withTag.exec(html);
  if (tagged) {
    return {
      html: html.replace(withTag, () => `${tagged[1]}\n\n${content.trim()}\n`),
      found: true,
    };
  }

  // (b) the heading is a plain numbered line.
  const plain = new RegExp(`((?:^|\\n)${heading})([\\s\\S]*?)(?=\\n<hr|\\n\\d+\\.\\s*<strong>|$)`, 'i');
  const plainMatch = plain.exec(html);
  if (plainMatch) {
    return {
      html: html.replace(plain, () => `${plainMatch[1]}\n\n${content.trim()}\n`),
      found: true,
    };
  }

  return { html, found: false };
}

/**
 * @typedef {{ slug: string, replacements?: Array<{from: string, to: string, kind: string}>, sections?: Array<{heading: string, kind: string, content: string}>, append?: string, demoteHeadings?: Array<{from: string, to: string}>|{from: string, to: string}, renumberSections?: boolean }} PolicyOverlay
 */

/**
 * Applies the overlay to the body of a policy.
 * @param {string} html the body converted from the Gutenberg blocks
 * @param {PolicyOverlay} overlay
 * @param {string} vigencia the date of vigência of the new version
 * @returns {{ html: string, applied: Array<{kind: string}>, missing: string[] }}
 */
export function applyOverlay(html, overlay, vigencia) {
  const applied = [];
  /** The authored entries that were NOT applied — o build falha (C13). */
  const missing = [];
  let out = html;

  // The date of vigência of the version that is published.
  if (vigencia) {
    const before = out;
    out = out.replace(/Data de Vigência: \d{2}\/\d{2}\/\d{4}/g, `Data de Vigência: ${vigencia}`);
    if (out !== before) applied.push({ kind: 'data de vigência', detail: vigencia });
  }

  for (const replacement of overlay.replacements ?? []) {
    if (!out.includes(replacement.from)) {
      missing.push(replacement.kind);
      continue;
    }
    out = out.split(replacement.from).join(replacement.to);
    applied.push({ kind: replacement.kind, detail: replacement.from.slice(0, 60) });
  }

  for (const section of overlay.sections ?? []) {
    const result = replaceSection(out, section.heading, section.content);
    out = result.html;
    if (result.found) applied.push({ kind: section.kind, detail: section.heading });
    else missing.push(section.kind);
  }

  if (overlay.append) {
    out = `${out.replace(/\s+$/, '')}\n\n${overlay.append}\n`;
    applied.push({ kind: 'secções acrescentadas', detail: 'SPEC-SECURITY §5.2/§5.3' });
  }

  // U19 — o contorno das políticas: os `<h4>` do WordPress saltavam do
  // `h1` para o `h4`. Descem para `h2`. A demoção vem **depois** do
  // acrescento: o texto acrescentado também traz `<h4>`.
  if (overlay.demoteHeadings) {
    const pairs = Array.isArray(overlay.demoteHeadings)
      ? overlay.demoteHeadings
      : [overlay.demoteHeadings];
    for (const { from, to } of pairs) {
      out = out.replace(new RegExp(`<${from}(\\s[^>]*)?>`, 'gi'), `<${to}$1>`);
      out = out.replace(new RegExp(`</${from}>`, 'gi'), `</${to}>`);
      applied.push({ kind: `títulos ${from} -> ${to}`, detail: 'contorno do documento' });
    }
  }

  // C8 — a numeração das secções é sequencial (1…N). O original tinha
  // "7, 8, 9" e o anexo acrescentado recomeçava no "9": a publicação tinha
  // dois §7, dois §8 e dois §9.
  if (overlay.renumberSections) {
    let counter = 0;
    out = out.replace(/(^|\n|<h2>)(\d+)(\.\s*)(?=<strong>)/g, (match, prefix, number, punctuation) => {
      counter += 1;
      return `${prefix}${counter}${punctuation}`;
    });
    applied.push({ kind: 'numeração das secções', detail: `${counter} secções renumeradas` });
  }

  return { html: out, applied, missing };
}
