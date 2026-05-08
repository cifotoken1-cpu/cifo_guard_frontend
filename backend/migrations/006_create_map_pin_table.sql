-- Migration: Create MapPin table
-- Created: 2024
-- Description: Table for map pins/markers functionality

-- Create MapPin table
CREATE TABLE IF NOT EXISTS map_pins (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'ALERT', 'INCIDENT', 'TEAM_MEMBER', 'CAMERA', 'GEOFENCE',
        'CHECKPOINT', 'LANDMARK', 'HAZARD', 'RESOURCE', 'CUSTOM'
    )),
    coordinates JSON DEFAULT ('{}'),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    icon_type VARCHAR(100),
    icon_color VARCHAR(50),
    size VARCHAR(20) DEFAULT 'MEDIUM' CHECK (size IN ('SMALL', 'MEDIUM', 'LARGE')),
    is_visible BOOLEAN DEFAULT true,
    is_clickable BOOLEAN DEFAULT true,
    metadata JSON DEFAULT ('{}'),
    
    -- Reference IDs to related entities
    alert_id CHAR(36),
    incident_id CHAR(36),
    team_member_id CHAR(36),
    camera_id CHAR(36),
    geofence_id CHAR(36),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE SET NULL
);

-- Create indexes for MapPin table
CREATE INDEX idx_map_pins_type ON map_pins(type);
CREATE INDEX idx_map_pins_status ON map_pins(status);
CREATE INDEX idx_map_pins_priority ON map_pins(priority);
CREATE INDEX idx_map_pins_is_visible ON map_pins(is_visible);
CREATE INDEX idx_map_pins_is_clickable ON map_pins(is_clickable);
CREATE INDEX idx_map_pins_created_at ON map_pins(created_at);
-- MySQL doesn't support GIN indexes for JSON columns
-- CREATE INDEX idx_map_pins_coordinates ON map_pins USING GIN(coordinates);
-- CREATE INDEX idx_map_pins_metadata ON map_pins USING GIN(metadata);

-- Create indexes for reference IDs
CREATE INDEX idx_map_pins_alert_id ON map_pins(alert_id);
CREATE INDEX idx_map_pins_incident_id ON map_pins(incident_id);
CREATE INDEX idx_map_pins_team_member_id ON map_pins(team_member_id);
CREATE INDEX idx_map_pins_camera_id ON map_pins(camera_id);
CREATE INDEX idx_map_pins_geofence_id ON map_pins(geofence_id);

-- Create composite indexes for common queries
CREATE INDEX idx_map_pins_type_status ON map_pins(type, status);
-- MySQL doesn't support partial indexes with WHERE clause
-- CREATE INDEX idx_map_pins_visible_active ON map_pins(is_visible, status) WHERE is_visible = true AND status = 'ACTIVE';

-- MySQL: updated_at trigger is handled by ON UPDATE CURRENT_TIMESTAMP in column definition

-- MySQL doesn't support PostgreSQL-style JSON operators in CHECK constraints
-- The following constraints would need to be implemented in application logic:
-- - coordinates format validation (latitude/longitude keys)
-- - coordinates range validation (-90 to 90 for latitude, -180 to 180 for longitude)

-- MySQL doesn't support COMMENT ON syntax
-- Table and column comments are added during CREATE TABLE

-- Insert sample data
INSERT IGNORE INTO map_pins (
    id, type, coordinates, title, description, status, priority,
    icon_type, icon_color, size, is_visible, is_clickable, metadata,
    alert_id, incident_id, team_member_id, camera_id, geofence_id,
    created_at, updated_at, created_by, updated_by
) VALUES 
(
    UUID(), 'CAMERA', '{"latitude": -6.2088, "longitude": 106.8456}',
    'Main Entrance Camera', 'Security camera monitoring main entrance',
    'ACTIVE', 'HIGH', 'camera-icon', 'blue', 'MEDIUM',
    true, true, '{"camera_type": "security", "resolution": "1080p"}',
    NULL, NULL, NULL, 'cam-001', NULL,
    NOW(), NOW(), 'system', 'system'
),
(
    UUID(), 'GEOFENCE', '{"latitude": -6.2090, "longitude": 106.8458}',
    'Office Building Perimeter', 'Security perimeter around office building',
    'ACTIVE', 'MEDIUM', 'fence-icon', 'green', 'LARGE',
    true, true, '{"fence_type": "security", "alert_on_breach": true}',
    NULL, NULL, NULL, NULL, (SELECT id FROM geofences WHERE name = 'Office Building Perimeter' LIMIT 1),
    NOW(), NOW(), 'admin', 'admin'
),
(
    UUID(), 'INCIDENT', '{"latitude": -6.2092, "longitude": 106.8460}',
    'Security Incident Location', 'Location where security incident occurred',
    'ACTIVE', 'CRITICAL', 'warning-icon', 'red', 'LARGE',
    true, true, '{"incident_type": "security", "requires_attention": true}',
    NULL, 'inc-001', NULL, NULL, NULL,
    NOW(), NOW(), 'security_officer', 'security_officer'
);