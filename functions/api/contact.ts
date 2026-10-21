/**
 * A Pages Function do formulário de contacto (SEC-67 / D86).
 *
 * O formulário publica **same-origin** para `POST /api/contact` — esta
 * Function — que valida o payload e envia o e-mail com o **Resend**. A
 * Function vive no **mesmo domínio** do site, por isso não há CORS e a CSP
 * pode ser `form-action 'self'`.
 *
 * A Function é um Worker por baixo (a Cloudflare Pages implanta-a com o
 * projecto, sem um Worker separado). Só usa as globais da plataforma
 * (`fetch`, `crypto`, `env`) — **zero dependências**.
 *
 * ⚠️ **Nunca** se registam no log o corpo da mensagem, o nome, o e-mail, o
 * telefone ou o IP do visitante. O log tem `{ ok, status, durationMs,
 * outcome, ray }` — o `CF-Ray` é o identificador do pedido na Cloudflare (e
 * o `CF-Connecting-IP` fica nos registos da própria Cloudflare).
 */

/** As variáveis de ambiente (o `RESEND_API_KEY` é um **segredo** do Pages). */
interface Env {
  RESEND_API_KEY?: string;
}

/** O contexto que a Cloudflare Pages entrega à Function. */
interface PagesContext {
  request: Request;
  env: Env;
}

/** O tipo de uma Pages Function, sem a dependência `@cloudflare/workers-types`. */
type PagesFunction = (context: PagesContext) => Promise<Response> | Response;

/** O destino das mensagens (a caixa institucional do escritório). */
const TO = 'contato@galastriadvocacia.com.br';

/** O remetente — o domínio tem de estar **verificado** no Resend. */
const FROM = `Galastri Advocacia <${TO}>`;

/** O endereço do Resend. */
const RESEND_URL = 'https://api.resend.com/emails';

/** O limite do corpo do pedido (SEC-N-15) — **16 KB**, medidos em **bytes** (REV-09). */
const MAX_BODY_BYTES = 16 * 1024;

/** Os limites da validação. */
const LIMITS = {
  nome: 120,
  email: 254,
  telefone: 19,
  mensagemMin: 20,
  mensagemMax: 4000,
} as const;

/**
 * O rate limit: **20 submissões por IP por hora**.
 *
 * ⚠️ **Porquê 20 e não 5:** o escritório e os seus visitantes partilham
 * muitas vezes o **mesmo endereço** (a NAT do operador, a rede do
 * escritório, um *proxy* corporativo ✗). Com 5, um visitante legítimo — ou o
 * escritório inteiro — ficava **sem o formulário**, que é o negócio ✗ (e
 * mediu-se isso em produção ✗: a partir do 6.º pedido tudo devolvia 429 ✗).
 * 20/h é o compromisso entre a protecção contra o abuso e o facto de **não
 * bloquear um cliente real** ✗.
 *
 * ⚠️ O orçamento é consumido **só** pelas tentativas que seriam de facto
 * enviadas ✗: um payload rejeitado pela validação **não** bloqueia o
 * visitante ✗ (e os caminhos de erro continuam testáveis ✗).
 *
 * ⚠️ É *best-effort* (um `Map` em memória, por isolate ✗): um isolate pode
 * ser descartado ✗ e há vários em paralelo ✗, por isso o limite **pode** ser
 * contornado com pedidos distribuídos ✗. **A correção durável é um rate limit
 * na WAF, à borda** (Cloudflare → Security → WAF → Rate limiting rules ✗) —
 * está **fora do âmbito** ✗ (precisa do painel da Cloudflare ✗, e a conta é
 * do dono ✗).
 *
 * A constante é **mutável** para o auto-teste poder usar um limite pequeno
 * sem mexer no limite de produção ✗.
 *
 * `maxTrackedIps` é o **teto** do `Map` do rate limit (REV-08): o mapa nunca
 * cresce sem limite — quando passa do teto, saem as entradas **mais antigas**
 * (as que já não podem bloquear ninguém) ✗.
 */
export const RATE_LIMIT = {
  max: 20,
  windowMs: 60 * 60 * 1000,
  maxTrackedIps: 5000,
};

/**
 * O tempo **decorrido** desde a abertura da página.
 *
 * ⚠️ O cliente manda o **tempo decorrido** (não um *timestamp*): assim o
 * relógio do dispositivo não interfere (um relógio 3 s atrás ou 24 h à frente
 * não valida nem reprova o pedido — SEC-N-01).
 */
const MIN_ELAPSED_MS = 3000;
const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000;

/** Um e-mail plausível (o front-end valida também, mas o servidor decide). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Os valores de consentimento aceites (o `checkbox` do browser manda "on"). */
const CONSENT_VALUES = new Set(['on', 'true', 'sim', 'yes', '1']);

