const mysql = require('mysql2/promise');
require('dotenv').config();

class TeamMember {
  static async getConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cifo_security',
      charset: 'utf8mb4'
    });
  }

  static async getAll(filters = {}) {
    const connection = await this.getConnection();
    try {
      let query = 'SELECT * FROM team_members';
      const params = [];
      const conditions = [];

      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }

      if (filters.role) {
        conditions.push('role = ?');
        params.push(filters.role);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY nama';

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
        'SELECT * FROM team_members WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  static async create(memberData) {
    const connection = await this.getConnection();
    try {
      const {
        id,
        nama,
        role,
        status = 'OFF_DUTY',
        phone,
        email,
        current_location,
        shift_start,
        shift_end
      } = memberData;

      const [result] = await connection.execute(
        `INSERT INTO team_members 
         (id, nama, role, status, phone, email, current_location, shift_start, shift_end) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, nama, role, status, phone, email, current_location, shift_start, shift_end]
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
        current_location,
        last_update
      } = statusData;

      const [result] = await connection.execute(
        `UPDATE team_members 
         SET status = ?, current_location = ?, last_update = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, current_location, last_update, id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async updateLocation(id, locationData) {
    const connection = await this.getConnection();
    try {
      const {
        current_location,
        last_update
      } = locationData;

      const [result] = await connection.execute(
        `UPDATE team_members 
         SET current_location = ?, last_update = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [current_location, last_update, id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async update(id, memberData) {
    const connection = await this.getConnection();
    try {
      const {
        nama,
        role,
        phone,
        email,
        shift_start,
        shift_end
      } = memberData;

      const [result] = await connection.execute(
        `UPDATE team_members 
         SET nama = ?, role = ?, phone = ?, email = ?, 
             shift_start = ?, shift_end = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nama, role, phone, email, shift_start, shift_end, id]
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
        'DELETE FROM team_members WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async getOnDutyMembers() {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM team_members WHERE status IN ('ON_DUTY', 'PATROLLING') ORDER BY nama"
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getByRole(role) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM team_members WHERE role = ? ORDER BY nama',
        [role]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getTeamStats() {
    const connection = await this.getConnection();
    try {
      const [stats] = await connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'ON_DUTY' THEN 1 ELSE 0 END) as on_duty,
          SUM(CASE WHEN status = 'OFF_DUTY' THEN 1 ELSE 0 END) as off_duty,
          SUM(CASE WHEN status = 'PATROLLING' THEN 1 ELSE 0 END) as patrolling,
          SUM(CASE WHEN status = 'BREAK' THEN 1 ELSE 0 END) as on_break
        FROM team_members
      `);
      
      return stats[0];
    } finally {
      await connection.end();
    }
  }

  static async getCurrentShiftMembers() {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT * FROM team_members 
        WHERE (
          (shift_start <= CURTIME() AND shift_end > CURTIME()) OR
          (shift_start > shift_end AND (CURTIME() >= shift_start OR CURTIME() <= shift_end))
        )
        ORDER BY nama
      `);
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getAvailableMembers() {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT * FROM team_members WHERE status IN ('ON_DUTY', 'OFF_DUTY') ORDER BY nama"
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async updateLastSeen(id) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        'UPDATE team_members SET last_update = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async getInactiveMembers(hours = 4) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM team_members 
         WHERE last_update < NOW() - INTERVAL ? HOUR 
         AND status IN ('ON_DUTY', 'PATROLLING')
         ORDER BY last_update`,
        [hours]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getCount(filters = {}) {
    const connection = await this.getConnection();
    try {
      const {
        status,
        role,
        shift,
        duty_status,
        search
      } = filters;

      let query = 'SELECT COUNT(*) as total FROM team_members';
      const params = [];
      const conditions = [];

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }

      if (role) {
        conditions.push('role = ?');
        params.push(role);
      }

      if (shift) {
        conditions.push('shift = ?');
        params.push(shift);
      }

      if (duty_status) {
        conditions.push('duty_status = ?');
        params.push(duty_status);
      }

      if (search) {
        conditions.push('(nama LIKE ? OR employee_id LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      const [rows] = await connection.execute(query, params);
      return rows[0].total;
    } finally {
      await connection.end();
    }
  }

  static async getStats() {
    const connection = await this.getConnection();
    try {
      const [totalRows] = await connection.execute(
        'SELECT COUNT(*) as total FROM team_members'
      );
      
      const [activeRows] = await connection.execute(
        'SELECT COUNT(*) as active FROM team_members WHERE status IN ("ON_DUTY", "PATROLLING")'
      );
      
      const [offDutyRows] = await connection.execute(
        'SELECT COUNT(*) as off_duty FROM team_members WHERE status = "OFF_DUTY"'
      );
      
      const [emergencyRows] = await connection.execute(
        'SELECT COUNT(*) as emergency FROM team_members WHERE status = "EMERGENCY"'
      );
      
      return {
        total: totalRows[0].total,
        active: activeRows[0].active,
        off_duty: offDutyRows[0].off_duty,
        emergency: emergencyRows[0].emergency,
        last_updated: new Date().toISOString()
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
          SUM(CASE WHEN status IN ('ON_DUTY', 'PATROLLING') THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'OFF_DUTY' THEN 1 ELSE 0 END) as off_duty,
          SUM(CASE WHEN status = 'EMERGENCY' THEN 1 ELSE 0 END) as emergency
        FROM team_members
      `);
      
      return {
        total: stats[0].total || 0,
        active: stats[0].active || 0,
        off_duty: stats[0].off_duty || 0,
        emergency: stats[0].emergency || 0,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in TeamMember.getStatsViaSequelize:', error);
      return {
        total: 0,
        active: 0,
        off_duty: 0,
        emergency: 0,
        last_updated: new Date().toISOString()
      };
    }
  }

  static async getAllViaSequelize(filters = {}) {
    const sequelize = require('../config/database');
    try {
      let query = 'SELECT * FROM team_members';
      const replacements = [];
      const conditions = [];

      if (filters.status) {
        conditions.push('status = ?');
        replacements.push(filters.status);
      }

      if (filters.role) {
        conditions.push('role = ?');
        replacements.push(filters.role);
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
      console.error('Error in TeamMember.getAllViaSequelize:', error);
      return [];
    }
  }
}

// Override the original methods to use Sequelize fallbacks
const originalGetStats = TeamMember.getStats;
const originalGetAll = TeamMember.getAll;

TeamMember.getStats = async function() {
  try {
    return await originalGetStats.call(this);
  } catch (error) {
    console.log('TeamMember.getStats failed, using Sequelize fallback');
    return await TeamMember.getStatsViaSequelize();
  }
};

TeamMember.getAll = async function(filters = {}) {
  try {
    return await originalGetAll.call(this, filters);
  } catch (error) {
    console.log('TeamMember.getAll failed, using Sequelize fallback');
    return await TeamMember.getAllViaSequelize(filters);
  }
};

module.exports = TeamMember;