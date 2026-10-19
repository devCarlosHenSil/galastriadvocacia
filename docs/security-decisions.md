# Decisões de segurança e exceções aceitas

Registro das aceitações de risco explícitas do projeto (SEC-49 / SEC-50).

---

## E2 — O contentor do GTM não pode levar uma tag do AdSense (aberta)

| Campo | Valor |
|---|---|
| **Data** | 2026-10-19 |
| **Responsável** | developer (a reverificar na configuração do GTM) |
| **Regra** | SEC-44, R13 |
| **Estado** | ✅ Implementado no código |

### O que mudou

O contentor do **Google Tag Manager** (`GTM-KDNG3QWB`) deixou de ser injetado
no `<head>`: passou a ser carregado por `public/js/cookie-consent.js`, **depois**
de `gtag('consent', 'update', …)`, e só quando o visitante aceita pelo menos
uma categoria opcional. Antes desta mudança, a primeira visita disparava um
pedido a `googletagmanager.com` **antes** de qualquer escolha (T1 do QA
exige zero pedidos).

O `<head>` mantém **apenas** o `gtag('consent', 'default', {… 'denied'})`, que
tem de ser a primeira coisa. O `adsbygoogle.js` continua no caminho
`type="text/plain"` → injetado pelo consentimento.

### O que o cliente tem de fazer

⚠️ **O contentor do GTM não pode conter uma tag do AdSense.** Se o painel do
GTM tiver a tag do AdSense, ela dispara quando o contentor carrega — ou seja,
**antes** do consentimento, e escreve `IDE`, `test_cookie` e `_gcl_au`. A tag
do AdSense do site é a do `<head>` (`ca-pub-5989678973778468`), que só é
ativada depois do consentimento.

**Verificar no painel do GTM** (Container → Tags → Publicidade): não pode haver
nenhuma tag do AdSense. Se houver, **removê-la**.

---

## E1 — `npm audit`: vulnerabilidade crítica no `astro` (aberta)

| Campo | Valor |
|---|---|
| **Data** | 2026-10-19 |
| **Responsável** | EM (decisão D1: Astro 5) — **revisão em 2026-11-19** |
| **Revisor** | `developer` (a verificar o advisory no `npm audit`) |
| **Regra** | SEC-49 (`npm audit --audit-level=high` deve reportar 0 high/critical) |
| **Estado** | **Exceção aceita** — `npm audit --audit-level=high` reporta **1 vulnerabilidade crítica** (`astro`), 0 high e 0 low |

### O que é

O `npm audit` aponta o pacote `astro` (todas as versões `<= 7.2.7`):

| Advisory | Gravidade | Aplica-se a este projeto? |
|---|---|---|
| GHSA-j687-52p2-xcff — XSS em `define:vars` | crítica | **Não** — o projeto não usa `define:vars` nem variáveis no cliente. |
| GHSA-jrpj-wcv7-9fh9 / GHSA-f48w-9m4c-m7f5 — XSS em nomes de atributos de *spread props* | crítica | **Não** — não há componentes de framework (React/Vue/Svelte) no projeto. |
| GHSA-7pw4-f3q4-r2p2 — XSS em `transition:*` | crítica | **Não** — não há ilhas hidratadas. |
| GHSA-4g3v-8h47-v7g6 — XSS em View Transitions | crítica | **Não** — não há view transitions. |
| GHSA-8hv8-536x-4wqp — XSS no nome de um *slot* | crítica | **Não** — não há *slots* com dado de utilizador. |
| GHSA-xr5h-phrj-8vxv — replay de parâmetros de *server island* | crítica | **Não** — o site é 100% estático (`output: 'static'`), sem islands nem servidor. |
| GHSA-2pvr-wf23-7pc7 — SSRF de *Host header* na página de erro | crítica | **Não** — sem SSR; o build é estático. |
| GHSA-26w7-cxv4-gfx2 — RCE na otimização AVIF | crítica | **Não** — não há `astro:assets` nem o serviço de imagens; as mídias são copiadas **verbatim** de `public/wp-content/uploads/`. |
| GHSA-376h-93r7-7g6f — bypass de autorização no `base` | crítica | **Não** — `base` é `/` (raiz), o mesmo domínio do `site`. |

