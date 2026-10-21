/**
 * Builders of `src/data/site.json` and of the Markdown frontmatter.
 */
import { BLOG_POSTS, POLICY_PAGES, FORM, SEO_PAGES, POLICY_VERSION, VIGENCIA_ISO } from './authored.mjs';
import { rewriteUrls, SITE_ORIGIN } from './urls.mjs';

const PUBLIC_UPLOADS = '/wp-content/uploads/';

/**
 * @param {string} value
 * @returns {string} a YAML double quoted scalar
 */
export function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * @param {number} value
 * @returns {string}
 */
export function yamlNumber(value) {
  return String(value);
}

/**
 * @param {string[]} list
 * @returns {string} a YAML block sequence
 */
export function yamlList(list) {
  if (list.length === 0) return '[]';
  return `\n${list.map((item) => `  - ${yamlString(item)}`).join('\n')}`;
}

/**
 * @param {string} date the `YYYY-MM-DD` of a WordPress local date
 * @returns {string}
 */
export function toDateOnly(wpDate) {
  return String(wpDate).slice(0, 10);
}

/**
 * The navigation menu, built from the `nav_menu_item` posts.
 * @param {object} db the normalised database
 * @returns {Array<object>}
 */
export function buildNav(db) {
  const items = [...db.posts.values()]
    .filter((post) => post.type === 'nav_menu_item')
    .sort((a, b) => a.menuOrder - b.menuOrder || a.id - b.id);

  return items.map((item) => {
    const meta = db.postmeta.get(item.id) ?? new Map();
    const type = meta.get('_menu_item_type');
    const objectId = Number(meta.get('_menu_item_object_id'));

    if (type === 'custom') {
      const url = rewriteUrls(String(meta.get('_menu_item_url') ?? ''));
      return {
        label: item.title,
        href: url.startsWith('/') ? url : `/${url}`,
        menuOrder: item.menuOrder,
        wpId: item.id,
        kind: 'anchor',
      };
    }

    const target = db.posts.get(objectId);
    const isFrontPage = db.options.get('page_on_front') === String(objectId);
    const isBlogPage = db.options.get('page_for_posts') === String(objectId);
    return {
      label: item.title || target?.title || '',
      href: isFrontPage ? '/' : isBlogPage ? '/blog/' : `/${target?.name ?? ''}/`,
      menuOrder: item.menuOrder,
      wpId: item.id,
      kind: 'page',
    };
  });
}

/**
 * The categories and the tags, with the real post counts.
 * @param {object} db the normalised database
 * @returns {{ categories: Array<object>, tags: Array<object> }}
 */
export function buildTaxonomies(db) {
  const publishedPosts = new Set(
    [...db.posts.values()].filter((post) => post.type === 'post' && post.status === 'publish').map((post) => post.id),
  );

  const byTermTaxonomy = new Map();
  for (const rel of db.termRelationships) {
    if (!publishedPosts.has(rel.objectId)) continue;
    if (!byTermTaxonomy.has(rel.termTaxonomyId)) byTermTaxonomy.set(rel.termTaxonomyId, []);
    byTermTaxonomy.get(rel.termTaxonomyId).push(rel.objectId);
  }

  const categories = [];
  const tags = [];
  for (const tt of [...db.termTaxonomy.values()].sort((a, b) => a.termId - b.termId)) {
    const term = db.terms.get(tt.termId);
    if (!term) continue;
    const postCount = (byTermTaxonomy.get(tt.termTaxonomyId) ?? []).length;
    if (postCount === 0) continue;

    if (tt.taxonomy === 'category') {
      categories.push({
        slug: term.slug,
        name: term.name,
        wpTermId: term.termId,
        postCount,
        href: `/category/${term.slug}/`,
      });
    } else if (tt.taxonomy === 'post_tag') {
      tags.push({
        slug: term.slug,
        name: term.name,
        wpTermId: term.termId,
        postCount,
        href: null,
      });
    }
  }
  return { categories, tags };
}

