# Decisões de segurança e exceções aceitas

Registro das aceitações de risco explícitas do projeto (SEC-49 / SEC-50).

---

## E2 — O contentor do GTM não pode levar uma tag do AdSense (aberta)

| Campo | Valor |
|---|---|
| **Data** | 2026-10-19 |
| **Responsável** | developer (a reverificar na configuração do GTM) |
| **Regra** | SEC-44, R13 |
| **Estado** | ✅ Implementado no código |

### O que mudou

O contentor do **Google Tag Manager** (`GTM-KDNG3QWB`) deixou de ser injetado
no `<head>`: passou a ser carregado por `public/js/cookie-consent.js`, **depois**
de `gtag('consent', 'update', …)`, e só quando o visitante aceita pelo menos
uma categoria opcional. Antes desta mudança, a primeira visita disparava um
pedido a `googletagmanager.com` **antes** de qualquer escolha (T1 do QA
exige zero pedidos).

O `<head>` mantém **apenas** o `gtag('consent', 'default', {… 'denied'})`, que
tem de ser a primeira coisa. O `adsbygoogle.js` continua no caminho
`type="text/plain"` → injetado pelo consentimento.

### O que o cliente tem de fazer

⚠️ **O contentor do GTM não pode conter uma tag do AdSense.** Se o painel do
GTM tiver a tag do AdSense, ela dispara quando o contentor carrega — ou seja,
**antes** do consentimento, e escreve `IDE`, `test_cookie` e `_gcl_au`. A tag
do AdSense do site é a do `<head>` (`ca-pub-5989678973778468`), que só é
ativada depois do consentimento.

**Verificar no painel do GTM** (Container → Tags → Publicidade): não pode haver
nenhuma tag do AdSense. Se houver, **removê-la**.

---

## E1 — `npm audit`: vulnerabilidade crítica no `astro` (aberta)

| Campo | Valor |
|---|---|
| **Data** | 2026-10-19 |
| **Responsável** | EM (decisão D1: Astro 5) — **revisão em 2026-11-19** |
| **Revisor** | `developer` (a verificar o advisory no `npm audit`) |
| **Regra** | SEC-49 (`npm audit --audit-level=high` deve reportar 0 high/critical) |
| **Estado** | **Exceção aceita** — `npm audit --audit-level=high` reporta **1 vulnerabilidade crítica** (`astro`), 0 high e 0 low |

### O que é

O `npm audit` aponta o pacote `astro` (todas as versões `<= 7.2.7`):

| Advisory | Gravidade | Aplica-se a este projeto? |
|---|---|---|
| GHSA-j687-52p2-xcff — XSS em `define:vars` | crítica | **Não** — o projeto não usa `define:vars` nem variáveis no cliente. |
| GHSA-jrpj-wcv7-9fh9 / GHSA-f48w-9m4c-m7f5 — XSS em nomes de atributos de *spread props* | crítica | **Não** — não há componentes de framework (React/Vue/Svelte) no projeto. |
| GHSA-7pw4-f3q4-r2p2 — XSS em `transition:*` | crítica | **Não** — não há ilhas hidratadas. |
| GHSA-4g3v-8h47-v7g6 — XSS em View Transitions | crítica | **Não** — não há view transitions. |
| GHSA-8hv8-536x-4wqp — XSS no nome de um *slot* | crítica | **Não** — não há *slots* com dado de utilizador. |
| GHSA-xr5h-phrj-8vxv — replay de parâmetros de *server island* | crítica | **Não** — o site é 100% estático (`output: 'static'`), sem islands nem servidor. |
| GHSA-2pvr-wf23-7pc7 — SSRF de *Host header* na página de erro | crítica | **Não** — sem SSR; o build é estático. |
| GHSA-26w7-cxv4-gfx2 — RCE na otimização AVIF | crítica | **Não** — não há `astro:assets` nem o serviço de imagens; as mídias são copiadas **verbatim** de `public/wp-content/uploads/`. |
| GHSA-376h-93r7-7g6f — bypass de autorização no `base` | crítica | **Não** — `base` é `/` (raiz), o mesmo domínio do `site`. |

### Por que não foi corrigido

O conserto exige `astro@7.4.1` (duas majors acima). A decisão **D1** do EM fixa **Astro 5**; a SPEC-UI e a SPEC-DATA assumem a API do Astro 5 (`glob()` loader, content collections). A atualização para a Astro 7 é uma **decisão de escopo**, não um patch de dependência — precisa de validação da Fase 3 (renderer) e da Fase 6 (paridade visual).

### Mitigações já aplicadas

- `overrides` no `package.json` para `esbuild@^0.28.2` e `sharp@^0.35.5` → zeram as vulnerabilidades **high** e **critical** dessas dependências transitivas.
- O site é estático, sem islands, sem `astro:assets`, sem SSR e sem `define:vars` — nenhuma das advisors acima tem caminho de exploração no código deste repositório.
- O `scripts/guard-secrets.mjs` roda no `prebuild` **e** no CI (SEC-30 / SEC-55).

### Como a exceção é verificada no CI (SEC-R-11)

