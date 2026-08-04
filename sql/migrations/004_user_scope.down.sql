-- Migration 004 rollback: Remove scope fields from users table.

ALTER TABLE users DROP COLUMN IF EXISTS phuong_xa_id;
ALTER TABLE users DROP COLUMN IF EXISTS quan_huyen_id;
