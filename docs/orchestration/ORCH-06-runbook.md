# ORCH-06 — Sổ tay Vận hành Điều phối (Runbook)

Tra cứu nhanh khi vận hành. Mọi lệnh đã kiểm chứng trên môi trường này.

## 1. Khởi động môi trường mỗi phiên

```bash
# PostgreSQL (socket /tmp)
bash -c 'source /workspace/ssd/toolchain/scripts/env.sh && pg_ctl -D /workspace/ssd/toolchain/pgdata -o "-k /tmp" -l /workspace/ssd/toolchain/pgdata/logfile start'
# nếu lỗi "lock file /var/run/postgresql": thêm -o "-k /tmp"

# Hermes (điều phối)
export PATH="/workspace/ssd/toolchain/node/bin:$PATH"
hermes kanban list   # kiểm tra bảng việc
nohup hermes gateway run > /workspace/ssd/.hermes-gateway.log 2>&1 &   # dispatcher
```

## 2. Kiểm chứng code (orchestrator tự chạy)

```bash
# Backend full suite (290 expected)
cd /workspace/ssd/qlttxd/app/backend && bash -c 'source /workspace/ssd/toolchain/scripts/env.sh && PGHOST=/tmp PGPORT=5432 PGDATABASE=qlttxd PGUSER=postgres JWT_SECRET=test-secret-that-is-long-enough-for-jwt-smoke-32chars RATE_LIMIT_DISABLED=true timeout 300 node --test --test-concurrency=1'

# Frontend vitest (107 expected) + build
cd /workspace/ssd/qlttxd/app/frontend && bash -c 'source /workspace/ssd/toolchain/scripts/env.sh && npx vitest run && npm run build'
```

## 3. Vận hành Kanban

```bash
export PATH="/workspace/ssd/toolchain/node/bin:$PATH"
hermes kanban create "<tiêu đề>" --assignee coder --priority 1 \
  --workspace "dir:/workspace/ssd/qlttxd" --body "$(cat spec-file.txt)"
hermes kanban show <task_id>
hermes kanban dispatch --failure-limit 4 --max 1     # đẩy task đang ready chạy
hermes kanban unblock <task_id> --reason "..."       # mở khóa rồi dispatch lại
timeout 120 hermes kanban tail <task_id> --interval 5 # xem event trực tiếp
```

## 4. Chạy agent thủ công (khi task crash lặp)

```bash
cd /workspace/ssd/qlttxd && hermes -p coder -z "<một bước nhỏ, rõ đầu ra>"
```
Nguyên tắc: chia việc nhỏ (1-2 file/lần), yêu cầu agent báo kết quả + tự chạy test/build. Timeout mỗi lần ≤280s. Agent crash ngay khi spawn = kiểm tra: (a) key OpenRouter còn hợp lệ, (b) PATH/HOME trong ~/.hermes/profiles/coder/.env, (c) symlink node trong profile home.

## 5. Lưu & đẩy mã sau khi verified

```bash
cd /workspace/ssd/qlttxd
git add <file cụ thể>          # KHÔNG add file rác/temp; UI change phải kèm screenshot mới
git commit -m "loại(scope): mô tả"
git push origin resolve-pending
git checkout master && git merge resolve-pending --no-edit && git push origin master
git checkout resolve-pending
```
Remote đã cấu hình sẵn token trong URL. Nếu push hỏi tài khoản → set-url lại với token từ /workspace/ssd/.secrets/github-token.

## 6. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Task crashed ngay lập tức xN lần | Key model hết hạn/mất | Kiểm tra key bằng curl /api/v1/key; thay vào profiles/coder/.env |
| Agent báo "node not found" | Mất PATH/HOME env | Xem mục 4 nguyên tắc (b); đảm bảo .env profile có PATH/HOME/LD_LIBRARY_PATH |
| BE suite fail loạt 259+ | DB chưa chạy | pg_ctl start như mục 1 |
| Test security fail thiếu /tmp/test-1x1.png | Container mới mất file tạm | Tạo lại PNG 1x1 bằng python (zlib+crc) |
| git push hỏi username | Token mất khỏi remote URL | set-url lại dùng /workspace/ssd/.secrets/github-token |
| hermes: not found | Mất PATH | export PATH toolchain/node/bin |

## 7. Báo cáo cho chủ dự án — khung chuẩn

```
AUDIT STATUS
P0: n · P1: n · P2: n · P3: n · P4: n
PHASE HIỆN TẠI: <GIAI ĐOẠN x — tên>
TASK ĐANG CHẠY: <id + tên> (owner)
BLOCKER: <không / mô tả + kế hoạch tháo gỡ>
TIẾP THEO: <việc kế>
CẦN QUYẾT ĐỊNH: <không / danh sách DECISION-GATE>
```
Chỉ gửi khi: xong một giai đoạn trọn vẹn, hoặc có DECISION-GATE. Không spam tiến trình từng task nhỏ.
