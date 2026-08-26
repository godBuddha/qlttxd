-- 03-config-tables.sql
-- ConfigService tables + workflow tables + seed data
-- (Gộp từ migrations 005 + 006 — chạy sau 02-seed.sql)

BEGIN;

-- ============================================================
-- DDL — Config + Workflow tables
-- ============================================================

CREATE TABLE IF NOT EXISTS system_config (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope       VARCHAR(50) NOT NULL DEFAULT 'global',
    scope_id    UUID,
    category    VARCHAR(50) NOT NULL,
    key         VARCHAR(200) NOT NULL,
    value       JSONB,
    value_type  VARCHAR(20) NOT NULL DEFAULT 'string',
    description TEXT,
    is_secret   BOOLEAN NOT NULL DEFAULT false,
    is_readonly BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_system_config UNIQUE (scope, scope_id, category, key)
);

CREATE TABLE IF NOT EXISTS config_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id     UUID NOT NULL REFERENCES system_config(id) ON DELETE CASCADE,
    nguoi_dung_id UUID REFERENCES users(id) ON DELETE SET NULL,
    old_value     JSONB,
    new_value     JSONB,
    action        VARCHAR(20) NOT NULL,
    thoi_gian     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip            INET,
    request_id    TEXT
);

CREATE TABLE IF NOT EXISTS config_schema (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category         VARCHAR(50) NOT NULL,
    key              VARCHAR(200) NOT NULL,
    value_type       VARCHAR(20),
    min_value        NUMERIC,
    max_value        NUMERIC,
    allowed_values   JSONB,
    regex            TEXT,
    is_secret        BOOLEAN NOT NULL DEFAULT false,
    is_readonly      BOOLEAN NOT NULL DEFAULT false,
    description      TEXT,
    CONSTRAINT uq_config_schema UNIQUE (category, key)
);

CREATE TABLE IF NOT EXISTS workflow_states (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50) NOT NULL UNIQUE,
    label       VARCHAR(200) NOT NULL,
    is_terminal BOOLEAN NOT NULL DEFAULT false,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workflow_transitions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_state  VARCHAR(50) NOT NULL REFERENCES workflow_states(code) ON DELETE CASCADE,
    to_state    VARCHAR(50) NOT NULL REFERENCES workflow_states(code) ON DELETE CASCADE,
    label       VARCHAR(200),
    sort_order  INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_workflow_transitions UNIQUE (from_state, to_state)
);

CREATE TABLE IF NOT EXISTS role_state_permissions (
    role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    state_code VARCHAR(50) NOT NULL REFERENCES workflow_states(code) ON DELETE CASCADE,
    PRIMARY KEY (role_id, state_code)
);

CREATE TABLE IF NOT EXISTS validation_rules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name    VARCHAR(100) NOT NULL,
    rule_type     VARCHAR(50) NOT NULL,
    value         TEXT,
    error_message TEXT,
    CONSTRAINT uq_validation_rules UNIQUE (field_name, rule_type)
);

CREATE TABLE IF NOT EXISTS notification_channels (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code               VARCHAR(30) NOT NULL UNIQUE,
    label              VARCHAR(100) NOT NULL,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    config             JSONB
);

CREATE TABLE IF NOT EXISTS allowed_mime_types (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mime_type                VARCHAR(100) NOT NULL UNIQUE,
    extension                VARCHAR(10),
    is_active                BOOLEAN NOT NULL DEFAULT true,
    magic_bytes_required     BOOLEAN NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);
CREATE INDEX IF NOT EXISTS idx_system_config_scope   ON system_config(scope);
CREATE INDEX IF NOT EXISTS idx_config_history_config ON config_history(config_id);
CREATE INDEX IF NOT EXISTS idx_workflow_trans_from   ON workflow_transitions(from_state);
CREATE INDEX IF NOT EXISTS idx_role_state_perm_role  ON role_state_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_state_perm_state ON role_state_permissions(state_code);

-- Trigger: auto-update updated_at on system_config
CREATE OR REPLACE FUNCTION _trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_config_updated_at ON system_config;
CREATE TRIGGER trg_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION _trigger_set_updated_at();

-- ============================================================
-- SEED — system_config (53 rows)
-- ============================================================

