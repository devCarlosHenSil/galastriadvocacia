# SPEC-DATA — Modelo de dados da migração WordPress → Astro (Galastri Advocacia)


> **Fonte:** agente `dba` — spec de dados sobre o dump WP-Vivid (34,7 MB · 41 tabelas · prefixo `wp_`).
> **Consolidado em:** 2026-10-19 · **Alvo:** `<LOCAL>/galastriadvocacia` (o repositório é **público**: o caminho da máquina não é versionado).
> **Método do dba:** leitura direta do dump (grep por `INSERT INTO <tabela> VALUES`). O dump é `mysqldump --extended-insert` desativado (1 linha por registro) → os ranges de linha **são** as contagens exatas.

---

## Rulings do EM aplicados a esta spec

| # | Ruling | O que mudou nesta spec |
|---|---|---|
| **R1** | **O CSS gerado pelo Elementor É copiado verbatim.** | §3.5.7 (antigo "não migrar") foi **revertido**. `uploads/elementor/css/*` (**36** arquivos; o `manifest.meta.cssFiles` = 39 porque inclui os 3 CSS das fontes locais) + `uploads/elementor/google-fonts/` passam a ser **assets versionados**. O CSS **é** o design; a estratégia é "replay do DOM para que o CSS gerado aplique sem alteração". |
| **R2** | **`_elementor_element_cache` EXISTE** (5 linhas: posts 30, 48, 49, 695, 1004). | §2.2 e §4.7 corrigem "AUSENTE" → **EXISTE**. É o **oráculo de paridade**: o extractor extrai 30/48/49 para `tests/fixtures/elementor-cache-{30,48,49}.html`. O placeholder `[elementor-element k="…" data="<base64>"]` marca widgets dinâmicos e o base64 decodifica para o `settings` JSON daquele elemento. |
| **R3** | **`_elementor_conditions` EXISTE** (116 linhas). | §2.2 corrige "AUSENTE" → **EXISTE (116)**. Não é migrado (rotas são fixas), mas o fato é registrado. |
| **R4** | **Rotas:** home `/`; `/home/` = alias com `canonical → /`; `/blog/` = arquivo; **posts na RAIZ** `/<slug>/`; categorias `/category/<slug>/`; **sem páginas de tag**; `/links/`; 3 políticas; `/404`. | §3.1, §3.4.7, §3.4.8 e todos os asserts de §6 foram reescritos. O prefixo `/blog/` nos posts e as 57 páginas de tag do dba foram **rejeitados**. `redirects.json` passa a ter **1 entrada**: `{"/home/": "/"}`. |
| **R5** | **Formulário com 4 campos**: nome, email, telefone, mensagem. | §3.4.5: removido o campo inventado `assunto`; o 1º campo chama-se `nome`. O dev **deve** validar contra o dump e reportar divergência. |
| **R6** | **E-mail público = `contato@galastriadvocacia.com.br`** (é o `email_to` do widget de form). `<email administrativo do cliente>` é o `admin_email` do WP e **não** pode aparecer no HTML publicado. | §2.3 e §3.4.1 `site.email` e §3.4.5 `form.emailTo` passam a `contato@galastriadvocacia.com.br`. §6.6 exige **0 ocorrências** de `<email administrativo do cliente>` em todo o output. |
| **R7** | **A paleta do Elementor kit (post 6 `_elementor_page_settings`) é canônica**; `theme_mods_kava` só contribui o que o kit não tem. | Mantido o que o dba já dizia (§3.4.4) e explicitado no texto. |
| **R8** | **Políticas = páginas Astro nativas** `src/pages/politica-*.md` (não collection). | Aceito sem alteração (§3.3). |
| **R9** | **Post 907 (template Linktree) é descartado**; **843 é publicado** em `/links/`. | §2.1, §3.5.5 e §6 ajustados. |
| **R10** | **Popups 695 / 1004 descartados** (renderizam vazio no cache). | §2.1 e §3.5.7. |
| **R11** | **Preloader descartado** (`theme_mods_kava.page_preloader=1` era o preloader de imagem do Kava, não um spinner). | §3.4.4: `theme.preloader = false` (mantido) + nota explicativa. |
| **R12** | **Fontes 100% self-hosted.** Roboto 300/400/500/900 e Montserrat 700 (só referenciados como URL do Google Fonts) **precisam ser baixados**. Nunito/Questrial/Qwigley já são locais em `uploads/elementor/google-fonts/`. `Amsterdam.ttf` só entra se o extractor reportar referência. | §3.5.7 (nova subseção) + §3.6.4 + asserts §6.5. |
| **R20** | **`site.json.seo.perUrl` é a fonte única de verdade** de `<title>` / `<meta name="description">`. Só o post 30 tem valores Rank Math; os demais são **rascunhos pendentes de aprovação da advogada**. | §3.4.6 + assert de coerência §6.7 + campo `"status": "draft"`. |

---

## 1. Escopo e fontes

| Item | Valor |
|---|---|
| Dump analisado | `<dump>.sql` (34,7 MB, 41 tabelas, prefixo `wp_`) |
| Backup (read-only) | `<BACKUP>` — **nunca escrever ali** |
| Alvo | `<LOCAL>/galastriadvocacia` → repo `devCarlosHenSil/galastriadvocacia` (público) |
| Stack | Astro 5, `output: 'static'`, GitHub Pages, `https://galastriadvocacia.com.br` |
| Fonte editorial | `wp_posts` + `wp_postmeta` (Elementor `_elementor_data`, Rank Math, `_wp_attached_file`) |
| Fonte de assets | `uploads/` do backup (closure por URL, não por `_wp_attached_file`) |

---

## 2. Modelo de dados de origem

### 2.1 Sobreviventes da migração (12 posts)

| ID | tipo | slug | data | papel |
|---|---|---|---|---|
| 30 | page | `home` | 2024-12-20 12:49:52 | Home (`page_on_front=30`) |
| 464 | page | `blog` | 2024-12-23 22:38:34 | Blog (`page_for_posts=464`) |
| 3 | page | `politica-de-privacidade` | 2024-12-20 12:31:50 | Política de Privacidade |
| 83 | page | `politica-de-cookies-galastri-advocacia` | 2024-12-20 16:18:31 | Política de Cookies |
| 85 | page | `politica-de-uso-de-inteligencia-artificial-galastri-advocacia` | 2024-12-20 16:20:46 | Política de IA |
| 843 | page | `links` | 2024-12-28 18:13:41 | Página "links" (Linktree) — **publicada** (R9) |
| 272 | post | `5aspectos-cruciais-direito-de-familia` | 2024-12-21 00:08:50 | Blog |
| 610 | post | `guarda-compartilhada` | 2024-12-24 14:54:20 | Blog |
| 714 | post | `pis-pasep-2025` | 2024-12-26 13:56:55 | Blog |
| 723 | post | `jovem-aprendiz` | 2024-12-26 14:40:17 | Blog |
| 733 | post | `salario-maternidade` | 2024-12-26 14:40:35 | Blog |
| 739 | post | `bpc-loas-bloqueado` | 2024-12-26 15:37:37 | Blog |

> `post_modified` **≠** `post_date` nos **6 posts** e nas **3 políticas** (o dump é de 2026-03) → o frontmatter dos **6 posts** emite o `updatedDate` **real** (o `post_modified` local); as **3 políticas** emits `updatedDate: 2026-10-19` — a **data de vigência** do texto publicado (a mesma que o corpo, §3.2; ver §6.1 D5 e D12).

**Descartados:** 662 revisions · 1 auto-draft (998) · 1 draft (997, `rm_content_editor`) · 58 attachments (só os arquivos sobrevivem, via §3.6) · 14 dos 20 `elementor_library` (41 Manutenção, 576 Dashboard, **695 + 1004 popups Recesso — descartados (R10)**, 759/762/766/769/772/775/778/781/784 já embutidos em `home-30.json`, **907 — descartado (R9)**) · `wp_navigation` (4) · `wp_global_styles` (9) · `elementor_font` (853) · `custom_css` (136 → §4.6) · `wpr_submissions` (977) · `nav_menu_item` (810–816 → §3.4.2).

**Fuso:** `timezone_string = 'America/Sao_Paulo'`; `post_date` é hora **local**. Use **apenas `post_date`** (data civil local) no frontmatter. `post_date_gmt` de 272 = `2024-12-21 03:08:50` ⇒ data local `2024-12-21`.

### 2.2 `wp_postmeta` — `meta_key`s load-bearing

| `meta_key` | Onde vive | Uso na migração |
|---|---|---|
| `_elementor_data` | 30, 48, 49, 516, 525, 790, 843 (+ kit 6) | Árvore normalizada → `src/data/elementor/*.json` (§3.5) |
| `_elementor_template_type` | 6=`kit`, 30=`wp-page`, 48=`footer`, 49=`header`, 516=`archive`, 525=`single-post`, 790=`error-404`, 843=`wp-page`, 41/576=`page` | Decide nome do arquivo de saída e papel do template |
| `_elementor_edit_mode` | 30, 48, 49, 516, 525, 790, 843 | `builder` → todos são Elementor (sem fallback de conteúdo clássico) |
| `_elementor_page_settings` | 6 (kit, 48 chaves), 30 (`{hide_title: yes}`) | Kit → paleta + tipografia (§3.4.4) |
| **`_elementor_element_cache`** | **posts 30, 48, 49, 695, 1004 (5 linhas)** — `value.content` = HTML **já renderizado**; `value.scripts`; `value.styles`; `timeout: 1774304699` (= 22/03/2026) | **EXISTE (R2).** Oráculo de paridade → `tests/fixtures/elementor-cache-{30,48,49}.html` (§4.7) |
| **`_elementor_conditions`** | **116 linhas** | **EXISTE (R3).** Não migrado (rotas fixas) — registrado por completude |
| `_wp_page_template` | 3=`default`, 30=`elementor_header_footer`, 6/49/48=`default` | 30 usa header/footer Elementor → `/` renderiza `home-30.json` entre `header-49.json` e `footer-48.json` |
| `_thumbnail_id` | 272→`274`, 610→`611`, 714→`715`, 723→`724`, 733→`734`, 739→`740` | Resolve o hero (→ `_wp_attached_file`) |
| `_wp_attached_file` | 58 attachments | Caminho relativo do original sob `uploads/` (§3.6) |
| `_wp_attachment_image_alt` | 58 (subset) | `heroAlt` dos posts (§3.2) |
| `_wp_attachment_metadata` | 58 | `filesize` (manifest) + `sizes` (**ignorada** — §3.6.3) |
| `rank_math_focus_keyword` | 272, 610, 714, 723, 733, 739 (+30) | `focusKeyword` do frontmatter |
| `rank_math_title` | **só post 30** | `site.json.seo.perUrl["/"].title` |
| `rank_math_description` | **só post 30** | `site.json.seo.perUrl["/"].description` |
| `rank_math_canonical_url`, `rank_math_robots`, `rank_math_schema_Article`, `rank_math_schema_BlogPosting` | — | **AUSENTES.** → JSON-LD gerado pelo próprio site |
| `_menu_item_*` | 810–816 | `nav` do `site.json` (§3.4.2) |

> **R2 — como usar o cache:** as linhas contêm o HTML renderizado com placeholders `[elementor-element k="<uuid>" data="<base64>"]` no lugar de widgets dinâmicos (nav-menu, site-logo, upk grids, testimonial, form). O `data` é base64 do **JSON `settings`** daquele elemento → o cache é uma **fonte completa** desses `settings` também. Não é saída final (TTL + placeholders), é **contrato**.

**Descartados (ruído):** `_edit_lock`, `_edit_last`, `_wp_old_slug`, `_yoast_wpseo_*`, `_aioseo_*`, `_wpr_*`, `_elementor_css_*`, `_thumbnail_id` de revisions, `edit_lock`.

### 2.3 `wp_options`

**Opções que entram no `site.json` (allow-list de 21 chaves — qualquer outra é descartada por construção, §4.4):**

| option | valor no dump | destino |
|---|---|---|
| `siteurl` / `home` | `https://galastriadvocacia.com.br` | `site.url` |
| `blogname` | `Galastri Advocacia - Escritório de Advocacia - Jundiaí - SP` | `site.legalName` (verbatim) |
| `blogdescription` | `Soluções Jurídicas  Personalizadas` (2 espaços) | `site.description` (espaço colapsado) |
| `admin_email` | `<email administrativo do cliente>` | **NÃO entra** (R6) — `site.email` = `contato@galastriadvocacia.com.br` |
| `WPLANG` | `pt_BR` | `site.lang` |
| `timezone_string` | `America/Sao_Paulo` | `site.timezone` |
| `date_format` / `time_format` | `d/m/Y` / `H:i` | `site.formats` |
| `permalink_structure` | `/%postname%/` | **decide as rotas** (§3.1) |
| `show_on_front` / `page_on_front` / `page_for_posts` | `page` / `30` / `464` | `site.routes.home` = `/`, `site.routes.blog` = `/blog/` |
| `posts_per_page` | `10` | `site.blog.postsPerPage` (registrado; irrelevante com 6 posts) |
| `default_comment_status` | `open` | ignorado (sem comentários no site novo) |
| `users_can_register` | `0` | ignorado (site estático) |
| `blog_public` | `1` | ok |
| `elementor_css_print_method` | `external` | ignorado (o CSS é copiado verbatim, R1) |
| `elementor_font_display` | `swap` | `theme.fontDisplay` |
| `elementor_google_font` | `1` | `theme.googleFonts` (→ tudo self-hosted, R12) |
| `theme_mods_kava` | 159 chaves (serializado PHP) | §3.4.4 / §4.6 |
| `rank_math_backups` | 1 backup (`general`, 49 chaves) | §3.4.6 (só `seo` gerado) |

**Opções que NÃO entram:** `cron`, `_transient*`, `_site_transient*`, `recently_activated`, `active_plugins`, `category_base` (default = `category` → `/category/<slug>/`), `tag_base`, `thumbnail_size`, `medium_size`, `large_size`, `comment_*`, `upload_path`, `upload_url_path`, `default_role`, `template`/`stylesheet`, `db_version`, `rewrite_rules`, `wp_user_roles`, `recovery_mode_*`, `elementor_pro_*`, `elementor_controls_usage`, `ultimate_post_kit_*`, `wpr_*`, `elementskit_options`, `litespeed_*`, `wpvivid_*`, `wpforms_*`, `wpmailsmtp_*`, `trustindex_*`, `googlesitekit_*`, `akismet_*`, `elementor_experiment-*`, `elementor_pro_theme_builder_conditions`, `wpr_license_key` (**não existe**), `elementor_pro_license` (não existe), `wpvivid_license` (não existe).

**`theme_mods_kava` — chaves relevantes:** `nav_menu_locations => {main: 3}` · `accent_color => #b68c5a` · `primary_text_color => #3b3d42` · `secondary_text_color => #a1a2a4` · `invert_text_color => #ffffff` · `link_color => #398ffc` · `link_hover_color => #b68c5a` · `h1..h6_color => #3b3d42` · `body_font_family => Roboto, sans-serif` (300 / 14px / 1.6) · `h1_font_family => Roboto` (56px) · `container_type => fullwidth` · `blog_layout_type => grid` · `blog_style => v6` · `show_tagline => 1` · `page_preloader => 1` · `header_social_links => 1` · `footer_social_links => 1` · `totop_*` · `sidebar_width => 1/3`.

