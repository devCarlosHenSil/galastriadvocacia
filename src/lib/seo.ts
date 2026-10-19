/**
 * The SEO of the pages (SPEC-DATA §3.4.6, R20).
 *
 * `site.json → seo.perUrl` is the single source of truth of the `<title>` and
 * of the `<meta name="description">`. The routes that are not listed there
 * fall back to the default of `seo.default`.
 */
import { seo, site } from './site';
export interface SeoMeta {
  title: string;
  description: string;
  /** empty when the page must not declare a canonical (the 404) */
  canonical: string;
  ogImage: string;
  twitterCard: string;
  locale: string;
  robots: string;
}

/**
 * The canonical URL of a path.
 * @param {string} path the path of the page, with its trailing slash
 * @returns {string}
 */
export function canonicalUrl(path: string): string {
  const clean = path === '/' ? '/' : path.replace(/\/+$/, '/');
  return `${site.url}${clean}`;
}

/**
 * The SEO of a route.
 * @param {string} path the path of the page, with its trailing slash
 * @returns {SeoMeta}
 */
export function seoFor(path: string): SeoMeta {
  const key = path === '/' ? '/' : path.replace(/\/+$/, '/');
  const perUrl = seo.perUrl[key];
  const fallback = seo.default;
  return {
    title: perUrl?.title ?? fallback.titleTemplate?.replace('%s', site.name) ?? site.name,
    description: perUrl?.description ?? fallback.description,
    // A `canonical: null` in `perUrl` removes the canonical link (the 404 is a
    // soft-404 without `index` — it must not declare itself as canonical).
    canonical:
      perUrl && 'canonical' in perUrl && perUrl.canonical === null
        ? ''
        : canonicalUrl(key),
    ogImage: `${site.url}${fallback.ogImage}`,
    twitterCard: fallback.twitterCard ?? 'summary_large_image',
    locale: fallback.locale ?? 'pt_BR',
    robots: perUrl?.robots ?? fallback.robots ?? 'index, follow, max-image-preview:large',
  };
}

/**
 * The JSON-LD `@graph` of a page.
 * @param {object} ctx
 * @param {string} ctx.path
 * @param {SeoMeta} ctx.meta
 * @param {object} [ctx.blogPosting] the extra fields of a `BlogPosting`
 * @param {boolean} [ctx.webPage] true for the pages that are not the home
 * @returns {object}
 */
export function jsonLd(ctx: {
  path: string;
  meta: SeoMeta;
  blogPosting?: Record<string, any>;
  webPage?: boolean;
  /** the date of vigência of the document (C8) */
  dateModified?: string;
}): Record<string, any> {
  const organization = seo.organization;
  const graph: Record<string, any>[] = [
    {
      '@type': 'Organization',
      '@id': `${site.url}/#organization`,
      name: site.name,
      legalName: site.legalName,
      url: site.url,
      email: site.email,
      telephone: organization.telephone,
      address: organization.address,
      sameAs: organization.sameAs,
    },
    {
      '@type': 'LegalService',
      '@id': `${site.url}/#legalservice`,
      name: site.name,
      url: site.url,
      telephone: organization.telephone,
      email: site.email,
      address: organization.address,
      sameAs: organization.sameAs,
    },
    {
      '@type': 'WebSite',
      '@id': `${site.url}/#website`,
      url: site.url,
      name: site.name,
      description: site.description,
      inLanguage: site.lang,
      publisher: { '@id': `${site.url}/#organization` },
    },
  ];

  if (ctx.blogPosting) {
    graph.push({
      '@type': 'BlogPosting',
      '@id': `${ctx.meta.canonical}#blogposting`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': ctx.meta.canonical },
      headline: ctx.blogPosting.headline,
      description: ctx.blogPosting.description,
      image: ctx.blogPosting.image,
      datePublished: ctx.blogPosting.datePublished,
      dateModified: ctx.blogPosting.dateModified ?? ctx.blogPosting.datePublished,
      author: { '@type': 'Person', name: ctx.blogPosting.author },
      publisher: { '@id': `${site.url}/#organization` },
    });
  } else if (ctx.webPage) {
    graph.push({
      '@type': 'WebPage',
      '@id': `${ctx.meta.canonical}#webpage`,
      url: ctx.meta.canonical,
      name: ctx.meta.title,
      description: ctx.meta.description,
      inLanguage: site.lang,
      // C8 — as políticas declaram a data de vigência no JSON-LD (a mesma
      // do frontmatter e do corpo do documento).
      ...(ctx.dateModified ? { dateModified: ctx.dateModified } : {}),
      isPartOf: { '@id': `${site.url}/#website` },
      about: { '@id': `${site.url}/#legalservice` },
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
