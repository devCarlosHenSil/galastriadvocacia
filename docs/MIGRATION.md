# MIGRATION — o registo histórico da migração (WordPress → Astro)

> **O que este ficheiro é:** o registo do que **veio** do WordPress, do que
> **foi** e do que **não foi** — e porquê. É a memória da migração: lê-se
> quando alguém pergunta "porque é que isto não está no site?".
>
> **Nota de 2026-10-20 (D86):** o **alvo da publicação** passou do GitHub Pages para a
> **Cloudflare Pages** e o **fornecedor do formulário** passou de um serviço de
> formulários de terceiros (o Formspree) para uma **Pages Function do próprio
> site** que envia o e-mail com o **Resend**. No mesmo dia o endpoint passou a
> ser **relativo** (`/api/contact`) — para que o formulário funcione em
> qualquer host (domínio canónico, pré-visualização `*.pages.dev` ou
> `localhost`).
>
> **Actualização de 2026-10-20 (tarde):** o site está **no ar** em
> `https://www.galastriadvocacia.com.br` ✗ (o endereço canónico passou a ser
> o `www` ✗ — D91 ✗; o apex devolve 301 para ele ✗) e o formulário é
> servido pela **Pages Function** do próprio site ✗. O registo histórico abaixo
> descreve a migração como ela foi feita — os textos que mencionam o Formspree
> são o **registo do que foi**, não o estado atual (ver
> [`PROJECT-STATE.md`](PROJECT-STATE.md) §19).
>
> **Não é** um guia de edição (é o [`CONTENT-EDITING.md`](CONTENT-EDITING.md)) nem
> um runbook (é o [`DEPLOY.md`](DEPLOY.md)). Para o estado atual, ver o
> [`PROJECT-STATE.md`](PROJECT-STATE.md); para as divergências visuais aceitas,
> o [`PARITY.md`](PARITY.md).

---

## 1. A origem

| Item | Valor |
|---|---|
| **A fonte** | o backup **WP-Vivid** de `galastriadvocacia.com.br` |
| **A data do snapshot** | **2026-03-22** |
| **O WordPress** | **6.9.4** |
| **O Elementor** | **3.35.7** (com Elementor Pro) |
| **O tema** | **`kava`** (Header Footer Elementor, Ultimate Post Kit, ElementsKit Lite) |
| **Os plugins notáveis** | Rank Math, Google Site Kit, WP Mail SMTP, WP-Vivid, Trustindex (WP Reviews for Google), WPR Addons, Royal Elementor Addons, Sticky Header Effects, LiteSpeed Cache |
| **O dump** | **34,7 MB**, **41 tabelas**, prefixo `wp_` |
| **Onde vive** | `<BACKUP>` — **read-only**, **fora** do repositório, **nunca versionado** |
| **O site antigo** | está **offline** (HTTP **522**) |

> ⚠️ O backup **contém credenciais vivas** (a senha da base de dados, os 8
> salts, tokens OAuth, chaves de API). É a razão de existir o gate de rotação
> (`docs/rotation-gate.md`) e de a guarda de segredos (`npm run guard`).

### A estratégia: *replay do DOM*

O CSS gerado pelo Elementor é **copiado verbatim** e o DOM é **reproduzido**
para que o CSS original aplique sem alteração. O design **é** esse CSS — não
foi re-autorado.

O **oráculo da paridade** é o `_elementor_element_cache` do dump — o HTML que o
Elementor efetivamente renderizou, guardado na base de dados:

```
tests/fixtures/elementor-cache-30.html   (a home)
tests/fixtures/elementor-cache-48.html   (o rodapé)
tests/fixtures/elementor-cache-49.html   (o header)
```

`npm run check-parity` compara a página gerada com estes ficheiros: o
conjunto **e a ordem** dos ids de elemento, a **lista de classes** de cada
elemento, as âncoras e o texto visível.

---

## 2. O mapa de URLs (antigo → novo)