> ⚠️ `theme_mods_kava` tem **outra paleta** (`primary_text_color=#3b3d42`, `secondary_text_color=#a1a2a4`, fonte Roboto). As páginas renderizadas usavam a paleta do **Elementor kit** (Nunito/Questrial). **A paleta do kit é a canônica (R7).** O Roboto/Roboto-heading do Kava é resíduo — mas o Roboto **precisa ser self-hosted** (R12) porque o `style.css` do Kava o referencia.
> ⚠️ `page_preloader = 1` era o preloader de **imagem** do Kava, não um spinner visível → **preloader descartado (R11)**.

**`rank_math_backups`** — `setup_mode => advanced` · `nofollow_external_links => off` · `new_window_external_links => on` · `add_img_alt => off` · `breadcrumbs => off` · `redirections_header_code => 301` · `content_ai_country => all` · `frontend_seo_score => off` · `strip_category_base => off` · `attachment_redirect_urls => on` · `attachment_redirect_default => https://galastriadvocacia.com.br`.
→ O backup **não** é migrado como config. Duas regras mudam o desenho: `attachment_redirect_urls => on` → **não existem páginas de attachment** (as 58 imagens são assets); `breadcrumbs => off` → **não implementar breadcrumbs**.

### 2.4 Taxonomia

**Categorias (`taxonomy='category'`)** — 4 no total, **3 em uso**:

| term_taxonomy_id | term_id | nome | slug | count | posts |
|---:|---:|---|---|---:|---|
| 1 | 1 | Sem categoria | `sem-categoria` | 0 | — (não entra no `site.json`) |
| 19 | 19 | Direito de Família | `direito-de-familia` | 2 | 272, 610 |
| 36 | 36 | Direito do Trabalho | `direito-do-trabalho` | 2 | 714, 723 |
| 67 | 67 | Direito Previdenciário | `direito-previdenciario` | 2 | 733, 739 |

**Tags (`taxonomy='post_tag'`)** — 67 no total, **57 em uso** (count>0); 10 sem uso (`term_id` 11, 14, 15, 16, 18, 80, 81, 82, 83, 84 — `Inventário`, `Adoção`, `Planejamento Sucessório`, `Testamento`, `Família e Direito`, `direitos dos filhos`, `direito civil`, `parentalidade`, `separação`, `melhores práticas familiares`).

> **R4 — as 57 tags NÃO geram páginas.** Ficam **apenas no frontmatter** (`tags[]`). Razão: 57 páginas de tag para 6 posts = thin content, que é exatamente o padrão que o próprio Google penaliza. Se o owner quiser, `/tag/<slug>/` pode ser gerado depois — não entra no escopo.

**Mapa tag → post (60 relações de tag em 6 posts)** — `direito-de-familia` (272, 610) · `divorcio` (272) · `guarda-de-filhos` (272, 610) · `heranca` (272) · `pensao-alimenticia` (272) · `sucessao` (272) · `direito-da-crianca` (272) · `familia` (272) · `patrimonio-familiar` (272) · `normas-juridicas` (272) · `guarda-compartilhada` (610) · `custodia-compartilhada` (610) · `pais-separados` (610) · `crianca-e-guarda-compartilhada` (610) · `responsabilidade-parental` (610) · `beneficios-da-guarda-compartilhada` (610) · `divisao-de-responsabilidades` (610) · `acordo-entre-pais` (610) · `pis-pasep-2025` (714) · `abono-salarial` (714) · `calendario-pis-pasep-2025` (714) · `quem-tem-direito-ao-pis-2025` (714) · `consulta-pis-pasep` (714) · `novas-regras-pis-pasep-2025` (714) · `pagamento-pis-pasep-2025` (714) · `como-receber-o-abono-salarial` (714) · `valor-do-pis-2025` (714) · `requisitos-pis-pasep-2025` (714) · `jovem-aprendiz` (723) · `seguro-desemprego` (723) · `direitos-trabalhistas` (723) · `programa-de-aprendizagem` (723) · `contrato-de-trabalho` (723) · `beneficios-trabalhistas` (723) · `aprendiz-e-seguro-desemprego` (723) · `direitos-do-jovem-aprendiz` (723) · `beneficios-do-programa-jovem-aprendiz` (723) · `contratacao-jovem-aprendiz` (723) · `salario-maternidade` (733) · `prorrogacao-do-salario-maternidade` (733) · `licenca_maternidade` (733) · `complicacoes_no_parto` (733) · `direito-da-gestante` (733) · `beneficios-do-inss` (733) · `prorrogacao-de-licenca` (733) · `inss` (733, 739) · `licenca-maternidade-estendida` (733) · `segurada-do-inss` (733) · `bpc` (739) · `loas` (739) · `beneficio-de-prestacao-continuada` (739) · `bloqueio-do-bpc` (739) · `regularizacao-do-bpc` (739) · `cadastro-unico` (739) · `cras` (739) · `atualizacao-de-dados` (739) · `beneficio-bloqueado` (739).

> ⚠️ **Colisão deliberada:** `direito-de-familia` é **tag** (tt 9) **e** **categoria** (tt 19). Nos posts 272 e 610 o slug aparece nos dois campos. Não há colisão de URL (as tags não geram rota, R4). Dados mantidos **verbatim**; a camada de view rotula "categoria" vs "tag".

### 2.5 `wp_users` / `wp_usermeta`

| ID | user_login | user_email | user_nicename | display_name | roles |
|---:|---|---|---|---|---|
| 1 | `carlos-henrique` | <email administrativo do cliente> | `carlos-henrique` | Carlos Henrique | administrator |
| 2 | `ana-paula` | <REDACTED:e-mail pessoal da autora> | `ana-paula` | **Ana Paula Galastri** | author |

**Sobrevivem (2 campos, ambos públicos):** `Ana Paula Galastri` → `site.author.name` + frontmatter `author` · `ana-paula-galastri` (derivado de `user_nicename`+`last_name`) → `site.author.slug` + frontmatter `authorSlug` · bio profissional (≈480 chars, `wp_usermeta.description`) → `site.author.bio` (conteúdo público, idêntico ao template "Equipe" 775).

**Não sobrevivem:** `user_email` (dos dois), `user_login`, `user_pass` (`<REDACTED:hash phpass>` / `<REDACTED:hash bcrypt>`), `user_url`, `user_registered`, chave de usermeta de sessões (`session`+`_tokens`) com IP+UA, `wp_capabilities`, `wp_level`, `admin_color`, `show_admin_bar_front`, `rich_editing_color`, `closed_postboxes`, `wp_user-settings*`, `wp_persisted_preferences`, `default_password_nag`, `personal_options_update`, `dismissed_wp_pointer_settings`, `use_admin_bar`, `wp_user_avatar` (hash Gravatar).

> **User 1 (Carlos Henrique / administrador) não migra nada** — não é autor público de nenhum post.
> Não existe hash Gravatar para a autora: o avatar vem do attachment `2024/12/ana-paula-galastri-avatar-circulo.png` (id 11).

### 2.6 `wp_comments` (48) e `wp_commentmeta` (231)

| Tipo | IDs | `comment_approved` | Quantidade |
|---|---|---|---:|
| pingback (WP 6.7.1 via XML-RPC, IP `<REDACTED:IP de pingback>`) | 2, 3, 4, 5 | `1` | **4** |
| spam (campanha "Hacklink Panel" de `<REDACTED:IP de campanha de spam>`; gambling `<REDACTED:IP de campanha de gambling>`) | 244–287 | `spam` | **44** |
| comentário humano aprovado | — | `1` + `comment_type='comment'` | **0** |

`wp_commentmeta`: **231 linhas, 100% `akismet_*`**, todas com `comment_id` ∈ {2,3,4,5,244..287} → órfãs quando os comentários são descartados.

---

## 3. Modelo de dados alvo

### 3.1 Rotas (R4 — fonte única: `permalink_structure = /%postname%/`)

| Origem WP | Novo | Implementação |
|---|---|---|
| `/` (post 30) | `/` | `src/pages/index.astro` |
| `/home/` (alias do post 30) | **→ `/`** (canonical + meta-refresh; 301 via Cloudflare) | `src/pages/home.astro` |
| `/blog/` (post 464) | `/blog/` | `src/pages/blog.astro` (template 516) |
| `/<slug>/` (os 6 posts) | **`/<slug>/`** (raiz — preserva backlinks) | `src/pages/[slug].astro` com `getStaticPaths` da collection |
| `/category/<cat>/` | `/category/<cat>/` (WP `category_base`) | `src/pages/category/[slug].astro` |
| `/tag/<tag>/` | **404 — sem páginas de tag** (R4) | — |
| `/politica-de-privacidade/` | idem | `src/pages/politica-de-privacidade.md` |
| `/politica-de-cookies-galastri-advocacia/` | idem | `src/pages/politica-de-cookies-galastri-advocacia.md` |
| `/politica-de-uso-de-inteligencia-artificial-galastri-advocacia/` | idem | `src/pages/politica-de-uso-de-inteligencia-artificial-galastri-advocacia.md` |
| `/links/` (post 843) | `/links/` (R9) | `src/pages/links.astro` (template 843) |
| `/wp-admin/`, `/wp-login.php`, `/xmlrpc.php` | 404 | site estático |
| `/wp-content/uploads/…` | idem | servido de `public/wp-content/uploads/` |
| — | `/404` | `error-404` (post 790) |

> **R4 — por que posts na raiz:** o WP gravava `permalink_structure=/%postname%/`. Mover para `/blog/<slug>/` quebraria **todo backlink existente** e exigiria 6 redirects. Já `/home/` é apenas alias do post 30 (o `post_name` é `home`, mas `page_on_front=30` faz o WP servir `/`).

### 3.2 `src/content.config.ts` — collection `blog`

```ts
// src/content.config.ts  (Astro 5)
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),                       // post_title do WP (verbatim)
    description: z.string(),                 // §3.2.0
    pubDate: z.coerce.date(),                // post_date local → YYYY-MM-DD
    updatedDate: z.coerce.date().optional(), // post_modified local (a data real de modificação)
    hero: z.string(),                        // "/wp-content/uploads/<file>"
    heroAlt: z.string(),                     // _wp_attachment_image_alt do hero
    category: z.string(),                    // slug da categoria (tt 19/36/67)
    categoryName: z.string(),                // nome da categoria
    tags: z.array(z.string()).default([]),   // slugs de tag, ordem de wp_term_relationships
    seoTitle: z.string(),                    // ≤60 chars — RASCUNHO (R20)
    seoDescription: z.string(),              // ≤155 chars — RASCUNHO (R20)
    focusKeyword: z.string(),                // rank_math_focus_keyword (verbatim)
    author: z.string().default('Ana Paula Galastri'),
    authorSlug: z.string().default('ana-paula-galastri'),
    readingTime: z.number().int().positive(),// ceil(palavras/200)
    comments: z.array(z.object({
      id: z.number().int(),
      author: z.string(),
      date: z.coerce.date(),
      body: z.string(),
    })).default([]),                         // ← sempre [] (§4.1)
  }),
});

export const collections = { blog };
```

| campo | obrig. | default | origem / regra |
|---|---|---|---|
| `title` | sim | — | `wp_posts.post_title`, verbatim (acentos preservados) |
| `description` | sim | — | `post_excerpt` (**não** está vazio no dump — ver §6.1 D4; o frontmatter usa a descrição de §3.2.2) |
| `pubDate` | sim | — | `post_date` local → `YYYY-MM-DD` |
| `updatedDate` | não | — | `post_modified` local, **quando é ≠ `pubDate`** — nos 6 posts é emitido (o JSON-LD declara a data real de modificação, DATA-R-07) |
| `hero` | sim | — | `"/wp-content/uploads/" + _wp_attached_file(_thumbnail_id)` |
| `heroAlt` | sim | — | `_wp_attachment_image_alt` do hero; fallback = `title` |
| `category` | sim | — | `wp_terms.slug` do único `term_taxonomy_id` com `taxonomy='category'` ligado ao post |
| `categoryName` | sim | — | `wp_terms.name` do mesmo termo |
| `tags` | sim (pode `[]`) | `[]` | slugs de `taxonomy='post_tag'`, na ordem de `wp_term_relationships` |
| `seoTitle` | sim | — | `rank_math_title` — **AUSENTE** nos 6 ⇒ autorar (rascunho §3.2.2) |
| `seoDescription` | sim | — | `rank_math_description` — **AUSENTE** nos 6 ⇒ autorar (rascunho §3.2.2) |
| `focusKeyword` | sim | — | `rank_math_focus_keyword` (verbatim, com vírgula e acentos) |
| `author` | sim | `'Ana Paula Galastri'` | `wp_users.user_display_name` (user 2) |
| `authorSlug` | sim | `'ana-paula-galastri'` | derivado de `user_nicename`+`last_name` |
| `readingTime` | sim | — | `ceil(palavras / 200)` do texto plano |
| `comments` | sim | `[]` | **sempre `[]`** — §4.1 |

**Loader / `id`:** `glob()` deriva `entry.id` do **nome do arquivo sem extensão** ⇒ `src/content/blog/guarda-compartilhada.md` ⇒ `id === 'guarda-compartilhada'` = `post_name` do WP. **O nome do arquivo DEVE ser o `post_name`** (sem prefixo de data, sem sufixo) — é o que faz `id` = URL.

#### 3.2.0 Fuso horário (armadilha)

- `pubDate: 2024-12-21` **sem aspas** → o parser YAML do Astro devolve `Date` (UTC meia-noite). Com aspas → `string`. `z.coerce.date()` aceita os dois.
- ⚠️ `new Date('2024-12-21')` é **UTC** meia-noite → em `America/Sao_Paulo` (UTC−3) é `2024-12-20 21:00` local, **um dia antes**.
- **Regra obrigatória:** frontmatter sem aspas e **todo** render de data com `timeZone: 'UTC'`:
  `new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(post.data.pubDate)` → "21 de dezembro de 2024". Determinístico e independente do fuso do CI.

#### 3.2.1 Arquivos

```
src/content/blog/5aspectos-cruciais-direito-de-familia.md
src/content/blog/guarda-compartilhada.md
src/content/blog/pis-pasep-2025.md
src/content/blog/jovem-aprendiz.md
src/content/blog/salario-maternidade.md
src/content/blog/bpc-loas-bloqueado.md
```

#### 3.2.2 Frontmatter completo (valores reais; `readingTime` é **placeholder**, o extractor calcula)

