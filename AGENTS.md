# AGENTS.md — acordo de trabalho (Galastri Advocacia)

> **Lê este ficheiro antes de mexer em qualquer coisa.** É o contrato entre o
> repositório e quem o muda — humano ou agente.
>
> **Projeto:** a migração do site `galastriadvocacia.com.br` (WordPress 6.9.4 +
> Elementor 3.35.7 + tema `kava`) para **Astro 5** estático no **GitHub Pages**.
> **Raiz:** `<LOCAL>` · **Backup do WordPress (read-only):** `<BACKUP>` ·
> **Repositório GitHub:** `devCarlosHenSil/galastriadvocacia` (público, ainda
> sem remote).
>
> **A implementação está completa e validada.** Falta o **operacional** (rotação
> dos segredos, DNS, Cloudflare, Formspree, aprovação jurídica).

---

## 1. Os quatro invariantes

### I1 — O CSS gerado pelo Elementor é reutilizado **verbatim**

`public/wp-content/uploads/elementor/css/*.css` (36 ficheiros) e
`public/css/*.css` são byte-idênticos ao backup. O design **é** esse CSS — por
isso o **DOM tem de lhe bater**: classes, ordem dos elementos, `cssId` (as
âncoras) e texto visível não podem mudar.

> **Nunca** "melhorar" uma classe, um id ou a ordem dos nós: o CSS do Elementor
> estiliza **por classe** (`e-flex`, `e-grid`, `e-con-boxed`,
> `elementor-hidden-desktop`, `animated-slow`, …) e uma classe nova ou apagada
> quebra o layout **em silêncio**.
>
> O que se pode mudar: a **sobreposição** em `public/css/a11y.css` (o último
> `<link>` da cascata), o conteúdo e a semântica. O que não: as regras do CSS
> original.

### I2 — A extração é a **única** fonte de verdade do conteúdo

Os posts, as políticas, as árvores do Elementor, o `site.json` e o manifesto de
assets **são gerados** por `scripts/extract/` a partir do dump. Não se editam
à mão.

> Se o texto mudou no WordPress, muda-se no backup e corre-se `npm run extract`.
> Se a correção é **do site novo** (um typo, um link morto), faz-se **na fonte
> da extração** (`scripts/extract/lib/repairs.mjs`, `authored.mjs`,
> `overlay.mjs`) — nunca no `src/` gerado.

### I3 — A guarda e o gate de rotação são **gates duros**

| Gate | Onde corre | O que bloqueia |
|---|---|---|
| `npm run guard` | `prebuild` do build **e** step do CI | segredo ou PII em `src/`, `public/`, `scripts/`, `tests/`, `docs/`, `.github/` |
| `npm run gate:rotation` | job de **publicação** | a publicação enquanto uma das **12** rotações de `docs/rotation-gate.md` estiver por fazer |

Não se contornam. Um gate duro que falha sempre é um gate que se apaga — e este
é o único que impede a publicação com as credenciais do backup.

### I4 — O repositório é **público**

Nada de caminho absoluto da máquina, segredo, PII de terceiros ou id real de
provedor. Os caminhos escrevem-se `<LOCAL>` e `<BACKUP>`; a guarda varre
`docs/` e `.github/` e falha se encontrar um valor vivo.

---

## 2. Comandos

```bash
npm install          # dependências (Node 20)
npm run dev          # http://localhost:4321
npm run build        # dist/ (17 páginas) — o prebuild corre a guarda
npm run preview      # serve o dist/
```

