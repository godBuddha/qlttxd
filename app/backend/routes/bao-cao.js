'use strict';

const express = require('express');
const { requirePool, coordinate, audit, nextCode, pointSelect, scopeWhere } = require('../utils/helpers');
const { upload, hasSafeImageMagic, removeUploadedFiles } = require('../utils/upload');

module.exports = function baoCaoRoutes({ pool, authenticate, authorize }) {
  const router = express.Router();

  router.post('/api/v1/bao-cao', authenticate, authorize('report.create'), upload.array('anh', 5), async (req, res, next) => {
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

  router.get('/api/v1/bao-cao', authenticate, authorize('report.view_own'), async (req, res, next) => { try { const all = req.user.permissions.includes('case.view'); const r = await pool.query(`SELECT bc.id,bc.ma_bao_cao,bc.nguoi_gui_ten,bc.mo_ta,bc.dia_chi,bc.created_at,${pointSelect('bc')},(SELECT count(*)::int FROM tep_dinh_kem t WHERE t.entity_type='bao_cao' AND t.entity_id=bc.id) AS anh_count FROM bao_cao_vi_pham bc ${all ? '' : 'WHERE bc.nguoi_gui_id=$1'} ORDER BY bc.created_at DESC`, all ? [] : [req.user.id]); res.json({ data: r.rows }); } catch (e) { next(e); } });

  // POST /api/v1/bao-cao/:id/to-ho-so — convert report to case
  router.post('/api/v1/bao-cao/:id/to-ho-so', authenticate, authorize('case.update'), async (req, res, next) => {
    if (!requirePool(pool, res)) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const bc = (await client.query('SELECT * FROM bao_cao_vi_pham WHERE id=$1', [req.params.id])).rows[0];
      if (!bc) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy báo cáo' }); }
      const existing = (await client.query('SELECT id,ma_ho_so FROM ho_so WHERE bao_cao_id=$1 LIMIT 1', [bc.id])).rows[0];
      if (existing) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Báo cáo đã được chuyển thành hồ sơ', data: existing }); }
      const code = await nextCode(client, 'HS');
      const r = await client.query(
        `INSERT INTO ho_so (ma_ho_so, bao_cao_id, nguoi_nop_id, dia_chi, quan_huyen_id, phuong_xa_id, toa_do, thoi_gian_xay_ra, mo_ta)
         SELECT $1, $2, $3, bc.dia_chi, bc.quan_huyen_id, bc.phuong_xa_id, bc.toa_do, bc.thoi_gian_xay_ra, bc.mo_ta
         FROM bao_cao_vi_pham bc WHERE bc.id=$2
         RETURNING id, ma_ho_so, trang_thai, ${pointSelect()}`,
        [code, bc.id, req.user.id]
      );
      const hoSo = r.rows[0];
      const attachments = (await client.query("SELECT ten_goc, duong_dan, loai_file, kich_thuoc FROM tep_dinh_kem WHERE entity_type='bao_cao' AND entity_id=$1", [bc.id])).rows;
      for (const att of attachments) {
        await client.query("INSERT INTO tep_dinh_kem (entity_type, entity_id, ten_goc, duong_dan, loai_file, kich_thuoc, nguoi_tai_id) VALUES ('ho_so', $1, $2, $3, $4, $5, $6)", [hoSo.id, att.ten_goc, att.duong_dan, att.loai_file, att.kich_thuoc, req.user.id]);
      }
      await audit(client, req, 'create', 'ho_so', hoSo.id, { from_bao_cao: bc.id, ma_bao_cao: bc.ma_bao_cao });
      await client.query('COMMIT');
      res.status(201).json({ data: { ...hoSo, anh_count: attachments.length } });
    } catch (e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
  });

  // GET /api/v1/bao-cao/:id — detail
  router.get('/api/v1/bao-cao/:id', authenticate, authorize('report.view_own'), async (req, res, next) => {
    try {
      const all = req.user.permissions.includes('case.view');
      const bc = (await pool.query(
        `SELECT bc.id, bc.ma_bao_cao, bc.nguoi_gui_id, bc.nguoi_gui_ten, bc.nguoi_gui_sdt, bc.nguoi_gui_email,
                bc.mo_ta, bc.dia_chi, bc.quan_huyen_id, bc.phuong_xa_id, bc.thoi_gian_xay_ra, bc.created_at,
                ${pointSelect('bc')},
                q.ten AS quan_huyen_ten, p.ten AS phuong_xa_ten
         FROM bao_cao_vi_pham bc
         LEFT JOIN quan_huyen q ON q.id=bc.quan_huyen_id
         LEFT JOIN phuong_xa p ON p.id=bc.phuong_xa_id
         WHERE bc.id=$1 ${all ? '' : 'AND bc.nguoi_gui_id=$2'}`,
        all ? [req.params.id] : [req.params.id, req.user.id]
      )).rows[0];
      if (!bc) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
      const anh = (await pool.query("SELECT id, ten_goc, duong_dan, loai_file, kich_thuoc, created_at FROM tep_dinh_kem WHERE entity_type='bao_cao' AND entity_id=$1 ORDER BY created_at", [bc.id])).rows;
      const hoSo = (await pool.query('SELECT id, ma_ho_so, trang_thai FROM ho_so WHERE bao_cao_id=$1 LIMIT 1', [bc.id])).rows[0];
      res.json({ data: { ...bc, anh, ho_so: hoSo || null } });
    } catch (e) { next(e); }
  });

  return router;
};
