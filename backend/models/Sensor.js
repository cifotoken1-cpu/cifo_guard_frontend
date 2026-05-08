const mysql = require('mysql2/promise');
require('dotenv').config();

class Sensor {
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
      let query = 'SELECT COUNT(*) as count FROM sensors';
      const params = [];
      const conditions = [];
      if (filters.type)   { conditions.push('type = ?');   params.push(filters.type); }
      if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }
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
      let query = 'SELECT * FROM sensors';
      const params = [];
      const conditions = [];

      if (filters.type)   { conditions.push('type = ?');   params.push(filters.type); }
      if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }

      if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
      query += ' ORDER BY last_event_at DESC';

      if (filters.limit) {
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(filters.limit), parseInt(filters.offset || 0));
      }

      const [rows] = await connection.execute(query, params);
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getById(id) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM sensors WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  static async updateStatus(id, status) {
    const validStatuses = ['clear', 'open', 'alert', 'offline'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        'UPDATE sensors SET status = ?, last_event_at = NOW() WHERE id = ?',
        [status, id]
      );
      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }
}

module.exports = Sensor;
