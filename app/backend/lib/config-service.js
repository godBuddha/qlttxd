'use strict';

const { Client } = require('pg');

/**
 * ConfigService – in-memory cache + DB fallback + LISTEN/NOTIFY replication.
 *
 * Public get() masks secrets ('***') when is_secret=true (except during internal set).
 */
class ConfigService {
  constructor() {
    this._cache = new Map();         // key → { row, ts }
    this._notifyClient = null;       // pg.Client for LISTEN channel
    this._stopped = false;
    this._listeners = [];            // callback(configId) on NOTIFY
    this._isInternal = false;        // flag to bypass masking during internal ops
    this._pool = null;
  }

  // ─────────────────── helpers ───────────────────

  _cacheKey(scope, scopeId, category, key) {
    const sid = scopeId ? String(scopeId) : 'null';
    return `${scope}:${sid}:${category}:${key}`;
  }

  /** Invalidate a single cached entry */
  _invalidate(ck) {
    this._cache.delete(ck);
  }

  /** Notify all registered listeners about a change */
  _emitNotify(configId) {
    for (const cb of this._listeners) {
      try { cb(configId); } catch (_) { /* ignore listener errors */ }
    }
  }

  // ─────────────────── core API ───────────────────

  /**
   * Get a config value.
   * Fallback chain: cache → DB → env var → fallback param
   * @param {string} category
   * @param {string} key
   * @param {*} [fallback]
   * @param {Object} [opts]
   * @param {string} [opts.scope='global']
   * @param {string|uuid} [opts.scopeId=null]
   * @returns {*|undefined}
   */
  async get(category, key, fallback, opts = {}) {
    const { scope = 'global', scopeId = null } = opts || {};
    const ck = this._cacheKey(scope, scopeId, category, key);

    // 1. Cache hit
    const cached = this._cache.get(ck);
    if (cached) {
      return this._maskIfSecret(cached.row, true);
    }

    // 2. DB query
    let row;
    if (this._pool) {
      const sql = `SELECT id, value, is_secret FROM system_config WHERE scope=$1 AND scope_id=CORE_CAST($2 AS UUID) AND category=$3 AND key=$4`;
      const r = await this._pool.query(sql, [scope, scopeId, category, key]);
      if (r.rows.length) row = r.rows[0];
    }

    // 3. Cache miss & DB miss → env var
    if (!row) {
      const envKey = `CONFIG_${scope.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${category.toUpperCase()}_${key.toUpperCase()}`;
      const envVal = process.env[envKey];
      if (envVal !== undefined) {
        try { return JSON.parse(envVal); } catch { return envVal; }
      }
      return fallback;
    }

    // Store in cache
    this._cache.set(ck, { row, ts: Date.now() });
    return this._maskIfSecret(row, true);
  }

