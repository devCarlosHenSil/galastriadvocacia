/**
 * Normalisation of the WordPress tables we need.
 *
 * Everything here is an ALLOW-list: anything not explicitly listed is
 * discarded by construction, so a new secret stored in `wp_options` or
 * `wp_postmeta` can never reach the repository (SPEC-DATA §4.4).
 */
import { streamInserts } from './sql.mjs';
import { phpUnserialize } from './php.mjs';

/** SPEC-DATA §2.3 — the only `wp_options` keys that may reach `site.json`. */
export const OPTION_ALLOWLIST = Object.freeze([
  'siteurl',
  'home',
  'blogname',
  'blogdescription',
  'WPLANG',
  'timezone_string',
  'date_format',
  'time_format',
  'permalink_structure',
  'show_on_front',
  'page_on_front',
  'page_for_posts',
  'posts_per_page',
  'default_comment_status',
  'users_can_register',
  'blog_public',
  'elementor_css_print_method',
  'elementor_font_display',
  'elementor_google_font',
  'theme_mods_kava',
]);

/** SPEC-DATA §2.2 — the only `wp_postmeta` keys that may reach the output. */
export const POSTMETA_ALLOWLIST = Object.freeze([
  '_elementor_data',
  '_elementor_template_type',
  '_elementor_edit_mode',
  '_elementor_page_settings',
  '_elementor_element_cache',
  '_elementor_conditions',
  '_wp_page_template',
  '_thumbnail_id',
  '_wp_attached_file',
  '_wp_attachment_image_alt',
  '_wp_attachment_metadata',
  'rank_math_focus_keyword',
  'rank_math_title',
  'rank_math_description',
  'rank_math_canonical_url',
  'rank_math_robots',
  '_menu_item_type',
  '_menu_item_menu_item_parent',
  '_menu_item_object_id',
  '_menu_item_object',
  '_menu_item_target',
  '_menu_item_classes',
  '_menu_item_xfn',
  '_menu_item_url',
]);

/** Posts whose `post_status` is not publish are never migrated. */
const LIVE_POST_STATUS = 'publish';

/** `wp_posts` column order (verified against the dump's CREATE TABLE). */
const POST_COLUMNS = [
  'ID', 'post_author', 'post_date', 'post_date_gmt', 'post_content', 'post_title',
  'post_excerpt', 'post_status', 'comment_status', 'ping_status', 'post_password',
  'post_name', 'to_ping', 'pinged', 'post_modified', 'post_modified_gmt',
  'post_content_filtered', 'post_parent', 'guid', 'menu_order', 'post_type',
  'post_mime_type', 'comment_count',
];

/**
 * @param {string} sqlPath
 * @returns {Promise<object>} the normalised database
 */
