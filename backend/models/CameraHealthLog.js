const mysql = require('mysql2/promise');
require('dotenv').config();

class CameraHealthLog {
  static async getConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cifo_security',
      charset: 'utf8mb4'
    });
  }

  static async create(logData) {
    const connection = await this.getConnection();
    try {
      const {
        camera_id,
        status,
        response_time,
        health_score,
        error_message,
        stream_accessible
      } = logData;

      const [result] = await connection.execute(
        `INSERT INTO camera_health_log 
         (camera_id, status, response_time, health_score, error_message, stream_accessible) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [camera_id, status, response_time, health_score, error_message, stream_accessible]
      );

      return {
        id: result.insertId,
        ...logData,
        timestamp: new Date()
      };
    } finally {
      await connection.end();
    }
  }

  static async getLatestHealth(cameraId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM camera_health_log 
         WHERE camera_id = ? 
         ORDER BY timestamp DESC 
         LIMIT 1`,
        [cameraId]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  static async getHealthHistory(cameraId, limit = 50) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM camera_health_log 
         WHERE camera_id = ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [cameraId, limit]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getHealthTrend(cameraId, hours = 24) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
           DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
           AVG(health_score) as avg_health_score,
           AVG(response_time) as avg_response_time,
           COUNT(*) as check_count,
           SUM(CASE WHEN stream_accessible = 1 THEN 1 ELSE 0 END) as accessible_count
         FROM camera_health_log 
         WHERE camera_id = ? AND timestamp >= NOW() - INTERVAL ? HOUR
         GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')
         ORDER BY hour DESC`,
        [cameraId, hours]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getSystemHealthOverview(hours = 24) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
           c.id,
           c.label,
           c.area,
           c.status as current_status,
           AVG(chl.health_score) as avg_health_score,
           AVG(chl.response_time) as avg_response_time,
           COUNT(chl.id) as total_checks,
           SUM(CASE WHEN chl.stream_accessible = 1 THEN 1 ELSE 0 END) as successful_checks,
           MAX(chl.timestamp) as last_check
         FROM cameras c
         LEFT JOIN camera_health_log chl ON c.id = chl.camera_id 
           AND chl.timestamp >= NOW() - INTERVAL ? HOUR
         GROUP BY c.id, c.label, c.area, c.status
         ORDER BY c.label`,
        [hours]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getFailureAnalysis(cameraId, days = 7) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
           DATE(timestamp) as date,
           COUNT(*) as total_checks,
           SUM(CASE WHEN status IN ('offline', 'error') THEN 1 ELSE 0 END) as failure_count,
           SUM(CASE WHEN stream_accessible = 0 THEN 1 ELSE 0 END) as stream_failures,
           AVG(response_time) as avg_response_time,
           MIN(health_score) as min_health_score,
           MAX(health_score) as max_health_score
         FROM camera_health_log 
         WHERE camera_id = ? AND timestamp >= NOW() - INTERVAL ? DAY
         GROUP BY DATE(timestamp)
         ORDER BY date DESC`,
        [cameraId, days]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async cleanupOldLogs(daysToKeep = 30) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        'DELETE FROM camera_health_log WHERE timestamp < NOW() - INTERVAL ? DAY',
        [daysToKeep]
      );
      return result.affectedRows;
    } finally {
      await connection.end();
    }
  }

  static async getAlertLogs(severity = 'error', limit = 100) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT chl.*, c.label, c.area
         FROM camera_health_log chl
         JOIN cameras c ON chl.camera_id = c.id
         WHERE chl.status = ? OR chl.stream_accessible = 0
         ORDER BY chl.timestamp DESC
         LIMIT ?`,
        [severity, limit]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  // Fallback method using Sequelize connection for better reliability
  static async createViaSequelize(logData) {
    const sequelize = require('../config/database');
    try {
      const {
        camera_id,
        status,
        response_time,
        health_score,
        error_message,
        stream_accessible
      } = logData;

      const [result] = await sequelize.query(
        `INSERT INTO camera_health_log 
         (camera_id, status, response_time, health_score, error_message, stream_accessible) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        {
          replacements: [camera_id, status, response_time, health_score, error_message, stream_accessible],
          type: sequelize.QueryTypes.INSERT
        }
      );

      return {
        id: result,
        camera_id,
        status,
        response_time,
        health_score,
        error_message,
        stream_accessible,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error in CameraHealthLog.createViaSequelize:', error);
      // Return a fallback result so the health check can continue
      return {
        id: null,
        camera_id,
        status,
        response_time,
        health_score,
        error_message,
        stream_accessible,
        timestamp: new Date()
      };
    }
  }
}

// Override the original create method to use Sequelize fallback
const originalCreate = CameraHealthLog.create;

CameraHealthLog.create = async function(logData) {
  try {
    return await originalCreate.call(this, logData);
  } catch (error) {
    console.log('CameraHealthLog.create failed, using Sequelize fallback');
    return await CameraHealthLog.createViaSequelize(logData);
  }
};

module.exports = CameraHealthLog;