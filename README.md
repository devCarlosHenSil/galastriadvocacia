# Galastri Advocacia — site estático (Astro 5)

Migração do site `galastriadvocacia.com.br` de **WordPress 6.9.4 + Elementor 3.35.7 (tema `kava`)** para **Astro 5** com `output: 'static'`, publicado no **GitHub Pages** no domínio `galastriadvocacia.com.br`.

A estratégia é **replay do DOM**: o CSS gerado pelo Elementor é copiado **verbatim** e o HTML é reproduzido para que o CSS original aplique sem alteração. O design não é re-autorado.

| | |
|---|---|
| **Repositório GitHub** | `devCarlosHenSil/galastriadvocacia` (público, **sem remote** ainda) |
| **Raiz do git** | `<LOCAL>` — a pasta do repositório |
| **Backup do WordPress (read-only)** | `<BACKUP>` — nunca escrever ali, nunca copiar nada para dentro do repositório |
| **Histórico git** | **1 commit** (o SHA muda a cada reescrita da história) — a história do WordPress não foi importada, de propósito |
| **Fase** | Implementação **completa e validada**; a publicação está **bloqueada** pelo gate de rotação dos 12 segredos (§7) |

> ⚠️ **O job de publicação fica VERMELHO de propósito.** Enquanto as **12 rotações**
> de `docs/rotation-gate.md` não estiverem feitas (com a data, o responsável e o
> sha256 da captura), o gate bloqueia a publicação. **Não se "arrume" o gate** —
> é a única coisa que impede a publicação com as credenciais do backup. Ver
> `docs/rotation-gate.md` e `docs/DEPLOY.md`.

---

## 1. Stack

| Item | Valor |
|---|---|
| Framework | Astro 5 (`output: 'static'`, `trailingSlash: 'always'`, `build.format: 'directory'`), sem adapter |
| Dependências | `astro`, `@astrojs/sitemap` (runtime) · `@astrojs/check`, `typescript`, `yaml` (dev) — **nenhuma outra** |
| Conteúdo | Content Collection `blog` (`src/content/blog/*.md`) + 3 páginas Markdown nativas |
| Deploy | GitHub Pages via GitHub Actions (5 actions fixadas por SHA, sem `pull_request`) |
| Formulário | Formspree (`PUBLIC_FORMSPREE_ENDPOINT`), 4 campos, honeypot `_gotcha`, consentimento LGPD, CTA de WhatsApp |
| Analytics | Google Tag Manager `GTM-KDNG3QWB` + AdSense `ca-pub-5989678973778468`, ambos **consent-gated** |
| Fontes | 100% self-hosted (Roboto, Montserrat, Nunito, Questrial, Qwigley) |
| Dados | Nenhum banco. O `.sql` do WordPress é fonte **read-only** e nunca é versionado |

---

## 2. Pré-requisitos

| # | Precisa de | Para quê | Sem isso |
|---|---|---|---|
| 1 | **Node 20** (`engines: ">=20"`, `.nvmrc`) | build e dev server | o Astro 5 não arranca |
| 2 | **npm** (vem com o Node) | instalar as dependências | — |
| 3 | A **variável de repositório** `PUBLIC_FORMSPREE_ENDPOINT` | o build **falha** sem ela | o `npm run build` sai com erro |
| 4 | O **backup do WordPress** em `<BACKUP>` (read-only) | para `npm run extract`, `npm run css` (o CSS do Elementor e as fontes saem de lá), `npm run guard:self-test` e `npm run guard:pii-digests` | o resto do projeto funciona sem ele |

O backup **nunca** entra no repositório. O dump `.sql` e o `wp-config.php` são
lidos de fora e o extractor **aborta** se o caminho resolvido estiver dentro do
projeto.

---

## 3. Comandos