**1) `5aspectos-cruciais-direito-de-familia.md`**
```yaml
---
title: "5 Aspectos Cruciais do Direito de Família que Você Precisa Conhecer"
description: "O direito de família lida com as questões jurídicas que envolvem os relacionamentos familiares, incluindo casamento, filhos, sucessão e divisão de bens."
pubDate: 2024-12-21
updatedDate: 2024-12-23
hero: "/wp-content/uploads/2024/12/imagem-padrao-post.jpg"
heroAlt: "Família unida e protegida, ilustrando os benefícios do Direito de Família."
category: "direito-de-familia"
categoryName: "Direito de Família"
tags:
  - "direito-de-familia"
  - "divorcio"
  - "guarda-de-filhos"
  - "heranca"
  - "pensao-alimenticia"
  - "sucessao"
  - "direito-da-crianca"
  - "familia"
  - "patrimonio-familiar"
  - "normas-juridicas"
seoTitle: "5 Aspectos do Direito de Família que Você Deve Conhecer"
seoDescription: "Guarda de filhos, pensão alimentícia, divórcio, herança e sucessão: os 5 pontos essenciais do Direito de Família explicados pela Galastri Advocacia."
focusKeyword: "Direito de Família,guarda de filhos,pensão alimentícia,divórcio,sucessão"
author: "Ana Paula Galastri"
authorSlug: "ana-paula-galastri"
readingTime: 3
comments: []
---
```

**2) `guarda-compartilhada.md`**
```yaml
---
title: "Guarda Compartilhada: 5 Pontos que Você Precisa Saber"
description: "A guarda compartilhada é um modelo de convivência familiar que vem ganhando destaque nas decisões judiciais e na rotina de muitas famílias."
pubDate: 2024-12-24
updatedDate: 2024-12-24
hero: "/wp-content/uploads/2024/12/Guarda-Compartilhada-scaled.jpg"
heroAlt: "Guarda Compartilhada"
category: "direito-de-familia"
categoryName: "Direito de Família"
tags:
  - "direito-de-familia"
  - "guarda-de-filhos"
  - "guarda-compartilhada"
  - "custodia-compartilhada"
  - "pais-separados"
  - "crianca-e-guarda-compartilhada"
  - "responsabilidade-parental"
  - "beneficios-da-guarda-compartilhada"
  - "divisao-de-responsabilidades"
  - "acordo-entre-pais"
seoTitle: "Guarda Compartilhada: 5 Pontos que Você Precisa Saber"
seoDescription: "Entenda como funciona a guarda compartilhada, quem decide sobre os filhos e quais são os direitos e deveres de cada pai no Brasil."
focusKeyword: "Guarda Compartilhada,Direito de Família,Custódia Compartilhada,Pais separados,Criança e guarda compartilhada"
author: "Ana Paula Galastri"
authorSlug: "ana-paula-galastri"
readingTime: 7
comments: []
---
```

**3) `pis-pasep-2025.md`**
```yaml
---
title: "PIS/Pasep 2025: Calendário, Regras e Como Consultar o Abono Salarial"
description: "O PIS/Pasep 2025 é um benefício aguardado por muitos trabalhadores brasileiros que têm direito ao abono salarial."
pubDate: 2024-12-26
updatedDate: 2024-12-26
hero: "/wp-content/uploads/2024/12/imagem-padrao-post-1.png"
heroAlt: "PIS/Pasep 2025"
category: "direito-do-trabalho"
categoryName: "Direito do Trabalho"
tags:
  - "pis-pasep-2025"
  - "abono-salarial"
  - "calendario-pis-pasep-2025"
  - "quem-tem-direito-ao-pis-2025"
  - "consulta-pis-pasep"
  - "novas-regras-pis-pasep-2025"
  - "pagamento-pis-pasep-2025"
  - "como-receber-o-abono-salarial"
  - "valor-do-pis-2025"
  - "requisitos-pis-pasep-2025"
seoTitle: "PIS/Pasep 2025: Calendário, Regras e Como Consultar"
seoDescription: "Calendário do PIS/Pasep 2025, quem tem direito ao abono salarial e como consultar o seu pagamento no Portal do Trabalho."
focusKeyword: "PIS/Pasep 2025,Como consultar PIS/Pasep,Regras do abono salarial,Abono salarial 2025"
author: "Ana Paula Galastri"
authorSlug: "ana-paula-galastri"
readingTime: 5
comments: []
---
```

**4) `jovem-aprendiz.md`**
```yaml
---
title: "Jovem Aprendiz Tem Direito a Seguro-Desemprego?"
description: "O jovem aprendiz é uma excelente oportunidade para quem busca ingresso no mercado de trabalho enquanto ainda estuda."
pubDate: 2024-12-26
updatedDate: 2024-12-26
hero: "/wp-content/uploads/2024/12/imagem-padrao-post-2.png"
heroAlt: "jovem aprendiz"
category: "direito-do-trabalho"
categoryName: "Direito do Trabalho"
tags:
  - "jovem-aprendiz"
  - "seguro-desemprego"
  - "direitos-trabalhistas"
  - "programa-de-aprendizagem"
  - "contrato-de-trabalho"
  - "beneficios-trabalhistas"
  - "aprendiz-e-seguro-desemprego"
  - "direitos-do-jovem-aprendiz"
  - "beneficios-do-programa-jovem-aprendiz"
  - "contratacao-jovem-aprendiz"
seoTitle: "Jovem Aprendiz Tem Direito a Seguro-Desemprego?"
seoDescription: "O jovem aprendiz tem direito ao seguro-desemprego? Veja a regra geral, a exceção prevista em lei e como solicitar o benefício."
focusKeyword: "Jovem Aprendiz"
author: "Ana Paula Galastri"
authorSlug: "ana-paula-galastri"
readingTime: 7
comments: []
---
```

**5) `salario-maternidade.md`**
```yaml
---
title: "Salário-maternidade pode ser prorrogado por complicações no parto"
description: "O salário-maternidade é um direito garantido pela legislação brasileira para todas as trabalhadoras, com o objetivo de proporcionar um período de afastamento do trabalho após o nascimento de um filho."
pubDate: 2024-12-26
updatedDate: 2024-12-26
hero: "/wp-content/uploads/2024/12/imagem-padrao-post-3.png"
heroAlt: "Salário-maternidade"
category: "direito-previdenciario"
categoryName: "Direito Previdenciário"
tags:
  - "salario-maternidade"
  - "prorrogacao-do-salario-maternidade"
  - "licenca_maternidade"
  - "complicacoes_no_parto"
  - "direito-da-gestante"
  - "beneficios-do-inss"
  - "prorrogacao-de-licenca"
  - "inss"
  - "licenca-maternidade-estendida"
  - "segurada-do-inss"
seoTitle: "Salário-maternidade pode ser prorrogado por complicações no parto"
seoDescription: "Entenda em que casos o salário-maternidade pode ser prorrogado por complicações no parto e como requerer a prorrogação junto ao INSS ou ao empregador."
focusKeyword: "Salário-maternidade"
author: "Ana Paula Galastri"
authorSlug: "ana-paula-galastri"
readingTime: 9
comments: []
---
```

**6) `bpc-loas-bloqueado.md`**
```yaml
---
title: "BPC/Loas Bloqueado? Veja Como Regularizar e Voltar a Receber o Benefício"
description: "Se o seu BPC/Loas foi bloqueado, não se preocupe. Esse benefício, que garante um salário mínimo mensal para idosos e pessoas com deficiência em situação de vulnerabilidade social, pode ser regularizado rapidamente."
pubDate: 2024-12-26
updatedDate: 2024-12-26
hero: "/wp-content/uploads/2024/12/BPC.png"
heroAlt: "BPC/Loas"
category: "direito-previdenciario"
categoryName: "Direito Previdenciário"
tags:
  - "inss"
  - "bpc"
  - "loas"
  - "beneficio-de-prestacao-continuada"
  - "bloqueio-do-bpc"
  - "regularizacao-do-bpc"
  - "cadastro-unico"
  - "cras"
  - "atualizacao-de-dados"
  - "beneficio-bloqueado"
seoTitle: "BPC/Loas Bloqueado? Veja Como Regularizar o Benefício"
seoDescription: "Seu BPC foi bloqueado? Veja os motivos mais comuns, como atualizar o Cadastro Único no Cras e voltar a receber o benefício."
focusKeyword: "BPC/Loas"
author: "Ana Paula Galastri"
authorSlug: "ana-paula-galastri"
readingTime: 10
comments: []
---
```

> ⚠️ `rank_math_focus_keyword` é **verbatim**, com a vírgula (separador multi-chave do Rank Math) e a capitalização original. Não reescrever como array neste campo — `focusKeyword` é uma string.
> ⚠️ `seoTitle` / `seoDescription` acima são **RASCUNHOS** (R20): não existem no dump, foram autorados e **dependem da aprovação da advogada**. O `<title>`/`<meta description>` finais saem de `site.json.seo.perUrl` (fonte única de verdade), que deve conter exatamente estes valores até a aprovação.
> ⚠️ `readingTime` é ilustrativo — o extractor calcula `ceil(palavras/200)`; o assert §6.1 valida o valor final.

### 3.3 As 3 páginas de política (R8 — páginas Astro nativas, não collection)

**Por que não collection:** `src/data/pages/*.md` **não funciona** sem plumbing (fora de `src/pages/` e fora de uma collection, o Astro não processa `.md` — seria preciso `gray-matter`, dependência nova). Uma collection `pages` funciona, mas custa 8 linhas de config + `getCollection` + `render()` para **3 arquivos** que nunca são listados, filtrados ou paginados. Páginas nativas usam o suporte a frontmatter que o Astro já traz, **zero configuração**, e produzem a URL **idêntica** ao `post_name` do WP — o que elimina 3 redirects.

```
src/pages/politica-de-privacidade.md
src/pages/politica-de-cookies-galastri-advocacia.md
src/pages/politica-de-uso-de-inteligencia-artificial-galastri-advocacia.md
```

| arquivo | WP post | `post_content` (chars) | `post_date` (o `post_modified` real é `2024-12-26` — §6.1 D5/D12) |
|---|---:|---:|---|
| `politica-de-privacidade.md` | 3 | 5.321 | 2024-12-20 12:31:50 |
| `politica-de-cookies-galastri-advocacia.md` | 83 | 6.437 | 2024-12-20 16:18:31 |
| `politica-de-uso-de-inteligencia-artificial-galastri-advocacia.md` | 85 | 5.015 | 2024-12-20 16:20:46 |

**Frontmatter:**

```yaml
---
title: "Política de Privacidade – Galastri Advocacia"
description: "Galastri Advocacia se compromete a proteger a privacidade e os dados pessoais de seus clientes e visitantes. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos as informações obtidas por meio de nosso site e blog."
updatedDate: 2024-12-20
layout: "~/layouts/PolicyLayout.astro"
---
```

| arquivo | `title` | `description` (1º parágrafo, verbatim do dump) |
|---|---|---|
| `politica-de-privacidade.md` | `Política de Privacidade – Galastri Advocacia` | "A Galastri Advocacia se compromete a proteger a privacidade e os dados pessoais de seus clientes e visitantes. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos as informações obtidas por meio de nosso site e blog." |
| `politica-de-cookies-galastri-advocacia.md` | `Política de Cookies – Galastri Advocacia` | "A **Galastri Advocacia** utiliza cookies para proporcionar uma melhor experiência ao usuário ao acessar nosso site e blog. Esta Política explica o que são cookies, como os utilizamos e como você pode gerenciá-los." |
| `politica-de-uso-de-inteligencia-artificial-galastri-advocacia.md` | `Política de Uso de Inteligência Artificial – Galastri Advocacia` | "Na **Galastri Advocacia**, prezamos pela transparência e ética no uso de tecnologias, incluindo ferramentas baseadas em Inteligência Artificial (I.A.). Esta Política esclarece como utilizamos a I.A. em nossos serviços e plataformas digitais, assegurando que sua privacidade e confiança sejam respeitadas." |

- `title` = texto do cabeçalho do corpo, com hífen normalizado para `–`. O `<title>` do HTML é `site.seo.perUrl["<url>"].title` (**fonte única**, R20) — evita duplicar meta em dois lugares; o assert §6.7 verifica a coerência.
- `updatedDate` = `2024-12-20` — a **data de vigência** do corpo do texto (o `post_modified` real é `2024-12-26`; ver §6.1 D12). **Não usar `pubDate` como "vigência"** — a vigência é o texto do corpo ("Data de Vigência: 20/12/2024"), que é o dado legal.
- ⚠️ **A Política de Privacidade precisa de revisão jurídica** (§4.5 item 6): o texto atual não declara o Formspree, o prazo de retenção nem o canal do encarregado. **Bloqueia o go-live** (ver `docs/SPEC-SECURITY.md` §5).

**Conversão Gutenberg → Markdown (regra determinística):**

1. **Parse dos blocos.** Reconhecer abertura `<!-- wp:{name} {json-attrs} -->`, fechamento `<!-- /wp:{name} -->`, auto-fechado `<!-- wp:{name} /-->`.
2. **Normalizar malformação (post 723).** O dump contém `<p><!-- /wp:paragraph --><!-- wp:paragraph --></p>` — um fechamento de bloco **dentro** de um `<p>`. Regra: ao encontrar um comentário de bloco dentro do conteúdo de um elemento inline, remover o comentário e **fechar o `<p>` imediatamente antes do próximo bloco** (mover o `</p>` para antes do `<!-- /wp:paragraph -->`). Resultado esperado para 723: `<p>…</p>` + `<p>…</p>`, sem tags vazias.
3. **Blocos de abertura sem fechamento válido:** inferir o nível pela tag HTML interna (`<h2>` → 2) — ex.: post 610, `<!-- wp:heading -->\n<h2>O Que é Guarda Compartilhada?</h2>\n<!-- /wp:heading -->`.
4. **Mapeamento bloco → Markdown:**

| bloco Gutenberg | saída |
|---|---|
| `paragraph` | parágrafo Markdown (remove o `<p>` interno; `<strong>`→`**`, `<em>`→`*`, `<a>`→`[texto](url)`) |
| `heading` | `#`…`######` conforme `level` |
| `list` / `list-item` | `- item` / `  - item` (2 espaços de indentação) |
| `separator` | `---` |
| `image` | `![alt](url)` |
| `quote` / `pullquote` | `> texto` |
| `code` / `preformatted` | bloco cercado por ``` |
| `buttons` / `button` | `[rótulo](url)` |
| `embed` / `html` | HTML bruto preservado |
| `gallery` | `<figure>` bruto |
| `table` | tabela Markdown |

5. **Limpeza obrigatória do HTML interno:** remover `class="wp-block-*"`, `class="has-*-color"`, `style="..."` inline, `id` gerados pelo WP (exceto âncoras internas cujo `href` seja interno) e `<!-- wp:... -->` residuais.
6. **Blocos não mapeáveis** → HTML interno emitido como **HTML bruto** (o pipeline Markdown do Astro inclui `rehype-raw` por padrão; se isso for confirmado como falso no `astro.config`, a alternativa é o dev mover o corpo para um `.html` parcial importado por `set:html` — mesma saída).
7. **Links internos:** reescrever `https://galastriadvocacia.com.br/<slug>/` → rota interna do site novo. Se o destino não existir (ex.: `/category/...`), reescrever para a rota nova equivalente.
8. **Assert:** **0 ocorrências** de `<!-- wp:` no output (§6.3).

