#!/usr/bin/env node
/**
 * The contrast table A1…A25 (SPEC-UI §4.1) **recomputed from the built
 * CSS** — the values that are really applied, not the ones of the spec.
 *
 *   node scripts/check-contrast.mjs [--dist <dist dir>]
 *
 * Each case declares the selector of the rule, the property to read and the
 * background it is measured against. The script resolves the cascade **the
 * way a browser does for these rules**: the order of the stylesheets (the
 * last one wins) and the `!important` (which wins over everything) — the
 * **specificity is not computed** (REV-9 / E15): the rules of the overlay
 * (`a11y.css`) are written with `!important` precisely so that the order of
 * the stylesheets decides. The custom properties (`var(--x)`) are expanded.
 *
 * The cases marked `manual: true` (A20, A21, A23) are **measured by hand**:
 * the background is a gradient or a colour that no selector of the built CSS
 * expresses, so the script cannot read it — they are **not** part of the
 * automated count.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');

const args = { dist: 'dist' };
for (let i = 0; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const key = process.argv[i].slice(2);
  const value = process.argv[i + 1];
  if (value === undefined) throw new Error(`missing value for --${key}`);
  args[key] = value;
  i++;
}

const DIST = resolve(process.cwd(), args.dist);
const CSS_DIR = join(DIST, 'css');

/** The order of the stylesheets (the same as `src/lib/stylesheets.ts`). */
const ORDER = [
  'fonts.css',
  'theme.css',
  'theme-dynamic.css',
  'elementor-core.css',
  'elementor-kit.css',
  'widgets.css',
  'elementor-widgets.css',
  'upk.css',
  'elementskit.css',
  'swiper.css',
  'fontawesome.css',
  'fontawesome5.css',
  'elementor-header.css',
  'elementor-home.css',
  'elementor-footer.css',
  'tokens.css',
  'a11y.css',
];

/**
 * The relative luminance of a colour.
 * @param {string} hex
 * @returns {number}
 */
function luminance(hex) {
  const rgb = hex
    .replace('#', '')
    .match(/../g)
    .map((part) => parseInt(part, 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/**
 * The WCAG contrast ratio of two colours.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The rules of a CSS file.
 * @param {string} file
 * @returns {Array<{selector: string, body: string}>}
 */
function rules(file) {
  // the comments are removed first: some of them carry braces (the quotation
  // of a rule of the Elementor) and would break the split.
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    const selector = match[1].trim();
    if (selector.startsWith('@')) continue;
    out.push({ selector, body: match[2] });
  }
  return out;
}

const ALL = [];
for (const file of ORDER) {
  const path = join(CSS_DIR, file);
  if (!existsSync(path)) continue;
  for (const rule of rules(path)) ALL.push({ ...rule, file });
}

/** The custom properties, by name. */
const VARIABLES = new Map();
for (const rule of ALL) {
  if (!rule.selector.includes(':root') && !rule.selector.includes('elementor-kit-6')) continue;
  // the comments inside the block would break the first declaration
  const body = rule.body.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const declaration of body.split(';')) {
    const index = declaration.indexOf(':');
    if (index === -1) continue;
    const name = declaration.slice(0, index).trim();
    const value = declaration.slice(index + 1).trim();
    if (!name.startsWith('--')) continue;
    if (!VARIABLES.has(name) || rule.file === 'tokens.css' || rule.file === 'elementor-kit.css') {
      VARIABLES.set(name, value);
    }
  }
}

/**
 * Resolves a value: the custom properties are expanded.
 * @param {string} value
 * @returns {string}
 */
function resolveValue(value) {
  let out = value;
  for (let i = 0; i < 5; i++) {
    const next = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, name, fallback) => {
      const resolved = VARIABLES.get(name);
      return resolved ?? fallback ?? 'transparent';
    });
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

/**
 * The value of a property for a selector, following the cascade.
 * @param {string} selector
 * @param {string} property
 * @returns {string | null}
 */
function valueOf(selector, property) {
  let best = null;
  for (const rule of ALL) {
    // the selector may carry the comment that precedes the rule
    const parts = rule.selector.replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((s) => s.trim());
    if (!parts.includes(selector)) continue;
    const re = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'g');
    let m;
    while ((m = re.exec(rule.body)) !== null) {
      const raw = m[1].trim();
      const important = /!important$/.test(raw);
      const value = resolveValue(raw.replace(/!important$/, '').trim());
      const weight = (important ? 1000 : 0) + ALL.indexOf(rule);
      if (!best || weight > best.weight) best = { value, weight };
    }
  }
  return best ? best.value : null;
}

