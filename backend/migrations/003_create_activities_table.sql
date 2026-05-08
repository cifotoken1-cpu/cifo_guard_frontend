-- Security Activities Table
CREATE TABLE IF NOT EXISTS security_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    ref_id VARCHAR(100) NULL,
    actor VARCHAR(255) NOT NULL,
    note TEXT NOT NULL,
    severity ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') DEFAULT 'INFO',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON NULL,
    source VARCHAR(50) DEFAULT 'system',
    
    INDEX idx_type (type),
    INDEX idx_severity (severity),
    INDEX idx_timestamp (timestamp),
    INDEX idx_actor (actor),
    INDEX idx_ref_id (ref_id)
);

-- Insert Sample Activities
INSERT IGNORE INTO security_activities (type, ref_id, actor, note, severity, timestamp, source) VALUES
('ALERT_RECEIVED', 'alert_001', 'Security System', 'Panic button alert from Cluster A-12', 'CRITICAL', NOW() - INTERVAL 1 HOUR, 'panic_system'),
('PATROL_COMPLETED', 'patrol_001', 'Budi Santoso', 'Routine patrol completed - Cluster B', 'INFO', NOW() - INTERVAL 2 HOUR, 'patrol_app'),
('SYSTEM_CHECK', 'cam-1', 'Health Monitor', 'CCTV system health check completed', 'INFO', NOW() - INTERVAL 3 HOUR, 'health_monitor'),
('TEAM_STATUS_CHANGE', 'guard_002', 'Ahmad Wijaya', 'Team member status changed to PATROLLING', 'INFO', NOW() - INTERVAL 4 HOUR, 'admin_panel'),
('VISITOR_LOGGED', 'visitor_001', 'Candra Putra', 'Visitor registered at Main Gate', 'INFO', NOW() - INTERVAL 5 HOUR, 'gate_system'),
('CAMERA_OFFLINE', 'cam-8', 'Health Monitor', 'Camera Asia Afrika 02 went offline', 'WARNING', NOW() - INTERVAL 6 HOUR, 'health_monitor'),
('EMERGENCY_RESPONSE', 'emergency_001', 'Gita Permata', 'Emergency response team dispatched to Cluster C', 'CRITICAL', NOW() - INTERVAL 7 HOUR, 'emergency_system'),
('MAINTENANCE_SCHEDULED', 'maint_001', 'Ahmad Wijaya', 'Scheduled maintenance for CCTV system', 'INFO', NOW() - INTERVAL 8 HOUR, 'admin_panel'),
('SHIFT_CHANGE', 'shift_001', 'System', 'Night shift personnel taking over duties', 'INFO', NOW() - INTERVAL 9 HOUR, 'system'),
('SECURITY_BREACH', 'breach_001', 'Security System', 'Unauthorized access detected at perimeter', 'CRITICAL', NOW() - INTERVAL 10 HOUR, 'security_system'),
('PATROL_STARTED', 'patrol_002', 'Hendra Saputra', 'Starting patrol route in Cluster A', 'INFO', NOW() - INTERVAL 11 HOUR, 'patrol_app'),
('SYSTEM_BACKUP', 'backup_001', 'System', 'Daily system backup completed successfully', 'INFO', NOW() - INTERVAL 12 HOUR, 'system'),
('VISITOR_CHECKOUT', 'visitor_002', 'Candra Putra', 'Visitor checked out from Main Gate', 'INFO', NOW() - INTERVAL 13 HOUR, 'gate_system'),
('CAMERA_RESTORED', 'cam-10', 'Health Monitor', 'Camera Braga 02 connection restored', 'INFO', NOW() - INTERVAL 14 HOUR, 'health_monitor'),
('INCIDENT_REPORTED', 'incident_001', 'Dewi Sartika', 'Minor incident reported in parking area', 'WARNING', NOW() - INTERVAL 15 HOUR, 'incident_system');