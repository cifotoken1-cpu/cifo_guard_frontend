-- Migration: Create Geofence and GeofenceBreach tables
-- Created: 2024
-- Description: Tables for geofencing functionality

-- Create Geofence table
CREATE TABLE IF NOT EXISTS geofences (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('POLYGON', 'CIRCLE', 'RECTANGLE')),
    coordinates JSON NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    notification_settings JSON DEFAULT ('{}'),
    metadata JSON DEFAULT ('{}'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Create indexes for Geofence table
-- Create index with error handling for duplicates
CREATE INDEX idx_geofences_type ON geofences(type);
CREATE INDEX idx_geofences_is_active ON geofences(is_active);
CREATE INDEX idx_geofences_priority ON geofences(priority);
CREATE INDEX idx_geofences_created_at ON geofences(created_at);

-- Create GeofenceBreach table
CREATE TABLE IF NOT EXISTS geofence_breaches (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    geofence_id CHAR(36) NOT NULL,
    team_member_id CHAR(36),
    breach_type VARCHAR(20) NOT NULL CHECK (breach_type IN ('ENTRY', 'EXIT', 'DWELL')),
    location JSON NOT NULL,
    severity VARCHAR(20) DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    notes TEXT,
    metadata JSON DEFAULT ('{}'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE CASCADE
);

-- Create indexes for GeofenceBreach table
CREATE INDEX idx_geofence_breaches_geofence_id ON geofence_breaches(geofence_id);
CREATE INDEX idx_geofence_breaches_team_member_id ON geofence_breaches(team_member_id);
CREATE INDEX idx_geofence_breaches_breach_type ON geofence_breaches(breach_type);
CREATE INDEX idx_geofence_breaches_severity ON geofence_breaches(severity);
CREATE INDEX idx_geofence_breaches_is_resolved ON geofence_breaches(is_resolved);
CREATE INDEX idx_geofence_breaches_created_at ON geofence_breaches(created_at);

-- MySQL doesn't support COMMENT ON syntax, but table comments can be added during CREATE TABLE
-- Triggers are not needed as we use ON UPDATE CURRENT_TIMESTAMP in column definition

-- Insert sample data
INSERT IGNORE INTO geofences (
    id, name, type, coordinates, description, is_active, priority,
    notification_settings, metadata, created_at, updated_at, created_by, updated_by
) VALUES 
(
    UUID(), 'Office Building Perimeter', 'POLYGON',
    '{"type": "Polygon", "coordinates": [[[106.8456, -6.2088], [106.8466, -6.2088], [106.8466, -6.2098], [106.8456, -6.2098], [106.8456, -6.2088]]]}',
    'Main office building security perimeter', true, 'HIGH',
    '{"email": true, "push": true, "sms": false}', '{"zone": "office", "building": "main"}',
    NOW(), NOW(), 'system', 'system'
),
(
    UUID(), 'Warehouse Zone', 'RECTANGLE',
    '{"type": "Rectangle", "bounds": {"north": -6.2080, "south": -6.2100, "east": 106.8480, "west": 106.8460}}',
    'Warehouse restricted access area', true, 'MEDIUM',
    '{"email": true, "push": false, "sms": true}', '{"zone": "warehouse", "access_level": "restricted"}',
    NOW(), NOW(), 'admin', 'admin'
),
(
    UUID(), 'Emergency Assembly Point', 'CIRCLE',
    '{"type": "Circle", "center": {"lat": -6.2094, "lng": 106.8471}, "radius": 50}',
    'Emergency evacuation assembly point', true, 'CRITICAL',
    '{"email": true, "push": true, "sms": true}', '{"zone": "emergency", "capacity": 200}',
    NOW(), NOW(), 'safety_officer', 'safety_officer'
);

INSERT IGNORE INTO geofence_breaches (
    id, geofence_id, team_member_id, breach_type, location, severity,
    is_resolved, resolved_at, resolved_by, notes, metadata, created_at, updated_at
) VALUES 
(
    UUID(), (SELECT id FROM geofences WHERE name = 'Office Building Perimeter' LIMIT 1),
    UUID(), 'ENTRY',
    '{"lat": -6.2090, "lng": 106.8461, "timestamp": "2024-01-15T08:30:00Z"}',
    'MEDIUM', true, NOW(), 'security_guard',
    'Authorized entry during business hours', '{"badge_scan": true, "authorized": true}',
    DATE_SUB(NOW(), INTERVAL 2 HOUR), NOW()
),
(
    UUID(), (SELECT id FROM geofences WHERE name = 'Warehouse Zone' LIMIT 1),
    UUID(), 'EXIT',
    '{"lat": -6.2095, "lng": 106.8465, "timestamp": "2024-01-15T14:15:00Z"}',
    'LOW', true, NOW(), 'supervisor',
    'Normal exit after shift completion', '{"shift_end": true, "authorized": true}',
     DATE_SUB(NOW(), INTERVAL 1 HOUR), NOW()
 );