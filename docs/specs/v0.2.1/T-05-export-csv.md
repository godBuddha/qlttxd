# SPEC T-05: Export CSV

> Task: coder (backend) | Priority: P1 | Dependency: T-01

## Mục tiêu

Install `csv-stringify` + endpoint xuất CSV báo cáo.

## Files thay đổi

1. `app/backend/package.json` — thêm `csv-stringify`
2. `app/backend/server.js` — thêm endpoint

## Chi tiết

### 1. Install

```bash
cd /workspace/ssd/qlttxd/app/backend
npm install csv-stringify
```

### 2. Endpoint

```js
app.get(
  '/api/v1/thong-ke/xuat',
  authenticateWithBlocklist,
  authorize('report.statistics'),
  async (req, res, next) => {
    try {
      const loai = req.query.loai || 'csv';
      const w = ['h.deleted_at IS NULL'];
      const vals = [];
      let idx = 1;
      if (req.query.trang_thai) {
        w.push(`h.trang_thai=$${idx++}`);
        vals.push(req.query.trang_thai);
      }
      if (req.query.quan_huyen_id) {
        w.push(`h.quan_huyen_id=$${idx++}`);
        vals.push(req.query.quan_huyen_id);
      }
      if (req.query.tu_ngay) {
        w.push(`h.created_at>=$${idx++}`);
        vals.push(req.query.tu_ngay);
      }
      if (req.query.den_ngay) {
        w.push(`h.created_at<=$${idx++}`);
        vals.push(req.query.den_ngay);
      }

      const r = await pool.query(
        `SELECT h.ma_ho_so, h.trang_thai, h.dia_chi, h.mo_ta, h.created_at, h.updated_at,
              q.ten AS quan_huyen, px.ten AS phuong_xa,
              nv.ten AS nguoi_vi_pham_ten, nv.sdt AS nguoi_vi_pham_sdt, nv.email AS nguoi_vi_pham_email
       FROM ho_so h
       LEFT JOIN quan_huyen q ON q.id=h.quan_huyen_id
       LEFT JOIN phuong_xa px ON px.id=h.phuong_xa_id
       LEFT JOIN nguoi_vi_pham nv ON nv.id=h.nguoi_vi_pham_id
       WHERE ${w.join(' AND ')} ORDER BY h.created_at DESC`,
        vals
      );

      // PII masking
      const canViewPII = req.user.permissions.includes('case.view');
      const mask = (s) => (s ? s.replace(/.(?=.{4})/g, '*') : '');
      const rows = r.rows.map((row) => ({
        ...row,
        nguoi_vi_pham_sdt: canViewPII ? row.nguoi_vi_pham_sdt : mask(row.nguoi_vi_pham_sdt),
        nguoi_vi_pham_email: canViewPII ? row.nguoi_vi_pham_email : mask(row.nguoi_vi_pham_email),
      }));

      if (loai === 'csv') {
        const { stringify } = require('csv-stringify/sync');
        const csv = stringify(rows, { header: true, bom: true });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="bao-cao-${new Date().toISOString().slice(0, 10)}.csv"`
        );
        res.send(csv);
      } else {
        return res.status(400).json({ error: 'Loại xuất không hợp lệ. Chỉ hỗ trợ csv.' });
      }
    } catch (e) {
      next(e);
    }
  }
);
```

## Acceptance Criteria

- [x] `GET /api/v1/thong-ke/xuat?loai=csv` trả file CSV
- [x] CSV có header đúng
- [x] PII (SĐT, email) bị che nếu không có `case.view`
- [x] Filter theo trạng thái/quận/ngày hoạt động
- [x] 85 test (70 cũ + 15 mới CSV export) vẫn PASS
