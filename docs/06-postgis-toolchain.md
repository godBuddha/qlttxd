# Cài PostGIS 3.6.3 vào PostgreSQL toolchain (không cần root)

> **Mục đích:** QLTTXD cần PostGIS (cột `GEOMETRY`, chỉ mục GIST, hàm `ST_*`).
> Toolchain PostgreSQL 16.14 chạy user-space (không root), nên không dùng
> `apt-get install postgresql-16-postgis-3` được → cài thủ công từ file `.deb`.

## Tóm tắt giải pháp

Copy 3 nhóm file từ package Debian `.deb` (postgresql-16-postgis-3 +
libgeos + libproj) vào thư mục toolchain của Postgres:

| Nhóm | Nguồn (trong .deb) | Đích (toolchain) |
|---|---|---|
| Extension SQL | `usr/share/postgresql/16/extension/` | `toolchain/postgres/usr/share/postgresql/16/extension/` |
| Thư viện `.so` | `usr/lib/postgresql/16/lib/` | `toolchain/postgres/usr/lib/postgresql/16/lib/` |
| Thư viện phụ thuộc | `usr/lib/x86_64-linux-gnu/` | `toolchain/postgres/lib/` (LD_LIBRARY_PATH) |

## Các bước chi tiết

### 1. Tải package `.deb` (đã cache trong `toolchain/downloads/`)
- `postgresql-16-postgis-3_3.6.3+dfsg-1~pgdg24.04+1_amd64.deb`
- `postgresql-16-postgis-3-scripts_3.6.3+dfsg-1~pgdg24.04+1_all.deb`
- `libgeos3.11.1_3.11.1-1_amd64.deb` (GEOS)
- `libproj25_9.1.1-1_amd64.deb` (PROJ) + `libproj-dev` (header, không bắt buộc)

### 2. Giải nén (dpkg-deb -x, không cần root)
```bash
cd /tmp
dpkg-deb -x postgresql-16-postgis-3_*.deb pgxs
dpkg-deb -x postgresql-16-postgis-3-scripts_*.deb pgxs  # gộp chung
dpkg-deb -x libgeos*.deb libg
dpkg-deb -x libproj*.deb libp
```

### 3. Copy vào toolchain
```bash
TC=/workspace/ssd/toolchain/postgres

# (a) Extension scripts — CHÚ Ý: toolchain/postgres/share là SYMLINK
#     tới usr/share/postgresql/16, nên copy thẳng vào đường dẫn thật:
EXT="$TC/usr/share/postgresql/16/extension"
cp -a /tmp/pgxs/usr/share/postgresql/16/extension/* "$EXT/"

# (b) Thư viện postgis cho PostgreSQL
cp -a /tmp/pgxs/usr/lib/postgresql/16/lib/*.so "$TC/usr/lib/postgresql/16/lib/"

# (c) Thư viện phụ thuộc (GEOS, PROJ...) vào lib/ (đã có trong LD_LIBRARY_PATH)
cp -a /tmp/libg/usr/lib/x86_64-linux-gnu/*.so* "$TC/lib/"
cp -a /tmp/libp/usr/lib/x86_64-linux-gnu/*.so* "$TC/lib/"
```

### 4. Tạo control file chuẩn (quan trọng!)
Debian PostGIS 3.6 đặt control là `postgis-3.control` nhưng PostgreSQL
tìm `postgis.control` khi chạy `CREATE EXTENSION postgis`. Tạo symlink:
```bash
cd "$EXT"
for ext in postgis postgis_raster postgis_topology postgis_sfcgal \
           address_standardizer address_standardizer_data_us postgis_tiger_geocoder; do
  [ -f "$ext-3.control" ] && ln -sf "$ext-3.control" "$ext.control"
done
```

### 5. Kiểm tra
```bash
. toolchain/scripts/env.sh && pg-start
psql -h /tmp -p 5432 -U postgres -d qlttxd -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -h /tmp -p 5432 -U postgres -d qlttxd -tAc "SELECT PostGIS_Full_Version();"
# POSTGIS="3.6.3 3d12666" PGSQL="160" GEOS="3.11.1-CAPI-1.17.1" PROJ="9.1.1" LIBXML="2.9.14" ...
```

## Kết quả kiểm chứng (2026-08-02)
- `CREATE EXTENSION postgis` ✅
- `schema.sql` 19 bảng chạy sạch (đã sửa lỗi thứ tự: `nguoi_vi_pham` tạo trước `ho_so`)
- Seed Điều 16 NĐ16: 4 nhóm / 12 hành vi / 36 mức phạt ✅
- Đơn vị hành chính + users demo + RBAC: `sql/seed.sql` ✅
- Truy vấn GIS: `ST_Contains` tìm phường của một điểm toạ độ ✅
  (Hồ Hoàn Kiếm → Phường Hàng Trống, Quận Hoàn Kiếm)
- Tái lập DB từ đầu chỉ bằng 1 lệnh: `bash qlttxd/sql/setup-db.sh`

## Lưu ý
- Nếu copy nhầm vào `share/...` (symlink), file sẽ rơi vào
  `usr/share/postgresql/16/postgresql/16/extension` — dọn bằng
  `rm -rf "$TC/usr/share/postgresql/16/postgresql"`.
- Mật khẩu demo của mọi tài khoản seed: xem comment trong `sql/seed.sql` (đổi khi triển khai).
