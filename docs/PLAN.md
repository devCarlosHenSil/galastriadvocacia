# PLAN — Implementação da migração WordPress → Astro (Galastri Advocacia)


> **Fonte:** agente `planner` (plano original, seções 1–11) **consolidado** com as specs `dba`, `security` e `uiux` e com os **rulings do EM**.
> **Consolidado em:** 2026-10-19 · **Público-alvo:** `https://galastriadvocacia.com.br` · **Repo:** `devCarlosHenSil/galastriadvocacia` (público).
> **Raiz do repo git:** `<LOCAL>/galastriadvocacia` — **nunca** `git init` na pasta do backup (SEC-23). `<LOCAL>` é a pasta local de trabalho, **fora** do repositório.

**Escala de esforço:** **S** ≤ 0,5 dia · **M** 1–2 dias · **L** 3–5 dias.
**Total estimado:** **≈ 24–30 dias** de desenvolvimento.

**Specs de referência (fonte de verdade por tema):**

| Tema | Spec |
|---|---|
| Modelo de dados, rotas, extração | `docs/SPEC-DATA.md` |
| Segurança, LGPD, CI/CD, headers | `docs/SPEC-SECURITY.md` |
| DOM, componentes, estados, a11y | `docs/SPEC-UI.md` |
| Estado do projeto e decisões | `docs/PROJECT-STATE.md` |

**Rulings do EM aplicados a este plano:**

| # | Ruling | Efeito no plano |
|---|---|---|
| **R1** | CSS do Elementor copiado **verbatim** | T2.3 (consolidação de CSS) é **bloqueante**; nenhum CSS é reescrito. |
| **R2** | `_elementor_element_cache` existe | T1.5 (fixtures de paridade) + T6.2 (teste de paridade) usam o cache como oráculo. |
| **R4** | Rotas: posts na raiz, categorias em `/category/<slug>/`, sem páginas de tag | T3.11, T3.13, T4.3; `redirects.json` com 1 entrada. |
| **R5** | Formulário com 4 campos | T1.7, T3.10, T6.5. |
| **R6** | E-mail público = `contato@galastriadvocacia.com.br` | T1.7, T3.10, T0.4 (guard). |
| **R7** | Paleta do kit canônica | T2.3 (`tokens.css` só acrescenta tokens derivados). |
| **R12** | Fontes 100% self-hosted | T2.4 (download de Roboto + Montserrat). |
| **R13** | Banner de cookies obrigatório | T4.3 + T6.4. |
| **R14** | Formspree: `_gotcha`, `Accept: application/json`, `Referrer-Policy: strict-origin-when-cross-origin`, "Restrict to Domain", reCAPTCHA, **CTA de WhatsApp permanente** | T3.10, T4.2, T6.5. |
| **R15** | Repo **público** | T0.3 (guard de segredos) e T5.1 (CI) viram **bloqueantes**. |
| **R16** | Sem `_headers` no Pages → Cloudflare Transform Rules + fallback `<meta>` | T4.2 (layout) + T5.2 (Cloudflare). |
| **R17** | Rotação de segredos = tarefa operacional bloqueante do cliente | **Fase 0, T0.1**. |
| **R18** | `public/CNAME` no artefato | T5.1, T5.2. |
| **R19** | Actions fixadas por SHA, sem `pull_request`, permissões mínimas, `persist-credentials: false` | T5.1. |
| **R20** | `site.json.seo.perUrl` é a fonte única de SEO; demais são rascunhos | T4.1, T4.4. |

---

## 1. Objetivo e escopo

**Objetivo:** site estático em Astro, `output: 'static'`, servido por GitHub Pages em `https://galastriadvocacia.com.br`, com **paridade visual** (mesmo HTML/CSS do Elementor), **mesmas URLs** e **formulário funcional** entregando em `contato@galastriadvocacia.com.br`.

**O que será construído:** 17 rotas HTML (home, alias `/home/`, `/blog/`, `/links/`, 3 políticas, 6 posts, 3 categorias) + `404.html` + sitemap + robots.txt · header (template 49) e footer (template 48) exatamente como renderizados · formulário de contato estático com Formspree · banner de cookies com Consent Mode · 404, `robots.txt`, sitemap, JSON-LD, OG/Twitter tags · CI/CD no GitHub Pages.

**O que NÃO será construído (deliberadamente):**
- ❌ Painel administrativo / CMS / área do WordPress. *(Edição de conteúdo via Markdown + JSON no repositório.)*
- ❌ Busca, filtro, paginação de blog, RSS de comentários, tags cloud, sidebar, comentários novos, login, multi-idioma, dark mode, i18n, PWA, service worker, CMS headless, analytics de página.
- ❌ Migração de usuário WP, histórico de revisões, `wp_options` completo, `wp_termmeta`, plugins, temas.
- ❌ Re-autorar o design em componentes Astro. **O CSS gerado pelo Elementor é reutilizado verbatim** (R1).
- ❌ Otimização/recodificação de imagens (WebP/AVIF), `astro:assets`, service worker, PWA.
- ❌ Páginas de tag (57 tags → frontmatter apenas) (R4).
- ❌ Migração dos comentários (44 spam + 4 pingbacks, 0 humanos).
- ❌ Migração dos popups "Recesso" (695/1004) e do post 907 (R9, R10).
- ❌ Preloader (R11).

**Restrições:** sem servidor (`output: 'static'`, sem adapter) · sem dependência de Node em runtime · sem DB.

---

## 2. Layout do repositório alvo

> Este ficheiro foi movido para `docs/PLAN.md` em **2026-10-19** (a versão inicial vivia em
> `docs/plan/README.md`, porque a sessão de escrita só liberava caminhos
> terminados em `README.md`).

> **A árvore real** (medida em 2026-10-19, depois da implementação). O que
> está no plano mas **não** foi construído está marcado no fim.

