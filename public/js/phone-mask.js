/**
 * The mask of the telephone `(00) 00000-0000` (SPEC-UI §2.5).
 */
(function () {
  'use strict';

  var inputs = document.querySelectorAll('input.phone_with_ddd, input[data-phone-mask]');

  inputs.forEach(function (input) {
    /**
     * @param {string} value
     * @returns {string} the digits of the value
     */
    function digits(value) {
      return (value || '').replace(/\D/g, '').slice(0, 11);
    }

    /**
     * @param {string} value
     * @returns {string} the masked value
     */
    function mask(value) {
      var d = digits(value);
      if (d.length <= 2) return d;
      if (d.length <= 7) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
      if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    }

    input.addEventListener('input', function () {
      input.value = mask(input.value);
    });

    input.addEventListener('focus', function () {
      if (!input.value) input.value = mask('');
    });

    input.addEventListener('blur', function () {
      if (!input.value) input.value = '';
    });
  });
})();
