/**
 * Normalisation of the Elementor `_elementor_data` tree (SPEC-DATA §3.5).
 *
 * The output keeps the original order of the elements, promotes
 * `settings._element_id` to a `cssId` sibling field and resolves the
 * `__globals__` / `__dynamic__` references against the Elementor kit.
 */
import { rewriteUrls, stripSrcset } from './urls.mjs';
import { repairContent, LINK_REPAIRS } from './repairs.mjs';
import { IMAGE_ALT_REPAIRS } from './authored.mjs';
import { sanitizeHtml } from './sanitize.mjs';

/** The six anchor ids of the home page. They are reserved. */
export const ANCHOR_IDS = Object.freeze([
  'home', 'sobre', 'areasdeatuacao', 'servicos', 'quemsou', 'contato',
]);

/** Widget types the renderer of Phase 3 knows about. */
export const KNOWN_WIDGET_TYPES = Object.freeze([
  'author-box', 'button', 'copyright', 'divider', 'elementskit-testimonial',
  'form', 'google_maps', 'heading', 'html', 'icon-box', 'icon-list', 'image',
  'image-box', 'nav-menu', 'post-comments', 'post-info', 'posts',
  'social-icons', 'spacer', 'text-editor', 'text-path', 'theme-post-content',
  'theme-post-featured-image', 'theme-post-title', 'theme-site-logo',
  'upk-alex-grid', 'upk-amox-grid', 'upk-post-category',
]);

/** Keys removed from every `settings` object. */
const DENY_EXACT = new Set([
  '_id', 'presetTitle', 'presetIcon', 'hover_parallax', 'sticky', '_column_size',
  // The second form action of the Elementor Pro form points to the WordPress
  // administration e-mail (R6) — the new site has a single endpoint.
  'email_to_2', 'email_subject_2', 'email_content_2', 'email_from_2',
  'email_from_name_2', 'email_reply_to_2',
]);

/** Key prefixes removed from every `settings` object. */
const DENY_PREFIX = ['eicon-', 'motion_fx_', 'scroll_', 'responsive_', 'element_'];

/** `element_*_double` is denied, the other `element_*` keys are kept. */
const DENY_DOUBLE = /^element_.+_double$/;

/** Responsive variants removed from every `settings` object. */
const RESPONSIVE_SUFFIX = [
  '_mobile', '_tablet', '_tablet_extra', '_tablet_extra_active', '_laptop', '_widescreen',
];

/**
 * The responsive settings that are **kept** because they generate the layout
 * classes of the Elementor DOM (`elementor-widget-{bp}__width-*` and
 * `elementor-hidden-{bp}`). The CSS copied verbatim (R1) selects on them, so
 * they are load-bearing and cannot be dropped.
 */
const RESPONSIVE_KEPT = [
  /^_element_width_(mobile|tablet|tablet_extra|laptop|widescreen)$/,
  /^hide_(mobile|tablet|tablet_extra|laptop|widescreen|desktop)$/,
  // The alignment of the social icons on the mobile (`e-grid-align-mobile-*`).
  /^align_mobile$/,
];

/**
 * Normalise a raw string into a CSS id: lowercase, without accents, only
 * `[a-z0-9-]`, without repeated or trailing dashes.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeCssId(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * @param {string} value
 * @returns {boolean} true when the key is a responsive variant
 */
function isResponsiveKey(value) {
  if (RESPONSIVE_KEPT.some((pattern) => pattern.test(value))) return false;
  return RESPONSIVE_SUFFIX.some((suffix) => value.endsWith(suffix));
}

/**
 * @param {string} key
 * @returns {boolean} true when the key must be dropped
 */
function isDeniedKey(key) {
  if (DENY_EXACT.has(key)) return true;
  if (DENY_DOUBLE.test(key)) return true;
  return DENY_PREFIX.some((prefix) => key.startsWith(prefix) && key !== prefix);
}

/**
 * Build the lookup tables of the Elementor kit (post 6).
 * @param {object} kitSettings the parsed `_elementor_page_settings`
 * @returns {{ colors: Map<string,string>, typography: Map<string,object> }}
 */
export function buildKit(kitSettings) {
  const colors = new Map();
  const typography = new Map();
  if (!kitSettings) return { colors, typography };

  for (const entry of kitSettings.system_colors ?? []) {
    colors.set(entry._id, entry.color);
  }
  for (const entry of kitSettings.custom_colors ?? []) {
    colors.set(entry._id, entry.color);
  }
  const readTypography = (entry) => {
    const size = entry.typography_font_size;
    typography.set(entry._id, {
      family: entry.typography_font_family ?? '',
      weight: entry.typography_font_weight ?? '400',
      size: typeof size === 'object' && size ? `${size.size}${size.unit ?? 'px'}` : '',
    });
  };
  for (const entry of kitSettings.system_typography ?? []) readTypography(entry);
  for (const entry of kitSettings.custom_typography ?? []) readTypography(entry);

  return { colors, typography };
}

