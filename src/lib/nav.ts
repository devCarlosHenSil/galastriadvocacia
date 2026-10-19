/**
 * The navigation of the header and of the footer (`site.json → nav`).
 */
import { nav, type NavItem } from './site';

export type { NavItem };

export { nav };

/**
 * The item of the menu that matches the current route.
 *
 * `aria-current="page"` is only applied to a **real** route (the home and the
 * blog): the anchor links point to a section of the home and are not the
 * current page (SPEC-UI §2.1).
 * @param {string} pathname the path of the current page
 * @returns {NavItem | undefined}
 */
export function currentNavItem(pathname: string): NavItem | undefined {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return nav.find((item) => {
    if (item.kind !== 'page') return false;
    const href = item.href.replace(/\/+$/, '') || '/';
    return href === clean;
  });
}

/**
 * True when the item of the menu points to the current route.
 * @param {NavItem} item
 * @param {string} pathname
 * @returns {boolean}
 */
export function isCurrent(item: NavItem, pathname: string): boolean {
  return currentNavItem(pathname)?.href === item.href;
}
