# SPEC-SECURITY — Threat model e requisitos testáveis (Galastri Advocacia)


> **Fonte:** agente `security` — threat model e requisitos SEC-23…SEC-67 sobre o backup real, a API do GitHub, o DNS e a documentação do Formspree/GitHub Pages.
> **Consolidado em:** 2026-10-19 · **Alvo:** `<LOCAL>/galastriadvocacia` → `devCarlosHenSil/galastriadvocacia` → `https://galastriadvocacia.com.br`.
> **Método:** leitura integral de `wp-config.php`, grep no dump SQL (34,7 MB) por `_key|_secret|_token|password|api_key|license|oauth|refresh_token`, GitHub API, DNS-over-HTTPS e docs oficiais do Formspree/GitHub Pages.

> 🔒 **Redação de credenciais (2026-10-19):** este arquivo é **publicado** no repositório público `devCarlosHenSil/galastriadvocacia`. **Nenhum valor de segredo é transcrito aqui.** Toda credencial é referenciada por **localização** (`wp-config.php` L25-34, `wp_options` id 7044, dump L3210) e por **forma** (prefixo, comprimento, tipo), nunca por valor. Os comandos de verificação **extraem o valor em tempo de execução** do backup local read-only (`<BACKUP>`, fora do repo). Ver **SEC-66** e o registro em `docs/PROJECT-STATE.md` §9.

---

## Rulings do EM aplicados a esta spec

| # | Ruling | O que mudou nesta spec |
|---|---|---|
| **R15** | **O repositório é PÚBLICO** (decisão do owner), sobrepondo a recomendação do agente de segurança de começar privado. | §2 (SEC-23…SEC-30) passa a ser **bloqueante de publicação**, não recomendação. `scripts/guard-secrets.mjs` é **obrigatório** no `prebuild` **e** no CI. §4 (verificação) mantém as listas "DEVE SER ZERO" como **gate de go-live**. |
| **R16** | **GitHub Pages NÃO suporta `_headers`** (verificado). CSP + headers vão por **Cloudflare Transform Rules** (a zona já está na Cloudflare) com fallback `<meta http-equiv>` no layout do Astro. | §2 (SEC-42/SEC-43) reescrito: a string da CSP é preservada, mas o **mecanismo** é Transform Rule + fallback `<meta>`. SEC-64/§4.2 citam a rota correta. |
| **R17** | **A rotação de segredos (SEC-31) é uma tarefa operacional BLOQUEANTE de pre-go-live**, pertencente ao cliente, listada como item de Fase 0 com checkbox — **não** como código. | §3 tem o checklist "Pre-go-live: rotação de segredos" como bloco próprio, operacional, com evidência obrigatória. |
| **R18** | **`public/CNAME` = `galastriadvocacia.com.br`** e precisa estar **dentro do artefato** do Pages. | SEC-56 detalhado: o `CNAME` vai em `public/` porque o deploy é via `actions/upload-pages-artifact`; definir o domínio só na UI **não** basta. |
| **R19** | **GitHub Actions**: fixar as 5 actions nos **SHAs de commit** listados; `pull_request` **NÃO** é trigger; `permissions` de menor privilégio; `persist-credentials: false`. | SEC-50…SEC-54 mantidos e reforçados; o template YAML de referência em §2.5 já sai pronto para uso. |
| **R14** | **Formspree**: endpoint via `PUBLIC_FORMSPREE_ENDPOINT`; honeypot `_gotcha`; `Accept: application/json`; `Referrer-Policy: strict-origin-when-cross-origin` (**nunca** `no-referrer`); "Restrict to Domain" = `galastriadvocacia.com.br`; reCAPTCHA ativo; free tier = **50 submissões/mês** → **CTA permanente de WhatsApp** ao lado do form. | SEC-36 (honeypot `_gotcha`), SEC-40 (dependência explícita do `Referer`), SEC-39 (domínio exato) e SEC-41 (quota + fallback WhatsApp). |
| **R13** | **Banner de cookies é obrigatório** (consequência de manter GTM + AdSense); o iframe do Maps é click-to-load e **gated on consent**. | SEC-44 mantém os 7 requisitos do banner; SEC-47 e a §5.2 (política de privacidade) refletem o gating do mapa. |

---

## 0. Método, convenção de IDs e o que foi verificado de fato

**Convenção de redação (SEC-66):** todo segredo é representado por um placeholder no formato `<REDACTED:o que é>` **seguido da origem e da forma** do valor — ex.: `<REDACTED:wp-config.php DB_PASSWORD>` (12 caracteres, `wp-config.php` L25-34). Um requisito **nunca** degenera em "verifique o segredo em algum lugar": ele sempre diz **onde** o valor vive e **como** derivá-lo em tempo de execução. Nomes de opção e de chave (`auth_key`, `client_secret`, `indexnow_api_key`, …) **podem** aparecer — são identificadores públicos do WordPress; **valores** não.

**Convenção:** ameaças = `SEC-01`…`SEC-22`. Requisitos testáveis = `SEC-23`…`SEC-67`. Cada requisito lista as ameaças que mitiga. QA e developer referenciam os IDs.

**Fontes inspecionadas (não suposições):**
- `<BACKUP>\wp-config.php` (lido integralmente)
- `..._backup_db\galastriadvocacia.com.br_wpvivid-…_backup_db.sql` (34,7 MB — grep por `_key|_secret|_token|password|api_key|license|oauth|refresh_token`)
- `wp_users`, `wp_usermeta`, `wp_options`, `wp_comments`, `wp_e_submissions`, `wp_e_submissions_values`, `wp_posts` (políticas), `uploads/`, `litespeed/`, `.htaccess`, `wpvivid_package_info.json`
- GitHub API: `get_me()`, `get_file_contents(devCarlosHenSil/galastriadvocacia)` → **404, o repositório ainda NÃO existe**
- DNS-over-HTTPS (`dns.google/resolve`) para `galastriadvocacia.com.br` (NS, A) e `www` (CNAME)
- `https://galastriadvocacia.com.br/` → **HTTP 522 confirmado** (origin WordPress fora do ar)
- Docs Formspree (`honeypot`, `how-to-prevent-spam`, `restrict-to-domain`, preços 2026) e GitHub Community (`_headers` em GitHub Pages)

**Achado estrutural que muda toda a avaliação de risco:** a pasta nova do Astro (`…\galastriadvocacia`) é **subpasta** da pasta do backup. `<BACKUP>` **não** é um repositório git hoje. Um `git init` no diretório errado publica o dump SQL e o `wp-config.php` no primeiro `git add .`. Isso é **SEC-01 / SEC-23** e é o risco #1 do projeto.

### 0.1 A superfície que *desaparece* (diga isso ao cliente)

O site novo é 100% estático: sem PHP, sem MySQL, sem `wp-login.php`, sem `xmlrpc.php`, sem `wp-admin/`, sem plugins, sem uploads executáveis, sem surface de upload de arquivo, sem painel. Desaparecem: SQLi, RCE via plugin/theme, brute force de login, XSS refletido no WP, file upload, Path Traversal, WP-CLI, cron, REST/XML-RPC. **Esta é a maior melhoria de segurança do projeto e deve ser comunicado.**

### 0.2 A superfície que *sobra* (onde vai o esforço)

1. Vazamento do repositório (o backup contém credenciais vivas).
2. Abuso do endpoint Formspree (relay de spam para `contato@`).
3. Supply chain de terceiros (GTM, AdSense, Maps, Formspree) + npm.
4. CI/CD (workflow, permissões, pin de actions, artefato).
5. DNS/TLS/domínio (Cloudflare → GitHub Pages, CNAME, takeover).
6. LGPD (dados pessoais, banner de cookies, transferência internacional).
7. Integridade de conteúdo (Markdown no repo → HTML).
8. O WordPress antigo, se voltarem a ligá-lo.

> Valores **redacted** (SEC-66). Cada linha foi localizada por grep; arquivo/linha quoted. **Nenhum valor é reproduzido aqui** — a coluna "Local real" é a origem, e a forma (prefixo/comprimento) basta para operar.

| # | Credencial / dado | Local real | Tipo | Risco |
|---|---|---|---|---|
| C1 | `DB_PASSWORD` = `<REDACTED:wp-config.php DB_PASSWORD>` (13 chars) · `DB_NAME`/`DB_USER` = `<REDACTED:nome do banco MySQL>` / `<REDACTED:usuário do MySQL>` · `DB_HOST=localhost` | `wp-config.php` L25-34 | **Segredo ativo** | **Critical** |
| C2 | 8 salts WP: `AUTH_KEY`, `SECURE_AUTH_KEY`, `LOGGED_IN_KEY`, `NONCE_KEY`, `AUTH_SALT`, `SECURE_AUTH_SALT`, `LOGGED_IN_SALT`, `NONCE_SALT` (64 chars cada) — **valores não reproduzidos** | `wp-config.php` L53-60 | **Segredo ativo** | **Critical** (forja cookie `wordpress_logged_in_*` de admin se o WP voltar) |
| C3 | Hash de senha do admin: `<REDACTED:hash de senha bcrypt>` (60 chars; prefixo `$wp$`+`2y$`+`10$`) | dump L1240, `wp_users` id 1 | Segredo | High |
| C4 | Hash de senha do autor: `<REDACTED:hash de senha phpass>` (34 chars; prefixo `$P`+`$`) | dump L1241, `wp_users` id 2 | Segredo | Medium |
| C5 | Chave de usermeta de sessões (`session`+`_tokens`) do user 1 → token 64-hex, IP `<REDACTED:IP de login do admin>`, UA Chrome 146, login 2026-03-22 | dump L1345, `wp_usermeta` id 16 | Segredo (sessão) | **High** |
| C6 | Chave de usermeta de sessões do user 2 → token 64-hex, IPv6 `<REDACTED:IPv6 de login>` | dump L1456, `wp_usermeta` id 134 | Segredo (sessão) | Medium |
| C7 | **Não existem** `application_passwords` (nem tabela nem linhas) | — | — | — |
| C8 | `wp_elementor_connect_common_data`: `client_id` 32c, `auth_secret` 32c, `access_token` JWT (`sub:7427774`, exp ~2070), `access_token_secret` 32c, e-mail `<REDACTED:e-mail de usuário WP>` | dump L1350, `wp_usermeta` id 21 | **Segredo** | High |
| C9 | `wp_googlesitekit_access_token` + `wp_googlesitekit_refresh_token` (Google OAuth) | dump L1401, L1404 | **Segredo** | High |
| C10 | `wp_googlesitekit_profile` → e-mail `<REDACTED:e-mail do perfil Site Kit>`, nome "Ana Paula Galastri" (público por design) | dump L1407 | PII | Medium |
| C11 | `wp_mail_smtp` → `gmail.client_id` (`<REDACTED:OAuth client_id>`, forma `…apps.googleusercontent.com`), **`gmail.client_secret`** `<REDACTED:OAuth client_secret>` (prefixo `GOCS`+`PX`+`-`), **`gmail.refresh_token`** `<REDACTED:OAuth refresh_token>` (prefixo `1`+`//`), `gmail.access_token` `<REDACTED:OAuth access_token>` (prefixo `ya29`+`.`), `auth_code` `<REDACTED:OAuth auth_code>` (prefixo `4`+`/0A`), `from_email` `<REDACTED:e-mail de envio do wp-mail-smtp>` | dump L3210, `wp_options` id 7044 | **Segredo** (envia e-mail como o escritório) | **Critical** |
| C12 | `wpvivid_upload_setting` → `auth_id` `<REDACTED:WP-Vivid auth_id>` (prefixo `wpvivid-auth`+`-`), Google Drive `access_token` + **`refresh_token`**, remote `galastriadvocaciabackup` | dump L3266, `wp_options` id 109337 | **Segredo** | High |
| C13 | Mesmo `refresh_token` do Drive + **caminhos absolutos do servidor** `/www/wwwroot/galastriadvocacia.com.br/…` | dump L3194 (`clean_task`), L3272 (`wpvivid_backup_list`), L3270 (`wpvivid_last_msg`) | Segredo + info disclosure | High |
| C14 | `rank_math_google_oauth_tokens` → `access_token` 588c + `refresh_token` 320c | dump L3152, `wp_options` id 892 | **Segredo** | High |
| C15 | `rank_math_connect_data` → `api_key` 192c ofuscado, `username`, `email` ofuscado, `plan` | dump L3513, `wp_options` id 161556 | Segredo | Medium |
| C16 | `indexnow_api_key` 32-hex | dump L3138, `wp_options` id 892 | Segredo | Low |
| C17 | `ea11y_client_secret` = `<REDACTED:client_secret do EqualWeb>` | dump L3523, `wp_options` id 161646 | Segredo | Medium |
| C18 | `elementor_safe_mode_token` 64-hex (habilita o Elementor Safe Mode) + `mu-plugins/elementor-safe-mode.php` | dump L3243, `wp_options` id 12694 | Segredo | High |
| C19 | `elementor_connect_site_key` = `<REDACTED:site_key do Elementor Connect>` (32-hex) | dump L3030, `wp_options` id 195 | Pseudo-secreto | Medium |
| C20 | `wordpress_api_key` = `<REDACTED:API key do WordPress.org>` (12-hex) | dump L3206, `wp_options` id 6676 | Segredo (API WP.org) | Low |
| C21 | `wp_options` duplica salts WP: `nonce_key`, `logged_in_key`, `secure_auth_key`, `auth_key` | dump L3008/3012/3014/3123 | Segredo | High |
| C22 | **48 comentários**: 4 pingbacks (ids 2-5, `<REDACTED:IP de pingback>`, WP 6.7.1 XML-RPC) + **44 spam** (ids 244-287: campanha "Hacklink Panel" de `<REDACTED:IP de campanha de spam>`; gambling `<REDACTED:IP de campanha de gambling>`; 44 e-mails de spammer distintos) | dump L2426-2473, `wp_comments` | PII de terceiros | Medium |
| C23 | **6 submissões do form Elementor / 24 valores** — inclui **PII de um cliente real**: `<REDACTED:nome do titular>` / `<REDACTED:e-mail do titular>` / `<REDACTED:telefone do titular>` / pergunta sobre antecipação de seguro-desemprego. As outras 5: 3 testes da agência, 1 spam SEO, 1 spam pornô em chinês. | dump L762-784 + L2853-2858 (`wp_e_submissions*`) | **PII de titular** | **High (LGPD)** |
| C24 | IPs de visitantes reais em `wp_e_submissions` (`<REDACTED:IPv4 de visitante>` ×2, `<REDACTED:IPv6 de visitante>` ×3) | dump L2853-2858 | PII | Medium |
| C25 | `wp_users` id 1 "Carlos Henrique" `<email administrativo do cliente>` (**administrator**), id 2 "Ana Paula Galastri" `<REDACTED:e-mail pessoal da autora>` (**author**) | dump L1240-1241 | PII + identidade | High |
| C26 | `litespeed/debug/debug05ad7d220e1f63da.log` (log PHP com stack traces) e `litespeed/robots.txt` = `User-agent: * / Disallow: /` | `litespeed/` | Info / config | Low |
| C27 | `uploads/2024/12/elementor-*.json_*.txt` (export de template), `uploads/ultimate-post-kit-backups/*.zip`, `uploads/rank-math/*.xml` | `uploads/` | Config/dump | Low |
| C28 | ZIPs de backup completos (contêm C1-C25) na raiz da pasta de trabalho | `*.zip` (7 arquivos) | Segredos | **Critical** |
| C27 | `uploads/2024/12/elementor-*.json_*.txt` (export de template), `uploads/ultimate-post-kit-backups/*.zip`, `uploads/rank-math/*.xml` | `uploads/` | Config/dump | Low |
| C28 | ZIPs de backup completos (contêm C1-C25) na raiz da pasta de trabalho | `*.zip` (7 arquivos) | Segredos | **Critical** |