`scripts/check-audit.mjs` fixa a exceção **pelo ID do advisory**, e não pelo
pacote: o step do workflow corre

```bash
npm audit --audit-level=high --json > audit.json || true
node scripts/check-audit.mjs audit.json
```

e **falha** se:

- aparecer um advisory de severidade `high` ou `critical` de um pacote que não
  está na lista aceite;
- um advisory do `astro` **fora** dos 10 IDs aceite;
- o número de advisories do `astro` for superior a 10;
- a lista aceite não estiver documentada aqui (o script verifica o
  `docs/security-decisions.md`).

**Os 10 advisories aceites (SHA-256 não, GHSA):**

GHSA-j687-52p2-xcff · GHSA-xr5h-phrj-8vxv · GHSA-jrpj-wcv7-9fh9 · GHSA-f48w-9m4c-m7f5 · GHSA-7pw4-f3q4-r2p2 · GHSA-4g3v-8h47-v7g6 · GHSA-2pvr-wf23-7pc7 · GHSA-8hv8-536x-4wqp · GHSA-26w7-cxv4-gfx2 · GHSA-376h-93r7-7g6f

| # | Advisory | O que é |
|---|---|---|
| 1 | `GHSA-j687-52p2-xcff` | XSS em `define:vars` |
| 2 | `GHSA-xr5h-phrj-8vxv` | replay de parâmetros de server island |
| 3 | `GHSA-jrpj-wcv7-9fh9` | XSS em nomes de atributos de spread props |
| 4 | `GHSA-f48w-9m4c-m7f5` | XSS em nomes de atributos de spread props (correção incompleta) |
| 5 | `GHSA-7pw4-f3q4-r2p2` | XSS em valores `transition:*` de ilhas hidratadas |
| 6 | `GHSA-4g3v-8h47-v7g6` | XSS reflexivo em View Transitions |
| 7 | `GHSA-2pvr-wf23-7pc7` | SSRF de `Host header` na página de erro |
| 8 | `GHSA-8hv8-536x-4wqp` | XSS reflexivo no nome de um `slot` |
| 9 | `GHSA-26w7-cxv4-gfx2` | RCE na otimização de imagens AVIF |
| 10 | `GHSA-376h-93r7-7g6f` | bypass de autorização ao remover o `base` |

**Nenhum deles tem caminho de exploração neste projeto** (site estático, sem
`define:vars`, sem ilhas hidratadas, sem `astro:assets`, sem SSR). Se um
advisory **novo** do `astro` aparecer, o build **falha** — a exceção é
revisada, não extendida.

## E3 — Os digest dos dados pessoais vivem **fora** do repositório (aberta)

> **SEC-R-26 / C3.** O `scripts/lib/forbidden.mjs` guarda os digest SHA-256
> dos **valores vivos** do backup, para que a guarda os reconheça sem que o
> valor esteja no repositório. Isso vale para as **credenciais** — um salt de
> 64 caracteres aleatórios não é reversível por força bruta, por isso o digest
> **não** é um oráculo de confirmação. **Não** vale para os **dados pessoais**
> (os IPv4 e os e-mails): o seu espaço de pesquisa é pequeno e o digest
> **confirmaria** um valor candidato.

| Nível | O que é | Onde vive |
|---|---|---|
| `HIGH_ENTROPY_DIGESTS` | as credenciais (a senha da base de dados, os 8 salts, os tokens OAuth, as chaves de API) | `scripts/lib/forbidden.mjs` (**versionado**) |
| `PII_DIGESTS` | os IPv4 e os e-mails pessoais | `scripts/private/pii-digests.json` — **local e git-ignored** |

A guarda lê o ficheiro local **quando ele existe** e **passa sem ele** (o CI
não tem ficheiro local: os dados pessoais são aí apanhados apenas pelas
regras de forma). O ficheiro é gerado a partir do backup pelo
`npm run guard:pii-digests` (o `npm run guard:self-test` só o **lê**).

**Como a guarda apanha um valor** (`scripts/lib/forbidden.mjs`): a extração
dos candidatos é **independente do conjunto de caracteres** — para cada
comprimento conhecido *L*, cada substring de comprimento *L* cujas
extremidades **não são alfanuméricas** (com uma tolerância de ±2 caracteres)
é um candidato, e o seu SHA-256 é comparado com a lista. Um salt do
WordPress (que tem pontuação) é assim apanhado tal e qual.

**O auto-teste** (`npm run guard:self-test`) planta **cada** valor vivo do
backup (lido do backup **read-only**, nunca copiado para o repositório) em
cada diretório varrido pela guarda (`src/`, `public/`, `docs/`, `tests/`,
`scripts/` e um `src/data/elementor/*.json`), prova que a guarda **reprova**
em todos os casos, remove as sondas e prova que volta a passar. No CI (sem o
backup) o auto-teste **salta** com uma mensagem.

### E3.1 — O que fica por fazer (o cliente)

- O ficheiro `scripts/private/pii-digests.json` **não é versionado** (por
  desenho). Num fork público, os dados pessoais deixam de ser reconhecidos
  localmente → o ficheiro tem de ser gerado de novo (o comando está
  documentado acima).
