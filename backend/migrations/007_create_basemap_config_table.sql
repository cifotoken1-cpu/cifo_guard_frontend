-- Migration: Create BasemapConfig table
-- Created: 2024
-- Description: Table for SVG basemap configuration and calibration

-- Create BasemapConfig table
CREATE TABLE IF NOT EXISTS basemap_configs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    svg_data LONGTEXT NOT NULL,
    calibration JSON NOT NULL,
    dimensions JSON NOT NULL,
    is_active BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    settings JSON DEFAULT ('{}'),
    metadata JSON DEFAULT ('{}'),
    file_size INTEGER,
    checksum VARCHAR(64),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Create indexes for BasemapConfig table
CREATE INDEX idx_basemap_configs_name ON basemap_configs(name);
CREATE INDEX idx_basemap_configs_is_active ON basemap_configs(is_active);
CREATE INDEX idx_basemap_configs_is_default ON basemap_configs(is_default);
CREATE INDEX idx_basemap_configs_version ON basemap_configs(version);
CREATE INDEX idx_basemap_configs_created_at ON basemap_configs(created_at);
CREATE INDEX idx_basemap_configs_checksum ON basemap_configs(checksum);
-- MySQL doesn't support GIN indexes for JSON columns
-- CREATE INDEX idx_basemap_configs_calibration ON basemap_configs USING GIN(calibration);
-- CREATE INDEX idx_basemap_configs_dimensions ON basemap_configs USING GIN(dimensions);
-- CREATE INDEX idx_basemap_configs_settings ON basemap_configs USING GIN(settings);
-- CREATE INDEX idx_basemap_configs_metadata ON basemap_configs USING GIN(metadata);

-- Create composite indexes for common queries
CREATE INDEX idx_basemap_configs_active_default ON basemap_configs(is_active, is_default);
-- MySQL doesn't support partial indexes with WHERE clause
-- CREATE UNIQUE INDEX idx_basemap_configs_unique_default ON basemap_configs(is_default) WHERE is_default = true;
CREATE UNIQUE INDEX idx_basemap_configs_name_version ON basemap_configs(name, version);

-- MySQL doesn't support PostgreSQL-style triggers, functions, and comments
-- Triggers for updated_at are handled by ON UPDATE CURRENT_TIMESTAMP in column definitions
-- CREATE TRIGGER update_basemap_configs_updated_at BEFORE UPDATE ON basemap_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add basic constraints (MySQL doesn't support JSON operators like ? and ->>
-- Complex JSON validation should be handled in application logic)
-- Note: MySQL doesn't support DROP CONSTRAINT IF EXISTS, so we skip dropping if they don't exist
-- The migration script will handle duplicate constraint errors gracefully

-- Add constraints (will be skipped if they already exist)
ALTER TABLE basemap_configs ADD CONSTRAINT chk_version_positive 
    CHECK (version > 0);

ALTER TABLE basemap_configs ADD CONSTRAINT chk_file_size_positive 
    CHECK (file_size IS NULL OR file_size > 0);

ALTER TABLE basemap_configs ADD CONSTRAINT chk_svg_data_not_empty 
    CHECK (CHAR_LENGTH(TRIM(svg_data)) > 0);

-- MySQL doesn't support PostgreSQL-style functions and triggers
-- Business logic for ensuring single default basemap and SVG validation
-- should be implemented in application code

-- Sample basemap configuration data
INSERT IGNORE INTO basemap_configs (
    id, name, description, svg_data, calibration, dimensions,
    is_active, is_default, version, settings, metadata,
    file_size, checksum, created_by
) VALUES 
(
    UUID(), 'Default Basemap', 'Default SVG basemap for the application',
    '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="600" fill="#f0f0f0"/><text x="400" y="300" text-anchor="middle" font-size="24">Sample Basemap</text></svg>',
    '{"controlPoints": [{"svg": {"x": 100, "y": 100}, "geo": {"lat": -6.2088, "lng": 106.8456}}, {"svg": {"x": 700, "y": 100}, "geo": {"lat": -6.2088, "lng": 106.8556}}, {"svg": {"x": 400, "y": 500}, "geo": {"lat": -6.2188, "lng": 106.8506}}]}',
    '{"width": 800, "height": 600}',
    TRUE, TRUE, 1,
    '{"showGrid": true, "gridSize": 50, "opacity": 0.8}',
    '{"author": "System", "created": "2024-01-01", "tags": ["default", "sample"]}',
    2048, 'abc123def456', 'system'
);