| Comando | O que faz | Saída esperada |
|---|---|---|
| `npm install` | instala as dependências | `added N packages` |
| `npm run dev` | servidor de desenvolvimento | `http://localhost:4321` |
| `npm run build` | build estático → `dist/` (o `prebuild` corre a guarda de segredos primeiro) | `Complete!` + `dist/` com **17 páginas** |
| `npm run preview` | serve o `dist/` localmente | `http://localhost:4321` |
| `npm run extract` | extrai o conteúdo do dump WP-Vivid → `src/`, `public/`, `tests/`, `docs/_reference/` (só na máquina do dev) | todos os asserts passam, `exit 0` |
| `npm run extract:check` | re-executa a extração num diretório temporário e compara os SHA-256 | `Idempotency OK — N ficheiros idênticos entre as duas execuções.` |
| `npm run css` | consolida o CSS em `public/css/` e baixa as fontes self-hosted | (usa o snapshot do Wayback, versionado — não precisa da rede) |
| `npm run guard` | varre `src/`, `public/`, `scripts/`, `tests/`, `docs/`, `.github/` em busca de segredos e PII. **Dois perfis**: a raiz do repositório e o `src/` são varridos com o perfil **completo** (as formas + os nomes das opções sensíveis); o `docs/` é varrido com o perfil de **valores** (as specs podem nomear as opções que têm de ser revogadas). As **formas de PII** (e-mail, IPv4, telefone) são rejeitadas em todo o lado, excepto os **contactos públicos** do escritório (a allow-list está em `scripts/lib/forbidden.mjs`). O ficheiro local `scripts/private/pii-digests.json` acrescenta o que só ele conhece (os IPv4 e os e-mails do backup) | `no secret or personal data found` |
| `npm run check-parity` | paridade **estrutural** com o `_elementor_element_cache` (obrigatória, sem browser) | PASS nos 3 fixtures (`30`, `48`, `49`) |
| `npm run check-links` | links internos do `dist/` + ausência de assets externos | `0` links quebrados |
| `npm run check-contrast` | recalcula a tabela de contraste **A1…A25** a partir do CSS construído (a cascata pela **ordem das folhas** e o `!important`; a especificidade **não** é calculada) | `21 casos automáticos + 3 medidos à mão, 0 falha(s)` (a A19 só se mede por captura de ecrã) |
| `npm run check-dist` | verifica o artefacto publicado (sem `javascript:`, sem `on…=`, sem etiquetas perigosas, sem o placeholder do Formspree) | `check-dist: N página(s) verificadas — sem handlers, sem URLs javascript:, …` |
| `npm run check-audit` | o `npm audit` com a exceção fixada **pelo ID do advisory** | `0` advisories fora da lista aceite |
| `npm run verify-csp` | a CSP do `<meta>` e a do runbook são a mesma | `verify-csp: the two policies are identical (11 directives) — except frame-ancestors and upgrade-insecure-requests, …` |
| `npm run verify-workflow` | confirma o workflow contra SEC-50…SEC-55 | `workflow deploy.yml: N verificação(ões) OK` |
| `npm run guard:self-test` | planta cada valor vivo do backup em 6 localizações e prova que a guarda os reprova | `guard-self-test: … valor(es) vivo(s) reconhecidos pelo digest.` |
| `npm run guard:pii-digests` | gera o ficheiro local de digests de PII (**git-ignored**) | escreve `scripts/private/pii-digests.json` |
| `npm run gate:rotation` | o gate da rotação dos 12 segredos | **sai com 1** enquanto houver um `☐` — *é o comportamento esperado* |
| `npm run visual-diff` | paridade de **pixels** — opcional (precisa do Playwright; sem ele, salta) | sem Playwright: aviso + `exit 0` |
| `npm run update-parity-fixtures` | regenera as fixtures douradas dos widgets dinâmicos a partir do build | — |

> `npm run extract` **não** roda no CI: o dump `.sql` não está no repositório. A saída extraída é versionada.
> O caminho do dump e da pasta `uploads` é passado por flag (`--sql`, `--uploads`, `--out`) e **precisa** estar fora do repositório.
> `npm run visual-diff` é a única ferramenta **opcional**: sem Playwright instalado ela avisa e sai com **0**. A verificação obrigatória de paridade é a **estrutural** (`npm run check-parity`).

---

## 4. Mapa de pastas

