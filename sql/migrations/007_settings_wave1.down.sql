-- Migration 007: rollback — remove Wave 1 additions
-- Drops schema_version, deletes smtp.*/features.* keys and unlocks hsts_max_age.

BEGIN;

ALTER TABLE config_schema DROP COLUMN IF EXISTS schema_version;

DELETE FROM system_config WHERE category = 'smtp';
DELETE FROM system_config WHERE category = 'features';

UPDATE system_config SET is_readonly = false
WHERE category = 'security' AND key = 'hsts_max_age';

COMMIT;
