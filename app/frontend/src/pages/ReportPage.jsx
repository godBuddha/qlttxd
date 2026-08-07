import { useState, useEffect } from 'react';
import { API_BASE, errorText } from '../lib/api.js';
import { FileDown, Download } from 'lucide-react';
import { STATES, STATE_LABELS } from '../lib/constants.js';
import { Loading } from '../components/Loading.jsx';
import { Chart } from '../components/Status.jsx';

export function ReportPage({ api, notify }) {
  const [filters, setFilters] = useState({
    trang_thai: '',
    quan_huyen_id: '',
    tu_ngay: '',
    den_ngay: '',
  });
  const [districts, setDistricts] = useState([]);
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    api('/api/v1/danh-muc/quan-huyen')
      .then((r) => setDistricts(r.data || []))
      .catch(() => {});
    api('/api/v1/thong-ke/tong-quan')
      .then((r) => setData(r.data))
      .catch((e) => notify(errorText(e), 'error'));
  }, []);

  const set = (key, value) => setFilters((old) => ({ ...old, [key]: value }));

  function applyFilters() {
    const params = new URLSearchParams();
    if (filters.trang_thai) params.set('trang_thai', filters.trang_thai);
    if (filters.quan_huyen_id) params.set('quan_huyen_id', filters.quan_huyen_id);
    if (filters.tu_ngay) params.set('tu_ngay', filters.tu_ngay);
    if (filters.den_ngay) params.set('den_ngay', filters.den_ngay);
    return params;
  }

  async function download(loai) {
    setDownloading(loai);
    try {
      const params = applyFilters();
      params.set('loai', loai);
      const token = localStorage.getItem('qlttxd_token');
      const url = `${API_BASE}/api/v1/thong-ke/xuat?${params}`;
      const r = await fetch(url, { headers: { 'X-Auth-Token': token || '' } });
      if (!r.ok) {
        let msg = `Xuất ${loai.toUpperCase()} thất bại (${r.status})`;
        try {
          const j = await r.json();
          msg = j.error || msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bao-cao-${new Date().toISOString().slice(0, 10)}.${loai}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      notify(`Đã tải file ${loai.toUpperCase()}.`, 'success');
    } catch (e) {
      notify(errorText(e), 'error');
    } finally {
      setDownloading('');
    }
  }

  if (!data) return <Loading />;

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Thống kê</p>
          <h2>Báo cáo tổng hợp</h2>
          <p>Xem thống kê hồ sơ và xuất dữ liệu theo bộ lọc.</p>
        </div>
      </div>
      <section className="panel">
        <h3>Bộ lọc</h3>
        <div className="report-filters">
          <label>
            Trạng thái
            <select value={filters.trang_thai} onChange={(e) => set('trang_thai', e.target.value)}>
              <option value="">Tất cả</option>
              {STATES.map((x) => (
                <option key={x} value={x}>
                  {STATE_LABELS[x]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quận/huyện
            <select
              value={filters.quan_huyen_id}
              onChange={(e) => set('quan_huyen_id', e.target.value)}
            >
              <option value="">Tất cả</option>
              {districts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.ten}
                </option>
              ))}
            </select>
          </label>
          <label>
            Từ ngày
            <input
              type="date"
              value={filters.tu_ngay}
              onChange={(e) => set('tu_ngay', e.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={filters.den_ngay}
              onChange={(e) => set('den_ngay', e.target.value)}
            />
          </label>
        </div>
        <div className="report-actions">
          <button onClick={() => download('csv')} disabled={!!downloading}>
            {downloading === 'csv' ? 'Đang tải…' : (
              <>
                <Download size={16} aria-hidden="true"/> Xuất CSV
              </>
            )}
          </button>
          <button onClick={() => download('pdf')} disabled={!!downloading}>
            {downloading === 'pdf' ? 'Đang tải…' : (
              <>
                <FileDown size={16} aria-hidden="true"/> Xuất PDF
              </>
            )}
          </button>
        </div>
      </section>
      <section className="panel">
        <h3>Thống kê theo trạng thái</h3>
        <Chart title="" data={data.theo_trang_thai} label="trang_thai" />
      </section>
      <section className="panel">
        <h3>Thống kê theo quận/huyện</h3>
        <Chart title="" data={data.theo_quan} label="ten" />
      </section>
      <section className="panel">
        <h3>Thống kê theo tháng</h3>
        <Chart title="" data={data.theo_thang} label="thang" />
      </section>
    </>
  );
}