/**
 * Resolve a `globals/...` reference.
 * @param {string} value
 * @param {{colors: Map<string,string>, typography: Map<string,object>}} kit
 * @returns {{ ok: true, value: any } | { ok: false }}
 */
export function resolveGlobal(value, kit) {
  const color = /^globals\/colors\?id=([^&]+)/.exec(value);
  if (color) {
    const hex = kit.colors.get(color[1]);
    return hex ? { ok: true, value: hex } : { ok: false };
  }
  const typo = /^globals\/typography\?id=([^&]+)/.exec(value);
  if (typo) {
    const t = kit.typography.get(typo[1]);
    return t ? { ok: true, value: t } : { ok: false };
  }
  return { ok: false };
}

/**
 * Resolve a `[elementor-tag ...]` reference.
 * @param {string} value
 * @param {{siteLogo: object, authorName: string}} dynamic
 * @returns {{ ok: true, value: any } | { ok: false }}
 */
export function resolveDynamic(value, dynamic) {
  const tag = /\[elementor-tag\b[^\]]*\]/.exec(value);
  if (!tag) return { ok: false };
  const raw = tag[0];
  const name = /name="([^"]+)"/.exec(raw)?.[1];
  if (name === 'site-logo') return { ok: true, value: dynamic.siteLogo };
  if (name === 'user-info') return { ok: true, value: { text: dynamic.authorName } };
  return { ok: false };
}

/**
 * Flatten an Elementor measure object (`{unit, size, sizes}` → `{unit, size}`).
 * @param {any} value
 * @returns {any}
 */
function flattenMeasures(value, repairs) {
  if (Array.isArray(value)) return value.map((item) => flattenMeasures(item, repairs));
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const isMeasure = keys.includes('unit') && (keys.includes('size') || keys.includes('sizes'));
    if (isMeasure) {
      const out = {};
      if ('unit' in value) out.unit = value.unit;
      if ('size' in value) out.size = value.size;
      for (const [k, v] of Object.entries(value)) {
        if (k === 'unit' || k === 'size' || k === 'sizes') continue;
        out[k] = flattenMeasures(v, repairs);
      }
      return out;
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'sizes' && Array.isArray(v) && v.length === 0) continue;
      out[k] = flattenMeasures(v, repairs);
    }
    return out;
  }
  if (typeof value === 'string') return repairContent(rewriteUrls(value), repairs);
  return value;
}

/**
 * Normalise a whole `_elementor_data` tree.
 * @param {Array<object>} nodes the parsed `_elementor_data`
 * @param {object} ctx
 * @param {{colors: Map<string,string>, typography: Map<string,object>}} ctx.kit
 * @param {{siteLogo: object, authorName: string}} ctx.dynamic
 * @param {object} ctx.report collector for the extract report
 * @param {number} ctx.postId
 * @returns {{ tree: Array<object>, cssIds: string[], elementCount: number }}
 */
