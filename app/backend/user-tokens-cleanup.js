'use strict';

/** Default values — used when configService is unavailable */
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 giờ
const DEFAULT_MAX_AGE_DAYS = 30;              // giữ token 30 ngày

/**
 * Dọn dẹp định kỳ bảng user_tokens.
 *
 * Xóa các token cũ hơn 30 ngày để tránh bảng phình to theo thời gian.
 * Timer được unref() để không giữ process sống khi tắt server (tương tự
 * ResetTokenCleanup / TokenBlocklist).
 */
class UserTokensCleanup {
  /**
   * @param {object} opts
   * @param {import('pg').Pool} opts.pool                - PostgreSQL connection pool
   * @param {import('../lib/config-service').ConfigService} [opts.configService] - optional config reader
   * @param {number} [opts.intervalMs]                     - chu kỳ dọn dẹp (mặc định 1 giờ)
   * @param {number} [opts.maxAgeDays]                      - số ngày giữ lại token (mặc định 30)
   */
  constructor({ pool, configService, intervalMs, maxAgeDays } = {}) {
    this._pool = pool;
    // Resolve maxAgeDays: explicit param → configService → fallback
    if (maxAgeDays === undefined || maxAgeDays === null) {
      if (configService && typeof configService.getSync === 'function') {
        maxAgeDays = configService.getSync('cleanup', 'user_tokens_max_age_days', DEFAULT_MAX_AGE_DAYS);
      } else {
        maxAgeDays = DEFAULT_MAX_AGE_DAYS;
      }
    }
    this._maxAgeDays = maxAgeDays;
    // Resolve interval: explicit param → configService → fallback
    if (intervalMs === undefined || intervalMs === null) {
      if (configService && typeof configService.getSync === 'function') {
        intervalMs = configService.getSync('cleanup', 'user_tokens_interval_ms', DEFAULT_INTERVAL_MS);
      } else {
        intervalMs = DEFAULT_INTERVAL_MS;
      }
    }
    this._timer = setInterval(() => this._cleanup(), intervalMs);
    this._timer.unref(); // không giữ process sống khi tắt server
  }

  /**
   * Xóa user_tokens cũ hơn maxAgeDays.
   * @returns {Promise<void>}
   */
  async _cleanup() {
    if (!this._pool) return;
    try {
      await this._pool.query(
        "DELETE FROM user_tokens WHERE created_at < now() - ($1::int * interval '1 day')",
        [this._maxAgeDays]
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

module.exports = { UserTokensCleanup };
