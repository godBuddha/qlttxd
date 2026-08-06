'use strict';

const express = require('express');

module.exports = function danhMucRoutes({ pool, authenticate, authorize }) {
  const router = express.Router();

  router.get('/api/v1/danh-muc/loai-vi-pham', async (_req, res, next) => {
    try {
      res.json({
        data: (await pool.query('SELECT * FROM loai_vi_pham ORDER BY so_thu_tu,ten')).rows,
      });
    } catch (e) {
      next(e);
    }
  });
  router.get('/api/v1/danh-muc/hanh-vi', async (req, res, next) => {
    try {
      const q = req.query.loai_vi_pham_id
        ? [' WHERE loai_vi_pham_id=$1', [req.query.loai_vi_pham_id]]
        : ['', []];
      res.json({
        data: (await pool.query(`SELECT * FROM hanh_vi_vi_pham${q[0]} ORDER BY khoan`, q[1])).rows,
      });
    } catch (e) {
      next(e);
    }
  });
  router.get('/api/v1/danh-muc/muc-phat', async (req, res, next) => {
    try {
      const q = req.query.hanh_vi_id ? [' WHERE hanh_vi_id=$1', [req.query.hanh_vi_id]] : ['', []];
      res.json({
        data: (await pool.query(`SELECT * FROM muc_phat${q[0]} ORDER BY nhom_cong_trinh`, q[1]))
          .rows,
      });
    } catch (e) {
      next(e);
    }
  });
  router.get('/api/v1/danh-muc/quan-huyen', async (_req, res, next) => {
    try {
      res.json({ data: (await pool.query('SELECT id,ma,ten FROM quan_huyen ORDER BY ma')).rows });
    } catch (e) {
      next(e);
    }
  });
  router.get('/api/v1/danh-muc/phuong-xa', async (req, res, next) => {
    try {
      const q = req.query.quan_huyen_id
        ? [' WHERE quan_huyen_id=$1', [req.query.quan_huyen_id]]
        : ['', []];
      res.json({
        data: (
          await pool.query(`SELECT id,ma,ten,quan_huyen_id FROM phuong_xa${q[0]} ORDER BY ma`, q[1])
        ).rows,
      });
    } catch (e) {
      next(e);
    }
  });
  router.get(
    '/api/v1/danh-muc/can-bo',
    authenticate,
    authorize('case.view'),
    async (_req, res, next) => {
      try {
        res.json({
          data: (
            await pool.query(
              `SELECT u.id,u.full_name,u.username FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='case_handler' AND u.is_active=true ORDER BY u.full_name`
            )
          ).rows,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
};