**Confirmado como NÃO existente (corrige premissas do briefing):**
- **Não há** `wpr_license_key` / `elementor_pro_license` / `wpvivid_license` / nenhuma `*_license_key` no dump (grep por `licen[sc]e` → só texto do Elementor e do GitHub).
- `wpvivid_saved_api_token` = `a:0:{}` (vazio).
- `elementor_google_maps_api_key` = `''`; `elementor_pro_recaptcha_*` = `''`; `elementor_pro_stripe_*_secret_key` = `''`; `elementor_pro_mailchimp_api_key` = `''`; `elementor_pro_drip_api_token` = `''`; `elementor_pro_activecampaign_api_key` = `''`; `elementor_pro_getresponse_api_key` = `''`; `elementor_pro_convertkit_api_key` = `''`; `elementor_pro_mailerlite_api_key` = `''`; `litespeed.conf.api_key` = `''`; `litespeed.conf.cdn-cloudflare_key` = `''`.
- Sem `sk_live_`, `pk_live_`, `AC…` (Mailchimp), `SG.` (SendGrid), `AIza…` (Google API key), `ghp_`, `xox…`, `sk-…` (OpenAI), `Bearer <jwt>` genérico. **Nenhuma chave de Stripe, nenhum segredo de gateway de pagamento.**

**Consequência:** o vetor de comprometimento financeiro de API de pagamento (que seria o pior para um escritório) **não existe**. O vetor real é **e-mail (Gmail via wp-mail-smtp) + Google Drive (backups) + Google OAuth**, todos do domínio/agência.