export async function loadDatabase(sqlPath) {
  /** @type {Map<number, object>} */
  const posts = new Map();
  /** @type {Map<number, Map<string, string>>} */
  const postmeta = new Map();
  /** @type {Map<string, string>} */
  const options = new Map();
  /** @type {Map<number, {termId:number,name:string,slug:string}>} */
  const terms = new Map();
  /** @type {Map<number, {termId:number,taxonomy:string,count:number,parent:number}>} */
  const termTaxonomy = new Map();
  /** @type {Array<{objectId:number,termTaxonomyId:number}>} */
  const termRelationships = [];
  /** @type {Map<number, {displayName:string,slug:string,bio:string}>} */
  const users = new Map();
  /** @type {Map<number, {description:string}>} */
  const userMeta = new Map();
  /** @type {{total:number,approvedPingback:number[],approvedHuman:number[],spam:number[],commentmeta:number}} */
  const comments = { total: 0, approvedPingback: [], approvedHuman: [], spam: [], commentmeta: 0 };

  const counts = {
    wp_posts: 0, wp_postmeta: 0, wp_options: 0, wp_terms: 0, wp_term_taxonomy: 0,
    wp_term_relationships: 0, wp_comments: 0, wp_commentmeta: 0, wp_users: 0, wp_usermeta: 0,
  };
  const metaKeyCounts = new Map();
  const postTypeCounts = new Map();
  const postStatusCounts = new Map();

  for await (const { table, values } of streamInserts(sqlPath)) {
    switch (table) {
      case 'wp_posts': {
        counts.wp_posts++;
        const row = Object.fromEntries(POST_COLUMNS.map((c, idx) => [c, values[idx]]));
        postTypeCounts.set(row.post_type, (postTypeCounts.get(row.post_type) || 0) + 1);
        postStatusCounts.set(row.post_status, (postStatusCounts.get(row.post_status) || 0) + 1);
        // Revisions and drafts are dropped before anything else looks at them.
        if (row.post_status !== LIVE_POST_STATUS) continue;
        posts.set(Number(row.ID), {
          id: Number(row.ID),
          author: Number(row.post_author),
          date: row.post_date,
          dateGmt: row.post_date_gmt,
          content: row.post_content,
          title: row.post_title,
          excerpt: row.post_excerpt,
          status: row.post_status,
          name: row.post_name,
          modified: row.post_modified,
          modifiedGmt: row.post_modified_gmt,
          parent: Number(row.post_parent),
          guid: row.guid,
          menuOrder: Number(row.menu_order),
          type: row.post_type,
          mimeType: row.post_mime_type,
          commentCount: Number(row.comment_count),
        });
        break;
      }
      case 'wp_postmeta': {
        counts.wp_postmeta++;
        const [, postId, metaKey, metaValue] = values;
        if (metaKey == null) break;
        metaKeyCounts.set(metaKey, (metaKeyCounts.get(metaKey) || 0) + 1);
        if (!POSTMETA_ALLOWLIST.includes(metaKey)) break;
        const pid = Number(postId);
        if (!postmeta.has(pid)) postmeta.set(pid, new Map());
        // The dump has no duplicate (post_id, meta_key) pairs, but keep the first
        // occurrence if it ever does — deterministic either way.
        if (!postmeta.get(pid).has(metaKey)) postmeta.get(pid).set(metaKey, metaValue ?? '');
        break;
      }
      case 'wp_options': {
        counts.wp_options++;
        const [, name, value] = values;
        if (!OPTION_ALLOWLIST.includes(name)) break;
        options.set(name, value ?? '');
        break;
      }
      case 'wp_terms': {
        counts.wp_terms++;
        const [termId, name, slug] = values;
        terms.set(Number(termId), { termId: Number(termId), name, slug });
        break;
      }
      case 'wp_term_taxonomy': {
        counts.wp_term_taxonomy++;
        const [ttId, termId, taxonomy, , parent, count] = values;
        termTaxonomy.set(Number(ttId), {
          termTaxonomyId: Number(ttId),
          termId: Number(termId),
          taxonomy,
          parent: Number(parent),
          count: Number(count),
        });
        break;
      }
      case 'wp_term_relationships': {
        counts.wp_term_relationships++;
        termRelationships.push({ objectId: Number(values[0]), termTaxonomyId: Number(values[1]) });
        break;
      }
      case 'wp_users': {
        counts.wp_users++;
        const [id, , , nicename, , , , , , displayName] = values;
        // SPEC-DATA §4.2: only 3 public fields survive. The e-mail, the hash and
        // the session tokens are never read into the model.
        users.set(Number(id), { displayName, slug: nicename, bio: '' });
        break;
      }
      case 'wp_usermeta': {
        counts.wp_usermeta++;
        const [, userId, metaKey, metaValue] = values;
        if (metaKey !== 'description') break;
        userMeta.set(Number(userId), { description: metaValue ?? '' });
        break;
      }
      case 'wp_comments': {
        counts.wp_comments++;
        // Only the approval status and the type are read — never the author,
        // the e-mail, the IP, the agent or the content (SPEC-DATA §4.1).
        const commentId = values[0];
        const commentApproved = values[10];
        const commentType = values[12];
        const entry = { id: Number(commentId), approved: commentApproved, type: commentType };
        if (entry.approved === 'spam') comments.spam.push(entry.id);
        else if (entry.type === 'pingback') comments.approvedPingback.push(entry.id);
        else if (entry.approved === '1') comments.approvedHuman.push(entry.id);
        comments.total++;
        break;
      }
      case 'wp_commentmeta': {
        counts.wp_commentmeta++;
        comments.commentmeta++;
        break;
      }
      default:
        break;
    }
  }

  for (const [userId, user] of users) {
    const meta = userMeta.get(userId);
    if (meta) user.bio = meta.description;
  }

  return {
    counts,
    metaKeyCounts,
    postTypeCounts,
    postStatusCounts,
    posts,
    postmeta,
    options,
    terms,
    termTaxonomy,
    termRelationships,
    users,
    comments,
  };
}

/**
 * Read one option, unserialising the PHP payload when needed.
 * @param {Map<string,string>} options
 * @param {string} name
 */
export function readOption(options, name) {
  const raw = options.get(name);
  if (raw == null) return undefined;
  if (raw.startsWith('a:') || raw.startsWith('s:') || raw.startsWith('i:') || raw.startsWith('b:')) {
    try {
      return phpUnserialize(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}
