#!/bin/sh
# Roda dentro do contêiner "backup": um dump por dia em ./backups, mantendo os 7 mais recentes.
# Restaurar: docker compose exec -T db pg_restore -U descartaai -d descartaai --clean < backups/ARQUIVO.dump
while true; do
  arquivo="/backups/descartaai-$(date +%F).dump"
  if pg_dump -h db -U descartaai -d descartaai -Fc -f "$arquivo"; then
    echo "backup ok: $arquivo"
  else
    echo "backup FALHOU em $(date)" >&2
  fi
  ls -1t /backups/descartaai-*.dump 2>/dev/null | tail -n +8 | while read -r antigo; do rm -f -- "$antigo"; done
  sleep 86400
done