- Os **12 segredos** continuam por rotacionar (E4 — `docs/rotation-gate.md`).

## E5 — A CSP ficou mais dura: `script-src-attr 'none'` (fechada)

> **D20 (2026-10-19).** A CSP passou a incluir **`script-src-attr 'none'`**: os
> handlers `on…=` em linha (o `onerror=`, o `onload=`) estão **proibidos**.
> O site **não tem nenhum** (os scripts do site estão em `public/js/*.js`), por
> isso a diretiva não quebra nada e fecha o vetor mesmo com `'unsafe-inline'`
> no `script-src`.
>
> ⚠️ **A `script-src-attr` NÃO bloqueia as URLs `javascript:`** — um
> `<a href="javascript:…">` continua a ser executado. Isso é tratado em duas
> camadas: o **sanitizador de tempo de build** (`scripts/extract/lib/sanitize.mjs`,
> que normaliza as entidades antes de testar) e a **guarda** (que reprova o
> `dist/` com `npm run check-dist`). A string da CSP vive em
> `src/lib/csp.ts` e o `npm run verify-csp` compara-a com a do runbook.

## E6 — O `pull_request` verifica; a publicação continua intocável (2026-10-20)

> **F1 / REV-19.** A branch protection de `main` exige o status check
> `build`, que **só** era reportado num `push` para `main` (o `pull_request`
> não era gatilho, por SEC-51). Num PR **nenhum** check era reportado, a
> aprovação era impossível e o PR que fecha as 12 rotações ficava bloqueado —
> um deadlock do próprio gate.
>
> **A decisão:** o workflow passa a ter **dois** gatilhos — `push` em `main`
> (publica) e `pull_request` (verifica). A propriedade que importa **não
> mudou**: o caminho de publicação é **inalcançável** a partir de um PR.
>
> | | Num `pull_request` | Num `push` para `main` |
> |---|---|---|
> | job `build` (`contents: read` **apenas**) | corre (verifica) | corre (verifica) |
> | step `upload-pages-artifact` | **saltado** (`if`) | corre |
> | job `deploy` (`pages: write` + `id-token: write`) | **saltado** (`if`) | corre |
> | o gate da rotação | não corre | corre (bloqueia a publicação) |
>
> Um fork continua a **não** poder publicar nada: o único job com
> `pages: write` é saltado, e o job que corre no PR não tem permissão de
> escrita. A verificação é automática (`npm run verify-workflow`) e a
> **branch protection** continua a exigir o check `build`.

## E7 — A publicação é da Cloudflare Pages; o GitHub Actions só verifica (2026-10-20)

> **D86.** O dono mudou o alvo de publicação: do **GitHub Pages** para a
> **Cloudflare Pages** (integração com o Git), e o registo `www` é
> **apagado** — o apex é a única URL canónica.
>
> **A decisão:**
>
> | | Onde |
> |---|---|
> | a publicação | a **Cloudflare Pages** (build command `node scripts/build-pages.mjs`, output `dist`) |
> | a verificação | o **GitHub Actions** — **só verifica** (`npm run verify-workflow`), já **não** publica |
> | a CSP e os 5 headers | o ficheiro `public/_headers` (a Cloudflare Pages aplica-o nativamente) — **já não há Transform Rules** |
> | o 301 de `/home/` | o ficheiro `public/_redirects` |
> | o gate da rotação (SEC-67) | o **build de produção** da Cloudflare — **só** quando `CF_PAGES_BRANCH` é a branch de produção (as pre-visualizações **não** são bloqueadas) |
>
> **A postura de segurança fica a mesma:** a mesma CSP (a única mudança foi o
> `form-action`, que passou a `'self'` porque o formulário é *same-origin*),
> os mesmos 5 headers, o mesmo gate duro. O que muda é **quem** aplica os
> headers — o ficheiro `_headers` em vez de uma regra no painel — e **quem**
> bloqueia a publicação: o build da Cloudflare em vez de um job do GitHub.
>
> **A consequência a reter:** o workflow do GitHub **não** tem já
> `pages: write`, nem `id-token: write`, nem `deploy-pages` — um PR de um
> fork não tem (nem pode ter) qualquer capacidade de publicar. A verificação
> é automática (`npm run verify-workflow`).

## E8 — O formulário é uma Pages Function do próprio site; o Resend envia o e-mail (2026-10-20)