| Caminho | O que lá está |
|---|---|
| `src/pages/` | as rotas: `index.astro`, `home.astro`, `blog.astro`, `links.astro`, `404.astro`, `[slug].astro` (posts), `category/[slug].astro`, `politica-*.md` (3) |
| `src/layouts/` | `BaseLayout` (head, meta, JSON-LD, CSP do `<meta>`), `PageLayout`, `PostLayout`, `PolicyLayout` |
| `src/components/` | `Header.astro`, `Footer.astro`, `CookieConsent.astro`, `elementor/` (o renderer + **25** widgets) |
| `src/content/blog/` | os 6 posts em Markdown (collection `blog`) |
| `src/content.config.ts` | o schema Zod da collection `blog` — **o contrato** dos campos do frontmatter |
| `src/data/` | `site.json` (site, nav, taxonomias, theme, form, seo, routes), `redirects.json`, `assets-manifest.json`, `fontawesome-icons.json`, `elementor/*.json` (7 árvores Elementor) |
| `src/lib/` | `seo.ts`, `nav.ts`, `site.ts`, `elementor.ts`, `csp.ts` (a CSP), `assets.ts`, `stylesheets.ts`, … |
| `public/` | o que é servido tal e qual: `CNAME`, `robots.txt`, `css/` (**17** folhas), `fonts/`, `webfonts/`, `js/` (9 ficheiros), `wp-content/uploads/` (**97** ficheiros) |
| `scripts/` | o pipeline de extração (`extract/`), a guarda de segredos (`guard-secrets.mjs`) e as verificações (`check-*.mjs`, `verify-*.mjs`) |
| `tests/fixtures/` | o oráculo de paridade: `elementor-cache-{30,48,49}.html` + as fixtures dos widgets dinâmicos |
| `docs/` | as especificações, o plano, o estado, os runbooks e os guias (índice em [`docs/README.md`](docs/README.md)) |
| `.github/workflows/deploy.yml` | o CI que constrói e publica no GitHub Pages |

---

## 5. Rotas

**17 rotas** no total. O sitemap tem **15 URLs** (sem `/home/` e sem `/404`).

| Rota | Ficheiro | Origem no WordPress | Nota |
|---|---|---|---|
| `/` | `src/pages/index.astro` | post 30 (`page_on_front`) | home — árvore `home-30.json`, **63** elementos |
| `/home/` | `src/pages/home.astro` | alias do post 30 | `canonical → /` + meta-refresh; o **301 na Cloudflare é uma acção pendente do cliente** (até lá, `/home/` responde 200) |
| `/blog/` | `src/pages/blog.astro` | post 464 (`page_for_posts`) | arquivo — template Elementor 516 |
| `/5aspectos-cruciais-direito-de-familia/` | `src/pages/[slug].astro` | post 272 | posts na **raiz** (preserva backlinks) |
| `/guarda-compartilhada/` | `src/pages/[slug].astro` | post 610 | idem |
| `/pis-pasep-2025/` | `src/pages/[slug].astro` | post 714 | idem |
| `/jovem-aprendiz/` | `src/pages/[slug].astro` | post 723 | idem |
| `/salario-maternidade/` | `src/pages/[slug].astro` | post 733 | idem |
| `/bpc-loas-bloqueado/` | `src/pages/[slug].astro` | post 739 | idem |
| `/category/direito-de-familia/` | `src/pages/category/[slug].astro` | categoria 19 | 2 posts |
| `/category/direito-do-trabalho/` | `src/pages/category/[slug].astro` | categoria 36 | 2 posts |
| `/category/direito-previdenciario/` | `src/pages/category/[slug].astro` | categoria 67 | 2 posts |
| `/links/` | `src/pages/links.astro` | post 843 | sem header/footer (`elementor_canvas`) |
| `/politica-de-privacidade/` | `src/pages/politica-de-privacidade.md` | post 3 | página nativa, **17** secções |
| `/politica-de-cookies-galastri-advocacia/` | `src/pages/politica-de-cookies-galastri-advocacia.md` | post 83 | página nativa, **8** secções |
| `/politica-de-uso-de-inteligencia-artificial-galastri-advocacia/` | `src/pages/politica-de-uso-de-inteligencia-artificial-galastri-advocacia.md` | post 85 | página nativa, **6** secções |
| `/404` | `src/pages/404.astro` | post 790 | `noindex, follow`, sem canonical, fora do sitemap |

**Sem** páginas de tag (as 57 tags ficam no frontmatter de cada post **e** em `src/data/site.json → tags`, onde o `href` é `null`), **sem** comentários, **sem** newsletter, **sem** `/wp-admin/`.

