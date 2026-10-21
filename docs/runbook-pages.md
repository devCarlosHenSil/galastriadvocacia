# Runbook da Cloudflare Pages (SEC-62)

> **Quando usar:** o projecto da Cloudflare Pages foi **renomeado**,
> **transferido** para outra conta, ou foi **eliminado**; ou o repositório foi
> renomeado/transferido/eliminado (a integração do projecto aponta para ele).
> O site em produção (`https://www.galastriadvocacia.com.br`) deixa de ser
> servido — o Pages liga o domínio ao **projecto** que o publica.
>
> ⚠️ O **`git push` não chega**: o *webhook* do GitHub só dispara num push
> real ✗. O deployment tem de ser **disparado pela API da Cloudflare Pages**
> ✗ (o procedimento completo está em `docs/DEPLOY.md` §10 ✗).

## 1. Antes de tocar em seja o que for

| # | Passo | Porquê |
|---|---|---|
| 1 | `npm run gate:rotation` | enquanto houver uma rotação por fazer, o site **não** deve ser republicado (o gate está aberto por decisão do dono ✗ — D88 ✗ — mas o registo tem de estar em dia ✗). |
| 2 | `npm run build && npm run check-dist` | o artefacto tem de estar limpo antes de o publicar noutro sítio. |
| 3 | Anotar o **projecto**, o **hostname** e o **domínio** | `galastriadvocacia` (id `f5855fc6-22d8-410d-8bb6-e06588e0b435`) · `galastriadvocacia.pages.dev` · `www.galastriadvocacia.com.br` (o canónico ✗ — D91 ✗). |
| 4 | Anotar as **variáveis e os segredos** do projecto | `NODE_VERSION` · `PRODUCTION_BRANCH` · `PUBLIC_CONTACT_ENDPOINT` · `ROTATION_GATE` · e o **segredo** `RESEND_API_KEY` ✗ (as variables **não** migram com o repositório ✗). |
| 5 | Cópia de segurança do repositório (`git bundle` ou um fork privado) | o repositório é **público**: a história e os ficheiros estão no GitHub, mas a **branch de produção** e as variables **não**. |

## 2. Projecto renomeado

1. O **domínio** não muda: o domínio é do **escritório**, não do projecto
   ✗ — nem o hostname `<project>.pages.dev` ✗.
2. Na Cloudflare: **Workers & Pages** → o projecto → **Settings → Custom
   domains** — confirmar `www.galastriadvocacia.com.br` ✗ (e o apex ✗, que
   devolve 301 para o `www` ✗).
3. **Settings → Environment variables**: recriar as **variables** e o
   **segredo** ✗ (`PUBLIC_CONTACT_ENDPOINT=/api/contact` ✗,
   `RESEND_API_KEY` ✗, `ROTATION_GATE` ✗, `PRODUCTION_BRANCH` ✗,
   `NODE_VERSION=20` ✗).
4. Se o **repositório** mudou de nome: **Settings → Builds & deployments →
   Source** → apontar para o novo ✗.
5. Verificar:
   ```bash
   curl -sI https://www.galastriadvocacia.com.br/ | head -1        # HTTP/2 200
   curl -sI https://www.galastriadvocacia.com.br/ | grep -i content-security-policy
   ```

## 3. Projecto transferido (outra conta)

1. A **conta destino** tem de ter o **Workers/Pages** ativado e o plano que o
   permite.
2. O domínio tem de estar associado à **nova** conta: em **Settings → Custom
   domains** ✗, confirmar que o domínio é detido por ela ✗.
3. Se o domínio **não** puder ser movido (o titular é a pessoa do escritório ✗
   e não a conta da agência ✗), manter o domínio no **DNS** da zona ✗ — o
   `www` em CNAME para `galastriadvocacia.pages.dev` ✗ e o apex com a
   Redirect Rule 301 para o `www` ✗.
4. Recriar as **variables** e os **segredos** ✗ (não migram ✗).
5. A **branch de produção** e a **branch protection** do repositório também não
   migram ✗: reconfigurar (revisão por PR obrigatória em `main` ✗ — SEC-49 ✗).

## 4. Projecto eliminado

> ⚠️ **Nunca eliminar o projecto antes de remover o domínio.** Se o projecto
> desaparecer com o domínio ainda associado, o domínio fica a apontar para um
> hostname inexistente e o site deixa de ser servido **sem aviso**.

Ordem correta:

1. **Settings → Custom domains → Remove** (o `www` e o apex ✗) ✗ — ou
   remover o registo DNS do `www` ✗.
2. **Só depois** eliminar o projecto.
3. Se o projecto foi eliminado **sem** remover o domínio: o `CNAME` do `www`
   tem de apontar para outro sítio **antes** de o domínio expirar ✗.

## 5. Repositório eliminado (o projecto continua)

1. O projecto fica sem origem ✗: **Settings → Builds & deployments → Source**
   → escolher outro repositório ✗ (ou criar um repositório novo ✗ com o mesmo
   conteúdo ✗).
2. A **branch de produção** e as **variables** do projecto **mantêm-se** ✗ — a
   integração é que muda ✗.
3. Se o repositório foi eliminado **sem** recriar a integração ✗: o projecto
   deixa de construir ✗ — o último deployment continua a ser servido ✗, mas
   não há novos ✗.

## 6. Recomendação: mover o repositório para a organização do cliente

O repositório é **público** (`devCarlosHenSil/galastriadvocacia`) porque as
especificações e o runbook são lidos pelo cliente e pela equipa. As
**consequências** de o repositório pertencer à agência:

- quem pode apagar o repositório também pode **desligar** o site ✗;
- as **variables** e os **segredos** do projecto (o endpoint do formulário ✗, a
  `RESEND_API_KEY` ✗) e as **configurações do Pages** (o domínio ✗, a branch
  de produção ✗) estão na conta da agência;
- uma rotação de credenciais na agência pode **derrubar** o site do cliente.

**Recomendação:** criar uma organização no GitHub em nome do
**Galastri Advocacia** (ou do domínio `galastriadvocacia.com.br`) e mover o
repositório para lá, com o cliente como **owner** e a agência como
colaborador. A propriedade do domínio e do repositório passa a ser do
**cliente** — e o runbook desta página deixa de ser o plano de recuperação
para ser apenas a rotina.

## 7. Checklist de recuperação (qualquer um dos cenários)

```bash
# 1. o artefacto está limpo?
npm ci && npm run build && npm run check-dist

# 2. as verificações passam?
npm run check-parity && npm run check-links && npm run check-contrast
npm run verify-csp && npm run verify-workflow && npm run check-function

# 3. o gate da rotação (a publicar é o cliente)
npm run gate:rotation

# 4. disparar o deployment (docs/DEPLOY.md §10) e ler o log

# 5. depois da publicação
curl -sI https://www.galastriadvocacia.com.br/ | head -1        # 200
curl -sI https://galastriadvocacia.com.br/ | head -3              # 301 para o www
curl -sI https://www.galastriadvocacia.com.br/ | grep -Ei "strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|content-security-policy"
```