**Infra verificada:**
- GitHub: `devCarlosHenSil` = **conta pessoal** (Carlos Silva, id 78239512, 47 repos públicos) — não é org, não é conta do cliente. Repo alvo **não existe**.
- DNS: NS `anna.ns.cloudflare.com` / `jaime.ns.cloudflare.com` → **Cloudflare**. Apex A = `172.67.161.120` / `104.21.57.72` (IP de proxy Cloudflare → **laranja ligado**). `www` **sem CNAME**.
- GitHub Pages **não suporta `_headers`** (confirmado: GitHub Community #157852 e #54257; resposta do GitHub "No ETA"). Só `CNAME` e `nojekyll` são arquivos especiais. **Logo, a alternativa correta é Cloudflare Transform Rules (já disponível, DNS está na Cloudflare) e, como fallback, `<meta http-equiv>` — que só funciona para CSP e Referrer-Policy.**

---

## 1. Modelo de ameaças

| ID | Ameaça | STRIDE | Likelihood | Impacto | Mitigação (requisitos) |
|---|---|---|---|---|---|
| **SEC-01** | **Dump SQL + `wp-config.php` commitados no repo público** → credencial de MySQL, 8 salts WP e hashes publicados. Com salts + hash, forja-se cookie `wordpress_logged_in_*` de **administrator** e o site volta com takeover total. | Info disclosure / Elevation | **Alta** (o dump está a 1 `git add .` de distância) | **Crítico** | SEC-23..SEC-28, SEC-44 |
| **SEC-02** | `wp-config.php` (senha do banco + salts) copiado para `public/` → publicado em `dist/` e servido no domínio. | Info disclosure | Média | **Crítico** | SEC-25, SEC-29, SEC-37 |
| **SEC-03** | E-mails dos 2 usuários WP + 44 e-mails de spammer + PII de cliente real + IPs de visitante no histórico git. Repositório público = indexado por scrapers. | Info disclosure | Alta | High | SEC-26, SEC-30 |
| **SEC-04** | Segredos Google (Gmail client_secret + refresh_token `<REDACTED:OAuth refresh_token>`, wpvivid Drive refresh_token, Site Kit refresh_token, Rank Math OAuth, Elementor Connect JWT) republicados ou reutilizados por terceiros → **envio de e-mail como o escritório** (phishing/spam com a marca) e leitura/escrita no Drive de backups (que contém o `wp-config.php`!). | Spoofing / Elevation | Média | **Crítico** (o Drive de backup é um segundo dump do dump) | SEC-27, SEC-31 (rotação **pré-requisito**, não opcional) |
| **SEC-05** | Repositório público = alvo de supply-chain: dependência npm maliciosa executa no CI e injeta script no `dist/` (supply chain) — o `GITHUB_TOKEN` do job de build tem `pages: write` + `id-token: write`. | Tampering | Média | High | SEC-42..SEC-47 |
| **SEC-06** | **PR de fork/externo dispara o workflow e faz deploy** → página do cliente serve conteúdo do atacante (phishing no domínio legítimo). | Tampering | Média (é o default do template `astro` no GitHub) | **Crítico** | SEC-45, SEC-46 |
| **SEC-07** | Actions fixadas por tag (`@v4`) → tag movida / action maliciosa → takeover do build. | Tampering | Baixa-Média | High | SEC-48 |
| **SEC-08** | **Endpoint Formspree usado como relay de spam** para `contato@galastriadvocacia.com.br` (o ID do form é público por design) → caixa de entrada do escritório inundada, e-mail do cliente marcado como spam (ruína a entregabilidade do domínio). | Denial of service / Abuse | **Alta** (bots varrem formulários; o WP antigo já sofreu 44 spams em comentários) | High | SEC-36..SEC-39, SEC-53 |
| **SEC-09** | Honeypot contornado (bots modernos leem o DOM) e ausência de CAPTCHA → spam garantido. | Abuse | Média | Medium | SEC-38, SEC-39 |
| **SEC-10** | "Restrict to Domain" do Formspree quebra porque `Referrer-Policy: no-referrer` → **todas as submissões legítimas marcadas como spam** (perda de clientes). | Denial of service (funcional) | Alta se mal configurado | **High** | SEC-40 (interdependência explícita) |
| **SEC-11** | Plano Formspree gratuito = 50 submissões/mês → estouro de quota = formulário **silenciosamente deixa de funcionar** (site de advocacia perde contatos). | Denial of service | Média | **High** | SEC-39, SEC-54 |
| **SEC-12** | **LGPD**: o form coleta nome/e-mail/telefone/mensagem (potencialmente dado sensível de saúde) e agora transita por **Formspree (EUA)** → transferência internacional sem mecanismo do art. 33. | Info disclosure / Non-compliance | **Alta** (o texto atual da política não menciona nada disso) | **High** (multa + dever de notificação) | SEC-49..SEC-52, SEC-55..SEC-58 |
| **SEC-13** | **GTM + AdSense carregam sem consentimento** → cookies de publicidade comportamental sem base legal. O Guia da ANPD (out/2022) exige consentimento prévio, livre, informado, inequívoco, **não-necessários desligados por padrão**, banner com "rejeitar todos", painel de preferências e **revogação tão fácil quanto a concessão**. | Non-compliance / Reputação | **Alta** (AdSense hoje está no site) | High | SEC-51, SEC-52 |
| **SEC-14** | **Sem banner**, a primeira visita já dispara GTM/AdSense → coleta antes do consentimento + sem prova de consentimento (Art. 6º, X). | Non-compliance | Alta | High | SEC-51 |
| **SEC-15** | AdSense serve **conteúdo de terceiros** (malvertising) num site de advocacia → risco de script malicioso no domínio do cliente + dano reputacional. | Tampering | Média | Medium | SEC-41 (CSP), SEC-53 |
| **SEC-16** | **Conta GTM sequestrada** → GTM serve JS arbitrário a todos os visitantes (sem build, sem PR, sem revisão). | Tampering | Baixa-Média | High | SEC-41, SEC-62 |
| **SEC-17** | Conteúdo do repo (Markdown/HTML do Elementor) renderizado com `set:html` → **XSS armazenado** se um editor colar `<script>`. Não há input de runtime, então não há XSS remoto; o risco é o commit. | Tampering | Média | High | SEC-41, SEC-45, SEC-60 |
| **SEC-18** | **DNS**: apex proxied na Cloudflare apontando para GitHub Pages; erro de configuração (laranja ligado sem CNAME válido, ou `www` sem CNAME) → site fora do ar ou http. | DoS / Spoofing | Média | High | SEC-56..SEC-59 |
| **SEC-19** | **CNAME ausente do `public/`** → GitHub Pages serve em `devcarloshensil.github.io` e o domínio customizado não resolve (ou resolve para o site errado). | DoS | Média | High | SEC-56 |
| **SEC-20** | Repo **renomeado/transferido/excluído** → o binding do Pages se quebra; se o usuário `devCarlosHenSil` for liberado, um atacante pode hospedar clone em `devcarloshensil.github.io` (phishing). | Spoofing / DoS | Baixa | Medium | SEC-60, SEC-63 |
| **SEC-21** | **WordPress antigo religado**: `wp-login.php`, `xmlrpc.php`, `wp-admin/` expostos; `wp-content/wpvividbackups/` com o backup completo **em diretório web acessível**; 44 spams de comentários. | Elevation / Info disclosure | Média | **Crítico** | SEC-62, SEC-64 |
| **SEC-22** | Vazamento de **segredo de build** em log do CI (`set -x`, `npm` verbose) ou em `PUBLIC_*` do Astro. | Info disclosure | Baixa | Medium | SEC-33, SEC-43 |

---

## 2. Requisitos de segurança testáveis (SEC-23 … SEC-67)

> **Ambiente:** QA roda na raiz do repo novo `<LOCAL>/galastriadvocacia`.
> Comandos em bash (Git Bash) e, quando indicado, equivalente PowerShell.
> **R15 — o repositório é PÚBLICO:** SEC-23…SEC-30 são **bloqueantes de publicação** (gate de go-live), não recomendações.

### Bloco A — Higiene do repositório (bloqueante de publicação)

**SEC-23 — A raiz do repositório git é a pasta do Astro, nunca a pasta do backup.** *(Critical · SEC-01, SEC-02)*
Verificar: `git rev-parse --show-toplevel` → deve imprimir o caminho do repo novo (`<LOCAL>/galastriadvocacia`). Além disso, `Test-Path "..\wp-config.php"` deve ser `True` mas `git check-ignore -v ../wp-config.php` **não deve** resolver (ou seja, ele está **fora** da árvore). Jamais executar `git init` em `<BACKUP>`.

**SEC-24 — `.gitignore` cobre o conjunto mínimo obrigatório.** *(Critical · SEC-01, SEC-02)*
Verificar: `git check-ignore -v .env .env.local node_modules dist .astro wp-config.php dump.sql backup.zip` → **7 linhas**, cada uma apontando para uma regra. Conteúdo mínimo exigido (arquivo `.gitignore` na raiz do repo):

```gitignore
# --- Dependências e artefatos de build ---
node_modules/
dist/
.astro/
.output/
.vercel/
.netlify/

# --- Segredos e ambiente ---
.env
.env.*
!.env.example
*.pem
*.key
*.p12

# --- Backup do WordPress: NUNCA versionar ---
*.sql
*.sql.gz
*.zip
*.tar
*.tar.gz
*.tgz
wp-config.php
wp-config-*.php
.htaccess
wp-content/
wp-admin/
wp-includes/
*.bak
*.bk
*.old
*.log

# --- SO / editor ---
.DS_Store
Thumbs.db
.idea/
.vscode/*
!.vscode/extensions.json
```
(Se algum `.zip` legítimo for necessário no site, usar `!public/**/*.zip` como exceção explícita.)

**SEC-25 — Nenhum arquivo do backup do WordPress está rastreado.** *(Critical · SEC-01, SEC-02)*
Verificar:
```bash
git ls-files | grep -Ei '^(wp-config|\.sql$|\.zip$|wp-content/|wp-admin/|wp-includes/|\.htaccess$)'
```
→ **saída vazia**. E `git ls-files | wc -l` deve ser compatível com um site Astro (dezenas de arquivos), **nunca** milhares.

**SEC-26 — Nenhuma credencial do dump aparece no conteúdo rastreado.** *(Critical · SEC-01, SEC-03, SEC-04)*
Requisito: **nenhum valor** do `wp-config.php` e do dump pode aparecer no repositório. O valor **não** é transcrito nesta spec: ele é **extraído em tempo de execução** do backup local, que é **read-only** e vive **fora** do repositório (`<BACKUP>`).

**Bloco 1 — todos os `define()` do `wp-config.php`** (cobre a senha do MySQL e os 8 salts):
```bash
# bash (Git Bash)
CFG="<BACKUP>/wp-config.php"
fail=0
while IFS= read -r v; do
  [ ${#v} -lt 8 ] && continue
  if git grep -n -I -F -- "$v" -- . ; then fail=1; echo "FALHA: valor de wp-config.php versionado"; fi
done < <(grep -oP "define\(\s*'[A-Z_0-9]+'\s*,\s*'\K[^']+" "$CFG")
[ $fail -eq 0 ] && echo "OK: nenhum valor do wp-config.php no repo"
```
```powershell
# PowerShell
$cfg = '<BACKUP>\wp-config.php'
$fail = $false
Select-String -Path $cfg -Pattern "define\(\s*'[A-Z_0-9]+'\s*,\s*'([^']+)'" -AllMatches | ForEach-Object {
  $_.Matches | ForEach-Object {
    $v = $_.Groups[1].Value
    if ($v.Length -ge 8) {
      git grep -n -I -F -- "$v" -- .
      if ($LASTEXITCODE -eq 0) { "FALHA: valor de wp-config.php versionado"; $script:fail = $true }
    }
  }
}
if (-not $fail) { "OK: nenhum valor do wp-config.php no repo" }
```

**Bloco 2 — valores das opções sensíveis do dump** (`wp_options` + `wp_usermeta`): OAuth do Gmail, WP-Vivid/Drive, Rank Math, Site Kit, Elementor Connect, Safe Mode e os tokens avulsos.
```bash
# bash (Git Bash)
DUMP="<BACKUP>/<dump>.sql"
OPTS='wp_mail_smtp|wpvivid_upload_setting|clean_task|wpvivid_backup_list|rank_math_google_oauth_tokens|rank_math_connect_data|wp_googlesitekit_access_token|wp_googlesitekit_refresh_token|wp_elementor_connect_common_data|elementor_safe_mode_token|elementor_connect_site_key|ea11y_client_secret|wordpress_api_key|indexnow_api_key|trustindex-google-review-download-token'
fail=0
while IFS= read -r v; do
  [ ${#v} -lt 12 ] && continue
  if git grep -n -I -F -- "$v" -- . ; then fail=1; echo "FALHA: valor de wp_options versionado"; fi
done < <(grep -oP "'($OPTS)',\K[^']{12,}" "$DUMP" | sort -u)
[ $fail -eq 0 ] && echo "OK: nenhum valor de wp_options no repo"
```
```powershell
# PowerShell
$dump = '<LOCAL>/<dump>.sql'
$opts = 'wp_mail_smtp|wpvivid_upload_setting|clean_task|wpvivid_backup_list|rank_math_google_oauth_tokens|rank_math_connect_data|wp_googlesitekit_access_token|wp_googlesitekit_refresh_token|wp_elementor_connect_common_data|elementor_safe_mode_token|elementor_connect_site_key|ea11y_client_secret|wordpress_api_key|indexnow_api_key|trustindex-google-review-download-token'
$fail = $false
Select-String -Path $dump -Pattern "'($opts)',([^']{12,})" -AllMatches | ForEach-Object {
  $_.Matches | ForEach-Object {
    $v = $_.Groups[2].Value
    git grep -n -I -F -- "$v" -- .
    if ($LASTEXITCODE -eq 0) { "FALHA: valor de wp_options versionado"; $script:fail = $true }
  }
}
if (-not $fail) { "OK: nenhum valor de wp_options no repo" }
```

**Bloco 3 — hashes de senha e tokens de sessão** (`wp_users` e `wp_usermeta`):
```bash
# bash (Git Bash)
# 3o campo da tupla de wp_users (hash de senha) + qualquer valor hexadecimal longo de usermeta (token de sessão)
{ grep -oP "VALUES \(\d+,'[^']+','\K[^']{20,}" "$DUMP"; grep -oP "VALUES \(\d+,'[^']+','\K[a-f0-9]{40,}" "$DUMP"; } | sort -u | while IFS= read -r v; do
  [ ${#v} -lt 20 ] && continue
  git grep -n -I -F -- "$v" -- . && echo "FALHA: hash ou token de sessão versionado"
done
echo "OK (nenhuma linha de grep acima = 0 hits)"
```

**Bloco 4 — nomes de opção sensíveis no output versionado** (aqui é seguro listar os *nomes*; os *valores* estão nos blocos 1-3):
```bash
git grep -n -I -E "wp_mail_smtp|wpvivid_upload_setting|rank_math_google_oauth_tokens|wp_googlesitekit_|elementor_safe_mode_token|ea11y_client_secret|wordpress_api_key|indexnow_api_key|trustindex-google-review-download-token" -- src public
```
→ **0 linhas**.

> A lista **canônica** dos padrões está em `scripts/lib/forbidden.mjs` (código, fora de `docs/`). Depois da SEC-65, `node scripts/guard-secrets.mjs` é a checagem completa e automatizada deste requisito.

**SEC-27 — Nenhuma PII de terceiros no repositório.** *(High · SEC-03, SEC-04)*
Requisito: nenhum e-mail, telefone, IP ou identificador de terceiro do dump pode aparecer no repositório. Os valores **não** são transcritos: são **extraídos do dump em tempo de execução** (o dump contém os 2 e-mails de usuário, os 44 e-mails de spammer, o e-mail de um cliente real e os IPs).

```bash
# bash (Git Bash)
DUMP="<BACKUP>/<dump>.sql"
ALLOWED='^contato@galastriadvocacia\.com\.br$'    # único e-mail público por design
fail=0
while IFS= read -r e; do
  git grep -n -I -F -- "$e" -- . && { fail=1; echo "FALHA: e-mail de terceiro no repo"; }
done < <(grep -oP "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" "$DUMP" | sort -u | grep -vE "$ALLOWED")
[ $fail -eq 0 ] && echo "OK: nenhum e-mail de terceiro no repo"
```
```powershell
# PowerShell
$dump = '<LOCAL>/<dump>.sql'
$allowed = '^contato@galastriadvocacia\.com\.br$'
$fail = $false
Select-String -Path $dump -Pattern "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" -AllMatches | ForEach-Object {
  $_.Matches | ForEach-Object {
    $e = $_.Value
    if ($e -notmatch $allowed) {
      git grep -n -I -F -- $e -- .
      if ($LASTEXITCODE -eq 0) { "FALHA: e-mail de terceiro no repo"; $script:fail = $true }
    }
  }
}
if (-not $fail) { "OK: nenhum e-mail de terceiro no repo" }
```

Campanhas de spam (strings públicas, não são credenciais nem PII):
```bash
SPAM='hack''link''panel|axie''bet|shbet''game|1''bet|welcome''to''s666|ket''quanet|hack''link'
git grep -n -I -E "$SPAM" -- . ':!scripts/lib/forbidden.mjs'
# (a lista canonica dos padroes, scripts/lib/forbidden.mjs, fica de fora: ela tem de descrever o que procura)
```
→ **0 linhas**.

**Permitido** (deliberadamente público): o nome **"Ana Paula Galastri"** como autora, `GTM-KDNG3QWB`, `ca-pub-5989678973778468`, o ID do form Formspree, `wa.me/5511985665992` (WhatsApp comercial), endereço e telefone do escritório, e o e-mail **público** `contato@galastriadvocacia.com.br`.
> **R6:** o e-mail **administrativo do cliente** (`<email administrativo do cliente>` — deriva de `wp_options.admin_email`, dump L…) é explicitamente **proibido** em qualquer arquivo versionado. Para verificá-lo sem transcrevê-lo: `ADMIN=$(grep -oP "admin_email','\K[^']+" "$DUMP")` e procure `$ADMIN` no repo.

**SEC-28 — O histórico git está limpo (o dump nunca foi commitado).** *(Critical · SEC-01)*
Verificar:
```bash
git log --all --oneline
git rev-list --objects --all | grep -Ei "\.sql$|wp-config|\.zip$|dist/"
```
→ **vazio**. Se aparecer algo: **criar o repositório do zero** (não `git rm` — o objeto permanece no histórico e no garbage collection do GitHub).

**SEC-29 — `dist/` não contém segredos, dumps, `.map` nem `.env`.** *(Critical · SEC-02)*
Verificar (após `npm run build`):
```bash
find dist -name "*.map" -o -name ".env*" -o -name "*.sql" -o -name "*.zip" -o -name "wp-config.php"
```
→ **vazio**. E `du -sh dist` deve ser compatível com as mídias migradas (ordem de MB), **não** de GB (sinal de que a `wp-content/uploads` inteira foi copiada).

**SEC-30 — A guarda de segredos roda no build e no CI.** *(High · SEC-01, SEC-03, SEC-04, SEC-22)*
Requisito: um script de guarda (`scripts/guard-secrets.mjs`, sem dependência externa) que:
1. varre `src/`, `public/`, `scripts/`, `tests/`, a raiz do repo **e `docs/`** (excluindo `node_modules/`, `.git/`, `dist/`) — `docs/` com o **perfil de valor** (SEC-65), porque as specs precisam **nomear** as opções sem reproduzir valores;
2. falha (exit ≠ 0) se encontrar **qualquer** item da lista de SEC-26/SEC-27, ou arquivo com nome `wp-config*.php`, `*.sql`, `*.zip`;
3. falha se encontrar `<script`, `onerror=`, `onload=`, `javascript:` dentro de `src/content/**` (exceto lista explícita de allowlist, ex.: o snippet GTM em `src/layouts/`);
4. é invocado por `"prebuild": "node scripts/guard-secrets.mjs"` no `package.json` **e** por um step próprio no workflow.
Verificar: introduzir temporariamente um **valor vivo** do backup (a senha da base de dados, um salt, um token) num arquivo Markdown → `npm run build` **deve falhar**; remover → **deve passar**.
> **Nota (D17):** o *nome* da opção (`DB_PASSWORD`) **não** faz falhar o build — a especificação nomeia legítimamente as opções que têm de ser revogadas (é o seu propósito) e o perfil de `docs/` exclui os padrões de nome. O que é apanhado é o **valor**.
> **R15 — no repo PÚBLICO este requisito é obrigatório, não opcional.**

### Bloco B — Secrets: o que é público e o que é secreto

**SEC-31 — Rotação dos segredos vivos ANTES de publicar.** *(Critical · SEC-04, SEC-21)*
Não é código, é operação, mas é **bloqueante**. Ver o checklist completo em **§3 — Pre-go-live: rotação de segredos**.

**SEC-32 — Regra de classificação de `PUBLIC_*` (Astro).** *(Medium · SEC-22)*
**Regra:** qualquer valor `PUBLIC_*` do Astro é **embutido no JavaScript do cliente e visível no `dist/`**. Portanto:
- **Público (pode ir em `PUBLIC_*` ou hard-coded no HTML):** ID do container GTM `GTM-KDNG3QWB`; ID do anunciante AdSense `ca-pub-5989678973778468`; **ID do formulário Formspree** (`https://formspree.io/f/<FORM_ID>`); URLs públicas (Maps, WhatsApp); nomes de imagens.
- **Secreto (nunca em `PUBLIC_*`, nunca no repo, nunca no `dist/`):** `access_key` do Web3Forms (**não usado — decisão correta, evitou um segredo no front**); chaves de API private; `client_secret`; senhas; refresh tokens; webhook secrets; `GITHUB_TOKEN`.
Verificar:
```bash
git grep -n -I -E "access_key|api[_-]?key|apiKey|client_secret|secret_key|webhook|private[_-]key|BEGIN [A-Z ]*PRIVATE KEY" -- src public
```
→ **0 linhas** (os IDs públicos não casam com esses padrões).
E: `git ls-files .env*` → apenas `.env.example` (se existir), e `.env.example` **não** contém valor real.

**SEC-33 — Nenhum segredo exposto via `astro:env`/build log.** *(Medium · SEC-22)*
Verificar: o workflow não usa `set -x` nem `npm run build --verbose`; `printenv` não aparece no workflow; nenhuma variável sem o prefixo `PUBLIC_` é lida em `src/`.

### Bloco C — Formulário / Formspree

**SEC-34 — O endpoint Formspree é o único destino do form e o ID é público (não é segredo).** *(Medium · SEC-08)*
Verificar: `grep -n "formspree.io/f/" src/**/*.astro` → exatamente 1 ocorrência, com o formato `https://formspree.io/f/<ID>`; `method="POST"`; `action` **aponta para formspree.io** (nunca para `mailto:`, nunca para o e-mail do cliente em texto puro — isso revelaria o e-mail no HTML, o que a Formspree eliminou de propósito).

**SEC-35 — Campos com `required`, `type` correto e `autocomplete`.** *(High · SEC-08, SEC-12)*
Verificar no HTML gerado (`dist/index.html`):

| Campo | Atributos obrigatórios |
|---|---|
| nome | `name="nome"` `type="text"` `required` `autocomplete="name"` `maxlength="120"` |
| e-mail | `name="email"` `type="email"` `required` `autocomplete="email"` `maxlength="254"` |
| telefone | `name="telefone"` `type="tel"` `required` `autocomplete="tel"` `inputmode="tel"` `pattern` de máscara BR `maxlength="19"` |
| mensagem | `name="mensagem"` `type="textarea"` `required` `minlength="20"` `maxlength="4000"` |

Comando:
```bash
grep -o '<input[^>]*name="\(nome\|email\|telefone\)"[^>]*>' dist/**/*.html | grep -c 'required'
```
→ **3**; e `grep -c 'autocomplete=' ` → **3**.

**SEC-36 — Honeypot `_gotcha` presente e invisível.** *(High · SEC-08, SEC-09)*
Verificar: `grep -o 'name="_gotcha"' dist/**/*.html` → **≥1**; o input deve estar `type="text"` com `tabindex="-1"` e `autocomplete="off"`, escondido por CSS (classe `display:none` / `position:absolute;left:-9999px`), **não** `type="hidden"` (o Formspree detecta campo *preenchido*; `hidden` também funciona, mas `text` + CSS é o padrão documentado pela Formspree).
> **R14:** o nome do honeypot é `_gotcha` (padrão Formspree). O Elementor Pro usava `form_fields[form_checkbox]` — não reaproveitar.

**SEC-37 — O formulário é renderizado sem `set:html` de dado de usuário e sem JS que reflita entrada.** *(High · SEC-17)*
Verificar:
```bash
git grep -n -I "set:html" -- src
```
→ cada ocorrência deve ser **literal de build-time** (ex.: um trecho HTML estático do Elementor migrado, ou conteúdo Markdown renderizado). **Nenhuma** pode usar `Astro.request`, `Astro.url.searchParams`, `Astro.cookies` ou `formData`. Como o site é `output: 'static'`, `Astro.request` nem existe — a checagem é: `git grep -n "Astro.request\|Astro.cookies\|searchParams" -- src` → **0 linhas**.

**SEC-38 — reCAPTCHA do Formspree ativado no projeto.** *(High · SEC-09)*
Verificar (painel Formspree → Settings → reCAPTCHA): habilitado. Configuração: reCAPTCHA **invisível v3** ou v2 checkbox; com `form-action` já restrito a `https://formspree.io` na CSP, o script do reCAPTCHA precisa estar na CSP — **se a versão escolhida for a do Google reCAPTCHA**, acrescentar `https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/` em `script-src` e `frame-src` da CSP (SEC-42). *A Formspree hospeda o widget; o script é carregado por ela — testar em produção.*

**SEC-39 — "Restrict to Domain" = `galastriadvocacia.com.br` (sem `www`, sem protocolo).** *(High · SEC-08)*
Verificar (painel Formspree → Settings): campo preenchido exatamente com `galastriadvocacia.com.br` (a documentação diz que, sem subdomínio, casa com o domínio e qualquer subdomínio, inclusive `www`). Teste funcional: `curl -s -o /dev/null -w "%{http_code}" -X POST https://formspree.io/f/<ID> -H "Referer: https://site-de-spam.example/" -d "nome=x&email=x@example.com"` → a submissão **não** deve chegar ao e-mail (vai para spam). Com `Referer: https://galastriadvocacia.com.br/` → **deve** chegar.
⚠️ **Esta é uma mitigação de BEST-EFFORT, não um controle de segurança**: um atacante com `curl` pode forjar o cabeçalho `Referer`. Ela bloqueia uso acidental/robô-de-indexação, **não** um Determination. Os controles reais são reCAPTCHA (SEC-38), honeypot (SEC-36) e o filtro ML da Formspree.

**SEC-40 — `Referrer-Policy` **não** pode ser `no-referrer` nem `same-origin`.** *(High · SEC-10)*
A "Restrict to Domain" da Formspree depende do cabeçalho `referer`. A própria documentação da Formspree avisa: *"If your web server sends a `referrer-policy` header the strictest setting it can use is `strict-origin-when-cross-origin`"*. `no-referrer`/`same-origin` → todas as submissões legítimas marcadas como spam.
Verificar: `curl -sI https://galastriadvocacia.com.br/ | grep -i referrer-policy` → **`strict-origin-when-cross-origin`** (nunca `no-referrer`).

**SEC-41 — Quota e plano do Formspree monitorados; sem estouro silencioso.** *(High · SEC-11)*
O plano gratuito = **50 submissões/mês**, 30 dias de retenção, e-mail de notificação **com marca Formspree**, 1 usuário. Verificar: (a) na fase de homologação, contar as submissões; (b) configurar alerta/verificação mensal do contador; (c) definir o plano pago (Personal, ~US$ 10/mês) **antes** de o limite ser atingido, ou aceitar o risco com plano de contingência documentado. Em produção, `curl -X POST` real → 1 envio de teste por semana no máximo, e **nunca** usar o endpoint de produção para testes (usar o form de homologação).
> **R14 — o plano B obrigatório:** um **CTA permanente de WhatsApp** ao lado do formulário (`https://wa.me/5511985665992`, texto "Prefere falar agora? Fale com a gente pelo WhatsApp"), para que uma eventual parada silenciosa do formulário **não** signifique perda de leads.

### Bloco D — CSP, headers e cookies

**SEC-42 — CSP aplicada e restritiva.** *(High · SEC-15, SEC-16, SEC-17)*

> **R16 — Fato verificado: GitHub Pages NÃO suporta `_headers`.** Só `CNAME` e `nojekyll` são arquivos especiais; a resposta oficial do GitHub é "No ETA" para headers customizados.
> **Caminho correto neste projeto: a zona DNS já é Cloudflare** → use **Cloudflare → Rules → Transform Rules → Modify Response Header** (disponível no plano Free) para injetar os headers. **Fallback: `<meta http-equiv>` no layout do Astro** (aceita apenas CSP e Referrer-Policy; `X-Content-Type-Options`, `Permissions-Policy` e HSTS **são ignorados em `<meta>`**).

**CSP exata recomendada (cabeçalho HTTP):**
```
default-src 'self';
base-uri 'self';
object-src 'none';
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.gstatic.com https://www.google.com https://www.googletagservices.com;
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
img-src 'self' data: https://www.google.com https://maps.gstatic.com https://maps.google.com https://*.googleusercontent.com https://*.ggpht.com https://www.gstatic.com;
connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.google.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://formspree.io https://www.googletagservices.com;
frame-src 'self' https://www.google.com https://maps.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.gstatic.com;
form-action 'self' https://formspree.io;
frame-ancestors 'none';
upgrade-insecure-requests
```

**Versão `<meta http-equiv="Content-Security-Policy">` (fallback)** — **idêntica, removendo `frame-ancestors 'none'` e `upgrade-insecure-requests`** (são ignorados em `<meta>`).

Trade-offs a registrar em `docs/architecture.md`:
- `'unsafe-inline'` em `script-src` é **obrigatório** porque o snippet do GTM é inline por desenho. Consequência: a CSP **não** bloqueia XSS inline. O que ela **continua** bloqueando: exfiltração para hosts não listados (`connect-src`/`img-src`), `<object>`/`base` injection, e formulários para destinos não permitidos (`form-action`).
- `'unsafe-inline'` em `style-src` é necessário pelo CSS gerado do Elementor e por `style="..."` inline.
- `img-src https://*.google.com` é amplo porque o AdSense serve imagens de subdomínios do Google.
- Se a reCAPTCHA for habilitada (SEC-38) e carregar `https://www.gstatic.com/recaptcha/`, acrescentar `https://www.gstatic.com` a `script-src`, `img-src` e `frame-src`.
- **Antes de fixar a string**, confirmar o `src` real do iframe do Maps no HTML gerado: `grep -o 'src="https://[^"]*maps[^"]*"' dist/**/*.html` → se for `https://www.google.com/maps/embed`, a lista acima já cobre; se aparecer `maps.googleapis.com`, acrescentar.

Verificar: `curl -sI https://galastriadvocacia.com.br/ | grep -i content-security-policy` → contém `form-action 'self' https://formspree.io` e `object-src 'none'`. Ou, se fallback meta: `grep -c 'http-equiv="Content-Security-Policy"' dist/index.html` → **1** e ele aparece **antes** de qualquer `<script>` no `<head>`.
Teste funcional: DevTools → Console → **zero** violações de CSP ao navegar a home, a página de contato (enviar o form) e a página do blog.

**SEC-43 — Demais headers de segurança aplicados.** *(High · SEC-15, SEC-16)*
Valores exatos para a regra Cloudflare (ou via `_headers` caso o hosting mude no futuro):
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self "https://www.google.com"), microphone=(), camera=(), payment=(), usb=(), browsing-topics=()
```
`Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy`: **não** adotar (o AdSense/GTM quebram com COEP; COOP `same-origin-allow-popers` é opcional e deve ser testado).
Verificar: `curl -sI https://galastriadvocacia.com.br/ | grep -Ei "strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy"` → **5 linhas** com os valores acima. `x-frame-options: DENY` **não** impede o site de *embutir* o Maps (é o inverso).

