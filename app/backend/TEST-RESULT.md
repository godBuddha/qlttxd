# TEST-RESULT.md — WAVE0 (HC-01 + HC-02 + HC-07) Regression Report

**Date:** 2026-08-24
**Task:** t_9d798529 — WAVE0: Fix HC-01 TTL drift + HC-02 Map center + HC-07 port default
**Roadmap:** docs/settings-center/06-roadmap.md — Wave 0 (3 bug cấu hình P0/P2)

---

## Summary

| Hạng mục | Kết quả |
| --- | --- |
| HC-01 TTL drift (P0, Risk 9/10) | ✅ FIXED — 3 INSERT dùng `make_interval(secs => $3)` parameterized, đọc `cfg('auth','jwt_refresh_ttl','7d')` |
| HC-02 Map center hardcode (P0, Risk 7/10) | ✅ FIXED — `homeCenter()` selector + consumer MapView/BanDoPage; provider nạp thêm category `ui` |
| HC-07 Default port lệch (P2) | ✅ FIXED — `PORT || 3001` khớp docker-compose/Caddy |
| Backend suite (`node --test --test-concurrency=1`) | ✅ **254/254 PASS** (0 fail, gồm 8 test mới) |
| Frontend vitest (`npx vitest run`) | ✅ **73/73 PASS** (13 files, gồm 3 test homeCenter mới) |
| Frontend build (`npm run build`) | ✅ SUCCESS (built in 2.77s) |

Không có fail mới so với baseline. 3 known-flaky đã ghi nhận trước đó
(2 forgot-password isolation + 1 input-validation duplicate TEST-KP) không xuất hiện trong run này.

---

## Files changed

### Mới tạo
- `app/backend/utils/ttl.js` — helper `ttlToSeconds(ttl)`: parse `'45s'|'30m'|'12h'|'7d'` → số giây integer; regex `/^([0-9]+)([smhd])$/`, s=1/m=60/h=3600/d=86400; sai format → throw Error rõ ràng.
- `app/backend/test/ttl.test.js` — 5 unit test: từng đơn vị, biên giới (0s/1d/365d), số nguyên, 15 case sai định dạng throw, message lỗi.
- `app/backend/test/ttl-drift.test.js` — 3 regression test (chi tiết bên dưới).
- `app/frontend/src/lib/homeCenter.test.jsx` — 3 unit test cho `homeCenter()`.

### Sửa đổi
- `app/backend/routes/auth.js` — import `ttlToSeconds`; thay 3 câu SQL (setup-admin ~L175, login ~L260, refresh ~L354):
  - TRƯỚC: `INSERT INTO refresh_tokens (user_id, jti, expires_at) VALUES ($1, $2, now() + interval '7 days')`
  - SAU: `INSERT INTO refresh_tokens (user_id, jti, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))`
  - Tham số `$3 = ttlToSeconds(cfg.getSync('auth', 'jwt_refresh_ttl', '7d'))` — **parameterized**, không string interpolation. `cfg` đã có sẵn scope trong `authRoutes`.
- `app/backend/server.js` — `const port = Number(process.env.PORT || 3001);` + comment `// Default must match docker-compose/Caddy upstream (3001)` (khớp `app/docker-compose.yml:28 PORT: 3001`, `app/Caddyfile reverse_proxy backend:3001`).
- `app/frontend/src/lib/ConfigContext.jsx`:
  - Thêm selector `homeCenter()`: đọc `getConfig('ui','home_lat')` / `getConfig('ui','home_lng')`; chưa load (`loading=true`) hoặc null/undefined hoặc NaN → fallback `[...HOME]`; trả `[lat, lng]`. Kiểm tra `== null` **trước** `Number()` vì `Number(null) === 0` (bug thật bị test bắt được ở lần chạy đầu).
  - Nạp thêm category `'ui'` vào danh sách categories của cả mount-load và `reload()` (trước đây chỉ có system/workflow/appearance/notification/security → DB seed `ui.*` không bao giờ được đọc).
  - Export `homeCenter` qua context value.