### 3.4 `src/data/site.json`

#### 3.4.1 Forma (chaves e tipos)

```jsonc
{
  "site": {
    "name": "Galastri Advocacia",
    "legalName": "Galastri Advocacia - Escritório de Advocacia - Jundiaí - SP",
    "description": "Soluções Jurídicas Personalizadas",
    "lang": "pt-BR",
    "url": "https://galastriadvocacia.com.br",
    "timezone": "America/Sao_Paulo",
    "email": "contato@galastriadvocacia.com.br",     // R6
    "whatsapp": "5511985665992",
    "whatsappUrl": "https://wa.me/5511985665992",
    "phone": "(11) 98566-5992",
    "address": {
      "street": "Avenida Henrique Brunini",
      "city": "Jundiaí",
      "state": "SP",
      "country": "BR",
      "mapsQuery": "Avenida Henrique Brunini Jundiaí"
    },
    "socials": {
      "instagram": "https://www.instagram.com/galastriadvocacia/",
      "whatsapp": "https://wa.me/5511985665992"
    },
    "formats": { "date": "d/m/Y", "time": "H:i" },
    "author": {
      "name": "Ana Paula Galastri",
      "slug": "ana-paula-galastri",
      "role": "Dra.",
      "bio": "É uma advogada renomada com mais de uma década de experiência, especialista em Direito de Família, Direito do Trabalho, Direito Previdenciário e Direito Civil. Com uma trajetória marcada pelo comprometimento e pela busca incansável por justiça, ela é reconhecida por sua habilidade em oferecer soluções jurídicas eficazes e personalizadas. Sua dedicação, aliada a uma abordagem humana e estratégica, faz dela uma profissional admirada e uma defensora excepcional dos direitos de seus clientes, sempre pautada pela ética e pela excelência."
    }
  },
  "nav": [ /* 7 itens, §3.4.2 */ ],
  "categories": [ /* 3, §3.4.3 */ ],
  "tags": [ /* 57, §3.4.3 */ ],
  "theme": { /* §3.4.4 */ },
  "form": { /* §3.4.5 */ },
  "seo": { /* §3.4.6 */ },
  "routes": { /* §3.4.7 */ }
}
```

> `site.email` = `contato@galastriadvocacia.com.br` (R6). O `admin_email` do WP (`administrador@…`) **não entra** em nenhuma chave.

#### 3.4.2 `nav` — 7 itens, ordem = `wp_posts.menu_order` dos `nav_menu_item` 810–816

```json
"nav": [
  { "label": "Home",             "href": "/",                "menuOrder": 1, "wpId": 810, "kind": "page" },
  { "label": "Sobre",            "href": "/#sobre",          "menuOrder": 2, "wpId": 812, "kind": "anchor" },
  { "label": "Áreas de Atuação","href": "/#areasdeatuacao", "menuOrder": 3, "wpId": 813, "kind": "anchor" },
  { "label": "Serviços",         "href": "/#servicos",       "menuOrder": 4, "wpId": 814, "kind": "anchor" },
  { "label": "Quem Sou",         "href": "/#quemsou",        "menuOrder": 5, "wpId": 815, "kind": "anchor" },
  { "label": "Blog",             "href": "/blog/",           "menuOrder": 6, "wpId": 811, "kind": "page" },
  { "label": "Contato",          "href": "/#contato",        "menuOrder": 7, "wpId": 816, "kind": "anchor" }
]
```

> **Origem:** `_menu_item_url` (812→`…/#sobre`, 813→`#areasdeatuacao`, 814→`#servicos`, 815→`#quemsou`, 816→`#contato`), `_menu_item_type`/`_menu_item_object_id` (810→page 30, 811→page 464), `post_title` (812–816 literais; **810 e 811 estão vazios** em `post_title` → resolvidos do título da página).
> **Rota dos âncoras:** canônico é `/#id` (a home real é `/`). O WP gravou `/home/#areasdeatuacao` em um ponto → vira redirect para `/#areasdeatuacao`.
> **`#quemsou` vs `#quem-sou`:** o `_element_id` real é `quemsou` (sem hífen) — **não "corrigir"**, senão o `scroll-offset` do `custom_css` (post 136) quebra.

#### 3.4.3 `categories` e `tags`

```json
"categories": [
  { "slug": "direito-de-familia",     "name": "Direito de Família",     "wpTermId": 19, "postCount": 2, "href": "/category/direito-de-familia/" },
  { "slug": "direito-do-trabalho",    "name": "Direito do Trabalho",    "wpTermId": 36, "postCount": 2, "href": "/category/direito-do-trabalho/" },
  { "slug": "direito-previdenciario", "name": "Direito Previdenciário", "wpTermId": 67, "postCount": 2, "href": "/category/direito-previdenciario/" }
],
"tags": [
  { "slug": "direito-de-familia", "name": "Direito de Família", "wpTermId": 9, "postCount": 2, "href": null },
  { "slug": "divorcio", "name": "Divórcio", "wpTermId": 10, "postCount": 1, "href": null }
  // … 57 entradas no total; `href: null` porque NÃO há páginas de tag (R4)
]
```

- `postCount` = contagem **real** de posts publicados (recalculada de `wp_term_relationships` filtrando `post_status='publish'`), **não** o campo `wp_term_taxonomy.count` (defasado: `tt 35 'popup'` tem `count=2` mas 6 relações). Ordenação: **`term_id` ascendente** (fiel à origem, determinístico, idempotente) — categorias (19, 36, 67) e tags.
- Tags sem uso real (count=0) **não entram**.
- `href: null` nas tags: as tags existem como **dados** (frontmatter) mas **não têm rota** (R4).

#### 3.4.4 `theme`

```json
"theme": {
  "colors": {
    "accent": "#B68C5A",
    "primary": "#2E2E2E",
    "secondary": "#2E2E2E",
    "text": "#7A7A7A",
    "container": "#F3F3F3",
    "success": "#0C884A",
    "danger": "#C1121F",
    "info": "#1C77BE",
    "white": "#FFFFFF",
    "link": "#398FFC"
  },
  "fonts": {
    "heading": { "family": "Questrial", "weight": 600, "size": "47px" },
    "headingSecondary": { "family": "Questrial", "weight": 600, "size": "19px" },
    "body": { "family": "Nunito", "weight": 500, "size": "15px", "lineHeight": 1.6 }
  },
  "fontDisplay": "swap",
  "googleFonts": true,
  "containerWidth": "1200px",
  "radius": "0px",
  "preloader": false
}
```

| cor | origem real | observação |
|---|---|---|
| `accent` `#B68C5A` | kit `system_colors.accent` **e** `theme_mods_kava.accent_color` | coincide |
| `primary` `#2E2E2E` | kit `system_colors.primary` | |
| `secondary` `#2E2E2E` | kit `system_colors.secondary` | |
| `text` `#7A7A7A` | kit `system_colors.text` | ⚠️ ver correção de contraste em `docs/SPEC-UI.md` §4.1 (A6/A7) |
| `container` `#F3F3F3` | kit `custom_colors['6809653']` ("White Smoke") | |
| `success` `#0C884A` | kit `custom_colors['e95ff82']` ("Sea Green") | |
| `danger` `#C1121F` | kit `custom_colors['aa84f74']` ("Fire Brick") | |
| `info` `#1C77BE` | kit `custom_colors['4af8520']` ("French Blue") | |
| `white` `#FFFFFF` | kit `custom_colors['9b3e70b']` ("White") | |
| `link` `#398FFC` | `theme_mods_kava.link_color` | |

> ⚠️ **R7 — a paleta do kit é a canônica.** `theme_mods_kava` tem **outra** paleta (`#3b3d42` / `#a1a2a4` / Roboto) que **não** é a das páginas renderizadas. `theme_mods_kava` contribui apenas o que o kit não tem: `containerWidth`, `fontDisplay`, `googleFonts`, `preloader`.
> ⚠️ `preloader: false` (R11) — `page_preloader=1` era o preloader de imagem do Kava, não um spinner.

#### 3.4.5 `form` (contato) — **4 campos** (R5)

```json
"form": {
  "provider": "formspree",
  "endpoint": "https://formspree.io/f/<FORM_ID>",
  "emailTo": "contato@galastriadvocacia.com.br",
  "subject": "Novo contato pelo site — Galastri Advocacia",
  "method": "POST",
  "fields": [
    { "name": "nome",     "type": "text",     "label": "Nome completo",     "placeholder": "Digite seu nome completo",   "required": true, "mask": null,    "autocomplete": "name",  "maxlength": 120 },
    { "name": "email",    "type": "email",    "label": "E-mail",             "placeholder": "Digite seu e-mail",           "required": true, "mask": "email", "autocomplete": "email", "maxlength": 254 },
    { "name": "telefone", "type": "tel",      "label": "Telefone/WhatsApp",  "placeholder": "Digite seu telefone com DDD", "required": true, "mask": "phone", "autocomplete": "tel",   "maxlength": 19 },
    { "name": "mensagem", "type": "textarea", "label": "Mensagem",           "placeholder": "Conte brevemente o seu caso:", "required": true, "mask": null,    "autocomplete": null,    "minlength": 20, "maxlength": 4000 }
  ],
  "honeypot": { "name": "_gotcha", "type": "text" },
  "submitLabel": "Enviar mensagem",
  "successMessage": "Mensagem enviada com sucesso! Em breve, nossa equipe entrará em contato.",
  "errorMessage": "Não foi possível enviar sua mensagem. Por favor, tente novamente ou fale conosco pelo WhatsApp.",
  "whatsappCta": {
    "label": "Prefere falar agora? Fale com a gente pelo WhatsApp",
    "href": "https://wa.me/5511985665992"
  },
  "privacyConsent": {
    "required": true,
    "label": "Li e autorizo o tratamento dos meus dados pessoais para contato, conforme a Política de Privacidade.",
    "link": "/politica-de-privacidade/",
    "helper": "Os dados serão utilizados apenas para retorno do contato e não serão compartilhados com terceiros."
  },
  "colors": {
    "fieldBg": "#2E2E2ECF",
    "fieldBorder": "#F3F3F34D",
    "fieldBorderFocus": "#E8C79A",
    "fieldRadius": 30,
    "label": "#F3F3F3",
    "inputText": "#F3F3F3",
    "buttonBackground": "#BC9265",
    "buttonText": "#2E2E2E",
    "buttonHoverBackground": "#C9A377",
    "successBackground": "#0C884A",
    "successText": "#0A7240",
    "errorBackground": "#C1121F",
    "errorText": "#C1121F",
    "infoBackground": "#1C77BE"
  },
  "masks": {
    "phone": { "pattern": "^\\(\\d{2}\\)\\s\\d{5}-\\d{4}$", "placeholder": "(11) 99999-9999" },
    "email": { "pattern": "^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$", "placeholder": "voce@email.com" }
  }
}
```

> ⚠️ **R5 — os 4 campos vêm do widget `3273196` e da renderização do Wayback.** Nomes no Elementor: `name`, `email`, `field_d252ca6` (tel mascarado), `message` → mapeados para nomes semânticos (`nome`, `email`, `telefone`, `mensagem`); o Formspree aceita nomes livres. **O campo `assunto` NÃO existe** — a proposta de 5 campos do dba foi rejeitada.
> ⚠️ **O dev DEVE validar a lista de campos contra o `_elementor_data` atual e reportar qualquer divergência** (Q2, §7). O extractor emite `extract-report.json → formFields` com os campos reais do widget `form`.
> ⚠️ `whatsappCta` é **obrigatório**: o plano gratuito do Formspree é de **50 submissões/mês** e um estouro de cota faz o formulário **parar de funcionar sem erro visível** (ver `docs/SPEC-SECURITY.md` SEC-41). O CTA permanente de WhatsApp ao lado do formulário é o plano B.
> ⚠️ `honeypot.name = "_gotcha"` (padrão Formspree). O Elementor Pro usava `form_fields[form_checkbox]`; ver `docs/SPEC-UI.md` §2.5.
> ⚠️ `emailTo` = `contato@galastriadvocacia.com.br` (R6) — é o `email_to` do widget. O `admin_email` do WP **não** é usado.

#### 3.4.6 `seo` (R20 — `perUrl` é a fonte única de verdade)

```json
"seo": {
  "default": {
    "titleTemplate": "%s | Galastri Advocacia",
    "titleSuffix": "| Galastri Advocacia",
    "description": "Galastri Advocacia oferece assessoria em Direito Civil e Trabalhista. Agende sua consulta e receba atendimento personalizado em Jundiaí.",
    "ogImage": "/wp-content/uploads/2024/12/galastri-advocacia-banner-destaque.png",
    "twitterCard": "summary_large_image",
    "locale": "pt_BR",
    "robots": "index, follow, max-image-preview:large"
  },
  "perUrl": {
    "/": {
      "title": "Advocacia Especializada em Jundiaí | Galastri Advocacia",
      "description": "Galastri Advocacia oferece assessoria em Direito Civil e Trabalhista. Agende sua consulta e receba atendimento personalizado em Jundiaí.",
      "focusKeyword": "advocacia Jundiaí",
      "status": "approved"
    },
    "/blog/": { "title": "Blog | Artigos de Direito Civil, Trabalhista e Previdenciário", "description": "Artigos sobre direito de família, direito do trabalho e direito previdenciário escritos pela equipe da Galastri Advocacia, em Jundiaí-SP.", "focusKeyword": "blog jurídico Jundiaí", "status": "draft" },
    "/5aspectos-cruciais-direito-de-familia/": { "title": "…", "description": "…", "focusKeyword": "…", "status": "draft" },
    "/guarda-compartilhada/": { "title": "…", "description": "…", "status": "draft" },
    "/pis-pasep-2025/": { "title": "…", "description": "…", "status": "draft" },
    "/jovem-aprendiz/": { "title": "…", "description": "…", "status": "draft" },
    "/salario-maternidade/": { "title": "…", "description": "…", "status": "draft" },
    "/bpc-loas-bloqueado/": { "title": "…", "description": "…", "status": "draft" },
    "/category/direito-de-familia/": { "title": "…", "description": "…", "status": "draft" },
    "/category/direito-do-trabalho/": { "title": "…", "description": "…", "status": "draft" },
    "/category/direito-previdenciario/": { "title": "…", "description": "…", "status": "draft" },
    "/politica-de-privacidade/": { "title": "Política de Privacidade | Galastri Advocacia", "description": "Saiba como a Galastri Advocacia coleta, utiliza, armazena e protege os seus dados pessoais, conforme a LGPD.", "status": "draft" },
    "/politica-de-cookies-galastri-advocacia/": { "title": "Política de Cookies | Galastri advocacia", "description": "Entenda quais cookies a Galastri Advocacia utiliza, para que servem e como gerenciá-los no seu navegador.", "status": "draft" },
    "/politica-de-uso-de-inteligencia-artificial-galastri-advocacia/": { "title": "Política de Uso de Inteligência Artificial | Galastri Advocacia", "description": "Conheça como a Galastri Advocacia utiliza inteligência artificial em seus serviços e plataformas, com transparência e revisão jurídica.", "status": "draft" },
    "/links/": { "title": "Links Úteis | Galastri Advocacia", "description": "Links para agendamento de consulta, Instagram e informações institucionais da Galastri Advocacia.", "status": "draft" },
    "/404": { "title": "Página não encontrada | Galastri Advocacia", "description": "A página que você procura não existe ou foi movida.", "status": "draft" }
  },
  "organization": {
    "@type": "LegalService",
    "name": "Galastri Advocacia",
    "url": "https://galastriadvocacia.com.br",
    "telephone": "+55-11-98566-5992",
    "email": "contato@galastriadvocacia.com.br",
    "address": { "@type": "PostalAddress", "streetAddress": "Avenida Henrique Brunini", "addressLocality": "Jundiaí", "addressRegion": "SP", "addressCountry": "BR" },
    "sameAs": ["https://www.instagram.com/galastriadvocacia/"]
  },
  "article": {
    "@type": "Article",
    "publisher": { "@type": "Organization", "name": "Galastri Advocacia" },
    "author": { "@type": "Person", "name": "Ana Paula Galastri" }
  }
}
```

