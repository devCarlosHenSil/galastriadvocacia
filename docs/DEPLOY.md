# DEPLOY — publicação em `https://galastriadvocacia.com.br`

> **Estado:** o repositório é **local** (**1 commit**, **sem remote**). O `deployer`
> cria o repositório público, faz o primeiro push e só depois aplica este runbook.
> **Gate duro (SEC-67):** o `deployer` **não publica** enquanto **qualquer** uma
> das **12** rotações de segredos de `docs/SPEC-SECURITY.md` §3 estiver
> por fazer. ⚠️ **O job de publicação fica VERMELHO de propósito** — é o gate
> a fazer o seu trabalho. **Não se "arrume" o gate** (nem se apague a linha
> do `rotation-gate.md`): publicar antes da rotação equivale a publicar as
> credenciais do backup.
> **Gate de redação (SEC-66):** `node scripts/guard-secrets.mjs` tem de passar
> **com `docs/` no escopo** e o bloco de redação tem de devolver **0 linhas**.

---

## 1. Checklist do primeiro push (na ordem)

> **Duas coisas têm de estar prontas antes do primeiro push:**
>
> 1. **A variável `PUBLIC_FORMSPREE_ENDPOINT`** no repositório (Settings →
>    Secrets and variables → Actions → **Variables**). Sem ela o **build falha**
>    (o formulário nunca é publicado morto) e o deploy não acontece.
> 2. **As 12 rotações de segredos** (SEC-67) — ver `docs/rotation-gate.md` e
>    `npm run gate:rotation`. O gate bloqueia a **publicação** (o job
>    `deploy` falha), **não** o `push`: o repositório pode — e deve — estar
>    público antes da rotação (os digest que nele vivem são de alta entropia; os
>    de baixa entropia estão no ficheiro local git-ignored).

```bash
# 1. a árvore de trabalho está limpa e o build é verde
git status --short                 # vazio
npm ci && npm run build            # 17 páginas
npm run guard                      # "no secret or personal data found"
npm run check-parity               # PASS nos 3 fixtures
npm run check-links                # 0 links internos quebrados

# 2. a redação de docs/ está verificada (SEC-66) -> 0 linhas
P='GOCS''PX''-|ya29\.|\$wp\$2y\$|\$P\$Beop|session''_tokens'
git grep -n -I -E "$P" -- docs && echo "FALHA" || echo "OK"

# 3. a rotação de segredos está 12/12 com evidência (SEC-31 / SEC-67)
#    -> o registo é docs/rotation-gate.md; o comando é:
npm run gate:rotation     # sai com 1 enquanto houver um ☐
```

> A **rotação é do cliente** (MySQL, 8 salts WP, 4 OAuth Google, Elementor
> Connect, Safe Mode, tokens avulsos, 2FA, retenção do backup, decisão sobre o
> WP antigo). A **verificação de redação** não a substitui: os segredos já
> circularam fora do repositório e precisam ser revogados de todo modo.

Depois: criar o repositório **público** `devCarlosHenSil/galastriadvocacia`,
ligar o remote e fazer o push para `main`. O workflow
(`.github/workflows/deploy.yml`) dispara sozinho.

---

## 2. DNS e Cloudflare

A zona `galastriadvocacia.com.br` está na **Cloudflare** (NS `anna`/`jaime`).

### 2.1 A configuração escolhida (uma só)

**O proxy da Cloudflare fica LIGADO (nuvem laranja).** É ele que aplica as
**Transform Rules** da §3 — a CSP e os 5 headers de segurança. O GitHub Pages
**não** suporta o ficheiro `_headers`, portanto **sem o proxy o site fica sem
CSP nenhuma** (o `<meta http-equiv>` é apenas um fallback: não transporta
`frame-ancestors`, `X-Frame-Options`, HSTS nem `nosniff`).

> ⚠️ **Nunca desligue o proxy laranja.** Se o proxy for desligado, as regras
> da §3 deixam de correr e o site fica **sem CSP e sem os headers** — e o
> `<meta>` não chega. A verificação da §3.4 é **bloqueante**: sem os 5 headers
> e a CSP completa, **o go-live não acontece**.

