# DEPLOY — publicação em `https://www.galastriadvocacia.com.br`

> **Estado:** o repositório é **público** (`devCarlosHenSil/galastriadvocacia`).
> A **publicação é da Cloudflare Pages** (a integração com o Git): a
> Cloudflare constrói o repositório e publica-o. O workflow do GitHub
> **só verifica** (é o check `build` que a branch protection de `main`
> exige) — não publica nada.
>
> **Gate duro (SEC-67):** o **build de produção** da Cloudflare Pages falha
> enquanto **qualquer** uma das **12** rotações de segredos de
> `docs/rotation-gate.md` estiver por fazer. ⚠️ **Não se "arrume" o gate**
> (nem se apague a linha do `rotation-gate.md`): publicar antes da rotação
> equivale a publicar as credenciais do backup.
>
> ⚠️ **Mas o gate está CONTORNADO:** o `ROTATION_GATE=skip` está no ambiente
> de **Production** (decisão **D88** do dono, 2026-10-20) — o build **passa**
> ✗ e o site **está no ar** ✗, com as 12 rotações **por fazer** ✗ (prazo:
> 2026-11-19 ✗). Para voltar a bloquear: **tirar a variável** ✗.
>
> **Gate de redação (SEC-66):** `node scripts/guard-secrets.mjs` tem de passar
> **com `docs/` no escopo** e o bloco de redação tem de devolver **0 linhas**.

---

## 1. O projecto da Cloudflare Pages

| Definição | Valor |
|---|---|
| Nome do projecto | `galastriadvocacia` (o subdomínio fica `galastriadvocacia.pages.dev`) |
| Source | **Git** → `devCarlosHenSil/galastriadvocacia` |
| Production branch | `feat/cloudflare-pages-worker` (⚠️ **provisório** — ver `docs/PROJECT-STATE.md` §20) |
| Build command | `node scripts/build-pages.mjs` |
| Build output directory | `dist` |
| Node version | **20** (a variável `NODE_VERSION=20`) |
| Custom domain | `www.galastriadvocacia.com.br` (o **endereço público** — decisão do dono, 2026-10-20; o apex redirecciona para cá) |

> ⚠️ O **build command** **tem** de ser `node scripts/build-pages.mjs` e não
> `npm run build`: o wrapper é o que corre o **gate da rotação** no build de
> produção (SEC-67) e **salta-o** nas pre-visualizações (uma pré-visualização
> não é uma publicação).

### As variáveis do projecto

| Variável | Tipo | Valor | Onde |
|---|---|---|---|
| `PUBLIC_CONTACT_ENDPOINT` | Variable | `/api/contact` (o caminho **relativo** — o mesmo em todos os hosts) | **Production** e **Preview** |
| `RESEND_API_KEY` | **Secret** | a chave do Resend (§5) | **Production** (o **Preview não tem** ✗ — a chave exposta foi removida de lá ✗) |
| `ROTATION_GATE` | Variable | `skip` — **a decisão D88 do dono** (§22 do PROJECT-STATE): publica-se antes das 12 rotações. O valor por omissão (`enforce`) bloqueia a publicação ✗ | **Production** (só) |

> O `PUBLIC_CONTACT_ENDPOINT` **não é um segredo**: é o caminho da Function do
> próprio site. É **relativo** (`/api/contact`) de propósito: o formulário
> resolve-o contra o host que serve a página — o domínio canónico, a
> pré-visualização `*.pages.dev` **ou** o `localhost` do `npm run dev`. Por
> isso o **mesmo** valor serve em local, em produção e em pré-visualização.
> (Um URL absoluto `https://<dominio>/api/contact` também é aceite pela
> validação do `Form.astro`, mas parte-o é a opção que **não** quebra a
> pré-visualização.)

---

## 2. O DNS (a zona `galastriadvocacia.com.br`, na Cloudflare)

> **O estado em 2026-10-20 (medido na API da Cloudflare).** Estes são os
> registos que **existem** — não o que se pretende.

