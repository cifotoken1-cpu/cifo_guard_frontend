-- Migration: Create users table for authentication
-- Separate users table with foreign key to team_members
-- Supports password hashing, account status, and password reset

DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY COMMENT 'Unique user ID (e.g., admin_001)',
  team_member_id VARCHAR(50) UNIQUE NULL COMMENT 'Link to team_members table (nullable for non-field users)',
  username VARCHAR(100) UNIQUE NOT NULL COMMENT 'Username for login (must be unique)',
  email VARCHAR(255) UNIQUE NOT NULL COMMENT 'Email address (must be unique)',
  name VARCHAR(255) NOT NULL COMMENT 'Full name of user',
  password_hash VARCHAR(255) NOT NULL COMMENT 'Bcryptjs hashed password (salt rounds: 10)',
  role ENUM('SUPER_ADMIN','ADMIN','SUPERVISOR','GUARD','VIEWER') NOT NULL DEFAULT 'GUARD' COMMENT 'User role for RBAC',
  account_status ENUM('ACTIVE','INACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE' COMMENT 'Account status (LOCKED after failed attempts)',
  failed_login_attempts INT NOT NULL DEFAULT 0 COMMENT 'Count of failed login attempts (reset on success, locks at 5+)',
  last_login_at TIMESTAMP NULL COMMENT 'Last successful login timestamp',
  password_reset_token VARCHAR(255) NULL COMMENT 'One-time password reset token (crypto.randomBytes(32).toString(hex))',
  password_reset_expires TIMESTAMP NULL COMMENT 'Password reset token expiration (1 hour)',
  created_by VARCHAR(50) NULL COMMENT 'Admin user who created this user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Account creation timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last account update timestamp',
  INDEX idx_users_username (username),
  INDEX idx_users_email (email),
  INDEX idx_users_status (account_status),
  INDEX idx_users_reset_token (password_reset_token),
  INDEX idx_users_team_member_id (team_member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User accounts for authentication and authorization';

-- Insert seed SUPER_ADMIN user (username: admin, password: citranetbd9)
-- Hash: $2a$10$cPau1voD1/LZMgDR1Y8sOewOF8CDtv3IMFjNzxGAzXCHoDciednRi
INSERT INTO users (
  id,
  username,
  email,
  name,
  password_hash,
  role,
  account_status,
  created_at
) VALUES (
  'admin_001',
  'admin',
  'admin@cifo.com',
  'Administrator',
  '$2a$10$cPau1voD1/LZMgDR1Y8sOewOF8CDtv3IMFjNzxGAzXCHoDciednRi',
  'SUPER_ADMIN',
  'ACTIVE',
  CURRENT_TIMESTAMP
) ON DUPLICATE KEY UPDATE username = username;

-- Add sample ADMIN user (password: citranetbd9)
INSERT INTO users (
  id,
  username,
  email,
  name,
  password_hash,
  role,
  account_status,
  created_at
) VALUES (
  'admin_002',
  'supervisor_lead',
  'supervisor@cifo.com',
  'Supervisor Lead',
  '$2a$10$cPau1voD1/LZMgDR1Y8sOewOF8CDtv3IMFjNzxGAzXCHoDciednRi',
  'ADMIN',
  'ACTIVE',
  CURRENT_TIMESTAMP
) ON DUPLICATE KEY UPDATE username = username;
