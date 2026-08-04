import { useState, useEffect } from 'react';
import { API_BASE, can, errorText, dateText } from '../lib/api.js';
import { STATE_LABELS } from '../lib/constants.js';
import { Loading } from '../components/Loading.jsx';

export function OfficerReportsPage({ api, user, navigate, notify }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const load = () => { setLoading(true); api('/api/v1/bao-cao').then((r) => setReports(r.data || [])).catch((e) => notify(errorText(e), 'error')).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  async function viewDetail(id) {
    try { const r = await api(`/api/v1/bao-cao/${id}`); setSelectedReport(r.data); } catch (e) { notify(errorText(e), 'error'); }
  }
  async function convertToCase(report) {
    if (!window.confirm(`Tạo hồ sơ xử lý từ báo cáo ${report.ma_bao_cao}?`)) return;
    setBusyId(report.id);
    try {
      const r = await api(`/api/v1/bao-cao/${report.id}/to-ho-so`, { method: 'POST' });
      notify(`Đã tạo hồ sơ ${r.data.ma_ho_so} từ báo cáo ${report.ma_bao_cao}.`, 'success');
      setSelectedReport(null); load();
      if (r.data?.id) navigate('case', r.data.id);
    } catch (e) { notify(errorText(e), 'error'); } finally { setBusyId(null); }
  }
  if (loading) return <Loading />;
  return <><div className="page-title"><div><p className="eyebrow">Quản trị nội bộ</p><h2>Danh sách báo cáo</h2><p>Xem báo cáo vi phạm và chuyển thành hồ sơ xử lý.</p></div></div><section className="panel"><div className="table-wrap"><table><thead><tr><th>Mã BC</th><th>Người gửi</th><th>Mô tả</th><th>Địa chỉ</th><th>Ảnh</th><th>Ngày tạo</th><th>Hồ sơ</th><th></th></tr></thead><tbody>{reports.length ? reports.map((r) => <tr key={r.id}><td>{r.ma_bao_cao}</td><td>{r.nguoi_gui_ten || '—'}</td><td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.mo_ta || '—'}</td><td>{r.dia_chi || '—'}</td><td>{r.anh_count ? `${r.anh_count} ảnh` : '—'}</td><td>{dateText(r.created_at)}</td><td>{r.ho_so ? <button className="text-button" onClick={() => navigate('case', r.ho_so.id)}>{r.ho_so.ma_ho_so}</button> : '—'}</td><td><button className="text-button" onClick={() => viewDetail(r.id)}>Chi tiết</button>{can(user, 'case.update') && <button className="text-button" onClick={() => convertToCase(r)} disabled={busyId === r.id}>{busyId === r.id ? 'Đang tạo…' : 'Tạo hồ sơ'}</button>}</td></tr>) : <tr><td colSpan="8" className="empty">Chưa có báo cáo nào.</td></tr>}</tbody></table></div></section>{selectedReport && <div className="modal-overlay" onClick={() => setSelectedReport(null)}><div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600}}><h3>Chi tiết báo cáo {selectedReport.ma_bao_cao}</h3><dl><dt>Người gửi</dt><dd>{selectedReport.nguoi_gui_ten || '—'}</dd>{selectedReport.nguoi_gui_sdt && <><dt>Điện thoại</dt><dd>{selectedReport.nguoi_gui_sdt}</dd></>}{selectedReport.nguoi_gui_email && <><dt>Email</dt><dd>{selectedReport.nguoi_gui_email}</dd></>}<dt>Mô tả</dt><dd>{selectedReport.mo_ta}</dd><dt>Địa chỉ</dt><dd>{selectedReport.dia_chi || '—'}</dd>{selectedReport.quan_huyen_ten && <><dt>Quận/Huyện</dt><dd>{selectedReport.quan_huyen_ten}</dd></>}{selectedReport.phuong_xa_ten && <><dt>Phường/Xã</dt><dd>{selectedReport.phuong_xa_ten}</dd></>}<dt>Tọa độ</dt><dd>{selectedReport.toa_do ? `${Number(selectedReport.toa_do.lat).toFixed(6)}, ${Number(selectedReport.toa_do.lng).toFixed(6)}` : '—'}</dd><dt>Thời gian xảy ra</dt><dd>{dateText(selectedReport.thoi_gian_xay_ra)}</dd><dt>Ngày tạo</dt><dd>{dateText(selectedReport.created_at)}</dd></dl>{selectedReport.anh?.length > 0 && <div style={{marginTop:12}}><h4>Ảnh minh chứng ({selectedReport.anh.length})</h4><div className="evidence-gallery">{selectedReport.anh.map((a) => <img key={a.id} src={`${API_BASE}${a.duong_dan}?token=${localStorage.getItem('qlttxd_token')}`} alt={a.ten_goc} className="evidence-img" loading="lazy" />)}</div></div>}{selectedReport.ho_so && <div className="action-box" style={{marginTop:12}}>Đã chuyển thành hồ sơ: <button className="text-button" onClick={() => { setSelectedReport(null); navigate('case', selectedReport.ho_so.id); }}>{selectedReport.ho_so.ma_ho_so}</button> ({STATE_LABELS[selectedReport.ho_so.trang_thai] || selectedReport.ho_so.trang_thai})</div>}<div className="modal-actions">{can(user, 'case.update') && !selectedReport.ho_so && <button onClick={() => convertToCase(selectedReport)} disabled={busyId === selectedReport.id}>{busyId === selectedReport.id ? 'Đang tạo…' : 'Tạo hồ sơ'}</button>}<button type="button" onClick={() => setSelectedReport(null)}>Đóng</button></div></div></div>}</>;
}
