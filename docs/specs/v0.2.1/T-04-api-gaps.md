# SPEC T-04: API Gap Fix — ho-so/:id + audit-log + password

> Task: coder (backend) | Priority: P0 | Dependency: T-01

## Mục tiêu
Fix 3 API gap: ho-so/:id trả khac_phuc[], endpoint audit-log, endpoint đổi mật khẩu.

## Files thay đổi
1. `app/backend/server.js`

## Chi tiết

### 1. `GET /api/v1/ho-so/:id` — thêm khac_phuc query
```js
// Trong handler ho-so/:id, thêm query:
const [bb, qd, kp] = await Promise.all([
  pool.query('SELECT * FROM bien_ban WHERE ho_so_id=$1 ORDER BY created_at', [req.params.id]),
  pool.query('SELECT * FROM quyet_dinh WHERE ho_so_id=$1 ORDER BY created_at', [req.params.id]),
  pool.query('SELECT * FROM khac_phuc WHERE ho_so_id=$1 ORDER BY created_at', [req.params.id]),
]);
// Response: { data: { ...h.rows[0], bien_ban: bb.rows, quyet_dinh: qd.rows, khac_phuc: kp.rows } }
```

### 2. `GET /api/v1/admin/audit-log` — mới
```js
app.get('/api/v1/admin/audit-log', authenticateWithBlocklist, authorize('admin.users'), async (req, res, next) => {
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
```

### 3. `PATCH /api/v1/auth/password` — mới
```js
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
```

## Acceptance Criteria
- [ ] `GET /ho-so/:id` trả `khac_phuc[]` trong response
- [ ] `GET /admin/audit-log` trả danh sách audit log, phân trang, filter
- [ ] `PATCH /auth/password` đổi mật khẩu thành công; mật khẩu cũ sai → 401
- [ ] 70 test cũ vẫn PASS

## Test
```bash
# Test ho-so/:id có khac_phuc
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/ho-so/$ID | jq '.data.khac_phuc'

# Test audit-log
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/admin/audit-log | jq '.data | length'

# Test password change
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"old_password":"Qlttxd@2026","new_password":"NewPass123"}' \
  http://localhost:3001/api/v1/auth/password
```
