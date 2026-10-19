# CONTENT-EDITING — como editar o site sem ser programador

Este guia é para quem escreve: a advogada, a equipa de conteúdo, o
marketing. **Não é preciso tocar em código.**

---

## 1. O que é o quê

| O quê | Onde | É gerado? |
|---|---|---|
| Um **post** do blog | `src/content/blog/<slug>.md` (6 ficheiros) | ⚠️ **parcialmente** — o texto é teu, o resto é extraído |
| O **título** e a **descrição** de uma página (que aparecem no Google) | `src/data/site.json` → `seo.perUrl["<url>"]` | ⚠️ **gerado** (a extração escreve o ficheiro) |
| O **menu** | `src/data/site.json` → `nav` | ⚠️ **gerado** |
| Os **campos** do formulário de contacto | `src/data/site.json` → `form` | ⚠️ **gerado** |
| As **cores** e os **tipos de letra** | `src/data/site.json` → `theme` + `public/css/tokens.css` | ⚠️ `site.json` é **gerado**; o `tokens.css` é **editável** |
| As **políticas** (privacidade, cookies, IA) | `src/pages/politica-de-*.md` | ⚠️ **gerado** (a extração escreve o ficheiro) |

> ⚠️ **Uma edição à mão num ficheiro gerado perde-se no `npm run extract`
> seguinte.** É a razão de `src/data/site.json`, `src/data/elementor/*.json` e
> `src/pages/*.md` serem **reescritos** pela extração.
>
> **Onde vai a alteração definitiva:**
>
> - o **texto de um post** → no ficheiro do post (`src/content/blog/<slug>.md`)
>   — **o texto é sempre teu**;
> - o **título/descrição de uma página** → no `authored.mjs` da extração
>   (`scripts/extract/lib/authored.mjs`), que é a fonte de verdade do
>   `site.json`;
> - um **erro do site novo** (uma gralha, um link morto) → em
>   `scripts/extract/lib/repairs.mjs`, que é registado no relatório da
>   extração (`docs/_reference/extract-report.json → repairs`).

> ⚠️ O `<title>` e a `<meta name="description">` de cada página saem
> **apenas** de `src/data/site.json → seo.perUrl`. O bloco `seoTitle` /
> `seoDescription` do post é a **mesma** coisa noutro sítio — se mudar um,
> mude o outro, senão o build falha (há um assert que verifica).

---

## 2. Editar um post

1. Abrir `src/content/blog/<slug>.md`.
2. O ficheiro tem duas partes: o **frontmatter** (entre `---`) e o **corpo**.

```markdown
---
title: "PIS/Pasep 2025: Calendário, Regras e Como Consultar o Abono Salarial"
description: "O PIS/Pasep 2025 é um benefício aguardado por muitos trabalhadores…"
pubDate: 2024-12-26          ← SEM aspas!
hero: "/wp-content/uploads/2024/12/imagem-padrao-post-1.png"
heroAlt: "PIS/Pasep 2025"
category: "direito-do-trabalho"
categoryName: "Direito do Trabalho"
tags:
  - "pis-pasep-2025"
  - "abono-salarial"
seoTitle: "PIS/Pasep 2025: Calendário, Regras e Como Consultar"
seoDescription: "Calendário do PIS/Pasep 2025, quem tem direito ao abono salarial…"
focusKeyword: "PIS/Pasep 2025,Como consultar PIS/Pasep,…"
author: "Ana Paula Galastri"
authorSlug: "ana-paula-galastri"
readingTime: 5
comments: []
---

O corpo do post começa aqui. A formatação é **HTML simples**:
`<p>parágrafo</p>`, `<h2>`, `<h3>`, `<ul><li>…</li></ul>`, `<strong>negrito</strong>`,
`<a href="…">ligação</a>`.
```

### Os campos do frontmatter

| Campo | Tipo | Origem | Podes mexer? |
|---|---|---|---|
| `title` | texto | o `post_title` do WordPress, **verbatim** | ✅ |
| `description` | texto | a 1.ª frase do corpo | ✅ |
| `pubDate` | data `YYYY-MM-DD` **sem aspas** | o `post_date` **local** do WordPress | ✅ |
| `updatedDate` | data (opcional) | o `post_modified` **real** — sai no frontmatter **e** no `dateModified` do JSON-LD | ✅ **só quando o texto muda** |
| `hero` | caminho `/wp-content/uploads/…` | o `_thumbnail_id` | ✅ mas o ficheiro tem de existir |
| `heroAlt` | texto | o `_wp_attachment_image_alt` | ✅ |
| `category` | slug | a taxonomia do WordPress | ⚠️ tem de existir em `site.json → categories` |
| `categoryName` | texto | o nome da categoria | ⚠️ tem de bater certo com o `category` |
| `tags` | lista de slugs | as tags do WordPress | ⚠️ cada uma tem de existir em `site.json → tags` |
| `seoTitle` | texto | **autorado** — rascunho pendente de aprovação | ✅ mas tem de ser **igual** ao `perUrl` |
| `seoDescription` | texto | **autorado** — rascunho pendente de aprovação | ✅ mas tem de ser **igual** ao `perUrl` |
| `focusKeyword` | texto | o `rank_math_focus_keyword` **verbatim** | ❌ |
| `author` | texto | `Ana Paula Galastri` | ❌ |
| `authorSlug` | texto | `ana-paula-galastri` | ❌ |
| `readingTime` | número > 0 | **calculado**: `ceil(palavras/200)` | ❌ |
| `comments` | lista | **sempre `[]`** (o site não tem comentários) | ❌ |