INSERT INTO system_config (scope, scope_id, category, key, value, value_type, description) VALUES
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'jwt_access_ttl', '"5m"'::jsonb, 'string', 'JWT access token lifetime'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'jwt_refresh_ttl', '"7d"'::jsonb, 'string', 'JWT refresh token lifetime'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'sse_token_ttl', '"60s"'::jsonb, 'string', 'SSE short-lived token lifetime'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'bcrypt_rounds', '10'::jsonb, 'integer', 'bcrypt cost factor'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'reset_token_expiry_ms', '900000'::jsonb, 'integer', 'Reset-token expiry (15 min)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'global_window_ms', '900000'::jsonb, 'integer', 'Global rate-limit window (ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'global_max', '100'::jsonb, 'integer', 'Max requests per window'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'write_max', '30'::jsonb, 'integer', 'Max write requests per window'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'user_max', '200'::jsonb, 'integer', 'Per-user max requests per window'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'auth_max', '10'::jsonb, 'integer', 'Max auth-endpoint requests per IP'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'forgot_max', '200'::jsonb, 'integer', 'Max forgot-password requests per IP'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'max_age_ms', '604800000'::jsonb, 'integer', 'Cookie max age (7 days)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'same_site', '"lax"'::jsonb, 'string', 'Cookie SameSite policy'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'http_only_refresh', 'true'::jsonb, 'boolean', 'Refresh token cookie HttpOnly'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'http_only_csrf', 'false'::jsonb, 'boolean', 'CSRF token cookie HttpOnly'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'path', '"/"'::jsonb, 'string', 'Cookie path'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pool', 'max', '20'::jsonb, 'integer', 'Max pool connections'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pool', 'idle_timeout_ms', '30000'::jsonb, 'integer', 'Idle timeout (ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pool', 'connect_timeout_ms', '5000'::jsonb, 'integer', 'Connect timeout (ms)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'security', 'request_timeout_ms', '30000'::jsonb, 'integer', 'Request timeout (ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'security', 'hsts_max_age', '31536000'::jsonb, 'integer', 'HSTS max-age (1 year)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'security', 'cors_max_age', '86400'::jsonb, 'integer', 'CORS preflight cache (24h)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'security', 'forced_shutdown_ms', '10000'::jsonb, 'integer', 'Forced shutdown timeout'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'upload', 'max_mb', '10'::jsonb, 'integer', 'Max upload size (MB)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'upload', 'body_limit_json', '"1mb"'::jsonb, 'string', 'JSON body limit'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'upload', 'body_limit_url', '"10kb"'::jsonb, 'string', 'URL-encoded body limit'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'token_blocklist_interval_ms', '1800000'::jsonb, 'integer', 'Token blocklist cleanup (30 min)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'token_blocklist_ttl_ms', '28800000'::jsonb, 'integer', 'Token blocklist TTL (8h)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'reset_token_interval_ms', '3600000'::jsonb, 'integer', 'Reset token cleanup (1h)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'user_tokens_interval_ms', '3600000'::jsonb, 'integer', 'User tokens cleanup (1h)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'user_tokens_max_age_days', '30'::jsonb, 'integer', 'User tokens max age (days)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'notification', 'worker_batch_size', '10'::jsonb, 'integer', 'Notification worker batch size'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'notification', 'worker_poll_interval_ms', '30000'::jsonb, 'integer', 'Worker poll interval (30s)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'sse', 'heartbeat_ms', '30000'::jsonb, 'integer', 'SSE heartbeat interval'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'sse', 'poll_ms', '5000'::jsonb, 'integer', 'SSE poll interval'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'sse', 'poll_limit', '50'::jsonb, 'integer', 'SSE poll limit'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'users_default', '50'::jsonb, 'integer', 'Users page size'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'users_max', '200'::jsonb, 'integer', 'Users max page size'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'ban_do_default', '500'::jsonb, 'integer', 'Map page size'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'ban_do_max', '2000'::jsonb, 'integer', 'Map max page size'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'notifications_default', '20'::jsonb, 'integer', 'Notifications page size'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'notifications_max', '100'::jsonb, 'integer', 'Notifications max page size'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'audit', 'retention_days', '7300'::jsonb, 'integer', 'Audit retention (20 years)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'audit', 'batch_size', '500'::jsonb, 'integer', 'Audit purge batch size'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'audit', 'archive_dir', '"audit_archive"'::jsonb, 'string', 'Audit archive directory'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'audit', 'interval_ms', '86400000'::jsonb, 'integer', 'Audit cleanup interval (24h)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'ui', 'home_lat', '21.0285'::jsonb, 'number', 'Map center latitude'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'ui', 'home_lng', '105.8542'::jsonb, 'number', 'Map center longitude'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'ui', 'language', '"vi"'::jsonb, 'string', 'UI language'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'ui', 'theme', '"light"'::jsonb, 'string', 'UI theme')
ON CONFLICT (scope, scope_id, category, key) DO NOTHING;

-- ============================================================
-- Wave 1 (migration 007) — smtp + features + readonly hsts + schema_version
-- ============================================================

INSERT INTO system_config (scope, scope_id, category, key, value, value_type, description) VALUES
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'smtp', 'enabled',      'false'::jsonb, 'boolean', 'Bật kênh email (SMTP). Khi tắt, mọi gửi mail bị bỏ qua và test-smtp trả lỗi'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'smtp', 'host',         '""'::jsonb,    'string',  'Địa chỉ máy chủ SMTP (vd: smtp.example.gov.vn)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'smtp', 'port',         '587'::jsonb,   'integer', 'Cổng SMTP (587 STARTTLS, 465 SSL/TLS)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'smtp', 'from_address', '""'::jsonb,    'string',  'Địa chỉ người gửi mặc định (From header)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'features', 'settings_center_v2', 'false'::jsonb, 'boolean', 'Flag bảo vệ shell Settings v2 (Wave 2) — bật để dùng shell mới'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'features', 'manual_audit_purge', 'false'::jsonb, 'boolean', 'Cho phép chạy purge audit log ngay trên UI (POST /audit/purge-now)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'features', 'import_dry_run',     'true'::jsonb,  'boolean', 'Mặc định dùng chế độ dry-run khi import cấu hình')
ON CONFLICT (scope, scope_id, category, key) DO NOTHING;

