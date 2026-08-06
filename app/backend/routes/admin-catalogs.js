'use strict';

const express = require('express');
const { requirePool, audit } = require('../utils/helpers');

module.exports = function adminCatalogsRoutes({ pool, authenticate, authorize }) {
  const router = express.Router();

  // GET /api/v1/admin/loai-vi-pham
  router.get(
    '/api/v1/admin/loai-vi-pham',
    authenticate,
    authorize('admin.users'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const result = await pool.query(
          'SELECT id, code, ten, mo_ta, so_thu_tu, created_at FROM loai_vi_pham ORDER BY so_thu_tu, ten'
        );
        res.json({ data: result.rows });
      } catch (e) {
        next(e);
      }
    }
  );

  // POST /api/v1/admin/loai-vi-pham
  router.post(
    '/api/v1/admin/loai-vi-pham',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
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
          if (e.code === '23505') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `Mã "${code}" đã tồn tại` });
          }
          throw e;
        }
        await audit(client, req, 'create', 'loai_vi_pham', r.rows[0].id, {
          code: code.trim(),
          ten: ten.trim(),
        });
        await client.query('COMMIT');
        res.status(201).json({ data: r.rows[0] });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  // PATCH /api/v1/admin/loai-vi-pham/:id
  router.patch(
    '/api/v1/admin/loai-vi-pham/:id',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const { code, ten, mo_ta, so_thu_tu } = req.body || {};
      if (code !== undefined && (!code?.trim() || code.trim().length > 30))
        {return res.status(400).json({ error: 'Mã không được rỗng và tối đa 30 ký tự' });}
      if (ten !== undefined && (!ten?.trim() || ten.trim().length > 300))
        {return res.status(400).json({ error: 'Tên không được rỗng và tối đa 300 ký tự' });}
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT id, code, ten FROM loai_vi_pham WHERE id=$1', [
          req.params.id,
        ]);
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy loại vi phạm' });
        }
        const updates = [];
        const values = [];
        let idx = 1;
        if (code !== undefined) {
          updates.push(`code=$${idx++}`);
          values.push(code.trim());
        }
        if (ten !== undefined) {
          updates.push(`ten=$${idx++}`);
          values.push(ten.trim());
        }
        if (mo_ta !== undefined) {
          updates.push(`mo_ta=$${idx++}`);
          values.push(mo_ta?.trim() || null);
        }
        if (so_thu_tu !== undefined) {
          updates.push(`so_thu_tu=$${idx++}`);
          values.push(Number(so_thu_tu) || 0);
        }
        if (updates.length) {
          values.push(req.params.id);
          try {
            await client.query(
              `UPDATE loai_vi_pham SET ${updates.join(', ')} WHERE id=$${idx}`,
              values
            );
          } catch (e) {
            if (e.code === '23505') {
              await client.query('ROLLBACK');
              return res.status(409).json({ error: `Mã "${code}" đã tồn tại` });
            }
            throw e;
          }
        }
        const result = await client.query(
          'SELECT id, code, ten, mo_ta, so_thu_tu, created_at FROM loai_vi_pham WHERE id=$1',
          [req.params.id]
        );
        await audit(client, req, 'update', 'loai_vi_pham', req.params.id, {});
        await client.query('COMMIT');
        res.json({ data: result.rows[0] });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  // DELETE /api/v1/admin/loai-vi-pham/:id
  router.delete(
    '/api/v1/admin/loai-vi-pham/:id',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT id, code, ten FROM loai_vi_pham WHERE id=$1', [
          req.params.id,
        ]);
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy loại vi phạm' });
        }
        const hvCount = (
          await client.query(
            'SELECT count(*)::int AS cnt FROM hanh_vi_vi_pham WHERE loai_vi_pham_id=$1',
            [req.params.id]
          )
        ).rows[0].cnt;
        if (hvCount > 0) {
          await client.query('ROLLBACK');
          return res
            .status(409)
            .json({ error: `Không thể xóa loại vi phạm đang có ${hvCount} hành vi vi phạm` });
        }
        await client.query('DELETE FROM loai_vi_pham WHERE id=$1', [req.params.id]);
        await audit(client, req, 'delete', 'loai_vi_pham', req.params.id, {
          code: existing.rows[0].code,
          ten: existing.rows[0].ten,
        });
        await client.query('COMMIT');
        res.json({ message: 'Đã xóa loại vi phạm' });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  // GET /api/v1/admin/hanh-vi
  router.get(
    '/api/v1/admin/hanh-vi',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
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
      } catch (e) {
        next(e);
      }
    }
  );

  // POST /api/v1/admin/hanh-vi
  router.post(
    '/api/v1/admin/hanh-vi',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const { loai_vi_pham_id, dieu, khoan, diem, ten, mo_ta, is_active } = req.body || {};
      if (!loai_vi_pham_id) return res.status(400).json({ error: 'Loại vi phạm là bắt buộc' });
      if (!khoan?.trim()) return res.status(400).json({ error: 'Khoản là bắt buộc' });
      if (!ten?.trim()) return res.status(400).json({ error: 'Tên là bắt buộc' });
      if (ten.trim().length > 500) return res.status(400).json({ error: 'Tên tối đa 500 ký tự' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const parent = await client.query('SELECT id FROM loai_vi_pham WHERE id=$1', [
          loai_vi_pham_id,
        ]);
        if (!parent.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Loại vi phạm không tồn tại' });
        }
        let r;
        try {
          r = await client.query(
            'INSERT INTO hanh_vi_vi_pham (loai_vi_pham_id, dieu, khoan, diem, ten, mo_ta, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, loai_vi_pham_id, dieu, khoan, diem, ten, mo_ta, is_active, created_at',
            [
              loai_vi_pham_id,
              dieu?.trim() || '16',
              khoan.trim(),
              diem?.trim() || null,
              ten.trim(),
              mo_ta?.trim() || null,
              is_active !== false,
            ]
          );
        } catch (e) {
          if (e.code === '23505') {
            await client.query('ROLLBACK');
            return res.status(409).json({
              error: `Điều ${dieu || '16'}, khoản ${khoan}, điểm ${diem || '—'} đã tồn tại`,
            });
          }
          throw e;
        }
        await audit(client, req, 'create', 'hanh_vi_vi_pham', r.rows[0].id, {
          khoan: khoan.trim(),
          ten: ten.trim(),
        });
        await client.query('COMMIT');
        res.status(201).json({ data: r.rows[0] });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  // PATCH /api/v1/admin/hanh-vi/:id
  router.patch(
    '/api/v1/admin/hanh-vi/:id',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const { loai_vi_pham_id, dieu, khoan, diem, ten, mo_ta, is_active } = req.body || {};
      if (ten !== undefined && (!ten?.trim() || ten.trim().length > 500))
        {return res.status(400).json({ error: 'Tên không được rỗng và tối đa 500 ký tự' });}
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query(
          'SELECT id, khoan, ten FROM hanh_vi_vi_pham WHERE id=$1',
          [req.params.id]
        );
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy hành vi vi phạm' });
        }
        if (loai_vi_pham_id !== undefined) {
          const parent = await client.query('SELECT id FROM loai_vi_pham WHERE id=$1', [
            loai_vi_pham_id,
          ]);
          if (!parent.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Loại vi phạm không tồn tại' });
          }
        }
        const updates = [];
        const values = [];
        let idx = 1;
        if (loai_vi_pham_id !== undefined) {
          updates.push(`loai_vi_pham_id=$${idx++}`);
          values.push(loai_vi_pham_id);
        }
        if (dieu !== undefined) {
          updates.push(`dieu=$${idx++}`);
          values.push(dieu.trim());
        }
        if (khoan !== undefined) {
          updates.push(`khoan=$${idx++}`);
          values.push(khoan.trim());
        }
        if (diem !== undefined) {
          updates.push(`diem=$${idx++}`);
          values.push(diem?.trim() || null);
        }
        if (ten !== undefined) {
          updates.push(`ten=$${idx++}`);
          values.push(ten.trim());
        }
        if (mo_ta !== undefined) {
          updates.push(`mo_ta=$${idx++}`);
          values.push(mo_ta?.trim() || null);
        }
        if (is_active !== undefined) {
          updates.push(`is_active=$${idx++}`);
          values.push(Boolean(is_active));
        }
        if (updates.length) {
          values.push(req.params.id);
          try {
            await client.query(
              `UPDATE hanh_vi_vi_pham SET ${updates.join(', ')} WHERE id=$${idx}`,
              values
            );
          } catch (e) {
            if (e.code === '23505') {
              await client.query('ROLLBACK');
              return res.status(409).json({ error: 'Điều/khoản/điểm đã tồn tại' });
            }
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
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  // DELETE /api/v1/admin/hanh-vi/:id
  router.delete(
    '/api/v1/admin/hanh-vi/:id',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query(
          'SELECT id, khoan, ten FROM hanh_vi_vi_pham WHERE id=$1',
          [req.params.id]
        );
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy hành vi vi phạm' });
        }
        const mpCount = (
          await client.query('SELECT count(*)::int AS cnt FROM muc_phat WHERE hanh_vi_id=$1', [
            req.params.id,
          ])
        ).rows[0].cnt;
        if (mpCount > 0) {
          await client.query('ROLLBACK');
          return res
            .status(409)
            .json({ error: `Không thể xóa hành vi đang có ${mpCount} mức phạt` });
        }
        await client.query('DELETE FROM hanh_vi_vi_pham WHERE id=$1', [req.params.id]);
        await audit(client, req, 'delete', 'hanh_vi_vi_pham', req.params.id, {
          khoan: existing.rows[0].khoan,
          ten: existing.rows[0].ten,
        });
        await client.query('COMMIT');
        res.json({ message: 'Đã xóa hành vi vi phạm' });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  // GET /api/v1/admin/muc-phat
  router.get(
    '/api/v1/admin/muc-phat',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
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
      } catch (e) {
        next(e);
      }
    }
  );

  // POST /api/v1/admin/muc-phat
  router.post(
    '/api/v1/admin/muc-phat',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const { hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da } = req.body || {};
      if (!hanh_vi_id) return res.status(400).json({ error: 'Hành vi vi phạm là bắt buộc' });
      if (![1, 2, 3].includes(Number(nhom_cong_trinh)))
        {return res.status(400).json({ error: 'Nhóm công trình phải là 1, 2 hoặc 3' });}
      if (muc_toi_thieu === null || muc_toi_thieu === undefined || Number(muc_toi_thieu) < 0)
        {return res.status(400).json({ error: 'Mức tối thiểu phải >= 0' });}
      if (muc_toi_da === null || muc_toi_da === undefined || Number(muc_toi_da) < Number(muc_toi_thieu))
        {return res.status(400).json({ error: 'Mức tối đa phải >= mức tối thiểu' });}
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const parent = await client.query('SELECT id FROM hanh_vi_vi_pham WHERE id=$1', [
          hanh_vi_id,
        ]);
        if (!parent.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Hành vi vi phạm không tồn tại' });
        }
        let r;
        try {
          r = await client.query(
            'INSERT INTO muc_phat (hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da) VALUES ($1, $2, $3, $4) RETURNING id, hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da, created_at',
            [hanh_vi_id, Number(nhom_cong_trinh), Number(muc_toi_thieu), Number(muc_toi_da)]
          );
        } catch (e) {
          if (e.code === '23505') {
            await client.query('ROLLBACK');
            return res
              .status(409)
              .json({ error: 'Mức phạt cho hành vi + nhóm công trình này đã tồn tại' });
          }
          throw e;
        }
        await audit(client, req, 'create', 'muc_phat', r.rows[0].id, {
          hanh_vi_id,
          nhom_cong_trinh: Number(nhom_cong_trinh),
        });
        await client.query('COMMIT');
        res.status(201).json({ data: r.rows[0] });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  // PATCH /api/v1/admin/muc-phat/:id
  router.patch(
    '/api/v1/admin/muc-phat/:id',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const { hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da } = req.body || {};
      if (nhom_cong_trinh !== undefined && ![1, 2, 3].includes(Number(nhom_cong_trinh)))
        {return res.status(400).json({ error: 'Nhóm công trình phải là 1, 2 hoặc 3' });}
      if (muc_toi_thieu !== undefined && Number(muc_toi_thieu) < 0)
        {return res.status(400).json({ error: 'Mức tối thiểu phải >= 0' });}
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query(
          'SELECT id, hanh_vi_id, nhom_cong_trinh FROM muc_phat WHERE id=$1',
          [req.params.id]
        );
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy mức phạt' });
        }
        if (hanh_vi_id !== undefined) {
          const parent = await client.query('SELECT id FROM hanh_vi_vi_pham WHERE id=$1', [
            hanh_vi_id,
          ]);
          if (!parent.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Hành vi vi phạm không tồn tại' });
          }
        }
        const updates = [];
        const values = [];
        let idx = 1;
        if (hanh_vi_id !== undefined) {
          updates.push(`hanh_vi_id=$${idx++}`);
          values.push(hanh_vi_id);
        }
        if (nhom_cong_trinh !== undefined) {
          updates.push(`nhom_cong_trinh=$${idx++}`);
          values.push(Number(nhom_cong_trinh));
        }
        if (muc_toi_thieu !== undefined) {
          updates.push(`muc_toi_thieu=$${idx++}`);
          values.push(Number(muc_toi_thieu));
        }
        if (muc_toi_da !== undefined) {
          updates.push(`muc_toi_da=$${idx++}`);
          values.push(Number(muc_toi_da));
        }
        if (updates.length) {
          values.push(req.params.id);
          try {
            await client.query(
              `UPDATE muc_phat SET ${updates.join(', ')} WHERE id=$${idx}`,
              values
            );
          } catch (e) {
            if (e.code === '23505') {
              await client.query('ROLLBACK');
              return res
                .status(409)
                .json({ error: 'Mức phạt cho hành vi + nhóm công trình này đã tồn tại' });
            }
            throw e;
          }
        }
        const result = await client.query(
          'SELECT id, hanh_vi_id, nhom_cong_trinh, muc_toi_thieu, muc_toi_da, created_at FROM muc_phat WHERE id=$1',
          [req.params.id]
        );
        await audit(client, req, 'update', 'muc_phat', req.params.id, {});
        await client.query('COMMIT');
        res.json({ data: result.rows[0] });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  // DELETE /api/v1/admin/muc-phat/:id
  router.delete(
    '/api/v1/admin/muc-phat/:id',
    authenticate,
    authorize('admin.users'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query(
          'SELECT id, hanh_vi_id, nhom_cong_trinh FROM muc_phat WHERE id=$1',
          [req.params.id]
        );
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy mức phạt' });
        }
        await client.query('DELETE FROM muc_phat WHERE id=$1', [req.params.id]);
        await audit(client, req, 'delete', 'muc_phat', req.params.id, {});
        await client.query('COMMIT');
        res.json({ message: 'Đã xóa mức phạt' });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  return router;
};