**Regras:**
- `seo.default.description` e `seo.perUrl["/"].description` vêm **verbatim** de `wp_postmeta` do post 30 (`rank_math_description` / `rank_math_title`) — são os **únicos** dois valores de SEO existentes no dump.
- **Os 6 posts não têm `rank_math_title`/`rank_math_description`** → os valores de `perUrl` dos posts são os **rascunhos** de §3.2.2, marcados com `"status": "draft"` e **pendentes de aprovação da advogada** (R20).
- **`perUrl` é a fonte única de verdade** de `<title>` / `<meta name="description">`. As páginas Markdown leem de lá (via `site.json`), não do próprio frontmatter — evita divergência. O assert §6.7 confere a coerência entre `perUrl` e o frontmatter dos posts.
- `focusKeyword` por URL: para os posts = `rank_math_focus_keyword`; para as páginas = autorado.
- **Schema.org:** não há `rank_math_schema_Article` no dump → o JSON-LD é gerado pelo template a partir de `seo.organization` + `seo.article` + os campos do post. `BlogPosting` (não `Article`) para os posts, `WebPage` para as políticas, `CollectionPage` para o índice do blog.

#### 3.4.7 `routes`

```json
"routes": {
  "home": "/",
  "blogIndex": "/blog/",
  "blogPost": "/<slug>/",
  "blogCategory": "/category/<slug>/",
  "blogTag": null,
  "policy": "/<slug>/",
  "links": "/links/",
  "notFound": "/404"
}
```

> `blogTag: null` — R4: sem páginas de tag. `blogPost` é `/<slug>/` (raiz), não `/blog/<slug>/`.

#### 3.4.8 `src/data/redirects.json` (R4)

```json
{
  "/home/": "/"
}
```

Derivado mecanicamente: para cada post/página sobrevivente com URL antiga ≠ URL nova, emitir 301. **Gerado pelo extractor** (determinístico), não escrito à mão. Com as rotas de R4, o arquivo contém **praticamente só** `"/home/"` → `"/"`. (O `redirects.json` alimenta: (a) a página alias `src/pages/home.astro` com `canonical` + meta-refresh; (b) la Redirect Rule 301 do Cloudflare — ver `docs/PLAN.md` Fase 5.)

### 3.5 `src/data/elementor/*.json` — a árvore Elementor normalizada

#### 3.5.1 Schema do nó

```jsonc
{
  "id": "af9b6b1",                 // Elementor element id (string)
  "elType": "container",           // "container" | "widget"
  "widgetType": "heading",         // OBRIGATÓRIO só quando elType === "widget"
  "label": "Destaque",             // settings._title (rótulo humano)
  "cssId": "home",                 // settings._element_id normalizado (§3.5.3)
  "settings": { },                 // já filtrado (§3.5.2) e com URLs reescritas
  "elements": [ /* filhos, mesma forma */ ],
  "isInner": false                 // true = container interno
}
```

**Contrato de renderização:**
- `elType === 'container'` → `<div>` com as classes de grid/flex de `settings` (markup exato em `docs/SPEC-UI.md` §1.1).
- `elType === 'widget'` → o componente correspondente a `widgetType`; `settings` é o input.
- `isInner: true` → o filho não gera um container de topo; vive em `elements[]` do widget pai.
- `cssId` → vira o atributo `id` do elemento renderizado **na raiz do nó**. É isso que faz `/#sobre` funcionar.

#### 3.5.2 `settings`: o que extrair, por tipo de nó

**Regras globais (todos os nós):**

1. **Remover** (deny-list): `__dynamic__` (após resolução), `_id`, `presetTitle`, `presetIcon`, `hover_parallax`, `eicon-*`, `sizes` (arrays vazios), `__globals__` (após resolução), `sticky`, `motion_fx_*`, `scroll_*`, `responsive_*`, `_column_size`, `element_*_double`.
2. **Remover variantes responsivas:** toda chave que termina em `_mobile`, `_tablet`, `_tablet_extra`, `_laptop`, `_widescreen`, `_tablet_extra_active`.
3. **Resolver `__globals__` antes de remover:** `globals/colors?id=<kitColorId>` → o hex do kit (§3.4.4); `globals/typography?id=<kitTypographyId>` → família/peso/tamanho. Se não resolver → remover a chave e registrar no relatório.
4. **Resolver `__dynamic__`:** `[elementor-tag name="site-logo"]` → `{ "url": "/wp-content/uploads/2024/12/galastri-advocacia-logo-horizontal-transparente-e1734733392829.png", "alt": "Galastri Advocacia" }`; `[elementor-tag name="user-info" type="login" before="Olá, "]` → `{ "text": "Ana Paula Galastri" }`. Tags não resolvíveis → remover a chave.
5. **Reescrever URLs** em qualquer string que case com `https://galastriadvocacia.com.br/wp-content/uploads/...` → `/wp-content/uploads/...`.
6. **Achatar** objetos de medida `{unit, size, sizes}` → `{unit, size}`; `sizes: []` removido.
7. **Manter** escalares, strings, arrays de strings e objetos simples; profundidade máxima 3.

**Whitelist por tipo:**

| `elType` / `widgetType` | chaves de `settings` mantidas |
|---|---|
| `container` | `flex_direction`, `flex_wrap`, `flex_justify_content`, `flex_align_items`, `flex_gap`, `grid_columns_grid`, `grid_rows_grid`, `grid_auto_flow`, `grid_justify_items`, `grid_align_items`, `container_type`, `content_width`, `width`, `boxed_width`, `min_height`, `background_background`, `background_color`, `background_image`, `background_position`, `background_size`, `background_repeat`, `background_overlay_background`, `background_overlay_color`, `background_overlay_image`, `background_overlay_position`, `background_overlay_size`, `background_overlay_opacity`, `padding`, `margin`, `border_radius`, `box_shadow_box_shadow`, `animation`, `animation_duration`, `css_classes`, `layout_*` |
| `heading` | `title`, `title_color`, `align`, `typography_typography`, `typography_font_family`, `typography_font_size`, `typography_font_weight`, `typography_text_transform`, `link_color`, `header_size` |
| `text-editor` | `editor` (HTML interno), `columns` |
| `image` | `image` (objeto `{url,id,size,alt,source}` → normalizado para `{url, alt}`), `image_size`, `caption`, `link`, `link_open_new`, `width` |
| `button` | `text`, `link`, `align`, `size`, `background_color`, `text_color`, `border_radius`, `border_color`, `border_width`, `typography_typography`, `typography_font_family`, `typography_font_size`, `typography_font_weight`, `icon` |
| `icon-box` | `title`, `description`, `icon`, `link`, `icon_position`, `title_color`, `description_color`, `background_color` |
| `icon-list` | `items` (array), `icon_position`, `list_items` |
| `image-box` | `image`, `title`, `description`, `link` |
| `form` | `form_fields`, `form_title`, `form_description`, `submit_label`, `success_message`, `error_message`, `required_mark`, `column_layout`, `field_placeholder`, `input_size`, `label_position` |
| `nav-menu` | `menu`, `menu_name`, `pointer`, `align`, `menu_typography_*`, `link_color`, `link_hover_color` |
| `theme-site-logo` | `align`, `logo` (resolvido de `__dynamic__`) |
| `post-grid` (UPK) | `columns`, `row_gap`, `image_height`, `primary_thumbnail_size`, `show_date`, `show_author`, `meta_separator`, `show_pagination`, `show_comments`, `content_padding`, `upk_in_animation_*`, `grid_style` |
| `ekit-testimonial` | `ekit_testimonial_style`, `ekit_testimonial_data[]`, `ekit_testimonial_column`, `ekit_testimonial_rating` |
| `text-path` / `divider` / `spacer` | `text_path`, `stroke_width`, `divider_color`, `space_height` |
| **qualquer outro** (fallback) | todos os escalares/strings, com deny-list e regras globais; chaves de tipo não reconhecido registradas em `unknown-widget-types.json` |

> **Regra de fallback (essencial):** um `widgetType` desconhecido **não** pode quebrar a extração. O extractor: (a) mantém o nó com `settings` filtrado pelo fallback; (b) registra `{widgetType, postId, elementId}` no `extract-report.json`; (c) o assert §6.2 falha se houver widgetTypes desconhecidos **nos 7 documentos que serão renderizados** (30, 48, 49, 516, 525, 790, 843).

#### 3.5.3 Derivação do **CSS ID** (regra crítica)

**Fonte confirmada no dump:** `settings._element_id`.

1. Se `settings._element_id` existir e for string não-vazia: `trim()` → lowercase → remover acentos (NFD + `\p{Diacritic}`) → substituir qualquer caractere fora de `[a-z0-9-]` por `-` → colapsar `-` repetidos → remover `-` das pontas. Resultado = `cssId`.
2. **Fallback** (sem `_element_id`): `settings._title` normalizado com o mesmo algoritmo, **prefixado com `el-`** (ex.: `"Destaque"` → `el-destaque`; `"Áreas de atuação"` → `el-areas-de-atuacao`); se `_title` também ausente → `cssId = "el-" + id` (ex.: `el-af9b6b1`).
3. **Reserva de IDs:** os 6 IDs âncora (`home`, `sobre`, `areasdeatuacao`, `servicos`, `quemsou`, `contato`) são **reservados**. Se um nó gerar um desses por fallback, renomear para `el-<valor>` e registrar. Se dois nós gerarem o mesmo `cssId` → **falha** (colisão de âncora = bug).
4. O `cssId` é emitido como **campo irmão** do nó, **não** dentro de `settings`. `settings._element_id` é removido na normalização.
5. **`_element_id` observado:** `home` (template 759 "Destaque" + container raiz do post 30) · `sobre` (762 "Sobre") · `areasdeatuacao` (766 "Áreas de atuação") · `servicos` (769 "Soluções") · `quemsou` (775 "Equipe") · `contato` (784 "Contato") → **6 âncoras confirmadas**.

#### 3.5.4 Formato de saída

```json
{
  "meta": {
    "sourcePostId": 30,
    "postType": "page",
    "postName": "home",
    "elementorTemplateType": "wp-page",
    "title": "Home",
    "elementCount": 63,
    "cssIds": ["home", "sobre", "areasdeatuacao", "servicos", "quemsou", "contato"]
  },
  "root": [ { "id": "af9b6b1", "elType": "container", "label": "Destaque", "cssId": "home", "settings": {}, "elements": [], "isInner": false }, { "id": "7dffe5f", "…": "…" } ]
}
```

> ⚠️ **`root` é um ARRAY, não um objeto.** O `_elementor_data` do Elementor é uma lista de elementos de topo; o objeto único que a spec original descrevia **não existe**. A forma correta é `"root": [ {…}, {…} ]` — no post 30 são **10** elementos de topo. O renderer consome `root` como array (SPEC-UI §1.1: o 1º elemento é o container-raiz, os demais são irmãos de nível superior). O fixture `tests/fixtures/elementor-cache-*.html` continua sendo **HTML renderizado** (oráculo), não JSON.

- `meta.elementCount` = contagem **recursiva** de todos os nós.
- `meta.cssIds` = lista ordenada de âncoras do documento.
- Chaves de `settings` ordenadas **alfabeticamente** e `elements` na ordem original → **serialização byte-idêntica** entre execuções (idempotência, §6.4).

#### 3.5.5 Os 7 arquivos a emitir

| arquivo | post | `_elementor_template_type` | papel no site novo | `elementCount` |
|---|---:|---|---|---:|
| `home-30.json` | 30 | `wp-page` | corpo da home `/` (entre header-49 e footer-48) | **63** (medido em 2026-10-19) |
| `header-49.json` | 49 | `header` | cabeçalho global | **4** (medido) |
| `footer-48.json` | 48 | `footer` | rodapé global | **19** (medido) |
| `links-843.json` | 843 | `wp-page` | página `/links/` (R9) | **9** (medido) |
| `blog-archive-516.json` | 516 | `archive` | `/blog/` | **6** (medido) |
| `post-single-525.json` | 525 | `single-post` | `/<slug>/` (post) | **16** (medido) |
| `error-404-790.json` | 790 | `error-404` | `/404` | **12** (medido) |

> **O `63`:** o briefing afirmava 108 elementos; o valor real foi **medido em 2026-10-19** (fonte: `docs/_reference/extract-report.json`) e fixado como constante do assert §6.2. **Se der ≠63, reportar o número real — não forçar.**

#### 3.5.6 Onde ficam os outros 10 templates

Os templates 759, 762, 766, 769, 772, 775, 778, 781, 784 (e o 907, descartado — R9) **já estão embutidos** dentro de `home-30.json`. **Não** se emitem arquivos separados. Isso reduz a superfície de 17 documentos para 7.

#### 3.5.7 O que se migra do Elementor (CSS e JS) — **R1: verbatim**

> **R1 — o CSS gerado É copiado verbatim.** Esta seção foi **revertida** em relação ao texto original do dba, que dizia "não copiar". A estratégia é "replay do DOM para que o CSS gerado aplique sem alteração".

**Copia-se (obrigatório):**

