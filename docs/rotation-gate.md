# Gate da rotação dos segredos (SEC-67)

> **Este ficheiro é o gate de publicação.** Enquanto uma das 12 linhas estiver
> com `☐`, o workflow **não publica o site**: o job `deploy` do GitHub Pages
> falha e o site continua a servir a versão anterior (ou nada).
>
> O **repositório pode (e deve) já estar público** — o gate **não** bloqueia o
> `push`. O `deployer` cria o repositório público e faz o primeiro push; o
> que fica bloqueado é a **publicação**.
>
> Comando: `npm run gate:rotation` (sai com **1** enquanto houver `☐`).

**Porquê:** os segredos do backup (22/03/2026) circularam fora do repositório.
A redação das specs removeu os **valores** do repositório, mas **não revoga
nada**: quem conseguir ler o backup continua com acesso ao MySQL, aos e-mails
do escritório, ao Google Drive dos backups e ao WordPress.

**Porque é que o gate está no job de publicação e não no push:** o que a
rotação protege é o **site vivo** (as credenciais continuam a valer até serem
revogadas, e o site é que as usa). Um repositório público **não** expõe uma
credencial confirmável: os digest que nele vivem são de **alta entropia** (o
mais curto tem 26 caracteres) e os de **baixa entropia** estão no ficheiro
**git-ignored** `scripts/private/pii-digests.json`, que nunca sai da máquina.
Por isso o repositório pode ser público **antes** da rotação — o que o gate
bloqueia é a **publicação**.

**Como fechar cada linha:** marcar `☑`, preencher a data e o responsável e
colar o **sha256** da captura de tela (nunca o valor). O sha256 prova que a
captura existe sem revelar o segredo.

**Quem:** o **cliente** (dono do domínio e das contas). O `developer` e o `qa`
verificam a evidência; o `deployer` executa o gate.

---

| # | Item (a rotação) | Evidência exigida | Estado | Data | Responsável | sha256 da captura |
|---|---|---|---|---|---|---|
| 1 | **Banco de dados** — trocar a senha do MySQL (ou apagar o banco e o utilizador) | print do console (sem o valor) | ☐ | — | — | — |
| 2 | **Salts do WordPress** — regenerar os 8 salts WP e os duplicados em `wp_options` | print + data | ☐ | — | — | — |
| 3 | **OAuth Google — Gmail** — revogar o client do wp-mail-smtp e apagar `gmail.client_secret`, `gmail.refresh_token`, `gmail.access_token`, `auth_code` | print da tela do Google Cloud | ☐ | — | — | — |
| 4 | **OAuth Google — Drive (wpvivid)** — revogar o client e apagar `wpvivid_upload_setting`, `clean_task`, `wpvivid_backup_list` | print + data | ☐ | — | — | — |
| 5 | **OAuth Google — Site Kit** — revogar os tokens e o perfil | print + data | ☐ | — | — | — |
| 6 | **OAuth Google — Rank Math** — revogar `rank_math_google_oauth_tokens` e `rank_math_connect_data` | print + data | ☐ | — | — | — |
| 7 | **Elementor Connect** — trocar `client_id`, `auth_secret`, `access_token_secret` e revogar o JWT | print + data | ☐ | — | — | — |
| 8 | **Elementor Safe Mode** — revogar `elementor_safe_mode_token` e remover o mu-plugin | print + data | ☐ | — | — | — |
| 9 | **Outros tokens do dump** — invalidar `elementor_connect_site_key`, `ea11y_client_secret`, `wordpress_api_key`, `trustindex-google-review-download-token`, `indexnow_api_key` | print + data | ☐ | — | — | — |
| 10 | **Contas** — ativar 2FA na conta GitHub e na conta Formspree; guardar os códigos de recuperação com o cliente | print da data de ativação | ☐ | — | — | — |
| 11 | **Backup local** — definir e registar o prazo de retenção do backup WP-Vivid (recomendado: 90 dias após o go-live) | registo neste repositório | ☐ | — | — | — |
| 12 | **WordPress antigo** — decisão formal: não religar; se religar, aplicar o lockdown de SEC-63 antes do DNS | registo neste repositório | ☐ | — | — | — |

---

## Como o gate é verificado

```bash
npm run gate:rotation
```

- Sai com **0** quando as 12 linhas estão com `☑` (e com data, responsável e
  sha256).
- Sai com **1** e imprime as linhas pendentes enquanto houver um `☐`.
- É executado no job `deploy` do workflow (`.github/workflows/deploy.yml`),
  **depois** do build: bloqueia a **publicação**, não o desenvolvimento local.

> O checklist completo, com o texto de cada rotação, está em
> `docs/SPEC-SECURITY.md` §3. Este ficheiro é o **registo** — é aqui que a
> evidência é colada.
