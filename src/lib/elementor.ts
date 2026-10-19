/**
 * The normalised Elementor tree and the rules that reproduce the classes of
 * the original DOM (SPEC-UI §1.1).
 *
 * The CSS copied verbatim from the WordPress site (R1) selects on those
 * classes, so they are **functional**: they are derived from the `settings` of
 * the node, never hard-coded per element.
 */

export interface ElementorNode {
  id: string;
  elType: 'container' | 'widget';
  widgetType?: string;
  label?: string;
  cssId: string;
  settings: Record<string, any>;
  elements: ElementorNode[];
  isInner: boolean;
}

export interface ElementorDocument {
  meta: {
    sourcePostId: number;
    postType: string;
    postName: string;
    elementorTemplateType: string;
    title: string;
    elementCount: number;
    cssIds: string[];
  };
  root: ElementorNode[];
}

/** The responsive devices of the Elementor, in the order of the CSS. */
const DEVICES = ['mobile', 'tablet', 'tablet_extra', 'laptop', 'widescreen'] as const;

/** The devices of the "hide on device" control, in the order of the DOM. */
const HIDE_DEVICES = ['widescreen', 'desktop', 'laptop', 'tablet_extra', 'tablet', 'mobile'] as const;

/** The classes of the plugins that mark the containers (inert markers). */
const PLUGIN_MARKERS = ['wpr-particle-no', 'wpr-jarallax-no', 'wpr-parallax-no', 'wpr-sticky-section-no'];

/** The dictionary of the icon position of the icon box (Elementor). */
const ICON_POSITION = {
  left: 'inline-start',
  right: 'inline-end',
  top: 'block-start',
  bottom: 'block-end',
} as const;

/**
 * @param {Record<string, any>} settings
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
function str(settings: Record<string, any>, key: string, fallback = ''): string {
  const value = settings[key];
  return typeof value === 'string' && value !== '' ? value : fallback;
}

/**
 * The layout classes of a container.
 * @param {ElementorNode} node
 * @returns {string[]}
 */
export function containerClasses(node: ElementorNode): string[] {
  const s = node.settings;
  const classes: string[] = [];
  classes.push(s.container_type === 'grid' ? 'e-grid' : 'e-flex');
  classes.push(s.content_width === 'full' ? 'e-con-full' : 'e-con-boxed');
  if (s.animation) {
    if (s.animation_duration === 'slow') classes.push('animated-slow');
    classes.push('elementor-invisible');
  }
  return classes;
}

/**
 * The layout classes of a widget.
 * @param {ElementorNode} node
 * @returns {string[]}
 */
export function widgetClasses(node: ElementorNode): string[] {
  const s = node.settings;
  const classes: string[] = [];

  const width = str(s, '_element_width');
  if (width) classes.push(`elementor-widget__width-${width}`);
  for (const device of DEVICES) {
    const value = str(s, `_element_width_${device}`);
    if (value) classes.push(`elementor-widget-${device}__width-${value}`);
  }
  for (const device of HIDE_DEVICES) {
    if (s[`hide_${device}`]) classes.push(`elementor-hidden-${device}`);
  }
  if (s._animation) {
    if (s.animation_duration === 'slow') classes.push('animated-slow');
    classes.push('elementor-invisible');
  }

  classes.push(...typeClasses(node));
  return classes;
}

/**
 * The layout classes that depend on the type of the widget (the `prefix_class`
 * of the controls of the Elementor).
 * @param {ElementorNode} node
 * @returns {string[]}
 */
