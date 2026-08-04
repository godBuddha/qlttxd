require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { TokenBlocklist } = require('./token-blocklist');

const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, done) => done(null, uploadDirectory),
  filename: (_req, file, done) => done(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024 },
  fileFilter: (_req, file, done) => done(null, file.mimetype.startsWith('image/')),
});
function hasSafeImageMagic(file) {
  const bytes = fs.readFileSync(file.path);
  return (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    || (bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a'))
    || (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP');
}
function removeUploadedFiles(files = []) { for (const file of files) fs.rmSync(file.path, { force: true }); }
const STATES = new Set(['cho_tiep_nhan', 'cho_xac_minh', 'dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban', 'da_lap_bien_ban', 'cho_ra_quyet_dinh', 'da_ra_quyet_dinh', 'dang_khac_phuc', 'cho_duyet_dieu_81', 'da_khac_phuc', 'da_dong', 'da_huy']);
const STATE_LABELS = { cho_tiep_nhan: 'Chờ tiếp nhận', cho_xac_minh: 'Chờ xác minh', dang_xac_minh: 'Đang xác minh', cho_bo_sung: 'Chờ bổ sung', cho_lap_bien_ban: 'Chờ lập biên bản', da_lap_bien_ban: 'Đã lập biên bản', cho_ra_quyet_dinh: 'Chờ ra quyết định', da_ra_quyet_dinh: 'Đã ra quyết định', dang_khac_phuc: 'Đang khắc phục', cho_duyet_dieu_81: 'Chờ duyệt Điều 81', da_khac_phuc: 'Đã khắc phục', da_dong: 'Đã đóng', da_huy: 'Đã hủy' };
const TRANSITIONS = {
  cho_tiep_nhan: ['cho_xac_minh', 'da_huy'], cho_xac_minh: ['dang_xac_minh', 'cho_bo_sung', 'da_huy'],
  dang_xac_minh: ['cho_bo_sung', 'cho_lap_bien_ban', 'da_huy'], cho_bo_sung: ['cho_xac_minh', 'da_huy'],
  cho_lap_bien_ban: ['da_lap_bien_ban', 'da_huy'], da_lap_bien_ban: ['cho_ra_quyet_dinh'],
  cho_ra_quyet_dinh: ['da_ra_quyet_dinh'], da_ra_quyet_dinh: ['dang_khac_phuc', 'da_dong'],
  dang_khac_phuc: ['da_khac_phuc'], da_khac_phuc: ['da_dong'], cho_duyet_dieu_81: ['cho_lap_bien_ban', 'da_huy'],
};
const startTime = Date.now();

function requirePool(pool, res) { if (!pool) { res.status(503).json({ error: 'Cơ sở dữ liệu chưa sẵn sàng' }); return false; } return true; }
function coordinate(body) {
  const lat = Number(body.latitude); const lng = Number(body.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}
function secret() { return process.env.JWT_SECRET; }
function makeAuthenticate(blocklist) {
  return async function authenticate(req, res, next) {
    const value = req.get('authorization') || ''; const bearerToken = value.startsWith('Bearer ') ? value.slice(7) : null;
    const xAuthToken = req.get('x-auth-token');
    const token = bearerToken || xAuthToken;
    if (!token) return res.status(401).json({ error: 'Thiếu mã xác thực' });
    try {
      const decoded = jwt.verify(token, secret());
      if (await blocklist.has(decoded.jti)) return res.status(401).json({ error: 'Mã xác thực đã bị thu hồi' });
      req.user = decoded;
      return next();
    } catch { return res.status(401).json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn' }); }
  };
}
// backward-compatible default (no blocklist) for tests that import authenticate directly
const authenticate = makeAuthenticate({ async has() { return false; } });
function authorize(...permissions) {
  return (req, res, next) => permissions.some((p) => req.user.permissions.includes(p))
    ? next() : res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
}
async function audit(pool, req, action, table, id, detail = {}) {
  await pool.query('INSERT INTO audit_log (nguoi_dung_id, hanh_dong, bang_bi_tac_dong, id_ban_ghi, chi_tiet, ip, request_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [req.user?.id || null, action, table, id || null, JSON.stringify(detail), req.ip, req.requestId || null]);
}
const BUSINESS_CODE_SEQUENCES = Object.freeze({
  BC: 'code_bao_cao_seq',
  HS: 'code_ho_so_seq',
  BB: 'code_bien_ban_seq',
  QD: 'code_quyet_dinh_seq',
});
async function nextCode(pool, prefix) {
  const sequence = BUSINESS_CODE_SEQUENCES[prefix];
  if (!sequence) throw new Error(`Unsupported business-code prefix: ${prefix}`);
  const result = await pool.query('SELECT next_business_code($1, $2::regclass) AS code', [prefix, sequence]);
  return result.rows[0].code;
}
function pointSelect(alias = '') { const p = alias ? `${alias}.` : ''; return `CASE WHEN ${p}toa_do IS NULL THEN NULL ELSE json_build_object('lat', ST_Y(${p}toa_do), 'lng', ST_X(${p}toa_do)) END AS toa_do`; }
function scopeWhere(user, vals, alias = '') {
  if (!user) return '';
  const p = alias ? `${alias}.` : '';
  if (user.permissions?.includes('case.view')) return '';
  vals.push(user.id);
  return ` AND ${p}nguoi_nop_id=$${vals.length}`;
}

function buildApp({ pool }) {
  if (!secret() || secret().length < 32) throw new Error('JWT_SECRET phải được cấu hình tối thiểu 32 ký tự');
  const tokenBlocklist = new TokenBlocklist({ pool });
  const authenticateWithBlocklist = makeAuthenticate(tokenBlocklist);
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN;
  app.use((req, res, next) => {
    const requestId = req.get('X-Request-Id') || crypto.randomUUID();
    req.requestId = requestId;
    res.set({ 'X-Request-Id': requestId });
    next();
  });
  app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((x) => x.trim()), methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] } : { origin: false }));
  app.use(express.json({ limit: '1mb' }));

  // Security headers via helmet (replaces manual CSP/STS/header setting)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        imgSrc: ["'self'", "https://*.tile.openstreetmap.org", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true }
  }));

  // Rate limit for login/auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 10, // 10 requests per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }
  });
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/setup-admin', authLimiter);

  app.get('/health', async (_req, res) => {
    try {
      const dbResult = await pool.query('SELECT 1 AS ok');
      res.json({
        status: 'ok',
        db: dbResult.rows[0]?.ok === 1 ? 'connected' : 'error',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: process.env.npm_package_version || '0.2.1',
      });
    } catch (e) {
      res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
    }
  });

  // --- Public setup endpoints (no auth) ---
  app.get('/api/v1/auth/setup-status', async (_req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const result = await pool.query(
        `SELECT EXISTS(SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.is_active=true) AS has_admin`
      );
      res.json({ needsSetup: !result.rows[0].has_admin });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/auth/setup-admin', async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { username, password, full_name, email, phone } = req.body || {};
      // Validate
      if (!username || username.length < 3 || username.length > 50) return res.status(400).json({ error: 'Tên đăng nhập phải từ 3-50 ký tự' });
      if (!password || password.length < 8) return res.status(400).json({ error: 'Mật khẩu phải tối thiểu 8 ký tự' });
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ error: 'Mật khẩu phải chứa cả chữ và chữ số' });
      if (!full_name?.trim()) return res.status(400).json({ error: 'Họ tên là bắt buộc' });
      if (!email && !phone) return res.status(400).json({ error: 'Email hoặc số điện thoại là bắt buộc' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Advisory lock to prevent race condition
        await client.query("SELECT pg_advisory_xact_lock(hashtext('setup_admin'))");
        // Check if admin already exists
        const hasAdmin = await client.query(
          `SELECT EXISTS(SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.is_active=true) AS has_admin`
        );
        if (hasAdmin.rows[0].has_admin) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Quản trị viên đã tồn tại. Không thể đăng ký lại.' });
        }
        // Create admin user
        const passwordHash = await bcrypt.hash(password, 10);
        const userResult = await client.query(
          `INSERT INTO users (username, password_hash, full_name, email, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, email, phone`,
          [username, passwordHash, full_name.trim(), email || null, phone || null]
        );
        const user = userResult.rows[0];
        // Assign admin role
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code='admin'`,
          [user.id]
        );
        // Get permissions
        const permResult = await client.query(
          `SELECT array_remove(array_agg(DISTINCT p.code), NULL) AS permissions FROM roles r JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE r.code='admin'`
        );
        const permissions = permResult.rows[0].permissions || [];
        // Update last_login_at
        await client.query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
        // Audit
        await client.query(
          `INSERT INTO audit_log (nguoi_dung_id, hanh_dong, bang_bi_tac_dong, id_ban_ghi, chi_tiet, ip) VALUES ($1, 'setup_admin', 'users', $2, $3, $4)`,
          [user.id, user.id, JSON.stringify({ username: user.username }), req.ip]
        );
        await client.query('COMMIT');
        // Generate JWT
        const claims = { id: user.id, username: user.username, roles: ['admin'], permissions };
        const token = jwt.sign(claims, secret(), { expiresIn: '8h', jwtid: crypto.randomUUID() });
        res.status(201).json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email, phone: user.phone, roles: ['admin'], permissions } });
      } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
    } catch (error) { next(error); }
  });

  app.post('/api/v1/auth/login', async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: 'Tên đăng nhập và mật khẩu là bắt buộc' });
      const result = await pool.query(`SELECT u.id,u.username,u.full_name,u.email,u.phone,u.password_hash, array_remove(array_agg(DISTINCT r.code),NULL) roles, array_remove(array_agg(DISTINCT p.code),NULL) permissions FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id WHERE u.username=$1 AND u.is_active=true GROUP BY u.id`, [username]);
      const user = result.rows[0];
      if (!user || !await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
      const claims = { id: user.id, username: user.username, roles: user.roles || [], permissions: user.permissions || [] };
      await pool.query('UPDATE users SET last_login_at=now() WHERE id=$1', [user.id]);
      await audit(pool, { user: claims, ip: req.ip }, 'login', 'users', user.id);
      return res.json({ token: jwt.sign(claims, secret(), { expiresIn: '8h', jwtid: crypto.randomUUID() }), user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email, phone: user.phone, roles: claims.roles, permissions: claims.permissions } });
    } catch (error) { next(error); }
  });
  app.post('/api/v1/auth/logout', authenticateWithBlocklist, async (req, res) => {
    if (req.user.jti) await tokenBlocklist.add(req.user.jti);
    return res.json({ message: 'Đăng xuất thành công' });
  });
  app.get('/api/v1/auth/me', authenticateWithBlocklist, (req, res) => res.json({ user: req.user }));

  // PATCH /api/v1/auth/password — change own password
  app.patch('/api/v1/auth/password', authenticateWithBlocklist, async (req, res, next) => {
    try {
      const { old_password, new_password } = req.body || {};
      if (!old_password || !new_password) return res.status(400).json({ error: 'Mật khẩu cũ và mới là bắt buộc' });
      if (new_password.length < 8 || !/[a-zA-Z]/.test(new_password) || !/[0-9]/.test(new_password))
        return res.status(400).json({ error: 'Mật khẩu mới phải tối thiểu 8 ký tự, chứa cả chữ và chữ số' });
      const user = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
      if (!user.rows[0] || !await bcrypt.compare(old_password, user.rows[0].password_hash))
        return res.status(401).json({ error: 'Mật khẩu cũ không đúng' });
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(new_password, 10), req.user.id]);
      await audit(pool, req, 'change_password', 'users', req.user.id);
      res.json({ message: 'Đã đổi mật khẩu thành công' });
    } catch (e) { next(e); }
  });

  app.get('/uploads/:filename', async (req, res, next) => {
    try {
      const filename = req.params.filename;
      if (!/^\d{13}-[0-9a-f-]{36}\.(?:jpe?g|png|gif|webp)$/i.test(filename)) return res.status(404).json({ error: 'Không tìm thấy tệp' });
      // Support token via query param (for <img> tags) or header
      const token = req.query.token || req.get('authorization')?.replace(/^Bearer /, '') || req.get('x-auth-token');
      if (!token) return res.status(401).json({ error: 'Thiếu mã xác thực' });
      let user;
      try { user = jwt.verify(token, secret()); } catch { return res.status(401).json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn' }); }
      if (await tokenBlocklist.has(user.jti)) return res.status(401).json({ error: 'Mã xác thực đã bị thu hồi' });
      const attachment = await pool.query("SELECT b.nguoi_gui_id FROM tep_dinh_kem t JOIN bao_cao_vi_pham b ON t.entity_type='bao_cao' AND b.id=t.entity_id WHERE t.duong_dan=$1", [`/uploads/${filename}`]);
      if (!attachment.rows[0]) return res.status(404).json({ error: 'Không tìm thấy tệp' });
      if (!user.permissions.includes('case.view') && attachment.rows[0].nguoi_gui_id !== user.id) return res.status(403).json({ error: 'Bạn không có quyền xem tệp này' });
      return res.sendFile(path.join(uploadDirectory, filename), { dotfiles: 'deny' }, (error) => { if (error) next(error); });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/danh-muc/loai-vi-pham', async (_req, res, next) => { try { res.json({ data: (await pool.query('SELECT * FROM loai_vi_pham ORDER BY so_thu_tu,ten')).rows }); } catch (e) { next(e); } });
  app.get('/api/v1/danh-muc/hanh-vi', async (req, res, next) => { try { const q = req.query.loai_vi_pham_id ? [' WHERE loai_vi_pham_id=$1', [req.query.loai_vi_pham_id]] : ['', []]; res.json({ data: (await pool.query(`SELECT * FROM hanh_vi_vi_pham${q[0]} ORDER BY khoan`, q[1])).rows }); } catch (e) { next(e); } });
  app.get('/api/v1/danh-muc/muc-phat', async (req, res, next) => { try { const q = req.query.hanh_vi_id ? [' WHERE hanh_vi_id=$1', [req.query.hanh_vi_id]] : ['', []]; res.json({ data: (await pool.query(`SELECT * FROM muc_phat${q[0]} ORDER BY nhom_cong_trinh`, q[1])).rows }); } catch (e) { next(e); } });
  app.get('/api/v1/danh-muc/quan-huyen', async (_req, res, next) => { try { res.json({ data: (await pool.query('SELECT id,ma,ten FROM quan_huyen ORDER BY ma')).rows }); } catch (e) { next(e); } });
  app.get('/api/v1/danh-muc/phuong-xa', async (req, res, next) => { try { const q = req.query.quan_huyen_id ? [' WHERE quan_huyen_id=$1', [req.query.quan_huyen_id]] : ['', []]; res.json({ data: (await pool.query(`SELECT id,ma,ten,quan_huyen_id FROM phuong_xa${q[0]} ORDER BY ma`, q[1])).rows }); } catch (e) { next(e); } });
  app.get('/api/v1/danh-muc/can-bo', authenticateWithBlocklist, authorize('case.view'), async (_req, res, next) => { try { res.json({ data: (await pool.query(`SELECT u.id,u.full_name,u.username FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='case_handler' AND u.is_active=true ORDER BY u.full_name`)).rows }); } catch (e) { next(e); } });

  app.post('/api/v1/bao-cao', authenticateWithBlocklist, authorize('report.create'), upload.array('anh', 5), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    if (!(req.files || []).every(hasSafeImageMagic)) { removeUploadedFiles(req.files); return res.status(400).json({ error: 'Tệp ảnh không hợp lệ theo chữ ký nội dung' }); }
    const pos = coordinate(req.body); if (!req.body.mo_ta?.trim() || !pos) { removeUploadedFiles(req.files); return res.status(400).json({ error: 'Mô tả và tọa độ hợp lệ là bắt buộc' }); }
    const client = await pool.connect();
    try { await client.query('BEGIN'); const code = await nextCode(client, 'BC');
      const r = await client.query(`WITH p AS (SELECT ST_SetSRID(ST_MakePoint($1,$2),4326) g) INSERT INTO bao_cao_vi_pham (ma_bao_cao,nguoi_gui_id,nguoi_gui_ten,nguoi_gui_sdt,nguoi_gui_email,mo_ta,dia_chi,quan_huyen_id,phuong_xa_id,toa_do,thoi_gian_xay_ra) SELECT $3,$4,$5,$6,$7,$8,$9,(SELECT id FROM quan_huyen,p WHERE boundary IS NOT NULL AND ST_Contains(boundary,p.g) LIMIT 1),(SELECT id FROM phuong_xa,p WHERE boundary IS NOT NULL AND ST_Contains(boundary,p.g) LIMIT 1),(SELECT g FROM p),$10 RETURNING id,ma_bao_cao,quan_huyen_id,phuong_xa_id,created_at,${pointSelect()}`,[pos.lng,pos.lat,code,req.user.id,req.body.nguoi_gui_ten||null,req.body.nguoi_gui_sdt||null,req.body.nguoi_gui_email||null,req.body.mo_ta.trim(),req.body.dia_chi||null,req.body.thoi_gian_xay_ra||null]);
      for (const file of req.files || []) await client.query("INSERT INTO tep_dinh_kem (entity_type,entity_id,ten_goc,duong_dan,loai_file,kich_thuoc,nguoi_tai_id) VALUES ('bao_cao',$1,$2,$3,$4,$5,$6)",[r.rows[0].id,file.originalname,`/uploads/${file.filename}`,file.mimetype,file.size,req.user.id]);
      await audit(client, req, 'create', 'bao_cao_vi_pham', r.rows[0].id); await client.query('COMMIT'); res.status(201).json({ data: r.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); removeUploadedFiles(req.files); next(e); } finally { client.release(); }
  });
  app.get('/api/v1/bao-cao', authenticateWithBlocklist, authorize('report.view_own'), async (req, res, next) => { try { const all = req.user.permissions.includes('case.view'); const r = await pool.query(`SELECT bc.id,bc.ma_bao_cao,bc.nguoi_gui_ten,bc.mo_ta,bc.dia_chi,bc.created_at,${pointSelect('bc')},(SELECT count(*)::int FROM tep_dinh_kem t WHERE t.entity_type='bao_cao' AND t.entity_id=bc.id) AS anh_count FROM bao_cao_vi_pham bc ${all ? '' : 'WHERE bc.nguoi_gui_id=$1'} ORDER BY bc.created_at DESC`, all ? [] : [req.user.id]); res.json({ data: r.rows }); } catch (e) { next(e); } });

  // POST /api/v1/bao-cao/:id/to-ho-so — chuyển báo cáo vi phạm thành hồ sơ xử lý
  app.post('/api/v1/bao-cao/:id/to-ho-so', authenticateWithBlocklist, authorize('case.update'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const bc = (await client.query('SELECT * FROM bao_cao_vi_pham WHERE id=$1', [req.params.id])).rows[0];
      if (!bc) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy báo cáo' }); }
      const existing = (await client.query('SELECT id,ma_ho_so FROM ho_so WHERE bao_cao_id=$1 LIMIT 1', [bc.id])).rows[0];
      if (existing) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Báo cáo đã được chuyển thành hồ sơ', data: existing }); }
      const code = await nextCode(client, 'HS');
      const r = await client.query(
        `INSERT INTO ho_so (ma_ho_so, bao_cao_id, nguoi_nop_id, dia_chi, quan_huyen_id, phuong_xa_id, toa_do, thoi_gian_xay_ra, mo_ta)
         SELECT $1, $2, $3, bc.dia_chi, bc.quan_huyen_id, bc.phuong_xa_id, bc.toa_do, bc.thoi_gian_xay_ra, bc.mo_ta
         FROM bao_cao_vi_pham bc WHERE bc.id=$2
         RETURNING id, ma_ho_so, trang_thai, ${pointSelect()}`,
        [code, bc.id, req.user.id]
      );
      const hoSo = r.rows[0];
      const attachments = (await client.query("SELECT ten_goc, duong_dan, loai_file, kich_thuoc FROM tep_dinh_kem WHERE entity_type='bao_cao' AND entity_id=$1", [bc.id])).rows;
      for (const att of attachments) {
        await client.query("INSERT INTO tep_dinh_kem (entity_type, entity_id, ten_goc, duong_dan, loai_file, kich_thuoc, nguoi_tai_id) VALUES ('ho_so', $1, $2, $3, $4, $5, $6)", [hoSo.id, att.ten_goc, att.duong_dan, att.loai_file, att.kich_thuoc, req.user.id]);
      }
      await audit(client, req, 'create', 'ho_so', hoSo.id, { from_bao_cao: bc.id, ma_bao_cao: bc.ma_bao_cao });
      await client.query('COMMIT');
      res.status(201).json({ data: { ...hoSo, anh_count: attachments.length } });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // GET /api/v1/bao-cao/:id — xem chi tiết báo cáo
  app.get('/api/v1/bao-cao/:id', authenticateWithBlocklist, authorize('report.view_own'), async (req, res, next) => {
    try {
      const all = req.user.permissions.includes('case.view');
      const bc = (await pool.query(
        `SELECT bc.id, bc.ma_bao_cao, bc.nguoi_gui_id, bc.nguoi_gui_ten, bc.nguoi_gui_sdt, bc.nguoi_gui_email,
                bc.mo_ta, bc.dia_chi, bc.quan_huyen_id, bc.phuong_xa_id, bc.thoi_gian_xay_ra, bc.created_at,
                ${pointSelect('bc')},
                q.ten AS quan_huyen_ten, p.ten AS phuong_xa_ten
         FROM bao_cao_vi_pham bc
         LEFT JOIN quan_huyen q ON q.id=bc.quan_huyen_id
         LEFT JOIN phuong_xa p ON p.id=bc.phuong_xa_id
         WHERE bc.id=$1 ${all ? '' : 'AND bc.nguoi_gui_id=$2'}`,
        all ? [req.params.id] : [req.params.id, req.user.id]
      )).rows[0];
      if (!bc) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
      const anh = (await pool.query("SELECT id, ten_goc, duong_dan, loai_file, kich_thuoc, created_at FROM tep_dinh_kem WHERE entity_type='bao_cao' AND entity_id=$1 ORDER BY created_at", [bc.id])).rows;
      const hoSo = (await pool.query('SELECT id, ma_ho_so, trang_thai FROM ho_so WHERE bao_cao_id=$1 LIMIT 1', [bc.id])).rows[0];
      res.json({ data: { ...bc, anh, ho_so: hoSo || null } });
    } catch (e) { next(e); }
  });


  app.post('/api/v1/ho-so', authenticateWithBlocklist, authorize('case.update'), async (req, res, next) => {
    const b = req.body || {}; const client = await pool.connect();
    try { await client.query('BEGIN'); let offender = null; if (b.nguoi_vi_pham?.ten && b.nguoi_vi_pham?.loai_chu_the) offender = (await client.query('INSERT INTO nguoi_vi_pham (loai_chu_the,ten,cmnd_cccd,dia_chi,sdt,email,nguoi_dai_dien) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',[b.nguoi_vi_pham.loai_chu_the,b.nguoi_vi_pham.ten,b.nguoi_vi_pham.cmnd_cccd||null,b.nguoi_vi_pham.dia_chi||null,b.nguoi_vi_pham.sdt||null,b.nguoi_vi_pham.email||null,b.nguoi_vi_pham.nguoi_dai_dien||null])).rows[0].id;
      const code = await nextCode(client, 'HS'); const pos = coordinate(b);
      const r = await client.query(`INSERT INTO ho_so (ma_ho_so,bao_cao_id,loai_vi_pham_id,hanh_vi_id,nguoi_nop_id,nguoi_vi_pham_id,dia_chi,quan_huyen_id,phuong_xa_id,toa_do,thoi_gian_xay_ra,mo_ta,muc_phat_du_kien,dang_thi_cong,ghi_chu) SELECT $1,$2,$3,$4,$5,$6,COALESCE($7,bc.dia_chi),COALESCE($8,bc.quan_huyen_id),COALESCE($9,bc.phuong_xa_id),CASE WHEN $10::float IS NULL THEN bc.toa_do ELSE ST_SetSRID(ST_MakePoint($10,$11),4326) END,COALESCE($12,bc.thoi_gian_xay_ra),COALESCE($13,bc.mo_ta),$14,COALESCE($15,false),$16 FROM (SELECT 1) x LEFT JOIN bao_cao_vi_pham bc ON bc.id=$2 RETURNING id,ma_ho_so,trang_thai,${pointSelect()}`,[code,b.bao_cao_id||null,b.loai_vi_pham_id||null,b.hanh_vi_id||null,req.user.id,offender,b.dia_chi||null,b.quan_huyen_id||null,b.phuong_xa_id||null,pos?.lng||null,pos?.lat||null,b.thoi_gian_xay_ra||null,b.mo_ta||null,b.muc_phat_du_kien||null,b.dang_thi_cong,b.ghi_chu||null]);
      await audit(client, req, 'create', 'ho_so', r.rows[0].id); await client.query('COMMIT'); res.status(201).json({ data: r.rows[0] });
    } catch(e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });
  app.get('/api/v1/ho-so', authenticateWithBlocklist, authorize('case.view'), async (req, res, next) => { try { const vals=[]; const add=(sql,v)=>{vals.push(v);return `${sql}$${vals.length}`}; const w=['deleted_at IS NULL']; if(req.query.trang_thai)w.push(add('trang_thai=',req.query.trang_thai)); if(req.query.quan_huyen_id)w.push(add('quan_huyen_id=',req.query.quan_huyen_id)); if(req.query.tu_ngay)w.push(add('created_at>=',req.query.tu_ngay)); if(req.query.den_ngay)w.push(add('created_at<=',req.query.den_ngay)); if(req.query.q)w.push(add('(ma_ho_so ILIKE ',`%${req.query.q}%`) + ` OR mo_ta ILIKE $${vals.length})`); const limit=Math.min(Math.max(Number(req.query.limit)||20,1),100),page=Math.max(Number(req.query.page)||1,1); vals.push(limit,(page-1)*limit); const r=await pool.query(`SELECT id,ma_ho_so,trang_thai,dia_chi,created_at,updated_at,${pointSelect()} FROM ho_so WHERE ${w.join(' AND ')} ORDER BY created_at DESC LIMIT $${vals.length-1} OFFSET $${vals.length}`,vals); res.json({data:r.rows,page,limit}); } catch(e){next(e);} });
  app.get('/api/v1/ho-so/:id', authenticateWithBlocklist, authorize('case.view'), async (req,res,next)=>{try { const h=await pool.query(`SELECT h.*,${pointSelect('h')},row_to_json(bc) bao_cao,row_to_json(nvp) nguoi_vi_pham,row_to_json(uxl) nguoi_xu_ly FROM ho_so h LEFT JOIN bao_cao_vi_pham bc ON bc.id=h.bao_cao_id LEFT JOIN nguoi_vi_pham nvp ON nvp.id=h.nguoi_vi_pham_id LEFT JOIN (SELECT u.id,u.full_name,u.username FROM users u) uxl ON uxl.id=h.nguoi_xu_ly_id WHERE h.id=$1 AND h.deleted_at IS NULL`,[req.params.id]); if(!h.rows[0])return res.status(404).json({error:'Không tìm thấy hồ sơ'}); const [bb,qd,kp,anh]=await Promise.all([pool.query('SELECT * FROM bien_ban WHERE ho_so_id=$1 ORDER BY created_at',[req.params.id]),pool.query('SELECT * FROM quyet_dinh WHERE ho_so_id=$1 ORDER BY created_at',[req.params.id]),pool.query('SELECT * FROM khac_phuc WHERE ho_so_id=$1 ORDER BY created_at',[req.params.id]),h.rows[0].bao_cao_id ? pool.query('SELECT id,ten_goc,duong_dan,loai_file,kich_thuoc,created_at FROM tep_dinh_kem WHERE entity_type=$1 AND entity_id=$2 ORDER BY created_at',['bao_cao',h.rows[0].bao_cao_id]) : Promise.resolve({rows:[]})]); res.json({data:{...h.rows[0],bien_ban:bb.rows,quyet_dinh:qd.rows,khac_phuc:kp.rows,anh:anh.rows}});}catch(e){next(e);}});
  app.patch('/api/v1/ho-so/:id/trang-thai', authenticateWithBlocklist, authorize('case.update'), async(req,res,next)=>{try {const nextState=req.body?.trang_thai;if(!STATES.has(nextState))return res.status(400).json({error:'Trạng thái hồ sơ không hợp lệ'});const old=(await pool.query('SELECT trang_thai FROM ho_so WHERE id=$1',[req.params.id])).rows[0];if(!old)return res.status(404).json({error:'Không tìm thấy hồ sơ'});if(!TRANSITIONS[old.trang_thai]?.includes(nextState))return res.status(400).json({error:'Chuyển trạng thái không hợp lệ'});const r=await pool.query('UPDATE ho_so SET trang_thai=$1 WHERE id=$2 RETURNING id,ma_ho_so,trang_thai,updated_at',[nextState,req.params.id]);await audit(pool,req,'update_status','ho_so',req.params.id,{from:old.trang_thai,to:nextState});try {const hs=await pool.query('SELECT nguoi_nop_id,nguoi_xu_ly_id FROM ho_so WHERE id=$1',[req.params.id]);const recipients=new Set([hs.rows[0]?.nguoi_nop_id,hs.rows[0]?.nguoi_xu_ly_id].filter(Boolean));for(const uid of recipients){if(uid!==req.user.id)await createThongBao(pool,{nguoi_nhan_id:uid,ho_so_id:req.params.id,loai:'trang_thai',tieu_de:`${r.rows[0].ma_ho_so}: chuyển trạng thái`,noi_dung:`Từ ${STATE_LABELS[old.trang_thai]||old.trang_thai} → ${STATE_LABELS[nextState]||nextState}`});}}catch(_n){/*notification failure should not block status update*/}res.json({data:r.rows[0]});}catch(e){next(e);}});

  // PUT /api/v1/ho-so/:id/phan-cong — assign handler
  app.put('/api/v1/ho-so/:id/phan-cong', authenticateWithBlocklist, authorize('case.assign'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { can_bo_id } = req.body || {};
      if (!can_bo_id) return res.status(400).json({ error: 'can_bo_id là bắt buộc' });
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(can_bo_id))
        return res.status(400).json({ error: 'can_bo_id không hợp lệ' });
      const hoSo = await pool.query('SELECT id, ma_ho_so, nguoi_xu_ly_id FROM ho_so WHERE id=$1 AND deleted_at IS NULL', [req.params.id]);
      if (!hoSo.rows[0]) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
      const handler = await pool.query(`SELECT u.id, u.full_name FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.id = $1 AND u.is_active = true AND r.code = 'case_handler'`, [can_bo_id]);
      if (!handler.rows[0]) return res.status(400).json({ error: 'Cán bộ không tồn tại hoặc không có vai trò xử lý hồ sơ' });
      const oldAssigneeId = hoSo.rows[0].nguoi_xu_ly_id;
      await pool.query('UPDATE ho_so SET nguoi_xu_ly_id=$1 WHERE id=$2', [can_bo_id, req.params.id]);
      await audit(pool, req, 'assign', 'ho_so', req.params.id, { old_can_bo_id: oldAssigneeId || null, new_can_bo_id: can_bo_id, can_bo_ten: handler.rows[0].full_name });
      res.json({ data: { id: hoSo.rows[0].id, ma_ho_so: hoSo.rows[0].ma_ho_so, nguoi_xu_ly_id: can_bo_id, nguoi_xu_ly_ten: handler.rows[0].full_name } });
    } catch (e) { next(e); }
  });

  app.post('/api/v1/ho-so/:id/bien-ban',authenticateWithBlocklist,authorize('bien_ban.create'),async(req,res,next)=>{try{const h=(await pool.query('SELECT * FROM ho_so WHERE id=$1',[req.params.id])).rows[0];if(!h)return res.status(404).json({error:'Không tìm thấy hồ sơ'});if(h.trang_thai!=='cho_lap_bien_ban')return res.status(400).json({error:'Hồ sơ phải ở trạng thái chờ lập biên bản'});const code=await nextCode(pool,'BB');const r=await pool.query("INSERT INTO bien_ban (ma_bien_ban,ho_so_id,nguoi_lap_id,nguoi_vi_pham_id,hanh_vi_id,noi_dung,muc_phat_du_kien) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",[code,h.id,req.user.id,h.nguoi_vi_pham_id,h.hanh_vi_id,req.body?.noi_dung||null,req.body?.muc_phat_du_kien||null]);await pool.query("UPDATE ho_so SET trang_thai='da_lap_bien_ban' WHERE id=$1",[h.id]);await audit(pool,req,'create','bien_ban',r.rows[0].id);res.status(201).json({data:r.rows[0]});}catch(e){next(e);}});
  app.post('/api/v1/ho-so/:id/quyet-dinh',authenticateWithBlocklist,authorize('quyet_dinh.issue'),async(req,res,next)=>{try{const h=(await pool.query('SELECT * FROM ho_so WHERE id=$1',[req.params.id])).rows[0];if(!h)return res.status(404).json({error:'Không tìm thấy hồ sơ'});if(h.trang_thai!=='cho_ra_quyet_dinh')return res.status(400).json({error:'Hồ sơ phải ở trạng thái chờ ra quyết định'});if(!req.body?.bien_ban_id)return res.status(400).json({error:'Biên bản là bắt buộc'});const bienBan=(await pool.query('SELECT id FROM bien_ban WHERE id=$1 AND ho_so_id=$2',[req.body.bien_ban_id,h.id])).rows[0];if(!bienBan)return res.status(400).json({error:'Biên bản không thuộc hồ sơ'});const mp=await pool.query('SELECT muc_toi_thieu,muc_toi_da FROM muc_phat WHERE hanh_vi_id=$1 AND nhom_cong_trinh=$2',[h.hanh_vi_id,req.body?.nhom_cong_trinh||1]);const amount=req.body?.so_tien_phat ?? (mp.rows[0] ? Math.round(Number(mp.rows[0].muc_toi_thieu)+(Number(mp.rows[0].muc_toi_da)-Number(mp.rows[0].muc_toi_thieu))/2) : null);const subject=(await pool.query('SELECT loai_chu_the FROM nguoi_vi_pham WHERE id=$1',[h.nguoi_vi_pham_id])).rows[0];const fine=subject?.loai_chu_the==='ca_nhan'&&amount!==null?Math.floor(amount/2):amount;const code=await nextCode(pool,'QD');const r=await pool.query("INSERT INTO quyet_dinh (ma_quyet_dinh,bien_ban_id,ho_so_id,nguoi_ky_id,so_tien_phat,can_cu_phap_ly,hinh_thuc_phat_bo_sung,bien_phap_khac_phuc_hau_qua,trang_thai) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft') RETURNING *",[code,bienBan.id,h.id,req.user.id,fine,req.body?.can_cu_phap_ly||null,req.body?.hinh_thuc_phat_bo_sung||null,req.body?.bien_phap_khac_phuc_hau_qua||null,]);await audit(pool,req,'create','quyet_dinh',r.rows[0].id);res.status(201).json({data:r.rows[0]});}catch(e){next(e);}});
  app.post('/api/v1/ho-so/:id/quyet-dinh/ban-hanh',authenticateWithBlocklist,authorize('quyet_dinh.issue'),async(req,res,next)=>{try{const h=(await pool.query('SELECT id,ma_ho_so,trang_thai,nguoi_nop_id,bao_cao_id FROM ho_so WHERE id=$1',[req.params.id])).rows[0];if(!h)return res.status(404).json({error:'Không tìm thấy hồ sơ'});if(h.trang_thai!=='cho_ra_quyet_dinh')return res.status(400).json({error:'Hồ sơ phải ở trạng thái chờ ra quyết định'});const qd=(await pool.query("SELECT * FROM quyet_dinh WHERE ho_so_id=$1 AND trang_thai='draft' ORDER BY created_at DESC LIMIT 1",[req.params.id])).rows[0];if(!qd)return res.status(400).json({error:'Không có quyết định nháp để ban hành'});const ngayBH=req.body?.ngay_ban_hanh||null;const r=await pool.query("UPDATE quyet_dinh SET trang_thai='da_ban_hanh',ngay_ban_hanh=COALESCE($1::date,CURRENT_DATE) WHERE id=$2 RETURNING *",[ngayBH,qd.id]);await pool.query("UPDATE ho_so SET trang_thai='da_ra_quyet_dinh' WHERE id=$1",[h.id]);await audit(pool,req,'ban_hanh','quyet_dinh',qd.id,{ma_quyet_dinh:qd.ma_quyet_dinh});res.json({data:r.rows[0]});}catch(e){next(e);}});
  app.post('/api/v1/ho-so/:id/khac-phuc',authenticateWithBlocklist,authorize('khac_phuc.manage'),async(req,res,next)=>{try{const h=(await pool.query('SELECT trang_thai FROM ho_so WHERE id=$1',[req.params.id])).rows[0];if(!h)return res.status(404).json({error:'Không tìm thấy hồ sơ'});if(h.trang_thai!=='da_ra_quyet_dinh')return res.status(400).json({error:'Hồ sơ phải đã có quyết định để theo dõi khắc phục'});if(req.body?.quyet_dinh_id&&!((await pool.query('SELECT 1 FROM quyet_dinh WHERE id=$1 AND ho_so_id=$2',[req.body.quyet_dinh_id,req.params.id])).rows[0]))return res.status(400).json({error:'Quyết định không thuộc hồ sơ'});const r=await pool.query("INSERT INTO khac_phuc (ho_so_id,quyet_dinh_id,bien_phap,mo_ta,han_thuc_hien,nguoi_theo_doi_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",[req.params.id,req.body?.quyet_dinh_id||null,req.body?.bien_phap,req.body?.mo_ta||null,req.body?.han_thuc_hien||null,req.user.id]);await pool.query("UPDATE ho_so SET trang_thai='dang_khac_phuc' WHERE id=$1",[req.params.id]);await audit(pool,req,'create','khac_phuc',r.rows[0].id);res.status(201).json({data:r.rows[0]});}catch(e){next(e);}});
  app.patch('/api/v1/khac-phuc/:id',authenticateWithBlocklist,authorize('khac_phuc.manage'),async(req,res,next)=>{try{const valid=['chua_thuc_hien','dang_thuc_hien','da_thuc_hien','qua_han','cuong_che','da_kiem_tra'];if(!valid.includes(req.body?.trang_thai))return res.status(400).json({error:'Trạng thái khắc phục không hợp lệ'});const r=await pool.query("UPDATE khac_phuc SET trang_thai=$1::varchar,ngay_hoan_thanh=CASE WHEN $1::varchar='da_thuc_hien' THEN now() ELSE ngay_hoan_thanh END WHERE id=$2 RETURNING *",[req.body.trang_thai,req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Không tìm thấy thông tin khắc phục'});if(req.body.trang_thai==='da_thuc_hien')await pool.query("UPDATE ho_so SET trang_thai='da_khac_phuc' WHERE id=$1",[r.rows[0].ho_so_id]);await audit(pool,req,'update','khac_phuc',r.rows[0].id);res.json({data:r.rows[0]});}catch(e){next(e);}});
  // ---------------------------------------------------------------------------
  // Export Biên bản / Quyết định ra DOCX
  // ---------------------------------------------------------------------------
  const { generateBienBan, generateQuyetDinh } = require('./gov_docx');

  async function fetchHoSoDocxData(hoSoId) {
    const h = await pool.query(
      `SELECT h.*, q.ten AS quan_huyen_ten, px.ten AS phuong_xa_ten
       FROM ho_so h
       LEFT JOIN quan_huyen q ON q.id=h.quan_huyen_id
       LEFT JOIN phuong_xa px ON px.id=h.phuong_xa_id
       WHERE h.id=$1 AND h.deleted_at IS NULL`, [hoSoId]
    );
    if (!h.rows[0]) return null;
    const hs = h.rows[0];
    const [nvpRes, hvRes, lvpRes, bbRes, qdRes] = await Promise.all([
      hs.nguoi_vi_pham_id ? pool.query('SELECT * FROM nguoi_vi_pham WHERE id=$1', [hs.nguoi_vi_pham_id]) : Promise.resolve({ rows: [null] }),
      hs.hanh_vi_id ? pool.query('SELECT * FROM hanh_vi_vi_pham WHERE id=$1', [hs.hanh_vi_id]) : Promise.resolve({ rows: [null] }),
      hs.loai_vi_pham_id ? pool.query('SELECT * FROM loai_vi_pham WHERE id=$1', [hs.loai_vi_pham_id]) : Promise.resolve({ rows: [null] }),
      pool.query('SELECT * FROM bien_ban WHERE ho_so_id=$1 ORDER BY created_at DESC LIMIT 1', [hoSoId]),
      pool.query('SELECT * FROM quyet_dinh WHERE ho_so_id=$1 ORDER BY created_at DESC LIMIT 1', [hoSoId]),
    ]);
    return {
      ho_so: hs, nguoi_vi_pham: nvpRes.rows[0], hanh_vi: hvRes.rows[0],
      loai_vi_pham: lvpRes.rows[0], bien_ban: bbRes.rows[0], quyet_dinh: qdRes.rows[0],
      quan_huyen: hs.quan_huyen_id ? { ten: hs.quan_huyen_ten } : null,
      phuong_xa: hs.phuong_xa_id ? { ten: hs.phuong_xa_ten } : null,
    };
  }

  app.get('/api/v1/ho-so/:id/xuat-bien-ban.docx', authenticateWithBlocklist, authorize('case.update'), async (req, res, next) => {
    try {
      const data = await fetchHoSoDocxData(req.params.id);
      if (!data) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
      if (!data.bien_ban) return res.status(400).json({ error: 'Hồ sơ chưa có biên bản' });
      const nguoiLap = await pool.query('SELECT full_name FROM users WHERE id=$1', [data.bien_ban.nguoi_lap_id]);
      const buffer = await generateBienBan({ ...data, nguoi_lap: nguoiLap.rows[0] });
      await audit(pool, req, 'export_docx', 'bien_ban', data.bien_ban.id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${data.bien_ban.ma_bien_ban || 'bien-ban'}.docx"`);
      res.send(buffer);
    } catch (e) { next(e); }
  });

  app.get('/api/v1/ho-so/:id/xuat-quyet-dinh.docx', authenticateWithBlocklist, authorize('case.update'), async (req, res, next) => {
    try {
      const data = await fetchHoSoDocxData(req.params.id);
      if (!data) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
      if (!data.quyet_dinh) return res.status(400).json({ error: 'Hồ sơ chưa có quyết định' });
      const [nguoiKyRes, bbFullRes] = await Promise.all([
        pool.query('SELECT full_name FROM users WHERE id=$1', [data.quyet_dinh.nguoi_ky_id]),
        data.quyet_dinh.bien_ban_id ? pool.query('SELECT * FROM bien_ban WHERE id=$1', [data.quyet_dinh.bien_ban_id]) : Promise.resolve({ rows: [data.bien_ban] }),
      ]);
      const buffer = await generateQuyetDinh({ ...data, bien_ban: bbFullRes.rows[0] || data.bien_ban, nguoi_ky: nguoiKyRes.rows[0] });
      await audit(pool, req, 'export_docx', 'quyet_dinh', data.quyet_dinh.id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${data.quyet_dinh.ma_quyet_dinh || 'quyet-dinh'}.docx"`);
      res.send(buffer);
    } catch (e) { next(e); }
  });

  // --- Per-case PDF export (Vietnamese font) ---
  function vnFont(doc) {
    const fontRegular = path.resolve(__dirname, 'fonts', 'NotoSans-Regular.ttf');
    const fontBold = path.resolve(__dirname, 'fonts', 'NotoSans-Bold.ttf');
    doc.registerFont('VN', fontRegular);
    doc.registerFont('VN-Bold', fontBold);
  }

  app.get('/api/v1/ho-so/:id/xuat-bien-ban.pdf', authenticateWithBlocklist, authorize('case.update'), async (req, res, next) => {
    try {
      const data = await fetchHoSoDocxData(req.params.id);
      if (!data) return res.status(404).json({ error: 'Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1' });
      if (!data.bien_ban) return res.status(400).json({ error: 'H\u1ed3 s\u01a1 ch\u01b0a c\u00f3 bi\u00ean b\u1ea3n' });
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      vnFont(doc);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + (data.bien_ban.ma_bien_ban || 'bien-ban') + '.pdf"');
      doc.pipe(res);
      doc.fontSize(14).font('VN-Bold').text('C\u1ed8NG H\u00d2A X\u00c3 H\u1ed8I CH\u1ee6 NGH\u0128A VI\u1ec6T NAM', { align: 'center' });
      doc.fontSize(11).font('VN').text('\u0110\u1ed9c l\u1eadp - T\u1ef1 do - H\u1ea1nh ph\u00fac', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(16).font('VN-Bold').text('BI\u00caN B\u1ea2N VI PH\u1ea0M H\u00c0NH CH\u00cdNH', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).font('VN').text('S\u1ed1: ' + (data.bien_ban.ma_bien_ban || '\2026'), { align: 'center' });
      doc.moveDown(1);
      const diaChiVP = [data.ho_so.dia_chi, data.phuong_xa && data.phuong_xa.ten, data.quan_huyen && data.quan_huyen.ten].filter(Boolean).join(', ') || '\2026';
      doc.fontSize(10).font('VN');
      doc.text('\u0110\u1ecba ch\u1ec9 vi ph\u1ea1m: ' + diaChiVP);
      doc.text('Ng\u01b0\u1eddi vi ph\u1ea1m: ' + (data.nguoi_vi_pham && data.nguoi_vi_pham.ten || '\2026'));
      doc.text('H\u00e0nh vi vi ph\u1ea1m: ' + (data.hanh_vi && data.hanh_vi.ten || '\2026'));
      doc.text('M\u00f4 t\u1ea3: ' + (data.ho_so.mo_ta || data.bien_ban.noi_dung || '\2026'));
      doc.text('M\u1ee9c ph\u1ea1t d\u1ef1 ki\u1ebfn: ' + (data.bien_ban.muc_phat_du_kien != null ? Number(data.bien_ban.muc_phat_du_kien).toLocaleString('vi-VN') + ' \u0111\u1ed3ng' : '\2026'));
      if (data.bien_ban.noi_dung) doc.text('Ghi ch\u00fa: ' + data.bien_ban.noi_dung);
      doc.moveDown(2);
      doc.font('VN').text('Bi\u00ean b\u1ea3n \u0111\u01b0\u1ee3c l\u1eadp th\u00e0nh 02 b\u1ea3n, 01 b\u1ea3n giao cho ng\u01b0\u1eddi vi ph\u1ea1m, 01 b\u1ea3n l\u01b0u t\u1ea1i c\u01a1 quan.', { align: 'justify' });
      doc.end();
      await audit(pool, req, 'export_pdf', 'bien_ban', data.bien_ban.id);
    } catch (e) { next(e); }
  });

  app.get('/api/v1/ho-so/:id/xuat-quyet-dinh.pdf', authenticateWithBlocklist, authorize('case.update'), async (req, res, next) => {
    try {
      const data = await fetchHoSoDocxData(req.params.id);
      if (!data) return res.status(404).json({ error: 'Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1' });
      if (!data.quyet_dinh) return res.status(400).json({ error: 'H\u1ed3 s\u01a1 ch\u01b0a c\u00f3 quy\u1ebft \u0111\u1ecbnh' });
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      vnFont(doc);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + (data.quyet_dinh.ma_quyet_dinh || 'quyet-dinh') + '.pdf"');
      doc.pipe(res);
      doc.fontSize(14).font('VN-Bold').text('C\u1ed8NG H\u00d2A X\u00c3 H\u1ed8I CH\u1ee6 NGH\u0128A VI\u1ec6T NAM', { align: 'center' });
      doc.fontSize(11).font('VN').text('\u0110\u1ed9c l\u1eadp - T\u1ef1 do - H\u1ea1nh ph\u00fac', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(14).font('VN-Bold').text('CH\u1ee6 T\u1ecaCH \u1ee8Y BAN NH\u00c2N D\u00c2N ' + (data.quan_huyen && data.quan_huyen.ten ? data.quan_huyen.ten.toUpperCase() : '\2026'), { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).font('VN-Bold').text('S\u1ed1: ' + (data.quyet_dinh.ma_quyet_dinh || '\2026'), { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).font('VN-Bold').text('QUY\u1ebeT \u0110\u1ecaNH', { align: 'center' });
      doc.fontSize(13).font('VN-Bold').text('X\u1eec PH\u1ea0T VI PH\u1ea0M H\u00c0NH CH\u00cdNH', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(10).font('VN');
      doc.text('X\u1eed ph\u1ea1t vi ph\u1ea1m h\u00e0nh ch\u00ednh \u0111\u1ed1i v\u1edbi:');
      doc.text('T\u00ean ng\u01b0\u1eddi vi ph\u1ea1m: ' + (data.nguoi_vi_pham && data.nguoi_vi_pham.ten || '\2026'));
      doc.text('CMND/CCCD: ' + (data.nguoi_vi_pham && data.nguoi_vi_pham.cmnd_cccd || '\2026'));
      doc.text('H\u00e0nh vi: ' + (data.hanh_vi && data.hanh_vi.ten || '\2026'));
      const dieuKhoan = data.hanh_vi ? '\u0110i\u1ec1u ' + (data.hanh_vi.dieu || '16') + ', Kho\u1ea3n ' + (data.hanh_vi.khoan || '\2026') : '\2026';
      doc.text('\u0110i\u1ec1u/Kho\u1ea3n: ' + dieuKhoan + ' N\u0110 16/2022/N\u0110-CP');
      const diaChiVP = [data.ho_so.dia_chi, data.phuong_xa && data.phuong_xa.ten, data.quan_huyen && data.quan_huyen.ten].filter(Boolean).join(', ') || '\2026';
      doc.text('\u0110\u1ecba ch\u1ec9 vi ph\u1ea1m: ' + diaChiVP);
      doc.moveDown(0.5);
      doc.fontSize(11).font('VN-Bold').text('H\u00ecnh th\u1ee9c x\u1eed ph\u1ea1t:');
      doc.fontSize(10).font('VN').text('Ph\u1ea1t ti\u1ec1n: ' + (data.quyet_dinh.so_tien_phat != null ? Number(data.quyet_dinh.so_tien_phat).toLocaleString('vi-VN') + ' \u0111\u1ed3ng' : '\2026'));
      if (data.quyet_dinh.hinh_thuc_phat_bo_sung) doc.text('Ph\u1ea1t b\u1ed5 sung: ' + data.quyet_dinh.hinh_thuc_phat_bo_sung);
      if (data.quyet_dinh.bien_phap_khac_phuc_hau_qua) doc.text('Kh\u1eafc ph\u1ee5c h\u1eadu qu\u1ea3: ' + data.quyet_dinh.bien_phap_khac_phuc_hau_qua);
      doc.moveDown(1);
      doc.font('VN').text('Quy\u1ebft \u0111\u1ecbnh n\u00e0y c\u00f3 hi\u1ec7u l\u1ee9c k\u1ec3 t\u1eeb ng\u00e0y k\u00fd. Ng\u01b0\u1eddi vi ph\u1ea1m ph\u1ea3i ch\u1ea5p h\u00e0nh trong th\u1eddi h\u1ea1n 10 ng\u00e0y.', { align: 'justify' });
      doc.end();
      await audit(pool, req, 'export_pdf', 'quyet_dinh', data.quyet_dinh.id);
    } catch (e) { next(e); }
  });

  app.get('/api/v1/thong-ke/tong-quan' ,authenticateWithBlocklist,authorize('report.statistics'),async(_req,res,next)=>{try{const [status,district,month]=await Promise.all([pool.query('SELECT trang_thai,count(*)::int AS so_luong FROM ho_so WHERE deleted_at IS NULL GROUP BY trang_thai ORDER BY trang_thai'),pool.query('SELECT q.id,q.ten,count(h.id)::int AS so_luong FROM quan_huyen q LEFT JOIN ho_so h ON h.quan_huyen_id=q.id AND h.deleted_at IS NULL GROUP BY q.id,q.ten ORDER BY q.ten'),pool.query("SELECT to_char(date_trunc('month',created_at),'YYYY-MM') thang,count(*)::int AS so_luong FROM ho_so WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1 DESC")]);res.json({data:{theo_trang_thai:status.rows,theo_quan:district.rows,theo_thang:month.rows}});}catch(e){next(e);}});

  app.get('/api/v1/thong-ke/xuat', authenticateWithBlocklist, authorize('report.statistics'), async (req, res, next) => {
    try {
      const loai = req.query.loai || 'csv';
      const w = ['h.deleted_at IS NULL'];
      const vals = [];
      let idx = 1;
      if (req.query.trang_thai) { w.push(`h.trang_thai=$${idx++}`); vals.push(req.query.trang_thai); }
      if (req.query.quan_huyen_id) { w.push(`h.quan_huyen_id=$${idx++}`); vals.push(req.query.quan_huyen_id); }
      if (req.query.tu_ngay) { w.push(`h.created_at>=$${idx++}`); vals.push(req.query.tu_ngay); }
      if (req.query.den_ngay) { w.push(`h.created_at<=$${idx++}`); vals.push(req.query.den_ngay); }

      const r = await pool.query(
        `SELECT h.ma_ho_so, h.trang_thai, h.dia_chi, h.mo_ta, h.created_at, h.updated_at,
                q.ten AS quan_huyen, px.ten AS phuong_xa,
                nv.ten AS nguoi_vi_pham_ten, nv.sdt AS nguoi_vi_pham_sdt, nv.email AS nguoi_vi_pham_email
         FROM ho_so h
         LEFT JOIN quan_huyen q ON q.id=h.quan_huyen_id
         LEFT JOIN phuong_xa px ON px.id=h.phuong_xa_id
         LEFT JOIN nguoi_vi_pham nv ON nv.id=h.nguoi_vi_pham_id
         WHERE ${w.join(' AND ')} ORDER BY h.created_at DESC`, vals
      );

      // PII masking
      const canViewPII = req.user.permissions.includes('case.view');
      const mask = (s) => s ? s.replace(/.(?=.{4})/g, '*') : '';
      const rows = r.rows.map(row => ({
        ...row,
        nguoi_vi_pham_sdt: canViewPII ? row.nguoi_vi_pham_sdt : mask(row.nguoi_vi_pham_sdt),
        nguoi_vi_pham_email: canViewPII ? row.nguoi_vi_pham_email : mask(row.nguoi_vi_pham_email),
      }));

      if (loai === 'csv') {
        const { stringify } = require('csv-stringify/sync');
        const csv = stringify(rows, { header: true, bom: true });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="bao-cao-${new Date().toISOString().slice(0,10)}.csv"`);
        res.send(csv);
      } else if (loai === 'pdf') {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        // Register Vietnamese-capable font (Noto Sans)
        const fontRegular = path.resolve(__dirname, 'fonts', 'NotoSans-Regular.ttf');
        const fontBold = path.resolve(__dirname, 'fonts', 'NotoSans-Bold.ttf');
        doc.registerFont('VN', fontRegular);
        doc.registerFont('VN-Bold', fontBold);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="bao-cao-${new Date().toISOString().slice(0,10)}.pdf"`);
        doc.pipe(res);

        doc.fontSize(16).font('VN-Bold').text('Báo cáo thống kê hồ sơ vi phạm', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('VN').text(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`);
        doc.moveDown(1);

        // Table header
        const cols = [50, 120, 200, 300, 400, 480];
        const headers = ['Mã HS', 'Trạng thái', 'Địa chỉ', 'Quận', 'Phường', 'Ngày tạo'];
        doc.fontSize(8).font('VN-Bold');
        headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { continued: i < headers.length - 1 }));
        doc.moveDown(0.5);
        doc.font('VN');

        rows.forEach(row => {
          if (doc.y > 750) doc.addPage();
          const vals = [row.ma_ho_so, row.trang_thai, row.dia_chi?.slice(0, 30) || '', row.quan_huyen || '', row.phuong_xa || '', row.created_at instanceof Date ? row.created_at.toISOString().slice(0, 10) : String(row.created_at || '').slice(0, 10)];
          vals.forEach((v, i) => doc.text(String(v || ''), cols[i], doc.y, { continued: i < vals.length - 1 }));
          doc.moveDown(0.3);
        });

        doc.end();
      } else {
        return res.status(400).json({ error: 'Loại xuất không hợp lệ. Chỉ hỗ trợ csv và pdf.' });
      }
    } catch (e) { next(e); }
  });

  // --- Admin endpoints (require admin.users permission) ---
  app.get('/api/v1/admin/users', authenticateWithBlocklist, authorize('admin.users'), async (_req, res, next) => {
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

  app.post('/api/v1/admin/users', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { username, password, full_name, email, phone, is_active, roles } = req.body || {};
      if (!username || username.length < 3 || username.length > 50) return res.status(400).json({ error: 'Tên đăng nhập phải từ 3-50 ký tự' });
      if (!password || password.length < 8) return res.status(400).json({ error: 'Mật khẩu phải tối thiểu 8 ký tự' });
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return res.status(400).json({ error: 'Mật khẩu phải chứa cả chữ và chữ số' });
      if (!full_name?.trim()) return res.status(400).json({ error: 'Họ tên là bắt buộc' });
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
        // Assign roles
        if (roles?.length) {
          await client.query(
            `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = ANY($2)`,
            [user.id, roles]
          );
        }
        // Get permissions
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

  app.patch('/api/v1/admin/users/:id', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { full_name, email, phone, is_active, roles, password } = req.body || {};
      const userId = req.params.id;
      // Validate UUID format
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return res.status(400).json({ error: 'ID người dùng không hợp lệ' });
      if (password && (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))) return res.status(400).json({ error: 'Mật khẩu phải tối thiểu 8 ký tự, chứa cả chữ và chữ số' });
      if (roles && !Array.isArray(roles)) return res.status(400).json({ error: 'Danh sách vai trò không hợp lệ' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Check user exists
        const existing = await client.query('SELECT id, is_active FROM users WHERE id=$1', [userId]);
        if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy người dùng' }); }

        // If deactivating or removing admin role, check not last admin
        const isDeactivating = is_active === false;
        const isRemovingAdmin = roles && !roles.includes('admin');
        if (isDeactivating || isRemovingAdmin) {
          const adminCount = await client.query(
            `SELECT count(*)::int AS cnt FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.is_active=true AND u.id != $1`,
            [userId]
          );
          if (adminCount.rows[0].cnt < 1) {
            // Check if current user has admin role
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

        // If self and removing admin.users permission
        if (req.user.id === userId && isRemovingAdmin) {
          const selfAdminCount = await client.query(
            `SELECT count(*)::int AS cnt FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.is_active=true`
          );
          if (selfAdminCount.rows[0].cnt <= 1) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Không thể tự gỡ quyền quản trị khi chỉ còn 1 admin' });
          }
        }

        // Update user fields
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

        // Update roles if provided
        if (roles) {
          await client.query('DELETE FROM user_roles WHERE user_id=$1', [userId]);
          if (roles.length) {
            await client.query(
              `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = ANY($2)`,
              [userId, roles]
            );
          }
        }

        // Get updated user
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

  app.get('/api/v1/admin/roles', authenticateWithBlocklist, authorize('admin.users'), async (_req, res, next) => {
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

  app.patch('/api/v1/admin/roles/:id/permissions', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const roleId = req.params.id;
      const { permission_ids } = req.body || {};
      if (!Array.isArray(permission_ids)) return res.status(400).json({ error: 'Danh sách quyền không hợp lệ' });
      // Validate UUID format
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId)) return res.status(400).json({ error: 'ID vai trò không hợp lệ' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Check role exists
        const role = await client.query('SELECT id FROM roles WHERE id=$1', [roleId]);
        if (!role.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy vai trò' }); }
        // Verify all permission IDs exist
        if (permission_ids.length) {
          const validPerms = await client.query('SELECT id FROM permissions WHERE id = ANY($1)', [permission_ids]);
          if (validPerms.rows.length !== permission_ids.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Một hoặc nhiều quyền không tồn tại' }); }
        }
        // Replace permissions
        await client.query('DELETE FROM role_permissions WHERE role_id=$1', [roleId]);
        if (permission_ids.length) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id) SELECT $1, unnest($2::uuid[])`,
            [roleId, permission_ids]
          );
        }
        await audit(client, req, 'update_permissions', 'roles', roleId, { permission_ids });
        await client.query('COMMIT');
        // Return updated role
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

  app.get('/api/v1/admin/permissions', authenticateWithBlocklist, authorize('admin.users'), async (_req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const result = await pool.query(
        `SELECT module, json_agg(json_build_object('id', id, 'code', code, 'name', name) ORDER BY code) AS permissions
         FROM permissions GROUP BY module ORDER BY module`
      );
      res.json({ data: result.rows });
    } catch (error) { next(error); }
  });

  // GET /api/v1/admin/audit-log — list audit log with filters + pagination
  app.get('/api/v1/admin/audit-log', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
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

  // --- Admin location endpoints (require admin.locations permission) ---
  const MA_RE = /^[0-9A-Za-z-]{1,20}$/;
  const TEN_MAX = 200;

  async function parseBoundary(client, boundaryGeoJSON) {
    if (!boundaryGeoJSON) return null;
    const geoStr = typeof boundaryGeoJSON === 'string' ? boundaryGeoJSON : JSON.stringify(boundaryGeoJSON);
    const check = await client.query(
      `SELECT ST_IsValid(g) AS is_valid, GeometryType(g) AS geom_type, ST_SRID(g) AS srid
       FROM (SELECT ST_GeomFromGeoJSON($1) AS g) sub`,
      [geoStr]
    );
    const row = check.rows[0];
    if (!row) return { error: 'Boundary GeoJSON không hợp lệ' };
    if (row.geom_type !== 'MULTIPOLYGON') return { error: `Kiểu hình học phải là MULTIPOLYGON, nhận được ${row.geom_type}` };
    if (row.srid !== 4326) return { error: `SRID phải là 4326, nhận được ${row.srid}` };
    if (!row.is_valid) return { error: 'Boundary không hợp lệ (ST_IsValid = false)' };
    return { sql: `ST_GeomFromGeoJSON($1)::geometry(MultiPolygon,4326)` };
  }

  // GET /api/v1/admin/quan-huyen — list with ward count + boundary as GeoJSON
  app.get('/api/v1/admin/quan-huyen', authenticateWithBlocklist, authorize('admin.locations'), async (_req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const result = await pool.query(
        `SELECT q.id, q.ma, q.ten, q.created_at,
                (SELECT count(*)::int FROM phuong_xa px WHERE px.quan_huyen_id = q.id) AS so_phuong,
                CASE WHEN q.boundary IS NOT NULL THEN ST_AsGeoJSON(q.boundary) ELSE NULL END AS boundary
         FROM quan_huyen q ORDER BY q.ma`
      );
      res.json({ data: result.rows });
    } catch (e) { next(e); }
  });

  // POST /api/v1/admin/quan-huyen — create
  app.post('/api/v1/admin/quan-huyen', authenticateWithBlocklist, authorize('admin.locations'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { ma, ten, boundary } = req.body || {};
    if (!ma || !MA_RE.test(ma)) return res.status(400).json({ error: 'Mã phải từ 1-20 ký tự, chỉ gồm chữ, số và dấu gạch ngang' });
    if (!ten?.trim() || ten.trim().length > TEN_MAX) return res.status(400).json({ error: `Tên là bắt buộc, tối đa ${TEN_MAX} ký tự` });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Validate boundary BEFORE insert
      if (boundary) {
        const parsed = await parseBoundary(client, boundary);
        if (parsed.error) { await client.query('ROLLBACK'); return res.status(400).json({ error: parsed.error }); }
      }
      let r;
      try {
        r = await client.query(
          `INSERT INTO quan_huyen (ma, ten, boundary) VALUES ($1, $2, ${boundary ? `$3` : 'NULL'}) RETURNING id, ma, ten, created_at`,
          boundary ? [ma, ten.trim(), typeof boundary === 'string' ? boundary : JSON.stringify(boundary)] : [ma, ten.trim()]
        );
      } catch (e) {
        if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Mã "${ma}" đã tồn tại` }); }
        throw e;
      }
      await audit(client, req, 'create', 'quan_huyen', r.rows[0].id, { ma, ten: ten.trim() });
      await client.query('COMMIT');
      res.status(201).json({ data: r.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // PATCH /api/v1/admin/quan-huyen/:id — update
  app.patch('/api/v1/admin/quan-huyen/:id', authenticateWithBlocklist, authorize('admin.locations'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { ma, ten, boundary } = req.body || {};
    if (ma !== undefined && !MA_RE.test(ma)) return res.status(400).json({ error: 'Mã phải từ 1-20 ký tự, chỉ gồm chữ, số và dấu gạch ngang' });
    if (ten !== undefined && (!ten?.trim() || ten.trim().length > TEN_MAX)) return res.status(400).json({ error: `Tên không được rỗng và tối đa ${TEN_MAX} ký tự` });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, ma, ten FROM quan_huyen WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy quận/huyện' }); }

      const updates = [];
      const values = [];
      let idx = 1;
      if (ma !== undefined) { updates.push(`ma=$${idx++}`); values.push(ma); }
      if (ten !== undefined) { updates.push(`ten=$${idx++}`); values.push(ten.trim()); }
      if (boundary !== undefined) {
        if (boundary === null) {
          updates.push('boundary=NULL');
        } else {
          const parsed = await parseBoundary(client, boundary);
          if (parsed.error) { await client.query('ROLLBACK'); return res.status(400).json({ error: parsed.error }); }
          updates.push(`boundary=ST_GeomFromGeoJSON($${idx})::geometry(MultiPolygon,4326)`);
          values.push(typeof boundary === 'string' ? boundary : JSON.stringify(boundary));
          idx++;
        }
      }
      if (updates.length) {
        values.push(req.params.id);
        try {
          await client.query(`UPDATE quan_huyen SET ${updates.join(', ')} WHERE id=$${idx}`, values);
        } catch (e) {
          if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Mã "${ma}" đã tồn tại` }); }
          throw e;
        }
      }
      const result = await client.query('SELECT id, ma, ten, created_at FROM quan_huyen WHERE id=$1', [req.params.id]);
      await audit(client, req, 'update', 'quan_huyen', req.params.id, { ma: ma ?? existing.rows[0].ma, ten: ten?.trim() ?? existing.rows[0].ten });
      await client.query('COMMIT');
      res.json({ data: result.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // DELETE /api/v1/admin/quan-huyen/:id — guard 409 if has children
  app.delete('/api/v1/admin/quan-huyen/:id', authenticateWithBlocklist, authorize('admin.locations'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, ma, ten FROM quan_huyen WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy quận/huyện' }); }

      // Pre-check children
      const pxCount = (await client.query('SELECT count(*)::int AS cnt FROM phuong_xa WHERE quan_huyen_id=$1', [req.params.id])).rows[0].cnt;
      const bcCount = (await client.query('SELECT count(*)::int AS cnt FROM bao_cao_vi_pham WHERE quan_huyen_id=$1', [req.params.id])).rows[0].cnt;
      const hsCount = (await client.query('SELECT count(*)::int AS cnt FROM ho_so WHERE quan_huyen_id=$1 AND deleted_at IS NULL', [req.params.id])).rows[0].cnt;
      const total = pxCount + bcCount + hsCount;
      if (total > 0) {
        await client.query('ROLLBACK');
        const details = [];
        if (pxCount) details.push(`${pxCount} phường/xã`);
        if (bcCount) details.push(`${bcCount} báo cáo`);
        if (hsCount) details.push(`${hsCount} hồ sơ`);
        return res.status(409).json({ error: `Không thể xóa quận/huyện đang được tham chiếu: ${details.join(', ')}` });
      }

      try {
        await client.query('DELETE FROM quan_huyen WHERE id=$1', [req.params.id]);
      } catch (e) {
        if (e.code === '23503') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Không thể xóa quận/huyện đang được tham chiếu bởi dữ liệu khác' }); }
        throw e;
      }
      await audit(client, req, 'delete', 'quan_huyen', req.params.id, { ma: existing.rows[0].ma, ten: existing.rows[0].ten });
      await client.query('COMMIT');
      res.json({ message: 'Đã xóa quận/huyện' });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // GET /api/v1/admin/phuong-xa?quan_huyen_id= — list wards
  app.get('/api/v1/admin/phuong-xa', authenticateWithBlocklist, authorize('admin.locations'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const where = req.query.quan_huyen_id ? ' WHERE px.quan_huyen_id=$1' : '';
      const params = req.query.quan_huyen_id ? [req.query.quan_huyen_id] : [];
      const result = await pool.query(
        `SELECT px.id, px.ma, px.ten, px.quan_huyen_id, px.created_at,
                q.ten AS quan_huyen_ten,
                CASE WHEN px.boundary IS NOT NULL THEN ST_AsGeoJSON(px.boundary) ELSE NULL END AS boundary
         FROM phuong_xa px
         LEFT JOIN quan_huyen q ON q.id=px.quan_huyen_id
         ${where} ORDER BY px.ma`,
        params
      );
      res.json({ data: result.rows });
    } catch (e) { next(e); }
  });

  // POST /api/v1/admin/phuong-xa — create ward
  app.post('/api/v1/admin/phuong-xa', authenticateWithBlocklist, authorize('admin.locations'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { ma, ten, quan_huyen_id, boundary } = req.body || {};
    if (!ma || !MA_RE.test(ma)) return res.status(400).json({ error: 'Mã phải từ 1-20 ký tự, chỉ gồm chữ, số và dấu gạch ngang' });
    if (!ten?.trim() || ten.trim().length > TEN_MAX) return res.status(400).json({ error: `Tên là bắt buộc, tối đa ${TEN_MAX} ký tự` });
    if (!quan_huyen_id) return res.status(400).json({ error: 'quan_huyen_id là bắt buộc' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Check quan_huyen exists
      const qh = await client.query('SELECT id FROM quan_huyen WHERE id=$1', [quan_huyen_id]);
      if (!qh.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy quận/huyện' }); }

      // Validate boundary BEFORE insert
      if (boundary) {
        const parsed = await parseBoundary(client, boundary);
        if (parsed.error) { await client.query('ROLLBACK'); return res.status(400).json({ error: parsed.error }); }
      }

      let r;
      try {
        r = await client.query(
          `INSERT INTO phuong_xa (ma, ten, quan_huyen_id, boundary) VALUES ($1, $2, $3, ${boundary ? `ST_GeomFromGeoJSON($4)::geometry(MultiPolygon,4326)` : 'NULL'}) RETURNING id, ma, ten, quan_huyen_id, created_at`,
          boundary ? [ma, ten.trim(), quan_huyen_id, typeof boundary === 'string' ? boundary : JSON.stringify(boundary)] : [ma, ten.trim(), quan_huyen_id]
        );
      } catch (e) {
        if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Mã "${ma}" đã tồn tại` }); }
        throw e;
      }

      await audit(client, req, 'create', 'phuong_xa', r.rows[0].id, { ma, ten: ten.trim() });
      await client.query('COMMIT');
      res.status(201).json({ data: r.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // PATCH /api/v1/admin/phuong-xa/:id — update ward
  app.patch('/api/v1/admin/phuong-xa/:id', authenticateWithBlocklist, authorize('admin.locations'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { ma, ten, quan_huyen_id, boundary } = req.body || {};
    if (ma !== undefined && !MA_RE.test(ma)) return res.status(400).json({ error: 'Mã phải từ 1-20 ký tự, chỉ gồm chữ, số và dấu gạch ngang' });
    if (ten !== undefined && (!ten?.trim() || ten.trim().length > TEN_MAX)) return res.status(400).json({ error: `Tên không được rỗng và tối đa ${TEN_MAX} ký tự` });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, ma, ten, quan_huyen_id FROM phuong_xa WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy phường/xã' }); }

      if (quan_huyen_id !== undefined) {
        const qh = await client.query('SELECT id FROM quan_huyen WHERE id=$1', [quan_huyen_id]);
        if (!qh.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy quận/huyện' }); }
      }

      // Validate boundary if provided
      if (boundary !== undefined && boundary !== null) {
        const geoStr = typeof boundary === 'string' ? boundary : JSON.stringify(boundary);
        const check = await client.query(
          `SELECT ST_IsValid(g) AS is_valid, GeometryType(g) AS geom_type, ST_SRID(g) AS srid
           FROM (SELECT ST_GeomFromGeoJSON($1) AS g) sub`,
          [geoStr]
        );
        const row = check.rows[0];
        if (!row) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Boundary GeoJSON không hợp lệ' }); }
        if (row.geom_type !== 'MULTIPOLYGON') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Kiểu hình học phải là MULTIPOLYGON, nhận được ${row.geom_type}` }); }
        if (row.srid !== 4326) { await client.query('ROLLBACK'); return res.status(400).json({ error: `SRID phải là 4326, nhận được ${row.srid}` }); }
        if (!row.is_valid) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Boundary không hợp lệ (ST_IsValid = false)' }); }
      }

      const updates = [];
      const values = [];
      let idx = 1;
      if (ma !== undefined) { updates.push(`ma=$${idx++}`); values.push(ma); }
      if (ten !== undefined) { updates.push(`ten=$${idx++}`); values.push(ten.trim()); }
      if (quan_huyen_id !== undefined) { updates.push(`quan_huyen_id=$${idx++}`); values.push(quan_huyen_id); }
      if (boundary !== undefined) {
        if (boundary === null) {
          updates.push('boundary=NULL');
        } else {
          updates.push(`boundary=ST_GeomFromGeoJSON($${idx})::geometry(MultiPolygon,4326)`);
          values.push(typeof boundary === 'string' ? boundary : JSON.stringify(boundary));
          idx++;
        }
      }
      if (updates.length) {
        values.push(req.params.id);
        try {
          await client.query(`UPDATE phuong_xa SET ${updates.join(', ')} WHERE id=$${idx}`, values);
        } catch (e) {
          if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Mã "${ma}" đã tồn tại` }); }
          throw e;
        }
      }
      const result = await client.query('SELECT id, ma, ten, quan_huyen_id, created_at FROM phuong_xa WHERE id=$1', [req.params.id]);
      await audit(client, req, 'update', 'phuong_xa', req.params.id, { ma: ma ?? existing.rows[0].ma, ten: ten?.trim() ?? existing.rows[0].ten });
      await client.query('COMMIT');
      res.json({ data: result.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // DELETE /api/v1/admin/phuong-xa/:id — guard 409 if has children
  app.delete('/api/v1/admin/phuong-xa/:id', authenticateWithBlocklist, authorize('admin.locations'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, ma, ten FROM phuong_xa WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy phường/xã' }); }

      // Pre-check children
      const bcCount = (await client.query('SELECT count(*)::int AS cnt FROM bao_cao_vi_pham WHERE phuong_xa_id=$1', [req.params.id])).rows[0].cnt;
      const hsCount = (await client.query('SELECT count(*)::int AS cnt FROM ho_so WHERE phuong_xa_id=$1 AND deleted_at IS NULL', [req.params.id])).rows[0].cnt;
      const total = bcCount + hsCount;
      if (total > 0) {
        await client.query('ROLLBACK');
        const details = [];
        if (bcCount) details.push(`${bcCount} báo cáo`);
        if (hsCount) details.push(`${hsCount} hồ sơ`);
        return res.status(409).json({ error: `Không thể xóa phường/xã đang được tham chiếu: ${details.join(', ')}` });
      }

      try {
        await client.query('DELETE FROM phuong_xa WHERE id=$1', [req.params.id]);
      } catch (e) {
        if (e.code === '23503') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Không thể xóa phường/xã đang được tham chiếu bởi dữ liệu khác' }); }
        throw e;
      }
      await audit(client, req, 'delete', 'phuong_xa', req.params.id, { ma: existing.rows[0].ma, ten: existing.rows[0].ten });
      await client.query('COMMIT');
      res.json({ message: 'Đã xóa phường/xã' });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // --- Admin catalog endpoints (loai_vi_pham, hanh_vi_vi_pham, muc_phat) ---
  // Uses admin.users permission (spec: menu gated by admin.users)

  // GET /api/v1/admin/loai-vi-pham — list all violation types
  app.get('/api/v1/admin/loai-vi-pham', authenticateWithBlocklist, authorize('admin.users'), async (_req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const result = await pool.query('SELECT id, code, ten, mo_ta, so_thu_tu, created_at FROM loai_vi_pham ORDER BY so_thu_tu, ten');
      res.json({ data: result.rows });
    } catch (e) { next(e); }
  });

  // POST /api/v1/admin/loai-vi-pham — create violation type
  app.post('/api/v1/admin/loai-vi-pham', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { code, ten, mo_ta, so_thu_tu } = req.body || {};
    if (!code?.trim()) return res.status(400).json({ error: 'Mã là bắt buộc' });
    if (code.trim().length > 30) return res.status(400).json({ error: 'Mã tối đa 30 ký tự' });
    if (!ten?.trim()) return res.status(400).json({ error: 'Tên là bắt buộc' });
    if (ten.trim().length > 300) return res.status(400).json({ error: 'Tên tối đa 300 ký tự' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let r;
      try {
        r = await client.query(
          'INSERT INTO loai_vi_pham (code, ten, mo_ta, so_thu_tu) VALUES ($1, $2, $3, $4) RETURNING id, code, ten, mo_ta, so_thu_tu, created_at',
          [code.trim(), ten.trim(), mo_ta?.trim() || null, Number(so_thu_tu) || 0]
        );
      } catch (e) {
        if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Mã "${code}" đã tồn tại` }); }
        throw e;
      }
      await audit(client, req, 'create', 'loai_vi_pham', r.rows[0].id, { code: code.trim(), ten: ten.trim() });
      await client.query('COMMIT');
      res.status(201).json({ data: r.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // PATCH /api/v1/admin/loai-vi-pham/:id — update violation type
  app.patch('/api/v1/admin/loai-vi-pham/:id', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { code, ten, mo_ta, so_thu_tu } = req.body || {};
    if (code !== undefined && (!code?.trim() || code.trim().length > 30)) return res.status(400).json({ error: 'Mã không được rỗng và tối đa 30 ký tự' });
    if (ten !== undefined && (!ten?.trim() || ten.trim().length > 300)) return res.status(400).json({ error: 'Tên không được rỗng và tối đa 300 ký tự' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, code, ten FROM loai_vi_pham WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy loại vi phạm' }); }
      const updates = [];
      const values = [];
      let idx = 1;
      if (code !== undefined) { updates.push(`code=$${idx++}`); values.push(code.trim()); }
      if (ten !== undefined) { updates.push(`ten=$${idx++}`); values.push(ten.trim()); }
      if (mo_ta !== undefined) { updates.push(`mo_ta=$${idx++}`); values.push(mo_ta?.trim() || null); }
      if (so_thu_tu !== undefined) { updates.push(`so_thu_tu=$${idx++}`); values.push(Number(so_thu_tu) || 0); }
      if (updates.length) {
        values.push(req.params.id);
        try {
          await client.query(`UPDATE loai_vi_pham SET ${updates.join(', ')} WHERE id=$${idx}`, values);
        } catch (e) {
          if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Mã "${code}" đã tồn tại` }); }
          throw e;
        }
      }
      const result = await client.query('SELECT id, code, ten, mo_ta, so_thu_tu, created_at FROM loai_vi_pham WHERE id=$1', [req.params.id]);
      await audit(client, req, 'update', 'loai_vi_pham', req.params.id, {});
      await client.query('COMMIT');
      res.json({ data: result.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // DELETE /api/v1/admin/loai-vi-pham/:id — guard 409 if has child hanh_vi
  app.delete('/api/v1/admin/loai-vi-pham/:id', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, code, ten FROM loai_vi_pham WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy loại vi phạm' }); }
      const hvCount = (await client.query('SELECT count(*)::int AS cnt FROM hanh_vi_vi_pham WHERE loai_vi_pham_id=$1', [req.params.id])).rows[0].cnt;
      if (hvCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Không thể xóa loại vi phạm đang có ${hvCount} hành vi vi phạm` });
      }
      await client.query('DELETE FROM loai_vi_pham WHERE id=$1', [req.params.id]);
      await audit(client, req, 'delete', 'loai_vi_pham', req.params.id, { code: existing.rows[0].code, ten: existing.rows[0].ten });
      await client.query('COMMIT');
      res.json({ message: 'Đã xóa loại vi phạm' });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // GET /api/v1/admin/hanh-vi — list all violation behaviors
  app.get('/api/v1/admin/hanh-vi', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const where = req.query.loai_vi_pham_id ? ' WHERE hv.loai_vi_pham_id=$1' : '';
      const params = req.query.loai_vi_pham_id ? [req.query.loai_vi_pham_id] : [];
      const result = await pool.query(
        `SELECT hv.id, hv.loai_vi_pham_id, hv.dieu, hv.khoan, hv.diem, hv.ten, hv.mo_ta, hv.is_active, hv.created_at,
                lvp.ten AS loai_vi_pham_ten
         FROM hanh_vi_vi_pham hv LEFT JOIN loai_vi_pham lvp ON lvp.id=hv.loai_vi_pham_id${where} ORDER BY hv.dieu, hv.khoan, hv.diem`,
        params
      );
      res.json({ data: result.rows });
    } catch (e) { next(e); }
  });

  // POST /api/v1/admin/hanh-vi — create violation behavior
  app.post('/api/v1/admin/hanh-vi', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { loai_vi_pham_id, dieu, khoan, diem, ten, mo_ta, is_active } = req.body || {};
    if (!loai_vi_pham_id) return res.status(400).json({ error: 'Loại vi phạm là bắt buộc' });
    if (!khoan?.trim()) return res.status(400).json({ error: 'Khoản là bắt buộc' });
    if (!ten?.trim()) return res.status(400).json({ error: 'Tên là bắt buộc' });
    if (ten.trim().length > 500) return res.status(400).json({ error: 'Tên tối đa 500 ký tự' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Verify parent exists
      const parent = await client.query('SELECT id FROM loai_vi_pham WHERE id=$1', [loai_vi_pham_id]);
      if (!parent.rows[0]) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Loại vi phạm không tồn tại' }); }
      let r;
      try {
        r = await client.query(
          'INSERT INTO hanh_vi_vi_pham (loai_vi_pham_id, dieu, khoan, diem, ten, mo_ta, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, loai_vi_pham_id, dieu, khoan, diem, ten, mo_ta, is_active, created_at',
          [loai_vi_pham_id, dieu?.trim() || '16', khoan.trim(), diem?.trim() || null, ten.trim(), mo_ta?.trim() || null, is_active !== false]
        );
      } catch (e) {
        if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Điều ${dieu || '16'}, khoản ${khoan}, điểm ${diem || '—'} đã tồn tại` }); }
        throw e;
      }
      await audit(client, req, 'create', 'hanh_vi_vi_pham', r.rows[0].id, { khoan: khoan.trim(), ten: ten.trim() });
      await client.query('COMMIT');
      res.status(201).json({ data: r.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // PATCH /api/v1/admin/hanh-vi/:id — update violation behavior
  app.patch('/api/v1/admin/hanh-vi/:id', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { loai_vi_pham_id, dieu, khoan, diem, ten, mo_ta, is_active } = req.body || {};
    if (ten !== undefined && (!ten?.trim() || ten.trim().length > 500)) return res.status(400).json({ error: 'Tên không được rỗng và tối đa 500 ký tự' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, khoan, ten FROM hanh_vi_vi_pham WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy hành vi vi phạm' }); }
      if (loai_vi_pham_id !== undefined) {
        const parent = await client.query('SELECT id FROM loai_vi_pham WHERE id=$1', [loai_vi_pham_id]);
        if (!parent.rows[0]) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Loại vi phạm không tồn tại' }); }
      }
      const updates = [];
      const values = [];
      let idx = 1;
      if (loai_vi_pham_id !== undefined) { updates.push(`loai_vi_pham_id=$${idx++}`); values.push(loai_vi_pham_id); }
      if (dieu !== undefined) { updates.push(`dieu=$${idx++}`); values.push(dieu.trim()); }
      if (khoan !== undefined) { updates.push(`khoan=$${idx++}`); values.push(khoan.trim()); }
      if (diem !== undefined) { updates.push(`diem=$${idx++}`); values.push(diem?.trim() || null); }
      if (ten !== undefined) { updates.push(`ten=$${idx++}`); values.push(ten.trim()); }
      if (mo_ta !== undefined) { updates.push(`mo_ta=$${idx++}`); values.push(mo_ta?.trim() || null); }
      if (is_active !== undefined) { updates.push(`is_active=$${idx++}`); values.push(Boolean(is_active)); }
      if (updates.length) {
        values.push(req.params.id);
        try {
          await client.query(`UPDATE hanh_vi_vi_pham SET ${updates.join(', ')} WHERE id=$${idx}`, values);
        } catch (e) {
          if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Điều/khoản/điểm đã tồn tại' }); }
          throw e;
        }
      }
      const result = await client.query(
        `SELECT hv.id, hv.loai_vi_pham_id, hv.dieu, hv.khoan, hv.diem, hv.ten, hv.mo_ta, hv.is_active, hv.created_at,
                lvp.ten AS loai_vi_pham_ten
         FROM hanh_vi_vi_pham hv LEFT JOIN loai_vi_pham lvp ON lvp.id=hv.loai_vi_pham_id WHERE hv.id=$1`,
        [req.params.id]
      );
      await audit(client, req, 'update', 'hanh_vi_vi_pham', req.params.id, {});
      await client.query('COMMIT');
      res.json({ data: result.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // DELETE /api/v1/admin/hanh-vi/:id — guard 409 if has child muc_phat
  app.delete('/api/v1/admin/hanh-vi/:id', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, khoan, ten FROM hanh_vi_vi_pham WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy hành vi vi phạm' }); }
      const mpCount = (await client.query('SELECT count(*)::int AS cnt FROM muc_phat WHERE hanh_vi_id=$1', [req.params.id])).rows[0].cnt;
      if (mpCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Không thể xóa hành vi đang có ${mpCount} mức phạt` });
      }
      await client.query('DELETE FROM hanh_vi_vi_pham WHERE id=$1', [req.params.id]);
      await audit(client, req, 'delete', 'hanh_vi_vi_pham', req.params.id, { khoan: existing.rows[0].khoan, ten: existing.rows[0].ten });
      await client.query('COMMIT');
      res.json({ message: 'Đã xóa hành vi vi phạm' });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // GET /api/v1/admin/muc-phat — list all fine levels
  app.get('/api/v1/admin/muc-phat', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const where = req.query.hanh_vi_id ? ' WHERE mp.hanh_vi_id=$1' : '';
      const params = req.query.hanh_vi_id ? [req.query.hanh_vi_id] : [];
      const result = await pool.query(
        `SELECT mp.id, mp.hanh_vi_id, mp.nhom_cong_trinh, mp.muc_toi_thieu, mp.muc_toi_da, mp.created_at,
                hv.khoan, hv.ten AS hanh_vi_ten, hv.dieu, hv.diem
         FROM muc_phat mp LEFT JOIN hanh_vi_vi_pham hv ON hv.id=mp.hanh_vi_id${where} ORDER BY hv.khoan, mp.nhom_cong_trinh`,
        params
      );
      res.json({ data: result.rows });
    } catch (e) { next(e); }
  });

  // POST /api/v1/admin/muc-phat — create fine level
  app.post('/api/v1/admin/muc-phat', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da } = req.body || {};
    if (!hanh_vi_id) return res.status(400).json({ error: 'Hành vi vi phạm là bắt buộc' });
    if (![1, 2, 3].includes(Number(nhom_cong_trinh))) return res.status(400).json({ error: 'Nhóm công trình phải là 1, 2 hoặc 3' });
    if (muc_toi_thieu == null || Number(muc_toi_thieu) < 0) return res.status(400).json({ error: 'Mức tối thiểu phải >= 0' });
    if (muc_toi_da == null || Number(muc_toi_da) < Number(muc_toi_thieu)) return res.status(400).json({ error: 'Mức tối đa phải >= mức tối thiểu' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const parent = await client.query('SELECT id FROM hanh_vi_vi_pham WHERE id=$1', [hanh_vi_id]);
      if (!parent.rows[0]) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Hành vi vi phạm không tồn tại' }); }
      let r;
      try {
        r = await client.query(
          'INSERT INTO muc_phat (hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da) VALUES ($1, $2, $3, $4) RETURNING id, hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da, created_at',
          [hanh_vi_id, Number(nhom_cong_trinh), Number(muc_toi_thieu), Number(muc_toi_da)]
        );
      } catch (e) {
        if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Mức phạt cho hành vi + nhóm công trình này đã tồn tại' }); }
        throw e;
      }
      await audit(client, req, 'create', 'muc_phat', r.rows[0].id, { hanh_vi_id, nhom_cong_trinh: Number(nhom_cong_trinh) });
      await client.query('COMMIT');
      res.status(201).json({ data: r.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // PATCH /api/v1/admin/muc-phat/:id — update fine level
  app.patch('/api/v1/admin/muc-phat/:id', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const { hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da } = req.body || {};
    if (nhom_cong_trinh !== undefined && ![1, 2, 3].includes(Number(nhom_cong_trinh))) return res.status(400).json({ error: 'Nhóm công trình phải là 1, 2 hoặc 3' });
    if (muc_toi_thieu !== undefined && Number(muc_toi_thieu) < 0) return res.status(400).json({ error: 'Mức tối thiểu phải >= 0' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, hanh_vi_id, nhom_cong_trinh FROM muc_phat WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy mức phạt' }); }
      if (hanh_vi_id !== undefined) {
        const parent = await client.query('SELECT id FROM hanh_vi_vi_pham WHERE id=$1', [hanh_vi_id]);
        if (!parent.rows[0]) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Hành vi vi phạm không tồn tại' }); }
      }
      const updates = [];
      const values = [];
      let idx = 1;
      if (hanh_vi_id !== undefined) { updates.push(`hanh_vi_id=$${idx++}`); values.push(hanh_vi_id); }
      if (nhom_cong_trinh !== undefined) { updates.push(`nhom_cong_trinh=$${idx++}`); values.push(Number(nhom_cong_trinh)); }
      if (muc_toi_thieu !== undefined) { updates.push(`muc_toi_thieu=$${idx++}`); values.push(Number(muc_toi_thieu)); }
      if (muc_toi_da !== undefined) { updates.push(`muc_toi_da=$${idx++}`); values.push(Number(muc_toi_da)); }
      if (updates.length) {
        values.push(req.params.id);
        try {
          await client.query(`UPDATE muc_phat SET ${updates.join(', ')} WHERE id=$${idx}`, values);
        } catch (e) {
          if (e.code === '23505') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Mức phạt cho hành vi + nhóm công trình này đã tồn tại' }); }
          throw e;
        }
      }
      const result = await client.query('SELECT id, hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da, created_at FROM muc_phat WHERE id=$1', [req.params.id]);
      await audit(client, req, 'update', 'muc_phat', req.params.id, {});
      await client.query('COMMIT');
      res.json({ data: result.rows[0] });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // DELETE /api/v1/admin/muc-phat/:id — delete fine level
  app.delete('/api/v1/admin/muc-phat/:id', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id, hanh_vi_id, nhom_cong_trinh FROM muc_phat WHERE id=$1', [req.params.id]);
      if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy mức phạt' }); }
      await client.query('DELETE FROM muc_phat WHERE id=$1', [req.params.id]);
      await audit(client, req, 'delete', 'muc_phat', req.params.id, {});
      await client.query('COMMIT');
      res.json({ message: 'Đã xóa mức phạt' });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // =========================================================================
  // T51: FORGOT PASSWORD / RESET PASSWORD
  // =========================================================================
  // Rate limit for forgot/reset password — separate from login limiter to avoid test collision
  const forgotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 200),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }
  });
  app.use('/api/v1/auth/forgot-password', forgotLimiter);
  app.use('/api/v1/auth/reset-password', forgotLimiter);

  app.post('/api/v1/auth/forgot-password', async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { identifier } = req.body || {};
      if (!identifier?.trim()) return res.status(400).json({ error: 'Tên đăng nhập hoặc email là bắt buộc' });

      // Look up user by username or email
      const user = (await pool.query(
        'SELECT id, username FROM users WHERE (username=$1 OR email=$1) AND is_active=true LIMIT 1',
        [identifier.trim()]
      )).rows[0];

      // Always return success to prevent user enumeration
      if (!user) return res.json({ message: 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' });

      // Generate token, hash it, store
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await pool.query(
        'INSERT INTO reset_token (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      // Audit
      await pool.query(
        "INSERT INTO audit_log (nguoi_dung_id, hanh_dong, bang_bi_tac_dong, id_ban_ghi, chi_tiet, ip) VALUES ($1, 'forgot_password', 'users', $2, $3, $4)",
        [user.id, user.id, JSON.stringify({ username: user.username }), req.ip]
      );

      // Production: send email with reset link
      if (process.env.SMTP_HOST) {
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
        const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
        try {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: Number(process.env.SMTP_PORT || 587) === 465,
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
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
        return res.json({ message: 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' });
      }

      // Dev/Test: return token for manual testing
      res.json({ message: 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.', dev_token: rawToken });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/auth/reset-password', async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    try {
      const { token, new_password } = req.body || {};
      if (!token) return res.status(400).json({ error: 'Token là bắt buộc' });
      if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Mật khẩu phải tối thiểu 8 ký tự' });
      if (!/[a-zA-Z]/.test(new_password) || !/[0-9]/.test(new_password))
        return res.status(400).json({ error: 'Mật khẩu phải chứa cả chữ và chữ số' });

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const result = await pool.query(
        'SELECT id, user_id, expires_at, used FROM reset_token WHERE token_hash=$1',
        [tokenHash]
      );
      const record = result.rows[0];
      if (!record || record.used || new Date(record.expires_at) < new Date())
        return res.status(400).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });

      // Update password
      const passwordHash = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, record.user_id]);
      // Mark token as used
      await pool.query('UPDATE reset_token SET used=true WHERE id=$1', [record.id]);
      // Audit
      await pool.query(
        "INSERT INTO audit_log (nguoi_dung_id, hanh_dong, bang_bi_tac_dong, id_ban_ghi, chi_tiet, ip) VALUES ($1, 'reset_password', 'users', $2, $3, $4)",
        [record.user_id, record.user_id, JSON.stringify({}), req.ip]
      );

      res.json({ message: 'Đặt lại mật khẩu thành công' });
    } catch (error) { next(error); }
  });

  // =========================================================================
  // T21: THÔNG BÁO (Notifications)
  // =========================================================================

  // Helper: create notifications for users
  async function createThongBao(clientOrPool, { nguoi_nhan_id, ho_so_id, loai, tieu_de, noi_dung }) {
    await clientOrPool.query(
      'INSERT INTO thong_bao (nguoi_nhan_id, ho_so_id, loai, tieu_de, noi_dung, kenh, trang_thai) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [nguoi_nhan_id, ho_so_id || null, loai, tieu_de, noi_dung || null, 'in_app', 'chua_doc']
    );
  }

  // GET /api/v1/thong-bao — list notifications for current user (paginated)
  app.get('/api/v1/thong-bao', authenticateWithBlocklist, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const page = Math.max(Number(req.query.page) || 1, 1);
      const offset = (page - 1) * limit;
      const r = await pool.query(
        `SELECT id, ho_so_id, loai, tieu_de, noi_dung, trang_thai, created_at
         FROM thong_bao WHERE nguoi_nhan_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      );
      const count = await pool.query('SELECT count(*)::int AS total FROM thong_bao WHERE nguoi_nhan_id=$1', [req.user.id]);
      res.json({ data: r.rows, total: count.rows[0].total, page, limit });
    } catch (e) { next(e); }
  });

  // GET /api/v1/thong-bao/unread-count
  app.get('/api/v1/thong-bao/unread-count', authenticateWithBlocklist, async (req, res, next) => {
    try {
      const r = await pool.query(
        "SELECT count(*)::int AS count FROM thong_bao WHERE nguoi_nhan_id=$1 AND trang_thai='chua_doc'",
        [req.user.id]
      );
      res.json({ count: r.rows[0].count });
    } catch (e) { next(e); }
  });

  // POST /api/v1/thong-bao/:id/mark-read
  app.post('/api/v1/thong-bao/:id/mark-read', authenticateWithBlocklist, async (req, res, next) => {
    try {
      const r = await pool.query(
        "UPDATE thong_bao SET trang_thai='da_doc' WHERE id=$1 AND nguoi_nhan_id=$2 RETURNING id",
        [req.params.id, req.user.id]
      );
      if (!r.rows[0]) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
      res.json({ message: 'Đã đánh dấu đã đọc' });
    } catch (e) { next(e); }
  });

  // POST /api/v1/thong-bao/mark-all-read
  app.post('/api/v1/thong-bao/mark-all-read', authenticateWithBlocklist, async (req, res, next) => {
    try {
      await pool.query(
        "UPDATE thong_bao SET trang_thai='da_doc' WHERE nguoi_nhan_id=$1 AND trang_thai='chua_doc'",
        [req.user.id]
      );
      res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
    } catch (e) { next(e); }
  });

  // Auto-notify on status transition — helper callable from route handlers above

  // =========================================================================
  // T22: BẢN ĐỒ TOÀN CỤC (Global Map)
  // =========================================================================
  app.get('/api/v1/ban-do/vi-pham', authenticateWithBlocklist, authorize('case.view'), async (req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT h.id, h.ma_ho_so, h.trang_thai, h.dia_chi, h.mo_ta, ${pointSelect('h')},
                lvp.ten AS loai_vi_pham_ten
         FROM ho_so h
         LEFT JOIN loai_vi_pham lvp ON lvp.id=h.loai_vi_pham_id
         WHERE h.deleted_at IS NULL AND h.toa_do IS NOT NULL
         ORDER BY h.created_at DESC`
      );
      res.json({ data: r.rows });
    } catch (e) { next(e); }
  });

  app.use((error,_req,res,_next)=>{if(error instanceof multer.MulterError)return res.status(400).json({error:`Tải tệp thất bại: ${error.message}`}); console.error(error); return res.status(500).json({error:'Lỗi máy chủ nội bộ'});});
  return app;
}
function createPool() { return new Pool({ host: process.env.PGHOST, port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined, database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD || undefined }); }
if (require.main === module) { const pool=createPool(); const port=Number(process.env.PORT||3000); const host=process.env.HOST||'0.0.0.0'; buildApp({pool}).listen(port,host,()=>console.log(`QLTTXD API đang nghe tại http://${host}:${port}`)); }
module.exports={buildApp,createPool,authenticate,authorize,coordinate,TokenBlocklist};