**SEC-44 — Banner de cookies com consentimento prévio, granular, revogável e em português.** *(High · SEC-13, SEC-14)*
Verificar:
1. GTM e AdSense **não carregam** antes do consentimento (usar o *Consent Mode* / *Basic Consent Mode* do GTM: `default: { analytics_storage: 'denied', ad_storage: 'denied', ... }` antes do `gtm.js`; e o `adsbygoogle.js` injetado **após** o consentimento).
2. Banner de primeiro nível com **dois botões de mesmo peso visual** ("Aceitar" / "Rejeitar") — o Guia da ANPD desaconselha um único botão sem gerenciamento.
3. **Painel de segundo nível** com categorias (necessários / analíticos / publicidade) e link permanente no rodapé "Gerenciar preferências de cookies".
4. Cookies não necessários **desligados por padrão**.
5. Consentimento **revogável** com a mesma facilidade com que foi concedido.
6. **Registro do consentimento** (timestamp + versão da política + categorias) para demonstrar conformidade (Art. 6º, X).
7. Todo o texto do banner e da política de cookies em **português do Brasil**.
Verificar: em janela anônima, `curl`/DevTools → **nenhuma requisição** a `googletagmanager.com`, `googlesyndication.com` ou `doubleclick.net` antes de clicar; após "Rejeitar", `document.cookie` não deve conter `IDE`, `test_cookie`, `_gcl_au` (AdSense) nem `_ga` (Analytics).

**SEC-45 — `set:html` só com literal de build-time; integridade do conteúdo por revisão de PR.** *(High · SEC-17)*
Verificar: `git grep -n "set:html" -- src` → cada ocorrência com literal; e **branch protection em `main`** (ver SEC-49) + revisão por PR obrigatória. A checagem automatizada de `<script` em `src/content/**` está em SEC-30.

**SEC-46 — Links externos com `rel="noopener noreferrer"`.** *(Medium · SEC-17)*
Verificar:
```bash
grep -o '<a [^>]*target="_blank"[^>]*>' dist/**/*.html | grep -vc 'rel="[^"]*noopener'
```
→ **0** (todo `target="_blank"` tem `noopener`). `noreferrer` é obrigatório em links para **terceiros** (Instagram, WhatsApp, Google Maps) e **opcional** em links internos.

