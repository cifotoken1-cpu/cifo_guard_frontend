const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
require('dotenv').config();

// Define SecurityActivity Sequelize model
const SecurityActivity = sequelize.define('SecurityActivity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  ref_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  actor: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  severity: {
    type: DataTypes.ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL'),
    defaultValue: 'INFO'
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'timestamp'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING(50),
    defaultValue: 'system'
  }
}, {
  tableName: 'security_activities',
  timestamps: false, // We use custom timestamp field
  indexes: [
    { fields: ['type'] },
    { fields: ['severity'] },
    { fields: ['timestamp'] },
    { fields: ['actor'] },
    { fields: ['ref_id'] }
  ]
});

// Add static methods to maintain backward compatibility
SecurityActivity.createActivity = async function(activityData) {
  try {
    const {
      type,
      ref_id,
      actor,
      note,
      severity = 'INFO',
      metadata,
      source = 'system'
    } = activityData;

    // Validate required fields
    if (!type) {
      throw new Error('Activity type is required');
    }
    if (!actor) {
      throw new Error('Activity actor is required');
    }
    if (!note) {
      throw new Error('Activity note is required');
    }

    const result = await SecurityActivity.create({
      type,
      ref_id: ref_id || null,
      actor,
      note,
      severity,
      metadata,
      source,
      timestamp: new Date()
    });

    return result.toJSON();
  } catch (error) {
    console.error('Error creating SecurityActivity:', error);
    throw error;
  }
};

SecurityActivity.getAll = async function(options = {}) {
  try {
    const {
      limit = 50,
      offset = 0,
      type,
      severity,
      actor,
      startDate,
      endDate
    } = options;

    const where = {};
    
    if (type) {
      where.type = type;
    }
    
    if (severity) {
      where.severity = severity;
    }
    
    if (actor) {
      where.actor = {
        [sequelize.Sequelize.Op.like]: `%${actor}%`
      };
    }
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp[sequelize.Sequelize.Op.gte] = startDate;
      }
      if (endDate) {
        where.timestamp[sequelize.Sequelize.Op.lte] = endDate;
      }
    }

    const results = await SecurityActivity.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      raw: true
    });
    
    return results;
  } catch (error) {
    console.error('Error in SecurityActivity.getAll:', error);
    throw error;
  }
};

SecurityActivity.getById = async function(id) {
  try {
    const result = await SecurityActivity.findByPk(id, { raw: true });
    return result || null;
  } catch (error) {
    console.error('Error in SecurityActivity.getById:', error);
    throw error;
  }
};

SecurityActivity.getCount = async function(filters = {}) {
  try {
    const {
      type,
      severity,
      actor,
      startDate,
      endDate
    } = filters;

    const where = {};

    if (type) {
      where.type = type;
    }

    if (severity) {
      where.severity = severity;
    }

    if (actor) {
      where.actor = {
        [sequelize.Sequelize.Op.like]: `%${actor}%`
      };
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp[sequelize.Sequelize.Op.gte] = startDate;
      }
      if (endDate) {
        where.timestamp[sequelize.Sequelize.Op.lte] = endDate;
      }
    }

    const count = await SecurityActivity.count({ where });
    return count;
  } catch (error) {
    console.error('Error in SecurityActivity.getCount:', error);
    throw error;
  }
};

SecurityActivity.getRecent = async function(limit = 10) {
  try {
    const results = await SecurityActivity.findAll({
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      raw: true
    });
    return results;
  } catch (error) {
    console.error('Error in SecurityActivity.getRecent:', error);
    throw error;
  }
};

