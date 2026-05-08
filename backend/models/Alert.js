const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const TeamMember = require('./TeamMember');
const Incident = require('./Incident');

const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  alertId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'alert_id'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  
  // Alert classification
  type: {
    type: DataTypes.ENUM('SECURITY', 'EMERGENCY', 'MAINTENANCE', 'WEATHER', 'TRAFFIC', 'SYSTEM', 'CUSTOM'),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  severity: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    allowNull: false,
    defaultValue: 'MEDIUM'
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
    allowNull: false,
    defaultValue: 'MEDIUM'
  },
  
  // Alert status and lifecycle
  status: {
    type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'EXPIRED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'ACTIVE'
  },
  isEmergency: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_emergency'
  },
  isBroadcast: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_broadcast'
  },
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_recurring'
  },
  
  // Location and targeting
  location: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Location details: {lat, lng, address, zone, building, floor, room}'
  },
  coordinatesLat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
    field: 'coordinates_lat',
    comment: 'Latitude for spatial queries'
  },
  coordinatesLng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
    field: 'coordinates_lng',
    comment: 'Longitude for spatial queries'
  },
  targetZones: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'target_zones',
    comment: 'Array of zone identifiers'
  },
  targetBuildings: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'target_buildings',
    comment: 'Array of building identifiers'
  },
  targetRoles: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'target_roles',
    comment: 'Array of role identifiers'
  },
  targetTeams: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'target_teams',
    comment: 'Array of team identifiers'
  },
  targetUsers: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'target_users',
    comment: 'Array of user identifiers'
  },
  geofenceIds: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'geofence_ids',
    comment: 'Array of geofence IDs for location-based alerts'
  },
  
  // Timing and scheduling
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'scheduled_at'
  },
  startsAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'starts_at'
  },
  endsAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'ends_at'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'acknowledged_at'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'resolved_at'
  },
  
  // Recurrence settings
  recurrencePattern: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'recurrence_pattern',
    comment: 'Recurrence configuration: {type, interval, days, time}'
  },
  nextOccurrence: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'next_occurrence'
  },
  
  // Content and media
  content: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Rich content, HTML, markdown, etc.'
  },
  attachments: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of file references'
  },
  mediaUrls: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'media_urls',
    comment: 'Array of media URLs'
  },
  actionButtons: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'action_buttons',
    comment: 'Array of action button configs'
  },
  
  // Delivery channels
  channels: {
    type: DataTypes.JSONB,
    defaultValue: ['app'],
    validate: {
      isValidChannels(value) {
        if (!Array.isArray(value)) {
          throw new Error('Channels must be an array');
        }
        const validChannels = ['app', 'email', 'sms', 'push', 'webhook'];
        const invalidChannels = value.filter(channel => !validChannels.includes(channel));
        if (invalidChannels.length > 0) {
          throw new Error(`Invalid channels: ${invalidChannels.join(', ')}`);
        }
      }
    },
    comment: 'Delivery channels: [app, email, sms, push, webhook]'
  },
  deliveryConfig: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'delivery_config',
    comment: 'Channel-specific delivery configuration'
  },
  
  // Source and context
  source: {
    type: DataTypes.STRING(100),
    defaultValue: 'manual',
    comment: 'Source: manual, system, camera, sensor, integration'
  },
  sourceId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'source_id',
    comment: 'ID from source system'
  },
  context: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional context data'
  },
  
  // Related entities
  incidentId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'incident_id',
    references: {
      model: 'incidents',
      key: 'id'
    }
  },
  cameraIds: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'camera_ids',
    comment: 'Array of related camera IDs'
  },
  relatedAlerts: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'related_alerts',
    comment: 'Array of related alert IDs'
  },
  
  // Delivery tracking
  totalRecipients: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_recipients'
  },
  deliveredCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'delivered_count'
  },
  acknowledgedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'acknowledged_count'
  },
  failedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'failed_count'
  },
  
  // Metadata and customization
  tags: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  customFields: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'custom_fields'
  },
  
  // Audit fields
  createdBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'created_by'
  },
  updatedBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'updated_by'
  },
  
  // Soft delete
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deleted_at'
  },
  deletedBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'deleted_by'
  }
}, {
  tableName: 'alerts',
  timestamps: true,
  paranoid: false, // We handle soft delete manually
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['alert_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['severity']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['status']
    },
    {
      fields: ['is_emergency']
    },
    {
      fields: ['is_broadcast']
    },
    {
      fields: ['scheduled_at']
    },
    {
      fields: ['starts_at']
    },
    {
      fields: ['expires_at']
    },
    {
      fields: ['source']
    },
    {
      fields: ['incident_id']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['deleted_at']
    },
    {
      fields: ['status', 'priority']
    },
    {
      fields: ['type', 'severity']
    },
    {
      fields: ['status', 'is_emergency'],
      where: {
        status: 'ACTIVE'
      }
    }
  ]
});