| Comando | Quando |
|---|---|
| `npm run extract` | o conteúdo do WordPress mudou (lê o dump em `<BACKUP>`) |
| `npm run extract:check` | depois de uma extração — **tem** de dar `Idempotency OK` |
| `npm run guard` | no `prebuild` e no CI (não há hook de pre-commit) |
| `npm run check-parity` | depois de mexer no renderer, no CSS ou no DOM |
| `npm run check-links` · `npm run check-contrast` · `npm run check-dist` | depois de mexer em conteúdo, cores ou no artefacto |
| `npm run verify-csp` | depois de mexer em `src/lib/csp.ts` **ou** em `docs/DEPLOY.md` |
| `npm run verify-workflow` | depois de mexer em `.github/workflows/deploy.yml` |
| `npm run guard:self-test` | só na máquina com o backup (planta valores vivos e prova que a guarda os reprova) |
| `npm run guard:pii-digests` | só na máquina com o backup (gera o ficheiro **local** de digests de PII) |
| `npm run gate:rotation` | **sai com 1** enquanto houver um `☐` — resultado esperado hoje |
| `npm run visual-diff` | opcional; sem Playwright, salta com `exit 0` |

`npm run check` (o `astro check`) valida os tipos — e corre **no CI**, antes do build (o `astro build` não verifica os tipos).

---

## 3. Convenções

### 3.1 Nomenclatura

| Coisa | Padrão | Exemplo |
|---|---|---|
| Rotas | minúsculas, barra final (`trailingSlash: 'always'`) | `/guarda-compartilhada/` |
| Slug de post / tag / categoria | o `post_name` do WordPress, **verbatim** | `bpc-loas-bloqueado` |
| Ficheiro de post | `<slug>.md` — o nome **é** o id da collection e a URL | `src/content/blog/guarda-compartilhada.md` |
| Componente | `PascalCase.astro` | `src/components/elementor/widgets/NavMenu.astro` |
| Módulo de código | `kebab-case` | `src/lib/post-context.ts` |
| Script do CI | `verbo-objeto.mjs` | `scripts/check-parity.mjs` |
| ID de elemento do Elementor | o id original, **sem renomear** | `af9b6b1` |
| `cssId` (âncora) | `_element_id` normalizado; as 6 âncoras: `home`, `sobre`, `areasdeatuacao`, `servicos`, `quemsou`, `contato` | — |
| ID de decisão | `D<n>` (estado), `SEC-<n>` (segurança), `T<n>.<n>` (plano) | `D64` |
| Commit | `tipo: descrição` | `content: novo post sobre PIS/Pasep 2025` |

### 3.2 A estrutura de `docs/`

- **Um assunto por ficheiro**; o índice é `docs/README.md`, com uma linha por
  documento.
- **Diataxis**: `README.md` = *tutorial*; `docs/CONTENT-EDITING.md` = *how-to*;
  `SPEC-*`, `DEPLOY.md`, `PARITY.md` = *referência*; `PROJECT-STATE.md`,
  `MIGRATION.md` = *explicação*. Não misturar tipos no mesmo ficheiro.
- **Prosa em pt-BR**; comandos, caminhos, identificadores, hex e classes CSS em
  inglês/verbatim.
- **Valores concretos são normais** — um hex, um id do Elementor, uma contagem,
  um comando: é o contrato. Não "simplifiques" um valor.
- **Segredos**: nunca por valor. `<REDACTED:o que é>` + **origem** + **forma**.
  Os **nomes** das opções sensíveis podem aparecer (estão em `docs/`, que é
  varrido com o perfil de valores) — o checklist de rotação depende deles.
  A raiz do repositório é varrida com o perfil **completo**: lá, um nome de
  opção também é um problema.
- **`docs/PROJECT-STATE.md` é a memória**: atualiza-lo no fim de cada entrega que
  muda o estado; **nunca** reescrever do zero.
- **Sem caminhos absolutos**: `<LOCAL>` e `<BACKUP>`.

### 3.3 O contrato de `scripts/extract/`

```
node scripts/extract/index.mjs --sql <dump.sql> --uploads <uploads/> --out .
```