SecurityActivity.getStats = async function(period = '24h') {
  try {
    let interval;
    switch (period) {
      case '1h':
        interval = '1 HOUR';
        break;
      case '24h':
        interval = '24 HOUR';
        break;
      case '7d':
        interval = '7 DAY';
        break;
      case '30d':
        interval = '30 DAY';
        break;
      default:
        interval = '24 HOUR';
    }

    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'INFO' THEN 1 ELSE 0 END) as info_count,
        SUM(CASE WHEN severity = 'WARNING' THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN severity = 'ERROR' THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count
      FROM security_activities 
      WHERE timestamp >= NOW() - INTERVAL ${interval}
    `);
    
    return stats[0];
  } catch (error) {
    console.error('Error in SecurityActivity.getStats:', error);
    throw error;
  }
};

SecurityActivity.getByType = async function(type, limit = 50) {
  try {
    const results = await SecurityActivity.findAll({
      where: { type },
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      raw: true
    });
    return results;
  } catch (error) {
    console.error('Error in SecurityActivity.getByType:', error);
    throw error;
  }
};

SecurityActivity.getBySeverity = async function(severity, limit = 50) {
  try {
    const results = await SecurityActivity.findAll({
      where: { severity },
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      raw: true
    });
    return results;
  } catch (error) {
    console.error('Error in SecurityActivity.getBySeverity:', error);
    throw error;
  }
};

SecurityActivity.getByActor = async function(actor, limit = 50) {
  try {
    const results = await SecurityActivity.findAll({
      where: {
        actor: {
          [sequelize.Sequelize.Op.like]: `%${actor}%`
        }
      },
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      raw: true
    });
    return results;
  } catch (error) {
    console.error('Error in SecurityActivity.getByActor:', error);
    throw error;
  }
};

SecurityActivity.getByRefId = async function(refId, options = {}) {
  try {
    const where = { ref_id: refId };
    
    // Add optional filters
    if (options.type) {
      where.type = options.type;
    }
    
    if (options.severity) {
      where.severity = options.severity;
    }
    
    const queryOptions = {
      where,
      order: [['timestamp', 'DESC']],
      raw: true
    };
    
    // Add pagination
    if (options.limit) {
      queryOptions.limit = parseInt(options.limit);
      if (options.offset && options.offset > 0) {
        queryOptions.offset = parseInt(options.offset);
      }
    }
    
    const results = await SecurityActivity.findAll(queryOptions);
    return results;
  } catch (error) {
    console.error('Error in SecurityActivity.getByRefId:', error);
    throw error;
  }
};

SecurityActivity.getActivityTrend = async function(hours = 24) {
  try {
    const [rows] = await sequelize.query(
      `SELECT 
         DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
         COUNT(*) as activity_count,
         SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
         SUM(CASE WHEN severity = 'ERROR' THEN 1 ELSE 0 END) as error_count,
         SUM(CASE WHEN severity = 'WARNING' THEN 1 ELSE 0 END) as warning_count
       FROM security_activities 
       WHERE timestamp >= NOW() - INTERVAL ? HOUR
       GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')
       ORDER BY hour DESC`,
      {
        replacements: [hours],
        type: sequelize.QueryTypes.SELECT
      }
    );
    return rows;
  } catch (error) {
    console.error('Error in SecurityActivity.getActivityTrend:', error);
    throw error;
  }
};

SecurityActivity.getTopActors = async function(limit = 10, period = '24h') {
  try {
    let interval;
    switch (period) {
      case '1h':
        interval = '1 HOUR';
        break;
      case '24h':
        interval = '24 HOUR';
        break;
      case '7d':
        interval = '7 DAY';
        break;
      case '30d':
        interval = '30 DAY';
        break;
      default:
        interval = '24 HOUR';
    }

    const rows = await sequelize.query(`
      SELECT 
        actor,
        COUNT(*) as activity_count,
        MAX(timestamp) as last_activity
      FROM security_activities 
      WHERE timestamp >= NOW() - INTERVAL ${interval}
      GROUP BY actor
      ORDER BY activity_count DESC
      LIMIT ?
    `, {
      replacements: [limit],
      type: sequelize.QueryTypes.SELECT
    });
    return rows;
  } catch (error) {
    console.error('Error in SecurityActivity.getTopActors:', error);
    throw error;
  }
};

SecurityActivity.getCriticalActivities = async function(hours = 24) {
  try {
    const results = await SecurityActivity.findAll({
      where: {
        severity: {
          [sequelize.Sequelize.Op.in]: ['CRITICAL', 'ERROR']
        },
        timestamp: {
          [sequelize.Sequelize.Op.gte]: sequelize.literal(`NOW() - INTERVAL ${hours} HOUR`)
        }
      },
      order: [['timestamp', 'DESC']],
      raw: true
    });
    return results;
  } catch (error) {
    console.error('Error in SecurityActivity.getCriticalActivities:', error);
    throw error;
  }
};

SecurityActivity.cleanupOldActivities = async function(daysToKeep = 90) {
  try {
    const result = await SecurityActivity.destroy({
      where: {
        timestamp: {
          [sequelize.Sequelize.Op.lt]: sequelize.literal(`NOW() - INTERVAL ${daysToKeep} DAY`)
        }
      }
    });
    return result;
  } catch (error) {
    console.error('Error in SecurityActivity.cleanupOldActivities:', error);
    throw error;
  }
};

SecurityActivity.updateActivity = async function(id, updateData) {
  try {
    const { note, severity, metadata } = updateData;
    
    const [affectedRows] = await SecurityActivity.update(
      { note, severity, metadata },
      { where: { id } }
    );
    
    return affectedRows > 0;
  } catch (error) {
    console.error('Error in SecurityActivity.updateActivity:', error);
    throw error;
  }
};

SecurityActivity.delete = async function(id) {
  try {
    const result = await SecurityActivity.destroy({
      where: { id }
    });
    return result > 0;
  } catch (error) {
    console.error('Error in SecurityActivity.delete:', error);
    throw error;
  }
};

module.exports = SecurityActivity;