```
galastriadvocacia/                          # ← raiz do GIT (nunca a pasta do backup)
├── .github/
│   └── workflows/
│       └── deploy.yml                      # SHA-pinned, sem pull_request
├── .gitignore                              # bloco SEC-24
├── .env.example                            # só PUBLIC_FORMSPREE_ENDPOINT (placeholder)
├── AGENTS.md                               # o acordo de trabalho (os 4 invariantes)
├── README.md
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── docs/
│   ├── README.md                           # o índice da documentação
│   ├── CONTENT-EDITING.md                  # como editar sem ser programador
│   ├── DEPLOY.md                           # DNS, Cloudflare, rollback
│   ├── MIGRATION.md                        # o registo histórico
│   ├── PARITY.md                           # o registo da paridade visual
│   ├── PLAN.md
│   ├── PROJECT-STATE.md
│   ├── rotation-gate.md                    # as 12 rotações
│   ├── runbook-pages.md                    # SEC-62
│   ├── security-decisions.md
│   ├── SPEC-DATA.md
│   ├── SPEC-SECURITY.md
│   ├── SPEC-UI.md
│   └── _reference/                         # as contagens medidas (gerado)
├── scripts/
│   ├── extract/
│   │   ├── index.mjs                       # o CLI principal
│   │   ├── check.mjs                       # a idempotência (SHA-256)
│   │   └── lib/
│   │       ├── allowlist.mjs               # a allow-list de escrita
│   │       ├── assets.mjs
│   │       ├── authored.mjs                # o texto autoral (as políticas, o form)
│   │       ├── css.mjs                     # a sobreposição (tokens + a11y)
│   │       ├── elementor.mjs
│   │       ├── fonts.mjs
│   │       ├── gutenberg.mjs
│   │       ├── overlay.mjs                 # o overlay LGPD das políticas
│   │       ├── php.mjs                     # o unserializador do PHP
│   │       ├── repairs.mjs                 # as correções de conteúdo
│   │       ├── sanitize.mjs                # o sanitizador de tempo de build
│   │       ├── site.mjs
│   │       ├── sql.mjs
│   │       ├── urls.mjs
│   │       └── wordpress.mjs
│   ├── lib/
│   │   ├── backup-values.mjs               # os valores sensíveis do backup
│   │   └── forbidden.mjs                   # as formas + os dois níveis de digest
│   ├── css.mjs                             # o CSS consolidado
│   ├── check-audit.mjs · check-contrast.mjs · check-dist.mjs
│   ├── check-links.mjs · check-parity.mjs
│   ├── check-rotation-gate.mjs
│   ├── generate-pii-digests.mjs            # o ficheiro local de digests de PII
│   ├── guard-secrets.mjs                   # SEC-30
│   ├── guard-self-test.mjs                 # o auto-teste da guarda
│   ├── update-parity-fixtures.mjs
│   ├── verify-csp.mjs · verify-workflow.mjs
│   └── visual-diff.mjs                     # Playwright (opcional)
├── src/
│   ├── components/
│   │   ├── CookieConsent.astro
│   │   ├── Footer.astro
│   │   ├── Header.astro
│   │   └── elementor/
│   │       ├── ElementorRenderer.astro
│   │       ├── ElementorWidget.astro
│   │       └── widgets/                    # 25 widgets (SPEC-UI §1.2)
│   ├── content.config.ts                   # o schema Zod da collection
│   ├── content/blog/                       # os 6 posts
│   ├── data/
│   │   ├── elementor/                      # as 7 árvores normalizadas
│   │   ├── assets-manifest.json
│   │   ├── fontawesome-icons.json
│   │   ├── redirects.json                  # {"/home/": "/"}  (R4)
│   │   └── site.json                       # nav, taxonomias, theme, form, seo, routes
│   ├── layouts/
│   │   ├── BaseLayout.astro                # o <head>, o meta, o OG, o JSON-LD, a CSP
│   │   ├── PageLayout.astro
│   │   ├── PolicyLayout.astro
│   │   └── PostLayout.astro
│   ├── lib/
│   │   ├── assets.ts · csp.ts · elementor.ts · fontawesome.ts
│   │   ├── image.ts · nav.ts · post-context.ts
│   │   ├── seo.ts · site.ts · stylesheets.ts · svg.ts
│   └── pages/
│       ├── 404.astro                       # → /404.html
│       ├── [slug].astro                    # → /<slug>/  (R4)
│       ├── blog.astro                      # /blog/
│       ├── category/[slug].astro           # → /category/<slug>/  (R4)
│       ├── home.astro                      # /home/ (o alias)
│       ├── index.astro                     # /
│       ├── links.astro                     # /links/
│       └── politica-de-*.md                 # as 3 políticas (R8)
├── tests/
│   └── fixtures/
│       ├── elementor-cache-{30,48,49}.html # o oráculo de paridade (R2)
│       ├── nav-menu.html                    # o menu (o toggle + o painel)
│       └── upk-grid.html                   # a grelha do blog
└── public/
    ├── CNAME                               # "galastriadvocacia.com.br" (R18)
    ├── robots.txt
    ├── css/                                # as 17 folhas consolidadas
    ├── fonts/                              # Roboto/Montserrat, Nunito/Questrial/Qwigley
    ├── js/                                 # os scripts do site
    ├── webfonts/                           # os webfonts do Font Awesome 5
    └── wp-content/
        ├── uploads/2024/12/…               # o fecho do manifesto
        ├── uploads/elementor/css/…         # os 36 ficheiros — R1 (verbatim)
        └── uploads/elementor/google-fonts/ # as faces locais — R12
```

> **O que o plano previa e não existe** (e porque): um painel/editor (CMS), a
> pesquisa, as páginas de tag, os comentários, a newsletter, a optimização de
> imagens (WebP/AVIF), o `elementor-frontend.min.js` (o comportamento das
> animações e das classes responsivas foi reproduzido em
> `public/js/elementor-animations.js` e em `a11y.css`), o `favicon.*` (o ícone
> é o logo, em `public/wp-content/uploads/`), os testes de Playwright
> (`form-e2e.spec.ts`, `tests/parity/visual.spec.ts`) e o snapshot do Wayback
> (`tests/fixtures/reference-home.html`) — o oráculo de paridade é o
> `_elementor_element_cache` do dump.

---

## Fase 0 — Fundação, decisões e pré-requisitos bloqueantes