> **D87.** O formulário deixou de ir para um serviço de formulários de
> terceiros. Passa a publicar **same-origin** para `POST /api/contact` — uma
> **Pages Function** (`functions/api/contact.ts`) no **mesmo domínio** do
> site.
>
> **A decisão:**
>
> - **Validação no servidor** (é a única que conta): os 4 campos obrigatórios,
>   o e-mail plausível, a mensagem entre 20 e 4000 caracteres, o honeypot
>   `_gotcha` **vazio** e o tempo decorrido desde a abertura da página
>   (`_t`: ≥ 3 s e ≤ 24 h);
> - **rate limit** de 5 submissões por IP por hora (um `Map` em memória —
>   *best-effort*, por isolate; a correção durável seria um binding de KV,
>   fora do âmbito);
>
> ⚠️ **Superada pela E17:** o limite é de **20** submissões por IP por hora
> (F1 ✗) — com 5, um visitante legítimo (a NAT do operador ✗) ficava sem
> formulário ✗. E o `Map` tem hoje um **teto** (REV-08 ✗): as entradas
> antigas saem ✗.
> - **envio** pelo **Resend** (`RESEND_API_KEY` é um **segredo** do projecto
>   da Cloudflare — nunca no repositório, nunca no `dist/`);
> - **nada** de terceiros no caminho dos dados: sem CAPTCHA, sem cookies de
>   terceiros no formulário, sem CORS (a Function é do mesmo domínio).
>
> **O log da Function** é `{ ok, status, durationMs }` + um prefixo do hash
> do IP — **nunca** o corpo, o nome, o e-mail, o telefone ou a mensagem. O
> erro do Resend **não** é devolvido ao visitante.
>
> ⚠️ **Superada pela E13:** o log **não** tem o IP nem qualquer *hash* dele ✗
> (um hash SHA-256 truncado é reversível por força bruta sobre o espaço IPv4
> ✗). O log de hoje é `{ ok, status, durationMs, outcome, ray }` ✗ — o
> `CF-Ray` é o identificador do pedido na Cloudflare ✗.
>
> **O que isto muda na LGPD:** o operador do formulário passa a ser o
> **Resend** (e o alojamento, a **Cloudflare**); o prazo de retenção passa a
> ser "conforme o contrato com o operador"; e o texto real das políticas está
> **marcado como pendente de aprovação do advogado**.

## E9 — O `www` é apagado: o apex é a única URL canónica (2026-10-20)

> **D86 / D90.** O `www` (e o *wildcard* `*.galastriadvocacia.com.br`) foram
> **apagados** da zona. O apex (`galastriadvocacia.com.br`, em CNAME para
> `galastriadvocacia.pages.dev`, com o proxy ligado) é a **única** URL
> canónica.
>
> ⚠️ **SUPERADO pela D91 (2026-10-20, mais tarde no mesmo dia):** o dono
> decidiu que o **endereço público é o `www`** — o oposto desta nota. O
> `www` voltou (a Cloudflare Pages recria o CNAME quando o domínio
> personalizado é adicionado ✗) e o apex passa a **redireccionar 301** para
> ele.
>
> **A consequência:** `https://www.galastriadvocacia.com.br` devolve
> **NXDOMAIN**. Os links antigos que apontem para o `www` (redes sociais,
> Google Search Console, anúncios) têm de ser actualizados.
>
> **A ressalva que fica registada:** a **Cloudflare Pages recria o CNAME do
> `www` por conta própria** (já aconteceu uma vez, ao adicionar o domínio
> personalizado). O `www` tem de ser **verificado depois de cada deploy** e
> apagado de novo se a Pages o tiver criado. Sem essa verificação, o domínio
> `www` volta a responder — e volta a ser uma segunda URL canónica (com o
> `Referrer-Policy` a apontar para um host diferente do que o formulário
> espera).
>
> (A alternativa — um 301 do `www` para o apex — fica de fora de propósito:
> a Cloudflare Pages **não** oferece Transform Rules, e o proxy laranja já
> está a servir o apex.)

## E10 — O SPF do apex foi fundido com o do Resend (2026-10-20)

> **D86.** O domínio do Resend (`galastriadvocacia.com.br`, `verified`,
> `us-east-1`) precisa de um SPF **no apex**. O SPF que lá estava (da Zoho,
> `v=spf1 include:zohomail.com ~all`) **não** pode ser substituído — a caixa
> de correio do escritório deixaria de receber. Por isso os dois foram
> **fundidos** num único registo:
>
> ```
> v=spf1 include:zohomail.com include:amazonses.com ~all
> ```
>
> **Porquê não um segundo TXT:** um domínio só pode ter **um** registo
> `v=spf1`; dois SPF fecham o domínio com `permerror` e **nada** é
> entregue (nem o Resend, nem a Zoho). A fusão é a única forma correcta.
>
> **O comando de reversão** (para tirar o `include:amazonses.com`) está na
> `docs/DEPLOY.md` §2.2 — com o id do registo, para não depender da
> memória de ninguém.

## E11 — A branch de produção é o ramo de trabalho (provisório) (2026-10-20)

> **D90.** O projecto da Cloudflare Pages tem como **production branch** o
> ramo `feat/cloudflare-pages-worker` e **não** o `main`.
>
> **A razão:** a **GitHub Actions da conta está bloqueada por fatura** — nenhum
> job arranca, logo o status check `build` que a branch protection de `main`
> exige **nunca é reportado**. Sem esse check, o PR #3 (a migração para a
> Cloudflare) **não pode ser fundido**; e o `main` não tem o
> `scripts/build-pages.mjs`, logo **não pode** ser a branch de produção (a
> build command falhava).
>
> **O risco e como fica mitigado:** enquanto o PR #3 não entrar, é o ramo de
> trabalho que publica — e é esse ramo que tem o gate da rotação
> (`build-pages.mjs`). Quando o PR #3 for fundido, a branch de produção volta
> a ser `main`.
>
> ⚠️ **Superada pela E15 (D88):** o gate **está** contornado ✗ — o
> `ROTATION_GATE=skip` está no ambiente de Production ✗ e a publicação
> **está a ocorrer** com as 12 rotações por fazer ✗ (prazo: 2026-11-19 ✗).
> A branch de produção é o ramo de trabalho **e** o gate está aberto ✗ — são
> duas coisas diferentes ✗.
>
> **As duas vias para fundir o PR #3** (e a recomendação) estão na
> `docs/PROJECT-STATE.md` §20.3.

