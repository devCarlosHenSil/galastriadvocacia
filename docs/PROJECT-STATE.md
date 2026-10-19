# PROJECT-STATE — Galastri Advocacia (WordPress → Astro)

> **Última atualização:** 2026-10-19 (Fases 0–3 e 5–6 implementadas · **redação das specs** (SEC-65…67) · **FIX PASS A** — segurança, dados e SEO, §13 · **FIX PASS B** — UI/UX, §14 · **FIX PASS C** — a rodada final, §15 · **FIX PASS D** — a última rodada, §16)
> **Projeto:** migração do site `galastriadvocacia.com.br` (WordPress 6.9.4 + Elementor 3.35.7 + tema `kava`) para **Astro 5** estático no **GitHub Pages**.
> **Raiz do repo git:** `<LOCAL>/galastriadvocacia` (o repositório é **público**: o caminho da máquina não é versionado)
> **Backup (read-only, nunca escrever):** `<BACKUP>`

---

## 1. Estado atual

| Item | Estado |
|---|---|
| **Fase** | **Implementação completa e validada (Fases 0–6).** A Fase 5 está **concluída no código** (workflow, runbooks, verificação); falta a **execução operacional** do cliente: rotação dos segredos, repositório público, DNS, Cloudflare, Pages e Formspree. | **Fases 0, 1, 2, 3, 5 e 6 concluídas** — fundação, extração validada, assets/CSS/fontes, renderer do Elementor com as 17 rotas, CI/CD e ferramentas de verificação. A **Fase 4** está **quase completa** (SEO, CSP em `<meta>`, banner de cookies, sitemap, robots e o alias `/home/` já estão no lugar) — falta apenas a **Fase 5 operacional** (DNS, Cloudflare, repositório público, Formspree). |
| Fase 0 | ✅ concluída — scaffold do Astro 5, `guard-secrets.mjs`, `.gitignore` (SEC-24), `git init` na pasta certa, `public/CNAME`, `public/robots.txt` |
| Fase 1 | ✅ concluída — `npm run extract` e `npm run extract:check` verdes (120 arquivos idênticos entre as duas execuções) |
| Fase 2 | ✅ concluída — CSS consolidado em `public/css/` (16 folhas + `fonts.css`), fontes self-hosted, `assets-manifest.json` gerado, `public/wp-content/uploads/` = 97 arquivos |
| Fase 3 | ✅ concluída — renderer do Elementor (7 templates), **25 widgets**, os 4 layouts, as **17 rotas** renderizadas, o formulário, o banner de cookies e o mapa click-to-load |
| Fase 5 (código) | ✅ concluída — `.github/workflows/deploy.yml` (5 actions fixadas por SHA, `pull_request` ausente, permissões mínimas) + `docs/DEPLOY.md` |
| Fase 5 (operação) | ⬜ pendente — repositório público, DNS, Transform Rules da Cloudflare, Pages, Formspree, **rotação dos 12 segredos** (gate duro, SEC-67) |
| Fase 6 | ✅ concluída — `npm run check-parity` (PASS nos 3 fixtures), `npm run check-links` (0 quebrados), `npm run visual-diff` (opcional, degrada com aviso), `.lighthouserc.json` |
| Código de aplicação | Completo: `src/pages/**`, `src/layouts/**`, `src/components/**` (Elementor + widgets), `src/lib/**` |
| Repositório GitHub | `devCarlosHenSil/galastriadvocacia` — **ainda não existe** (a API do GitHub retorna 404). O repositório local tem **1 commit** (a história é recriada de propósito, sem o histórico do WordPress) e **sem remote**. |
| Site de produção | **Offline — HTTP 522** (origin do WordPress sem resposta; Cloudflare com proxy ligado) |
| Única referência navegável | Snapshot do Wayback `20250328152643` (local, fora do repo) + o `_elementor_element_cache` do dump (22/03/2026) |

---

## 2. Decisões tomadas

| # | Decisão | Data | Origem | Status |
|---|---|---|---|---|
| D1 | Astro 5, `output: 'static'`, sem adapter, sem backend | 2026-10-19 | planner | **Firmada** |
| D2 | Estratégia de renderização: **"DOM replay fiel ao CSS"** — o CSS gerado pelo Elementor é copiado **verbatim** e o DOM é reproduzido para que ele aplique sem alteração | 2026-10-19 | planner + **R1** | **Firmada** |
| D3 | Repositório **PÚBLICO** (decisão do owner), sobrepondo a recomendação de começar privado | 2026-10-19 | **R15** | **Firmada** — impõe SEC-23…SEC-30 como gate |
| D4 | `scripts/guard-secrets.mjs` roda no `prebuild` **e** em step próprio do CI | 2026-10-19 | **R15** + SEC-30/55 | **Firmada** |
| D5 | Rotas: home `/`; `/home/` = alias (canonical → `/`); `/blog/` = arquivo; **posts na raiz** `/<slug>/`; categorias em `/category/<slug>/`; **sem páginas de tag**; `/links/`; 3 políticas; `/404` | 2026-10-19 | **R4** | **Firmada** — `redirects.json` = `{"/home/": "/"}` |
| D6 | Formulário com **4 campos**: nome, email, telefone, mensagem (sem "assunto") | 2026-10-19 | **R5** | **Firmada** — o dev deve validar contra o widget `3273196` |
| D7 | E-mail público = `contato@galastriadvocacia.com.br`; `<email administrativo do cliente>` (admin do WP) **fora** do HTML publicado | 2026-10-19 | **R6** | **Firmada** |
| D8 | Paleta do **Elementor kit** (post 6) é canônica; `theme_mods_kava` só contribui o que o kit não tem | 2026-10-19 | **R7** | **Firmada** |
| D9 | Correções de contraste da SPEC-UI aplicadas via **tokens derivados** (`--color-accent-text` / `--color-accent-text-inverse`), **sem** mexer em `--e-global-color-accent` | 2026-10-19 | **R7** + SPEC-UI §4.1 | **Firmada** |
| D10 | Políticas são **páginas Astro nativas** `src/pages/politica-*.md` (não collection) | 2026-10-19 | **R8** | **Firmada** |
| D11 | Post **907** descartado; **843** publicado em `/links/` | 2026-10-19 | **R9** | **Firmada** |
| D12 | Popups **695/1004** descartados (renderizam vazio) | 2026-10-19 | **R10** | **Firmada** |
| D13 | **Preloader descartado** (`page_preloader=1` era o preloader de imagem do Kava) | 2026-10-19 | **R11** | **Firmada** |
| D14 | Fontes **100% self-hosted**: Roboto 300/400/500/900 e Montserrat 700 **baixados**; Nunito/Questrial/Qwigley já locais; `Amsterdam.ttf` só se referenciado | 2026-10-19 | **R12** | **Firmada** |
| D15 | **Banner de cookies obrigatório** (GTM + AdSense mantidos); iframe do Maps **click-to-load e gated on consent** | 2026-10-19 | **R13** | **Firmada** |
| D16 | Formspree: `PUBLIC_FORMSPREE_ENDPOINT`, honeypot `_gotcha`, `Accept: application/json`, `Referrer-Policy: strict-origin-when-cross-origin` (nunca `no-referrer`), "Restrict to Domain" = `galastriadvocacia.com.br`, reCAPTCHA ativo, free tier 50/mês → **CTA permanente de WhatsApp** | 2026-10-19 | **R14** | **Firmada** |
| D17 | GitHub Pages **não** suporta `_headers` → CSP + headers via **Cloudflare Transform Rules**, com fallback `<meta http-equiv>` no layout | 2026-10-19 | **R16** (verificado) | **Firmada** |
| D18 | Rotação de segredos (SEC-31) = **tarefa operacional bloqueante do cliente**, item de Fase 0 com checkbox | 2026-10-19 | **R17** | **Firmada** — checklist em `docs/SPEC-SECURITY.md` §3 |
| D19 | `public/CNAME` = `galastriadvocacia.com.br`, dentro do artefato do Pages | 2026-10-19 | **R18** | **Firmada** |
| D20 | Actions fixadas nos **5 SHAs** de commit; `pull_request` **não** é trigger; `permissions` mínimas; `persist-credentials: false` | 2026-10-19 | **R19** | **Firmada** — template em `docs/SPEC-SECURITY.md` §2.5 |
| D21 | `site.json.seo.perUrl` é a **fonte única de verdade** de `<title>`/`<meta description>`; só o post 30 tem valor aprovado — os demais são **rascunhos pendentes da advogada** (`"status": "draft"`) | 2026-10-19 | **R20** | **Firmada** |
| D22 | `_elementor_element_cache` (5 linhas) e `_elementor_conditions` (116 linhas) **existem** no dump | 2026-10-19 | **R2 / R3** | **Firmada** — o cache é o oráculo de paridade (T1.5, T6.2) |
| D23 | "recomeçar com repo privado" — **rejeitada** pelo EM | 2026-10-19 | **R15** | **Rejeitada** (motivo: decisão do owner; SEC-23…SEC-30 como gate) |
| D24 | `_headers` do GitHub Pages — **rejeitada** pelo EM | 2026-10-19 | **R16** | **Rejeitada** (motivo: GitHub confirmou "No ETA"; CSP via Cloudflare) |
| D25 | `/blog/<slug>/` para os posts e 57 páginas de tag — **rejeitadas** pelo EM | 2026-10-19 | **R4** | **Rejeitadas** (motivo: preserva backlinks; thin content nas tags) |
| D26 | Campo "assunto" no formulário e paleta do `theme_mods_kava` como canônica — **rejeitadas** pelo EM | 2026-10-19 | **R5 / R7** | **Rejeitadas** |