---

## 6. `PUBLIC_FORMSPREE_ENDPOINT` — a única configuração externa

O endpoint do Formspree **não é um segredo**: é o id público do formulário. Por isso vive como **variável de repositório**, não como segredo:

```
GitHub → devCarlosHenSil/galastriadvocacia → Settings → Secrets and variables
      → Actions → Variables → PUBLIC_FORMSPREE_ENDPOINT
```

- O **build falha** se a variável estiver ausente, mal formada (`https://formspree.io/f/<ID>`) ou for o placeholder. O formulário **nunca** é publicado morto.
- **Nunca** escrever o id real neste repositório. O `.env` local (git-ignored) usa o id **inventado** de `.env.example` — sintacticamente válido (o build passa), mas o formulário não entrega nada. O id real vive na **variável** do repositório.
- O **CTA de WhatsApp** é permanente ao lado do formulário: o free tier do Formspree é de **50 submissões/mês** e estoura em silêncio.

Detalhe do painel (Restrict to Domain, reCAPTCHA, quota): `docs/DEPLOY.md` §5.

---

## 7. O gate de rotação — a publicação fica vermelha de propósito

`npm run gate:rotation` corre **no job de publicação** do workflow e **sai com 1**
enquanto qualquer uma das **12** linhas de `docs/rotation-gate.md` estiver com `☐`.

O gate exige, por linha: a marca `☑`, a **data**, o **responsável** e o
**sha256 da captura** (nunca o valor do segredo).

> Publicar antes da rotação equivale a publicar as credenciais do backup. A
> rotação é uma tarefa **operacional do cliente** (MySQL, 8 salts do WordPress,
> 4 OAuth do Google, Elementor Connect, Safe Mode, tokens avulsos, 2FA, retenção
> do backup, decisão sobre o WordPress antigo).
>
> **Não "arrume" o gate** e não apague a linha do `rotation-gate.md`. Um gate
> duro que falha sempre é um gate que se apaga.

---

## 8. Como editar o conteúdo

→ **[`docs/CONTENT-EDITING.md`](docs/CONTENT-EDITING.md)** — guia para quem não
é programador: que ficheiro abrir, que campo mexer, a referência completa do
frontmatter, as regras que quebram o build e o fluxo de publicação.

| O quê | Onde |
|---|---|
| Um post | `src/content/blog/<slug>.md` (frontmatter + corpo) |
| Uma política | `src/pages/politica-*.md` |
| Título/description de uma página (o que o Google vê) | `src/data/site.json` → `seo.perUrl["<url>"]` (**fonte única de verdade**) |
| Menu | `src/data/site.json` → `nav` |
| Campos do formulário | `src/data/site.json` → `form` |
| Cores e tipografia | `src/data/site.json` → `theme` + `public/css/tokens.css` |

> ⚠️ **`src/data/site.json` e as políticas são *gerados*** por
> `npm run extract` (a extração é a única fonte de verdade do conteúdo). Uma
> alteração feita à mão é perdida na próxima extração — a alteração
> **definitiva** vai para `scripts/extract/lib/authored.mjs`. A nota completa
> está em `docs/CONTENT-EDITING.md` §1.

---

## 9. Como publicar

→ **[`docs/DEPLOY.md`](docs/DEPLOY.md)** — o runbook completo: DNS, Transform
Rules da Cloudflare (CSP + headers), GitHub Pages, Formspree, rollback e o gate
de rotação. Também [`docs/runbook-pages.md`](docs/runbook-pages.md) (recuperação
do repositório) e [`docs/rotation-gate.md`](docs/rotation-gate.md) (o gate).

O fluxo normal:

```bash
git add <ficheiros>
git commit -m "content: novo post sobre PIS/Pasep 2025"
git push origin main      # o workflow constrói, verifica e publica (~2 min)
```

O `push` para `main` dispara `.github/workflows/deploy.yml`, que corre
`verify-workflow` → `npm ci` → audit → guard → build → `verify-csp` →
`check-parity` → `check-links` → `check-contrast` → `guard:self-test` →
`check-dist` → upload; e só depois, no job de publicação, o **gate de rotação**.

---

## 10. Limitações conhecidas

