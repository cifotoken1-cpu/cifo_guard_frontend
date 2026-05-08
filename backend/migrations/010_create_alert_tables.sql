-- Migration: Create Alert and AlertRecipient tables
-- Created: 2024
-- Description: Tables for alert management and notification system

-- Create Alert table
CREATE TABLE IF NOT EXISTS alerts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    alert_id VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Alert classification
    type VARCHAR(50) NOT NULL CHECK (type IN ('SECURITY', 'EMERGENCY', 'MAINTENANCE', 'WEATHER', 'TRAFFIC', 'SYSTEM', 'CUSTOM')),
    category VARCHAR(100),
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    
    -- Alert status and lifecycle
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'EXPIRED', 'CANCELLED')),
    is_emergency BOOLEAN DEFAULT false,
    is_broadcast BOOLEAN DEFAULT false,
    is_recurring BOOLEAN DEFAULT false,
    
    -- Location and targeting
    location JSON, -- {lat, lng, address, zone, building, floor, room}
    coordinates_lat DECIMAL(10,8), -- Latitude for spatial queries
    coordinates_lng DECIMAL(11,8), -- Longitude for spatial queries
    target_zones JSON DEFAULT ('[]'), -- Array of zone identifiers
    target_buildings JSON DEFAULT ('[]'), -- Array of building identifiers
    target_roles JSON DEFAULT ('[]'), -- Array of role identifiers
    target_teams JSON DEFAULT ('[]'), -- Array of team identifiers
    target_users JSON DEFAULT ('[]'), -- Array of user identifiers
    geofence_ids JSON DEFAULT ('[]'), -- Array of geofence IDs for location-based alerts
    
    -- Timing and scheduling
    scheduled_at TIMESTAMP,
    starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP,
    expires_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    
    -- Recurrence settings (for recurring alerts)
    recurrence_pattern JSON, -- {type: 'daily'|'weekly'|'monthly', interval: 1, days: [], time: 'HH:MM'}
    next_occurrence TIMESTAMP,
    
    -- Content and media
    content JSON DEFAULT ('{}'), -- Rich content, HTML, markdown, etc.
    attachments JSON DEFAULT ('[]'), -- Array of file references
    media_urls JSON DEFAULT ('[]'), -- Array of media URLs
    action_buttons JSON DEFAULT ('[]'), -- Array of action button configs
    
    -- Delivery channels
    channels JSON DEFAULT ('["app"]'), -- ['app', 'email', 'sms', 'push', 'webhook']
    delivery_config JSON DEFAULT ('{}'), -- Channel-specific delivery configuration
    
    -- Source and context
    source VARCHAR(100) DEFAULT 'manual', -- 'manual', 'system', 'camera', 'sensor', 'integration'
    source_id VARCHAR(255), -- ID from source system
    context JSON DEFAULT ('{}'), -- Additional context data
    
    -- Related entities
    incident_id CHAR(36),
    camera_ids JSON DEFAULT ('[]'), -- Array of related camera IDs
    related_alerts JSON DEFAULT ('[]'), -- Array of related alert IDs
    
    -- Delivery tracking
    total_recipients INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    acknowledged_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Metadata and customization
    tags JSON DEFAULT ('[]'),
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
    
    -- Foreign Keys
    FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

-- Create AlertRecipient table for tracking alert delivery
CREATE TABLE IF NOT EXISTS alert_recipients (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    alert_id CHAR(36) NOT NULL,
    
    -- Recipient information
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('USER', 'TEAM', 'ROLE', 'EXTERNAL')),
    recipient_id VARCHAR(255), -- User ID, team ID, role name, or external identifier
    recipient_name VARCHAR(255),
    recipient_contact JSON, -- {email, phone, push_token, etc.}
    
    -- Delivery tracking per channel
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('app', 'email', 'sms', 'push', 'webhook')),
    delivery_status VARCHAR(20) DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'ACKNOWLEDGED', 'IGNORED')),
    
    -- Timing
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    failed_at TIMESTAMP,
    
    -- Delivery details
    delivery_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    failure_reason TEXT,
    delivery_metadata JSON DEFAULT ('{}'), -- Provider-specific delivery data
    
    -- Response tracking
    response_data JSON, -- User response, feedback, or interaction data
    response_time INTEGER, -- Time taken to acknowledge/respond in seconds
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);

