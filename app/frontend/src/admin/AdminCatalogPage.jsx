import { useState, useEffect } from 'react';
import { errorText, money } from '../lib/api.js';
import { Loading } from '../components/Loading.jsx';
import { Tabs, TabPanel } from '../components/Tabs.jsx';

export function AdminCatalogPage({ api, notify }) {
  const [tab, setTab] = useState('loai-vi-pham');
  const [loaiVP, setLoaiVP] = useState([]);
  const [hanhVi, setHanhVi] = useState([]);
  const [mucPhat, setMucPhat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterLoai, setFilterLoai] = useState('');
  const [filterHanhVi, setFilterHanhVi] = useState('');
  const load = () =>
    Promise.all([
      api('/api/v1/admin/loai-vi-pham').then((r) => setLoaiVP(r.data || [])),
      api('/api/v1/admin/hanh-vi').then((r) => setHanhVi(r.data || [])),
      api('/api/v1/admin/muc-phat').then((r) => setMucPhat(r.data || [])),
    ]).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  const openCreate = () => {
    setEditItem(null);
    setShowModal(true);
  };
  const openEdit = (item) => {
    setEditItem(item);
    setShowModal(true);
  };
  const handleSave = async () => {
    setShowModal(false);
    load();
  };
  async function handleDelete(item, type) {
    const labels = { 'loai-vi-pham': 'loại vi phạm', 'hanh-vi': 'hành vi', 'muc-phat': 'mức phạt' };
    if (!window.confirm(`Xác nhận xóa ${labels[type]} "${item.ten || item.code}"?`)) return;
    try {
      await api(`/api/v1/admin/${type}/${item.id}`, { method: 'DELETE' });
      notify(`Đã xóa ${labels[type]}.`, 'success');
      load();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  }
  if (loading) return <Loading />;
  const filteredHanhVi = filterLoai
    ? hanhVi.filter((h) => String(h.loai_vi_pham_id) === String(filterLoai))
    : hanhVi;
  const filteredMucPhat = filterHanhVi
    ? mucPhat.filter((m) => String(m.hanh_vi_id) === String(filterHanhVi))
    : mucPhat;
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị hệ thống</p>
          <h2>Quản lý danh mục</h2>
          <p>Loại vi phạm, hành vi vi phạm, mức phạt — theo Điều 16 NĐ 16/2022/NĐ-CP.</p>
        </div>
      </div>
      <Tabs
        id="admin-catalog"
        label="Quản lý danh mục"
        tabs={[
          { key: 'loai-vi-pham', label: 'Loại vi phạm' },
          { key: 'hanh-vi', label: 'Hành vi vi phạm' },
          { key: 'muc-phat', label: 'Mức phạt' },
        ]}
        active={tab}
        onChange={setTab}
        style={{ marginBottom: 18 }}
      />
      <TabPanel id="admin-catalog" tabKey="loai-vi-pham" active={tab === 'loai-vi-pham'}>
        <section className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 15,
            }}
          >
            <h3 style={{ margin: 0 }}>Loại vi phạm ({loaiVP.length})</h3>
            <button onClick={openCreate}>Thêm loại</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>STT</th>
                  <th>Mô tả</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loaiVP.length ? (
                  loaiVP.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code>{item.code}</code>
                      </td>
                      <td>
                        <strong>{item.ten}</strong>
                      </td>
                      <td>{item.so_thu_tu}</td>
                      <td
                        style={{
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.mo_ta || '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="text-button" onClick={() => openEdit(item)}>
                          Sửa
                        </button>
                        <button
                          className="text-button"
                          onClick={() => handleDelete(item, 'loai-vi-pham')}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty">
                      Chưa có loại vi phạm nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </TabPanel>
      <TabPanel id="admin-catalog" tabKey="hanh-vi" active={tab === 'hanh-vi'}>
        <section className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 15,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0 }}>Hành vi vi phạm ({filteredHanhVi.length})</h3>
              <select
                value={filterLoai}
                onChange={(e) => setFilterLoai(e.target.value)}
                style={{ width: 'auto', minWidth: 180 }}
              >
                <option value="">Tất cả loại</option>
                {loaiVP.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.ten}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={openCreate}>Thêm hành vi</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Điều/Khoản/Điểm</th>
                  <th>Tên</th>
                  <th>Loại VP</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredHanhVi.length ? (
                  filteredHanhVi.map((item) => (
                    <tr key={item.id}>
                      <td>
                        Điều {item.dieu}, Khoản {item.khoan}
                        {item.diem ? `, Điểm ${item.diem}` : ''}
                      </td>
                      <td>{item.ten}</td>
                      <td>{item.loai_vi_pham_ten || '—'}</td>
                      <td>
                        {item.is_active ? (
                          <span className="badge da_khac_phuc">Hoạt động</span>
                        ) : (
                          <span className="badge da_huy">Tắt</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="text-button" onClick={() => openEdit(item)}>
                          Sửa
                        </button>
                        <button
                          className="text-button"
                          onClick={() => handleDelete(item, 'hanh-vi')}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty">
                      {filterLoai
                        ? 'Không có hành vi nào cho loại vi phạm này.'
                        : 'Chưa có hành vi vi phạm nào.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </TabPanel>
      <TabPanel id="admin-catalog" tabKey="muc-phat" active={tab === 'muc-phat'}>
        <section className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 15,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0 }}>Mức phạt ({filteredMucPhat.length})</h3>
              <select
                value={filterHanhVi}
                onChange={(e) => setFilterHanhVi(e.target.value)}
                style={{ width: 'auto', minWidth: 220 }}
              >
                <option value="">Tất cả hành vi</option>
                {hanhVi.map((h) => (
                  <option key={h.id} value={h.id}>
                    Khoản {h.khoan}: {h.ten?.slice(0, 60)}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={openCreate}>Thêm mức phạt</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hành vi (Khoản)</th>
                  <th>Nhóm CT</th>
                  <th>Tối thiểu</th>
                  <th>Tối đa</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredMucPhat.length ? (
                  filteredMucPhat.map((item) => (
                    <tr key={item.id}>
                      <td>
                        Khoản {item.khoan}: {item.hanh_vi_ten?.slice(0, 80) || '—'}
                      </td>
                      <td>Nhóm {item.nhom_cong_trinh}</td>
                      <td>{money(item.muc_toi_thieu)}</td>
                      <td>{money(item.muc_toi_da)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="text-button" onClick={() => openEdit(item)}>
                          Sửa
                        </button>
                        <button
                          className="text-button"
                          onClick={() => handleDelete(item, 'muc-phat')}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty">
                      {filterHanhVi
                        ? 'Không có mức phạt nào cho hành vi này.'
                        : 'Chưa có mức phạt nào.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </TabPanel>
      {showModal && (
        <CatalogModal
          tab={tab}
          editItem={editItem}
          loaiVP={loaiVP}
          hanhVi={hanhVi}
          api={api}
          notify={notify}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function CatalogModal({ tab, editItem, loaiVP, hanhVi, api, notify, onClose, onSave }) {
  const labels = {
    'loai-vi-pham': 'loại vi phạm',
    'hanh-vi': 'hành vi vi phạm',
    'muc-phat': 'mức phạt',
  };
  const [form, setForm] = useState(() => {
    if (tab === 'loai-vi-pham')
      return editItem
        ? {
            code: editItem.code,
            ten: editItem.ten,
            mo_ta: editItem.mo_ta || '',
            so_thu_tu: editItem.so_thu_tu ?? 0,
          }
        : { code: '', ten: '', mo_ta: '', so_thu_tu: 0 };
    if (tab === 'hanh-vi')
      return editItem
        ? {
            loai_vi_pham_id: editItem.loai_vi_pham_id,
            dieu: editItem.dieu || '16',
            khoan: editItem.khoan,
            diem: editItem.diem || '',
            ten: editItem.ten,
            mo_ta: editItem.mo_ta || '',
            is_active: editItem.is_active,
          }
        : {
            loai_vi_pham_id: '',
            dieu: '16',
            khoan: '',
            diem: '',
            ten: '',
            mo_ta: '',
            is_active: true,
          };
    return editItem
      ? {
          hanh_vi_id: editItem.hanh_vi_id,
          nhom_cong_trinh: editItem.nhom_cong_trinh,
          muc_toi_thieu: editItem.muc_toi_thieu,
          muc_toi_da: editItem.muc_toi_da,
        }
      : { hanh_vi_id: '', nhom_cong_trinh: 1, muc_toi_thieu: '', muc_toi_da: '' };
  });
  const [busy, setBusy] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'loai-vi-pham') {
        if (!form.code.trim()) return (notify('Mã là bắt buộc.', 'error'), setBusy(false));
        if (!form.ten.trim()) return (notify('Tên là bắt buộc.', 'error'), setBusy(false));
      }
      if (tab === 'hanh-vi') {
        if (!form.loai_vi_pham_id)
          return (notify('Phải chọn loại vi phạm.', 'error'), setBusy(false));
        if (!form.khoan.trim()) return (notify('Khoản là bắt buộc.', 'error'), setBusy(false));
        if (!form.ten.trim()) return (notify('Tên là bắt buộc.', 'error'), setBusy(false));
      }
      if (tab === 'muc-phat') {
        if (!form.hanh_vi_id) return (notify('Phải chọn hành vi.', 'error'), setBusy(false));
        if (Number(form.muc_toi_thieu) < 0)
          return (notify('Mức tối thiểu phải >= 0.', 'error'), setBusy(false));
        if (Number(form.muc_toi_da) < Number(form.muc_toi_thieu))
          return (notify('Mức tối đa phải >= mức tối thiểu.', 'error'), setBusy(false));
      }
      const payload = { ...form };
      if (tab === 'loai-vi-pham') payload.so_thu_tu = Number(payload.so_thu_tu) || 0;
      if (tab === 'hanh-vi') {
        payload.is_active = payload.is_active === true || payload.is_active === 'true';
      }
      if (tab === 'muc-phat') {
        payload.nhom_cong_trinh = Number(payload.nhom_cong_trinh);
        payload.muc_toi_thieu = Number(payload.muc_toi_thieu);
        payload.muc_toi_da = Number(payload.muc_toi_da);
      }
      const ep = `/api/v1/admin/${tab}`;
      if (editItem) {
        await api(`${ep}/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        notify(`Đã cập nhật ${labels[tab]}.`, 'success');
      } else {
        await api(ep, { method: 'POST', body: JSON.stringify(payload) });
        notify(`Đã tạo ${labels[tab]} mới.`, 'success');
      }
      onSave();
    } catch (err) {
      notify(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  }
  const NHOM_LABELS = {
    1: 'Nhóm 1 — Nhà ở riêng lẻ',
    2: 'Nhóm 2 — Nhà ở trong bảo tồn / CT khác',
    3: 'Nhóm 3 — Công trình BCNCKT / BCKT-KT',
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(100%, 580px)' }}
      >
        <h3>
          {editItem ? 'Sửa' : 'Thêm'} {labels[tab]}
        </h3>
        <form onSubmit={submit}>
          {tab === 'loai-vi-pham' && (
            <>
              <label>
                Mã *
                <input
                  required
                  name="code"
                  value={form.code}
                  onChange={change}
                  maxLength={30}
                  placeholder="VD: N_AT_CT"
                />
              </label>
              <label>
                Tên *
                <input
                  required
                  name="ten"
                  value={form.ten}
                  onChange={change}
                  maxLength={300}
                  placeholder="VD: Vi phạm về an toàn, vệ sinh công trường"
                />
              </label>
              <label>
                Thứ tự hiển thị
                <input
                  type="number"
                  name="so_thu_tu"
                  value={form.so_thu_tu}
                  onChange={change}
                  min="0"
                />
              </label>
              <label>
                Mô tả
                <textarea
                  name="mo_ta"
                  value={form.mo_ta}
                  onChange={change}
                  placeholder="Mô tả chi tiết (tùy chọn)"
                />
              </label>
            </>
          )}
          {tab === 'hanh-vi' && (
            <>
              <label>
                Loại vi phạm *
                <select
                  required
                  name="loai_vi_pham_id"
                  value={form.loai_vi_pham_id}
                  onChange={change}
                >
                  <option value="">-- Chọn loại vi phạm --</option>
                  {loaiVP.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.ten}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <span style={{ gridColumn: '1 / -1' }}>Điều/Khoản/Điểm *</span>
                <label style={{ fontWeight: 400 }}>
                  Điều
                  <input name="dieu" value={form.dieu} onChange={change} maxLength={10} />
                </label>
                <label style={{ fontWeight: 400 }}>
                  Khoản *
                  <input
                    required
                    name="khoan"
                    value={form.khoan}
                    onChange={change}
                    maxLength={10}
                    placeholder="1..13"
                  />
                </label>
                <label style={{ fontWeight: 400 }}>
                  Điểm
                  <input
                    name="diem"
                    value={form.diem}
                    onChange={change}
                    maxLength={10}
                    placeholder="a/b/c"
                  />
                </label>
              </label>
              <label>
                Tên *
                <input
                  required
                  name="ten"
                  value={form.ten}
                  onChange={change}
                  maxLength={500}
                  placeholder="Mô tả ngắn hành vi vi phạm"
                />
              </label>
              <label>
                Mô tả
                <textarea
                  name="mo_ta"
                  value={form.mo_ta}
                  onChange={change}
                  placeholder="Mô tả đầy đủ (tùy chọn)"
                />
              </label>
              <label>
                Trạng thái
                <select
                  name="is_active"
                  value={String(form.is_active)}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
                >
                  <option value="true">Hoạt động</option>
                  <option value="false">Tắt</option>
                </select>
              </label>
            </>
          )}
          {tab === 'muc-phat' && (
            <>
              <label>
                Hành vi vi phạm *
                <select required name="hanh_vi_id" value={form.hanh_vi_id} onChange={change}>
                  <option value="">-- Chọn hành vi --</option>
                  {hanhVi.map((h) => (
                    <option key={h.id} value={h.id}>
                      Khoản {h.khoan}: {h.ten}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nhóm công trình *
                <select
                  required
                  name="nhom_cong_trinh"
                  value={form.nhom_cong_trinh}
                  onChange={change}
                >
                  {Object.entries(NHOM_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mức phạt tối thiểu (VNĐ) *
                <input
                  required
                  type="number"
                  name="muc_toi_thieu"
                  value={form.muc_toi_thieu}
                  onChange={change}
                  min="0"
                  step="100000"
                  placeholder="VD: 3000000"
                />
              </label>
              <label>
                Mức phạt tối đa (VNĐ) *
                <input
                  required
                  type="number"
                  name="muc_toi_da"
                  value={form.muc_toi_da}
                  onChange={change}
                  min="0"
                  step="100000"
                  placeholder="VD: 5000000"
                />
              </label>
              <p className="hint" style={{ gridColumn: '1 / -1' }}>
                Mức phạt dành cho tổ chức. Mức dành cho cá nhân = 1/2.
              </p>
            </>
          )}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
