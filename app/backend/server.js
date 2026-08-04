require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
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
const TRANSITIONS = {
  cho_tiep_nhan: ['cho_xac_minh', 'da_huy'], cho_xac_minh: ['dang_xac_minh', 'cho_bo_sung', 'da_huy'],
  dang_xac_minh: ['cho_bo_sung', 'cho_lap_bien_ban', 'da_huy'], cho_bo_sung: ['cho_xac_minh', 'da_huy'],
  cho_lap_bien_ban: ['da_lap_bien_ban', 'da_huy'], da_lap_bien_ban: ['cho_ra_quyet_dinh'],
  cho_ra_quyet_dinh: ['da_ra_quyet_dinh'], da_ra_quyet_dinh: ['dang_khac_phuc', 'da_dong'],
  dang_khac_phuc: ['da_khac_phuc'], da_khac_phuc: ['da_dong'], cho_duyet_dieu_81: ['cho_lap_bien_ban', 'da_huy'],
};

function requirePool(pool, res) { if (!pool) { res.status(503).json({ error: 'Cơ sở dữ liệu chưa sẵn sàng' }); return false; } return true; }
function coordinate(body) {
  const lat = Number(body.latitude); const lng = Number(body.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}
function secret() { return process.env.JWT_SECRET; }
function makeAuthenticate(blocklist) {
  return function authenticate(req, res, next) {
    const value = req.get('authorization') || ''; const bearerToken = value.startsWith('Bearer ') ? value.slice(7) : null;
    const xAuthToken = req.get('x-auth-token');
    const token = bearerToken || xAuthToken;
    if (!token) return res.status(401).json({ error: 'Thiếu mã xác thực' });
    try {
      const decoded = jwt.verify(token, secret());
      if (blocklist.has(decoded.jti)) return res.status(401).json({ error: 'Mã xác thực đã bị thu hồi' });
      req.user = decoded;
      return next();
    } catch { return res.status(401).json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn' }); }
  };
}
// backward-compatible default (no blocklist) for tests that import authenticate directly
const authenticate = makeAuthenticate({ has() { return false; } });
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

function buildApp({ pool }) {
  if (!secret() || secret().length < 32) throw new Error('JWT_SECRET phải được cấu hình tối thiểu 32 ký tự');
  const tokenBlocklist = new TokenBlocklist();
  const authenticateWithBlocklist = makeAuthenticate(tokenBlocklist);
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const requestId = req.get('X-Request-Id') || crypto.randomUUID();
    req.requestId = requestId;
    res.set({
      'X-Request-Id': requestId,
      'Content-Security-Policy': "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' https://*.tile.openstreetmap.org data:",
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    });
    next();
  });
  app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((x) => x.trim()), methods: ['GET', 'POST', 'PATCH'] } : { origin: false }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

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
  app.post('/api/v1/auth/logout', authenticateWithBlocklist, (req, res) => {
    if (req.user.jti) tokenBlocklist.add(req.user.jti);
    return res.json({ message: 'Đăng xuất thành công' });
  });
  app.get('/api/v1/auth/me', authenticateWithBlocklist, (req, res) => res.json({ user: req.user }));

  app.get('/uploads/:filename', authenticateWithBlocklist, async (req, res, next) => {
    try {
      const filename = req.params.filename;
      if (!/^\d{13}-[0-9a-f-]{36}\.(?:jpe?g|png|gif|webp)$/i.test(filename)) return res.status(404).json({ error: 'Không tìm thấy tệp' });
      const attachment = await pool.query("SELECT b.nguoi_gui_id FROM tep_dinh_kem t JOIN bao_cao_vi_pham b ON t.entity_type='bao_cao' AND b.id=t.entity_id WHERE t.duong_dan=$1", [`/uploads/${filename}`]);
      if (!attachment.rows[0]) return res.status(404).json({ error: 'Không tìm thấy tệp' });
      if (!req.user.permissions.includes('case.view') && attachment.rows[0].nguoi_gui_id !== req.user.id) return res.status(403).json({ error: 'Bạn không có quyền xem tệp này' });
      return res.sendFile(path.join(uploadDirectory, filename), { dotfiles: 'deny' }, (error) => { if (error) next(error); });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/danh-muc/loai-vi-pham', async (_req, res, next) => { try { res.json({ data: (await pool.query('SELECT * FROM loai_vi_pham ORDER BY so_thu_tu,ten')).rows }); } catch (e) { next(e); } });
  app.get('/api/v1/danh-muc/hanh-vi', async (req, res, next) => { try { const q = req.query.loai_vi_pham_id ? [' WHERE loai_vi_pham_id=$1', [req.query.loai_vi_pham_id]] : ['', []]; res.json({ data: (await pool.query(`SELECT * FROM hanh_vi_vi_pham${q[0]} ORDER BY khoan`, q[1])).rows }); } catch (e) { next(e); } });
  app.get('/api/v1/danh-muc/muc-phat', async (req, res, next) => { try { const q = req.query.hanh_vi_id ? [' WHERE hanh_vi_id=$1', [req.query.hanh_vi_id]] : ['', []]; res.json({ data: (await pool.query(`SELECT * FROM muc_phat${q[0]} ORDER BY nhom_cong_trinh`, q[1])).rows }); } catch (e) { next(e); } });
  app.get('/api/v1/danh-muc/quan-huyen', async (_req, res, next) => { try { res.json({ data: (await pool.query('SELECT id,ma,ten FROM quan_huyen ORDER BY ma')).rows }); } catch (e) { next(e); } });
  app.get('/api/v1/danh-muc/phuong-xa', async (req, res, next) => { try { const q = req.query.quan_huyen_id ? [' WHERE quan_huyen_id=$1', [req.query.quan_huyen_id]] : ['', []]; res.json({ data: (await pool.query(`SELECT id,ma,ten,quan_huyen_id FROM phuong_xa${q[0]} ORDER BY ma`, q[1])).rows }); } catch (e) { next(e); } });

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
  app.get('/api/v1/bao-cao', authenticateWithBlocklist, authorize('report.view_own'), async (req, res, next) => { try { const all = req.user.permissions.includes('case.view'); const r = await pool.query(`SELECT id,ma_bao_cao,nguoi_gui_ten,mo_ta,dia_chi,created_at,${pointSelect()} FROM bao_cao_vi_pham ${all ? '' : 'WHERE nguoi_gui_id=$1'} ORDER BY created_at DESC`, all ? [] : [req.user.id]); res.json({ data: r.rows }); } catch (e) { next(e); } });

  app.post('/api/v1/ho-so', authenticateWithBlocklist, authorize('case.update'), async (req, res, next) => {
    const b = req.body || {}; const client = await pool.connect();
    try { await client.query('BEGIN'); let offender = null; if (b.nguoi_vi_pham?.ten && b.nguoi_vi_pham?.loai_chu_the) offender = (await client.query('INSERT INTO nguoi_vi_pham (loai_chu_the,ten,cmnd_cccd,dia_chi,sdt,email,nguoi_dai_dien) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',[b.nguoi_vi_pham.loai_chu_the,b.nguoi_vi_pham.ten,b.nguoi_vi_pham.cmnd_cccd||null,b.nguoi_vi_pham.dia_chi||null,b.nguoi_vi_pham.sdt||null,b.nguoi_vi_pham.email||null,b.nguoi_vi_pham.nguoi_dai_dien||null])).rows[0].id;
      const code = await nextCode(client, 'HS'); const pos = coordinate(b);
      const r = await client.query(`INSERT INTO ho_so (ma_ho_so,bao_cao_id,loai_vi_pham_id,hanh_vi_id,nguoi_nop_id,nguoi_vi_pham_id,dia_chi,quan_huyen_id,phuong_xa_id,toa_do,thoi_gian_xay_ra,mo_ta,muc_phat_du_kien,dang_thi_cong,ghi_chu) SELECT $1,$2,$3,$4,$5,$6,COALESCE($7,bc.dia_chi),COALESCE($8,bc.quan_huyen_id),COALESCE($9,bc.phuong_xa_id),CASE WHEN $10::float IS NULL THEN bc.toa_do ELSE ST_SetSRID(ST_MakePoint($10,$11),4326) END,COALESCE($12,bc.thoi_gian_xay_ra),COALESCE($13,bc.mo_ta),$14,COALESCE($15,false),$16 FROM (SELECT 1) x LEFT JOIN bao_cao_vi_pham bc ON bc.id=$2 RETURNING id,ma_ho_so,trang_thai,${pointSelect()}`,[code,b.bao_cao_id||null,b.loai_vi_pham_id||null,b.hanh_vi_id||null,req.user.id,offender,b.dia_chi||null,b.quan_huyen_id||null,b.phuong_xa_id||null,pos?.lng||null,pos?.lat||null,b.thoi_gian_xay_ra||null,b.mo_ta||null,b.muc_phat_du_kien||null,b.dang_thi_cong,b.ghi_chu||null]);
      await audit(client, req, 'create', 'ho_so', r.rows[0].id); await client.query('COMMIT'); res.status(201).json({ data: r.rows[0] });
    } catch(e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });
  app.get('/api/v1/ho-so', authenticateWithBlocklist, authorize('case.view'), async (req, res, next) => { try { const vals=[]; const add=(sql,v)=>{vals.push(v);return `${sql}$${vals.length}`}; const w=['deleted_at IS NULL']; if(req.query.trang_thai)w.push(add('trang_thai=',req.query.trang_thai)); if(req.query.quan_huyen_id)w.push(add('quan_huyen_id=',req.query.quan_huyen_id)); if(req.query.tu_ngay)w.push(add('created_at>=',req.query.tu_ngay)); if(req.query.den_ngay)w.push(add('created_at<=',req.query.den_ngay)); if(req.query.q)w.push(add('(ma_ho_so ILIKE ',`%${req.query.q}%`) + ` OR mo_ta ILIKE $${vals.length})`); const limit=Math.min(Math.max(Number(req.query.limit)||20,1),100),page=Math.max(Number(req.query.page)||1,1); vals.push(limit,(page-1)*limit); const r=await pool.query(`SELECT id,ma_ho_so,trang_thai,dia_chi,created_at,updated_at,${pointSelect()} FROM ho_so WHERE ${w.join(' AND ')} ORDER BY created_at DESC LIMIT $${vals.length-1} OFFSET $${vals.length}`,vals); res.json({data:r.rows,page,limit}); } catch(e){next(e);} });
  app.get('/api/v1/ho-so/:id', authenticateWithBlocklist, authorize('case.view'), async (req,res,next)=>{try { const h=await pool.query(`SELECT h.*,${pointSelect('h')},row_to_json(bc) bao_cao,row_to_json(nvp) nguoi_vi_pham FROM ho_so h LEFT JOIN bao_cao_vi_pham bc ON bc.id=h.bao_cao_id LEFT JOIN nguoi_vi_pham nvp ON nvp.id=h.nguoi_vi_pham_id WHERE h.id=$1 AND h.deleted_at IS NULL`,[req.params.id]); if(!h.rows[0])return res.status(404).json({error:'Không tìm thấy hồ sơ'}); const [bb,qd]=await Promise.all([pool.query('SELECT * FROM bien_ban WHERE ho_so_id=$1 ORDER BY created_at',[req.params.id]),pool.query('SELECT * FROM quyet_dinh WHERE ho_so_id=$1 ORDER BY created_at',[req.params.id])]); res.json({data:{...h.rows[0],bien_ban:bb.rows,quyet_dinh:qd.rows}});}catch(e){next(e);}});
  app.patch('/api/v1/ho-so/:id/trang-thai', authenticateWithBlocklist, authorize('case.update'), async(req,res,next)=>{try {const nextState=req.body?.trang_thai;if(!STATES.has(nextState))return res.status(400).json({error:'Trạng thái hồ sơ không hợp lệ'});const old=(await pool.query('SELECT trang_thai FROM ho_so WHERE id=$1',[req.params.id])).rows[0];if(!old)return res.status(404).json({error:'Không tìm thấy hồ sơ'});if(!TRANSITIONS[old.trang_thai]?.includes(nextState))return res.status(400).json({error:'Chuyển trạng thái không hợp lệ'});const r=await pool.query('UPDATE ho_so SET trang_thai=$1 WHERE id=$2 RETURNING id,ma_ho_so,trang_thai,updated_at',[nextState,req.params.id]);await audit(pool,req,'update_status','ho_so',req.params.id,{from:old.trang_thai,to:nextState});res.json({data:r.rows[0]});}catch(e){next(e);}});

  app.post('/api/v1/ho-so/:id/bien-ban',authenticateWithBlocklist,authorize('bien_ban.create'),async(req,res,next)=>{try{const h=(await pool.query('SELECT * FROM ho_so WHERE id=$1',[req.params.id])).rows[0];if(!h)return res.status(404).json({error:'Không tìm thấy hồ sơ'});if(h.trang_thai!=='cho_lap_bien_ban')return res.status(400).json({error:'Hồ sơ phải ở trạng thái chờ lập biên bản'});const code=await nextCode(pool,'BB');const r=await pool.query("INSERT INTO bien_ban (ma_bien_ban,ho_so_id,nguoi_lap_id,nguoi_vi_pham_id,hanh_vi_id,noi_dung,muc_phat_du_kien) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",[code,h.id,req.user.id,h.nguoi_vi_pham_id,h.hanh_vi_id,req.body?.noi_dung||null,req.body?.muc_phat_du_kien||null]);await pool.query("UPDATE ho_so SET trang_thai='da_lap_bien_ban' WHERE id=$1",[h.id]);await audit(pool,req,'create','bien_ban',r.rows[0].id);res.status(201).json({data:r.rows[0]});}catch(e){next(e);}});
  app.post('/api/v1/ho-so/:id/quyet-dinh',authenticateWithBlocklist,authorize('quyet_dinh.issue'),async(req,res,next)=>{try{const h=(await pool.query('SELECT * FROM ho_so WHERE id=$1',[req.params.id])).rows[0];if(!h)return res.status(404).json({error:'Không tìm thấy hồ sơ'});if(h.trang_thai!=='cho_ra_quyet_dinh')return res.status(400).json({error:'Hồ sơ phải ở trạng thái chờ ra quyết định'});if(!req.body?.bien_ban_id)return res.status(400).json({error:'Biên bản là bắt buộc'});const bienBan=(await pool.query('SELECT id FROM bien_ban WHERE id=$1 AND ho_so_id=$2',[req.body.bien_ban_id,h.id])).rows[0];if(!bienBan)return res.status(400).json({error:'Biên bản không thuộc hồ sơ'});const mp=await pool.query('SELECT muc_toi_thieu,muc_toi_da FROM muc_phat WHERE hanh_vi_id=$1 AND nhom_cong_trinh=$2',[h.hanh_vi_id,req.body?.nhom_cong_trinh||1]);const amount=req.body?.so_tien_phat ?? (mp.rows[0] ? Math.round(Number(mp.rows[0].muc_toi_thieu)+(Number(mp.rows[0].muc_toi_da)-Number(mp.rows[0].muc_toi_thieu))/2) : null);const subject=(await pool.query('SELECT loai_chu_the FROM nguoi_vi_pham WHERE id=$1',[h.nguoi_vi_pham_id])).rows[0];const fine=subject?.loai_chu_the==='ca_nhan'&&amount!==null?Math.floor(amount/2):amount;const code=await nextCode(pool,'QD');const r=await pool.query("INSERT INTO quyet_dinh (ma_quyet_dinh,bien_ban_id,ho_so_id,nguoi_ky_id,so_tien_phat,can_cu_phap_ly,hinh_thuc_phat_bo_sung,bien_phap_khac_phuc_hau_qua,ngay_ban_hanh,trang_thai) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::date,CURRENT_DATE),'da_ban_hanh') RETURNING *",[code,bienBan.id,h.id,req.user.id,fine,req.body?.can_cu_phap_ly||null,req.body?.hinh_thuc_phat_bo_sung||null,req.body?.bien_phap_khac_phuc_hau_qua||null,req.body?.ngay_ban_hanh||null]);await pool.query("UPDATE ho_so SET trang_thai='da_ra_quyet_dinh' WHERE id=$1",[h.id]);await audit(pool,req,'create','quyet_dinh',r.rows[0].id);res.status(201).json({data:r.rows[0]});}catch(e){next(e);}});
  app.post('/api/v1/ho-so/:id/khac-phuc',authenticateWithBlocklist,authorize('khac_phuc.manage'),async(req,res,next)=>{try{const h=(await pool.query('SELECT trang_thai FROM ho_so WHERE id=$1',[req.params.id])).rows[0];if(!h)return res.status(404).json({error:'Không tìm thấy hồ sơ'});if(h.trang_thai!=='da_ra_quyet_dinh')return res.status(400).json({error:'Hồ sơ phải đã có quyết định để theo dõi khắc phục'});if(req.body?.quyet_dinh_id&&!((await pool.query('SELECT 1 FROM quyet_dinh WHERE id=$1 AND ho_so_id=$2',[req.body.quyet_dinh_id,req.params.id])).rows[0]))return res.status(400).json({error:'Quyết định không thuộc hồ sơ'});const r=await pool.query("INSERT INTO khac_phuc (ho_so_id,quyet_dinh_id,bien_phap,mo_ta,han_thuc_hien,nguoi_theo_doi_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",[req.params.id,req.body?.quyet_dinh_id||null,req.body?.bien_phap,req.body?.mo_ta||null,req.body?.han_thuc_hien||null,req.user.id]);await pool.query("UPDATE ho_so SET trang_thai='dang_khac_phuc' WHERE id=$1",[req.params.id]);await audit(pool,req,'create','khac_phuc',r.rows[0].id);res.status(201).json({data:r.rows[0]});}catch(e){next(e);}});
  app.patch('/api/v1/khac-phuc/:id',authenticateWithBlocklist,authorize('khac_phuc.manage'),async(req,res,next)=>{try{const valid=['chua_thuc_hien','dang_thuc_hien','da_thuc_hien','qua_han','cuong_che','da_kiem_tra'];if(!valid.includes(req.body?.trang_thai))return res.status(400).json({error:'Trạng thái khắc phục không hợp lệ'});const r=await pool.query("UPDATE khac_phuc SET trang_thai=$1::varchar,ngay_hoan_thanh=CASE WHEN $1::varchar='da_thuc_hien' THEN now() ELSE ngay_hoan_thanh END WHERE id=$2 RETURNING *",[req.body.trang_thai,req.params.id]);if(!r.rows[0])return res.status(404).json({error:'Không tìm thấy thông tin khắc phục'});if(req.body.trang_thai==='da_thuc_hien')await pool.query("UPDATE ho_so SET trang_thai='da_khac_phuc' WHERE id=$1",[r.rows[0].ho_so_id]);await audit(pool,req,'update','khac_phuc',r.rows[0].id);res.json({data:r.rows[0]});}catch(e){next(e);}});
  app.get('/api/v1/thong-ke/tong-quan',authenticateWithBlocklist,authorize('report.statistics'),async(_req,res,next)=>{try{const [status,district,month]=await Promise.all([pool.query('SELECT trang_thai,count(*)::int AS so_luong FROM ho_so WHERE deleted_at IS NULL GROUP BY trang_thai ORDER BY trang_thai'),pool.query('SELECT q.id,q.ten,count(h.id)::int AS so_luong FROM quan_huyen q LEFT JOIN ho_so h ON h.quan_huyen_id=q.id AND h.deleted_at IS NULL GROUP BY q.id,q.ten ORDER BY q.ten'),pool.query("SELECT to_char(date_trunc('month',created_at),'YYYY-MM') thang,count(*)::int AS so_luong FROM ho_so WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1 DESC")]);res.json({data:{theo_trang_thai:status.rows,theo_quan:district.rows,theo_thang:month.rows}});}catch(e){next(e);}});

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

  app.use((error,_req,res,_next)=>{if(error instanceof multer.MulterError)return res.status(400).json({error:`Tải tệp thất bại: ${error.message}`}); console.error(error); return res.status(500).json({error:'Lỗi máy chủ nội bộ'});});
  return app;
}
function createPool() { return new Pool({ host: process.env.PGHOST, port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined, database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD || undefined }); }
if (require.main === module) { const pool=createPool(); const port=Number(process.env.PORT||3000); const host=process.env.HOST||'0.0.0.0'; buildApp({pool}).listen(port,host,()=>console.log(`QLTTXD API đang nghe tại http://${host}:${port}`)); }
module.exports={buildApp,createPool,authenticate,authorize,coordinate,TokenBlocklist};
