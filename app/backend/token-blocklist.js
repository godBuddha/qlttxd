'use strict';

/** Default values — used when configService is unavailable */
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 phút
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;  // 8 giờ

class TokenBlocklist {
  /**
   * @param {object} opts
   * @param {import('pg').Pool} opts.pool          - PostgreSQL connection pool
   * @param {import('../lib/config-service').ConfigService} [opts.configService] - optional config reader
   * @param {number} [opts.ttlMs]                    - thời gian sống của JTI trong blocklist (mặc định 8h)
   * @param {number} [opts.intervalMs]                - chu kỳ dọn dẹp (mặc định 30 phút)
   */
  constructor({ pool, configService, ttlMs, intervalMs } = {}) {
    this._pool = pool;
    // Resolve TTL: explicit param → configService → fallback
    if (ttlMs === undefined || ttlMs === null) {
      if (configService && typeof configService.getSync === 'function') {
        ttlMs = configService.getSync('cleanup', 'token_blocklist_ttl_ms', DEFAULT_TTL_MS);
      } else {
        ttlMs = DEFAULT_TTL_MS;
      }
    }
    this._ttl = ttlMs;
    // Resolve interval: explicit param → configService → fallback
    if (intervalMs === undefined || intervalMs === null) {
      if (configService && typeof configService.getSync === 'function') {
        intervalMs = configService.getSync('cleanup', 'token_blocklist_interval_ms', DEFAULT_INTERVAL_MS);
      } else {
        intervalMs = DEFAULT_INTERVAL_MS;
      }
    }
    this._timer = setInterval(() => this._cleanup(), intervalMs);
    this._timer.unref(); // không giữ process sống khi tắt server
  }

  /**
   * Thêm JTI vào blocklist (revoke token)
   * @param {string} jti
   * @returns {Promise<void>}
   */
  async add(jti) {
    if (!jti) return;
    const expiresAt = new Date(Date.now() + this._ttl);
    await this._pool.query(
      'INSERT INTO token_blocklist (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO UPDATE SET expires_at = $2',
      [jti, expiresAt]
    );
  }

  /**
   * Kiểm tra JTI có nằm trong blocklist không
   * @param {string} jti
   * @returns {Promise<boolean>}
   */
  async has(jti) {
    if (!jti) return false;
    const { rows } = await this._pool.query(
      'SELECT 1 FROM token_blocklist WHERE jti = $1 AND expires_at > now()',
      [jti]
    );
    return rows.length > 0;
  }

  /** Dọn hết JTI hết hạn */
  async _cleanup() {
    try {
      await this._pool.query('DELETE FROM token_blocklist WHERE expires_at < now()');
    } catch {
      // swallow cleanup errors to avoid unhandled rejection in interval
    }
  }

  /** Hủy timer (khi test hoặc shutdown) */
  destroy() {
    clearInterval(this._timer);
  }
}

module.exports = { TokenBlocklist };