| Registro | Tipo | Valor | Proxy | TTL |
|---|---|---|---|---|
| `galastriadvocacia.com.br` | A | `185.199.108.153` | **ligado (laranja)** | 3600 |
| `galastriadvocacia.com.br` | A | `185.199.109.153` | **ligado (laranja)** | 3600 |
| `galastriadvocacia.com.br` | A | `185.199.110.153` | **ligado (laranja)** | 3600 |
| `galastriadvocacia.com.br` | A | `185.199.111.153` | **ligado (laranja)** | 3600 |
| `www.galastriadvocacia.com.br` | CNAME | `galastriadvocacia.com.br` | **ligado (laranja)** | 3600 |

O `www` aponta para o **apex** (e não para `devcarloshensil.github.io`): com o
proxy ligado, um CNAME direto para o GitHubPages sairia do perímetro da
Cloudflare e as Transform Rules não correriam para o `www`. O `www` é
canonicalizado no **apex** pela Redirect Rule da §3.3.

O modo TLS é **"Full (strict)"** e o GitHub Pages tem **"Enforce HTTPS" =
Enabled**.

### 2.2 O DNS medido (2026-10-19)

| Nome | Resolve para | Interpretação |
|---|---|---|
| `galastriadvocacia.com.br` | `104.21.57.72`, `172.67.161.120` (+ IPv6 `2606:4700:…`) | os **IP do proxy da Cloudflare** → o proxy **está ligado** ✓ |
| `www.galastriadvocacia.com.br` | `104.21.57.72`, `172.67.161.120` (+ IPv6 `2606:4700:…`) | o mesmo perímetro da Cloudflare ✓ |

O resolvedor devolve **sempre os IP da Cloudflare** (nunca os do GitHub
Pages) — é o comportamento esperado com o proxy ligado: os registos A
apontam para a origem (`185.199.108–111.153`) e a Cloudflare responde pelo
perímetro.

Verificar:

```bash
dig +short galastriadvocacia.com.br A          # os IP da Cloudflare (o proxy)
dig +short www.galastriadvocacia.com.br A      # os mesmos IP da Cloudflare
```

---

## 3. Headers de segurança (Cloudflare Transform Rules)

> **GitHub Pages NÃO suporta o ficheiro `_headers`** (verificado — o GitHub
> respondeu "No ETA"). A CSP e os headers vão, portanto, por **Transform
> Rules → Modify Response Header**. O `<meta http-equiv>` no layout do Astro é
> apenas o **fallback** (aceita CSP e Referrer-Policy; `nosniff`,
> `Permissions-Policy` e HSTS são ignorados em `<meta>`).

### 3.1 Regra 1 — a CSP (o valor exato está em `docs/SPEC-SECURITY.md` §2, SEC-42)

```
default-src 'self';
base-uri 'self';
object-src 'none';
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.gstatic.com https://www.google.com https://www.googletagservices.com;
script-src-attr 'none';
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
img-src 'self' data: https://www.google.com https://maps.gstatic.com https://maps.google.com https://*.googleusercontent.com https://*.ggpht.com https://www.gstatic.com;
connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.google.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://formspree.io https://www.googletagservices.com;
frame-src 'self' https://www.google.com https://maps.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.gstatic.com;
form-action 'self' https://formspree.io;
frame-ancestors 'none';
upgrade-insecure-requests
```

> `'unsafe-inline'` em `script-src` é **obrigatório** (o snippet do GTM é
> inline por desenho) e em `style-src` (o CSS gerado pelo Elementor usa
> `style="..."` inline). A consequência — a CSP **não** bloqueia XSS inline —
> está registada em `docs/SPEC-SECURITY.md` SEC-42.
> A reCAPTCHA da Formspree **é** a do Google: `https://www.gstatic.com` **já está** em
> `script-src`, `img-src` e `frame-src` (a string da CSP vive em `src/lib/csp.ts` e
> o `npm run verify-csp` compara-a com a deste runbook).

### 3.2 Regra 2 — os 5 headers (SEC-43)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self "https://www.google.com"), microphone=(), camera=(), payment=(), usb=(), browsing-topics=()
```

> `Referrer-Policy` **nunca** `no-referrer` nem `same-origin`: a Formspree
> usa o `Referer` para o "Restrict to Domain" e marcaria todo envio legítimo
> como spam (SEC-40).

Verificar:

```bash
curl -sI https://galastriadvocacia.com.br/ | grep -Ei "strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|content-security-policy"
```

### 3.3 Regra 3 — o redirect 301 de `/home/` (R4, SEC-67/T4.5)

| Origem | Destino | Estado |
|---|---|---|
| `https://galastriadvocacia.com.br/home/` | `https://galastriadvocacia.com.br/` | 301 (**regra pendente**: até lá, `/home/` responde 200 com o canonical para `/`) |

