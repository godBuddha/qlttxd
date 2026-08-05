'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { requirePool, audit, invalidateUserTokens } = require('../utils/helpers');

module.exports = function adminUsersRoutes({ pool, authenticate, authorize }) {
  const router = express.Router();

  // GET /api/v1/admin/users
  router.get('/api/v1/admin/users', authenticate, authorize('admin.users'), async (_req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const result = await pool.query(
        `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active, u.last_login_at, u.created_at,
                array_remove(array_agg(DISTINCT r.code), NULL) AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id=u.id
         LEFT JOIN roles r ON r.id=ur.role_id
         GROUP BY u.id ORDER BY u.created_at DESC`
      );
      res.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  // POST /api/v1/admin/users
  router.post('/api/v1/admin/users', authenticate, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { username, password, full_name, email, phone, is_active, roles } = req.body || {};
      if (!username || username.length < 3 || username.length > 50) return res.status(400).json({ error: 'Tên đăng nhập phải từ 3-50 ký tự' });
      if (!password || password.length < 8) return res.status(400).json({ error: 'Mật khẩu phải tối thiểu 8 ký tự' });
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ error: 'Mật khẩu phải chứa cả chữ và chữ số' });
      if (!full_name?.trim()) return res.status(400).json({ error: 'Họ tên là bắt buộc' });
      if (full_name && full_name.length > 200) return res.status(400).json({ error: 'Họ tên không được vượt quá 200 ký tự' });
      if (!email && !phone) return res.status(400).json({ error: 'Email hoặc số điện thoại là bắt buộc' });
      if (roles && !Array.isArray(roles)) return res.status(400).json({ error: 'Danh sách vai trò không hợp lệ' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const passwordHash = await bcrypt.hash(password, 10);
        const userResult = await client.query(
          `INSERT INTO users (username, password_hash, full_name, email, phone, is_active) VALUES ($1, $2, $3, $4, $5, COALESCE($6, true)) RETURNING id, username, full_name, email, phone, is_active`,
          [username, passwordHash, full_name.trim(), email || null, phone || null, is_active]
        );
        const user = userResult.rows[0];
        if (roles?.length) {
          await client.query(
            `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = ANY($2)`,
            [user.id, roles]
          );
        }
        const permResult = await client.query(
          `SELECT array_remove(array_agg(DISTINCT p.code), NULL) AS permissions FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1`,
          [user.id]
        );
        const permissions = permResult.rows[0].permissions || [];
        await audit(client, req, 'create', 'users', user.id);
        await client.query('COMMIT');
        res.status(201).json({ data: { ...user, roles: roles || [], permissions } });
      } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
    } catch (error) { next(error); }
  });

  // PATCH /api/v1/admin/users/:id
  router.patch('/api/v1/admin/users/:id', authenticate, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { full_name, email, phone, is_active, roles, password } = req.body || {};
      const userId = req.params.id;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
      if (password && (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))) return res.status(400).json({ error: 'Mật khẩu phải tối thiểu 8 ký tự, chứa cả chữ và chữ số' });
      if (full_name && full_name.length > 200) return res.status(400).json({ error: 'Họ tên không được vượt quá 200 ký tự' });
      if (roles && !Array.isArray(roles)) return res.status(400).json({ error: 'Danh sách vai trò không hợp lệ' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT id, is_active FROM users WHERE id=$1', [userId]);
        if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy người dùng' }); }

        const isDeactivating = is_active === false;
        const isRemovingAdmin = roles && !roles.includes('admin');
        if (isDeactivating || isRemovingAdmin) {
          const adminCount = await client.query(
            `SELECT count(*)::int AS cnt FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.is_active=true AND u.id != $1`,
            [userId]
          );
          if (adminCount.rows[0].cnt < 1) {
            const currentAdmin = await client.query(
              `SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.code='admin') AS is_admin`,
              [userId]
            );
            if (currentAdmin.rows[0].is_admin) {
              await client.query('ROLLBACK');
              return res.status(400).json({ error: 'Không thể khóa/xóa quyền quản trị viên cuối cùng' });
            }
          }
        }

        if (req.user.id === userId && isRemovingAdmin) {
          const selfAdminCount = await client.query(
            `SELECT count(*)::int AS cnt FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.is_active=true`
          );
          if (selfAdminCount.rows[0].cnt <= 1) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Không thể tự gỡ quyền quản trị khi chỉ còn 1 admin' });
          }
        }

        const updates = [];
        const values = [];
        let idx = 1;
        if (full_name !== undefined) { updates.push(`full_name=$${idx++}`); values.push(full_name.trim()); }
        if (email !== undefined) { updates.push(`email=$${idx++}`); values.push(email || null); }
        if (phone !== undefined) { updates.push(`phone=$${idx++}`); values.push(phone || null); }
        if (is_active !== undefined) { updates.push(`is_active=$${idx++}`); values.push(is_active); }
        if (password) { updates.push(`password_hash=$${idx++}`); values.push(await bcrypt.hash(password, 10)); }
        if (updates.length) {
          values.push(userId);
          await client.query(`UPDATE users SET ${updates.join(', ')} WHERE id=$${idx}`, values);
        }

        if (roles) {
          await client.query('DELETE FROM user_roles WHERE user_id=$1', [userId]);
          if (roles.length) {
            await client.query(
              `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = ANY($2)`,
              [userId, roles]
            );
          }
          await invalidateUserTokens(client, userId);
        }

        const result = await client.query(
          `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active, u.last_login_at, u.created_at,
                  array_remove(array_agg(DISTINCT r.code), NULL) AS roles
           FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id
           WHERE u.id=$1 GROUP BY u.id`,
          [userId]
        );
        await audit(client, req, 'update', 'users', userId);
        await client.query('COMMIT');
        res.json({ data: result.rows[0] });
      } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
    } catch (error) { next(error); }
  });

  // GET /api/v1/admin/roles
  router.get('/api/v1/admin/roles', authenticate, authorize('admin.users'), async (_req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const roles = await pool.query(
        `SELECT r.id, r.code, r.name, r.description,
                json_agg(json_build_object('id', p.id, 'code', p.code, 'name', p.name, 'module', p.module) ORDER BY p.module, p.code) FILTER (WHERE p.id IS NOT NULL) AS permissions
         FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
         GROUP BY r.id ORDER BY r.name`
      );
      res.json({ data: roles.rows });
    } catch (error) { next(error); }
  });

  // PATCH /api/v1/admin/roles/:id/permissions
  router.patch('/api/v1/admin/roles/:id/permissions', authenticate, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const roleId = req.params.id;
      const { permission_ids } = req.body || {};
      if (!Array.isArray(permission_ids)) return res.status(400).json({ error: 'Danh sách quyền không hợp lệ' });
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId)) return res.status(400).json({ error: 'ID vai trò không hợp lệ' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const role = await client.query('SELECT id FROM roles WHERE id=$1', [roleId]);
        if (!role.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy vai trò' }); }
        if (permission_ids.length) {
          const validPerms = await client.query('SELECT id FROM permissions WHERE id = ANY($1)', [permission_ids]);
          if (validPerms.rows.length !== permission_ids.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Một hoặc nhiều quyền không tồn tại' }); }
        }
        await client.query('DELETE FROM role_permissions WHERE role_id=$1', [roleId]);
        if (permission_ids.length) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id) SELECT $1, unnest($2::uuid[])`,
            [roleId, permission_ids]
          );
        }
        await audit(client, req, 'update_permissions', 'roles', roleId, { permission_ids });
        await client.query('COMMIT');
        const result = await pool.query(
          `SELECT r.id, r.code, r.name, r.description,
                  json_agg(json_build_object('id', p.id, 'code', p.code, 'name', p.name, 'module', p.module) ORDER BY p.module, p.code) FILTER (WHERE p.id IS NOT NULL) AS permissions
           FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
           WHERE r.id=$1 GROUP BY r.id`,
          [roleId]
        );
        res.json({ data: result.rows[0] });
      } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
    } catch (error) { next(error); }
  });

  // GET /api/v1/admin/permissions
  router.get('/api/v1/admin/permissions', authenticate, authorize('admin.users'), async (_req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const result = await pool.query(
        `SELECT module, json_agg(json_build_object('id', id, 'code', code, 'name', name) ORDER BY code) AS permissions
         FROM permissions GROUP BY module ORDER BY module`
      );
      res.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  // GET /api/v1/admin/audit-log
  router.get('/api/v1/admin/audit-log', authenticate, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const vals = [];
      const add = (sql, v) => { vals.push(v); return `${sql}$${vals.length}` };
      const w = [];
      if (req.query.bang) w.push(add('bang_bi_tac_dong=', req.query.bang));
      if (req.query.hanh_dong) w.push(add('hanh_dong=', req.query.hanh_dong));
      if (req.query.tu_ngay) w.push(add('thoi_gian>=', req.query.tu_ngay));
      if (req.query.den_ngay) w.push(add('thoi_gian<=', req.query.den_ngay));
      const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const page = Math.max(Number(req.query.page) || 1, 1);
      vals.push(limit, (page - 1) * limit);
      const r = await pool.query(
        `SELECT al.*, u.username, u.full_name
         FROM audit_log al LEFT JOIN users u ON u.id = al.nguoi_dung_id
         ${where} ORDER BY al.thoi_gian DESC LIMIT $${vals.length - 1} OFFSET $${vals.length}`, vals
      );
      res.json({ data: r.rows, page, limit });
    } catch (e) { next(e); }
  });

  return router;
};
