'use strict';

const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');
const { createWriteStream } = require('node:fs');
const { pipeline } = require('node:stream/promises');

/** Default values — used when configService is unavailable */
const DEFAULT_RETENTION_DAYS = 7300; // 20 năm = 365 * 20 ngày
const DEFAULT_BATCH_SIZE = 500;      // xóa theo batch để không khóa bảng lâu
const DEFAULT_ARCHIVE_DIR = 'audit_archive';
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 giờ

/**
 * AuditRetention — archive cũ audit_log ra file nén rồi xóa khỏi DB.
 *
 * Chạy tự động mỗi 24h và một lần lúc khởi động server.
 * Env: AUDIT_RETENTION_DAYS (mặc định 7300 = 20 năm).
 *
 * Nguyên tắc:
 *  - Atomic: chỉ xóa sau khi archive ghi xog thành công.
 *  - An toàn lỗi: nếu ghi file fail → KHÔNG xóa DB, log lỗi.
 *  - Batch delete: chia nhỏ DELETE để tránh lock bảng dài.
 *  - Idempotent: chạy lại không tạo trùng / xóa nhầm.
 */
class AuditRetention {
  /**
   * @param {object} opts
   * @param {import('pg').Pool} opts.pool               PostgreSQL pool
   * @param {import('../../lib/config-service').ConfigService} [opts.configService] - optional config reader
   * @param {number}    [opts.retentionDays]              số ngày giữ lại (default 7300)
   * @param {number}    [opts.intervalMs]                 chu kỳ chạy (default 24h)
   * @param {string}    [opts.archiveBaseDir]             thư mục chứa uploads/default './'
   */
  constructor({ pool, configService, retentionDays, intervalMs, archiveBaseDir } = {}) {
    this._pool = pool;
    // Resolve retentionDays: explicit param → configService → fallback
    if (retentionDays === undefined || retentionDays === null) {
      if (configService && typeof configService.getSync === 'function') {
        retentionDays = Number(configService.getSync('audit', 'retention_days', DEFAULT_RETENTION_DAYS));
      } else {
        retentionDays = DEFAULT_RETENTION_DAYS;
      }
    }
    this._retentionDays = retentionDays;
    // Resolve archive dir name from config → fallback
    let archiveDirName = DEFAULT_ARCHIVE_DIR;
    if (configService && typeof configService.getSync === 'function') {
      const ad = configService.getSync('audit', 'archive_dir', DEFAULT_ARCHIVE_DIR);
      if (ad && typeof ad === 'string') archiveDirName = ad;
    }
    this._archiveBaseDir = archiveBaseDir ? path.resolve(archiveBaseDir) : '.';
    this._archiveDirName = archiveDirName;
    // Resolve interval: explicit param → configService → fallback
    if (intervalMs === undefined || intervalMs === null) {
      if (configService && typeof configService.getSync === 'function') {
        intervalMs = Number(configService.getSync('audit', 'interval_ms', DEFAULT_INTERVAL_MS));
      } else {
        intervalMs = DEFAULT_INTERVAL_MS;
      }
    }
    this._intervalMs = intervalMs;
    // Resolve batch size: explicit param → configService → fallback
    let batchSize = DEFAULT_BATCH_SIZE;
    const rawBatchSize = Number(process.env.AUDIT_BATCH_SIZE);
    if (!Number.isNaN(rawBatchSize)) {
      batchSize = rawBatchSize;
    } else if (configService && typeof configService.getSync === 'function') {
      const csVal = configService.getSync('audit', 'batch_size', DEFAULT_BATCH_SIZE);
      batchSize = Number(csVal) || DEFAULT_BATCH_SIZE;
    }
    this._batchSize = batchSize;

    this._timer = null;

    // Advisory-lock key duy nhất cho job này
    // value = hash của tên class + config => đảm bảo không 2 instance chạy song song
    const seed = JSON.stringify({ name: 'AuditRetention', days: retentionDays });
    this._lockKey = require('node:crypto')
      .createHash('md5')
      .update(seed)
      .digest('hex')
      .slice(0, 8);

    // đếm lần cleanup cuối thành công để ghi metadata file
    this._lastSuccessCount = 0;
    this._lastSuccessFile = '';

    // Guard chống gọi cleanup chồng lấp (single-flight)
    this._isRunning = false;
  }

  /** Khởi động: chạy cleanup ngay + hẹn giờ hàng ngày */
  async start() {
    // Chạy 1 lần khi khởi động
    try {
      await this.cleanup();
    } catch (err) {
      console.error('[AuditRetention] Lỗi lần chạy khởi động:', err.message);
      // Không crash server nếu cleanup bị lỗi
    }

    // Hẹn giờ hàng ngày
    this._timer = setInterval(() => {
      this.cleanup().catch((err) => {
        console.error('[AuditRetention] Lỗi cleanup định kỳ:', err.message);
      });
    }, this._intervalMs);
    this._timer.unref(); // không giữ process sống khi tắt server
  }

