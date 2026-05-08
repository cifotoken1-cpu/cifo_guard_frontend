-- Migration: Create FeatureFlag table
-- Created: 2024
-- Description: Table for feature flag management and A/B testing

-- Create FeatureFlag table
CREATE TABLE IF NOT EXISTS feature_flags (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    `key` VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT false,
    type VARCHAR(20) NOT NULL DEFAULT 'BOOLEAN' CHECK (type IN ('BOOLEAN', 'STRING', 'NUMBER', 'JSON')),
    value JSON,
    default_value JSON,
    environment VARCHAR(50) DEFAULT 'all' CHECK (environment IN ('development', 'staging', 'production', 'all')),
    category VARCHAR(100),
    tags JSON DEFAULT ('[]'),
    conditions JSON DEFAULT ('{}'),
    rollout_percentage DECIMAL(5,2) DEFAULT 100.00 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    user_segments JSON DEFAULT ('[]'),
    is_archived BOOLEAN DEFAULT false,
    is_permanent BOOLEAN DEFAULT false,
    expires_at TIMESTAMP,
    last_evaluated_at TIMESTAMP,
    evaluation_count BIGINT DEFAULT 0,
    metadata JSON DEFAULT ('{}'),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    enabled_at TIMESTAMP,
    disabled_at TIMESTAMP
);

-- Create indexes for FeatureFlag table
CREATE UNIQUE INDEX idx_feature_flags_key ON feature_flags(`key`);
CREATE INDEX idx_feature_flags_is_enabled ON feature_flags(is_enabled);
CREATE INDEX idx_feature_flags_type ON feature_flags(type);
CREATE INDEX idx_feature_flags_environment ON feature_flags(environment);
CREATE INDEX idx_feature_flags_category ON feature_flags(category);
CREATE INDEX idx_feature_flags_is_archived ON feature_flags(is_archived);
CREATE INDEX idx_feature_flags_is_permanent ON feature_flags(is_permanent);
CREATE INDEX idx_feature_flags_expires_at ON feature_flags(expires_at);
CREATE INDEX idx_feature_flags_last_evaluated_at ON feature_flags(last_evaluated_at);
CREATE INDEX idx_feature_flags_created_at ON feature_flags(created_at);
CREATE INDEX idx_feature_flags_rollout_percentage ON feature_flags(rollout_percentage);

-- MySQL doesn't support GIN indexes for JSON columns
-- CREATE INDEX idx_feature_flags_tags ON feature_flags USING GIN(tags);
-- CREATE INDEX idx_feature_flags_conditions ON feature_flags USING GIN(conditions);
-- CREATE INDEX idx_feature_flags_user_segments ON feature_flags USING GIN(user_segments);
-- CREATE INDEX idx_feature_flags_metadata ON feature_flags USING GIN(metadata);
-- CREATE INDEX idx_feature_flags_value ON feature_flags USING GIN(value);
-- CREATE INDEX idx_feature_flags_default_value ON feature_flags USING GIN(default_value);

-- Create composite indexes for common queries
CREATE INDEX idx_feature_flags_enabled_env ON feature_flags(is_enabled, environment);
CREATE INDEX idx_feature_flags_enabled_archived ON feature_flags(is_enabled, is_archived);
CREATE INDEX idx_feature_flags_category_enabled ON feature_flags(category, is_enabled);
-- MySQL doesn't support partial indexes with WHERE clause
-- CREATE INDEX idx_feature_flags_expires_enabled ON feature_flags(expires_at, is_enabled) WHERE expires_at IS NOT NULL;

-- MySQL: updated_at trigger is handled by ON UPDATE CURRENT_TIMESTAMP in column definition

-- MySQL doesn't support regex CHECK constraints like PostgreSQL
-- ALTER TABLE feature_flags ADD CONSTRAINT chk_key_format CHECK (key ~ '^[a-zA-Z0-9_-]+$');

-- MySQL supports basic CHECK constraints (MySQL 8.0+)
ALTER TABLE feature_flags ADD CONSTRAINT chk_evaluation_count_positive 
    CHECK (evaluation_count >= 0);

ALTER TABLE feature_flags ADD CONSTRAINT chk_expires_future 
    CHECK (expires_at IS NULL OR expires_at > created_at);

-- MySQL doesn't support PostgreSQL-style functions and triggers
-- The following PostgreSQL functions and triggers are not supported in MySQL:
-- - update_flag_timestamps() function and trigger
-- - validate_flag_value() function and trigger  
-- - prevent_permanent_flag_deletion() function and trigger
-- These would need to be implemented in application logic instead

-- MySQL doesn't support VIEWs in migration files the same way
-- CREATE VIEW active_feature_flags would be created separately

-- MySQL doesn't support COMMENT ON syntax
-- Table and column comments are added during CREATE TABLE

-- Insert sample data
INSERT IGNORE INTO feature_flags (
    id, `key`, name, description, is_enabled, type, value, default_value,
    environment, category, tags, conditions, rollout_percentage, user_segments,
    expires_at, last_evaluated_at, evaluation_count, metadata,
    is_archived, is_permanent, enabled_at, disabled_at,
    created_at, updated_at, created_by, updated_by
) VALUES 
(
    UUID(), 'dark_mode_toggle', 'Dark Mode Toggle', 'Enable dark mode UI theme',
    true, 'BOOLEAN', 'true', 'false',
    'production', 'ui', '["theme", "ui"]', '{}', 100, '[]',
    NULL, NOW(), 0, '{}',
    false, false, NOW(), NULL,
    NOW(), NOW(), 'system', 'system'
),
(
    UUID(), 'new_dashboard_layout', 'New Dashboard Layout', 'Enable new dashboard design',
    false, 'BOOLEAN', 'false', 'false',
    'staging', 'ui', '["dashboard", "layout"]', '{}', 50, '["beta_users"]',
    DATE_ADD(NOW(), INTERVAL 30 DAY), NULL, 0, '{"version": "2.0"}',
    false, false, NULL, NOW(),
    NOW(), NOW(), 'admin', 'admin'
),
(
    UUID(), 'api_rate_limit', 'API Rate Limit', 'Rate limiting configuration',
    true, 'NUMBER', '1000', '500',
    'production', 'api', '["performance", "security"]', '{}', 100, '[]',
    NULL, NOW(), 150, '{"unit": "requests_per_hour"}',
    false, true, NOW(), NULL,
    NOW(), NOW(), 'system', 'system'
 );