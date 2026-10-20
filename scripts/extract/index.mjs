/**
 * The extraction pipeline (SPEC-DATA §5).
 *
 *   node scripts/extract/index.mjs --sql <dump.sql> --uploads <uploads dir> --out <project root>
 *
 * It reads the WordPress dump, writes the extracted data into the project and
 * runs the whole assertion suite of SPEC-DATA §6.1…§6.7.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDatabase, readOption } from './lib/wordpress.mjs';
import { phpUnserialize } from './lib/php.mjs';
import { buildKit, normalizeTree, ANCHOR_IDS } from './lib/elementor.mjs';
import { convertGutenberg, countWords, firstParagraphText } from './lib/gutenberg.mjs';
import { buildAssets, listPublicUploads } from './lib/assets.mjs';
import { collectUploadPaths, rewriteUrls } from './lib/urls.mjs';
import {
  buildNav, buildTaxonomies, buildPostTags, buildPostCategory,
  buildPostFrontmatter, buildPolicyFrontmatter, buildSiteJson, toDateOnly,
} from './lib/site.mjs';
import { BLOG_POSTS, POLICY_PAGES, POLICY_OVERLAYS, VIGENCIA, POLICY_VERSION } from './lib/authored.mjs';
import { applyOverlay } from './lib/overlay.mjs';
import { findForbiddenInContent } from './lib/sanitize.mjs';
import { assertWritable, isInside } from './lib/allowlist.mjs';
import { FORBIDDEN_PATTERNS, findDigestedValues } from '../lib/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..', '..');

const DEFAULTS = {
  // REV-15 (E12): o dump é resolvido por **glob** (`*_backup_db/*.sql`, o mais
  // novo por mtime) — o id do export **não** está escrito no código (o
  // repositório é público) e um export novo não quebra o comando.
  sql: '**/*_backup_db/*.sql',
  uploads: '../uploads',
  out: '.',
};

/**
 * The dump of the backup: o `*.sql` mais recente debaixo do directório do
 * backup (o `..` do repositório, por omissão).
 *
 * @param {string} pattern
 * @param {string} base
 * @returns {string | null}
 */
function findDump(pattern, base) {
  const matches = [];
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (entry.name.endsWith('.sql')) {
        try {
          matches.push({ file: full, mtime: statSync(full).mtimeMs });
        } catch {
          /* the file vanished */
        }
      }
    }
  };
  walk(base, 0);
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.mtime - a.mtime);
  return matches[0].file;
}

/** The seven Elementor documents that are emitted. */
const ELEMENTOR_DOCS = [
  { postId: 30, file: 'home-30.json' },
  { postId: 49, file: 'header-49.json' },
  { postId: 48, file: 'footer-48.json' },
  { postId: 843, file: 'links-843.json' },
  { postId: 516, file: 'blog-archive-516.json' },
  { postId: 525, file: 'post-single-525.json' },
  { postId: 790, file: 'error-404-790.json' },
];

/** The measured constants of the dump (SPEC-DATA §6.1). */
const EXPECTED = {
  counts: {
    wp_posts: 766, wp_postmeta: 5112, wp_options: 741, wp_terms: 84,
    wp_term_taxonomy: 84, wp_term_relationships: 132, wp_comments: 48,
    wp_commentmeta: 231, wp_users: 2,
  },
  metaKeys: {
    _elementor_data: 605,
    _elementor_element_cache: 5,
    _elementor_conditions: 116,
  },
  postTypes: {
    elementor_library: 20, attachment: 58, nav_menu_item: 7, revision: 662,
  },
  postStatuses: { 'auto-draft': 1 },
  /** measured: `_elementor_data` on `post_type='revision'` */
  elementorDataOnRevisions: 578,
  /** measured: `_elementor_data` on published posts */
  elementorDataOnPublished: 27,
  publishedPosts: [272, 610, 714, 723, 733, 739],
  publishedPages: [3, 30, 83, 85, 464, 843],
  categoryTermTaxonomyIds: [19, 36, 67],
  tagCount: 57,
  // measured: 6 posts x 10 tags = 60 (the spec said 66 - the errata of DATA-R-13)
  tagRelations: 60,
  categoryRelations: 6,
  blogFiles: 6,
  policyFiles: 3,
  assetFiles: 97,
  assetBytes: 10149570,
  assetCssFiles: 39,
  assetFontFiles: 16,
  navItems: 7,
  seoPerUrl: 16,
  redirects: 1,
  formFields: 4,
  /** measured: the number of elements of the `_elementor_data` of post 30 */
  homeElementCount: 63,
  anchors: ANCHOR_IDS,
};

/** Collected assertion failures. */
const failures = [];
/** @type {string[]} */
const log = [];

/**
 * @param {string} message
 */
function fail(message) {
  failures.push(message);
}

/**
 * @param {any} actual
 * @param {any} expected
 * @param {string} label
 */
function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) fail(`${label}: expected ${b}, got ${a}`);
}

/**
 * @param {boolean} condition
 * @param {string} message
 */
function assertTrue(condition, message) {
  if (!condition) fail(message);
}

/**
 * @param {string} file
 * @param {string} content
 */
async function writeOutput(outDir, file, content) {
  assertWritable(file);
  const target = join(outDir, ...file.split('/'));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}
/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    args[key] = value;
    i++;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(process.cwd(), args.out);
// REV-15 (E12): o dump é resolvido por glob — o id do export não está no
// código (o repositório é público) e um export novo não quebra o comando.
const sqlPath = args.sql.includes('*')
  ? findDump(args.sql, resolve(process.cwd(), '..'))
  : resolve(process.cwd(), args.sql);
const uploadsDir = resolve(process.cwd(), args.uploads);

// The sources have to live OUTSIDE the project: the guard exits immediately,
// before anything is read or written (DATA-R-01).
if (outDir === sqlPath || isInside(outDir, sqlPath)) {
  console.error('the SQL dump must live outside the project — aborting.');
  process.exit(1);
}
if (isInside(outDir, uploadsDir)) {
  console.error('the uploads directory must live outside the project — aborting.');
  process.exit(1);
}
if (!existsSync(sqlPath)) {
  console.error(`SQL dump not found: ${sqlPath}`);
  process.exit(1);
}
if (!existsSync(uploadsDir)) {
  console.error(`uploads directory not found: ${uploadsDir}`);
  process.exit(1);
}

