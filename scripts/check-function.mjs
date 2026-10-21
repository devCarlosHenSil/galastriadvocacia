#!/usr/bin/env node
/**
 * A verificação da Pages Function do formulário (D86 · SEC-N-01…SEC-N-20).
 *
 *   node scripts/check-function.mjs
 *
 * Duas fases:
 *
 * 1. **Asserções estáticas** sobre `functions/api/contact.ts` — correm em
 *    qualquer Node. São feitas sobre o **código** (não sobre a prosa): cada
 *    asserção aponta a uma expressão real do ficheiro (SEC-N-16);
 * 2. **Testes de comportamento** — importa a Function e exercise-a. Precisa
 *    de um Node que sabe ler TypeScript (**≥ 22.6**, com o *type
 *    stripping*); num Node mais antigo a fase é **saltada com um aviso**
 *    (o mesmo padrão do `npm run visual-diff`) e o script **sai com 0** — o
 *    CI corre o Node 20 e é o job `functions` (Node 22) que corre a fase de
 *    comportamento.
 *
 * Inclui o **teste de contrato cliente↔servidor** (SEC-N-01): a expressão
 * que o `public/js/form.js` calcula para o `_t` é **executada** e o
 * resultado é enviado à Function real — se as duas pontas discordarem, o
 * formulário está partido.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE = resolve(process.cwd(), 'functions/api/contact.ts');
const CLIENT = resolve(process.cwd(), 'public/js/form.js');
const source = readFileSync(SOURCE, 'utf8');
const client = readFileSync(CLIENT, 'utf8');

/** A primeira versão do Node que lê TypeScript (o *type stripping*). */
const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const NODE_MINOR = Number(process.versions.node.split('.')[1]);
const READS_TYPESCRIPT =
  (NODE_MAJOR > 22 || (NODE_MAJOR === 22 && NODE_MINOR >= 6)) &&
  process.env.CHECK_FUNCTION_STATIC_ONLY !== '1';

const problems = [];
const ok = [];

/**
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [detail]
 */
function check(label, condition, detail = '') {
  if (condition) ok.push(label);
  else problems.push(`${label}${detail ? ' — ' + detail : ''}`);
}

