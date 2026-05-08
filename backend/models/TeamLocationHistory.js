const mysql = require('mysql2/promise');
require('dotenv').config();

class TeamLocationHistory {
  static async getConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cifo_security',
      charset: 'utf8mb4'
    });
  }

  static async create(locationData) {
    const connection = await this.getConnection();
    try {
      const {
        member_id,
        location,
        lat,
        lng,
        activity_type
      } = locationData;

      const [result] = await connection.execute(
        `INSERT INTO team_location_history 
         (member_id, location, lat, lng, activity_type) 
         VALUES (?, ?, ?, ?, ?)`,
        [member_id, location, lat, lng, activity_type]
      );

      return {
        id: result.insertId,
        ...locationData,
        timestamp: new Date()
      };
    } finally {
      await connection.end();
    }
  }

  static async getLatest(memberId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM team_location_history 
         WHERE member_id = ? 
         ORDER BY timestamp DESC 
         LIMIT 1`,
        [memberId]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  static async getHistory(memberId, limit = 50) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM team_location_history 
         WHERE member_id = ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [memberId, limit]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getHistoryByDateRange(memberId, startDate, endDate) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM team_location_history 
         WHERE member_id = ? AND timestamp BETWEEN ? AND ?
         ORDER BY timestamp DESC`,
        [memberId, startDate, endDate]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getPatrolRoute(memberId, date) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM team_location_history 
         WHERE member_id = ? 
         AND DATE(timestamp) = DATE(?)
         AND activity_type IN ('PATROL_START', 'PATROL_CHECKPOINT', 'PATROL_END')
         ORDER BY timestamp ASC`,
        [memberId, date]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getAllCurrentLocations() {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT 
          tlh.*,
          tm.nama,
          tm.role,
          tm.status
        FROM team_location_history tlh
        INNER JOIN (
          SELECT member_id, MAX(timestamp) as latest_timestamp
          FROM team_location_history
          GROUP BY member_id
        ) latest ON tlh.member_id = latest.member_id AND tlh.timestamp = latest.latest_timestamp
        INNER JOIN team_members tm ON tlh.member_id = tm.id
        WHERE tm.status IN ('ON_DUTY', 'PATROLLING')
        ORDER BY tlh.timestamp DESC
      `);
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getLocationsByArea(location, radius = 100) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT tlh.*, tm.nama, tm.role, tm.status
         FROM team_location_history tlh
         INNER JOIN team_members tm ON tlh.member_id = tm.id
         WHERE tlh.location LIKE ? 
         AND tlh.timestamp >= NOW() - INTERVAL 1 HOUR
         ORDER BY tlh.timestamp DESC`,
        [`%${location}%`]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getActivitySummary(memberId, date) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
           activity_type,
           COUNT(*) as count,
           MIN(timestamp) as first_activity,
           MAX(timestamp) as last_activity
         FROM team_location_history 
         WHERE member_id = ? AND DATE(timestamp) = DATE(?)
         GROUP BY activity_type
         ORDER BY first_activity`,
        [memberId, date]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getTeamMovementSummary(date) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
           tm.nama,
           tm.role,
           COUNT(tlh.id) as total_movements,
           COUNT(DISTINCT tlh.location) as unique_locations,
           MIN(tlh.timestamp) as first_movement,
           MAX(tlh.timestamp) as last_movement
         FROM team_members tm
         LEFT JOIN team_location_history tlh ON tm.id = tlh.member_id 
           AND DATE(tlh.timestamp) = DATE(?)
         GROUP BY tm.id, tm.nama, tm.role
         ORDER BY total_movements DESC`,
        [date]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async cleanupOldHistory(daysToKeep = 90) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        'DELETE FROM team_location_history WHERE timestamp < NOW() - INTERVAL ? DAY',
        [daysToKeep]
      );
      return result.affectedRows;
    } finally {
      await connection.end();
    }
  }

  static async getPatrolCoverage(date) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
           location,
           COUNT(*) as visit_count,
           COUNT(DISTINCT member_id) as unique_visitors,
           MIN(timestamp) as first_visit,
           MAX(timestamp) as last_visit
         FROM team_location_history 
         WHERE DATE(timestamp) = DATE(?) 
         AND activity_type IN ('PATROL_CHECKPOINT', 'PATROL_START', 'PATROL_END')
         GROUP BY location
         ORDER BY visit_count DESC`,
        [date]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getMemberTrackingData(memberId, hours = 8) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
           location,
           lat,
           lng,
           activity_type,
           timestamp
         FROM team_location_history 
         WHERE member_id = ? 
         AND timestamp >= NOW() - INTERVAL ? HOUR
         ORDER BY timestamp ASC`,
        [memberId, hours]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }
}

module.exports = TeamLocationHistory;