-- Create indexes for Alert table
CREATE UNIQUE INDEX idx_alerts_alert_id ON alerts(alert_id);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_category ON alerts(category);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_priority ON alerts(priority);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_is_emergency ON alerts(is_emergency);
CREATE INDEX idx_alerts_is_broadcast ON alerts(is_broadcast);
CREATE INDEX idx_alerts_is_recurring ON alerts(is_recurring);
CREATE INDEX idx_alerts_scheduled_at ON alerts(scheduled_at);
CREATE INDEX idx_alerts_starts_at ON alerts(starts_at);
CREATE INDEX idx_alerts_ends_at ON alerts(ends_at);
CREATE INDEX idx_alerts_expires_at ON alerts(expires_at);
CREATE INDEX idx_alerts_next_occurrence ON alerts(next_occurrence);
CREATE INDEX idx_alerts_source ON alerts(source);
CREATE INDEX idx_alerts_source_id ON alerts(source_id);
CREATE INDEX idx_alerts_incident_id ON alerts(incident_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_created_by ON alerts(created_by);
CREATE INDEX idx_alerts_deleted_at ON alerts(deleted_at);

-- Create spatial index for coordinates
CREATE INDEX idx_alerts_coordinates_lat ON alerts(coordinates_lat);
CREATE INDEX idx_alerts_coordinates_lng ON alerts(coordinates_lng);

-- MySQL doesn't support GIN indexes for JSON, but we can create functional indexes if needed
-- CREATE INDEX idx_alerts_location ON alerts((CAST(location AS CHAR(255))));
-- CREATE INDEX idx_alerts_target_zones ON alerts((CAST(target_zones AS CHAR(255))));
-- CREATE INDEX idx_alerts_target_buildings ON alerts((CAST(target_buildings AS CHAR(255))));
-- CREATE INDEX idx_alerts_target_roles ON alerts((CAST(target_roles AS CHAR(255))));
-- CREATE INDEX idx_alerts_target_teams ON alerts((CAST(target_teams AS CHAR(255))));
-- CREATE INDEX idx_alerts_target_users ON alerts((CAST(target_users AS CHAR(255))));
-- CREATE INDEX idx_alerts_geofence_ids ON alerts((CAST(geofence_ids AS CHAR(255))));
-- CREATE INDEX idx_alerts_channels ON alerts((CAST(channels AS CHAR(255))));
-- CREATE INDEX idx_alerts_camera_ids ON alerts((CAST(camera_ids AS CHAR(255))));
-- CREATE INDEX idx_alerts_related_alerts ON alerts((CAST(related_alerts AS CHAR(255))));
-- CREATE INDEX idx_alerts_tags ON alerts((CAST(tags AS CHAR(255))));
-- CREATE INDEX idx_alerts_metadata ON alerts((CAST(metadata AS CHAR(255))));
-- CREATE INDEX idx_alerts_custom_fields ON alerts((CAST(custom_fields AS CHAR(255))));
-- CREATE INDEX idx_alerts_recurrence_pattern ON alerts((CAST(recurrence_pattern AS CHAR(255))));
-- CREATE INDEX idx_alerts_delivery_config ON alerts((CAST(delivery_config AS CHAR(255))));
-- CREATE INDEX idx_alerts_context ON alerts((CAST(context AS CHAR(255))));}]}}}

-- Create composite indexes for common queries
CREATE INDEX idx_alerts_status_priority ON alerts(status, priority);
CREATE INDEX idx_alerts_type_severity ON alerts(type, severity);
-- MySQL doesn't support partial indexes with WHERE clause like PostgreSQL
-- CREATE INDEX idx_alerts_active_emergency ON alerts(status, is_emergency) WHERE status = 'ACTIVE';
-- CREATE INDEX idx_alerts_active_broadcast ON alerts(status, is_broadcast) WHERE status = 'ACTIVE';
-- CREATE INDEX idx_alerts_scheduled_pending ON alerts(scheduled_at, status) WHERE status = 'DRAFT';
-- CREATE INDEX idx_alerts_recurring_next ON alerts(is_recurring, next_occurrence) WHERE is_recurring = true;
-- CREATE INDEX idx_alerts_expires_active ON alerts(expires_at, status) WHERE expires_at IS NOT NULL;

