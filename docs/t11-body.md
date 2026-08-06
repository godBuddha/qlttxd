BỐI CẢNH:
User truy cập http://localhost:5173 bấm Đăng nhập → lỗi "Thiếu mã xác thực" (401).

NGUYÊN NHÂN ĐÃ XÁC MINH:

1. Task T10 (t_de85e61c) đã implement Vite proxy trong vite.config.js + đổi API_BASE thành rỗng trong main.jsx — CODE ĐÃ ĐÚNG.
2. NHƯNG Vite instance chính trên port 5173 CHƯA BAO GIỜ ĐƯỢC RESTART với config mới. Process cũ từ trước T10 vẫn chạy.
3. Có NHIỀU stale processes: nhiều Vite instances (5173, 5174, 5175, 5176, 5199, 5299), nhiều backend instances, static server trên 4173.
4. Backend đang chạy với CORS_ORIGIN=http://localhost:5173 (đúng), nhưng frontend user đang truy cập có thể không phải 5173 (bị chiếm bởi process cũ).
5. Kết quả: request login không đi qua Vite proxy → đến thẳng backend khác hoặc CORS chặn → 401 "Thiếu mã xác thực".

YÊU CẦU (thực hiện tuần tự, MỖI bước verify trước khi qua bước tiếp):

BƯỚC 1 — CLEANUP STALE PROCESSES (coder):

- Kill TẤT CẢ node/vite processes đang chạy NGOẠI TRỪ postgres (process có "postgres" trong cmdline).
- Kill cả static-server.cjs, python http.server.
- Verify: cat /proc/*/cmdline kiểm tra không còn node/vite nào.
- KHÔNG kill postgres. KHÔNG xóa pgdata.

BƯỚC 2 — VERIFY CODE T10 CÒN NGUYÊN VẸN (coder):

- Đọc vite.config.js: xác nhận có proxy /api và /uploads tới http://127.0.0.1:3001.
- Đọc src/main.jsx dòng 7: xác nhận API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/$/, "").
- Nếu thiếu → khôi phục từ code đã merge (T10 done).

BƯỚC 3 — START BACKEND SẠCH (coder):

- source toolchain/scripts/env.sh
- Start postgres nếu chưa chạy: pg-start
- Start backend: cd qlttxd/app/backend && PGHOST=/tmp PGPORT=5432 PGDATABASE=qlttxd PGUSER=postgres JWT_SECRET="staging-qlttxd-jwt-secret-2026-08-03-secure" CORS_ORIGIN="http://localhost:5173" UPLOAD_DIR=/tmp/qlttxd-uploads PORT=3001 node server.js
- Verify: curl http://localhost:3001/health → {"status":"ok"}

BƯỚC 4 — START FRONTEND SẠCH trên port 5173 (coder):

- cd qlttxd/app/frontend
- VITE_API_BASE_URL="" npm run dev -- --port 5173 --strictPort
- Verify: curl http://localhost:5173 → 200 HTML
- Verify proxy: curl -X POST http://localhost:5173/api/v1/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"Qlttxd@2026\"}" → 200 + token

BƯỚC 5 — E2E SMOKE TEST (coder):

- Dùng Playwright hoặc curl test flow:
  a. POST /api/v1/auth/login → 200, có token
  b. GET /api/v1/thong-ke/tong-quan (với Bearer token) → 200
  c. GET /api/v1/thong-ke/tong-quan (không token) → 401 "Thiếu mã xác thực"
  d. GET /api/v1/ho-so (với Bearer token admin) → 200
- Ghi kết quả vào TEST-RESULT.md mục T11.

BƯỚC 6 — BROWSER TEST (nếu Playwright chromium hoạt động):

- Mở http://localhost:5173
- Điền admin / Qlttxd@2026
- Bấm Đăng nhập
- Verify: vào dashboard, không lỗi 401
- Screenshot lưu /workspace/ssd/screenshots/t11-login-success.png

KHÔNG LÀM:

- Không sửa code backend (server.js, token-blocklist.js).
- Không sửa schema.sql, seed.sql.
- Không reset database.
- Không đổi JWT_SECRET hoặc CORS_ORIGIN khác giá trị đã cho.
- Không tạo file .env mới.

ACCEPTANCE CRITERIA:
□ Không còn stale node/vite processes (ngoại trừ postgres)
□ Backend :3001 /health → 200
□ Frontend :5173 proxy login → 200 + token (không 401)
□ Protected endpoint không token → 401 "Thiếu mã xác thực"
□ Protected endpoint có token → 200
□ Browser login admin → dashboard thành công (không lỗi 401)
□ Evidence trong TEST-RESULT.md
