/**
 * The map of the office: click-to-load and gated on the consent (R13,
 * SPEC-UI §4.5).
 *
 * The iframe of the Google is only injected after a click **and** after the
 * consent of the third parties; before that, the browser never talks to
 * Google.
 *
 * When the consent is missing, the message is shown **inside** the
 * placeholder (with `role="status"`) and the focus goes to the link
 * "Abrir no Google Maps" — a native `alert()` blocks the whole page (U14).
 */
(function () {
  'use strict';

  var CONSENT_KEY = 'ga_consent';

  /**
   * @returns {object | null} the stored consent
   */
  function readConsent() {
    try {
      var raw = window.localStorage.getItem(CONSENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  document.querySelectorAll('[data-map]').forEach(function (placeholder) {
    var button = placeholder.querySelector('.map-load');
    var link = placeholder.querySelector('.map-link');
    if (!button) return;

    button.addEventListener('click', function () {
      var consent = readConsent();
      // REV-12 (E10): o mapa tem a sua **própria** categoria de consentimento
      // ("Mapas", por omissão desligada). Pedir consentimento de publicidade
      // para ver o endereço do escritório é um dark pattern ao contrário.
      if (!consent || !consent.maps) {
        var message = placeholder.querySelector('[data-map-message]');
        if (!message) {
          message = document.createElement('p');
          message.setAttribute('data-map-message', '');
          message.setAttribute('role', 'status');
          message.className = 'map-message';
          message.textContent =
            'Para mostrar o mapa é preciso ativar a categoria "Mapas" nas preferências de cookies. ' +
            'Use o link "Abrir no Google Maps" ou gerencie as suas preferências de cookies.';
          placeholder.appendChild(message);
        }
        message.hidden = false;
        if (link) {
          link.focus();
          link.scrollIntoView({ block: 'center' });
        }
        return;
      }

      var iframe = document.createElement('iframe');
      iframe.loading = 'lazy';
      iframe.src = placeholder.getAttribute('data-map-src');
      iframe.title = placeholder.getAttribute('data-map-title') || 'Mapa do escritório';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.setAttribute('allowfullscreen', '');
      placeholder.innerHTML = '';
      placeholder.appendChild(iframe);
    });
  });
})();
