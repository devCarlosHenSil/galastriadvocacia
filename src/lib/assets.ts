/**
 * The paths of the assets.
 *
 * The site is published at the root of the domain, but `astro.config.mjs`
 * allows a `base` for a preview in a subpath; every asset goes through this
 * module so that the base is applied in a single place.
 */

/** The base of the site, always with a trailing slash. */
export const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/**
 * Prefix a public path with the base of the site.
 * @param {string} path a path that starts with `/`
 * @returns {string}
 */
export function asset(path: string): string {
  if (!path.startsWith('/')) return path;
  return `${base}${path.replace(/^\//, '')}`;
}
