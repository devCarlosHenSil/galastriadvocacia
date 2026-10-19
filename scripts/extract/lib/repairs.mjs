/**
 * The content repairs of the dump (SPEC-UI §6, PROJECT-STATE B8).
 *
 * The WordPress database of the backup contains a handful of typos that were
 * published on the site. They are repaired **at the source** — inside the
 * extraction — so that re-running `npm run extract` keeps the correction.
 *
 * The list is explicit and auditable: every entry is a verbatim string of the
 * dump and its corrected form.
 */
export const CONTENT_REPAIRS = [
  // The contact e-mail of the footer and of the "Política de IA" has a typo
  // in the domain ("glastri" instead of "galastri").
  ['contato@glastriadvocacia.com.br', 'contato@galastriadvocacia.com.br'],
  // The Instagram URL of the social widgets of the templates 525 and 790.
  ['https://instragram.com/', 'https://www.instagram.com/'],
  // "Contamos com uma equipe profissional e epecialista no que faz".
  ['epecialista', 'especialista'],
  // SPEC-UI §6.1 — the 404 page.
  [
    'Ops parece que alguma coisa deu errado! :/',
    'Ops! Parece que alguma coisa deu errado.',
  ],
  [
    'A página que você está tentando acessar está tentando acessar está temporariamente fora do ar ou foi encerrada! Recomendo que você acesse um dos links abaixo',
    'A página que você está tentando acessar está temporariamente fora do ar ou foi encerrada. Use os links abaixo para continuar navegando.',
  ],
  ['Voltar ao inínicio', 'Voltar ao início'],
  // SPEC-UI §6.7 — the subtitle of the contact section.
  [
    'Agende sua reunião preencha formulário abaixo:',
    'Agende sua reunião preenchendo o formulário abaixo:',
  ],
  // C19a — o erro de digitação no título do post (o BLPC).
  ['Sálario-materinidade', 'Salário-maternidade'],
  // C19b — o nome oficial do CRAS é "Centro de Referência de Assistência
  // Social" (e não "e Assistência Social").
  ['Centro de Referência e Assistência Social', 'Centro de Referência de Assistência Social'],
  // C19c — o depoimento: "próspero" com o acento.
  ['Tenha um prospero ano novo', 'Tenha um próspero ano novo'],
];

/**
 * The links of the lists of the footer, keyed by the text of the item.
 *
 * The original WordPress had two link bugs in the "Institucional" list of the
 * footer (template 48, widget `2749d9b`):
 *
 *   - "Áreas de Atuação" pointed to `#sobre` (a copy/paste mistake);
 *   - "Serviços" pointed to `/servicos/` — a page that **never existed**:
 *     a dead link on every page of the site.
 *
 * The services are an **anchor** of the home page (`/#servicos`, R4).
 */
export const LINK_REPAIRS = {
  'Áreas de Atuação': '/#areasdeatuacao',
  Serviços: '/#servicos',
};

/**
 * Apply the content repairs to a string.
 * @param {string} text
 * @param {Array<{from: string, to: string}>} [applied] the collector of the
 *   repairs that were really applied (DATA-R-08)
 * @returns {string}
 */
export function repairContent(text, applied) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;
  for (const [from, to] of CONTENT_REPAIRS) {
    if (!out.includes(from)) continue;
    out = out.split(from).join(to);
    applied?.push({ from, to });
  }
  return out;
}