---

## 3. Arquivos criados até agora

Todos em `<LOCAL>/galastriadvocacia` (a raiz do git):

| Caminho | Conteúdo | Observação |
|---|---|---|
| `README.md` | Onboarding do projeto: stack, comandos, mapa de pastas, ponteiros para `docs/` | — |
| `docs/README.md` | Índice das specs | — |
| `docs/SPEC-DATA.md` | **SPEC-DATA** — modelo de dados, rotas, extração e asserts | movido de `docs/spec-data/README.md` |
| `docs/SPEC-SECURITY.md` | **SPEC-SECURITY** — threat model, SEC-23…SEC-64, CSP, LGPD | movido de `docs/spec-security/README.md` |
| `docs/SPEC-UI.md` | **SPEC-UI** — DOM, componentes, estados, a11y, tokens | movido de `docs/spec-ui/README.md` |
| `docs/PLAN.md` | **PLAN** — plano consolidado em 6 fases + DoD + riscos | movido de `docs/plan/README.md` |
| `docs/PROJECT-STATE.md` | **PROJECT-STATE** — este arquivo | movido de `docs/project-state/README.md` |
| `docs/_reference/extract-report.json` | Relatório da extração: contagens medidas, campos do formulário, avisos | commitado |
| `package.json` / `astro.config.mjs` / `tsconfig.json` / `.nvmrc` / `.env.example` / `.gitignore` | Scaffold do Astro 5 (`output: 'static'`, `trailingSlash: 'always'`) | — |
| `scripts/guard-secrets.mjs` + `scripts/lib/forbidden.mjs` | Guarda de segredos (SEC-30) e a lista única de padrões | roda no `prebuild` |
| `scripts/extract/**` | Pipeline de extração (SQL, WordPress, Elementor, Gutenberg, URLs, assets, fontes, CSS) | sem dependências externas |
| `scripts/css.mjs` | Consolidação do CSS + fontes self-hosted (Fase 2) | — |
| `src/data/elementor/*.json` | 7 templates normalizados (`home-30`, `header-49`, `footer-48`, `links-843`, `blog-archive-516`, `post-single-525`, `error-404-790`) | commitado |
| `src/content/blog/*.md` | 6 posts com o frontmatter de `SPEC-DATA.md` §3.2.2 | commitado |
| `src/pages/politica-*.md` | 3 políticas (R8) | commitado |
| `src/data/site.json` / `redirects.json` / `assets-manifest.json` | Configuração do site, redireções e closure de assets | commitado |
| `src/content.config.ts` | Schema Zod da collection `blog` (SPEC-DATA §3.2) | — |
| `src/lib/stylesheets.ts` | Ordem das folhas de estilo consolidadas | — |
| `src/pages/index.astro` / `src/layouts/PolicyLayout.astro` | as páginas reais (a home e o layout das políticas) | commitado |
| `tests/fixtures/elementor-cache-{30,48,49}.html` | Oráculo de paridade (R2) — HTML renderizado, verbatim | commitado |
| `public/wp-content/uploads/**` | **97** arquivos / **10 149 570** B (9,69 MB) — 42 mídias em `2024/12` + 36 CSS do Elementor + 19 ficheiros de `elementor/google-fonts` (16 woff2 + 3 CSS); `meta.cssFiles` = 39, `meta.fontFiles` = 16 | commitado (R1) |
| `public/css/*.css` | 16 folhas consolidadas + `fonts.css` | commitado |
| `public/fonts/**`, `public/webfonts/**` | Roboto/Montserrat baixados, Nunito/Questrial/Qwigley/Amsterdam locais, webfonts do Font Awesome 5 | commitado |
| `public/CNAME`, `public/robots.txt` | Domínio do Pages e robots real (SEC-56, SEC-59) | commitado |
| `docs/audit/comentarios-retidos.md` | Auditoria dos 48 comentários (contagens) | **não commitado** (`.gitignore`) |
| `docs/PARITY.md` | O registo da paridade visual: o método, as 10 secções e as **divergências aceites** | commitado |
| `docs/runbook-pages.md` | O que fazer se o repositório for renomeado, transferido ou eliminado (SEC-62) | commitado |
| `docs/rotation-gate.md` | O registo das **12 rotações** (a data, o responsável e o sha256 por linha) | commitado |
| `docs/security-decisions.md` | As excepções de segurança **aceites** (a advisory do `astro`, os digests de PII, o `script-src-attr`) | commitado |
| `docs/MIGRATION.md` | O registo histórico: o mapa de URLs antigo → novo, o que foi descartado e porquê | commitado |
| `docs/README.md` | O índice da documentação | commitado |
| `AGENTS.md` | O acordo de trabalho: os 4 invariantes, os comandos, as acções proibidas e a Definition of Done | commitado |

---

## 4. O que está pendente

### 4.1 Bloqueadores (impedem o go-live)

| # | Pendência | Responsável | Spec |
|---|---|---|---|
| **B1** | **Rotação de segredos** — 12 itens (MySQL, 8 salts WP, 4 OAuth Google, Elementor Connect, Safe Mode, tokens avulsos, 2FA, retenção do backup, decisão sobre o WP antigo) com evidência | **cliente** | `docs/SPEC-SECURITY.md` §3 |
| **B2** | Criar o repositório `devCarlosHenSil/galastriadvocacia` **público** e apontar o Pages — o `git init` já foi feito na pasta certa | developer | SEC-23 / T0.4 |
| **B2b** | **RESOLVIDO em 2026-10-19.** As specs de `docs/` citavam valores vivos do backup (e-mail administrativo, e-mails de usuários, hashes, salts, tokens OAuth, tokens de sessão) e PII de terceiros. Como o repositório é **público** (R15), foram **redigidas** — ver §9 e SEC-65/66/67. **Aplicado**: a SEC-65 está em `scripts/guard-secrets.mjs:50` — `SCAN_DIRS = ['src','public','scripts','tests','docs','.github']` — e o `docs/` é varrido com o **perfil de valores**. | developer | SEC-65 / SEC-66 / SEC-27 / SEC-26 |
| **B2c** | **`npm audit` reporta 1 vulnerabilidade crítica no `astro`** (afeta todas as versões ≤ 7.2.7; o conserto exige `astro@7`, o que contradiz a decisão D1 — Astro 5). Exceção documentada em `docs/security-decisions.md` | EM | SEC-49 |
| **B3** | Atualizar as **Políticas de Privacidade e de Cookies** com os blocos prontos e obter aprovação jurídica | cliente + advogado | `docs/SPEC-SECURITY.md` §5.2/§5.3 |
| **B4** | Aprovar o **copy de SEO** dos 6 posts, das 3 categorias, das 3 políticas, de `/blog/`, `/links/` e `/404` | advogada | `docs/SPEC-DATA.md` §3.4.6 |
| **B5** | Configurar o **painel do Formspree** (conta do cliente, "Restrict to Domain", reCAPTCHA, plano) e o **CTA de WhatsApp** permanente | developer + cliente | SEC-39/SEC-41 |
| **B6** | **DNS + Cloudflare**: A records do GitHub Pages, CNAME `www`, Transform Rules (CSP + headers), Redirect Rule 301 de `/home/`, TLS "Full (strict)" | developer | SEC-42/43/56/57 |
| **B7** | Decidir a **titularidade** das 4 contas (registro.br, Cloudflare, GitHub, Formspree) e ativar 2FA | cliente | `docs/SPEC-SECURITY.md` Q4 |
| **B8** | **RESOLVIDO em 2026-10-19.** As correções de conteúdo estão em `scripts/extract/lib/repairs.mjs` — **10 entradas**, registadas em `docs/_reference/extract-report.json → repairs` (o `mailto:contato@glastri…`, o `instragram.com`, o "epecialista", o 404, o "inínicio", o "preencha", o "Sálario-materinidade", o "Centro de Referência e Assistência Social" e o "prospero") | developer | SPEC-UI §6 |

### 4.2 Trabalho de código (do `developer`)

**Nenhum.** As Fases 1–6 estão implementadas e validadas (`npm run extract`, `extract:check`, `build`, `check-parity`, `check-links`, `check-contrast`, `check-dist`, `verify-csp`, `verify-workflow`, `guard`, `guard:self-test` verdes). As Fases 1–6 do `docs/PLAN.md` foram feitas pela ordem: extração (T1.1–T1.9) → assets/CSS/fontes (T2.1–T2.5) → renderer e páginas (T3.1–T3.15) → SEO/cookies/rotas (T4.1–T4.6) → deploy/CI (T5.1–T5.5) → verificação (T6.1–T6.7).

### 4.3 Decisões pendentes do owner

`docs/PLAN.md` §5 (Q1–Q8) e `docs/SPEC-DATA.md` §7 (Q1–Q6).

---

## 5. Specs deste projeto

