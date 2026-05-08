-- Migration: Add VIGI AI enrichment columns to alerts and panic_alerts
-- Database: MySQL 5.7+ / 8.x / MariaDB 10.x
-- Run: mysql -u root -p cifo_security < backend/migrations/20260428_120000_add_ai_columns_to_alerts.sql

-- Helper procedure: add a column only if it doesn't exist yet (idempotent)
DROP PROCEDURE IF EXISTS _add_col;
DELIMITER //
CREATE PROCEDURE _add_col(
  IN tbl   VARCHAR(64),
  IN col   VARCHAR(64),
  IN def   TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = tbl
      AND COLUMN_NAME  = col
  ) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE _stmt FROM @s;
    EXECUTE _stmt;
    DEALLOCATE PREPARE _stmt;
  END IF;
END //
DELIMITER ;

-- =========== alerts: camera & event identity ===========
CALL _add_col('alerts', 'camera_id',       'VARCHAR(64)  AFTER source_id');
CALL _add_col('alerts', 'camera_location', 'VARCHAR(255) AFTER camera_id');
CALL _add_col('alerts', 'event_type',      'VARCHAR(64)  AFTER camera_location');
CALL _add_col('alerts', 'event_time',      'TIMESTAMP NULL AFTER event_type');

-- =========== alerts: AI analysis results ===========
CALL _add_col('alerts', 'ai_description',        'TEXT         AFTER event_time');
CALL _add_col('alerts', 'ai_person_count',        'INT          DEFAULT 0 AFTER ai_description');
CALL _add_col('alerts', 'ai_vehicle_count',       'INT          DEFAULT 0 AFTER ai_person_count');
CALL _add_col('alerts', 'ai_severity',            'VARCHAR(16)  AFTER ai_vehicle_count');
CALL _add_col('alerts', 'ai_severity_reason',     'TEXT         AFTER ai_severity');
CALL _add_col('alerts', 'ai_tags',                'JSON         AFTER ai_severity_reason');
CALL _add_col('alerts', 'ai_is_false_positive',   'TINYINT(1)   DEFAULT 0 AFTER ai_tags');
CALL _add_col('alerts', 'ai_recommended_action',  'VARCHAR(32)  AFTER ai_is_false_positive');
CALL _add_col('alerts', 'ai_snapshot_path',       'VARCHAR(255) AFTER ai_recommended_action');
CALL _add_col('alerts', 'ai_processed_at',        'TIMESTAMP NULL AFTER ai_snapshot_path');
CALL _add_col('alerts', 'ai_model',               'VARCHAR(64)  AFTER ai_processed_at');
CALL _add_col('alerts', 'ai_tokens_used',         'INT          DEFAULT 0 AFTER ai_model');
CALL _add_col('alerts', 'ai_latency_ms',          'INT          DEFAULT 0 AFTER ai_tokens_used');

-- =========== alerts: indexes (skip if exists) ===========
DROP PROCEDURE IF EXISTS _add_idx;
DELIMITER //
CREATE PROCEDURE _add_idx(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = tbl
      AND INDEX_NAME   = idx
  ) THEN
    SET @s = CONCAT('CREATE INDEX `', idx, '` ON `', tbl, '` ', def);
    PREPARE _stmt FROM @s;
    EXECUTE _stmt;
    DEALLOCATE PREPARE _stmt;
  END IF;
END //
DELIMITER ;

CALL _add_idx('alerts', 'idx_alerts_event_time',   '(event_time)');
CALL _add_idx('alerts', 'idx_alerts_camera_id',    '(camera_id)');
CALL _add_idx('alerts', 'idx_alerts_ai_severity',  '(ai_severity)');
CALL _add_idx('alerts', 'idx_alerts_ai_false_pos', '(ai_is_false_positive)');

-- =========== panic_alerts: create if not exists ===========
CREATE TABLE IF NOT EXISTS panic_alerts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source          VARCHAR(64),
  source_alert_id CHAR(36),
  camera_id       VARCHAR(64),
  message         TEXT,
  severity        VARCHAR(16),
  reason          TEXT,
  triggered_at    TIMESTAMP NULL,
  status          VARCHAR(16) DEFAULT 'open',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add columns in case panic_alerts already existed without them
CALL _add_col('panic_alerts', 'source',           'VARCHAR(64)');
CALL _add_col('panic_alerts', 'source_alert_id',  'CHAR(36)');
CALL _add_col('panic_alerts', 'camera_id',        'VARCHAR(64)');
CALL _add_col('panic_alerts', 'message',          'TEXT');
CALL _add_col('panic_alerts', 'severity',         'VARCHAR(16)');
CALL _add_col('panic_alerts', 'reason',           'TEXT');
CALL _add_col('panic_alerts', 'triggered_at',     'TIMESTAMP NULL');
CALL _add_col('panic_alerts', 'status',           "VARCHAR(16) DEFAULT 'open'");

CALL _add_idx('panic_alerts', 'idx_panic_source_alert', '(source_alert_id)');
CALL _add_idx('panic_alerts', 'idx_panic_status',       '(status)');

-- Cleanup helper procedures
DROP PROCEDURE IF EXISTS _add_col;
DROP PROCEDURE IF EXISTS _add_idx;
