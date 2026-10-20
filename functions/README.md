# `functions/` — as Pages Functions

As funções deste directório são implantadas pela **Cloudflare Pages** com o
projecto (é um Worker por baixo, mas **não** é preciso criar um Worker
separado). A rota é o caminho do ficheiro: `functions/api/contact.ts` →
`POST /api/contact` (o caminho **relativo** — o formulário resolve-o contra o
host que serve a página).

> A Function vive no **mesmo domínio** do site: por isso **não há CORS** e a
> CSP pode ser `form-action 'self'`.

## `api/contact.ts` — o formulário de contacto

| | |
|---|---|
| Método | `POST` (qualquer outro → `405`) |
| Corpo | `application/json`: `{ nome, email, telefone, mensagem, consentimento, _gotcha, _t }` — o `_t` é o **tempo decorrido** desde a abertura da página (em ms), **não** um *timestamp* (assim o relógio do dispositivo não interfere) |
| Resposta | `200 { ok: true }` · `400 { ok: false, error }` · `429 { ok: false, error }` · `500 { ok: false, error }` |
| Validação | 4 campos obrigatórios · e-mail plausível · mensagem entre 20 e 4000 caracteres · `nome` ≤ 120 · `telefone` ≤ 19 · `_gotcha` **vazio** · **consentimento** pedido · `_t` (o decorrido) entre 3 s e 24 h · `Content-Type: application/json` (senão `415`) · corpo ≤ 16 KB (senão `413`) · um CR/LF no `nome` é recusado (`400`) |
| Limite | 5 submissões por IP por hora (`Map` em memória — *best-effort*, ver o comentário no código) |
| Envio | `POST https://api.resend.com/emails` (Resend) |
| Log | só `{ ok, status, durationMs }` e um prefixo do hash do IP — **nunca** o payload, o nome ou o e-mail do visitante |

O `_gotcha` é o **honeypot** (o campo escondido): um bot que o preencha recebe
a mesma resposta de sucesso e a mensagem **não** é enviada.

## O segredo `RESEND_API_KEY`

A Function lê `env.RESEND_API_KEY` — um **segredo** do projecto (nunca uma
variável, nunca no código, nunca no `dist/`).

**No painel** (a forma que o dono vai usar):

1. Cloudflare Dashboard → **Workers & Pages** → o projecto
   (`galastriadvocacia`) → **Settings** → **Environment variables**.
2. **Production** → **Add** → `RESEND_API_KEY` → tipo **Secret** → colar a
   chave do Resend → **Save**.
3. Repetir em **Preview** (as pre-visualizações precisam da chave para
   testar o formulário).

**Na linha de comando** (com o `wrangler` instalado):

```bash
wrangler pages secret put RESEND_API_KEY --project-name galastriadvocacia
```

O comando pergunta pelo valor (não vai para o histórico do shell) e grava-o
como segredo ** cifrado** no projecto.

> A chave nunca é lida pelo `npm run build` nem entra no `dist/`: só a
> Function a usa, no momento do envio.

## O domínio de envio tem de estar verificado no Resend

O `from` é `Galastri Advocacia <contato@galastriadvocacia.com.br>`: o Resend
só envia de um domínio **verificado**.

1. Resend → **Domains** → **Add Domain** → `galastriadvocacia.com.br`.
2. O Resend dá os registos **SPF** e **DKIM** → criar no DNS da zona
   (Cloudflare) com o proxy **desligado** (nuvem cinzenta) — são registos de
   TXT/CNAME de verificação.
3. Voltar ao Resend → o estado do domínio passa a **Verified**.

Sem a verificação, o Resend devolve `403` e a Function responde `500` com a
mensagem genérica (o erro do Resend **não** é devolvido ao visitante).

## Testar a Function localmente

O `wrangler` corre as Pages Functions localmente:

```bash
npm run build
npx wrangler pages dev dist
curl -i -X POST http://localhost:8788/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Teste","email":"teste@example.com","telefone":"(11) 99999-9999","mensagem":"Mensagem de teste com mais de vinte caracteres.","consentimento":"on","_gotcha":"","_t":10000}'
# (o "_t" é o TEMPO DECORRIDO em ms: 10000 = 10 s depois de abrir a página)
```

> O `wrangler` **não** é uma dependência do projecto: é uma ferramenta
> opcional do dono (instala-se à parte, `npm i -g wrangler`). O CI e o build
> de produção **não** precisam dele.