| # | Tarefa | Objetivo / arquivos | Depende | Aceitação | Esforço |
|---|---|---|---|---|---|
| **T0.1** | **Rotação de segredos (SEC-31) — BLOQUEANTE, cliente** | Executar o checklist completo de `docs/SPEC-SECURITY.md` §3 (12 itens: senha do MySQL, 8 salts WP, OAuth Google ×4, Elementor Connect, Safe Mode, tokens avulsos, 2FA, retenção do backup, decisão sobre o WP antigo). **Nenhum arquivo de código.** | — | Os 12 itens marcados com evidência (print sem o valor, data, responsável). Registrado em `docs/PROJECT-STATE.md`. | S (operação) |
| **T0.2** | Decisões de escopo com o owner | Registrar em `docs/PROJECT-STATE.md`: Q1–Q8 respondidas (form provider, destino do admin WP, popups, mapa, analytics, SEO, `/links/`, endereço/horário). **Nenhum arquivo de código.** | T0.1 | Q1–Q8 respondidas e registradas. | S |
| **T0.3** | Guard de segredos + `.gitignore` | `scripts/guard-secrets.mjs` (sem dependência externa) + `.gitignore` (bloco SEC-24 completo) + `"prebuild": "node scripts/guard-secrets.mjs"` no `package.json`. | T0.2 | Introduzir um **valor vivo** do backup (a senha da base de dados, um salt, um token) num `.md` → `npm run build` **falha**; remover → **passa**. (O *nome* da opção não falha: as specs nomeiam as opções a revogar.) `git check-ignore -v .env node_modules dist .astro wp-config.php dump.sql backup.zip` → 7 linhas. | M |
| **T0.4** | Criar o repo no lugar certo | `git init` **em** `<LOCAL>` (a pasta do repositório, dentro de `<BACKUP>`; NUNCA no diretório pai) + `package.json`, `astro.config.mjs`, `tsconfig.json`, `.nvmrc`, `README.md` inicial. Repo `devCarlosHenSil/galastriadvocacia` **público** (R15). | T0.3 | `git rev-parse --show-toplevel` → `<LOCAL>` (SEC-23). `npm install && npm run dev` sobe; `npm run build` gera `dist/` sem erro. `git ls-files` não contém nada do backup. | S |
| **T0.5** | Guardar a referência visual | O oráculo de paridade é o `_elementor_element_cache` do dump (`tests/fixtures/elementor-cache-{30,48,49}.html`); o snapshot do Wayback é **opcional** e fica **fora** do repo. | T0.4 | Os 3 fixtures versionados. | S |
| **T0.6** | Inventariar o CSS servido | O CSS dynamic do Kava fica em `docs/_reference/kava-theme-dynamic.css`; o inventário dos 36 arquivos do Elementor está no `src/data/assets-manifest.json`. | T0.5 | O CSS dynamic versionado e o manifesto. | S |
| **T0.7** | Configurar o Formspree (painel) | Criar/confirmar a conta **do cliente** (Q1 da SPEC-SECURITY), definir o destino `contato@galastriadvocacia.com.br`, "Restrict to Domain" = `galastriadvocacia.com.br`, reCAPTCHA **ativado**, e anotar o plano (free = 50/mês). | T0.2 | Painel configurado; ID do form anotado **fora do repo** até o `.env`. | S |

---

## Fase 1 — Pipeline de extração

| # | Tarefa | Objetivo / arquivos | Depende | Aceitação | Esforço |
|---|---|---|---|---|---|
| **T1.1** | Parser do dump SQL | `scripts/extract/lib/sql.mjs` + `wordpress.mjs` | T0.4 | Lê o `.sql` de 34,7 MB em < 60 s. Contagens conferem: `wp_posts` 766, `wp_postmeta` 5.112, `wp_options` 741, `wp_terms` 84, `wp_term_taxonomy` 84, `wp_term_relationships` 132, `wp_comments` 48, `wp_commentmeta` 231, `wp_users` 2, `_elementor_data` **605** (27 publicados + 578 revisões), `_elementor_element_cache` **5** (R2), `_elementor_conditions` **116** (R3), `elementor_library` 20, `attachment` 58, `nav_menu_item` 7, `auto-draft` 1, `revision` **662 (confirmado)**. | M |
| **T1.2** | Normalizar a árvore Elementor | `lib/elementor.mjs` → `src/data/elementor/*.json` (7 arquivos) | T1.1 | 7 JSONs com a **mesma contagem** de elementos do `_elementor_data` original; `cssId` presente em `home`, `sobre`, `areasdeatuacao`, `servicos`, `quemsou`, `contato`; 0 `_element_id` residual; 0 `__globals__`/`__dynamic__` residual. `home-30.json` com **63** elementos (medido em 2026-10-19; se ≠63, **reportar**, não forçar). | M |
| **T1.3** | Gutenberg → Markdown/HTML | `lib/gutenberg.mjs` → `src/content/blog/*.md` (6) + `src/pages/politica-*.md` (3) | T1.1 | 0 ocorrências de `<!-- wp:`; o post 723 sai com HTML válido (sem `<p></p>`); parágrafos preservados; `<p>/<h1..6>/<ul>/<li>` balanceados. | M |
| **T1.4** | Taxonomias, nav e SEO | `site.json` → `nav` (7, ordem do snapshot: Home, Sobre, Áreas de Atuação, Serviços, Quem Sou, Blog, Contato), `categories` (3), `tags` (57, `href: null` — R4), `seo.perUrl` (16 URLs, R20) | T1.1 | 3 categorias com 2 posts cada; 7 itens de menu com `menu_order` 1..7; `focusKeyword` dos 6 posts verbatim; `perUrl` com `"status": "approved"` só em `/` e `"status": "draft"` nos demais. | S |
| **T1.5** | **Fixtures de paridade (R2)** | `lib/elementor-cache.mjs` → `tests/fixtures/elementor-cache-{30,48,49}.html` | T1.1 | Os 3 fixtures contêm o HTML renderizado; os placeholders `[elementor-element k="…" data="<base64>"]` decodificam para o `settings` JSON de cada widget dinâmico. | S |
| **T1.6** | Reescrita de URLs + manifesto de assets | `lib/urls.mjs` + `lib/assets.mjs` → `src/data/assets-manifest.json` | T1.2 | 0 ocorrências de `galastriadvocacia.com.br/wp-content`; `srcset`/`sizes` removidos; manifest sem nenhum `-WxH`; `public/wp-content/uploads/` == manifest (0 extras, 0 faltantes). Inclui os **36 CSS** do Elementor e as 17 faces locais (R1, R12). | M |
| **T1.7** | Extrair o config do formulário (4 campos) | `site.json → form` a partir do widget `3273196` | T1.2 | Campos, placeholders, `required`, `email_to` (`contato@galastriadvocacia.com.br` — R6), textos de sucesso/erro e cores batem com o widget real. **4 campos: nome, email, telefone, mensagem** (R5) — sem `assunto`. `extract-report.json → formFields` registra os campos reais. | S |
| **T1.8** | **Auditoria de comentários** | Emitir `docs/audit/comentarios-retidos.md` (**não commitado**) | T1.1 | Relatório registra **4 pingbacks aprovados + 44 spam + 0 comentários humanos**; `src/` **sem** qualquer comentário. | S |
| **T1.9** | Suite de asserts do extractor | `scripts/extract/check.mjs` + asserts em `index.mjs` | T1.1–T1.8 | `npm run extract:check` roda a extração 2× e compara SHA-256: **idêntico**. Falha (exit ≠ 0) em qualquer violação das regras §6.1–§6.7 da SPEC-DATA (inclui **0 ocorrências** do e-mail administrativo do cliente, R6). | M |

