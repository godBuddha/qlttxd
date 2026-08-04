-- Migration 004: Add scope fields (quan_huyen_id, phuong_xa_id) to users table.
-- Allows filtering statistics by administrative scope.

ALTER TABLE users ADD COLUMN IF NOT EXISTS quan_huyen_id UUID REFERENCES quan_huyen(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phuong_xa_id  UUID REFERENCES phuong_xa(id);

COMMENT ON COLUMN users.quan_huyen_id IS 'Phạm vi quận — lãnh đạo quận chỉ thấy quận mình';
COMMENT ON COLUMN users.phuong_xa_id  IS 'Phạm vi phường — cán bộ phường chỉ thấy phường mình';
