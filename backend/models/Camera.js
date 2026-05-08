const mysql = require('mysql2/promise');
require('dotenv').config();

class Camera {
  static async getConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cifo_security',
      charset: 'utf8mb4'
    });
  }

  static async getCount(filters = {}) {
    const connection = await this.getConnection();
    try {
      let query = 'SELECT COUNT(*) as count FROM cameras';
      const params = [];
      const conditions = [];
      if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }
      if (filters.area)   { conditions.push('area = ?');   params.push(filters.area);   }
      if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
      const [rows] = await connection.execute(query, params);
      return rows[0].count;
    } finally {
      await connection.end();
    }
  }

  static async getAll(filters = {}) {
    const connection = await this.getConnection();
    try {
      let query = 'SELECT * FROM cameras';
      const params = [];
      const conditions = [];

      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }

      if (filters.area) {
        conditions.push('area = ?');
        params.push(filters.area);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await connection.execute(query, params);
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getById(id) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM cameras WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  static async create(cameraData) {
    const connection = await this.getConnection();
    try {
      const {
        id,
        label,
        area,
        lat,
        lng,
        stream_url,
        status = 'offline'
      } = cameraData;

      const [result] = await connection.execute(
        `INSERT INTO cameras (id, label, area, lat, lng, stream_url, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, label, area, lat, lng, stream_url, status]
      );

      return await this.getById(id);
    } finally {
      await connection.end();
    }
  }

  static async updateStatus(id, statusData) {
    const connection = await this.getConnection();
    try {
      const {
        status,
        last_heartbeat,
        response_time,
        health_score,
        error_message
      } = statusData;

      const [result] = await connection.execute(
        `UPDATE cameras 
         SET status = ?, last_heartbeat = ?, response_time = ?, 
             health_score = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, last_heartbeat, response_time, health_score, error_message, id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async update(id, cameraData) {
    const connection = await this.getConnection();
    try {
      const {
        label,
        area,
        lat,
        lng,
        stream_url
      } = cameraData;

      const [result] = await connection.execute(
        `UPDATE cameras 
         SET label = ?, area = ?, lat = ?, lng = ?, stream_url = ?, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [label, area, lat, lng, stream_url, id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async delete(id) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        'DELETE FROM cameras WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async getDashboardStats() {
    const connection = await this.getConnection();
    try {
      const [stats] = await connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
          SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
          SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
          AVG(CASE WHEN health_score > 0 THEN health_score ELSE NULL END) as avgHealthScore,
          AVG(CASE WHEN response_time > 0 THEN response_time ELSE NULL END) as avgResponseTime
        FROM cameras
      `);
      
      return stats[0];
    } finally {
      await connection.end();
    }
  }

  static async getByArea(area) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM cameras WHERE area = ? ORDER BY label',
        [area]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getOnlineCameras() {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM cameras WHERE status = 'online' ORDER BY label"
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getOfflineCameras() {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM cameras WHERE status IN ('offline', 'error') ORDER BY last_heartbeat DESC"
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async updateHeartbeat(id) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        'UPDATE cameras SET last_heartbeat = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async getStats() {
    const connection = await this.getConnection();
    try {
      const [stats] = await connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'ONLINE' THEN 1 ELSE 0 END) as online,
          SUM(CASE WHEN status = 'OFFLINE' THEN 1 ELSE 0 END) as offline,
          SUM(CASE WHEN status = 'MAINTENANCE' THEN 1 ELSE 0 END) as maintenance,
          SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as error,
          AVG(CASE WHEN health_score > 0 THEN health_score ELSE NULL END) as avg_health_score,
          AVG(CASE WHEN response_time > 0 THEN response_time ELSE NULL END) as avg_response_time
        FROM cameras
      `);
      
      return stats[0] || {
        total: 0,
        online: 0,
        offline: 0,
        maintenance: 0,
        error: 0,
        avg_health_score: 0,
        avg_response_time: 0
      };
    } finally {
      await connection.end();
    }
  }

  // Fallback method using Sequelize connection for better reliability
  static async getStatsViaSequelize() {
    const sequelize = require('../config/database');
    try {
      const [stats] = await sequelize.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
          SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
          SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
          AVG(CASE WHEN health_score > 0 THEN health_score ELSE NULL END) as avg_health_score,
          AVG(CASE WHEN response_time > 0 THEN response_time ELSE NULL END) as avg_response_time
        FROM cameras
      `);
      return stats[0] || {
        total: 0,
        online: 0,
        offline: 0,
        degraded: 0,
        error: 0,
        avg_health_score: 0,
        avg_response_time: 0
      };
    } catch (error) {
      console.error('Error in Camera.getStatsViaSequelize:', error);
      return {
        total: 0,
        online: 0,
        offline: 0,
        degraded: 0,
        error: 0,
        avg_health_score: 0,
        avg_response_time: 0
      };
    }
  }

  static async getAllViaSequelize(filters = {}) {
    const sequelize = require('../config/database');
    try {
      let query = 'SELECT * FROM cameras';
      const replacements = [];
      const conditions = [];

      if (filters.status) {
        conditions.push('status = ?');
        replacements.push(filters.status);
      }

      if (filters.area) {
        conditions.push('area = ?');
        replacements.push(filters.area);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY id';

      const results = await sequelize.query(query, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });
      
      return results;
    } catch (error) {
      console.error('Error in Camera.getAllViaSequelize:', error);
      return [];
    }
  }
}

// Override the original methods to use Sequelize fallbacks
const originalGetStats = Camera.getStats;
const originalGetAll = Camera.getAll;

Camera.getStats = async function() {
  try {
    return await originalGetStats.call(this);
  } catch (error) {
    console.log('Camera.getStats failed, using Sequelize fallback');
    return await Camera.getStatsViaSequelize();
  }
};

Camera.getAll = async function(filters = {}) {
  try {
    return await originalGetAll.call(this, filters);
  } catch (error) {
    console.log('Camera.getAll failed, using Sequelize fallback');
    return await Camera.getAllViaSequelize(filters);
  }
};

module.exports = Camera;