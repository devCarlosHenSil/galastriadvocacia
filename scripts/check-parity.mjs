#!/usr/bin/env node
/**
 * The structural parity check (R1, R2, U25).
 *
 * For each of the three fixtures of the `_elementor_element_cache` — the
 * oracle of the original rendering — the script compares the generated page
 * with the reference:
 *
 *   1. the set **and** the order of the `elementor-element-{id}` classes;
 *   2. the **class list of each element** (the layout: `e-flex`/`e-grid`,
 *      `e-con-boxed`/`e-con-full`, `elementor-widget__width-*`,
 *      `elementor-hidden-*`, `animated-slow`);
 *   3. the sequence of the anchors (`id` attributes);
 *   4. the visible text, after the normalisation of the white spaces and the
 *      application of the copy corrections of SPEC-UI §6.
 *
 * The `_elementor_element_cache` replaces the **dynamic** widgets by a
 * placeholder, so the navigation menu, the logo of the header and the grid of
 * the blog are compared against the golden fixtures of `tests/fixtures/`
 * (`nav-menu.html` and `upk-grid.html`).
 *
 *   node scripts/check-parity.mjs [--dist <dist dir>]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTENT_REPAIRS } from './extract/lib/repairs.mjs';

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
const FIXTURES = join(PROJECT_ROOT, 'tests', 'fixtures');

/**
 * The widgets whose content was rewritten on purpose and that are excluded
 * from the comparison of the visible text — with the reason (U25).
 */
const EXCLUDED = [
  { id: '3273196', reason: 'o formulário (4 campos com rótulos reais, o consentimento da LGPD e o CTA do WhatsApp — SPEC-UI §2.5)' },
  { id: '4b48758', reason: 'o copyright (o ano e a assinatura — SPEC-UI §6.2)' },
  { id: 'c2265f5', reason: 'o mapa (click-to-load — SPEC-UI §4.5)' },
];

/**
 * The region of the page that carries the template of the Elementor.
 * @param {string} html
 * @param {string} id the `data-elementor-id` of the template
 * @returns {string}
 */
function region(html, id) {
  const marker = `data-elementor-id="${id}"`;
  const at = html.indexOf(marker);
  if (at < 0) throw new Error(`the template ${id} was not found in the generated page`);
  const start = html.lastIndexOf('<div', at);
  let depth = 0;
  const re = /<\/?div\b/g;
  re.lastIndex = start;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match[0] === '</div') {
      depth--;
      if (depth === 0) return html.slice(start, match.index + 6);
    } else {
      depth++;
    }
  }
  throw new Error(`the template ${id} is not closed`);
}

/**
 * The ids of the elements, in the order of the document. The placeholders of
 * the cache (`[elementor-element k="…" data="<base64>"]`) are decoded: the
 * base64 carries the JSON of the element, with its id.
 * @param {string} html
 * @returns {string[]}
 */
function elementIds(html) {
  const ids = [];
  const re = /class="elementor-element elementor-element-([0-9a-f]+)|\[elementor-element\s+k="[^"]*"\s+data="([^"]*)"\]/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match[1]) {
      ids.push(match[1]);
      continue;
    }
    try {
      const json = JSON.parse(Buffer.from(match[2], 'base64').toString('utf8'));
      if (json && json.id) ids.push(json.id);
    } catch {
      /* a placeholder that cannot be decoded is ignored */
    }
  }
  return ids;
}

/**
 * The class list of each element, by id (U25).
 * @param {string} html
 * @returns {Map<string, Set<string>>}
 */
function classMap(html) {
  const map = new Map();
  const re = /<div class="elementor-element elementor-element-([0-9a-f]+)([^"]*)"/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    const classes = (`elementor-element elementor-element-${match[1]}${match[2]}`).split(/\s+/).filter(Boolean);
    map.set(match[1], new Set(classes));
  }
  return map;
}

/**
 * The anchors (`id` attributes) of the elements, in the order of the document.
 * @param {string} html
 * @returns {string[]}
 */
function anchors(html) {
  const anchors = [];
  const re = /<div class="elementor-element elementor-element-([0-9a-f]+)[^"]*"\s+([^>]*)>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    const id = /\sid="([^"]*)"/.exec(match[2]);
    if (id) anchors.push(id[1]);
  }
  return anchors;
}

/**
 * Remove the block of an element (the `<div>` and its content).
 * @param {string} html
 * @param {string} id
 * @returns {string}
 */