| Origem (no backup) | Destino no repo | Nota |
|---|---|---|
| `uploads/elementor/css/*` (**36** arquivos) | `public/wp-content/uploads/elementor/css/` | **Fonte de verdade do design.** Inclui `post-30.css`, `post-6.css`, `post-48.css`, `post-49.css`, `post-695.css`, `post-1004.css` e os `custom-*.min.css`. `post-695.css`/`post-1004.css` ficam mesmo com os popups descartados (R10) — são ~KB e mantêm o conjunto byte-idêntico. |
| `uploads/elementor/google-fonts/css/*.css` | `public/wp-content/uploads/elementor/google-fonts/css/` | `questrial.css`, `nunito.css`, `qwigley.css` |
| `uploads/elementor/google-fonts/fonts/*` | `public/wp-content/uploads/elementor/google-fonts/fonts/` | Nunito (11 woff2), Questrial (3), Qwigley (3) — **já locais** (R12) |
| `themes/kava/style.css` | `public/css/theme.css` | tipografia base (Roboto 300/14px) |
| `themes/kava/theme.css` | `public/css/theme-kava.css` | se necessário para as regras do Kava |
| bloco `<style id="kava-theme-style-inline-css">` (dynamic dos `theme_mods_kava`) | `public/css/theme-dynamic.css` | extraído do snapshot Wayback (linha 114) |
| CSS de widget do Elementor (`plugins/elementor/assets/css/widget-*.min.css`) | `public/css/widgets.css` | heading, image, divider, google_maps, nav-menu, social-icons, icon-list, blockquote, mega-menu, form (`pro-elements`) |
| `plugins/elementor/assets/lib/swiper/v8/css/swiper.min.css` | `public/css/swiper.css` | |
| `plugins/elementor/assets/lib/font-awesome/css/font-awesome.min.css` | `public/css/fontawesome.css` | **Font Awesome 4.7.0** |
| `plugins/elementor/assets/lib/animations/styles/{fadeIn,pulse,grow}.min.css` | `public/css/animations.css` | as 3 usadas |
| `plugins/ultimate-post-kit/assets/css/upk-alex-grid.css`, `upk-amox-grid.css`, `upk-post-category.css` | `public/css/upk.css` | |
| `plugins/elementskit-lite/widgets/init/assets/css/widget-styles.css` + `widget-styles-pro.css` | `public/css/elementskit.css` | |
| `plugins/header-footer-elementor/assets/css/header-footer-elementor.css` + `inc/widgets-css/frontend.css` | `public/css/hfe.css`, `public/css/hfe-widgets.css` | |
| `custom-pro-widget-nav-menu.min.css` | `public/css/custom-pro-widget-nav-menu.css` | menu principal |
| `plugins/elementor/assets/js/frontend.min.js` | `public/js/elementor-frontend.min.js` | animações de entrada |
| `plugins/elementor/assets/lib/swiper/v8/swiper-bundle.min.js` | `public/js/swiper-bundle.min.js` | slider de depoimentos |
| `uploads/2024/12/Amsterdam.ttf` | `public/fonts/Amsterdam.ttf` | **só se o extractor reportar referência** (R12) |

**Não se copia:**
- `uploads/elementor/screenshots/` — não copiar.
- `uploads/rank-math/`, `uploads/ultimate-post-kit-backups/`, `uploads/wpforms/`, `uploads/wpr-addons/` — artefatos de plugin. **Não copiar.**
- `uploads/2024/12/elementor-41-2024-12-26.json*.txt` — dump de edição. Não copiar.
- `uploads/2025/03/Logo-Xentry-Labs-*.png` — marca da agência; **não** aparece no site público. Não copiar (salvo pedido explícito do owner).
- `uploads/2025/12/Recesso-Art-*` — **DROP** (popups 695/1004 descartados, R10).

**R12 — fontes self-hosted (procedimento):**
1. Baixar o CSS do Google Fonts com User-Agent moderno (para woff2):
   - `https://fonts.googleapis.com/css?family=Roboto:300,400,500,900&display=swap`
   - `https://fonts.googleapis.com/css?family=Montserrat:700&display=swap`
2. Extrair as URLs `.woff2` (subset `latin`).
3. Baixar para `public/fonts/roboto/roboto-latin-{300,400,500,900}.woff2` e `public/fonts/montserrat/montserrat-latin-700.woff2`.
4. Reescrever `url()` para `/fonts/…` (ou `${BASE}fonts/…`).
5. Gerar `public/css/fonts.css` com todos os `@font-face` (Roboto, Montserrat, Nunito, Questrial, Qwigley, Amsterdam) com `font-display: swap`.
> Os `@font-face` de `uploads/elementor/google-fonts/css/{nunito,questrial,qwigley}.css` já existem e apontam para `../fonts/…` → reescrever para `/wp-content/uploads/elementor/google-fonts/fonts/…` e incluir. **Conferir o `font-weight` de cada face** (o Elementor gera uma face por combinação peso/estilo — 11 arquivos para Nunito).
> **shortcut** a registrar no código: o `Amsterdam.ttf` (TTF) não é convertido para woff2 por simplicidade; ~92 KB é irrelevante. Se o LCP indicar problema, converter com `fonttools`.

### 3.6 `src/data/assets-manifest.json` — o closure de assets

#### 3.6.1 Schema

```jsonc
{
  "meta": {
    "sourceRoot": "uploads",
    "publicBase": "/wp-content/uploads/",
    "totalFiles": 97,
    "totalBytes": 10149570,
    "cssFiles": 39,
    "fontFiles": 16
  },
  "assets": [
    {
      "src": "2024/12/imagem-padrao-post.jpg",
      "dest": "/wp-content/uploads/2024/12/imagem-padrao-post.jpg",
      "bytes": 284913,
      "mime": "image/jpeg",
      "width": 1200,
      "height": 800,
      "referencedBy": [
        { "file": "src/content/blog/5aspectos-cruciais-direito-de-familia.md", "kind": "frontmatter.hero" },
        { "file": "src/data/elementor/home-30.json", "kind": "element.background_image" }
      ],
      "refCount": 2
    }
  ],
  "missing": [
    { "src": "2024/12/Popup-Recesso.png", "referencedBy": ["src/data/elementor/popup-695.json"] }
  ],
  "skipped": { "thumbnails": 419, "srcsetCandidates": 0, "pluginArtifacts": 412, "unreferenced": 470 }
}
```
> `cssFiles` = **39** = **36** CSS do Elementor + **3** CSS das fontes locais. `totalFiles` = **97** · `totalBytes` = **10 149 570** (**9,69 MB**) — medido em 2026-10-19 (`docs/_reference/extract-report.json`).

> ⚠️ **`generatedAt` e afins são proibidos** — quebram a idempotência byte-a-byte (§6.4). Nada de timestamp, caminho absoluto, host ou iteração de `fs.readdir` sem `sort()`.

#### 3.6.2 Como o closure é calculado

1. Extrair todas as URLs de asset de **todo** o output (frontmatter dos 6 posts, os 7 JSONs do Elementor, os 3 `.md` de política, `site.json`, os **36** CSS do Elementor).
2. Regex: `https://galastriadvocacia\.com\.br/wp-content/uploads/(?<path>[^"'\s)]+)` e, nas referências internas do Elementor, `\/wp-content\/uploads\/(?<path>[^"'\s)]+)` (o Elementor escapa as barras como `https:\/\/...`).
3. Normalizar: remover query string e fragmento; remover o sufixo `-WxH` se o arquivo existir apenas nessa forma.
4. Manter a ordem de primeira aparição e ordenar por `src` (alfanumérico) para serialização estável.
5. Para cada `src`, copiar de `<backup>/uploads/<src>` para `<projeto>/public/wp-content/uploads/<src>`.
6. `bytes` = tamanho em disco; `width`/`height` de `_wp_attachment_metadata` quando o arquivo for um attachment registrado, senão `null`.
7. `referencedBy` = lista de `{file, kind}`; `refCount` = `referencedBy.length`.

#### 3.6.3 Regras de exclusão

**a) Thumbs `-WxH` (gerados pelo WordPress):**
- Arquivo cujo nome casa `-\d{2,4}x\d{2,4}\.(png|jpe?g|webp|gif)$` é **thumbnail** e **nunca** entra no manifest.
- Se uma URL referenciada aponta para um `-WxH` (acontece no `srcset`), reescrever para o original (`_wp_attached_file` do mesmo attachment) ou descartar junto com o atributo `srcset`.
- ⚠️ **Exceção:** `galastri-advocacia-banner-arthemis-scaled.jpg` e `Guarda-Compartilhada-scaled.jpg` **contêm** `-scaled` e **são** os originais registrados — a regex `-(\d+)x(\d+)` não casa `-scaled`. ✔
- ⚠️ `galastri-advocacia-logo-horizontal-transparente-e1734733392829.png` tem sufixo numérico do WordPress (timestamp) — **não** é thumbnail. ✔
- ⚠️ `Dra._Ana_Paula_Galastri__3_-removebg-preview-e1735422317688.png` idem. ✔
- ⚠️ `imagem-padrao-post-1000x640.jpg` **é** thumbnail; `imagem-padrao-post.jpg` é o original. ✔

**b) `srcset` / `sizes`:**
- O atributo `srcset` (e o `sizes` correspondente) é **removido inteiramente** do HTML/JSON emitido. Assert: **0 ocorrências de `srcset=`** (§6.5).
- Arquivos só referenciados por `srcset` não entram no manifest (elimina ~419 thumbnails).

**c) Artefatos de plugin:** `uploads/rank-math/**`, `uploads/ultimate-post-kit-backups/**`, `uploads/wpforms/**`, `uploads/wpr-addons/**`, `*.txt` de export do Elementor → nunca copiados.
> **R1 — `uploads/elementor/css/**` e `uploads/elementor/google-fonts/**` NÃO são mais excluídos.** São assets do site (R1 + R12).

**d) Não referenciados:** `uploads/2024/12` tem **477 arquivos**; só os referenciados são copiados. **Não** copiar diretórios inteiros.

- **Closure de assets (medido em 2026-10-19):** **97** arquivos / **10 149 570** bytes (**9,69 MB**) — `meta.totalFiles` / `meta.totalBytes`. O assert §6.5 valida a *propriedade* (todo referenciado existe, nenhum `-WxH`), e o literal medido serve de constante de regressão.

- **Originais registrados:** 58 (`_wp_attached_file`).
- **Fontes:** woff2 locais (Nunito, Questrial, Qwigley) + Roboto 300/400/500/900 e Montserrat 700 **baixados** (R12) + `Amsterdam.ttf` se referenciado (`meta.fontFiles` = **16** woff2).
- **Tamanho total estimado:** **≈8–12 MB** (banners `galastri-advocacia-banner-*.png` ~200–800 KB cada, `Fundo-LinkTree-3.png` ~1 MB, `Design-sem-nome-1.png` ~1 MB, `Amsterdam.ttf` ~250 KB, fotos da equipe ~200–600 KB cada). O `meta.totalBytes` é o número exato.
- **CSS do Elementor:** **36** arquivos, ≈0,5 MB (o `meta.cssFiles` = 39 = 36 + os 3 CSS das fontes locais).
- **Fontes:** woff2 locais (Nunito 11, Questrial 3, Qwigley 3) + Roboto 300/400/500/900 e Montserrat 700 **baixados** (R12) + `Amsterdam.ttf` se referenciado.

---

## 4. Ciclo de vida, retenção e privacidade

### 4.1 `wp_comments` (48) e `wp_commentmeta` (231) — RETENÇÃO: **não migrar**

**Decisão do owner: os comentários não vão para o site novo.** Regra operacional:

1. **Fronteira de extração:** o extractor **nunca** lê `wp_comments` nem `wp_commentmeta` para produzir output. Não há `comments` populado em nenhum `.md` (o campo existe no schema, sempre `[]`).
2. **Nada no repositório:** nenhum `.md`, `.json` ou `.ts` gerado contém `comment_author`, `comment_author_email`, `comment_author_IP`, `comment_content`, `comment_agent` ou `akismet_as_submitted`.
3. **Relatório de auditoria (não commitado):** `docs/audit/comentarios-retidos.md` registra **apenas contagens**, nunca conteúdo:
   ```
   wp_comments: 48 linhas comment_approved='1' + comment_type='pingback' → 4   (IDs 2,3,4,5)
     comment_approved='spam' + comment_type='comment' → 44  (IDs 244..287)
     comment_approved='1'  + comment_type='comment'  → 0
   wp_commentmeta: 231 linhas (100% akismet_*) — órfãs, descartadas junto
   ```
   > O briefing dizia "0 approved". Há **4 comentários aprovados** (pingbacks) que estavam **publicamente visíveis** no site antigo. A decisão de não migrar é do owner, mas o relatório precisa ser preciso.
4. **Verificação de órfãos (confirmada):**
   - `wp_commentmeta` → 231 linhas, 100% `akismet_*`, `comment_id` ∈ {2,3,4,5,244..287} → descartadas junto.
   - `wp_term_relationships` **não** tem FK para comentários (`object_id` aponta para posts). Os 132 registros têm `object_id` ∈ {9,41,48,49,53,56,58,60,67,69,73,75,79,81,100,101,102,104,109,156,183,185,272,448,516,520,525,528,542,546,559,561,576,579,583,610,695,703,714,723,733,739,752,759,762,766,769,772,775,778,781,784,790,793,795,810..816,853,907,953,955,957,992,1001,1004,1007,1009} — **nenhum é comment_id**. ✔
   - `wp_posts.comment_count` dos 6 posts é `0`.
   - `wp_rank_math_*` não referenciam comentários. Não há tabela de pingbacks/trackbacks separada.
   - **Conclusão:** descartar `wp_comments` + `wp_commentmeta` juntos não deixa órfã alguma.
5. **Dado pessoal nos comentários:** os 44 spam contêm e-mails de spammers, IPs e user-agents — **dados pessoais de terceiros** (LGPD art. 7/11). Descartar é a decisão correta. Nada disso vai para o repo.
6. **Retenção no backup:** o backup WP-Vivid original (read-only, fora do repo) permanece como fonte por **90 dias após o go-live** e depois é destruído conforme a política de retenção do cliente. Decisão do owner/cliente.

### 4.2 `wp_users` (2) e `wp_usermeta` — RETENÇÃO: **apenas o autor público**

Sobrevivem: `Ana Paula Galastri` · `ana-paula-galastri` · bio profissional (≈480 chars) — §2.5.
Não sobrevivem: tudo o resto (`user_email` dos dois, hashes de senha, chave de usermeta de sessões, capabilities, preferências, `wp_user_avatar`).
> O e-mail `<email administrativo do cliente>` (R6) **não entra** em nenhuma forma. O e-mail pessoal da autora (`<REDACTED:e-mail pessoal da autora>`) **sai**.
> **Resultado:** o site novo tem **zero** contas de usuário, **zero** hashes, **zero** tokens de sessão, **um** nome público e **uma** bio pública. O `wp_users`/`wp_usermeta` não é lido pelo extractor, exceto as **3 células** listadas acima (implementar como allow-list de 3 campos, não como "filtrar tudo").

### 4.3 `wp-config.php` e o dump `.sql` — **nunca** no repo

**Guardrails do script de extração (`scripts/extract/`):**