| Spec | Caminho | Conteúdo |
|---|---|---|
| Dados | `docs/SPEC-DATA.md` | Modelo de origem e alvo, rotas, `site.json`, schema Zod, extração, **asserts §6.1–§6.7** |
| Segurança | `docs/SPEC-SECURITY.md` | Ameaças SEC-01…SEC-22, requisitos SEC-23…SEC-64, CSP, `.gitignore`, comandos de verificação, textos LGPD, **checklist de rotação** |
| UI/UX | `docs/SPEC-UI.md` | Contrato de DOM, inventário de widgets, estados de interação, tabelas responsivas, contraste medido, a11y, alt-text, tokens, **método de paridade visual** |
| Plano | `docs/PLAN.md` | 6 fases, tarefas ordenadas (T0.1–T6.7), Definition of Done, riscos, perguntas em aberto |
| Estado | `docs/PROJECT-STATE.md` | Este arquivo |

---

## 6. Gotchas e armadilhas conhecidas

1. **Nunca `git init` em `<BACKUP>`.** A pasta nova é *dentro* da pasta do backup; um `git init` no lugar errado publica o dump SQL e o `wp-config.php` (SEC-01). A raiz do git é ``<LOCAL>` (a pasta do repositório, dentro de `<BACKUP>`)`.
2. **O dump é `mysqldump --extended-insert` desativado** (1 linha por registro) → os ranges de linha **são** as contagens exatas. Não precisa de MySQL.
3. **Ordem de unescape no SQL:** `\n` e `\\` nessa ordem, senão o `post_content` sai corrompido.
4. **Fuso:** o frontmatter grava a data civil **local** (`America/Sao_Paulo`) e **todo** render de data usa `timeZone: 'UTC'` — senão a data aparece um dia antes.
5. **`srcset`/`sizes` precisam ser removidos juntos** — se um fica, aponta para thumbnail não publicado.
6. **Hífen em `-scaled` não é thumb** (regex `-(\d+)x(\d+)`), e o sufixo numérico do WordPress (`...-e1734733392829.png`) também não é thumb.
7. **`#quemsou` sem hífen** — o `_element_id` real; "corrigir" quebra o `scroll-offset` do `custom_css` (post 136).
8. **A ordem dos `<link>` de CSS importa** (cascata). `tokens.css` e `a11y.css` vão **por último**.
9. **Remover/renomear qualquer classe quebra o layout silenciosamente** — o CSS é por classe (`elementor-screen-only`, `e--pointer-double-line`, `elementor-icon-list--layout-traditional`, …).
10. **`Referrer-Policy: no-referrer` faria o Formspree marcar todo envio legítimo como spam** (SEC-40). Usar `strict-origin-when-cross-origin`.
11. **O free tier do Formspree é 50/mês e estoura em silêncio** — por isso o CTA de WhatsApp é permanente.
12. **O `post-30.css` local (92.994 B) e o arquivado (93.362 B) podem ter micro-divergências** — o teste estrutural A.1 detecta; não assumir equivalência.
13. **`data-e-type` só existe no Elementor 3.29+** → aparece no HTML novo e **não** no snapshot do Wayback. É drift esperado, não regressão.
14. **A raiz do repositório é ``<LOCAL>` (a pasta do repositório, dentro de `<BACKUP>`)`** — as specs desta rodada foram gravadas em `…\galastriadvocacia\docs\` e devem ser movidas para dentro da raiz do git antes do primeiro commit. → **RESOLVIDO** em 2026-10-19: as specs foram movidas para `docs/SPEC-*.md`, `docs/PLAN.md` e `docs/PROJECT-STATE.md`.
15. **`_elementor_data` de um post é um ARRAY de elementos de topo**, não um objeto. O `root` dos 7 JSONs é esse array (o `root` do SPEC-DATA §3.5.4 foi escrito assumindo um objeto).
16. **O `elementCount` real do post 30 é 63**, não 108. Os 9 templates de seção (759…784) **não** são somados: o conteúdo já está embutido na árvore do post 30.
17. **As revisões do WP têm `post_status='inherit'`, não `'revision'`** — o `post_type` é que vale. Por isso o split real de `_elementor_data` é **27 publicados + 578 revisões** (e não 22 + 583).
18. **`post_modified` ≠ `post_date` nos 6 posts e nas 3 políticas** (o dump é de 2026-03; a spec assume que são iguais). O frontmatter segue a spec (sem `updatedDate`) e a data civil do `post_date` local.
19. **O `post_excerpt` dos 6 posts NÃO está vazio** (a spec §3.2 diz que está) — o frontmatter usa a descrição da spec §3.2.2; o valor derivado e o excerpt estão no `docs/_reference/extract-report.json`.
20. **O `elementor/css/` do backup tem 36 arquivos, não 39** (a spec §3.5.7 diz 39). O `manifest.meta.cssFiles` = 39 porque inclui os 3 CSS das fontes locais.
21. **O `.gitignore` precisa ancorar `wp-content/`, `wp-admin/` e `wp-includes/` na raiz** (`/wp-content/`) — senão o `public/wp-content/` do site novo (R1) é ignorado junto com as pastas do backup.
22. **`docs/` não era varrido pelo `guard-secrets`** — até 2026-10-19 isso era intencional (as specs citavam os próprios padrões e valores vivos). **Redigido** em 2026-10-19 e a **SEC-65** passa a exigir `docs/` no escopo, com **perfil de valor** (nomes de opção podem aparecer; valores, não). Ver §9.
23. **A "segunda ação" do form do Elementor (`email_to_2`, `email_reply_to_2`) aponta para o e-mail administrativo do cliente** — essas chaves são removidas na normalização (R6).
24. **O Font Awesome 5 é necessário**: o DOM usa `fab`/`fas`/`far` (FA5), e o `font-awesome.min.css` do Elementor é o FA 4.7.0. Por isso existe `public/css/fontawesome5.css` + `public/webfonts/`.
25. **A CSS do Royal Elementor Addons (425 KB) e a do Header Footer Elementor (83 KB) não são necessárias**: as únicas classes `wpr-*` do DOM são marcadores inertes e o `.hfe-copyright-wrapper` é estilizado pelo `post-48.css`.

---

## 6.1 Divergências medidas entre as specs e o dump (2026-10-19)

| D1 | `home-30.json` com **108** elementos | **63** | Emitido 63; o 108 foi actualizado no `extract-report.json` |
| D2 | `_elementor_data`: 22 vivos + 583 revisões | **27 publicados + 578 revisões** (total 605) | Asserts ajustados para os valores medidos |
| D3 | `revision` = 662 (a confirmar) | **662** (`post_type='revision'`) | Confirmado — o número do briefing estava certo |
| D4 | `post_excerpt` vazio nos 6 posts | **preenchido** | O frontmatter segue a spec §3.2.2; o excerpt real está no relatório |
| D5 | `post_modified` = `post_date` nos 6 posts | **diferente** em todos | Frontmatter sem `updatedDate` (como na spec) |
| D6 | `post_date` do post 733 = `2024-12-26 15:14:47` | `2024-12-26 14:40:35` | Sem impacto (a data civil é a mesma) |
| D7 | `uploads/elementor/css/` com 39 arquivos | **36** | Os 36 foram copiados; `meta.cssFiles` = 39 (36 + 3 CSS de fontes) |
| D8 | 17 "faces" de fonte local | 17 ficheiros woff2, mas **86 `@font-face`** (Nunito tem 80 blocos) | Todos os blocos foram preservados |
| D9 | Placeholders do form = os da spec §3.4.5 | Os **originais** do dump ("Digite seu nome", …) | A spec §3.4.5 traz a copy **corrigida** (SPEC-UI §6.7) — ela é a canônica |
| D10 | `root` dos JSONs do Elementor é um objeto | É um **array** (10 elementos de topo no post 30) | `root` = array |
| D11 | `containerWidth: "1200px"` vem do `theme_mods_kava` | Não existe essa chave | Valor autorado da spec |
| D12 | `updatedDate` das políticas = `2024-12-20` | `post_modified` = `2024-12-26` | Mantido `2024-12-20` (é a data de vigência do corpo do texto) |

---

## 7. Roadmap

### 7.1 O que está **fora de escopo** (decidido, não é falta)

- Um **painel/editor** (CMS) — editar é mexer num ficheiro do repositório.
- **Pesquisa** no site.
- **Páginas de tag** (57 tags) — *thin content*.
- **Comentários** — o `comments[]` fica sempre `[]`.
- **Newsletter** — não havia inscrição a funcionar.
- **Optimização de imagens** (WebP/AVIF) — as mídias são verbatim; a paridade é o requisito.
- Um **job de pixel diff** no CI — o Playwright é opcional; o `npm run visual-diff` salta.
- **RSS**, **login**, **i18n** e **PWA**.

### 7.2 Próximos passos (por ordem)

| # | Passo | Quem |
|---|---|---|
| 1 | **Rotação dos 12 segredos** (`docs/rotation-gate.md`) — o gate tem de fechar linha a linha | cliente |
| 2 | **Repositório público** (`devCarlosHenSil/galastriadvocacia`) + a **variable** `PUBLIC_FORMSPREE_ENDPOINT` | deployer |
| 3 | **DNS** — o proxy da Cloudflare ligado, o `www` com o 301 para o apex (`docs/DEPLOY.md` §2–§3) | cliente |
| 4 | **Cloudflare** — as Transform Rules (a CSP e os 5 headers) e a Redirect Rule do `www` | cliente |
| 5 | **Formspree** — o id real do form e o "Restrict to Domain" | cliente |
| 6 | **Políticas aprovadas** pelo advogado (o texto anexado está marcado como pendente) | cliente + advogado |
| 7 | **SEO aprovado** — os `seoTitle`/`seoDescription` estão em `status: "draft"` | cliente |
| 8 | **Branch protection** em `main` e **2FA** nas contas (GitHub, Formspree, Cloudflare) | cliente |


## 8. Como este arquivo é mantido

- Atualizado pelo agente `docs` ao final de cada entrega que muda o estado (feature, decisão, procedimento de deploy, roadmap).
- **Nunca** reescrever do zero: preservar decisões e armadilhas acima.
- **Nunca** colocar segredos, tokens ou dados pessoais reais aqui.
- Formato: §1 estado · §2 decisões (data + origem) · §3 arquivos · §4 pendências (bloqueadores primeiro) · §5 links das specs · §6 gotchas · §7 roadmap · §8 manutenção · §9 redação de credenciais · §10 contagem do dump · §11 bugs de conteúdo herdados · §12 riscos em aberto.

---

## 9. Redação de credenciais (2026-10-19)

| Item | Registro |
|---|---|
| **Motivo** | O repositório-alvo é **público** (R15). As specs de `docs/` reproduziam **valores vivos** do backup (senha do MySQL, 8 salts WP, hashes de senha, tokens de sessão, segredos OAuth do Google, tokens do Elementor/WP-Vivid/Rank Math/Site Kit) e **PII de terceiros** (e-mails de usuários, de spammers e de um cliente real; IPs). Publicar as specs publicaria as credenciais — e, com salts + hash, forja-se um cookie `wordpress_logged_in_*` de **administrator**. |
| **Arquivos revisados** | `docs/SPEC-SECURITY.md` · `docs/SPEC-DATA.md` · `docs/SPEC-UI.md` · `docs/PLAN.md` · `docs/PROJECT-STATE.md` · `docs/README.md` · `README.md` |
| **Regra aplicada** | Todo segredo → `<REDACTED:o que é>` **+ origem** (`wp-config.php` L25-34, `wp_options` id 7044, dump L3210) **+ forma** (prefixo, comprimento, tipo). Todo e-mail/IP de terceiro → placeholder. Nomes de opção e de chave (`auth_key`, `client_secret`, `indexnow_api_key`, …) **permanecem** — são identificadores públicos e o checklist de rotação depende deles. O e-mail **administrativo do cliente** → `<email administrativo do cliente>` (SEC-27 o proíbe); o e-mail **público** `contato@galastriadvocacia.com.br` **permanece**. O nome público **"Ana Paula Galastri"** e o slug `ana-paula-galastri` **permanecem**. |
| **Comandos de verificação** | Deixaram de embutir o literal: o valor passa a ser **extraído em tempo de execução** do backup read-only (`<BACKUP>`, fora do repo) — 4 blocos na SEC-26 (wp-config, `wp_options`, hashes/sessões, nomes de opção) e 1 bloco na SEC-27 (e-mails extraídos do dump). O padrão da SEC-66 é montado em runtime para que a spec não se auto-case. |
| **Requisitos novos** | **SEC-65** (`docs/` no escopo do `guard-secrets`) · **SEC-66** (as specs são documentação, não cofre; padrão verificado = **0 linhas**) · **SEC-67** (redação verificada antes do 1º push + rotação de segredos como **gate duro**) |
| **Estado** | ✅ Redação aplicada às specs em 2026-10-19 · ✅ `scripts/guard-secrets.mjs` varre `docs/` com o **perfil de valor** (SEC-65) · ⬜ Rotação de segredos **pendente** (T0.1, ver §12 R-04) |

---

## 10. Contagem do dump (medida em 2026-10-19)

Fonte: `docs/_reference/extract-report.json` (gerado pelo extractor, commitado).

| Métrica | Valor medido | Regra de contagem |
|---|---:|---|
| `elementorData` (linhas de `wp_postmeta` com `_elementor_data`) | **605** | — |
| … em posts **publicados** | **27** | **"publicado" = toda linha de post que NÃO é `revision`** — as revisões do WP têm `post_status='inherit'`, não `'revision'`; quem vale é o `post_type` |
| … em **revisões** | **578** | `post_type = 'revision'` |
| `revision` (posts) | **662** | `wp_posts.post_type = 'revision'` — **confirmado** |
| Relações tag→post dos 6 posts | **60** | 6 posts × 10 tags — a spec dizia 66 (errata, §6.1 D13) |
| Relações categoria→post dos 6 posts | **6** | 1 por post (o `post_count` de cada uma das 3 categorias é 2) |
| `home-30.json` → `meta.elementCount` | **63** | contagem recursiva de nós da árvore do **post 30** |
| `header-49.json` | **4** | idem, template 49 |
| `footer-48.json` | **19** | idem, template 48 |
| `links-843.json` | **9** | idem |
| `blog-archive-516.json` | **6** | idem |
| `post-single-525.json` | **16** | idem |
| `error-404-790.json` | **12** | idem |
| `uploads/elementor/css/` | **36** arquivos | o `manifest.meta.cssFiles` = **39** porque inclui os **3** CSS das fontes locais |
| Closure de assets | **97** arquivos / **10 149 570** B (**9,69 MB**) | `meta.totalFiles` / `meta.totalBytes` |
| Widget de formulário `3273196` | **4** campos | `name`, `email`, `field_d252ca6`, `message` — **não** existe campo "assunto" |

> **Por que o `108` original estava errado:** vinha do *briefing* e nunca foi verificado byte-a-byte (a linha do dump tem >100 KB). O valor real é **63** e já está no `extract-report.json`.
> **Nota de escopo (SPEC-UI §1.3):** o inventário do DOM da **página inteira** do SPEC-UI tem 86 nós (25 containers + 61 widgets) = header 4 + corpo 63 + footer 19. O `elementCount` de 63 é **só o corpo do post 30**.
> **`root` é um ARRAY** de elementos de topo (10 no post 30), não um objeto — corrigido em SPEC-DATA §3.5.4.

---

## 11. Bugs de conteúdo herdados do dump

Defeitos reais no conteúdo de **origem**. O `developer` está corrigindo-os **na fonte da extração** (não no `src/` gerado), para que não voltem a cada `npm run extract`.

| # | Onde | Defeito | Correção |
|---|---|---|---|
| 1 | Política de Uso de IA (post 85) | `mailto:contato@glastriadvocacia.com.br` — **typo** "glastri" (falta o "a") | `mailto:contato@galastriadvocacia.com.br` |
| 2 | Widgets de redes sociais do template `post-single-525` **e** do `error-404-790` | `https://instragram.com/...` — **typo** "instragram" | `https://www.instagram.com/galastriadvocacia/` (URL canônica de `site.json → socials.instagram`) |
| 3 | Seção "Nossa Equipe" (template 775) | "…equipe profissional e **epecialista** no que faz" | "…equipe profissional e **especialista** no que faz" (SPEC-UI §6.3) |
| 4 | `wp_posts.post_excerpt` dos 6 posts | a spec §3.2 assumia **excerpt vazio**; no dump ele está **preenchido** | O frontmatter segue a descrição de SPEC-DATA §3.2.2 (canônica); o valor derivado e o excerpt real ficam no `extract-report.json` |
| 5 | `wp_posts.post_modified` | **≠** `post_date` nos **6 posts** e nas **3 políticas** (o dump é de 2026-03) | Frontmatter sem `updatedDate` (decisão de conteúdo); as políticas mantêm `updatedDate: 2024-12-20` (data de vigência do corpo) |
| 6 | `post_date` do post **733** (`salario-maternidade`) | a spec registrava `2024-12-26 15:14:47`; o dump tem **`2024-12-26 14:40:35`** | Data civil inalterada (`2024-12-26`) → sem impacto no frontmatter |
| 7 | `theme_mods_kava` | a chave **`containerWidth` não existe** nessa opção | `site.json → theme.containerWidth` = `1200px` é **autorado** pela spec (SPEC-DATA §3.4.4) |
| 8 | Widget de formulário `3273196` | a **segunda ação** (`email_to_2` / `email_reply_to_2`) aponta para o e-mail administrativo do cliente | **Removida** na normalização (R6) — o formulário tem **1** destino: `contato@galastriadvocacia.com.br` |

