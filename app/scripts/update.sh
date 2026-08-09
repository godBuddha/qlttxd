#!/usr/bin/env bash
# =============================================================================
# QLTTXD — Auto-update script
# Usage: ./scripts/update.sh
# Pulls latest code from master, rebuilds containers, runs migrations.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== QLTTXD Update ==="
echo ""

# 1. Pull latest changes
echo "[1/4] Pulling latest changes..."
git pull origin master --ff-only || {
    echo "ERROR: git pull failed (merge conflict?). Resolve manually."
    exit 1
}

# 2. Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env not found. Copy from .env.example and configure."
    exit 1
fi

# 3. Rebuild and restart containers
echo "[2/4] Rebuilding containers..."
docker compose up --build -d

# 4. Wait for DB to be healthy
echo "[3/4] Waiting for database..."
for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U qlttxd -d qlttxd >/dev/null 2>&1; then
        echo "  Database ready."
        break
    fi
    if [ "$i" = "30" ]; then
        echo "ERROR: Database not ready after 30s."
        exit 1
    fi
    sleep 1
done

# 5. Run pending migrations (idempotent — safe to re-run)
echo "[4/4] Running migrations..."
for f in sql/migrations/*_*.up.sql; do
    [ -f "$f" ] || continue
    echo "  Applying $(basename "$f")..."
    docker compose exec -T db psql -U qlttxd -d qlttxd -f "/docker-entrypoint-initdb.d/$(basename "$f")" 2>/dev/null || true
done

# 6. Health check
echo ""
echo "Checking health..."
sleep 3
HEALTH=$(curl -sf http://localhost/health 2>/dev/null || echo '{"status":"error"}')
echo "  $HEALTH"

echo ""
echo "=== Update complete ==="
echo "Access: https://localhost"