### Por que não foi corrigido

O conserto exige `astro@7.4.1` (duas majors acima). A decisão **D1** do EM fixa **Astro 5**; a SPEC-UI e a SPEC-DATA assumem a API do Astro 5 (`glob()` loader, content collections). A atualização para a Astro 7 é uma **decisão de escopo**, não um patch de dependência — precisa de validação da Fase 3 (renderer) e da Fase 6 (paridade visual).

### Mitigações já aplicadas

- `overrides` no `package.json` para `esbuild@^0.28.2` e `sharp@^0.35.5` → zeram as vulnerabilidades **high** e **critical** dessas dependências transitivas.
- O site é estático, sem islands, sem `astro:assets`, sem SSR e sem `define:vars` — nenhuma das advisors acima tem caminho de exploração no código deste repositório.
- O `scripts/guard-secrets.mjs` roda no `prebuild` **e** no CI (SEC-30 / SEC-55).

### Como a exceção é verificada no CI (SEC-R-11)

`scripts/check-audit.mjs` fixa a exceção **pelo ID do advisory**, e não pelo
pacote: o step do workflow corre

```bash
npm audit --audit-level=high --json > audit.json || true
node scripts/check-audit.mjs audit.json
```

e **falha** se:

- aparecer um advisory de severidade `high` ou `critical` de um pacote que não
  está na lista aceite;
- um advisory do `astro` **fora** dos 10 IDs aceite;
- o número de advisories do `astro` for superior a 10;
- a lista aceite não estiver documentada aqui (o script verifica o
  `docs/security-decisions.md`).

**Os 10 advisories aceites (SHA-256 não, GHSA):**

GHSA-j687-52p2-xcff · GHSA-xr5h-phrj-8vxv · GHSA-jrpj-wcv7-9fh9 · GHSA-f48w-9m4c-m7f5 · GHSA-7pw4-f3q4-r2p2 · GHSA-4g3v-8h47-v7g6 · GHSA-2pvr-wf23-7pc7 · GHSA-8hv8-536x-4wqp · GHSA-26w7-cxv4-gfx2 · GHSA-376h-93r7-7g6f

| # | Advisory | O que é |
|---|---|---|
| 1 | `GHSA-j687-52p2-xcff` | XSS em `define:vars` |
| 2 | `GHSA-xr5h-phrj-8vxv` | replay de parâmetros de server island |
| 3 | `GHSA-jrpj-wcv7-9fh9` | XSS em nomes de atributos de spread props |
| 4 | `GHSA-f48w-9m4c-m7f5` | XSS em nomes de atributos de spread props (correção incompleta) |
| 5 | `GHSA-7pw4-f3q4-r2p2` | XSS em valores `transition:*` de ilhas hidratadas |
| 6 | `GHSA-4g3v-8h47-v7g6` | XSS reflexivo em View Transitions |
| 7 | `GHSA-2pvr-wf23-7pc7` | SSRF de `Host header` na página de erro |
| 8 | `GHSA-8hv8-536x-4wqp` | XSS reflexivo no nome de um `slot` |
| 9 | `GHSA-26w7-cxv4-gfx2` | RCE na otimização de imagens AVIF |
| 10 | `GHSA-376h-93r7-7g6f` | bypass de autorização ao remover o `base` |

**Nenhum deles tem caminho de exploração neste projeto** (site estático, sem
`define:vars`, sem ilhas hidratadas, sem `astro:assets`, sem SSR). Se um
advisory **novo** do `astro` aparecer, o build **falha** — a exceção é
revisada, não extendida.

## E3 — Os digest dos dados pessoais vivem **fora** do repositório (aberta)

