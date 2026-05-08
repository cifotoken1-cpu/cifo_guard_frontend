-- Perumahan Info Table
CREATE TABLE IF NOT EXISTS perumahan_info (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    total_units INT NOT NULL,
    clusters JSON NOT NULL,
    address TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Perumahan Facilities Table
CREATE TABLE IF NOT EXISTS perumahan_facilities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT NULL,
    location VARCHAR(255) NOT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    operating_hours JSON NULL,
    contact_info JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_location (lat, lng)
);

-- Insert Perumahan Data
INSERT IGNORE INTO perumahan_info (name, total_units, clusters, address) VALUES
('Green Valley Regency', 250, '["A", "B", "C", "D"]', 'Jl. Green Valley No. 123, Bandung, Jawa Barat 40123');

INSERT IGNORE INTO perumahan_facilities (name, type, description, location, lat, lng, status, operating_hours, contact_info) VALUES
('Main Gate', 'entrance', 'Main entrance with security post and visitor registration', 'Main Gate', -6.2088, 106.8456, 'active', '{"open": "00:00", "close": "23:59", "24h": true}', '{"phone": "+62812345003", "guard": "Candra Putra"}'),
('Swimming Pool', 'recreation', 'Community swimming pool with lifeguard on duty', 'Pool Area', -6.2090, 106.8460, 'active', '{"open": "06:00", "close": "22:00", "24h": false}', '{"phone": "+62812345010", "lifeguard": "Available 08:00-20:00"}'),
('Clubhouse', 'community', 'Community center and meeting hall for residents', 'Community Center', -6.2085, 106.8465, 'active', '{"open": "08:00", "close": "22:00", "24h": false}', '{"phone": "+62812345011", "manager": "Sari Indah"}'),
('Playground', 'recreation', 'Children playground area with safety equipment', 'Play Area', -6.2092, 106.8470, 'active', '{"open": "06:00", "close": "20:00", "24h": false}', '{"maintenance": "Daily cleaning at 07:00"}'),
('Security Post', 'security', 'Main security monitoring post with CCTV control room', 'Security Area', -6.2088, 106.8456, 'active', '{"open": "00:00", "close": "23:59", "24h": true}', '{"phone": "+62812345001", "supervisor": "Ahmad Wijaya"}');

INSERT INTO perumahan_facilities (name, type, description, location, lat, lng, status, operating_hours, contact_info) VALUES
('Medical Clinic', 'healthcare', '24-hour medical clinic with emergency services', 'Clinic Building', -6.2087, 106.8462, 'active', '{"open": "00:00", "close": "23:59", "24h": true}', '{"phone": "+62812345012", "emergency": "+62812345999"}');

INSERT INTO perumahan_facilities (name, type, description, location, lat, lng, status, operating_hours, contact_info) VALUES
('Parking Area A', 'parking', 'Main parking area for Cluster A residents', 'Cluster A Parking', -6.2089, 106.8458, 'active', '{"open": "00:00", "close": "23:59", "24h": true}', '{"capacity": 50, "security_camera": true}');

INSERT INTO perumahan_facilities (name, type, description, location, lat, lng, status, operating_hours, contact_info) VALUES
('Parking Area B', 'parking', 'Main parking area for Cluster B residents', 'Cluster B Parking', -6.2091, 106.8463, 'active', '{"open": "00:00", "close": "23:59", "24h": true}', '{"capacity": 60, "security_camera": true}');

INSERT INTO perumahan_facilities (name, type, description, location, lat, lng, status, operating_hours, contact_info) VALUES
('Jogging Track', 'recreation', 'Outdoor jogging track around the complex', 'Perimeter Track', -6.2090, 106.8461, 'active', '{"open": "05:00", "close": "21:00", "24h": false}', '{"length": "1.2km", "lighting": "Available until 21:00"}');

INSERT INTO perumahan_facilities (name, type, description, location, lat, lng, status, operating_hours, contact_info) VALUES
('Waste Management', 'utility', 'Centralized waste collection and management facility', 'Utility Area', -6.2093, 106.8467, 'active', '{"collection": "06:00, 18:00", "24h": false}', '{"phone": "+62812345013", "schedule": "Daily collection"}')