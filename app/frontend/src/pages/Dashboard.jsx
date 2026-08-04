import { useState, useEffect } from 'react';
import { errorText } from '../lib/api.js';
import { STATE_LABELS } from '../lib/constants.js';
import { Loading } from '../components/Loading.jsx';
import { Stat, Chart } from '../components/Status.jsx';

export function Dashboard({ api, navigate, notify }) {
  const [data, setData] = useState(null); useEffect(() => { api('/api/v1/thong-ke/tong-quan').then((r) => setData(r.data)).catch((e) => notify(errorText(e), 'error')); }, []);
  if (!data) return <Loading />;
  const total = data.theo_trang_thai.reduce((sum, x) => sum + Number(x.so_luong), 0);
  return <><div className="page-title"><div><p className="eyebrow">Quản trị nội bộ</p><h2>Bảng điều khiển</h2><p>Tổng quan hồ sơ vi phạm đang được xử lý.</p></div><button onClick={() => navigate('cases')}>Xem hồ sơ</button></div><div className="stat-grid"><Stat label="Tổng hồ sơ" value={total} /><Stat label="Đang xử lý" value={data.theo_trang_thai.filter((x) => !['da_dong', 'da_huy'].includes(x.trang_thai)).reduce((s, x) => s + Number(x.so_luong), 0)} /><Stat label="Đã đóng" value={data.theo_trang_thai.find((x) => x.trang_thai === 'da_dong')?.so_luong || 0} /></div><div className="chart-grid"><Chart title="Hồ sơ theo trạng thái" data={data.theo_trang_thai} label="trang_thai" /><Chart title="Hồ sơ theo quận/huyện" data={data.theo_quan} label="ten" /><Chart title="Hồ sơ theo tháng" data={data.theo_thang} label="thang" /></div></>;
}