-- Create indexes for AlertRecipient table
CREATE INDEX idx_alert_recipients_alert_id ON alert_recipients(alert_id);
CREATE INDEX idx_alert_recipients_recipient_type ON alert_recipients(recipient_type);
CREATE INDEX idx_alert_recipients_recipient_id ON alert_recipients(recipient_id);
CREATE INDEX idx_alert_recipients_channel ON alert_recipients(channel);
CREATE INDEX idx_alert_recipients_delivery_status ON alert_recipients(delivery_status);
CREATE INDEX idx_alert_recipients_sent_at ON alert_recipients(sent_at);
CREATE INDEX idx_alert_recipients_delivered_at ON alert_recipients(delivered_at);
CREATE INDEX idx_alert_recipients_acknowledged_at ON alert_recipients(acknowledged_at);
CREATE INDEX idx_alert_recipients_failed_at ON alert_recipients(failed_at);
CREATE INDEX idx_alert_recipients_created_at ON alert_recipients(created_at);

-- MySQL doesn't support GIN indexes for JSON
-- CREATE INDEX idx_alert_recipients_recipient_contact ON alert_recipients((CAST(recipient_contact AS CHAR(255))));
-- CREATE INDEX idx_alert_recipients_delivery_metadata ON alert_recipients((CAST(delivery_metadata AS CHAR(255))));
-- CREATE INDEX idx_alert_recipients_response_data ON alert_recipients((CAST(response_data AS CHAR(255))));}]}}}

-- Create composite indexes for AlertRecipient
CREATE INDEX idx_alert_recipients_alert_status ON alert_recipients(alert_id, delivery_status);
CREATE INDEX idx_alert_recipients_recipient_status ON alert_recipients(recipient_id, delivery_status);
CREATE INDEX idx_alert_recipients_channel_status ON alert_recipients(channel, delivery_status);
-- MySQL doesn't support partial indexes with WHERE clause
-- CREATE INDEX idx_alert_recipients_pending ON alert_recipients(delivery_status, created_at) WHERE delivery_status = 'PENDING';
-- CREATE INDEX idx_alert_recipients_failed ON alert_recipients(delivery_status, failed_at) WHERE delivery_status = 'FAILED';

-- MySQL doesn't support PostgreSQL-style triggers and functions
-- Triggers for updated_at are handled by ON UPDATE CURRENT_TIMESTAMP in column definitions
-- CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_alert_recipients_updated_at BEFORE UPDATE ON alert_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MySQL doesn't support PostgreSQL-style functions, triggers, views, and comments
-- The following PostgreSQL features are not supported in MySQL:
-- 1. PL/pgSQL functions and stored procedures with complex logic
-- 2. Triggers with EXECUTE FUNCTION syntax
-- 3. Complex views with FILTER clauses
-- 4. COMMENT ON statements
-- 5. Advanced JSON operators like ? and ->>
-- 6. INTERVAL arithmetic
-- 7. PostGIS POINT data type

-- For MySQL implementation, you would need to:
-- 1. Use MySQL stored procedures instead of PostgreSQL functions
-- 2. Use MySQL trigger syntax
-- 3. Implement coordinate updates in application logic
-- 4. Use separate tables for delivery statistics instead of complex views
-- 5. Handle alert ID generation in application code or use AUTO_INCREMENT

-- Sample alert data
INSERT IGNORE INTO alerts (
    id, alert_id, title, message, type, severity, status,
    coordinates_lat, coordinates_lng, location, channels,
    created_by, incident_id, is_recurring, starts_at
) VALUES 
(
    UUID(), 'ALERT-001', 'Test Alert', 'This is a test alert message',
    'EMERGENCY', 'HIGH', 'ACTIVE',
    -6.2088, 106.8456, '{"lat": -6.2088, "lng": 106.8456, "address": "Jakarta"}',
    '["app", "email", "sms"]',
    UUID(), NULL, FALSE, NOW()
);

INSERT IGNORE INTO alert_recipients (
    id, alert_id, recipient_id, recipient_type, channel,
    delivery_status, sent_at
) VALUES 
(
    UUID(), (SELECT id FROM alerts WHERE alert_id = 'ALERT-001' LIMIT 1),
    UUID(), 'USER', 'app', 'SENT', NOW()
);