| Item | Regra |
|---|---|
| **Origem do dump** | Tem de estar **fora** do repositório. Por omissão resolve-se por **glob** na pasta pai (`*_backup_db/*.sql`, o mais novo por mtime) — o id do export **não** está escrito no código; pode ser passado com `--sql`. O `uploads` também (`--uploads`, omissão `../uploads`). |
| **`GALASTRI_BACKUP`** | Variável de ambiente dos scripts que precisam do backup **inteiro**: `npm run guard:self-test` e `npm run guard:pii-digests` (omissão: a pasta pai). O `extract` usa as flags. |
| **Guarda de entrada** | Se o dump ou o `uploads` estiverem **dentro** do projeto, a extração **aborta**. |
| **Allow-list de escrita** | Só: `src/`, `public/wp-content/uploads/`, `public/css/`, `public/fonts/`, `public/js/`, `tests/fixtures/`, `docs/_reference/`, `docs/audit/comentarios-retidos.md`. Qualquer outro caminho → **erro** (`scripts/extract/lib/allowlist.mjs`). |
| **Idempotência** | Output **byte-idêntico** entre execuções: nada de timestamp, caminho absoluto, host ou `readdir` sem `sort()`. |
| **Asserts** | As contagens medidas estão em `EXPECTED` (`scripts/extract/index.mjs`). Se o dump mudar, o número muda: **reportar, não forçar**. |

### 3.4 As formas em `src/data/`

| Ficheiro | Forma | Gerado por |
|---|---|---|
| `src/data/site.json` | `site` · `nav` (7) · `categories` (3) · `tags` (57, `href: null`) · `theme` · `form` (4 campos) · `policy` (`version` + `vigencia`) · `seo` (`default` + `perUrl` (16) + `organization`) · `routes` | `scripts/extract/lib/site.mjs` |
| `src/data/redirects.json` | `{ "<url-antiga>": "<url-nova>" }` — hoje **1** entrada (`/home/` → `/`) | `scripts/extract/lib/urls.mjs` |
| `src/data/assets-manifest.json` | `meta` (`totalFiles` 97, `totalBytes` 10 149 570, `cssFiles` 39, `fontFiles` 16) + `assets[]` + `missing[]` + `skipped{}` | `scripts/extract/lib/assets.mjs` |
| `src/data/elementor/*.json` | `meta` (`sourcePostId`, `elementCount`, `cssIds`, …) + `root` (**um array** de nós de topo) | `scripts/extract/lib/elementor.mjs` |
| `src/data/fontawesome-icons.json` | mapa de ícones | `scripts/css.mjs` |

Nó de uma árvore Elementor: `{ id, elType, widgetType?, label, cssId, settings, elements[], isInner }`.
`cssId` é **irmão** de `settings`, nunca dentro dele.

### 3.5 O contrato de `src/content.config.ts`

O schema Zod da collection `blog` é **o contrato** dos campos do frontmatter:
qualquer campo novo tem de lá ser adicionado **e** documentado em
`docs/CONTENT-EDITING.md`. A data é `z.coerce.date()` e **todo** o render usa
`timeZone: 'UTC'` — a data civil é a local do WordPress (`America/Sao_Paulo`).

---

## 4. Ações proibidas

