-- CCTV Cameras Table
CREATE TABLE IF NOT EXISTS cameras (
    id VARCHAR(50) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    area VARCHAR(100) NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    stream_url VARCHAR(500) NOT NULL,
    status ENUM('online', 'offline', 'degraded', 'error') DEFAULT 'offline',
    last_heartbeat TIMESTAMP NULL,
    response_time INT DEFAULT 0,
    health_score INT DEFAULT 0,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_area (area),
    INDEX idx_last_heartbeat (last_heartbeat)
);

-- Camera Health Log Table
CREATE TABLE IF NOT EXISTS camera_health_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    camera_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time INT NOT NULL,
    health_score INT NOT NULL,
    error_message TEXT NULL,
    stream_accessible BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE,
    INDEX idx_camera_timestamp (camera_id, timestamp),
    INDEX idx_timestamp (timestamp)
);

-- Insert Initial CCTV Data
INSERT IGNORE INTO cameras (id, label, area, lat, lng, stream_url, status) VALUES
('cam-1', 'CCTV Aceh - Wastukencana', 'Bandung', -6.9103254, 107.6089499, '/video/HIKSVISION/acehwastukencana.m3u8', 'online'),
('cam-2', 'CCTV Alun Alun 01 Banceuy', 'Bandung', -6.920917, 107.606446, '/video/DAHUA/DepanTo.m3u8', 'online'),
('cam-3', 'CCTV Alun Alun 02 Asia Afrika', 'Bandung', -6.920949, 107.606511, '/video/DAHUA/DepanTop.m3u8', 'online'),
('cam-4', 'CCTV Alun-Alun 03', 'Bandung', -6.9231843, 107.6074217, '/video/DAHUA/ALUN.m3u8', 'online'),
('cam-5', 'CCTV Antapani Depan Borma 01', 'Bandung', -6.912725, 107.649657, '/video/HIKSVISION/Ant.m3u8', 'online'),
('cam-6', 'CCTV Antapani Depan Borma 02', 'Bandung', -6.912800, 107.649700, '/video/HIKSVISION/Ant2.m3u8', 'online'),
('cam-7', 'CCTV Asia Afrika 01', 'Bandung', -6.921500, 107.607000, '/video/DAHUA/AsiaAfrika1.m3u8', 'online'),
('cam-8', 'CCTV Asia Afrika 02', 'Bandung', -6.921600, 107.607100, '/video/DAHUA/AsiaAfrika2.m3u8', 'offline'),
('cam-9', 'CCTV Braga 01', 'Bandung', -6.917000, 107.609000, '/video/HIKSVISION/Braga1.m3u8', 'online'),
('cam-10', 'CCTV Braga 02', 'Bandung', -6.917100, 107.609100, '/video/HIKSVISION/Braga2.m3u8', 'degraded');