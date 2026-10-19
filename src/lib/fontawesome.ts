/**
 * The inline SVG of the Font Awesome 5 icons and of the Elementor eicons.
 *
 * The paths are committed in `src/data/fontawesome-icons.json` (extracted from
 * the backup) so that the build never reads the WordPress backup.
 */
import icons from '../data/fontawesome-icons.json';

interface Icon {
  width: number;
  height: number;
  path: string;
}

const registry = icons as unknown as Record<string, Icon>;

/**
 * The SVG of an icon, in the markup of the Elementor.
 * @param {string} style `brands`, `regular`, `solid` or `eicon`
 * @param {string} name the name of the icon
 * @returns {{html: string, width: number, height: number} | null}
 */
export function icon(style: string, name: string) {
  const entry = registry[`${style}.${name}`];
  if (!entry) return null;
  const className =
    style === 'eicon'
      ? `e-font-icon-svg e-eicon-${name}`
      : `e-font-icon-svg e-f${style === 'brands' ? 'ab' : style === 'regular' ? 'ar' : 'as'}-${name}`;
  const html =
    `<svg aria-hidden="true" class="${className}" viewBox="0 0 ${entry.width} ${entry.height}" ` +
    `xmlns="http://www.w3.org/2000/svg"><path d="${entry.path}"></path></svg>`;
  return { html, path: entry.path, width: entry.width, height: entry.height };
}

/**
 * The icon of a Font Awesome class, e.g. `fab fa-instagram`.
 * @param {string} value the class of the icon
 * @returns {{html: string, path: string, width: number, height: number} | null}
 */
export function iconFromClass(value: string) {
  const parts = String(value ?? '').split(/\s+/).filter(Boolean);
  const raw = parts[parts.length - 1] ?? '';
  const name = raw.replace(/^fa-/, '');
  const prefix = parts[parts.length - 2] ?? '';
  if (prefix === 'fab') return icon('brands', name);
  if (prefix === 'far') return icon('regular', name);
  if (prefix === 'fas') return icon('solid', name);
  return null;
}
