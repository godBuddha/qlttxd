-- Migration 007: Settings Center Wave 1 — smtp.* + features.* + readonly hsts + schema_version
-- Purpose: add SMTP channel keys and feature flags, lock security.hsts_max_age
--          (HSTS is issued solely by Caddy — HC-04), and version config_schema rows.
-- All inserts are idempotent (ON CONFLICT DO NOTHING). Secrets stay in .env (layer A):
-- SMTP_USER / SMTP_PASS are deliberately NOT stored in system_config.

BEGIN;

-- ============================================================
-- 1) Category: smtp (4 keys, global scope)
-- ============================================================

INSERT INTO system_config (scope, scope_id, category, key, value, value_type, description) VALUES
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'smtp', 'enabled',      'false'::jsonb, 'boolean', 'Bật kênh email (SMTP). Khi tắt, mọi gửi mail bị bỏ qua và test-smtp trả lỗi'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'smtp', 'host',         '""'::jsonb,    'string',  'Địa chỉ máy chủ SMTP (vd: smtp.example.gov.vn)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'smtp', 'port',         '587'::jsonb,   'integer', 'Cổng SMTP (587 STARTTLS, 465 SSL/TLS)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'smtp', 'from_address', '""'::jsonb,    'string',  'Địa chỉ người gửi mặc định (From header)')
ON CONFLICT ON CONSTRAINT uq_system_config DO NOTHING;

-- LƯU Ý: SMTP_USER / SMTP_PASS vẫn nằm trong .env (lớp A - secret).
-- Không đưa secret vào DB để tránh lộ qua API export/history/audit.

-- ============================================================
-- 2) Category: features (feature flags)
-- ============================================================

INSERT INTO system_config (scope, scope_id, category, key, value, value_type, description) VALUES
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'features', 'settings_center_v2', 'false'::jsonb, 'boolean', 'Flag bảo vệ shell Settings v2 (Wave 2) — bật để dùng shell mới'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'features', 'manual_audit_purge', 'false'::jsonb, 'boolean', 'Cho phép chạy purge audit log ngay trên UI (POST /audit/purge-now)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'features', 'import_dry_run',     'true'::jsonb,  'boolean', 'Mặc định dùng chế độ dry-run khi import cấu hình')
ON CONFLICT ON CONSTRAINT uq_system_config DO NOTHING;

-- ============================================================
-- 3) Mark security.hsts_max_age readonly (HC-04)
-- ============================================================
-- HSTS header do Caddy phát hành độc quyền; giá trị này chỉ mang tính
-- tham chiếu cho Caddyfile. Sửa từ UI sẽ không có tác dụng thực tế nên bị chặn.

UPDATE system_config SET is_readonly = true
WHERE category = 'security' AND key = 'hsts_max_age';

-- ============================================================
-- 4) Version column for config_schema
-- ============================================================

ALTER TABLE config_schema ADD COLUMN IF NOT EXISTS schema_version INT NOT NULL DEFAULT 1;

-- Existing rows keep schema_version=1 via the DEFAULT above; the explicit UPDATE
-- makes the intent clear and covers any row created between ADD COLUMN and now.
UPDATE config_schema SET schema_version = 1 WHERE schema_version <> 1;

COMMIT;
