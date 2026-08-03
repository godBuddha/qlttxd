#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------
# QLTTXD — Backup script (PostgreSQL + uploads volume)
# Usage:  ./scripts/backup.sh
# Env:    BACKUP_DIR  (default: ./backups)
#         UPLOADS_VOLUME  (auto-detected from docker volume ls if unset)
# ---------------------------------------------------------------------------

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

# --- Auto-detect uploads volume name ---
# docker-compose.yml defines "uploads_data"; docker compose prefixes with
# the project name (directory name), so the real volume varies per install.
UPLOADS_VOLUME="${UPLOADS_VOLUME:-}"
if [[ -z "$UPLOADS_VOLUME" ]]; then
  UPLOADS_VOLUME="$(docker volume ls --format '{{.Name}}' 2>/dev/null \
    | grep 'uploads_data$' | head -1 || true)"
fi
if [[ -z "$UPLOADS_VOLUME" ]]; then
  echo "[backup] ERROR: Cannot detect uploads volume." >&2
  echo "  Set UPLOADS_VOLUME env var, e.g.:" >&2
  echo "    UPLOADS_VOLUME=app_uploads_data ./scripts/backup.sh" >&2
  exit 1
fi

echo "[backup] Starting backup — stamp=$STAMP"
echo "[backup] BACKUP_DIR=$BACKUP_DIR"
echo "[backup] UPLOADS_VOLUME=$UPLOADS_VOLUME"

# --- 1. PostgreSQL dump (custom format via container) ---
DUMP_FILE="$BACKUP_DIR/qlttxd-$STAMP.dump"
echo "[backup] Dumping PostgreSQL → $DUMP_FILE ..."
docker compose exec -T db pg_dump -U qlttxd -Fc qlttxd > "$DUMP_FILE"
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "[backup] PostgreSQL dump done ($DUMP_SIZE)"

# --- 2. Uploads volume backup ---
UPLOADS_FILE="$BACKUP_DIR/uploads-$STAMP.tar.gz"
echo "[backup] Backing up uploads volume ($UPLOADS_VOLUME) → $UPLOADS_FILE ..."
docker run --rm \
  -v "${UPLOADS_VOLUME}":/data \
  -v "$PWD/$BACKUP_DIR":/backup \
  alpine tar czf "/backup/uploads-$STAMP.tar.gz" -C /data .
UPLOADS_SIZE=$(du -h "$UPLOADS_FILE" | cut -f1)
echo "[backup] Uploads backup done ($UPLOADS_SIZE)"

# --- 3. Rotate: keep 14 newest backups ---
echo "[backup] Rotating old backups (keeping 14 newest) ..."
ls -1t "$BACKUP_DIR"/qlttxd-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f --
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f --

REMAINING_DUMPS=$(ls -1 "$BACKUP_DIR"/qlttxd-*.dump 2>/dev/null | wc -l)
REMAINING_UPLOADS=$(ls -1 "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | wc -l)
echo "[backup] Rotation done — $REMAINING_DUMPS dump(s), $REMAINING_UPLOADS uploads archive(s) retained"

echo "[backup] All done."
