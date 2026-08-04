'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { BUSINESS_CODE_SEQUENCES } = require('./constants');

function secret() { return process.env.JWT_SECRET; }

function requirePool(pool, res) { if (!pool) { res.status(503).json({ error: 'Cơ sở dữ liệu chưa sẵn sàng' }); return false; } return true; }

function coordinate(body) {
  const lat = Number(body.latitude); const lng = Number(body.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

async function audit(pool, req, action, table, id, detail = {}) {
  await pool.query('INSERT INTO audit_log (nguoi_dung_id, hanh_dong, bang_bi_tac_dong, id_ban_ghi, chi_tiet, ip, request_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [req.user?.id || null, action, table, id || null, JSON.stringify(detail), req.ip, req.requestId || null]);
}

async function nextCode(pool, prefix) {
  const sequence = BUSINESS_CODE_SEQUENCES[prefix];
  if (!sequence) throw new Error(`Unsupported business-code prefix: ${prefix}`);
  const result = await pool.query('SELECT next_business_code($1, $2::regclass) AS code', [prefix, sequence]);
  return result.rows[0].code;
}

function pointSelect(alias = '') { const p = alias ? `${alias}.` : ''; return `CASE WHEN ${p}toa_do IS NULL THEN NULL ELSE json_build_object('lat', ST_Y(${p}toa_do), 'lng', ST_X(${p}toa_do)) END AS toa_do`; }

function scopeWhere(user, vals, alias = '') {
  if (!user) return '';
  const p = alias ? `${alias}.` : '';
  if (user.permissions?.includes('case.view')) return '';
  vals.push(user.id);
  return ` AND ${p}nguoi_nop_id=$${vals.length}`;
}

async function createThongBao(clientOrPool, { nguoi_nhan_id, ho_so_id, loai, tieu_de, noi_dung }) {
  await clientOrPool.query(
    'INSERT INTO thong_bao (nguoi_nhan_id, ho_so_id, loai, tieu_de, noi_dung, kenh, trang_thai) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [nguoi_nhan_id, ho_so_id || null, loai, tieu_de, noi_dung || null, 'in_app', 'chua_doc']
  );
}

async function fetchHoSoDocxData(pool, hoSoId) {
  const h = await pool.query(
    `SELECT h.*, q.ten AS quan_huyen_ten, px.ten AS phuong_xa_ten
     FROM ho_so h
     LEFT JOIN quan_huyen q ON q.id=h.quan_huyen_id
     LEFT JOIN phuong_xa px ON px.id=h.phuong_xa_id
     WHERE h.id=$1 AND h.deleted_at IS NULL`, [hoSoId]
  );
  if (!h.rows[0]) return null;
  const hs = h.rows[0];
  const [nvpRes, hvRes, lvpRes, bbRes, qdRes] = await Promise.all([
    hs.nguoi_vi_pham_id ? pool.query('SELECT * FROM nguoi_vi_pham WHERE id=$1', [hs.nguoi_vi_pham_id]) : Promise.resolve({ rows: [null] }),
    hs.hanh_vi_id ? pool.query('SELECT * FROM hanh_vi_vi_pham WHERE id=$1', [hs.hanh_vi_id]) : Promise.resolve({ rows: [null] }),
    hs.loai_vi_pham_id ? pool.query('SELECT * FROM loai_vi_pham WHERE id=$1', [hs.loai_vi_pham_id]) : Promise.resolve({ rows: [null] }),
    pool.query('SELECT * FROM bien_ban WHERE ho_so_id=$1 ORDER BY created_at DESC LIMIT 1', [hoSoId]),
    pool.query('SELECT * FROM quyet_dinh WHERE ho_so_id=$1 ORDER BY created_at DESC LIMIT 1', [hoSoId]),
  ]);
  return {
    ho_so: hs, nguoi_vi_pham: nvpRes.rows[0], hanh_vi: hvRes.rows[0],
    loai_vi_pham: lvpRes.rows[0], bien_ban: bbRes.rows[0], quyet_dinh: qdRes.rows[0],
    quan_huyen: hs.quan_huyen_id ? { ten: hs.quan_huyen_ten } : null,
    phuong_xa: hs.phuong_xa_id ? { ten: hs.phuong_xa_ten } : null,
  };
}

function vnFont(doc) {
  const fontRegular = path.resolve(__dirname, '..', 'fonts', 'NotoSans-Regular.ttf');
  const fontBold = path.resolve(__dirname, '..', 'fonts', 'NotoSans-Bold.ttf');
  doc.registerFont('VN', fontRegular);
  doc.registerFont('VN-Bold', fontBold);
}

module.exports = { secret, requirePool, coordinate, audit, nextCode, pointSelect, scopeWhere, createThongBao, fetchHoSoDocxData, vnFont };