| URL antigo | URL novo | Nota |
|---|---|---|
| `/` (post 30) | `/` | igual |
| `/home/` (o `post_name` do post 30) | `/` | o WordPress servia `/`; `/home/` era só o `post_name` do **mesmo** post. O novo site **não constrói** o alias: o pedido érespondido com um **301** para `/` (a regra do ficheiro `public/_redirects` ✗ — só dispara porque não há activo estático em `/home/` ✗). `src/data/redirects.json` tem esta **1** entrada (o **registo** ✗). |
| `/blog/` (post 464) | `/blog/` | igual |
| `/<slug>/` (os 6 posts) | `/<slug>/` **na raiz** | o `permalink_structure` era `/%postname%/`; passar a `/blog/<slug>/` quebraria **todos** os backlinks |
| `/category/<slug>/` | `/category/<slug>/` | igual (`category_base` por omissão) |
| `/tag/<slug>/` (57 tags) | **404** | sem páginas de tag (*thin content*) — a tag é só um rótulo no post |
| `/politica-de-privacidade/` | `/politica-de-privacidade/` | igual |
| `/politica-de-cookies-galastri-advocacia/` | `/politica-de-cookies-galastri-advocacia/` | igual |
| `/politica-de-uso-de-inteligencia-artificial-galastri-advocacia/` | idem | igual |
| `/links/` (post 843) | `/links/` | o post 907 foi descartado por duplicado |
| `/wp-admin/`, `/wp-login.php`, `/xmlrpc.php` | **404** | não há painel nem API XML-RPC |
| `/feed/`, `/author/ana-paula/` | **404** | sem RSS, sem páginas de autor |

**16 rotas** no total; o `sitemap-index.xml` tem **15 URLs** (o `/home/` deixou de ser uma rota ✗ — é um 301 ✗ — e o
`/404` ficam de fora, por decisão).

---

## 3. O que foi migrado

| # | O quê | O detalhe |
|---|---|---|
| 1 | **6 posts** do blog | o corpo, o frontmatter e as imagens |
| 2 | **3 políticas** | privacidade, cookies e IA — o texto original **mais** o *overlay* da LGPD (SPEC-SECURITY §5.2–§5.4), marcado como pendente de aprovação jurídica |
| 3 | **A home** | 63 elementos do Elementor, 10 secções, 6 âncoras |
| 4 | **O header** e **o rodapé** | 4 e 19 elementos (os templates 49 e 48) |
| 5 | **O arquivo do blog** | 6 elementos + a grelha `upk-amox-grid` |
| 6 | **O template de post** | 16 elementos + os 3 posts relacionados |
| 7 | **`/links/`** | 9 elementos, **sem** header nem rodapé (a página de links do WhatsApp) |
| 8 | **O 404** | 12 elementos, com o `noindex, follow` e **sem** canonical |
| 9 | **As 3 categorias** | 2 posts cada |
| 10 | **O menu** | 7 itens, na ordem do `menu_order` do WordPress |
| 11 | **O formulário** | 4 campos, a *honeypot* `_gotcha`, o consentimento da LGPD, o CTA do WhatsApp, a máscara de telefone e as mensagens por campo |
| 12 | **Os assets** | **97 ficheiros / 10 149 570 B** — o fecho de `uploads/`, sem miniaturas `-WxH` e sem `srcset` |
| 13 | **O CSS** | 36 ficheiros do Elementor **verbatim** + 17 folhas em `public/css/` (o `tokens.css` e o `a11y.css` por último) |
| 14 | **As fontes** | **100% self-hosted**: Roboto 300/400/500/900, Montserrat 700, Nunito, Questrial, Qwigley, Amsterdam — com `font-display: swap` |
| 15 | **O banner de cookies** | 3 categorias reais, Consent Mode com `denied`, o registo em `localStorage` e **nova pergunta** quando a versão da Política muda |
| 16 | **O mapa** | *click-to-load*, atrás do consentimento |
| 17 | **O SEO** | `sitemap-index.xml` (15 URLs), `robots.txt`, OG/Twitter, JSON-LD (`Organization`, `LegalService`, `WebSite`, `BlogPosting`, `WebPage`) |
| 18 | **O `CNAME`** | dentro do artefacto do Pages (R18) — **retirado em 2026-10-20** (D86): na Cloudflare Pages o domínio é uma definição do projecto, não um ficheiro |

---

## 4. O que foi descartado — e porquê