## E12 — O endpoint do formulário é **relativo** (2026-10-20)

> **D91.** O `PUBLIC_CONTACT_ENDPOINT` é `/api/contact` (o caminho
> **relativo**), e não `https://galastriadvocacia.com.br/api/contact`.
>
> **O que a validação aceita:** o caminho relativo `/api/contact` **ou** um
> URL absoluto `https://<host>/api/contact` — o build continua a **falhar
> fechado** se o valor estiver ausente ou mal formado (e a forma antiga, de
> um serviço de formulários de terceiros, é rejeitada).
>
> **Porquê o relativo:** o formulário tem de resolver o endpoint contra **o
> host que serve a página**. Com o URL absoluto, a pré-visualização
> `*.pages.dev` postava para o domínio canónico — que, com o gate da
> rotação em vermelho, **não tem deployment** (404). O visitante via o erro
> do formulário sem a Function alguma vez receber o pedido. (Um `curl` ao
> `/api/contact` da pré-visualização **passa** — e não prova nada do
> formulário: prova a Function, não o `action`.)
>
> **A CSP:** `form-action 'self'` cobre um POST `*same-origin` (relativo ou
> absoluto na mesma origem) — a política não muda.

## E13 — O contrato do formulário é *same-origin*, com o tempo decorrido (2026-10-20)

> **SEC-N-01 a SEC-N-07, SEC-N-14 a SEC-N-17 e SEC-N-19.** A revisão de
> segurança da superfície nova (a Pages Function) encontrou um bug **crítico**
> e mais doze. As decisões:
>
> - **O `_t` é o TEMPO DECORRIDO** (em ms, desde a abertura da página), não
>   um *timestamp*. A versão anterior (o cliente mandava o instante e o
>   servidor comparava com `Date.now()`) media a latência da rede — **todas**
>   as submissões legítimas eram recusadas com `400`. Além disso dependia do
>   relógio do dispositivo. O `_t` é **exigido** (sem ele: `400`) e
>   validado entre 3 s (o sinal de bot) e 24 h (a página velha).
> - **O `Content-Type` tem de ser `application/json`** (senão `415`): sem
>   isso, uma página de um terceiro podia mandar um POST `text/plain` (um
>   *simple request*, sem *preflight*) e usar a Function como **relay de spam**
>   para a caixa do escritório. A Function **não** responde com nenhum header
>   de CORS — só *same-origin*.
> - **O honeypot é lido como texto** (um array, um `0` ou um objeto também
>   são spam) e **o `nome` com CR/LF ou caracteres de controlo é recusado**
>   (`400`) — nunca corrigido em silêncio, porque o `nome` vai para o
>   **assunto** do e-mail (um cabeçalho MIME). Todos os campos são limpos
>   antes de entrarem no corpo do e-mail.
> - **O `Content-Type` errado responde com uma página HTML mínima** (com o
>   link do WhatsApp) — é o que o visitante sem JavaScript vê; um dump de JSON
>   num browser não é uma resposta.
> - **O `consentimento` é exigido no servidor** e fica registado no e-mail
>   (`Consentimento: sim`) — o e-mail passa a ser o registo (art. 8º/9º da
>   LGPD).
> - **O log tem um `outcome`** (`sent` | `spam` | `invalid` | `limited`
>   | `error`) e **nenhuma PII**: nem o nome, nem o e-mail, nem o telefone,
>   nem a mensagem — e **nem o IP** (SEC-N-07: o hash SHA-256 truncado é
>   reversível por força bruta sobre o espaço IPv4; a correlação continua
>   disponível pelo header `CF-Ray`, que a Cloudflare liga aos seus próprios
>   registos).
> - **A resposta da Function traz HSTS** (o ficheiro `_headers` **não** se
>   aplica às respostas de uma Function) e o corpo é limitado a **16 KB**
>   (`413`).
> - **O `check-function.mjs` verifica o código, não a prosa** (uma asserção
>   que casa com um comentário passa por acidente) e traz um **teste de
>   contrato cliente↔servidor**: a expressão que o `public/js/form.js`
>   calcula é **executada** e o resultado é enviado à Function real.

## E14 — O gate da rotação falha **fechado** e o CI corre na branch que publica (2026-10-20)