1. Ler o dump de um caminho **fora do repo**, por flag/ENV: `EXTRACT_SQL_PATH` (default `../galastriadvocacia.com.br_wpvivid-…/…_backup_db.sql`). O script **falha** se o caminho resolvido estiver dentro da raiz do projeto.
2. Ler `uploads/` de um caminho **fora do repo**: `EXTRACT_UPLOADS_PATH` (default `../uploads`). **Falhar** se estiver dentro do projeto.
3. **Nunca** copiar o `.sql` nem `wp-config.php` para dentro do projeto. **Nunca** ler `wp-config.php`.
4. **Guard de escrita:** o script só escreve dentro de `<projeto>/src/`, `<projeto>/public/wp-content/uploads/`, `<projeto>/public/css/`, `<projeto>/public/fonts/`, `<projeto>/public/js/`, `<projeto>/tests/fixtures/` e `<projeto>/scripts/extract/` (artefatos de relatório). Qualquer outro caminho → erro.
5. **Guard de segredo:** após gerar o output, re-scan de todos os arquivos escritos em busca de `auth_key`, `logged_in_key`, `secure_auth_key`, `nonce_key`, `AKIA[0-9A-Z]{16}`, `sk_live_`, `-----BEGIN [A-Z ]*PRIVATE KEY-----`, `ghp_`, `eyJ[A-Za-z0-9_-]{20,}\.`, `AIza[0-9A-Za-z_-]{35}`, `xox[baprs]-`, tokens do `rank_math_google_oauth_tokens` → **falha se encontrar**.
6. **Guard de PII:** re-scan do output em busca de `comment_author_email`, de qualquer e-mail de terceiro (a lista completa dos domínios de spam observados e dos e-mails de usuário está em `scripts/lib/forbidden.mjs`), de hashes de senha (bcrypt e phpass), da chave de usermeta de sessões e do e-mail administrativo do cliente (R6) → falha.
7. O dump **nunca** é commitado; `.gitignore` cobre `*.sql` como segunda barreira.

> O `.gitignore` **definitivo** (bloco completo de SEC-24, superset) está em `docs/SPEC-SECURITY.md` §2 — **use aquele**.

### 4.4 Segredos dentro de `wp_options` — **descartar todos**

| option | conteúdo | ação |
|---|---|---|
| `rank_math_google_oauth_tokens` | `access_token` + `refresh_token` do Google (OAuth do Rank Math) | **DESCARTAR** — token ativo de terceiro |
| `elementor_connect_site_key` | `<REDACTED:site_key do Elementor Connect>` (32-hex) | **DESCARTAR** |
| `elementor_safe_mode_token` | token hex de 64 chars | **DESCARTAR** |
| `nonce_key` / `auth_key` / `logged_in_key` / `secure_auth_key` | salts WP duplicados em `wp_options` | **DESCARTAR** |
| `ea11y_client_secret` | `<REDACTED:client_secret do EqualWeb>` | **DESCARTAR** |
| `wordpress_api_key` | `<REDACTED:API key do WordPress.org>` (12-hex) | **DESCARTAR** |
| `trustindex-google-review-download-token` | `<REDACTED:token de download do Trustindex>` (10-hex) | **DESCARTAR** |
| `googlesitekit_credentials` | blob base64 (GA4/Search Console/AdSense) | **DESCARTAR** |
| `googlesitekit_analytics-4_settings` | IDs de conta GA4/GTM/AdSense | **DESCARTAR** (não migrar analytics IDs) |
| `wp_mail_smtp` (`gmail.client_secret`, `gmail.refresh_token`, `gmail.access_token`, `auth_code`) | credenciais de envio como o escritório | **DESCARTAR** |
| `wpvivid_upload_setting` / `clean_task` / `wpvivid_backup_list` | `auth_id`, Drive `access_token`/`refresh_token`, caminhos absolutos do servidor | **DESCARTAR** |
| `indexnow_api_key` | 32-hex | **DESCARTAR** |
| `moderation_keys`, `disallowed_keys`, `recovery_keys` | listas de palavras | **DESCARTAR** |
| `wpvivid_saved_api_token`, `litespeed.conf.*`, `elementor_pro_*_key/secret` | (vazios neste dump) | **DESCARTAR** |

**Regra (allow-list, não deny-list):** o extractor lê `wp_options` **somente** pelas chaves listadas em §2.3. Qualquer outra option é descartada por construção — impossível vazar um segredo novo.

> **Requerimento operacional (SEC-31):** os tokens acima são **credenciais reais** de um site que ainda está no ar. **Rotacionar/revogar** antes do go-live — checklist em `docs/SPEC-SECURITY.md` §6.

**`wpr_license_key`: NÃO EXISTE** no dump. Nenhuma licença de plugin está presente.

### 4.5 Dados pessoais no formulário de contato — o site novo não tem banco

**Estado:** o formulário envia para **Formspree**, por `fetch` no cliente. O site Astro não tem banco, API, serverless function nem logs de submission. `site.json → form.endpoint` é a única integração.

1. **O repo nunca recebe dados de visitante.** O payload vai do browser direto para o Formspree. O Astro não vê, não loga e não persiste o corpo do formulário.
2. **O que fica no repo:** apenas a *definição* do formulário (nomes de campo, labels, placeholders, mensagens) — **não** valores.
3. **Log de erro:** se o `fetch` falhar, logar **apenas** `{ status, endpoint }` — nunca o corpo, o nome ou o e-mail. Usar `console.warn('formspree-error', res.status)`.
4. **Provedor (Formspree):** o contrato precisa declarar (a) que o dado é **dado pessoal** do titular, (b) **prazo de retenção** (30 dias no plano gratuito) e (c) **subprocessors**. Isso está no contrato do Formspree, não no repo — mas **deve** constar na Política de Privacidade do site.
5. **Consentimento:** checkbox explícito (`form.privacyConsent`) com link para `/politica-de-privacidade/`. O WP antigo **não** tinha consentimento no formulário — é uma **melhora** a preservar. Base legal: art. 7º, V (execução de contrato / procedimentos preliminares) e consentimento para comunicações.
6. **O que a Política de Privacidade do site novo PRECISA declarar** (além do texto de 20/12/2024): controlador + e-mail de contato · categorias de dados (nome, e-mail, telefone/WhatsApp, mensagem) · finalidade (responder a consulta e agendar reunião) · base legal (art. 7º, V) · **operador** (Formspree) e **transferência internacional** (art. 33) · **prazo de retenção** (owner define) · **direitos do titular** (acesso, correção, portabilidade, informação, oposição, anonimização/bloqueio/eliminação, revogação) com canal e prazo (15 dias, art. 19 §3º) · cookies/analytics (GTM `GTM-KDNG3QWB`, AdSense `ca-pub-5989678973778468` → Consent Mode obrigatório) · encarregado (DPO).
7. **Ausência de hash Gravatar** em comentários: não aplicável. O formulário **não** envia hash de avatar.
8. **Cookies próprios:** apenas o cookie de registro do consentimento (first-party). Nada de cookies de terceiros por padrão.
9. **Minimização (R5):** exatamente **4 campos**. Não adicionar CPF, RG, número de processo, data de nascimento, estado civil, valor da causa, dados de saúde nem upload de documento. A mensagem é livre → por isso o aviso "não envie dados sensíveis".

### 4.6 `custom_css` (post 136) e `theme_mods_kava` — configuração, não conteúdo

**Post 136 (`post_type='custom_css'`, `post_name='kava'`)** — conteúdo verificado:

```css
/* Remover margens */
body:not(.page-template-fullwidth-content) .site-content { margin-top: 0; margin-bottom: 0; }
/* Subir o botão do formulário */
p.form-submit { padding-bottom: 50px; }
/* Desativa a hifenização */
.site { hyphens: none; }
/* Estilos gerais para os cards */
.elementor-icon-box-icon, .elementor-icon-box-title { display: flex; justify-content: center; align-items: center; text-align: center; white-space: nowrap; }
/* Ajustes específicos para dispositivos */
@media (min-width: 769px) { … } @media (max-width: 768px) { … } @media (min-width: 769px) and (max-width: 1024px) { … }
/* Ajuste para todas as seções com âncoras */
#sobre, #areasdeatuacao, #contato { scroll-margin-top: 100px; }
#servicos, #quemsou { scroll-margin-top: 110px; }
```

**Destino no projeto Astro — migrar o *efeito*, não o *seletor*:**
- `body:not(.page-template-fullwidth-content) .site-content { margin: 0 }` → **descartar** (não há `.site-content`; o reset já zera).
- `p.form-submit { padding-bottom: 50px }` → reformular para a classe do novo form.
- `.site { hyphens: none }` → `body { hyphens: none }`.
- `.elementor-icon-box-icon, .elementor-icon-box-title { … }` → **manter o seletor** (é o mesmo do Elementor, ver `docs/SPEC-UI.md` §3.4 B1) e corrigir apenas o `white-space` no breakpoint quebrado.
- Os 3 `@media` de ajuste de `font-size` do icon-box → **descartar** (o `post-30.css` vence em especificidade; ver SPEC-UI §3.4 B2).
- ⭐ **`scroll-margin-top` é o mais importante → PRESERVAR**: `#sobre, #areasdeatuacao, #contato { scroll-margin-top: 100px }` e `#servicos, #quemsou { scroll-margin-top: 110px }`. É isso que faz as âncoras do menu não ficarem sob o header fixo. `home` não tem `scroll-margin` no WP.

**`theme_mods_kava` (159 chaves):** vive em `site.json → theme` apenas o que o kit não define (§3.4.4). As chaves de layout do Kava (`container_type=fullwidth`, `sidebar_width=1/3`, `blog_layout_type=grid`, `blog_style=v6`, `page_preloader=1` → **descartado, R11**, `totop_*`, `header/footer_social_links=1`) são decisões de layout traduzidas para o CSS do projeto. `nav_menu_locations => {main: 3}` → `site.json.nav` + o `settings.menu = 'menu-principal'` do widget nav-menu.

### 4.7 Onde fica cada coisa

| Tipo | Onde no projeto Astro | Fonte |
|---|---|---|
| Conteúdo editorial (blog) | `src/content/blog/*.md` (6) | `wp_posts` + `wp_postmeta` |
| Conteúdo editorial (prosa) | `src/pages/politica-*.md` (3) | `wp_posts` (R8) |
| Configuração de layout | `src/data/site.json → theme`, `public/css/tokens.css` | `theme_mods_kava` (parcial) + kit + `custom_css` |
| Paleta / tipografia | `src/data/site.json → theme.colors` / `theme.fonts` | kit Elementor (post 6 `_elementor_page_settings`) (R7) |
| Navegação | `src/data/site.json → nav` | `wp_postmeta._menu_item_*` (810–816) |
| Taxonomias | `src/data/site.json → categories` / `tags` | `wp_terms` + `wp_term_taxonomy` + `wp_term_relationships` |
| SEO | `src/data/site.json → seo` | `rank_math_title`/`description` (só post 30) + authoring (R20) |
| Configuração do form | `src/data/site.json → form` | widget `form` do post 30 (a conferir) + `email_to` |
| Template Elementor | `src/data/elementor/*.json` (7) | `wp_postmeta._elementor_data` |
| Assets | `public/wp-content/uploads/**` + `src/data/assets-manifest.json` | `uploads/**` (closure) |
| CSS do Elementor | `public/wp-content/uploads/elementor/css/*` + `public/css/*` | `uploads/elementor/css/*` + plugins (R1) |
| Fontes | `public/fonts/**` + `public/wp-content/uploads/elementor/google-fonts/**` | backup + download do Google Fonts (R12) |
| Redirects | `src/data/redirects.json` | derivado (URL antiga → URL nova) |
| Fixtures de paridade | `tests/fixtures/elementor-cache-{30,48,49}.html` | `_elementor_element_cache` (R2) |
| Auditoria (contagens) | `docs/audit/` — **não commitado** | contagens do dump |
| Dump, backup, credenciais | **fora do repo** | — |

---

## 5. Pipeline de extração

### 5.1 Decisão: script one-off versionado, em Node ESM, **sem dependências externas**

| Alternativa | Veredito |
|---|---|
| Copiar/colar manual do HTML do Elementor | ❌ 78 KB de JSON por template, **63** elementos, ids que viram classes CSS. Erro humano = site visualmente quebrado. |
| `wp-cli` + MySQL local | ❌ Exige MySQL + PHP + wp-cli; o dump já é parseável linha a linha. Ganho zero. |
| Importar o `.sql` num Postgres/SQLite e consultar | ❌ Overkill; 41 tabelas, 5.112 rows de postmeta das quais **578** são revisões. |
| Usar o `_elementor_element_cache` como HTML final | ❌ Tem placeholders não resolvidos e TTL; é **contrato/oráculo**, não saída. |
| **Script one-off versionado (Node)** | ✅ **Escolhido** |

**Módulos:**

