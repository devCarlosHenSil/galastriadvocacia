# Runbook das GitHub Pages (SEC-62)

> **Quando usar:** o repositório foi **renomeado**, **transferido** para outra
> organização, ou foi **eliminado**. O site em produção (`galastriadvocacia.com.br`)
> deixa de ser servido — o GitHub Pages liga o domínio ao **repositório** que o
> publica.

## 1. Antes de tocar em seja o que for

| # | Passo | Porquê |
|---|---|---|
| 1 | `npm run gate:rotation` | enquanto houver uma rotação por fazer, o site **não** deve ser republicado. |
| 2 | `npm run build && npm run check-dist` | o artefacto tem de estar limpo antes de o publicar noutro sítio. |
| 3 | Anotar o **domínio** e o **CNAME** | `public/CNAME` (`galastriadvocacia.com.br`) vai dentro do artefacto (R18). |
| 4 | Cópia de segurança do repositório (`git bundle` ou um fork privado) | o repositório é **público**: a história e os ficheiros estão no GitHub, mas o **branch** de produção e as variables **não**. |

## 2. Repositório renomeado

1. O `CNAME` **não** muda: o domínio é do **escritório**, não do repositório.
2. No repositório novo: **Settings → Pages → Custom domain** =
   `galastriadvocacia.com.br` (o `CNAME` do artefacto continua a ser o mesmo).
3. **Settings → Secrets and variables → Actions → Variables**:
   recriar a variable **`PUBLIC_FORMSPREE_ENDPOINT`** (o id público do
   formulário) — **não** é um secret, é uma variable ✓.
4. `git remote set-url origin <a nova origem>` e `git push --follow-tags`.
5. Verificar:
   ```bash
   curl -sI https://galastriadvocacia.com.br/ | head -1        # HTTP/2 200
   curl -sI https://galastriadvocacia.com.br/ | grep -i content-security-policy
   ```

## 3. Repositório transferido (outra organização)

1. A **organização destino** tem de ter o **Pages** ativado e o plano que o
   permite.
2. O domínio tem de estar associado à **nova** organização: em
   **Settings → Pages → Custom domain**, confirmar que o domínio é detido por
   ela (a GitHub pede o ficheiro `TXT` no DNS).
3. Se o domínio **não** puder ser movido (o titular é a pessoa do escritório e
   não a organização), manter o domínio no **ficheiro DNS** com o
   `CNAME` para `<organização>.github.io` ✓ — é o que a §2 do
   `docs/DEPLOY.md` descreve.
4. Recriar as **variables** e os **secrets** (as variables **não** migram com
   o repositório).
5. O **branch protection** e a **branch protection rules** também não
   migram: reconfigurar (revisão por PR obrigatória em `main` — SEC-49).

## 4. Repositório eliminado

> ⚠️ **Nunca eliminar o repositório antes de remover o domínio.** Se o
> repositório desaparecer com o `CNAME` ainda associado, o domínio fica
> apontado para o GitHub e o site deixa de ser servido **sem aviso**.

Ordem correta:

1. **Settings → Pages → Custom domain → Remove** (ou o registo DNS do
   `CNAME` do `www`).
2. **Só depois** eliminar o repositório.
3. Se o repositório foi eliminado **sem** remover o domínio: o `CNAME` do
   domínio tem de apontar para outro sítio (por exemplo, a Cloudflare) **antes**
   de o domínio expirar — o `CNAME` do apex para o GitHub Pages tem de ser
   desfeito e substituído pelos **A records** da origem.

## 5. Recomendação: mover o repositório para a organização do cliente

O repositório é **público** (`devCarlosHenSil/galastriadvocacia`) porque as
especificações e o runbook são lidos pelo cliente e pela equipa. As
**consequências** de o repositório pertencer à agência:

- quem pode apagar o repositório também pode **desligar o site**;
- as **variables** do repositório (o endpoint do Formspree) e as **configurações
  do Pages** (o domínio, o branch de produção) estão na conta da agência;
- uma rotação de credenciais na agência pode **derrubar** o site do cliente.

**Recomendação:** criar uma organização no GitHub em nome do
**Galastri Advocacia** (ou do domínio `galastriadvocacia.com.br`) e mover o
repositório para lá, com o cliente como **owner** e a agência como
colaborador. A propriedade do domínio e do repositório passa a ser do
**cliente** — e o runbook desta página deixa de ser o plano de recuperação
para ser apenas a rotina.

## 6. Checklist de recuperação (qualquer um dos cenários)

```bash
# 1. o artefacto está limpo?
npm ci && npm run build && npm run check-dist

# 2. as verificações passam?
npm run check-parity && npm run check-links && npm run check-contrast
npm run verify-csp && npm run verify-workflow

# 3. o gate da rotação (a publicar é o cliente)
npm run gate:rotation

# 4. depois da publicação
curl -sI https://galastriadvocacia.com.br/ | head -1
curl -sI https://www.galastriadvocacia.com.br/ | head -3   # 301 para o apex
curl -sI https://galastriadvocacia.com.br/ | grep -Ei "strict-transport|x-content-type|x-frame|referrer-policy|permissions-policy|content-security-policy"
```
