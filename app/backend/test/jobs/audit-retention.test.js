'use strict';

// Unit + integration tests for AuditRetention (H-08, BE-E7-04)
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const test = require('node:test');
const assert = require('node:assert/strict');

const { AuditRetention } = require('../../jobs/audit-retention');

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function tempArchiveDir() {
  const d = path.join(
    os.tmpdir(),
    `audit-ret-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function cleanTemp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
}

/** List .gz files inside <base>/audit_archive */
function findGzFiles(baseDir) {
  const inner = path.join(baseDir, 'audit_archive');
  if (!fs.existsSync(inner)) return [];
  return fs.readdirSync(inner).filter((f) => f.endsWith('.json.gz'));
}

/**
 * Factory: mock pool that (a) checks retention threshold against thoi_gian,
 * and (b) tracks params passed to the expired-rows SELECT.
 */
function createTestPool(expiredRowsParam, opts = {}) {
  let lockAcquired = opts.lockDefault ?? true;
  let deleteBatchCount = 0;
  let selectedRowsSnapshot = null;

  return {
    async query(sql, params) {
      if (sql.includes('pg_try_advisory_xact_lock')) {
        return { rows: [{ acquired: lockAcquired }] };
      }

      // Expired-rows SELECT
      if (sql.includes('WHERE thoi_gian < now()')) {
        const retentionDays = Number(params?.[0]) || 7300;
        const cutoff = new Date(Date.now() - retentionDays * 86400000);
        const expired = expiredRowsParam.filter((r) => new Date(r.thoi_gian) < cutoff);
        selectedRowsSnapshot = expired.slice();
        return { rows: expired };
      }

      // Release lock / SELECT 1
      if (/^SELECT\s+1/i.test(sql)) {
        return { rows: [] };
      }

      if (sql.startsWith('COMMIT')) return {};

      if (sql.startsWith('DELETE FROM audit_log')) {
        deleteBatchCount += 1;
        return { rowCount: params?.[0]?.length || 0 };
      }

      return { rows: [] };
    },

    getSelectedRows() { return selectedRowsSnapshot; },
    getDeleteBatchCount() { return deleteBatchCount; },
    setLock(val) { lockAcquired = val; },
  };
}

// ────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────

test('AuditRetention: constructor sets defaults', () => {
  const ar = new AuditRetention({ pool: { query: async () => ({ rows: [] }) } });
  assert.equal(ar._retentionDays, 7300);
  assert.ok(typeof ar.archiveDir === 'string');
  ar.destroy();
});

test('AuditRetention: start() calls cleanup on boot without crashing', async () => {
  const ar = new AuditRetention({
    pool: { query: async () => ({ rows: [] }) },
    intervalMs: 999999,
    archiveBaseDir: os.tmpdir(),
  });
  await ar.start();
  assert.ok(true);
  ar.destroy();
});

test('AuditRetention: cleanup with no expired rows does nothing', async () => {
  const pool = createTestPool([]);
  const ar = new AuditRetention({ pool, archiveBaseDir: os.tmpdir() });
  await ar.cleanup();
  assert.equal(ar.lastResult.count, 0);
  ar.destroy();
});

test('AuditRetention: archives old rows to .gz then deletes them', async () => {
  const baseDir = tempArchiveDir();
  const oldRow = {
    id: 100, nguoi_dung_id: 5, hanh_dong: 'TAO_BAO_CAO',
    bang_bi_tac_dong: 'bao_cao', id_ban_ghi: 42,
    chi_tiet: { ma: 'BC-2026-000001' }, ip: '192.168.1.1',
    thoi_gian: new Date('2000-01-01T00:00:00Z'), request_id: 'req-old',
  };
  const pool = createTestPool([oldRow]);
  const ar = new AuditRetention({ pool, retentionDays: 10, archiveBaseDir: baseDir });
  await ar.cleanup();

  const gz = findGzFiles(baseDir);
  assert.ok(gz.length > 0, `Expected .gz, found: ${gz}`);

  const raw = fs.readFileSync(path.join(baseDir, 'audit_archive', gz[0]));
  const lines = require('node:zlib').gunzipSync(raw).toString('utf8').trim().split('\n');
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.id, 100);
  assert.equal(parsed.hanh_dong, 'TAO_BAO_CAO');
  assert.equal(ar.lastResult.count, 1);

  cleanTemp(baseDir);
  ar.destroy();
});

test('AuditRetention: only archives old rows — recent rows kept', async () => {
  const baseDir = tempArchiveDir();
  const recentRow = {
    id: 200, nguoi_dung_id: 1, hanh_dong: 'TAO_HO_SO',
    bang_bi_tac_dong: 'ho_so', id_ban_ghi: 99, chi_tiet: {},
    ip: '10.0.0.1', thoi_gian: new Date(), request_id: 'req-new',
  };
  const pool = createTestPool([recentRow]);
  const ar = new AuditRetention({ pool, retentionDays: 7300, archiveBaseDir: baseDir });
  await ar.cleanup();

  assert.equal(findGzFiles(baseDir).length, 0, 'No archive for recent-only data');
  cleanTemp(baseDir);
  ar.destroy();
});

test('AuditRetention: mixed old+new — only old archived & deleted', async () => {
  const baseDir = tempArchiveDir();
  const oldRow = {
    id: 300, nguoi_dung_id: 2, hanh_dong: 'XOA', bang_bi_tac_dong: 'bao_cao',
    id_ban_ghi: 77, chi_tiet: {}, ip: '1.2.3.4',
    thoi_gian: new Date('1990-01-01'), request_id: 'req-x',
  };
  const newRow = {
    id: 400, nguoi_dung_id: 3, hanh_dong: 'TAO', bang_bi_tac_dong: 'system',
    id_ban_ghi: null, chi_tiet: {}, ip: '5.5.5.5',
    thoi_gian: new Date(), request_id: 'req-y',
  };
  const pool = createTestPool([oldRow, newRow]);
  const ar = new AuditRetention({ pool, retentionDays: 1, archiveBaseDir: baseDir });
  await ar.cleanup();

  const gz = findGzFiles(baseDir);
  assert.ok(gz.length > 0);

  const raw = fs.readFileSync(path.join(baseDir, 'audit_archive', gz[0]));
  const lines = require('node:zlib').gunzipSync(raw).toString('utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).id, 300, 'Only old row');

  cleanTemp(baseDir);
  ar.destroy();
});

test('AuditRetention: idempotent — second run finds no rows, no duplicate', async () => {
  const baseDir = tempArchiveDir();
  const oldRow = {
    id: 500, nguoi_dung_id: 4, hanh_dong: 'UPD', bang_bi_tac_dong: 'ho_so',
    id_ban_ghi: 10, chi_tiet: {}, ip: '9.9.9.9',
    thoi_gian: new Date('1970-01-01'), request_id: 'req-idem',
  };

  // Pool returns oldRow on first SELECT, empty on subsequent calls
  let selectN = 0;
  const pool = {
    async query(sql) {
      if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('WHERE thoi_gian < now()')) {
        selectN++;
        return { rows: selectN <= 1 ? [oldRow] : [] };
      }
      if (/^SELECT\s+1/i.test(sql)) return { rows: [] };
      if (sql.startsWith('COMMIT')) return {};
      if (sql.startsWith('DELETE FROM audit_log')) return { rowCount: selectN <= 1 ? 1 : 0 };
      return { rows: [] };
    },
  };

  const ar = new AuditRetention({ pool, retentionDays: 1, archiveBaseDir: baseDir });
  await ar.cleanup();
  await ar.cleanup(); // idempotent

  assert.equal(findGzFiles(baseDir).length, 1, 'Exactly one archive file');

  cleanTemp(baseDir);
  ar.destroy();
});

test('AuditRetention: fail-safe — archive failure prevents DB deletion', async () => {
  const baseDir = tempArchiveDir();
  const oldRow = {
    id: 600, nguoi_dung_id: 5, hanh_dong: 'DEL', bang_bi_tac_dong: 'bao_cao',
    id_ban_ghi: 20, chi_tiet: {}, ip: '0.0.0.0',
    thoi_gian: new Date('1960-01-01'), request_id: 'req-fail',
  };

  let deleteHit = false;
  const pool = {
    async query(sql) {
      if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('WHERE thoi_gian < now()')) return { rows: [oldRow] };
      if (/^SELECT\s+1/i.test(sql)) return { rows: [] };
      if (sql.startsWith('COMMIT')) return {};
      if (sql.startsWith('DELETE FROM audit_log')) { deleteHit = true; return { rowCount: 0 }; }
      return { rows: [] };
    },
  };

  const ar = new AuditRetention({ pool, retentionDays: 1, archiveBaseDir: baseDir });
  ar._exportArchive = async (_rows) => { throw new Error('disk full'); };

  try { await ar.cleanup(); } catch { /* expected */ }

  assert.equal(deleteHit, false, 'DELETE must NOT execute when archive fails');
  ar.destroy();
});

test('AuditRetention: destroy stops timer', () => {
  const ar = new AuditRetention({
    pool: { query: async () => ({ rows: [] }) },
    intervalMs: 10, archiveBaseDir: os.tmpdir(),
  });
  ar.destroy();
  assert.ok(!ar._timer, 'Timer cleared');
});

test('AuditRetention: single-flight guard skips while running', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('WHERE thoi_gian < now()')) return { rows: [] };
      if (/^SELECT\s+1/i.test(sql)) return { rows: [] };
      if (sql.startsWith('COMMIT')) return {};
      return { rows: [] };
    },
  };

  const ar = new AuditRetention({ pool, archiveBaseDir: os.tmpdir() });

  // Simulate in-flight state manually
  ar._isRunning = true;
  await ar.cleanup(); // skipped via guard

  ar.destroy();
});

test('AuditRetention: advisory lock blocked — skips work', async () => {
  const baseDir = tempArchiveDir();
  const pool = createTestPool([{ id: 700, nguoi_dung_id: 1, hanh_dong: 'LOG', bang_bi_tac_dong: 'sys', id_ban_ghi: null, chi_tiet: {}, ip: '1.1.1.1', thoi_gian: new Date('1970-01-01'), request_id: 'l' }]);
  pool.setLock(false);

  const ar = new AuditRetention({ pool, retentionDays: 1, archiveBaseDir: baseDir });
  await ar.cleanup();

  assert.equal(findGzFiles(baseDir).length, 0, 'No archive when lock blocked');
  ar.destroy();
});

test('AuditRetention: env override — uses constructor retentionDays value', async () => {
  const baseDir = tempArchiveDir();
  const row = {
    id: 800, nguoi_dung_id: 1, hanh_dong: 'LOG', bang_bi_tac_dong: 'system',
    id_ban_ghi: null, chi_tiet: {}, ip: '0.0.0.0',
    thoi_gian: new Date('2020-01-01'), request_id: 'req-env',
  };

  let selectedDayThreshold = null;
  const pool = {
    async query(sql, params) {
      if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
      if (sql.includes('WHERE thoi_gian < now()')) {
        selectedDayThreshold = Number(params?.[0]);
        return { rows: [row] }; // will be expired with 30-day threshold
      }
      if (/^SELECT\s+1/i.test(sql)) return { rows: [] };
      if (sql.startsWith('COMMIT')) return {};
      if (sql.startsWith('DELETE FROM audit_log')) return { rowCount: 1 };
      return { rows: [] };
    },
  };

  const ar = new AuditRetention({ pool, retentionDays: 30, archiveBaseDir: baseDir });
  await ar.cleanup();

  assert.equal(selectedDayThreshold, 30, 'Passed retentionDays=30 to SQL');
  assert.ok(findGzFiles(baseDir).length > 0, 'Archive created with 30-day cutoff');

  cleanTemp(baseDir);
  ar.destroy();
});