| Módulo | Entrada | Saída | Detalhe |
|---|---|---|---|
| `lib/sql.mjs` | `.sql` | iterator de linhas | Streaming (`readline` sobre `createReadStream`, `utf8`). Casa `INSERT INTO \`wp_x\` VALUES (…);` por linha. Só extrai a lista de valores e faz `JSON.parse` após desescapar (`\'`→`'`, `\\`→`\`, `\"`→`"`, `\n`→LF, `\r`→CR, `\t`→TAB, `\0`→NUL, `\Z`→0x1A). ⚠️ `post_content` traz `\n` real dentro do literal — o unescape precisa tratar `\n` e `\\` **nessa ordem**, senão o HTML sai corrompido. |
| `lib/wordpress.mjs` | linhas | `{posts, postmeta, terms, term_taxonomy, term_relationships, options, comments, users}` | Ignora `post_type='revision'` e `post_status='auto-draft'`. `wp_users` **excluído do output** (só 3 campos públicos, §4.2). |
| `lib/elementor.mjs` | `_elementor_data` | árvore normalizada | `JSON.parse` → array de elementos. Normaliza cada nó: `{id, elType, widgetType?, settings, elements[], isInner}`. Extrai `settings._element_id` → `cssId`. **Preserva a ordem original** dos elementos. |
| `lib/elementor-cache.mjs` | `_elementor_element_cache` | fixtures | Extrai `value.content` dos posts 30/48/49 → `tests/fixtures/elementor-cache-{30,48,49}.html`; decodifica os placeholders `data="<base64>"` → `settings` JSON (R2). |
| `lib/gutenberg.mjs` | `post_content` | Markdown/HTML | Remove `<!-- wp:* -->` e o JSON de atributos; preserva o HTML interno. Caso especial: post 723 (`<p><!-- /wp:paragraph --><!-- wp:paragraph --></p>`) → §3.3 item 2. |
| `lib/urls.mjs` | qualquer string | string reescrita | Regras nesta ordem: (1) `…/wp-content/uploads/` → `${BASE}wp-content/uploads/`; (2) `…/wp-content/plugins/` → `${BASE}wp-content/plugins/`; (3) `…/` → `${BASE}` (exceto canonical/og:url); (4) `//fonts.googleapis.com/…` e `//fonts.gstatic.com/…` → removidos (self-hosted, R12); (5) `srcset="…"` → removido (§3.6.3 b). |
| `lib/assets.mjs` | HTML final + JSON | `assets-manifest.json` | Varre `src`, `srcset`, `href`, `url(...)` em CSS e coleta o **closure** de arquivos de `uploads/` referenciados. Inclui os **36** CSS do Elementor e as fontes (R1, R12). |
| `lib/fonts.mjs` | — | `public/fonts/**` + `public/css/fonts.css` | Baixa Roboto 300/400/500/900 e Montserrat 700 (latin, woff2) do Google Fonts com UA moderno, reescreve `url()` para `/fonts/…`, gera `@font-face` com `font-display: swap` (R12). |

**Comandos:**

```
node scripts/extract/extract.mjs \
  --sql "<LOCAL>/<dump>.sql" \
  --uploads "<BACKUP>\uploads" \
  --out .
```

`npm run extract` → extrai. `npm run extract:check` → re-executa num diretório temporário e compara **hashes** com o output commitado (idempotência, §6.4).
> `npm run extract` **não** roda no CI (o `.sql` não está no repo) — a saída extraída é versionada.

**Saídas do script:**

| Arquivo | Conteúdo |
|---|---|
| `src/data/elementor/home-30.json` | `_elementor_data` normalizado do post 30 |
| `src/data/elementor/header-49.json` | idem, post 49 |
| `src/data/elementor/footer-48.json` | idem, post 48 |
| `src/data/elementor/links-843.json` | idem, post 843 |
| `src/data/elementor/blog-archive-516.json` | idem, post 516 |
| `src/data/elementor/post-single-525.json` | idem, post 525 |
| `src/data/elementor/error-404-790.json` | idem, post 790 |
| `src/pages/politica-*.md` (3) | frontmatter + corpo das políticas (R8) |
| `src/content/blog/*.md` (6) | frontmatter + corpo dos posts |
| `src/data/site.json` | `nav` (7), `categories` (3), `tags` (57), `options` (allow-list), `seo` (perUrl — R20), `form` (4 campos — R5), `theme`, `routes` |
| `src/data/redirects.json` | derivado (R4) |
| `src/data/assets-manifest.json` | assets + CSS + fontes (R1, R12) |
| `tests/fixtures/elementor-cache-{30,48,49}.html` | HTML renderizado do Elementor (R2) |

### 5.2 Extração de campos do formulário (crítico)

O script localiza, na árvore do post 30, o widget com `widgetType === 'form'` (id `3273196`) e emite `site.json → form` com os **4 campos** (§3.4.5), o `email_to` (`contato@galastriadvocacia.com.br`), `success_message`, `error_message`, `submit_label`, `field_placeholder` e as cores.

> ⚠️ Os `name` do Elementor (`name`, `email`, `field_d252ca6`, `message`) **não** são usados diretamente (o Formspree usa nomes livres) → mapeados para nomes semânticos (`nome`, `email`, `telefone`, `mensagem`).
> ⚠️ **O dev deve validar contra o `_elementor_data` atual** e reportar qualquer divergência. O extractor emite `extract-report.json → formFields` com os campos reais do widget.

---

## 6. Suíte de validação da extração (§4.1–§4.7 como asserts)

Implementar como **asserts dentro do script** (`scripts/extract/`), falhando com exit code ≠ 0.

```jsonc
// package.json
{
  "scripts": {
    "extract": "node scripts/extract/index.mjs",
    "extract:check": "node scripts/extract/check.mjs"
  }
}
```

### 6.1 Contagens de linhas (assert `COUNT`)

```
wp_posts            === 766
wp_postmeta         === 5112
wp_options          === 741
wp_terms            === 84
wp_term_taxonomy    === 84
wp_term_relationships=== 132
wp_comments         === 48
wp_commentmeta      === 231
wp_users            === 2
wp_postmeta com meta_key='_elementor_data' === 605
   ... das quais em posts publicados (post_type != 'revision') === 27
   ... das quais em revisions === 578
wp_postmeta com meta_key='_elementor_element_cache' === 5    (posts 30, 48, 49, 695, 1004)   [R2]
wp_postmeta com meta_key='_elementor_conditions'   === 116                                     [R3]
wp_posts com post_type='elementor_library' === 20
wp_posts com post_type='attachment'        === 58
wp_posts com post_type='nav_menu_item'     === 7
wp_posts com post_status='auto-draft'      === 1
wp_posts com post_status='revision'        === 662   <-- CONFIRMADO
```

> O `662` foi **confirmado** na 1ª execução (fonte: `docs/_reference/extract-report.json`).

**Sub-asserts de conteúdo:**

```
posts publicados do tipo 'post'          === 6   e IDs == {272,610,714,723,733,739}
posts publicados do tipo 'page' migrados  === 6   e IDs == {3,30,83,85,464,843}
categorias em uso === 3   e term_taxonomy_ids == {19,36,67}
tags em uso                              === 57
relações tag→post nos 6 posts            === 60
rels de categoria→post nos 6 posts       === 6   (1 por post)
arquivos em src/content/blog/            === 6
arquivos de política em src/pages/       === 3
entradas em site.json.nav                === 7   e menu_order == [1,2,3,4,5,6,7]
entradas em site.json.categories         === 3
entradas em site.json.tags               === 57
entradas em site.json.seo.perUrl         === 16  (1 home + 1 blog + 6 posts + 3 categorias + 3 políticas + 1 links + 1 404)
entradas em redirects.json                === 1   (R4: {"/home/": "/"})
site.json.form.fields                    === 4   (R5: nome, email, telefone, mensagem)
site.json.form.emailTo                   === "contato@galastriadvocacia.com.br"   (R6)
site.json.site.email                     === "contato@galastriadvocacia.com.br"   (R6)
site.json.theme.preloader                === false   (R11)
site.json.routes.blogPost                === "/<slug>/"   (R4)
site.json.routes.blogTag                 === null      (R4)
```

### 6.2 Elementor (assert)

```
elementCount(source post 30)  === elementCount(emitted home-30.json)
  -> esperado **63** (medido em 2026-10-19; se !=63, reportar)
ids dos elementos: o conjunto de `id` do JSON emitido === o conjunto de `id` do JSON de origem
   (comparação por conjunto, deep, recursiva — inclui containers e widgets)
cssIds de home-30.json ⊇ {home, sobre, areasdeatuacao, servicos, quemsou, contato}
cssIds únicos por documento (nenhuma colisão de âncora)
7 arquivos emitidos: home-30, header-49, footer-48, links-843, blog-archive-516,
                     post-single-525, error-404-790
nenhum widgetType desconhecido nos 7 documentos (ou lista reportada em extract-report.json
                     e aceita pelo time)
todo settings.__globals__ resolvido (0 chaves __globals__ residuais)
todo settings.__dynamic__ resolvido (0 chaves __dynamic__ residuais)
0 ocorrências de "_element_id" no settings emitido (foi promovido a cssId)
```

### 6.3 Gutenberg (assert)

```
9 itens baseados em blocos processados (6 posts + 3 políticas)
0 ocorrências de "<!-- wp:" em TODO o output (md, json, ts)
0 ocorrências de "--> <!--" (fechamento/abertura de bloco adjacente sem HTML)
0 ocorrências de "<p></p>" ou "<p> </p>" (parágrafo vazio gerado pela normalização)
post 723: "<p><!-- /wp:paragraph --><!-- wp:paragraph --></p>" não existe no output
           e o número de <p> no corpo == número de parágrafos do original
0 ocorrências de 'class="wp-block-' no output
0 ocorrências de 'style="' inline vindo do WP (exceto os permitidos explicitamente)
HTML balanceado: contagem de tags <p>/<h1..6>/<ul>/<li> abre == fecha em cada arquivo
```

### 6.4 Idempotência (assert)

```
rodar o extractor 2x em diretórios distintos
=> os conjuntos de arquivos são idênticos (mesmos nomes, mesma árvore)
=> SHA-256 de cada arquivo é idêntico entre as 2 execuções
=> nenhum arquivo contém timestamp, caminho absoluto, host ou random
   (grep por /\d{4}-\d{2}-\d{2}T\d{2}:/ e por 'C:\\' e por 'galastriadvocacia.com.br/wp-content' residual)
```

### 6.5 Reescrita de URL e assets (assert)

```
0 ocorrências de "galastriadvocacia.com.br/wp-content" em TODO o output
0 ocorrências de "srcset=" em TODO o output
0 ocorrências de "sizes=" como atributo de img
0 ocorrências de "http://" (tudo https ou caminho relativo)
todo hero dos 6 posts aponta para /wp-content/uploads/<arquivo existente>
todo "/wp-content/uploads/<path>" referenciado existe em public/wp-content/uploads/<path>
manifest: todo asset com src existe em <backup>/uploads/<src>
manifest: 0 entradas cujo src casa -\d{2,4}x\d{2,4}\.(png|jpe?g|webp|gif)$
manifest: totalBytes == soma dos bytes dos arquivos copiados
public/wp-content/uploads/ contém EXATAMENTE os arquivos do manifest (0 extras, 0 faltantes)
public/wp-content/uploads/elementor/css/ contém os **36** arquivos do CSS do Elementor   [R1]
public/wp-content/uploads/elementor/google-fonts/ contém as 17 faces locais            [R12]
public/fonts/ contém roboto-{300,400,500,900} e montserrat-700 (woff2)                 [R12]
public/css/fonts.css declara @font-face com font-display: swap para cada face
0 ocorrências de "fonts.googleapis.com" ou "fonts.gstatic.com" em TODO o output
Amsterdam.ttf presente em public/fonts/ SOMENTE SE o extract-report indicar referência [R12]
```

### 6.6 Segredos e PII (assert)

```
0 ocorrências de: auth_key|logged_in_key|secure_auth_key|nonce_key
0 ocorrências de: AKIA[0-9A-Z]{16}|sk_live_|ghp_|xox[baprs]-|AIza[0-9A-Za-z_-]{35}
0 ocorrências de: -----BEGIN [A-Z ]*PRIVATE KEY-----
0 ocorrências de hash de senha (bcrypt e phpass) e da chave de usermeta de sessões (padrões completos em `scripts/lib/forbidden.mjs`)
0 occurrences de: comment_author|comment_content|akismet_
0 ocorrências de e-mail de spam (lista dos domínios de provedor gratuitado observados no dump — em `scripts/lib/forbidden.mjs`)
0 ocorrências dos IPs de pingback/spammer (lista em `scripts/lib/forbidden.mjs`)
0 ocorrências de e-mail de usuário WP (ambos)
0 ocorrências do e-mail administrativo do cliente (R6 — em NENHUM arquivo do output)
0 ocorrências de e-mail de terceiro (Site Kit / Elementor Connect / wp-mail-smtp)
```

### 6.7 Coerência semântica (assert)

```
para cada post: site.json.seo.perUrl["/<slug>/"].title === frontmatter.seoTitle
para cada post: site.json.seo.perUrl["/<slug>/"].description === frontmatter.seoDescription
para cada post: frontmatter.heroAlt === _wp_attachment_image_alt do hero (ou === title se ausente)
para cada post: frontmatter.category ∈ site.json.categories[].slug
para cada post: todo frontmatter.tags[] ∈ site.json.tags[].slug
para cada post: frontmatter.focusKeyword === rank_math_focus_keyword (verbatim)
para cada post: frontmatter.readingTime === ceil(palavras/200) recomputado do corpo emitido
para cada política: site.json.seo.perUrl["/<slug>/"] existe
para cada nav item: href ∈ {"/", "/blog/", "/#sobre", "/#areasdeatuacao", "/#servicos", "/#quemsou", "/#contato"}
todo cssId âncora de home-30.json tem um alvo correspondente no DOM renderizado
todo redirect de redirects.json tem destino que é uma rota existente
todo perUrl com "status": "draft" está marcado como pendente de aprovação   (R20)
```

---

## 7. Questões abertas de dados

| # | Questão | Default recomendado | Impacto se errar |
|---|---|---|---|
| **Q1** | A página `/links/` (post 843, `post_type='page'`) vai existir? | **SIM — publicar `/links/`** (R9). Já é conteúdo público, tem assets próprios (`Fundo-LinkTree-3.png`, `Design-sem-nome-1.png`) e é referenciada no Elementor. O post **907 é descartado** (R9). | Se for descartada: `links-843.json` e 2 assets (~2 MB) saem do escopo; 1 redirect `/links/ → /` é necessário. |
| **Q2** | Os campos do formulário são mesmo 4? | **4 campos: nome, email, telefone, mensagem** (R5, do widget `3273196` + Wayback). O extractor emite `extract-report.json → formFields` com os campos reais; **o dev alinha o `site.json` a ele antes de escrever o componente** e reporta divergência. Não inventar campos. | Formulário com campos diferentes do site atual → perda de leads. |
| **Q3** | `site.name` e `focusKeyword` por página? | `site.name` = "Galastri Advocacia" (limpo) e o texto completo em `site.legalName`. `site.description` = "Soluções Jurídicas Personalizadas" (espaço colapsado). `focusKeyword` das 3 políticas e das páginas de índice: **autorar** (não há dado de origem). | Nome/descrição errados em `<title>` e OG tags de todas as páginas → SEO ruim. |
| **Q4** | LGPD: a Política de Privacidade (post 3, de 20/12/2024) não conhece o Formspree, o prazo de retenção nem o canal do encarregado. | (a) O owner **redefine o prazo de retenção** das mensagens (recomendação: 6 meses após o último contato, ou até a prescrição do processo); (b) o owner atualiza o texto da política **antes do go-live** (texto pronto em `docs/SPEC-SECURITY.md` §5). O texto é conteúdo, mas **bloqueia o go-live**. | Publicar política desatualizada = infração (art. 6/9 da LGPD). Alta prioridade. |
| **Q5** | `Amsterdam.ttf` e as 2 logos `Logo-Xentry-Labs-*.png`? | A fonte: **migrar só se o extractor reportar referência** (R12). As logos da agência: **não copiar** (não aparecem no site público). | 250 KB+ de lixo no repo, ou uma fonte faltando na página. |
| **Q6** | `_elementor_conditions` (116 linhas, R3) e `_elementor_element_cache` (5 linhas, R2) | **Não migrar** como configuração (rotas são fixas; o cache é TTL). **Usar** como fixtures de paridade (R2). O `extract-report.json` registra a contagem para auditoria. | Nada (são fontes de verdade/verificação, não saída). |

---

## 8. Resumo de uma página

> O inventário completo de arquivos (com contagem esperada) está em `docs/PLAN.md` §2 (layout do repositório alvo) e as **contagens que precisam bater** estão em §6.1–§6.7 desta spec.

**Contagens que precisam bater após a extração:**

```
FONTE (dump)                        ALVO (projeto)
  wp_posts            766              src/content/blog/*.md        6
  wp_postmeta         5112             src/pages/politica-*.md      3
  wp_options           741             src/data/elementor/*.json    7
  wp_terms              84             site.json.nav                7
  wp_term_taxonomy      84             site.json.categories         3
  wp_term_relationships 132            site.json.tags              57
  wp_comments           48             site.json.seo.perUrl         16
  wp_commentmeta       231             redirects.json                1
  wp_users               2             site.json.form.fields         4
  _elementor_data      605             assets-manifest.json      97 arquivos / 10 149 570 B
     27 publicados + 578 revisões       home-30.json.elementCount   63
  _elementor_element_cache 5 [R2]     home-30.json.cssIds          6
  _elementor_conditions   116 [R3]    tests/fixtures/               3
  elementor_library     20
  attachment            58
  nav_menu_item          7
  auto-draft             1
  revision             662 (confirmado)

NUNCA NO REPO
  wp-config.php, *.sql, wp_users, wp_usermeta, wp_comments, wp_commentmeta,
  wp_options (exceto as 21 allow-listed), uploads não referenciados,
  <email administrativo do cliente> (R6),
  qualquer segredo (14 chaves/tokens identificados), qualquer PII de comentário
```
