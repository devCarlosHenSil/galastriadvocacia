/**
 * The height of the sticky header, published as `--header-height`.
 *
 * The anchors of the home have to land **below** the sticky header. Its
 * height depends on the width of the viewport (the logo shrinks with the
 * grid of the header), so it is measured at runtime instead of being
 * hard-coded for each breakpoint (U1). The CSS uses
 * `scroll-margin-top: calc(var(--header-height) + 16px)`; the token
 * `--header-height` in `tokens.css` is the fallback for the pages without
 * JavaScript.
 */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  if (!header) return;

  /**
   * Publishes the measured height.
   * @returns {void}
   */
  function publish() {
    var height = Math.round(header.getBoundingClientRect().height);
    if (height > 0) {
      document.documentElement.style.setProperty('--header-height', height + 'px');
    }
  }

  publish();
  window.addEventListener('resize', publish);
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(publish).observe(header);
  }
})();
