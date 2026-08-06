import { useState, useEffect } from 'react';
import { errorText, dateText } from '../lib/api.js';
import { STATES, STATE_LABELS } from '../lib/constants.js';
import { Loading } from '../components/Loading.jsx';
import { Status } from '../components/Status.jsx';
import { MapView } from '../components/MapView.jsx';

export function CaseList({ api, navigate, notify }) {
  const [cases, setCases] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [filters, setFilters] = useState({ q: '', trang_thai: '', quan_huyen_id: '', page: 1 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/api/v1/danh-muc/quan-huyen')
      .then((r) => setDistricts(r.data || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: filters.page, limit: 20 });
    if (filters.q) q.set('q', filters.q);
    if (filters.trang_thai) q.set('trang_thai', filters.trang_thai);
    if (filters.quan_huyen_id) q.set('quan_huyen_id', filters.quan_huyen_id);
    api(`/api/v1/ho-so?${q}`)
      .then((r) => setCases(r.data || []))
      .catch((e) => notify(errorText(e), 'error'))
      .finally(() => setLoading(false));
  }, [filters]);
  const set = (key, value) =>
    setFilters((old) => ({ ...old, [key]: value, page: key === 'page' ? value : 1 }));
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Quản trị nội bộ</p>
          <h2>Danh sách hồ sơ</h2>
          <p>Lọc, tra cứu và chọn hồ sơ để xử lý.</p>
        </div>
      </div>
      <section className="panel filters">
        <label>
          Tìm kiếm
          <input
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Mã hồ sơ, mô tả, địa chỉ, loại vi phạm"
          />
        </label>
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
      </section>
      {loading ? (
        <Loading />
      ) : (
        <>
          <section className="panel">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mã HS</th>
                    <th>Trạng thái</th>
                    <th>Địa chỉ</th>
                    <th>Ngày tạo</th>
                    <th>Tọa độ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cases.length ? (
                    cases.map((item) => (
                      <tr key={item.id}>
                        <td>{item.ma_ho_so}</td>
                        <td>
                          <Status value={item.trang_thai} />
                        </td>
                        <td>{item.dia_chi || '—'}</td>
                        <td>{dateText(item.created_at)}</td>
                        <td>
                          {item.toa_do
                            ? `${Number(item.toa_do.lat).toFixed(4)}, ${Number(item.toa_do.lng).toFixed(4)}`
                            : '—'}
                        </td>
                        <td>
                          <button className="text-button" onClick={() => navigate('case', item.id)}>
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="empty">
                        Không có hồ sơ phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button disabled={filters.page === 1} onClick={() => set('page', filters.page - 1)}>
                ← Trang trước
              </button>
              <span>Trang {filters.page}</span>
              <button disabled={cases.length < 20} onClick={() => set('page', filters.page + 1)}>
                Trang sau →
              </button>
            </div>
          </section>
          <section className="panel">
            <h3>Bản đồ hồ sơ trong trang</h3>
            <MapView
              points={cases
                .filter((x) => x.toa_do)
                .map((x) => ({ ...x.toa_do, label: x.ma_ho_so }))}
              height="300px"
            />
          </section>
        </>
      )}
    </>
  );
}
