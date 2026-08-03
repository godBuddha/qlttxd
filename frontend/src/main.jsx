import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const HOME = [21.0285, 105.8542]; // Hà Nội
const STATES = ['cho_tiep_nhan', 'cho_xac_minh', 'dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban', 'da_lap_bien_ban', 'cho_ra_quyet_dinh', 'da_ra_quyet_dinh', 'dang_khac_phuc', 'cho_duyet_dieu_81', 'da_khac_phuc', 'da_dong', 'da_huy'];
const STATE_LABELS = { cho_tiep_nhan: 'Chờ tiếp nhận', cho_xac_minh: 'Chờ xác minh', dang_xac_minh: 'Đang xác minh', cho_bo_sung: 'Chờ bổ sung', cho_lap_bien_ban: 'Chờ lập biên bản', da_lap_bien_ban: 'Đã lập biên bản', cho_ra_quyet_dinh: 'Chờ ra quyết định', da_ra_quyet_dinh: 'Đã ra quyết định', dang_khac_phuc: 'Đang khắc phục', cho_duyet_dieu_81: 'Chờ duyệt Điều 81', da_khac_phuc: 'Đã khắc phục', da_dong: 'Đã đóng', da_huy: 'Đã hủy' };
const can = (user, permission) => Boolean(user?.permissions?.includes(permission));
const errorText = (err) => err?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
const dateText = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';
const money = (value) => value == null ? 'Chưa xác định' : `${Number(value).toLocaleString('vi-VN')} đ`;

async function request(path, options = {}, onUnauthorized) {
  const token = localStorage.getItem('qlttxd_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('X-Auth-Token', token);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response;
  try { response = await fetch(`${API_BASE}${path}`, { ...options, headers }); }
  catch { throw new Error('Không thể kết nối API. Kiểm tra máy chủ và VITE_API_BASE_URL.'); }
  let body = {};
  try { body = await response.json(); } catch { /* API may not return JSON */ }
  if (response.status === 401) { onUnauthorized?.(); throw new Error(body.error || 'Phiên đăng nhập đã hết hạn.'); }
  if (!response.ok) throw new Error(body.error || `Yêu cầu thất bại (${response.status})`);
  return body;
}

function Notice({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`notice ${notice.type || 'info'}`} role="status">{notice.text}<button aria-label="Đóng thông báo" onClick={onClose}>×</button></div>;
}

function MapView({ point, points = [], onPick, height = '360px' }) {
  const node = useRef(null); const map = useRef(null); const layers = useRef(L.layerGroup());
  useEffect(() => {
    if (map.current || !node.current) return undefined;
    map.current = L.map(node.current).setView(point ? [point.lat, point.lng] : HOME, point ? 16 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map.current);
    layers.current.addTo(map.current);
    if (onPick) map.current.on('click', (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }));
    return () => { map.current?.remove(); map.current = null; };
  }, [onPick]);
  useEffect(() => {
    if (!map.current) return;
    layers.current.clearLayers();
    const all = [...(point ? [{ ...point, label: 'Vị trí đã chọn' }] : []), ...points.filter(Boolean)];
    const markers = all.filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))).map((p) => {
      const marker = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#1f6feb', fillOpacity: 1 });
      if (p.label) marker.bindPopup(p.label);
      marker.addTo(layers.current); return marker;
    });
    if (point && markers[0]) map.current.setView([point.lat, point.lng], 16);
    else if (markers.length > 1) map.current.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
  }, [point, points]);
  return <div ref={node} className="map" style={{ height }} aria-label="Bản đồ GIS" />;
}

function Login({ onLogin, notice }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      localStorage.setItem('qlttxd_token', result.token); localStorage.setItem('qlttxd_user', JSON.stringify(result.user)); onLogin(result.user);
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-card"><div className="brand-mark">QL</div><h1>QLTTXD</h1><p>Hệ thống quản lý trật tự xây dựng</p><Notice notice={notice} onClose={() => {}} />{error && <div className="field-error">{error}</div>}<form onSubmit={submit}><label>Tên đăng nhập<input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} /></label><label>Mật khẩu<input autoComplete="current-password" required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><button disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button></form></section></main>;
}

