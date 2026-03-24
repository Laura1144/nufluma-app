#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Nufluma — Build local + Deploy para VPS (app.nufluma.com)
# Uso:
#   ./deploy.sh          → build + upload + restart no VPS
#   ./deploy.sh --setup  → configura o VPS do zero (primeira vez)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configurações ─────────────────────────────────────────────────────────────
VPS_HOST="31.97.26.11"
VPS_USER="root"
VPS_PATH="/var/www/nufluma"
APP_NAME="nufluma"

# Senha via variável de ambiente (nunca hardcoded)
# Uso: VPS_PASS="senha" bash deploy.sh
VPS_PASS="${VPS_PASS:-}"

if [[ -z "$VPS_PASS" ]]; then
  echo -n "Senha SSH do VPS: "
  read -rs VPS_PASS
  echo
fi

SSH="sshpass -p $VPS_PASS ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST"
RSYNC="sshpass -p $VPS_PASS rsync -avz --progress -e \"ssh -o StrictHostKeyChecking=no\""

# ── Cores ─────────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

info()    { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()    { echo -e "${YELLOW}[aviso]${NC}  $1"; }
error()   { echo -e "${RED}[erro]${NC}   $1"; exit 1; }
step()    { echo -e "\n${GREEN}══ $1 ══${NC}"; }

# ─────────────────────────────────────────────────────────────────────────────
# SETUP — Configura o VPS do zero (rode apenas na primeira vez)
# ─────────────────────────────────────────────────────────────────────────────
setup_vps() {
  step "Configurando VPS do zero"
  warn "Isso instala Node.js 20, Docker, PM2, Nginx e Certbot no VPS."
  read -rp "Continuar? (s/N) " confirm
  [[ "$confirm" =~ ^[Ss]$ ]] || { info "Cancelado."; exit 0; }

  $SSH bash <<'REMOTE'
set -euo pipefail

echo "── Atualizando pacotes ──"
apt-get update -y && apt-get upgrade -y

echo "── Instalando Node.js 20 ──"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "── Instalando Docker ──"
apt-get install -y docker.io docker-compose
systemctl enable docker
systemctl start docker

echo "── Instalando PM2 ──"
npm install -g pm2

echo "── Instalando Nginx + Certbot ──"
apt-get install -y nginx certbot python3-certbot-nginx

echo "── Criando pasta do app ──"
mkdir -p /var/www/nufluma

echo "── Configurando Nginx ──"
cat > /etc/nginx/sites-available/nufluma <<'NGINX'
server {
    listen 80;
    server_name app.nufluma.com;

    location / {
        proxy_pass         http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/nufluma /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "✅ VPS configurado! Próximos passos manuais:"
echo "   1. Faça upload do .env de produção para /var/www/nufluma/.env"
echo "   2. Execute: ./deploy.sh"
echo "   3. Após o deploy: certbot --nginx -d app.nufluma.com"
REMOTE

  info "Setup concluído!"
}

# ─────────────────────────────────────────────────────────────────────────────
# DEPLOY — Build local + Upload + Restart
# ─────────────────────────────────────────────────────────────────────────────
deploy() {
  # ── 1. Verifica pré-requisitos locais ──────────────────────────────────────
  step "Verificando pré-requisitos"
  command -v node  >/dev/null || error "Node.js não encontrado"
  command -v npm   >/dev/null || error "npm não encontrado"
  command -v rsync >/dev/null || error "rsync não encontrado"
  command -v ssh   >/dev/null || error "ssh não encontrado"
  [[ -f ".env" ]]             || error ".env não encontrado na raiz do projeto"
  info "OK"

  # ── 2. Build ───────────────────────────────────────────────────────────────
  step "Build do Next.js"
  npm run build
  info "Build concluído"

  # ── 3. Monta estrutura standalone ─────────────────────────────────────────
  step "Montando pacote de deploy"
  DEPLOY_DIR=".deploy"
  rm -rf "$DEPLOY_DIR"
  mkdir -p "$DEPLOY_DIR"

  # Copia standalone (server.js + node_modules pré-bundled)
  cp -r .next/standalone/. "$DEPLOY_DIR/"

  # Static assets e public (obrigatório para o standalone funcionar)
  mkdir -p "$DEPLOY_DIR/.next/static"
  cp -r .next/static/. "$DEPLOY_DIR/.next/static/"
  cp -r public/. "$DEPLOY_DIR/public/"

  # Prisma schema para migrations no servidor
  mkdir -p "$DEPLOY_DIR/prisma"
  cp prisma/schema.prisma "$DEPLOY_DIR/prisma/"

  # docker-compose para subir Postgres + Redis no VPS
  cp docker-compose.yml "$DEPLOY_DIR/"

  info "Pacote montado em .deploy/"

  # ── 4. Upload para o VPS ───────────────────────────────────────────────────
  step "Enviando arquivos para o VPS"
  eval "$RSYNC \
    --exclude '.env' \
    --delete \
    $DEPLOY_DIR/ \
    $VPS_USER@$VPS_HOST:$VPS_PATH/"
  info "Upload concluído"

  # ── 5. Comandos remotos ────────────────────────────────────────────────────
  step "Configurando e reiniciando no VPS"
  $SSH bash <<REMOTE
set -euo pipefail
cd $VPS_PATH

echo "── Subindo banco e Redis ──"
docker compose up postgres redis -d

echo "── Aguardando banco ficar pronto ──"
sleep 5

echo "── Aplicando schema do Prisma ──"
npx prisma db push --schema=prisma/schema.prisma

echo "── Reiniciando app com PM2 ──"
if pm2 list | grep -q "$APP_NAME"; then
  pm2 restart $APP_NAME
else
  pm2 start server.js --name $APP_NAME
  pm2 save
  pm2 startup systemd -u $VPS_USER --hp /root | tail -1 | bash || true
fi

echo "── Status do PM2 ──"
pm2 show $APP_NAME
REMOTE

  # ── 6. Limpeza local ───────────────────────────────────────────────────────
  step "Limpeza"
  rm -rf "$DEPLOY_DIR"
  info "Pasta .deploy removida"

  # ── 7. Resumo ──────────────────────────────────────────────────────────────
  echo ""
  echo -e "${GREEN}✅ Deploy concluído!${NC}"
  echo -e "   App rodando em: https://app.nufluma.com"
  echo -e "   PM2 logs:       ssh $VPS_USER@$VPS_HOST 'pm2 logs $APP_NAME'"
}

# ─────────────────────────────────────────────────────────────────────────────
# Entrada
# ─────────────────────────────────────────────────────────────────────────────
case "${1:-}" in
  --setup) setup_vps ;;
  *)       deploy    ;;
esac