/**
 * The tags of a post, in the order of `wp_term_relationships`.
 * @param {object} db
 * @param {number} postId
 * @returns {string[]}
 */
export function buildPostTags(db, postId) {
  const out = [];
  for (const rel of db.termRelationships) {
    if (rel.objectId !== postId) continue;
    const tt = db.termTaxonomy.get(rel.termTaxonomyId);
    if (!tt || tt.taxonomy !== 'post_tag') continue;
    const term = db.terms.get(tt.termId);
    if (term) out.push(term.slug);
  }
  return out;
}

/**
 * The category of a post.
 * @param {object} db
 * @param {number} postId
 * @returns {{slug: string, name: string} | null}
 */
export function buildPostCategory(db, postId) {
  for (const rel of db.termRelationships) {
    if (rel.objectId !== postId) continue;
    const tt = db.termTaxonomy.get(rel.termTaxonomyId);
    if (!tt || tt.taxonomy !== 'category') continue;
    const term = db.terms.get(tt.termId);
    if (term) return { slug: term.slug, name: term.name };
  }
  return null;
}

/**
 * @param {string} digits a Brazilian phone number, digits only
 * @returns {string} the `(11) 99999-9999` format
 */
export function formatBrlPhone(digits) {
  const d = String(digits).replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('0')) {
    return `(${d.slice(1, 3)}) ${d.slice(3, 8)}-${d.slice(8)}`;
  }
  return d;
}

/**
 * The frontmatter of a blog post.
 * @param {object} data
 * @returns {string}
 */
