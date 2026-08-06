'use strict';

const express = require('express');
const { requirePool, audit } = require('../utils/helpers');

const MA_RE = /^[0-9A-Za-z-]{1,20}$/;
const TEN_MAX = 200;

async function parseBoundary(client, boundaryGeoJSON) {
  if (!boundaryGeoJSON) return null;
  const geoStr =
    typeof boundaryGeoJSON === 'string' ? boundaryGeoJSON : JSON.stringify(boundaryGeoJSON);
  const check = await client.query(
    `SELECT ST_IsValid(g) AS is_valid, GeometryType(g) AS geom_type, ST_SRID(g) AS srid
     FROM (SELECT ST_GeomFromGeoJSON($1) AS g) sub`,
    [geoStr]
  );
  const row = check.rows[0];
  if (!row) return { error: 'Boundary GeoJSON không hợp lệ' };
  if (row.geom_type !== 'MULTIPOLYGON')
    {return { error: `Kiểu hình học phải là MULTIPOLYGON, nhận được ${row.geom_type}` };}
  if (row.srid !== 4326) return { error: `SRID phải là 4326, nhận được ${row.srid}` };
  if (!row.is_valid) return { error: 'Boundary không hợp lệ (ST_IsValid = false)' };
  return { sql: `ST_GeomFromGeoJSON($1)::geometry(MultiPolygon,4326)` };
}

