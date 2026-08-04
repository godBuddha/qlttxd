# SPEC T-11: Frontend Báo cáo/Thống kê + Xuất CSV/PDF

> Task: coder (frontend) | Priority: P1 | Dependency: T-05, T-06

## Mục tiêu
Trang báo cáo thống kê nâng cao với nút xuất CSV/PDF.

## Files thay đổi
1. `app/frontend/src/main.jsx` — thêm `ReportPage`
2. `app/frontend/src/styles.css` — CSS cho report

## Chi tiết

### Component `ReportPage`
```jsx
function ReportPage({ api, user, notify }) {
  const [filters, setFilters] = useState({ trang_thai: '', quan_huyen_id: '', tu_ngay: '', den_ngay: '' });
  const [districts, setDistricts] = useState([]);
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/api/v1/danh-muc/quan-huyen').then(r => setDistricts(r.data));
    api('/api/v1/thong-ke/tong-quan').then(r => setData(r.data));
  }, []);

  function download(loai) {
    const params = new URLSearchParams({ loai, ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) });
    const url = `/api/v1/thong-ke/xuat?${params}`;
    // Fetch with auth header
    fetch(url, { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `bao-cao.${loai}`;
        a.click();
      });
  }

  return (
    <div className="page-title"><div><p className="eyebrow">Thống kê</p><h2>Báo cáo tổng hợp</h2></div></div>
    <section className="panel">
      <h3>Bộ lọc</h3>
      {/* Filter form */}
      <button onClick={() => download('csv')}>📥 Xuất CSV</button>
      <button onClick={() => download('pdf')}>📄 Xuất PDF</button>
    </section>
    <section className="panel">
      <h3>Thống kê theo trạng thái</h3>
      {/* Bar chart từ data.theo_trang_thai */}
    </section>
    <section className="panel">
      <h3>Thống kê theo quận</h3>
      {/* Bar chart từ data.theo_quan */}
    </section>
  );
}
```

### Menu
Thêm vào nav (chỉ khi `can(user, 'report.statistics')`):
```jsx
<button className={route.page === 'report' ? 'selected' : ''} onClick={() => nav('report')}>📊 Báo cáo</button>
```

## Acceptance Criteria
- [ ] Trang hiển thị thống kê theo trạng thái và quận
- [ ] Nút Xuất CSV download file .csv
- [ ] Nút Xuất PDF download file .pdf
- [ ] Filter hoạt động (trạng thái, quận, ngày)
- [ ] Frontend build pass