function removeElement(html, id) {
  const marker = `class="elementor-element elementor-element-${id}`;
  const at = html.indexOf(marker);
  if (at < 0) return html;
  const start = html.lastIndexOf('<div', at);
  let depth = 0;
  const re = /<\/?div\b/g;
  re.lastIndex = start;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match[0] === '</div') {
      depth--;
      if (depth === 0) return html.slice(0, start) + html.slice(match.index + 6);
    } else {
      depth++;
    }
  }
  return html;
}

/**
 * Remove the placeholders of the cache (`[elementor-element k="…" data="…"]`):
 * they are not text, they are the marker of a dynamic widget.
 * @param {string} html
 * @returns {string}
 */
function removePlaceholders(html) {
  return html
    .replace(/\[elementor-element\s+k="[^"]*"\s+data="[^"]*"\]/g, ' ')
    // The control that pauses the carousel is an addition of the
    // accessibility (SPEC-UI §2.6): the original does not have it.
    .replace(/<button[^>]*data-swiper-toggle[^>]*>[\s\S]*?<\/button>/g, ' ');
}

/**
 * The visible text of an HTML fragment.
 * @param {string} html
 * @returns {string}
 */
function visibleText(html) {
  return removePlaceholders(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The copy corrections of SPEC-UI §6, applied to the text of the reference.
 * @param {string} text
 * @returns {string}
 */
function applyRepairs(text) {
  let out = text;
  for (const [from, to] of CONTENT_REPAIRS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {string[]} the elements of `a` that are not in `b`
 */
function missing(a, b) {
  const set = new Set(b);
  return a.filter((item) => !set.has(item));
}

/**
 * The comparison of one template.
 * @param {object} ctx
 * @param {string} ctx.name
 * @param {number} ctx.postId
 * @param {string} ctx.generated the region of the generated page
 * @param {string} ctx.reference the fixture
 * @returns {{ok: boolean, report: string[]}}
 */
function compare(ctx) {
  const report = [];
  let ok = true;

  // --- the placeholders of the reference -----------------------------------
  const placeholderIds = elementIds(ctx.reference).filter((id) => !ctx.reference.includes(`elementor-element-${id} `));
  const excluded = [...new Set([...EXCLUDED.map((e) => e.id), ...placeholderIds])];

  // --- 1. the ids of the elements -----------------------------------------
  const expectedIds = elementIds(ctx.reference);
  const actualIds = elementIds(ctx.generated);

  const missingIds = missing(expectedIds, actualIds);
  const extraIds = missing(actualIds, expectedIds);
  if (missingIds.length > 0 || extraIds.length > 0) {
    ok = false;
    report.push(`  element ids: ${missingIds.length} missing, ${extraIds.length} extra`);
    if (missingIds.length) report.push(`    missing: ${missingIds.join(', ')}`);
    if (extraIds.length) report.push(`    extra:   ${extraIds.join(', ')}`);
  } else {
    report.push(`  element ids: ${actualIds.length} (identical set and order)`);
  }

  // --- 2. the class list of each element (U25) ----------------------------
  const expectedClasses = classMap(ctx.reference);
  const actualClasses = classMap(ctx.generated);
  let classDiffs = 0;
  for (const [id, classes] of expectedClasses) {
    const other = actualClasses.get(id);
    if (!other) continue;
    const missing = [...classes].filter((c) => !other.has(c));
    const extra = [...other].filter((c) => !classes.has(c));
    if (missing.length > 0 || extra.length > 0) {
      classDiffs++;
      ok = false;
      report.push(`  class list of ${id}: missing [${missing.join(' ')}], extra [${extra.join(' ')}]`);
    }
  }
  report.push(
    classDiffs === 0
      ? `  class list: ${expectedClasses.size} element(s), identical sets`
      : `  class list: ${classDiffs} element(s) with a different set`,
  );

  // --- 3. the anchors ------------------------------------------------------
  const expectedAnchors = anchors(ctx.reference);
  const actualAnchors = anchors(ctx.generated);
  if (JSON.stringify(expectedAnchors) !== JSON.stringify(actualAnchors)) {
    ok = false;
    report.push(`  anchors: expected [${expectedAnchors.join(', ')}], got [${actualAnchors.join(', ')}]`);
  } else {
    report.push(`  anchors: ${actualAnchors.length ? actualAnchors.join(', ') : '(none)'}`);
  }

  // --- 4. the visible text -------------------------------------------------
  let expectedHtml = ctx.reference;
  let actualHtml = ctx.generated;
  for (const id of excluded) {
    expectedHtml = removeElement(expectedHtml, id);
    actualHtml = removeElement(actualHtml, id);
  }
  const expectedText = applyRepairs(visibleText(expectedHtml));
  const actualText = visibleText(actualHtml);
  if (expectedText !== actualText) {
    ok = false;
    report.push('  visible text: different');
    let at = 0;
    while (at < expectedText.length && expectedText[at] === actualText[at]) at++;
    report.push(`    at ${at}: expected …${JSON.stringify(expectedText.slice(at, at + 120))}`);
    report.push(`            got      …${JSON.stringify(actualText.slice(at, at + 120))}`);
  } else {
    report.push(`  visible text: ${actualText.length} characters (identical)`);
  }

  return { ok, report };
}

// ---------------------------------------------------------------------------
// The comparison
// ---------------------------------------------------------------------------
if (!existsSync(DIST)) {
  console.error(`the directory ${DIST} does not exist — run "npm run build" first.`);
  process.exit(1);
}

const home = readFileSync(join(DIST, 'index.html'), 'utf8');

const CASES = [
  { name: 'home (post 30)', postId: 30, generated: region(home, '30') },
  { name: 'header (post 49)', postId: 49, generated: region(home, '49') },
  { name: 'footer (post 48)', postId: 48, generated: region(home, '48') },
];

let failed = 0;
for (const testCase of CASES) {
  const reference = readFileSync(join(FIXTURES, `elementor-cache-${testCase.postId}.html`), 'utf8');
  const { ok, report } = compare({ ...testCase, reference });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${testCase.name}`);
  for (const line of report) console.log(line);
  if (!ok) failed++;
}

// ---------------------------------------------------------------------------
// The dynamic widgets (U25) — the cache replaces them by a placeholder
// ---------------------------------------------------------------------------
/**
 * @param {string} html
 * @param {string} id
 * @returns {string}
 */
function elementBlock(html, id) {
  const marker = `class="elementor-element elementor-element-${id}`;
  const at = html.indexOf(marker);
  if (at < 0) throw new Error(`the element ${id} was not found in the page`);
  const start = html.lastIndexOf('<div', at);
  let depth = 0;
  const re = /<\/?div\b/g;
  re.lastIndex = start;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (match[0] === '</div') {
      depth--;
      if (depth === 0) return html.slice(start, match.index + 6);
    } else {
      depth++;
    }
  }
  throw new Error(`the element ${id} is not closed`);
}

/**
 * The markup of the menu: the desktop `<nav>`, the toggle and the dropdown
 * panel.
 *
 * The panel is found by its **exact** opening (`elementor-nav-menu--dropdown
 * elementor-nav-menu__container`) — the class `elementor-nav-menu--dropdown-mobile`
 * of the wrapper would stop the slice at the desktop `</nav>` (C17).
 *
 * @param {string} html
 * @returns {string}
 */
function navMenuMarkup(html) {
  const at = html.indexOf('class="elementor-nav-menu--main');
  if (at < 0) throw new Error('the navigation menu was not found in the page');
  const start = html.lastIndexOf('<nav', at);
  const dropdownAt = html.indexOf('class="elementor-nav-menu--dropdown elementor-nav-menu__container"');
  if (dropdownAt < 0) throw new Error('the dropdown panel of the menu was not found');
  const dropdownStart = html.lastIndexOf('<nav', dropdownAt);
  const end = html.indexOf('</nav>', dropdownStart) + 6;
  return html.slice(start, end);
}

/**
 * @param {string} html
 * @returns {string}
 */
const normalise = (html) => html.replace(/\s+/g, ' ').replace(/> </g, '><').trim();

const DYNAMIC = [
  { name: 'nav menu (7a77dab)', fixture: 'nav-menu.html', generated: normalise(navMenuMarkup(home)) },
  { name: 'blog grid (290d6a8)', fixture: 'upk-grid.html', generated: normalise(elementBlock(home, '290d6a8')) },
];

for (const item of DYNAMIC) {
  const file = join(FIXTURES, item.fixture);
  if (!existsSync(file)) {
    console.log(`FAIL  ${item.name}: the fixture ${item.fixture} does not exist`);
    failed++;
    continue;
  }
  const expected = normalise(readFileSync(file, 'utf8'));
  if (expected === item.generated) {
    console.log(`PASS  ${item.name}`);
    console.log(`  markup: ${item.generated.length} characters (identical to tests/fixtures/${item.fixture})`);
  } else {
    console.log(`FAIL  ${item.name}`);
    let at = 0;
    while (at < expected.length && expected[at] === item.generated[at]) at++;
    console.log(`    at ${at}: expected …${JSON.stringify(expected.slice(at, at + 100))}`);
    console.log(`            got      …${JSON.stringify(item.generated.slice(at, at + 100))}`);
    failed++;
  }
}

// The mobile menu (C17): the toggle must be the **immediate sibling** of the
// panel (the CSS of the Elementor Pro uses the `+` combinator) and the two
// icons must be the `<svg>` children of the button (C4).
const menuMarkup = normalise(navMenuMarkup(home));
const MENU_CHECKS = [
  {
    label: 'o toggle é o irmão imediato do painel',
    ok: /<\/button><nav[^>]*class="elementor-nav-menu--dropdown/.test(menuMarkup),
  },
  {
    label: 'o botão tem os dois ícones em <svg>',
    ok:
      /<svg[^>]*class="[^"]*elementor-menu-toggle__icon--open/.test(menuMarkup) &&
      /<svg[^>]*class="[^"]*elementor-menu-toggle__icon--close/.test(menuMarkup),
  },
  {
    label: 'o aria-controls do toggle aponta para o painel (e não para o <ul>)',
    ok: (() => {
      const controls = /aria-controls="([^"]+)"/.exec(menuMarkup)?.[1];
      if (!controls) return false;
      return new RegExp(`<nav id="${controls}"`).test(menuMarkup);
    })(),
  },
  {
    label: 'o painel fechado tem inert e aria-hidden',
    ok: /<nav id="nav-menu-2-[0-9a-f]+" class="elementor-nav-menu--dropdown elementor-nav-menu__container" aria-hidden="true"[^>]*inert/.test(menuMarkup),
  },
];
for (const check of MENU_CHECKS) {
  if (check.ok) {
    console.log(`PASS  o menu móvel · ${check.label}`);
  } else {
    console.log(`FAIL  o menu móvel · ${check.label}`);
    failed++;
  }
}