  /** Dừng timer (dùng khi test hoặc graceful shutdown) */
  destroy() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._isRunning = false;
  }

  /** Hàm chính: query bản ghi cũ → archive → purge */
  async cleanup() {
    if (!this._pool) return;

    // Single-flight guard: bỏ qua nếu đang chạy (timer fire trong lúc boot chưa xong)
    if (this._isRunning) {
      console.log('[AuditRetention] Cleanup đang chạy, bỏ qua.');
      return;
    }

    // Bước 0: lấy advisory lock để tránh 2 instance chạy song song (trong cùng process)
    const locked = await this._acquireLock();
    if (!locked) {
      console.log('[AuditRetention] Instance khác đang chạy, bỏ qua.');
      return;
    }

    this._isRunning = true;
    try {
      // Bước 1: query các bản ghi quá hạn
      const oldRows = await this._queryExpiredRows();
      if (oldRows.length === 0) {
        console.log('[AuditRetention] Không có bản ghi nào cần dọn.');
        return;
      }

      // Bước 2: archive ra file gzip
      const archiveFile = await this._exportArchive(oldRows);
      console.log(
        `[AuditRetention] Đã archive ${oldRows.length} bản ghi → ${archiveFile}`
      );

      // Bước 3: xóa theo batch sau khi archive thành công
      const ids = oldRows.map((r) => r.id);
      let totalDeleted = 0;
      for (let i = 0; i < ids.length; i += this._batchSize) {
        const chunk = ids.slice(i, i + this._batchSize);
        const res = await this._pool.query(
          'DELETE FROM audit_log WHERE id = ANY($1::bigint[])',
          [chunk]
        );
        totalDeleted += Number(res.rowCount || 0);
      }

      console.log(`[AuditRetention] Đã xóa ${totalDeleted} bản ghi.`);
      this._lastSuccessCount = totalDeleted;
      this._lastSuccessFile = archiveFile;
    } finally {
      this._isRunning = false;
      await this._releaseLock();
    }
  }

  /** Lấy advisory lock — trả true nếu đã lock được */
  async _acquireLock() {
    try {
      // pg_try_advisory_xact_lock(int8) — trả về boolean, tự release khi txn kết thúc
      const res = await this._pool.query(
        `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired`,
        [`audit_retention_${this._lockKey}`]
      );
      return res.rows[0].acquired;
    } catch (err) {
      console.warn('[AuditRetention] Advisory lock failed:', err.message);
      // Fallback: vẫn tiếp tục nếu PG không hỗ trợ
      return true;
    }
  }

  /** Giải phóng advisory lock (txn implicit commit kết thúc ở đây) */
  async _releaseLock() {
    try {
      await this._pool.query('SELECT 1');
    } catch {
      /* ignore — connection close will handle it */
    }
  }

  /** Query audit_log cũ hơn retentionDays */
  async _queryExpiredRows() {
    const res = await this._pool.query(
      `SELECT id, nguoi_dung_id, hanh_dong, bang_bi_tac_dong, id_ban_ghi,
              chi_tiet, ip, thoi_gian, request_id
       FROM audit_log
       WHERE thoi_gian < now() - ($1::int * interval '1 day')
       ORDER BY thoi_gian ASC`,
      [this._retentionDays]
    );
    return res.rows;
  }

  /** Xuất hàng loạt bản ghi sang file gzip JSONL */
  async _exportArchive(rows) {
    const dateStr = new Date()
      .toISOString()
      .slice(0, 7); // YYYY-MM
    const ts = Date.now();
    const fileName = `audit-${dateStr}-${ts}.json.gz`;
    const dir = path.join(this._archiveBaseDir, this._archiveDirName);

    // Tạo thư mục nếu chưa tồn tại
    await this._ensureDir(dir);

    const filePath = path.join(dir, fileName);

    // Ghi file: stream từng dòng JSONL rồi nén gzip
    const outStream = createWriteStream(filePath);
    const gzip = zlib.createGzip();

    return new Promise((resolve, reject) => {
      outStream.on('error', (err) => reject(err));
      gzip.on('error', (err) => reject(err));

      // Pipe: write JSON lines → gzip → file
      // Sử dụng pipeline để đảm bảo cleanup đúng
      pipeline([
        this._jsonLinesGenerator(rows),
        gzip,
        outStream,
      ]).then(
        () => resolve(filePath),
        reject
      );
    });
  }

  /** Generator đọc các hàng và yield từng dòng JSONL */
  *_jsonLinesGenerator(rows) {
    for (const row of rows) {
      const line = JSON.stringify(row);
      yield line + '\n';
    }
  }

  /** Đảm bảo thư mục tồn tại */
  async _ensureDir(dir) {
    try {
      await fs.promises.access(dir);
    } catch {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  /** Getter expose thông tin debug (chủ yếu cho test) */
  get lastResult() {
    return {
      count: this._lastSuccessCount,
      file: this._lastSuccessFile,
    };
  }

  get archiveDir() {
    return path.join(this._archiveBaseDir, this._archiveDirName);
  }
}

module.exports = { AuditRetention, DEFAULT_RETENTION_DAYS };
