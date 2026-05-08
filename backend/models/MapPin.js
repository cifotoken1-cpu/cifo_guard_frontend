/**
 * MapPin.js
 * Model untuk pin/marker pada map
 * Mendukung berbagai jenis pin (alert, incident, team, camera, etc.)
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MapPin = sequelize.define('MapPin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM(
      'ALERT', 'INCIDENT', 'TEAM_MEMBER', 'CAMERA', 
      'GEOFENCE', 'PATROL_POINT', 'EMERGENCY_EXIT', 
      'CHECKPOINT', 'FACILITY', 'CUSTOM'
    ),
    allowNull: false,
    validate: {
      isIn: [[
        'ALERT', 'INCIDENT', 'TEAM_MEMBER', 'CAMERA', 
        'GEOFENCE', 'PATROL_POINT', 'EMERGENCY_EXIT', 
        'CHECKPOINT', 'FACILITY', 'CUSTOM'
      ]]
    }
  },
  coordinates: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      isValidCoordinates(value) {
        if (!value || typeof value !== 'object') {
          throw new Error('Coordinates must be a valid object');
        }
        if (typeof value.latitude !== 'number' || typeof value.longitude !== 'number') {
          throw new Error('Coordinates must have numeric latitude and longitude');
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
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'RESOLVED', 'ARCHIVED'),
    defaultValue: 'ACTIVE',
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'MEDIUM',
    allowNull: false
  },
  iconType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Icon identifier for frontend rendering'
  },
  iconColor: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      is: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i // Hex color validation
    }
  },
  size: {
    type: DataTypes.ENUM('SMALL', 'MEDIUM', 'LARGE'),
    defaultValue: 'MEDIUM',
    allowNull: false
  },
  isVisible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  isClickable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional pin metadata (custom properties, styling, etc.)'
  },
  // Reference IDs untuk linking dengan entities lain
  alertId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'alerts',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  incidentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'incidents',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  teamMemberId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'team_members',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  cameraId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'cameras',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  geofenceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'geofences',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  updatedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Auto-remove pin after this date'
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
  tableName: 'map_pins',
  timestamps: true,
  indexes: [
    {
      fields: ['type']
    },
    {
      fields: ['status']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['isVisible']
    },
    {
      fields: ['alertId']
    },
    {
      fields: ['incidentId']
    },
    {
      fields: ['teamMemberId']
    },
    {
      fields: ['cameraId']
    },
    {
      fields: ['geofenceId']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['expiresAt']
    },
    {
      // Spatial index untuk koordinat (jika database mendukung)
      fields: ['coordinates'],
      using: 'gin'
    }
  ],
  hooks: {
    beforeUpdate: (pin) => {
      pin.updatedAt = new Date();
    },
    beforeCreate: (pin) => {
      // Auto-set icon color berdasarkan priority jika tidak diset
      if (!pin.iconColor) {
        const priorityColors = {
          'LOW': '#28a745',
          'MEDIUM': '#ffc107',
          'HIGH': '#fd7e14',
          'CRITICAL': '#dc3545'
        };
        pin.iconColor = priorityColors[pin.priority] || '#6c757d';
      }
      
      // Auto-set icon type berdasarkan type jika tidak diset
      if (!pin.iconType) {
        const typeIcons = {
          'ALERT': 'alert-triangle',
          'INCIDENT': 'alert-circle',
          'TEAM_MEMBER': 'user',
          'CAMERA': 'camera',
          'GEOFENCE': 'shield',
          'PATROL_POINT': 'map-pin',
          'EMERGENCY_EXIT': 'log-out',
          'CHECKPOINT': 'check-circle',
          'FACILITY': 'building',
          'CUSTOM': 'circle'
        };
        pin.iconType = typeIcons[pin.type] || 'circle';
      }
    }
  }
});

// Instance Methods
MapPin.prototype.updateLocation = function(latitude, longitude) {
  return this.update({
    coordinates: { latitude, longitude },
    updatedBy: 'system'
  });
};

MapPin.prototype.updateStatus = function(status, updatedBy) {
  return this.update({
    status,
    updatedBy: updatedBy || 'system'
  });
};

MapPin.prototype.hide = function() {
  return this.update({ isVisible: false });
};

MapPin.prototype.show = function() {
  return this.update({ isVisible: true });
};

MapPin.prototype.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

MapPin.prototype.getDistance = function(latitude, longitude) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = this.coordinates.latitude * Math.PI / 180;
  const φ2 = latitude * Math.PI / 180;
  const Δφ = (latitude - this.coordinates.latitude) * Math.PI / 180;
  const Δλ = (longitude - this.coordinates.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Class Methods
MapPin.getVisiblePins = function(options = {}) {
  const { type, status, priority } = options;
  const whereClause = { isVisible: true };
  
  if (type) whereClause.type = type;
  if (status) whereClause.status = status;
  if (priority) whereClause.priority = priority;
  
  return this.findAll({
    where: whereClause,
    order: [['priority', 'DESC'], ['createdAt', 'DESC']]
  });
};

MapPin.getActivePins = function() {
  return this.findAll({
    where: {
      status: 'ACTIVE',
      isVisible: true
    },
    order: [['priority', 'DESC'], ['createdAt', 'DESC']]
  });
};

MapPin.getCriticalPins = function() {
  return this.findAll({
    where: {
      priority: 'CRITICAL',
      status: 'ACTIVE',
      isVisible: true
    },
    order: [['createdAt', 'DESC']]
  });
};

MapPin.getPinsByType = function(type) {
  return this.findAll({
    where: { type },
    order: [['createdAt', 'DESC']]
  });
};

MapPin.getPinsInRadius = function(centerLat, centerLng, radiusMeters) {
  // Simplified bounding box calculation
  const latOffset = radiusMeters / 111320; // rough conversion
  const lngOffset = radiusMeters / (111320 * Math.cos(centerLat * Math.PI / 180));
  
  const { Op } = require('sequelize');
  
  return this.findAll({
    where: {
      isVisible: true,
      coordinates: {
        [Op.and]: [
          sequelize.where(
            sequelize.cast(sequelize.json('coordinates.latitude'), 'float'),
            {
              [Op.between]: [centerLat - latOffset, centerLat + latOffset]
            }
          ),
          sequelize.where(
            sequelize.cast(sequelize.json('coordinates.longitude'), 'float'),
            {
              [Op.between]: [centerLng - lngOffset, centerLng + lngOffset]
            }
          )
        ]
      }
    },
    order: [['priority', 'DESC'], ['createdAt', 'DESC']]
  });
};

MapPin.cleanupExpiredPins = function() {
  const { Op } = require('sequelize');
  
  return this.destroy({
    where: {
      expiresAt: {
        [Op.lt]: new Date()
      }
    }
  });
};

MapPin.bulkUpdateStatus = function(pinIds, status, updatedBy) {
  return this.update(
    {
      status,
      updatedBy: updatedBy || 'system'
    },
    {
      where: {
        id: pinIds
      }
    }
  );
};

MapPin.bulkHide = function(pinIds) {
  return this.update(
    { isVisible: false },
    {
      where: {
        id: pinIds
      }
    }
  );
};

MapPin.bulkShow = function(pinIds) {
  return this.update(
    { isVisible: true },
    {
      where: {
        id: pinIds
      }
    }
  );
};

MapPin.getPinStats = function() {
  return this.findAll({
    attributes: [
      'type',
      'status',
      'priority',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['type', 'status', 'priority']
  });
};

MapPin.createFromAlert = function(alert, options = {}) {
  return this.create({
    type: 'ALERT',
    coordinates: {
      latitude: alert.location?.latitude || alert.latitude,
      longitude: alert.location?.longitude || alert.longitude
    },
    title: alert.title || `Alert ${alert.id}`,
    description: alert.description,
    status: 'ACTIVE',
    priority: alert.priority || 'HIGH',
    alertId: alert.id,
    createdBy: options.createdBy || 'system',
    expiresAt: options.expiresAt,
    ...options
  });
};

MapPin.createFromIncident = function(incident, options = {}) {
  return this.create({
    type: 'INCIDENT',
    coordinates: {
      latitude: incident.location?.latitude || incident.latitude,
      longitude: incident.location?.longitude || incident.longitude
    },
    title: incident.title || `Incident ${incident.id}`,
    description: incident.description,
    status: 'ACTIVE',
    priority: incident.priority || 'MEDIUM',
    incidentId: incident.id,
    createdBy: options.createdBy || 'system',
    ...options
  });
};

MapPin.createFromTeamMember = function(teamMember, options = {}) {
  return this.create({
    type: 'TEAM_MEMBER',
    coordinates: {
      latitude: teamMember.currentLocation?.latitude,
      longitude: teamMember.currentLocation?.longitude
    },
    title: teamMember.name,
    description: `${teamMember.role} - ${teamMember.status}`,
    status: 'ACTIVE',
    priority: 'LOW',
    teamMemberId: teamMember.id,
    createdBy: options.createdBy || 'system',
    ...options
  });
};

module.exports = MapPin;