---

## Fase 2 — Assets, fontes e CSS

| # | Tarefa | Objetivo / arquivos | Depende | Aceitação | Esforço |
|---|---|---|---|---|---|
| **T2.1** | Copiar os uploads | `public/wp-content/uploads/**` (via manifest) | T1.6 | Todos os arquivos do manifest presentes; nenhum `-WxH`; nenhum `wpforms/`, `ultimate-post-kit-backups/`, `wpr-addons/`, `rank-math/`; `Recesso-Art-*` **DROP** (R10); `Logo-Xentry-Labs-*` **DROP**. | M |
| **T2.2** | Copiar o CSS do Elementor **verbatim** (R1) | `public/wp-content/uploads/elementor/css/*` (**36** arquivos) + `public/wp-content/uploads/elementor/google-fonts/**` | T1.6 | Os **36** arquivos byte-idênticos ao backup (hash conferido). `post-695.css`/`post-1004.css` mantidos mesmo com os popups descartados. | S |
| **T2.3** | **Consolidar o CSS** | `public/css/*`: `theme.css` (kava/style.css) · `theme-dynamic.css` (bloco `kava-theme-style-inline-css`) · `elementor-core.css` (`custom-frontend.min.css`) · `elementor-kit.css` (`post-6.css`) · `elementor-home.css` (`post-30.css`) · `elementor-header.css` (`post-49.css`) · `elementor-footer.css` (`post-48.css`) · `widgets.css` · `elementor-widgets.css` (`custom-widget-*.min.css`) · `custom-pro-widget-nav-menu.css` · `upk.css` · `elementskit.css` · `swiper.css` · `fontawesome.css` (FA 4.7.0) · `animations.css` (fadeIn/pulse/grow) · `hfe.css` · `hfe-widgets.css` · `fonts.css` · `tokens.css` · `a11y.css` | T2.1, T2.2, T2.4 | Ordem de `<link>` **idêntica** ao snapshot (§5.1 da SPEC-UI), com `tokens.css` e `a11y.css` **por último**; `url()` reescritas para `${BASE}wp-content/…`; **nenhuma** regra do CSS do Elementor reescrita; `tokens.css` **não** altera `--e-global-color-accent` (R7). | M |
| **T2.4** | **Self-hosting de fontes (R12)** | `lib/fonts.mjs` → `public/fonts/roboto/roboto-latin-{300,400,500,900}.woff2`, `public/fonts/montserrat/montserrat-latin-700.woff2`, `public/css/fonts.css` | T2.2 | `grep -r "fonts.googleapis\|fonts.gstatic" dist/` = **0**; todas as faces com `font-display: swap`; pesos 300/400/500/900 (Roboto) e 700 (Montserrat) presentes; os `@font-face` locais de Nunito (11), Questrial (3) e Qwigley (3) reescritos para `/wp-content/uploads/elementor/google-fonts/fonts/…`; `Amsterdam.ttf` **só se** o extractor reportar referência. | S |
| **T2.5** | Montar o manifesto de fontes no `site.json` | `site.json → theme.fonts` | T2.4 | `Questrial` 600 47px/19px e `Nunito` 500 15px/1.6 como canônicos; `Roboto` e `Montserrat` presentes como `--font-ui` / `--font-brand` (self-hosted). | S |

---

## Fase 3 — Layout, renderer e páginas