function typeClasses(node: ElementorNode): string[] {
  const s = node.settings;
  switch (node.widgetType) {
    case 'button': {
      const align = str(s, 'align');
      return align ? [`elementor-align-${align}`] : [];
    }
    case 'divider': {
      return [
        `elementor-widget-divider--view-${str(s, 'look', 'line')}`,
        `elementor-widget-divider--element-align-${str(s, 'align', 'center')}`,
      ];
    }
    case 'icon-box': {
      const view = str(s, 'view', 'default');
      const classes = [`elementor-view-${view}`];
      // The `shape` control only applies to the views that are not the default.
      if (view !== 'default') {
        const shape = str(s, 'shape', 'circle');
        if (shape) classes.push(`elementor-shape-${shape}`);
      }
      const position = ICON_POSITION[str(s, 'icon_position', 'top') as keyof typeof ICON_POSITION] ?? 'block-start';
      const positionMobile =
        ICON_POSITION[str(s, 'icon_position_mobile', 'top') as keyof typeof ICON_POSITION] ?? 'block-start';
      classes.push(`elementor-position-${position}`);
      classes.push(`elementor-mobile-position-${positionMobile}`);
      return classes;
    }
    case 'image-box': {
      return [`elementor-position-${str(s, 'position', 'top')}`];
    }
    case 'icon-list': {
      return [
        `elementor-icon-list--layout-${str(s, 'layout', 'traditional')}`,
        `elementor-list-item-link-${str(s, 'link_behavior', 'full_width')}`,
      ];
    }
    case 'social-icons': {
      const classes = [
        `elementor-shape-${str(s, 'shape', 'rounded')}`,
        `elementor-grid-${str(s, 'columns', '0')}`,
        `e-grid-align-${str(s, 'align', 'center')}`,
      ];
      const alignMobile = str(s, 'align_mobile');
      if (alignMobile) classes.push(`e-grid-align-mobile-${alignMobile}`);
      return classes;
    }
    case 'form': {
      return [`elementor-button-align-${str(s, 'button_width', 'stretch')}`];
    }
    case 'nav-menu': {
      const classes = ['elementor-nav-menu--toggle', 'elementor-nav-menu--burger'];
      if (s.dropdown === 'mobile') classes.push('elementor-nav-menu--dropdown-mobile');
      if (s.full_width === 'stretch') classes.push('elementor-nav-menu--stretch');
      if (s.text_align) classes.push(`elementor-nav-menu__text-align-${s.text_align}`);
      return classes;
    }
    default:
      return [];
  }
}

/**
 * The class list of a node, in the order of the original DOM.
 * @param {ElementorNode} node
 * @param {boolean} isTopLevel true for the nodes of the root of the template
 * @returns {string}
 */
export function nodeClassList(node: ElementorNode, isTopLevel: boolean): string {
  const classes = ['elementor-element', `elementor-element-${node.id}`];
  if (node.elType === 'container') {
    classes.push(...containerClasses(node));
    classes.push(...PLUGIN_MARKERS);
    classes.push('e-con');
    classes.push(isTopLevel ? 'e-parent' : 'e-child');
  } else {
    classes.push(...widgetClasses(node));
    classes.push('elementor-widget');
    classes.push(`elementor-widget-${node.widgetType}`);
  }
  return classes.join(' ');
}

/**
 * The `id` attribute of a node: only the anchors of the original site have
 * one (the others are the `el-*` fallback of the extractor).
 * @param {ElementorNode} node
 * @returns {string | undefined}
 */
export function nodeId(node: ElementorNode): string | undefined {
  return node.cssId.startsWith('el-') ? undefined : node.cssId;
}

/**
 * The exceptions of the outline of the document (SPEC-UI §4.2).
 *
 * The CSS selects on the classes, not on the tags: changing the tag of a
 * heading does not move a single pixel. Only the outline of the document
 * changes — and that is the point of the correction.
 */
const HEADING_TAGS: Record<string, 'h1' | 'h2' | 'h3' | 'p'> = {
  // The quote of Voltaire is a citation, not a section title.
  a3ee56d: 'p',
};

/**
 * The semantic tag of a heading (SPEC-UI §4.2).
 * @param {ElementorNode} node
 * @param {string | null | undefined} h1Id the id of the heading that is the `h1` of the page
 * @returns {'h1' | 'h2' | 'h3' | 'p'}
 */
export function headingTag(node: ElementorNode, h1Id?: string | null): 'h1' | 'h2' | 'h3' | 'p' {
  // A heading that is a link (the policy links of the footer) is not a title.
  if (node.settings.link?.url) return 'p';
  // The subtitles of the sections.
  if (node.label === 'Subtítulo') return 'p';
  const explicit = HEADING_TAGS[node.id];
  if (explicit) return explicit;
  if (h1Id === node.id) return 'h1';
  return 'h2';
}

/**
 * Read a template of the Elementor (the JSON of `src/data/elementor/`).
 * @param {unknown} data the imported JSON
 * @returns {ElementorDocument}
 */
export function template(data: unknown): ElementorDocument {
  return data as ElementorDocument;
}

/**
 * The id of the first heading of a template: it is the `h1` of the page
 * (SPEC-UI §4.2).
 * @param {ElementorNode[]} tree
 * @returns {string | null}
 */export function firstHeadingId(tree: ElementorNode[]): string | null {
  for (const node of tree) {
    if (node.elType === 'widget' && node.widgetType === 'heading') return node.id;
    const found = firstHeadingId(node.elements);
    if (found) return found;
  }
  return null;
}

/**
 * Find a node by its id.
 * @param {ElementorNode[]} tree
 * @param {string} id
 * @returns {ElementorNode | undefined}
 */
export function findNode(tree: ElementorNode[], id: string): ElementorNode | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNode(node.elements, id);
    if (found) return found;
  }
  return undefined;
}
