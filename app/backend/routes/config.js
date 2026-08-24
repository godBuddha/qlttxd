'use strict';

/**
 * Config API routes – settings management + workflow state-machine config.
 * Pattern matches existing route modules: module.exports = function deps(…){ … }
 * NOTE: Route order matters! Specific/special routes must come BEFORE parameterized
 * routes like /:category/:key which would otherwise capture them.
 */
module.exports = function configRoutes({ pool, authenticate, authorize, auditRetention }) {
  const express = require('express');
  const { requirePool, audit } = require('../utils/helpers');
  const router = express.Router();

  // Default global-scope UUID used in migration 005 seed data.
  const GLOBAL_SCOPE_UUID = '00000000-0000-4000-a000-000000000000';

  /** Helper: resolve scope_uuid param from query string */
  function resolveScopeUuid(req) {
    if (req.query.scope_id && req.query.scope_id !== 'null') return req.query.scope_id;
    const scope = req.query.scope || 'global';
    return scope === 'global' ? GLOBAL_SCOPE_UUID : null;
  }

  // ═══════════════════════════════════════════════
  // WAVE 1 — shared helpers for bulk/import/test-smtp/purge-now
  // ═══════════════════════════════════════════════

  /**
   * Parse an incoming config value the same way PUT /:category/:key does:
   * object/array → as-is; string → try JSON.parse with raw-string fallback.
   * @returns {{ ok: boolean, value?: *, error?: string }}
   */
  function parseConfigValue(value) {
    if (value === undefined || value === null) {
      return { ok: false, error: 'Thiếu trường value' };
    }
    if (typeof value === 'object') return { ok: true, value };
    if (typeof value === 'string') {
      try { return { ok: true, value: JSON.parse(value) }; } catch { return { ok: true, value }; }
    }
    return { ok: true, value };
  }

  /**
   * Core single-item set logic shared by PUT /:category/:key and bulk endpoints.
   * MUST be called inside an open transaction on `client`.
   * @param {import('pg').PoolClient} client
   * @param {{ category: string, key: string, value: * }} item
   * @param {object} req — express request (user/ip/requestId)
   * @param {string} [scopeUuid] — resolved global scope UUID
   * @returns {{ category: string, key: string, old_value: *, new_value: * }}
   * @throws Error('CONFIG_NOT_FOUND') | Error('CONFIG_READONLY') | validation Error
   */
  async function setOneInTx(client, { category, key, value }, req, scopeUuid = GLOBAL_SCOPE_UUID) {
    const scope = 'global';
    const r = await client.query(
      `SELECT id, value, is_readonly FROM system_config WHERE scope=$1 AND scope_id=$2::uuid AND category=$3 AND key=$4`,
      [scope, scopeUuid, category, key]
    );
    if (!r.rows.length) {
      throw Object.assign(new Error(`Không tìm thấy cấu hình ${category}/${key}`), { code: 'CONFIG_NOT_FOUND' });
    }
    const oldRow = r.rows[0];
    if (oldRow.is_readonly) {
      throw Object.assign(new Error(`Cấu hình ${category}/${key} chỉ đọc, không thể thay đổi`), { code: 'CONFIG_READONLY' });
    }

    let newValue;
    if (typeof value === 'object' && value !== null) {
      newValue = value;
    } else if (typeof value === 'string') {
      try { newValue = JSON.parse(value); } catch { newValue = value; }
    } else {
      newValue = value;
    }

    const newValStr = JSON.stringify(newValue);
    // Use pre-encoded JSON string + explicit text→jsonb cast to handle all value types.
    await client.query(
      `UPDATE system_config SET value=$2::text::jsonb, updated_at=now() WHERE id=$1`,
      [oldRow.id, newValStr]
    );
    await client.query(
      `INSERT INTO config_history (config_id, nguoi_dung_id, old_value, new_value, action, ip, request_id) VALUES ($1,$2,$3,$4,'update',$5,$6)`,
      [oldRow.id, req.user.id, JSON.stringify(oldRow.value), newValStr, req.ip || null, req.requestId || null]
    );
    return { category, key, old_value: oldRow.value, new_value: newValue };
  }

  /** Category → required edit permission (mirrors migration 006 permission codes). */
  const CATEGORY_PERMISSIONS = {
    general: 'config.edit.general',
    security: 'config.edit.security',
    workflow: 'config.edit.workflow',
    infra: 'config.edit.infra',
    appearance: 'config.edit.appearance',
    auth: 'config.edit.auth',
    upload: 'config.edit.upload',
    notification: 'config.edit.notification',
    smtp: 'config.edit.notification',   // SMTP channel belongs to the notification group
    features: 'config.edit.infra',      // feature flags are infrastructure switches
    audit: 'config.edit.infra',
    ui: 'config.edit.appearance',
    cookie: 'config.edit.security',
    pool: 'config.edit.infra',
    cleanup: 'config.edit.infra',
    sse: 'config.edit.infra',
    bell: 'config.edit.appearance',
    pagination: 'config.edit.general',
    rate_limit: 'config.edit.security',
    version: 'config.edit.general',
  };

  /** Resolve required permission for a config category; null when unknown. */
  function permissionForCategory(category) {
    return Object.prototype.hasOwnProperty.call(CATEGORY_PERMISSIONS, category)
      ? CATEGORY_PERMISSIONS[category]
      : null;
  }

  // ═══════════════════════════════════════════════
  // WAVE 1 — BULK / IMPORT / TEST-SMTP / PURGE-NOW
  // NOTE: these fixed paths have ONE segment after /config so they never collide
  // with the parameterized /:category/:key routes below.
  // ═══════════════════════════════════════════════

  const MAX_BULK_ITEMS = 50;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Validate one bulk item (shape + category permission). Returns an error
   * message string, or null when the item is usable.
   */
  function validateBulkItem(item, user) {
    if (!item || typeof item !== 'object') return 'Item không hợp lệ';
    const { category, key } = item;
    if (!category || !key) return 'Thiếu category hoặc key';
    if (item.value === undefined || item.value === null) return 'Thiếu trường value';
    const permCode = permissionForCategory(category);
    if (!permCode) return `Danh mục không hợp lệ: ${category}`;
    if (!user.permissions.includes(permCode)) return `Bạn không có quyền cập nhật danh mục ${category}`;
    return null;
  }

  // ─── PUT /api/v1/config/bulk ───
  // Atomic multi-update: one invalid item rolls back the WHOLE batch (400 with index).
  router.put(
    '/api/v1/config/bulk',
    authenticate,
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const { items } = req.body || {};
        if (!Array.isArray(items) || !items.length) {
          return res.status(400).json({ error: 'Danh sách cấu hình không hợp lệ' });
        }
        if (items.length > MAX_BULK_ITEMS) {
          return res.status(400).json({ error: `Tối đa ${MAX_BULK_ITEMS} item mỗi lần gọi` });
        }

        // Fail fast BEFORE opening the transaction: shape, category, permission.
        for (let i = 0; i < items.length; i++) {
          const err = validateBulkItem(items[i], req.user);
          if (err) {
            return res.status(400).json({ error: err, index: i, item: { category: items[i]?.category, key: items[i]?.key } });
          }
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const applied = [];
          for (let i = 0; i < items.length; i++) {
            const { category, key, value } = items[i];
            try {
              const r = await setOneInTx(client, { category, key, value }, req);
              applied.push(r);
            } catch (e) {
              await client.query('ROLLBACK');
              const status = e.code === 'CONFIG_READONLY' ? 400 : e.code === 'CONFIG_NOT_FOUND' ? 404 : 400;
              return res.status(status).json({
                error: e.message,
                index: i,
                item: { category, key },
                rolled_back: applied.length,
              });
            }
          }
          await client.query('COMMIT');

          // Notify other instances about every changed key (payload is safe metadata).
          for (const r of applied) {
            const notifyPayload = JSON.stringify({ category: r.category, key: r.key, scope: 'global', scopeId: GLOBAL_SCOPE_UUID }).slice(0, 7900);
            await pool.query(`SELECT pg_notify('config_changed', $1)`, [notifyPayload]).catch(() => {});
          }

          // Per-item audit trail (non-critical — mirrors ConfigService.set behaviour).
          for (const r of applied) {
            try {
              await audit(pool, req, 'config.update', 'system_config', null, { category: r.category, key: r.key, scope: 'global', bulk: true });
            } catch (_) { /* ignore */ }
          }

          res.json({ updated: applied.length, items: applied.map(r => ({ category: r.category, key: r.key, value: r.new_value })) });
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── POST /api/v1/config/test-smtp ───
  // Sends one probe email using DB smtp.* settings + layer-A secrets from env.
  router.post(
    '/api/v1/config/test-smtp',
    authenticate,
    authorize('config.edit.notification'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const { to } = req.body || {};
        if (!to || typeof to !== 'string' || !EMAIL_REGEX.test(to.trim())) {
          return res.status(400).json({ error: 'Địa chỉ nhận email thử nghiệm không hợp lệ' });
        }

        // Channel master switch lives in DB (migration 007).
        const cfgRow = await pool.query(
          `SELECT key, value FROM system_config WHERE scope='global' AND scope_id=$1::uuid AND category='smtp'`,
          [GLOBAL_SCOPE_UUID]
        );
        const smtp = {};
        for (const row of cfgRow.rows) smtp[row.key] = row.value;

        if (smtp.enabled !== true) {
          return res.status(400).json({ error: 'Kênh email đang tắt' });
        }

        const host = smtp.host || process.env.SMTP_HOST;
        if (!host) {
          return res.status(400).json({ error: 'Chưa cấu hình máy chủ SMTP (smtp.host)' });
        }
        const port = Number(smtp.port) || Number(process.env.SMTP_PORT) || 587;

        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });

        const from = smtp.from_address || process.env.SMTP_FROM || `QLTTXD <no-reply@${host}>`;
        try {
          const info = await transporter.sendMail({
            from,
            to: to.trim(),
            subject: 'QLTTXD — Email thử nghiệm cấu hình SMTP',
            text: 'Đây là email thử nghiệm từ Settings Center. Nếu bạn nhận được email này, cấu hình SMTP đang hoạt động.',
          });
          try {
            await audit(pool, req, 'config.test_smtp', 'system_config', null, { host, port, to: to.trim() });
          } catch (_) { /* non-critical */ }
          return res.json({ ok: true, messageId: info && info.messageId });
        } catch (mailErr) {
          // Redact anything resembling credentials before responding.
          const raw = String(mailErr && mailErr.message || 'Lỗi không xác định');
          const detail = process.env.SMTP_PASS ? raw.split(process.env.SMTP_PASS).join('[REDACTED]') : raw;
          return res.status(502).json({ error: 'Gửi email thử nghiệm thất bại', detail });
        } finally {
          transporter.close();
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── POST /api/v1/audit/purge-now ───
  // Manual one-shot audit purge, gated by feature flag features.manual_audit_purge.
  router.post(
    '/api/v1/audit/purge-now',
    authenticate,
    authorize('config.edit.infra'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const flag = await pool.query(
          `SELECT value FROM system_config WHERE scope='global' AND scope_id=$1::uuid AND category='features' AND key='manual_audit_purge'`,
          [GLOBAL_SCOPE_UUID]
        );
        if (!flag.rows.length || flag.rows[0].value !== true) {
          return res.status(403).json({ error: 'Tính năng chưa được bật' });
        }
        if (!auditRetention) {
          return res.status(503).json({ error: 'Job dọn audit log chưa sẵn sàng' });
        }
        const result = await auditRetention.runOnce();
        try {
          await audit(pool, req, 'audit.purge_now', 'audit_log', null, { deleted: result.count });
        } catch (_) { /* non-critical */ }
        res.json({ ok: true, deleted: result.count, file: result.file, skipped: !!result.skipped });
      } catch (error) {
        next(error);
      }
    }
  );



  // ═══════════════════════════════════════════════
  // WORKFLOW CONFIG ROUTES — MUST come BEFORE /:category/:key
  // ═══════════════════════════════════════════════

  // ─── GET /api/v1/config/workflow/states ───
  router.get(
    '/api/v1/config/workflow/states',
    authenticate,
    authorize('config.view'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const r = await pool.query(`SELECT id, code, label, is_terminal, sort_order FROM workflow_states ORDER BY sort_order`);
        res.json({ data: r.rows });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── GET /api/v1/config/workflow/transitions ───
  router.get(
    '/api/v1/config/workflow/transitions',
    authenticate,
    authorize('config.view'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const r = await pool.query(`SELECT id, from_state, to_state, label, sort_order FROM workflow_transitions ORDER BY from_state, sort_order`);
        const groups = {};
        for (const t of r.rows) {
          if (!groups[t.from_state]) groups[t.from_state] = [];
          groups[t.from_state].push(t);
        }
        res.json({ data: r.rows, grouped: groups });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── PUT /api/v1/config/workflow/transitions/:id ───
  router.put(
    '/api/v1/config/workflow/transitions/:id',
    authenticate,
    authorize('config.edit.workflow'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const transId = req.params.id;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transId)) {
          return res.status(400).json({ error: 'ID không hợp lệ' });
        }
        const { label, sort_order, from_state, to_state } = req.body || {};

        const updates = [];
        const vals = [];
        let idx = 1;
        if (label !== undefined) { updates.push(`label=$${idx++}`); vals.push(label); }
        if (sort_order !== undefined) { updates.push(`sort_order=$${idx++}`); vals.push(sort_order); }
        if (from_state !== undefined) { updates.push(`from_state=$${idx++}`); vals.push(from_state); }
        if (to_state !== undefined) { updates.push(`to_state=$${idx++}`); vals.push(to_state); }
        if (!updates.length) return res.status(400).json({ error: 'Thiếu dữ liệu cập nhật' });

        vals.push(transId);
        const r = await pool.query(
          `UPDATE workflow_transitions SET ${updates.join(', ')} WHERE id=$${idx} RETURNING id, from_state, to_state, label, sort_order`,
          vals
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Không tìm thấy transition' });

        await audit(pool, req, 'workflow.transition.update', 'workflow_transitions', transId, { from_state: r.rows[0].from_state, to_state: r.rows[0].to_state });
        res.json({ data: r.rows[0] });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── GET /api/v1/config/workflow/role-permissions ───
  router.get(
    '/api/v1/config/workflow/role-permissions',
    authenticate,
    authorize('config.view'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const r = await pool.query(
          `SELECT rsp.role_id, r.code AS role_code, r.name AS role_name, rsp.state_code, ws.label AS state_label
           FROM role_state_permissions rsp
           JOIN roles r ON r.id=rsp.role_id
           JOIN workflow_states ws ON ws.code=rsp.state_code
           ORDER BY r.code, ws.sort_order`
        );
        const matrix = {};
        for (const row of r.rows) {
          if (!matrix[row.role_code]) matrix[row.role_code] = {};
          matrix[row.role_code][row.state_code] = true;
        }
        const states = await pool.query(`SELECT code, label, is_terminal, sort_order FROM workflow_states ORDER BY sort_order`);
        res.json({ data: matrix, roles: r.rows.map(r => ({ code: r.role_code, name: r.role_name })), states: states.rows });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── PUT /api/v1/config/workflow/role-permissions ───
  router.put(
    '/api/v1/config/workflow/role-permissions',
    authenticate,
    authorize('config.edit.workflow'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const { assignments } = req.body || {};
        if (!Array.isArray(assignments)) {
          return res.status(400).json({ error: 'Danh sách phân quyền không hợp lệ' });
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const validRoles = await client.query(`SELECT id, code FROM roles`);
          const roleCodeToId = {};
          for (const r of validRoles.rows) { roleCodeToId[r.code] = r.id; }
          const validStateCodes = new Set((await client.query(`SELECT code FROM workflow_states`)).rows.map(s => s.code));

          for (const a of assignments) {
            // a.role_id may be UUID or code — resolve code first
            let roleId = a.role_id;
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(roleId))) {
              roleId = roleCodeToId[roleId];
            }
            if (!roleId || !validStateCodes.has(a.state_code)) continue;

            if (a.allowed) {
              await client.query(`INSERT INTO role_state_permissions (role_id, state_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [roleId, a.state_code]);
            } else {
              await client.query(`DELETE FROM role_state_permissions WHERE role_id=$1 AND state_code=$2`, [roleId, a.state_code]);
            }
          }

          await client.query('COMMIT');
          await audit(client, req, 'workflow.role_perms.update', 'role_state_permissions', null, { count: assignments.length });

          res.json({ data: { updated: assignments.length } });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // ═══════════════════════════════════════════════
  // GENERAL CONFIG ROUTES
  // ═══════════════════════════════════════════════

  // ─── GET /api/v1/config?category=X&scope=global ───
  router.get(
    '/api/v1/config',
    authenticate,
    authorize('config.view'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const scopeUuid = resolveScopeUuid(req);
        const scope = req.query.scope || 'global';
        const category = req.query.category;

        if (!category) {
          // Return all categories grouped
          const r = await pool.query(
            `SELECT category, key, value, is_secret FROM system_config WHERE scope=$1 AND scope_id=$2::uuid ORDER BY category, key`,
            [scope, scopeUuid]
          );
          const groups = {};
          for (const row of r.rows) {
            const mask = row.is_secret ? '***' : row.value;
            if (!groups[row.category]) groups[row.category] = [];
            groups[row.category].push({ key: row.key, value: mask });
          }
          return res.json({ data: groups });
        }

        const r = await pool.query(
          `SELECT id, category, key, value, is_secret FROM system_config WHERE scope=$1 AND scope_id=$2::uuid AND category=$3 ORDER BY key`,
          [scope, scopeUuid, category]
        );
        const masked = r.rows.map(row => ({ ...row, value: row.is_secret ? '***' : row.value }));
        res.json({ data: masked });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── GET /api/v1/config/:category/:key ───
  router.get(
    '/api/v1/config/:category/:key',
    authenticate,
    authorize('config.view'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const { category, key } = req.params;
        const scopeUuid = resolveScopeUuid(req);
        const scope = req.query.scope || 'global';

        const r = await pool.query(
          `SELECT id, category, key, value, is_secret, description, value_type FROM system_config WHERE scope=$1 AND scope_id=$2::uuid AND category=$3 AND key=$4`,
          [scope, scopeUuid, category, key]
        );
        if (!r.rows.length) return res.status(404).json({ error: `Không tìm thấy cấu hình ${category}/${key}` });

        const row = r.rows[0];
        res.json({ data: { ...row, value: row.is_secret ? '***' : row.value } });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── PUT /api/v1/config/:category/:key ───
  router.put(
    '/api/v1/config/:category/:key',
    authenticate,
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const { category, key } = req.params;
        const scopeUuid = resolveScopeUuid(req);
        const scope = req.query.scope || 'global';

        // Dynamic permission based on category prefix → config.edit.{prefix}
        const permCode = `config.edit.${category}`;
        const hasPerm = req.user.permissions.includes(permCode);
        if (!hasPerm) {
          return res.status(403).json({ error: 'Bạn không có quyền cập nhật cấu hình này' });
        }

        const { value } = req.body || {};
        if (value === undefined || value === null) {
          return res.status(400).json({ error: 'Thiếu trường value' });
        }

        // Parse incoming value safely: object/array → use as-is; string → try JSON.parse, fall back to raw string
        let newValue;
        if (typeof value === 'object' && value !== null) {
          newValue = value;
        } else if (typeof value === 'string') {
          try { newValue = JSON.parse(value); } catch { newValue = value; }
        } else {
          newValue = value;
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const r = await client.query(
            `SELECT id, value, is_readonly FROM system_config WHERE scope=$1 AND scope_id=$2::uuid AND category=$3 AND key=$4`,
            [scope, scopeUuid, category, key]
          );
          if (!r.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: `Không tìm thấy cấu hình ${category}/${key}` });
          }
          const oldRow = r.rows[0];
          if (oldRow.is_readonly) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Cấu hình này chỉ đọc, không thể thay đổi' });
          }

          const newValStr = JSON.stringify(newValue);

          // Use pre-encoded JSON string + explicit text→jsonb cast to handle all value types.
          await client.query(
            `UPDATE system_config SET value=$2::text::jsonb, updated_at=now() WHERE id=$1`,
            [oldRow.id, newValStr]
          );

          await client.query(
            `INSERT INTO config_history (config_id, nguoi_dung_id, old_value, new_value, action, ip, request_id) VALUES ($1,$2,$3,$4,'update',$5,$6)`,
            [oldRow.id, req.user.id, JSON.stringify(oldRow.value), newValStr, req.ip || null, req.requestId || null]
          );

          await client.query('COMMIT');
          await audit(client, req, 'config.update', 'system_config', oldRow.id, { category, key, scope });
          // NOTIFY with safe payload — pg NOTIFY max payload is 8000 bytes
          const notifyPayload = JSON.stringify({ category, key, scope, scopeId: scopeUuid }).slice(0, 7900);
          await client.query(`SELECT pg_notify('config_changed', $1)`, [notifyPayload]);

          res.json({ data: { category, key, value: newValue, updated_at: new Date().toISOString() } });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── GET /api/v1/config/history?category=X&key=Y ───
  router.get(
    '/api/v1/config/history',
    authenticate,
    authorize('config.view'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const { category, key } = req.query;
        if (!category || !key) return res.status(400).json({ error: 'Thiếu tham số category và key' });

        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const offset = (page - 1) * limit;

        const countResult = await pool.query(
          `SELECT count(*)::int AS total FROM config_history ch JOIN system_config sc ON sc.id=ch.config_id WHERE sc.category=$1 AND sc.key=$2`,
          [category, key]
        );
        const total = countResult.rows[0].total;

        const r = await pool.query(
          `SELECT ch.*, u.username, u.full_name, sc.category, sc.key FROM config_history ch
           JOIN system_config sc ON sc.id=ch.config_id LEFT JOIN users u ON u.id=ch.nguoi_dung_id
           WHERE sc.category=$1 AND sc.key=$2 ORDER BY ch.thoi_gian DESC LIMIT $3 OFFSET $4`,
          [category, key, limit, offset]
        );
        res.json({ data: r.rows, total, page, limit });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── POST /api/v1/config/rollback/:historyId ───
  router.post(
    '/api/v1/config/rollback/:historyId',
    authenticate,
    authorize('config.edit.general'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const historyId = req.params.historyId;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(historyId)) {
          return res.status(400).json({ error: 'ID lịch sử không hợp lệ' });
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // config_history doesn't have category/key directly — need a JOIN to system_config
          const h = await client.query(
            `SELECT ch.id, ch.config_id, ch.new_value, sc.category, sc.key
             FROM config_history ch
             JOIN system_config sc ON sc.id=ch.config_id
             WHERE ch.id=$1`,
            [historyId]
          );
          if (!h.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Không tìm thấy lịch sử này' });
          }
          const hist = h.rows[0];

          // new_value is stored as TEXT JSON (e.g. "\"10m\"", "12"). Cast it back to jsonb safely.
          await client.query(`UPDATE system_config SET value=$2::text::jsonb, updated_at=now() WHERE id=$1`, [hist.config_id, hist.new_value]);

          // Log rollback as a new history entry
          await client.query(
            `INSERT INTO config_history (config_id, nguoi_dung_id, old_value, new_value, action, ip, request_id) VALUES ($1,$2,(SELECT value FROM system_config WHERE id=$1),$2,'rollback',$3,$4)`,
            [hist.config_id, req.user.id, req.ip || null, req.requestId || null]
          );

          await client.query('COMMIT');
          await audit(client, req, 'config.rollback', 'system_config', hist.config_id, { category: hist.category, key: hist.key, rollback_from: historyId });

          res.json({ data: { rolled_back: true, category: hist.category, key: hist.key } });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── GET /api/v1/config/export ───
  router.get(
    '/api/v1/config/export',
    authenticate,
    authorize('config.view'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const r = await pool.query(
          `SELECT scope, scope_id::text, category, key, value, value_type, description, is_secret, is_readonly FROM system_config ORDER BY category, key`
        );
        res.json({ data: r.rows });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── POST /api/v1/config/import ───
  // Wave 1: ?dryRun=true → diff preview, NO DB write.
  //         ?dryRun=false → transactional write of valid items, skip invalid ones.
  // Legacy behaviour (no dryRun param) is preserved: per-item best-effort import.
  router.post(
    '/api/v1/config/import',
    authenticate,
    authorize('config.edit.general'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const { items } = req.body || {};
        const dryRunRaw = req.query.dry_run !== undefined
          ? req.query.dry_run
          : (req.body || {}).dry_run;
        const hasDryRun = dryRunRaw !== undefined;
        // String 'false' must be treated as false — hence the explicit comparison chain.
        const dryRun = dryRunRaw === true || dryRunRaw === 'true' || dryRunRaw === '1';
        if (!Array.isArray(items) || !items.length) {
          return res.status(400).json({ error: 'Danh sách cấu hình không hợp lệ' });
        }
        if (items.length > MAX_BULK_ITEMS) {
          return res.status(400).json({ error: `Tối đa ${MAX_BULK_ITEMS} item mỗi lần gọi` });
        }

        if (hasDryRun) {
          return await handleDryRunAwareImport(req, res, items, dryRun);
        }
        return await handleLegacyImport(req, res, items);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * Wave 1 import — dryRun-aware.
   * dryRun=true: read-only diff against current DB values.
   * dryRun=false: transactional write; invalid items are skipped and reported.
   */
  async function handleDryRunAwareImport(req, res, items, dryRun) {
    const wouldUpdate = [];
    const invalid = [];
    const unchanged = [];
    const validItems = [];

    // Pass 1 — classify every item without writing anything.
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { category, key, value } = item || {};
      if (!category || !key) {
        invalid.push({ category, key, error: 'thiếu category hoặc key', index: i });
        continue;
      }
      const parsed = parseConfigValue(value);
      if (!parsed.ok) {
        invalid.push({ category, key, error: parsed.error, index: i });
        continue;
      }
      const exists = await pool.query(
        `SELECT id, value FROM system_config WHERE scope='global' AND scope_id=$1::uuid AND category=$2 AND key=$3`,
        [GLOBAL_SCOPE_UUID, category, key]
      );
      if (!exists.rows.length) {
        invalid.push({ category, key, error: `Không tìm thấy cấu hình ${category}/${key}`, index: i });
        continue;
      }
      const oldJsonb = JSON.stringify(exists.rows[0].value);
      const newJsonb = JSON.stringify(parsed.value);
      if (oldJsonb === newJsonb) {
        unchanged.push({ category, key });
      } else {
        wouldUpdate.push({
          category,
          key,
          old_value: exists.rows[0].value,
          new_value: parsed.value,
        });
      }
      validItems.push({ category, key, value: item.value });
    }

    if (dryRun) {
      return res.json({
        data: { would_update: wouldUpdate, invalid, unchanged },
        dry_run: true,
      });
    }

    // dryRun=false — apply only valid items inside ONE transaction.
    const applied = [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const vi of validItems) {
        try {
          const r = await setOneInTx(client, vi, req);
          applied.push(r);
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw e;
    }
    client.release();

    for (const r of applied) {
      try {
        await audit(pool, req, 'config.update', 'system_config', null, { category: r.category, key: r.key, scope: 'global', source: 'import' });
      } catch (_) { /* non-critical */ }
    }

    return res.json({
      data: {
        imported: applied.length,
        skipped: invalid.length,
        unchanged: unchanged.length,
        results: [
          ...applied.map(r => ({ category: r.category, key: r.key, status: 'updated' })),
          ...invalid.map(v => ({ category: v.category, key: v.key, status: 'skipped', reason: v.error })),
        ],
      },
      dry_run: false,
    });
  }

  /** Legacy import (no dryRun param) — preserved verbatim from pre-Wave-1 contract. */
  async function handleLegacyImport(req, res, items) {
    const results = [];
    for (const item of items) {
      try {
        const { category, key, value, scope, scope_id } = item;
        if (!category || !key) {
          results.push({ category, key, status: 'skipped', reason: 'thiếu category hoặc key' });
          continue;
        }
        const s = scope || 'global';
        const sid = scope_id || GLOBAL_SCOPE_UUID;

        const exists = await pool.query(
          `SELECT id FROM system_config WHERE scope=$1 AND scope_id=$2::uuid AND category=$3 AND key=$4`,
          [s, sid, category, key]
        );

        if (exists.rows.length) {
          const valJsonb = typeof item.value === 'object' ? item.value : JSON.parse(String(item.value || 'null'));
          await pool.query(`UPDATE system_config SET value=$2::jsonb, updated_at=now() WHERE id=$1`, [exists.rows[0].id, JSON.stringify(valJsonb)]);
          results.push({ category, key, status: 'updated' });
        } else {
          const valJsonb = typeof item.value === 'object' ? item.value : JSON.parse(String(item.value || 'null'));
          await pool.query(
            `INSERT INTO system_config (scope, scope_id, category, key, value, value_type, description) VALUES ($1,$2::uuid,$3,$4,$5::jsonb,'json',COALESCE($6,''))`,
            [s, sid, category, key, JSON.stringify(valJsonb), item.description || '']
          );
          results.push({ category, key, status: 'created' });
        }
      } catch (e) {
        results.push({ category: item.category, key: item.key, status: 'error', reason: e.message });
      }
    }

    return res.json({
      data: {
        imported: results.filter(r => r.status !== 'skipped').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        results,
      },
      dry_run: !!req.body?.dry_run,
    });
  }

  // ─── GET /api/v1/config/schema ───
  router.get(
    '/api/v1/config/schema',
    authenticate,
    authorize('config.view'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const r = await pool.query(
          `SELECT category, key, value_type, min_value, max_value, allowed_values, regex, is_secret, is_readonly, description FROM config_schema ORDER BY category, key`
        );
        res.json({ data: r.rows });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── GET /api/v1/config/validation-rules ───
  router.get(
    '/api/v1/config/validation-rules',
    authenticate,
    authorize('config.view'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const r = await pool.query(`SELECT id, field_name, rule_type, value, error_message FROM validation_rules ORDER BY field_name, rule_type`);
        res.json({ data: r.rows });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── GET /api/v1/config/notification-channels ───
  router.get(
    '/api/v1/config/notification-channels',
    authenticate,
    authorize('config.view'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const r = await pool.query(`SELECT id, code, label, is_active, config FROM notification_channels ORDER BY code`);
        res.json({ data: r.rows });
      } catch (error) {
        next(error);
      }
    }
  );

  // ─── GET /api/v1/config/allowed-mime-types ───
  router.get(
    '/api/v1/config/allowed-mime-types',
    authenticate,
    authorize('config.view'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const r = await pool.query(`SELECT id, mime_type, extension, is_active, magic_bytes_required FROM allowed_mime_types WHERE is_active=true ORDER BY mime_type`);
        res.json({ data: r.rows });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};