> **O contrato é o schema Zod de `src/content.config.ts`.** Um campo que não
> lá esteja **quebra o build**; um campo que lá esteja e falte no ficheiro
> também.

> **As tags não geram páginas.** A tag é só um rótulo no post — não existe
> `/tag/…` no site novo (decisão R4). Para uma **página** de categoria, ver
> `src/data/site.json → categories`.

---

## 3. Ver como fica (antes de publicar)

```bash
npm install        # só na primeira vez
npm run dev        # abre http://localhost:4321
```

O servidor recarrega a página assim que se guarda o ficheiro. Para ver o
formulário a funcionar localmente, copie o endpoint do Formspree para um
`.env` (ver `docs/DEPLOY.md` §5):

```bash
cp .env.example .env
# .env:  PUBLIC_FORMSPREE_ENDPOINT=https://formspree.io/f/<ID>
```

---

## 4. Datas — a regra que mais confunde

```yaml
pubDate: 2024-12-26        # ✅ SEM aspas
pubDate: "2024-12-26"      # ❌ com aspas
```

- **Sem aspas** é obrigatório: com aspas o YAML devolve texto e o Astro
  pode interpretá-lo como UTC, o que **mostra a data um dia antes** no
  fuso de São Paulo.
- A data civil é a **local** do WordPress (America/Sao_Paulo), não a UTC.
- Qualquer data que o site imprima é renderizada com `timeZone: 'UTC'` —
  assim a data é a mesma em qualquer máquina, em qualquer fuso.
- `updatedDate` **aparece** nos posts: é o `post_modified` real do WordPress,
  e é também o `dateModified` do JSON-LD. Só muda se o texto mudar.

---

## 5. O fluxo de publicação

```bash
# 1. editar o ficheiro em src/content/blog/… (ou src/data/site.json)

# 2. ver o resultado
npm run dev

# 3. confirmar que nada quebrou
npm run build          # tem de dizer "Complete!"
npm run guard          # tem de dizer "no secret or personal data found"

# 4. gravar
git add src/content/blog/<slug>.md
git commit -m "content: novo post sobre PIS/Pasep 2025"
git push origin main
```

O `push` para `main` dispara o workflow `.github/workflows/deploy.yml`, que
constrói e publica o site. **Demora ~2 minutos.**

### O que o CI impede que vá para o ar

| Verificação | O que impede |
|---|---|
| `node scripts/guard-secrets.mjs` | segredos, senhas, e-mails pessoais e IPs dentro do repositório (incluindo as specs em `docs/`) |
| `npm run build` | frontmatter inválido, imagens em falta, CSS partido |
| `npm run check-parity` | a estrutura do HTML do Elementor deixa de bater com o original |
| `npm run check-links` | um link interno quebrado |
| `npm run check-contrast` | uma regressão de contraste (A1…A25) |
| `npm run check-dist` | um `javascript:`, um `on…=` ou uma etiqueta perigosa no **artefacto publicado** |

---

## 6. Escrever um post novo (5 passos)

1. **Copiar um post existente como modelo** — o ficheiro é o `id` da collection
   **e** a URL, por isso o nome tem de ser o *slug* final:
   ```bash
   cp src/content/blog/guarda-compartilhada.md src/content/blog/meu-post.md
   ```
2. **Editar o frontmatter**:
   - `title` e `description` — o texto;
   - `pubDate` — a data de hoje, `YYYY-MM-DD` **sem aspas**;
   - `hero` — uma imagem que **exista** em `public/wp-content/uploads/`
     (ex.: `/wp-content/uploads/2024/12/nome-do-ficheiro.png`);
   - `heroAlt` — a descrição da imagem;
   - `category` + `categoryName` — uma das **3** categorias
     (`direito-de-familia` · "Direito de Família", `direito-do-trabalho` ·
     "Direito do Trabalho", `direito-previdenciario` · "Direito Previdenciário");
   - `tags` — slugs que existam em `src/data/site.json → tags`;
   - `seoTitle` e `seoDescription` — o rascunho para o Google;
   - `focusKeyword`, `author`, `authorSlug`, `readingTime` e `comments` —
     **deixa como estão**.
