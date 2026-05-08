-- Migration: Create Incident and IncidentUpdate tables
-- Created: 2024
-- Description: Tables for incident management and tracking

-- Create Incident table
CREATE TABLE IF NOT EXISTS incidents (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    incident_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('SECURITY', 'MEDICAL', 'FIRE', 'TECHNICAL', 'ENVIRONMENTAL', 'TRAFFIC', 'VANDALISM', 'THEFT', 'ASSAULT', 'SUSPICIOUS_ACTIVITY', 'MAINTENANCE', 'OTHER')),
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'CANCELLED', 'ESCALATED')),
    
    -- Location information
    location JSON NOT NULL, -- {lat, lng, address, zone, building, floor, room}
    coordinates_lat DECIMAL(10, 8), -- Latitude
    coordinates_lng DECIMAL(11, 8), -- Longitude
    address TEXT,
    zone VARCHAR(100),
    building VARCHAR(100),
    floor VARCHAR(50),
    room VARCHAR(50),
    
    -- Reporter information
    reported_by CHAR(36),
    reporter_name VARCHAR(255),
    reporter_contact VARCHAR(100),
    reporter_type VARCHAR(50) DEFAULT 'INTERNAL' CHECK (reporter_type IN ('INTERNAL', 'EXTERNAL', 'ANONYMOUS', 'SYSTEM')),
    
    -- Assignment information
    assigned_to CHAR(36),
    assigned_team VARCHAR(100),
    assigned_at TIMESTAMP,
    
    -- Timing information
    occurred_at TIMESTAMP NOT NULL,
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,
    due_date TIMESTAMP,
    
    -- Additional information
    tags JSON DEFAULT ('[]'),
    attachments JSON DEFAULT ('[]'), -- Array of file references
    evidence JSON DEFAULT ('[]'), -- Array of evidence items
    witnesses JSON DEFAULT ('[]'), -- Array of witness information
    related_incidents JSON DEFAULT ('[]'), -- Array of related incident IDs
    
    -- External references
    camera_ids JSON DEFAULT ('[]'), -- Array of related camera IDs
    geofence_id CHAR(36),
    alert_id CHAR(36), -- Reference to alerts if applicable
    
    -- Metadata
    metadata JSON DEFAULT ('{}'),
    custom_fields JSON DEFAULT ('{}'),
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- Soft delete
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(255),
    
    -- Foreign keys
    FOREIGN KEY (reported_by) REFERENCES team_members(id),
    FOREIGN KEY (assigned_to) REFERENCES team_members(id),
    FOREIGN KEY (geofence_id) REFERENCES geofences(id)
);

-- Create IncidentUpdate table for tracking incident history
CREATE TABLE IF NOT EXISTS incident_updates (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    incident_id CHAR(36) NOT NULL,
    
    update_type VARCHAR(50) NOT NULL CHECK (update_type IN ('STATUS_CHANGE', 'ASSIGNMENT', 'COMMENT', 'ATTACHMENT', 'ESCALATION', 'RESOLUTION', 'SYSTEM')),
    title VARCHAR(255),
    description TEXT,
    
    -- Change tracking
    old_values JSON DEFAULT ('{}'),
    new_values JSON DEFAULT ('{}'),
    changed_fields JSON DEFAULT ('[]'),
    
    -- Update metadata
    is_internal BOOLEAN DEFAULT false,
    is_system_generated BOOLEAN DEFAULT false,
    attachments JSON DEFAULT ('[]'),
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    
    -- Notification tracking
    notifications_sent JSON DEFAULT ('[]'),
    notification_status VARCHAR(20) DEFAULT 'PENDING' CHECK (notification_status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
    
    -- Foreign keys
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Create indexes for Incident table
CREATE UNIQUE INDEX idx_incidents_incident_number ON incidents(incident_number);
CREATE INDEX idx_incidents_type ON incidents(type);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_priority ON incidents(priority);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_reported_by ON incidents(reported_by);
CREATE INDEX idx_incidents_assigned_to ON incidents(assigned_to);
CREATE INDEX idx_incidents_assigned_team ON incidents(assigned_team);
CREATE INDEX idx_incidents_occurred_at ON incidents(occurred_at);
CREATE INDEX idx_incidents_reported_at ON incidents(reported_at);
CREATE INDEX idx_incidents_resolved_at ON incidents(resolved_at);
CREATE INDEX idx_incidents_due_date ON incidents(due_date);
CREATE INDEX idx_incidents_zone ON incidents(zone);
CREATE INDEX idx_incidents_building ON incidents(building);
CREATE INDEX idx_incidents_geofence_id ON incidents(geofence_id);
CREATE INDEX idx_incidents_alert_id ON incidents(alert_id);
CREATE INDEX idx_incidents_created_at ON incidents(created_at);
CREATE INDEX idx_incidents_deleted_at ON incidents(deleted_at);
CREATE INDEX idx_incidents_coordinates_lat ON incidents(coordinates_lat);
CREATE INDEX idx_incidents_coordinates_lng ON incidents(coordinates_lng);

-- MySQL doesn't support GIN indexes for JSON, but we can create functional indexes if needed
-- For now, we'll skip JSON column indexes as they're not critical for basic functionality

-- Create composite indexes for common queries
CREATE INDEX idx_incidents_status_priority ON incidents(status, priority);
CREATE INDEX idx_incidents_type_severity ON incidents(type, severity);
CREATE INDEX idx_incidents_assigned_status ON incidents(assigned_to, status);
CREATE INDEX idx_incidents_zone_status ON incidents(zone, status);
CREATE INDEX idx_incidents_occurred_status ON incidents(occurred_at, status);

-- Create indexes for IncidentUpdate table
CREATE INDEX idx_incident_updates_incident_id ON incident_updates(incident_id);
CREATE INDEX idx_incident_updates_update_type ON incident_updates(update_type);
CREATE INDEX idx_incident_updates_created_at ON incident_updates(created_at);
CREATE INDEX idx_incident_updates_created_by ON incident_updates(created_by);
CREATE INDEX idx_incident_updates_is_internal ON incident_updates(is_internal);
CREATE INDEX idx_incident_updates_notification_status ON incident_updates(notification_status);

-- Insert sample incident data
INSERT IGNORE INTO incidents (
    id, incident_number, title, description, type, severity, priority, status,
    location, coordinates_lat, coordinates_lng, address, zone, building,
    occurred_at, reported_at
) VALUES 
(
    'inc-001', '2024-000001', 'Security Breach at Main Gate', 
    'Unauthorized person attempted to enter through main gate',
    'SECURITY', 'HIGH', 'HIGH', 'OPEN',
    '{"lat": -6.2088, "lng": 106.8456, "address": "Main Gate", "zone": "Entrance"}',
    -6.2088, 106.8456, 'Main Gate', 'Entrance', 'Main Building',
    '2024-01-15 08:30:00', '2024-01-15 08:35:00'
),
(
    'inc-002', '2024-000002', 'Medical Emergency in Building A',
    'Employee collapsed in office area, ambulance called',
    'MEDICAL', 'CRITICAL', 'URGENT', 'IN_PROGRESS',
    '{"lat": -6.2090, "lng": 106.8458, "address": "Building A Floor 3", "zone": "Office Area"}',
    -6.2090, 106.8458, 'Building A Floor 3', 'Office Area', 'Building A',
    '2024-01-15 10:15:00', '2024-01-15 10:16:00'
);