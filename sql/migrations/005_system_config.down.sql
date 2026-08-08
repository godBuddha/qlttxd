-- Migration 005: rollback — DROP TABLEs in reverse dependency order
DROP TABLE IF EXISTS allowed_mime_types CASCADE;
DROP TABLE IF EXISTS notification_channels CASCADE;
DROP TABLE IF EXISTS validation_rules CASCADE;
DROP TABLE IF EXISTS role_state_permissions CASCADE;
DROP TABLE IF EXISTS workflow_transitions CASCADE;
DROP TABLE IF EXISTS workflow_states CASCADE;
DROP TABLE IF EXISTS config_schema CASCADE;
DROP TABLE IF EXISTS config_history CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
