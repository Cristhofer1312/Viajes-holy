#!/usr/bin/env bash
# scripts/backup.sh — respaldo de la BD y las fotos de Viajes Holy.
#
# Uso (desde la raíz del repo, en el VPS):
#   ./scripts/backup.sh [carpeta_destino]      # por defecto /var/backups/viajes-holy
#
# Programarlo diario (crontab -e):
#   30 3 * * * cd /var/www/Proyectos/Viajes-holy && ./scripts/backup.sh >> /var/log/viajes-holy-backup.log 2>&1
#
# Restaurar:
#   gunzip -c holy-db-FECHA.sql.gz | docker compose exec -T db psql -U holy -d holy
#   docker run --rm -v holy-uploads:/u -v "$PWD":/b alpine tar xzf /b/holy-uploads-FECHA.tar.gz -C /u
set -euo pipefail

DESTINO="${1:-/var/backups/viajes-holy}"
DIAS_RETENCION="${DIAS_RETENCION:-14}"
FECHA="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DESTINO"

echo "[$(date -Is)] Respaldando en $DESTINO"

docker compose exec -T db pg_dump -U holy -d holy --clean --if-exists \
  | gzip > "$DESTINO/holy-db-$FECHA.sql.gz"

docker run --rm -v holy-uploads:/u:ro -v "$DESTINO":/b alpine \
  tar czf "/b/holy-uploads-$FECHA.tar.gz" -C /u .

find "$DESTINO" -name 'holy-*' -mtime +"$DIAS_RETENCION" -delete

ls -lh "$DESTINO" | tail -n 4
echo "[$(date -Is)] OK"
