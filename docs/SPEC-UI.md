# SPEC-UI — Contrato de DOM, inventário de componentes, estados e acessibilidade


> **Fonte:** agente `uiux` — spec de UI/UX com correção mínima de acessibilidade, sobre paridade visual com o Elementor original.
> **Consolidado em:** 2026-10-19.
> **Fontes lidas pelo uiux:** `uploads/elementor/css/post-6.css`, `post-30.css`, `post-48.css`, `post-49.css`, `custom-widget-*.min.css`, `custom-pro-widget-nav-menu.min.css`; `themes/kava/style.css`, `theme.css`; `_elementor_element_cache` / `_elementor_data` / `wp_posts` / `wp_options` / `wp_comments` do dump SQL; snapshot Wayback `20250328152643` (HTML completo + CSS servido).

---

## Rulings do EM aplicados a esta spec

| # | Ruling | O que mudou nesta spec |
|---|---|---|
| **R1** | **O CSS gerado pelo Elementor É copiado verbatim** (**36** arquivos em `uploads/elementor/css/*` + `themes/kava/style.css` + o bloco dynamic inline + CSS dos widgets do Elementor + `custom-pro-widget-nav-menu.min.css` + Upk + ElementsKit + Swiper + Font Awesome 4.7.0 + as animações). | §5.1 fica explícito: o `<head>` do build reproduz a **ordem exata** das folhas do snapshot, e **nenhuma** regra CSS é reescrita. §7 (tokens) **não** mexe em `--e-global-color-*`; só **acrescenta** tokens de texto derivados, numa folha posterior (`tokens.css`) + `a11y.css`. |
| **R7** | **A paleta do Elementor kit (post 6) é canônica**; `theme_mods_kava` só contribui o que o kit não tem. | §7: os tokens de cor saem da paleta do kit; as correções de contraste são **tokens derivados** (`--color-accent-text` / `--color-accent-text-inverse`), nunca a troca de `--e-global-color-accent`. |
| **R11** | **Preloader descartado.** | §1.2: não há componente de preloader. |
| **R12** | **Fontes 100% self-hosted.** Roboto 300/400/500/900 e Montserrat 700 **baixados**; Nunito/Questrial/Qwigley **já locais**; `Amsterdam.ttf` só se referenciado. | §5.1 (ordem dos `@font-face`) e §5.4 (verificação B.3). |
| **R13** | **Banner de cookies é obrigatório** (GTM + AdSense mantidos) e o **Maps iframe é click-to-load, gated on consent**. | §2.8 e §4.5 mantidos e marcados como **obrigatórios**. |
| **R5** | **Formulário com 4 campos** (nome, email, telefone, mensagem). | §2.5 e §4.9: 4 campos, sem `assunto`. |
| **R14** | **Honeypot `_gotcha`** (o nome usado pela Function do próprio site), não `form_fields[form_checkbox]` do Elementor Pro. | §2.5: o nome do honeypot passa a `_gotcha`. |
| **R4** | **Posts na raiz** `/<slug>/`; **categorias** em `/category/<slug>/`; **sem páginas de tag**. | §1.4 e §5.5: o filtro de categorias do blog usa `/category/<slug>/`; não há link para tag. |
| **R9 / R10** | **Post 907 descartado**; **popups 695/1004 descartados**. | §1.3: o container `ddf5b16` (template 695) não é renderizado; o 907 não existe. |

---

## 0. Correções factuais ao briefing (verificadas — ajustar o plano antes de codar)

| # | Briefing afirmava | Realidade verificada | Impacto |
|---|---|---|---|
| C1 | Hero com overlay 0.46 | **Hero NÃO tem overlay.** `af9b6b1` só tem `data-settings="{"background_background":"classic"}"` e **não existe** `af9b6b1::before` no `post-30.css` (grep local: 0 hits). O 0.46 é do container **Nossa Equipe** (`e2b2a60`); o Sobre usa 0.45 e o Contato 0.5. O hero compensa com `text-shadow: 0 0 10px rgba(0,0,0,.54)` no título. | Alto — criar overlay no hero muda a foto e o contraste do CTA. |
| C2 | Logo do header = vertical 327×299 | **Logo do header é HORIZONTAL 560×189** (`site_logo` = attachment `20` = `galastri-advocacia-logo-horizontal-transparente`). O vertical 327×299 (`wp-image-22`) está no **footer**. | Alto — trocar o logo quebra o grid `1fr 3fr 1fr` do header. |
| C3 | Áreas = 4 col, Serviços = 3 col | **Áreas = 4 col** (`b8d750d`: `repeat(4,1fr)` × `repeat(1,1fr)`; 6 itens, **2 deles com `hidden-desktop`** → 4 visíveis). **Serviços = 4 col** (`fc5c748`: `repeat(4,1fr)` × `repeat(3,1fr)`, 12 itens). | **Alto** — as duas revisões discordavam (3 vs 4) e o valor **medido** no CSS verbatim (`post-30.css`) e nos `settings` (`grid_columns_grid.size = 4`) é **4**. Ver §3.2 e o assert de `npm run check-parity`. |
| C4 | Citação Voltaire 40px | Correto **no widget** (`a3ee56d .elementor-heading-title{font-size:40px}`), mas o token do kit `--e-global-typography-60d8fd8` é **47px**. Usar 40px. | Baixo. |
| C5 | Contato com `banner-contato.png` + overlay | `a69d5f8` usa `background-color:#02010121` (13% preto) **+** imagem, com `--overlay-opacity:0.5`. | Baixo. |
| C6 | Página `/links/` = post 843 | Confirmado: 843 tem `_wp_page_template = elementor_canvas`. **Existe também o post 907**, Linktree quase idêntico (mesma imagem de fundo). **R9: publica-se o 843; o 907 é descartado.** | Médio — resolvido. |
| C7 | `post-comments` descartável | Confirmado: `wp_comments` tem **48 linhas, todas pingback ou spam** — nenhum comentário humano. Descartar. | Baixo. |
| C8 | — | O `post-30.css` **local (92.994 B)** e o arquivado (93.362 B) têm o mesmo conteúdo; validado por sampling de prefixo e por grep de regras-chave. | — |

---

## 1. Inventário de componentes e limites

### 1.1 Contrato de DOM (inviolável — o CSS gerado depende dele)

**Container**
```html
<div class="elementor-element elementor-element-{id} {e-flex|e-grid} e-con-boxed
            wpr-particle-no wpr-jarallax-no wpr-parallax-no wpr-sticky-section-no
            e-con e-parent|e-child"
     data-id="{id}" data-element_type="container" data-e-type="container" [id="{cssId}"]>
  <div class="e-con-inner"> …filhos… </div>
</div>
```
Regras: `e-con-boxed` só nos containers que usam `--container-max-width:1140px`; `e-flex`/`e-grid` conforme `--display`; `e-parent` no topo da árvore, `e-child` nos demais. **`data-settings` pode ser omitido** — nenhum seletor de CSS lê esse atributo (verificado em `post-30/48/49.css` e nos `custom-*.min.css`). Manter `data-id` (barato, útil para diff e para o `id` âncora).

**Widget**
```html
<div class="elementor-element elementor-element-{id} [classes de layout do widget]
            elementor-widget elementor-widget-{type}"
     data-id="{id}" data-element_type="widget" data-e-type="widget"
     data-widget_type="{type}.default">
  <div class="elementor-widget-container"> … </div>
</div>
```

> **Atenção às classes de layout**: várias são *funcionalmente necessárias* porque o CSS as usa como seletor. Não podem ser removidas: `elementor-nav-menu--dropdown-mobile`, `elementor-nav-menu--stretch`, `elementor-nav-menu__text-align-center`, `elementor-nav-menu--toggle`, `elementor-nav-menu--burger` (nav); `elementor-position-top` (image-box); `elementor-icon-list--layout-traditional`, `elementor-list-item-link-full_width` (icon-list); `elementor-button-align-stretch` (form); `elementor-labels-` (wrapper de campos); `elementor-view-stacked` / `elementor-view-framed` (icon-box).

**Shell da página (mesma estrutura do snapshot):**
```html
<body class="home page-template page-template-elementor_header_footer page page-id-30
             wp-custom-logo ehf-template-kava ehf-stylesheet-kava layout-fullwidth blog-grid
             elementor-default elementor-template-full-width elementor-kit-6 elementor-page elementor-page-30">
  <div id="page" class="site">
    <a class="skip-link screen-reader-text" href="#content">Pular para o conteúdo</a>
    <header id="masthead" class="site-header">
      <div data-elementor-type="header" data-elementor-id="49"
           class="elementor elementor-49 elementor-location-header"
           data-elementor-post-type="elementor_library"> … </div>
    </header>
    <div id="content" class="site-content">
      <div data-elementor-type="wp-page" data-elementor-id="30"
           class="elementor elementor-30" data-elementor-post-type="page"> … </div>
    </div>
    <footer id="colophon" class="site-footer">
      <div data-elementor-type="footer" data-elementor-id="48"
           class="elementor elementor-48 elementor-location-footer"
           data-elementor-post-type="elementor_library"> … </div>
    </footer>
  </div>
</body>
```
> ⚠️ `elementor-kit-6` **no `<body>`** — é lá que `post-6.css` define `--e-global-color-*` e `--e-global-typography-*`. Sem isso, todo o CSS do Elementor cai para valores não resolvidos.

### 1.2 Inventário por widget

| widgetType | Templates | Implementação | Estado que possui |
|---|---|---|---|
| `heading` | todos | **Componente Astro** `<Heading>` → `<h2 class="elementor-heading-title elementor-size-default">` | apenas `tag` (h1/h2/h3) — ver §4.2 |
| `text-editor` | 30 | **Componente Astro** → `<div class="elementor-text-editor">` com o HTML original | nenhum |
| `divider` | 30 | **Componente Astro** → `<div class="elementor-divider"><span class="elementor-divider-separator"></span></div>` (o widget tem `--divider-border-style:solid; --divider-color:accent; --divider-border-width:3px`; `separator{width:50%;margin:0 auto;margin-left:0}` + `text-align:left`) | nenhum |
| `image` | 30, 48 | **Componente Astro** → `<a href><img class="attachment-full size-full wp-image-N" width height src alt></a>` | nenhum |
| `button` | 30 | **Componente Astro** → `<div class="elementor-button-wrapper"><a class="elementor-button elementor-button-link elementor-size-sm elementor-animation-grow"><span class="elementor-button-content-wrapper"><span class="elementor-button-text">…</span><span class="elementor-button-icon">…svg…</span></span></a></div>` | hover/focus/active — §2.3 |
| `icon-box` | 30 (6 + 12) | **Componente Astro** → `.elementor-icon-box-wrapper > .elementor-icon-box-icon > .elementor-icon-box-content > h2.elementor-icon-box-title` + `p.elementor-icon-box-description` | hover/focus — §2.4 |
| `image-box` | 30 | **Componente Astro** → `.elementor-image-box-wrapper > figure.elementor-image-box-img > img` + `.elementor-image-box-content > h2.elementor-image-box-title` + `p.elementor-image-box-description` | hover/focus — §2.4 |
| `icon-list` | 48 (×3) | **Componente Astro** → `<ul class="elementor-icon-list-items"><li class="elementor-icon-list-item"><a><span class="elementor-icon-list-icon">svg</span><span class="elementor-icon-list-text">…</span></a></li></ul>` | hover do item — §2.7 |
| `social-icons` | 49, 48 | **Componente Astro** → `<div class="elementor-grid"><a class="elementor-social-icon elementor-social-icon-{net}" href target rel aria-label><i class="…"></i></a></div>` | hover — §2.7 |
| `theme-site-logo` | 49 | **Componente Astro** → `<a href="/"><img class="attachment-full size-full wp-image-20" width="560" height="189" src alt></a>` | nenhum |
| `nav-menu` | 49 | **Componente Astro `<NavMenu>`** — precisa emitir **dois** `<nav>` (main + dropdown) + o botão, para casar com `widget-nav-menu.min.css` e `custom-pro-widget-nav-menu.min.css` | breakpoint, hover, dropdown — §2.1/§2.2 |
| `copyright` | 48 | **Componente Astro** → `<div class="hfe-copyright-wrapper"><a href="https://xentrylabs.com.br" target="_blank"><span>Copyright © {ano} …</span></a></div>` | nenhum |
| `upk-alex-grid` | 30 | **`set:html` pass-through** do HTML do grid gerado no build (`.upk-alex-grid > .upk-alex-wrap > .upk-item > .upk-content-wrap > .upk-title/.upk-category/.upk-readmore`) | nenhum (links) |
| `upk-amox-grid` | 516 | idem `upk-alex-grid` | paginação |
| `upk-post-category` | 516 | **Componente Astro** — filtro de categorias (chips/select) | selecionado/não selecionado — §2.9 |
| `elementskit-testimonial` | 30 | **Componente Astro `<TestimonialSlider>`** — precisa reproduzir `.ekit-wid-con > .elementskit-testimonial-slider[data-config] > .ekit-main-swiper.swiper > .swiper-wrapper > .swiper-slide > .swiper-slide-inner > .elementskit-single-testimonial-slider` + `.swiper-pagination` | slide, dots, autoplay — §2.6 |
| `form` | 30 | **Componente Astro `<ContactForm>`** — `<form class="elementor-form" method="post" name="New Form">` com os 4 campos, honeypot `_gotcha` e container de mensagem | todos os estados — §2.5 |
| `google_maps` | 30 | **Componente Astro `<MapEmbed>`** → `<div class="elementor-custom-embed">` com `<iframe>` **carregado sob demanda** | carregado/não carregado — §4.5 |
| `html` | — | **NÃO USADO** em nenhum dos 7 templates | — |
| `post-info` | 525 | **REPLACED** por markup estático equivalente (`<time datetime>`, `<a class="upk-category">`) | — |
| `post-title` | 525 | **REPLACED** por `<h1 class="elementor-heading-title elementor-size-default">` | — |
| `post-featured-image` | 525 | **REPLACED** por `<img>` estático | — |
| `post-content` | 525 | **`set:html`** do conteúdo sanitizado do post | — |
| `author-box` | 525 | **REPLACED** por markup estático (avatar + `<strong>` + bio) | — |
| `post-comments` | 525 | **DROPPED** — `wp_comments` contém apenas pingbacks e spam (48 linhas, 0 humanos) | — |
| `related posts` | 525 | **REPLACED** por grid estático de 3 posts | — |
| `posts` (loop) | 516 | **DROPPED** — substituído por `upk-amox-grid` estático | — |
| **Preloader** | — | **NÃO EXISTE (R11)** — `theme_mods_kava.page_preloader=1` era o preloader de **imagem** do Kava, não um spinner. | — |
| **Cookie banner** | novo | **Componente Astro `<CookieConsent>`** + `<dialog>` de preferências (§2.8) | todos — §2.8 |