**SEC-47 — Iframe do Maps com `title`/`aria-label` e `loading="lazy"`.** *(Medium · SEC-15)*
Verificar (R13 — **click-to-load**): o `dist/` **não** contém nenhum `<iframe>` do Maps — o mapa é injetado por `public/js/map.js` **após o clique** e **após o consentimento**. O que se verifica no HTML é o *placeholder*: `grep -o 'data-map-src="[^"]*"' dist/**/*.html` → a URL do Maps está no atributo, e `grep -c '<iframe' dist/**/*.html` → **0**. O iframe injetado leva `title="…"` **e** `loading="lazy"` **e** `referrerpolicy="strict-origin-when-cross-origin"`. O `filter: saturate(60%)` pode ser aplicado por CSS no wrapper (o `filter` no iframe funciona, mas cuidado: `filter` cria um containing block — afeta o layout).
> **R13 — click-to-load:** o iframe só é injetado **após o clique** do usuário **e** após consentimento; antes disso, um placeholder com a mesma caixa (16:9) e um link "Abrir no Google Maps". Detalhes em `docs/SPEC-UI.md` §4.5.

**SEC-48 — Google Fonts não é contatado em runtime.** *(Medium · SEC-12, SEC-15)*
Verificar:
```bash
git grep -n -I -E "fonts\.googleapis\.com|fonts\.gstatic\.com" -- src public
```
→ **0 linhas**; e em `dist/`: `grep -rE "fonts\.googleapis\.com|fonts\.gstatic\.com" dist` → **0**. Teste em runtime: DevTools → Network → filtrar `gstatic|googleapis` → **nenhuma requisição**. Os arquivos de fonte ficam em `public/fonts/` (ou `src/assets/fonts/` com `@font-face` local) e são servidos do próprio domínio.

### Bloco E — Supply chain e CI/CD

**SEC-49 — `npm ci` (não `npm install`), lockfile versionado, `npm audit` limpo.** *(High · SEC-05)*
Verificar:
```bash
git ls-files package-lock.json          # deve listar o arquivo
npm ci                                 # deve falhar se o lockfile divergir de package.json
npm audit --audit-level=high            # deve reportar 0 vulnerabilidades high/critical
npm outdated                            # informativo
```
No CI, o step `npm audit` deve **quebrar o build** em high/critical, com processo documentado de exceção (advisory ID + justificativa + data de revisão) para falsos positivos transitórios. `npm audit` sem `lockfile` não é auditável.

**SEC-50 — Actions fixadas por SHA de commit.** *(High · SEC-07)*
Valores **verificados** contra a API do GitHub (tag → commit):