// Instance methods
Alert.prototype.isActive = function() {
  return this.status === 'ACTIVE' && 
         (this.expiresAt === null || this.expiresAt > new Date()) &&
         this.deletedAt === null;
};

Alert.prototype.isExpired = function() {
  return this.expiresAt !== null && this.expiresAt <= new Date();
};

Alert.prototype.canBeAcknowledged = function() {
  return this.status === 'ACTIVE' && !this.isExpired();
};

Alert.prototype.canBeResolved = function() {
  return ['ACTIVE', 'ACKNOWLEDGED'].includes(this.status) && !this.isExpired();
};

Alert.prototype.getDeliveryRate = function() {
  if (this.totalRecipients === 0) return 0;
  return Math.round((this.deliveredCount / this.totalRecipients) * 100);
};

Alert.prototype.getAcknowledgmentRate = function() {
  if (this.totalRecipients === 0) return 0;
  return Math.round((this.acknowledgedCount / this.totalRecipients) * 100);
};

// Static methods
Alert.findActive = function(options = {}) {
  return this.findAll({
    where: {
      status: ['ACTIVE', 'ACKNOWLEDGED'],
      deletedAt: null,
      [sequelize.Sequelize.Op.or]: [
        { expiresAt: null },
        { expiresAt: { [sequelize.Sequelize.Op.gt]: new Date() } }
      ],
      ...options.where
    },
    ...options
  });
};

Alert.findByType = function(type, options = {}) {
  return this.findAll({
    where: {
      type,
      deletedAt: null,
      ...options.where
    },
    ...options
  });
};

Alert.findEmergency = function(options = {}) {
  return this.findAll({
    where: {
      isEmergency: true,
      status: ['ACTIVE', 'ACKNOWLEDGED'],
      deletedAt: null,
      ...options.where
    },
    order: [['priority', 'DESC'], ['created_at', 'DESC']],
    ...options
  });
};

Alert.findExpired = function(options = {}) {
  return this.findAll({
    where: {
      expiresAt: {
        [sequelize.Sequelize.Op.lte]: new Date()
      },
      status: ['ACTIVE', 'ACKNOWLEDGED'],
      deletedAt: null,
      ...options.where
    },
    ...options
  });
};

Alert.findRecurring = function(options = {}) {
  return this.findAll({
    where: {
      isRecurring: true,
      nextOccurrence: {
        [sequelize.Sequelize.Op.lte]: new Date()
      },
      deletedAt: null,
      ...options.where
    },
    ...options
  });
};

// Hooks
Alert.beforeCreate(async (alert, options) => {
  // Generate alert ID if not provided
  if (!alert.alertId) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await Alert.count({
      where: {
        alertId: {
          [sequelize.Sequelize.Op.like]: `${dateStr}-%`
        }
      }
    });
    alert.alertId = `${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
  
  // Update coordinate fields from location
  if (alert.location && alert.location.lat && alert.location.lng) {
    alert.coordinatesLat = alert.location.lat;
    alert.coordinatesLng = alert.location.lng;
  }
});

Alert.beforeUpdate(async (alert, options) => {
  // Update coordinate fields from location if changed
  if (alert.changed('location') && alert.location && alert.location.lat && alert.location.lng) {
    alert.coordinatesLat = alert.location.lat;
    alert.coordinatesLng = alert.location.lng;
  }
  
  // Update timing fields based on status changes
  if (alert.changed('status')) {
    const now = new Date();
    switch (alert.status) {
      case 'ACKNOWLEDGED':
        if (!alert.acknowledgedAt) {
          alert.acknowledgedAt = now;
        }
        break;
      case 'RESOLVED':
        if (!alert.resolvedAt) {
          alert.resolvedAt = now;
        }
        break;
    }
  }
});

// Associations
Alert.associate = function(models) {
  // Alert belongs to Incident
  Alert.belongsTo(models.Incident, {
    foreignKey: 'incidentId',
    as: 'incident'
  });
  
  // Alert has many AlertRecipients
  Alert.hasMany(models.AlertRecipient, {
    foreignKey: 'alertId',
    as: 'recipients'
  });
};

module.exports = Alert;