export function buildPostFrontmatter(data) {
  const lines = [
    '---',
    `title: ${yamlString(data.title)}`,
    `description: ${yamlString(data.description)}`,
    `pubDate: ${data.pubDate}`,
    // The real date of the modification of the post (DATA-R-07): the dump has
    // `post_modified ≠ post_date` for the 6 posts.
    ...(data.updatedDate ? [`updatedDate: ${data.updatedDate}`] : []),
    `hero: ${yamlString(data.hero)}`,
    `heroAlt: ${yamlString(data.heroAlt)}`,
    `category: ${yamlString(data.category)}`,
    `categoryName: ${yamlString(data.categoryName)}`,
    `tags:${yamlList(data.tags)}`,
    `seoTitle: ${yamlString(data.seoTitle)}`,
    `seoDescription: ${yamlString(data.seoDescription)}`,
    `author: ${yamlString(data.author)}`,
    `authorSlug: ${yamlString(data.authorSlug)}`,
    `readingTime: ${yamlNumber(data.readingTime)}`,
    'comments: []',
    '---',
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * The frontmatter of a policy page.
 * @param {object} data
 * @returns {string}
 */
export function buildPolicyFrontmatter(data) {
  const lines = [
    '---',
    `title: ${yamlString(data.title)}`,
    `description: ${yamlString(data.description)}`,
    `updatedDate: ${data.updatedDate}`,
    'layout: "~/layouts/PolicyLayout.astro"',
    '---',
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * The `site.json` document.
 * @param {object} ctx
 * @returns {object}
 */
export function buildSiteJson(ctx) {
  const { db, kit, nav, categories, tags, heroFile, whatsapp, instagram, address, author, logo } = ctx;
  const mods = ctx.themeMods ?? {};

  const seoPerUrl = {};
  seoPerUrl['/'] = {
    title: db.postmeta.get(30)?.get('rank_math_title') ?? '',
    description: db.postmeta.get(30)?.get('rank_math_description') ?? '',
    status: 'approved',
  };
  for (const [url, page] of Object.entries(SEO_PAGES)) {
    seoPerUrl[url] = { ...page, status: 'draft' };
  }
  for (const post of BLOG_POSTS) {
    seoPerUrl[`/${post.slug}/`] = {
      title: post.seoTitle,
      description: post.seoDescription,
      status: 'draft',
    };
  }

  // REV-7 (E6): as **overrides** do SEO — um ficheiro escrito à mão
  // (`src/data/seo-overrides.json`, versionado) que é fundido por cima do
  // `perUrl` gerado. É o caminho que o editor usa para publicar um post
  // novo (o `site.json` é reescrito pela extração — um editor não pode
  // escrever nele).
  const overrides = ctx.seoOverrides ?? {};
  for (const [url, page] of Object.entries(overrides)) {
    seoPerUrl[url] = { ...(seoPerUrl[url] ?? {}), ...page };
  }

  return {
    site: {
      name: 'Galastri Advocacia',
      legalName: db.options.get('blogname'),
      description: String(db.options.get('blogdescription') ?? '').replace(/\s+/g, ' ').trim(),
      lang: 'pt-BR',
      // D91 — o `siteurl` do WordPress é o **apex** (o endereço de então);
      // o endereço canónico de hoje é o `www` (decisão do dono, 2026-10-20).
      // É o `site.url` que sai no canonical, no og:url, no JSON-LD e no
      // sitemap.
      url: SITE_ORIGIN,
      timezone: db.options.get('timezone_string'),
      email: FORM.emailTo,
      whatsapp,
      whatsappUrl: `https://wa.me/${whatsapp}`,
      phone: formatBrlPhone(whatsapp),
      address,
      socials: { instagram, whatsapp: `https://wa.me/${whatsapp}` },
      formats: { date: db.options.get('date_format'), time: db.options.get('time_format') },
      logo,
      author,
    },
    nav,
    categories,
    tags,
    // C11 — a versão vigente das políticas: o consentimento regista-a (a
    // Política de Cookies §8 promete registar a versão).
    policy: {
      version: POLICY_VERSION,
      vigencia: VIGENCIA_ISO,
    },
    theme: {
      colors: {
        accent: kit.colors.get('accent'),
        primary: kit.colors.get('primary'),
        secondary: kit.colors.get('secondary'),
        text: kit.colors.get('text'),
        container: kit.colors.get('6809653'),
        success: kit.colors.get('e95ff82'),
        danger: kit.colors.get('aa84f74'),
        info: kit.colors.get('4af8520'),
        white: kit.colors.get('9b3e70b'),
        link: mods.link_color,
      },
      fonts: {
        heading: { family: 'Questrial', weight: 600, size: '47px' },
        headingSecondary: { family: 'Questrial', weight: 600, size: '19px' },
        body: { family: 'Nunito', weight: 500, size: '15px', lineHeight: 1.6 },
      },
      fontDisplay: db.options.get('elementor_font_display'),
      googleFonts: db.options.get('elementor_google_font') === '1',
      containerWidth: '1200px',
      radius: '0px',
      preloader: false,
    },
    form: FORM,
    seo: {
      default: {
        titleTemplate: '%s | Galastri Advocacia',
        titleSuffix: '| Galastri Advocacia',
        description: db.postmeta.get(30)?.get('rank_math_description') ?? '',
        ogImage: `${PUBLIC_UPLOADS}${heroFile}`,
        twitterCard: 'summary_large_image',
        locale: 'pt_BR',
        robots: 'index, follow, max-image-preview:large',
      },
      perUrl: seoPerUrl,
      organization: {
        '@type': 'LegalService',
        name: 'Galastri Advocacia',
        url: SITE_ORIGIN,
        telephone: `+55-11-98566-5992`,
        email: FORM.emailTo,
        address: {
          '@type': 'PostalAddress',
          streetAddress: address.street,
          addressLocality: address.city,
          addressRegion: address.state,
          addressCountry: address.country,
        },
        sameAs: [instagram],
      },
    },
    routes: {
      home: '/',
      blogIndex: '/blog/',
      blogPost: '/<slug>/',
      blogCategory: '/category/<slug>/',
      blogTag: null,
      policy: '/<slug>/',
      links: '/links/',
      notFound: '/404',
    },
  };
}
