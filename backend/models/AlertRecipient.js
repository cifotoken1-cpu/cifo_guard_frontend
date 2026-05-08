const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Alert = require('./Alert');

const AlertRecipient = sequelize.define('AlertRecipient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  alertId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'alert_id',
    references: {
      model: 'alerts',
      key: 'id'
    }
  },
  
  // Recipient information
  recipientType: {
    type: DataTypes.ENUM('USER', 'TEAM', 'ROLE', 'EXTERNAL'),
    allowNull: false,
    field: 'recipient_type'
  },
  recipientId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'recipient_id',
    comment: 'User ID, team ID, role name, or external identifier'
  },
  recipientName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'recipient_name'
  },
  recipientContact: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'recipient_contact',
    comment: 'Contact information: {email, phone, push_token, etc.}'
  },
  
  // Delivery tracking per channel
  channel: {
    type: DataTypes.ENUM('app', 'email', 'sms', 'push', 'webhook'),
    allowNull: false
  },
  deliveryStatus: {
    type: DataTypes.ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'ACKNOWLEDGED', 'IGNORED'),
    defaultValue: 'PENDING',
    field: 'delivery_status'
  },
  
  // Timing
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at'
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'delivered_at'
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'acknowledged_at'
  },
  failedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'failed_at'
  },
  
  // Delivery details
  deliveryAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'delivery_attempts'
  },
  lastAttemptAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_attempt_at'
  },
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'failure_reason'
  },
  deliveryMetadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'delivery_metadata',
    comment: 'Provider-specific delivery data'
  },
  
  // Response tracking
  responseData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'response_data',
    comment: 'User response, feedback, or interaction data'
  },
  responseTime: {
    type: DataTypes.INTEGER, // Store as milliseconds
    allowNull: true,
    field: 'response_time',
    comment: 'Time taken to acknowledge/respond in milliseconds'
  }
}, {
  tableName: 'alert_recipients',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['alert_id']
    },
    {
      fields: ['recipient_type']
    },
    {
      fields: ['recipient_id']
    },
    {
      fields: ['channel']
    },
    {
      fields: ['delivery_status']
    },
    {
      fields: ['sent_at']
    },
    {
      fields: ['delivered_at']
    },
    {
      fields: ['acknowledged_at']
    },
    {
      fields: ['failed_at']
    },
    {
      fields: ['alert_id', 'delivery_status']
    },
    {
      fields: ['recipient_id', 'delivery_status']
    },
    {
      fields: ['channel', 'delivery_status']
    },
    {
      fields: ['delivery_status', 'created_at'],
      where: {
        delivery_status: 'PENDING'
      }
    },
    {
      fields: ['delivery_status', 'failed_at'],
      where: {
        delivery_status: 'FAILED'
      }
    }
  ]
});

// Instance methods
AlertRecipient.prototype.isPending = function() {
  return this.deliveryStatus === 'PENDING';
};

AlertRecipient.prototype.isDelivered = function() {
  return ['SENT', 'DELIVERED', 'ACKNOWLEDGED'].includes(this.deliveryStatus);
};

AlertRecipient.prototype.isFailed = function() {
  return ['FAILED', 'BOUNCED'].includes(this.deliveryStatus);
};

AlertRecipient.prototype.isAcknowledged = function() {
  return this.deliveryStatus === 'ACKNOWLEDGED';
};

AlertRecipient.prototype.canRetry = function() {
  return this.isFailed() && this.deliveryAttempts < 3;
};

AlertRecipient.prototype.getResponseTimeInSeconds = function() {
  if (!this.responseTime) return null;
  return Math.round(this.responseTime / 1000);
};