const started = Date.now();
const db = await loadDatabase(sqlPath);
log.push(`dump read in ${Math.round((Date.now() - started) / 1000)}s`);

// ---------------------------------------------------------------------------
// §6.1 — counts
// ---------------------------------------------------------------------------
for (const [table, expected] of Object.entries(EXPECTED.counts)) {
  assertEqual(db.counts[table], expected, `count ${table}`);
}
for (const [key, expected] of Object.entries(EXPECTED.metaKeys)) {
  assertEqual(db.metaKeyCounts.get(key) ?? 0, expected, `count postmeta ${key}`);
}
for (const [type, expected] of Object.entries(EXPECTED.postTypes)) {
  assertEqual(db.postTypeCounts.get(type) ?? 0, expected, `count post_type ${type}`);
}
for (const [status, expected] of Object.entries(EXPECTED.postStatuses)) {
  assertEqual(db.postStatusCounts.get(status) ?? 0, expected, `count post_status ${status}`);
}

const publishedPosts = [...db.posts.values()].filter((p) => p.type === 'post').map((p) => p.id).sort((a, b) => a - b);
const publishedPages = [...db.posts.values()].filter((p) => p.type === 'page').map((p) => p.id).sort((a, b) => a - b);
assertEqual(publishedPosts, EXPECTED.publishedPosts, 'published posts');
assertEqual(publishedPages, EXPECTED.publishedPages, 'published pages');

// `_elementor_data` split — measured, the briefing number was 22 + 583.
let elementorDataOnRevisions = 0;
let elementorDataOnPublished = 0;
for (const [postId, meta] of db.postmeta) {
  if (!meta.has('_elementor_data')) continue;
  const post = db.posts.get(postId);
  if (post && post.status === 'publish') elementorDataOnPublished++;
  else elementorDataOnRevisions++;
}
assertEqual(elementorDataOnRevisions, EXPECTED.elementorDataOnRevisions, '_elementor_data on revisions');
assertEqual(elementorDataOnPublished, EXPECTED.elementorDataOnPublished, '_elementor_data on published posts');

// ---------------------------------------------------------------------------
// The Elementor kit
// ---------------------------------------------------------------------------
const kitRaw = db.postmeta.get(6)?.get('_elementor_page_settings');
const kit = buildKit(kitRaw ? phpUnserialize(kitRaw) : null);
assertEqual(kit.colors.get('accent'), '#B68C5A', 'kit accent colour');
assertEqual(kit.colors.get('primary'), '#2E2E2E', 'kit primary colour');
assertEqual(kit.colors.get('text'), '#7A7A7A', 'kit text colour');
assertEqual(kit.colors.get('6809653'), '#F3F3F3', 'kit container colour');
assertEqual(kit.typography.get('primary')?.family, 'Questrial', 'kit primary typography');
assertEqual(kit.typography.get('text')?.family, 'Nunito', 'kit body typography');

const siteLogoFile = phpUnserialize(kitRaw).site_logo;
const siteLogo = {
  url: rewriteUrls(siteLogoFile.url),
  alt: siteLogoFile.alt,
};

const report = {
  renamedCssIds: [],
  unresolvedGlobals: [],
  unresolvedDynamic: [],
  unknownWidgetTypes: [],
};
/** the repairs of the content that were really applied (DATA-R-08) */
const repairs = [];

const dynamic = { siteLogo, authorName: db.users.get(2)?.displayName ?? '' };

const attachmentSizes = new Map();
/** the attachments by id — the URL and the dimensions of an image come from
 * here, and not from the string of the URL (U8).
 *
 * The attachments have the status `inherit`, so they are not in `db.posts`:
 * they are recognised by the `_wp_attached_file` of their postmeta. */
const attachments = new Map();
for (const [postId, meta] of db.postmeta) {
  const file = meta.get('_wp_attached_file');
  if (!file) continue;
  const raw = meta.get('_wp_attachment_metadata');
  let size = { width: null, height: null };
  if (raw) {
    try {
      const data = phpUnserialize(raw);
      size = { width: data.width ?? null, height: data.height ?? null };
    } catch {
      /* the metadata is optional */
    }
  }
  attachmentSizes.set(file, size);
  attachments.set(postId, {
    file,
    width: size.width,
    height: size.height,
    alt: meta.get('_wp_attachment_image_alt') ?? '',
  });
}

// ---------------------------------------------------------------------------
// The seven Elementor documents
// ---------------------------------------------------------------------------
/** @type {Array<{file: string, meta: object, tree: Array<object>}>} */
const elementorDocs = [];
/** @type {string[]} every file written by the extraction */
const writtenFiles = [];
for (const doc of ELEMENTOR_DOCS) {
  const post = db.posts.get(doc.postId);
  const raw = db.postmeta.get(doc.postId)?.get('_elementor_data');
  if (!post || !raw) {
    fail(`missing _elementor_data for post ${doc.postId}`);
    continue;
  }
  const source = JSON.parse(raw);
  const normalized = normalizeTree(source, { kit, dynamic, report, postId: doc.postId, repairs, attachments });
  const meta = db.postmeta.get(doc.postId) ?? new Map();
  const cssIds = normalized.cssIds.filter((id) => EXPECTED.anchors.includes(id));
  const document = {
    meta: {
      sourcePostId: doc.postId,
      postType: post.type,
      postName: post.name,
      elementorTemplateType: meta.get('_elementor_template_type') ?? '',
      title: post.title,
      elementCount: normalized.elementCount,
      cssIds,
    },
    root: normalized.tree,
  };
  elementorDocs.push({ file: doc.file, meta: document.meta, tree: normalized.tree, document });
  const elementorFile = `src/data/elementor/${doc.file}`;
  await writeOutput(outDir, elementorFile, `${JSON.stringify(document, null, 2)}\n`);
  writtenFiles.push(elementorFile);

  // §6.2 — the emitted tree has the same number of nodes as the source
  const countSource = (nodes) => nodes.reduce((acc, n) => acc + 1 + countSource(n.elements ?? []), 0);
  assertEqual(normalized.elementCount, countSource(source), `element count of post ${doc.postId}`);
}
assertEqual(elementorDocs.length, 7, 'number of Elementor documents');
assertEqual(elementorDocs[0].meta.elementCount, EXPECTED.homeElementCount, 'elementCount of post 30');
for (const anchor of EXPECTED.anchors) {
  assertTrue(elementorDocs[0].meta.cssIds.includes(anchor), `anchor ${anchor} missing from home-30.json`);
}
assertEqual(report.unknownWidgetTypes.length, 0, 'unknown widget types');

