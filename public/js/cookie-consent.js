/**
 * The banner of the cookies and the panel of the preferences (SPEC-UI §2.8;
 * R13, SEC-44).
 *
 * The choice is stored in the `localStorage` under the key `ga_consent`:
 * `{necessary, analytics, ads, ts, version}`. The absence of the key means
 * that the banner has to be shown.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ga_consent';
  var GTM_ID = 'GTM-KDNG3QWB';
  // C11 — a versão vigente das políticas (a mesma de `site.json →
  // policy.version`).
  var POLICY_VERSION = '2026-10-19';
  var banner = document.querySelector('[data-cookie-banner]');
  var dialog = document.querySelector('[data-cookie-dialog]');
  var status = document.querySelector('[data-cookie-status]');
  var analyticsBox = document.querySelector('[data-cookie-analytics]');
  var adsBox = document.querySelector('[data-cookie-ads]');
  var mapsBox = document.querySelector('[data-cookie-maps]');  // REV-12 (E10)
  var lastTrigger = null;

  /**
   * @returns {object | null} the stored consent
   */
  function readConsent() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * @param {object} consent
   */
  function writeConsent(consent) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch (error) {
      /* the storage may be disabled: the choice is only kept for the visit */
    }
  }

  /**
   * Applies the consent to the Google Consent Mode and loads the third
   * parties — the AdSense and the container of the GTM — only when the
   * visitor granted at least one optional category.
   *
   * The container of the GTM is **not** in the `<head>`: it is injected here,
   * after `gtag('consent', 'update', …)`, so that no request ever reaches
   * googletagmanager.com before the choice (SEC-R-03, T1 of the QA).
   * @param {object} consent
   */
  function applyConsent(consent) {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: consent.analytics ? 'granted' : 'denied',
        ad_storage: consent.ads ? 'granted' : 'denied',
        ad_user_data: consent.ads ? 'granted' : 'denied',
        ad_personalization: consent.ads ? 'granted' : 'denied',
      });
    }
    if (consent.ads) loadAdSense();
    if (consent.analytics || consent.ads) loadGtm();
  }

  /**
   * Loads the container of the Google Tag Manager.
   */
  function loadGtm() {
    if (document.getElementById('gtm-loader')) return;
    var loader = document.createElement('script');
    loader.id = 'gtm-loader';
    loader.async = true;
    loader.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
    document.head.appendChild(loader);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  }

  /**
   * Loads the AdSense: the tag of the layout stays inert until now.
   */
  function loadAdSense() {
    var loader = document.getElementById('adsbygoogle-loader');
    if (!loader || loader.dataset.loaded === 'true') return;
    loader.dataset.loaded = 'true';
    var script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = loader.dataset.src;
    loader.parentNode.insertBefore(script, loader);
  }

  /**
   * @param {object} consent
   */
  function save(consent) {
    consent.necessary = true;
    consent.ts = new Date().toISOString();
    // C11 — a Política de Cookies §8 promete registar "a data, as categorias
    // **e a versão vigente desta Política**": a versão vai no registo.
    consent.version = POLICY_VERSION;
    writeConsent(consent);
    applyConsent(consent);
  }

  /**
   * @param {string} message
   */
  function confirm(message) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    window.setTimeout(function () {
      status.hidden = true;
    }, 4000);
  }

  /**
   * @param {object} consent
   */
  function fillDialog(consent) {
    if (analyticsBox) analyticsBox.checked = Boolean(consent.analytics);
    if (adsBox) adsBox.checked = Boolean(consent.ads);
    if (mapsBox) mapsBox.checked = Boolean(consent.maps);
  }

  /**
   * Opens the panel of the preferences.
   * @param {Event | null} trigger
   */
  function openDialog(trigger) {
    if (!dialog) return;
    lastTrigger = trigger || document.activeElement;
    fillDialog(readConsent() || { necessary: true, analytics: false, ads: false, maps: false });
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  /**
   * Closes the panel and gives the focus back to the trigger.
   */
  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
  }

  if (banner) {
    document.querySelectorAll('[data-cookie-accept]').forEach(function (button) {
      button.addEventListener('click', function () {
        save({ necessary: true, analytics: true, ads: true, maps: true });
        banner.hidden = true;
        // REV-9: o diálogo tinha de ser fechado — a confirmação ficava por
        // baixo do *backdrop* e o utilizador via um ecrã travado.
        closeDialog();
        confirm('Preferências salvas.');
      });
    });
    document.querySelectorAll('[data-cookie-reject]').forEach(function (button) {
      button.addEventListener('click', function () {
        save({ necessary: true, analytics: false, ads: false, maps: false });
        banner.hidden = true;
        closeDialog();
        confirm('Preferências salvas.');
      });
    });
  }

  document.querySelectorAll('[data-cookie-preferences]').forEach(function (button) {
    button.addEventListener('click', function (event) {
      openDialog(event.currentTarget);
    });
  });

  document.querySelectorAll('[data-cookie-save]').forEach(function (button) {
    button.addEventListener('click', function () {
      save({
        necessary: true,
        analytics: Boolean(analyticsBox && analyticsBox.checked),
        ads: Boolean(adsBox && adsBox.checked),
        maps: Boolean(mapsBox && mapsBox.checked),
      });
      closeDialog();
      if (banner) banner.hidden = true;
      confirm('Preferências salvas.');
    });
  });

  document.querySelectorAll('[data-cookie-close]').forEach(function (button) {
    button.addEventListener('click', closeDialog);
  });

  if (dialog) {
    // The `Esc` of the native dialog closes it; the focus goes back to the
    // trigger.
    dialog.addEventListener('close', function () {
      if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    });
  }

  var stored = readConsent();
  // D12 — quando a **versão das políticas** muda, o visitante tem de
  // escolher de novo: o consentimento antigo é de outra versão da Política de
  // Cookies e não pode valer para a nova.
  if (stored && stored.version !== POLICY_VERSION) {
    stored = null;
  }
  if (stored) {
    applyConsent(stored);
    if (banner) banner.hidden = true;
  } else if (banner) {
    banner.hidden = false;
  }

  // Only the two operations the page needs: read the choice and open the
  // panel of the preferences. The `save` is not exposed (SEC-R-12).
  window.galastriConsent = { read: readConsent, openPreferences: openDialog };
})();