> **SEC-R-26 / C3.** O `scripts/lib/forbidden.mjs` guarda os digest SHA-256
> dos **valores vivos** do backup, para que a guarda os reconheça sem que o
> valor esteja no repositório. Isso vale para as **credenciais** — um salt de
> 64 caracteres aleatórios não é reversível por força bruta, por isso o digest
> **não** é um oráculo de confirmação. **Não** vale para os **dados pessoais**
> (os IPv4 e os e-mails): o seu espaço de pesquisa é pequeno e o digest
> **confirmaria** um valor candidato.

| Nível | O que é | Onde vive |
|---|---|---|
| `HIGH_ENTROPY_DIGESTS` | as credenciais (a senha da base de dados, os 8 salts, os tokens OAuth, as chaves de API) | `scripts/lib/forbidden.mjs` (**versionado**) |
| `PII_DIGESTS` | os IPv4 e os e-mails pessoais | `scripts/private/pii-digests.json` — **local e git-ignored** |

A guarda lê o ficheiro local **quando ele existe** e **passa sem ele** (o CI
não tem ficheiro local: os dados pessoais são aí apanhados apenas pelas
regras de forma). O ficheiro é gerado a partir do backup pelo
`npm run guard:pii-digests` (o `npm run guard:self-test` só o **lê**).

**Como a guarda apanha um valor** (`scripts/lib/forbidden.mjs`): a extração
dos candidatos é **independente do conjunto de caracteres** — para cada
comprimento conhecido *L*, cada substring de comprimento *L* cujas
extremidades **não são alfanuméricas** (com uma tolerância de ±2 caracteres)
é um candidato, e o seu SHA-256 é comparado com a lista. Um salt do
WordPress (que tem pontuação) é assim apanhado tal e qual.

**O auto-teste** (`npm run guard:self-test`) planta **cada** valor vivo do
backup (lido do backup **read-only**, nunca copiado para o repositório) em
cada diretório varrido pela guarda (`src/`, `public/`, `docs/`, `tests/`,
`scripts/` e um `src/data/elementor/*.json`), prova que a guarda **reprova**
em todos os casos, remove as sondas e prova que volta a passar. No CI (sem o
backup) o auto-teste **salta** com uma mensagem.

### E3.1 — O que fica por fazer (o cliente)

- O ficheiro `scripts/private/pii-digests.json` **não é versionado** (por
  desenho). Num fork público, os dados pessoais deixam de ser reconhecidos
  localmente → o ficheiro tem de ser gerado de novo (o comando está
  documentado acima).
- Os **12 segredos** continuam por rotacionar (E4 — `docs/rotation-gate.md`).

## E5 — A CSP ficou mais dura: `script-src-attr 'none'` (fechada)

> **D20 (2026-10-19).** A CSP passou a incluir **`script-src-attr 'none'`**: os
> handlers `on…=` em linha (o `onerror=`, o `onload=`) estão **proibidos**.
> O site **não tem nenhum** (os scripts do site estão em `public/js/*.js`), por
> isso a diretiva não quebra nada e fecha o vetor mesmo com `'unsafe-inline'`
> no `script-src`.
>
> ⚠️ **A `script-src-attr` NÃO bloqueia as URLs `javascript:`** — um
> `<a href="javascript:…">` continua a ser executado. Isso é tratado em duas
> camadas: o **sanitizador de tempo de build** (`scripts/extract/lib/sanitize.mjs`,
> que normaliza as entidades antes de testar) e a **guarda** (que reprova o
> `dist/` com `npm run check-dist`). A string da CSP vive em
> `src/lib/csp.ts` e o `npm run verify-csp` compara-a com a do runbook.

## E4 — A rotação dos 12 segredos (aberta)

`npm run gate:rotation` bloqueia a **publicação** enquanto **qualquer** uma
das 12 rotações de `docs/SPEC-SECURITY.md` §3 não estiver registada em
`docs/rotation-gate.md` (com a data, o responsável e o sha256 da captura).
O gate corre **no job de publicação** do workflow — não no desenvolvimento
local.
