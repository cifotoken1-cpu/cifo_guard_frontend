const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const QRCode = sequelize.define('QRCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  entryPoint: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'entry_point',
    validate: {
      notEmpty: true
    }
  },
  qrData: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
    field: 'qr_data',
    validate: {
      notEmpty: true
    }
  },
  locationLat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
    field: 'location_lat',
    validate: {
      min: -90,
      max: 90
    }
  },
  locationLng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
    field: 'location_lng',
    validate: {
      min: -180,
      max: 180
    }
  },
  geofenceRadius: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 50,
    field: 'geofence_radius',
    validate: {
      min: 10,
      max: 1000
    },
    comment: 'Geofence radius in meters'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Description of the entry point'
  },
  maxDailyRegistrations: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'max_daily_registrations',
    validate: {
      min: 1
    },
    comment: 'Maximum registrations per day (null = unlimited)'
  },
  operatingHours: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'operating_hours',
    comment: 'Operating hours configuration: {start: "08:00", end: "18:00", days: [1,2,3,4,5]}'
  },
  securityLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'restricted'),
    allowNull: false,
    defaultValue: 'medium',
    field: 'security_level'
  },
  requiresApproval: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'requires_approval'
  },
  autoApproveRoles: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    field: 'auto_approve_roles',
    comment: 'Array of roles that get auto-approved'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Additional configuration and context'
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_used_at'
  },
  usageCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'usage_count'
  },
  createdBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'created_by'
  },
  updatedBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'updated_by'
  }
}, {
  tableName: 'qr_codes',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['qr_data']
    },
    {
      fields: ['entry_point']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['security_level']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['last_used_at']
    }
  ]
});

// Instance methods
QRCode.prototype.isWithinGeofence = function(lat, lng) {
  if (!lat || !lng || !this.locationLat || !this.locationLng) {
    return false;
  }

  // Calculate distance using Haversine formula
  const R = 6371000; // Earth's radius in meters
  const dLat = this.toRadians(lat - this.locationLat);
  const dLng = this.toRadians(lng - this.locationLng);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRadians(this.locationLat)) * Math.cos(this.toRadians(lat)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return distance <= this.geofenceRadius;
};

QRCode.prototype.toRadians = function(degrees) {
  return degrees * (Math.PI/180);
};

QRCode.prototype.isOperational = function() {
  if (!this.isActive) return false;
  
  if (!this.operatingHours) return true;
  
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
  
  const { start, end, days } = this.operatingHours;
  
  // Check if current day is in operating days
  if (days && !days.includes(currentDay)) {
    return false;
  }
  
  // Check if current time is within operating hours
  if (start && end) {
    return currentTime >= start && currentTime <= end;
  }
  
  return true;
};

QRCode.prototype.canAcceptRegistration = async function() {
  if (!this.isOperational()) return false;
  
  if (!this.maxDailyRegistrations) return true;
  
  // Check today's registration count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const VisitorRegistration = require('./VisitorRegistration');
  const todayCount = await VisitorRegistration.count({
    where: {
      qrCodeId: this.id,
      createdAt: {
        [sequelize.Sequelize.Op.gte]: today,
        [sequelize.Sequelize.Op.lt]: tomorrow
      }
    }
  });
  
  return todayCount < this.maxDailyRegistrations;
};

// Class methods
QRCode.findActive = function(options = {}) {
  return this.findAll({
    where: {
      isActive: true
    },
    order: [['entryPoint', 'ASC']],
    ...options
  });
};

QRCode.findByEntryPoint = function(entryPoint, options = {}) {
  return this.findOne({
    where: {
      entryPoint: entryPoint,
      isActive: true
    },
    ...options
  });
};

QRCode.findByQRData = function(qrData, options = {}) {
  return this.findOne({
    where: {
      qrData: qrData
    },
    ...options
  });
};

QRCode.generateQRData = function(entryPoint) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${entryPoint}-${timestamp}-${random}`;
};

// Hooks
QRCode.beforeCreate(async (qrCode, options) => {
  // Auto-generate QR data if not provided
  if (!qrCode.qrData) {
    qrCode.qrData = QRCode.generateQRData(qrCode.entryPoint);
  }
});

QRCode.beforeUpdate(async (qrCode, options) => {
  // Update usage tracking
  if (qrCode.changed('lastUsedAt')) {
    qrCode.usageCount = (qrCode.usageCount || 0) + 1;
  }
});

// Associations
QRCode.associate = function(models) {
  QRCode.hasMany(models.VisitorRegistration, {
    foreignKey: 'qrCodeId',
    as: 'registrations'
  });
};

module.exports = QRCode;