| Action | Tag | SHA a usar |
|---|---|---|
| `actions/checkout` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | `v7.1.0` | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| `actions/configure-pages` | `v6.0.0` | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| `actions/upload-pages-artifact` | `v5.0.0` | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/deploy-pages` | `v5.0.1` | `368f82528645a54fb793d4d04e342629a3f51346` |

Usar no formato `uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`.
Verificar:
```bash
git grep -n -I -E "uses: [^@]+@(v[0-9]|main|master|latest)" -- .github/   # deve retornar 0 linhas
```
Alternativa aceitável se o time **não** quiser pin por SHA: **aceitação de risco explícita e registrada** (issue ou `docs/security-decisions.md` com data, responsável e a razão), revisada a cada 6 meses. Não é recomendado.

**SEC-51 — Workflow só dispara em `push` na `main` e `workflow_dispatch`; nunca em `pull_request`.** *(Critical · SEC-06)*
Verificar:
```bash
grep -n -A6 "^on:" .github/workflows/*.yml
```
→ deve conter `push:` com `branches: [main]` e `workflow_dispatch:`; **`pull_request` ausente**. Teste funcional (obrigatório): abrir um PR de um fork com um `<script>alert(1)</script>` no `src/layouts/Base.astro` → **o Pages não pode mudar** (verificar em `https://devcarloshensil.github.io/` e no deploy log: nenhum job `deploy` executado).

**SEC-52 — Permissões mínimas por job.** *(High · SEC-05)*
Estrutura exigida (privilégio mínimo; `contents: read` no topo, escalate só no job que precisa):
```yaml
permissions:
  contents: read
jobs:
  build:
    permissions:
      contents: read
      pages: write
      id-token: write
  deploy:
    permissions:
      pages: write
      id-token: write
```
Verificar: `grep -n -A3 "permissions:" .github/workflows/*.yml` → nenhum job com `contents: write`, `pull-requests: write`, `actions: write` ou `permissions: write-all`. Justificativa do desenho: o job `build` (que roda npm) tem `contents: read` — **não** pode fazer push no repositório; só o job `deploy` publica. Assim, uma dependência npm comprometida não consegue reescrever o repositório.

**SEC-53 — Deploy usa o `GITHUB_TOKEN` automático; nenhum PAT.** *(High · SEC-05)*
Verificar: `git grep -n -I -E "secrets\.[A-Z_]*(PAT|TOKEN|KEY)" -- .github/` → **0 linhas**; e `git grep -n "GITHUB_TOKEN\|github.token" -- .github/` → ok. O Pages usa o token automático do workflow; não há necessidade de PAT.

**SEC-54 — `checkout` sem credencial persistida.** *(Medium · SEC-05)*
Verificar: o step de checkout tem `with: persist-credentials: false`. Isso evita que o `GITHUB_TOKEN` fique gravado em `.git/config` e seja reutilizado por um step malicioso.

**SEC-55 — `npm run build` falha se a guarda de segredos falhar; CI executa a guarda explicitamente.** *(High · SEC-05)*
Verificar: o workflow tem um step `run: node scripts/guard-secrets.mjs` (exit ≠ 0 interrompe) **antes** do `astro build`; e o `package.json` tem `"prebuild": "node scripts/guard-secrets.mjs"`.

**SEC-56 — `public/CNAME` presente com o domínio correto.** *(High · SEC-19)*
Verificar:
```bash
cat public/CNAME            # deve imprimir exatamente: galastriadvocacia.com.br
find dist -name CNAME -exec cat {} \;   # idem
```
Conteúdo: **exatamente** `galastriadvocacia.com.br` (sem `https://`, sem barra, com newline final). **Importante (R18):** como o deploy é feito via `actions/upload-pages-artifact`, o `CNAME` precisa estar no **artefato** — ou seja, em `public/`. Definir o domínio apenas na UI do GitHub Pages **não** basta para o fluxo via Actions.

**SEC-57 — DNS do domínio aponta para o GitHub Pages, com verificação feita.** *(High · SEC-18)*
Configuração alvo (Cloudflare, zona `galastriadvocacia.com.br`):
- `galastriadvocacia.com.br` (apex) → **A**: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (GitHub Pages)
- `www.galastriadvocacia.com.br` → **CNAME**: `devcarloshensil.github.io`
- **Proxy (laranja)**: mantido **ligado** para que as **Transform Rules** (SEC-42/43) rodem; configurar o modo TLS **"Full (strict)"** (o GitHub Pages emite certificado válido para o domínio customizado). Se o "Full (strict)" falhar, usar "Full" como contingência.
⚠️ **Contradição resolvida (R16):** para ter headers via Cloudflare, o proxy precisa ficar **ligado**; para GitHub Pages "Enforce HTTPS" + validação de certificado, o ideal seria **desligado**. **Decisão:** proxy **ligado** + TLS "Full (strict)". Se o proxy for desligado, a CSP cai para o fallback `<meta http-equiv>` e perde-se HSTS, `nosniff` e `Permissions-Policy`.
Verificar:
```bash
dig +short galastriadvocacia.com.br A
dig +short www.galastriadvocacia.com.br CNAME
curl -sI https://galastriadvocacia.com.br/ | head -1     # HTTP/2 200
curl -sI https://www.galastriadvocacia.com.br/ | head -1 # 200 ou 301 para o apex
```
Verificar o certificado: `echo | openssl s_client -connect galastriadvocacia.com.br:443 -servername galastriadvocacia.com.br 2>/dev/null | openssl x509 -noout -subject -issuer -dates` → SAN contém `galastriadvocacia.com.br` **e** `www.galastriadvocacia.com.br`; sem erro de validação.
Verificar o "Enforce HTTPS" do GitHub Pages: em Settings → Pages → **Enforce HTTPS = Enabled**.

**SEC-58 — Verificação de posse do domínio registrada no DNS.** *(Medium · SEC-20)*
Adicionar o TXT de verificação do GitHub Pages na zona Cloudflare (`_github-pages-challenge-devCarlosHenSil` com o valor fornecido pela UI do Pages) e confirmar que o `www` **não** é dangling: o CNAME `www` deve resolver para `devcarloshensil.github.io` **e** o repo existir. Se o repo for renomeado/excluído, o `www` vira **dangling CNAME** → alguém pode tomar o subdomínio. Verificar:
```bash
dig +short www.galastriadvocacia.com.br CNAME   # deve ser devcarloshensil.github.io
```

**SEC-59 — `robots.txt` do novo site é real (não o `Disallow: /` do LiteSpeed).** *(Medium · SEC-19)*
O arquivo `litespeed/robots.txt` do backup contém `User-agent: * / Disallow: /` — é um **placeholder do LiteSpeed** e **não** pode ser copiado. O `public/robots.txt` do site novo deve ser:
```
User-agent: *
Allow: /
Disallow: /wp-admin/
Disallow: /wp-login.php

Sitemap: https://galastriadvocacia.com.br/sitemap-index.xml
```
Verificar: `curl -s https://galastriadvocacia.com.br/robots.txt` → **não** contém `Disallow: /` em linha isolada; contém `Allow: /` e o `Sitemap:`.

**SEC-60 — `astro.config` define `site` e não expõe nada além do domínio.** *(Medium · SEC-19)*
Verificar: `site: 'https://galastriadvocacia.com.br'` (necessário para canonical/sitemap) e `trailingSlash` consistente. Nenhum `import.meta.env` exposto além de `PUBLIC_*` (ver SEC-32).

**SEC-61 — Branch protection em `main` + 2FA na conta GitHub.** *(High · SEC-05, SEC-06, SEC-17)*
Verificar: Settings → Branches → **Rule "main"**: *Require a pull request before merging* (≥1 aprovação), *Require status checks to pass* (`build`), *Do not allow bypassing the above settings* (inclui admins) e **"Allow force pushes" = OFF**, "Allow deletions" = OFF.
Verificar 2FA: Settings → Password and authentication → **Two-factor authentication = Enabled**; registrar a data. Recomenda-se **chave de hardware/passkey** + **códigos de recuperação** guardados pelo cliente, não pela agência.

**SEC-62 — Procedimento documentado para repositório renomeado/transferido/excluído.** *(Medium · SEC-20)*
Requisito: um runbook de 1 página em `docs/runbook-pages.md` cobrindo: (a) ao renomear o repo, o `public/CNAME` **continua** no build, mas a URL `devcarloshensil.github.io` muda → re-verificar o domínio customizado em Settings → Pages; (b) ao **transferir** para outra conta, o Pages precisa ser re-autorizado (`Settings → Pages → Source: GitHub Actions` na nova conta) e o `CNAME` reconfirmado; (c) **nunca** excluir o repositório sem antes remover o domínio customizado (senão o domínio pode ficar "pendente" e ser apontado para outro); (d) a recomendação estrutural: **mover o repositório para uma organização do cliente** (com 2FA obrigatório e branch protection), em vez de deixá-lo na conta pessoal de um desenvolvedor — reduz risco de offboarding e perda de acesso.

**SEC-63 — WordPress antigo: decisão formal e, se mantiver, lockdown.** *(Critical · SEC-21)*
Decisão recomendada: **não religar o WordPress**. O site novo cobre 100% do escopo; religar traz `wp-login.php`, `xmlrpc.php`, `wp-admin/`, 44 comentários de spam e um diretório `wp-content/wpvividbackups/` **em diretório web acessível** contendo o `wp-config.php` e o dump — ou seja, um backup completo exposto por HTTP.
Se, ainda assim, for religado (ex.: para redirects 301 de URLs antigas):
1. Instalar o WP **antes** de apontar o DNS (evita window de exposição com o host vazio).
2. Remover fisicamente `/wp-content/wpvividbackups/`, `/wp-content/plugins/wpvivid-*`, `/wp-content/wpvivid_uploads/`, `wp-config-sample.php` e `litespeed/debug/`.
3. `xmlrpc.php`: bloquear por `.htaccess` (`<Files "xmlrpc.php"> Require all denied </Files>`) ou por `X-Robots-Tag`.
4. `wp-login.php`: restringir por IP (allowlist do escritório) ou por **Cloudflare Access**; **nunca** `wp-admin/` público.
5. Desabilitar `WP_DEBUG`/log de debug; remover `litespeed/debug/*.log`.
6. **Apagar** o banco MySQL e o usuário do banco (SEC-31) se o WP não voltar.
Verificar: `curl -sI https://wp.galastriadvocacia.com.br/wp-login.php` → 403/401 (não 200); `curl -s https://.../xmlrpc.php` → semethods list; `curl -sI https://.../wp-content/wpvividbackups/` → 404.

**SEC-64 — Itens do checklist de LGPD presentes e consistentes.** *(High · SEC-12, SEC-13)*
Verificar a existência e o conteúdo (§5):
1. `src/pages/politica-de-privacidade.md` → build gera `dist/politica-de-privacidade/index.html`; contém as seções novas (Formspree, Google/transferência, ausência de comentários, site estático, retenção, direitos do titular).
2. `src/pages/politica-de-cookies-galastri-advocacia.md` → `dist/politica-de-cookies-galastri-advocacia/index.html`, coerente com o banner (categorias, descritores, prazo de retenção, como revogar).
3. Link "Política de Privacidade" **e** "Política de Cookies" no rodapé de **todas** as páginas; link de "Gerenciar preferências de cookies" também no rodapé.
4. Consentimento (ou aviso) **no próprio formulário**, com link para `/politica-de-privacidade/`.
5. Verificação: `grep -rn "politica-de-privacidade" dist/ | wc -l` > 0 em todas as páginas; `curl -sI https://galastriadvocacia.com.br/politica-de-privacidade/` → **200**.

**SEC-65 — O diretório `docs/` está no escopo do `scripts/guard-secrets.mjs`.** *(High · SEC-01, SEC-03, SEC-04, SEC-30)*
As specs são parte do **repositório publicado**: um segredo transcrito em `docs/` é tão público quanto um em `src/`. Requisito: `scripts/guard-secrets.mjs` varre **também** `docs/`.

**Perfil de `docs/` (necessário, e não um detalhe):** as specs **legitimamente nomeiam** opções e chaves (`auth_key`, `client_secret`, `indexnow_api_key`, `wordpress_api_key`, `nonce_key`, `wp_mail_smtp`, …) porque precisam dizer **o que** revogar/descartar. O que é proibido em `docs/` são os **valores** e a **PII de terceiros**. Portanto:

1. `scripts/lib/forbidden.mjs` passa a exportar **dois** perfis:
   - `FORBIDDEN_PATTERNS` — perfil completo (valores + PII + nomes de chave), aplicado a `src/`, `public/`, `scripts/`, `tests/` e à raiz do repo;
   - `FORBIDDEN_DOCS_PATTERNS` — perfil **de valor**: OAuth client secret / access token / refresh token / auth code, `wpvivid-auth`+`-` + Drive tokens, tokens de sessão, hashes de senha, JWT, chaves hex de 32/64 chars, e-mails de terceiros, IPs de visitantes, campanhas de spam. **Sem** os nomes de chave.
2. `scripts/guard-secrets.mjs` adiciona `'docs'` a `SCAN_DIRS` e aplica `FORBIDDEN_DOCS_PATTERNS` aos arquivos de `docs/`.
3. `scripts/lib/forbidden.mjs` continua sendo o **único** arquivo exento (ele contém os padrões que procura).

Verificar (plantar um segredo dentro de `docs/` e o build tem de falhar):
```bash
# bash (Git Bash)
printf 'token = "ya29%sSOMETHING-SECRET"\n' '.' > docs/_probe-secret.md
npm run build # deve FALHAR (guard-secrets bloqueia)
rm docs/_probe-secret.md
npm run build            # deve PASSAR
```
```powershell
# PowerShell
Set-Content docs\_probe-secret.md ('ya29' + '.SOMETHING-SECRET')
npm run build            # deve FALHAR
Remove-Item docs\_probe-secret.md
npm run build            # deve PASSAR
```

**SEC-66 — As specs são documentação, não um cofre de segredos.** *(Critical · SEC-01, SEC-03, SEC-04)*
Nenhuma credencial é transcrita neste repositório — **nem nas specs**. Todo segredo é referenciado por **localização** (`wp-config.php` L25-34 · `wp_options` id 7044 · dump L3210) e por **forma** (prefixo, comprimento, tipo). O placeholder é `<REDACTED:o que é>`.

Verificar (o padrão é montado em runtime para que a **própria** linha do comando não se auto-case):
```bash
# bash (Git Bash)
P='GOCS''PX''-|ya29\.|\$wp\$2y\$|\$P\$Beop|session''_tokens'
git grep -n -I -E "$P" -- docs && echo "FALHA: segredo literal em docs/" || echo "OK"
```
```powershell
# PowerShell
$P = 'GOCS' + 'PX' + '-' + 'ya29\.' + '\$wp\$2y\$' + '\$P\$Beop' + 'session' + '_tokens'
git grep -n -I -E $P -- docs; if ($LASTEXITCODE -eq 1) { 'OK' } else { 'FALHA: segredo literal em docs/' }
```
→ **0 linhas**.

> **Por que o padrão aparece quebrado:** o comando precisa procurar literais que, escritos de forma contígua no próprio arquivo, fariam a spec se detectar. `GOCS''PX''-` concatena para `GOCS`+`PX`+`-` no shell mas **não** casa com o regex; o mesmo vale para `ya29\.`, `\$wp\$2y\$`, `\$P\$Beop` e `session''_tokens`. Nenhum valor é armazenado — a forma só existe em memória, no momento da verificação.
> A lista **canônica** dos padrões é `scripts/lib/forbidden.mjs` (código, fora de `docs/`). Depois que a SEC-65 entrar, `node scripts/guard-secrets.mjs` é a checagem completa de `docs/`.

**SEC-67 — A redação é verificada antes do primeiro push; a rotação de segredos é gate duro.** *(Critical · SEC-01, SEC-04, SEC-21)*
Dois gates, ambos **antes** de qualquer `git push` para o repositório público:

1. **Gate de redação.** A lista de comandos da §4.1 roda na **árvore de trabalho**, com o repo **ainda não publicado**. Saída esperada: todas as listas "DEVE SER ZERO" vazias e o bloco de redação de `docs/` (SEC-66) em **0 linhas**. Quem roda: `developer` ou `qa`, com a saída anexada ao registro da tarefa.
2. **Gate de rotação (SEC-31 · Fase 0 · T0.1).** As **12** rotações da §3 são **tarefa operacional do cliente** e são **gate duro de go-live**: o `deployer` **não publica** enquanto **qualquer** uma das 12 estiver pendente — nem "depois", nem "no próximo push". Publicar antes da rotação equivale a publicar as credenciais.

Ordem obrigatória: **rotação (1) → verificação de redação (2) → push**. A verificação de redação **não substitui** a rotação: os segredos já circularam fora do repositório e precisam ser revogados de todo modo.

Verificar (checklist do `deployer`, antes do primeiro push):
```bash
# 1. §4.1 inteira (todas as listas "DEVE SER ZERO" vazias)
# 2. SEC-66 (redação de docs/)  -> 0 linhas
# 3. SEC-65 (node scripts/guard-secrets.mjs) -> "no secret or personal data found"
# 4. §3 (rotação) -> 12/12 com evidência (print sem o valor + data + responsável)
```
> O item da rotação é declarado como **gate duro** no `docs/PLAN.md` §3 (Definition of Done).

---

### 2.5 Template de referência — `.github/workflows/deploy.yml` (R19)

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    # SEC-R-07: o job que executa `npm` não pode publicar. Só lê o repositório.
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      # SEC-R-11: a excecao do audit e fixada pelo ID do advisory
      - run: npm audit --audit-level=high --json > audit.json || true
      - run: node scripts/check-audit.mjs audit.json
      - run: node scripts/guard-secrets.mjs
      - run: npm run build
        env:
          SITE_BASE: '/'
          PUBLIC_FORMSPREE_ENDPOINT: ${{ vars.PUBLIC_FORMSPREE_ENDPOINT }}
      - uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0
      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: dist
  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      pages: write
      id-token: write
    steps:
      # SEC-R-09: o gate da rotacao bloqueia a PUBLICACAO, nao o build
      - run: node scripts/check-rotation-gate.mjs
      - id: deployment
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
```

Pontos que o template já resolve (não reescrever):
- `pull_request` **ausente** (SEC-51).
- 5 actions fixadas por SHA (SEC-50).
- `persist-credentials: false` (SEC-54).
- `permissions` mínimas por job (SEC-52).
- `node scripts/guard-secrets.mjs` antes do build (SEC-55) + `prebuild` no `package.json` (SEC-30).
- `npm ci` (não `npm install`) + `npm audit --audit-level=high` (SEC-49).
- `concurrency` evita deploys concorrentes.

---

## 3. Pre-go-live: rotação de segredos (SEC-31) — **BLOQUEANTE**

> **R17 — esta seção é operacional, não é código.** É de responsabilidade do **cliente** (dono do domínio e das contas), com evidência registrada. **Não publicar o repositório, não ativar o domínio e não fazer o go-live antes de cada item abaixo estar marcado.**
> Todos os tokens listados existem **vivos** no dump de 22/03/2026 e **o backup já circulou** entre as ferramentas e a equipe. A rotação é obrigatória **mesmo que o repositório nunca vaze**.

| # | Ação | Item exato a revogar/rotacionar | Evidência exigida | ☑ |
|---|---|---|---|---|
| 1 | **Banco de dados** | Trocar a senha do MySQL do banco `<REDACTED:nome do banco MySQL>` (ver `wp-config.php` L25-34) — ou **apagar o banco e o usuário** se o WordPress não volta (SEC-63 item 6). | Print do console (sem o valor) + data + responsável | ☐ |
| 2 | **Salts do WordPress** | Regenerar os **8** salts WP (`AUTH_KEY`, `SECURE_AUTH_KEY`, `LOGGED_IN_KEY`, `NONCE_KEY`, `AUTH_SALT`, `SECURE_AUTH_SALT`, `LOGGED_IN_SALT`, `NONCE_SALT`) **e os duplicados** em `wp_options` (`nonce_key`, `auth_key`, `logged_in_key`, `secure_auth_key`). Invalida C5/C6/C21. | Print + data + responsável | ☐ |
| 3 | **OAuth Google — Gmail** | Revogar o client `<REDACTED:OAuth client_id do wp-mail-smtp>` (forma `…apps.googleusercontent.com`; `wp_options` id 7044). Apagar `gmail.client_secret`, `gmail.refresh_token`, `gmail.access_token`, `auth_code`. Revisar os e-mails enviados no período. | Print da tela do Google Cloud + data | ☐ |
| 4 | **OAuth Google — Drive (wpvivid)** | Revogar o client do wpvivid. Apagar `wpvivid_upload_setting`, `clean_task`, `wpvivid_backup_list` (contêm `auth_id`, `access_token`, `refresh_token` e caminhos absolutos do servidor). | Print + data | ☐ |
| 5 | **OAuth Google — Site Kit** | Revogar `wp_googlesitekit_access_token` / `wp_googlesitekit_refresh_token` e o `wp_googlesitekit_profile` (e-mail `<REDACTED:e-mail do perfil Site Kit>`). | Print + data | ☐ |
| 6 | **OAuth Google — Rank Math** | Revogar `rank_math_google_oauth_tokens` (`access_token` 588c + `refresh_token` 320c) e `rank_math_connect_data` (`api_key` 192c). | Print + data | ☐ |
| 7 | **Elementor Connect** | Trocar `client_id`, `auth_secret`, `access_token_secret` e revogar o `access_token` JWT (`wp_elementor_connect_common_data`). | Print + data | ☐ |
| 8 | **Elementor Safe Mode** | Revogar `elementor_safe_mode_token` (64-hex) e remover `mu-plugins/elementor-safe-mode.php`. | Print + data | ☐ |
| 9 | **Outros tokens do dump** | Invalidar `elementor_connect_site_key` (32-hex), `ea11y_client_secret`, `wordpress_api_key` (12-hex), `trustindex-google-review-download-token` (10-hex), `indexnow_api_key` (32-hex). | Print + data | ☐ |
| 10 | **Contas** | Ativar **2FA** na conta GitHub `devCarlosHenSil` e na conta Formspree do cliente; guardar **códigos de recuperação** com o cliente (SEC-61). | Print da data de ativação | ☐ |
| 11 | **Backup local** | Definir e registrar o prazo de retenção do backup WP-Vivid (recomendação: **90 dias após o go-live**) e a destruição posterior. | Registro no `docs/PROJECT-STATE.md` | ☐ |
| 12 | **WordPress antigo** | Decisão formal: **não religar**. Se religar, aplicar o lockdown de SEC-63 (itens 1–6) **antes** de apontar o DNS. | Registro no `docs/PROJECT-STATE.md` | ☐ |

> **Sem evidência (print sem o valor, data, responsável) para cada item, o go-live não acontece.** Este checklist é o **gate de SEC-31** e aparece como item de **Fase 0** em `docs/PLAN.md`.

---

## 4. Plano de verificação (QA)

Executar na raiz `<LOCAL>/galastriadvocacia`, com o repo **já clonado** e `npm ci && npm run build` executado.

### 4.1 Lista "DEVE SER ZERO" (qualquer item não-zero = **FAIL**)

```bash
# 1. Raiz do repo
git rev-parse --show-toplevel                 # deve ser <LOCAL>  (NÃO a pasta do backup)

# 2. Arquivos do backup WP rastreados
git ls-files | grep -Ei 'wp-config|\.sql$|\.zip$|^wp-content/|^wp-admin/|^wp-includes/|\.htaccess$'   # 0 linhas
# (as pastas sao ancoradas na raiz: o `public/wp-content/` do site novo e um asset legitimo, R1)

# 3. Segredos — os 4 blocos da SEC-26 (valor extraído em runtime do backup read-only)
#    3.1 valores do wp-config.php          -> "OK", 0 linhas
#    3.2 valores das opções sensíveis     -> "OK", 0 linhas
#    3.3 hashes de senha / tokens de sessão -> "OK", 0 linhas
#    3.4 nomes de opção sensíveis no output versionado
git grep -n -I -E "wp_mail_smtp|wpvivid_upload_setting|rank_math_google_oauth_tokens|wp_googlesitekit_|elementor_safe_mode_token|ea11y_client_secret|wordpress_api_key|indexnow_api_key|trustindex-google-review-download-token" -- src public   # 0 linhas

# 3b. PII de terceiros — bloco da SEC-27 (e-mails extraídos do dump em runtime)  -> "OK"
# 3c. Campanhas de spam (strings públicas, não credenciais)
SPAM='hack''link''panel|axie''bet|shbet''game|1''bet|welcome''to''s666|ket''quanet|hack''link'   # 0 linhas
git grep -n -I -E "$SPAM" -- . ':!scripts/lib/forbidden.mjs'
# (a lista canonica dos padroes, scripts/lib/forbidden.mjs, fica de fora: ela tem de descrever o que procura)

# 3d. REDAÇÃO DE docs/ (SEC-66) — o padrão é montado em runtime para não se auto-casar
P='GOCS''PX''-|ya29\.|\$wp\$2y\$|\$P\$Beop|session''_tokens'
git grep -n -I -E "$P" -- docs && echo "FALHA: segredo literal em docs/" || echo "OK"

# 3e. Checagem completa, com a lista canônica de scripts/lib/forbidden.mjs (SEC-65)
node scripts/guard-secrets.mjs      # "no secret or personal data found"

# 4. Histórico
git rev-list --objects --all | grep -Ei "\.sql$|wp-config|\.zip$|dist/"    # 0 linhas

# 5. dist/ limpo
find dist -name "*.map" -o -name ".env*" -o -name "*.sql" -o -name "*.zip" -o -name "wp-config.php"

# 6. Fontes de terceiros em runtime
git grep -n -I -E "fonts\.googleapis\.com|fonts\.gstatic\.com" -- src public
grep -rE "fonts\.googleapis\.com|fonts\.gstatic\.com" dist

# 7. Sem input de runtime (site estático)
git grep -n -I -E "Astro\.request|Astro\.cookies|searchParams" -- src

# 8. Workflow
git grep -n -I -E "pull_request" -- .github/workflows/       # 0 linhas
git grep -n -I -E "uses: [^@]+@(v[0-9]|main|master|latest)" -- .github/   # 0 linhas
git grep -n -I -E "secrets\.[A-Z_]*(PAT|TOKEN|KEY)" -- .github/            # 0 linhas
git grep -n -E "permissions: write-all|contents: write" -- .github/         # 0 linhas

# 9. Dependências
npm audit --audit-level=high       # 0 vulnerabilidades high/critical

# 10. Não deve existir conteúdo de usuário
git grep -n -I -E "<script|onerror=|onload=|javascript:" -- src/content   # 0 linhas
```

### 4.2 Lista "DEVE ESTAR PRESENTE"

```bash
# Repo / build
git ls-files package-lock.json                                   # presente
test -f .gitignore && echo ok
test -f public/CNAME && [ "$(cat public/CNAME)" = "galastriadvocacia.com.br" ] && echo ok
test -f public/robots.txt && echo ok
test -f .github/workflows/deploy.yml && echo ok
test -f scripts/guard-secrets.mjs && echo ok
grep -q '"prebuild"' package.json && echo ok
grep -q 'npm ci' .github/workflows/deploy.yml && echo ok
grep -q 'persist-credentials: false' .github/workflows/deploy.yml && echo ok

# Formulário (no HTML gerado)
grep -o 'name="_gotcha"' dist/**/*.html                # >= 1
grep -o 'formspree.io/f/[A-Za-z0-9]*' dist/**/*.html    # >= 1
grep -c 'autocomplete=' dist/**/*.html                  # >= 3
grep -c 'required' dist/**/*.html                       # >= 3
grep -o '<iframe[^>]*maps[^>]*>' dist/**/*.html          # contém title= e loading="lazy"

