# Publicação

- **Site**: Cloudflare Pages (gratuito), em `https://descarta-ai.pages.dev` até o domínio ser registrado.
- **API + banco**: um VPS com Docker. O Caddy emite o HTTPS sozinho. Sem domínio, o endereço é `https://api.<IP>.sslip.io`.
- **Atualizações**: o GitHub Actions roda os testes a cada push e, na `main`, publica o site e a API.

## 1. Servidor (VPS)

Requisitos: Ubuntu 24.04, 1 vCPU, 1–2 GB de RAM e acesso SSH por chave.

```bash
# Firewall: só SSH, HTTP e HTTPS
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # saia e entre de novo no SSH

# Código
git clone https://github.com/souz4diogo/descarta-ai.git ~/descarta-ai
cd ~/descarta-ai/deploy
cp .env.example .env
nano .env    # DB_SENHA, JWT_CHAVE, ADMIN_EMAIL/ADMIN_SENHA, API_DOMINIO com o IP do VPS, GEMINI_CHAVE
docker compose up -d --build
```

Teste: `curl https://api.<IP>.sslip.io/health` deve responder `Healthy`. Na primeira subida, a API cria as tabelas, carrega o catálogo e os pontos e cria o administrador com `ADMIN_EMAIL`/`ADMIN_SENHA`. Entre em `/entrar` no site para conferir; depois, pode apagar essas duas linhas do `.env`.

Se o repositório for privado, crie uma *deploy key* só de leitura (Settings → Deploy keys) para o servidor conseguir fazer `git pull`.

### Backups

O contêiner `backup` grava um dump por dia em `deploy/backups/` e mantém os 7 mais recentes. Copie de vez em quando para fora do servidor:

```bash
scp usuario@IP:~/descarta-ai/deploy/backups/*.dump .
```

Para restaurar:

```bash
docker compose exec -T db pg_restore -U descartaai -d descartaai --clean < backups/descartaai-AAAA-MM-DD.dump
```

## 2. Site (Cloudflare Pages)

1. Crie uma conta no Cloudflare, abra **Workers & Pages → Create → Pages → Direct Upload** e dê ao projeto o nome `descarta-ai`.
2. Crie um token em **My Profile → API Tokens** com a permissão *Cloudflare Pages: Edit*.
3. O primeiro envio pode ser manual:
   ```bash
   cd web
   VITE_API_URL=https://api.<IP>.sslip.io/v1 npm run build
   npx wrangler pages deploy dist --project-name=descarta-ai
   ```

Os arquivos `web/public/_headers` e `_redirects` configuram os cabeçalhos de segurança e as rotas do React.

## 3. Publicação automática (GitHub Actions)

Em **Settings → Secrets and variables → Actions** do repositório:

| Tipo | Nome | Valor |
|---|---|---|
| Variable | `DEPLOY_HABILITADO` | `true` (sem ela, o CI só testa) |
| Variable | `VITE_API_URL` | `https://api.<IP>.sslip.io/v1` |
| Variable | `VITE_CONTATO_EMAIL` | e-mail de contato da NSI |
| Variable | `VITE_NSI_CNPJ` | CNPJ da NSI |
| Variable | `VITE_MAPTILER_CHAVE` | chave do MapTiler (plano grátis) para o fundo do mapa; a mesma do app |
| Secret | `CLOUDFLARE_API_TOKEN` | token do passo 2 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | ID da conta (aparece no painel do Cloudflare) |
| Secret | `VPS_HOST` | IP do VPS |
| Secret | `VPS_USUARIO` | usuário do SSH |
| Secret | `VPS_CHAVE_SSH` | chave privada de um par criado só para o deploy (`ssh-keygen -t ed25519`; a pública vai em `~/.ssh/authorized_keys` no VPS) |
| Secret | `VPS_HOST_CONHECIDO` | saída de `ssh-keyscan -t ed25519 IP` |

Crie também o ambiente `producao` em **Settings → Environments**. Se quiser, exija aprovação manual antes de cada deploy.

## 4. Monitoramento

Cadastre `https://api.<IP>.sslip.io/health` no [UptimeRobot](https://uptimerobot.com) (gratuito, verificação a cada 5 min, alerta por e-mail).

## 5. Quando o domínio for registrado

1. No Cloudflare, adicione `descartaai.com.br` e troque os servidores DNS no Registro.br pelos do Cloudflare.
2. Crie o registro DNS `api` do tipo A apontando para o IP do VPS (com a nuvem cinza, *DNS only*, para o Caddy emitir o certificado).
3. No projeto do Pages, em **Custom domains**, adicione `descartaai.com.br`.
4. No `.env` do VPS: `API_DOMINIO=api.descartaai.com.br` e `SITE_ORIGEM=https://descartaai.com.br,https://descarta-ai.pages.dev`. Depois rode `docker compose up -d`.
5. No GitHub, troque `VITE_API_URL` para `https://api.descartaai.com.br/v1` e rode o workflow **Web**.
6. O app já aponta para `api.descartaai.com.br` em `mobile/eas.json`. Antes disso, troque o endereço para o do sslip.io se for gerar um APK.

### Chave do mapa no APK

O fundo do mapa do app vem do MapTiler e precisa da chave na hora do build. Cadastre-a uma vez no EAS (não fica no repositório):

```bash
cd mobile
npx eas-cli env:create --name EXPO_PUBLIC_MAPTILER_CHAVE --value SUA-CHAVE --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_MAPTILER_CHAVE --value SUA-CHAVE --environment production --visibility plaintext
```