| # | Tarefa | Objetivo / arquivos | Depende | Aceitação | Esforço |
|---|---|---|---|---|---|
| **T3.1** | `BaseLayout.astro` | `<head>`, meta/OG/Twitter, JSON-LD, classes do `<body>`, `#page.site`, skip-link, `<meta http-equiv="Content-Security-Policy">` (fallback R16), `Referrer-Policy` | T2.3, T1.4 | `dist/index.html` contém `lang="pt-BR"`, `elementor-kit-6` no `<body>`, `<div id="page" class="site">`, `<div id="content" class="site-content">`, `<footer id="colophon" class="site-footer">`; a meta CSP aparece **antes** de qualquer `<script>`. | M |
| **T3.2** | `ElementorRenderer.astro` + `ElementorWidget` (o contentor é o nó `e-con` do próprio renderer) | Motor de render da árvore Elementor (contrato DOM da SPEC-UI §1.1) | T1.2 | Para o post 30: **63** elementos renderizados, mesma ordem, mesmas classes `elementor-element-<id>`, containers com `e-con`/`e-con-inner`/`e-parent`/`e-child`, widgets com `elementor-widget-container`. `data-settings` opcional (nenhum CSS o lê). | L |
| **T3.3** | Widgets estáticos | `Heading`, `TextEditor`, `Button`, `Image`, `IconBox`, `ImageBox`, `Divider`, `IconList`, `SocialIcons`, `Html`, `Copyright` | T3.2 | O markup gerado é equivalente ao do snapshot para os mesmos ids (exceto `data-settings`); as classes funcionais de layout estão presentes (§1.1 da SPEC-UI). | M |
| **T3.4** | `NavMenu.astro` + `nav-toggle.js` | Substitui o widget nav-menu (dois `<nav>`: main + dropdown) | T3.2 | 7 itens na ordem correta; toggle mobile é `<button>` real com `aria-expanded`; `Esc` fecha e devolve o foco; `href`s corretos (`/#sobre`, `/blog/`, …); `aria-current="page"` **só** em Home. | M |
| **T3.5** | `Header.astro` / `Footer.astro` | Renderizam os templates 49 e 48 | T3.3 | `dist/index.html` contém `class="elementor elementor-49 elementor-location-header"` e `…elementor-48 elementor-location-footer"`; footer com o copyright "© {ano} … Xentry Labs"; logo do header **horizontal 560×189** (C2). | M |
| **T3.6** | Home (post 30) | `src/pages/index.astro` | T3.5 | As 10 seções na ordem `af9b6b1 → 7dffe5f → 845bcff → dd1df9b → 2f1b5f2 → e2b2a60 → 6d564f8 → 0c92c76 → a69d5f8 → 78422c7`; os 6 âncoras presentes; hero **sem overlay** (C1). | M |
| **T3.7** | `UpkAlexGrid.astro` / `UpkAmoxGrid.astro` | Substituem os loops UPK (home + arquivo) | T3.2, T1.3 | Home mostra 3 posts; `/blog/` mostra 6; markup `upk-alex-grid`/`upk-amox-grid` preservado; `upk-alex-grid.css` aplica. | M |
| **T3.8** | `ElementskitTestimonial.astro` + Swiper | Substitui o slider | T3.2, T2.3 | 3 slides; autoplay 1000 ms; 3/2/1 slides por viewport; dots como `<button>` com `aria-current`; botão de pausar/retomar; `pauseOnFocus`. | M |
| **T3.9** | `GoogleMaps.astro` (click-to-load) | Placeholder 16:9 + botão "Carregar mapa" + link "Abrir no Google Maps"; iframe só após clique **e** consentimento (R13) | T3.2, T4.3 | Nenhuma requisição ao Google antes do clique/consentimento; iframe com `title` descritivo, `loading="lazy"`, `referrerpolicy="strict-origin-when-cross-origin"`; `filter: saturate(60%)` mantido. | S |
| **T3.10** | `Form.astro` + `form.js` + `phone-mask.js` | Formulário de 4 campos (R5) com Formspree | T1.7, T0.7 | 4 campos com `required`, `autocomplete`, `maxlength`; honeypot `_gotcha` (R14); `Accept: application/json`; `Referrer-Policy` **nunca** `no-referrer`; máscara `(00) 00000-0000`; checkbox LGPD obrigatório; **CTA permanente de WhatsApp** ao lado; mensagens de sucesso/erro com `role="status"`/`role="alert"`; sem `set:html` de dado de usuário. | M |
| **T3.11** | Blog | `src/pages/blog.astro`, `src/pages/[slug].astro` (**raiz**, R4), `src/pages/category/[slug].astro` (**`/category/<slug>/`**, R4), `PostLayout.astro` | T1.3, T3.7 | 6 posts em `/<slug>/`; categorias em `/category/<slug>/` com os 2 posts corretos; **nenhuma página de tag**; nenhum comentário renderizado; nenhuma string de spam no `dist/`. | M |
| **T3.12** | Páginas de política | 3 `src/pages/politica-*.md` (R8) | T1.3 | Conteúdo idêntico ao `post_content`; `<h1>`/`<h2>` preservados; `layout: ~/layouts/PolicyLayout.astro`; **texto LGPD atualizado** (SPEC-SECURITY §5.2/§5.3) e revisado pelo advogado. | S |
| **T3.13** | `LinksPage` (843) | `src/pages/links.astro` | T3.3 | Avatar, título e botões-imagem renderizados; sem header/footer (fiel ao `elementor_canvas`); `alt` dos botões conforme §4.4 da SPEC-UI. | S |
| **T3.14** | `404.astro` | Template 790 | T3.3 | `dist/404.html` com "Ops! Parece que alguma coisa deu errado." e o botão "Voltar ao início" (sem typo); sem header/footer. | S |
| **T3.15** | `PolicyLayout.astro` + `PostLayout.astro` + `PageLayout.astro` | Layouts com `<head>`, JSON-LD e link "Gerenciar preferências de cookies" no rodapé | T3.1, T3.5 | Toda página tem o link de preferências no rodapé; o JSON-LD é válido no validator.schema.org. | S |

---

## Fase 4 — SEO, cookies (LGPD) e rotas legadas

| # | Tarefa | Objetivo / arquivos | Depende | Aceitação | Esforço |
|---|---|---|---|---|---|
| **T4.1** | `src/lib/seo.ts` | Title/description/canonical/OG/Twitter/JSON-LD por página, lendo **`site.json.seo.perUrl`** (R20) | T3.1 | `<title>` e `<meta name="description">` vêm **exclusivamente** de `perUrl`; canonical absoluto `https://galastriadvocacia.com.br{path}`; OG completo; `twitter:card=summary_large_image`; JSON-LD `@graph` com `Organization` + `LegalService` + `WebSite` + `BlogPosting` (posts) + `WebPage` (políticas). | M |
| **T4.2** | **CSP + headers (R16)** | Meta CSP no `BaseLayout` (fallback) **+** Transform Rule do Cloudflare (produção) | T3.1 | A string de CSP é **exatamente** a da SPEC-SECURITY §2 (SEC-42); a versão `<meta>` remove `frame-ancestors 'none'` e `upgrade-insecure-requests`; a Transform Rule injeta os 5 headers da SEC-43. `curl -sI` mostra CSP, HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. | M |
| **T4.3** | **Banner de cookies (R13)** | `CookieConsent.astro` + `cookie-consent.js` + `<dialog>` de preferências | T3.1, T3.9 | 1ª visita mostra o banner; "Aceitar"/"Rejeitar" com **peso visual igual**; painel de 2º nível com 3 categorias ("Necessários" desabilitado, Analíticos/Publicidade desmarcados); escolha persiste em `localStorage` (`ga_consent`); link permanente no rodapé; **zero requests** a GTM/AdSense antes do consentimento; Consent Mode com `denied` por padrão; `adsbygoogle.js` só após consentimento. | L |
| **T4.4** | Sitemap + robots + alias | `@astrojs/sitemap`, `public/robots.txt`, `public/sitemap_index.xml`, `src/pages/home.astro` | T4.1 | `sitemap-index.xml` lista as 15 rotas públicas (sem `/404` nem o alias `/home/`); `robots.txt` com `Allow: /` + `Sitemap:` (sem `Disallow: /` isolado); `/home/` responde 200 com `<link rel="canonical" href="https://galastriadvocacia.com.br/">` + meta-refresh. | S |
| **T4.5** | Redirects | `src/data/redirects.json` (R4) + Redirect Rule 301 do Cloudflare | T1.4, T5.2 | O arquivo contém **1** entrada: `{"/home/": "/"}`. A Redirect Rule do Cloudflare está criada (ou documentada como pendência em `docs/DEPLOY.md`). | S |
| **T4.6** | Copy de SEO dos 6 posts + políticas | Preencher `seo.perUrl` (R20) | T1.4 | Rascunhos de §3.2.2 da SPEC-DATA revisados e **aprovados pela advogada**; `"status": "draft"` → `"status": "approved"` apenas para os aprovados. | S |

---

## Fase 5 — Deploy, CI/CD e go-live