// ---------------------------------------------------------------------------
// The blog posts
// ---------------------------------------------------------------------------
const author = db.users.get(2);
const authorSlug = 'ana-paula-galastri';
const contentReferences = [];

for (const spec of BLOG_POSTS) {
  const post = db.posts.get(spec.id);
  if (!post) {
    fail(`post ${spec.id} not found`);
    continue;
  }
  const meta = db.postmeta.get(spec.id) ?? new Map();
  const converted = convertGutenberg(post.content, repairs);

  const thumbnailId = Number(meta.get('_thumbnail_id'));
  const attachment = db.postmeta.get(thumbnailId) ?? new Map();
  const attachedFile = attachment.get('_wp_attached_file') ?? '';
  const hero = attachedFile ? `/wp-content/uploads/${attachedFile}` : '';
  const heroAlt = attachment.get('_wp_attachment_image_alt') || post.title;

  const category = buildPostCategory(db, spec.id);
  const tags = buildPostTags(db, spec.id);
  const readingTime = Math.max(1, Math.ceil(countWords(converted.html) / 200));

  const frontmatter = buildPostFrontmatter({
    title: post.title,
    description: spec.description,
    pubDate: toDateOnly(post.date),
    updatedDate: toDateOnly(post.modified),
    hero,
    heroAlt,
    category: category?.slug ?? '',
    categoryName: category?.name ?? '',
    tags,
    seoTitle: spec.seoTitle,
    seoDescription: spec.seoDescription,
    author: author?.displayName ?? '',
    authorSlug,
    readingTime,
  });
  const file = `src/content/blog/${spec.slug}.md`;
  await writeOutput(outDir, file, `${frontmatter}\n${converted.html}\n`);
  writtenFiles.push(file);
  contentReferences.push({ file, kind: 'frontmatter.hero', paths: [hero.replace('/wp-content/uploads/', '')] });

  // §6.3 — the Gutenberg conversion
  assertTrue(!converted.html.includes('<!-- wp:'), `${file}: residual Gutenberg marker`);
  assertTrue(!/-->\s*<!--/.test(converted.html), `${file}: adjacent block markers`);
  assertTrue(!/<p>\s*<\/p>/i.test(converted.html), `${file}: empty paragraph`);
  assertTrue(!converted.html.includes('class="wp-block-'), `${file}: residual wp-block class`);
  assertTrue(!/\sstyle="/.test(converted.html), `${file}: residual inline style`);
  const paragraphCount = (converted.html.match(/<p(?:\s[^>]*)?>/gi) ?? []).length;
  assertEqual(paragraphCount, converted.textParagraphs, `${file}: paragraph count`);
  assertTrue(tags.length > 0, `${file}: no tags`);
  assertTrue(Boolean(category), `${file}: no category`);

  spec.derived = {
    description: firstParagraphText(post.content),
    readingTime,
    wordCount: countWords(converted.html),
  };
}

// ---------------------------------------------------------------------------
// The policy pages
// ---------------------------------------------------------------------------
/** @type {Array<{file: string, applied: Array<{kind: string, detail?: string}>}>} */
const policyOverlays = [];
for (const spec of POLICY_PAGES) {
  const post = db.posts.get(spec.id);
  if (!post) {
    fail(`policy post ${spec.id} not found`);
    continue;
  }
  const converted = convertGutenberg(post.content, repairs);
  // The overlay of the LGPD (SPEC-SECURITY §5.2/§5.3/§5.4).
  const overlay = POLICY_OVERLAYS[spec.slug];
  const body = overlay
    ? applyOverlay(converted.html, overlay, VIGENCIA)
    : { html: converted.html, applied: [], missing: [] };
  const frontmatter = buildPolicyFrontmatter({
    title: spec.title,
    description: spec.description,
    updatedDate: spec.updatedDate,
  });
  const file = `src/pages/${spec.slug}.md`;
  // C19m — o ficheiro termina com **uma** linha em branco (o overlay
  // acrescenta o `\n` do fim do texto).
  await writeOutput(outDir, file, `${frontmatter}\n${body.html.trimEnd()}\n`);
  writtenFiles.push(file);
  contentReferences.push({ file, kind: 'policy.body', paths: collectUploadPaths(body.html) });
  policyOverlays.push({ file, applied: body.applied });

  assertTrue(!body.html.includes('<!-- wp:'), `${file}: residual Gutenberg marker`);
  assertTrue(!/-->\s*<!--/.test(body.html), `${file}: adjacent block markers`);
  assertTrue(!/<p>\s*<\/p>/i.test(body.html), `${file}: empty paragraph`);
  assertTrue(!body.html.includes('class="wp-block-'), `${file}: residual wp-block class`);
  assertTrue(!/\sstyle="/.test(body.html), `${file}: residual inline style`);
  // The overlay has to be applied — a policy without it would publish the
  // text of 2024 (SEC-R-05).
  assertTrue(body.applied.length > 0, `${file}: the LGPD overlay was not applied`);
  assertTrue(body.html.includes('Data de Vigência:'), `${file}: the date of vigência is missing`);
  // U19 — o contorno do documento: só `h2` (o `h1` é o título da página).
  assertTrue(!/<h[3-6]\b/i.test(body.html), `${file}: the outline still has a heading of level 3 or deeper`);

  // C13 — a aplicação do overlay é ESTRITA: cada `replacement` e cada
  // `section` autoral tem de ter sido aplicada. Uma divergência literal no
  // texto do dump faria publicar o texto original sem correção — e o build
  // dizer "All assertions passed".
  assertTrue(
    body.missing.length === 0,
    `${file}: the overlay did not match the original text — ${body.missing.join(', ')}`,
  );

  // C8.3 — a vigência: o frontmatter e o corpo dizem a MESMA data.
  const bodyVigencia = /Data de Vigência:\s*(\d{2}\/\d{2}\/\d{4})/.exec(body.html)?.[1];
  const [day, month, year] = (bodyVigencia ?? '').split('/');
  const iso = `${year}-${month}-${day}`;
  assertEqual(spec.updatedDate, iso, `${file}: the date of vigência of the frontmatter and of the body`);

  // C8.3 — a numeração das secções é sequencial e ÚNICA.
  const numbers = [...body.html.matchAll(/(^|\n|<h2>)(\d+)\.\s*(?=<strong>)/g)].map((match) => Number(match[2]));
  assertTrue(numbers.length > 0, `${file}: no numbered section was found`);
  const unique = new Set(numbers);
  assertTrue(
    unique.size === numbers.length,
    `${file}: the section numbering is not unique — ${numbers.join(', ')}`,
  );
  assertTrue(
    numbers.every((number, index) => number === index + 1),
    `${file}: the section numbering is not sequential — ${numbers.join(', ')}`,
  );
}

// ---------------------------------------------------------------------------
// site.json
// ---------------------------------------------------------------------------
const nav = buildNav(db);
const { categories, tags } = buildTaxonomies(db);
assertEqual(nav.length, EXPECTED.navItems, 'nav items');
assertEqual(nav.map((item) => item.menuOrder), [1, 2, 3, 4, 5, 6, 7], 'nav menu order');
assertEqual(categories.length, 3, 'categories');
assertEqual(categories.map((c) => c.wpTermId), EXPECTED.categoryTermTaxonomyIds, 'category term ids');
assertEqual(tags.length, EXPECTED.tagCount, 'tags');

const themeMods = readOption(db.options, 'theme_mods_kava') ?? {};
const socialLinks = collectSocialLinks(elementorDocs);
const mapsWidget = findWidget(elementorDocs[0].tree, 'c2265f5');
const address = {
  street: 'Avenida Henrique Brunini',
  city: 'Jundiaí',
  state: 'SP',
  country: 'BR',
  mapsQuery: mapsWidget?.settings?.address ?? 'Avenida Henrique Brunini Jundiaí',
};

// REV-7 (E6): as overrides do SEO (o ficheiro escrito à mão que o editor
// usa para publicar um post novo).
// As overrides são **escritas à mão** (ficheiro do editor): lêem-se da
// árvore de origem, não do directório de saída (que é temporário no check).
const seoOverridesPath = join(PROJECT_ROOT, 'src', 'data', 'seo-overrides.json');
let seoOverrides = {};
if (existsSync(seoOverridesPath)) {
  const parsed = JSON.parse(await readFile(seoOverridesPath, 'utf8'));
  seoOverrides = parsed?.overrides ?? {};
  assertTrue(
    typeof seoOverrides === 'object' && !Array.isArray(seoOverrides),
    'src/data/seo-overrides.json: the "overrides" has to be an object',
  );
}

const siteJson = buildSiteJson({
  db,
  kit,
  nav,
  categories,
  tags,
  themeMods,
  heroFile: '2024/12/galastri-advocacia-banner-destaque.png',
  whatsapp: socialLinks.whatsapp,
  instagram: socialLinks.instagram,
  address,
  author: { name: author?.displayName ?? '', slug: authorSlug, role: 'Dra.', bio: author?.bio ?? '' },
  logo: siteLogo,
  seoOverrides,
});
await writeOutput(outDir, 'src/data/site.json', `${JSON.stringify(siteJson, null, 2)}\n`);
writtenFiles.push('src/data/site.json');

// C11 — a versão das políticas é a mesma no `site.json` e no script do
// consentimento (que a regista).
assertEqual(siteJson.policy.version, POLICY_VERSION, 'the version of the policies');
assertTrue(
  (await readFile(resolve(process.cwd(), 'public', 'js', 'cookie-consent.js'), 'utf8')).includes(
    POLICY_VERSION,
  ),
  'public/js/cookie-consent.js does not carry the version of the policies',
);

// §6.1 / §6.7 — the SEO and the form
assertEqual(
  Object.keys(siteJson.seo.perUrl).length,
  EXPECTED.seoPerUrl + Object.keys(seoOverrides).length,
  'seo.perUrl entries',
);
assertEqual(siteJson.form.fields.length, EXPECTED.formFields, 'form fields');
assertEqual(siteJson.form.emailTo, 'contato@galastriadvocacia.com.br', 'form emailTo');
assertEqual(siteJson.site.email, 'contato@galastriadvocacia.com.br', 'site email');
assertEqual(siteJson.theme.preloader, false, 'theme preloader');
assertEqual(siteJson.routes.blogPost, '/<slug>/', 'routes.blogPost');
assertEqual(siteJson.routes.blogTag, null, 'routes.blogTag');
assertEqual(siteJson.theme.colors.accent, '#B68C5A', 'theme accent');
for (const post of BLOG_POSTS) {
  const perUrl = siteJson.seo.perUrl[`/${post.slug}/`];
  assertEqual(perUrl?.title, post.seoTitle, `perUrl title of ${post.slug}`);
  assertEqual(perUrl?.description, post.seoDescription, `perUrl description of ${post.slug}`);
  assertEqual(perUrl?.status, 'draft', `perUrl status of ${post.slug}`);
}
assertEqual(siteJson.seo.perUrl['/'].status, 'approved', 'perUrl status of /');
for (const item of nav) {
  assertTrue(
    ['/', '/blog/', '/#sobre', '/#areasdeatuacao', '/#servicos', '/#quemsou', '/#contato'].includes(item.href),
    `nav href not allowed: ${item.href}`,
  );
}

// ---------------------------------------------------------------------------
// redirects.json
// ---------------------------------------------------------------------------
await writeOutput(outDir, 'src/data/redirects.json', `${JSON.stringify({ '/home/': '/' }, null, 2)}\n`);
writtenFiles.push('src/data/redirects.json');
assertEqual(Object.keys({ '/home/': '/' }).length, EXPECTED.redirects, 'redirects');

// ---------------------------------------------------------------------------
// §6.7 — the coherence of the data (DATA-R-03)
// ---------------------------------------------------------------------------

// --- the taxonomy containment -----------------------------------------------
const categorySlugs = new Set(siteJson.categories.map((c) => c.slug));
const tagSlugs = new Set(siteJson.tags.map((t) => t.slug));
for (const post of BLOG_POSTS) {
  const frontmatter = await readFile(join(outDir, 'src', 'content', 'blog', `${post.slug}.md`), 'utf8');
  const category = /^category: "(.*)"$/m.exec(frontmatter)?.[1];
  const tags = [...frontmatter.matchAll(/^ {2}- "(.*)"$/gm)].map((m) => m[1]);
  assertTrue(categorySlugs.has(category), `${post.slug}: the category "${category}" is not in site.json`);
  for (const tag of tags) {
    assertTrue(tagSlugs.has(tag), `${post.slug}: the tag "${tag}" is not in site.json`);
  }
}

// --- the hero, the focus keyword, the reading time and the date -------------
for (const post of BLOG_POSTS) {
  const wp = db.posts.get(post.id);
  const meta = db.postmeta.get(post.id) ?? new Map();
  const attachment = db.postmeta.get(Number(meta.get('_thumbnail_id'))) ?? new Map();
  const expectedAlt = attachment.get('_wp_attachment_image_alt') || wp.title;
  const frontmatter = await readFile(join(outDir, 'src', 'content', 'blog', `${post.slug}.md`), 'utf8');
  assertEqual(/^heroAlt: "(.*)"$/m.exec(frontmatter)?.[1], expectedAlt, `${post.slug}: heroAlt`);
  const body = frontmatter.split('---\n').slice(2).join('\n');
  const expectedReading = Math.max(1, Math.ceil(countWords(body) / 200));
  assertEqual(Number(/^readingTime: (\d+)$/m.exec(frontmatter)?.[1]), expectedReading, `${post.slug}: readingTime`);
  // The date of the modification is the real one (DATA-R-07).
  assertEqual(
    /^updatedDate: (\d{4}-\d{2}-\d{2})$/m.exec(frontmatter)?.[1],
    toDateOnly(wp.modified),
    `${post.slug}: updatedDate`,
  );
}

// --- the routes of the SEO and of the redirects ------------------------------
const knownRoutes = new Set([
  '/',
  '/blog/',
  '/links/',
  '/404',
  ...BLOG_POSTS.map((p) => `/${p.slug}/`),
  ...POLICY_PAGES.map((p) => `/${p.slug}/`),
  ...siteJson.categories.map((c) => c.href),
]);
// REV-7 (E6): as rotas das **overrides** (o ficheiro que o editor escreve) são
// aceites quando existe um post com esse slug — é assim que um post novo
// entra no site sem mexer no `authored.mjs`.
for (const url of Object.keys(seoOverrides)) {
  const slug = url.replace(/^\/|\/$/g, '');
  const post = join(outDir, 'src', 'content', 'blog', `${slug}.md`);
  assertTrue(
    knownRoutes.has(url) || existsSync(post),
    `the override "${url}" does not correspond to a post (${slug}.md)`,
  );
}
for (const url of Object.keys(siteJson.seo.perUrl)) {
  assertTrue(
    knownRoutes.has(url) || Object.keys(seoOverrides).includes(url),
    `the perUrl "${url}" is not a known route`,
  );
}
for (const [from, to] of Object.entries({ '/home/': '/' })) {
  assertTrue(knownRoutes.has(to), `the redirect ${from} -> ${to} points to an unknown route`);
}
for (const [url, entry] of Object.entries(siteJson.seo.perUrl)) {
  if (url === '/') continue;
  assertEqual(entry.status, 'draft', `perUrl status of ${url} (only the home is approved)`);
}

// --- the form: the divergence with the dump is registered (DATA-R-04) -------
const formWidgetOfTheDump = findWidget(elementorDocs[0].tree, '3273196');
const dumpFields = (formWidgetOfTheDump?.settings?.form_fields ?? []).map((field) => ({
  customId: field.custom_id,
  type: field.field_type ?? 'text',
  required: field.required === 'true',
  placeholder: field.placeholder ?? '',
}));
assertEqual(dumpFields.length, siteJson.form.fields.length, 'the number of the fields of the form');
const TYPE_BY_CUSTOM_ID = {
  name: 'text',
  email: 'email',
  field_d252ca6: 'tel',
  message: 'textarea',
};
for (const [index, field] of siteJson.form.fields.entries()) {
  const source = dumpFields[index];
  assertEqual(
    field.type,
    TYPE_BY_CUSTOM_ID[source.customId] ?? field.type,
    `the type of the field ${field.name}`,
  );
  assertEqual(field.required, source.required, `the "required" of the field ${field.name}`);
  assertTrue(Boolean(field.placeholder), `the placeholder of the field ${field.name} is empty`);
}
// The names are authored (R5) — the divergence is registered in the report.
// C14: os **placeholders** também divergem (os publicados são mais claros que
// os do dump) — cada diferença é registada na tabela de divergência.
const formDivergence = {
  rule: 'R5 — the names of the fields are authored (nome, email, telefone, mensagem); the widget of the dump uses name, email, field_d252ca6, message',
  dump: dumpFields.map((f) => f.customId),
  emitted: siteJson.form.fields.map((f) => f.name),
  placeholders: siteJson.form.fields
    .map((field, index) => {
      const source = dumpFields[index];
      if (!source || source.placeholder === field.placeholder) return null;
      return {
        name: field.name,
        dump: source.placeholder ?? '',
        emitted: field.placeholder,
      };
    })
    .filter(Boolean),
};

// --- the CSS ids that were renamed (DATA-R-05) ------------------------------
for (const renamed of report.renamedCssIds) {
  assertTrue(
    renamed.from.startsWith('el-') || renamed.to.startsWith('el-'),
    `the cssId "${renamed.from}" was renamed without the fallback`,
  );
  assertTrue(!EXPECTED.anchors.includes(renamed.to), `the renamed cssId "${renamed.to}" is a reserved anchor`);
}

// --- the counts of the taxonomy (DATA-R-13) ---------------------------------
let tagRelations = 0;
let categoryRelations = 0;
const publishedPostIds = new Set(BLOG_POSTS.map((p) => p.id));
for (const rel of db.termRelationships) {
  if (!publishedPostIds.has(rel.objectId)) continue;
  const tt = db.termTaxonomy.get(rel.termTaxonomyId);
  if (!tt) continue;
  if (tt.taxonomy === 'post_tag') tagRelations++;
  if (tt.taxonomy === 'category') categoryRelations++;
}
assertEqual(tagRelations, EXPECTED.tagRelations, 'the relations of the tags');
assertEqual(categoryRelations, EXPECTED.categoryRelations, 'the relations of the categories');
assertEqual(BLOG_POSTS.length, EXPECTED.blogFiles, 'the number of the posts');
assertEqual(POLICY_PAGES.length, EXPECTED.policyFiles, 'the number of the policies');

// ---------------------------------------------------------------------------
// The parity fixtures (R2)
// ---------------------------------------------------------------------------
for (const postId of [30, 48, 49]) {
  const raw = db.postmeta.get(postId)?.get('_elementor_element_cache');
  if (!raw) {
    fail(`missing _elementor_element_cache for post ${postId}`);
    continue;
  }
  const cache = JSON.parse(raw);
  const file = `tests/fixtures/elementor-cache-${postId}.html`;
  await writeOutput(outDir, file, cache.value.content);
  writtenFiles.push(file);
}

// ---------------------------------------------------------------------------
// The assets
// ---------------------------------------------------------------------------

const references = [...contentReferences];
for (const doc of elementorDocs) {
  references.push({ file: `src/data/elementor/${doc.file}`, kind: 'elementor.settings', paths: collectUploadPaths(JSON.stringify(doc.tree)) });
}
references.push({ file: 'src/data/site.json', kind: 'site.ogImage', paths: collectUploadPaths(JSON.stringify(siteJson)) });

const manifest = await buildAssets({ uploadsDir, outDir, references, attachmentSizes });
await writeOutput(outDir, 'src/data/assets-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
writtenFiles.push('src/data/assets-manifest.json');
// os ficheiros copiados (o fecho de assets) tambem sao da extracao
for (const asset of manifest.assets) writtenFiles.push('public/wp-content/uploads/' + asset.src);

assertEqual(manifest.missing.length, 0, 'missing assets');
assertTrue(
  manifest.assets.every((asset) => !/-\d{2,4}x\d{2,4}\.(png|jpe?g|webp|gif)$/i.test(asset.src)),
  'the manifest contains a thumbnail',
);
const publicFiles = await listPublicUploads(outDir);
assertEqual(publicFiles.length, manifest.assets.length, 'public/wp-content/uploads file count');
assertEqual(
  publicFiles.filter((f) => manifest.assets.some((a) => a.src === f)).length,
  manifest.assets.length,
  'public/wp-content/uploads matches the manifest',
);

// ---------------------------------------------------------------------------
// §6.5 / §6.7 — the manifest, the Elementor tree, the HTML and the fonts
// (DATA-R-03)
// ---------------------------------------------------------------------------

// --- the counters of the manifest -------------------------------------------
assertEqual(manifest.meta.totalFiles, EXPECTED.assetFiles, 'the number of the files of the manifest');
assertEqual(manifest.meta.totalBytes, EXPECTED.assetBytes, 'the number of the bytes of the manifest');
assertEqual(manifest.meta.cssFiles, EXPECTED.assetCssFiles, 'the number of the CSS files of the manifest');
assertEqual(manifest.meta.fontFiles, EXPECTED.assetFontFiles, 'the number of the font files of the manifest');
assertEqual(
  manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0),
  manifest.meta.totalBytes,
  'the sum of the bytes of the assets',
);
assertEqual(
  new Set(manifest.assets.map((asset) => asset.src)).size,
  manifest.assets.length,
  'the "src" of the assets is unique',
);
assertTrue(manifest.missing.length === 0, 'there are missing assets in the manifest');
assertTrue(
  manifest.assets.every((asset) => !/-\d{2,4}x\d{2,4}\.(png|jpe?g|webp|gif)$/i.test(asset.src)),
  'the manifest contains a thumbnail',
);

// --- the Elementor: the set of the ids, the uniqueness of the cssIds --------
/**
 * @param {Array<object>} nodes
 * @returns {string[]}
 */
function collectIds(nodes) {
  const out = [];
  for (const node of nodes) {
    out.push(node.id);
    out.push(...collectIds(node.elements ?? []));
  }
  return out;
}

/**
 * @param {Array<object>} nodes
 * @returns {string[]}
 */
function collectCssIds(nodes) {
  const out = [];
  for (const node of nodes) {
    out.push(node.cssId);
    out.push(...collectCssIds(node.elements ?? []));
  }
  return out;
}

for (const doc of elementorDocs) {
  const source = JSON.parse(db.postmeta.get(doc.meta.sourcePostId).get('_elementor_data'));
  const sourceIds = collectIds(source).sort();
  const emittedIds = collectIds(doc.tree).sort();
  assertEqual(emittedIds, sourceIds, `the set of the ids of ${doc.file}`);
  const cssIds = collectCssIds(doc.tree);
  assertEqual(new Set(cssIds).size, cssIds.length, `the cssIds of ${doc.file} are not unique`);
  const serialised = JSON.stringify(doc.tree);
  assertTrue(!serialised.includes('__globals__'), `${doc.file}: residual __globals__`);
  assertTrue(!serialised.includes('__dynamic__'), `${doc.file}: residual __dynamic__`);
  assertTrue(!serialised.includes('_element_id'), `${doc.file}: residual _element_id`);
}

// --- the HTML of the bodies is balanced --------------------------------------
/**
 * @param {string} html
 * @returns {boolean}
 */
function isBalanced(html) {
  const tags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'div', 'table', 'tr', 'td', 'th', 'tbody', 'thead', 'figure', 'figcaption', 'code', 'strong', 'em', 'a', 'span', 'button', 'input'];
  for (const tag of tags) {
    const open = (html.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi')) ?? []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length;
    // `<input>` and `<br>` have no closing tag.
    if (tag === 'input') continue;
    if (open !== close) return false;
  }
  return true;
}

for (const file of writtenFiles.filter((f) => f.endsWith('.md'))) {
  const content = await readFile(join(outDir, ...file.split('/')), 'utf8');
  const body = content.split('---\n').slice(2).join('\n');
  assertTrue(isBalanced(body), `${file}: the HTML is not balanced`);
  assertTrue(!content.includes('<!-- wp:'), `${file}: residual Gutenberg marker`);
}

// --- the emitted files: no timestamp, no absolute path, no host ------------
for (const file of writtenFiles) {
  // Os ficheiros **binários** (as fontes) não têm texto: os asserts abaixo
  // só valem para os ficheiros de texto.
  if (!/\.(md|json|css|js|mjs|ts|astro|txt|xml|html)$/i.test(file)) continue;
  const content = await readFile(join(outDir, ...file.split('/')), 'utf8');
  assertTrue(
    !/\d{4}-\d{2}-\d{2}T\d{2}:/.test(content),
    `${file}: a timestamp leaked into the output`,
  );
  // C19j — o caminho absoluto do Windows (`<USER>\…`): o regex precisa de
  // uma barra invertida (duas no código, uma no texto).
  assertTrue(!/[A-Za-z]:\\/.test(content), `${file}: an absolute Windows path leaked into the output`);
  // The fixtures are the verbatim oracle of the original rendering (R2): they
  // keep the URLs of the old WordPress on purpose.
  if (!file.startsWith('tests/fixtures/')) {
    assertTrue(
      !content.includes('galastriadvocacia.com.br/wp-content'),
      `${file}: the absolute URL of the old WordPress leaked into the output`,
    );
    // U17 — o alias `/home/` perde o fragmento: nenhum link pode apontar
    // para ele (o `redirects.json` é a exceção: é a origem do 301).
    if (file !== 'src/data/redirects.json') {
      assertTrue(!content.includes('/home/'), `${file}: a link to the alias /home/ survived`);
    }
  }
  // `http://` is only allowed in an `xmlns` attribute (the SVG namespace).
  const withoutXmlns = content.replace(/xmlns(:\w+)?="[^"]*"/g, '');
  assertTrue(!withoutXmlns.includes('http://'), `${file}: a plain http:// URL leaked into the output`);
  // C20 — o placeholder do endpoint do formulário não pode sobreviver: o
  // endpoint vem da variável de ambiente `PUBLIC_CONTACT_ENDPOINT`.
  assertTrue(!content.includes('FORM_ID'), `${file}: the dead placeholder FORM_ID survived`);
}

// --- C6 / SEC-R-28: o conteúdo emitido é sanitizado -------------------------
// O HTML do site chega à página por `set:html` (os widgets `html` e `editor`,
// os posts e as políticas): nenhum script, nenhum handler e nenhum
// `javascript:` pode sobreviver à extração.
for (const file of writtenFiles.filter((f) => f.endsWith('.md') || f.endsWith('.json'))) {
  if (file.startsWith('tests/fixtures/')) continue;
  const content = await readFile(join(outDir, ...file.split('/')), 'utf8');
  const forbidden = findForbiddenInContent(content);
  assertTrue(
    forbidden.length === 0,
    `${file}: forbidden content — ${forbidden.join(', ')} (the sanitiser did not run)`,
  );
  // C19k — os vestígios do Gutenberg não podem sobreviver em NENHUM ficheiro
  // emitido (nem nos `.json` do Elementor).
  assertTrue(!content.includes('<!-- wp:'), `${file}: residual Gutenberg marker`);
  assertTrue(!content.includes('class="wp-block-'), `${file}: residual wp-block class`);
  assertTrue(!/\sstyle="/.test(content), `${file}: residual inline style`);
}

// ---------------------------------------------------------------------------
// §6.6 — secrets and PII
//
// The re-scan covers the written files **and** the copied assets (DATA-R-02):
// a secret could be hiding in a CSS or in an image of the closure.
// ---------------------------------------------------------------------------
for (const file of writtenFiles) {
  const content = await readFile(join(outDir, ...file.split('/')), 'utf8');
  for (const entry of FORBIDDEN_PATTERNS) {
    if (entry.exempt?.some((prefix) => file.startsWith(prefix))) continue;
    assertTrue(!entry.pattern.test(content), `${file}: forbidden pattern — ${entry.label}`);
  }
  for (const value of findDigestedValues(content)) {
    fail(`${file}: live value of the backup (sha256) — ${value.slice(0, 8)}…`);
  }
}
for (const asset of manifest.assets) {
  if (!/\.(css|js|json|txt|html|md|xml)$/i.test(asset.src)) continue;
  const content = await readFile(join(outDir, 'public', 'wp-content', 'uploads', ...asset.src.split('/')), 'utf8');
  for (const entry of FORBIDDEN_PATTERNS) {
    assertTrue(!entry.pattern.test(content), `public/wp-content/uploads/${asset.src}: forbidden pattern — ${entry.label}`);
  }
  for (const value of findDigestedValues(content)) {
    fail(`public/wp-content/uploads/${asset.src}: live value of the backup (sha256) — ${value.slice(0, 8)}…`);
  }
}

// ---------------------------------------------------------------------------
// The audit report (never committed — `docs/audit/` is gitignored)
// ---------------------------------------------------------------------------
const comments = db.comments;
await writeOutput(
  outDir,
  'docs/audit/comentarios-retidos.md',
  [
    '# Comentários retidos (auditoria)',
    '',
    'Gerado por `scripts/extract/index.mjs`. **Não versionado** — apenas contagens, nunca conteúdo.',
    '',
    '```',
    `wp_comments: ${comments.total} linhas`,
    `  comment_approved='1' + comment_type='pingback' → ${comments.approvedPingback.length}   (IDs ${comments.approvedPingback.join(',')})`,
    `  comment_approved='spam' + comment_type='comment' → ${comments.spam.length}  (IDs ${comments.spam[0]}..${comments.spam.at(-1)})`,
    `  comment_approved='1'  + comment_type='comment'  → ${comments.approvedHuman.length}`,
    `wp_commentmeta: ${comments.commentmeta} linhas (akismet metadata) — órfãs, descartadas junto`,
    '```',
    '',
  ].join('\n'),
);

// ---------------------------------------------------------------------------
// The extract report
// ---------------------------------------------------------------------------
const formWidget = findWidget(elementorDocs[0].tree, '3273196');
const formFields = (formWidget?.settings?.form_fields ?? []).map((field) => ({
  customId: field.custom_id,
  type: field.field_type ?? 'text',
  required: field.required === 'true',
  placeholder: field.placeholder ?? '',
  label: field.field_label ?? '',
}));

const extractReport = {
  // REV-7 (E6): a lista dos ficheiros que a extracao escreveu — o check de
  // idempotencia compara so estes (os posts escritos a mao nao sao dela).
  writtenFiles: [...writtenFiles, 'docs/_reference/extract-report.json'],
  counts: {
    ...db.counts,
    elementorData: db.metaKeyCounts.get('_elementor_data') ?? 0,
    elementorDataOnPublished,
    elementorDataOnRevisions,
    elementorElementCache: db.metaKeyCounts.get('_elementor_element_cache') ?? 0,
    elementorConditions: db.metaKeyCounts.get('_elementor_conditions') ?? 0,
    elementorLibrary: db.postTypeCounts.get('elementor_library') ?? 0,
    attachment: db.postTypeCounts.get('attachment') ?? 0,
    navMenuItem: db.postTypeCounts.get('nav_menu_item') ?? 0,
    autoDraft: db.postStatusCounts.get('auto-draft') ?? 0,
    revision: db.postTypeCounts.get('revision') ?? 0,
  },
  elementor: {
    homeElementCount: elementorDocs[0].meta.elementCount,
    documents: elementorDocs.map((doc) => ({ file: doc.file, ...doc.meta })),
  },
  formFields,
  formDivergence,
  comments: {
    total: comments.total,
    approvedPingback: comments.approvedPingback.length,
    approvedHuman: comments.approvedHuman.length,
    spam: comments.spam.length,
    commentMeta: comments.commentmeta,
  },
  posts: BLOG_POSTS.map((post) => ({
    id: post.id,
    slug: post.slug,
    ...post.derived,
  })),
  warnings: {
    renamedCssIds: report.renamedCssIds,
    unresolvedGlobals: report.unresolvedGlobals,
    unresolvedDynamic: report.unresolvedDynamic,
    unknownWidgetTypes: report.unknownWidgetTypes,
  },
  repairs: {
    applied: repairs.length,
    entries: repairs,
  },
  policies: policyOverlays,
  // C14 — `formFields` são os campos REAIS (o array) e `formDivergence` a
  // divergência (o objeto). Antes as duas chaves se sobrepunham e o array
  // perdia-se.
  formFields,
  formDivergence,
  assets: manifest.meta,
};
await writeOutput(outDir, 'docs/_reference/extract-report.json', `${JSON.stringify(extractReport, null, 2)}\n`);
writtenFiles.push('docs/_reference/extract-report.json');

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
log.push(`posts=${db.counts.wp_posts} postmeta=${db.counts.wp_postmeta} options=${db.counts.wp_options} terms=${db.counts.wp_terms} term_taxonomy=${db.counts.wp_term_taxonomy} term_relationships=${db.counts.wp_term_relationships} comments=${db.counts.wp_comments} commentmeta=${db.counts.wp_commentmeta} users=${db.counts.wp_users}`);
log.push(`_elementor_data=${db.metaKeyCounts.get('_elementor_data')} (${elementorDataOnPublished} published + ${elementorDataOnRevisions} revisions)`);
log.push(`_elementor_element_cache=${db.metaKeyCounts.get('_elementor_element_cache')} _elementor_conditions=${db.metaKeyCounts.get('_elementor_conditions')}`);
log.push(`elementor_library=${db.postTypeCounts.get('elementor_library')} attachment=${db.postTypeCounts.get('attachment')} nav_menu_item=${db.postTypeCounts.get('nav_menu_item')} auto-draft=${db.postStatusCounts.get('auto-draft')} revision=${db.postTypeCounts.get('revision')}`);
log.push(`home elementCount=${elementorDocs[0].meta.elementCount} anchors=${elementorDocs[0].meta.cssIds.join(',')}`);
log.push(`form fields=${formFields.length} (${formFields.map((f) => f.customId).join(', ')})`);
log.push(`assets=${manifest.meta.totalFiles} files, ${manifest.meta.totalBytes} bytes, css=${manifest.meta.cssFiles}, fonts=${manifest.meta.fontFiles}`);
log.push(`wrote ${writtenFiles.length} files`);

console.log(log.join('\n'));

if (failures.length > 0) {
  console.error(`\n${failures.length} assertion failure(s):`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log('\nAll assertions passed.');

/**
 * @param {Array<object>} tree
 * @param {string} id
 * @returns {object | null}
 */
function findWidget(tree, id) {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findWidget(node.elements ?? [], id);
    if (found) return found;
  }
  return null;
}

/**
 * @param {Array<object>} docs
 * @returns {{whatsapp: string, instagram: string}}
 */
function collectSocialLinks(docs) {
  let whatsapp = '5511985665992';
  let instagram = 'https://www.instagram.com/galastriadvocacia/';
  const visit = (nodes) => {
    for (const node of nodes) {
      for (const item of node.settings?.social_icon_list ?? []) {
        const url = String(item.link?.url ?? '');
        const wa = /wa\.me\/(\d+)/.exec(url);
        if (wa && url.includes('wa.me')) whatsapp = wa[1];
        if (url.includes('instagram.com') && !url.includes('instragram.com')) {
          instagram = `${url.replace(/#$/, '').replace(/\/?$/, '/')}`;
        }
      }
      visit(node.elements ?? []);
    }
  };
  for (const doc of docs) visit(doc.tree);
  return { whatsapp, instagram };
}