// ===========================================================================
// 1. as asserções estáticas (sobre o código, não sobre a prosa)
// ===========================================================================
check('a rota é a Function do formulário', /export const onRequestPost/.test(source));
for (const field of ['nome', 'email', 'telefone', 'mensagem']) {
  check(`a validação cobre o campo "${field}"`, source.includes(`'${field}'`));
}
check(
  'o honeypot é lido como texto (um array ou um 0 também é spam)',
  /String\(payload\._gotcha \?\? ''\)/.test(source),
);
check(
  'o tempo `_t` é o decorrido (não um timestamp)',
  /const elapsed = Number\(payload\._t\)/.test(source) && !/Date\.now\(\) - (payload\._t|_t)/.test(source),
);
check('o `_t` é obrigatório', /payload\._t === undefined/.test(source));
check('o `Content-Type` é exigido (415)', /contentType\.startsWith\('application\/json'\)/.test(source));
check('há um limite do corpo (16 KB → 413)', /MAX_BODY_BYTES/.test(source) && /413/.test(source));
check(
  'o tamanho do corpo é medido em BYTES (REV-09 — `raw.length` contaria caracteres)',
  /new TextEncoder\(\)\.encode\(raw\)\.length\s*>\s*MAX_BODY_BYTES/.test(source),
);
check(
  'o mapa do rate limit tem um teto (REV-08 — nunca cresce sem limite)',
  /maxTrackedIps/.test(source) && /submissions\.delete\(ip\)/.test(source),
);
check('o limite de submissões é de 20 por hora (F1)', /max:\s*20/.test(source) && /windowMs:\s*60 \* 60 \* 1000/.test(source));
check('o rate limit é por IP (CF-Connecting-IP)', source.includes('CF-Connecting-IP'));
check('a chave vem do ambiente, nunca do código', source.includes('env.RESEND_API_KEY') && !/RESEND_API_KEY\s*=\s*['"]/.test(source));
check('o envio é pelo Resend', source.includes('https://api.resend.com/emails'));
check(
  'a resposta tem os headers da Function (HSTS incluído)',
  source.includes("'Content-Type': 'application/json") &&
    source.includes("'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'") &&
    source.includes("'X-Robots-Tag': 'noindex'"),
);
check('os caracteres de controlo são limpos', /function clean\(/.test(source) && /CONTROL_CHARS\.test\(nome\)/.test(source));
check('o consentimento é exigido no servidor', /CONSENT_VALUES/.test(source));
check('o e-mail regista o consentimento', source.includes('Consentimento: sim'));

// O log: o objecto é extraído do **código** e as suas chaves são vistas.
const logCall = /console\.log\(\s*JSON\.stringify\(\{([\s\S]*?)\}\)/.exec(source);
check('o log tem um objecto identificável', Boolean(logCall), logCall ? '' : 'o console.log do log não foi encontrado');
if (logCall) {
  const keys = [...logCall[1].matchAll(/(?:^|[{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*[:,}]/g)].map((m) => m[1]);
  check(
    'o log não tem PII (nome, e-mail, telefone, mensagem, payload, IP)',
    !keys.some((key) => /nome|email|telefone|mensagem|payload|ip|hash/i.test(key)),
    keys.join(', '),
  );
  check('o log tem o `outcome` (sent | spam | invalid | limited | error)', keys.includes('outcome'), keys.join(', '));
  check('o log não tem o IP do visitante (SEC-N-07)', !source.includes('ipFingerprint') && !/ip:\s*fingerprint/.test(source));
}

// A CSP do site: `form-action 'self'` cobre um POST same-origin.
check(
  'a CSP do site é `form-action \'self\'`',
  readFileSync(resolve(process.cwd(), 'src/lib/csp.ts'), 'utf8').includes("form-action 'self'"),
);

// ===========================================================================
// 2. os testes de comportamento
// ===========================================================================
let mod = null;
if (!READS_TYPESCRIPT) {
  const tooOld = NODE_MAJOR < 22 || (NODE_MAJOR === 22 && NODE_MINOR < 6);
  console.log(
    tooOld
      ? `check-function: este Node (${process.version}) não lê TypeScript (precisa de ≥ 22.6) — ` +
          'a fase de COMPORTAMENTO é saltada; as asserções estáticas correm sempre. ' +
          'O job `functions` do CI (Node 22) é que corre a fase de comportamento.'
      : 'check-function: a fase de COMPORTAMENTO foi desactivada ' +
          '(`CHECK_FUNCTION_STATIC_ONLY=1`); as asserções estáticas correm sempre.',
  );
} else {
  try {
    mod = await import(pathToFileURL(SOURCE).href);
  } catch (error) {
    console.log(
      `check-function: a Function não pôde ser importada (${error.message}) — ` +
        'a fase de COMPORTAMENTO é saltada.',
    );
  }
}

if (mod) {
  const post = mod.onRequestPost;
  const ORIGEM = 'https://www.galastriadvocacia.com.br/api/contact';
  const CHAVE = 'chave-de-teste';

  /** As submissões que a Function tentou enviar (o `fetch` é interceptado). */
  const enviados = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    enviados.push({ url: String(url), body: init?.body });
    return new Response('{"id":"teste"}', { status: 200 });
  };

  /** Cada caso de teste usa um IP próprio (o rate limit é de 5/hora por IP). */
  let ipCounter = 0;

  /**
   * Chama a Function e devolve a resposta com os logs.
   *
   * @param {object} options
   */
  async function call({
    body,
    contentType = 'application/json',
    raw,
    env = { RESEND_API_KEY: CHAVE },
    headers = {},
  } = {}) {
    const logs = [];
    const logOriginal = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    ipCounter += 1;
    try {
      const init = {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'CF-Connecting-IP': `cliente-de-teste-${ipCounter}`,
          ...headers,
        },
      };
      if (raw !== undefined) init.body = raw;
      else init.body = JSON.stringify(body);
      const response = await post({ request: new Request(ORIGEM, init), env });
      return { response, logs, status: response.status, body: await response.clone().json().catch(() => null) };
    } finally {
      console.log = logOriginal;
    }
  }

  /** Um payload válido (o `_t` é o tempo decorrido). */
  const valido = (extra = {}) => ({
    nome: 'Dra. Ana Paula Galastri',
    email: 'teste@example.com',
    telefone: '(11) 99999-9999',
    mensagem: 'Mensagem de teste com mais de vinte caracteres.',
    consentimento: 'on',
    _gotcha: '',
    _t: 10_000,
    ...extra,
  });

  // --- o payload válido -> 200 e 'sent' -----------------------------------
  {
    const antes = enviados.length;
    const r = await call({ body: valido() });
    check('um payload válido devolve 200', r.status === 200, String(r.status));
    check('o log diz outcome:sent', r.logs.some((l) => l.includes('"outcome":"sent"')), r.logs.join(' | '));
    check('o e-mail foi enviado ao Resend', enviados.length === antes + 1 && enviados.at(-1).url.includes('api.resend.com'));
    check(
      'o e-mail regista o consentimento',
      String(enviados.at(-1)?.body ?? '').includes('Consentimento: sim'),
    );
  }

  // --- o tempo ---------------------------------------------------------------
  for (const [nome, t, esperado] of [
    ['rápido demais (100 ms)', 100, 400],
    ['ausente', undefined, 400],
    ['muito antigo (> 24 h)', 999_999_999_999, 400],
  ]) {
    const body = valido();
    if (t === undefined) delete body._t;
    else body._t = t;
    const r = await call({ body });
    check(`o _t ${nome} devolve ${esperado}`, r.status === esperado, String(r.status));
  }

  // --- o honeypot ------------------------------------------------------------
  for (const [nome, gotcha] of [
    ['com texto', 'preenchido'],
    ['com um array', ['x']],
    ['com um número', 0],
  ]) {
    const antes = enviados.length;
    const r = await call({ body: valido({ _gotcha: gotcha }) });
    check(`o honeypot ${nome} é descartado (200)`, r.status === 200, String(r.status));
    check(`o honeypot ${nome} não envia nada`, enviados.length === antes);
    check(
      `o honeypot ${nome} fica no log como spam`,
      r.logs.some((l) => l.includes('"outcome":"spam"')),
      r.logs.join(' | '),
    );
  }

  // --- o Content-Type ---------------------------------------------------------
  {
    const antes = enviados.length;
    const r = await call({ body: valido(), contentType: 'text/plain' });
    check('um Content-Type que não é JSON devolve 415', r.status === 415, String(r.status));
    check('o 415 não envia nada', enviados.length === antes);
    const tipo = r.response.headers.get('content-type') ?? '';
    check('o 415 responde com uma página HTML (sem JSON bruto)', tipo.includes('text/html'), tipo);
    check(
      'a resposta do 415 não tem headers de CORS',
      !r.response.headers.get('access-control-allow-origin'),
    );
  }

  // --- o nome com CR/LF ------------------------------------------------------
  {
    const r = await call({ body: valido({ nome: 'Ana\r\nBcc: teste@example.com' }) });
    check('um nome com CR/LF devolve 400', r.status === 400, String(r.status));
  }

  // --- o corpo grande --------------------------------------------------------
  {
    // (a) com o `Content-Length` declarado
    const r = await call({ body: valido({ mensagem: 'x'.repeat(20_000) }) });
    check('um corpo acima de 16 KB devolve 413', r.status === 413, String(r.status));
    // (b) sem o `Content-Length` (o tamanho real é lido)
    const r2 = await call({
      raw: JSON.stringify(valido({ mensagem: 'x'.repeat(20_000) })),
      headers: { 'Content-Length': '' },
    });
    check('um corpo grande sem Content-Length também devolve 413', r2.status === 413, String(r2.status));
    // (c) um corpo **multi-byte** (REV-09): o limite conta **bytes**, não
    //     caracteres — 6 000 emoji são 12 000 caracteres (abaixo do limite) mas
    //     24 000 bytes (acima) ✗.
    const rawMulti = JSON.stringify(valido({ mensagem: '😀'.repeat(6000) }));
    const caracteres = rawMulti.length;
    const bytes = new TextEncoder().encode(rawMulti).length;
    check(
      'o corpo multi-byte do teste tem menos de 16 384 caracteres e mais de 16 384 bytes',
      caracteres < 16384 && bytes > 16384,
      `${caracteres} caracteres / ${bytes} bytes`,
    );
    const r3 = await call({ raw: rawMulti, headers: { 'Content-Length': '' } });
    check(
      'um corpo multi-byte acima de 16 KB (medido em bytes) devolve 413',
      r3.status === 413,
      String(r3.status),
    );
  }

  // --- o consentimento em falta ---------------------------------------------
  {
    const body = valido();
    delete body.consentimento;
    const r = await call({ body });
    check('sem consentimento devolve 400', r.status === 400, String(r.status));
  }

  // --- o rate limit (F1) ----------------------------------------------------
  //
  // O limite de produção é de 20 submissões por IP por hora ✗. O auto-teste
  // usa um limite pequeno **em memória** (o `RATE_LIMIT` exportado é
  // mutável ✗) — o limite de produção **não muda** ✗.
  {
    const maxDeProducao = mod.RATE_LIMIT.max;
    check('o limite de produção é de 20 submissões por hora', maxDeProducao === 20, String(maxDeProducao));
    mod.RATE_LIMIT.max = 3;

    const ip = 'cliente-do-rate-limit';
    const estados = [];
    for (let i = 0; i < 4; i += 1) {
      const r = await call({ body: valido(), headers: { 'CF-Connecting-IP': ip } });
      estados.push(r.status);
    }
    check(
      'as submissões dentro do limite são aceites',
      estados.slice(0, 3).every((estado) => estado === 200),
      estados.join(', '),
    );
    check('a submissão a seguir ao limite é recusada com 429', estados[3] === 429, estados.join(', '));

    // Um payload **rejeitado pela validação** não consome o orçamento ✗: o
    // visitante não pode ficar bloqueado por um erro de preenchimento ✗.
    mod.RATE_LIMIT.max = 1;
    const invalidos = [];
    for (let i = 0; i < 3; i += 1) {
      const r = await call({
        body: { ...valido(), nome: '' },
        headers: { 'CF-Connecting-IP': 'cliente-que-erra' },
      });
      invalidos.push(r.status);
    }
    check(
      'um payload inválido responde 400 e não 429 (não consome o orçamento)',
      invalidos.every((estado) => estado === 400),
      invalidos.join(', '),
    );

    mod.RATE_LIMIT.max = maxDeProducao;
  }

  // --- o mapa do rate limit não cresce sem limite (REV-08) --------------------
  //
  // O `Map` é **em memória**, por isolate: cada IP visto deixava uma entrada
  // (mesmo vazia) e as entradas nunca saíam ✗. Agora a chave sai quando a
  // janela esvazia ✗ e o mapa tem um **teto** (as entradas mais antigas saem
  // quando o teto é ultrapassado) ✗.
  {
    const maxOriginal = mod.RATE_LIMIT.max;
    const tetoOriginal = mod.RATE_LIMIT.maxTrackedIps;

    // (a) um IP **recusado** (429) não fica guardado: não houve submissão ✗.
    mod.RATE_LIMIT.max = 0;
    const antes = mod.rateLimitSize();
    for (let i = 0; i < 5; i += 1) {
      await call({ body: valido(), headers: { 'CF-Connecting-IP': `ip-recusado-${i}` } });
    }
    check(
      'um IP recusado (429) não fica guardado no mapa do rate limit',
      mod.rateLimitSize() === antes,
      `${antes} → ${mod.rateLimitSize()}`,
    );
    mod.RATE_LIMIT.max = maxOriginal;

    // (b) o mapa nunca passa o teto ✗.
    mod.RATE_LIMIT.maxTrackedIps = 3;
    for (let i = 0; i < 10; i += 1) {
      await call({ body: valido(), headers: { 'CF-Connecting-IP': `ip-muitos-${i}` } });
    }
    check(
      'o mapa do rate limit nunca passa o teto (saem as entradas mais antigas)',
      mod.rateLimitSize() <= 3,
      String(mod.rateLimitSize()),
    );
    mod.RATE_LIMIT.maxTrackedIps = tetoOriginal;
  }

  // --- o log não tem PII ------------------------------------------------------
  {
    const r = await call({ body: valido() });
    const linha = r.logs.find((l) => l.includes('"outcome":"sent"')) ?? '';
    check(
      'o log não tem o nome, o e-mail, o telefone nem a mensagem',
      !/Ana Paula|teste@example\.com|99999-9999|Mensagem de teste/.test(linha),
      linha,
    );
    check('o log tem o estado, a duração e o outcome', /"status":\d+/.test(linha) && /"durationMs":\d+/.test(linha), linha);
  }

  // =========================================================================
  // O TESTE DE CONTRATO CLIENTE↔SERVIDOR (SEC-N-01)
  // =========================================================================
  // A expressão que o cliente calcula para o `_t` é **executada** (com um
  // `Date.now()` controlado) e o resultado é enviado à Function real.
  const atribuicao = /data\._t\s*=\s*([^;]+);/.exec(client);
  check('o cliente atribui o `_t`', Boolean(atribuicao), client.slice(0, 80));
  if (atribuicao) {
    const expressao = atribuicao[1].trim();
    check(
      'o cliente calcula o `_t` como o tempo decorrido (não um instante)',
      /Date\.now\(\)\s*-\s*openedAt/.test(expressao),
      expressao,
    );
    check('o cliente guarda o instante de abertura', /var openedAt = Date\.now\(\)/.test(client));

    // A expressão, com um `Date.now()` controlado: 10 s depois de abrir.
    const T = 1_700_000_000_000;
    const valor = new Function('Date', 'openedAt', `return ${expressao};`)(
      { now: () => T + 10_000 },
      T,
    );
    check('o valor que o cliente envia é o tempo decorrido', valor === 10_000, String(valor));

    // ...e a Function aceita-o (o contrato é cumprido).
    const r = await call({ body: valido({ _t: valor }) });
    check('a Function aceita o valor que o cliente calcula (200)', r.status === 200, String(r.status));
    check('e o log diz outcome:sent', r.logs.some((l) => l.includes('"outcome":"sent"')), r.logs.join(' | '));

    console.log(
      `check-function: contrato cliente↔servidor verificado — o \`form.js\` calcula ` +
        `\`Date.now() - openedAt\` (${valor} ms aqui) e a Function real **aceitou-o** (${r.status}).`,
    );
  }

  globalThis.fetch = fetchOriginal;
}

if (problems.length > 0) {
  console.error(`check-function: ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `check-function: ${ok.length} verificação(ões) OK — ` +
    (mod
      ? 'a Function valida, limita e não loga o payload (estático + comportamento).'
      : 'a Function valida, limita e não loga o payload (só as asserções estáticas).'),
);