- `app/frontend/src/components/MapView.jsx` — thay `HOME` bằng `useConfig().homeCenter()` khi setView mặc định (dùng chung bởi CitizenPage, CaseList, AdminLocationsPage).
- `app/frontend/src/pages/BanDoPage.jsx` — thay `L.map(...).setView(HOME, 12)` bằng `setView(homeCenter(), 12)`.
- `app/frontend/src/lib/constants.js` — **KHÔNG đổi**: giữ export `HOME` làm fallback (backward compatible với tests cũ).
- `app/backend/routes/thong-bao.js` — fix phụ phát hiện khi verify: SQL SSE poll có `LIMIT cfg.getSync(...)` nhúng trực tiếp JS vào query → Postgres lỗi `schema "cfg" does not exist` mỗi 5s, làm SSE stream không bao giờ push được notification (chính là known-fail #97 cũ). Đổi sang parameterized `LIMIT $3`.

---

## Acceptance criteria (từ task)

```
1. grep -n "interval '7 days'" app/backend/routes/auth.js   → 0 kết quả ✅
2. grep HOME app/frontend/src/{pages,components}/           → chỉ còn comment HC-02 +
                                                              fallback trong constants.js/ConfigContext;
                                                              BanDoPage + MapView dùng useConfig().homeCenter() ✅
3. grep -n "PORT || 3000" app/backend/server.js             → 0 kết quả ✅
4. Unit test TTL helper (5/5) + homeCenter (3/3)            → PASS ✅
5. Full backend 254/254 + frontend 73/73 + build OK         → PASS ✅
```

---

## Backend Tests

### Unit — ttlToSeconds (test/ttl.test.js): 5/5 PASS

```
node --test test/ttl.test.js
# pass 5 / fail 0
```

### Regression — TTL drift (test/ttl-drift.test.js): 3/3 PASS

```
node --test --test-concurrency=1 test/ttl-drift.test.js
# pass 3 / fail 0
```

1. **Login → expires_at ≈ now + TTL mặc định:** sau POST /api/v1/auth/login,
   `EXTRACT(EPOCH FROM (expires_at - now()))` của row refresh_tokens mới nhất nằm trong
   604800 ± 5s; cookie Max-Age cũng = 604800.
2. **TTL mock khác (1h):** set `CONFIG_GLOBAL_AUTH_JWT_REFRESH_TTL='"1h"'` (đường dẫn env
   sync-fallback của ConfigService.getSync — cùng cơ chế khi admin đổi giá trị qua Settings),
   khởi động app mới → expires_at ≈ 3600 ± 5s. **Đây là case chứng minh hết drift:**
   trước fix row vẫn là 604800s trong khi JWT chỉ sống 3600s.
3. **Refresh flow (rotate):** login → dùng cookie refresh gọi /api/v1/auth/refresh →
   row mới cũng bám TTL cấu hình (±5s).

### Full suite: 254/254 PASS

```
cd app/backend && node --test --test-concurrency=1 test/*.test.js
# tests 254
# pass  254
# fail  0
```

Ghi chú môi trường: PostgreSQL test chạy user-space qua `/workspace/ssd/toolchain/scripts/pg-start.sh`;
DB test thiếu seed `03-config-tables.sql` nên đã apply lại file init đó (idempotent, ON CONFLICT DO NOTHING)
để có đủ 53+ rows system_config gồm `ui.home_lat/home_lng` và `auth.jwt_refresh_ttl` — KHÔNG đổi nội dung seed.

### Fix phụ trong quá trình verify (routes/thong-bao.js)

Suite đầy đủ ban đầu dính fail #97 `GET /api/v1/thong-bao/stream — SSE pushes new notification`
(known-fail từ CONFIG-T7). Root cause thật: câu poll SQL viết
`LIMIT cfg.getSync('sse', 'poll_limit', 50)` — một biểu thức JS bị nhúng thẳng vào SQL string,
Postgres parse thành `schema "cfg"` → poll lỗi mỗi tick (`schema "cfg" does not exist`),
notification không bao giờ được push. Đã sửa thành `LIMIT $3` parameterized với clamp
`[1, 1000]`. Sau fix: email-notification.test.js 9/9 PASS, full suite 254/254.
Đây là sửa lỗi an toàn (parameterization + validation theo đúng chuẩn skill), không đổi API contract.

---

## Frontend Tests

### Vitest: 73/73 PASS (13 files)

```
cd app/frontend && npx vitest run
Test Files  13 passed (13)
Tests       73 passed (73)
```

Mới — src/lib/homeCenter.test.jsx (3/3):
1. config `ui.home_lat=10.5, ui.home_lng=106.7` → `[10.5, 106.7]`
2. config chưa load / rỗng → fallback `[21.0285, 105.8542]` (= HOME)
3. giá trị không hợp lệ (`'abc'` / null) → fallback HOME

### Build: SUCCESS

```
npm run build
✓ built in 2.77s
```

---

## Security & contract review

- `$3` là số nguyên từ helper (throw sớm nếu TTL config sai format) → không có đường SQL injection.
- Không đổi API contract, không đổi schema/seed, không đổi format response.
- Backward compatible: `HOME` vẫn export; `getSync` fallback `'7d'` giữ nguyên hành vi mặc định.
- Không log secret/JWT/token; test không in token ra output.

## Known risks / ghi nhận

1. `getSync` chỉ đọc cache/env — nếu admin đổi TTL khi server đang chạy mà instance không nhận
   NOTIFY reload thì request kế tiếp vẫn dùng giá trị cache cũ cho tới khi reload (hành vi hiện có
   của kiến trúc config, không phải drift giữa JWT và DB nữa vì cả hai đều đọc cùng một nguồn tại
   cùng thời điểm ký/insert).
2. Cookie `max_age_ms` (cookie.max_age_ms = 604800000) là config riêng; nếu admin đổi
   jwt_refresh_ttl xuống thấp hơn cookie max-age thì cookie còn tồn nhưng refresh sẽ bị từ chối
   do expires_at ngắn hơn — đề xuất Wave sau đồng bộ cookie max-age từ TTL (ngoài phạm vi task này).
3. Test TTL-drift #2 mô phỏng thay đổi config qua env sync-fallback của ConfigService (cùng code path
   getSync như khi Settings Center cập nhật giá trị); không test đường LISTEN/NOTIFY runtime.