| Registro | Tipo | Valor | Proxy |
|---|---|---|---|
| `www.galastriadvocacia.com.br` | CNAME | `galastriadvocacia.pages.dev` | **ligado (laranja)** |
| `galastriadvocacia.com.br` (apex) | CNAME | `galastriadvocacia.pages.dev` | **ligado (laranja)** — e um **Redirect Rule 301** para o `www` |
| `galastriadvocacia.com.br` | MX ×3 | `mx.zoho.com`, `mx2.zoho.com`, `mx3.zoho.com` | desligado |
| `galastriadvocacia.com.br` | TXT (SPF) | `v=spf1 include:zohomail.com include:amazonses.com ~all` | desligado |
| `galastriadvocacia.com.br` | TXT (DKIM) | `resend._domainkey` | desligado |
| `send.galastriadvocacia.com.br` | MX | `feedback-smtp.us-east-1.amazonses.com` | desligado |
| `send.galastriadvocacia.com.br` | TXT (SPF) | `v=spf1 include:amazonses.com ~all` | desligado |
| `rsend.galastriadvocacia.com.br` | CNAME | `send.forge.rmta.net` | desligado |
| ~~`aapanel.galastriadvocacia.com.br`~~ · ~~`www.aapanel.…`~~ · ~~`ftp.…`~~ | A | **apagados** (2026-10-20 ✗) — apontavam para o host antigo do WordPress ✗ e não são necessários ✗ | — |
| ~~`*.galastriadvocacia.com.br`~~ | — | **apagado** (o *wildcard* antigo) | — |

Os **nameservers** não mudam (`anna.ns.cloudflare.com` e
`jaime.ns.cloudflare.com`).

### 2.1 O `www` é o endereço canónico — e o apex redirecciona para ele

> **A decisão do dono (2026-10-20, D91): o `www` é o endereço público.** O
> apex (`galastriadvocacia.com.br`) **redirecciona 301** para o `www` ✗ —
> **não se apaga o `www`** ✗ (a decisão D86, que o apagava ✗, foi
> **substituída** ✗).

⚠️ **A Cloudflare Pages recria o CNAME do `www` por conta própria** (já
aconteceu uma vez, ao adicionar o domínio personalizado). Por isso:

> **O `www` tem de ser verificado depois de cada deploy** ✗ — mas agora o
> que se verifica é que **continua a resolver** ✗ (nunca que se apaga ✗).
> Sem proxy, o ficheiro `public/_headers` **continua** a ser aplicado (é a
> Cloudflare Pages que o aplica, antes do proxy) — mas o proxy é o que dá o
> **certificate** e o **Anycast** do domínio.

Verificar:

```bash
dig +short www.galastriadvocacia.com.br CNAME   # galastriadvocacia.pages.dev
dig +short galastriadvocacia.com.br CNAME      # galastriadvocacia.pages.dev (o apex redirecciona)
curl -sI https://www.galastriadvocacia.com.br/ | head -1        # HTTP/2 200
curl -sI https://galastriadvocacia.com.br/      | head -3        # 301 para o www
```

> **O endereço público é o `www`** (decisão do dono, 2026-10-20, D91): é o que
> o sitemap, os `canonical`, o `og:url` e o JSON-LD anunciam ✗. O apex
> **redirecciona 301** para o `www` ✗ (a **Single Redirect** da zona ✗ — o
> ficheiro `_redirects` **não** distingue hosts ✗; o *Worker*
> `galastri-apex-redirect` é a rede de segurança ✗ — ver a §10.3 ✗).
> O *wildcard* antigo continua apagado ✗.
>
> ✅ **Feito (2026-10-20):** os registos `aapanel.` ✗, `www.aapanel.` ✗ e
> `ftp.` ✗ — que apontavam para o host antigo do WordPress ✗ — foram
> **apagados** ✗.

### 2.2 O SPF do apex — a fusão com o do Resend

O domínio do Resend (`galastriadvocacia.com.br`, `verified`, `us-east-1`)
precisa de um SPF no apex. O SPF do Zoho **não** pode simplesmente ser
substituído (a caixa do escritório deixaria de receiving), por isso foi
**fundido**:

| | valor |
|---|---|
| **antes** | `v=spf1 include:zohomail.com ~all` (só a Zoho) |
| **depois** | `v=spf1 include:zohomail.com include:amazonses.com ~all` |

O registo é o **TXT do apex** (o `id` **não** fica escrito aqui — a guarda
reprova um `id` de 32 hex como se fosse uma API key; procurá-lo em tempo de
execução é mais seguro). **Reverter** (o `include:amazonses.com` sai, a Zoho
fica como estava):

```bash
# 1. o id do registo (o TXT do apex)
ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=TXT&name=galastriadvocacia.com.br" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).result[0].id))")

# 2. o SPF volta a ser o da Zoho
curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"TXT","name":"galastriadvocacia.com.br","content":"v=spf1 include:zohomail.com ~all","ttl":1,"proxied":false}'
```

> A `ZONE_ID` é o id da zona — também **não** fica versionado (a guarda
> reprova-o pela mesma razão); o `deployer` tem-no no painel.

> ⚠️ Um SPF tem **um** registo `v=spf1` por domínio: dois TXT com SPF
> fecham o dominio com `permerror` e **nada** é entregue. A fusão é
> obrigatória — nunca dois TXT.

---

## 3. Os headers de segurança — `public/_headers`

A Cloudflare Pages aplica nativamente o ficheiro `public/_headers` (e o
`public/_redirects`). **Não há Transform Rules**: os headers saem do ficheiro
que vai no `dist/`.

> ⚠️ O `_headers` **não** se aplica às respostas das **Pages Functions**
> (`functions/`) — essas respostas trazem os seus próprios headers (ver
> `functions/api/contact.ts`).

O ficheiro (a fonte da verdade é `src/lib/csp.ts`; o `npm run verify-csp`
compara os **três** sítios — o módulo, este ficheiro e o runbook):

```
/*
	Strict-Transport-Security: max-age=31536000; includeSubDomains
	X-Content-Type-Options: nosniff
	X-Frame-Options: DENY
	Referrer-Policy: strict-origin-when-cross-origin
	Permissions-Policy: geolocation=(self "https://www.google.com"), microphone=(), camera=(), payment=(), usb=(), browsing-topics=()
	Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.gstatic.com https://www.google.com https://www.googletagservices.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https://www.google.com https://maps.gstatic.com https://maps.google.com https://*.googleusercontent.com https://*.ggpht.com https://www.gstatic.com; connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.google.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.googletagservices.com; frame-src 'self' https://www.google.com https://maps.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.gstatic.com; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests

# A pre-visualização e o hostname `*.pages.dev` não são indexados
# (SEC-59). O domínio canónico é `www.galastriadvocacia.com.br`.
https://:project.pages.dev/*
	X-Robots-Tag: noindex
```

> `'unsafe-inline'` em `script-src` é **obrigatório** (o snippet do GTM é
> inline por desenho) e em `style-src` (o CSS gerado pelo Elementor usa
> `style="..."` inline). A consequência — a CSP **não** bloqueia XSS inline —
> está registada em `docs/SPEC-SECURITY.md` SEC-42.
>
> `form-action 'self'` (D86): o formulário publica para a Function **do
> próprio site** — não há domínio externo no `form-action`.
>
> ⚠️ O `<meta http-equiv>` do layout é apenas o **fallback** (aceita CSP e
> Referrer-Policy; `nosniff`, `Permissions-Policy` e HSTS são ignorados em
> `<meta>`). E o `<meta>` **não transporta** `frame-ancestors` nem
> `upgrade-insecure-requests` — as duas directivas só existem no header.

Verificar:

```bash
curl -sI https://galastriadvocacia.com.br/ | grep -Ei "strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|content-security-policy"
```

### 3.1 O 301 do `/home/` — o ficheiro `_redirects` da Cloudflare Pages

```
/home/	/	301
```

`src/data/redirects.json` é a **fonte da verdade** (1 entrada) e
`public/_redirects` é a **declaração** desse registo (o que *deveria*
redirecionar) ✗.

