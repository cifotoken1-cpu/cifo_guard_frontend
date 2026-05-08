/**
 * Activity Logger Service
 * Logs security activities and system events
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

class ActivityLogger {
  static async getConnection() {
    return await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cifo_security',
      charset: 'utf8mb4'
    });
  }

  /**
   * Log a security activity
   * @param {Object} activity - Activity data
   * @param {string} activity.type - Activity type
   * @param {string} activity.description - Activity description
   * @param {string} activity.team_member_id - Team member ID
   * @param {Object} activity.metadata - Additional metadata
   * @param {string} activity.severity - Activity severity
   */
  static async logActivity(activity) {
    const connection = await this.getConnection();
    try {
      const query = `
        INSERT INTO security_activities (
          type, ref_id, actor, note, severity, metadata, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        activity.type || 'SYSTEM',
        activity.ref_id || null,
        activity.team_member_id || activity.actor || 'system',
        activity.description || activity.note || 'System activity',
        activity.severity || 'INFO',
        JSON.stringify(activity.metadata || {}),
        activity.source || 'SYSTEM'
      ];
      
      const [result] = await connection.execute(query, values);
      
      console.log(`✅ Activity logged: ${activity.type} - ${activity.description || activity.note}`);
      return result.insertId;
    } catch (error) {
      console.error('❌ Error logging activity:', error.message);
      throw error;
    } finally {
      await connection.end();
    }
  }

  /**
   * Log map pin activity
   * @param {string} action - Action performed (CREATE, UPDATE, DELETE)
   * @param {Object} pinData - Map pin data
   * @param {string} userId - User ID performing the action
   */
  static async logMapPinActivity(action, pinData, userId = null) {
    const activity = {
      type: 'MAP_PIN_MANAGEMENT',
      description: `Map pin ${action.toLowerCase()}: ${pinData.title || pinData.id}`,
      team_member_id: userId,
      metadata: {
        action,
        pin_id: pinData.id,
        pin_type: pinData.type,
        coordinates: pinData.coordinates,
        timestamp: new Date().toISOString()
      },
      severity: 'INFO'
    };
    
    return await this.logActivity(activity);
  }

  /**
   * Log geofence activity
   * @param {string} action - Action performed
   * @param {Object} geofenceData - Geofence data
   * @param {string} userId - User ID performing the action
   */
  static async logGeofenceActivity(action, geofenceData, userId = null) {
    const activity = {
      type: 'GEOFENCE_MANAGEMENT',
      description: `Geofence ${action.toLowerCase()}: ${geofenceData.name || geofenceData.id}`,
      team_member_id: userId,
      metadata: {
        action,
        geofence_id: geofenceData.id,
        geofence_type: geofenceData.type,
        timestamp: new Date().toISOString()
      },
      severity: 'INFO'
    };
    
    return await this.logActivity(activity);
  }

  /**
   * Log system event
   * @param {string} event - Event type
   * @param {string} description - Event description
   * @param {Object} metadata - Additional metadata
   * @param {string} severity - Event severity (INFO, WARNING, ERROR)
   */
  static async logSystemEvent(event, description, metadata = {}, severity = 'INFO') {
    const activity = {
      type: 'SYSTEM_EVENT',
      description: `${event}: ${description}`,
      metadata: {
        event,
        ...metadata,
        timestamp: new Date().toISOString()
      },
      severity
    };
    
    return await this.logActivity(activity);
  }

  /**
   * Generic log method for backward compatibility
   * @param {Object} logData - Log data object
   */
  static async log(logData) {
    const {
      userId,
      action,
      resource,
      resourceId,
      details,
      severity = 'INFO',
      type = 'SYSTEM'
    } = logData;

    const activity = {
      type: type.toUpperCase(),
      ref_id: resourceId,
      actor: userId || 'system',
      note: `${action}: ${resource}${resourceId ? ` (${resourceId})` : ''}`,
      severity: severity.toUpperCase(),
      metadata: details || {},
      source: 'SYSTEM'
    };

    return await this.logActivity(activity);
  }

  /**
   * Get recent activities
   * @param {number} limit - Number of activities to retrieve
   * @param {Object} filters - Filter options
   */
  static async getRecentActivities(limit = 50, filters = {}) {
    const connection = await this.getConnection();
    try {
      let query = `
        SELECT sa.*, tm.name as team_member_name, tm.role as team_member_role
        FROM security_activities sa
        LEFT JOIN team_members tm ON sa.team_member_id = tm.id
        WHERE 1=1
      `;
      const params = [];
      
      if (filters.type) {
        query += ' AND sa.type = ?';
        params.push(filters.type);
      }
      
      if (filters.severity) {
        query += ' AND sa.severity = ?';
        params.push(filters.severity);
      }
      
      if (filters.team_member_id) {
        query += ' AND sa.team_member_id = ?';
        params.push(filters.team_member_id);
      }
      
      query += ' ORDER BY sa.created_at DESC LIMIT ?';
      params.push(limit);
      
      const [rows] = await connection.execute(query, params);
      
      // Parse metadata JSON
      return rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }));
    } catch (error) {
      console.error('❌ Error getting activities:', error.message);
      throw error;
    } finally {
      await connection.end();
    }
  }
}

module.exports = ActivityLogger;