| # | Tarefa | Objetivo / arquivos | Depende | Aceitação | Esforço |
|---|---|---|---|---|---|
| **T5.1** | **Workflow GH Actions (R19)** | `.github/workflows/deploy.yml` (template pronto na SPEC-SECURITY §2.5) | T0.4, T2.3, T3.1 | 5 actions fixadas por SHA; `pull_request` **ausente**; `permissions` mínimas por job; `persist-credentials: false`; `npm ci`; `npm audit --audit-level=high`; step `node scripts/guard-secrets.mjs` **antes** do build; `concurrency` group `pages`; `public/CNAME` **dentro** do artefato (R18). | S |
| **T5.2** | Domínio + DNS + Cloudflare | `public/CNAME` + A records do GitHub Pages + CNAME `www` → ``galastriadvocacia.com.br` (o `www` é um **CNAME para o apex** + uma **Redirect Rule 301** para o apex — a decisão está em `docs/DEPLOY.md` §2.1 e §3.4)` + **Transform Rules** (CSP + headers) + Redirect Rule 301 de `/home/` + TLS "Full (strict)" + "Enforce HTTPS" no Pages | T5.1, T4.2, T4.5 | `https://galastriadvocacia.com.br/` serve o `dist/`; `www` redireciona; `dig` confere; certificado válido (SAN com apex e `www`); `curl -sI` mostra os 5 headers + CSP. | M |
| **T5.3** | Env do form | `.env.example` (só `PUBLIC_FORMSPREE_ENDPOINT` com **placeholder**) + `vars.PUBLIC_FORMSPREE_ENDPOINT` no repositório GitHub + painel Formspree com destino `contato@galastriadvocacia.com.br` | T0.7, T3.10 | O bundle **não** contém segredo; só o endpoint público. A entrega real chega em `contato@galastriadvocacia.com.br` (E2E, T6.5). | S |
| **T5.4** | Runbook de deploy e rollback | `docs/DEPLOY.md` + `docs/runbook-pages.md` (SEC-62) | T5.2 | Runbook de rollback **testado uma vez** (`git revert` + push; alternativa: reabrir um artifact anterior na aba *Deployments*). DNS old host pronto para re-point. O WP antigo fica acessível (host separado, sem DNS) por **≥ 30 dias**. | S |
| **T5.5** | Gate de go-live | Checklist final: SEC-23…SEC-30 verdes, **T0.1 (rotação) concluída**, políticas LGPD aprovadas, SEO aprovado, aprovação visual do owner | T5.1–T5.4, T6.1–T6.7 | Todos os itens do Definition of Done marcados; aprovação da advogada registrada. | S |

---

## Fase 6 — Verificação e QA

| # | Tarefa | Objetivo / arquivos | Depende | Aceitação | Esforço |
|---|---|---|---|---|---|
| **T6.1** | Link-checker + validação HTML | `scripts/check-links.mjs` | T4.4 | 0 links internos quebrados; 0 erros de HTML; `grep -r "galastriadvocacia.com.br/wp-content" dist/` = 0; `grep -r "srcset=" dist/` = 0. | S |
| **T6.2** | **Teste de paridade visual** | `scripts/visual-diff.mjs` (Playwright) — **opcional**: sem Playwright o script imprime "Playwright unavailable — skipping the pixel diff" e **sai com 0**; a verificação **estrutural** (`npm run check-parity`, R2) é a obrigatória e não precisa de browser | T1.5, T3.14 | (a) **Estrutural**: conjunto + ordem de `elementor-element-{id}`, âncoras e texto visível **idênticos** ao fixture `tests/fixtures/elementor-cache-30.html`; (b) **Pixels**: `toHaveScreenshot` com `maxDiffPixelRatio ≤ 0.02` em 1440×900, 390×844 e 768×1024; diffs > 0,5% documentados em `docs/PARITY.md` com causa (drift vs regressão). | M |
| **T6.3** | Lighthouse | `.lighthouserc.json` | T6.1 | Performance ≥ 90 (mobile), SEO = 100, A11y ≥ 95, Best Practices ≥ 95 nas 6 rotas principais. | S |
| **T6.4** | Acessibilidade + banner de cookies | `axe-core` + checklist manual da SPEC-UI §9 (blocos A–E) | T6.1, T4.3 | 0 violações axe `serious`/`critical`; contraste ≥ 4.5:1 (texto) e ≥ 3:1 (componentes); nenhum request ao Google Fonts; banner respeita "Rejeitar" (sem `_ga`/`IDE`/`test_cookie`/`_gcl_au`); mapa não carrega antes do consentimento. | M |
| **T6.5** | **E2E do formulário** | Playwright + envio real (manual, na máquina do escritório) | T5.3 | (a) Envio real **chega** em `contato@galastriadvocacia.com.br` e **não** é marcado como spam — print arquivado; (b) o request mostra `Referer: https://galastriadvocacia.com.br/`; (c) `curl` com `Referer` alheio **não** entrega; (d) honeypot preenchido **não** entrega; (e) 4 campos com `required` bloqueiam envio vazio; (f) máscara de telefone aplicada; (g) mensagem de sucesso com `role="status"`. | M |
| **T6.6** | Revisão de segurança do repo | Checklist SEC-23…SEC-30 + SEC-49…SEC-55 + SPEC-SECURITY §4.1/§4.2 | T5.1 | **Todas** as listas "DEVE SER ZERO" devolvem vazio; "DEVE ESTAR PRESENTE" tudo ok; `npm audit` 0 high/critical; histórico git limpo; `dist/` limpo. | S |
| **T6.7** | Documentação | `README.md`, `docs/DEPLOY.md`, `docs/PARITY.md`, `docs/PROJECT-STATE.md` | T6.2–T6.6 | Um desenvolvedor novo consegue buildar, editar um post e publicar sem ajuda; `docs/PROJECT-STATE.md` reflete o estado final. | M |

---

> **Ferramentas opcionais da Fase 6 (2026-10-19).** `npm run check-parity` (paridade **estrutural**, R2) e `npm run check-links` (links internos + ausência de assets externos) correm **sem** dependências externas e são **obrigatórios**. `npm run visual-diff` (paridade de **pixels**) usa o Playwright como dependência **opcional**: sem ele — ou sem browser — o script avisa e sai com **0**, sem falhar o build. `.lighthouserc.json` é só a configuração; o Lighthouse corre à parte (`npx lighthouse`).

## 3. Definition of Done