> ⚠️ **O ficheiro `_redirects` só produz o 301 se a origem **não** tiver um
> activo estático.** Mediu-se em produção (2026-10-20): com o ficheiro
> `public/_redirects` a servir o `/home/` → `301`, a resposta era **200** —
> o **ficheiro estático** (`/home/index.html`) ganha ao ficheiro de regras ✗.
>
> **Por isso o alias `/home/` deixou de ser construído** ✗ (a página
> `src/pages/home.astro` **não existe** ✗): sem activo estático, o pedido
> não casa com nenhum ficheiro e a regra dos `_redirects` aplica-se ✗ →
> **301 → `/`** ✗.
>
> ⚠️ **Se alguém recriar a página do alias, o 301 deixa de funcionar** ✗ (e
> o `npm run check-redirects` **reprova** ✗ — é o invariante que o garante
> ✗).

**A zona não tem nenhuma regra para o `/home/`** ✗ — a **única** regra da
zona é o **apex → `www`** ✗ (a que está medida ✗):

| Campo | Valor |
|---|---|
| **A regra** | `apex_para_www` ✗ (ruleset `3d30cd8a…` ✗ · fase `http_request_dynamic_redirect` ✗) |
| **When incoming requests match** (a expressão) | o host **apex** (`galastriadvocacia.com.br`) ✗ |
| **Then** (a acção) | *Static redirect* (URL rewrite) ✗ |
| **Target URL** | `https://www.galastriadvocacia.com.br/` ✗ |
| **Status code** | **301** (permanente) ✗ |
| **Preserve query string** | **Ligado** (o `?utm_source=…` passa intacto ✗) |

O **apex** responde 301 para `https://www.galastriadvocacia.com.br/` ✗ — e o
`www` responde **200** ✗. O *Worker* `galastri-apex-redirect` ✗ é a rede de
segurança para o mesmo 301 ✗ (ver a §10.3 ✗).

> **O que está medido:** antes desta correcção, `https://www.galastriadvocacia.com.br/home/`
> respondia **200** (a home servida de `/home/index.html` ✗) ✗. **Depois**
> de o alias deixar de ser construído ✗, o `_redirects` da Cloudflare Pages
> aplica-se ✗ → **301** para `https://www.galastriadvocacia.com.br/` ✗.

O `/home/` **já não é uma página** ✗ (o alias é só um 301 ✗) — não há
segunda cópia da home ✗ nem `canonical` duplicado ✗.

---

## 4. O formulário — a Pages Function

O formulário publica **same-origin** para
`POST /api/contact`, a **Pages Function** do próprio site (é um Worker por
baixo, implantado com o projecto — não é preciso criar um Worker separado).
A Function valida o payload, aplica o limite de submissões e envia o e-mail
com o **Resend**.

| | |
|---|---|
| Rota | `POST /api/contact` (relativo — no domínio canónico, `https://galastriadvocacia.com.br/api/contact`) |
| Corpo | `application/json`: `{ nome, email, telefone, mensagem, consentimento, _gotcha, _t }` — o `_t` é o **tempo decorrido** desde a abertura da página (em ms), **não** um *timestamp* |
| Resposta | `200 { ok: true }` · `400 { ok: false, error }` · `429` · `500` |
| Validação | 4 campos obrigatórios · e-mail plausível · mensagem entre 20 e 4000 caracteres · `nome` ≤ 120 · `telefone` ≤ 19 · `_gotcha` **vazio** · **consentimento** pedido · `_t` (o decorrido) entre 3 s e 24 h · `Content-Type: application/json` (senão `415`) · corpo ≤ 16 KB (senão `413`) |
| Limite | **20 submissões por IP por hora** (F1, em memória e *best-effort*) — e o orçamento **só** é consumido pelas tentativas que seriam **de facto enviadas** ✗: um payload rejeitado pela validação **não** bloqueia o visitante ✗. O mapa dos IPs tem um **teto** (REV-08 ✗): quando o passa, saem as entradas mais antigas ✗ |
| Envio | `POST https://api.resend.com/emails` (Resend) |
| Log | só `{ ok, status, durationMs, outcome, ray }` — **sem PII** ✗ (nem o IP, nem um *hash* do IP ✗: o `CF-Ray` é o identificador do pedido na Cloudflare ✗) |

