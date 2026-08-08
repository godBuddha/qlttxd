'use strict';

const express = require('express');
const {
  requirePool,
  coordinate,
  audit,
  nextCode,
  pointSelect,
  createThongBao,
  fetchHoSoDocxData,
  vnFont,
} = require('../utils/helpers');
const { isSmtpConfigured } = require('../lib/email');
const { STATES, STATE_LABELS, TRANSITIONS, AUDIT_ACTIONS } = require('../utils/constants');
const { canTransition } = require('../utils/workflow-rules');
const { generateBienBan, generateQuyetDinh } = require('../gov_docx');

module.exports = function hoSoRoutes({ pool, authenticate, authorize }) {
  const router = express.Router();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function validateHoSo(b) {
    if (!b.bao_cao_id && !b.mo_ta?.trim()) return 'Mô tả hoặc báo cáo liên kết là bắt buộc';
    if (b.loai_vi_pham_id && !UUID_RE.test(b.loai_vi_pham_id))
      {return 'loai_vi_pham_id không hợp lệ (cần UUID)';}
    if (b.hanh_vi_id && !UUID_RE.test(b.hanh_vi_id)) return 'hanh_vi_id không hợp lệ (cần UUID)';
    if (b.bao_cao_id && !UUID_RE.test(b.bao_cao_id)) return 'bao_cao_id không hợp lệ (cần UUID)';
    return null;
  }

  function validateNguoiViPham(nvp) {
    if (!nvp || typeof nvp !== 'object') return null;
    if (!nvp.ten?.trim()) return 'Tên người vi phạm là bắt buộc';
    if (nvp.ten.length > 200) return 'Tên người vi phạm không được vượt quá 200 ký tự';
    if (!nvp.loai_chu_the) return 'Loại chủ thể là bắt buộc';
    if (nvp.cmnd_cccd && !/^\d{9,12}$/.test(nvp.cmnd_cccd)) return 'CMND/CCCD phải 9-12 chữ số';
    if (nvp.sdt && !/^\d{9,11}$/.test(nvp.sdt)) return 'Số điện thoại phải 9-11 chữ số';
    if (nvp.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nvp.email)) return 'Email không hợp lệ';
    if (nvp.dia_chi && nvp.dia_chi.length > 1000) return 'Địa chỉ không được vượt quá 1000 ký tự';
    if (nvp.nguoi_dai_dien && nvp.nguoi_dai_dien.length > 200) return 'Người đại diện không được vượt quá 200 ký tự';
    return null;
  }

  router.post('/api/v1/ho-so', authenticate, authorize('case.update'), async (req, res, next) => {
    const b = req.body || {};
    const hoSoErr = validateHoSo(b);
    if (hoSoErr) return res.status(400).json({ error: hoSoErr });
    if (b.mo_ta && b.mo_ta.length > 10000)
      {return res.status(400).json({ error: 'Mô tả không được vượt quá 10000 ký tự' });}
    if (b.ghi_chu && b.ghi_chu.length > 5000)
      {return res.status(400).json({ error: 'Ghi chú không được vượt quá 5000 ký tự' });}
    const nvpErr = validateNguoiViPham(b.nguoi_vi_pham);
    if (nvpErr) return res.status(400).json({ error: nvpErr });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let offender = null;
      if (b.nguoi_vi_pham?.ten && b.nguoi_vi_pham?.loai_chu_the)
        {offender = (
          await client.query(
            'INSERT INTO nguoi_vi_pham (loai_chu_the,ten,cmnd_cccd,dia_chi,sdt,email,nguoi_dai_dien) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
            [
              b.nguoi_vi_pham.loai_chu_the,
              b.nguoi_vi_pham.ten,
              b.nguoi_vi_pham.cmnd_cccd || null,
              b.nguoi_vi_pham.dia_chi || null,
              b.nguoi_vi_pham.sdt || null,
              b.nguoi_vi_pham.email || null,
              b.nguoi_vi_pham.nguoi_dai_dien || null,
            ]
          )
        ).rows[0].id;}
      const code = await nextCode(client, 'HS');
      const pos = coordinate(b);
      const r = await client.query(
        `INSERT INTO ho_so (ma_ho_so,bao_cao_id,loai_vi_pham_id,hanh_vi_id,nguoi_nop_id,nguoi_vi_pham_id,dia_chi,quan_huyen_id,phuong_xa_id,toa_do,thoi_gian_xay_ra,mo_ta,muc_phat_du_kien,dang_thi_cong,ghi_chu) SELECT $1,$2,$3,$4,$5,$6,COALESCE($7,bc.dia_chi),COALESCE($8,bc.quan_huyen_id),COALESCE($9,bc.phuong_xa_id),CASE WHEN $10::float IS NULL THEN bc.toa_do ELSE ST_SetSRID(ST_MakePoint($10,$11),4326) END,COALESCE($12,bc.thoi_gian_xay_ra),COALESCE($13,bc.mo_ta),$14,COALESCE($15,false),$16 FROM (SELECT 1) x LEFT JOIN bao_cao_vi_pham bc ON bc.id=$2 RETURNING id,ma_ho_so,trang_thai,${pointSelect()}`,
        [
          code,
          b.bao_cao_id || null,
          b.loai_vi_pham_id || null,
          b.hanh_vi_id || null,
          req.user.id,
          offender,
          b.dia_chi || null,
          b.quan_huyen_id || null,
          b.phuong_xa_id || null,
          pos?.lng || null,
          pos?.lat || null,
          b.thoi_gian_xay_ra || null,
          b.mo_ta || null,
          b.muc_phat_du_kien || null,
          b.dang_thi_cong,
          b.ghi_chu || null,
        ]
      );
      await audit(client, req, AUDIT_ACTIONS.CASE_CREATE, 'ho_so', r.rows[0].id);
      await client.query('COMMIT');
      res.status(201).json({ data: r.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      next(e);
    } finally {
      client.release();
    }
  });

  router.get('/api/v1/ho-so', authenticate, authorize('case.view'), async (req, res, next) => {
    try {
      const vals = [];
      const add = (sql, v) => {
        vals.push(v);
        return `${sql}$${vals.length}`;
      };
      const w = ['h.deleted_at IS NULL'];
      if (req.query.trang_thai) w.push(add('h.trang_thai=', req.query.trang_thai));
      if (req.query.quan_huyen_id) w.push(add('h.quan_huyen_id=', req.query.quan_huyen_id));
      if (req.query.tu_ngay) w.push(add('h.created_at>=', req.query.tu_ngay));
      if (req.query.den_ngay) w.push(add('h.created_at<=', req.query.den_ngay));
      if (req.query.q)
        {w.push(
          add('(h.ma_ho_so ILIKE ', `%${req.query.q}%`) +
            ` OR h.mo_ta ILIKE $${vals.length} OR h.dia_chi ILIKE $${vals.length} OR lvp.ten ILIKE $${vals.length})`
        );}
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100),
        page = Math.max(Number(req.query.page) || 1, 1);
      vals.push(limit, (page - 1) * limit);
      const countResult = await pool.query(
        `SELECT count(*)::int FROM ho_so h LEFT JOIN loai_vi_pham lvp ON lvp.id=h.loai_vi_pham_id WHERE ${w.join(' AND ')}`,
        vals.slice(0, -2)
      );
      const r = await pool.query(
        `SELECT h.id,h.ma_ho_so,h.trang_thai,h.dia_chi,h.created_at,h.updated_at,${pointSelect('h')} FROM ho_so h LEFT JOIN loai_vi_pham lvp ON lvp.id=h.loai_vi_pham_id WHERE ${w.join(' AND ')} ORDER BY h.created_at DESC LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
        vals
      );
      res.json({
        data: r.rows,
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      });
    } catch (e) {
      next(e);
    }
  });

  router.get('/api/v1/ho-so/:id', authenticate, authorize('case.view'), async (req, res, next) => {
    try {
      const h = await pool.query(
        `SELECT h.*,${pointSelect('h')},row_to_json(bc) bao_cao,row_to_json(nvp) nguoi_vi_pham,row_to_json(uxl) nguoi_xu_ly FROM ho_so h LEFT JOIN bao_cao_vi_pham bc ON bc.id=h.bao_cao_id LEFT JOIN nguoi_vi_pham nvp ON nvp.id=h.nguoi_vi_pham_id LEFT JOIN (SELECT u.id,u.full_name,u.username FROM users u) uxl ON uxl.id=h.nguoi_xu_ly_id WHERE h.id=$1 AND h.deleted_at IS NULL`,
        [req.params.id]
      );
      if (!h.rows[0]) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
      const [bb, qd, kp, anh] = await Promise.all([
        pool.query('SELECT * FROM bien_ban WHERE ho_so_id=$1 ORDER BY created_at', [req.params.id]),
        pool.query('SELECT * FROM quyet_dinh WHERE ho_so_id=$1 ORDER BY created_at', [
          req.params.id,
        ]),
        pool.query('SELECT * FROM khac_phuc WHERE ho_so_id=$1 ORDER BY created_at', [
          req.params.id,
        ]),
        h.rows[0].bao_cao_id
          ? pool.query(
              'SELECT id,ten_goc,duong_dan,loai_file,kich_thuoc,created_at FROM tep_dinh_kem WHERE entity_type=$1 AND entity_id=$2 ORDER BY created_at',
              ['bao_cao', h.rows[0].bao_cao_id]
            )
          : Promise.resolve({ rows: [] }),
      ]);
      res.json({
        data: {
          ...h.rows[0],
          bien_ban: bb.rows,
          quyet_dinh: qd.rows,
          khac_phuc: kp.rows,
          anh: anh.rows,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  router.patch(
    '/api/v1/ho-so/:id/trang-thai',
    authenticate,
    authorize('case.update'),
    async (req, res, next) => {
      try {
        const nextState = req.body?.trang_thai;
        if (!STATES.has(nextState))
          {return res.status(400).json({ error: 'Trạng thái hồ sơ không hợp lệ' });}
        const old = (await pool.query('SELECT trang_thai FROM ho_so WHERE id=$1', [req.params.id]))
          .rows[0];
        if (!old) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
        if (!TRANSITIONS[old.trang_thai]?.includes(nextState))
          {return res.status(400).json({ error: 'Chuyển trạng thái không hợp lệ' });}
        // C — Role × state transition rules: only allowed roles may perform a transition
        const userRole = req.user?.roles?.[0] || '';
        if (userRole && !canTransition(userRole, nextState)) {
          return res.status(403).json({
            error: `Vai trò "${req.user.roles.join(', ')}" không có quyền chuyển sang trạng thái ${STATE_LABELS[nextState] || nextState}`,
          });
        }
        const r = await pool.query(
          'UPDATE ho_so SET trang_thai=$1 WHERE id=$2 RETURNING id,ma_ho_so,trang_thai,updated_at',
          [nextState, req.params.id]
        );
        await audit(pool, req, AUDIT_ACTIONS.CASE_STATUS_CHANGE, 'ho_so', req.params.id, {
          from: old.trang_thai,
          to: nextState,
        });
        try {
          const hs = await pool.query('SELECT nguoi_nop_id,nguoi_xu_ly_id FROM ho_so WHERE id=$1', [
            req.params.id,
          ]);
          const recipients = new Set(
            [hs.rows[0]?.nguoi_nop_id, hs.rows[0]?.nguoi_xu_ly_id].filter(Boolean)
          );
          for (const uid of recipients) {
            if (uid !== req.user.id)
              {await createThongBao(pool, {
                nguoi_nhan_id: uid,
                ho_so_id: req.params.id,
                loai: 'trang_thai',
                tieu_de: `${r.rows[0].ma_ho_so}: chuyển trạng thái`,
                noi_dung: `Từ ${STATE_LABELS[old.trang_thai] || old.trang_thai} → ${STATE_LABELS[nextState] || nextState}`,
              });}
            if (uid !== req.user.id && isSmtpConfigured())
              {await createThongBao(pool, {
                nguoi_nhan_id: uid,
                ho_so_id: req.params.id,
                loai: 'trang_thai',
                tieu_de: `${r.rows[0].ma_ho_so}: chuyển trạng thái`,
                noi_dung: `Từ ${STATE_LABELS[old.trang_thai] || old.trang_thai} → ${STATE_LABELS[nextState] || nextState}`,
                kenh: 'email',
                trang_thai: 'cho_gui',
              });}
          }
        } catch {
          /*notification failure should not block status update*/
        }
        res.json({ data: r.rows[0] });
      } catch (e) {
        next(e);
      }
    }
  );

  // PUT /api/v1/ho-so/:id/phan-cong — assign handler
  router.put(
    '/api/v1/ho-so/:id/phan-cong',
    authenticate,
    authorize('case.assign'),
    async (req, res, next) => {
      if (!requirePool(pool, res)) return;
      try {
        const { can_bo_id } = req.body || {};
        if (!can_bo_id) return res.status(400).json({ error: 'can_bo_id là bắt buộc' });
        if (!UUID_RE.test(can_bo_id))
          {return res.status(400).json({ error: 'can_bo_id không hợp lệ' });}
        const hoSo = await pool.query(
          'SELECT id, ma_ho_so, nguoi_xu_ly_id FROM ho_so WHERE id=$1 AND deleted_at IS NULL',
          [req.params.id]
        );
        if (!hoSo.rows[0]) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
        const handler = await pool.query(
          `SELECT u.id, u.full_name FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.id = $1 AND u.is_active = true AND r.code = 'case_handler'`,
          [can_bo_id]
        );
        if (!handler.rows[0])
          {return res
            .status(400)
            .json({ error: 'Cán bộ không tồn tại hoặc không có vai trò xử lý hồ sơ' });}
        const oldAssigneeId = hoSo.rows[0].nguoi_xu_ly_id;
        await pool.query('UPDATE ho_so SET nguoi_xu_ly_id=$1 WHERE id=$2', [
          can_bo_id,
          req.params.id,
        ]);
        await audit(pool, req, AUDIT_ACTIONS.CASE_ASSIGN, 'ho_so', req.params.id, {
          old_can_bo_id: oldAssigneeId || null,
          new_can_bo_id: can_bo_id,
          can_bo_ten: handler.rows[0].full_name,
        });
        res.json({
          data: {
            id: hoSo.rows[0].id,
            ma_ho_so: hoSo.rows[0].ma_ho_so,
            nguoi_xu_ly_id: can_bo_id,
            nguoi_xu_ly_ten: handler.rows[0].full_name,
          },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  router.post(
    '/api/v1/ho-so/:id/bien-ban',
    authenticate,
    authorize('bien_ban.create'),
    async (req, res, next) => {
      try {
        const h = (await pool.query('SELECT * FROM ho_so WHERE id=$1', [req.params.id])).rows[0];
        if (!h) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
        if (h.trang_thai !== 'cho_lap_bien_ban')
          {return res.status(400).json({ error: 'Hồ sơ phải ở trạng thái chờ lập biên bản' });}
        const code = await nextCode(pool, 'BB');
        const r = await pool.query(
          'INSERT INTO bien_ban (ma_bien_ban,ho_so_id,nguoi_lap_id,nguoi_vi_pham_id,hanh_vi_id,noi_dung,muc_phat_du_kien) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [
            code,
            h.id,
            req.user.id,
            h.nguoi_vi_pham_id,
            h.hanh_vi_id,
            req.body?.noi_dung || null,
            req.body?.muc_phat_du_kien || null,
          ]
        );
        await pool.query("UPDATE ho_so SET trang_thai='da_lap_bien_ban' WHERE id=$1", [h.id]);
        await audit(pool, req, AUDIT_ACTIONS.BIENBAN_CREATE, 'bien_ban', r.rows[0].id);
        res.status(201).json({ data: r.rows[0] });
      } catch (e) {
        next(e);
      }
    }
  );

  router.post(
    '/api/v1/ho-so/:id/quyet-dinh',
    authenticate,
    authorize('quyet_dinh.issue'),
    async (req, res, next) => {
      try {
        const h = (await pool.query('SELECT * FROM ho_so WHERE id=$1', [req.params.id])).rows[0];
        if (!h) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
        if (h.trang_thai !== 'cho_ra_quyet_dinh')
          {return res.status(400).json({ error: 'Hồ sơ phải ở trạng thái chờ ra quyết định' });}
        if (!req.body?.bien_ban_id) return res.status(400).json({ error: 'Biên bản là bắt buộc' });
        const bienBan = (
          await pool.query('SELECT id FROM bien_ban WHERE id=$1 AND ho_so_id=$2', [
            req.body.bien_ban_id,
            h.id,
          ])
        ).rows[0];
        if (!bienBan) return res.status(400).json({ error: 'Biên bản không thuộc hồ sơ' });
        const mp = await pool.query(
          'SELECT muc_toi_thieu,muc_toi_da FROM muc_phat WHERE hanh_vi_id=$1 AND nhom_cong_trinh=$2',
          [h.hanh_vi_id, req.body?.nhom_cong_trinh || 1]
        );
        const amount =
          req.body?.so_tien_phat ??
          (mp.rows[0]
            ? Math.round(
                Number(mp.rows[0].muc_toi_thieu) +
                  (Number(mp.rows[0].muc_toi_da) - Number(mp.rows[0].muc_toi_thieu)) / 2
              )
            : null);
        const subject = (
          await pool.query('SELECT loai_chu_the FROM nguoi_vi_pham WHERE id=$1', [
            h.nguoi_vi_pham_id,
          ])
        ).rows[0];
        const fine =
          subject?.loai_chu_the === 'ca_nhan' && amount !== null ? Math.floor(amount / 2) : amount;
        const code = await nextCode(pool, 'QD');
        const r = await pool.query(
          "INSERT INTO quyet_dinh (ma_quyet_dinh,bien_ban_id,ho_so_id,nguoi_ky_id,so_tien_phat,can_cu_phap_ly,hinh_thuc_phat_bo_sung,bien_phap_khac_phuc_hau_qua,trang_thai) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft') RETURNING *",
          [
            code,
            bienBan.id,
            h.id,
            req.user.id,
            fine,
            req.body?.can_cu_phap_ly || null,
            req.body?.hinh_thuc_phat_bo_sung || null,
            req.body?.bien_phap_khac_phuc_hau_qua || null,
          ]
        );
        await audit(pool, req, AUDIT_ACTIONS.QUYETDINH_CREATE, 'quyet_dinh', r.rows[0].id);
        res.status(201).json({ data: r.rows[0] });
      } catch (e) {
        next(e);
      }
    }
  );

  router.post(
    '/api/v1/ho-so/:id/quyet-dinh/ban-hanh',
    authenticate,
    authorize('quyet_dinh.issue'),
    async (req, res, next) => {
      try {
        const h = (
          await pool.query(
            'SELECT id,ma_ho_so,trang_thai,nguoi_nop_id,bao_cao_id FROM ho_so WHERE id=$1',
            [req.params.id]
          )
        ).rows[0];
        if (!h) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
        if (h.trang_thai !== 'cho_ra_quyet_dinh')
          {return res.status(400).json({ error: 'Hồ sơ phải ở trạng thái chờ ra quyết định' });}
        const qd = (
          await pool.query(
            "SELECT * FROM quyet_dinh WHERE ho_so_id=$1 AND trang_thai='draft' ORDER BY created_at DESC LIMIT 1",
            [req.params.id]
          )
        ).rows[0];
        if (!qd) return res.status(400).json({ error: 'Không có quyết định nháp để ban hành' });
        const ngayBH = req.body?.ngay_ban_hanh || null;
        const r = await pool.query(
          "UPDATE quyet_dinh SET trang_thai='da_ban_hanh',ngay_ban_hanh=COALESCE($1::date,CURRENT_DATE) WHERE id=$2 RETURNING *",
          [ngayBH, qd.id]
        );
        await pool.query("UPDATE ho_so SET trang_thai='da_ra_quyet_dinh' WHERE id=$1", [h.id]);
        await audit(pool, req, AUDIT_ACTIONS.QUYETDINH_ISSUE, 'quyet_dinh', qd.id, {
          ma_quyet_dinh: qd.ma_quyet_dinh,
        });
        res.json({ data: r.rows[0] });
      } catch (e) {
        next(e);
      }
    }
  );

  router.post(
    '/api/v1/ho-so/:id/khac-phuc',
    authenticate,
    authorize('khac_phuc.manage'),
    async (req, res, next) => {
      try {
        const h = (await pool.query('SELECT trang_thai FROM ho_so WHERE id=$1', [req.params.id]))
          .rows[0];
        if (!h) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
        if (h.trang_thai !== 'da_ra_quyet_dinh')
          {return res
            .status(400)
            .json({ error: 'Hồ sơ phải đã có quyết định để theo dõi khắc phục' });}
        if (
          req.body?.quyet_dinh_id &&
          !(
            await pool.query('SELECT 1 FROM quyet_dinh WHERE id=$1 AND ho_so_id=$2', [
              req.body.quyet_dinh_id,
              req.params.id,
            ])
          ).rows[0]
        )
          {return res.status(400).json({ error: 'Quyết định không thuộc hồ sơ' });}
        if (!req.body?.bien_phap?.trim()) {
          return res.status(400).json({ error: 'Biện pháp là bắt buộc' });
        }
        if (req.body.bien_phap.length > 1000) {
          return res.status(400).json({ error: 'Biện pháp không được vượt quá 1000 ký tự' });
        }
        if (req.body.mo_ta && req.body.mo_ta.length > 5000) {
          return res.status(400).json({ error: 'Mô tả không được vượt quá 5000 ký tự' });
        }
        const r = await pool.query(
          'INSERT INTO khac_phuc (ho_so_id,quyet_dinh_id,bien_phap,mo_ta,han_thuc_hien,nguoi_theo_doi_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
          [
            req.params.id,
            req.body?.quyet_dinh_id || null,
            req.body?.bien_phap,
            req.body?.mo_ta || null,
            req.body?.han_thuc_hien || null,
            req.user.id,
          ]
        );
        await pool.query("UPDATE ho_so SET trang_thai='dang_khac_phuc' WHERE id=$1", [
          req.params.id,
        ]);
        await audit(pool, req, AUDIT_ACTIONS.KHACPHUC_CREATE, 'khac_phuc', r.rows[0].id);
        res.status(201).json({ data: r.rows[0] });
      } catch (e) {
        next(e);
      }
    }
  );

  router.patch(
    '/api/v1/khac-phuc/:id',
    authenticate,
    authorize('khac_phuc.manage'),
    async (req, res, next) => {
      try {
        const valid = [
          'chua_thuc_hien',
          'dang_thuc_hien',
          'da_thuc_hien',
          'qua_han',
          'cuong_che',
          'da_kiem_tra',
        ];
        if (!valid.includes(req.body?.trang_thai))
          {return res.status(400).json({ error: 'Trạng thái khắc phục không hợp lệ' });}
        const r = await pool.query(
          "UPDATE khac_phuc SET trang_thai=$1::varchar,ngay_hoan_thanh=CASE WHEN $1::varchar='da_thuc_hien' THEN now() ELSE ngay_hoan_thanh END WHERE id=$2 RETURNING *",
          [req.body.trang_thai, req.params.id]
        );
        if (!r.rows[0])
          {return res.status(404).json({ error: 'Không tìm thấy thông tin khắc phục' });}
        if (req.body.trang_thai === 'da_thuc_hien')
          {await pool.query("UPDATE ho_so SET trang_thai='da_khac_phuc' WHERE id=$1", [
            r.rows[0].ho_so_id,
          ]);}
        await audit(pool, req, AUDIT_ACTIONS.KHACPHUC_UPDATE, 'khac_phuc', r.rows[0].id);
        res.json({ data: r.rows[0] });
      } catch (e) {
        next(e);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Export Biên bản / Quyết định ra DOCX
  // ---------------------------------------------------------------------------
  router.get(
    '/api/v1/ho-so/:id/xuat-bien-ban.docx',
    authenticate,
    authorize('case.update'),
    async (req, res, next) => {
      try {
        const data = await fetchHoSoDocxData(pool, req.params.id);
        if (!data) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
        if (!data.bien_ban) return res.status(400).json({ error: 'Hồ sơ chưa có biên bản' });
        const nguoiLap = await pool.query('SELECT full_name FROM users WHERE id=$1', [
          data.bien_ban.nguoi_lap_id,
        ]);
        const buffer = await generateBienBan({ ...data, nguoi_lap: nguoiLap.rows[0] });
        await audit(pool, req, AUDIT_ACTIONS.EXPORT_DOCX, 'bien_ban', data.bien_ban.id);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${data.bien_ban.ma_bien_ban || 'bien-ban'}.docx"`
        );
        res.send(buffer);
      } catch (e) {
        next(e);
      }
    }
  );

  router.get(
    '/api/v1/ho-so/:id/xuat-quyet-dinh.docx',
    authenticate,
    authorize('case.update'),
    async (req, res, next) => {
      try {
        const data = await fetchHoSoDocxData(pool, req.params.id);
        if (!data) return res.status(404).json({ error: 'Không tìm thấy hồ sơ' });
        if (!data.quyet_dinh) return res.status(400).json({ error: 'Hồ sơ chưa có quyết định' });
        const [nguoiKyRes, bbFullRes] = await Promise.all([
          pool.query('SELECT full_name FROM users WHERE id=$1', [data.quyet_dinh.nguoi_ky_id]),
          data.quyet_dinh.bien_ban_id
            ? pool.query('SELECT * FROM bien_ban WHERE id=$1', [data.quyet_dinh.bien_ban_id])
            : Promise.resolve({ rows: [data.bien_ban] }),
        ]);
        const buffer = await generateQuyetDinh({
          ...data,
          bien_ban: bbFullRes.rows[0] || data.bien_ban,
          nguoi_ky: nguoiKyRes.rows[0],
        });
        await audit(pool, req, AUDIT_ACTIONS.EXPORT_DOCX, 'quyet_dinh', data.quyet_dinh.id);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${data.quyet_dinh.ma_quyet_dinh || 'quyet-dinh'}.docx"`
        );
        res.send(buffer);
      } catch (e) {
        next(e);
      }
    }
  );

  // --- Per-case PDF export (Vietnamese font) ---
  router.get(
    '/api/v1/ho-so/:id/xuat-bien-ban.pdf',
    authenticate,
    authorize('case.update'),
    async (req, res, next) => {
      try {
        const data = await fetchHoSoDocxData(pool, req.params.id);
        if (!data)
          {return res.status(404).json({ error: 'Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1' });}
        if (!data.bien_ban)
          {return res
            .status(400)
            .json({ error: 'H\u1ed3 s\u01a1 ch\u01b0a c\u00f3 bi\u00ean b\u1ea3n' });}
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        vnFont(doc);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="' + (data.bien_ban.ma_bien_ban || 'bien-ban') + '.pdf"'
        );
        doc.pipe(res);
        doc
          .fontSize(14)
          .font('VN-Bold')
          .text('C\u1ed8NG H\u00d2A X\u00c3 H\u1ed8I CH\u1ee6 NGH\u0128A VI\u1ec6T NAM', {
            align: 'center',
          });
        doc
          .fontSize(11)
          .font('VN')
          .text('\u0110\u1ed9c l\u1eadp - T\u1ef1 do - H\u1ea1nh ph\u00fac', { align: 'center' });
        doc.moveDown(1);
        doc
          .fontSize(16)
          .font('VN-Bold')
          .text('BI\u00caN B\u1ea2N VI PH\u1ea0M H\u00c0NH CH\u00cdNH', { align: 'center' });
        doc.moveDown(0.3);
        doc
          .fontSize(11)
          .font('VN')
          .text('S\u1ed1: ' + (data.bien_ban.ma_bien_ban || '\u2026'), { align: 'center' });
        doc.moveDown(1);
        const diaChiVP =
          [
            data.ho_so.dia_chi,
            data.phuong_xa && data.phuong_xa.ten,
            data.quan_huyen && data.quan_huyen.ten,
          ]
            .filter(Boolean)
            .join(', ') || '\u2026';
        doc.fontSize(10).font('VN');
        doc.text('\u0110\u1ecba ch\u1ec9 vi ph\u1ea1m: ' + diaChiVP);
        doc.text(
          'Ng\u01b0\u1eddi vi ph\u1ea1m: ' +
            ((data.nguoi_vi_pham && data.nguoi_vi_pham.ten) || '\u2026')
        );
        doc.text('H\u00e0nh vi vi ph\u1ea1m: ' + ((data.hanh_vi && data.hanh_vi.ten) || '\u2026'));
        doc.text('M\u00f4 t\u1ea3: ' + (data.ho_so.mo_ta || data.bien_ban.noi_dung || '\u2026'));
        doc.text(
          'M\u1ee9c ph\u1ea1t d\u1ef1 ki\u1ebfn: ' +
            (data.bien_ban.muc_phat_du_kien !== null && data.bien_ban.muc_phat_du_kien !== undefined
              ? Number(data.bien_ban.muc_phat_du_kien).toLocaleString('vi-VN') + ' \u0111\u1ed3ng'
              : '\u2026')
        );
        if (data.bien_ban.noi_dung) doc.text('Ghi ch\u00fa: ' + data.bien_ban.noi_dung);
        doc.moveDown(2);
        doc
          .font('VN')
          .text(
            'Bi\u00ean b\u1ea3n \u0111\u01b0\u1ee3c l\u1eadp th\u00e0nh 02 b\u1ea3n, 01 b\u1ea3n giao cho ng\u01b0\u1eddi vi ph\u1ea1m, 01 b\u1ea3n l\u01b0u t\u1ea1i c\u01a1 quan.',
            { align: 'justify' }
          );
        doc.end();
        await audit(pool, req, AUDIT_ACTIONS.EXPORT_PDF, 'bien_ban', data.bien_ban.id);
      } catch (e) {
        next(e);
      }
    }
  );

  router.get(
    '/api/v1/ho-so/:id/xuat-quyet-dinh.pdf',
    authenticate,
    authorize('case.update'),
    async (req, res, next) => {
      try {
        const data = await fetchHoSoDocxData(pool, req.params.id);
        if (!data)
          {return res.status(404).json({ error: 'Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1' });}
        if (!data.quyet_dinh)
          {return res
            .status(400)
            .json({ error: 'H\u1ed3 s\u01a1 ch\u01b0a c\u00f3 quy\u1ebft \u0111\u1ecbnh' });}
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        vnFont(doc);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="' + (data.quyet_dinh.ma_quyet_dinh || 'quyet-dinh') + '.pdf"'
        );
        doc.pipe(res);
        doc
          .fontSize(14)
          .font('VN-Bold')
          .text('C\u1ed8NG H\u00d2A X\u00c3 H\u1ed8I CH\u1ee6 NGH\u0128A VI\u1ec6T NAM', {
            align: 'center',
          });
        doc
          .fontSize(11)
          .font('VN')
          .text('\u0110\u1ed9c l\u1eadp - T\u1ef1 do - H\u1ea1nh ph\u00fac', { align: 'center' });
        doc.moveDown(1);
        doc
          .fontSize(14)
          .font('VN-Bold')
          .text(
            'CH\u1ee6 T\u1ecaCH \u1ee8Y BAN NH\u00c2N D\u00c2N ' +
              (data.quan_huyen && data.quan_huyen.ten
                ? data.quan_huyen.ten.toUpperCase()
                : '\u2026'),
            { align: 'center' }
          );
        doc.moveDown(0.3);
        doc
          .fontSize(11)
          .font('VN-Bold')
          .text('S\u1ed1: ' + (data.quyet_dinh.ma_quyet_dinh || '\u2026'), { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).font('VN-Bold').text('QUY\u1ebeT \u0110\u1ecaNH', { align: 'center' });
        doc
          .fontSize(13)
          .font('VN-Bold')
          .text('X\u1eec PH\u1ea0T VI PH\u1ea0M H\u00c0NH CH\u00cdNH', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(10).font('VN');
        doc.text('X\u1eed ph\u1ea1t vi ph\u1ea1m h\u00e0nh ch\u00ednh \u0111\u1ed1i v\u1edbi:');
        doc.text(
          'T\u00ean ng\u01b0\u1eddi vi ph\u1ea1m: ' +
            ((data.nguoi_vi_pham && data.nguoi_vi_pham.ten) || '\u2026')
        );
        doc.text(
          'CMND/CCCD: ' + ((data.nguoi_vi_pham && data.nguoi_vi_pham.cmnd_cccd) || '\u2026')
        );
        doc.text('H\u00e0nh vi: ' + ((data.hanh_vi && data.hanh_vi.ten) || '\u2026'));
        const dieuKhoan = data.hanh_vi
          ? '\u0110i\u1ec1u ' +
            (data.hanh_vi.dieu || '16') +
            ', Kho\u1ea3n ' +
            (data.hanh_vi.khoan || '\u2026')
          : '\u2026';
        doc.text('\u0110i\u1ec1u/Kho\u1ea3n: ' + dieuKhoan + ' N\u0110 16/2022/N\u0110-CP');
        const diaChiVP =
          [
            data.ho_so.dia_chi,
            data.phuong_xa && data.phuong_xa.ten,
            data.quan_huyen && data.quan_huyen.ten,
          ]
            .filter(Boolean)
            .join(', ') || '\u2026';
        doc.text('\u0110\u1ecba ch\u1ec9 vi ph\u1ea1m: ' + diaChiVP);
        doc.moveDown(0.5);
        doc.fontSize(11).font('VN-Bold').text('H\u00ecnh th\u1ee9c x\u1eed ph\u1ea1t:');
        doc
          .fontSize(10)
          .font('VN')
          .text(
            'Ph\u1ea1t ti\u1ec1n: ' +
              (data.quyet_dinh.so_tien_phat !== null && data.quyet_dinh.so_tien_phat !== undefined
                ? Number(data.quyet_dinh.so_tien_phat).toLocaleString('vi-VN') + ' \u0111\u1ed3ng'
                : '\u2026')
          );
        if (data.quyet_dinh.hinh_thuc_phat_bo_sung)
          {doc.text('Ph\u1ea1t b\u1ed5 sung: ' + data.quyet_dinh.hinh_thuc_phat_bo_sung);}
        if (data.quyet_dinh.bien_phap_khac_phuc_hau_qua)
          {doc.text(
            'Kh\u1eafc ph\u1ee5c h\u1eadu qu\u1ea3: ' + data.quyet_dinh.bien_phap_khac_phuc_hau_qua
          );}
        doc.moveDown(1);
        doc
          .font('VN')
          .text(
            'Quy\u1ebft \u0111\u1ecbnh n\u00e0y c\u00f3 hi\u1ec7u l\u1ee9c k\u1ec3 t\u1eeb ng\u00e0y k\u00fd. Ng\u01b0\u1eddi vi ph\u1ea1m ph\u1ea3i ch\u1ea5p h\u00e0nh trong th\u1eddi h\u1ea1n 10 ng\u00e0y.',
            { align: 'justify' }
          );
        doc.end();
        await audit(pool, req, AUDIT_ACTIONS.EXPORT_PDF, 'quyet_dinh', data.quyet_dinh.id);
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
};