3. **Escrever o corpo** em HTML simples. A **1.ª frase tem de ser igual** ao
   `description`.
4. **Acrescentar a rota ao SEO** ⚠️ — o passo mais esquecido: sem isto o post
   fica sem `<title>` nem `<meta name="description">`, e o assert de coerência
   do SPEC-DATA §6.7 falha na extração seguinte. O `site.json` é **reescrito**
   pela extração, por isso a entrada vai para o ficheiro das **overrides**,
   `src/data/seo-overrides.json` (versionado, escrito à mão):
   ```json
   {
     "overrides": {
       "/meu-post/": {
         "title": "O mesmo que o seoTitle do post",
         "description": "O mesmo que o seoDescription do post",
         "status": "draft"
       }
     }
   }
   ```
   (`"status": "draft"` enquanto o texto do Google não está aprovado.) A
   extração funde as overrides por cima do `perUrl` gerado — não se mexe no
   `authored.mjs`.
5. **Publicar**:
   ```bash
   npm run build     # tem de dizer "Complete!"
   npm run guard     # tem de dizer "no secret or personal data found"
   git add src/content/blog/meu-post.md src/data/seo-overrides.json
   git commit -m "content: novo post sobre <assunto>"
   git push origin main
   ```

> **Uma categoria nova** tem de ser criada em `src/data/site.json →
> categories` (com `slug`, `name`, `wpTermId`, `postCount` e `href`) — só
> depois de existirem as entradas de `seo.perUrl` é que a rota
> `/category/<slug>/` aparece.

---

## 7. Escrever uma política nova

1. Copiar `src/pages/politica-de-privacidade.md` para `src/pages/<slug>.md`.
2. O `slug` é o **URL** — `politica-de-privacidade` → `/politica-de-privacidade/`.
3. O `layout` do frontmatter é `~/layouts/PolicyLayout.astro` — **não** trocar.
4. Acrescentar a rota em `src/data/site.json → seo.perUrl` (com
   `"status": "draft"` até a advogada aprovar).

> As políticas **não** são conteúdo técnico: são documento jurídico. Qualquer
> alteração tem de passar pelo advogado (SEC-64, item 3 do Definition of Done).
>
> ⚠️ E atenção: `src/pages/*.md` é **gerado** pela extração (§1) — o texto
> novo entra pelo *overlay* em `scripts/extract/lib/authored.mjs`, não por
> uma edição directa ao ficheiro.

---

## 8. Perguntas frequentes

**A imagem que pus não aparece.**
O caminho tem de existir em `public/wp-content/uploads/`. A forma é
`/wp-content/uploads/2024/12/nome-do-ficheiro.png` — sem o domínio, sem
`https://`.

**Troquei o título e o Google ainda mostra o antigo.**
O `<title>` vem de `src/data/site.json → seo.perUrl["<url>"] → title`. Tem de
mudar **lá** (e no `seoTitle` do post, para ficarem iguais).

**Apareceu "This field is required" em português.**
O `required_field_message` do formulário vem do widget antigo; o texto novo
está em `src/data/site.json → form.fieldErrors`. Ver §1 (campos do form).

**Posso mudar a cor do site?**
Sim, em `public/css/tokens.css` (`--color-accent`, `--color-primary`, …).
As cores **derivadas** de acessibilidade (`--color-accent-text`,
`--color-accent-text-inverse`) não se mexem à mão — estão calibradas para
os rácios de contraste da WCAG (SPEC-UI §4.1).

---

## 9. Nunca edites estes ficheiros

| Ficheiro | Porquê |
|---|---|
| `src/data/elementor/*.json` | são as **árvores do Elementor extraídas** — uma edição à mão quebra a paridade com o CSS verbatim, o `npm run check-parity` falha, e a alteração desaparece na extração seguinte |
| `public/wp-content/**` | é o **fecho de assets gerado** (97 ficheiros / 10 149 570 B): o que lá for acrescentado pode ser apagado. Para uma imagem nova, fala com o developer |
| `public/css/**` (excepto `tokens.css`) | o CSS do Elementor é **verbatim**; a única sobreposição autorizada é o `a11y.css` (o último `<link>` da cascata) |
| `docs/_reference/` | as **contagens medidas** e o CSS dinâmico do Kava — são a *evidência* da migração |
| `public/robots.txt` e `public/CNAME` | o `CNAME` tem de ser exactamente `galastriadvocacia.com.br` (é o que liga o domínio ao Pages) |
| `dist/` | é gerado; corrige-se a fonte e reconstrói-se |
| `.github/workflows/deploy.yml` | as *actions* estão fixadas por SHA e verificadas pelo `npm run verify-workflow`: uma action solta ou um trigger novo (por exemplo `pull_request`) é uma regressão de segurança |