> **SEC-N-09 e SEC-N-10.**
>
> - **O gate da rotação não pode ser saltado por omissão.** O
>   `build-pages.mjs` usava `PRODUCTION_BRANCH ?? 'main'`: se a variável
>   desaparecesse do ambiente de Production, a build de produção (de uma
>   branch que não é `main`) **saltava o gate** e publicava com as
>   credenciais do backup ainda válidas — o oposto do invariante I3. Agora a
>   variável **não tem omissão**: sem ela (e com o `CF_PAGES_BRANCH`
>   definido) o build **aborta**. A pré-visualização continua a saltar o
>   gate — uma pré-visualização não é uma publicação — mas isso é explícito.
> - **O CI tem de correr na branch que publica.** Os gatilhos eram só
>   `main`, e a branch de produção da Cloudflare Pages é (provisoriamente)
>   `feat/cloudflare-pages-worker` — o código que ia para o ar **não** era
>   verificado pelo `npm audit`, pelo `astro check`, pela verificação da
>   Function (a fase de comportamento) nem pelo `check-dist`. Os dois
>   gatilhos (push e pull_request) passaram a incluir a branch que publica.

## E15 — D88: publicar antes das 12 rotações, por decisão explícita do dono (2026-10-20)

> **O que foi decidido:** o dono autorizou a **publicação do site antes de as
> 12 rotações de segredos estarem feitas** — o site estava **offline há
> meses** e a decisão é dele. Fica registada aqui, com o risco e a forma de
> a reverter.
>
> **Quem e quando:** o dono (Galastri Advocacia), em 2026-10-20, por escrito
> (a instrução que acompanha esta mudança).
>
> **Como está implementado:** uma variável de ambiente da **Cloudflare
> Pages**, `ROTATION_GATE`, com o valor por omissão `enforce` — o gate
> corre e a publicação pára. Só com `ROTATION_GATE=skip` **numa build da
> Cloudflare** (`CF_PAGES_BRANCH` definido) o gate é saltado, e a build
> imprime um aviso impossível de não ver:
>
> ```
> [build-pages] ATENÇÃO: o gate da rotação foi SALTADO por decisão explícita (ROTATION_GATE=skip, D88).
> [build-pages] As 12 rotações de docs/rotation-gate.md CONTINUAM por fazer. Risco residual aceite pelo dono.
> ```
>
> O **gate em si não mudou** (as 12 linhas, a regra ☑ + data + responsável +
> sha256 ✗): isto é um **interruptor**, não uma alteração do requisito. E
> **uma corrida local nunca o usa** — o gate corre localmente ✗, para que
> ninguém seja surpreendido por uma publicação que o gate teria parado.
>
> **O risco residual aceite (é real e está escrito aqui):** a senha do MySQL,
> os **8 salts** do WordPress e as **4 integrações OAuth do Google** do
> backup antigo **continuam válidos**. Uma parte que os obtenha pode:
>
> - forjar uma sessão de `administrator` no WordPress antigo;
> - **enviar e-mail como o escritório** (a reputação do domínio fica em
>   jogo ✗);
> - **ler o backup** que está no Drive.
>
> A mitigação é a mesma de sempre e continua valendo: o WordPress antigo
> **não é reencaminhado** (SEC-63 — o lockdown ✗), o sítio novo **não tem
> WordPress** ✗ e o formulário **não expõe** nada ✗.
>
> **Como reverter:** tirar a variável `ROTATION_GATE` do ambiente de
> **Production** do projecto da Cloudflare Pages (Settings → Environment
> variables) — a build seguinte volta a **falhar** no gate ✗ (o valor por
> omissão é `enforce` ✗). Nenhuma alteração de código é precisa ✗.

## E16 — D91: o endereço público passa a ser `https://www.galastriadvocacia.com.br` (2026-10-20)

> **O que foi decidido:** o **endereço canónico** do site é o
> `https://www.galastriadvocacia.com.br` (o apex, `galastriadvocacia.com.br`,
> deixa de ser o canónico ✗). O dono usa o `www` ✗.
>
> **O que muda no código:** a fonte da verdade é `SITE_ORIGIN`
> (`scripts/extract/lib/urls.mjs`) ✗ — de lá saem o `site.url` (o canonical,
> o `og:url`, o `og:image` e o JSON-LD ✗) e a linha `Sitemap:` do
> `public/robots.txt` ✗. ⚠️ **O `astro.config.mjs` NÃO vem do extractor**
> ✗: o ficheiro está **fora** da allow-list de escrita da extração ✗ (que é
> `src/`, `public/wp-content/uploads/`, `public/css/`, `public/fonts/`,
> `public/js/`, `tests/fixtures/`, `docs/_reference/` e
> `docs/audit/comentarios-retidos.md` ✗) — o `site` do Astro é escrito
> **à mão** ✗. O **endereço antigo** (o apex) continua a ser removido do
> conteúdo importado ✗ — os links internos são **relativos** (`/blog/`,
> `/#sobre`) e funcionam em qualquer host ✗ (o canónico ✗, a pré-visualização
> `*.pages.dev` ✗, o `localhost` ✗).
>
> **O DNS (acção do `deployer`):** o `www` em CNAME para
> `galastriadvocacia.pages.dev` ✗ (a Cloudflare Pages recria-o quando o
> domínio personalizado é adicionado ✗) e o apex com uma **Redirect Rule 301**
> para o `www` ✗ (o ficheiro `_redirects` **não** distingue hosts ✗ — a
> regra vive na zona da Cloudflare ✗).
>
> **O `PUBLIC_CONTACT_ENDPOINT` continua relativo** (`/api/contact`) ✗ —
> é o que garante que o formulário funciona em qualquer host ✗.