// The six anchors of the home (SPEC-UI §9 A.3).
const homeAnchors = anchors(region(home, '30'));
const expectedAnchors = ['home', 'sobre', 'areasdeatuacao', 'servicos', 'quemsou', 'contato'];
if (JSON.stringify(homeAnchors) !== JSON.stringify(expectedAnchors)) {
  console.log(`FAIL  the six anchors of the home: got [${homeAnchors.join(', ')}]`);
  failed++;
} else {
  console.log(`PASS  the six anchors of the home: ${homeAnchors.join(', ')}`);
}

// The grid columns of the built CSS against the settings (U23).
const GRIDS = [
  { id: 'b8d750d', name: 'Áreas' },
  { id: 'fc5c748', name: 'Serviços' },
];
const home30 = JSON.parse(readFileSync(join(PROJECT_ROOT, 'src/data/elementor/home-30.json'), 'utf8'));
/**
 * @param {Array<object>} nodes
 * @param {string} id
 * @returns {object | undefined}
 */
function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.elements ?? [], id);
    if (found) return found;
  }
  return undefined;
}
const builtCss = readFileSync(join(DIST, 'css', 'elementor-home.css'), 'utf8');
for (const grid of GRIDS) {
  const node = findNode(home30.root, grid.id);
  const declared = node?.settings?.grid_columns_grid?.size;
  const rule = new RegExp(`\\.elementor-element-${grid.id}\\{[^}]*--e-con-grid-template-columns:repeat\\((\\d+)`);
  const measured = Number(rule.exec(builtCss)?.[1]);
  if (declared && measured && Number(declared) === measured) {
    console.log(`PASS  the grid of the "${grid.name}" (${grid.id}): ${measured} columns (the CSS and the settings agree)`);
  } else {
    console.log(`FAIL  the grid of the "${grid.name}" (${grid.id}): the settings say ${declared}, the CSS says ${measured}`);
    failed++;
  }
}

// The exclusions, with the reason.
console.log('\nThe excluded widgets (the content was rewritten on purpose):');
for (const item of EXCLUDED) console.log(`  - ${item.id}: ${item.reason}`);
console.log('  - (o botão de pausa do carrossel): uma adição da acessibilidade (SPEC-UI §2.6)');

if (failed > 0) {
  console.error(`\ncheck-parity: ${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\ncheck-parity: all the checks passed.');
