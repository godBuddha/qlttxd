'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { secret, requirePool, audit, invalidateUserTokens } = require('../utils/helpers');
const { sanitizeString } = require('../utils/sanitize');

const startTime = Date.now();

module.exports = function authRoutes({ pool, tokenBlocklist, authenticate, authorize }) {
  const router = express.Router();

  // Rate limit for login/auth endpoints (disabled in test/debug mode)
  const authLimiter =
    process.env.NODE_ENV === 'test' ||
    process.env.RATE_LIMIT_DISABLED === 'true' ||
    process.env.QLTTXD_DEBUG_TOKENS === 'true'
      ? (_req, _res, next) => next()
      : rateLimit({
          windowMs: 15 * 60 * 1000,
          max: 10,
          standardHeaders: true,
          legacyHeaders: false,
          message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
        });

  // Public liveness probe — lightweight, no memory/pool info leaked
  router.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1 AS ok');
      res.json({
        status: 'ok',
        db: 'connected',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: process.env.npm_package_version || '0.3.2',
      });
    } catch (e) {
      res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
    }
  });

  // M-14: Liveness — process sống, không phụ thuộc dependency. Luôn 200.
  router.get('/health/live', (_req, res) => {
    const { liveness } = require('../utils/health');
    res.json(liveness());
  });

  // M-14: Readiness — kiểm tra dependency thật (DB + storage). 200 ready / 503 not-ready.
  router.get('/health/ready', async (_req, res) => {
    const { readiness } = require('../utils/health');
    try {
      const { ready, checks } = await readiness(pool);
      if (ready) {
        res.json({ status: 'ready', checks, uptime: Math.floor((Date.now() - startTime) / 1000), version: process.env.npm_package_version || '0.3.2' });
      } else {
        res.status(503).json({ status: 'not_ready', checks });
      }
    } catch {
      res.status(503).json({ status: 'not_ready', checks: { db: { ok: false, error: 'database-unreachable' } } });
    }
  });

  // Detailed health — pool stats + process memory (admin only)
  router.get('/health/detailed', authenticate, authorize('admin.users'), async (_req, res) => {
    try {
      await pool.query('SELECT 1 AS ok');
      res.json({
        status: 'ok',
        db: 'connected',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: process.env.npm_package_version || '0.3.2',
        pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
        process: {
          pid: process.pid,
          memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        },
      });
    } catch (e) {
      res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
    }
  });

  // --- Public setup endpoints (no auth) ---
  router.get('/api/v1/auth/setup-status', async (_req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const result = await pool.query(
        `SELECT EXISTS(SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.is_active=true) AS has_admin`
      );
      res.json({ needsSetup: !result.rows[0].has_admin });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/v1/auth/setup-admin', authLimiter, async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { username, password, full_name, email, phone } = req.body || {};
      if (!username || username.length < 3 || username.length > 50) {
        return res.status(400).json({ error: 'Tên đăng nhập phải từ 3-50 ký tự' });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Mật khẩu phải tối thiểu 8 ký tự' });
      }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'Mật khẩu phải chứa cả chữ và chữ số' });
      }
      if (!full_name?.trim()) return res.status(400).json({ error: 'Họ tên là bắt buộc' });
      if (full_name.length > 200) return res.status(400).json({ error: 'Họ tên không được vượt quá 200 ký tự' });
      if (!email && !phone) {
        return res.status(400).json({ error: 'Email hoặc số điện thoại là bắt buộc' });
      }

      // Sanitize inputs to prevent XSS
      const safeUsername = sanitizeString(username);
      const safeFullName = sanitizeString(full_name.trim());
      const safeEmail = email ? sanitizeString(email) : null;
      const safePhone = phone ? sanitizeString(phone) : null;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('setup_admin'))");
        const hasAdmin = await client.query(
          `SELECT EXISTS(SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.is_active=true) AS has_admin`
        );
        if (hasAdmin.rows[0].has_admin) {
          await client.query('ROLLBACK');
          return res
            .status(409)
            .json({ error: 'Quản trị viên đã tồn tại. Không thể đăng ký lại.' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const userResult = await client.query(
          `INSERT INTO users (username, password_hash, full_name, email, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, email, phone`,
          [safeUsername, passwordHash, safeFullName, safeEmail, safePhone]
        );
        const user = userResult.rows[0];
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code='admin'`,
          [user.id]
        );
        const permResult = await client.query(
          `SELECT array_remove(array_agg(DISTINCT p.code), NULL) AS permissions FROM roles r JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE r.code='admin'`
        );
        const permissions = permResult.rows[0].permissions || [];
        await client.query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
        await client.query(
          `INSERT INTO audit_log (nguoi_dung_id, hanh_dong, bang_bi_tac_dong, id_ban_ghi, chi_tiet, ip) VALUES ($1, 'setup_admin', 'users', $2, $3, $4)`,
          [user.id, user.id, JSON.stringify({ username: user.username }), req.ip]
        );
        await client.query('COMMIT');
        const claims = { id: user.id, username: user.username, roles: ['admin'], permissions };
        const token = jwt.sign(claims, secret(), { expiresIn: '5m', jwtid: crypto.randomUUID() });
        await pool
          .query(
            'INSERT INTO user_tokens (user_id, jti) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING',
            [user.id, jwt.decode(token).jti]
          )
          .catch(() => {});
        const refreshToken = jwt.sign({ id: user.id, type: 'refresh' }, secret(), {
          expiresIn: '7d',
          jwtid: crypto.randomUUID(),
        });
        const rtDecoded = jwt.decode(refreshToken);
        await pool
          .query(
            "INSERT INTO refresh_tokens (user_id, jti, expires_at) VALUES ($1, $2, now() + interval '7 days')",
            [user.id, rtDecoded.jti]
          )
          .catch(() => {});
        // Set HttpOnly cookie for refresh token
        res.cookie('qlttxd_refresh_token', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/',
        });
        // Set CSRF cookie for CSRF protection (readable by JS, sameSite lax)
        const csrfToken = crypto.randomBytes(32).toString('hex');
        res.cookie('qlttxd_csrf', csrfToken, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/',
        });
        res.status(201).json({
          token,
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            roles: ['admin'],
            permissions,
          },
        });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/v1/auth/login', authLimiter, async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: 'Tên đăng nhập và mật khẩu là bắt buộc' });
      }
      if (typeof username !== 'string' || username.length > 200) {
        return res.status(400).json({ error: 'Tên đăng nhập không hợp lệ' });
      }
      const safeUsername = sanitizeString(username);
      const result = await pool.query(
        `SELECT u.id,u.username,u.full_name,u.email,u.phone,u.password_hash, array_remove(array_agg(DISTINCT r.code),NULL) roles, array_remove(array_agg(DISTINCT p.code),NULL) permissions FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id WHERE u.username=$1 AND u.is_active=true GROUP BY u.id`,
        [safeUsername]
      );
      const user = result.rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
      }
      const claims = {
        id: user.id,
        username: user.username,
        roles: user.roles || [],
        permissions: user.permissions || [],
      };
      await pool.query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
      await audit(pool, { user: claims, ip: req.ip }, 'login', 'users', user.id);
      const token = jwt.sign(claims, secret(), { expiresIn: '5m', jwtid: crypto.randomUUID() });
      await pool
        .query(
          'INSERT INTO user_tokens (user_id, jti) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING',
          [user.id, jwt.decode(token).jti]
        )
        .catch(() => {});
      const refreshToken = jwt.sign({ id: user.id, type: 'refresh' }, secret(), {
        expiresIn: '7d',
        jwtid: crypto.randomUUID(),
      });
      const rtDecoded = jwt.decode(refreshToken);
      await pool
        .query(
          "INSERT INTO refresh_tokens (user_id, jti, expires_at) VALUES ($1, $2, now() + interval '7 days')",
          [user.id, rtDecoded.jti]
        )
        .catch(() => {});
      // Set HttpOnly cookie for refresh token
      res.cookie('qlttxd_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
      // Set CSRF cookie for CSRF protection (readable by JS, sameSite lax)
      const csrfToken = crypto.randomBytes(32).toString('hex');
      res.cookie('qlttxd_csrf', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          roles: claims.roles,
          permissions: claims.permissions,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/v1/auth/logout', authenticate, async (req, res) => {
    if (req.user.jti) await tokenBlocklist.add(req.user.jti);
    // Clear refresh token cookie
    res.clearCookie('qlttxd_refresh_token', { path: '/' });
    // Clear CSRF cookie
    res.clearCookie('qlttxd_csrf', { path: '/' });
    return res.json({ message: 'Đăng xuất thành công' });
  });

  router.post('/api/v1/auth/refresh', async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      // Read refresh token from HttpOnly cookie
      const refreshToken = req.cookies?.qlttxd_refresh_token;
      if (!refreshToken) return res.status(401).json({ error: 'Thiếu refresh token' });
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, secret());
      } catch {
        return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' });
      }
      if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Token không hợp lệ' });
      const stored = await pool.query(
        'SELECT id FROM refresh_tokens WHERE jti=$1 AND expires_at > now()',
        [decoded.jti]
      );
      if (!stored.rows[0]) {
        return res.status(401).json({ error: 'Refresh token đã bị thu hồi hoặc hết hạn' });
      }
      await pool.query('DELETE FROM refresh_tokens WHERE jti=$1', [decoded.jti]);
      const userResult = await pool.query(
        `SELECT u.id,u.username,u.full_name,u.email,u.phone, array_remove(array_agg(DISTINCT r.code),NULL) roles, array_remove(array_agg(DISTINCT p.code),NULL) permissions FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id WHERE u.id=$1 AND u.is_active=true GROUP BY u.id`,
        [decoded.id]
      );
      const user = userResult.rows[0];
      if (!user) return res.status(401).json({ error: 'Người dùng không tồn tại' });
      const claims = {
        id: user.id,
        username: user.username,
        roles: user.roles || [],
        permissions: user.permissions || [],
      };
      const token = jwt.sign(claims, secret(), { expiresIn: '5m', jwtid: crypto.randomUUID() });
      await pool
        .query(
          'INSERT INTO user_tokens (user_id, jti) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING',
          [user.id, jwt.decode(token).jti]
        )
        .catch(() => {});
      const newRefreshToken = jwt.sign({ id: user.id, type: 'refresh' }, secret(), {
        expiresIn: '7d',
        jwtid: crypto.randomUUID(),
      });
      const newRtDecoded = jwt.decode(newRefreshToken);
      await pool
        .query(
          "INSERT INTO refresh_tokens (user_id, jti, expires_at) VALUES ($1, $2, now() + interval '7 days')",
          [user.id, newRtDecoded.jti]
        )
        .catch(() => {});
      // Set HttpOnly cookie for new refresh token
      res.cookie('qlttxd_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
      // Set CSRF cookie for CSRF protection (readable by JS, sameSite lax)
      const csrfToken = crypto.randomBytes(32).toString('hex');
      res.cookie('qlttxd_csrf', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          roles: claims.roles,
          permissions: claims.permissions,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/v1/auth/me', authenticate, (req, res) => res.json({ user: req.user }));

  // PATCH /api/v1/auth/password — change own password
  router.patch('/api/v1/auth/password', authenticate, async (req, res, next) => {
    try {
      const { old_password, new_password } = req.body || {};
      if (!old_password || !new_password) {
        return res.status(400).json({ error: 'Mật khẩu cũ và mới là bắt buộc' });
      }
      if (
        new_password.length < 8 ||
        !/[a-zA-Z]/.test(new_password) ||
        !/[0-9]/.test(new_password)
      ) {
        return res
          .status(400)
          .json({ error: 'Mật khẩu mới phải tối thiểu 8 ký tự, chứa cả chữ và chữ số' });
      }
      const user = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
      if (!user.rows[0] || !(await bcrypt.compare(old_password, user.rows[0].password_hash))) {
        return res.status(401).json({ error: 'Mật khẩu cũ không đúng' });
      }
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [
        await bcrypt.hash(new_password, 10),
        req.user.id,
      ]);
      // Sau khi đổi mật khẩu, thu hồi toàn bộ token của user (C-02)
      await invalidateUserTokens(pool, req.user.id);
      await audit(pool, req, 'change_password', 'users', req.user.id);
      res.json({ message: 'Đã đổi mật khẩu thành công' });
    } catch (e) {
      next(e);
    }
  });

  // =========================================================================
  // Attachment / evidence image serving
  // Auth via Authorization / X-Auth-Token header ONLY — never via query param
  // (JWT in ?token= leaks into logs, history and Referer headers).
  // =========================================================================
  const CONTENT_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  async function serveAttachment(req, res, next) {
    try {
      const filename = req.params.filename;
      if (
        !/^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|gif|webp)$/i.test(
          filename
        )
      ) {
        return res.status(404).json({ error: 'Không tìm thấy tệp' });
      }
      const auth = req.get('authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.get('x-auth-token');
      if (!token) return res.status(401).json({ error: 'Thiếu mã xác thực' });
      let user;
      try {
        user = jwt.verify(token, secret());
      } catch {
        return res.status(401).json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn' });
      }
      if (await tokenBlocklist.has(user.jti)) {
        return res.status(401).json({ error: 'Mã xác thực đã bị thu hồi' });
      }
      const attachment = await pool.query(
        "SELECT b.nguoi_gui_id FROM tep_dinh_kem t JOIN bao_cao_vi_pham b ON t.entity_type='bao_cao' AND b.id=t.entity_id WHERE t.duong_dan=$1",
        [`/uploads/${filename}`]
      );
      if (!attachment.rows[0]) return res.status(404).json({ error: 'Không tìm thấy tệp' });
      if (!user.permissions.includes('case.view') && attachment.rows[0].nguoi_gui_id !== user.id) {
        return res.status(403).json({ error: 'Bạn không có quyền xem tệp này' });
      }
      const uploadDirectory = require('../utils/upload').uploadDirectory;
      const ext = path.extname(filename).toLowerCase();
      res.set('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
      res.set('Content-Disposition', 'inline');
      res.set('Cache-Control', 'private, no-store');
      return res.sendFile(path.join(uploadDirectory, filename), { dotfiles: 'deny' }, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  }

  router.get('/uploads/:filename', serveAttachment);
  router.get('/api/v1/attachments/:filename/view', serveAttachment);

  // =========================================================================
  // T51: FORGOT PASSWORD / RESET PASSWORD
  // =========================================================================
  const forgotLimiter =
    process.env.NODE_ENV === 'test' ||
    process.env.RATE_LIMIT_DISABLED === 'true' ||
    process.env.QLTTXD_DEBUG_TOKENS === 'true'
      ? (_req, _res, next) => next()
      : rateLimit({
          windowMs: 15 * 60 * 1000,
          max: Number(process.env.RATE_LIMIT_MAX || 200),
          standardHeaders: true,
          legacyHeaders: false,
          message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
        });

  router.post('/api/v1/auth/forgot-password', forgotLimiter, async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { identifier } = req.body || {};
      if (!identifier?.trim()) {
        return res.status(400).json({ error: 'Tên đăng nhập hoặc email là bắt buộc' });
      }
      if (identifier.trim().length > 200) {
        return res.status(400).json({ error: 'Định danh không được vượt quá 200 ký tự' });
      }
      const safeIdentifier = sanitizeString(identifier.trim());

      const user = (
        await pool.query(
          'SELECT id, username FROM users WHERE (username=$1 OR email=$1) AND is_active=true LIMIT 1',
          [safeIdentifier]
        )
      ).rows[0];

      if (!user) {
        return res.json({
          message: 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.',
        });
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await pool.query(
        'INSERT INTO reset_token (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      await pool.query(
        "INSERT INTO audit_log (nguoi_dung_id, hanh_dong, bang_bi_tac_dong, id_ban_ghi, chi_tiet, ip) VALUES ($1, 'forgot_password', 'users', $2, $3, $4)",
        [user.id, user.id, JSON.stringify({ username: user.username }), req.ip]
      );

      if (process.env.SMTP_HOST) {
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(
          /\/$/,
          ''
        );
        const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
        try {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: Number(process.env.SMTP_PORT || 587) === 465,
            auth: process.env.SMTP_USER
              ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
              : undefined,
          });
          await transporter.sendMail({
            from: process.env.SMTP_FROM || `QLTTXD <no-reply@${process.env.SMTP_HOST}>`,
            to: user.email || identifier.trim(),
            subject: 'Đặt lại mật khẩu QLTTXD',
            html: `<p>Xin chào ${user.username},</p><p>Bạn đã yêu cầu đặt lại mật khẩu. Nhấp vào liên kết sau (có hiệu lực 15 phút):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Nếu bạn không yêu cầu, bỏ qua email này.</p>`,
          });
        } catch (mailErr) {
          console.error('[forgot-password] Gửi email thất bại:', mailErr.message);
        }
        return res.json({
          message: 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.',
        });
      }

      const resp = { message: 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' };
      // Chỉ trả dev_token ở môi trường KHÔNG production (dev/staging/test) khi có debug flag.
      // Tuyệt đối không lộ dev_token trong production.
      if (process.env.NODE_ENV !== 'production' && process.env.QLTTXD_DEBUG_TOKENS === 'true') {
        resp.dev_token = rawToken;
      }
      res.json(resp);
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/v1/auth/reset-password', forgotLimiter, async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { token, new_password } = req.body || {};
      if (!token) return res.status(400).json({ error: 'Token là bắt buộc' });
      if (!new_password || new_password.length < 8) {
        return res.status(400).json({ error: 'Mật khẩu phải tối thiểu 8 ký tự' });
      }
      if (!/[a-zA-Z]/.test(new_password) || !/[0-9]/.test(new_password)) {
        return res.status(400).json({ error: 'Mật khẩu phải chứa cả chữ và chữ số' });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const result = await pool.query(
        'SELECT id, user_id, expires_at, used FROM reset_token WHERE token_hash=$1',
        [tokenHash]
      );
      const record = result.rows[0];
      if (!record || record.used || new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
      }

      const passwordHash = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [
        passwordHash,
        record.user_id,
      ]);
      await pool.query('UPDATE reset_token SET used=true WHERE id=$1', [record.id]);
      await pool.query(
        "INSERT INTO audit_log (nguoi_dung_id, hanh_dong, bang_bi_tac_dong, id_ban_ghi, chi_tiet, ip) VALUES ($1, 'reset_password', 'users', $2, $3, $4)",
        [record.user_id, record.user_id, JSON.stringify({}), req.ip]
      );

      res.json({ message: 'Đặt lại mật khẩu thành công' });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
