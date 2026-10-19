#!/usr/bin/env node
/**
 * The golden fixtures of the dynamic widgets (R2, U25).
 *
 * The `_elementor_element_cache` replaces the dynamic widgets by a placeholder
 * (`[elementor-element k="…" data="<base64>"]`), so the navigation menu, the
 * logo of the header and the grid of the blog are **never** compared with the
 * original. These two fixtures pin the markup that the original would have
 * rendered, built from the settings of the Elementor.
 *
 *   node scripts/update-parity-fixtures.mjs [--dist <dist dir>]
 *
 * Run it when the content of the menu or of the grid changes, and commit the
 * result.
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
const FIXTURES = join(PROJECT_ROOT, 'tests', 'fixtures');
const home = readFileSync(join(DIST, 'index.html'), 'utf8');

/**
 * The markup of the element with the id, in the page.
 * @param {string} html
 * @param {string} id
 * @returns {string}
 */
function element(html, id) {
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
 * The markup of the navigation menu: the desktop `<nav>`, the toggle and the
 * dropdown panel.
 *
 * The panel is found by its **exact** opening (`elementor-nav-menu--dropdown
 * elementor-nav-menu__container`) — the class `elementor-nav-menu--dropdown-mobile`
 * of the wrapper would stop the slice at the desktop `</nav>` (C17).
 *
 * @param {string} html
 * @returns {string}
 */
function navMenu(html) {
  const at = html.indexOf('class="elementor-nav-menu--main');
  if (at < 0) throw new Error('the navigation menu was not found in the page');
  const start = html.lastIndexOf('<nav', at);
  const dropdownAt = html.indexOf('class="elementor-nav-menu--dropdown elementor-nav-menu__container"');
  if (dropdownAt < 0) throw new Error('the dropdown panel of the menu was not found');
  const dropdownStart = html.lastIndexOf('<nav', dropdownAt);
  const end = html.indexOf('</nav>', dropdownStart) + 6;
  return html
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
}

/**
 * The markup of the grid of the blog.
 * @param {string} html
 * @returns {string}
 */
function upkGrid(html) {
  return element(html, '290d6a8')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
}

const fixtures = {
  'nav-menu.html': navMenu(home),
  'upk-grid.html': upkGrid(home),
};

for (const [name, content] of Object.entries(fixtures)) {
  writeFileSync(join(FIXTURES, name), `${content}\n`, 'utf8');
  console.log(`wrote tests/fixtures/${name} (${content.length} chars)`);
}
