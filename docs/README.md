# docs — a documentação da migração WordPress → Astro

Conjunto de documentos do site `galastriadvocacia.com.br` (WordPress 6.9.4 +
Elementor 3.35.7 + tema `kava` → **Astro 5** estático no GitHub Pages).

> **O `README.md` da raiz é o ponto de entrada.** Este ficheiro é o **índice**:
> diz qual é cada documento e **para quem** é.

| Convenções | |
|---|---|
| **Prosa** | português (pt-BR) |
| **Comandos, caminhos, identificadores, hex de cor, classes CSS** | inglês / verbatim |
| **Segredos** | nunca por valor — `<REDACTED:o que é>` + origem + forma. O `npm run guard` varre `docs/` (perfil de **valores**) e falha se aparecer um valor vivo ou uma **forma de PII** (e-mail, IPv4, telefone) que não seja um contacto público do escritório |
| **Caminhos da máquina** | `<LOCAL>` (a raiz do repositório) e `<BACKUP>` (o backup do WordPress, read-only) |
| **E-mail público** | `contato@galastriadvocacia.com.br` |

---

## Para o cliente / o dono do site

Leia nesta ordem. Nada aqui exige saber programar.

| # | Documento | O que responde |
|---|---|---|
| 1 | [`../README.md`](../README.md) | O que é o projeto, como se constrói, o que está pendente e onde está cada truth |
| 2 | [`CONTENT-EDITING.md`](CONTENT-EDITING.md) | **Como escrever no site**: que ficheiro abrir, que campo mexer, a referência do frontmatter e o fluxo de publicação |
| 3 | [`rotation-gate.md`](rotation-gate.md) | **As 12 rotações de segredos** a fazer antes de o site ir para o ar — com data, responsável e sha256 da captura |
| 4 | [`DEPLOY.md`](DEPLOY.md) | **O runbook de publicação**: DNS, Transform Rules da Cloudflare, GitHub Pages, Formspree, rollback e o gate |
| 5 | [`MIGRATION.md`](MIGRATION.md) | **O que foi migrado, o que foi descartado e porquê** — o registo histórico da migração |
| 6 | [`PROJECT-STATE.md`](PROJECT-STATE.md) | **Em que estado está o projeto**: a fase atual, as decisões tomadas, o que falta e o que está fora de escopo |

---

## Para quem desenvolve

| # | Documento | O que responde |
|---|---|---|
| 1 | [`../AGENTS.md`](../AGENTS.md) | **O acordo de trabalho**: os 4 invariantes, os comandos, as convenções, as ações proibidas, o Definition of Done e quem revê o quê |
| 2 | [`SPEC-DATA.md`](SPEC-DATA.md) | O modelo de dados de origem e de destino, as rotas, o `site.json`, o schema Zod, o pipeline de extração e a suíte de asserts (§6.1–§6.7) |
| 3 | [`SPEC-SECURITY.md`](SPEC-SECURITY.md) | O threat model, os requisitos SEC-23…SEC-67, a CSP e os headers, o `.gitignore`, os comandos de verificação, os textos LGPD e o checklist de rotação |
| 4 | [`SPEC-UI.md`](SPEC-UI.md) | O contrato de DOM, o inventário de widgets, os estados de interação, o responsivo, o contraste medido, a acessibilidade e os tokens |
| 5 | [`PLAN.md`](PLAN.md) | O plano consolidado em 6 fases: tarefas, dependências, critérios de aceitação, Definition of Done e riscos |
| 6 | [`PARITY.md`](PARITY.md) | O registo da paridade visual: o método, as 10 secções da home e as **divergências aceites**, com o motivo de cada uma |
| 7 | [`runbook-pages.md`](runbook-pages.md) | O que fazer se o repositório for renomeado, transferido ou eliminado |
| 8 | [`security-decisions.md`](security-decisions.md) | As exceções de segurança **aceites** e a sua justificação (a advisory crítica do `astro`, os digests de PII, o `script-src-attr`) |
| 9 | [`_reference/extract-report.json`](_reference/extract-report.json) | As **contagens medidas** da extração: elementos, assets, relações, campos do formulário, reparações aplicadas e avisos |