function CitizenPage({ api, notify }) {
  const [point, setPoint] = useState(null); const [files, setFiles] = useState([]); const [reports, setReports] = useState([]); const [result, setResult] = useState(null); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ mo_ta: '', dia_chi: '', thoi_gian_xay_ra: '', nguoi_gui_ten: '', nguoi_gui_sdt: '', nguoi_gui_email: '' });
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  useEffect(() => { api('/api/v1/bao-cao').then((r) => setReports(r.data || [])).catch((e) => notify(errorText(e), 'error')); }, []);
  async function submit(e) {
    e.preventDefault(); if (!point) return notify('Vui lòng chọn vị trí trên bản đồ.', 'error');
    const payload = new FormData(); Object.entries(form).forEach(([key, value]) => value && payload.append(key, value)); payload.append('latitude', point.lat); payload.append('longitude', point.lng); files.forEach((f) => payload.append('anh', f));
    setBusy(true); setResult(null);
    try { const r = await api('/api/v1/bao-cao', { method: 'POST', body: payload }); setResult(r.data); setReports((old) => [r.data, ...old]); setForm({ mo_ta: '', dia_chi: '', thoi_gian_xay_ra: '', nguoi_gui_ten: '', nguoi_gui_sdt: '', nguoi_gui_email: '' }); setFiles([]); }
    catch (err) { notify(errorText(err), 'error'); } finally { setBusy(false); }
  }
  return <><div className="page-title"><div><p className="eyebrow">Cổng công dân</p><h2>Báo cáo vi phạm xây dựng</h2><p>Chọn chính xác vị trí, cung cấp thông tin và ảnh minh chứng (tối đa 5 ảnh).</p></div></div>{result && <section className="success-card"><strong>Đã tiếp nhận {result.ma_bao_cao}</strong><span>Vị trí: {result.toa_do?.lat?.toFixed(6)}, {result.toa_do?.lng?.toFixed(6)}. Quận/phường sẽ được hệ thống tự động xác định.</span></section>}<div className="two-col"><MapView point={point} onPick={setPoint} height="520px" /><form className="panel form-grid" onSubmit={submit}><h3>Nội dung báo cáo</h3><label className="full">Mô tả vi phạm *<textarea required name="mo_ta" value={form.mo_ta} onChange={change} placeholder="Mô tả công trình, hành vi và dấu hiệu vi phạm" /></label><label className="full">Địa chỉ<input name="dia_chi" value={form.dia_chi} onChange={change} /></label><label>Thời gian xảy ra<input type="datetime-local" name="thoi_gian_xay_ra" value={form.thoi_gian_xay_ra} onChange={change} /></label><div className="coordinate">Tọa độ: {point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : 'Chưa chọn'}</div><fieldset className="full"><legend>Người gửi</legend><label>Họ tên<input name="nguoi_gui_ten" value={form.nguoi_gui_ten} onChange={change} /></label><label>Số điện thoại<input name="nguoi_gui_sdt" value={form.nguoi_gui_sdt} onChange={change} /></label><label>Email<input type="email" name="nguoi_gui_email" value={form.nguoi_gui_email} onChange={change} /></label></fieldset><label className="full">Ảnh minh chứng<input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 5))} /></label>{files.length > 0 && <div className="file-list full">Đã chọn: {files.map((f) => f.name).join(', ')}</div>}<button className="full" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi báo cáo'}</button></form></div><section className="panel"><h3>Báo cáo của tôi</h3><ReportTable reports={reports} /></section></>;
}

function ReportTable({ reports }) { return <div className="table-wrap"><table><thead><tr><th>Mã báo cáo</th><th>Mô tả</th><th>Địa chỉ</th><th>Ngày tạo</th></tr></thead><tbody>{reports.length ? reports.map((r) => <tr key={r.id || r.ma_bao_cao}><td>{r.ma_bao_cao}</td><td>{r.mo_ta || '—'}</td><td>{r.dia_chi || '—'}</td><td>{dateText(r.created_at)}</td></tr>) : <tr><td colSpan="4" className="empty">Chưa có báo cáo nào.</td></tr>}</tbody></table></div>; }

