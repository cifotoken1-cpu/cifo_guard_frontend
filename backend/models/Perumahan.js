const mysql = require('mysql2/promise');
require('dotenv').config();

class Perumahan {
  static async getConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cifo_security',
      charset: 'utf8mb4'
    });
  }

  // Perumahan Info Methods
  static async getAllPerumahan(options = {}) {
    const connection = await this.getConnection();
    try {
      const {
        limit = 50,
        offset = 0,
        status,
        area,
        search
      } = options;

      let query = 'SELECT * FROM perumahan_info';
      const params = [];
      const conditions = [];

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }

      if (area) {
        conditions.push('area LIKE ?');
        params.push(`%${area}%`);
      }

      if (search) {
        conditions.push('(name LIKE ? OR address LIKE ? OR description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [rows] = await connection.execute(query, params);
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getPerumahanById(id) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM perumahan_info WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  static async createPerumahan(perumahanData) {
    const connection = await this.getConnection();
    try {
      const {
        name,
        address,
        area,
        total_units,
        occupied_units = 0,
        security_level = 'MEDIUM',
        contact_person,
        contact_phone,
        description,
        coordinates,
        status = 'ACTIVE'
      } = perumahanData;

      const [result] = await connection.execute(
        `INSERT INTO perumahan_info 
         (name, address, area, total_units, occupied_units, security_level, 
          contact_person, contact_phone, description, coordinates, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, address, area, total_units, occupied_units, security_level,
         contact_person, contact_phone, description, coordinates, status]
      );

      return {
        id: result.insertId,
        ...perumahanData,
        created_at: new Date(),
        updated_at: new Date()
      };
    } finally {
      await connection.end();
    }
  }

  static async updatePerumahan(id, updateData) {
    const connection = await this.getConnection();
    try {
      const fields = [];
      const values = [];

      const allowedFields = [
        'name', 'address', 'area', 'total_units', 'occupied_units',
        'security_level', 'contact_person', 'contact_phone', 
        'description', 'coordinates', 'status'
      ];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(updateData[field]);
        }
      });

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = NOW()');
      values.push(id);

      const [result] = await connection.execute(
        `UPDATE perumahan_info SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async deletePerumahan(id) {
    const connection = await this.getConnection();
    try {
      // Delete related facilities first
      await connection.execute(
        'DELETE FROM perumahan_facilities WHERE perumahan_id = ?',
        [id]
      );

      // Delete perumahan info
      const [result] = await connection.execute(
        'DELETE FROM perumahan_info WHERE id = ?',
        [id]
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async getPerumahanStats() {
    const connection = await this.getConnection();
    try {
      const [stats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_perumahan,
          SUM(total_units) as total_units,
          SUM(occupied_units) as total_occupied,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) as inactive_count,
          SUM(CASE WHEN security_level = 'HIGH' THEN 1 ELSE 0 END) as high_security,
          SUM(CASE WHEN security_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_security,
          SUM(CASE WHEN security_level = 'LOW' THEN 1 ELSE 0 END) as low_security
        FROM perumahan_info
      `);
      
      return stats[0];
    } finally {
      await connection.end();
    }
  }

  static async getPerumahanByArea(area) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM perumahan_info WHERE area LIKE ? ORDER BY name',
        [`%${area}%`]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getPerumahanBySecurityLevel(level) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM perumahan_info WHERE security_level = ? ORDER BY name',
        [level]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  // Facilities Methods
  static async getFacilitiesByPerumahan(perumahanId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM perumahan_facilities WHERE perumahan_id = ? ORDER BY name',
        [perumahanId]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getFacilityById(id) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM perumahan_facilities WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  static async createFacility(facilityData) {
    const connection = await this.getConnection();
    try {
      const {
        perumahan_id,
        name,
        type,
        description,
        location,
        operating_hours,
        contact_info,
        status = 'ACTIVE'
      } = facilityData;

      const [result] = await connection.execute(
        `INSERT INTO perumahan_facilities 
         (perumahan_id, name, type, description, location, operating_hours, contact_info, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [perumahan_id, name, type, description, location, operating_hours, contact_info, status]
      );

      return {
        id: result.insertId,
        ...facilityData,
        created_at: new Date(),
        updated_at: new Date()
      };
    } finally {
      await connection.end();
    }
  }

  static async updateFacility(id, updateData) {
    const connection = await this.getConnection();
    try {
      const fields = [];
      const values = [];

      const allowedFields = [
        'name', 'type', 'description', 'location', 
        'operating_hours', 'contact_info', 'status'
      ];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(updateData[field]);
        }
      });

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = NOW()');
      values.push(id);

      const [result] = await connection.execute(
        `UPDATE perumahan_facilities SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async deleteFacility(id) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        'DELETE FROM perumahan_facilities WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  static async getFacilitiesByType(type) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT pf.*, pi.name as perumahan_name 
         FROM perumahan_facilities pf 
         JOIN perumahan_info pi ON pf.perumahan_id = pi.id 
         WHERE pf.type = ? 
         ORDER BY pi.name, pf.name`,
        [type]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getFacilityStats() {
    const connection = await this.getConnection();
    try {
      const [stats] = await connection.execute(`
        SELECT 
          COUNT(*) as total_facilities,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_facilities,
          SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) as inactive_facilities,
          SUM(CASE WHEN type = 'SECURITY_POST' THEN 1 ELSE 0 END) as security_posts,
          SUM(CASE WHEN type = 'PLAYGROUND' THEN 1 ELSE 0 END) as playgrounds,
          SUM(CASE WHEN type = 'PARKING' THEN 1 ELSE 0 END) as parking_areas,
          SUM(CASE WHEN type = 'CLUBHOUSE' THEN 1 ELSE 0 END) as clubhouses,
          SUM(CASE WHEN type = 'SWIMMING_POOL' THEN 1 ELSE 0 END) as swimming_pools,
          SUM(CASE WHEN type = 'GYM' THEN 1 ELSE 0 END) as gyms,
          SUM(CASE WHEN type = 'OTHER' THEN 1 ELSE 0 END) as others
        FROM perumahan_facilities
      `);
      
      return stats[0];
    } finally {
      await connection.end();
    }
  }

  static async getPerumahanWithFacilities(perumahanId) {
    const connection = await this.getConnection();
    try {
      // Get perumahan info
      const [perumahanRows] = await connection.execute(
        'SELECT * FROM perumahan_info WHERE id = ?',
        [perumahanId]
      );

      if (perumahanRows.length === 0) {
        return null;
      }

      const perumahan = perumahanRows[0];

      // Get facilities
      const [facilityRows] = await connection.execute(
        'SELECT * FROM perumahan_facilities WHERE perumahan_id = ? ORDER BY name',
        [perumahanId]
      );

      perumahan.facilities = facilityRows;
      return perumahan;
    } finally {
      await connection.end();
    }
  }

  static async searchPerumahan(searchTerm, options = {}) {
    const connection = await this.getConnection();
    try {
      const { limit = 20, offset = 0 } = options;

      const [rows] = await connection.execute(
        `SELECT pi.*, 
                COUNT(pf.id) as facility_count
         FROM perumahan_info pi
         LEFT JOIN perumahan_facilities pf ON pi.id = pf.perumahan_id
         WHERE pi.name LIKE ? OR pi.address LIKE ? OR pi.area LIKE ? OR pi.description LIKE ?
         GROUP BY pi.id
         ORDER BY pi.name
         LIMIT ? OFFSET ?`,
        [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getOccupancyReport() {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT 
          name,
          area,
          total_units,
          occupied_units,
          (occupied_units / total_units * 100) as occupancy_rate,
          security_level,
          status
        FROM perumahan_info
        WHERE total_units > 0
        ORDER BY occupancy_rate DESC
      `);
      return rows;
    } finally {
      await connection.end();
    }
  }

  static async getAreaSummary() {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT 
          area,
          COUNT(*) as perumahan_count,
          SUM(total_units) as total_units,
          SUM(occupied_units) as total_occupied,
          AVG(occupied_units / total_units * 100) as avg_occupancy_rate
        FROM perumahan_info
        WHERE total_units > 0
        GROUP BY area
        ORDER BY perumahan_count DESC
      `);
      return rows;
    } finally {
      await connection.end();
    }
  }
}

module.exports = Perumahan;