AlertRecipient.prototype.getResponseTimeFormatted = function() {
  if (!this.responseTime) return null;
  
  const seconds = Math.floor(this.responseTime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

// Static methods
AlertRecipient.findPending = function(options = {}) {
  return this.findAll({
    where: {
      deliveryStatus: 'PENDING',
      ...options.where
    },
    order: [['created_at', 'ASC']],
    ...options
  });
};

AlertRecipient.findFailed = function(options = {}) {
  return this.findAll({
    where: {
      deliveryStatus: ['FAILED', 'BOUNCED'],
      ...options.where
    },
    order: [['failed_at', 'DESC']],
    ...options
  });
};

AlertRecipient.findRetryable = function(options = {}) {
  return this.findAll({
    where: {
      deliveryStatus: ['FAILED', 'BOUNCED'],
      deliveryAttempts: {
        [sequelize.Sequelize.Op.lt]: 3
      },
      ...options.where
    },
    order: [['last_attempt_at', 'ASC']],
    ...options
  });
};

AlertRecipient.findByAlert = function(alertId, options = {}) {
  return this.findAll({
    where: {
      alertId,
      ...options.where
    },
    ...options
  });
};

AlertRecipient.findByRecipient = function(recipientId, recipientType = null, options = {}) {
  const where = {
    recipientId,
    ...options.where
  };
  
  if (recipientType) {
    where.recipientType = recipientType;
  }
  
  return this.findAll({
    where,
    order: [['created_at', 'DESC']],
    ...options
  });
};

AlertRecipient.findByChannel = function(channel, options = {}) {
  return this.findAll({
    where: {
      channel,
      ...options.where
    },
    ...options
  });
};

AlertRecipient.getDeliveryStats = function(alertId = null, options = {}) {
  const where = alertId ? { alertId } : {};
  
  return this.findAll({
    where: {
      ...where,
      ...options.where
    },
    attributes: [
      'channel',
      'delivery_status',
      [sequelize.fn('COUNT', '*'), 'count'],
      [sequelize.fn('AVG', sequelize.col('response_time')), 'avg_response_time']
    ],
    group: ['channel', 'delivery_status'],
    raw: true
  });
};

// Hooks
AlertRecipient.beforeUpdate(async (recipient, options) => {
  const now = new Date();
  
  // Update timing fields based on status changes
  if (recipient.changed('deliveryStatus')) {
    switch (recipient.deliveryStatus) {
      case 'SENT':
        if (!recipient.sentAt) {
          recipient.sentAt = now;
        }
        break;
      case 'DELIVERED':
        if (!recipient.deliveredAt) {
          recipient.deliveredAt = now;
        }
        if (!recipient.sentAt) {
          recipient.sentAt = now;
        }
        break;
      case 'ACKNOWLEDGED':
        if (!recipient.acknowledgedAt) {
          recipient.acknowledgedAt = now;
        }
        if (!recipient.deliveredAt) {
          recipient.deliveredAt = now;
        }
        if (!recipient.sentAt) {
          recipient.sentAt = now;
        }
        // Calculate response time
        if (recipient.sentAt && !recipient.responseTime) {
          recipient.responseTime = now.getTime() - recipient.sentAt.getTime();
        }
        break;
      case 'FAILED':
      case 'BOUNCED':
        if (!recipient.failedAt) {
          recipient.failedAt = now;
        }
        recipient.deliveryAttempts += 1;
        recipient.lastAttemptAt = now;
        break;
    }
  }
});

AlertRecipient.afterCreate(async (recipient, options) => {
  // Update alert delivery counts
  await updateAlertDeliveryCounts(recipient.alertId);
});

AlertRecipient.afterUpdate(async (recipient, options) => {
  // Update alert delivery counts if status changed
  if (recipient.changed('deliveryStatus')) {
    await updateAlertDeliveryCounts(recipient.alertId);
  }
});

AlertRecipient.afterDestroy(async (recipient, options) => {
  // Update alert delivery counts
  await updateAlertDeliveryCounts(recipient.alertId);
});

// Helper function to update alert delivery counts
async function updateAlertDeliveryCounts(alertId) {
  try {
    const Alert = require('./Alert');
    
    const stats = await AlertRecipient.findAll({
      where: { alertId },
      attributes: [
        [sequelize.fn('COUNT', '*'), 'total'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN delivery_status IN ('SENT', 'DELIVERED', 'ACKNOWLEDGED') THEN 1 END")), 'delivered'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN delivery_status = 'ACKNOWLEDGED' THEN 1 END")), 'acknowledged'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN delivery_status = 'FAILED' THEN 1 END")), 'failed']
      ],
      raw: true
    });
    
    if (stats.length > 0) {
      const stat = stats[0];
      await Alert.update({
        totalRecipients: parseInt(stat.total) || 0,
        deliveredCount: parseInt(stat.delivered) || 0,
        acknowledgedCount: parseInt(stat.acknowledged) || 0,
        failedCount: parseInt(stat.failed) || 0
      }, {
        where: { id: alertId }
      });
    }
  } catch (error) {
    console.error('Error updating alert delivery counts:', error);
  }
}

// Associations
AlertRecipient.associate = function(models) {
  // AlertRecipient belongs to Alert
  AlertRecipient.belongsTo(models.Alert, {
    foreignKey: 'alertId',
    as: 'alert'
  });
};

module.exports = AlertRecipient;