| # | Proibido | Porquê |
|---|---|---|
| 1 | **Escrever no backup** (`<BACKUP>`) | É a fonte read-only; um `git init` ou uma edição lá publica o dump (SEC-23). |
| 2 | **Versionar `.sql`, `wp-config.php` ou `.zip`** | Repositório público; o `.gitignore` e a guarda são a segunda barreira. |
| 3 | **Mexer à mão em `public/wp-content/uploads/`** | É **gerado** (closure de assets); uma edição manual desaparece. |
| 4 | **Mexer à mão em `public/wp-content/uploads/elementor/css/`** | É o CSS **verbatim** (I1). |
| 5 | **Mexer à mão em `src/data/elementor/*.json`, `assets-manifest.json`, `redirects.json`** | São gerados; a correção vai na fonte da extração (I2). |
| 6 | **Adicionar uma dependência de runtime sem perguntar** | Zero dependências além do Astro, por desenho (paridade, superfície de ataque, `npm audit`). Propor, justificar, medir o `dist/`. |
| 7 | **Fazer `push` para `main` com o gate vermelho** | Publicar antes da rotação = publicar as credenciais do backup. |
| 8 | **Editar o `dist/` à mão** | É gerado. Corrige-se a fonte e reconstrói-se. |
| 9 | **"Arrumar" o gate de rotação** | Exige `☑` + data + responsável + sha256 **por linha**. |
| 10 | **Publicar o id real do Formspree** | Vai como **variável** de repositório. |
| 11 | **Tocar no `wp_users`, `wp_comments` ou no `admin_email`** | Não migram (R6; SPEC-DATA §4.1/§4.2). |
| 12 | **Escrever caminhos absolutos da máquina** | `<LOCAL>` e `<BACKUP>`; a guarda varre `docs/` e `.github/`. |
| 13 | **Fazer `git init` fora da raiz do repositório** | A raiz é `<LOCAL>`. |
| 14 | **Mudar as rotas sem o `redirects.json` e o 301** | As URLs existentes têm backlinks. |

---

## 5. Definition of Done (curta)

1. `npm run build` **passa** (17 páginas) e o `prebuild` (a guarda) não reclama.
2. `npm run check-parity` **passa** nos 3 fixtures — se o DOM mexeu.
3. `npm run check-links`, `check-contrast` e `check-dist` **passam** — se o
   conteúdo, as cores ou o artefacto mexeram.
4. `npm run verify-csp` **passa** — se a CSP ou o runbook mexeram.
5. `npm run verify-workflow` **passa** — se o workflow mexeu.
6. `npm run extract:check` dá `Idempotency OK` — se a extração mexeu.
7. O `docs/PROJECT-STATE.md` foi atualizado e nenhum documento ficou a
   contradizer o código.
8. Nenhum segredo, PII ou caminho absoluto.
9. O gate de rotação continua a funcionar (ou, se era para o fechar, tem `☑` +
   data + responsável + sha256 **por linha**).

> `check-parity` é a **paridade estrutural**: conjunto **e ordem** dos ids de
> elemento, **lista de classes** por elemento, âncoras e texto visível, contra
> o HTML que o Elementor renderizou (`tests/fixtures/elementor-cache-{30,48,49}.html`).

---

## 6. Quem revê o quê

| Especialista | Revê | Como |
|---|---|---|
| **`developer`** | O código: renderer, widgets, layouts, scripts, extração, CI | Implementa, escreve os testes, mantém a paridade estrutural |
| **`dba`** | Modelo de dados: `site.json`, schema Zod, manifesto de assets | Revê formas e contagens medidas |
| **`security`** | Ameaças, guarda, CSP, `.gitignore`, exposição do repo público, checklist de rotação | Emite `SEC-<n>`; revisão **adversarial** |
| **`uiux`** | Contrato de DOM, estados, contraste, acessibilidade, alvos de toque | Emite a SPEC-UI; valida a paridade visual quando há navegador |
| **`qa`** | Comportamento: build, paridade, links, contraste, `dist/`, artefacto | Devolve **PASS/FAIL**; corre depois de cada alteração |
| **`reviewer`** | As decisões: escopo, arquitetura, o que ficou de fora | **Sempre o último**, depois do QA |
| **`docs`** | A documentação: `README.md`, `docs/**`, o estado do projeto | Edita **só** documentação; mantém a verdade alinhada com o código |
| **`deployer`** | A publicação: branches, commits, push, tags, CI | **Nunca** publica com o gate vermelho |

**Ordem obrigatória:** `developer` → `qa` → `reviewer` → `deployer`.
`security` e `uiux` revêm em paralelo, a qualquer altura.
