'use strict';

const path = require('node:path');
const express = require('express');

module.exports = function thongKeRoutes({ pool, authenticate, authorize }) {
  const router = express.Router();

  router.get('/api/v1/thong-ke/tong-quan', authenticate, authorize('report.statistics'), async (_req, res, next) => {
    try {
      const [status, district, month] = await Promise.all([
        pool.query('SELECT trang_thai,count(*)::int AS so_luong FROM ho_so WHERE deleted_at IS NULL GROUP BY trang_thai ORDER BY trang_thai'),
        pool.query('SELECT q.id,q.ten,count(h.id)::int AS so_luong FROM quan_huyen q LEFT JOIN ho_so h ON h.quan_huyen_id=q.id AND h.deleted_at IS NULL GROUP BY q.id,q.ten ORDER BY q.ten'),
        pool.query("SELECT to_char(date_trunc('month',created_at),'YYYY-MM') thang,count(*)::int AS so_luong FROM ho_so WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1 DESC"),
      ]);
      res.json({ data: { theo_trang_thai: status.rows, theo_quan: district.rows, theo_thang: month.rows } });
    } catch (e) { next(e); }
  });

  router.get('/api/v1/thong-ke/xuat', authenticate, authorize('report.statistics'), async (req, res, next) => {
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
        const fontRegular = path.resolve(__dirname, '..', 'fonts', 'NotoSans-Regular.ttf');
        const fontBold = path.resolve(__dirname, '..', 'fonts', 'NotoSans-Bold.ttf');
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

  return router;
};