  /**
   * Set (update) a config value.
   * Writes to DB → invalidates cache → INSERT config_history → NOTIFY → audit
   */
  async set(category, key, value, userId, req = {}, opts = {}) {
    const { scope = 'global', scopeId = null } = opts || {};
    if (!this._pool) throw new Error('ConfigService not started');

    const client = await this._pool.connect();
    try {
      await client.query('BEGIN');

      // Get current row
      const r = await client.query(
        `SELECT id, value FROM system_config WHERE scope=$1 AND scope_id=CORE_CAST($2 AS UUID) AND category=$3 AND key=$4`,
        [scope, scopeId, category, key]
      );
      if (!r.rows.length) {
        await client.query('ROLLBACK');
        throw new Error(`Config not found: ${category}/${key}`);
      }

      const oldRow = r.rows[0];
      const newValue = typeof value === 'string' ? JSON.parse(value) : value;
      const oldJsonb = JSON.stringify(oldRow.value);
      const newJsonb = JSON.stringify(newValue);

      // UPDATE
      await client.query(
        `UPDATE system_config SET value=$2, updated_at=now() WHERE id=$1`,
        [oldRow.id, newValue]
      );

      // Invalidate cache
      const ck = this._cacheKey(scope, scopeId, category, key);
      this._invalidate(ck);

      // INSERT config_history
      await client.query(
        `INSERT INTO config_history (config_id, nguoi_dung_id, old_value, new_value, action, ip, request_id) VALUES ($1,$2,$3,$4,'update',$5,$6)`,
        [oldRow.id, userId || null, oldJsonb, newJsonb, req.ip || null, req.requestId || null]
      );

      await client.query('COMMIT');

      // NOTIFY other instances
      await client.query(`NOTIFY config_changed, '${JSON.stringify({ category, key, scope, scopeId })}'`);

      // Audit (if we have req.user from middleware)
      if (req.user && userId) {
        try {
          const { audit: doAudit } = require('../utils/helpers');
          await doAudit(this._pool, req, 'config.update', 'system_config', oldRow.id, { category, key, scope });
        } catch (_) { /* non-critical */ }
      }

      this._emitNotify(oldRow.id);
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Get all config values for a category.
   * @returns {Array<{id, category, key, value, is_secret}>}
   */
  async getAll(category, opts = {}) {
    const { scope = 'global', scopeId = null } = opts || {};
    if (!this._pool) return [];

    // First check cache
    let rows;
    const prefix = `${scope}:${scopeId ? String(scopeId) : 'null'}:${category}:`;
    let cachedResults = [];
    for (const [ck, entry] of this._cache.entries()) {
      if (ck.startsWith(prefix)) cachedResults.push(entry);
    }

    if (cachedResults.length) {
      rows = cachedResults.map(e => e.row);
    } else {
      const r = await this._pool.query(
        `SELECT id, category, key, value, is_secret FROM system_config WHERE scope=$1 AND scope_id=CORE_CAST($2 AS UUID) AND category=$3 ORDER BY key`,
        [scope, scopeId, category]
      );
      rows = r.rows;
      // Fill cache
      for (const row of rows) {
        const ck = this._cacheKey(scope, scopeId, row.category, row.key);
        this._cache.set(ck, { row, ts: Date.now() });
      }
    }

    return rows.map(r => ({ ...r, value: this._maskIfSecret(r, true) }));
  }

  /** Get config by scope */
  async getByScope(scope, scopeId, category) {
    return this.getAll(category, { scope, scopeId });
  }

  /** Start the service: load cache from DB and subscribe to LISTEN/NOTIFY */
  async start(pool) {
    this._pool = pool;

    // Load all configs into cache
    const r = await pool.query(
      `SELECT scope, scope_id::text, category, key, value, is_secret FROM system_config ORDER BY category, key`
    );
    for (const row of r.rows) {
      const ck = this._cacheKey(row.scope, row.scope_id, row.category, row.key);
      this._cache.set(ck, { row, ts: Date.now() });
    }

    // Subscribe to LISTEN channel
    const notifyDsn = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, statement_timeout: 0 }
      : {
          host: process.env.PGHOST,
          port: Number(process.env.PGPORT) || 5432,
          database: process.env.PGDATABASE,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD || undefined,
          statement_timeout: 0,
        };
    this._notifyClient = new Client(notifyDsn);
    await this._notifyClient.connect();
    await this._notifyClient.query('LISTEN config_changed');

    this._notifyClient.on('notification', (msg) => {
      let data;
      try { data = JSON.parse(msg.payload); } catch { return; }
      if (data.category && data.key) {
        const ck = this._cacheKey(data.scope || 'global', data.scopeId || null, data.category, data.key);
        this._invalidate(ck);
      } else {
        // Wildcard reload — clear entire cache and re-query
        this._cache.clear();
        this.reloadFromDB();
      }
    });

    console.log('[ConfigService] Started — cache loaded, LISTEN active');
  }

  /** Force-reload cache from DB */
  async reloadFromDB() {
    if (!this._pool) return;
    const r = await this._pool.query(
      `SELECT scope, scope_id::text, category, key, value, is_secret FROM system_config ORDER BY category, key`
    );
    for (const row of r.rows) {
      const ck = this._cacheKey(row.scope, row.scope_id, row.category, row.key);
      this._cache.set(ck, { row, ts: Date.now() });
    }
  }

  /** Stop: close notify client */
  stop() {
    this._stopped = true;
    if (this._notifyClient) {
      this._notifyClient.end();
      this._notifyClient = null;
    }
    console.log('[ConfigService] Stopped');
  }

  /** Register a listener callback(configId) */
  onNotify(cb) { this._listeners.push(cb); }

  /** Internal helpers for testing */
  getCacheSize() { return this._cache.size; }

  /** Return unmasked value (for internal use / testing) */
  async _getUnmasked(category, key, fallback, opts) {
    this._isInternal = true;
    try { return this.get(category, key, fallback, opts); }
    finally { this._isInternal = false; }
  }
}

module.exports = { ConfigService };
