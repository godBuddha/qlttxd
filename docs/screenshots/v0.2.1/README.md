# Screenshots v0.2.1 — QLTTXD

Ảnh chụp giao diện hệ thống v0.2.1.

## 📸 Gallery

### Đăng nhập

| Ảnh                      | Mô tả                   |
| ------------------------ | ----------------------- |
| `01-login-page.png`      | Trang đăng nhập         |
| `02-login-filled.png`    | Form đã điền            |
| `02-dashboard-admin.png` | Dashboard sau đăng nhập |

### Admin

| Ảnh                         | Mô tả                 |
| --------------------------- | --------------------- |
| `admin-dashboard.png`       | Bảng điều khiển admin |
| `admin-Tổng-quan.png`       | Tổng quan thống kê    |
| `admin-case-detail.png`     | Chi tiết hồ sơ        |
| `admin-case-Timeline.png`   | Timeline xử lý        |
| `admin-case-Biên-bản.png`   | Tab Biên bản          |
| `admin-case-Quyết-định.png` | Tab Quyết định        |
| `admin-case-Khắc-phục.png`  | Tab Khắc phục         |
| `admin-Hồ-sơ.png`           | Hồ sơ cá nhân         |

### 🆕 Tính năng mới v0.2.1

| Ảnh             | Mô tả                                              |
| --------------- | -------------------------------------------------- |
| `audit-log.png` | Nhật ký hệ thống (Audit Log)                       |
| `catalog.png`   | Danh mục quản lý (loại vi phạm, hành vi, mức phạt) |
| `profile.png`   | Hồ sơ cá nhân + đổi mật khẩu                       |
| `report.png`    | Báo cáo/Thống kê + nút xuất CSV/PDF                |
| `images.png`    | Ảnh minh chứng trong chi tiết hồ sơ                |
| `security.png`  | Security headers (Helmet)                          |

### Vai trò khác

| Ảnh                      | Mô tả                   |
| ------------------------ | ----------------------- |
| `handler-dashboard.png`  | Dashboard cán bộ thụ lý |
| `handler-Tổng-quan.png`  | Tổng quan handler       |
| `handler-Hồ-sơ.png`      | Hồ sơ handler           |
| `verifier-dashboard.png` | Dashboard xác minh viên |
| `verifier-Tổng-quan.png` | Tổng quan verifier      |
| `verifier-Hồ-sơ.png`     | Hồ sơ verifier          |
| `leader-dashboard.png`   | Dashboard lãnh đạo      |
| `leader-Tổng-quan.png`   | Tổng quan leader        |
| `leader-Hồ-sơ.png`       | Hồ sơ leader            |
| `citizen-dashboard.png`  | Dashboard công dân      |
| `citizen-Báo-cáo.png`    | Báo cáo vi phạm         |

## 🔄 Cập nhật ảnh

Chạy script chụp ảnh tự động:

```bash
# Đảm bảo backend + frontend đang chạy
cd qlttxd
node scripts/take-screenshots-v0.2.1.mjs
```

Script sử dụng Playwright Chromium, cần cài system deps:

```bash
npx playwright install chromium
npx playwright install-deps chromium
```
