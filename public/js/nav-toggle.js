/**
 * The toggle of the mobile menu (SPEC-UI §2.2).
 *
 * The Elementor Pro opens the panel with the class **`elementor-active` on
 * the toggle button** — the rule of the CSS is
 * `.elementor-nav-menu--toggle .elementor-menu-toggle.elementor-active +
 * .elementor-nav-menu__container`. The class `elementor-nav-menu--dropdown-open`
 * that the previous version toggled does not exist in any stylesheet (U2).
 *
 * The panel is `inert` while it is closed (so its links are not focusable and
 * `aria-hidden` does not hide a focusable element — axe `aria-hidden-focus`),
 * and the `inert` attribute is removed when it opens (U10).
 */
(function () {
  'use strict';

  var toggles = document.querySelectorAll('.elementor-menu-toggle');

  toggles.forEach(function (toggle) {
    var dropdown = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!dropdown) return;

    /**
     * @param {boolean} open
     */
    function setState(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      // The class that the CSS of the Elementor Pro uses.
      toggle.classList.toggle('elementor-active', open);
      dropdown.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) {
        dropdown.removeAttribute('inert');
      } else {
        dropdown.setAttribute('inert', '');
      }
    }

    setState(false);

    toggle.addEventListener('click', function () {
      setState(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      setState(false);
      toggle.focus();
    });
  });
})();