function Dashboard({ api, navigate, notify }) {
  const [data, setData] = useState(null); useEffect(() => { api('/api/v1/thong-ke/tong-quan').then((r) => setData(r.data)).catch((e) => notify(errorText(e), 'error')); }, []);
  if (!data) return <Loading />;
  const total = data.theo_trang_thai.reduce((sum, x) => sum + Number(x.so_luong), 0);
  return <><div className="page-title"><div><p className="eyebrow">Quản trị nội bộ</p><h2>Bảng điều khiển</h2><p>Tổng quan hồ sơ vi phạm đang được xử lý.</p></div><button onClick={() => navigate('cases')}>Xem hồ sơ</button></div><div className="stat-grid"><Stat label="Tổng hồ sơ" value={total} /><Stat label="Đang xử lý" value={data.theo_trang_thai.filter((x) => !['da_dong', 'da_huy'].includes(x.trang_thai)).reduce((s, x) => s + Number(x.so_luong), 0)} /><Stat label="Đã đóng" value={data.theo_trang_thai.find((x) => x.trang_thai === 'da_dong')?.so_luong || 0} /></div><div className="chart-grid"><Chart title="Hồ sơ theo trạng thái" data={data.theo_trang_thai} label="trang_thai" /><Chart title="Hồ sơ theo quận/huyện" data={data.theo_quan} label="ten" /><Chart title="Hồ sơ theo tháng" data={data.theo_thang} label="thang" /></div></>;
}
function Stat({ label, value }) { return <section className="stat"><span>{label}</span><strong>{value}</strong></section>; }
function Chart({ title, data, label }) { const max = Math.max(1, ...data.map((x) => Number(x.so_luong))); return <section className="panel chart"><h3>{title}</h3>{data.length ? data.map((x) => <div className="bar-row" key={x[label]}><span title={x[label]}>{STATE_LABELS[x[label]] || x[label]}</span><i><b style={{ width: `${(Number(x.so_luong) / max) * 100}%` }} /></i><em>{x.so_luong}</em></div>) : <p className="empty">Chưa có dữ liệu.</p>}</section>; }
function Loading() { return <div className="loading">Đang tải dữ liệu…</div>; }

