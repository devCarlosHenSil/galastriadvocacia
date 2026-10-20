/**
 * The submission of the contact form (SPEC-UI §2.5, §4.9; R14).
 *
 * The request goes to the **Pages Function of the site itself**
 * (`POST /api/contact`, same-origin) — the Function validates the payload and
 * sends the e-mail with the Resend. **The payload is never logged**: only the
 * status and the endpoint are (SEC-37).
 */
(function () {
  'use strict';

  // D91 / SEC-N-01 — o `_t` que a Function valida é o **tempo decorrido**
  // desde a abertura da página (em ms), **não** um *timestamp*: assim o
  // relógio do dispositivo não interfere (um relógio 3 s atrás não reprova,
  // um relógio 24 h à frente não valida). A Function exige ≥ 3 s (o sinal de
  // bot) e ≤ 24 h (a página velha).
  var openedAt = Date.now();

  var forms = document.querySelectorAll('form[data-form="contact"]');

  forms.forEach(function (form) {
    var endpoint = form.getAttribute('action');
    var message = form.querySelector('.elementor-message');
    var submit = form.querySelector('button[type="submit"]');
    var buttonText = submit ? submit.querySelector('.elementor-button-text') : null;
    var submittingLabel = 'Enviando…';

    if (!endpoint || !message) return;

    /**
     * @param {string} text
     * @param {boolean} isError
     */
    function showMessage(text, isError) {
      message.textContent = text;
      message.classList.remove('elementor-message-success', 'elementor-message-danger');
      message.classList.add(isError ? 'elementor-message-danger' : 'elementor-message-success');
      message.setAttribute('role', isError ? 'alert' : 'status');
      message.setAttribute('aria-live', isError ? 'assertive' : 'polite');
      message.hidden = false;
    }

    /**
     * Marks the invalid fields and their messages.
     * @param {Array<{name: string, message: string}>} errors
     */
    function showErrors(errors) {
      errors.forEach(function (error) {
        var field = form.querySelector('[name="' + error.name + '"]');
        if (!field) return;
        field.setAttribute('aria-invalid', 'true');
        var errorNode = form.querySelector('#err-' + error.name);
        if (errorNode) {
          errorNode.textContent = error.message;
          errorNode.hidden = false;
        }
      });
    }

    /**
     * Clears the state of the validation.
     */
    function clearErrors() {
      form.querySelectorAll('[aria-invalid="true"]').forEach(function (field) {
        field.removeAttribute('aria-invalid');
      });
      form.querySelectorAll('.elementor-form-field-error').forEach(function (node) {
        node.textContent = '';
        node.hidden = true;
      });
    }

    form.addEventListener('input', function (event) {
      var field = event.target;
      if (field && field.hasAttribute && field.hasAttribute('aria-invalid')) {
        field.removeAttribute('aria-invalid');
        var errorNode = form.querySelector('#err-' + field.name);
        if (errorNode) {
          errorNode.textContent = '';
          errorNode.hidden = true;
        }
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearErrors();

      var data = {};
      var invalid = [];
      new FormData(form).forEach(function (value, key) {
        // C5: o honeypot `_gotcha` **fica** no payload. A Function trata o
        // campo preenchido como spam (e responde como se fosse sucesso) —
        // dropping o campo aqui desligava a proteção (só funcionava no
        // caminho sem JavaScript). O valor nunca é registado.
        data[key] = value;
      });

      form.querySelectorAll('[required]').forEach(function (field) {
        var value = (field.value || '').trim();
        var message = '';
        // The per-field messages come from `site.json → form.fieldErrors`
        // (SPEC-UI §6.4) and travel in the `data-error` of the field (U15).
        var specific = field.getAttribute('data-error') || '';
        if (!value && field.type !== 'checkbox') {
          message = specific || 'Preencha este campo.';
        } else if (field.type === 'checkbox' && !field.checked) {
          message = specific || 'É necessário autorizar o tratamento de dados para enviar a mensagem.';
        } else if (field.type === 'email' && value && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value)) {
          message = specific || 'Informe um e-mail válido.';
        } else if (field.type === 'tel' && value && !/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(value)) {
          message = specific || 'Informe um telefone válido com DDD.';
        } else if (field.minLength > 0 && value && value.length < field.minLength) {
          // The form has `novalidate`: the `minlength` has to be validated here.
          message =
            specific || 'Descreva brevemente o seu caso (mínimo ' + field.minLength + ' caracteres).';
        }
        if (message) invalid.push({ name: field.name, message: message });
      });

      if (invalid.length > 0) {
        showErrors(invalid);
        var first = form.querySelector('[aria-invalid="true"]');
        if (first) first.focus();
        return;
      }

      // D86 / SEC-N-01: o `_t` é o **tempo decorrido** desde a abertura da
      // página (em ms) — a Function valida-o (≥ 3 s e ≤ 24 h). O campo
      // **não** existe no HTML (o DOM do Elementor é intocável): é
      // preenchido aqui, no momento do envio. A Function valida todo o resto
      // no servidor.
      data._t = Date.now() - openedAt;

      if (submit) {
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
      }
      if (buttonText) buttonText.textContent = submittingLabel;
      form.setAttribute('aria-busy', 'true');

      fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (response) {
          // A Function responde `{ ok: true }` ou `{ ok: false, error: "…" }`
          // — a mensagem de erro é do servidor (é genérica e não devolve
          // nada do pedido).
          return response
            .json()
            .catch(function () {
              return { ok: false, error: '' };
            })
            .then(function (body) {
              if (!response.ok || body.ok !== true) {
                var error = new Error(String(response.status));
                error.detail = typeof body.error === 'string' ? body.error.slice(0, 200) : '';
                throw error;
              }
              showMessage('Mensagem enviada com sucesso! Em breve, nossa equipe entrará em contato.', false);
              form.reset();
            });
        })
        .catch(function (error) {
          // Only the status and the endpoint are logged — never the payload.
          console.warn('contact-error', { status: error.message, endpoint: endpoint });
          showMessage(
            error.detail ||
              'Não foi possível enviar sua mensagem. Por favor, tente novamente ou fale conosco pelo WhatsApp.',
            true,
          );
        })
        .finally(function () {
          if (submit) {
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
          }
          if (buttonText) buttonText.textContent = submit ? 'Enviar mensagem' : submittingLabel;
          form.removeAttribute('aria-busy');
        });
    });
  });
})();