# Conteúdo público permitido (presentes, e apenas eles)
grep -rq 'GTM-KDNG3QWB' dist/ && echo ok
grep -rq 'ca-pub-5989678973778468' dist/ && echo ok

# Headers / CSP / DNS (em produção)
curl -sI https://galastriadvocacia.com.br/ | grep -i content-security-policy   # presente, com form-action formspree
curl -sI https://galastriadvocacia.com.br/ | grep -i referrer-policy          # strict-origin-when-cross-origin
curl -sI https://galastriadvocacia.com.br/ | grep -Ei "strict-transport|x-content-type|x-frame|permissions-policy"  # 4-5 linhas
curl -s https://galastriadvocacia.com.br/robots.txt                            # Allow: / + Sitemap:
curl -sI https://galastriadvocacia.com.br/politica-de-privacidade/             # 200
curl -sI https://galastriadvocacia.com.br/politica-de-cookies-galastri-advocacia/  # 200
dig +short galastriadvocacia.com.br A
dig +short www.galastriadvocacia.com.br CNAME                                  # devcarloshensil.github.io
```

### 4.3 Testes manuais / funcionais (obrigatórios)

| # | Teste | Resultado esperado |
|---|---|---|
| T1 | Janela anônima, carregar a home, **não clicar** em nada | **Zero** requisições a `googletagmanager.com`, `googlesyndication.com`, `doubleclick.net`; banner visível em português |
| T2 | Clicar em "Rejeitar" | Banner fecha; `document.cookie` **sem** `IDE`/`test_cookie`/`_gcl_au`/`_ga`; nenhum request ao AdSense |
| T3 | "Gerenciar preferências de cookies" no rodapé | Abre painel de 2º nível; revogar é possível com a mesma facilidade de conceder |
| T4 | Enviar o formulário de contato (domínio de produção) | E-mail chega em `contato@galastriadvocacia.com.br`; **não** é marcado como spam; DevTools mostra `Referer: https://galastriadvocacia.com.br/` no request ao Formspree |
| T5 | `curl` de fora com `Referer` de domínio alheio | Submissão **não** chega ao e-mail (vai para spam da Formspree) → confirma "Restrict to Domain" |
| T6 | Preencher o campo `_gotcha` via DevTools e enviar | Submissão **não** chega |
| T7 | Console do DevTools em todas as páginas | **Zero** violações de CSP |
| T8 | Abrir o site e o console em paralelo | Nenhum request a `fonts.gstatic.com`/`fonts.googleapis.com` |
| T9 | **Abrir um PR de um fork** com `<script>alert(1)</script>` | Nenhum workflow de deploy executa; `https://devcarloshensil.github.io/` inalterado; `galastriadvocacia.com.br` inalterado |
| T10 | Abortar o deploy no meio e reexecutar | `concurrency: {group: pages, cancel-in-progress: true}` evita deploys concorrentes |
| T11 | `https://galastriadvocacia.com.br/wp-login.php`, `/xmlrpc.php`, `/wp-admin/` | **404** (site estático) — confirmar que o WP antigo não está acessível |
| T12 | Escanear o site com `zizmor` / `actionlint` / `checkov` (opcional) | Sem findings de supply chain no workflow |
| T13 | **Contador do Formspree** (painel → Usage) | Abaixo de 50/mês; plano pago definido antes de chegar lá |

---

## 5. Checklist LGPD para um escritório de advocacia (texto pronto para colar)

> **Enquadramento:** a Lei nº 13.709/2018 (LGPD), o **Guia Orientativo: Cookies e Proteção de Dados Pessoais** da ANPD (out/2022, ainda a referência na Agenda Regulatória 2025-2026) e o **art. 33** (transferência internacional), com a **Resolução CD/ANPD nº 19/2024**. Isto é **orientação de engenharia, não parecer jurídico** — a política final precisa de revisão do advogado responsável (inclusive por causa do sigilo profissional e do dever de confidencialidade, art. 7º, II e XI).
>
> ⚠️ **Correção aplicada:** o texto de origem do agente de segurança trazia **erros de digitação deliberados** ("a suaXM seclusion", "informações_relative", "clientepotencial", "coleta dos", "空间 de publicação", "提到", "canal de exercise de direitos"). **Todos foram corrigidos** abaixo. O texto está pronto para colar.

### 5.1 O que o banner de cookies precisa cobrir

| Item | Exigência | Como no site novo |
|---|---|---|
| Carga de GTM/AdSense **antes** do consentimento | **Proibida** para cookies não necessários | Consent Mode com `denied` por padrão; `adsbygoogle.js` só após consentimento |
| Cookies não necessários | **Desligados por padrão** | Configuração inicial `denied` |
| Banner de 1º nível | Botões "Aceitar" e "Rejeitar" com **mesmo peso visual**; nada de "continuar" ambíguo | UI própria, em português |
| Banner de 2º nível | Obrigatório: categorias granulares | Modal de preferências (necessários / analíticos / publicidade) |
| Revogação | Tão fácil quanto conceder | Link permanente no rodapé + botão no banner |
| Prova do consentimento | Registrar (quem/quando/quais categorias) | `localStorage` + registro de timestamp/versão |
| Idioma | Português (BR) | Todo o banner e a política |
| Transparência | Link para Política de Cookies e Privacidade no banner | `/politica-de-cookies-galastri-advocacia/` e `/politica-de-privacidade/` |
| Mapeamento de cookies | Nome, finalidade, categoria, prazo | Tabela na Política de Cookies |

**Categorias esperadas no site novo:** *Necessários* (cookie de consentimento, first-party) · *Analíticos* (Google Analytics via GTM, apenas se ativado) · *Publicidade* (Google AdSense, `IDE`/`test_cookie`/`_gcl_au`, `googleads.g.doubleclick.net`) · *Mapa* (Google Maps iframe — não é cookie do site, mas é terceiro).

### 5.2 Bloco para **acrescentar** à Política de Privacidade (post 3, "Data de Vigência: 20/12/2024")

```markdown
---

## 6. Natureza estática do site e cookies próprios

Este site é um website estático: não possui banco de dados, painel administrativo, cadastro de usuários nem sistema de comentários. A única gravação em cookie próprio é o cookie de registro do seu consentimento em cookies, utilizado exclusivamente para lembrar a sua escolha e permitir que você a revogue a qualquer momento. Nenhum cookie próprio deste website é utilizado para identificar, rastrear ou perfilar você além dessa finalidade.

## 7. Cookies de terceiros: Google Tag Manager e Google AdSense

Este site utiliza o **Google Tag Manager** (ID do container: GTM-KDNG3QWB) e o **Google AdSense** (ID do anunciante: ca-pub-5989678973778468), operados pelo **Google LLC**, empresa com sede nos Estados Unidos.

O carregamento desses recursos e a gravação de cookies de publicidade comportamental (incluindo os cookies `IDE`, `test_cookie` e `_gcl_au`, do domínio `doubleclick.net`) **somente ocorrem após o seu consentimento** para a categoria "Publicidade", obtido na janela de consentimento exibida na primeira visita. Você pode aceitar, recusar ou gerenciar suas preferências a qualquer momento pelo link **"Gerenciar preferências de cookies"**, disponível no rodapé de todas as páginas, bem como pela ferramenta do Google em [adssettings.google.com](https://adssettings.google.com) e [myaccount.google.com/ads-data](https://myaccount.google.com/ads-data).

O Google, como controlador independente, trata os dados pessoais coletados conforme as suas próprias políticas de privacidade e os termos de publicidade do Google Ads.

## 8. Mapa do Google Maps

O mapa do escritório é exibido por meio de um quadro (iframe) do **Google Maps** (Google LLC, Estados Unidos). O carregamento desse quadro pode permitir que o Google receba dados técnicos do seu navegador, tais como endereço IP, agente do usuário e cookies próprios do Google. O mapa não é carregado de forma automática antes da sua interação, e a sua inclusão depende da sua escolha.

## 9. Envio do formulário de contato

Os dados enviados pelo formulário de contato (**nome, e-mail, telefone e mensagem**) são transmitidos, de forma criptografada (HTTPS), à **Formspree Inc.**, empresa sediada nos Estados Unidos, que atua como **operadora** (subencarregada) do tratamento, e são encaminhados ao endereço de e-mail institucional do escritório.

A Formspree conserva as submissões por prazo limitado (30 dias no plano gratuito), findo o qual são eliminadas ou anonimizadas. O envio fica condicionado à habilitação do recurso "Restrict to Domain", que impede o aceite de submissões originadas fora deste domínio.

**Não solicitamos dados pessoais sensíveis.** Orientamos a não enviar, por este formulário, informações relativas a saúde, orientação sexual, biometria, dados de crianças e adolescentes, dados fiscais detalhados, número de processo judicial ou qualquer outra informação relativa a cliente potencial, devendo todo e qualquer tratamento de dados dessa natureza ocorrer por canal privado e seguro, com o cliente.

## 10. Ausência de comentários e de conteúdo enviado por usuários

Este site **não possui sistema de comentários, fóruns, cadastro de usuários ou espaço de publicação aberta**. O sistema de comentários da antiga plataforma foi desativado e **nenhum comentário, endereço de e-mail ou conteúdo enviado por visitantes é coletado, exibido ou armazenado**. Todo o conteúdo publicado é redigido e publicado pela Galastri Advocacia.

## 11. Transferência internacional de dados

Parte do tratamento de dados pessoais deste site é realizado por operadores com sede fora do Brasil — notadamente **Google LLC** (Tag Manager, AdSense e Maps) e **Formspree Inc.** (formulário de contato) — nos Estados Unidos e, eventualmente, em outros países.

Essa transferência internacional é realizada em observância ao **art. 33 da LGPD** e à **Resolução CD/ANPD nº 19/2024**, mediante os mecanismos de transferência internacional previstos na regulamentação aplicável, e com as garantias contratuais e de proteção de dados cabíveis.

## 12. Prazo de retenção

- **Formulários de contato:** os dados são mantidos pelo prazo necessário ao atendimento da solicitação e ao cumprimento de obrigações legais ou regulatórias, sendo, então, eliminados ou anonimizados.
- **Registros de consentimento de cookies:** mantidos enquanto o consentimento estiver vigente e pelo prazo necessário à demonstração de conformidade, nos termos do art. 6º, X, da LGPD.
- **Logs de acesso e segurança (quando existentes):** mantidos por prazo tecnicamente justificado, normalmente de 30 a 90 dias.

## 13. Atualização desta Política

Esta Política pode ser atualizada para refletir mudanças no site ou na legislação aplicável. A data de vigência da versão vigente é indicada no início deste documento. Alterações relevantes serão comunicadas por meio do próprio site.
```