-- LƯU Ý: SMTP_USER / SMTP_PASS vẫn nằm trong .env (lớp A - secret), không đưa vào DB.

-- HC-04: HSTS do Caddy phát hành độc quyền — khóa readonly để tránh sửa không hiệu quả.
UPDATE system_config SET is_readonly = true
WHERE category = 'security' AND key = 'hsts_max_age';

-- Version column for config_schema (migration 007)
ALTER TABLE config_schema ADD COLUMN IF NOT EXISTS schema_version INT NOT NULL DEFAULT 1;
UPDATE config_schema SET schema_version = 1 WHERE schema_version <> 1;

-- ============================================================
-- SEED — workflow_states (15 states)
-- ============================================================

INSERT INTO workflow_states (code, label, is_terminal, sort_order) VALUES
('cho_tiep_nhan',       'Chờ tiếp nhận',           false, 1),
('da_tiep_nhan',        'Đã tiếp nhận',            false, 2),
('cho_xac_minh',        'Chờ xác minh',            false, 3),
('dang_xac_minh',       'Đang xác minh',           false, 4),
('cho_bo_sung',         'Chờ bổ sung',             false, 5),
('cho_lap_bien_ban',    'Chờ lập biên bản',        false, 6),
('da_lap_bien_ban',     'Đã lập biên bản',         false, 7),
('cho_ra_quyet_dinh',   'Chờ ra quyết định',       false, 8),
('da_ra_quyet_dinh',    'Đã ra quyết định',        false, 9),
('dang_khac_phuc',      'Đang khắc phục',          false, 10),
('cho_duyet_dieu_81',   'Chờ duyệt Điều 81',       false, 11),
('da_khac_phuc',        'Đã khắc phục',            false, 12),
('da_dong',             'Đã đóng',                 true,  13),
('da_huy',              'Đã hủy',                  true,  14),
('da_chuyen_co_quan',   'Chuyển cơ quan khác',     true,  15)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED — workflow_transitions (28 transitions)
-- ============================================================

INSERT INTO workflow_transitions (from_state, to_state, label) VALUES
('cho_tiep_nhan',     'da_tiep_nhan',      'Tiếp nhận'),
('cho_tiep_nhan',     'da_huy',            'Hủy bỏ'),
('da_tiep_nhan',      'cho_xac_minh',      'Chuyển xác minh'),
('da_tiep_nhan',      'da_chuyen_co_quan', 'Chuyển cơ quan'),
('cho_xac_minh',      'dang_xac_minh',     'Bắt đầu xác minh'),
('dang_xac_minh',     'cho_bo_sung',       'Yêu cầu bổ sung'),
('dang_xac_minh',     'cho_lap_bien_ban',  'Đủ chứng cứ'),
('dang_xac_minh',     'da_huy',            'Không vi phạm'),
('cho_bo_sung',       'cho_xac_minh',      'Đã bổ sung'),
('cho_lap_bien_ban',  'da_lap_bien_ban',   'Lập biên bản'),
('da_lap_bien_ban',   'cho_ra_quyet_dinh', 'Chuyển ra quyết định'),
('cho_ra_quyet_dinh', 'da_ra_quyet_dinh',  'Ban hành quyết định'),
('da_ra_quyet_dinh',  'dang_khac_phuc',    'Bắt đầu khắc phục'),
('dang_khac_phuc',    'da_khac_phuc',      'Hoàn thành khắc phục'),
('dang_khac_phuc',    'cho_duyet_dieu_81', 'Đề xuất Điều 81'),
('cho_duyet_dieu_81', 'da_khac_phuc',      'Duyệt Điều 81'),
('cho_duyet_dieu_81', 'dang_khac_phuc',    'Từ chối, yêu cầu bổ sung'),
('da_khac_phuc',      'da_dong',           'Đóng hồ sơ'),
('da_dong',           'cho_tiep_nhan',     'Mở lại')
ON CONFLICT (from_state, to_state) DO NOTHING;