## E17 — O rate limit do formulário sobe para 20 por IP e por hora (2026-10-20)

> **F1.** O limite era de **5 submissões por IP por hora** ✗ — mediu-se em
> produção ✗: a partir do 6.º pedido, **tudo** devolvia `429` ✗ (inclusive os
> pedidos **rejeitados pela validação** ✗).
>
> **O problema:** o escritório e os seus visitantes partilham muitas vezes o
> **mesmo endereço** (a NAT do operador ✗, a rede do escritório ✗, um *proxy*
> corporativo ✗). Com 5, um visitante legítimo — ou o escritório inteiro —
> ficava **sem o formulário** ✗, que é o negócio ✗. E os caminhos de erro
> deixavam de ser alcançáveis ✗ (o `429` chegava antes ✗).
>
> **A decisão:** o limite sobe para **20 por IP por hora** ✗ e o orçamento
> **só** é consumido pelas tentativas que seriam **de facto enviadas** ✗ — um
> payload rejeitado pela validação **não** bloqueia o visitante ✗. O log
> mantém o `outcome` ✗ (`sent` | `spam` | `invalid` | `limited` |
> `error` ✗) ✗.
>
> **O limite continua a ser *best-effort*** ✗ (um `Map` em memória ✗, por
> isolate ✗): um isolate pode ser descartado ✗ e há vários em paralelo ✗, por
> isso o limite **pode** ser contornado com pedidos distribuídos ✗.
>
> **A correção durável é um rate limit na WAF** ✗, à borda (Cloudflare →
> Security → WAF → Rate limiting rules ✗) — está **fora do âmbito** ✗ (é uma
> acção no painel da Cloudflare ✗, e a conta é do dono ✗). Está registada
> como acção aberta no `PROJECT-STATE` ✗.
>
> O auto-teste (`npm run check:function` ✗) exercita o limite com um
> **override em memória** ✗ — o limite de produção **não muda** ✗.

## E18 — ~~Os redireccionamentos são executados pela Redirect Rule da borda~~ (2026-10-20) — **superada pela E19/E20**

> ⚠️ **Superada.** A *Redirect Rule* da zona **não** executa o `/home/` ✗ (e
> nem é preciso ✗).
>
> **O que está medido:** o ficheiro `public/_redirects` declara `/home/ /
> 301` ✗, mas a Cloudflare Pages **não** o aplica quando existe o ficheiro
> estático correspondente ✗: `https://www.galastriadvocacia.com.br/home/`
> respondia **200** (a home servida de `/home/index.html` ✗) em vez de 301 ✗.
>
> **A decisão (E19):** o **registo** (`src/data/redirects.json` ✗) é a fonte
> da verdade ✗, `public/_redirects` é a **declaração** desse registo ✗ e a
> **execução** é o **ficheiro `_redirects` da Cloudflare Pages** ✗ — que só
> produz o 301 **porque o alias deixou de ser construído** ✗ (sem activo
> estático, o pedido não casa com nenhum ficheiro ✗). O `npm run
> check-redirects` **reprova** se a página do alias voltar a existir ✗.
>
> **O `apex → `www`** é outra coisa ✗: é a **Single Redirect** da zona ✗
> (E20 ✗) — o ficheiro `_redirects` **não** distingue hosts ✗.

## E19 — O alias `/home/` é um 301 dos `_redirects`, e para isso a página deixa de existir (2026-10-20)

> **O problema medido:** o ficheiro `public/_redirects` declara `/home/ / 301`
> ✗, mas a Cloudflare Pages **não o aplica** quando existe o ficheiro
> estático correspondente ✗ — com a página `/home/` construída ✗, a URL
> respondia **200** ✗ (a home servida de `/home/index.html` ✗). A
> `Redirect Rule` da zona que o resolveria **não dispara** nesta conta ✗
> ✗.
>
> **A decisão:** o alias **deixa de ser construído** ✗ (a página
> `src/pages/home.astro` foi removida ✗). Sem activo estático ✗, o pedido
> não casa com nenhum ficheiro ✗ e a regra dos `_redirects` aplica-se ✗ →
> **301 → `/`** ✗.
>
> **O invariante:** o `npm run check-redirects` passa a **reprovar** se a
> página do alias voltar a existir ✗ (e se o `dist/` tiver o activo
> estático ✗) — porque é essa a condição que mantém a regra viva ✗. O
> registo (`src/data/redirects.json` ✗) continua a ser a fonte da verdade
> ✗ e a **declaration** (`public/_redirects` ✗) continua a ser confrontada
> com ele ✗ e com o runbook ✗.
>
> **Porquê não uma `Redirect Rule` na zona:** porque a regra da zona
> **não dispara** nesta conta ✗ (e a zona é do dono ✗). O ficheiro
> `_redirects` é a mesma Cloudflare ✗ e **funciona** ✗ — desde que não
> haja activo estático ✗.
>
> **A consequência para o SEO:** o `/home/` deixa de ser uma **segunda
> cópia** da home ✗ (passa a ser um 301 ✗) — o `canonical` continua a ser
> `https://www.galastriadvocacia.com.br/` ✗ e o `www` continua a servir
> a home ✗.

