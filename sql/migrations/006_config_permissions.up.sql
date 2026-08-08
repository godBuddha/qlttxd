-- Migration 006: Config permissions + role assignments
-- Purpose: add RBAC permissions for config management; grant all to admin.

BEGIN;

-- ============================================================
-- INSERT config permissions (9 total)
-- ============================================================
INSERT INTO permissions (code, name, module) VALUES
  ('config.view',           'Xem cấu hình hệ thống',       'config'),
  ('config.edit.general',   'Chỉnh sửa cài đặt chung',     'config'),
  ('config.edit.security',  'Chỉnh sửa bảo mật',           'config'),
  ('config.edit.workflow',  'Chỉnh sửa workflow',          'config'),
  ('config.edit.infra',     'Chỉnh sửa hạ tầng',           'config'),
  ('config.edit.appearance','Chỉnh sửa giao diện',         'config'),
  ('config.edit.auth',      'Chỉnh sửa xác thực',          'config'),
  ('config.edit.upload',    'Chỉnh sửa upload',            'config'),
  ('config.edit.notification','Chỉnh sửa thông báo',       'config')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Grant ALL config permissions to admin role
-- ============================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
CROSS JOIN (VALUES
  ('config.view'),
  ('config.edit.general'),
  ('config.edit.security'),
  ('config.edit.workflow'),
  ('config.edit.infra'),
  ('config.edit.appearance'),
  ('config.edit.auth'),
  ('config.edit.upload'),
  ('config.edit.notification')
) AS perms(code)
JOIN permissions p ON p.code = perms.code
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;