`src/data/redirects.json` é a fonte de verdade (1 entrada). A página
`/home/` também responde 200 com `<link rel="canonical" href=".../">` e
meta-refresh, para o caso de a regra ainda não existir.

### 3.4 Regra 0 (a **primeira**) — o 301 de `www` para o apex (C10)

> ⚠️ **Esta é a Redirect Rule mais importante do runbook.**

| Origem | Destino | Estado |
|---|---|---|
| `https://www.galastriadvocacia.com.br/*` | `https://galastriadvocacia.com.br/$1` | **301** |

**Porquê (SEC-10):** com `Referrer-Policy: strict-origin-when-cross-origin`, o
`Referer` enviado à Formspree a partir de `https://www.…` é um **host
diferente** do valor de "Restrict to Domain" (`galastriadvocacia.com.br`).
**Todas** as submissões legítimas seriam marcadas como spam e **nunca
entregadas** — o formulário deixaria de funcionar para o escritório.

A regra é **obrigatória** (ou, em alternativa, o "Restrict to Domain" da
Formspree tem de listar **os dois** hosts — `galastriadvocacia.com.br` **e**
`www.galastriadvocacia.com.br`). O runbook exige o 301: o apex é a única
URL canónica.

Verificar:

```bash
curl -sI https://www.galastriadvocacia.com.br/ | head -3
# HTTP/2 301
# location: https://galastriadvocacia.com.br/
```

### 3.5 A verificação **bloqueante** do go-live (C9)

Depois de publicar, **antes** de anunciar o site:

```bash
curl -sI https://galastriadvocacia.com.br/ | grep -Ei "strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|content-security-policy"
curl -sI https://www.galastriadvocacia.com.br/ | head -3
```

O go-live está **BLOQUEADO** se:

