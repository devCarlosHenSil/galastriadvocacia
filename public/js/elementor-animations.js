/**
 * The entrance animations of the Elementor.
 *
 * The CSS copied verbatim hides the elements that have an animation
 * (`.elementor-invisible { visibility: hidden }`) and the Elementor removes
 * the class when the element enters the viewport. This script reproduces
 * that behaviour without the jQuery of the original theme.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * The name of the entrance animation of an element.
   * @param {Element} element
   * @returns {string}
   */
  function animationName(element) {
    var raw = element.getAttribute('data-settings');
    if (!raw) return '';
    try {
      var settings = JSON.parse(raw);
      return settings._animation || settings.animation || '';
    } catch (error) {
      return '';
    }
  }

  /**
   * The class of the animation.
   *
   * O CSS do Elementor define \`.elementor-animation-<nome>\` para as animações
   * de destaque (\`pulse\`, \`grow\`); a \`fadeIn\` é a exceção desta versão
   * do Elementor, que a define pelo nome cru (U16).
   *
   * @param {string} name
   * @returns {string}
   */
  function animationClass(name) {
    if (!name) return '';
    if (name === 'fadeIn') return 'fadeIn';
    return 'elementor-animation-' + name;
  }

  /**
   * @param {Element} element
   */
  function reveal(element) {
    element.classList.remove('elementor-invisible');
    var name = animationName(element);
    if (name && !reduced) {
      element.classList.add('elementor-animated');
      element.classList.add(animationClass(name));
    }
  }

  var elements = document.querySelectorAll('.elementor-invisible');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    elements.forEach(reveal);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.05, rootMargin: '0px 0px -5% 0px' },
  );

  elements.forEach(function (element) {
    observer.observe(element);
  });

  // The content is never left hidden when the observer does not fire.
  window.setTimeout(function () {
    document.querySelectorAll('.elementor-invisible').forEach(reveal);
  }, 3000);
})();