> Os itens 1, 2 e 3 são typos **publicados hoje** no site WordPress (que está offline). Corrigir na fonte é o que impede que voltem na próxima execução do extractor.

---

## 12. Riscos em aberto

| # | Risco | Estado | Mitigação / dono |
|---|---|---|---|
| **R-01** | **Advisory crítica do `astro`** — `npm audit` reporta vulnerabilidade critical que afeta **todas** as versões ≤ 7.2.7; o conserto exige `astro@7`, que contradiz a decisão **D1** (Astro 5). | **Exceção documentada** em `docs/security-decisions.md` | `overrides` em `esbuild` e `sharp`; reavaliar a cada release do Astro. **Dono:** EM. Não bloqueia o go-live, mas é dívida técnica assumida. |
| **R-02** | **Redação de `docs/`** — as specs republicavam credenciais vivas do backup. | ✅ **Redigido** em 2026-10-19 (SEC-65/66/67, §9) | ✅ `docs/` no escopo do `guard-secrets.mjs` com o **perfil de valor**; o bloco de redação da SEC-66 devolve **0 linhas**. **Dono:** developer. |
| **R-03** | **Repositório público** — `devCarlosHenSil/galastriadvocacia` é público (R15). | **Firmado** (D3) | SEC-23…SEC-30 são **gate de publicação**, não recomendação; `scripts/guard-secrets.mjs` é obrigatório no `prebuild` **e** no CI. Recomendação estrutural que permanece: mover para uma **organização do cliente** com 2FA + branch protection (SEC-61/SEC-62). **Dono:** EM + cliente. |
| **R-04** | **Rotação de segredos ainda pendente** — as **12** rotações de `docs/SPEC-SECURITY.md` §3 são tarefa **operacional do cliente** (MySQL, 8 salts WP, 4 OAuth Google, Elementor Connect, Safe Mode, tokens avulsos, 2FA, retenção do backup, decisão sobre o WP antigo). | ⬜ **PENDENTE — gate de go-live (T0.1)** | O `deployer` **não publica** enquanto qualquer uma das 12 estiver pendente (SEC-67). Publicar antes = publicar as credenciais. **Dono:** cliente. |
| **R-05** | **Formspree free tier = 50 submissões/mês** — o estouro de cota faz o formulário **parar de funcionar sem erro visível** (perda de leads, o ativo mais caro do site). | ⚠️ Mitigado | **CTA permanente de WhatsApp** ao lado do formulário (R14 / SEC-41) + plano Personal (≈US$ 10/mês) definido **antes** de 50/mês + 1 envio de teste por semana no máximo + alerta mensal no painel. **Dono:** cliente (monitora) + developer (CTA). |