/** Os caracteres de controlo que não podem entrar num cabeçalho nem no corpo. */
const CONTROL_CHARS = /[\r\n\t\u0000-\u001F\u007F]/;

/**
 * O rate limit — um `Map` **em memória**, por isolate.
 *
 * ⚠️ É *best-effort*: um isolate pode ser descartado a qualquer momento (e
 * reiniciar a partir do zero) e há vários isolates em paralelo, por isso o
 * limite **pode** ser contornado com pedidos distribuídos. A correção
 * durável é um binding de **KV** ou uma **Durable Object** — está fora do
 * âmbito deste projecto (e exigiria um plano pago).
 */
const submissions = new Map<string, number[]>();

/**
 * O mapa do rate limit nunca cresce sem limite (REV-08).
 *
 * Quando passa do teto (`RATE_LIMIT.maxTrackedIps`), saem as entradas **mais
 * antigas** — a mais antiga é a que tem o *timestamp* mais antigo ✗ (e não a
 * que foi inserida primeiro: um IP que repete dentro da janela tem de contar
 * pela **data** da submissão ✗).
 */
function evictOldest(): void {
  if (submissions.size <= RATE_LIMIT.maxTrackedIps) return;
  const entries = [...submissions.entries()].sort(
    (a, b) => (a[1][0] ?? 0) - (b[1][0] ?? 0),
  );
  for (const [ip] of entries) {
    if (submissions.size <= RATE_LIMIT.maxTrackedIps) break;
    submissions.delete(ip);
  }
}

/**
 * O IP já gastou o orçamento?
 *
 * ⚠️ Esta função **não** consome nada ✗ — o consumo acontece em
 * `recordSubmission()` ✗, e só quando o pedido é de facto enviado ✗.
 *
 * ⚠️ O IP **só** entra no mapa quando tem submissões dentro da janela ✗:
 * um IP visto (e recusado) não deixa rasto ✗ — era isso que fazia o mapa
 * crescer com cada IP que aparecia ✗ (REV-08).
 *
 * @param ip the address of the client
 * @returns {boolean} true when the IP is over the limit
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (submissions.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (times.length === 0) {
    // A janela esvaziou (ou o IP é novo): a chave **sai** do mapa ✗.
    submissions.delete(ip);
  } else {
    submissions.set(ip, times);
  }
  evictOldest();
  return times.length >= RATE_LIMIT.max;
}

/**
 * Consome uma unidade do orçamento do IP.
 *
 * @param ip the address of the client
 */
function recordSubmission(ip: string): void {
  const now = Date.now();
  const times = (submissions.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  times.push(now);
  submissions.set(ip, times);
  evictOldest();
}

/**
 * O número de IPs guardados no mapa do rate limit.
 *
 * ⚠️ É um **teste** (o `check-function`): não expõe nenhum valor, só a
 * contagem ✗ — e não é alcançável por HTTP ✗.
 *
 * @returns {number}
 */
export function rateLimitSize(): number {
  return submissions.size;
}

/**
 * Limpa um valor: tira os CR/LF/TAB e os caracteres de controlo C0 (o que
 * impede a injecção de cabeçalhos no e-mail) e normaliza os espaços.
 *
 * @param value the raw value
 * @returns {string} the cleaned value
 */
function clean(value: string): string {
  return value.replace(/[\r\n\t\u0000-\u001F\u007F]/g, ' ').replace(/ {2,}/g, ' ').trim();
}

/**
 * A resposta JSON da Function — sempre com os mesmos headers.
 *
 * ⚠️ O ficheiro `_headers` **não** se aplica às respostas de uma Function
 * (a Cloudflare Pages não aplica os headers do `_headers` às respostas
 * geradas por código) — por isso são aqui, à mão (HSTS incluído, SEC-N-14).
 *
 * @param status the HTTP status
 * @param body the JSON body
 * @returns {Response}
 */
function json(status: number, body: { ok: boolean; error?: string }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Robots-Tag': 'noindex',
    },
  });
}

/**
 * A resposta HTML mínima — para quem **não** tem JavaScript (o formulário
 * sem JS faz um POST `form-urlencoded`, que a Function não aceita) e para o
 * `Content-Type` errado (SEC-N-17). Sem CORS, sem *tracking*.
 *
 * @param status the HTTP status
 * @param message the message to show
 * @returns {Response}
 */
