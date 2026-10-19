/**
 * The order of the consolidated stylesheets (SPEC-UI §5.1).
 *
 * `tokens.css` and `a11y.css` come last so that they can override the CSS
 * copied from the Elementor (R1).
 */
export const stylesheets = [
  '/css/fonts.css',
  '/css/theme.css',
  '/css/theme-dynamic.css',
  '/css/elementor-core.css',
  '/css/elementor-kit.css',
  '/css/widgets.css',
  '/css/elementor-widgets.css',
  '/css/upk.css',
  '/css/elementskit.css',
  '/css/swiper.css',
  '/css/fontawesome.css',
  '/css/fontawesome5.css',
  '/css/elementor-header.css',
  '/css/elementor-home.css',
  '/css/elementor-footer.css',
  '/css/tokens.css',
  '/css/a11y.css',
];