| # | O quê | Porquê |
|---|---|---|
| 1 | **Os 48 comentários** (4 pingbacks + 44 spam + **0** humanos) | decisão do dono: publicar spam de casino/apostas num site de advocacia é dano reputacional, um sinal de spam e PII de terceiros. O campo `comments[]` fica no schema, **sempre `[]`** |
| 2 | **As 231 linhas de `wp_commentmeta`** | 100% `akismet_*`, órfãs |
| 3 | **Os popups "Recesso"** (695 e 1004) | renderizam **vazios** no cache do Elementor; o `post-695.css` e o `post-1004.css` ficam, para o conjunto de ficheiros continuar byte-idêntico |
| 4 | **O post 907** | duplicado do 843 |
| 5 | **Os 9 templates de secção** (759…784) | já estavam **inline** na árvore do post 30 |
| 6 | **As 57 páginas de tag** | *thin content*: a tag é só um rótulo |
| 7 | **A newsletter** | não havia inscrição a funcionar; a finalidade foi declarada "não aplicável" na Política de Privacidade |
| 8 | **O painel do WordPress** | não há CMS: editar é mexer num ficheiro do repositório (ver [`CONTENT-EDITING.md`](CONTENT-EDITING.md)) |
| 9 | **As miniaturas `-WxH`** | o `uploads/` é a **fonte**; as miniaturas seriam duplicatas |
| 10 | **As caches dos plugins** (`uploads/rank-math/`, `ultimate-post-kit-backups/`, `wpforms/`, `wpr-addons/`) | artefactos de cache, não conteúdo |
| 11 | **`wp_users` e `wp_usermeta`** | só migram o nome público e a bio (R6) |
| 12 | **As 662 revisões** e o *auto-draft* | histórico de edição, não conteúdo |
| 13 | **O preloader** | `page_preloader=1` era o preloader **de imagem** do Kava, não um *spinner* |
| 14 | **A optimização de imagens** (WebP/AVIF) | fora de escopo: as mídias são verbatim e a paridade é o requisito |
| 15 | **A pesquisa, o RSS, o login, o i18n e o PWA** | deliberadamente fora de escopo |

---

## 5. As divergências conhecidas face ao original

| # | Divergência | Porquê |
|---|---|---|
| 1 | As **4 etiquetas** do formulário são visíveis | o *placeholder* desaparece quando se escreve: a etiqueta é a forma acessível. O formulário fica ~1 linha mais alto por campo |
| 2 | Os **ícones sociais** têm um alvo de toque de **44×44 px** (o original tinha ~40×40) | WCAG 2.5.5; o **círculo** mantém o tamanho visual (`--icon-padding: .6em`) |
| 3 | O **mapa** é *click-to-load* e está atrás do consentimento | o original carregava o iframe do Google à partida |
| 4 | O **CTA do WhatsApp** é permanente, ao lado do formulário | o plano gratuito do Formspree acaba ao fim de 50 submissões/mês e **falha em silêncio** — um lead perdido é o ativo mais caro do site |
| 5 | A paginação do carrossel usa `role="group"` (e não `tablist`) | `tablist` sem `role="tab"` nos botões é ARIA inválido |
| 6 | As **3 categorias** de cookies reais (e não as 4 do texto original) | o banner só oferece Necessários, Analíticos e Publicidade |
| 7 | A **Política de IA** foi alinhada com a de Privacidade | a original dizia que a I.A. identificava padrões de navegação — o site é estático e não coleta isso |
| 8 | As **cores** corrigidas para WCAG AA | tokens **derivados** (`--color-accent-text`, `--color-accent-text-inverse`); a paleta do kit fica **intocada**. A1…A25 são recalculadas do CSS construído (`npm run check-contrast`) |
| 9 | Os **títulos longos** dos icon-boxes quebram acima de 1367 px | o `nowrap` do "Additional CSS" (post 136) transbordava na grelha de 4 colunas (~285 px) |
| 10 | A **altura do header** é medida em runtime (`--header-height`) | o logo encolhe com a largura: o `scroll-margin-top` das âncoras tem de seguir |
| 11 | O link **"Gerenciar preferências de cookies"** está em todas as páginas | SEC-64 / SEC-R-12: o link tem de estar em todas |
| 12 | As **políticas** só usam `h2` | o `h4` do WordPress e o `h3` do título repetido desceram de nível |

> ⚠️ **O texto legal acrescentado está MARCADO como pendente de aprovação do
> advogado** (o comentário no início de cada anexo). As políticas não são
> conteúdo técnico: a revisão jurídica é do escritório.

---

## 6. As correções feitas ao conteúdo de origem

