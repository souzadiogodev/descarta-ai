#!/usr/bin/env sh
# Atualiza a API no servidor com o código mais recente da main. Rodado pelo GitHub Actions ou à mão.
set -eu
cd "$(dirname "$0")"
git fetch --quiet origin main
git checkout --quiet main
git pull --quiet --ff-only origin main
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

dominio=$(grep '^API_DOMINIO=' .env | cut -d= -f2)
i=0
while [ "$i" -lt 30 ]; do
  if curl -fsS "https://$dominio/health" >/dev/null 2>&1; then
    echo "API no ar: https://$dominio"
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done
echo "A API não respondeu em /health. Veja: docker compose logs api" >&2
exit 1