O `from` é `Galastri Advocacia <contato@galastriadvocacia.com.br>` e o `to` é
o mesmo endereço; o `reply_to` é o e-mail de quem escreveu.

O código e as instruções de operação estão em **`functions/README.md`**.

> ⚠️ O formulário **precisa de JavaScript**: a Function só aceita
> `application/json`, que é o que o `public/js/form.js` envia. Sem
> JavaScript, o navegador faz um POST normal (`form-urlencoded`) e a
> Function responde com uma **página HTML** de erro (SEC-N-17 ✗ — não um JSON
> cru ✗). O **CTA permanente do WhatsApp**
> (`https://wa.me/5511985665992`), logo abaixo do formulário, é o plano B
> obrigatório: uma paragem do formulário não pode significar perda de
> contactos.

---

## 5. O segredo `RESEND_API_KEY` e a verificação do domínio no Resend

### 5.1 O segredo

No painel: **Workers & Pages** → o projecto → **Settings** → **Environment
variables** → **Add** → `RESEND_API_KEY` → tipo **Secret** → colar a chave do
Resend → **Save** (em **Production** e em **Preview**).

Na linha de comando (com o `wrangler` instalado):

```bash
wrangler pages secret put RESEND_API_KEY --project-name galastriadvocacia
```

A chave **nunca** é lida pelo build, **nunca** entra no `dist/` e **nunca** é
registada no log: só a Function a usa, no momento do envio.

> ⚠️ **A chave que estava no ambiente local desta máquina foi EXPOSTA** ✗ (num
> transcript ✗) e **já não tem acesso completo** ✗ (a conta não tem nenhuma
> chave de acesso completo ✗). A rotação dela:
>
> 1. **criar** no painel do Resend uma **nova chave de acesso `Sending`** ✗
>    (só de envio ✗ — não de acesso completo ✗);
> 2. **instalá-la** como segredo `RESEND_API_KEY` no projecto da Cloudflare
>    Pages, no ambiente **Production** ✗ (o **Preview não tem** ✗ — a chave
>    exposta foi removida de lá ✗);
> 3. **revogar** a chave exposta ✗ — o id é
>    `586d3fe2-78ed-4117-be1e-f3f5c0f7c427` ✗ (⚠️ o *id* **não** é um
>    segredo ✗, mas é uma *impressão digital* gratuita ✗ — não o repitas
>    fora do repositório ✗);
> 4. confirmar que o formulário **continua a enviar** ✗ (a §6 ✗).
>
> ⚠️ **Sem isto, o formulário em produção devolve `500`** ✗ (a Function
> não tem `RESEND_API_KEY` ✗).

### 5.2 O domínio de envio no Resend

O Resend só envia de um domínio **verificado**. O de `galastriadvocacia.com.br`
já está **verificado** (região `us-east-1`, criado em 2026-10-20) com os
**4 registos** que o Resend pediu, todos `verified`:

| Tipo | Nome | Valor | Onde está |
|---|---|---|---|
| TXT | `resend._domainkey` | a chave DKIM | no DNS (desligado) |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | no DNS (desligado) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | no DNS (desligado) |
| CNAME | `rsend` | `send.forge.rmta.net` | no DNS (desligado) |

O **SPF do apex** é o registo fundido da §2.2 (a Zoho + o SES do Resend).

Para um **novo** domínio: Resend → **Domains** → **Add Domain** → o Resend dá
os registos → criá-los no DNS com o proxy **desligado** → voltar ao Resend →
`Verified`.

Sem a verificação, o Resend devolve `403` e a Function responde `500` com a
mensagem genérica (o erro do Resend **não** é devolvido ao visitante).

---

## 6. A verificação **bloqueante** do go-live (C9)

Depois de publicar, **antes** de anunciar o site:

