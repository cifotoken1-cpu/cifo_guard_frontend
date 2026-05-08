-- Sensors Table (door, motion, glass)
-- Resolves issue #8 — frontend tidak lagi derive sensor dari activities/recent
CREATE TABLE IF NOT EXISTS sensors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('door', 'motion', 'glass') NOT NULL,
    location VARCHAR(255) NULL,
    status ENUM('clear', 'open', 'alert', 'offline') DEFAULT 'clear',
    last_event_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_last_event (last_event_at)
);

-- Initial Sensor Data (sebelumnya hardcoded di src/features/dashboard/CenterPanel.jsx)
INSERT IGNORE INTO sensors (id, name, type, location, status, last_event_at) VALUES
('sen-1', 'Living Room Door', 'door', 'Ground Floor', 'open', DATE_SUB(NOW(), INTERVAL 23 HOUR)),
('sen-2', 'Guest Bedroom Door', 'door', 'First Floor', 'open', DATE_SUB(NOW(), INTERVAL 12 HOUR)),
('sen-3', 'TV Cabinet PIR', 'motion', 'Living Room', 'clear', DATE_SUB(NOW(), INTERVAL 7 MINUTE)),
('sen-4', 'First Hallway Motion', 'motion', 'Ground Floor', 'clear', DATE_SUB(NOW(), INTERVAL 7 MINUTE)),
('sen-5', 'Front Door Sensor', 'door', 'Exterior', 'clear', DATE_SUB(NOW(), INTERVAL 2 DAY)),
('sen-6', 'Garage Motion', 'motion', 'Exterior', 'alert', DATE_SUB(NOW(), INTERVAL 1 HOUR));