### 1.3 Árvore da home (25 containers + 61 widgets = 86 nós da página inteira, ordem exata)

> **Contagem (medida em 2026-10-19):** a árvore abaixo é o inventário do **DOM da página inteira** — header (template 49, **4** nós) + corpo (post 30, **63** nós) + footer (template 48, **19** nós) = **86** nós = 25 containers + 61 widgets. O `meta.elementCount` de `src/data/elementor/home-30.json` vale **63** e conta **só o corpo do post 30** (os templates 49 e 48 são arquivos separados). Os **9** templates de seção (759…784) **não** são somados: o conteúdo já está embutido na árvore do post 30.

```
5a1c209 container (header)          → a299f36 logo · 7a77dab nav-menu · c0012ca social-icons
af9b6b1 #home     → 084a245 h2 · 6fd2079 h2 · 8cfb77d button
7dffe5f #sobre    → e2ab28b → 02bcc83 divider · b7fa39f h1 · 67ccd3a text-editor · dd28795 → 4b8b744 image
845bcff #areasdeatuacao → 87bb8c7 h2 · 80c99f5 h2 · b8d750d(grid) → 30d8c26 ad2bac4 bcd56c5 9c05309 efc07e5 fe8497c (icon-box)
dd1df9b #servicos → 9bb6899 h2 · 24ebf0c h2 · fc5c748(grid) → bc731ec 3942d0f 1fe7e32 517911a 66c7841 19ef0e5
                                                          ac93d1a 5f8a0ca fc68968 e2899d9 58d53c7 b17667f (icon-box)
2f1b5f2 (blog)    → 92fa1a8 h2 · fefdbd4 h2 · 290d6a8 upk-alex-grid · 011caa0 button
e2b2a60 #quemsou  → ff7acb3 h2 · 5adf940 h2 · 14b82dd(grid) → ea6573c image-box
6d564f8 (depoimentos) → 100fed7 h2 · c06a067 h2 · 5f31c3f elementskit-testimonial
0c92c76 (citação) → a3ee56d h2 · 269416c h2
a69d5f8 #contato   → 4cafe7c → 09f0ede h2 · c3cd150 h2 · 3273196 form   ‖  a50453d → c2265f5 google_maps
78422c7 → 3666b99(footer grid) → 3303072 → c34d807 image · 50673f0 h2 · 39952cb social-icons
                                       → f1416de → a9626d7 h2 · 2749d9b icon-list
                                       → c6a6d40 → 0e429b2 h2 · a271cfc icon-list
                                       → 00837e6 → e423663 h2 · e8d3c97 icon-list
                              → 16c7b5e → 4b48758 copyright · e1bd7cb · 789d679 · 79541a9 (h2 com link)
```

Footer: `3666b99` = grid `repeat(4,1fr)` (4 colunas) + barra inferior `16c7b5e` (flex row, `space-between`, bg `#2E2E2EF2`). `ddf5b16` = container vazio do template "Modelo Popup - Recesso" → **DROPPED (R10)**, sem efeito visual.

### 1.4 Rotas que a UI precisa respeitar (R4)

| Tela | Rota | Observação |
|---|---|---|
| Home | `/` | âncoras `#home`, `#sobre`, `#areasdeatuacao`, `#servicos`, `#quemsou`, `#contato` |
| Alias | `/home/` | `canonical` → `/` + meta-refresh |
| Arquivo do blog | `/blog/` | filtro de categorias → `/category/<slug>/` (R4) |
| Post | `/<slug>/` | **na raiz** (R4) |
| Categoria | `/category/<slug>/` | 3 páginas (R4) |
| Tags | **sem rota** (R4) | apenas frontmatter — nenhum link de tag na UI |
| Links | `/links/` | post 843 (R9) |
| Políticas | `/politica-de-privacidade/`, `/politica-de-cookies-galastri-advocacia/`, `/politica-de-uso-de-inteligencia-artificial-galastri-advocacia/` | páginas nativas (R8) |
| 404 | `/404` | template 790 |

---

## 2. Estados de interação

### 2.1 Itens de navegação (desktop, header `7a77dab`)

Token base: `font: "Questrial" 15px/1.6 500; text-transform:uppercase; padding:0 8px; color:#F3F3F3` (header bg `#2E2E2E`).

