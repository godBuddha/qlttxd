import { useState, useEffect } from 'react';
import { errorText, dateText } from '../lib/api.js';
import { MapView } from '../components/MapView.jsx';

export function ReportTable({ reports }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã báo cáo</th>
            <th>Mô tả</th>
            <th>Địa chỉ</th>
            <th>Ảnh</th>
            <th>Ngày tạo</th>
          </tr>
        </thead>
        <tbody>
          {reports.length ? (
            reports.map((r) => (
              <tr key={r.id || r.ma_bao_cao}>
                <td>{r.ma_bao_cao}</td>
                <td>{r.mo_ta || '—'}</td>
                <td>{r.dia_chi || '—'}</td>
                <td>{r.anh_count ? `${r.anh_count} ảnh` : '—'}</td>
                <td>{dateText(r.created_at)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="empty">
                Chưa có báo cáo nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CitizenPage({ api, notify }) {
  const [point, setPoint] = useState(null);
  const [files, setFiles] = useState([]);
  const [reports, setReports] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    mo_ta: '',
    dia_chi: '',
    thoi_gian_xay_ra: '',
    nguoi_gui_ten: '',
    nguoi_gui_sdt: '',
    nguoi_gui_email: '',
  });
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  useEffect(() => {
    api('/api/v1/bao-cao')
      .then((r) => setReports(r.data || []))
      .catch((e) => notify(errorText(e), 'error'));
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (!point) return notify('Vui lòng chọn vị trí trên bản đồ.', 'error');
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => value && payload.append(key, value));
    payload.append('latitude', point.lat);
    payload.append('longitude', point.lng);
    files.forEach((f) => payload.append('anh', f));
    setBusy(true);
    setResult(null);
    try {
      const r = await api('/api/v1/bao-cao', { method: 'POST', body: payload });
      setResult(r.data);
      setReports((old) => [r.data, ...old]);
      setForm({
        mo_ta: '',
        dia_chi: '',
        thoi_gian_xay_ra: '',
        nguoi_gui_ten: '',
        nguoi_gui_sdt: '',
        nguoi_gui_email: '',
      });
      setFiles([]);
    } catch (err) {
      notify(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Cổng công dân</p>
          <h2>Báo cáo vi phạm xây dựng</h2>
          <p>Chọn chính xác vị trí, cung cấp thông tin và ảnh minh chứng (tối đa 5 ảnh).</p>
        </div>
      </div>
      {result && (
        <section className="success-card">
          <strong>Đã tiếp nhận {result.ma_bao_cao}</strong>
          <span>
            Vị trí: {result.toa_do?.lat?.toFixed(6)}, {result.toa_do?.lng?.toFixed(6)}. Quận/phường
            sẽ được hệ thống tự động xác định.
          </span>
        </section>
      )}
      <div className="two-col">
        <MapView point={point} onPick={setPoint} height="520px" />
        <form className="panel form-grid" onSubmit={submit}>
          <h3>Nội dung báo cáo</h3>
          <label className="full">
            Mô tả vi phạm *
            <textarea
              required
              name="mo_ta"
              value={form.mo_ta}
              onChange={change}
              placeholder="Mô tả công trình, hành vi và dấu hiệu vi phạm"
            />
          </label>
          <label className="full">
            Địa chỉ
            <input name="dia_chi" value={form.dia_chi} onChange={change} />
          </label>
          <label>
            Thời gian xảy ra
            <input
              type="datetime-local"
              name="thoi_gian_xay_ra"
              value={form.thoi_gian_xay_ra}
              onChange={change}
            />
          </label>
          <div className="coordinate">
            Tọa độ: {point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : 'Chưa chọn'}
          </div>
          <fieldset className="full">
            <legend>Người gửi</legend>
            <label>
              Họ tên
              <input name="nguoi_gui_ten" value={form.nguoi_gui_ten} onChange={change} />
            </label>
            <label>
              Số điện thoại
              <input name="nguoi_gui_sdt" value={form.nguoi_gui_sdt} onChange={change} />
            </label>
            <label>
              Email
              <input
                type="email"
                name="nguoi_gui_email"
                value={form.nguoi_gui_email}
                onChange={change}
              />
            </label>
          </fieldset>
          <label className="full">
            Ảnh minh chứng
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 5))}
            />
          </label>
          {files.length > 0 && (
            <div className="file-list full">Đã chọn: {files.map((f) => f.name).join(', ')}</div>
          )}
          <button className="full" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi báo cáo'}
          </button>
        </form>
      </div>
      <section className="panel">
        <h3>Báo cáo của tôi</h3>
        <ReportTable reports={reports} />
      </section>
    </>
  );
}
