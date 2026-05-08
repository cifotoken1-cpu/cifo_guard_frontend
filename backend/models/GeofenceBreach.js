/**
 * GeofenceBreach.js
 * Model untuk mencatat pelanggaran geofence
 * Tracking entry/exit events dan severity levels
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GeofenceBreach = sequelize.define('GeofenceBreach', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  geofenceId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'geofences',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  teamMemberId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'team_members',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  breachType: {
    type: DataTypes.ENUM('ENTRY', 'EXIT', 'DWELL'),
    allowNull: false,
    validate: {
      isIn: [['ENTRY', 'EXIT', 'DWELL']]
    }
  },
  location: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      isValidLocation(value) {
        if (!value || typeof value !== 'object') {
          throw new Error('Location must be a valid object');
        }
        if (!value.latitude || !value.longitude) {
          throw new Error('Location must have latitude and longitude');
        }
        if (value.latitude < -90 || value.latitude > 90) {
          throw new Error('Latitude must be between -90 and 90');
        }
        if (value.longitude < -180 || value.longitude > 180) {
          throw new Error('Longitude must be between -180 and 180');
        }
      }
    }
  },
  severity: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'MEDIUM',
    allowNull: false
  },
  isResolved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resolvedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional breach metadata (speed, duration, etc.)'
  },
  notificationSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  tableName: 'geofence_breaches',
  timestamps: true,
  indexes: [
    {
      fields: ['geofenceId']
    },
    {
      fields: ['teamMemberId']
    },
    {
      fields: ['breachType']
    },
    {
      fields: ['severity']
    },
    {
      fields: ['isResolved']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['geofenceId', 'teamMemberId', 'createdAt']
    }
  ],
  hooks: {
    beforeUpdate: (breach) => {
      breach.updatedAt = new Date();
      
      // Auto-set resolvedAt when isResolved changes to true
      if (breach.isResolved && !breach.resolvedAt) {
        breach.resolvedAt = new Date();
      }
    }
  }
});

// Instance Methods
GeofenceBreach.prototype.resolve = function(resolvedBy, notes) {
  return this.update({
    isResolved: true,
    resolvedAt: new Date(),
    resolvedBy,
    notes: notes || this.notes
  });
};

GeofenceBreach.prototype.getDuration = function() {
  if (!this.resolvedAt) {
    return Date.now() - this.createdAt.getTime();
  }
  return this.resolvedAt.getTime() - this.createdAt.getTime();
};

GeofenceBreach.prototype.isOverdue = function(thresholdMinutes = 30) {
  if (this.isResolved) return false;
  
  const now = new Date();
  const diffMinutes = (now - this.createdAt) / (1000 * 60);
  return diffMinutes > thresholdMinutes;
};

GeofenceBreach.prototype.getSeverityLevel = function() {
  const severityLevels = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'CRITICAL': 4
  };
  return severityLevels[this.severity] || 1;
};

// Class Methods
GeofenceBreach.getActiveBreaches = function() {
  return this.findAll({
    where: { isResolved: false },
    include: [
      {
        model: sequelize.models.Geofence,
        as: 'geofence',
        attributes: ['id', 'name', 'type', 'priority']
      },
      {
        model: sequelize.models.TeamMember,
        as: 'teamMember',
        attributes: ['id', 'name', 'role', 'employeeId']
      }
    ],
    order: [['severity', 'DESC'], ['createdAt', 'DESC']]
  });
};

GeofenceBreach.getCriticalBreaches = function() {
  return this.findAll({
    where: {
      severity: 'CRITICAL',
      isResolved: false
    },
    include: [
      {
        model: sequelize.models.Geofence,
        as: 'geofence',
        attributes: ['id', 'name', 'type', 'priority']
      },
      {
        model: sequelize.models.TeamMember,
        as: 'teamMember',
        attributes: ['id', 'name', 'role', 'employeeId']
      }
    ],
    order: [['createdAt', 'DESC']]
  });
};

GeofenceBreach.getOverdueBreaches = function(thresholdMinutes = 30) {
  const { Op } = require('sequelize');
  const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  
  return this.findAll({
    where: {
      isResolved: false,
      createdAt: {
        [Op.lte]: thresholdTime
      }
    },
    include: [
      {
        model: sequelize.models.Geofence,
        as: 'geofence',
        attributes: ['id', 'name', 'type', 'priority']
      },
      {
        model: sequelize.models.TeamMember,
        as: 'teamMember',
        attributes: ['id', 'name', 'role', 'employeeId']
      }
    ],
    order: [['createdAt', 'ASC']]
  });
};

GeofenceBreach.getBreachesByGeofence = function(geofenceId, options = {}) {
  const { limit = 50, offset = 0, includeResolved = true } = options;
  const whereClause = { geofenceId };
  
  if (!includeResolved) {
    whereClause.isResolved = false;
  }
  
  return this.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: sequelize.models.TeamMember,
        as: 'teamMember',
        attributes: ['id', 'name', 'role', 'employeeId']
      }
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
};

GeofenceBreach.getBreachesByTeamMember = function(teamMemberId, options = {}) {
  const { limit = 50, offset = 0, includeResolved = true } = options;
  const whereClause = { teamMemberId };
  
  if (!includeResolved) {
    whereClause.isResolved = false;
  }
  
  return this.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: sequelize.models.Geofence,
        as: 'geofence',
        attributes: ['id', 'name', 'type', 'priority']
      }
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']]
  });
};

GeofenceBreach.getBreachStats = function(period = '24h') {
  const { Op } = require('sequelize');
  let startDate;
  
  switch (period) {
    case '1h':
      startDate = new Date(Date.now() - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
  
  return this.findAll({
    attributes: [
      'severity',
      'breachType',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      createdAt: {
        [Op.gte]: startDate
      }
    },
    group: ['severity', 'breachType']
  });
};

GeofenceBreach.bulkResolve = function(breachIds, resolvedBy, notes) {
  return this.update(
    {
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy,
      notes
    },
    {
      where: {
        id: breachIds,
        isResolved: false
      }
    }
  );
};

module.exports = GeofenceBreach;