- [ ] `npm ci && npm run build` roda limpo do zero e gera `dist/` com as **17 rotas HTML** esperadas (`/`, `/home/`, `/blog/`, `/links/`, 3 políticas, 6 posts na raiz, 3 categorias) + `404.html` + `sitemap-index.xml` + `robots.txt`.
- [ ] `dist/` não contém nenhuma referência a `galastriadvocacia.com.br/wp-content` nem a `fonts.googleapis.com` / `fonts.gstatic.com`.
- [ ] O repositório **não** contém: o dump `.sql`, `wp-config.php`, `wp-config-sample.php`, e-mails de usuários ou de spammers, o e-mail administrativo do cliente, ou qualquer string de credencial.
- [ ] `git rev-parse --show-toplevel` → `<LOCAL>`; `git ls-files` limpo; histórico sem `.sql`/`wp-config`/`.zip`.
- [ ] **Gate de publicação (SEC-67):** `npm run gate:rotation` sai com **0** — as **12** rotações de segredos de `docs/rotation-gate.md` estão **todas** concluídas **com evidência** (print sem o valor + data + responsável). O `deployer` **não** faz push para o repositório público enquanto **qualquer** uma das 12 estiver pendente — o gate é **duro**, não advisory: publicar antes da rotação equivale a publicar as credenciais.
- [ ] **Redação de `docs/` verificada (SEC-65 / SEC-66):** `node scripts/guard-secrets.mjs` passa **com `docs/` no escopo**; o bloco de redação da SEC-66 devolve **0 linhas**; o teste de "segredo plantado em `docs/`" faz o build **falhar**; nenhuma das specs de `docs/` contém valor de segredo ou PII de terceiro.
- [ ] Diff visual ≤ 2% nas 3 viewports, nas 10 seções da home, em `/blog/`, em 1 post e nas 3 políticas — **não aplicável sem um navegador**: o `tests/visual/reference/` não existe e o `visual-diff` nunca teve base de comparação. O que **foi** medido e as divergências **aceites** estão em `docs/PARITY.md`.
- [ ] Paridade estrutural: os **63** ids de elemento do `_elementor_data` presentes com as classes `elementor-element-<id>` e os 6 âncoras existem.
- [ ] O formulário tem os **4 campos** com os placeholders originais, envia para o endpoint, exibe a mensagem de sucesso e a de erro, tem honeypot `_gotcha`, máscara de telefone, checkbox LGPD, **CTA de WhatsApp**, e **a entrega em `contato@galastriadvocacia.com.br` foi confirmada**.
- [ ] Os 6 posts estão em `/<slug>/` (raiz), com imagem de destaque, categoria, data, tempo de leitura e SEO próprio; as 3 categorias em `/category/<slug>/`; **nenhuma página de tag**.
- [ ] Nenhum comentário renderizado; nenhuma string de spam no `dist/`.
- [ ] JSON-LD válido no validator.schema.org, com `Organization`, `WebSite`, `LegalService` e `BlogPosting`.
- [ ] `sitemap-index.xml` e `robots.txt` publicados e referenciados.
- [ ] `404.html` correto e servido pelo Pages em rota inexistente.
- [ ] `/home/` responde 200 com canonical para `/`; Redirect Rule 301 no Cloudflare ativa (ou documentada).
- [ ] Banner de cookies presente, com "Aceitar"/"Rejeitar" de mesmo peso, painel de preferências e Consent Mode `denied` por padrão; **zero** requests ao GTM/AdSense antes do consentimento.
- [ ] CSP e os 5 headers de segurança aplicados (Transform Rule do Cloudflare) **ou** fallback `<meta>` documentado; `Referrer-Policy: strict-origin-when-cross-origin` (nunca `no-referrer`).
- [ ] `public/CNAME` no artefato do Pages; `www` redireciona para o apex; certificado válido.
- [ ] Workflow: 5 actions por SHA, sem `pull_request`, permissões mínimas, `persist-credentials: false`, guard de segredos no `prebuild` **e** no CI, `npm audit` limpo.
- [ ] Lighthouse: Performance ≥ 90, SEO = 100, A11y ≥ 95, Best Practices ≥ 95.
- [ ] 0 links internos quebrados; 0 erros de HTML; 0 violações axe críticas; alvos de toque ≥ 44×44.
- [ ] Políticas de Privacidade e de Cookies atualizadas com os blocos da SPEC-SECURITY §5.2/§5.3 e **aprovadas pelo advogado**.
- [ ] `site.json.seo.perUrl` aprovado pela advogada (R20) — nada de `"status": "draft"` pendente.
- [ ] O runbook de rollback foi escrito **e testado uma vez**.
- [ ] `README.md`, `docs/DEPLOY.md`, `docs/PARITY.md` e `docs/PROJECT-STATE.md` existem e estão corretos.
- [ ] Aprovação visual final do **owner** (a advogada) registrada.

---

## 4. Riscos

