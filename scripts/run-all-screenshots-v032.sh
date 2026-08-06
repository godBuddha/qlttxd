#!/bin/bash
# Rà soát & chụp toàn bộ màn hình QLTTXD v0.3.2 — bản đầy đủ
set -e
export TOOLCHAIN=/workspace/ssd/toolchain
export PATH="$TOOLCHAIN/node/bin:$TOOLCHAIN/postgres/bin:$PATH"
export LD_LIBRARY_PATH="$TOOLCHAIN/postgres/lib"

# Kill leftovers
for p in /proc/[0-9]*; do
  if grep -q "node" $p/cmdline 2>/dev/null; then kill -9 ${p##*/} 2>/dev/null || true; fi
done
sleep 2

# Start backend (rate limit off for demo)
cd /workspace/ssd/qlttxd/app/backend
nohup env NODE_ENV=test PGHOST=/tmp PGPORT=5432 PGDATABASE=qlttxd PGUSER=postgres \
  JWT_SECRET=qlttxd-secret-key-2026-min32chars UPLOAD_DIR=/workspace/ssd/qlttxd/uploads \
  CORS_ORIGIN=http://localhost:5173 RATE_LIMIT_DISABLED=true QLTTXD_DEBUG_TOKENS=true \
  "$TOOLCHAIN/node/bin/node" server.js > /workspace/ssd/backend.log 2>&1 &
sleep 4

# Start frontend
cd /workspace/ssd/qlttxd/app/frontend
nohup env VITE_API_BASE_URL=http://localhost:3000 "$TOOLCHAIN/node/bin/node" node_modules/.bin/vite \
  --port 5173 --strictPort > /workspace/ssd/frontend.log 2>&1 &
sleep 6

# Playwright env for chromium libs
. /workspace/ssd/toolchain/scripts/playwright-env.sh
export LD_LIBRARY_PATH="/workspace/ssd/toolchain/libs:$LD_LIBRARY_PATH"

# Full screenshots
cd /workspace/ssd
"$TOOLCHAIN/node/bin/node" qlttxd/scripts/take-screenshots-v032.mjs 2>&1

echo "ALL DONE"
