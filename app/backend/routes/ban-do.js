'use strict';

const express = require('express');
const { pointSelect } = require('../utils/helpers');

module.exports = function banDoRoutes({ pool, authenticate, authorize }) {
  const router = express.Router();

  router.get('/api/v1/ban-do/vi-pham', authenticate, authorize('case.view'), async (req, res, next) => {
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

  return router;
};
