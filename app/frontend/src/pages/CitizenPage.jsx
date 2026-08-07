import { useState, useEffect } from 'react';
import { errorText, dateText } from '../lib/api.js';
import { MapView } from '../components/MapView.jsx';

export function ReportTable({ reports }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Danh sách báo cáo của tôi</caption>
        <thead>
          <tr>
            <th scope="col">Mã báo cáo</th>
            <th scope="col">Mô tả</th>
            <th scope="col">Địa chỉ</th>
            <th scope="col">Ảnh</th>
            <th scope="col">Ngày tạo</th>
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
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const latNum = parseFloat(latStr);
  const lngNum = parseFloat(lngStr);
  const point =
    latStr.trim() && lngStr.trim() && Number.isFinite(latNum) && Number.isFinite(lngNum)
      ? { lat: latNum, lng: lngNum }
      : null;
  const setPointCoords = (lat, lng) => {
    setLatStr(String(lat));
    setLngStr(String(lng));
  };
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
  const useCurrentLocation = () => {
    if (!('geolocation' in navigator))
      return notify('Trình duyệt không hỗ trợ lấy vị trí hiện tại.', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => setPointCoords(pos.coords.latitude, pos.coords.longitude),
      () =>
        notify('Không lấy được vị trí hiện tại. Vui lòng nhập tọa độ hoặc chọn trên bản đồ.', 'error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };
  const clearCoords = () => {
    setLatStr('');
    setLngStr('');
  };
  async function submit(e) {
    e.preventDefault();
    if (!point)
      return notify('Vui lòng nhập tọa độ, dùng vị trí hiện tại hoặc chọn vị trí trên bản đồ.', 'error');
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
        <MapView point={point} onPick={setPointCoords} height="520px" />
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
          <fieldset className="full coordinate-entry">
            <legend>Vị trí (tọa độ)</legend>
            <span className="hint full">
              Chọn trên bản đồ, nhập tọa độ hoặc dùng vị trí hiện tại — không bắt buộc dùng chuột.
            </span>
            <label>
              Vĩ độ (Lat)
              <input
                type="number"
                step="any"
                name="lat"
                inputMode="decimal"
                autoComplete="off"
                value={latStr}
                onChange={(e) => setLatStr(e.target.value)}
                placeholder="21.0285"
              />
            </label>
            <label>
              Kinh độ (Lng)
              <input
                type="number"
                step="any"
                name="lng"
                inputMode="decimal"
                autoComplete="off"
                value={lngStr}
                onChange={(e) => setLngStr(e.target.value)}
                placeholder="105.8542"
              />
            </label>
            <div className="coord-actions">
              <button type="button" className="text-button" onClick={useCurrentLocation}>
                Dùng vị trí hiện tại
              </button>
              <button type="button" className="text-button" onClick={clearCoords}>
                Xóa tọa độ
              </button>
            </div>
          </fieldset>
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
