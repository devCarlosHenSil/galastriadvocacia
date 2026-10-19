# Registo da paridade visual (SPEC-UI §5)

> **O que este ficheiro é:** o registo do que foi medido na paridade visual e
> **quais as divergências que foram aceites, com o motivo de cada uma**. Torna
> auditável o "pixel diff ≤ 2%" do DoD **mesmo sem navegador** (o Playwright
> é opcional e não está instalado — ver `npm run visual-diff`).
>
> **O que este ficheiro NÃO é:** não substitui a captura de ecrã. A medição
> real (a percentagem de píxeis diferentes) **não foi feita**: sem navegador
> não há captura.

## 1. O método (SPEC-UI §5)

| # | Passo | Ferramenta |
|---|---|---|
| 1 | O HTML **verbatim** que o Elementor renderizou (o `_elementor_element_cache` do dump) é a **referência** | `tests/fixtures/elementor-cache-{30,48,49}.html` |
| 2 | A página gerada é comparada com a referência | `npm run check-parity` (ids, **lista de classes**, âncoras e texto visível) |
| 3 | O CSS do Elementor é **copiado verbatim** do backup — a camada que define o design (R1). Sobre ele vêm **duas** folhas nossas: `tokens.css` (os tokens) e `a11y.css` (a sobreposição de acessibilidade), ambas no fim da cascata | `public/css/*.css` (R1) |
| 4 | As **correções** vivem numa sobreposição isolada, no fim da cascata | `public/css/a11y.css` (o contraste, o foco, os alvos de toque) |
| 5 | As **capturas** de ecrã (1440 / 1024 / 390) | `npm run visual-diff` — **requer o Playwright** (não instalado) |

## 2. As 10 secções da home (a ordem do DOM)

| # | Secção | Elemento | Grelha (medida) |
|---|---|---|---|
| 1 | Hero | `af9b6b1` | 1 coluna |
| 2 | Sobre | `7dffe5f` | 2 colunas (o texto + o retrato) |
| 3 | Áreas de Atuação | `845bcff` | **4 colunas** × 1 linha (6 icon-boxes, **2 com `hidden-desktop`** → 4 visíveis) |
| 4 | Serviços | `fc5c748` | **4 colunas** × 3 linhas (12 icon-boxes) |
| 5 | Quem Sou | `quemsou` | 2 colunas |
| 6 | Nossa Equipe | `e2b2a60` | 3 colunas |
| 7 | Depoimentos | `a3ee56d` | carrossel (3 slides) |
| 8 | Artigos do blog | `...` | a grelha do `upk-alex-grid` (3 cartões) |
| 9 | Fale Conosco | `a69d5f8` | 2 colunas (o form + o mapa) |
| 10 | CTA final | — | 1 coluna |

> As colunas foram **medidas no CSS verbatim** (`post-30.css`), não estimadas:
> `--e-con-grid-template-columns: repeat(4, 1fr)` para as "Áreas" e para os
> "Serviços". A SPEC-UI §3.2 foi corrigida (a revisão da UI/UX dizia 3 colunas
> para as "Áreas" — o valor real é 4) e o `npm run check-parity` **afirma** que
> o CSS construído e os `settings` extraídos dizem o mesmo.

## 3. As divergências aceites (e o motivo de cada uma)

