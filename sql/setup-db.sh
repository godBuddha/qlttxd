#!/usr/bin/env bash
# ============================================================================
# QLTTXD — Tái lập cơ sở dữ liệu từ đầu (schema + seed) trên PostgreSQL toolchain
# ----------------------------------------------------------------------------
# Cách dùng:
#   source toolchain/scripts/env.sh        # nạp biến môi trường PG toolchain
#   bash qlttxd/sql/setup-db.sh [ten_db]   # mặc định: qlttxd
#
# Yêu cầu: PostGIS đã cài trong toolchain (xem docs/06-postgis-toolchain.md)
# ============================================================================
set -euo pipefail

DB_NAME="${1:-qlttxd}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL=(psql -h "${PGHOST:-/tmp}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d postgres)

# A reset drops the named database. Refuse the conventional production name unless
# an operator explicitly opts in; never use this reset helper against production.
if [[ "${DB_NAME}" == "qlttxd_prod" && "${QLTTXD_ALLOW_DESTRUCTIVE_RESET:-}" != "yes" ]]; then
  echo "LỖI: từ chối reset database production qlttxd_prod. Chỉ dùng migration có backup; nếu thực sự cần, đặt QLTTXD_ALLOW_DESTRUCTIVE_RESET=yes." >&2
  exit 2
fi
if [[ ! "${DB_NAME}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "LỖI: tên database không hợp lệ: ${DB_NAME}" >&2
  exit 2
fi

echo "CẢNH BÁO: lệnh này sẽ XÓA TOÀN BỘ dữ liệu trong database '${DB_NAME}'."

echo "==> [1/4] Kiểm tra PostGIS trong PostgreSQL"
if ! "${PSQL[@]}" -tAc "SELECT 1 FROM pg_available_extensions WHERE name='postgis';" | grep -q 1; then
  echo "LỖI: extension postgis chưa khả dụng. Cài PostGIS vào toolchain trước (xem docs/06-postgis-toolchain.md)." >&2
  exit 1
fi

echo "==> [2/4] Tạo lại database '${DB_NAME}'"
"${PSQL[@]}" -c "DROP DATABASE IF EXISTS ${DB_NAME};"
"${PSQL[@]}" -c "CREATE DATABASE ${DB_NAME};"

echo "==> [3/4] Chạy migration runner (scripts/migrate.js) — baseline + indexes"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  NODE_BIN="${NODE_HOME:-/home/cptr/ssd/toolchain/node}/bin/node"
fi
export PGDATABASE="${DB_NAME}"
"${NODE_BIN}" "${REPO_ROOT}/scripts/migrate.js"

echo "==> [4/4] Chạy seed.sql (đơn vị hành chính + người dùng demo + RBAC)"
psql -h "${PGHOST:-/tmp}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "${DB_NAME}" \
  -v ON_ERROR_STOP=1 -f "${SCRIPT_DIR}/seed.sql"

echo
echo "==> HOÀN TẤT. Database '${DB_NAME}' sẵn sàng."
echo "    Chưa có tài khoản nào. Truy cập hệ thống để đăng ký quản trị viên đầu tiên."