```bash
# 1. os 5 headers + a CSP (a CSP completa, com form-action 'self')
#    (no WWW: o apex responde 301 e os headers nunca aparecem lá)
curl -sI https://www.galastriadvocacia.com.br/ | grep -Ei "strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|content-security-policy"

# 2. o 301 de /home/ (o alias ja nao e uma pagina)
curl -sI https://www.galastriadvocacia.com.br/home/ | head -3

# 3. o formulário (a Function responde) — o endpoint é RELATIVO
curl -i -X POST https://galastriadvocacia.com.br/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Teste","email":"teste@example.com","telefone":"(11) 99999-9999","mensagem":"Mensagem de teste com mais de vinte caracteres.","consentimento":"on","_gotcha":"","_t":10000}'
# (o "_t" é o TEMPO DECORRIDO em ms: 10000 = 10 s depois de abrir a página)

# 4. o www tem de RESOLVER e o apex tem de redireccionar para ele
dig +short www.galastriadvocacia.com.br      # galastriadvocacia.pages.dev
curl -sI https://galastriadvocacia.com.br/ | head -1   # 301 (o apex -> o www)
```

> No **browser**, a prova completa é o próprio formulário: abrir a página
> (de preferência numa **pré-visualização** `*.pages.dev`), escrever e enviar
> — o `action` tem de ser `/api/contact` (relativo) e a mensagem tem de
> **chegar** à caixa `contato@galastriadvocacia.com.br`. Um `curl` directo
> ao `/api/contact` **não** prova o formulário: prova a Function.

> ⚠️ **A publicação está a acontecer com o gate aberto, por decisão D88 do
> dono** (`ROTATION_GATE=skip` ✗). As **12 rotações de
> `docs/rotation-gate.md` CONTINUAM por fazer** ✗ — o **próximo** trabalho
> do dono ✗ (o prazo está em `docs/PROJECT-STATE.md` §22.2 ✗). Para voltar a
> bloquear a publicação: **tirar a variável `ROTATION_GATE`** do ambiente de
> Production ✗ (a build seguinte falha ✗).
>
> O go-live está **BLOQUEADO** se:

1. não aparecerem os **5 headers** (`Strict-Transport-Security`,
   `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
   `Permissions-Policy`);
2. a **CSP** não for a da §3 **completa** — em especial
   `frame-ancestors 'none'` (que o `<meta>` **não** transporta),
   `object-src 'none'` e `form-action 'self'`;
3. o `/home/` **não** responder **301** para o `/` (e o `/` responder **200** ✗ — o alias não pode voltar a ser uma página ✗);
4. o `POST /api/contact` **não** responder `200 { ok: true }` (ou `400` com
   uma mensagem de validação — `500` é que é um problema);
5. a **mensagem não chegar** a `contato@galastriadvocacia.com.br` (é a
   única prova de que o caminho inteiro funciona: browser → Function →
   Resend → caixa do escritório);
6. o `www` **não resolver** ✗ (ou o apex **não** redireccionar para ele ✗) —
   o `www` **tem** de resolver ✗: é o endereço canónico ✗ (D91 ✗).

---

## 7. Rollback

**Plano A — reverter o commit (2 minutos):**

```bash
git log --oneline -5
git revert <sha-do-deploy>        # NÃO use `git reset --hard` na branch de produção
git push origin feat/cloudflare-pages-worker   # a Cloudflare reconstrói e republica
```

> ⚠️ A branch de produção é `feat/cloudflare-pages-worker` ✗ (o PR #3 não
> pode ser fundido ✗) — quando for fundido ✗, volta a ser `main` ✗.

**Plano B — republicar um deploy anterior:**

1. Cloudflare Dashboard → **Workers & Pages** → o projecto → **Deployments** →
   escolher o deployment anterior → **Retry deployment** / *Rollback to this
   deployment*.
2. O site volta a servir a versão anterior em segundos (o mesmo endereço).

**Plano C — repor o DNS no host antigo:**

| Registro | Valor |
|---|---|
| `www.galastriadvocacia.com.br` (A) | o IP do host antigo do WordPress (o cliente tem-no; **não** fica versionado aqui) |
| `galastriadvocacia.com.br` (A) | o mesmo IP (o apex passa a servir o WordPress antigo) |

O WordPress antigo tem de estar **acessível num host separado, sem DNS**
(janela de rollback de 30 dias, `docs/PROJECT-STATE.md` §7). Se ele foi
desligado, aplicamos **SEC-63** (lockdown) **antes** de religar o DNS.

> **Rollback testado uma vez** antes do go-live (item do Definition of Done).

---

## 8. Runbook do domínio (SEC-62)

| Situação | O que fazer |
|---|---|
| O repositório foi **renomeado** | o projecto da Cloudflare Pages fica ligado ao repositório antigo → mudar em **Settings → Builds & deployments → Source** e reconfirmar o domínio personalizado. |
| O repositório foi **transferido** | a integração da Cloudflare tem de ser **re-autorizada** (a conta nova tem de ser autorizada no projecto) e o domínio reconfirmado. |
| O repositório vai ser **excluído** | **primeiro** remover o domínio personalizado — senão o domínio fica "pendente" e pode ser apontado para outro. |
| O projecto da Cloudflare for **apagado** | o domínio fica órfão: recriar o projecto com o **mesmo nome** (para manter o `*.pages.dev`) e voltar a apontar o CNAME. |
| Recomendação estrutural | mover o repositório para uma **organização do cliente**, com 2FA obrigatório e branch protection, em vez de o deixar na conta pessoal de um programador. |

---

## 9. O contentor do GTM e a tag do AdSense (obrigatório do cliente)

⚠️ O contentor do Google Tag Manager (`GTM-KDNG3QWB`) não pode conter uma
tag do AdSense. O contentor só é carregado **depois** do consentimento
(`public/js/cookie-consent.js`), mas uma tag do AdSense dentro dele dispara
quando o contentor carrega — ou seja, escreve `IDE`, `test_cookie` e
`_gcl_au` **antes** da escolha do visitante.

A tag do AdSense do site é a do `<head>` (`ca-pub-5989678973778468`), que só
é ativada depois do consentimento.

**Verificar no painel do GTM** (Container → Tags → Publicidade): não pode haver
nenhuma tag do AdSense. Se houver, **removê-la**. O registo desta decisão está
em `docs/security-decisions.md` (E2).

---

## 10. Como publicar a partir de agora (o procedimento)

> A branch de produção da Cloudflare Pages é, **provisoriamente**, o ramo
> de trabalho `feat/cloudflare-pages-worker` — o PR #3 não pode ser fundido
> enquanto a **GitHub Actions da conta estiver bloqueada por fatura** (a
> branch protection exige o check `build`, que nunca é reportado).
> **Quando o PR #3 for fundido, a branch de produção volta a ser `main`** e
> este procedimento deixa de precisar do caminho de recurso.

### 10.1 O caminho normal (o `git push`)

Um **push** para `feat/cloudflare-pages-worker` feito com o `git` **dispara
a build da Cloudflare Pages sozinho** — é o *webhook* da integração do Git
(que funciona):

```bash
git push origin feat/cloudflare-pages-worker
# a Cloudflare constrói e publica (a branch de produção)
```

### 10.2 O caminho de recurso (o que os agentes usam)

Nas sessões do agente o `git push` está **bloqueado** e o push é feito pela
**API de git-data** do GitHub — e **essa via não dispara o *webhook* do
Git** (o `push` é um evento do GitHub, não uma actualização de referência).
Por isso, depois do push, o **deployment tem de ser disparado**:

**1. Push (pela API do GitHub, com as credenciais que o git já tem)**:

```bash
# o conteúdo vem do object store do git (o working copy tem CRLF e binários)
git diff --name-status <pai> HEAD
# … para cada ficheiro: POST /repos/{owner}/{repo}/git/blobs (base64)
# … POST /repos/{owner}/{repo}/git/trees
# … POST /repos/{owner}/{repo}/git/commits
# … PATCH /repos/{owner}/{repo}/git/refs/heads/<ramo> (force)
```

**2. Disparar o deployment (a Cloudflare Pages)** — o corpo tem de ser
**`multipart/form-data`** (o `branch`, o `commit_hash`, o `commit_message` e
o `commit_dirty=false`). ⚠️ **Com `application/json` no corpo é ignorado em
silêncio** e sai um deployment da **ponta do ramo** (a `commit_hash` fica a
zeros):

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/galastriadvocacia/deployments" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F "branch=feat/cloudflare-pages-worker" \
  -F "commit_hash=<SHA>" \
  -F "commit_message=<mensagem do commit>" \
  -F "commit_dirty=false"
```

**3. Ler o log do build** (é onde se vê o gate):

```bash
# o log completo do build
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/galastriadvocacia/deployments/<DEPLOYMENT_ID>/history/logs"

# o log ao vivo (a build a correr)
curl -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/galastriadvocacia/deployments/<DEPLOYMENT_ID>/tails"
```

> O build de **produção** é o que corre o **gate da rotação**: com
> `ROTATION_GATE=skip` (a decisão D88) a build passa e o site é
> republicado; sem ele, a build **falha** e o Cloudflare continua a
> servir o deployment anterior.

**4. Verificar**: o `curl -sI https://www.galastriadvocacia.com.br/` (os
5 headers + a CSP) e o `npm run check` da ronda (a suite completa).

> ⚠️ **O job `functions` do CI tem de ser um *required status check* do
> `main`.** É o único que corre a fase de **comportamento** da Function (o
> contrato cliente↔servidor ✗ — o Critical que partiu o formulário para todos
> os visitantes ✗). Sem ele, um PR pode ser fundido com o job `build` verde
> e o job `functions` vermelho ✗.
>
> ✅ **Feito (2026-10-20):** o contexto `functions` foi acrescentado aos
> *required status checks* do `main` pela API do GitHub ✗ (a lista é
> `["build", "functions"]` ✗).
>
> ⚠️ **Enquanto a GitHub Actions da conta estiver bloqueada por fatura** ✗,
> nenhum check é reportado ✗ — o PR #3 **não pode** ser fundido ✗ e a branch
> de produção fica a ser o ramo de trabalho ✗.

### 10.3 Os dois mecanismos de redireccionamento vivos

| | Onde | O que faz |
|---|---|---|
| **Single Redirect da zona** | ruleset `3d30cd8a…` · fase `http_request_dynamic_redirect` · regra `apex_para_www` | **301** do **apex** para o `www` (o *path* e a *query* são preservados) |
| **Worker** `galastri-apex-redirect` | rota `93a323ba…` · padrão `galastriadvocacia.com.br/*` | a **rede de segurança** para o mesmo 301 |

> A **regra da zona corre primeiro** — por isso o **Worker está inerte**
> (só entraria em acção se a regra da zona deixasse de existir).
> Os dois são do dono e **não são** tocados pelo código.

---

## 11. O que o CI faz (e o que não faz)

`.github/workflows/deploy.yml` (verificado por `node scripts/verify-workflow.mjs`):

- dispara em `push` para `main` **e** para `feat/cloudflare-pages-worker` (a branch que publica ✗), em `pull_request` e em `workflow_dispatch`;
- corre **dois** jobs: `build` (Node 20 — a verificação toda) e `functions` (Node 22 — a fase de **comportamento** da Function, que precisa de Node ≥ 22.6 para ler TypeScript);
- `npm ci` + o audit (com a exceção fixada **pelo ID do advisory** — `scripts/check-audit.mjs`) + `node scripts/guard-secrets.mjs` + `npm run check` + `npm run check:function` + `npm run build` + as 8 verificações do `dist/`;
- **não publica**: não há `pages: write`, nem `id-token: write`, nem `deploy-pages` (D86 — a publicação é da Cloudflare Pages);
- `permissions` mínimas (`contents: read`) e `persist-credentials: false` (SEC-52/54).

**O CI não** cria o projecto da Cloudflare, **não** toca no DNS, **não** corre
o gate da rotação (esse está no build da Cloudflare) e **não** roda o Resend
nem a rotação de segredos — são passos manuais deste runbook.