1. não aparecerem os **5 headers** (`Strict-Transport-Security`,
   `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
   `Permissions-Policy`);
2. a **CSP** não for a da §3.1 **completa** — em especial
   `frame-ancestors 'none'` (que o `<meta>` **não** transporta) e
   `object-src 'none'`;
3. o `www` **não** responder **301** para o apex.

Se a CSP ou os headers não aparecerem, o proxy da Cloudflare está **desligado**
(ou as Transform Rules não estão a correr) → **religar o proxy laranja** e
voltar a verificar. **Não publicar sem isto.**

---

## 4. GitHub Pages

| Definição | Valor |
|---|---|
| Source | **GitHub Actions** |
| Branch / folder | `main` / (root) — o workflow publica o artefacto |
| Custom domain | `galastriadvocacia.com.br` |
| `Enforce HTTPS` | **Enabled** |

O `public/CNAME` (`galastriadvocacia.com.br`) vai **dentro** do artefacto
(R18) — por isso está versionado e o `upload-pages-artifact` envia-o.

Verificar:

```bash
find dist -name CNAME -exec cat {} \;   # galastriadvocacia.com.br
```

---

## 5. Formulário (Formspree)

| Passo | Onde | O que |
|---|---|---|
| Conta | painel da Formspree | a **conta do cliente** (não a da agência) — Q1 da SPEC-SECURITY |
| Form ID | painel | `https://formspree.io/f/<ID>` |
| Destino | painel → Settings → Notifications | `contato@galastriadvocacia.com.br` |
| "Restrict to Domain" | painel → Settings | `galastriadvocacia.com.br` (sem `www`, sem protocolo) — **e o 301 do `www` é obrigatório** (§3.4): com o proxy ligado, o `Referer` de `www.…` é um host diferente e **todas** as submissões legítimas seriam marcadas como spam (SEC-10). Se o `www` não puder ser redirecionado, listar **os dois** hosts aqui. |
| reCAPTCHA | painel → Settings | **ativado** (SEC-38) |
| Quota | painel → Usage | free = **50 submissões/mês** → plano Personal definido **antes** de 50/mês (SEC-41) |

O endpoint **não** é um segredo: vai em `vars.PUBLIC_FORMSPREE_ENDPOINT` no
repositório GitHub (Settings → Secrets and variables → Actions → **Variables**
→ `PUBLIC_FORMSPREE_ENDPOINT`). O `.env` local serve para o `npm run dev`:

```bash
cp .env.example .env
# .env:  PUBLIC_FORMSPREE_ENDPOINT=https://formspree.io/f/<ID>
```

O `.env` está no `.gitignore` e **nunca** é versionado.

O CTA permanente do WhatsApp (`https://wa.me/5511985665992`) é o plano B
obrigatório: uma paragem silenciosa do formulário não pode significar perda
de leads (R14 / SEC-41).

---

## 6. Rollback

**Plano A — reverter o commit (2 minutos):**

```bash
git log --oneline -5
git revert <sha-do-deploy>        # NÃO use `git reset --hard` em `main`
git push origin main               # o workflow republica
```

**Plano B — reabrir um artefacto anterior:**

1. GitHub → **Deployments** → escolher o deployment anterior → **Re-run** /
   *Restore* do artifact no Pages.
2. Se o domínio já estiver no GitHub Pages, o artefacto restaurado volta a ser
   servido em segundos.

**Plano C — repor o DNS no host antigo:**

| Registro | Valor |
|---|---|
| `galastriadvocacia.com.br` (A) | o IP do host antigo do WordPress |
| `www.galastriadvocacia.com.br` (CNAME) | o mesmo host antigo |

O WordPress antigo tem de estar **acessível num host separado, sem DNS**
(janela de rollback de 30 dias, `docs/PROJECT-STATE.md` §7). Se ele foi
desligado, aplicamos **SEC-63** (lockdown) **antes** de religar o DNS.

> **Rollback testado uma vez** antes do go-live (item do Definition of Done).

---

## 7. Runbook do domínio (SEC-62)

| Situação | O que fazer |
|---|---|
| O repositório foi **renomeado** | O `public/CNAME` continua no build, mas a URL `devcarloshensil.github.io` muda → re-verificar o domínio customizado em Settings → Pages. |
| O repositório foi **transferido** | O Pages tem de ser re-autorizado (Settings → Pages → Source: **GitHub Actions**) na nova conta e o `CNAME` reconfirmado. |
| O repositório vai ser **excluído** | **Primeiro** remover o domínio customizado — senão o domínio fica "pendente" e pode ser apontado para outro. |
| Recomendação estrutural | Mover o repositório para uma **organização do cliente**, com 2FA obrigatório e branch protection, em vez de o deixar na conta pessoal de um programador. |

---

## 8. O contentor do GTM e a tag do AdSense (obrigatório do cliente)

⚠️ **O contentor do Google Tag Manager (`GTM-KDNG3QWB`) não pode conter uma
tag do AdSense.** O contentor só é carregado **depois** do consentimento
(`public/js/cookie-consent.js`), mas uma tag do AdSense dentro dele dispara
quando o contentor carrega — ou seja, escreve `IDE`, `test_cookie` e
`_gcl_au` **antes** da escolha do visitante.

A tag do AdSense do site é a do `<head>` (`ca-pub-5989678973778468`), que só
é ativada depois do consentimento.

**Verificar no painel do GTM** (Container → Tags → Publicidade): não pode haver
nenhuma tag do AdSense. Se houver, **removê-la**. O registo desta decisão está
em `docs/security-decisions.md` (E2).

---

## 9. O que o CI faz (e o que não faz)

`.github/workflows/deploy.yml` (verificado por `node scripts/verify-workflow.mjs`):

- dispara **apenas** em `push` para `main` e em `workflow_dispatch` — **`pull_request` não é um trigger** (SEC-51);
- `npm ci` + o audit (com a exceção fixada **pelo ID do advisory** — `scripts/check-audit.mjs`) + `node scripts/guard-secrets.mjs` + `npm run build`;
- publica o `dist/` no Pages com as 5 actions fixadas por SHA (SEC-50);
- `permissions` mínimas (o job de build **só lê** o repositório — SEC-R-07) e `persist-credentials: false` (SEC-52/54);
- **bloqueia a publicação** enquanto o gate da rotação não estiver fechado
  (`npm run gate:rotation`, SEC-R-09).

**O CI não** cria o repositório, **não** toca no DNS e **não** roda o
Formspree, a Cloudflare nem a rotação de segredos — são passos manuais
deste runbook.
