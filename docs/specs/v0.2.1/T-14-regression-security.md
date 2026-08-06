# SPEC T-14: Hồi quy toàn bộ + Security Review

> Task: security + qa | Priority: P1 | Dependency: T-01..T-13

## Mục tiêu

Hồi quy toàn bộ test + security review.

## Chi tiết

### QA — Hồi quy

```bash
cd /workspace/ssd/qlttxd/app/backend
npm test  # Tất cả test phải pass

cd /workspace/ssd/qlttxd/app/frontend
npm run build  # Build phải pass

# verify-db.sql
PGPASSWORD=postgres psql -h /tmp -U postgres -d qlttxd -f /workspace/ssd/qlttxd/sql/verify-db.sql
```

### Security — Review

Kiểm tra:

1. Rate limit không chặn nhầm user thật
2. Helmet headers đầy đủ (CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy)
3. PII masking đúng quyền
4. Password change yêu cầu old_password đúng
5. Audit log ghi đầy đủ
6. Không lộ secret/stack trace trong error

## Acceptance Criteria

- [ ] Tất cả test pass (cũ + mới)
- [ ] Frontend build pass
- [ ] verify-db.sql pass
- [ ] Security review: không finding HIGH
- [ ] Báo cáo review ghi rõ findings (nếu có)