module.exports = function adminLocationsRoutes({ pool, authenticate, authorize }) {
  const router = express.Router();

  // GET /api/v1/admin/quan-huyen
  router.get(
    '/api/v1/admin/quan-huyen',
    authenticate,
    authorize('admin.locations'),
    async (_req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const result = await pool.query(
          `SELECT q.id, q.ma, q.ten, q.created_at,
                (SELECT count(*)::int FROM phuong_xa px WHERE px.quan_huyen_id = q.id) AS so_phuong,
                CASE WHEN q.boundary IS NOT NULL THEN ST_AsGeoJSON(q.boundary) ELSE NULL END AS boundary
         FROM quan_huyen q ORDER BY q.ma`
        );
        res.json({ data: result.rows });
      } catch (e) {
        next(e);
      }
    }
  );

  // POST /api/v1/admin/quan-huyen
  router.post(
    '/api/v1/admin/quan-huyen',
    authenticate,
    authorize('admin.locations'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const { ma, ten, boundary } = req.body || {};
      if (!ma || !MA_RE.test(ma))
        {return res
          .status(400)
          .json({ error: 'Mã phải từ 1-20 ký tự, chỉ gồm chữ, số và dấu gạch ngang' });}
      if (!ten?.trim() || ten.trim().length > TEN_MAX)
        {return res.status(400).json({ error: `Tên là bắt buộc, tối đa ${TEN_MAX} ký tự` });}
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (boundary) {
          const parsed = await parseBoundary(client, boundary);
          if (parsed.error) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: parsed.error });
          }
        }
        let r;
        try {
          r = await client.query(
            `INSERT INTO quan_huyen (ma, ten, boundary) VALUES ($1, $2, ${boundary ? `$3` : 'NULL'}) RETURNING id, ma, ten, created_at`,
            boundary
              ? [ma, ten.trim(), typeof boundary === 'string' ? boundary : JSON.stringify(boundary)]
              : [ma, ten.trim()]
          );
        } catch (e) {
          if (e.code === '23505') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `Mã "${ma}" đã tồn tại` });
          }
          throw e;
        }
        await audit(client, req, 'create', 'quan_huyen', r.rows[0].id, { ma, ten: ten.trim() });
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

  // PATCH /api/v1/admin/quan-huyen/:id
  router.patch(
    '/api/v1/admin/quan-huyen/:id',
    authenticate,
    authorize('admin.locations'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const { ma, ten, boundary } = req.body || {};
      if (ma !== undefined && !MA_RE.test(ma))
        {return res
          .status(400)
          .json({ error: 'Mã phải từ 1-20 ký tự, chỉ gồm chữ, số và dấu gạch ngang' });}
      if (ten !== undefined && (!ten?.trim() || ten.trim().length > TEN_MAX))
        {return res.status(400).json({ error: `Tên không được rỗng và tối đa ${TEN_MAX} ký tự` });}

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT id, ma, ten FROM quan_huyen WHERE id=$1', [
          req.params.id,
        ]);
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy quận/huyện' });
        }

        const updates = [];
        const values = [];
        let idx = 1;
        if (ma !== undefined) {
          updates.push(`ma=$${idx++}`);
          values.push(ma);
        }
        if (ten !== undefined) {
          updates.push(`ten=$${idx++}`);
          values.push(ten.trim());
        }
        if (boundary !== undefined) {
          if (boundary === null) {
            updates.push('boundary=NULL');
          } else {
            const parsed = await parseBoundary(client, boundary);
            if (parsed.error) {
              await client.query('ROLLBACK');
              return res.status(400).json({ error: parsed.error });
            }
            updates.push(`boundary=ST_GeomFromGeoJSON($${idx})::geometry(MultiPolygon,4326)`);
            values.push(typeof boundary === 'string' ? boundary : JSON.stringify(boundary));
            idx++;
          }
        }
        if (updates.length) {
          values.push(req.params.id);
          try {
            await client.query(
              `UPDATE quan_huyen SET ${updates.join(', ')} WHERE id=$${idx}`,
              values
            );
          } catch (e) {
            if (e.code === '23505') {
              await client.query('ROLLBACK');
              return res.status(409).json({ error: `Mã "${ma}" đã tồn tại` });
            }
            throw e;
          }
        }
        const result = await client.query(
          'SELECT id, ma, ten, created_at FROM quan_huyen WHERE id=$1',
          [req.params.id]
        );
        await audit(client, req, 'update', 'quan_huyen', req.params.id, {
          ma: ma ?? existing.rows[0].ma,
          ten: ten?.trim() ?? existing.rows[0].ten,
        });
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

  // DELETE /api/v1/admin/quan-huyen/:id
  router.delete(
    '/api/v1/admin/quan-huyen/:id',
    authenticate,
    authorize('admin.locations'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT id, ma, ten FROM quan_huyen WHERE id=$1', [
          req.params.id,
        ]);
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy quận/huyện' });
        }

        const pxCount = (
          await client.query('SELECT count(*)::int AS cnt FROM phuong_xa WHERE quan_huyen_id=$1', [
            req.params.id,
          ])
        ).rows[0].cnt;
        const bcCount = (
          await client.query(
            'SELECT count(*)::int AS cnt FROM bao_cao_vi_pham WHERE quan_huyen_id=$1',
            [req.params.id]
          )
        ).rows[0].cnt;
        const hsCount = (
          await client.query(
            'SELECT count(*)::int AS cnt FROM ho_so WHERE quan_huyen_id=$1 AND deleted_at IS NULL',
            [req.params.id]
          )
        ).rows[0].cnt;
        const total = pxCount + bcCount + hsCount;
        if (total > 0) {
          await client.query('ROLLBACK');
          const details = [];
          if (pxCount) details.push(`${pxCount} phường/xã`);
          if (bcCount) details.push(`${bcCount} báo cáo`);
          if (hsCount) details.push(`${hsCount} hồ sơ`);
          return res.status(409).json({
            error: `Không thể xóa quận/huyện đang được tham chiếu: ${details.join(', ')}`,
          });
        }

        try {
          await client.query('DELETE FROM quan_huyen WHERE id=$1', [req.params.id]);
        } catch (e) {
          if (e.code === '23503') {
            await client.query('ROLLBACK');
            return res
              .status(409)
              .json({ error: 'Không thể xóa quận/huyện đang được tham chiếu bởi dữ liệu khác' });
          }
          throw e;
        }
        await audit(client, req, 'delete', 'quan_huyen', req.params.id, {
          ma: existing.rows[0].ma,
          ten: existing.rows[0].ten,
        });
        await client.query('COMMIT');
        res.json({ message: 'Đã xóa quận/huyện' });
      } catch (e) {
        await client.query('ROLLBACK');
        next(e);
      } finally {
        client.release();
      }
    }
  );

  // GET /api/v1/admin/phuong-xa
  router.get(
    '/api/v1/admin/phuong-xa',
    authenticate,
    authorize('admin.locations'),
    async (req, res, next) => {
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
      } catch (e) {
        next(e);
      }
    }
  );

  // POST /api/v1/admin/phuong-xa
  router.post(
    '/api/v1/admin/phuong-xa',
    authenticate,
    authorize('admin.locations'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const { ma, ten, quan_huyen_id, boundary } = req.body || {};
      if (!ma || !MA_RE.test(ma))
        {return res
          .status(400)
          .json({ error: 'Mã phải từ 1-20 ký tự, chỉ gồm chữ, số và dấu gạch ngang' });}
      if (!ten?.trim() || ten.trim().length > TEN_MAX)
        {return res.status(400).json({ error: `Tên là bắt buộc, tối đa ${TEN_MAX} ký tự` });}
      if (!quan_huyen_id) return res.status(400).json({ error: 'quan_huyen_id là bắt buộc' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const qh = await client.query('SELECT id FROM quan_huyen WHERE id=$1', [quan_huyen_id]);
        if (!qh.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy quận/huyện' });
        }

        if (boundary) {
          const parsed = await parseBoundary(client, boundary);
          if (parsed.error) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: parsed.error });
          }
        }

        let r;
        try {
          r = await client.query(
            `INSERT INTO phuong_xa (ma, ten, quan_huyen_id, boundary) VALUES ($1, $2, $3, ${boundary ? `ST_GeomFromGeoJSON($4)::geometry(MultiPolygon,4326)` : 'NULL'}) RETURNING id, ma, ten, quan_huyen_id, created_at`,
            boundary
              ? [
                  ma,
                  ten.trim(),
                  quan_huyen_id,
                  typeof boundary === 'string' ? boundary : JSON.stringify(boundary),
                ]
              : [ma, ten.trim(), quan_huyen_id]
          );
        } catch (e) {
          if (e.code === '23505') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `Mã "${ma}" đã tồn tại` });
          }
          throw e;
        }

        await audit(client, req, 'create', 'phuong_xa', r.rows[0].id, { ma, ten: ten.trim() });
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

  // PATCH /api/v1/admin/phuong-xa/:id
  router.patch(
    '/api/v1/admin/phuong-xa/:id',
    authenticate,
    authorize('admin.locations'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const { ma, ten, quan_huyen_id, boundary } = req.body || {};
      if (ma !== undefined && !MA_RE.test(ma))
        {return res
          .status(400)
          .json({ error: 'Mã phải từ 1-20 ký tự, chỉ gồm chữ, số và dấu gạch ngang' });}
      if (ten !== undefined && (!ten?.trim() || ten.trim().length > TEN_MAX))
        {return res.status(400).json({ error: `Tên không được rỗng và tối đa ${TEN_MAX} ký tự` });}

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query(
          'SELECT id, ma, ten, quan_huyen_id FROM phuong_xa WHERE id=$1',
          [req.params.id]
        );
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy phường/xã' });
        }

        if (quan_huyen_id !== undefined) {
          const qh = await client.query('SELECT id FROM quan_huyen WHERE id=$1', [quan_huyen_id]);
          if (!qh.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Không tìm thấy quận/huyện' });
          }
        }

        if (boundary !== undefined && boundary !== null) {
          const geoStr = typeof boundary === 'string' ? boundary : JSON.stringify(boundary);
          const check = await client.query(
            `SELECT ST_IsValid(g) AS is_valid, GeometryType(g) AS geom_type, ST_SRID(g) AS srid
           FROM (SELECT ST_GeomFromGeoJSON($1) AS g) sub`,
            [geoStr]
          );
          const row = check.rows[0];
          if (!row) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Boundary GeoJSON không hợp lệ' });
          }
          if (row.geom_type !== 'MULTIPOLYGON') {
            await client.query('ROLLBACK');
            return res
              .status(400)
              .json({ error: `Kiểu hình học phải là MULTIPOLYGON, nhận được ${row.geom_type}` });
          }
          if (row.srid !== 4326) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `SRID phải là 4326, nhận được ${row.srid}` });
          }
          if (!row.is_valid) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Boundary không hợp lệ (ST_IsValid = false)' });
          }
        }

        const updates = [];
        const values = [];
        let idx = 1;
        if (ma !== undefined) {
          updates.push(`ma=$${idx++}`);
          values.push(ma);
        }
        if (ten !== undefined) {
          updates.push(`ten=$${idx++}`);
          values.push(ten.trim());
        }
        if (quan_huyen_id !== undefined) {
          updates.push(`quan_huyen_id=$${idx++}`);
          values.push(quan_huyen_id);
        }
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
            await client.query(
              `UPDATE phuong_xa SET ${updates.join(', ')} WHERE id=$${idx}`,
              values
            );
          } catch (e) {
            if (e.code === '23505') {
              await client.query('ROLLBACK');
              return res.status(409).json({ error: `Mã "${ma}" đã tồn tại` });
            }
            throw e;
          }
        }
        const result = await client.query(
          'SELECT id, ma, ten, quan_huyen_id, created_at FROM phuong_xa WHERE id=$1',
          [req.params.id]
        );
        await audit(client, req, 'update', 'phuong_xa', req.params.id, {
          ma: ma ?? existing.rows[0].ma,
          ten: ten?.trim() ?? existing.rows[0].ten,
        });
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

  // DELETE /api/v1/admin/phuong-xa/:id
  router.delete(
    '/api/v1/admin/phuong-xa/:id',
    authenticate,
    authorize('admin.locations'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT id, ma, ten FROM phuong_xa WHERE id=$1', [
          req.params.id,
        ]);
        if (!existing.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Không tìm thấy phường/xã' });
        }

        const bcCount = (
          await client.query(
            'SELECT count(*)::int AS cnt FROM bao_cao_vi_pham WHERE phuong_xa_id=$1',
            [req.params.id]
          )
        ).rows[0].cnt;
        const hsCount = (
          await client.query(
            'SELECT count(*)::int AS cnt FROM ho_so WHERE phuong_xa_id=$1 AND deleted_at IS NULL',
            [req.params.id]
          )
        ).rows[0].cnt;
        const total = bcCount + hsCount;
        if (total > 0) {
          await client.query('ROLLBACK');
          const details = [];
          if (bcCount) details.push(`${bcCount} báo cáo`);
          if (hsCount) details.push(`${hsCount} hồ sơ`);
          return res
            .status(409)
            .json({ error: `Không thể xóa phường/xã đang được tham chiếu: ${details.join(', ')}` });
        }

        try {
          await client.query('DELETE FROM phuong_xa WHERE id=$1', [req.params.id]);
        } catch (e) {
          if (e.code === '23503') {
            await client.query('ROLLBACK');
            return res
              .status(409)
              .json({ error: 'Không thể xóa phường/xã đang được tham chiếu bởi dữ liệu khác' });
          }
          throw e;
        }
        await audit(client, req, 'delete', 'phuong_xa', req.params.id, {
          ma: existing.rows[0].ma,
          ten: existing.rows[0].ten,
        });
        await client.query('COMMIT');
        res.json({ message: 'Đã xóa phường/xã' });
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
