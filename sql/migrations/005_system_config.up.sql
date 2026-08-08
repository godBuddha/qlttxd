-- Migration 005: system_config + workflow tables + seed
-- Purpose: centralize configuration, model the workflow state machine,
--           enforce validation rules, and manage notification channels.

BEGIN;

-- ============================================================
-- DDL — new tables
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
-- SEED DATA
-- ============================================================

-- --- system_config ---
-- Uses a single global scope_uuid so ON CONFLICT works for global configs.
-- (PostgreSQL treats NULL ≠ NULL in UNIQUE constraints.)

INSERT INTO system_config (scope, scope_id, category, key, value, value_type, description) VALUES
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'jwt_access_ttl', '"5m"'::jsonb, 'string', 'JWT access token lifetime'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'jwt_refresh_ttl', '"7d"'::jsonb, 'string', 'JWT refresh token lifetime'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'sse_token_ttl', '"60s"'::jsonb, 'string', 'SSE short-lived token lifetime'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'bcrypt_rounds', '10'::jsonb, 'integer', 'bcrypt cost factor for password hashing'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'auth', 'reset_token_expiry_ms', '900000'::jsonb, 'integer', 'Reset-token expiry in milliseconds (15 min)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'global_window_ms', '900000'::jsonb, 'integer', 'Global rate-limit window (ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'global_max', '100'::jsonb, 'integer', 'Max requests per window (all endpoints)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'write_max', '30'::jsonb, 'integer', 'Max write requests per window (POST/PATCH/PUT/DELETE)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'user_max', '200'::jsonb, 'integer', 'Per-user max requests per window'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'auth_max', '10'::jsonb, 'integer', 'Max auth-endpoint requests per IP per window'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'rate_limit', 'forgot_max', '200'::jsonb, 'integer', 'Max forgot-password requests per IP per window'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'max_age_ms', '604800000'::jsonb, 'integer', 'Cookie max age in ms (7 days)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'same_site', '"lax"'::jsonb, 'string', 'Cookie SameSite policy'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'http_only_refresh', 'true'::jsonb, 'boolean', 'Refresh token cookie HttpOnly flag'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'http_only_csrf', 'false'::jsonb, 'boolean', 'CSRF token cookie HttpOnly flag'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cookie', 'path', '"/"'::jsonb, 'string', 'Cookie path'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pool', 'max', '20'::jsonb, 'integer', 'Max PgBouncer pool connections'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pool', 'idle_timeout_ms', '30000'::jsonb, 'integer', 'Pool idle timeout (ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pool', 'connect_timeout_ms', '5000'::jsonb, 'integer', 'Pool connection timeout (ms)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'upload', 'max_mb', '10'::jsonb, 'integer', 'Max upload size per file in MB'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'upload', 'body_limit_json', '"1mb"'::jsonb, 'string', 'Express JSON body-parser limit'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'upload', 'body_limit_url', '"10kb"'::jsonb, 'string', 'Express URL-encoded body-parser limit'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'upload', 'max_photos', '5'::jsonb, 'integer', 'Max photos per submission'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'audit', 'retention_days', '7300'::jsonb, 'integer', 'Audit log retention period in days (20 years)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'audit', 'batch_size', '500'::jsonb, 'integer', 'Batch size for audit purge'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'audit', 'cron_interval_ms', '86400000'::jsonb, 'integer', 'Audit retention job interval (daily, ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'audit', 'archive_dir', '"audit_archive"'::jsonb, 'string', 'Archive output directory name'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'token_blocklist_ttl_ms', '28800000'::jsonb, 'integer', 'Token-blocklist JTI TTL (8 hours, ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'token_blocklist_interval_ms', '1800000'::jsonb, 'integer', 'Token blocklist cleanup interval (30 min, ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'reset_token_interval_ms', '3600000'::jsonb, 'integer', 'Reset-token cleanup interval (1 hour, ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'user_tokens_interval_ms', '3600000'::jsonb, 'integer', 'User-tokens cleanup interval (1 hour, ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'cleanup', 'user_tokens_max_age_days', '30'::jsonb, 'integer', 'Max age for user-tokens before cleanup (days)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'notification', 'worker_batch_size', '10'::jsonb, 'integer', 'Notification worker batch size'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'notification', 'worker_poll_interval_ms', '30000'::jsonb, 'integer', 'Notification worker poll interval (30 s, ms)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'sse', 'heartbeat_ms', '30000'::jsonb, 'integer', 'SSE heartbeat interval (ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'sse', 'poll_ms', '5000'::jsonb, 'integer', 'SSE fallback polling interval (ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'sse', 'poll_limit', '50'::jsonb, 'integer', 'SSE poll response limit'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'bell', 'poll_interval_ms', '30000'::jsonb, 'integer', 'Bell-notification polling interval (ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'bell', 'retry_interval_ms', '300000'::jsonb, 'integer', 'Retry SSE after N ms of polling fallback'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'bell', 'reconnect_delays', '[1000,2000,4000]'::jsonb, 'array', 'SSE reconnection delays (exponential backoff)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'bell', 'max_reconnect', '3'::jsonb, 'integer', 'Max SSE reconnect attempts before polling fallback'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'bell', 'dropdown_limit', '15'::jsonb, 'integer', 'Max items in bell dropdown'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'security', 'hsts_max_age', '31536000'::jsonb, 'integer', 'HSTS max-age in seconds (1 year)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'security', 'cors_max_age', '86400'::jsonb, 'integer', 'CORS preflight cache max-age (seconds)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'security', 'request_timeout_ms', '30000'::jsonb, 'integer', 'Default HTTP request timeout (ms)'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'security', 'forced_shutdown_ms', '10000'::jsonb, 'integer', 'Graceful-shutdown forced-stop delay (ms)'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'users_default', '50'::jsonb, 'integer', 'Default page size for users list'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'users_max', '200'::jsonb, 'integer', 'Max page size for users list'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'notifications_default', '20'::jsonb, 'integer', 'Default page size for notifications'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'notifications_max', '100'::jsonb, 'integer', 'Max page size for notifications'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'ban_do_default', '500'::jsonb, 'integer', 'Default page size for ban-do results'),
('global', '00000000-0000-4000-a000-000000000000'::uuid, 'pagination', 'ban_do_max', '2000'::jsonb, 'integer', 'Max page size for ban-do results'),

('global', '00000000-0000-4000-a000-000000000000'::uuid, 'version', 'fallback', '"0.3.2"'::jsonb, 'string', 'App version fallback')

ON CONFLICT ON CONSTRAINT uq_system_config DO NOTHING;

-- --- workflow_states (from utils/constants.js STATES + STATE_LABELS) ---
INSERT INTO workflow_states (code, label, is_terminal, sort_order) VALUES
('cho_tiep_nhan',      'Chờ tiếp nhận',       false, 10),
('da_tiep_nhan',       'Đã tiếp nhận',        false, 20),
('cho_xac_minh',       'Chờ xác minh',        false, 30),
('dang_xac_minh',      'Đang xác minh',       false, 40),
('cho_bo_sung',        'Chờ bổ sung',         false, 50),
('cho_lap_bien_ban',   'Chờ lập biên bản',    false, 60),
('da_lap_bien_ban',    'Đã lập biên bản',     false, 70),
('cho_ra_quyet_dinh',  'Chờ ra quyết định',   false, 80),
('da_ra_quyet_dinh',   'Đã ra quyết định',    false, 90),
('dang_khac_phuc',     'Đang khắc phục',      false, 100),
('cho_duyet_dieu_81',  'Chờ duyệt Điều 81',   false, 110),
('da_khac_phuc',       'Đã khắc phục',        false, 120),
('da_dong',            'Đã đóng',             true,  200),
('da_huy',             'Đã hủy',              true,  210),
('da_chuyen_co_quan',  'Chuyển cơ quan khác', true,  220)
ON CONFLICT DO NOTHING;

-- --- workflow_transitions (from utils/constants.js TRANSITIONS) ---
INSERT INTO workflow_transitions (from_state, to_state, label, sort_order) VALUES
('cho_tiep_nhan',      'cho_xac_minh',       'Chuyển sang xác minh',         1),
('cho_tiep_nhan',      'da_tiep_nhan',       'Nhận hồ sơ',                   2),
('cho_tiep_nhan',      'da_huy',             'Hủy báo cáo',                  3),
('cho_tiep_nhan',      'da_chuyen_co_quan',  'Chuyển cơ quan',               4),
('da_tiep_nhan',       'cho_xac_minh',       'Yêu cầu xác minh',             1),
('da_tiep_nhan',       'cho_bo_sung',        'Yêu cầu bổ sung',              2),
('da_tiep_nhan',       'da_huy',             'Hủy hồ sơ',                    3),
('cho_xac_minh',       'dang_xac_minh',      'Bắt đầu xác minh',             1),
('cho_xac_minh',       'cho_bo_sung',        'Yêu cầu bổ sung',              2),
('cho_xac_minh',       'da_huy',             'Hủy báo cáo',                  3),
('cho_xac_minh',       'da_chuyen_co_quan',  'Chuyển cơ quan',               4),
('dang_xac_minh',      'cho_bo_sung',        'Yêu cầu bổ sung',              1),
('dang_xac_minh',      'cho_lap_bien_ban',   'Lập biên bản',                 2),
('dang_xac_minh',      'da_huy',             'Hủy báo cáo',                  3),
('cho_bo_sung',        'cho_xac_minh',       'Tiếp tục xác minh',            1),
('cho_bo_sung',        'da_huy',             'Hủy báo cáo',                  2),
('cho_lap_bien_ban',   'da_lap_bien_ban',    'Hoàn thành biên bản',          1),
('cho_lap_bien_ban',   'da_huy',             'Hủy biên bản',                 2),
('da_lap_bien_ban',    'cho_ra_quyet_dinh',  'Chờ ra quyết định',            1),
('cho_ra_quyet_dinh',  'da_ra_quyet_dinh',   'Ra quyết định',                1),
('da_ra_quyet_dinh',   'dang_khac_phuc',     'Bắt đầu khắc phục',            1),
('da_ra_quyet_dinh',   'da_dong',            'Đóng hồ sơ',                   2),
('dang_khac_phuc',     'da_khac_phuc',       'Hoàn tất khắc phục',           1),
('da_khac_phuc',       'da_dong',            'Đóng hồ sơ',                   1),
('cho_duyet_dieu_81',  'cho_lap_bien_ban',   'Lập biên bản',                 1),
('cho_duyet_dieu_81',  'da_huy',             'Hủy báo cáo',                  2)
ON CONFLICT DO NOTHING;

-- --- role_state_permissions (from utils/workflow-rules.js ROLE_PERMISSIONS) ---
-- case_handler permissions
INSERT INTO role_state_permissions (role_id, state_code)
SELECT r.id, ws.code FROM roles r, workflow_states ws
WHERE r.code = 'case_handler' AND ws.code IN (
    'da_tiep_nhan', 'dang_khac_phuc', 'da_khac_phuc', 'da_dong', 'da_lap_bien_ban'
) ON CONFLICT DO NOTHING;

-- verifier permissions
INSERT INTO role_state_permissions (role_id, state_code)
SELECT r.id, ws.code FROM roles r, workflow_states ws
WHERE r.code = 'verifier' AND ws.code IN (
    'dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban', 'da_dong'
) ON CONFLICT DO NOTHING;

-- leader permissions
INSERT INTO role_state_permissions (role_id, state_code)
SELECT r.id, ws.code FROM roles r, workflow_states ws
WHERE r.code = 'leader' AND ws.code IN (
    'cho_xac_minh', 'dang_xac_minh', 'cho_bo_sung', 'cho_lap_bien_ban',
    'da_ra_quyet_dinh', 'da_dong', 'da_huy', 'da_chuyen_co_quan'
) ON CONFLICT DO NOTHING;

-- admin gets ALL states — handled by app logic (role='admin' => unrestricted),
-- but seed here too for completeness
INSERT INTO role_state_permissions (role_id, state_code)
SELECT r.id, ws.code FROM roles r, workflow_states ws
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- --- validation_rules (from backend validation logic) ---
INSERT INTO validation_rules (field_name, rule_type, value, error_message) VALUES
('username',   'min_length', '3',    'Tên đăng nhập tối thiểu 3 ký tự'),
('username',   'max_length', '50',   'Tên đăng nhập tối đa 50 ký tự'),
('password',   'min_length', '8',    'Mật khẩu tối thiểu 8 ký tự'),
('password',   'regex',      '[a-zA-Z]', 'Mật khẩu phải chứa ít nhất một chữ cái'),
('password',   'regex',      '[0-9]',    'Mật khẩu phải chứa ít nhất một số'),
('full_name',  'max_length', '200',  'Họ tên tối đa 200 ký tự'),
('email',      'regex',      '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', 'Email không hợp lệ'),
('phone',      'regex',      '^\\d{9,11}$', 'Số điện thoại 9-11 chữ số'),
('cmnd_cccd',  'regex',      '^\\d{9,12}$', 'CMND/CCCD 9-12 chữ số'),
('mo_ta',      'max_length', '10000','Mô tả tối đa 10 000 ký tự'),
('ghi_chu',    'max_length', '5000', 'Ghi chú tối đa 5 000 ký tự')
ON CONFLICT ON CONSTRAINT uq_validation_rules DO NOTHING;

-- --- notification_channels ---
INSERT INTO notification_channels (code, label, is_active, config) VALUES
('portal', 'Cổng thông tin',   true,  '{}'::jsonb),
('email',  'Email',            true,  '{}'::jsonb),
('sms',    'Tin nhắn SMS',     true,  '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- --- allowed_mime_types ---
INSERT INTO allowed_mime_types (mime_type, extension, is_active, magic_bytes_required) VALUES
('image/jpeg', '.jpg',   true, true),
('image/jpeg', '.jpeg',  true, true),
('image/png',  '.png',   true, true),
('image/gif',  '.gif',   true, true),
('image/webp', '.webp',  true, true)
ON CONFLICT DO NOTHING;

COMMIT;