export function normalizeTree(nodes, ctx) {
  const { kit, dynamic, report, postId, repairs, attachments } = ctx;
  const cssIds = [];
  const seen = new Map();
  let elementCount = 0;

  const walk = (list, isInner) =>
    list.map((node) => {
      elementCount++;
      const rawSettings = node.settings && typeof node.settings === 'object' && !Array.isArray(node.settings)
        ? node.settings
        : {};

      // --- cssId -------------------------------------------------------
      const rawElementId = typeof rawSettings._element_id === 'string' ? rawSettings._element_id : '';
      const rawTitle = typeof rawSettings._title === 'string' ? rawSettings._title : '';
      let cssId;
      let cssIdSource = 'element_id';
      if (rawElementId.trim()) {
        cssId = normalizeCssId(rawElementId);
      } else if (rawTitle.trim()) {
        cssId = `el-${normalizeCssId(rawTitle)}`;
        cssIdSource = 'title';
      } else {
        cssId = `el-${normalizeCssId(node.id)}`;
        cssIdSource = 'id';
      }
      if (cssIdSource !== 'element_id' && ANCHOR_IDS.includes(cssId)) {
        // A fallback must never steal a reserved anchor id.
        report.renamedCssIds.push({ postId, elementId: node.id, from: cssId, to: `el-${cssId}` });
        cssId = `el-${cssId}`;
        cssIdSource = 'reserved-rename';
      }
      if (!cssId) cssId = `el-${normalizeCssId(node.id)}`;
      if (seen.has(cssId)) {
        // A collision on a real `_element_id` (or on a reserved anchor) is a
        // bug; a collision between two `_title` fallbacks is only a naming
        // clash and falls back to the element id.
        if (cssIdSource === 'element_id' || ANCHOR_IDS.includes(cssId)) {
          throw new Error(
            `CSS id collision in post ${postId}: "${cssId}" used by ${seen.get(cssId)} and ${node.id}`,
          );
        }
        const fallback = `el-${normalizeCssId(node.id)}`;
        report.renamedCssIds.push({ postId, elementId: node.id, from: cssId, to: fallback });
        cssId = fallback;
      }
      seen.set(cssId, node.id);
      cssIds.push(cssId);

      // --- settings ----------------------------------------------------
      const settings = {};
      for (const [key, value] of Object.entries(rawSettings)) {
        if (key === '__globals__' || key === '__dynamic__') continue;
        if (isDeniedKey(key)) continue;
        if (isResponsiveKey(key)) continue;

        if (key === '_element_id' || key === '_title') continue;

        if (typeof value === 'string' && value.includes('globals/')) {
          const resolved = resolveGlobal(value, kit);
          if (resolved.ok) {
            settings[key] = resolved.value;
            continue;
          }
          report.unresolvedGlobals.push({ postId, elementId: node.id, key, value });
          continue;
        }
        if (typeof value === 'string' && value.includes('[elementor-tag')) {
          const resolved = resolveDynamic(value, dynamic);
          if (resolved.ok) {
            settings[key] = resolved.value;
            continue;
          }
          report.unresolvedDynamic.push({ postId, elementId: node.id, key, value });
          continue;
        }
        settings[key] = flattenMeasures(value, repairs);
      }

      const widgetType = node.elType === 'widget' ? node.widgetType : undefined;
      if (widgetType && !KNOWN_WIDGET_TYPES.includes(widgetType)) {
        report.unknownWidgetTypes.push({ postId, elementId: node.id, widgetType });
      }

      // C6 / SEC-R-28 — o HTML dos widgets (`html` e `editor`) é renderizado
      // com `set:html`: passa pelo sanitizador (sem `<script>`, sem `on…=`,
      // sem `javascript:`).
      for (const key of ['html', 'editor']) {
        if (typeof settings[key] === 'string') settings[key] = sanitizeHtml(settings[key]);
      }

      // U8 — a URL e as dimensões de uma imagem vêm do ATTACHMENT (o
      // Elementor guarda o id e gera a URL a partir dele). O URL guardado nas
      // settings apontava para o original SEM o corte, o que mudava a caixa do
      // logo do rodapé (500x500 em vez de 327x299).
      for (const key of ['image', 'background_image']) {
        const image = settings[key];
        if (!image || typeof image !== 'object') continue;
        const attachment = ctx.attachments?.get(Number(image.id));
        if (!attachment?.file) continue;
        image.url = `/wp-content/uploads/${attachment.file}`;
        if (attachment.width) image.width = attachment.width;
        if (attachment.height) image.height = attachment.height;
      }

      // U21 — os alt texts corrigidos (SPEC-UI §4.4).
      const altRepair = IMAGE_ALT_REPAIRS[node.id];
      if (altRepair !== undefined && settings.image && typeof settings.image === 'object') {
        settings.image.alt = altRepair;
      }

      // The link lists of the footer pointed to a page that never existed and
      // to the wrong anchor (see `LINK_REPAIRS`).
      if (widgetType === 'icon-list' && Array.isArray(settings.icon_list)) {
        for (const item of settings.icon_list) {
          const target = LINK_REPAIRS[item?.text];
          if (target && item?.link?.url) item.link.url = target;
        }
      }

      const out = {
        id: node.id,
        elType: node.elType,
      };
      if (widgetType) out.widgetType = widgetType;
      if (rawTitle) out.label = rawTitle;
      out.cssId = cssId;
      out.settings = sortKeys(settings);
      out.elements = walk(node.elements ?? [], node.elType === 'widget');
      out.isInner = isInner;
      return out;
    });

  const tree = walk(nodes, false);
  return { tree, cssIds, elementCount };
}

/**
 * @param {Record<string, any>} obj
 * @returns {Record<string, any>} the same object with alphabetically sorted keys
 */
function sortKeys(obj) {
  const out = {};
  for (const key of Object.keys(obj).sort()) out[key] = obj[key];
  return out;
}

/**
 * @param {string} html
 * @returns {string} the HTML without `srcset` / `sizes`
 */
export function cleanHtml(html) {
  return stripSrcset(rewriteUrls(html));
}