| # | Risco | Prob. | Impacto | Mitigação | Rollback |
|---|---|---|---|---|---|
| R1 | **O site original está offline (HTTP 522)** — não há "antes" ao vivo | Alta | Médio | Usar o `_elementor_element_cache` (2026-03-22) como oráculo de paridade + o snapshot do Wayback (2025-03-28) como referência visual. Se o owner tiver screenshots, usar. | — |
| R2 | Divergência entre o snapshot de 2025-03 e o backup de 2026-03 (formulário, popups, novos widgets) | Média | Médio | O `_elementor_data` do backup é a fonte de verdade; o snapshot valida DOM/CSS. Classificar cada diff como **drift** ou **regressão** em `docs/PARITY.md`. | Reverter o commit. |
| R3 | O CSS do Elementor depende de JS (animações, `elementor-hidden-*`) | Média | Alto | Copiar `elementor-frontend.min.js`; se as classes responsivas falharem, replicar as regras em `a11y.css`/`site.css`. | Reverter o commit. |
| R4 | Fontes self-hosted com subsets/pesos errados → texto com fallback diferente | Média | Médio | `font-display: swap` + checklist de paridade; conferir o `font-weight` de cada face; `document.fonts.check` no teste B.3. | Reverter. |
| R5 | `srcset` removido mas `sizes` mantido (ou vice-versa) → imagens quebradas | Baixa | Alto | Remover **ambos** no mesmo passo; `grep` no `dist/` por `srcset` deve retornar 0; link-checker. | Reverter. |
| R6 | **Formulário não entrega e-mail** (endpoint errado, quota, spam) | Média | **Crítico** | E2E real antes do go-live (T6.5); reCAPTCHA + honeypot + "Restrict to Domain"; **CTA de WhatsApp permanente** como mitigação de quota (R14); plano pago definido antes de 50/mês. | Reverter para o endpoint anterior; plano B: `mailto:` do form. |
| R7 | DNS/CNAME de domínio custom não configurado → site não abre no domínio | Média | Crítico | Configurar DNS **antes** do deploy; validar com `dig` + `curl -I`; `CNAME` dentro do artefato (R18). | Reverter DNS (apontar para o host antigo). |
| R8 | **Repo público vaza segredos/PII** (dump SQL, `wp-config.php`, e-mails) | Média | **Crítico** | `.gitignore` (SEC-24) + guard de segredos no `prebuild` **e** no CI + SEC-23…SEC-30 como gate + **rotação de segredos antes do go-live** (T0.1). | `git filter-repo` / recriar o repo. |
| R9 | Repositório público expõe e-mails de comentários spam | Baixa | Alto | Comentários **não** migrados (48 linhas de auditoria fora do repo). | — |
| R10 | GitHub Pages não faz 301 → `/home/` duplica conteúdo | Alta | Baixo | `canonical` correto + meta-refresh + Redirect Rule no Cloudflare (T4.5). | — |
| R11 | Ranqueamento/URLs: se o owner mudar de hospedagem, o canonical precisa do domínio final | Média | Alto | `site` fixo em `astro.config.mjs` = `https://galastriadvocacia.com.br`. | Editar 1 linha. |
| R12 | Custo/latência: `public/wp-content/uploads` com PNG de 700 KB | Certa | Médio | Aceitar (paridade). Otimização para WebP = follow-up opcional. | — |
| R13 | **Quota do Formspree (50/mês)** estourada → formulário para em silêncio | Média | **Alto** | Monitorar o contador; plano Personal (≈US$ 10/mês) antes do limite; CTA de WhatsApp permanente; 1 envio de teste por semana no máximo. | — |
| R14 | **Cloudflare proxy desligado** → sem CSP/headers no servidor | Baixa | Alto | Proxy **ligado** + TLS "Full (strict)" (T5.2); fallback `<meta http-equiv>` no layout (R16). | — |
| R15 | **Política LGPD desatualizada** no go-live | Média | **Alto** | Blocos de texto prontos (SPEC-SECURITY §5.2/§5.3); aprovação do advogado como item do Definition of Done. | Atrasar o go-live. |
| R16 | Mudança de tag (`h2`→`h1`/`h3`/`p`) quebra o CSS | Média | Alto | O CSS é por **classe**; teste estrutural A.1+A.2 antes de aceitar qualquer diff. | Reverter. |
| R17 | **As specs de `docs/` republicam credenciais** (o repositório é público) | Alta | **Crítico** | Redação SEC-66 (placeholders + derivação em runtime) + SEC-65 (`docs/` no escopo do `guard-secrets`) + SEC-67 (gate duro antes do 1º push). Registro em `docs/PROJECT-STATE.md` §9. | Reverter o commit / recriar o repo. |

---

## 5. Perguntas em aberto (com o default recomendado)

| # | Pergunta | Default recomendado | Impacto se a resposta for diferente |
|---|---|---|---|
| **Q1** | Conta do Formspree: do cliente ou da agência? | **Do cliente**, com `contato@galastriadvocacia.com.br` como titular e 2FA ativo. Se for da agência, a agência vira controladora de um canal que recebe dados de potenciais clientes (risco de sigilo profissional, art. 7º, XI). | Precisa de convênio/convite como *member*; risco de perda de acesso no fim do contrato. |
| **Q2** | Formspree **ou** Web3Forms? | **Formspree** (`https://formspree.io/f/<id>`), com destino `contato@…` no painel. Web3Forms exigiria proxy (a `access_key` é segredo). | Web3Forms adiciona 1 componente (proxy) e um segredo no front — **evitar**. |
| **Q3** | URL canônica da home: `/` ou `/home/`? | **`/`** (é o que o WP servia; o `<link rel=canonical>` original apontava para `/`). `/home/` vira alias com canonical para `/`. | Baixo, com canonical correto. |
| **Q4** | Migrar os 48 comentários (4 pingbacks + 44 spam)? | **Dropar.** Não existe comentário humano aprovado; publicar spam de casino e de apostas num site de advocacia é dano real (reputação, sinal de spam, PII de terceiros). O campo `comments[]` fica no schema, vazio. | Migrar exigiria moderação (remover spam) — +1 dia e risco reputacional. |
| **Q5** | Manter `/feed/` (RSS), `/author/ana-paula/` e páginas de tag? | **Não** (default): 404. **R4** já fixou: sem páginas de tag. | Baixo. Sem SEO relevante. |
| **Q6** | `/links/` deve ter header/footer? E os popups "Recesso"? | **`/links/` sem header/footer** (fiel ao `elementor_canvas` do post 843). **Popups: dropar** (R10) — já renderizam vazios. O post **907 é descartado** (R9). | Se o owner quiser os popups, exige reconstruir o conteúdo de marketing (não recuperável do banco) — escopo novo. |
| **Q7** | Google Maps: iframe ou imagem estática? E manter GTM/AdSense? | **Manter o iframe**, mas **click-to-load e gated on consent** (R13). **GTM: manter** (métricas existentes). **AdSense: manter** (decisão do owner) → **banner de cookies obrigatório** (T4.3). | Se remover GTM/AdSense: CSP mais simples, mas perde-se receita/métricas e o banner deixa de ser obrigatório. |
| **Q8** | Endereço completo, horário de atendimento e aprovação do copy de SEO? | Preencher com dados públicos verificáveis (o mapa traz "Avenida Henrique Brunini, Jundiaí"); horário `Mo-Fr 09:00-18:00` **deixar como omissão** até o owner confirmar. SEO: usar os rascunhos da SPEC-DATA §3.2.2 como ponto de partida, **sujeitos à aprovação da advogada** (R20). | `LegalService` incompleto não quebra nada; copy de SEO não aprovado é o principal risco editorial. |

---

## 6. Ordem de execução resumida

```
Fase 0  Fundação ──► Fase 1 Extração ──► Fase 2 Assets/CSS/Fontes ──► Fase 3 Renderer/Páginas
                                                                        │
                            ┌───────────────────────────────────────────┘
                            ▼
Fase 4 SEO/Cookies/Rotas ──► Fase 5 Deploy/CI/Go-live ──► Fase 6 Verificação/QA
                            ▲
                            └─ Fase 0 (rotação de segredos) é gate de entrada do go-live
```

**Caminho crítico:** T0.1 (rotação) → T0.4 (repo) → T1.1–T1.9 (extração) → T2.1–T2.5 (assets) → T3.1–T3.15 (renderer/páginas) → T4.1–T4.6 (SEO/cookies) → T5.1–T5.5 (deploy) → T6.1–T6.7 (QA).
**Paralelizável:** T2.4 (fontes) com T1.x; T3.3–T3.5 com T2.3; T4.4–T4.6 com T3.11; T6.2–T6.4 com T5.x.
