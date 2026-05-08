-- Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    id VARCHAR(50) PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    status ENUM('ON_DUTY', 'OFF_DUTY', 'PATROLLING', 'BREAK') DEFAULT 'OFF_DUTY',
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NULL,
    current_location VARCHAR(255) NULL,
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shift_start TIME NULL,
    shift_end TIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_role (role),
    INDEX idx_last_update (last_update)
);

-- Team Location History
CREATE TABLE IF NOT EXISTS team_location_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL,
    lat DECIMAL(10,8) NULL,
    lng DECIMAL(11,8) NULL,
    activity_type VARCHAR(50) NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE,
    INDEX idx_member_timestamp (member_id, timestamp),
    INDEX idx_timestamp (timestamp)
);

-- Insert Initial Team Data
INSERT IGNORE INTO team_members (id, nama, role, status, phone, current_location, shift_start, shift_end) VALUES
('guard_001', 'Ahmad Wijaya', 'Security Supervisor', 'ON_DUTY', '+62812345001', 'Security Post', '08:00:00', '20:00:00'),
('guard_002', 'Budi Santoso', 'Patrol Guard', 'PATROLLING', '+62812345002', 'Cluster B Area', '06:00:00', '18:00:00'),
('guard_003', 'Candra Putra', 'Gate Guard', 'ON_DUTY', '+62812345003', 'Main Gate', '00:00:00', '12:00:00'),
('guard_004', 'Dewi Sartika', 'CCTV Operator', 'ON_DUTY', '+62812345004', 'Control Room', '12:00:00', '00:00:00'),
('guard_005', 'Eko Prasetyo', 'Patrol Guard', 'BREAK', '+62812345005', 'Rest Area', '18:00:00', '06:00:00'),
('guard_006', 'Fajar Nugroho', 'Security Guard', 'OFF_DUTY', '+62812345006', 'Off Site', '20:00:00', '08:00:00'),
('guard_007', 'Gita Permata', 'Emergency Response', 'ON_DUTY', '+62812345007', 'Emergency Station', '08:00:00', '20:00:00'),
('guard_008', 'Hendra Saputra', 'Patrol Guard', 'PATROLLING', '+62812345008', 'Cluster A Area', '06:00:00', '18:00:00');