function CaseList({ api, navigate, notify }) {
  const [cases, setCases] = useState([]); const [districts, setDistricts] = useState([]); const [filters, setFilters] = useState({ q: '', trang_thai: '', quan_huyen_id: '', page: 1 }); const [loading, setLoading] = useState(true);
  useEffect(() => { api('/api/v1/danh-muc/quan-huyen').then((r) => setDistricts(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { setLoading(true); const q = new URLSearchParams({ page: filters.page, limit: 20 }); if (filters.q) q.set('q', filters.q); if (filters.trang_thai) q.set('trang_thai', filters.trang_thai); if (filters.quan_huyen_id) q.set('quan_huyen_id', filters.quan_huyen_id); api(`/api/v1/ho-so?${q}`).then((r) => setCases(r.data || [])).catch((e) => notify(errorText(e), 'error')).finally(() => setLoading(false)); }, [filters]);
  const set = (key, value) => setFilters((old) => ({ ...old, [key]: value, page: key === 'page' ? value : 1 }));
  return <><div className="page-title"><div><p className="eyebrow">Quản trị nội bộ</p><h2>Danh sách hồ sơ</h2><p>Lọc, tra cứu và chọn hồ sơ để xử lý.</p></div></div><section className="panel filters"><label>Tìm kiếm<input value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="Mã hồ sơ hoặc mô tả" /></label><label>Trạng thái<select value={filters.trang_thai} onChange={(e) => set('trang_thai', e.target.value)}><option value="">Tất cả</option>{STATES.map((x) => <option key={x} value={x}>{STATE_LABELS[x]}</option>)}</select></label><label>Quận/huyện<select value={filters.quan_huyen_id} onChange={(e) => set('quan_huyen_id', e.target.value)}><option value="">Tất cả</option>{districts.map((x) => <option key={x.id} value={x.id}>{x.ten}</option>)}</select></label></section>{loading ? <Loading /> : <><section className="panel"><div className="table-wrap"><table><thead><tr><th>Mã HS</th><th>Trạng thái</th><th>Địa chỉ</th><th>Ngày tạo</th><th>Tọa độ</th><th></th></tr></thead><tbody>{cases.length ? cases.map((item) => <tr key={item.id}><td>{item.ma_ho_so}</td><td><Status value={item.trang_thai} /></td><td>{item.dia_chi || '—'}</td><td>{dateText(item.created_at)}</td><td>{item.toa_do ? `${Number(item.toa_do.lat).toFixed(4)}, ${Number(item.toa_do.lng).toFixed(4)}` : '—'}</td><td><button className="text-button" onClick={() => navigate('case', item.id)}>Chi tiết</button></td></tr>) : <tr><td colSpan="6" className="empty">Không có hồ sơ phù hợp.</td></tr>}</tbody></table></div><div className="pagination"><button disabled={filters.page === 1} onClick={() => set('page', filters.page - 1)}>← Trang trước</button><span>Trang {filters.page}</span><button disabled={cases.length < 20} onClick={() => set('page', filters.page + 1)}>Trang sau →</button></div></section><section className="panel"><h3>Bản đồ hồ sơ trong trang</h3><MapView points={cases.filter((x) => x.toa_do).map((x) => ({ ...x.toa_do, label: x.ma_ho_so }))} height="300px" /></section></>}</>;
}
function Status({ value }) { return <span className={`badge ${value}`}>{STATE_LABELS[value] || value}</span>; }

function CaseDetail({ id, api, user, navigate, notify }) {
  const [item, setItem] = useState(null); const [tab, setTab] = useState('overview'); const [busy, setBusy] = useState(false); const [state, setState] = useState('');
  const load = () => api(`/api/v1/ho-so/${id}`).then((r) => { setItem(r.data); setState(r.data.trang_thai); }).catch((e) => notify(errorText(e), 'error'));
  useEffect(() => { load(); }, [id]);
  if (!item) return <Loading />;
  async function transition() { if (!state || state === item.trang_thai) return; setBusy(true); try { await api(`/api/v1/ho-so/${id}/trang-thai`, { method: 'PATCH', body: JSON.stringify({ trang_thai: state }) }); notify('Đã cập nhật trạng thái.', 'success'); load(); } catch (e) { notify(errorText(e), 'error'); setState(item.trang_thai); } finally { setBusy(false); } }
  return <><div className="page-title"><div><button className="back" onClick={() => navigate('cases')}>← Danh sách hồ sơ</button><h2>{item.ma_ho_so}</h2><Status value={item.trang_thai} /></div></div><div className="detail-grid"><section className="panel"><h3>Thông tin hồ sơ</h3><dl><dt>Địa chỉ</dt><dd>{item.dia_chi || '—'}</dd><dt>Mô tả</dt><dd>{item.mo_ta || item.bao_cao?.mo_ta || '—'}</dd><dt>Thời gian xảy ra</dt><dd>{dateText(item.thoi_gian_xay_ra)}</dd><dt>Người vi phạm</dt><dd>{item.nguoi_vi_pham?.ten || 'Chưa cập nhật'}</dd><dt>Trạng thái</dt><dd><Status value={item.trang_thai} /></dd></dl>{can(user, 'case.update') && <div className="action-box"><label>Chuyển trạng thái<select value={state} onChange={(e) => setState(e.target.value)}>{STATES.map((x) => <option key={x} value={x}>{STATE_LABELS[x]}</option>)}</select></label><button disabled={busy || state === item.trang_thai} onClick={transition}>Cập nhật</button><small>Hệ thống chỉ chấp nhận các chuyển trạng thái hợp lệ.</small></div>}</section><section className="panel"><h3>Vị trí GIS</h3>{item.toa_do ? <MapView point={item.toa_do} height="350px" /> : <p className="empty">Hồ sơ chưa có tọa độ.</p>}</section></div><section className="panel"><div className="tabs">{[['overview', 'Timeline'], ['minutes', 'Biên bản'], ['decision', 'Quyết định'], ['remedy', 'Khắc phục']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>{tab === 'overview' && <Timeline item={item} />}{tab === 'minutes' && <Minutes caseItem={item} api={api} allow={can(user, 'bien_ban.create')} notify={notify} refresh={load} />}{tab === 'decision' && <Decision caseItem={item} api={api} allow={can(user, 'quyet_dinh.issue')} notify={notify} refresh={load} />}{tab === 'remedy' && <Remedy caseItem={item} api={api} allow={can(user, 'khac_phuc.manage')} notify={notify} refresh={load} />}</section></>;
}
function Timeline({ item }) { return <div><h3>Tiến trình xử lý</h3><ol className="timeline"><li><b>Khởi tạo hồ sơ</b><span>{dateText(item.created_at)}</span></li><li className="current"><b>{STATE_LABELS[item.trang_thai]}</b><span>Cập nhật {dateText(item.updated_at)}</span></li></ol></div>; }
function Minutes({ caseItem, api, allow, notify, refresh }) { const [noi_dung, setNoiDung] = useState(''); const [muc_phat_du_kien, setFine] = useState(''); async function submit(e) { e.preventDefault(); try { await api(`/api/v1/ho-so/${caseItem.id}/bien-ban`, { method: 'POST', body: JSON.stringify({ noi_dung, muc_phat_du_kien: muc_phat_du_kien || null }) }); notify('Đã lập biên bản.', 'success'); refresh(); } catch (x) { notify(errorText(x), 'error'); } } return <div className="tab-body"><h3>Biên bản</h3>{caseItem.bien_ban?.length ? <ul className="record-list">{caseItem.bien_ban.map((x) => <li key={x.id}><b>{x.ma_bien_ban}</b><span>{x.noi_dung || 'Không có nội dung'} — {money(x.muc_phat_du_kien)}</span></li>)}</ul> : <p className="empty">Chưa có biên bản.</p>}{allow && <form className="inline-form" onSubmit={submit}><h4>Lập biên bản</h4><label>Nội dung<textarea value={noi_dung} onChange={(e) => setNoiDung(e.target.value)} /></label><label>Mức phạt dự kiến<input type="number" min="0" value={muc_phat_du_kien} onChange={(e) => setFine(e.target.value)} /></label><button>Lập biên bản</button></form>}</div>; }
function Decision({ caseItem, api, allow, notify, refresh }) { const [form, setForm] = useState({ bien_ban_id: '', nhom_cong_trinh: '1', can_cu_phap_ly: '', hinh_thuc_phat_bo_sung: '', bien_phap_khac_phuc_hau_qua: '', ngay_ban_hanh: '' }); const set = (e) => setForm({ ...form, [e.target.name]: e.target.value }); async function submit(e) { e.preventDefault(); try { await api(`/api/v1/ho-so/${caseItem.id}/quyet-dinh`, { method: 'POST', body: JSON.stringify({ ...form, bien_ban_id: form.bien_ban_id || null, nhom_cong_trinh: Number(form.nhom_cong_trinh) }) }); notify('Đã ban hành quyết định.', 'success'); refresh(); } catch (x) { notify(errorText(x), 'error'); } } return <div className="tab-body"><h3>Quyết định xử phạt</h3>{caseItem.quyet_dinh?.length ? <ul className="record-list">{caseItem.quyet_dinh.map((x) => <li key={x.id}><b>{x.ma_quyet_dinh}</b><span>{money(x.so_tien_phat)} · {dateText(x.ngay_ban_hanh)}</span></li>)}</ul> : <p className="empty">Chưa có quyết định.</p>}{allow && <form className="inline-form form-grid" onSubmit={submit}><h4 className="full">Ban hành quyết định</h4><label>Biên bản<select name="bien_ban_id" value={form.bien_ban_id} onChange={set}><option value="">Không chọn</option>{(caseItem.bien_ban || []).map((x) => <option key={x.id} value={x.id}>{x.ma_bien_ban}</option>)}</select></label><label>Nhóm công trình<input type="number" min="1" name="nhom_cong_trinh" value={form.nhom_cong_trinh} onChange={set} /></label><label>Căn cứ pháp lý<input name="can_cu_phap_ly" value={form.can_cu_phap_ly} onChange={set} /></label><label>Ngày ban hành<input type="date" name="ngay_ban_hanh" value={form.ngay_ban_hanh} onChange={set} /></label><label className="full">Hình thức phạt bổ sung<textarea name="hinh_thuc_phat_bo_sung" value={form.hinh_thuc_phat_bo_sung} onChange={set} /></label><label className="full">Biện pháp khắc phục hậu quả<textarea name="bien_phap_khac_phuc_hau_qua" value={form.bien_phap_khac_phuc_hau_qua} onChange={set} /></label><button className="full">Ban hành quyết định</button></form>}</div>; }
function Remedy({ caseItem, api, allow, notify, refresh }) { const [form, setForm] = useState({ quyet_dinh_id: '', bien_phap: '', mo_ta: '', han_thuc_hien: '' }); const [remedy, setRemedy] = useState(null); const [status, setStatus] = useState('dang_thuc_hien'); const set = (e) => setForm({ ...form, [e.target.name]: e.target.value }); async function submit(e) { e.preventDefault(); try { const r = await api(`/api/v1/ho-so/${caseItem.id}/khac-phuc`, { method: 'POST', body: JSON.stringify({ ...form, quyet_dinh_id: form.quyet_dinh_id || null }) }); setRemedy(r.data); notify('Đã đăng ký theo dõi khắc phục.', 'success'); refresh(); } catch (x) { notify(errorText(x), 'error'); } } async function update() { try { const r = await api(`/api/v1/khac-phuc/${remedy.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: status }) }); setRemedy(r.data); notify('Đã cập nhật trạng thái khắc phục.', 'success'); refresh(); } catch (x) { notify(errorText(x), 'error'); } } return <div className="tab-body"><h3>Khắc phục hậu quả</h3><p className="hint">Sau khi đăng ký trong phiên hiện tại, có thể cập nhật trạng thái theo dõi. API chi tiết hồ sơ hiện chưa trả danh sách khắc phục đã có, nên cần chọn hồ sơ/tạo thông tin để thao tác tiếp.</p>{remedy && <div className="action-box"><b>Thông tin khắc phục vừa tạo</b><label>Trạng thái<select value={status} onChange={(e) => setStatus(e.target.value)}>{['chua_thuc_hien','dang_thuc_hien','da_thuc_hien','qua_han','cuong_che','da_kiem_tra'].map((x) => <option key={x} value={x}>{x.replaceAll('_', ' ')}</option>)}</select></label><button onClick={update}>Cập nhật trạng thái</button></div>}{allow && <form className="inline-form form-grid" onSubmit={submit}><label>Quyết định<select name="quyet_dinh_id" value={form.quyet_dinh_id} onChange={set}><option value="">Không chọn</option>{(caseItem.quyet_dinh || []).map((x) => <option key={x.id} value={x.id}>{x.ma_quyet_dinh}</option>)}</select></label><label>Hạn thực hiện<input type="date" name="han_thuc_hien" value={form.han_thuc_hien} onChange={set} /></label><label className="full">Biện pháp *<textarea required name="bien_phap" value={form.bien_phap} onChange={set} /></label><label className="full">Mô tả<textarea name="mo_ta" value={form.mo_ta} onChange={set} /></label><button className="full">Đăng ký khắc phục</button></form>}</div>; }

function SetupAdminPage({ onSetup }) {
  const [form, setForm] = useState({ full_name: '', username: '', email: '', phone: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Mật khẩu xác nhận không khớp');
    setBusy(true); setError('');
    try {
      const result = await request('/api/v1/auth/setup-admin', {
        method: 'POST',
        body: JSON.stringify({ username: form.username, password: form.password, full_name: form.full_name, email: form.email || undefined, phone: form.phone || undefined })
      });
      localStorage.setItem('qlttxd_token', result.token);
      localStorage.setItem('qlttxd_user', JSON.stringify(result.user));
      onSetup(result.user);
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">QL</div>
        <h1>QLTTXD</h1>
        <p>Đăng ký quản trị viên đầu tiên</p>
        {error && <div className="field-error">{error}</div>}
        <form onSubmit={submit}>
          <label>Họ và tên<input required name="full_name" value={form.full_name} onChange={change} /></label>
          <label>Tên đăng nhập<input required name="username" value={form.username} onChange={change} minLength={3} maxLength={50} /></label>
          <label>Email<input type="email" name="email" value={form.email} onChange={change} /></label>
          <label>Số điện thoại<input name="phone" value={form.phone} onChange={change} /></label>
          <label>Mật khẩu<input required type="password" name="password" value={form.password} onChange={change} minLength={8} /></label>
          <label>Xác nhận mật khẩu<input required type="password" name="confirm" value={form.confirm} onChange={change} /></label>
          <button disabled={busy}>{busy ? 'Đang tạo tài khoản…' : 'Đăng ký quản trị viên'}</button>
        </form>
      </section>
    </main>
  );
}

function AdminUsersPage({ api, notify }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', email: '', phone: '', roles: [] });
  const load = () => Promise.all([
    api('/api/v1/admin/users').then((r) => setUsers(r.data || [])),
    api('/api/v1/admin/roles').then((r) => setRoles(r.data || []))
  ]).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const toggleRole = (code) => setForm((f) => ({ ...f, roles: f.roles.includes(code) ? f.roles.filter((r) => r !== code) : [...f.roles, code] }));
  const openCreate = () => { setEditUser(null); setForm({ username: '', password: '', full_name: '', email: '', phone: '', roles: [] }); setShowModal(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ username: u.username, password: '', full_name: u.full_name, email: u.email || '', phone: u.phone || '', roles: u.roles || [] }); setShowModal(true); };
  async function save(e) {
    e.preventDefault();
    try {
      if (editUser) {
        const payload = { full_name: form.full_name, email: form.email || null, phone: form.phone || null, roles: form.roles };
        if (form.password) payload.password = form.password;
        await api(`/api/v1/admin/users/${editUser.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        notify('Đã cập nhật người dùng.', 'success');
      } else {
        await api('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(form) });
        notify('Đã tạo người dùng mới.', 'success');
      }
      setShowModal(false); load();
    } catch (err) { notify(errorText(err), 'error'); }
  }
  async function toggleActive(u) {
    try {
      await api(`/api/v1/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !u.is_active }) });
      notify(u.is_active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.', 'success');
      load();
    } catch (err) { notify(errorText(err), 'error'); }
  }
  if (loading) return <Loading />;
  return (
    <>
      <div className="page-title"><div><p className="eyebrow">Quản trị hệ thống</p><h2>Quản lý người dùng</h2></div><button onClick={openCreate}>Tạo tài khoản</button></div>
      <section className="panel"><div className="table-wrap"><table><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td>{u.username}</td><td>{u.full_name}</td><td>{u.email || '—'}</td><td>{u.roles?.join(', ') || '—'}</td><td>{u.is_active ? 'Hoạt động' : 'Đã khóa'}</td><td><button className="text-button" onClick={() => openEdit(u)}>Sửa</button><button className="text-button" onClick={() => toggleActive(u)}>{u.is_active ? 'Khóa' : 'Mở'}</button></td></tr>)}</tbody></table></div></section>
      {showModal && <div className="modal-overlay" onClick={() => setShowModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><h3>{editUser ? 'Sửa người dùng' : 'Tạo người dùng'}</h3><form onSubmit={save}><label>Họ tên<input required name="full_name" value={form.full_name} onChange={change} /></label>{!editUser && <label>Tên đăng nhập<input required name="username" value={form.username} onChange={change} minLength={3} maxLength={50} /></label>}<label>Email<input type="email" name="email" value={form.email} onChange={change} /></label><label>Số điện thoại<input name="phone" value={form.phone} onChange={change} /></label><label>{editUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}<input type="password" name="password" value={form.password} onChange={change} minLength={8} /></label><fieldset><legend>Vai trò</legend>{roles.map((r) => <label key={r.code} className="checkbox"><input type="checkbox" checked={form.roles.includes(r.code)} onChange={() => toggleRole(r.code)} />{r.name}</label>)}</fieldset><div className="modal-actions"><button type="button" onClick={() => setShowModal(false)}>Hủy</button><button type="submit">Lưu</button></div></form></div></div>}
    </>
  );
}

function AdminRolesPage({ api, notify }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePerms, setRolePerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = () => Promise.all([
    api('/api/v1/admin/roles').then((r) => setRoles(r.data || [])),
    api('/api/v1/admin/permissions').then((r) => setPermissions(r.data || []))
  ]).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const selectRole = (role) => { setSelectedRole(role); setRolePerms(role.permissions?.map((p) => p.id) || []); };
  const togglePerm = (id) => setRolePerms((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  async function save() {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await api(`/api/v1/admin/roles/${selectedRole.id}/permissions`, { method: 'PATCH', body: JSON.stringify({ permission_ids: rolePerms }) });
      notify('Đã cập nhật quyền cho vai trò.', 'success');
      load();
    } catch (err) { notify(errorText(err), 'error'); } finally { setSaving(false); }
  }
  if (loading) return <Loading />;
  return (
    <>
      <div className="page-title"><div><p className="eyebrow">Quản trị hệ thống</p><h2>Phân quyền vai trò</h2></div></div>
      <div className="two-col">
        <section className="panel"><h3>Vai trò</h3><ul className="role-list">{roles.map((r) => <li key={r.id} className={selectedRole?.id === r.id ? 'selected' : ''} onClick={() => selectRole(r)}><b>{r.name}</b><small>{r.code}</small></li>)}</ul></section>
        <section className="panel"><h3>Quyền hạn {selectedRole && `— ${selectedRole.name}`}</h3>{selectedRole ? <><div className="permission-grid">{permissions.map((mod) => <div key={mod.module} className="perm-module"><h4>{mod.module}</h4>{mod.permissions.map((p) => <label key={p.id} className="checkbox"><input type="checkbox" checked={rolePerms.includes(p.id)} onChange={() => togglePerm(p.id)} />{p.name}</label>)}</div>)}</div><button onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu quyền'}</button></> : <p className="empty">Chọn vai trò bên trái để chỉnh sửa quyền.</p>}</section>
      </div>
    </>
  );
}

function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('qlttxd_user')); } catch { return null; } }); const [route, setRoute] = useState(() => ({ page: 'home', id: null })); const [notice, setNotice] = useState(null); const [needsSetup, setNeedsSetup] = useState(null);
  const notify = (text, type = 'info') => setNotice({ text, type });
  useEffect(() => {
    if (!user) {
      request('/api/v1/auth/setup-status').then((r) => setNeedsSetup(r.needsSetup)).catch(() => setNeedsSetup(false));
    }
  }, [user]);
  const logout = async () => { try { await request('/api/v1/auth/logout', { method: 'POST' }); } catch { /* local logout is still safe */ } localStorage.removeItem('qlttxd_token'); localStorage.removeItem('qlttxd_user'); setUser(null); setRoute({ page: 'home' }); notify('Đã đăng xuất.', 'success'); };
  const api = (path, opts) => request(path, opts, () => { localStorage.removeItem('qlttxd_token'); localStorage.removeItem('qlttxd_user'); setUser(null); notify('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error'); });
  if (!user) {
    if (needsSetup === null) return <Loading />;
    if (needsSetup) return <SetupAdminPage onSetup={(value) => { setUser(value); setRoute({ page: 'admin-users' }); }} />;
    return <Login onLogin={(value) => { setUser(value); setRoute({ page: can(value, 'case.view') ? 'dashboard' : 'citizen' }); }} notice={notice} />;
  }
  const nav = (page, id = null) => setRoute({ page, id }); const isOfficer = can(user, 'case.view');
  return <div className="app-shell"><header><div className="logo" onClick={() => nav(isOfficer ? 'dashboard' : 'citizen')} role="button" tabIndex="0">QLTTXD</div><div className="user-menu"><span>{user.full_name || user.username}</span><small>{user.roles?.join(', ') || 'Người dùng'}</small><button className="logout" onClick={logout}>Đăng xuất</button></div></header><div className="body"><aside><nav>{!isOfficer && can(user, 'report.create') && <button className={route.page === 'citizen' ? 'selected' : ''} onClick={() => nav('citizen')}>⌖ Báo cáo vi phạm</button>}{isOfficer && <><button className={route.page === 'dashboard' ? 'selected' : ''} onClick={() => nav('dashboard')}>▦ Tổng quan</button><button className={route.page === 'cases' || route.page === 'case' ? 'selected' : ''} onClick={() => nav('cases')}>▤ Hồ sơ xử lý</button></>}{can(user, 'admin.users') && <><div className="nav-group">Quản trị</div><button className={route.page === 'admin-users' ? 'selected' : ''} onClick={() => nav('admin-users')}>👤 Người dùng</button><button className={route.page === 'admin-roles' ? 'selected' : ''} onClick={() => nav('admin-roles')}>🔑 Phân quyền</button></>}<div className="permission">Quyền: {user.permissions?.join(', ') || '—'}</div></nav></aside><main className="content"><Notice notice={notice} onClose={() => setNotice(null)} />{route.page === 'citizen' && <CitizenPage api={api} notify={notify} />}{route.page === 'dashboard' && <Dashboard api={api} navigate={nav} notify={notify} />}{route.page === 'cases' && <CaseList api={api} navigate={nav} notify={notify} />}{route.page === 'case' && <CaseDetail id={route.id} api={api} user={user} navigate={nav} notify={notify} />}{route.page === 'admin-users' && <AdminUsersPage api={api} notify={notify} />}{route.page === 'admin-roles' && <AdminRolesPage api={api} notify={notify} />}</main></div></div>;
}
createRoot(document.getElementById('root')).render(<App />);