---

## 13. FIX PASS A (2026-10-19) — segurança, dados e SEO

As quatro revisões (QA, security, uiux, dba) devolveram achados. Esta secção
regista o que foi **corrigido** e o que **ficou por corrigir** (a UI/UX é a
FIX PASS B).

### 13.1 Decisões

| # | Decisão | Data | Origem | Estado |
|---|---|---|---|---|
| **D27** | **A lista canónica dos padrões passou a guardar os digests SHA-256 dos valores vivos**, e não os valores. O ficheiro `scripts/lib/forbidden.mjs` tem duas camadas: as **formas** (regexes, publicadas) e os **digests** (irreversíveis). O perfil de `docs/` é **derivado** do perfil completo pelo `scope` de cada entrada (`value` / `name`), por isso não pode divergir. | 2026-10-19 | SEC-R-01 | **Firmada** |
| **D28** | **O contentor do GTM deixou de estar no `<head>`**: passa a ser injetado por `public/js/cookie-consent.js` depois de `gtag('consent','update',…)` e só com consentimento. O `<head>` só tem o `gtag('consent','default', …'denied')`. | 2026-10-19 | SEC-R-03 | **Firmada** — o cliente tem de **tirar a tag do AdSense do contentor do GTM** (E2 de `docs/security-decisions.md`) |
| **D29** | **A CSP passou a incluir os hosts da reCAPTCHA** (`www.gstatic.com`, `www.google.com`, `www.googletagservices.com`) e `'self'` no `frame-src`. A string vive em `src/lib/csp.ts` e é **derivada** para a versão do `<meta>`; `npm run verify-csp` compara-a com a do runbook. | 2026-10-19 | SEC-R-05 | **Firmada** |
| **D30** | **O build falha sem `PUBLIC_FORMSPREE_ENDPOINT`** (e se o valor não tiver a forma `https://formspree.io/f/<ID>`). O aviso que publicava o nome da variável no HTML foi removido. | 2026-10-19 | SEC-R-09 | **Firmada** — a variável é pública (o id do form), vive no repositório como **variable** |
| **D31** | **O job de build do CI só tem `contents: read`**; `pages: write` e `id-token: write` ficam no job de deploy, com `timeout-minutes: 15`. | 2026-10-19 | SEC-R-07 | **Firmada** |
| **D32** | **A exceção do `npm audit` é fixada pelo ID do advisory** (os 10 GHSA do `astro`), e não pelo pacote. `scripts/check-audit.mjs` falha com qualquer advisory novo. | 2026-10-19 | SEC-R-11 | **Firmada** |
| **D33** | **A rotação dos segredos passou de prosa a gate**: `docs/rotation-gate.md` (12 linhas com `☐`/`☑`, data, responsável e o sha256 da captura) + `npm run gate:rotation`, que corre **no job de deploy** (bloqueia a publicação, não o desenvolvimento). | 2026-10-19 | SEC-R-07 | **Firmada** — ⬜ 12/12 ainda **pendentes** (o cliente) |
| **D34** | **O `dateModified` do JSON-LD passou a ser o real**: o frontmatter dos 6 posts emite o `updatedDate` (o `post_modified` do dump). A SPEC-DATA §3.2 foi corrigida. | 2026-10-19 | DATA-R-07 | **Firmada** — a data é civil local, renderizada em `timeZone: 'UTC'` |
| **D35** | **A 404 passou a ser `noindex, follow` e sem canonical** (`seo.perUrl["/404"]`), e o sitemap deixou de listar `/home/` e `/404`. | 2026-10-19 | QA-5, QA-6 | **Firmada** |

### 13.2 Correções de dados

| # | O que | Onde |
|---|---|---|
| 1 | As **duas políticas da LGPD** (privacidade e cookies) receberam o **overlay autoral** de `docs/SPEC-SECURITY.md` §5.2/§5.3/§5.4: natureza estática, ausência de comentários, formulário processado pelo Formspree (EUA), transferência internacional (art. 33 + Res. 19/2024), prazos de retenção, encarregado (DPO) e o prazo de 15 dias (art. 19 §3º), categorias de cookies, revogação e registo do consentimento. A data de vigência passou a **19/10/2026**. O texto fica **marcado** como pendente de aprovação do advogado. | `scripts/extract/lib/authored.mjs` → `POLICY_OVERLAYS` |
| 2 | A **contagem das relações das tags** dos 6 posts é **60** (6 × 10) — a spec dizia 66. | SPEC-DATA §2.4 e §6.1 |
| 3 | Os **slugs das tags** do post 733 usam **hifens** (`salario-maternidade`), não sublinhados. | SPEC-DATA §2.4 |
| 4 | O **slug do post 610** é `guarda-compartilhada` (a spec dizia `guarda-comportilhada`). | SPEC-DATA §2.1 |
| 5 | O §2.1 da SPEC-DATA lista **12** sobreviventes (a spec dizia 11). | SPEC-DATA §2.1 |
| 6 | O **link morto** `/servicos/` do rodapé e a **âncora errada** `#sobre` em "Áreas de Atuação" foram corrigidos **na fonte** (`repairs.mjs`). | `scripts/extract/lib/repairs.mjs` |
| 7 | A divergência dos **nomes dos campos do formulário** (autorais vs do dump) ficou registada no relatório. | `docs/_reference/extract-report.json` → `formFields` |
| 8 | As **reparações aplicadas** ficaram registadas no relatório. | `docs/_reference/extract-report.json` → `repairs` |

### 13.3 Por corrigir (nesta passagem)

| # | Porquê |
|---|---|
| A **UI/UX** — foi tratada na **FIX PASS B** (§14). |
| A **rotação dos 12 segredos** — é tarefa do cliente (D33). |
| O **upgrade do `astro` para a v7** — continua a ser uma decisão de escopo (D1). |
| O **pixel diff** — o Playwright não está instalado (é opcional; o aviso é o resultado). |
| O **Lighthouse** — não está instalado; a **configuração** existe (`.lighthouserc.json`, com as 6 rotas principais e os limiares), mas a **medição continua pendente** de um navegador. |

## 14. FIX PASS B (2026-10-19) — UI/UX

A revisão de UI/UX devolveu **4 achados críticos** e **7 altos**; vários
partiam a navegação no telemóvel. Todos foram corrigidos, **na fonte** quando
o defeito nascia na extração. Nenhum achado de segurança, dados ou SEO (FIX
PASS A) foi desfeito.

### 14.1 Decisões

