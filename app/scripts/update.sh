#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------
# QLTTXD — Update script (pull + rebuild + restart + health check)
# Usage:  ./scripts/update.sh
# ---------------------------------------------------------------------------

echo "=== QLTTXD Update ==="
echo ""

# --- Step 1: Backup before updating ---
echo "[update] Step 1/5 — Running backup ..."
if [[ -x ./scripts/backup.sh ]]; then
  ./scripts/backup.sh
else
  echo "[update] WARNING: ./scripts/backup.sh not found or not executable — skipping backup" >&2
fi
echo ""

# --- Step 2: Git pull ---
echo "[update] Step 2/5 — Pulling latest changes ..."
if git rev-parse --is-inside-work-tree &>/dev/null; then
  git pull --ff-only
else
  echo "[update] WARNING: Not a git repository." >&2
  echo "  If you installed via archive/download, update manually:" >&2
  echo "    1. Download the latest release" >&2
  echo "    2. Replace files (keep your .env and backups/)" >&2
  echo "    3. Run: docker compose build --no-cache && docker compose up -d" >&2
  echo "  Continuing with current code ..." >&2
fi
echo ""

# --- Step 3: Rebuild images ---
echo "[update] Step 3/5 — Rebuilding images (no cache) ..."
docker compose build --no-cache
echo ""

# --- Step 4: Restart containers (NEVER use down -v) ---
echo "[update] Step 4/5 — Restarting containers ..."
echo "  ⚠ NOT using 'down -v' — data volumes are preserved"
docker compose up -d
echo ""

# --- Step 5: Health check ---
echo "[update] Step 5/5 — Health check (http://localhost/health) ..."
HEALTH_URL="http://localhost/health"
MAX_ATTEMPTS=12
DELAY=5

for i in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "  Attempt $i/$MAX_ATTEMPTS ..."
  if curl -fsS "$HEALTH_URL" &>/dev/null; then
    echo ""
    echo "=== OK — QLTTXD is healthy ==="
    exit 0
  fi
  if [[ "$i" -lt "$MAX_ATTEMPTS" ]]; then
    sleep "$DELAY"
  fi
done

echo ""
echo "=== FAILED — Health check did not pass after $MAX_ATTEMPTS attempts ==="
echo ""
echo "Troubleshooting:"
echo "  1. Check container logs:   docker compose logs --tail=50"
echo "  2. Check container status: docker compose ps"
echo "  3. Check backend logs:     docker compose logs backend --tail=50"
echo "  4. Check database:         docker compose exec db pg_isready -U qlttxd"
echo ""
exit 1