| # | Limitação | Porquê |
|---|---|---|
| 1 | **Não há pixel diff, axe nem Lighthouse no CI.** | O CI não tem navegador. A paridade **estrutural** (`check-parity`) corre sem browser e é a obrigatória; `npm run visual-diff` existe mas precisa do Playwright. Detalhe em `docs/PARITY.md` §4. |
| 2 | **A19 (o contraste sobre a fotografia) não é medida.** | Depende da imagem final — só se mede por captura de ecrã. As outras **24** linhas de A1…A25 são recalculadas do CSS construído. |
| 3 | **O ficheiro de digests de PII não é versionado.** | `scripts/private/pii-digests.json` é local e git-ignored (um digest de um e-mail ou de um IP seria um oráculo de confirmação). Num fork público tem de ser gerado de novo com `npm run guard:pii-digests`. |
| 4 | **O `npm audit` reporta 1 vulnerabilidade crítica no `astro`.** | Exceção **aceita e documentada** (`docs/security-decisions.md` E1): o conserto exige `astro@7` e a decisão D1 fixa Astro 5. Nenhum dos 10 advisories aceites tem caminho de exploração neste site estático. |
| 5 | **O site ainda não está no ar.** | O DNS, as Transform Rules da Cloudflare, o repositório público e a rotação dos 12 segredos são passos manuais do runbook. |
| 6 | **As políticas e o copy de SEO precisam de aprovação jurídica.** | O texto está pronto (`"status": "draft"` em `site.json → seo.perUrl`), mas só a advogada o pode aprovar. |

---

## 11. Onde vive a verdade

| Questão | Ficheiro |
|---|---|
| Como é o modelo de dados, o pipeline e a suíte de asserts? | [`docs/SPEC-DATA.md`](docs/SPEC-DATA.md) |
| Quais são as ameaças, os requisitos de segurança e o checklist de rotação? | [`docs/SPEC-SECURITY.md`](docs/SPEC-SECURITY.md) |
| Qual é o contrato do DOM, os estados, o contraste e a acessibilidade? | [`docs/SPEC-UI.md`](docs/SPEC-UI.md) |
| Como foi planeado e com que critérios de aceitação? | [`docs/PLAN.md`](docs/PLAN.md) |
| Em que estado está o projeto, que decisões foram tomadas e o que falta? | [`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md) |
| Como se publica (e como se volta atrás)? | [`docs/DEPLOY.md`](docs/DEPLOY.md) |
| O que foi migrado, o que foi descartado e porquê? | [`docs/MIGRATION.md`](docs/MIGRATION.md) |
| Que paridade visual foi medida e que divergências foram aceites? | [`docs/PARITY.md`](docs/PARITY.md) |
| Como se recupera de um repositório renomeado/transferido/eliminado? | [`docs/runbook-pages.md`](docs/runbook-pages.md) |
| Quais são as 12 rotações a fazer? | [`docs/rotation-gate.md`](docs/rotation-gate.md) |
| Que riscos de segurança foram aceites? | [`docs/security-decisions.md`](docs/security-decisions.md) |
| Como se edita o conteúdo sem ser programador? | [`docs/CONTENT-EDITING.md`](docs/CONTENT-EDITING.md) |
| O que um agente tem de saber antes de mexer no repositório? | [`AGENTS.md`](AGENTS.md) |

---

## 12. Segurança — o que não entra no repositório

O repositório é **público**. Nada abaixo pode ser versionado: o dump `.sql`, o
`wp-config.php`, `wp_users`/`wp_usermeta`, `wp_comments`/`wp_commentmeta`,
qualquer `wp_options` fora da allow-list, e-mails de utilizadores ou de
spammers, e o e-mail administrativo do WordPress.

`npm run guard` roda antes de cada build (e no CI) e falha se encontrar
qualquer um desses padrões — em `src/`, `public/`, `scripts/`, `tests/`,
`docs/` **e** `.github/`.

As **specs em `docs/`** também são versionadas e **públicas**: referenciam
credenciais por **localização e forma**, nunca por valor (`<REDACTED:…>`). O
checklist de **rotação dos segredos** (12 itens) é **gate duro de publicação**
(SEC-67).

> O e-mail público do site é `contato@galastriadvocacia.com.br`. O e-mail
> administrativo do WordPress **não** aparece no HTML publicado.