| # | Divergência | Onde | Motivo | Efeito visual |
|---|---|---|---|---|
| 1 | Os **ícones sociais** do header e do rodapé têm uma área de toque de **44×44 px** (o alvo mínimo da WCAG 2.5.5 / do SPEC-UI §4.7) | `a11y.css` (`.elementor-social-icon`) | o original tinha ~36 px | o **círculo** mantém o tamanho visual (o `--icon-padding: .6em` do original ✓) — o alvo é maior, o desenho é o mesmo |
| 2 | As **4 etiquetas** do formulário são visíveis (o original tinha só os *placeholders*) | `src/components/elementor/widgets/Form.astro` | o *placeholder* desaparece quando se escreve: o rótulo é a forma acessível | o formulário ocupa ~1 linha a mais por campo |
| 3 | O **mapa** é um *placeholder* com um clique (o iframe só é injetado depois do clique e do consentimento) | `public/js/map.js` | R13 / SEC-44: sem pedido ao Google antes da escolha | o mapa é uma imagem estática até ao clique |
| 4 | O formulário foi **reescrito** (a honeypot, o consentimento da LGPD, o CTA do WhatsApp, as mensagens por campo) | `Form.astro` | R5 / R14 | a área do formulário é maior e o CTA do WhatsApp está ao lado |
| 5 | Os **títulos longos** dos icon-boxes quebram acima de 1367 px (a grelha de 4 colunas tem ~285 px) | `a11y.css` | o `nowrap` do "Additional CSS" (post 136) transbordava | 1–2 linhas a mais nos títulos mais compridos ("Planejamento Previdenciário", "Reconhecimento de União") |
| 6 | O **overlay do consentimento** (o link "Gerenciar preferências" e os links das políticas) está em todas as páginas, mesmo nas que não mostram o rodapé | `BaseLayout.astro` | SEC-64 / SEC-R-12: o link tem de estar em todas as páginas | uma linha no fim de cada página |
| 7 | As **políticas** têm o texto reescrito (o overlay da LGPD) e a numeração sequencial | `scripts/extract/lib/authored.mjs` | SPEC-SECURITY §5.2–§5.4 — **precisa da aprovação do advogado** | o texto é diferente do original (é uma correção legal) |
| 8 | O **`</html>`/`<body>`** saem na ordem certa (o `<noscript>` foi do `<head>` para o `<body>`) | `BaseLayout.astro` | com o `<noscript>` na cabeça, o compilador do Astro fechava a cabeça antes dos últimos elementos — o HTML publicado ficava malformado | nenhum (o HTML é o mesmo) |
| 9 | O `scroll-margin-top` das âncoras é `calc(var(--header-height) + 16px)` | `a11y.css` + `public/js/header-height.js` | a altura do header é medida em runtime (o logo encolhe com a largura) | nenhum |

## 4. O que **não** foi medido

| # | Porquê |
|---|---|
| A **percentagem de píxeis** (o "≤ 2%" do DoD) | o **Playwright** não está instalado (é opcional): `npm run visual-diff` salta com a mensagem. A comparação estrutural (`check-parity`) **não** precisa de navegador e passa. |
| As **capturas** de 1440 / 1024 / 390 px |idem. |
| O **axe** (as violações `serious`/`critical`) |idem. |
| A **cor sobre a fotografia** (A19) — depende da imagem final | só se mede por captura de ecrã. |

## 5. O trabalho de performance que fica (REV-15 / E14)

Os **4 banners** são PNG de 1920 px (651–776 KB cada) e são `background-image`
(sem `<img>`, sem `width`/`height`, sem `fetchpriority`). O do herói é a
imagem do **LCP** — por isso o `<link rel="preload" as="image" fetchpriority="high">`
foi acrescentado em `src/layouts/BaseLayout.astro` (os outros 3 banners estão
**abaixo** da dobra e não são pré-carregados).

**A conversão para WebP/AVIF é o trabalho recomendado** (e **não** foi feito
nesta passagem: é uma mudança visual que o dono tem de aprovar):

```bash
# a imagem original fica intacta; o WebP é uma variante ao lado
magick public/wp-content/uploads/2024/12/galastri-advocacia-banner-destaque.png \
  -resize 1920x -quality 78 -define webp:method=6 \
  public/wp-content/uploads/2024/12/galastri-advocacia-banner-destaque.webp
```

> O `npm run check-parity` compara o **DOM**, as **classes** e o **texto** — **não**
> os bytes das imagens. A conversão **não** quebra a paridade estrutural; muda
> o ficheiro que o CSS aponta (o `background-image` passa a ser o `.webp`
> com um `image-set` ou uma `@media`).

## 6. Como fechar a medição (quando houver navegador)

```bash
npm i -D playwright && npx playwright install chromium
npm run visual-diff        # o script mede e compara com a referência
```

O `visual-diff` usa as **mesmas** viewports do SPEC-UI §5.2 (1440 / 1024 /
390) e a tolerância de 2% do §5.4. As divergências da §3 (acima) são as
**esperadas**: se uma delas passar de 2%, é uma regressão a investigar.