### 5.3 Bloco para a **Política de Cookies** (post 83, "Data de Vigência: 20/12/2024") — _acrescentar_:

```markdown
---

## 7. Terceiros utilizados neste site

| Terceiro | Finalidade | Categoria | Endereço |
|---|---|---|---|
| Google Tag Manager (GTM-KDNG3QWB) | Carregamento de tags, analytics e publicidade | Publicidade / Analítica (conforme consentimento) | https://www.googletagmanager.com |
| Google AdSense (ca-pub-5989678973778468) | Exibição de publicidade | Publicidade | https://googleads.g.doubleclick.net |
| Google Maps | Exibição do mapa do escritório | Funcionalidade | https://www.google.com/maps |
| Formspree | Envio do formulário de contato | Necessário ao envio | https://formspree.io |

O Google Tag Manager e o Google AdSense **não são carregados** antes da sua escolha na janela de consentimento. O mapa e o formulário têm os seus carregamentos descritos nas seções correspondentes da Política de Privacidade.

## 8. Como revogar o consentimento

A qualquer momento, pelo link **"Gerenciar preferências de cookies"** no rodapé de todas as páginas. Você pode também limpar os cookies do seu navegador. O consentimento é tão fácil de revogar quanto de conceder.

## 9. Registro do consentimento

Registramos a data e a hora da sua escolha, as categorias aceitas e a versão vigente desta Política, para demonstrar conformidade com os princípios de responsabilização e prestação de contas (art. 6º, X, da LGPD).
```

### 5.4 O que **REMOVER/EDITAR** do texto original (a página atual afirma coisas que deixarão de ser verdade)

1. "…**ou assinatura de newsletter**" → **remover** (não há newsletter no site estático).
2. "Dados de navegação, como endereço IP, tipo de navegador, páginas acessadas, tempo de permanência no site e cookies" → **reescrever**: o site **não** coleta IP/tempo de permanência por conta própria; quem coleta é o Google (GTM/AdSense/Maps) e a Formspree, e o endereço IP do titular do formulário é tratado pela Formspree. Dizer isso claramente.
3. Se a política original **mencionar** "**comentários**" ou "**formulários de contato processados pelo WordPress**" → substituir pelo texto do item 9 e 10 acima.
4. Menções a **plugins** (Elementor, Rank Math, WPForms, LiteSpeed) como "terceiros" → **remover** (não existem mais).
5. Se mencionar "**LGPD e Lei nº 13.709/2018**" genérico → **acrescentar** os pontos 11 (transferência internacional) e 12 (retenção).
6. Adicionar **e-mail do encarregado (DPO/contato)** e o canal de **exercício de direitos** (art. 18) — já que a página original provavelmente não tem. **Obrigatório para um escritório.** Incluir: prazo de resposta (15 dias, art. 19, §3º) e a possibilidade de petição à ANPD.
7. Adicionar a **data de vigência atualizada** e a seção "Atualização desta Política".

### 5.5 Itens de engenharia que apoiam o LGPD

- **Minimização:** manter exatamente **4 campos** (nome, e-mail, telefone, mensagem). **Não** adicionar CPF, RG, número de processo, data de nascimento, estado civil, valor da causa, dados de saúde, nem "upload de documento". A mensagem é livre → por isso o aviso "não envie dados sensíveis" (item 9).
- **Finalidade:** a mensagem de consentimento do form diz exatamente a finalidade ("para retorno do escritório sobre a sua solicitação").
- **Retenção:** definir e documentar o prazo de retenção dos e-mails de contato (recomendação: **6 meses após a última interação**) e quem faz a eliminação — normalmente o e-mail institucional, com filtro/regra de arquivamento. **Não há onde "excluir" no site estático** → o responsável é o processo interno do escritório.
- **Incidentes:** o processo de notificação à ANPD (art. 48) é do escritório; o papel do site é não agravar (minimização + sem segredos no repo).

---

## 6. Perguntas abertas (com default recomendado)

**Q1 — A conta Formspree é do cliente (Galastri) ou da agência (Xentry Labs)?**
*Default recomendado:* **do cliente**, com o e-mail institucional `contato@galastriadvocacia.com.br` como titular, e **2FA ativo**. Se for da agência: a agência se torna **controladora** de um canal que recebe dados sensíveis de potenciais clientes — risco de confidencialidade profissional (art. 7º, XI) e de perda de acesso se a relação comercial terminar. Alternativa: conta do cliente + convênio/convite da agência como *member*.

**Q2 — Banner de cookies é obrigatório?**
*Default:* **Sim, implementar** (R13). Com GTM + AdSense, há cookies de publicidade comportamental sem base legal se carregados sem consentimento, e o Guia da ANPD é explícito. Consequências práticas: sem banner, risco de sanção e de bloqueio de Adsense. A alternativa "não usar banner" só é defensável com base legal de legítimo interesse para analytics estritamente anonimizado — **não se aplica ao AdSense**. Nota: a ANPD não tem "lei de cookies" própria; a base é a LGPD.

**Q3 — O repositório deve ser público?**
> **R15 — RESOLVIDO pelo EM: o repositório é PÚBLICO (decisão do owner).** A recomendação original do agente de segurança (começar privado) fica registrada em `docs/PROJECT-STATE.md` como decisão **rejeitada**, com o motivo: o conteúdo do site já é público e o cliente quer open-source/portfólio. **Consequência:** SEC-23…SEC-30 e SEC-49…SEC-55 são gates de go-live, e `scripts/guard-secrets.mjs` roda no `prebuild` **e** no CI. A recomendação estrutural que **permanece**: **mover para uma organização do cliente** (com 2FA obrigatório e branch protection), em vez de deixar o repo na conta pessoal `devCarlosHenSil`.

**Q4 — Quem detém o registrador e o DNS?**
*Default:* **O cliente** (Galastri), com a agência como *collaborator* na zona Cloudflare; login 2FA via hardware; a agência **não** deve ser a única a poder recuperar o domínio. Confirmar: titularidade do domínio `.com.br` no registro.br (o titular deve ser o cliente ou a agência formalmente autorizada), titularidade da conta Cloudflare, titularidade do repositório GitHub, e titularidade da conta Formspree. **Nenhuma dessas 4 titularidades deve ser exclusivamente de um devs da agência.**

**Q5 — Cloudflare proxy (laranja) ligado ou desligado?**
*Default (R16):* **Ligado**, com `Full (strict)`, porque as Transform Rules do Cloudflare são o **único** caminho viável para injetar CSP e headers de segurança (GitHub Pages não suporta `_headers`). O certificado do GitHub Pages para o domínio customizado é válido, então `Full (strict)` funciona. Se falhar, `Full` como contingência, com a CSP movida para `<meta>` como segunda camada. Se o cliente preferir simplicidade: desligar o proxy, aceitar a **ausência** de headers de segurança e aplicar apenas `<meta http-equiv="Content-Security-Policy">` + `<meta http-equiv="Referrer-Policy">` — perda real de proteção (sem HSTS, sem nosniff, sem Permissions-Policy).

**Q6 — Qual o plano/limite do Formspree e quem monitora a cota?**
*Default:* **Plano Personal (≈US$ 10/mês)** com noção de custo e sem a marca Formspree nos e-mails, mais um responsável nomeado (o cliente) para o alerta mensal de uso. Com 50/mês no plano gratuito, um mês de pico de SEO de um escritório de advocacia pode estourar — e o efeito é o formulário **parar de funcionar sem erro visível** (risco de perda de leads, o ativo mais caro do site). Até o plano pago estar ativo, o **CTA permanente de WhatsApp** (R14) é o mitigador.

---

## Top 5 riscos (ordem por risco real)

1. **CRÍTICO — Publicar o backup do WordPress no repositório (SEC-01/23/24/25/28).** A pasta nova do Astro é *dentro* da pasta do backup; um `git init` no lugar errado expõe publicamente a senha do MySQL, os 8 salts WP e os hashes de senha — o que permite forjar um cookie de **administrator** e retomar o site. *Mitigação: raiz do repo = pasta do Astro, `.gitignore` com o conjunto exato, `git ls-files` limpo, histórico limpo, guarda de segredos no build.* **Rota de rotação (SEC-31) é obrigatória mesmo que o repositório nunca seja vazado** — porque o dump já circulou entre as mãos da equipe e ficou 6 meses na pasta de trabalho.
2. **CRÍTICO — Segredos Google vivos reutilizados (SEC-04/31).** `gmail.client_secret` + `refresh_token` (envio de e-mail **como o escritório**), `wpvivid` Drive `refresh_token` (**o backup no Drive contém o `wp-config.php`**), Site Kit e Rank Math OAuth. Um vazamento aqui = phishing com a marca do escritório + leitura do dump. *Mitigação: revogar/rotacionar tudo antes do go-live, mesmo que o repo nunca vaze.*
3. **ALTO — Endpoint Formspree como relay de spam (SEC-08/09/10/11).** O ID do form é público **por design**; sem CAPTCHA + honeypot + "Restrict to Domain" + `Referrer-Policy` correto + cota, o escritório vira alvo de spam (o WP antigo já sofreu 44 spams) e a reputação de e-mail do domínio é afetada — o que quebra o formulário **real**. *Mitigação: SEC-35..SEC-41, monitorar a cota, CTA de WhatsApp permanente.*
4. **ALTO — LGPD não coberta pela política atual (SEC-12/13).** A política migrada é de 20/12/2024 e **não menciona** Formspree, Google como destinatário, transferência internacional (art. 33), a remoção do sistema de comentários, nem a natureza estática do site. Somado ao GTM/AdSense sem consentimento prévio, o passivo de conformidade é o risco **legal**, não o técnico. *Mitigação: SEC-64 + bloco de texto pronto (§5.2, §5.3) + banner conforme ANPD.*
5. **ALTO — CI/CD e DNS (SEC-06/07/18/20).** `pull_request` no trigger = qualquer fork publica no domínio do cliente; actions por tag = takeover do build; apex DNS na Cloudflare e CNAME ausente do `public/` = site fora do ar. *Mitigação: SEC-50..SEC-58, com teste funcional obrigatório T9 (PR de fork) e T11 (rotas WP).*

---

**O que não verifiquei / não cobri** (limitação explícita, não omissão):
- Não localizei o `src` exato do iframe do Maps no dump (o widget do Elementor não expôs a URL nos greps executados) — **a CSP de `frame-src` precisa ser confirmada contra o `dist/` gerado** (SEC-42).
- Não auditei o conteúdo dos 7 ZIPs de backup (34,7 MB + zips) além do dump SQL e do `wp-config.php`; podem conter material adicional (`.env`, chaves do ProElements, logs).
- Não inspecionei o `wp-content/uploads` recursivamente (imagem/vídeo); há ~GB de mídias que devem ser migradas **seletivamente**, não em bloco.
- Não validei em runtime a CSP, os headers, o consent mode do GTM nem o comportamento do AdSense — isso exige o site publicado e um navegador real.
- Não avaliamos risco de **assinatura digital** de e-mail do escritório (SPF/DKIM/DMARC): o dump mostra que o envio saía via `<REDACTED:e-mail de envio do wp-mail-smtp>` (Gmail), **não** via `contato@galastriadvocacia.com.br` — se o formulário passar a enviar para o domínio próprio, é preciso configurar SPF/DKIM/DMARC no provedor de e-mail. **Recomendação:** considerar um serviço de envio transacional (ex.: Resend/Postmark/SES) em vez do Gmail, para evitar queda de entrega e reputação — decisão de produto, não requisito de segurança.
- A classificação do texto da LGPD (§5) precisa de revisão do advogado responsável antes de publicar.

*Esta spec é advisory: os `SEC-23..SEC-67` são especificações para o `developer` e o `qa` executarem.*
