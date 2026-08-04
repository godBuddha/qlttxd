import { useState, useEffect } from 'react';
import { errorText } from '../lib/api.js';
import { Loading } from '../components/Loading.jsx';
import { MapView } from '../components/MapView.jsx';

export function AdminLocationsPage({ api, notify }) {
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [modalType, setModalType] = useState('');
  const [form, setForm] = useState({ ma: '', ten: '', quan_huyen_id: '', boundary: '' });
  const [boundaryError, setBoundaryError] = useState('');
  const load = () => Promise.all([
    api('/api/v1/admin/quan-huyen').then((r) => setDistricts(r.data || [])),
    api('/api/v1/admin/phuong-xa').then((r) => setWards(r.data || []))
  ]).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const filteredWards = selectedDistrict ? wards.filter((w) => String(w.quan_huyen_id) === String(selectedDistrict.id)) : wards;
  let previewPolygons = [];
  if (form.boundary.trim()) {
    try {
      const parsed = JSON.parse(form.boundary);
      if (parsed.type === 'Feature') previewPolygons = [parsed];
      else if (parsed.type === 'FeatureCollection') previewPolygons = parsed.features || [];
      else if (parsed.type) previewPolygons = [{ type: 'Feature', geometry: parsed, properties: {} }];
    } catch { /* invalid JSON — no preview */ }
  }
  const change = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); if (e.target.name === 'boundary') setBoundaryError(''); };
  const openCreateDistrict = () => { setModalType('district'); setEditItem(null); setForm({ ma: '', ten: '', quan_huyen_id: '', boundary: '' }); setBoundaryError(''); setShowModal(true); };
  const openCreateWard = () => { setModalType('ward'); setEditItem(null); setForm({ ma: '', ten: '', quan_huyen_id: selectedDistrict?.id ? String(selectedDistrict.id) : '', boundary: '' }); setBoundaryError(''); setShowModal(true); };
  const openEdit = (item, type) => {
    setModalType(type); setEditItem(item);
    setForm({ ma: item.ma, ten: item.ten, quan_huyen_id: item.quan_huyen_id ? String(item.quan_huyen_id) : '', boundary: item.boundary ? (typeof item.boundary === 'string' ? item.boundary : JSON.stringify(item.boundary, null, 2)) : '' });
    setBoundaryError(''); setShowModal(true);
  };
  async function save(e) {
    e.preventDefault();
    if (!form.ma.trim() || !form.ten.trim()) return notify('Mã và tên là bắt buộc.', 'error');
    if (!/^[0-9A-Za-z-]{1,20}$/.test(form.ma.trim())) return notify('Mã phải từ 1-20 ký tự, chỉ gồm chữ, số và dấu gạch ngang.', 'error');
    if (modalType === 'ward' && !form.quan_huyen_id) return notify('Phải chọn quận/huyện cho phường/xã.', 'error');
    let boundaryPayload = null;
    if (form.boundary.trim()) {
      try { const parsed = JSON.parse(form.boundary); if (!parsed.type) return setBoundaryError('GeoJSON phải có trường type.'); boundaryPayload = parsed; }
      catch { return setBoundaryError('GeoJSON không hợp lệ. Kiểm tra lại định dạng JSON.'); }
    }
    const payload = { ma: form.ma.trim(), ten: form.ten.trim() };
    if (boundaryPayload) payload.boundary = boundaryPayload;
    if (modalType === 'ward') payload.quan_huyen_id = Number(form.quan_huyen_id);
    try {
      const ep = modalType === 'district' ? '/api/v1/admin/quan-huyen' : '/api/v1/admin/phuong-xa';
      if (editItem) { await api(`${ep}/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(payload) }); notify(`Đã cập nhật ${modalType === 'district' ? 'quận/huyện' : 'phường/xã'}.`, 'success'); }
      else { await api(ep, { method: 'POST', body: JSON.stringify(payload) }); notify(`Đã tạo ${modalType === 'district' ? 'quận/huyện' : 'phường/xã'} mới.`, 'success'); }
      setShowModal(false); load();
    } catch (err) { notify(errorText(err), 'error'); }
  }
  async function handleDelete(item, type) {
    const label = type === 'district' ? 'quận/huyện' : 'phường/xã';
    if (!window.confirm(`Xác nhận xóa ${label} "${item.ten}" (${item.ma})?`)) return;
    try {
      const ep = type === 'district' ? '/api/v1/admin/quan-huyen' : '/api/v1/admin/phuong-xa';
      await api(`${ep}/${item.id}`, { method: 'DELETE' }); notify(`Đã xóa ${label}.`, 'success');
      if (type === 'district' && selectedDistrict?.id === item.id) setSelectedDistrict(null);
      load();
    } catch (err) { notify(errorText(err), 'error'); }
  }
  if (loading) return <Loading />;
  return (
    <>
      <div className="page-title"><div><p className="eyebrow">Quản trị hệ thống</p><h2>Quản lý địa điểm</h2><p>Quản lý quận/huyện và phường/xã — đơn vị hành chính trong hệ thống.</p></div></div>
      <div className="two-col">
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <h3 style={{ margin: 0 }}>Quận/Huyện</h3>
            <button onClick={openCreateDistrict}>Thêm quận</button>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Tên</th><th>Mã</th><th>Phường</th><th></th></tr></thead>
            <tbody>{districts.length ? districts.map((d) => (
              <tr key={d.id} className={selectedDistrict?.id === d.id ? 'selected-row' : ''} onClick={() => setSelectedDistrict(selectedDistrict?.id === d.id ? null : d)} style={{ cursor: 'pointer', background: selectedDistrict?.id === d.id ? '#e7f0fe' : undefined }}>
                <td><strong>{d.ten}</strong></td><td>{d.ma}</td><td>{d.so_phuong ?? 0}</td>
                <td style={{ whiteSpace: 'nowrap' }}><button className="text-button" onClick={(e) => { e.stopPropagation(); openEdit(d, 'district'); }}>Sửa</button><button className="text-button" onClick={(e) => { e.stopPropagation(); handleDelete(d, 'district'); }}>Xóa</button></td>
              </tr>
            )) : <tr><td colSpan="4" className="empty">Chưa có quận/huyện nào.</td></tr>}</tbody></table></div>
        </section>
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <h3 style={{ margin: 0 }}>{selectedDistrict ? `Phường/Xã — ${selectedDistrict.ten}` : 'Phường/Xã'}</h3>
            <button onClick={openCreateWard}>Thêm phường</button>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Tên</th><th>Mã</th><th>Quận/Huyện</th><th></th></tr></thead>
            <tbody>{filteredWards.length ? filteredWards.map((w) => (
              <tr key={w.id}>
                <td>{w.ten}</td><td>{w.ma}</td><td>{w.quan_huyen_ten || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}><button className="text-button" onClick={() => openEdit(w, 'ward')}>Sửa</button><button className="text-button" onClick={() => handleDelete(w, 'ward')}>Xóa</button></td>
              </tr>
            )) : <tr><td colSpan="4" className="empty">{selectedDistrict ? `Chưa có phường/xã trong ${selectedDistrict.ten}.` : 'Chưa có phường/xã nào.'}</td></tr>}</tbody></table></div>
        </section>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 600px)' }}>
            <h3>{editItem ? 'Sửa' : 'Thêm'} {modalType === 'district' ? 'quận/huyện' : 'phường/xã'}</h3>
            <form onSubmit={save}>
              <label>Mã *<input required name="ma" value={form.ma} onChange={change} maxLength={20} pattern="[0-9A-Za-z\-]+" title="Chỉ gồm chữ, số và dấu gạch ngang, tối đa 20 ký tự" placeholder="VD: Q01, P-Ba-Dinh" /></label>
              <label>Tên *<input required name="ten" value={form.ten} onChange={change} maxLength={200} placeholder="VD: Quận Ba Đình" /></label>
              {modalType === 'ward' && <label>Quận/Huyện *<select required name="quan_huyen_id" value={form.quan_huyen_id} onChange={change}><option value="">-- Chọn quận/huyện --</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}</select></label>}
              <label>Boundary (GeoJSON)<textarea name="boundary" value={form.boundary} onChange={change} placeholder='Dán GeoJSON MultiPolygon hoặc Feature vào đây…' style={{ minHeight: 100, fontFamily: 'monospace', fontSize: '.82rem' }} /></label>
              {boundaryError && <div className="field-error">{boundaryError}</div>}
              {previewPolygons.length > 0 && <div><small style={{ color: '#667085', fontWeight: 600 }}>Preview ranh giới:</small><MapView polygons={previewPolygons} height="250px" /></div>}
              <div className="modal-actions"><button type="button" onClick={() => setShowModal(false)}>Hủy</button><button type="submit">Lưu</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