As correções são feitas **na fonte da extração**
(`scripts/extract/lib/repairs.mjs`) e ficam registadas em
`docs/_reference/extract-report.json → repairs`. Um erro escrito à mão no
`src/` desaparece no `npm run extract` seguinte.

| Onde | Original | Corrigido |
|---|---|---|
| Header e rodapé, "Política de IA" | `contato@glastriadvocacia.com.br` | `contato@galastriadvocacia.com.br` |
| Templates 525 e 790 | `https://instragram.com/` | `https://www.instagram.com/` |
| Nossa Equipe | "epecialista" | "especialista" |
| 404 | "Ops parece que alguma coisa deu errado! :/" | "Ops! Parece que alguma coisa deu errado." |
| 404 | "…está tentando acessar está tentando acessar está temporariamente fora do ar… Recomendo que você acesse um dos links abaixo" | "…está temporariamente fora do ar ou foi encerrada. Use os links abaixo para continuar navegando." |
| 404 | "Voltar ao **inínicio**" | "Voltar ao **início**" |
| Secção "Fale Conosco" | "Agende sua reunião **preencha** formulário abaixo:" | "Agende sua reunião **preenchendo** o formulário abaixo:" |
| Post do BLPC | "Sálario-materinidade" | "Salário-maternidade" |
| Post do BLPC (×2) | "Centro de Referência **e** Assistência Social" | "Centro de Referência **de** Assistência Social" |
| Depoimento | "Tenha um **prospero** ano novo" | "Tenha um **próspero** ano novo" |

E os **dois links mortos** do rodapé (`LINK_REPAIRS`, em
`scripts/extract/lib/repairs.mjs`):

| Texto | Antes | Agora |
|---|---|---|
| "Áreas de Atuação" | `#sobre` | `/#areasdeatuacao` |
| "Serviços" | `/servicos/` (uma página que **nunca existiu**) | `/#servicos` |

---

## 7. As rondas de correções

| Rodada | Âmbito | O que trouxe | Resultado |
|---|---|---|---|
| **A** | segurança, dados e SEO | D27–D35: os digest dos valores vivos em vez dos valores, o contentor do GTM atrás do consentimento, a CSP numa fonte única, o formulário *fail-closed*, a guarda de segredos, o gate de rotação, a 404 *noindex* | **0 segredos** no repositório; as contagens medidas corrigidas |
| **B** | UI/UX | D36–D52: o header colava (`overflow: clip`), o menu móvel abre com `elementor-active`, o painel fechado leva `inert`, o skip-link aponta para `#conteudo`, o logo do rodapé resolvido pelo *attachment* (327×299), o alias `/home/` deixou de perder o fragmento, as políticas só usam `h2` | 4 críticos + 7 altos resolvidos; a tabela de contraste passou a ser recalculada do CSS construído |
| **C** | a rodada final | D53–D63: o `inert` no `<nav>` certo, o `checkout` no job de publicação, os digest em dois níveis com a janela deslizante, o auto-teste da guarda, o sanitizador de tempo de build, a numeração sequencial e a vigência única das políticas, o overlay estrito, todas as verificações no CI | 20 itens (C1–C20) resolvidos |
| **D** | a última rodada | D64–D75: nenhum caminho absoluto no repositório público, a guarda varre o `.github`, o pré-filtro de prefixo (a guarda deixou de demorar minutos), o `javascript:` testado depois da normalização das entidades, o sanitizador mantém os títulos, o gate exige os quatro campos, as sondas da guarda são git-ignored, o `dist/` é verificado, o `configure-pages` no job de publicação, o consentimento é repetido quando a versão muda, a CSP com `script-src-attr 'none'` | 22 itens (D1–D22) resolvidos |

> ⚠️ As **12 rotações** de `docs/rotation-gate.md` continuam **pendentes** (é
> tarefa do cliente) — e o gate está **CONTORNADO** por decisão do dono (D88:
> `ROTATION_GATE=skip` ✗): o **build de produção** da Cloudflare Pages corre o
> gate ✗, mas ele é **saltado** ✗ e a publicação **está a ocorrer** ✗. Para
> voltar a bloquear: tirar a variável `ROTATION_GATE` ✗.
> Ver [`rotation-gate.md`](rotation-gate.md) e o
> [`security-decisions.md`](security-decisions.md).