| # | Decisão | Data | Origem | Estado |
|---|---|---|---|---|
| **D36** | O `.site` do tema Kava tem `overflow: hidden` (copiado **verbatim**, R1): o antepassado tornava-se um contentor de scroll e o `position: sticky` do header ficava preso a um scrollport que nunca rola. A correção está **na sobreposição** (`a11y.css`): `overflow: clip` (que não cria contentor de scroll) com o fallback `@supports not (overflow: clip)`. | 2026-10-19 | U1 | **Firmada** |
| **D37** | A altura do header **não é fixada por breakpoint**: é medida em runtime e publicada em `--header-height` (`public/js/header-height.js`), e os `scroll-margin-top` passaram a `calc(var(--header-height) + 16px)` (o token é o fallback sem JavaScript). Sem navegador não há medição de pixel — a medição em runtime é a solução que cobre 1440/1024/390 **e** qualquer outra largura. | 2026-10-19 | U1 | **Firmada** |
| **D38** | O painel do menu móvel abre com a classe **`elementor-active` no `<button>`** (é a regra do Elementor Pro: `.elementor-nav-menu--toggle .elementor-menu-toggle.elementor-active + .elementor-nav-menu__container`). A classe `elementor-nav-menu--dropdown-open` que o JS alternava **não existe em nenhum CSS**. | 2026-10-19 | U2 | **Firmada** |
| **D39** | Os dois ícones do toggle têm as classes `elementor-menu-toggle__icon--open` / `--close` (a regra do CSS é `.elementor-menu-toggle.elementor-active .elementor-menu-toggle__icon--open{display:none}`) e o `<button>` tem uma regra própria — o `post-49.css` estiliza `div.elementor-menu-toggle`, que não existe no site. | 2026-10-19 | U3 | **Firmada** |
| **D40** | O painel fechado tem **`inert`** (não só `aria-hidden`) e os seus links **não** têm `tabindex="-1"` fixo: o `inert` é o que os tira da ordem de tabulação (axe `aria-hidden-focus`). | 2026-10-19 | U10 | **Firmada** |
| **D41** | **A6/A7/A24 corrigidos por id de elemento**, sem tocar em `--e-global-color-text` (R7): a descrição dos icon-boxes sobre o cartão escuro passa a `--color-text-on-dark` (#B5B5B5 = 6.62:1) e sobre o cartão claro a `--color-text` (#6E6E6E = 5.10:1); a biografia do "Sobre" passa a #B5B5B5 (6.62:1). | 2026-10-19 | U4 | **Firmada** |
| **D42** | O **erro** do formulário usa `--color-danger` (#C1121F, 6.22:1) com `border-left: 4px`; o erro **por campo** (sobre o bloco escuro) usa um tom claro (12.24:1) com `border-left: 3px solid #E23B48` — o `--color-danger-text` é um tom de borda/ícone, não de texto. | 2026-10-19 | U5 | **Firmada** |
| **D43** | A lista das **superfícies escuras** (o hover do link genérico) foi ampliada para as 5 secções que faltavam: `7dffe5f` (Sobre), `845bcff` (Áreas), `dd1df9b` (Serviços), `e2b2a60` (Equipa) e `a69d5f8` (Contato). Sem isso, o hover dos 18 títulos dos icon-boxes caía em #8A6132 sobre fundo escuro (2.48:1). | 2026-10-19 | U7 | **Firmada** |
| **D44** | O **logo do rodapé** é resolvido **pelo attachment** (id 22 → `…-e1734737534272.png`, 327×299) e não pela string do URL — o URL guardado nas `settings` apontava para o original **sem o corte** (500×500). O `alt` é "Galastri Advocacia" e o `href` é `/`. | 2026-10-19 | U8 | **Firmada** |
| **D45** | O `_animation` é mapeado para a classe que o CSS usa (`elementor-animation-<nome>`), **excepto** `fadeIn` (esta versão do Elementor define-a pelo nome cru). O `grow` é uma **transição**: o `prefers-reduced-motion` também lhe tira a `transform` e a `transition`. | 2026-10-19 | U11, U16 | **Firmada** |
| **D46** | O alias `/home/` **perde o fragmento** (responde 200 com um meta-refresh para `/`): todas as árvores do Elementor e os corpos markdown são reescritos (`/home/#x` → `/#x`, `/home/` → `/`) e o extrator **afirma** que nenhuma saída contém `/home/` (exceto o `redirects.json`, que é a origem do 301). | 2026-10-19 | U17 | **Firmada** |
| **D47** | As **políticas** só usam `h2` (o `h4` do WordPress e o `h3` do título repetido descem). A demoção acontece **depois** do overlay da LGPD — o texto acrescentado também traz `<h4>`. O extrator afirma que não fica nenhum título de nível ≥ 3. | 2026-10-19 | U19 | **Firmada** |
| **D48** | O "Additional CSS" (post 136) migrou **só o efeito** (a centragem e o `nowrap` dos icon-boxes) com a correção documentada `@media (max-width:1366px){.elementor-icon-box-title{white-space:normal}}`; o `font-size` desse post continua **morto** (a especificidade do `post-30.css` é maior) e não foi migrado. | 2026-10-19 | U22 | **Firmada** |
| **D49** | O `custom-frontend.min.css` saiu do glob do `elementor-widgets.css` (já estava no `elementor-core.css`): 118 KB duplicados. | 2026-10-19 | U20 | **Firmada** |
| **D50** | A grade das **"Áreas" tem 4 colunas** (não 3): medido no `post-30.css` verbatim (`repeat(4, 1fr)` × `repeat(1, 1fr)`) e nos `settings` (`grid_columns_grid.size = 4`); 2 dos 6 icon-boxes têm `hidden-desktop` → 4 visíveis. A SPEC-UI §3.2 e o critério C3 foram corrigidos e o `npm run check-parity` **afirma** que o CSS construído e os `settings` concordam. | 2026-10-19 | U23 | **Firmada** |
| **D51** | O `check-parity` passou a comparar a **lista de classes de cada elemento** (o que carrega `e-flex`/`e-grid`, `e-con-boxed`/`e-con-full`, `elementor-hidden-*`, `animated-slow`) e a confrontar os **widgets dinâmicos** (o menu e a grelha do blog, que o cache do Elementor substitui por placeholders) com as fixtures douradas `tests/fixtures/nav-menu.html` e `tests/fixtures/upk-grid.html`. As 4 exclusões documentadas são **impressas** com o motivo. | 2026-10-19 | U25 | **Firmada** |
| **D52** | O `npm run check-contrast` **recalcula** a tabela A1…A25 a partir do CSS construído — a cascata pela **ordem das folhas** e o `!important` (a especificidade **não** é calculada) e as custom properties. **21** casos são automáticos; **3** (A20, A21, A23) são medidos à mão (o fundo é um gradiente, que nenhum seletor exprime) e **1** (A19) só se mede por captura de ecrã. | 2026-10-19 | U4 | **Firmada** |

### 14.2 Correções por achado

| Achado | Onde foi corrigido |
|---|---|
| **U1** header não colado | `scripts/extract/lib/css.mjs` → `A11Y_CSS` (`.site{overflow:clip}` + `@supports`) e `public/js/header-height.js` |
| **U2** menu móvel não abre | `public/js/nav-toggle.js` (a classe `elementor-active`) |
| **U3** os dois ícones | `src/components/elementor/widgets/NavMenu.astro` + `A11Y_CSS` (`button.elementor-menu-toggle`) |
| **U4** A6/A7/A24 | `A11Y_CSS` (regras por id) |
| **U5** A14 e o erro por campo | `A11Y_CSS` |
| **U6** A22 (o ícone social no hover) | `A11Y_CSS` (`fill` + `!important`) |
| **U7** A17 (o hover nas secções escuras) | `A11Y_CSS` |
| **U8** o logo do rodapé | `scripts/extract/lib/elementor.mjs` (o attachment) + `scripts/extract/lib/authored.mjs` (`IMAGE_ALT_REPAIRS`) |
| **U9** o skip-link | `src/layouts/BaseLayout.astro` (`#conteudo`) |
| **U10** o menu por teclado | `NavMenu.astro` + `nav-toggle.js` (`inert`) |
| **U11** o `grow` com movimento reduzido | `A11Y_CSS` (`@media (prefers-reduced-motion: reduce)`) |
| **U12** o botão "Ver mais notícias" | `A11Y_CSS` (a exclusão de `011caa0`) |
| **U13** o botão de pausa do carrossel | `A11Y_CSS` (`.swiper-toggle`) |
| **U14** o `alert()` do mapa | `public/js/map.js` (mensagem em linha com `role="status"`) |
| **U15** as mensagens e o `minlength` | `src/components/elementor/widgets/Form.astro` (`data-error`) + `public/js/form.js` |
| **U16** a animação `pulse` | `public/js/elementor-animations.js` |
| **U17** o alias `/home/` | `scripts/extract/lib/urls.mjs` + o assert em `scripts/extract/index.mjs` |
| **U18** a página invisível sem JS | `src/layouts/BaseLayout.astro` (o `<noscript>`) |
| **U19** as políticas | `scripts/extract/lib/overlay.mjs` (a demoção) + `A11Y_CSS` (o bloco `.policy*`) |
| **U20** o CSS duplicado | `scripts/extract/lib/css.mjs` (o `exclude` do glob) |
| **U21** os alt, o copyright e o icon-box sem link | `authored.mjs` (`IMAGE_ALT_REPAIRS`), `Copyright.astro`, `IconBox.astro` |
| **U22** o "Additional CSS" | `A11Y_CSS` |
| **U23** as colunas da grelha | `docs/SPEC-UI.md` (§0 C3 e §3.2) + `scripts/check-parity.mjs` (o assert) |
| **U24** o `icon-list` do rodapé | `A11Y_CSS` (`display: flex`, como no CSS original) |
| **U25** a comparação das classes | `scripts/check-parity.mjs` + `scripts/update-parity-fixtures.mjs` |

### 14.3 Não verificado (sem navegador)

| # | Porquê |
|---|---|
| O **pixel diff** e o **axe** — o Playwright não está instalado (é opcional). |
| A **altura real** do header em 1440/1024/390 — não há navegador; a medição em runtime (D37) resolve o problema em qualquer largura. |
| O **Lighthouse** — não está instalado. |
| A tabela de contraste tem **24 das 25 linhas** medidas (A19 depende da fotografia — só se mede por captura de ecrã). |

## 15. FIX PASS C (2026-10-19) — a rodada final

Quatro revisões (QA, segurança, UI/UX, dba) voltaram a achados; a lista
**deduplicada** tinha 20 itens (C1…C20). Todos foram tratados.

### 15.1 Decisões

| # | Decisão | Data | Origem | Estado |
|---|---|---|---|---|
| **D53** | O painel do menu móvel tem o **seu próprio `id`** (`nav-menu-2-{id}`) e o `aria-controls` do toggle aponta para **ele** (e não para o `<ul>`): o `inert` era removido do elemento errado e **todos** os links do menu ficavam inertes — a única via de navegação no telemóvel estava morta. | 2026-10-19 | C1 | **Firmada** |
| **D54** | O job de **publicação** tem `actions/checkout` (`persist-credentials: false`) e `contents: read`: sem o código no working directory, o gate da rotação falhava com "file not found" e **o site nunca era publicado** — o gate bloqueava pelo motivo errado (e um gate duro que falha sempre é um gate que se apaga). | 2026-10-19 | C2 | **Firmada** |
| **D55** | Os digest dos valores vivos têm **dois níveis**: `HIGH_ENTROPY_DIGESTS` (as credenciais — a senha da base de dados, os 8 salts, os tokens OAuth, as chaves de API) **no repositório**, e `PII_DIGESTS` (os IPv4 e os e-mails pessoais) num ficheiro **local e git-ignored** (`scripts/private/pii-digests.json`). Um digest de um valor de baixa entropia é um **oráculo de confirmação por força bruta** (SEC-R-26). A extração dos candidatos passou a ser **independente do conjunto de caracteres** (janela deslizante): um salt com pontuação é apanhado tal e qual. | 2026-10-19 | C3 | **Firmada** — E3 em `docs/security-decisions.md` |
| **D56** | A aplicação do overlay das políticas é **estrita**: cada `replacement` e cada `section` autoral tem de casar com o texto do dump — se não casar, **o build falha** em vez de publicar o texto original sem correção. | 2026-10-19 | C13 | **Firmada** |
| **D57** | As políticas têm **numeração sequencial e única** (a Privacy tem 17 secções, as Cookies 8, a de IA 6) e **uma única vigência** (o frontmatter, o corpo e o `dateModified` do JSON-LD são `2026-10-19`). | 2026-10-19 | C8 | **Firmada** — o texto publicado **precisa da aprovação do advogado** |
| **D58** | O sanitizador é **de tempo de build** (sem dependências): uma lista de permissões sobre o HTML do site (`settings.html`, `settings.editor`, os posts e as políticas) e um **assert** que nenhum ficheiro emitido pode conter `on…=`, `javascript:`, `<script` ou `<iframe>`. A CSP permite `'unsafe-inline'`, por isso o HTML tem de estar limpo **antes** de chegar à página. | 2026-10-19 | C6 | **Firmada** |
| **D59** | O `check-contrast` passou a ter uma **linha nova** (A25, o hover dos "Serviços") e uma **verificação explícita** de que a secção `dd1df9b` (fundo branco) **não** está na lista das superfícies escuras. | 2026-10-19 | C7 | **Firmada** |
| **D60** | O limite do `white-space: nowrap` foi **invertido**: a grelha dos "Serviços" tem 4 colunas (~285 px) **acima** de 1367 px e 3 (~380 px) abaixo — é em cima que o título longo transborda. | 2026-10-19 | C18 | **Firmada** |
| **D61** | O CI corre agora **todas** as verificações que leem o `dist/`: `verify-workflow` → `npm ci` → `audit` → `guard` → `build` → `verify-csp` → `check-parity` → `check-links` → `check-contrast` → `guard:self-test` → upload. | 2026-10-19 | C16 | **Firmada** |
| **D62** | O runbook tem **uma** configuração de DNS (o proxy da Cloudflare **ligado**, porque é ele que aplica as Transform Rules) e uma **Redirect Rule 301 do `www` para o apex** como **primeira** regra: com `Referrer-Policy: strict-origin-when-cross-origin`, o `Referer` de `www.…` é um host diferente do "Restrict to Domain" e **todas** as submissões legítimas seriam marcadas como spam. A verificação do go-live é **bloqueante**. | 2026-10-19 | C9, C10 | **Firmada** — tarefa do cliente (DNS + regras) |
| **D63** | As políticas passam a corresponder à implementação: 3 categorias reais (Necessários / Analíticos / Publicidade), `localStorage` em vez de "cookie próprio", a **versão** no registo do consentimento, o **Cloudflare** e o **GitHub Pages** na tabela de terceiros, a finalidade da newsletter declarada não aplicável e a Política de IA alinhada com a de Privacidade. | 2026-10-19 | C11, C12 | **Firmada** — o texto publicado **precisa da aprovação do advogado** |

### 15.2 O que mudou no texto publicado (precisa da aprovação do advogado)

| # | Onde | O que |
|---|---|---|
| 1 | Política de Privacidade §1 | "coleção de dados de navegação" reescrita (o site é estático); o "cookie próprio" passa a **armazenamento local (`localStorage`)**. |
| 2 | Política de Privacidade §2 | a finalidade "enviar atualizações, artigos…" (a newsletter que não existe) passa a **"não aplicável"**. |
| 3 | Política de Privacidade §6 | o texto do anexo reescrito com a terminologia do `localStorage`. |
| 4 | Política de Cookies §2 | as 4 categorias que não existem são substituídas pelas **3 reais**. |
| 5 | Política de Cookies §3 | a tabela de terceiros inclui **Cloudflare** e **GitHub Pages** (com a nota da transferência internacional). |
| 6 | Política de IA §1 | a "análise de dados" passa a **não aplicável** (alinhada com a Política de Privacidade). |
| 7 | Política de IA §2 | a confidencialidade remete para a Política de Privacidade. |

> Todo o texto acrescentado continua **marcado** com o comentário
> "PENDENTE DE APROVAÇÃO DO ADVOGADO" (o marcador no início do anexo).

### 15.3 Por corrigir (nesta passagem)

| # | Porquê |
|---|---|
| A **rotação dos 12 segredos** — é tarefa do cliente (D33/E4). |
| O **upgrade do `astro`** para a v7 — continua a ser uma decisão de escopo (D1). |
| O **pixel diff**, o **axe** e o **Lighthouse** — o Playwright não está instalado (é opcional). |
| O **`scripts/private/pii-digests.json`** não é versionado (por desenho, D55): num fork público tem de ser gerado de novo a partir do backup. |

## 16. FIX PASS D (2026-10-19) — a última rodada

Quatro revisões (QA, segurança, UI/UX, dba) voltaram a achados; a lista
deduplicada tinha 22 itens (D1…D22). Todos foram tratados.

### 16.1 Decisões

| # | Decisão | Data | Origem | Estado |
|---|---|---|---|---|
| **D64** | **O repositório é público: nenhum caminho absoluto da máquina fica nele.** O backup é resolvido a partir da **pasta pai** do repositório (ou da variável `GALASTRI_BACKUP`) — não há literal no código. | 2026-10-19 | D1, D2 | **Firmada** |
| **D65** | A guarda varre **`.github/`** (é onde se cola um PAT) e as regras de conteúdo chegam a `public/`, `docs/`, `tests/` e `scripts/`. O ficheiro do workflow tem uma **excepção estreita** (os 5 SHA fixados, escritos no próprio padrão) em vez de uma excepção do ficheiro inteiro. | 2026-10-19 | D3, D16 | **Firmada** |
| **D66** | Os digest têm **dois níveis** (as credenciais no repositório, os dados pessoais num ficheiro local) e **dois mecanismos**: a **janela deslizante** para as credenciais (com o **pré-filtro de prefixo** — sem ele a guarda demorava minutos) e as **formas** (e-mail, IPv4, telefone) para os dados pessoais. O `npm run guard:pii-digests` **gera** o ficheiro local. | 2026-10-19 | D4 | **Firmada** — E3 em `docs/security-decisions.md` |
| **D67** | O `javascript:` é testado **depois da normalização** (as entidades e os caracteres de controlo são descodificados, como o navegador faz). | 2026-10-19 | D5 | **Firmada** |
| **D68** | O sanitizador **mantém os títulos** (`h1`…`h6`, `pre`, `button`, `label`, `time`, `mark`, `small`) e a extração **afirma** que a sequência dos níveis não mudou. | 2026-10-19 | D6 | **Firmada** |
| **D69** | O gate da rotação exige **os quatro campos** (a marca ☑, a data, o responsável e o sha256 da captura) — uma marca sem evidência não é uma rotação. | 2026-10-19 | D7 | **Firmada** |
| **D70** | As sondas do auto-teste são **git-ignored globalmente** e a guarda **falha** se alguma ficar na árvore (contêm os valores vivos). | 2026-10-19 | D8 | **Firmada** |
| **D71** | O **dist/** é verificado (`npm run check-dist`): sem `javascript:`, sem `on…=`, sem as etiquetas perigosas (`iframe`, `object`, `embed`, `srcdoc`), sem `<script>` não autorizado, sem o placeholder do Formspree e com a **ordem das etiquetas** certa. | 2026-10-19 | D9, D15 | **Firmada** |
| **D72** | O `actions/configure-pages` passou para o **job de publicação** (precisa de `pages: read`; no job de build devolvia 403 e **nada era publicado**). | 2026-10-19 | D10 | **Firmada** |
| **D73** | O CI corre **todas** as verificações (incluindo `check-dist` e o auto-teste da guarda) antes de carregar o artefacto. | 2026-10-19 | C16 | **Firmada** |
| **D74** | O consentimento é **repedido** quando a versão das políticas muda. | 2026-10-19 | D12 | **Firmada** |
| **D75** | A CSP ganhou **`script-src-attr 'none'`** (o site não tem handlers em linha). | 2026-10-19 | D20 | **Firmada** — E5 em `docs/security-decisions.md` |

### 16.2 Correções por achado

| Achado | Onde |
|---|---|
| **D1/D2** | `docs/*.md`, `README.md`, `scripts/guard-self-test.mjs`, `scripts/extract/index.mjs` — os caminhos são `<LOCAL>` e `<BACKUP>` |
| **D3/D16** | `scripts/guard-secrets.mjs` (os `.github`, os padrões de conteúdo em todas as pastas), `scripts/lib/forbidden.mjs` (a excepção dos SHA fixados) |
| **D4** | `scripts/lib/forbidden.mjs` (a tabela das credenciais com as chaves de prefixo), `scripts/lib/backup-values.mjs` (novo), `scripts/generate-pii-digests.mjs` (novo), `scripts/guard-self-test.mjs` (a cobertura) |
| **D5** | `scripts/lib/forbidden.mjs` (`normaliseUrlValue`), `scripts/extract/lib/sanitize.mjs` |
| **D6** | `scripts/extract/lib/sanitize.mjs` (a lista de etiquetas), `scripts/extract/lib/gutenberg.mjs` (a asserção do contorno) |
| **D7** | `scripts/check-rotation-gate.mjs` |
| **D8** | `.gitignore`, `scripts/guard-secrets.mjs` (a precond do build) |
| **D9** | `src/components/elementor/widgets/Form.astro` (o placeholder), `scripts/check-dist.mjs` (novo) |
| **D10** | `.github/workflows/deploy.yml`, `scripts/verify-workflow.mjs` |
| **D11** | `docs/runbook-pages.md` (novo), `docs/PARITY.md` (novo) |
| **D12** | `public/js/cookie-consent.js` |
| **D13** | `scripts/extract/lib/authored.mjs` (a §8 da Política de Cookies) — **precisa da aprovação do advogado** |
| **D14** | `scripts/lib/forbidden.mjs` (as formas dos tokens) |
| **D15** | `src/layouts/BaseLayout.astro` (o `<noscript>` passou para o corpo) |
| **D17/D19** | `docs/SPEC-SECURITY.md`, `docs/PLAN.md` |
| **D18** | `scripts/check-contrast.mjs` (a linha A25 sem duplicação) |
| **D20** | `src/lib/csp.ts`, `docs/DEPLOY.md`, `docs/security-decisions.md` (E5) |
| **D21** | `README.md`, `docs/DEPLOY.md` |
| **D22** | este ficheiro |

### 16.3 Por corrigir (nesta passagem)

| # | Porquê |
|---|---|
| A **rotação dos 12 segredos** — é tarefa do cliente (E4). |
| O **upgrade do `astro`** para a v7 — continua a ser uma decisão de escopo (D1). |
| O **pixel diff**, o **axe** e o **Lighthouse** — o Playwright não está instalado (é opcional). Ver `docs/PARITY.md`. |
| A **cor sobre a fotografia** (A19) — só se mede por captura de ecrã. |

## 17. FIX PASS E (2026-10-20) — a revisão final

O **reviewer** devolveu **3 achados críticos** (que bloqueavam a publicação),
mais um conjunto de altos/médios e **15 afirmações falsas** na documentação.
Todos foram tratados.

### 17.1 Decisões

| # | Decisão | Data | Origem | Estado |
|---|---|---|---|---|
| **D76** | O `docs/rotation-gate.md` fica **excepção** da regra dos 64 hex: o sha256 de uma captura de ecrã não é uma credencial. Sem isto, a primeira prova colada pelo cliente reprovava a guarda, o `prebuild` reprovava o build e o site **nunca** seria publicado — os dois gates deadlockavam-se. | 2026-10-20 | REV-1 | **Firmada** |
| **D77** | O `verify-workflow` corre **depois** do `npm ci` (usa o `yaml`, uma devDependency: num runner limpo não há `node_modules` e o step morria com MODULE_NOT_FOUND — o pipeline nunca tinha corrido). | 2026-10-20 | REV-2 | **Firmada** |
| **D78** | Os digest de **baixa entropia** (< 24 caracteres) saem do repositório: um sha256 de 13 caracteres é um oráculo de confirmação por força bruta. O nível local (`scripts/private/pii-digests.json`) tem **duas** secções — as credenciais (janela deslizante) e os dados pessoais (formas). No repositório ficam só os **8 salts**, os blobs OAuth e os tokens do Drive. | 2026-10-20 | REV-3 | **Firmada** |
| **D79** | A guarda passa a rejeitar as **formas de PII** (e-mail, IPv4, telefone) com uma allow-list dos **contactos públicos** do escritório — o CI apanha um e-mail colado por engano mesmo sem o ficheiro local. | 2026-10-20 | REV-4 | **Firmada** |
| **D80** | O mapa passa a ter a **própria categoria** de consentimento ("Mapas", por omissão **desligada**): pedir consentimento de *publicidade* para ver o endereço do escritório é um dark pattern ao contrário. A Política de Cookies tem 4 categorias. | 2026-10-20 | REV-12 | **Firmada** — o texto legal **precisa da aprovação do advogado** |
| **D81** | O `check-contrast` passa a dizer o que faz: a cascata pela **ordem das folhas** e o `!important` (a especificidade **não** é calculada) — 21 casos automáticos + 3 medidos à mão + 1 só por captura. | 2026-10-20 | REV-9 | **Firmada** |
| **D82** | O `check-redirects` imprime a **regra exacta** da Cloudflare a colar e compara-a com o registo (`src/data/redirects.json`) e com o runbook. | 2026-10-20 | REV-6 | **Firmada** |

### 17.2 Correções por achado

| Achado | Onde |
|---|---|
| **REV-1** | `scripts/lib/forbidden.mjs` (a excepção do `docs/rotation-gate.md`) + `docs/security-decisions.md` |
| **REV-2/REV-7** | `.github/workflows/deploy.yml` (a ordem) + `scripts/verify-workflow.mjs` (as asserções) |
| **REV-3** | `scripts/lib/forbidden.mjs` (a tabela) + `scripts/generate-pii-digests.mjs` (as duas secções) + `scripts/guard-self-test.mjs` (a cobertura) |
| **REV-4** | `scripts/lib/forbidden.mjs` (as formas de PII + a allow-list `PUBLIC_EMAILS`/`PUBLIC_IPS`/`PUBLIC_PHONES`) |
| **REV-5** | `.env.example` (um id válido e não-placeholder) |
| **REV-6** | `scripts/check-redirects.mjs` (novo) + o CI |
| **REV-7** | `.env.example` + `docs/CONTENT-EDITING.md` (o caminho das overrides) + `src/data/seo-overrides.json` (novo) |
| **REV-9** | `scripts/check-contrast.mjs` (o docstring e os 3 casos medidos à mão) |
| **REV-10** | `scripts/check-links.mjs` (as âncoras) |
| **REV-11** | `public/js/cookie-consent.js` (o `closeDialog`) |
| **REV-12** | `public/js/map.js`, `public/js/cookie-consent.js`, `src/components/CookieConsent.astro`, a Política de Cookies |
| **REV-13** | `src/content.config.ts`, `src/lib/site.ts`, `scripts/extract/lib/site.mjs`, `scripts/extract/lib/authored.mjs` (o `focusKeyword` e o `seo.article` saíram) |
| **REV-14** | `src/layouts/BaseLayout.astro` (o `defer` + o Swiper só no widget + o `preload` do herói) |
| **REV-15** | `scripts/extract/index.mjs` e `scripts/guard-self-test.mjs` (o dump por glob) + `scripts/lib/forbidden.mjs` (as excepções do CSS verbatim) + `.lighthouserc.json` (novo) + `docs/PARITY.md` |
| **REV-16** | `README.md`, `AGENTS.md`, `docs/README.md`, `docs/PLAN.md`, `docs/PARITY.md`, `docs/DEPLOY.md`, `docs/CONTENT-EDITING.md`, `docs/PROJECT-STATE.md` |
| **REV-17** | `src/layouts/BaseLayout.astro` (o `<noscript>` que revela o painel do menu) |
| **REV-18** | `src/content.config.ts` + `scripts/extract/lib/site.mjs` (os campos mortos) |

### 17.3 Por corrigir (nesta passagem)

| # | Porquê |
|---|---|
| A **rotação dos 12 segredos** — é tarefa do cliente (E4). O job de publicação fica **vermelho de propósito**. |
| O **upgrade do `astro`** para a v7 — continua a ser uma decisão de escopo (D1). |
| O **pixel diff**, o **axe** e o **Lighthouse** — não há navegador. A configuração do Lighthouse existe (REV-15); a medição fica pendente. |
| A **conversão dos banners para WebP** — é uma mudança visual que o dono tem de aprovar (REV-15, `docs/PARITY.md` §5). |
| O `scripts/private/pii-digests.json` **não é versionado** (por desenho, D78): num fork público tem de ser gerado com `npm run guard:pii-digests`. |
