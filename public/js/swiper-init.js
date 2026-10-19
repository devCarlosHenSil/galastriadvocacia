/**
 * The slider of the testimonials (SPEC-UI §2.6).
 *
 * The Swiper is initialised with the `data-config` of the widget; the dots
 * are rendered as buttons (44×44), the autoplay is paused when the visitor
 * asks for it and it is disabled when the motion is reduced.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.elementskit-testimonial-slider').forEach(function (widget) {
    var configNode = widget.querySelector('[data-config]');
    var swiperNode = widget.querySelector('.ekit-main-swiper');
    var pagination = widget.querySelector('.swiper-pagination');
    var toggle = widget.querySelector('[data-swiper-toggle]');
    if (!configNode || !swiperNode) return;

    var config = {};
    try {
      config = JSON.parse(configNode.getAttribute('data-config'));
    } catch (error) {
      config = {};
    }
    if (reduced) {
      config.autoplay = false;
      config.speed = 0;
    }
    config.pauseOnFocus = true;
    config.pagination = {
      el: pagination,
      clickable: true,
      renderBullet: function (index, className) {
        return (
          '<button type="button" class="' +
          className +
          '" aria-label="Ver depoimento ' +
          (index + 1) +
          '"></button>'
        );
      },
    };
    config.on = {
      init: function () {
        swiperNode.setAttribute('aria-live', reduced ? 'polite' : 'off');
      },
      paginationRender: function (swiper, _bullets, _params) {
        var buttons = pagination.querySelectorAll('button');
        buttons.forEach(function (button, index) {
          if (index === swiper.activeIndex) button.setAttribute('aria-current', 'true');
          else button.removeAttribute('aria-current');
        });
      },
      slideChange: function (swiper) {
        var buttons = pagination.querySelectorAll('button');
        buttons.forEach(function (button, index) {
          if (index === swiper.activeIndex) button.setAttribute('aria-current', 'true');
          else button.removeAttribute('aria-current');
        });
      },
    };

    if (typeof window.Swiper !== 'function') return;
    var swiper = new window.Swiper(swiperNode, config);

    if (toggle) {
      toggle.addEventListener('click', function () {
        if (swiper.autoplay && swiper.autoplay.running) {
          swiper.autoplay.stop();
          toggle.textContent = 'Retomar slideshow';
          toggle.setAttribute('aria-pressed', 'true');
          swiperNode.setAttribute('aria-live', 'polite');
        } else {
          swiper.autoplay.start();
          toggle.textContent = 'Pausar slideshow';
          toggle.setAttribute('aria-pressed', 'false');
          swiperNode.setAttribute('aria-live', 'off');
        }
      });
      if (reduced) {
        toggle.textContent = 'Retomar slideshow';
        toggle.setAttribute('aria-pressed', 'true');
      }
    }
  });
})();
