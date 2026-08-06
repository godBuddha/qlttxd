'use strict';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 giờ

/**
 * Dọn dẹp định kỳ bảng reset_token.
 *
 * Xóa các reset token đã used hoặc đã hết hạn hơn 1 giờ để tránh bảng
 * phình to theo thời gian (H-11). Timer được unref() để không giữ process
 * sống khi tắt server (tương tự TokenBlocklist).
 */
class ResetTokenCleanup {
  /**
   * @param {object} opts
   * @param {import('pg').Pool} opts.pool - PostgreSQL connection pool
   * @param {number} [opts.intervalMs] - chu kỳ dọn dẹp (mặc định 1 giờ)
   */
  constructor({ pool, intervalMs = CLEANUP_INTERVAL_MS } = {}) {
    this._pool = pool;
    this._timer = setInterval(() => this._cleanup(), intervalMs);
    this._timer.unref(); // không giữ process sống khi tắt server
  }

  /**
   * Xóa reset token đã used hoặc expired hơn 1 giờ.
   * @returns {Promise<void>}
   */
  async _cleanup() {
    if (!this._pool) return;
    try {
      await this._pool.query(
        "DELETE FROM reset_token WHERE used = true OR expires_at < now() - interval '1 hour'"
      );
    } catch {
      // swallow cleanup errors để interval không tạo unhandled rejection
    }
  }

  /** Hủy timer (khi test hoặc shutdown) */
  destroy() {
    clearInterval(this._timer);
  }
}

module.exports = { ResetTokenCleanup };
