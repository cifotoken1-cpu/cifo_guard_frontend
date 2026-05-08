const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VisitorRegistration = sequelize.define('VisitorRegistration', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 255]
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: true,
      is: /^[+]?[0-9\s\-\(\)]+$/
    }
  },
  photoUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'photo_url',
    validate: {
      isUrl: true
    }
  },
  purpose: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'Visit'
  },
  entryPoint: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'entry_point'
  },
  locationLat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
    field: 'location_lat',
    validate: {
      min: -90,
      max: 90
    }
  },
  locationLng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
    field: 'location_lng',
    validate: {
      min: -180,
      max: 180
    }
  },
  qrCodeId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'qr_code_id',
    references: {
      model: 'qr_codes',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired', 'checked_in', 'checked_out'),
    allowNull: false,
    defaultValue: 'pending'
  },
  approvedBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'approved_by'
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approved_at'
  },
  rejectedBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'rejected_by'
  },
  rejectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'rejected_at'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  },
  checkedInAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'checked_in_at'
  },
  checkedOutAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'checked_out_at'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Additional visitor data and context'
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
  tableName: 'visitor_registrations',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['entry_point']
    },
    {
      fields: ['qr_code_id']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['status', 'created_at']
    },
    {
      fields: ['phone']
    },
    {
      fields: ['expires_at']
    }
  ]
});

// Instance methods
VisitorRegistration.prototype.isPending = function() {
  return this.status === 'pending';
};

VisitorRegistration.prototype.isApproved = function() {
  return this.status === 'approved';
};

VisitorRegistration.prototype.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

VisitorRegistration.prototype.canCheckIn = function() {
  return this.status === 'approved' && !this.checkedInAt && !this.isExpired();
};

VisitorRegistration.prototype.canCheckOut = function() {
  return this.checkedInAt && !this.checkedOutAt;
};

// Class methods
VisitorRegistration.findPending = function(options = {}) {
  return this.findAll({
    where: {
      status: 'pending'
    },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

VisitorRegistration.findByEntryPoint = function(entryPoint, options = {}) {
  return this.findAll({
    where: {
      entryPoint: entryPoint
    },
    order: [['createdAt', 'DESC']],
    ...options
  });
};

VisitorRegistration.findActiveVisitors = function(options = {}) {
  return this.findAll({
    where: {
      status: 'approved',
      checkedInAt: {
        [sequelize.Sequelize.Op.not]: null
      },
      checkedOutAt: null
    },
    order: [['checkedInAt', 'DESC']],
    ...options
  });
};

VisitorRegistration.findExpired = function(options = {}) {
  return this.findAll({
    where: {
      expiresAt: {
        [sequelize.Sequelize.Op.lt]: new Date()
      },
      status: {
        [sequelize.Sequelize.Op.ne]: 'expired'
      }
    },
    ...options
  });
};

// Hooks
VisitorRegistration.beforeCreate(async (visitor, options) => {
  // Set default expiration (24 hours from now)
  if (!visitor.expiresAt) {
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 24);
    visitor.expiresAt = expirationDate;
  }
});

VisitorRegistration.beforeUpdate(async (visitor, options) => {
  // Auto-set approval/rejection timestamps
  if (visitor.changed('status')) {
    const now = new Date();
    if (visitor.status === 'approved' && !visitor.approvedAt) {
      visitor.approvedAt = now;
    } else if (visitor.status === 'rejected' && !visitor.rejectedAt) {
      visitor.rejectedAt = now;
    }
  }
});

// Associations
VisitorRegistration.associate = function(models) {
  VisitorRegistration.belongsTo(models.QRCode, {
    foreignKey: 'qrCodeId',
    as: 'qrCode'
  });
};

module.exports = VisitorRegistration;