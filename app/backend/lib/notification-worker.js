'use strict';

const { createTransporter, sendEmail, isSmtpConfigured } = require('./email');

const BATCH_SIZE = 10;
const POLL_INTERVAL_MS = 30 * 1000; // 30 giây

/**
 * Notification Worker — polling thong_bao kenh='email', trang_thai='cho_gui'.
 */
class NotificationWorker {
  /**
   * @param {object} opts
   * @param {import('pg').Pool} opts.pool
   * @param {number} [opts.intervalMs]
   * @param {number} [opts.batchSize]
   */
  constructor({ pool, intervalMs = POLL_INTERVAL_MS, batchSize = BATCH_SIZE } = {}) {
    this._pool = pool;
    this._intervalMs = intervalMs;
    this._batchSize = batchSize;
    this._timer = null;
    this._transporter = null;
    this._running = false;
  }

  /** Khởi động worker (setInterval). */
  start() {
    if (!isSmtpConfigured()) {
      console.warn('[notification-worker] SMTP_HOST chưa cấu hình — worker không khởi động.');
      return;
    }
    this._transporter = createTransporter();
    if (!this._transporter) return;

    this._running = true;
    this._timer = setInterval(
      () =>
        this.processBatch().catch((err) => {
          console.error('[notification-worker] Lỗi xử lý batch:', err.message);
        }),
      this._intervalMs
    );
    this._timer.unref();
    console.log(
      `[notification-worker] Khởi động — poll mỗi ${this._intervalMs / 1000}s, batch ${this._batchSize}`
    );
  }

  /** Dừng worker. */
  stop() {
    this._running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * Xử lý 1 batch: lấy tối đa batchSize thông báo email đang chờ, gửi, cập nhật trạng thái.
   * @returns {Promise<{sent: number, failed: number}>}
   */
  async processBatch() {
    if (!this._transporter) return { sent: 0, failed: 0 };

    const { rows } = await this._pool.query(
      `SELECT tb.id, tb.tieu_de, tb.noi_dung, u.email, u.full_name
       FROM thong_bao tb
       JOIN users u ON u.id = tb.nguoi_nhan_id
       WHERE tb.kenh = 'email' AND tb.trang_thai = 'cho_gui' AND u.email IS NOT NULL
       ORDER BY tb.created_at
       LIMIT $1`,
      [this._batchSize]
    );

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        await sendEmail({
          transporter: this._transporter,
          to: row.email,
          subject: row.tieu_de,
          html: `<p>${row.noi_dung || row.tieu_de}</p>`,
        });
        await this._pool.query(
          "UPDATE thong_bao SET trang_thai='da_gui', ngay_gui=now() WHERE id=$1",
          [row.id]
        );
        sent++;
      } catch (err) {
        console.error(`[notification-worker] Gửi email thất bại (id=${row.id}):`, err.message);
        await this._pool
          .query("UPDATE thong_bao SET trang_thai='that_bai' WHERE id=$1", [row.id])
          .catch(() => {});
        failed++;
      }
    }

    return { sent, failed };
  }

  get isRunning() {
    return this._running;
  }
}

module.exports = { NotificationWorker, BATCH_SIZE, POLL_INTERVAL_MS };
