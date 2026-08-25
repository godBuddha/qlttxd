'use strict';

// M-14: dependency-aware health. Tách liveness (process sống) và readiness
// (dependency thật: DB + storage). KHÔNG lộ secrets / connection strings —
// chỉ trả trạng thái ok/error chung chung.

const fs = require('node:fs');
const path = require('node:path');
const { APP_VERSION } = require('../lib/version');

const startTime = Date.now();

function currentVersion() {
  return APP_VERSION;
}

function uptimeSeconds() {
  return Math.floor((Date.now() - startTime) / 1000);
}

// Liveness: process đang chạy, không phụ thuộc dependency nào. Luôn 200.
function liveness() {
  return {
    status: 'ok',
    uptime: uptimeSeconds(),
    version: currentVersion(),
  };
}

function resolveUploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || './uploads');
}

// Storage check: ghi → đọc → xoá file probe trong thư mục upload.
// Trả {ok, error?} — không lộ đường dẫn tuyệt đối.
async function storageCheck(dir = resolveUploadDir()) {
  const probe = path.join(dir, `.health-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.probe`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(probe, 'qlttxd-health-probe');
    const read = fs.readFileSync(probe, 'utf8');
    if (read !== 'qlttxd-health-probe') return { ok: false, error: 'read-mismatch' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'storage-unavailable' };
  } finally {
    try {
      fs.rmSync(probe, { force: true });
    } catch {
      /* ignore cleanup errors */
    }
  }
}

// Readiness: tất cả dependency phải ok. Cho phép override các check trong test.
async function readiness(pool, { dbOverrides, storageOverrides } = {}) {
  const checks = {};

  if (dbOverrides) {
    checks.db = dbOverrides;
  } else {
    try {
      await pool.query('SELECT 1 AS ok');
      checks.db = { ok: true };
    } catch {
      checks.db = { ok: false, error: 'database-unreachable' };
    }
  }

  checks.storage = storageOverrides || (await storageCheck());

  const ready = Object.values(checks).every((c) => c.ok === true);
  return { ready, checks };
}

module.exports = { liveness, readiness, storageCheck, resolveUploadDir };
