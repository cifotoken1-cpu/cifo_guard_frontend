/**
 * Geofence.js
 * Model untuk geofence dan area monitoring
 * Mendukung berbagai jenis geofence (POLYGON, CIRCLE, RECTANGLE)
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Geofence = sequelize.define('Geofence', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  type: {
    type: DataTypes.ENUM('POLYGON', 'CIRCLE', 'RECTANGLE'),
    allowNull: false,
    validate: {
      isIn: [['POLYGON', 'CIRCLE', 'RECTANGLE']]
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

        // Validasi berdasarkan type
        if (this.type === 'CIRCLE') {
          if (!value.center || !value.radius) {
            throw new Error('Circle geofence requires center and radius');
          }
          if (!value.center.lat || !value.center.lng) {
            throw new Error('Circle center must have lat and lng');
          }
          if (typeof value.radius !== 'number' || value.radius <= 0) {
            throw new Error('Circle radius must be a positive number');
          }
        } else if (this.type === 'RECTANGLE') {
          if (!value.bounds) {
            throw new Error('Rectangle geofence requires bounds');
          }
          const { north, south, east, west } = value.bounds;
          if (typeof north !== 'number' || typeof south !== 'number' ||
              typeof east !== 'number' || typeof west !== 'number') {
            throw new Error('Rectangle bounds must be numbers');
          }
          if (north <= south || east <= west) {
            throw new Error('Invalid rectangle bounds');
          }
        } else if (this.type === 'POLYGON') {
          if (!Array.isArray(value.points) || value.points.length < 3) {
            throw new Error('Polygon geofence requires at least 3 points');
          }
          for (const point of value.points) {
            if (!point.lat || !point.lng) {
              throw new Error('Each polygon point must have lat and lng');
            }
          }
        }
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    field: 'is_active'
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'MEDIUM',
    allowNull: false
  },
  alertSettings: {
    type: DataTypes.JSONB,
    defaultValue: {
      onEntry: true,
      onExit: true,
      notifyRoles: ['supervisor', 'coordinator']
    },
    field: 'notification_settings',
    validate: {
      isValidAlertSettings(value) {
        if (value && typeof value === 'object') {
          if (value.notifyRoles && !Array.isArray(value.notifyRoles)) {
            throw new Error('notifyRoles must be an array');
          }
        }
      }
    }
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata for geofence'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'created_by'
  },
  updatedBy: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'updated_by'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  tableName: 'geofences',
  timestamps: true,
  indexes: [
    {
      fields: ['isActive']
    },
    {
      fields: ['type']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['name'],
      type: 'BTREE'
    }
  ],
  hooks: {
    beforeUpdate: (geofence) => {
      geofence.updatedAt = new Date();
    }
  }
});

// Instance Methods
Geofence.prototype.calculateArea = function() {
  const { type, coordinates } = this;
  
  switch (type) {
    case 'CIRCLE':
      return Math.PI * Math.pow(coordinates.radius, 2);
    case 'RECTANGLE':
      const { bounds } = coordinates;
      const width = this.calculateDistance(
        bounds.north, bounds.west,
        bounds.north, bounds.east
      );
      const height = this.calculateDistance(
        bounds.north, bounds.west,
        bounds.south, bounds.west
      );
      return width * height;
    case 'POLYGON':
      // Shoelace formula for polygon area
      const { points } = coordinates;
      let area = 0;
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].lat * points[j].lng;
        area -= points[j].lat * points[i].lng;
      }
      return Math.abs(area) / 2;
    default:
      return 0;
  }
};

Geofence.prototype.getCenter = function() {
  const { type, coordinates } = this;
  
  switch (type) {
    case 'CIRCLE':
      return coordinates.center;
    case 'RECTANGLE':
      const { bounds } = coordinates;
      return {
        lat: (bounds.north + bounds.south) / 2,
        lng: (bounds.east + bounds.west) / 2
      };
    case 'POLYGON':
      const { points } = coordinates;
      const sumLat = points.reduce((sum, point) => sum + point.lat, 0);
      const sumLng = points.reduce((sum, point) => sum + point.lng, 0);
      return {
        lat: sumLat / points.length,
        lng: sumLng / points.length
      };
    default:
      return { lat: 0, lng: 0 };
  }
};

Geofence.prototype.getBounds = function() {
  const { type, coordinates } = this;
  
  switch (type) {
    case 'CIRCLE':
      const { center, radius } = coordinates;
      // Approximate bounds for circle (simplified)
      const latOffset = radius / 111320; // rough conversion
      const lngOffset = radius / (111320 * Math.cos(center.lat * Math.PI / 180));
      return {
        north: center.lat + latOffset,
        south: center.lat - latOffset,
        east: center.lng + lngOffset,
        west: center.lng - lngOffset
      };
    case 'RECTANGLE':
      return coordinates.bounds;
    case 'POLYGON':
      const { points } = coordinates;
      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      return {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
      };
    default:
      return { north: 0, south: 0, east: 0, west: 0 };
  }
};

Geofence.prototype.calculateDistance = function(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Class Methods
Geofence.getActiveGeofences = function() {
  return this.findAll({
    where: { isActive: true },
    order: [['priority', 'DESC'], ['createdAt', 'DESC']]
  });
};

Geofence.getGeofencesByType = function(type) {
  return this.findAll({
    where: { type },
    order: [['createdAt', 'DESC']]
  });
};

Geofence.getCriticalGeofences = function() {
  return this.findAll({
    where: {
      priority: 'CRITICAL',
      isActive: true
    },
    order: [['createdAt', 'DESC']]
  });
};

Geofence.searchGeofences = function(searchTerm) {
  const { Op } = require('sequelize');
  return this.findAll({
    where: {
      [Op.or]: [
        { name: { [Op.iLike]: `%${searchTerm}%` } },
        { description: { [Op.iLike]: `%${searchTerm}%` } }
      ]
    },
    order: [['createdAt', 'DESC']]
  });
};

Geofence.getGeofenceStats = function() {
  return this.findAll({
    attributes: [
      'type',
      'priority',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['type', 'priority']
  });
};

module.exports = Geofence;