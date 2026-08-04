'use strict';

const express = require('express');

module.exports = function thongBaoRoutes({ pool, authenticate }) {
  const router = express.Router();

  // GET /api/v1/thong-bao — list notifications for current user (paginated)
  router.get('/api/v1/thong-bao', authenticate, async (req, res, next) => {
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
  router.get('/api/v1/thong-bao/unread-count', authenticate, async (req, res, next) => {
    try {
      const r = await pool.query(
        "SELECT count(*)::int AS count FROM thong_bao WHERE nguoi_nhan_id=$1 AND trang_thai='chua_doc'",
        [req.user.id]
      );
      res.json({ count: r.rows[0].count });
    } catch (e) { next(e); }
  });

  // POST /api/v1/thong-bao/:id/mark-read
  router.post('/api/v1/thong-bao/:id/mark-read', authenticate, async (req, res, next) => {
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
  router.post('/api/v1/thong-bao/mark-all-read', authenticate, async (req, res, next) => {
    try {
      await pool.query(
        "UPDATE thong_bao SET trang_thai='da_doc' WHERE nguoi_nhan_id=$1 AND trang_thai='chua_doc'",
        [req.user.id]
      );
      res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
    } catch (e) { next(e); }
  });

  return router;
};
