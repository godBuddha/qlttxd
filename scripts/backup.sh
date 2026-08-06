#!/usr/bin/env bash
# ============================================================================
# QLTTXD — PostgreSQL backup script
# ----------------------------------------------------------------------------
# Creates a timestamped pg_dump of the target database, then optionally uploads
# it to S3 if the AWS/AWS_BUCKET(alias S3_BUCKET) env vars are set.
#
# Env vars (same toolchain defaults as setup-db.sh):
#   PGHOST    (default /tmp)      PGPORT (default 5432)
#   PGUSER    (default postgres)  PGPASSWORD (optional)
#   DB_NAME   name of db to dump  (default: qlttxd)
#   BACKUP_DIR directory for the dump (default: ./backups)
#   AWS_BUCKET | S3_BUCKET  optional S3 bucket for upload
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION  (for aws cli)
#
# Usage:
#   bash scripts/backup.sh                     # dump qlttxd
#   bash scripts/backup.sh mydb /tmp/backups    # dump mydb into /tmp/backups
# ============================================================================
set -euo pipefail

DB_NAME="${1:-${DB_NAME:-qlttxd}}"
BACKUP_DIR="${2:-${BACKUP_DIR:-./backups}}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUTFILE="${BACKUP_DIR}/qlttxd-${DB_NAME}-${STAMP}.dump"

PGHOST="${PGHOST:-/tmp}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"

# Locate pg_dump binary (toolchain-aware).
PG_DUMP="${PGBIN:-}/pg_dump"
if [[ -n "${PGBIN:-}" && -x "${PGBIN}/pg_dump" ]]; then
  PG_DUMP="${PGBIN}/pg_dump"
elif command -v pg_dump >/dev/null 2>&1; then
  PG_DUMP="$(command -v pg_dump)"
elif [[ -x /home/cptr/ssd/toolchain/postgres/usr/lib/postgresql/16/bin/pg_dump ]]; then
  PG_DUMP=/home/cptr/ssd/toolchain/postgres/usr/lib/postgresql/16/bin/pg_dump
fi

mkdir -p "${BACKUP_DIR}"

echo "==> Backing up database '${DB_NAME}' -> ${OUTFILE}"
PGPASSWORD="${PGPASSWORD:-}" "${PG_DUMP}" \
  -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" \
  -Fc -f "${OUTFILE}" "${DB_NAME}"

echo "==> Dump created: $(stat -c '%s bytes' "${OUTFILE}")"

# Optional S3 upload.
BUCKET="${AWS_BUCKET:-${S3_BUCKET:-}}"
if [[ -n "${BUCKET}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "WARNING: AWS_BUCKET set but 'aws' CLI not installed; skipping upload." >&2
  else
    echo "==> Uploading ${OUTFILE} to s3://${BUCKET}/"
    AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}" \
    AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}" \
    AWS_REGION="${AWS_REGION:-us-east-1}" \
      aws s3 cp "${OUTFILE}" "s3://${BUCKET}/$(basename "${OUTFILE}")"
  fi
else
  echo "==> No AWS_BUCKET/S3_BUCKET set; skipping S3 upload."
fi

echo "==> Backup complete: ${OUTFILE}"