## E20 — Os dois mecanismos de redireccionamento que estão vivos (2026-10-20)

> **O que está configurado hoje** (a conta é do dono ✗ — o código não toca
> em nada disto ✗):

| | Onde | O que faz |
|---|---|---|
| **Single Redirect da zona** | ruleset `3d30cd8a…` ✗ · fase `http_request_dynamic_redirect` ✗ · regra `apex_para_www` ✗ | **301** do **apex** (`galastriadvocacia.com.br` ✗) para o **`www`** ✗ — o `*path*` e a `*query*` são preservados ✗ |
| **Worker** `galastri-apex-redirect` | rota `93a323ba…` ✗ · padrão `galastriadvocacia.com.br/*` ✗ | a **rede de segurança** ✗ para o mesmo 301 ✗ |

> **A regra da zona corre primeiro** ✗ — por isso o **Worker está inerte**
> ✗: só entraria em acção se a regra da zona deixasse de estar aplicada ✗
> (ou se a zona deixasse de estar na Cloudflare ✗).

**E o `/home/`?** É o ficheiro `public/_redirects` ✗ (E19 ✗) — a regra
dispara porque **não** há activo estático em `/home/` ✗ ✗.

**Porquê dois mecanismos?** A regra da zona é a correcta ✗ (corre antes de
qualquer ficheiro ✗ e preserva a *query* ✗); o Worker é a rede de segurança
✗ — cobre o caso de a regra da zona ser apagada por engano ✗ ✗. Ter os dois
é **redundante** ✗ — e é uma decisão do dono ✗, não do código ✗ ✗.

## E21 — Endurecimento **recommended**: tirar o `'unsafe-inline'` de `script-src` (2026-10-20)

> **A análise (feita, não aplicada).** O `'unsafe-inline'` de `script-src`
> **não** é forçado pelo GTM ✗:
>
> - o único **script inline executável** do layout é o bloco **estático**
>   `gtag('consent','default',…)` ✗ (o Consent Mode) ✗;
> - o contentor do **GTM** é injectado como **script externo** ✗ (o
>   `public/js/cookie-consent.js` cria o elemento ✗);
> - o bloco do **AdSense** é `type="text/plain"` ✗ — **não é executado** ✗.
>
> Ou seja: um **hash SHA-256** do bloco do Consent Mode permitiria trocar
> `'unsafe-inline'` por `'sha256-…'` em `script-src` ✗.

> **Porquê não foi feito agora:** um hash errado **quebra o Consent Mode
> default** ✗ — e isso é um problema de **LGPD** ✗ (o visitante seria
> rastreado sem consentimento ✗), silenciosamente ✗. O ganho é pequeno,
> porque:
>
> - o sanitizador de build **já** remove `<script>` do conteúdo do
>   repositório ✗ (SEC-R-28 ✗);
> - `script-src-attr 'none'` **já** bloqueia os *event handlers* inline ✗
>   (E5 ✗).
>
> **Como se faria (quando se decidir):**
>
> 1. calcular o hash do bloco inline **exactamente como é servido** (o
>    `public/js/cookie-consent.js` injecta-o ✗ — o texto tem de ser o que
>    chega ao browser ✗);
> 2. acrescentar `'sha256-…'` a `script-src` **em três sítios** ✗
>    (`src/lib/csp.ts` ✗, `public/_headers` ✗ e `docs/DEPLOY.md` ✗ — o
>    `npm run verify-csp` exige que sejam idênticos ✗);
> 3. **verificar em produção** ✗ que o Consent Mode continua a ser
>    definido ✗ (o `gtag('consent','default',…)` tem de correr ✗) e que
>    o contentor do GTM **ainda** carrega ✗;
> 4. só então **remover** `'unsafe-inline'` ✗.
>
> ⚠️ **Decisão em aberto** — fica registada para não ser um esquecimento ✗.

## E4 — A rotação dos 12 segredos (aberta)

`npm run gate:rotation` bloqueia a **publicação** enquanto **qualquer** uma
das 12 rotações de `docs/SPEC-SECURITY.md` §3 não estiver registada em
`docs/rotation-gate.md` (com a data, o responsável e o sha256 da captura).
O gate corre no **build command** da **Cloudflare Pages**
(`scripts/build-pages.mjs`) — **não** num job do GitHub (o workflow do
GitHub **só verifica** ✗) — e **não** no desenvolvimento local ✗.

⚠️ **O gate está CONTORNADO** (decisão **E15** / D88 ✗): o
`ROTATION_GATE=skip` está no ambiente de **Production** ✗ — a publicação
está a ocorrer com as 12 rotações por fazer ✗ (prazo: 2026-11-19 ✗).