function html(status: number, message: string): Response {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex"><title>Envio indisponível</title></head>` +
      `<body><main><h1>Não foi possível enviar a mensagem</h1>` +
      `<p>${message}</p>` +
      `<p>Prefere falar connosco? <a href="https://wa.me/5511985665992">WhatsApp</a>.</p>` +
      `</main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}

/** O resultado da validação. */
interface Validation {
  /** a mensagem de erro (null quando o payload é válido). */
  error: string | null;
  /** true quando o honeypot está preenchido (spam): a resposta é a de sucesso. */
  spam: boolean;
}

/**
 * A validação do payload — **toda** no servidor, independentemente do que o
 * navegador tenha feito.
 *
 * @param payload the body, already parsed
 * @returns {Validation}
 */
function validate(payload: Record<string, unknown>): Validation {
  const text = (key: string): string =>
    typeof payload[key] === 'string' ? (payload[key] as string).trim() : '';

  // O honeypot: um campo preenchido é um bot — a resposta é a mesma de uma
  // submissão válida (o bot não deve saber que foi detectado). O valor é
  // lido como texto: `["x"]`, `0` ou um objeto **também** são spam
  // (SEC-N-04).
  const gotcha = String(payload._gotcha ?? '').trim();
  if (gotcha !== '') return { error: null, spam: true };

  const nome = text('nome');
  if (nome === '') return { error: 'O campo "nome" é obrigatório.', spam: false };
  // O `nome` vai para o **assunto** do e-mail (um cabeçalho MIME): um CR/LF
  // ou um carácter de controlo é **rejeitado**, nunca corrigido em silêncio
  // (SEC-N-05).
  if (CONTROL_CHARS.test(nome)) {
    return { error: 'O campo "nome" tem caracteres inválidos.', spam: false };
  }
  if (nome.length > LIMITS.nome) {
    return { error: `O campo "nome" não pode ter mais de ${LIMITS.nome} caracteres.`, spam: false };
  }

  const email = text('email');
  if (email === '') return { error: 'O campo "email" é obrigatório.', spam: false };
  if (email.length > LIMITS.email || !EMAIL_PATTERN.test(email)) {
    return { error: 'O campo "email" não é válido.', spam: false };
  }

  const telefone = text('telefone');
  if (telefone === '') return { error: 'O campo "telefone" é obrigatório.', spam: false };
  if (telefone.length > LIMITS.telefone) {
    return { error: `O campo "telefone" não pode ter mais de ${LIMITS.telefone} caracteres.`, spam: false };
  }

  const mensagem = text('mensagem');
  if (mensagem === '') return { error: 'O campo "mensagem" é obrigatório.', spam: false };
  if (mensagem.length < LIMITS.mensagemMin) {
    return { error: `O campo "mensagem" tem de ter pelo menos ${LIMITS.mensagemMin} caracteres.`, spam: false };
  }
  if (mensagem.length > LIMITS.mensagemMax) {
    return { error: `O campo "mensagem" não pode ter mais de ${LIMITS.mensagemMax} caracteres.`, spam: false };
  }

  // O tempo **decorrido** (o cliente manda-o já em ms, não um timestamp):
  // menos de 3 s é um bot, mais de 24 h é uma página velha (SEC-N-01).
  if (payload._t === undefined || payload._t === null) {
    return { error: 'O campo "_t" é obrigatório.', spam: false };
  }
  const elapsed = Number(payload._t);
  if (!Number.isFinite(elapsed)) {
    return { error: 'O campo "_t" não é válido.', spam: false };
  }
  if (elapsed < MIN_ELAPSED_MS) {
    return { error: 'A mensagem foi enviada demasiado depressa.', spam: false };
  }
  if (elapsed > MAX_ELAPSED_MS) {
    return { error: 'A página está desatualizada. Recarregue e tente de novo.', spam: false };
  }

  // O consentimento (art. 8º/9º da LGPD): é **exigido** no servidor e fica
  // registado no e-mail (SEC-N-19).
  const consent = String(payload.consentimento ?? '').trim().toLowerCase();
  if (!CONSENT_VALUES.has(consent)) {
    return { error: 'É necessário autorizar o tratamento de dados para enviar a mensagem.', spam: false };
  }

  return { error: null, spam: false };
}

/**
 * O tratamento do `POST /api/contact`.
 *
 * @param context the context of the Pages Function
 * @returns {Promise<Response>}
 */
async function handle({ request, env }: PagesContext): Promise<Response> {
  const started = Date.now();
  const ray = request.headers.get('CF-Ray') ?? null;
  const ip = request.headers.get('CF-Connecting-IP') ?? 'desconhecido';

  /**
   * O registo. ⚠️ **Sem PII**: nem o nome, nem o e-mail, nem o telefone,
   * nem a mensagem, nem o IP (SEC-N-07 — o `CF-Ray` correlaciona com os
   * registos da Cloudflare, que têm o IP).
   *
   * @param outcome o que aconteceu
   * @param status o estado HTTP
   */
  const log = (outcome: 'sent' | 'spam' | 'invalid' | 'limited' | 'error', status: number): void => {
    console.log(
      JSON.stringify({
        ok: status < 400,
        status,
        durationMs: Date.now() - started,
        outcome,
        ray,
      }),
    );
  };

  // --- o Content-Type (SEC-N-03) --------------------------------------------
  // Sem esta exigência, uma página de um terceiro pode mandar um POST
  // `text/plain` (um *simple request*, sem *preflight*) e usar a Function
  // como relay de spam para a caixa do escritório. Com o `Content-Type`
  // exigido, um POST JSON de outra origem precisa de *preflight* — e a
  // Function não responde a `OPTIONS` com nenhum `Access-Control-Allow-Origin`.
  const contentType = (request.headers.get('Content-Type') ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    log('invalid', 415);
    return html(
      415,
      'O formulário precisa de JavaScript. Se preferir, envie a sua mensagem por WhatsApp.',
    );
  }

  // --- o tamanho do corpo (SEC-N-15) -----------------------------------------
  const declaredLength = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    log('invalid', 413);
    return json(413, { ok: false, error: 'O pedido é demasiado grande.' });
  }

  // --- o corpo --------------------------------------------------------------
  // O `Content-Length` é a primeira barreira; o **tamanho real** lido é a
  // segunda (um pedido sem `Content-Length` não escapa ao limite).
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    log('invalid', 400);
    return json(400, { ok: false, error: 'O corpo do pedido não pôde ser lido.' });
  }
  // ⚠️ O tamanho é medido em **bytes** (REV-09): `raw.length` conta unidades
  // UTF-16, e um payload multi-byte (acentos, emoji) pode ser ~3× maior do
  // que o limite permite ✗.
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    log('invalid', 413);
    return json(413, { ok: false, error: 'O pedido é demasiado grande.' });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    log('invalid', 415);
    return json(415, { ok: false, error: 'O corpo do pedido não é um JSON válido.' });
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    log('invalid', 400);
    return json(400, { ok: false, error: 'O corpo do pedido tem de ser um objeto.' });
  }

  // --- a validação ----------------------------------------------------------
  const { error, spam } = validate(payload);
  if (spam) {
    // O honeypot preenchido devolve a **mesma** resposta de uma submissão
    // válida — o bot não recebe nenhum sinal. Mas o **log** distingue
    // (SEC-N-06): `outcome: 'spam'`.
    log('spam', 200);
    return json(200, { ok: true });
  }
  if (error) {
    log('invalid', 400);
    return json(400, { ok: false, error });
  }

  // --- o segredo ------------------------------------------------------------
  const key = env.RESEND_API_KEY;
  if (!key) {
    // A mensagem é genérica e **só** se regista a falta da configuração — o
    // valor do segredo nunca é registado.
    console.error('RESEND_API_KEY is not configured');
    log('error', 500);
    return json(500, {
      ok: false,
      error: 'Não foi possível enviar a mensagem agora. Fale conosco pelo WhatsApp.',
    });
  }

  // --- o limite de submissões (F1) -----------------------------------------
  // O limite só é aplicado (e o orçamento só é consumido) a partir daqui: um
  // pedido **rejeitado pela validação** não pode bloquear o visitante ✗.
  if (isRateLimited(ip)) {
    log('limited', 429);
    return json(429, {
      ok: false,
      error: 'Demasiadas tentativas a partir deste endereço. Tente novamente mais tarde.',
    });
  }

  // --- o envio --------------------------------------------------------------
  const nome = clean(String(payload.nome).trim());
  const email = String(payload.email).trim();
  const telefone = clean(String(payload.telefone).trim());
  const mensagem = clean(String(payload.mensagem).trim());

  // A partir daqui a mensagem **é enviada** — o orçamento do IP consome-se.
  recordSubmission(ip);

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Nova mensagem — ${nome}`,
        text: [
          `Nome: ${nome}`,
          `E-mail: ${email}`,
          `Telefone: ${telefone}`,
          'Consentimento: sim',
          '',
          mensagem,
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      // ⚠️ O corpo do Resend **não** é devolvido ao cliente (pode trazer o
      // endereço da conta ou a chave); fica só o estado.
      console.error(`the Resend API answered with ${response.status}`);
      log('error', 500);
      return json(500, {
        ok: false,
        error: 'Não foi possível enviar a mensagem agora. Fale conosco pelo WhatsApp.',
      });
    }
  } catch {
    console.error('the Resend API could not be reached');
    log('error', 500);
    return json(500, {
      ok: false,
      error: 'Não foi possível enviar a mensagem agora. Fale conosco pelo WhatsApp.',
    });
  }

  log('sent', 200);
  return json(200, { ok: true });
}

/** O `POST /api/contact`. */
export const onRequestPost: PagesFunction = handle;

/** Os métodos que não são `POST` (a Function só aceita `POST`). */
export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === 'POST') return handle(context);
  return json(405, { ok: false, error: 'Método não permitido.' });
};
