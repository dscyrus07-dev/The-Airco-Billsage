#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/root/airco-billsage}"
REPO_URL="${REPO_URL:-https://github.com/dscyrus07-dev/The-Airco-Billsage.git}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.utho.yml}"
PROJECT_NAME="${PROJECT_NAME:-airco-billsage}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/billsage.theairco.ai}"
NGINX_ENABLED="${NGINX_ENABLED:-/etc/nginx/sites-enabled/billsage.theairco.ai}"
NGINX_TEMPLATE_REL="deploy/utho/nginx/billsage.theairco.ai.conf"
SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/ssl/origin.pem}"
SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/ssl/origin-key.pem}"
BACKUP_DIR="${BACKUP_DIR:-/root/airco-billsage-backups}"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://billsage.theairco.ai}"
VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://lqliskmaiyemyramntyp.supabase.co}"
VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxbGlza21haXllbXlyYW1udHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzMyNzQsImV4cCI6MjA4ODk0OTI3NH0.TZYJMv4j5HoaLn1k9S8OP-oh6TvMtJz1v4A2n7Xr0RU}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_BIN="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE_BIN="docker-compose"
else
  echo "Docker Compose not found"
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"
mkdir -p backend/uploads/purchase_bills

if [ -f "$NGINX_SITE" ]; then
  cp "$NGINX_SITE" "$BACKUP_DIR/billsage.theairco.ai.$TIMESTAMP.conf"
fi

if [ ! -f "$SSL_CERT_PATH" ] || [ ! -f "$SSL_KEY_PATH" ]; then
  DETECTED_CERT_PATH="$(grep -R "ssl_certificate[[:space:]]" /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null | grep -v "ssl_certificate_key" | head -n 1 | awk '{print $2}' | sed 's/;$//')"
  DETECTED_KEY_PATH="$(grep -R "ssl_certificate_key[[:space:]]" /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null | head -n 1 | awk '{print $2}' | sed 's/;$//')"
  if [ -n "$DETECTED_CERT_PATH" ] && [ -n "$DETECTED_KEY_PATH" ]; then
    SSL_CERT_PATH="$DETECTED_CERT_PATH"
    SSL_KEY_PATH="$DETECTED_KEY_PATH"
  fi
fi

if [ ! -f "$SSL_CERT_PATH" ] || [ ! -f "$SSL_KEY_PATH" ]; then
  echo "SSL files not found"
  exit 1
fi

$COMPOSE_BIN -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down || true
DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}" docker build -t airco-billsage-backend:latest "$APP_DIR/backend"
DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-0}" docker build \
  --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  -t airco-billsage-frontend:latest \
  "$APP_DIR/frontend"

$COMPOSE_BIN -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --no-build

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8100/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl -fsS http://127.0.0.1:8100/health >/dev/null
curl -IfsS http://127.0.0.1:3100 >/dev/null

sed \
  -e "s|__SSL_CERT_PATH__|$SSL_CERT_PATH|g" \
  -e "s|__SSL_KEY_PATH__|$SSL_KEY_PATH|g" \
  "$APP_DIR/$NGINX_TEMPLATE_REL" > "$NGINX_SITE"

ln -sfn "$NGINX_SITE" "$NGINX_ENABLED"
nginx -t
systemctl reload nginx

curl -IfsS https://billsage.theairco.ai >/dev/null
curl -fsS https://billsage.theairco.ai/health >/dev/null

$COMPOSE_BIN -p "$PROJECT_NAME" -f "$COMPOSE_FILE" ps
