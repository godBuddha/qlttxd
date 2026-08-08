'use strict';

const express = require('express');
const { pointSelect } = require('../utils/helpers');

module.exports = function banDoRoutes({ pool, authenticate, authorize, configService }) {
  const cfg = { getSync(cat, key, fb) { return configService ? configService.getSync(cat, key, fb) : fb; } };
  const router = express.Router();

  router.get(
    '/api/v1/ban-do/vi-pham',
    authenticate,
    authorize('case.view'),
    async (req, res, next) => {
      try {
        // M-15: pagination — default limit 500, max 2000
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || cfg.getSync('pagination', 'ban_do_default', 500), 1), cfg.getSync('pagination', 'ban_do_max', 2000));
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const offset = (page - 1) * limit;

        const where = 'WHERE h.deleted_at IS NULL AND h.toa_do IS NOT NULL';
        const countR = await pool.query(
          `SELECT COUNT(*)::int AS total FROM ho_so h ${where}`
        );
        const total = countR.rows[0].total;

        const r = await pool.query(
          `SELECT h.id, h.ma_ho_so, h.trang_thai, h.dia_chi, h.mo_ta, ${pointSelect('h')},
                lvp.ten AS loai_vi_pham_ten
         FROM ho_so h
         LEFT JOIN loai_vi_pham lvp ON lvp.id=h.loai_vi_pham_id
         ${where}
         ORDER BY h.created_at DESC
         LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
        res.json({ data: r.rows, total, page, limit });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
};
