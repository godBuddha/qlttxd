'use strict';

const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 phút

class TokenBlocklist {
  /**
   * @param {number} ttlMs - thời gian sống của JTI trong blocklist (mặc định 8h)
   */
  constructor(ttlMs = 8 * 60 * 60 * 1000) {
    this._map = new Map();
    this._ttl = ttlMs;
    this._timer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
    this._timer.unref(); // không giữ process sống khi tắt server
  }

  /**
   * Thêm JTI vào blocklist (revoke token)
   * @param {string} jti
   */
  add(jti) {
    if (!jti) return;
    this._map.set(jti, Date.now() + this._ttl);
  }

  /**
   * Kiểm tra JTI có nằm trong blocklist không
   * @param {string} jti
   * @returns {boolean}
   */
  has(jti) {
    if (!jti) return false;
    const expiry = this._map.get(jti);
    if (expiry === undefined) return false;
    if (Date.now() > expiry) {
      this._map.delete(jti);
      return false;
    }
    return true;
  }

  /** Số lượng JTI đang bị block */
  get size() {
    return this._map.size;
  }

  /** Dọn hết JTI hết hạn */
  _cleanup() {
    const now = Date.now();
    for (const [jti, expiry] of this._map) {
      if (now > expiry) this._map.delete(jti);
    }
  }

  /** Hủy timer (khi test hoặc shutdown) */
  destroy() {
    clearInterval(this._timer);
    this._map.clear();
  }
}

module.exports = { TokenBlocklist };