/**
 * The cases of the table. `fg`/`bg` are the values that the built CSS must
 * apply; `min` is the required ratio.
 */
const CASES = [
  { id: 'A1', what: 'o rótulo do botão', fg: '#2E2E2E', bg: '#BC9265', min: 4.5, selector: '.elementor-kit-6 .elementor-button', property: 'color' },
  { id: 'A2', what: 'o rótulo do botão no hover', fg: '#2E2E2E', bg: '#C9A377', min: 4.5, selector: '.elementor-kit-6 .elementor-button:hover', property: 'color' },
  { id: 'A3', what: 'o hover do menu', fg: '#C09A6B', bg: '#2E2E2E', min: 4.5, selector: '.elementor-widget-nav-menu .elementor-nav-menu--main .elementor-item:hover', property: 'color' },
  { id: 'A4', what: 'o título do icon-box (Áreas)', fg: '#C09A6B', bg: '#2E2E2E', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-30d8c26 .elementor-icon-box-title', property: 'color' },
  { id: 'A5', what: 'o título do icon-box (Serviços)', fg: '#8A6132', bg: '#FFFFFF', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-bc731ec .elementor-icon-box-title', property: 'color' },
  { id: 'A6', what: 'a descrição do icon-box (Áreas)', fg: '#B5B5B5', bg: '#2E2E2E', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-30d8c26 .elementor-icon-box-description', property: 'color' },
  { id: 'A7', what: 'a descrição do icon-box (Serviços)', fg: '#6E6E6E', bg: '#FFFFFF', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-bc731ec .elementor-icon-box-description', property: 'color' },
  { id: 'A8', what: 'o título de uma coluna do rodapé', fg: '#C09A6B', bg: '#2E2E2E', min: 4.5, selector: '.elementor-48 .elementor-element.elementor-element-50673f0 .elementor-heading-title', property: 'color' },
  { id: 'A9', what: 'o hover de um link do rodapé', fg: '#C09A6B', bg: '#2E2E2E', min: 4.5, selector: '.elementor-48 .elementor-element.elementor-element-2749d9b .elementor-icon-list-item a:hover', property: 'color' },
  { id: 'A10', what: 'o texto de um campo do formulário', fg: '#F3F3F3', bg: '#2E2E2E', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-3273196 .elementor-field-group .elementor-field', property: 'color' },
  { id: 'A11', what: 'a borda de um campo (componente)', fg: '#E8C79A', bg: '#2E2E2E', min: 3, selector: '.elementor-30 .elementor-element.elementor-element-3273196 .elementor-field-group .elementor-field:not(.elementor-select-wrapper)', property: 'border-color' },
  { id: 'A12', what: 'o placeholder de um campo', fg: '#B5B5B5', bg: '#2E2E2E', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-3273196 .elementor-field::placeholder', property: 'color' },
  { id: 'A13', what: 'a mensagem de sucesso', fg: '#0A7240', bg: '#FFFFFF', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-3273196 .elementor-message-success', property: 'color' },
  { id: 'A14', what: 'a mensagem de erro', fg: '#C1121F', bg: '#FFFFFF', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-3273196 .elementor-message-danger', property: 'color' },
  { id: 'A15', what: 'as estrelas do depoimento', fg: '#8A6132', bg: '#F3F3F3', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-5f31c3f .elementskit-stars > li > a', property: 'color' },
  { id: 'A16', what: 'a legenda "- Voltaire"', fg: '#8A6132', bg: '#F3F3F3', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-269416c .elementor-heading-title', property: 'color' },
  { id: 'A17', what: 'o hover de um link genérico (fundo claro)', fg: '#8A6132', bg: '#FFFFFF', min: 4.5, selector: '.elementor-kit-6 a:hover', property: 'color' },
  { id: 'A18', what: 'o hover de um link genérico (fundo escuro)', fg: '#C09A6B', bg: '#2E2E2E', min: 4.5, selector: '.elementor-element-7dffe5f a:hover', property: 'color' },
  // REV-9 (E15): medido à mão (o fundo é um gradiente, que nenhum seletor
  // do CSS construído expressa) — fora da contagem automática.
  { id: 'A20', what: 'o separador do icon-list (componente)', fg: '#7A7A7A', bg: '#2E2E2E', min: 3, selector: null, property: null, manual: true },
  { id: 'A21', what: 'o divisor do divider (componente, fundo claro)', fg: '#B68C5A', bg: '#FFFFFF', min: 3, selector: null, property: null, manual: true },
  { id: 'A22', what: 'o ícone social no hover', fg: '#2E2E2E', bg: '#BC9265', min: 4.5, selector: '.elementor-49 .elementor-social-icon:hover svg', property: 'fill' },
  { id: 'A23', what: 'o texto do blog', fg: '#2E2E2E', bg: '#F3F3F3', min: 4.5, selector: null, property: null, manual: true },
  { id: 'A24', what: 'a biografia do "Sobre"', fg: '#B5B5B5', bg: '#2E2E2E', min: 4.5, selector: '.elementor-30 .elementor-element.elementor-element-67ccd3a .elementor-text-editor p', property: 'color' },
  // C7 — o hover dos "Serviços": a secção tem um fundo BRANCO, por isso o
  // hover é o genérico (#8A6132 = 5.47:1), e não o dourado claro das
  // superfícies escuras (2.60:1).
  { id: 'A25', what: 'o hover de um link dos "Serviços" (fundo branco)', fg: '#8A6132', bg: '#FFFFFF', min: 4.5, selector: '.elementor-kit-6 a:hover', property: 'color', lightSection: 'dd1df9b' },
];

console.log('A tabela de contraste A1…A25, RECOMPUTADA a partir do CSS construído:\n');

// C7 — a lista das superfícies escuras (o hover dos links). Uma secção de
// fundo BRANCO na lista é um erro: o dourado claro sobre o branco dá 2.60:1.
const LIGHT_SECTIONS = {
  dd1df9b: 'Serviços',
};
const darkSections = new Set();
for (const rule of ALL) {
  if (!rule.body.includes('--color-accent-text-inverse')) continue;
  for (const part of rule.selector.replace(/\/\*[\s\S]*?\*\//g, '').split(',')) {
    const match = /elementor-element-([0-9a-f]+)\s+a:hover/.exec(part.trim());
    if (match) darkSections.add(match[1]);
  }
}

let failed = 0;
for (const item of CASES) {
  let fg = item.fg;
  let note = '';
  if (item.selector) {
    const applied = valueOf(item.selector, item.property);
    if (!applied) {
      console.log(`  ????  ${item.id} · ${item.what} — a regra "${item.selector}" não foi encontrada no CSS construído`);
      failed++;
      continue;
    }
    if (applied.toLowerCase() !== item.fg.toLowerCase()) {
      note = ` (o CSS aplica ${applied}, não ${item.fg})`;
      fg = applied;
    }
  }
  // A25 — a secção dos "Serviços" tem um fundo branco: se estiver na lista
  // das superfícies escuras, o hover efetivo é o dourado claro (2.60:1).
  if (item.lightSection && darkSections.has(item.lightSection)) {
    const name = LIGHT_SECTIONS[item.lightSection] ?? item.lightSection;
    note = ` — a secção "${name}" (${item.lightSection}) está na lista das superfícies escuras (fundo branco)`;
    fg = '#C09A6B';
  }
  const value = ratio(fg, item.bg);
  const ok = value >= item.min;
  if (!ok) failed++;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${item.id.padEnd(4)} ${item.what.padEnd(42)} ${fg} sobre ${item.bg} = ${value.toFixed(2)}:1 (mín. ${item.min})${note}`,
  );
}

// A19 — the colour of "Fale Conosco" is #F3F3F3 over a photo: it depends on
// the image and can only be measured on a screenshot.
console.log('  ????  A19  "Fale Conosco" sobre a foto com overlay 0.5 — só se mede por captura de ecrã');

const manual = CASES.filter((item) => item.manual).length;
console.log(
  `\ncheck-contrast: ${CASES.length - manual} casos automáticos + ${manual} medidos à mão, ${failed} falha(s).`,
);
if (failed > 0) process.exit(1);
