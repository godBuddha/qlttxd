GET /api/docs                     -> 200 text/html; charset=utf-8  (chứa id="swagger-ui")
GET /api/v1/docs                  -> 200 application/json; openapi=3.0.3, info.version=0.3.2, paths=58
GET /api/docs/assets/swagger-ui.css  -> 200 text/css
GET /api/docs/swagger-init.js     -> 200 application/javascript
Coverage: /health/live=true /health/ready=true /thong-bao/stream=true /attachments/{filename}/view=true
No secret: json spec không chứa chuỗi "test-secret" / JWT_SECRET value
```

### Chú thích
- Không đổi API contract endpoint có real client (chỉ THÊM schema mô tả, không sửa handler, không đổi response).
- Swagger UI policy: mount công khai tại `/api/docs` (spec mô tả endpoint nhưng file thật vẫn cần JWT — `/attachments/{filename}/view` yêu cầu Bearer; `/thong-bao/stream` yêu cầu `?token=`). Không lộ secret/credential trong spec.
- Không thêm dependency nặng (tái dùng `swagger-ui-dist` / `swagger-ui-express` có sẵn, chỉ thêm 2 import builtin/package.json).
- Backend test suite PASS 173 (không giảm), `/api/docs` cũ giữ nguyên.


# EVIDENCE: BE-E6-03 - Input validation consistency (M-01)
Ngày kiểm thử: 2026-08-07

## Phạm vi
Audit và bổ sung validation cho các endpoint POST/PATCH chính: auth (setup-admin, login, forgot-password, reset-password, password change), ho-so (create, khac-phuc), bao-cao (create), admin-users (create, update).

## Thay đổi code

### app/backend/routes/auth.js
- Thêm import `sanitizeString` từ utils/sanitize
- POST /api/v1/auth/setup-admin: thêm max-length full_name (>200 reject), sanitize username/full_name/email/phone trước khi INSERT vào DB
- POST /api/v1/auth/login: thêm độ dài username max 200, sanitize username trước khi query DB
- POST /api/v1/auth/forgot-password: thêm max-length identifier (>200 reject), sanitize identifier
- Đã có sẵn: password length >=8 + alphanumeric pattern check, setup admin idempotency (409)

### app/backend/routes/ho-so.js
- Hàm `validateNguoiViPham`: thêm ten max 200 chars, dia_chi max 1000 chars, nguoi_dai_dien max 200 chars
- POST /api/v1/ho-so/:id/khac-phuc: thêm bien_phap required + max 1000 chars, mo_ta max 5000 chars

### app/backend/routes/bao-cao.js
- POST /api/v1/bao-cao: thêm nguoi_gui_ten max 200 chars, dia_chi max 1000 chars (optional field DoS guard)

### app/backend/routes/admin-users.js
- POST /api/v1/admin/users: thêm email format check, phone format check (đã có existing logic)
- PATCH /api/v1/admin/users/:id: thêm email format check khi email present, phone format check khi phone present

## Test mới
Tạo `app/backend/test/input-validation.test.js` với 34 test cases:
- Auth setup-admin: long username (>50), short password (<8), weak pattern, oversized full_name (>200), valid payload (409 duplicate)
- Auth login: valid credentials, username >200 rejected
- Forgot-password: empty identifier, oversized identifier (>200)
- Ho-so create: missing auth (401), NVP name required, NVP ten >200, NVP dia_chi >1000, NVP nguoi_dai_dien >200, NVP cmnd invalid format, NVP phone invalid format, NVP email invalid format, UUID check for loai_vi_pham_id
- Ho-so khac-phuc: missing bien_phap (>1000), bien_phap >1000 chars, mo_ta >5000 chars
- Bao-cao: nguoi_gui_ten >200, dia_chi >1000, coordinate required, reporter phone invalid, reporter email invalid
- Admin-users create: invalid email, invalid phone
- Admin-users PATCH: invalid email when email present, invalid phone when phone present, partial update without email/phone OK
- Auth reset-password: missing token, weak password
- Ho-so status: invalid state value

## Kết quả test

```sh
cd /workspace/ssd/qlttxd/app/backend
npm test
```

Kết quả runner: **207 passed, 0 failed** (173 original + 34 new input validation tests).

## Evidence chi tiết từng endpoint

| Endpoint | Validation đã thêm/bổ sung | Status test |
| -------- | ------------------------- | ----------- |
| POST /auth/setup-admin | username length [3-50], password >=8 + alpha+digit, full_name <=200, sanitize all string fields | PASS |
| POST /auth/login | username <=200, sanitize before query | PASS |
| POST /auth/forgot-password | identifier trimmed + <=200, sanitized | PASS |
| POST /auth/reset-password | token required, password >=8 + alpha+digit (đã có) | PASS |
| PATCH /auth/password | old+new required, new >=8 + alpha+digit (đã có) | PASS |
| POST /ho-so | validateHoSo (UUID, mo_ta/bao_cao_id), validateNguoiViPham (ten/loai_chu_the/cmnd/sdt/email/dia_chi/nguoi_dai_dien lengths) | PASS |
| PATCH /ho-so/:id/trang-thai | STATES set check (đã có) | PASS |
| PUT /ho-so/:id/phan-cong | UUID can_bo_id check (đã có) | PASS |
| POST /ho-so/:id/khac-phuc | bien_phap required + <=1000, mo_ta <=5000 | PASS |
| PATCH /khac-phuc/:id | trang_thai enum whitelist (đã có) | PASS |
| POST /bao-cao | mo_ta <=10000, coordinate required, phone/email format, nguoi_gui_ten <=200, dia_chi <=1000 | PASS |
| POST /admin/users | username [3-50], password >=8 + alpha+digit, full_name <=200, email format, phone format, roles array | PASS |
| PATCH /admin/users/:id | UUID user_id, password rules if present, full_name <=200, email format if present, phone format if present | PASS |
| GET /ho-so | limit/page bounded (đã có) | PASS |
| GET /bao-cao | permission scope (đã có) | PASS |

## Không thay đổi
- Không đổi status code/signature cho client hợp lệ hiện tại
- Không thêm dependency nặng (dùng sanitize có sẵn)
- Không đổi API contract public-facing
- Message lỗi tiếng Việt, trả về 400