| Estado | Tratamento | Origem |
|---|---|---|
| default | `color:#F3F3F3` (12.24:1 ✓) | `post-49.css` `7a77dab .elementor-nav-menu--main .elementor-item{color:var(--e-global-color-6809653)}` |
| hover | `color:#C09A6B` **← trocado** (era `accent` #B68C5A = 4.45:1 ✗) + pseudo-elemento `::after` duplo-linha `background:#C09A6B; height:1px` + `transform:scale(1)` | `custom-pro-widget-nav-menu.min.css` (`.e--pointer-double-line`) |
| focus-visible | idem hover + **anel de foco** `outline:2px solid #E8C79A; outline-offset:3px` | novo (§4.3) |
| atual (`aria-current="page"`) | `color:#C09A6B` + `::before/::after` `transform:scale(1)` (sem `opacity:0`) — o CSS base zera a opacidade do pseudo-elemento **apenas** quando não há `:hover/:focus/.elementor-item-active/.highlighted` | `custom-pro-widget-nav-menu.min.css` |
| dropdown aberto | o bloco `<nav class="elementor-nav-menu--dropdown">` recebe `aria-hidden="false"`; `a:hover/:focus/.elementor-item-active/.highlighted{background-color:#C09A6B}` + `color:#2E2E2E` | `post-49.css` |

> **Correção obrigatória**: no original, **todos** os links-âncora (`Sobre`, `Áreas de Atuação`, `Serviços`, `Quem Sou`, `Contato`) recebem `aria-current="page"` no HTML. Isso é semanticamente falso (são seções da mesma página). Remover `aria-current` dos âncoras e manter apenas em `Home` (rota `/`).

### 2.2 Toggle de menu mobile

Elementor renderiza **dois** `<nav>` e alterna por breakpoint. Contrato a preservar:

```html
<nav aria-label="Menu principal" class="elementor-nav-menu--main elementor-nav-menu__container elementor-nav-menu--layout-horizontal e--pointer-double-line e--animation-fade">
  <ul id="menu-1-7a77dab" class="elementor-nav-menu"> … </ul>
</nav>
<button type="button" class="elementor-menu-toggle" aria-expanded="false" aria-controls="menu-2-7a77dab" aria-label="Abrir menu">
  <svg class="elementor-menu-toggle__icon--open  …">…</svg>
  <svg class="elementor-menu-toggle__icon--close …">…</svg>
</button>
<nav class="elementor-nav-menu--dropdown elementor-nav-menu__container" aria-hidden="true" aria-label="Menu principal (mobile)">
  <ul id="menu-2-7a77dab" class="elementor-nav-menu"> … </ul>
</nav>
```

| Estado | Tratamento |
|---|---|
| fechado | `<nav class="elementor-nav-menu--main">` visível **apenas ≥768px**; `.elementor-nav-menu--dropdown{display:none}`; toggle mostra o ícone `--open` (hambúrguer) |
| aberto | `.elementor-nav-menu--dropdown` passa a `display:block`; o toggle troca para o ícone `--close` (X) — os dois SVGs já existem no DOM, o CSS troca a visibilidade; `aria-expanded="true"`, `aria-hidden="false"` no dropdown; `margin-top:42px !important` (regra de `post-49.css` ≤767px) |
| focus-visible | `color:#C09A6B; fill:#C09A6B` (o original usava `accent` = 4.45:1 ✗) **+** anel `outline:2px solid #E8C79A; outline-offset:3px` |

> ⚠️ **A abertura é feita pela classe `elementor-active` no `<button>`** (U2,
> medido em 2026-10-19): a regra do Elementor Pro é
> `.elementor-nav-menu--toggle .elementor-menu-toggle.elementor-active +
> .elementor-nav-menu__container` — o painel é o **irmão seguinte** do toggle.
> A classe `elementor-nav-menu--dropdown-open` **não existe em nenhum CSS**.
> O painel fechado leva **`inert`** (e não só `aria-hidden`), para que os
> seus links não sejam focáveis (axe `aria-hidden-focus`).

**Correções a11y (obrigatórias):**
1. `<div role="button" tabindex="0">` → `<button type="button" class="elementor-menu-toggle" aria-expanded="false" aria-controls="menu-2-7a77dab">`. Mantenha as **duas classes SVG** (`elementor-menu-toggle__icon--open` / `--close`) — o CSS de `widget-nav-menu.min.css` depende delas.
2. `aria-label="Menu Toggle"` (inglês) → `"Abrir menu"` / `"Fechar menu"` conforme `aria-expanded`.
3. `Enter`/`Space` ativam o botão (nativo). `Esc` fecha e devolve o foco ao toggle.
4. Alvo de toque: o SVG de 1000×1000 renderizado em `font-size` do container → dimensionar a caixa em **44×44 px** (`min-width/min-height:44px`), mantendo o traço original.
5. O `<button>` precisa de uma **regra própria** (`button.elementor-menu-toggle`): o `post-49.css` estiliza `div.elementor-menu-toggle` (cor e `fill`), que não existe no site.

### 2.3 Botões

Base (kit `post-6.css`): `background:var(--accent); color:#FFFFFF; font:"Questrial" 15px 600; border-radius:30px; padding` do `widget-button.min.css`.

| Estado | Tratamento original | Tratamento especificado | Razão |
|---|---|---|---|
| default | bg `#B68C5A`, texto `#FFFFFF` | bg `#BC9265`, texto `#2E2E2E` | `#FFFFFF` sobre `#B68C5A` = **3.05:1 ✗**. Nenhum tom de gold comporta texto branco *e* grafite a 4.5:1 a 15px. Claro sobre gold = **4.81:1 ✓**. A inversão (grafite sobre gold) é **exatamente o hover que o original já faz** — mantém a assinatura visual. |
| hover | bg `#B68C5A`, texto `#2E2E2E` | bg `#C9A377`, texto `#2E2E2E` (**5.81:1 ✓**) | o hover original não pode sobreviver (texto branco sobre gold) |
| focus-visible | idem hover | idem hover + `outline:2px solid #2E2E2E; outline-offset:3px` (anel escuro sobre o gold — `#2E2E2E` sobre `#C9A377` = 5.81 ✓) | foco precisa de 3:1 contra o adjacente |
| active | (não existia) | bg `#C9A377` + `box-shadow: inset 0 2px 4px rgba(0,0,0,.20)` | afordância de pressionado sem quebrar contraste |
| disabled | (não existia) | `opacity:.55; cursor:not-allowed` | não usado no site atual; reservado para o formulário durante envio |

**Variante "Ver todos" (blog) — `011caa0`:** bg `#F3F3F3`, texto `#2E2E2E` (12.24 ✓), `text-transform:uppercase`, `padding:0`. Hover/focus: texto → `#8A6132` (**5.47:1 ✓**; o original usava `accent` = 3.05:1 ✗). Botão é um `<a>` (navega) — não remover `href`.

**Variante 404 "Voltar ao início":** ver §6 (typo "inínicio").

### 2.4 Icon-box e image-box

| Elemento | default | hover | focus |
|---|---|---|---|
| Áreas — título (22px, sobre card `linear-gradient(#FFFFFF14 → #2E2E2E)`) | `#C09A6B` **← trocado** (era `accent` 4.45 ✗ → 5.22 ✓) | `:has(:focus) .elementor-icon-box-title{color:var(--primary)}` (regra global do `post-30.css` — **manter**) | anel `2px solid #E8C79A` no wrapper |
| Áreas — descrição (15px) | `#B5B5B5` **← trocado** (era `#7A7A7A` = 3.16 ✗ → 6.62 ✓) | idem | — |
| Serviços — título (22px, card branco) | `#8A6132` **← trocado** (era `accent` = 3.05 ✗ → 5.47 ✓) | `:has(:focus)` → `#2E2E2E` | anel `2px solid #9C6E3C` |
| Serviços — descrição (15px, card branco) | `#6E6E6E` **← trocado** (era `#7A7A7A` = 4.29 ✗ → 5.10 ✓) | idem | — |
| Card Áreas | `background:linear-gradient(180deg,#FFFFFF14 0%, var(--primary) 100%); border-radius:10px; box-shadow:0 2px 15px rgba(0,0,0,.13)` | `background-color:#3D3D3D` (mantido) | — |
| Card Serviços | sem card (fundo branco da seção) | — | — |
| Card image-box (equipe) | `background:linear-gradient(180deg,#F3F3F34A 0%,#FFFFFF 100%); border-radius:10px; box-shadow:0 1px 15px rgba(0,0,0,.16)` | `background-color:#FFFFFFE8` | anel claro |
| Ícone do icon-box | `fill/color: accent` (decorativo — 3:1 vs adjacente; no card escuro 4.45 ✓, no branco 3.05 ✓) | — | — |

> Os 6 ícones de Áreas e os 12 de Serviços são **decorativos**: `alt=""` + `aria-hidden="true"` no `<svg>`. O `icon-box` **não** deve ter link clicável no título quando o link é só âncora decorativa — ver §4.4.

### 2.5 Formulário (widget `3273196`) — **4 campos** (R5)

Estrutura original (verificada no HTML):
```
form.elementor-form[method=post]
  input[hidden] post_id / form_id / referer_title / queried_id
  div.elementor-form-fields-wrapper.elementor-labels-
    div.elementor-field-type-text.…elementor-field-required → input#form-field-name      (SEM <label>)
    div.elementor-field-type-email.…elementor-field-required     → label[for=form-field-email].elementor-screen-only + input#form-field-email
    div.elementor-field-type-maskphone_with_ddd.…elementor-field-required → label[for=form-field-field_d252ca6].elementor-screen-only + input#form-field-field_d252ca6
    div.elementor-field-type-textarea.…elementor-field-required   → textarea#form-field-message (SEM <label>)
    div.elementor-field-group.elementor-field-type-submit        → button.elementor-button[type=submit] > span.elementor-button-content-wrapper > span.elementor-button-text "Enviar"
```
> `elementor-screen-only` **é** uma classe real de ocultação visual (em `custom-frontend.min.css`: `position:absolute;top:-10000em;width:1px;clip:rect(0,0,0,0)`). Os labels de e-mail e telefone **existem** — mas são invisíveis e os campos de **nome e mensagem não têm label nenhum**.
> **Nome dos campos no site novo** (R5, mapeados para a Function do próprio site): `nome`, `email`, `telefone`, `mensagem` — os `name` do Elementor (`name`, `email`, `field_d252ca6`, `message`) **não** são usados diretamente.

**Estados (todos os valores abaixo vêm do CSS existente):**

| Estado | Tratamento | Valor |
|---|---|---|
| idle | campo: `background:#2E2E2ECF; border:1px solid #F3F3F34D; border-radius:30px; color:#F3F3F3; font:"Nunito" 15px 500` | texto do campo `#F3F3F3` sobre `#2E2E2E` = **12.24:1 ✓** |
| focus | borda → `2px solid #E8C79A` (**8.45:1** vs `#2E2E2E` ✓) + `outline:none` **somente** com `:focus-visible` + anel `2px solid #E8C79A; outline-offset:2px` | a borda original (`#F3F3F34D` ≈ 1.9:1) **não** cumpre 3:1 — corrigir |
| filled | idem idle; `placeholder` visível em `#B5B5B5` | placeholder original herda `#7A7A7A` = 3.16 ✗ |
| inválido (nativo) | `border:2px solid #E23B48` (**3.2:1** vs `#2E2E2E` ✓) + mensagem `role="alert"` abaixo do campo | `#C1121F` sobre `#2E2E2E` = 2.18 ✗ → usar tom claro |
| inválido (custom, Elementor Pro) | idem + `.elementor-message-danger` | — |
| enviando | botão `disabled` + `opacity:.55` + `aria-busy="true"` no form | — |
| sucesso | `<div class="elementor-message elementor-message-success" role="status" aria-live="polite">` — bg `#FFFFFF`, `border-left:4px solid #0A7240`, texto `#0A7240` (**5.42:1** sobre `#F3F3F3`) | o original só pintava o texto (`#0C884A` = 2.26 sobre fundo escuro ✗) |
| erro | `<div class="elementor-message elementor-message-danger" role="alert">` — bg `#FFFFFF`, `border-left:4px solid #C1121F`, texto `#C1121F` (5.61 ✓) | — |

**Honeypot (R14):** campo `name="_gotcha"` com `type="text"`, `tabindex="-1"`, `aria-hidden="true"`, `autocomplete="off"`, escondido por CSS (`position:absolute;left:-9999px` — fora da viewport, mas detectável por bot). **Não** usar `display:none` puro (alguns bots ignoram).

**Máscara de telefone:** manter `(00) 00000-0000`. `inputmode="tel"`, `autocomplete="tel"`, `pattern="^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$"`, `maxlength="19"`.

**Atributos a11y obrigatórios (os 4 campos):**

| Campo | `type` | `autocomplete` | `inputmode` | `aria-*` |
|---|---|---|---|---|
| Nome | `text` | `name` | `text` | `aria-required="true"`, `aria-describedby="err-name"` |
| E-mail | `email` | `email` | `email` | idem |
| Telefone | `tel` | `tel` | `tel` | idem |
| Mensagem | `textarea` | — | — | `aria-required="true"`, `aria-describedby="err-message"` |

**Label:** os 4 campos precisam de `<label for>` **real**. Os dois que faltam (`nome`, `mensagem`) recebem label **visível** — não `screen-only` — porque o design original **não tem** label visível e a UX de formulário de contato sem label é ambígua. **Escolha A (visíveis)**: custo visual = ~20px de altura por campo; ganho = WCAG 1.3.1 e 3.3.2 reais. Se a prioridade for paridade pixel-perfect absoluta, manter `elementor-screen-only` nos 4 e aceitar o custo.

**Consentimento LGPD:** ver §6.5.

### 2.6 Slider de depoimentos (ElementsKit)

Configuração real extraída do `data-config`:
```json
{"rtl":false,"arrows":false,"dots":true,"pauseOnHover":true,"autoplay":true,
 "speed":1000,"slidesPerGroup":1,"slidesPerView":3,"loop":false,
 "breakpoints":{"320":{"slidesPerView":1,"slidesPerGroup":1,"spaceBetween":10},
                "768":{"slidesPerView":2,"slidesPerGroup":1,"spaceBetween":10},
                "1024":{"slidesPerView":3,"slidesPerGroup":1,"spaceBetween":15}}}
```

| Elemento | Estado | Tratamento |
|---|---|---|
| Slide | em foco | card `background:#F3F3F3; border-radius:10px; box-shadow:0 1px 15px rgba(0,0,0,.13)`; `min-height:260px` (≤1200px → 270px); texto `#2E2E2E`; autor `#2E2E2E` Questrial 15/600; foto 100×100 |
| Estrelas | — | `color/fill: accent` 20px → **2.75:1** sobre `#F3F3F3` ✗ → `#8A6132` (**4.93 ✓**) |
| Dot | inativo | `background:#B68C5A; width:8px; height:8px` — no fundo da seção `#2E2E2E` → 4.45 ✓ (≥3) |
| Dot | ativo | `width:8px; height:8px; transform:scale(1.2)` (mantido) + `aria-current="true"` |
| Dot | foco | anel `2px solid #E8C79A; outline-offset:3px` |
| Dot | alvo de toque | o `<span>` de 8×8 é **insuficiente**. Renderizar como `<button type="button" class="swiper-pagination-bullet" aria-label="Ver depoimento N">` com `::after{content:"";position:absolute;inset:-18px}` → área de toque **44×44**, mantendo o visual de 8px |
| Autoplay | — | 1000ms, `pauseOnHover:true`. **Adicionar** `pauseOnFocus` e um botão "Pausar/Retomar slideshow" (WCAG 2.2.2) |
| `prefers-reduced-motion` | — | autoplay **desligado**, transição `0ms` (ver §4.6) |
| Carrossel | sem `aria-live` | adicionar `aria-roledescription="carrossel"`, `aria-label="Depoimentos de clientes"`, e `aria-live="off"` enquanto em autoplay, `aria-live="polite"` quando pausado |

### 2.7 Links do rodapé, ícones sociais e listas

| Elemento | default | hover | focus-visible |
|---|---|---|---|
| Link de `icon-list` (Institucional / Áreas / Contato) | `#F3F3F3` 15px (12.24 ✓) | `#C09A6B` **← trocado** (era `accent` 4.45 ✗) + `transition:color .3s` | anel `2px solid #E8C79A; outline-offset:3px` |
| Ícone do `icon-list` | `#F3F3F3` (`fill`) | `#C09A6B` **← trocado** + `transition:fill .3s` | idem |
| Título de coluna do rodapé (`a9626d7`, `0e429b2`, `e423663`) | Questrial 20px 600 `#B68C5A` → `#C09A6B` **← trocado** (4.45 ✗ → 5.22 ✓) | — | anel claro |
| `50673f0` ("Soluções Jurídicas Personalizadas") | 19px `#B68C5A` → `#C09A6B` **← trocado** | — | anel claro |
| Links de política (`e1bd7cb`, `789d679`, `79541a9`) | `#FFFFFF` 15px (13.58 ✓) | `#C09A6B` **← trocado** | anel claro |
| Copyright (`4b48758`) | `#FFFFFF` (regra `post-48.css`); texto "Copyright © {ano} Galastri Advocacia - Jundiaí \| SP \| Desenvolvido por Xentry Labs" | link Xentry → `#C09A6B` | anel claro |
| Social icon do header (`c0012ca`) | `background:#FFFFFF24; border:1px solid #FFFFFF; icon:#FFFFFF`; `--icon-size:20px` | `background:#B68C5A; border-color:#B68C5A` + **ícone → `#2E2E2E`** (branco sobre gold = 3.05 ✗) | anel `2px solid #E8C79A` |
| Social icon do rodapé (`39952cb`) | `background:#2E2E2E; border:1px solid #B68C5A; icon:#F3F3F3` | `background:#B68C5A` + ícone `#2E2E2E` | anel claro |
| **Alvo de toque dos social icons** | `--icon-size:20px` → caixa `calc(20px + 2×.5em)` = **40×40** ✗ | corrigir para `--icon-padding:.6em` → **44×44** | — |
| Separador de item do `icon-list` | `border-color:#7A7A7A` (`border-color:var(--e-global-color-text)`) | — | trocar por `#8A6132` (3.05 ✓, divisor decorativo em fundo escuro) |

### 2.8 Banner de cookies (novo componente — **OBRIGATÓRIO**, R13)

Requisito do dono: manter **GTM (`GTM-KDNG3QWB`)** e **AdSense (`ca-pub-5989678973778468`)**. Então o banner é **obrigatório** e o Consent Mode precisa de defaults `denied`.

> ⚠️ **Atualizado em 2026-10-19** (PASS A, D28): o **contentor do GTM já não
> está no `<head>`**. O `<head>` só tem o `gtag('consent','default', …'denied')`;
> o contentor e a tag do AdSense são **injetados por
> `public/js/cookie-consent.js`**, **depois** de `gtag('consent','update',…)` e
> **só com consentimento**. O banner (e o painel de preferências) é
> **obrigatório**; o contentor do GTM **não** é carregado antes da escolha.

| Estado | Tratamento |
|---|---|
| primeira visita | banner fixo no rodapé, `background:#FFFFFF`, `border-top:1px solid #E5E5E5`, `box-shadow:0 -4px 20px rgba(0,0,0,.12)`, `padding:20px`, `max-width:1140px` centralizado, `z-index:9000` |
| botão "Aceitar" | `background:#2E2E2E; color:#FFFFFF; border-radius:30px; font:"Questrial" 15px 600; padding:12px 28px; min-height:44px` |
| botão "Rejeitar" | **mesmo peso visual**: `background:#FFFFFF; color:#2E2E2E; border:1px solid #2E2E2E; border-radius:30px; mesma fonte/padding/altura` — **nunca** um link cinza |
| "Gerenciar preferências" | link `Questrial 15px 600` com `text-decoration:underline`, `color:#8A6132` (5.47 ✓ sobre branco) |
| preferências abertas | **dialog** `<dialog>` nativo: `max-width:640px; border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,.28)`; 3 linhas com checkbox + rótulo + descrição; "Necessários" **desabilitado e marcado** (sempre ativo, `aria-disabled="true"`, `checked`); "Analíticos" e "Publicidade" **desmarcados por padrão** |
| preferências salvas | dialog fecha, banner **não** reaparece; confirmação via `role="status"` oculto por 4s |
| foco | anel `2px solid #9C6E3C; outline-offset:3px` (sobre branco = 4.46 ✓) |
| teclado | banner **não** prende o foco (não é modal) — `Esc` não faz nada; o botão de fechar (X) deve existir; tabulação natural. O **dialog** de preferências: focus trap, `Esc` fecha, `aria-modal="true"`, foco volta ao disparador |

**Persistência:** `localStorage` key `ga_consent` → `{necessary:true, analytics:bool, ads:bool, ts:ISO}`. Ausência = banner aparece. **`localStorage` não é herança** — limpar o storage reabre o banner (comportamento correto e desejado).

**GTM/AdSense:** carregar o GTM **sempre**, mas com `gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'})` antes do `gtag/js`. O `adsbygoogle.js` só é injetado após `ads:true`. O script do GTM **não** deve ser bloqueado por `type="text/plain"` condicional sem Granted — apenas os tags de Ads dependem do consentimento.

**Maps:** o iframe **não** deve ser carregado antes do consentimento → §4.5.

### 2.9 Âncoras e `scroll-margin-top`

O header é **sticky** (`"sticky":"top"`, `sticky_on:[widescreen,desktop,laptop,tablet_extra,tablet,mobile]`, `sticky_offset:0`).

> ⚠️ **Medido em 2026-10-19** (U1, D36/D37): o `.site` do tema Kava tem
> `overflow: hidden` (copiado **verbatim**, R1) → o antepassado tornava-se um
> contentor de scroll e o `position: sticky` do header **não colava**. A
> correção está na sobreposição (`a11y.css`): `overflow: clip` (que não cria
> contentor de scroll) com o fallback `@supports not (overflow: clip)`.
>
> A altura do header **depende da largura** (o logo encolhe com a grelha
> `1fr 3fr 1fr`) e não há navegador para a medir: em vez de fixar um valor
> por breakpoint, a altura é **medida em runtime** e publicada em
> `--header-height` (`public/js/header-height.js`). O CSS usa:
> ```css
> #sobre, #areasdeatuacao, #contato,
> #servicos, #quemsou { scroll-margin-top: calc(var(--header-height) + 16px); }
> @media (max-width: 767px) {
>   #sobre, #areasdeatuacao, #contato, #servicos, #quemsou {
>     scroll-margin-top: calc(var(--header-height) + 8px);
>   }
> }
> ```
> O token `--header-height: 100px` (`tokens.css`) é o **fallback** para as
> páginas sem JavaScript.

> `scroll-behavior: smooth` só sob `prefers-reduced-motion: no-preference`.

### 2.10 As três páginas de política

Os corpos vêm do WordPress (Gutenberg) e são **reformatados na fonte**
(`scripts/extract/lib/overlay.mjs`):

| # | Correção | Data |
|---|---|---|
| 1 | O contorno do documento: os `<h4>` do WordPress (e o `<h3>` do título repetido no corpo da política de cookies) descem para **`<h2>`** — o outline fica **h1 → h2**. A demoção acontece **depois** do overlay da LGPD (o texto acrescentado também traz `<h4>`). | 2026-10-19 (U19) |
| 2 | O bloco `.policy*` (`.policy`, `.policy-title`, `.policy-content`) passa a ter tipografia, medida e espaçamento: `max-width:1140px`, `h1` Questrial 47/600, secções 24/19px, `p` Nunito 15/500 `line-height:1.6`, listas indentadas e tabelas com borda. **Não havia nenhuma regra** para estas classes → a página saía com a tipografia do navegador. | 2026-10-19 (U19) |

A extração **afirma** que nenhuma política fica com um título de nível ≥ 3.

---

## 3. Comportamento responsivo

### 3.1 Mapa de breakpoints (do CSS gerado, não estimado)

| Elementor bp | CSS | Largura |
|---|---|---|
| widescreen | `@media (min-width:2400px)` | ≥2400 |
| desktop | (base) | 1367–2399 |
| laptop | `@media (max-width:1366px)` | 1201–1366 |
| tablet_extra | `@media (max-width:1200px)` | 1025–1200 |
| tablet | `@media (max-width:1024px)` | 768–1024 |
| mobile | `@media (max-width:767px)` | ≤767 |

**Atenção:** entre 1201–1366 valem as regras de 1366; **não existe** `@media (max-width:1200px)` que mude colunas — o único efeito em 1200px é `--grid-auto-flow:row` em `b8d750d`, `fc5c748`, `14b82dd`.

### 3.2 Tabela de colunas (valores lidos do CSS)

> ⚠️ **Medido em 2026-10-19** (U23): a tabela abaixo foi relida do `post-30.css` **verbatim** e comparada com os `settings` extraídos (`grid_columns_grid.size`). A grade das **"Áreas" tem 4 colunas** (não 3): `b8d750d` declara `repeat(4, 1fr)` × `repeat(1, 1fr)` e 2 dos 6 icon-boxes têm `hidden-desktop` → 4 visíveis na grade. O `npm run check-parity` verifica que o CSS construído e os `settings` dizem o mesmo — a divergência não pode passar despercebida.

| Grid | base (≥1367) | ≤1366 | ≤1024 | ≤767 |
|---|---|---|---|---|
| **Áreas** `b8d750d` | `repeat(4, 1fr)` × `repeat(1,1fr)` | `repeat(4,1fr)` × `repeat(1,1fr)` | `repeat(2,1fr)` × `repeat(3,1fr)` | `repeat(1,1fr)` |
| **Serviços** `fc5c748` | `repeat(4, 1fr)` × `repeat(3,1fr)` | `repeat(3,1fr)` × `repeat(2,1fr)` | `repeat(2,1fr)` × `repeat(3,1fr)` | `repeat(1,1fr)` |
| **Equipe** `14b82dd` | `repeat(1,1fr)`, `--content-width:400px` (≥768px) | `--grid-auto-flow:row` | `--grid-auto-flow:row` | `repeat(1,1fr)` |
| **Rodapé** `3666b99` | `repeat(4,1fr)` | `repeat(4,1fr)` | `repeat(4,1fr)` → **`1fr 1fr 1fr 2fr`** | `1` (1 coluna) |
| **Header** `5a1c209` | `1fr 3fr 1fr` (column) | `1fr 3fr 1fr` | **`1fr 3fr`** | **`3`** (1 coluna) + `grid-justify-content:center` |

### 3.3 Por seção da home

| Seção | ≥1367 | ≤1366 | ≤1200 | ≤1024 | ≤767 |
|---|---|---|---|---|---|
| **Hero** `af9b6b1` | flex column, `min-height:500px`, `justify-content:center`, `padding:50px` | idem | `min-height:450px` (regra em ≤1024) | `min-height:450px`, `padding:20px` | `min-height:460px`, `justify-content:flex-end`, `padding:20px`, **`background-position:-800px 0`** (recorte do banner) |
| Hero título `084a245` | `width:66%; max-width:66%` | idem | idem | `width:580px; max-width:580px` | `width:100%; max-width:100%; text-align:left`, `font-size:26px` |
| Hero subtítulo `6fd2079` | 19px | idem | idem | idem | idem (19px) |
| **Sobre** `7dffe5f` | flex row, `min-height:550px`, `align-items:center`, `padding-left:80px` (no `dd28795`) | idem | `padding:20px` | `flex-direction:column`, `padding:20px 20px 40px` | `padding:20px`; `dd28795` → `padding:15px 15px 35px`; `b7fa39f` → 33px; `4b8b744 img{width:70%}` (≤1024) |
| **Áreas** `845bcff` | `padding:50px` | idem | `padding:20px` | idem | `padding:20px`; `87bb8c7` → 38px; grid 1 col; `text-align:center` (≤767) vs `justify` (≤1024) |
| **Serviços** `dd1df9b` | `padding:50px`; bg `#FFFFFF` | idem | `padding:20px` | idem | `padding:20px`; `9bb6899` → 38px; grid 1 col; `text-align:center` (≤767) |
| **Blog** `2f1b5f2` | `padding:70px`; bg `#F3F3F3` | idem | `padding:20px` | idem | `padding:20px`; `92fa1a8` → 38px; `fefdbd4` → 17px |
| **Equipe** `e2b2a60` | flex column, `padding:50px`, overlay .46 | idem | `padding:20px` | idem | `padding:20px`; `ff7acb3` → 38px |
| **Depoimentos** `6d564f8` | `padding:50px 50px 80px`; bg `#2E2E2E` | idem | `padding:20px` | idem | `padding:40px 20px 80px`; `100fed7` → 38px; `a3ee56d` → 36px |
| **Citação** `0c92c76` | `padding:10px`; bg `#F3F3F3` | idem | idem | idem | idem |
| **Contato** `a69d5f8` | flex row, `padding:5px`, overlay .5 | idem | `padding:20px` | idem | `padding:20px`; `4cafe7c`/`a50453d` → `--width:50%` **só ≥768px** (→100% abaixo) |
| **Formulário** | 1 coluna (`elementor-col-100`), `button_width:100` | idem | idem | idem | idem — **o formulário é 1 coluna em todas as larguras** (não há layout 2-col) |
| **Slider** | `slidesPerView:3`, `spaceBetween:15` | idem | idem | `spaceBetween:10` | ≤767: `slidesPerView:1` (bp 320) / `2` (bp 768→1024) |

**Blog (grade `upk-alex-grid`)**: `.upk-alex-wrap{gap:20px 20px}`; `.upk-item{border-radius:5px}`; `.upk-content-wrap{backdrop-filter:blur(10px)}`; título `Questrial 15px 600` (`--e-global-typography-accent`); categoria `Nunito 15px 500`. Colunas: **3** (home, desktop) — o `upk-alex-grid` do post 30 mostra 3 posts; em ≤1024 o `.upk-title` cai para `--e-global-typography-accent-font-size` (15px) e a categoria para `--e-global-typography-text-font-size` (15px).

### 3.4 Breakpoints quebrados no original (e correção mínima)

| # | Onde | Sintoma | Correção mínima |
|---|---|---|---|
| **B1** | `white-space:nowrap` em `.elementor-icon-box-title` (Additional CSS, post 136) | Títulos como "Planejamento Previdenciário" (25 ch) e "Reconhecimento de União" **não quebram linha**. Na grade de 4 col do serviço (≈262px/col com padding 20px) o texto a 22px Questrial passa de ~270px → **overflow horizontal / corte**. A 2 col (≤1024) piora. | `@media (min-width:1367px){ .elementor-icon-box-title{ white-space:normal; } }` — **o limite foi invertido** (C18): a grelha de 4 colunas (≈285 px) é a mais apertada e está **acima** de 1367 px; abaixo disso a grelha tem 3 colunas (≈380 px) e o `nowrap` cabe. Implementado em `public/css/a11y.css`. |
| **B2** | `.elementor-icon-box-icon, .elementor-icon-box-title{font-size:16px}` (≥769px) no Additional CSS | Morto: a especificidade do `post-30.css` (`.elementor-30 .elementor-element.elementor-element-{id} .elementor-icon-box-title` = 0,4,0) vence o Additional CSS (0,1,0). **O `display:flex` do Additional CSS também aplica** e converte o `<h2>` em flex container. | Não é bug; **não** replicar as regras de `font-size` do Additional CSS (mantêm o tamanho 22px real). Replicar apenas `white-space` com a correção B1. |
| **B3** | `5a1c209` ≤767px → `--e-con-grid-template-columns:3` | Valor inválido (`3` sem unidade) → a coluna vira `3` (interpretado como `3px` ou ignorado). **O header mobile renderiza com 1 coluna só por acidente do CSS do plugin.** | Fixar `1fr` (e `grid-auto-flow:row`) no mobile. |
| **B4** | `14b82dd` ≥768px → `--content-width:400px` em um container **grid** | `--content-width` não se aplica a grid; a equipe fica com a imagem em 45% do card (definido em `.elementor-image-box-img{width:45%}`) e o texto ao lado. | Manter como está (é o visual publicado). Não "consertar". |
| **B5** | `a69d5f8` ≤767px | `--overlay-opacity:0.5` + `background-color:#02010121` — o `justify-content` do flex row vira wrap sem definição → colunas do form/map podem colar. | Adicionar `--flex-direction:column` em ≤767px (o flex já tem `--flex-wrap-mobile:wrap`, mas sem `gap`). |
| **B6** | `084a245` ≤767px | `font-size:26px` — o `<h2>` do hero fica 26px (boa) mas **o subtítulo** `6fd2079` continua 19px sobre a foto. | Aceitar (paridade). |
| **B7** | `post-49.css` ≤767px | `.elementor-nav-menu--dropdown{margin-top:42px !important}` — o painel dropdown começa 42px abaixo, sobrepondo o conteúdo. | Manter o `margin-top` (paridade) mas garantir `z-index` e `position:relative` no painel. |

---

## 4. Acessibilidade — problemas medidos e correções

### 4.1 Contraste (razões WCAG 2.x calculadas)

| # | Uso | Original | Razão | Veredito | Correção mínima |
|---|---|---|---|---|---|
| A1 | Botão (rótulo 15px) | `#FFFFFF` sobre `#B68C5A` | **3.05** | ✗ (4.5) | rótulo → `#2E2E2E`, bg → `#BC9265` (**4.81**) |
| A2 | Hover do botão | `#2E2E2E` sobre `#B68C5A` | **4.45** | ✗ por 0.05 | hover → bg `#C9A377` (**5.81**) |
| A3 | Nav item hover/focus (15px) | `#B68C5A` sobre `#2E2E2E` | **4.45** | ✗ | → `#C09A6B` (**5.22**) |
| A4 | Título icon-box Áreas (22px/500) | `#B68C5A` sobre card escuro | **4.45** | ✗ (22px/500 não é "large text") | → `#C09A6B` (**5.22**) |
| A5 | Título icon-box Serviços (22px/500) | `#B68C5A` sobre `#FFFFFF` | **3.05** | ✗ | → `#8A6132` (**5.47**) |
| A6 | Descrição icon-box (15px) | `#7A7A7A` sobre card escuro | **3.16** | ✗ | → `#B5B5B5` (**6.62**) |
| A7 | Descrição icon-box (15px) | `#7A7A7A` sobre `#FFFFFF` | **4.29** | ✗ | → `#6E6E6E` (**5.10**) |
| A8 | Títulos do rodapé (20px/600) | `#B68C5A` sobre `#2E2E2E` | **4.45** | ✗ | → `#C09A6B` (**5.22**) |
| A9 | Hover de link no rodapé | `#B68C5A` sobre `#2E2E2E` | **4.45** | ✗ | → `#C09A6B` |
| A10 | Texto do campo de formulário | `#F3F3F3` sobre `#2E2E2E` | **12.24** | ✓ | — |
| A11 | Borda do campo | `#F3F3F34D` sobre `#2E2E2E` | **≈1.9** | ✗ (3:1, componente) | → `#E8C79A` (**8.45**) |
| A12 | Placeholder do campo | herda `#7A7A7A` | **3.16** | ✗ | → `#B5B5B5` |
| A13 | Mensagem de sucesso | `#0C884A` sobre fundo escuro | **2.26** | ✗ | chip bg `#FFFFFF` + texto `#0A7240` (**6.01** sobre `#FFFFFF`) |
| A14 | Mensagem de erro | `#C1121F` sobre fundo escuro | **2.18** | ✗ | chip bg `#FFFFFF` + texto `#C1121F` (**6.22** sobre `#FFFFFF`) |
| A15 | Estrelas do depoimento | `#B68C5A` sobre `#F3F3F3` | **2.75** | ✗ (3:1) | → `#8A6132` (**4.93**) |
| A16 | "- Voltaire" (19px) | `#B68C5A` sobre `#F3F3F3` | **2.75** | ✗ | → `#8A6132` (**4.93**) |
| A17 | Link genérico `.elementor-kit-6 a:hover` | `#B68C5A` | 3.05 / 2.75 | ✗ | usar `--color-accent-text` (`#8A6132`) em fundo claro e `--color-accent-text-inverse` (`#C09A6B`) em fundo escuro |
| A18 | "Nossa Equipe" + subtítulo (`ff7acb3`, `5adf940`) | `#2E2E2E` sobre a foto `banner-equipe.png` com overlay 0.46 | **indeterminado** — provável ✗ | ⚠️ | **Trocar para `#F3F3F3`**, igual aos títulos `100fed7`/`c06a067` que estão na mesma seção. Correção de 2 tokens, sem redesign. |
| A19 | "Fale Conosco" (`09f0ede`, `c3cd150`) | `#2E2E2E` sobre `banner-contato.png` | **indeterminado** | ⚠️ | Medir por screenshot. Se falhar, usar `#F3F3F3` (mesmo tratamento de A18) |
| A20 | Separador do `icon-list` | `#7A7A7A` sobre `#2E2E2E` | **3.16** | ✓ (3:1) | manter ou → `#8A6132` |
| A21 | Divisor do `divider` (3px) | `#B68C5A` sobre `#FFFFFF` / `#2E2E2E` | **3.05 / 4.45** | ✓ | manter |
| A22 | Social icon do header (hover) | `#FFFFFF` sobre `#B68C5A` | **3.05** | ✗ | ícone → `#2E2E2E` no hover |
| A23 | Texto do blog (`fefdbd4` 19px, `#2E2E2E` sobre `#F3F3F3`) | **12.24** | ✓ | — |
| A24 | Bio "Sobre" (`67ccd3a` 16px `#696868` sobre `#2E2E2E`+overlay .45) | **5.01** vs `#F3F3F3` / **2.45** vs `#2E2E2E` | ⚠️ | → `#B5B5B5` (**6.62** sobre `#2E2E2E`) — medido e decidido em 2026-10-19 (D41) |

> **A tabela é recalculada, não escrita à mão**: o `npm run check-contrast`
> lê o **CSS construído** (`dist/css`), resolve a cascata (a ordem das
> folhas, a especificidade e os `!important`), expande as custom properties
> e calcula a razão WCAG de cada linha. As 23 linhas com fundo conhecido
> passam; a **A19** depende da fotografia e só se mede por captura de ecrã.

> **Conclusão sobre "mudar um token"**: é **matematicamente impossível** satisfazer os dois contextos com um único valor de `--e-global-color-accent`: para ≥4.5:1 sobre `#2E2E2E` o token precisa de luminância ≥0.297; para ≥4.5:1 sobre `#FFFFFF` precisa de luminância ≤0.183 — os intervalos não se cruzam. Por isso a correção mínima é **um token de cor preservado (`--color-accent`) + dois tokens de texto derivados**, e não uma reestilização. **R7: o `--e-global-color-accent` do kit NÃO é alterado** (divisores, estrelas e badge dependem de `#B68C5A`).

### 4.2 Hierarquia de headings

Estado real na home (extraído do HTML): o `<h1>` **único** é "Galastri Advocacia" (widget `b7fa39f`, dentro do Sobre) e o **título do hero é um `<h2>`**. Os 18 títulos de icon-box são `<h2>`. Resultado: o outline começa em h2 e o h1 aparece na metade da página.

**Outline correto (mudança mínima — só a tag, sem tocar em CSS, porque o CSS é por classe e não por tag):**

| Local | Original | Correto |
|---|---|---|
| Hero — título | `<h2>` `084a245` | **`<h1 class="elementor-heading-title elementor-size-default">`** |
| Hero — subtítulo | `<h2>` `6fd2079` | `<p class="elementor-heading-title elementor-size-default">` |
| Sobre — "Galastri Advocacia" | `<h1>` `b7fa39f` | **`<h2 class="elementor-heading-title elementor-size-default">`** |
| Sobre — bio | `text-editor` | `<p>` (já é) |
| Áreas — "Áreas de atuação" | `<h2>` `87bb8c7` | `<h2>` ✓ |
| Áreas — subtítulo | `<h2>` `80c99f5` | `<p class="elementor-heading-title elementor-size-default">` |
| Áreas — 6 icon-box | `<h2>` `elementor-icon-box-title` | **`<h3 class="elementor-icon-box-title">`** |
| Serviços — "Nossas Soluções" | `<h2>` `9bb6899` | `<h2>` ✓ |
| Serviços — subtítulo | `<h2>` `24ebf0c` | `<p class="elementor-heading-title elementor-size-default">` |
| Serviços — 12 icon-box | `<h2>` | **`<h3 class="elementor-icon-box-title">`** |
| Blog — "Nosso Blog de notícias" | `<h2>` `92fa1a8` | `<h2>` ✓ |
| Blog — subtítulo | `<h2>` `fefdbd4` | `<p class="elementor-heading-title elementor-size-default">` |
| Equipe — "Nossa Equipe" | `<h2>` `ff7acb3` | `<h2>` ✓ |
| Equipe — subtítulo | `<h2>` `5adf940` | `<p class="elementor-heading-title elementor-size-default">` |
| Equipe — image-box | `<h2>` `elementor-image-box-title` | `<h3 class="elementor-image-box-title">` |
| Depoimentos — "Depoimentos" | `<h2>` `100fed7` | `<h2>` ✓ |
| Depoimentos — subtítulo | `<h2>` `c06a067` | `<p class="elementor-heading-title elementor-size-default">` |
| Citação — frase | `<h2>` `a3ee56d` | `<blockquote class="elementor-heading-title elementor-size-default">` (com `<p>` interno) — **recomendado `<p>`**, é uma citação, não um título de seção |
| Citação — autor | `<h2>` `269416c` | `<p class="elementor-heading-title elementor-size-default">` + `<cite>` |
| Contato — "Fale Conosco" | `<h2>` `09f0ede` | `<h2>` ✓ |
| Contato — subtítulo | `<h2>` `c3cd150` | `<p class="elementor-heading-title elementor-size-default">` |
| Rodapé — títulos de coluna | `<h2>` (×3+1) | `<h2 class="elementor-heading-title elementor-size-default">` → **manter h2** |
| Rodapé — links de política | `<h2>` (×3) | **`<p class="elementor-heading-title elementor-size-default">`** (são links, não títulos) |

> **Impacto no CSS:** o CSS gerado usa **classes** (`.elementor-heading-title`), não tags. Trocar `h2`→`h1`/`h3`/`p` **não** altera nenhum pixel, desde que a classe e as classes do container sejam preservadas. O único cuidado: o `<p>` com `class="elementor-heading-title"` precisa de `margin:0` (o CSS do Elementor não zera margens de `<p>`) → resetar `margin-block:0` em `.elementor-heading-title` que não é `h2`.

### 4.3 Visibilidade de foco

O tema Kava **não** remove outlines globalmente (só `a:active, a:hover{outline:0}` em `style.css:74-77`, e `outline:none` pontual em `theme.css` para `#toTop` e inputs). Porém:
- `.elementor-item:hover/:focus` muda a cor para `accent` — **é um foco visual**, mas com 4.45:1 e **sem anel**, e some ao tirar o mouse.
- `kava/theme.css:415-431` tem `input[type=...]:focus{... outline:none}` → **os campos do formulário não têm foco visível**.
- `theme.css:1210-1212` remove o outline do skip-link target.

**Anel de foco especificado:**
```css
:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 3px;
  border-radius: inherit;
}
/* superfícies escuras (header #2E2E2E, footer #2E2E2E, hero, Depoimentos) */
.elementor-49 :focus-visible,
.elementor-48 :focus-visible,
.elementor-element-af9b6b1 :focus-visible,
.elementor-element-6d564f8 :focus-visible {
  outline-color: var(--color-focus-ring-inverse); /* #E8C79A — 8.45:1 */
}
/* sobre o próprio botão dourado */
.elementor-button:focus-visible { outline-color: var(--color-primary); } /* #2E2E2E — 4.83:1 */
```
Valores: `--color-focus-ring:#9C6E3C` (4.46 sobre `#FFFFFF`, 4.02 sobre `#F3F3F3`), `--color-focus-ring-inverse:#E8C79A` (8.45 sobre `#2E2E2E`). Todos ≥3:1.

Campos do formulário: `outline:none` **removido**; usar `border-color` + `box-shadow:0 0 0 2px var(--color-focus-ring-inverse)` (o `box-shadow` é mais previsível em campos arredondados).

### 4.4 Texto alternativo das imagens

| Imagem | `alt` original | `alt` corrigido | `aria-hidden` |
|---|---|---|---|
| Logo header (`wp-image-20`, 560×189) | `galastri-advocacia-logo-horizontal-transparente` | `Galastri Advocacia` | não (é o logo do link, precisa de nome acessível) |
| Logo footer (`wp-image-22`, 327×299) | `galastri-advocacia-logo-vertical-transparente` | `Galastri Advocacia` | não |
| Avatar "Sobre" (`4b8b744`, `ana-paula-galastri-avatar-quadrado.png`) | `ana-paula-galastri-avatar-quadrado` | `Retrato da Dra. Ana Paula Galastri, fundadora do escritório` | não |
| Avatar equipe (`ea6573c`, `avatar-borda-dourada.png` 183×184) | `ana-paula-galastri-avatar-circulo-dourado` | `Retrato da Dra. Ana Paula Galastri` (o `<h3>` ao lado já dá o nome) | **sim** (`alt=""`) — redundante |
| Foto depoimento Débora | `Débora cliente galastri advocacia` | `Débora` (o nome já está em `<strong class="elementskit-author-name">`) | **sim** |
| Fotos Rose / 1612016126338 / Irael / Mariana / Margarete | (verificar no HTML) | `""` — nome já ao lado | **sim** |
| 6 ícones de Áreas (SVG inline) | — | `""` | **sim** (`aria-hidden="true"`, `focusable="false"`) |
| 12 ícones de Serviços (SVG inline) | — | `""` | **sim** |
| Ícone do botão do hero (SVG do WhatsApp/Agenda) | — | `""` | **sim** |
| Ícones do `icon-list` do rodapé (SVG) | — | `""` | **sim** |
| Ícones sociais | — | `""` no SVG + `aria-label` no `<a>` ("Instagram", "WhatsApp") | SVG sim |
| Backgrounds (banners, `Fundo-LinkTree-3.png`, `Design-sem-nome-1.png`) | — | são `background-image` de CSS | não aplicável |
| Logo do 404 (`background_image` com `alt` no editor) | — | é background; o 404 já tem texto "Voltar ao início" | — |

**Ícones dentro de `<a>`**: o `<a>` dos botões-imagem do `/links/` (post 843) tem `alt="botão agendamento galastri advocacia"` → corrigir para descrições funcionais: `"Agendar uma reunião pelo WhatsApp"`, `"Visitar o site galastriadvocacia.com.br"`, `"Ver as áreas de atuação no Instagram"`.

### 4.5 Iframe do mapa — **click-to-load, gated on consent** (R13)

Original: `<iframe loading="lazy" src="https://maps.google.com/maps?q=Avenida%20Henrique%20Brunini%20Jundiaí&t=m&z=13&output=embed&iwloc=near" title="Avenida Henrique Brunini Jundiaí" aria-label="Avenida Henrique Brunini Jundiaí">`.

Problemas: (1) `loading="lazy"` **não** impede a requisição ao Google quando o iframe entra no viewport — o IP do visitante vaza para o Google antes do consentimento; (2) `title` duplica `aria-label` (redundante, mas inofensivo).

**Especificação:**
- Renderizar **placeholder** com a mesma caixa (`aspect-ratio` do iframe original ≈ **16:9**), fundo `linear-gradient(135deg,#E8E2D9,#D6CFC4)` (amostra do mapa), e um **botão** `<button type="button" class="map-load">` com `aria-label="Carregar mapa do escritório na Avenida Henrique Brunini, Jundiaí"` e texto visível **"Carregar mapa"** + um link secundário **"Abrir no Google Maps"** (`href` para `https://www.google.com/maps/search/?api=1&query=Avenida+Henrique+Brunini,+Jundiaí+-SP`).
- Ao clicar, injetar `<iframe loading="lazy" src="…" title="Mapa do escritório na Avenida Henrique Brunini, Jundiaí" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen>`.
- **Só renderizar o iframe se o consentimento de publicidade/analíticos estiver concedido** (o mapa é um terceiro). Se o consentimento for recusado, o mapa **nunca** carrega — apenas o link "Abrir no Google Maps" (navegação do usuário, não tracking).
- `filter: saturate(60%)` no hover → `saturate(100%)` (mantido do CSS original).

### 4.6 Movimento reduzido

```css
@media (prefers-reduced-motion: reduce) {
  .elementor-invisible { opacity: 1; visibility: visible; }
  .elementor-invisible.animated-slow { animation: none !important; }
  html { scroll-behavior: auto; }
  .swiper-wrapper { transition-duration: 0ms !important; }
  .swiper-slide { transition-duration: 0ms !important; }
}
```
- Desativar **autoplay** do slider via JS (`autoplay:false` quando `matchMedia('(prefers-reduced-motion: reduce)').matches`).
- Desativar `elementor-animation-grow` no botão do hero (o `animation: grow` do Elementor é contínuo).
- Manter `fadeIn` (fade de opacidade não viola 2.3.3); desligar `grow`/`pulse` (scale).

### 4.7 Alvos de toque (mín. 44×44)

| Elemento | Atual | Correção |
|---|---|---|
| Toggle do menu | SVG 1000×1000 renderizado ~20px | caixa **44×44** (`.elementor-menu-toggle{min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}`) |
| Dots do carrossel | **8×8** | `<button>` + `::after{inset:-18px}` → **44×44** |
| Social icons (header e footer) | **40×40** | `--icon-padding:.6em` → **44×44** |
| Itens do `icon-list` | altura da linha (~24px) | `min-height:44px` + `align-items:center` nos itens com link |
| Links do rodapé (políticas) | linha ~22px | `padding-block:8px` → 38–44px; `display:inline-block` |
| Botões | `padding` do `widget-button.min.css` (~12px 24px) → ~44px | ok |
| Link "Gerenciar preferências" no banner | ~24px | `min-height:44px; display:inline-flex; align-items-center` |
| Dot do filtro de categorias (blog) | — | 44×44 |

### 4.8 Teclado, skip-link, ordem de tabulação

- **Skip-link** (novo, o original não tem): `<a href="#conteudo" class="skip-link">Pular para o conteúdo</a>` como **primeiro** elemento do `<body>`; `position:absolute; left:16px; top:-100px;` → `top:16px` no `:focus`; `background:#FFFFFF; color:#2E2E2E; padding:12px 20px; border-radius:0 0 8px 8px; z-index:10000;` + `min-height:44px`. Destino: `<main id="conteudo" tabindex="-1">`.
- **Ordem de tabulação**: skip-link → **banner de cookies** (deve ser alcançável sem percorrer a página) → header (logo → 7 itens de nav → toggle no mobile → 3 ícones sociais) → conteúdo (hero: 1 CTA → sobre → áreas: 6 títulos com link → serviços: 12 → blog: 3 títulos + 1 botão → equipe → depoimentos: dots → citação → **contato: 4 campos + botão + checkbox LGPD + botão "Carregar mapa"**) → rodapé (logo → 3 ícones → 3 listas → copyright → 3 links de política → "Gerenciar preferências de cookies").
- **Foco no hash**: ao carregar com `#sobre`, o foco vai para o alvo — usar `tabindex="-1"` no container âncora.
- **Nenhum keytrap** fora do `<dialog>` de preferências.
- **Modal de preferências**: `<dialog>` nativo → `showModal()` dá focus trap + `Esc` + `::backdrop`. `Esc` → `close()` + foco de volta no botão "Gerenciar preferências".

### 4.9 Formulário — semântica

- Todos os inputs dentro de `<form>` com `method="post"`; `action` = o endpoint da **Function do próprio site** (`PUBLIC_CONTACT_ENDPOINT`, `/api/contact`); o envio é por `fetch` com `Content-Type: application/json` (o `action` fica como fallback sem-JS, mas **a Function só aceita JSON**).
- `aria-live="polite"` no container de mensagens; `role="alert"` (= `aria-live: assertive`) **apenas** na mensagem de erro.
- `aria-describedby` aponta para o `id` do texto de erro quando o campo é inválido.
- `aria-invalid="true"` no campo inválido; remover ao corrigir.
- `autocomplete` conforme a tabela de §2.5.
- `spellcheck="false"` no telefone; `enterkeyhint="next"` no campo de mensagem.
- Mensagem de sucesso: `role="status"` + texto exato (§6.4).
- Honeypot: ver §2.5.
- Checkbox LGPD obrigatório: ver §6.5.

### 4.10 Semântica da navegação e do rodapé

- `<nav aria-label="Menu principal">` no header (o original usa `aria-label="Menu"` → "Menu Principal").
- O dropdown mobile é um **segundo** `<nav>` com `aria-label="Menu principal (mobile)"` e `aria-hidden="true"` quando fechado.
- Rodapé: `<footer id="colophon">` (role `contentinfo` implícito); os 3 blocos de links em `<nav aria-label="Institucional">`, `<nav aria-label="Áreas de Atuação">`, `<nav aria-label="Contato">`.
- `<address>` para o bloco de contato do rodapé.

---

## 5. Verificação de paridade visual

### 5.1 Referência

- **HTML**: snapshot do Wayback `https://web.archive.org/web/20250328152643id_/https://galastriadvocacia.com.br/` → salvar localmente como `tests/fixtures/reference-home.html` (251.099 bytes; confirmado acessível). Salvar também `/blog/`, um post, o 404 e `/links/` se houver captura.
- **HTML (R2)**: o `_elementor_element_cache` do dump é a referência **mais fiel** (22/03/2026, mesmo estado do backup) → `tests/fixtures/elementor-cache-{30,48,49}.html`. A paridade estrutural deve comparar contra **este** fixture; o Wayback serve de confirmação visual.
- **CSS (R1)**: o snapshot lista as folhas de estilo **na ordem exata** do `<head>`. As que importam para a paridade, na ordem: `custom-frontend.min.css` → `post-6.css` → `widget-heading.min.css` → `fadeIn/e-animation-grow/e-animation-pulse.min.css` → `widget-divider.min.css` → `widget-image.min.css` → `custom-widget-icon-box.min.css` → `upk-alex-grid.css` → `custom-widget-image-box.min.css` → `swiper.min.css` → `widget-form.min.css` → `widget-google_maps.min.css` → **`post-30.css`** → `font-awesome` → **`themes/kava/style.css`** + `theme.css` → `blog-layouts-module.css` → `custom-pro-widget-nav-menu.min.css` → `widget-social-icons.min.css` → `custom-apple-webkit.min.css` → `sticky.min.css` → `custom-widget-icon-list.min.css` → **`post-49.css`** → **`post-48.css`** → eicons → `widget-icon-list.min.css` → `widget-social-icons.min.css` → FA → `widget-blockquote` → `widget-mega-menu` → `widget-nav-menu.min.css` → elementskit `widget-styles.css` + `responsive.css` → royal-addons → `upk-font.css` + `upk-site.css` → as 3 fontes Google (`questrial`, `nunito`, `qwigley`) → `ekiticons.css`.
  **A ordem importa** (especificidade + cascata). O `<head>` do build Astro deve reproduzir essa ordem **exatamente**; depois anexar `tokens.css` (que só define/ajusta custom properties) e `a11y.css`.
- **Imagens**: usar o **backup local** (`uploads/2024/12/…`) — é a fonte de verdade de 2026-03.

### 5.2 Viewports

| # | Largura × Altura | Dispositivo | bp Elementor | Por que |
|---|---|---|---|---|
| V1 | **1440 × 900** | desktop | base | maior chance de diff |
| V2 | **390 × 844** | iPhone 12 | mobile (≤767) | mobile real |
| V3 | **768 × 1024** | iPad portrait | tablet (≤1024) | **importante**: é onde o `white-space:nowrap` quebra e onde `--width:50%` aparece |

> Sugestão: usar **1440** (não 1366) para o diff principal e adicionar **1366×768** como caso extra, porque o CSS tem uma regra **exclusiva** em `max-width:1366px` (muda as grades para 3 col) — 1365px dispara, 1367px não.

### 5.3 Script Playwright (outline)

```js
// tests/parity/visual.spec.ts
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile',  width: 390,  height: 844 },
  { name: 'tablet',  width: 768,  height: 1024 },
];
const PAGES = ['/', '/blog/', '/404']; // +1 post e /links/

// 1) carga do fixture
const referenceHtml = fs.readFileSync('tests/fixtures/reference-home.html', 'utf8');

// 2) paridade estrutural (determinístico, sem pixel)
test('paridade estrutural do HTML gerado', async ({ page }) => {
  await page.goto(BASE_URL + '/');
  const generated = await page.content();
  const ids = (html) => [...html.matchAll(/elementor-element-([0-9a-f]{6,8})/g)].map(m => m[1]);
  expect([...new Set(ids(generated))].sort())
    .toEqual([...new Set(ids(referenceHtml))].sort()); // conjunto idêntico
  expect(ids(generated).length).toBe(ids(referenceHtml).length);  // mesma quantidade/ordem
  const anchors = (html) => [...html.matchAll(/id="(home|sobre|areasdeatuacao|servicos|quemsou|contato)"/g)].map(m=>m[1]);
  expect(anchors(generated)).toEqual(anchors(referenceHtml));
  // texto visível: comparar o texto normalizado de cada seção
  for (const id of ['home','sobre','areasdeatuacao','servicos','quemsou','contato']) {
    const t = (html) => norm(textOfSection(html, id));
    expect(t(generated)).toBe(t(referenceHtml));
  }
});

// 3) ordem das seções (assinatura dos containers de nível superior)
test('ordem das seções da home', async ({ page }) => {
  const sig = await page.$$eval('.elementor-30 > .e-con', els => els.map(e => e.dataset.id));
  expect(sig).toEqual(['af9b6b1','7dffe5f','845bcff','dd1df9b','2f1b5f2','e2b2a60','6d564f8','0c92c76','a69d5f8','78422c7']);
});

// 4) paridade de pixels
test('paridade visual', async ({ page }, testInfo) => {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.goto(BASE_URL + '/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {                    // neutraliza animação e sticky
      document.querySelectorAll('.elementor-invisible')
        .forEach(e => e.classList.remove('elementor-invisible'));
      document.querySelectorAll('.swiper-pagination').forEach(e => e.remove());
      window.scrollTo(0, 0);
    });
    await expect(page).toHaveScreenshot(`home-${vp.name}.png`, {
      maxDiffPixelRatio: 0.02,   // 2%
      threshold: 0.15,           // tolerância por canal (PNG diff do Playwright)
      animations: 'disabled',
    });
  }
});
```

### 5.4 Tolerância e por que 2%

O `post-30.css` é **copiado verbatim** e as imagens são as mesmas → o diff esperado é **< 1%** dos pixels. Use:
- `maxDiffPixelRatio: 0.02` (2%) como **teto**; investigue qualquer diff > 0.5%.
- `threshold: 0.15` (15% de diferença por canal) para absorver antialiasing de fonte.
- **Não** compare a captura do Wayback (que tem a barra de Wayback e recursos reescritos) — compare a **estrutura** com o HTML e os **pixels** contra uma **re-renderização local do HTML de referência com o CSS do backup**. Ou seja: montar `tests/fixtures/reference-home-local.html` (HTML do snapshot com URLs reescritas para o backup local) e servir com `file://`/http local → esse é o pixel-perfect de referência.

### 5.5 As duas diferenças inevitáveis (regressão vs. drift)

| Diferença | Origem | Como classificar |
|---|---|---|
| **Elementor 3.28.1 / WP 6.7.2 (referência)** vs **3.35.7 / 6.9.4 (backup)** | versão | O Elementor 3.29+ adicionou `data-e-type="container|widget"` ao DOM (visível no `_elementor_element_cache` local: `data-e-type="container"`) e o **container `ddf5b16`** (template "Modelo Popup - Recesso", `post-695`) foi criado em **2025-12-17** — **depois** do snapshot. Portanto: (a) atributos `data-e-type` **existem só no novo** → **esperado**, não é regressão; (b) `post-695.css` e `post-1004.css` **não** existem no snapshot → **esperado**; (c) qualquer container presente no backup e ausente na referência é **drift** — **verificar item a item**, não aceitar em bloco. |
| **Snapshot de 2025-03-28** vs **backup de 2026-03-22** | data | Mudanças legítimas do período: nº de posts (o `upk-alex-grid` da referência mostra 6 itens, o backup mostra 3 — a home mostra 3); novos posts; **texto do copyright "© 2025"** → agora deve ser dinâmico `{ano}` = 2026. Classificação: se o diff de **texto** bater com um post novo/publicação → drift; se o diff for de **layout/métrica** → **regressão** (tratar como bug). |

**Regra de decisão para o developer:**
1. Rodar a **paridade estrutural** (conjunto de `elementor-element-{id}` + ordem + âncoras + texto) contra `tests/fixtures/elementor-cache-30.html`. Qualquer falha aqui é **regressão** (bug) — exceto ids que existam apenas por `post-695`/`post-1004`.
2. Rodar a **paridade de pixels** por viewport. Diff grande e **localizado** numa seção = regressão. Diff distribuído = provavelmente **fonte** (Questrial/Nunito/Qwigley carregadas do Google vs. self-hosted) → **verificar primeiro o carregamento das fontes** antes de investigar CSS.
3. Registrar cada diff aceito na **lista de drift** do `docs/PARITY.md`, com o motivo.

---

## 6. Copy e conteúdo — correções prontas para uso

### 6.1 Página 404 (template 790)

| Item | Original | Correto |
|---|---|---|
| Título | `Ops parece que alguma coisa deu errado! :/` | **`Ops! Parece que alguma coisa deu errado.`** |
| Texto | `A página que você está tentando acessar está tentando acessar está temporariamente fora do ar ou foi encerrada! Recomendo que você acesse um dos links abaixo` | **`A página que você está tentando acessar está temporariamente fora do ar ou foi encerrada. Use os links abaixo para continuar navegando.`** |
| Botão | `Voltar ao inínicio` (typo) | **`Voltar ao início`** |
| Subtítulo do botão (aria-label) | — | **`Voltar para a página inicial`** |

### 6.2 Rodapé — copyright

| Original | Correto |
|---|---|
| `Copyright © 2025 Galastri Advocacia - Jundiaí \| SP \| Desenvolvido por Xentry Labs` | **`Copyright © {ano} Galastri Advocacia - Jundiaí \| SP — Desenvolvido por Xentry Labs`** (`{ano}` calculado no build, ex. `2026`) |

> **Decidido em 2026-10-19** (PASS B): o **hífen** entre "Galastri Advocacia" e
> "Jundiaí" **mantém-se** (a assinatura da marca) e o **separador final** passa
> de `|` para `—` (travessão). A implementação está em
> `src/components/elementor/widgets/Copyright.astro` e é a que o build emite.

### 6.3 Seção "Nossa Equipe"

| Original | Correto |
|---|---|
| `Contamos com uma equipe profissional e epecialista no que faz` | **`Contamos com uma equipe profissional e especialista no que faz`** |

### 6.4 Formulário — mensagens

| Situação | Original | Correto |
|---|---|---|
| Sucesso | (padrão Elementor: "The form was successfully sent.") | **`Mensagem enviada com sucesso! Em breve, nossa equipe entrará em contato.`** |
| Erro | (padrão Elementor: "There was an error when sending the form. Please try again.") | **`Não foi possível enviar sua mensagem. Por favor, tente novamente ou fale conosco pelo WhatsApp.`** |
| Erro de campo (nome) | — | **`Informe seu nome completo.`** |
| Erro de campo (e-mail) | — | **`Informe um e-mail válido.`** |
| Erro de campo (telefone) | — | **`Informe um telefone válido com DDD.`** |
| Erro de campo (mensagem) | — | **`Descreva brevemente o seu caso (mínimo 20 caracteres).`** |
| Botão | `Enviar` | **`Enviar mensagem`** (mais descritivo; mantém o estilo) |
| Enviando | — | **`Enviando…`** |
| Honeypot falhou | — | (silencioso — sem mensagem) |

### 6.5 Consentimento LGPD no formulário

Checkbox **obrigatório** acima do botão:
> **Label:** `Li e autorizo o tratamento dos meus dados pessoais para contato, conforme a Política de Privacidade.`
> **Link:** `Política de Privacidade` → `/politica-de-privacidade/`
> **Erro:** `É necessário autorizar o tratamento de dados para enviar a mensagem.`
> **Helper:** `Os dados serão utilizados apenas para retorno do contato e não serão compartilhados com terceiros.`

### 6.6 Banner de cookies (novo)

**Banner principal:**
> **Título:** `Usamos cookies`
> **Texto:** `Utilizamos cookies para medir o desempenho do site e exibir anúncios relevantes. Você pode aceitar, recusar ou gerenciar suas preferências. A política completa está na nossa Política de Cookies.`
> **Botões:** `Aceitar` · `Rejeitar` · `Gerenciar preferências`
> **Link:** `Política de Cookies` → `/politica-de-cookies-galastri-advocacia/`

**Painel de preferências (`<dialog>`):**
> **Título:** `Preferências de cookies`
> **Necessários** — `Sempre ativos. Necessários para o funcionamento do site e para guardar a sua escolha.`
> **Analíticos** — `Permitem medir o desempenho do site (Google Analytics) de forma agregada.`
> **Publicidade** — `Permitem exibir anúncios relevantes (Google AdSense) e limitar a repetição de anúncios.`
> **Rodapé do painel:** `Salvar preferências` · `Aceitar todos`
> **Rodapé do link no site (footer):** `Gerenciar preferências de cookies`

### 6.7 Demais microcopys

| Onde | Original | Correto |
|---|---|---|
| Contato, subtítulo | `Agende sua reunião preencha formulário abaixo:` | **`Agende sua reunião preenchendo o formulário abaixo:`** |
| Contato, placeholder textarea | `Digite aqui sua mensagem, conte brevemente seu caso.......` | **`Conte brevemente o seu caso:`** |
| Contato, placeholder nome | `Digite seu nome` | **`Digite seu nome completo`** |
| Contato, placeholder e-mail | `Digite seu email` | **`Digite seu e-mail`** |
| Contato, placeholder telefone | `Digite seu telefone` | **`Digite seu telefone com DDD`** |
| Botão do hero | `Agendar uma Reunião` | manter |
| Menu | `Quem Sou` | **`Quem Somos`** (o section é "Nossa Equipe" e a âncora é `#quemsou`) — **opcional**, ver Q2 |

---

## 7. Tokens (`public/css/tokens.css`)

```css
:root {
  /* ---------- COLOR ---------- */
  --color-primary:            #2E2E2E;   /* igual ao original */
  --color-secondary:          #2E2E2E;   /* igual */
  --color-text:               #6E6E6E;   /* ALTERADO: era #7A7A7A (4.29:1 no branco) */
  --color-text-on-dark:       #B5B5B5;   /* NOVO: descriptions sobre card/fundo escuro (6.62:1) */
  --color-accent:             #B68C5A;   /* igual — só uso decorativo (divisores, sombras, estrelas, badge) */
  --color-accent-text:        #8A6132;   /* NOVO: texto dourado sobre fundo claro (5.47:1) */
  --color-accent-text-inverse:#C09A6B;   /* NOVO: texto dourado sobre fundo escuro (5.22:1) */
  --color-accent-button:      #BC9265;   /* ALTERADO: era #B68C5A — base do botão (4.81:1 com #2E2E2E) */
  --color-accent-button-hover:#C9A377;   /* NOVO: hover do botão (5.81:1) */
  --color-white:              #FFFFFF;   /* igual */
  --color-container:          #F3F3F3;   /* igual (White Smoke) */
  --color-success:            #0C884A;   /* igual — uso gráfico */
  --color-success-text:       #0A7240;   /* NOVO: mensagem de sucesso (5.42:1) */
  --color-danger:             #C1121F;   /* igual (5.61:1) */
  --color-danger-text:        #E23B48;   /* NOVO: borda/ícone de erro sobre fundo escuro (3.2:1) */
  --color-info:               #1C77BE;   /* igual */
  --color-link:               #398FFC;   /* igual (tema) — NÃO usar para texto de 15px sobre branco (3.23:1) */
  --color-border-subtle:      #E5E5E5;   /* NOVO: borda do banner de cookies */

  /* ---------- FOCUS ---------- */
  --color-focus-ring:         #9C6E3C;   /* NOVO: 4.46:1 no branco / 4.02 no #F3F3F3 */
  --color-focus-ring-inverse: #E8C79A;   /* NOVO: 8.45:1 no #2E2E2E */
  --focus-ring-width:         2px;
  --focus-ring-offset:        3px;

  /* ---------- TYPOGRAPHY ---------- */
  --font-heading: "Questrial", sans-serif; /* igual */
  --font-body:    "Nunito", sans-serif;            /* igual */
  --font-quote:   "Qwigley", sans-serif;           /* igual */
  --font-brand:   "Montserrat", sans-serif;        /* tema (logo) */
  --font-ui:      "Roboto", sans-serif;            /* tema */

  --text-4xl: 47px;  --leading-4xl: 1.2;  --weight-4xl: 600;  /* h1/h2 — token primary do kit */
  --text-3xl: 38px;  --leading-3xl: 1.2;  --weight-3xl: 600;  /* h2 em ≤767px (regra do Elementor) */
  --text-2xl: 33px;  --leading-2xl: 1.2;  --weight-2xl: 600;  /* "Galastri Advocacia" em ≤767px */
  --text-xl:  26px;  --leading-xl:  1.25; --weight-xl:  600;  /* h1 do hero em ≤767px */
  --text-lg:  22px;  --leading-lg:  1.3;  --weight-lg:  500;  /* título de icon-box (e640e9a) */
  --text-md:  20px;  --leading-md:  1.3;  --weight-md:  600;  /* título de coluna do rodapé (5a72b0f) */
  --text-lg2: 19px;  --leading-lg2: 1.35; --weight-lg2: 500; /* subtítulos (secondary/1241739/c71a467) */
  --text-base:15px;  --leading-base:1.6; --weight-base:500;  /* corpo (text/accent/fbdcd6f/ce13146) */
  --text-sm:  13px;  --leading-sm:  1.5; --weight-sm:  500;  /* rodapé ≤1024px (50673f0) */
  --text-quote:40px; --leading-quote:1.35; --weight-quote:600; /* Voltaire (a3ee56d) */
  --text-bio:  16px;  --leading-bio:  1.6; --weight-bio:  500;  /* bio "Sobre" (67ccd3a, #696868) */
  --text-upk:  15px;  --leading-upk:  1.5; --weight-upk:  600;  /* título do post (upk-title) */

  /* ---------- SPACING (escala real do Elementor) ---------- */
  --space-0: 0;      --space-1: 4px;    --space-2: 5px;    --space-3: 9px;
  --space-4: 10px;   --space-5: 15px;   --space-6: 20px;   --space-7: 40px;
  --space-8: 50px;   --space-9: 70px;   --space-10: 80px;

  /* ---------- RADIUS ---------- */
  --radius-pill:  30px;   /* botões e campos do formulário */
  --radius-card:  10px;   /* icon-box, image-box, depoimento */
  --radius-item:   5px;   /* upk-item */
  --radius-dialog:12px;   /* NOVO: painel de cookies */

  /* ---------- ELEVATION ---------- */
  --shadow-card:    0 2px 15px rgba(0,0,0,.13);   /* icon-box de Áreas */
  --shadow-card-sm: 0 1px 15px rgba(0,0,0,.16);   /* image-box */
  --shadow-testimonial: 0 1px 15px rgba(0,0,0,.13);
  --shadow-cookie: 0 -4px 20px rgba(0,0,0,.12);    /* NOVO */
  --shadow-dialog: 0 12px 40px rgba(0,0,0,.28);    /* NOVO */

  /* ---------- LAYOUT ---------- */
  --container-max: 1140px;   /* igual (.elementor-section-boxed) */
  --container-max-tablet: 1024px;
  --container-max-mobile: 767px;
  --widget-gap: 20px;        /* --widgets-spacing */
  --header-height: 100px;    /* a altura do header, MEDIDA em runtime
                                (public/js/header-height.js); este é o
                                fallback sem JavaScript (D37) */

  /* ---------- Z-INDEX ---------- */
  --z-content: 1;
  --z-header: 100;            /* NOVO: header sticky */
  --z-dropdown: 200;          /* menu mobile */
  --z-cookie: 9000;           /* banner */
  --z-dialog: 10000;          /* <dialog> (top layer do navegador) */

  /* ---------- BREAKPOINTS (só para referência em TS/JS) ---------- */
  --bp-widescreen: 2400px;
  --bp-desktop:    1366px;
  --bp-tablet-extra:1200px;
  --bp-tablet:     1024px;
  --bp-mobile:     767px;
}
```

**Tokens alterados (justificativa):**

| Token | Antes | Depois | Motivo |
|---|---|---|---|
| `--color-text` | `#7A7A7A` | `#6E6E6E` | 4.29 → **5.10:1** no branco (corpo 15px) |
| `--color-accent-button` | `#B68C5A` | `#BC9265` | rótulo grafite 4.45 → **4.81:1** |
| `--color-accent-button-hover` | (não existia) | `#C9A377` | hover do botão **5.81:1** |
| *(novos)* `--color-text-on-dark`, `--color-accent-text`, `--color-accent-text-inverse`, `--color-success-text`, `--color-danger-text`, `--color-focus-ring`, `--color-focus-ring-inverse` | — | — | impossibilidade provada de um único valor de acento servir os dois contextos (§4.1) |
| `--text-quote` | — | `40px` | valor real do widget `a3ee56d` (o token do kit diz 47px — não usar) |
| `--text-xl` | — | `26px` | valor real do hero em ≤767px |
| `--text-3xl` / `--text-2xl` | — | `38px` / `33px` | valores reais das media queries do Elementor |

> Os tokens do Elementor (`--e-global-color-*`, `--e-global-typography-*`) **não** precisam ser reproduzidos se o `post-*.css` for copiado verbatim (R1): **manter os nomes originais** e sobrescrever apenas os valores corrigidos via um `tokens.css` posterior na cascata. **R7 — não** mudar `--e-global-color-accent`: usar as classes de widget específicas (ex.: `.elementor-30 .elementor-element.elementor-element-011caa0 .elementor-button{color:var(--color-accent-text)}`) para não afetar o `divider`, as estrelas e o badge, que **precisam** manter `#B68C5A`.

---

## 8. Perguntas abertas (com recomendação)

| # | Pergunta | Recomendação |
|---|---|---|
| **Q1** | O hero deve ganhar um overlay escuro (o briefing diz 0.46, mas o Elementor real **não tem**)? | **Não adicionar.** Manter a foto limpa + `text-shadow` (paridade exata). O overlay mudaria o visual da home inteira e o CTA dourado perderia destaque. Se o dono quiser mais legibilidade, adicionar `text-shadow` mais forte, não overlay. |
| **Q2** | O menu "Quem Sou" vs seção "Nossa Equipe" — renomear? | **Manter "Quem Sou"** (paridade) e apenas corrigir a âncora. A dissonância é de conteúdo, não de UI. |
| **Q3** | `/links/` = post **843** ou **907** (quase idênticos)? | **Publicar só o 843** (R9) em `/links/`; o **907 é descartado**. Evitar páginas duplicadas (SEO). |
| **Q4** | Para onde vai o POST do formulário num site estático na Cloudflare Pages? | **A Function do próprio site** (`POST /api/contact`) via `PUBLIC_CONTACT_ENDPOINT`, com `fetch` POST e `Content-Type: application/json` (R14); `Accept: application/json`; honeypot `_gotcha`; sem base de dados e sem servidor de aplicação no repositório. Alternativa `mailto:` (rua). |
| **Q5** | Labels do formulário: invisíveis (paridade) ou visíveis (a11y)? | **Visíveis.** São 4 campos, +20px de altura cada, e o formulário original já tem um visual "campo arredondado cinza" que funciona com label acima. Custo visual baixo, ganho WCAG 1.3.1/3.3.2 alto. Se a prioridade for paridade pixel-perfect absoluta, manter `elementor-screen-only` nos 4 e aceitar o custo. |

---

## 9. Definition of Visual + Interaction Done (checklist QA)

### A. Paridade estrutural (bloqueante)
- [ ] A.1 O conjunto de classes `elementor-element-{id}` do HTML gerado é **idêntico** ao do fixture `tests/fixtures/elementor-cache-30.html` (mesmo conjunto, mesma quantidade, mesma ordem) na home.
- [ ] A.2 A ordem das 10 seções da home é `af9b6b1 → 7dffe5f → 845bcff → dd1df9b → 2f1b5f2 → e2b2a60 → 6d564f8 → 0c92c76 → a69d5f8 → 78422c7`.
- [ ] A.3 Os `id`s de âncora presentes são exatamente `home, sobre, areasdeatuacao, servicos, quemsou, contato`.
- [ ] A.4 O texto visível de cada seção é idêntico ao da referência (exceto as correções de copy de §6, listadas explicitamente).
- [ ] A.5 O `<head>` lista as folhas de estilo **na mesma ordem** do snapshot, com `tokens.css` e `a11y.css` **após**.
- [ ] A.6 `ddf5b16` (container vazio do template 695) **não** é renderizado (R10).
- [ ] A.7 Os **25 containers** e **61 widgets** da **página inteira** (86 nós) estão presentes com o `data-id` correto; o corpo do post 30 tem **63** nós (= `home-30.json.meta.elementCount`), o header **4** e o footer **19**.
- [ ] A.8 As classes funcionais de layout (`elementor-nav-menu--*`, `elementor-position-top`, `elementor-icon-list--layout-traditional`, `elementor-list-item-link-full_width`, `elementor-button-align-stretch`, `elementor-labels-`, `elementor-view-stacked`) estão presentes.

### B. Paridade visual (bloqueante)
- [ ] B.1 `toHaveScreenshot` passa em 1440×900, 390×844 e 768×1024 com `maxDiffPixelRatio ≤ 0.02`.
- [ ] B.2 Diff > 0.5% em qualquer viewport está documentado em `docs/PARITY.md` com causa (drift ou regressão).
- [ ] B.3 As fontes Questrial, Nunito e Qwigley carregam (verificar `document.fonts.check`) — **self-hosted, sem request ao Google** (R12).
- [ ] B.4 A grade de Áreas mostra **4 col** em 1440px e **2 col** em 1024px e **1 col** em 390px; a de Serviços mostra **4 / 2 / 1**.
- [ ] B.5 O rodapé mostra **4 col** em 1440px, `1fr 1fr 1fr 2fr` em 1024px e **1 col** em 390px.
- [ ] B.6 O header é `1fr 3fr 1fr` em ≥1025px, `1fr 3fr` em 768–1024 e 1 coluna em ≤767.
- [ ] B.7 O slider mostra **3 / 2 / 1** slides em 1440 / 768 / 390.
- [ ] B.8 O hero recorta a imagem com `background-position:-800px 0` em ≤767px e mantém `center center` acima disso.
- [ ] B.9 `min-height` do hero: 500px base, 450px em ≤1024, 460px em ≤767.
- [ ] B.10 Nenhum título de icon-box é cortado ou transborda em 1440, 1024 e 390px (correção B1 aplicada).

### C. Interação
- [ ] C.1 Nav desktop: default `#F3F3F3`; hover/focus/active `#C09A6B` com a linha dupla aparecendo.
- [ ] C.2 `aria-current="page"` **apenas** no item Home; os âncoras **não** têm `aria-current`.
- [ ] C.3 Menu mobile: `<button>` real, `aria-expanded` alterna, `Esc` fecha, foco retorna ao botão, ícone hambúrguer ⇄ X.
- [ ] C.4 Painel dropdown no mobile abre abaixo do header com `margin-top:42px`, `z-index` acima do conteúdo, e `aria-hidden` sincronizado. Abertura pela classe **`elementor-active`** no `<button>` (a regra do Elementor Pro); o painel fechado tem **`inert`**.
- [ ] C.5 Botão principal: default `#BC9265`/`#2E2E2E`, hover `#C9A377`, active com sombra interna, focus com anel `#2E2E2E` de 2px.
- [ ] C.6 Botão "Ver todos" (blog): default `#F3F3F3`/`#2E2E2E`, hover `#8A6132`.
- [ ] C.7 Icon-box: hover muda o fundo do card para `#3D3D3D` (Áreas) / `#FFFFFFE8` (equipe); `:has(:focus)` escurece o título.
- [ ] C.8 Formulário: 4 campos com `<label for>` correto, placeholder, `autocomplete`, `inputmode`; borda de foco `#E8C79A` visível; mensagem de erro com `role="alert"` e `aria-describedby` no campo; mensagem de sucesso com `role="status"`; botão com estado `Enviando…` e `disabled`; **CTA de WhatsApp visível ao lado do form** (R14).
- [ ] C.9 O honeypot `_gotcha` **não** é visível nem focável pelo teclado, mas é preenchido por script automatizado.
- [ ] C.10 Máscara de telefone `(00) 00000-0000` aplicada e `inputmode="tel"`.
- [ ] C.11 Slider: autoplay 1000ms, pausa no hover **e no foco**, dots são `<button>` com `aria-current` no ativo, `aria-label` "Ver depoimento N", área de toque ≥44×44, botão de pausar/retomar presente.
- [ ] C.12 Banner de cookies: aparece na 1ª visita, "Aceitar" e "Rejeitar" com **peso visual igual**, preferências abrem um `<dialog>` com `aria-modal`, focus trap, `Esc` fecha e devolve o foco; "Necessários" desabilitado e marcado; Analíticos/Publicidade **desmarcados**; escolha persiste em `localStorage` e o banner **não** reaparece.
- [ ] C.13 "Gerenciar preferências de cookies" presente no rodapé e abre o mesmo diálogo.
- [ ] C.14 `scroll-margin-top` = `calc(var(--header-height) + 16px)` (`#sobre`, `#areasdeatuacao`, `#contato`, `#servicos`, `#quemsou`) e `+ 8px` em ≤767px; `--header-height` é a altura **medida** do header (fallback: 100px).
- [ ] C.15 O mapa **não** faz requisição ao Google antes do clique/consentimento; após o clique, o iframe carrega com `title` descritivo.
- [ ] C.16 O GTM carrega com `analytics_storage:'denied'` e `ad_storage:'denied'` por padrão; o `adsbygoogle.js` só é injetado após consentimento de publicidade.

### D. Acessibilidade
- [ ] D.1 O outline da home tem **exatamente um** `<h1>` (o título do hero) e a hierarquia h1→h2→h3 é sequencial, sem saltos.
- [ ] D.2 Todos os títulos de seção continuam sendo `<h2>` e todos os icon-box/image-box viram `<h3>`, com a classe `elementor-heading-title`/`elementor-icon-box-title` preservada (zero mudança de pixel).
- [ ] D.3 Todo elemento interativo tem foco visível de 2px com offset 3px, na cor correta por superfície (≥3:1).
- [ ] D.4 Os campos do formulário têm foco visível (o `outline:none` do Kava foi removido/sobreposto).
- [ ] D.5 O skip-link é o primeiro elemento focável e aparece ao receber foco.
- [ ] D.6 A navegação por teclado percorre: skip-link → banner de cookies → header → seções → form → rodapé, sem keytrap (fora do `<dialog>`).
- [ ] D.7 `prefers-reduced-motion: reduce` desliga as animações `grow`/`pulse`, o autoplay do slider e o `scroll-behavior: smooth`.
- [ ] D.8 Alvos de toque ≥44×44: toggle de menu, dots do slider, social icons, itens do icon-list, links do rodapé, links do banner.
- [ ] D.9 Todas as imagens têm `alt` conforme a tabela de §4.4 (ícones decorativos com `alt=""` + `aria-hidden="true"`).
- [ ] D.10 Contraste conferido com ferramenta automatizada: nenhum texto <4.5:1; nenhum componente/ícone <3:1. **Aprovado** com os tokens de §7 (A1–A24 corrigidos).
- [ ] D.11 Nenhuma informação é transmitida apenas por cor.
- [ ] D.12 `axe-core` sem violações `serious`/`critical` na home, no blog, num post, no 404 e em `/links/`.

### E. Conteúdo
- [ ] E.1 404: "Ops! Parece que alguma coisa deu errado." + "Voltar ao início" (sem typo).
- [ ] E.2 "Nossa Equipe": "…profissional e especialista no que faz".
- [ ] E.3 Contato: "Agende sua reunião preenchendo o formulário abaixo:".
- [ ] E.4 Copyright com `{ano}` dinâmico e pipes preservados.
- [ ] E.5 Mensagens de sucesso/erro do formulário conforme §6.4.
- [ ] E.6 Checkbox LGPD presente, obrigatório, com link para a Política de Privacidade.
- [ ] E.7 Textos do banner e do painel de cookies conforme §6.6.

---

**Riscos que o developer deve conhecer:**
1. **O CSS é o contrato.** Qualquer mudança de tag (`h2`→`h1`/`h3`/`p`) é segura porque o CSS é por classe — mas **qualquer** remoção/renomeação de classe (incluindo `elementor-screen-only`, `elementor-icon-list--layout-traditional`, `e--pointer-double-line`) quebra o layout silenciosamente.
2. **A ordem das folhas de estilo** importa; `tokens.css`/`a11y.css` devem vir **depois** de todas.
3. Nenhum valor único de `--e-global-color-accent` resolve contraste nos dois contextos (prova em §4.1) — a correção exige tokens de texto derivados, não um ajuste de valor.
4. O `post-30.css` local (92.994 B) e o arquivado (93.362 B) podem ter micro-divergências ainda não mapeadas; o teste estrutural do §5.3 é o que vai detectá-las.

**Não verificado / limitação declarada:** o uiux não conseguiu ler o `post-30.css` local byte a byte (o leitor de linhas trunca em 2.000 caracteres e o arquivo tem 8 linhas de 92 KB); trabalhou com a cópia arquivada de conteúdo equivalente e validou por *sampling* de prefixo e *grep* de regras-chave. As luminâncias das fotos de fundo (`banner-destaque`, `banner-equipe`, `banner-contato`) não puderam ser medidas — os itens A18/A19/A24 dependem de medição por screenshot, não de cálculo.