---

## Para quem revê

A ordem de leitura: primeiro o estado, depois o plano, depois as specs, depois a evidência.

| # | Documento | O que auditar |
|---|---|---|
| 1 | [`PROJECT-STATE.md`](PROJECT-STATE.md) | As decisões (D1…D75) com data e origem, os riscos em aberto (R-01…R-05) e as quatro rondas de correções (FIX PASS A…D) |
| 2 | [`PLAN.md`](PLAN.md) | O Definition of Done e as perguntas em aberto (Q1–Q8) |
| 3 | [`SPEC-DATA.md`](SPEC-DATA.md) · [`SPEC-SECURITY.md`](SPEC-SECURITY.md) · [`SPEC-UI.md`](SPEC-UI.md) | Os **IDs são estáveis e citáveis**: `SEC-nn`, `AC-*`, `T<n>.<n>`, `R1`…`R20`, `Q1`…`Q8` |
| 4 | [`MIGRATION.md`](MIGRATION.md) | O mapa de URLs antigo → novo, o que foi descartado, as divergências conhecidas e as correções feitas ao conteúdo de origem |
| 5 | [`PARITY.md`](PARITY.md) | As divergências aceites e o que **não** foi medido (sem navegador) |
| 6 | [`rotation-gate.md`](rotation-gate.md) | As 12 linhas com `☑` + data + responsável + sha256 |
| 7 | [`security-decisions.md`](security-decisions.md) | As 10 advisories aceites, uma a uma, com a razão de não haver caminho de exploração |
| 8 | [`../AGENTS.md`](../AGENTS.md) | Se as regras que a máquina impõe (invariantes, ações proibidas, Definition of Done) são as que a revisão espera |

---

## Como usar este conjunto

1. **Lê `PROJECT-STATE.md` primeiro** — ele resume o que já foi decidido e o que está a bloquear.
2. **Cada spec começa com a linha "Fonte"** (de qual agente veio) e com a seção **"Rulings do EM"** (quais rulings foram aplicados e o que mudou). Se um requisito de um agente conflitar com um ruling, **o ruling vence**.
3. **Cada spec tem um bloco de "Correções factuais"** — as divergências entre o que a spec dizia e o que o dump tem. As **medidas** valem sempre: o dump é a fonte primária, nunca a memória.
4. **Valores concretos são normais** — hex de cor, IDs de elemento do Elementor (`af9b6b1`), classes CSS, comandos e contagens. Não "simplifiques" um valor: ele é o contrato de paridade.
5. **O código é a fonte primária.** Em qualquer dúvida sobre comportamento, a fonte primária é o dump do WordPress + os ficheiros do repositório. Onde o código e um documento divergem, **o código ganha** e o documento é corrigido.
6. **A extração é a única fonte de verdade do conteúdo.** `src/data/*.json`, `src/content/blog/*.md`, `src/pages/politica-*.md` e `public/wp-content/uploads/**` são **gerados** — não se editam à mão. Ver `../AGENTS.md` §3.3.

---

## Não versionado

| Caminho | O que é | Porquê |
|---|---|---|
| `docs/audit/comentarios-retidos.md` | A auditoria dos **48 comentários** do WordPress (4 pingbacks + 44 spam + 0 humanos), só em contagens | Decisão do dono: os comentários **não** migram. O ficheiro está no `.gitignore` |
| `scripts/private/pii-digests.json` | Os digests SHA-256 dos e-mails e IPs pessoais | Um digest de baixa entropia é um oráculo de confirmação por força bruta. **Local e git-ignored** — regenerar com `npm run guard:pii-digests` |