-- ============================================================
-- SEED — role_state_permissions
-- ============================================================

INSERT INTO role_state_permissions (role_id, state_code)
SELECT r.id, s.code FROM roles r, workflow_states s
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_state_permissions (role_id, state_code)
SELECT r.id, s.code FROM roles r, workflow_states s
WHERE r.code = 'case_handler'
  -- DEF-009: KHÔNG cấp 'da_dong' — hồ sơ chỉ được đóng qua chuỗi khắc phục/duyệt
  -- hoặc bởi leader/admin (docs/03-dac-ta-nghiep-vu.md UC-06).
  AND s.code IN ('da_tiep_nhan','dang_khac_phuc','da_khac_phuc','da_lap_bien_ban')
ON CONFLICT DO NOTHING;

INSERT INTO role_state_permissions (role_id, state_code)
SELECT r.id, s.code FROM roles r, workflow_states s
WHERE r.code = 'verifier'
  AND s.code IN ('cho_xac_minh','dang_xac_minh','cho_bo_sung','cho_lap_bien_ban')
ON CONFLICT DO NOTHING;

INSERT INTO role_state_permissions (role_id, state_code)
SELECT r.id, s.code FROM roles r, workflow_states s
WHERE r.code = 'leader'
  AND s.code IN ('cho_ra_quyet_dinh','da_ra_quyet_dinh','cho_duyet_dieu_81','da_khac_phuc','da_dong')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED — notification_channels
-- ============================================================

INSERT INTO notification_channels (code, label, config) VALUES
('in_app',   'Thông báo trong ứng dụng', '{"realtime": true}'),
('email',    'Email',                     '{"smtp_configured": false}'),
('sms',      'SMS',                       '{"provider": "none"}')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED — allowed_mime_types
-- ============================================================

INSERT INTO allowed_mime_types (mime_type, extension, magic_bytes_required) VALUES
('image/jpeg', '.jpg',  true),
('image/png',  '.png',  true),
('image/gif',  '.gif',  true),
('image/webp', '.webp', true),
('application/pdf', '.pdf', false)
ON CONFLICT (mime_type) DO NOTHING;

-- ============================================================
-- SEED — validation_rules
-- ============================================================

INSERT INTO validation_rules (field_name, rule_type, value, error_message) VALUES
('mo_ta',       'max_length', '5000',  'Mô tả không được quá 5000 ký tự'),
('dia_chi',     'max_length', '1000',  'Địa chỉ không được quá 1000 ký tự'),
('nguoi_gui_ten','max_length','200',   'Tên người gửi không được quá 200 ký tự'),
('phone',       'regex',      '^0[0-9]{9}$', 'Số điện thoại không hợp lệ'),
('email',       'regex',      '^[^@]+@[^@]+\\.[^@]+$', 'Email không hợp lệ')
ON CONFLICT (field_name, rule_type) DO NOTHING;

-- ============================================================
-- Config permissions (migration 006)
-- ============================================================

INSERT INTO permissions (code, name, module) VALUES
  ('config.view',             'Xem cấu hình hệ thống',       'config'),
  ('config.edit.general',     'Chỉnh sửa cài đặt chung',     'config'),
  ('config.edit.security',    'Chỉnh sửa bảo mật',           'config'),
  ('config.edit.workflow',    'Chỉnh sửa workflow',           'config'),
  ('config.edit.infra',       'Chỉnh sửa hạ tầng',           'config'),
  ('config.edit.appearance',  'Chỉnh sửa giao diện',         'config'),
  ('config.edit.auth',        'Chỉnh sửa xác thực',          'config'),
  ('config.edit.upload',      'Chỉnh sửa upload',            'config'),
  ('config.edit.notification','Chỉnh sửa thông báo',         'config')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN (VALUES
  ('config.view'), ('config.edit.general'), ('config.edit.security'),
  ('config.edit.workflow'), ('config.edit.infra'), ('config.edit.appearance'),
  ('config.edit.auth'), ('config.edit.upload'), ('config.edit.notification')
) AS perms(code)
JOIN permissions p ON p.code = perms.code
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;
