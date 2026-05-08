/**
 * Incident Model
 * Represents security incidents in the system
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Incident = sequelize.define('Incident', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  incidentNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'incident_number'
  },
  type: {
    type: DataTypes.ENUM(
      'SECURITY_BREACH', 'FIRE', 'MEDICAL_EMERGENCY', 'THEFT', 'VANDALISM',
      'SUSPICIOUS_ACTIVITY', 'EQUIPMENT_FAILURE', 'POWER_OUTAGE', 'FLOOD',
      'EARTHQUAKE', 'PANIC_ALERT', 'UNAUTHORIZED_ACCESS', 'OTHER'
    ),
    allowNull: false
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    allowNull: false,
    defaultValue: 'MEDIUM'
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'OPEN'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  location: {
    type: DataTypes.JSON,
    allowNull: false,
    validate: {
      isValidLocation(value) {
        if (!value || typeof value !== 'object') {
          throw new Error('Location must be an object');
        }
        if (typeof value.latitude !== 'number' || typeof value.longitude !== 'number') {
          throw new Error('Location must include valid latitude and longitude');
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
  reportedBy: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'reported_by',
    references: {
      model: 'TeamMembers',
      key: 'id'
    }
  },
  assignedTo: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'assigned_to',
    references: {
      model: 'TeamMembers',
      key: 'id'
    }
  },
  assignedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'assigned_at'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'resolved_at'
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'closed_at'
  },
  occurredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'occurred_at',
    defaultValue: DataTypes.NOW
  },
  // escalatedAt: {
  //   type: DataTypes.DATE,
  //   allowNull: true,
  //   field: 'escalated_at'
  // },
  // escalatedBy: {
  //   type: DataTypes.STRING,
  //   allowNull: true,
  //   field: 'escalated_by',
  //   references: {
  //     model: 'TeamMembers',
  //     key: 'id'
  //   }
  // },
  // escalationReason: {
  //   type: DataTypes.TEXT,
  //   allowNull: true,
  //   field: 'escalation_reason'
  // },
  // resolution: {
  //   type: DataTypes.TEXT,
  //   allowNull: true
  // },
  // notes: {
  //   type: DataTypes.JSON,
  //   allowNull: true,
  //   defaultValue: []
  // },
  attachments: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  // estimatedResolutionTime: {
  //   type: DataTypes.DATE,
  //   allowNull: true,
  //   field: 'estimated_resolution_time'
  // },
  // actualResolutionTime: {
  //   type: DataTypes.INTEGER, // in minutes
  //   allowNull: true,
  //   field: 'actual_resolution_time'
  // },
  // impactLevel: {
  //   type: DataTypes.ENUM('MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'SEVERE'),
  //   allowNull: true,
  //   defaultValue: 'LOW',
  //   field: 'impact_level'
  // },
  // affectedAreas: {
  //   type: DataTypes.JSON,
  //   allowNull: true,
  //   defaultValue: [],
  //   field: 'affected_areas'
  // },
  // relatedIncidents: {
  //   type: DataTypes.JSON,
  //   allowNull: true,
  //   defaultValue: [],
  //   field: 'related_incidents'
  // },
  // externalReferenceId: {
  //   type: DataTypes.STRING,
  //   allowNull: true,
  //   field: 'external_reference_id'
  // },
  // isPublic: {
  //   type: DataTypes.BOOLEAN,
  //   allowNull: false,
  //   defaultValue: false,
  //   field: 'is_public'
  // },
  // createdBy: {
  //   type: DataTypes.STRING,
  //   allowNull: false,
  //   field: 'created_by',
  //   references: {
  //     model: 'TeamMembers',
  //     key: 'id'
  //   }
  // },
  // updatedBy: {
  //   type: DataTypes.STRING,
  //   allowNull: true,
  //   field: 'updated_by',
  //   references: {
  //     model: 'TeamMembers',
  //     key: 'id'
  //   }
  // }
}, {
  tableName: 'incidents',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['type']
    },
    {
      fields: ['assignedTo']
    },
    {
      fields: ['reportedBy']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['status', 'priority']
    },
    {
      fields: ['type', 'status']
    }
  ],
  hooks: {
    beforeUpdate: (incident, options) => {
      // Auto-set resolution time when status changes to RESOLVED
      if (incident.changed('status') && incident.status === 'RESOLVED' && !incident.resolvedAt) {
        incident.resolvedAt = new Date();
        
        // Calculate actual resolution time in minutes
        if (incident.createdAt) {
          const resolutionTimeMs = incident.resolvedAt - incident.createdAt;
          incident.actualResolutionTime = Math.round(resolutionTimeMs / (1000 * 60));
        }
      }
      
      // Auto-set closed time when status changes to CLOSED
      if (incident.changed('status') && incident.status === 'CLOSED' && !incident.closedAt) {
        incident.closedAt = new Date();
      }
      
      // Auto-set assigned time when assignedTo changes
      if (incident.changed('assignedTo') && incident.assignedTo && !incident.assignedAt) {
        incident.assignedAt = new Date();
      }
    }
  }
});

// Define associations
Incident.associate = (models) => {
  // Note: TeamMember and SecurityActivity associations removed as they use raw MySQL queries
  // TeamMember data is fetched separately using TeamMember.getById()
  // Activities are fetched separately using SecurityActivity.getByRefId()
};

// Instance methods
Incident.prototype.addNote = function(noteData) {
  const notes = this.notes || [];
  const newNote = {
    id: `NOTE_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    content: noteData.content,
    isInternal: noteData.isInternal || false,
    addedBy: noteData.addedBy,
    addedAt: noteData.addedAt || new Date().toISOString()
  };
  notes.push(newNote);
  return this.update({ notes });
};

Incident.prototype.addAttachment = function(attachmentData) {
  const attachments = this.attachments || [];
  const newAttachment = {
    id: `ATT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    filename: attachmentData.filename,
    originalName: attachmentData.originalName,
    mimeType: attachmentData.mimeType,
    size: attachmentData.size,
    url: attachmentData.url,
    uploadedBy: attachmentData.uploadedBy,
    uploadedAt: attachmentData.uploadedAt || new Date().toISOString()
  };
  attachments.push(newAttachment);
  return this.update({ attachments });
};

Incident.prototype.addTag = function(tag) {
  const tags = this.tags || [];
  if (!tags.includes(tag)) {
    tags.push(tag);
    return this.update({ tags });
  }
  return Promise.resolve(this);
};

Incident.prototype.removeTag = function(tag) {
  const tags = this.tags || [];
  const updatedTags = tags.filter(t => t !== tag);
  return this.update({ tags: updatedTags });
};

Incident.prototype.isOverdue = function() {
  if (!this.estimatedResolutionTime) {
    return false;
  }
  return new Date() > new Date(this.estimatedResolutionTime) && 
         !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(this.status);
};

Incident.prototype.getDurationMinutes = function() {
  const endTime = this.resolvedAt || this.closedAt || new Date();
  const startTime = this.createdAt;
  return Math.round((endTime - startTime) / (1000 * 60));
};

// Class methods
Incident.getActiveIncidents = function() {
  return this.findAll({
    where: {
      status: { [DataTypes.Op.in]: ['OPEN', 'IN_PROGRESS'] }
    },
    order: [['priority', 'DESC'], ['createdAt', 'ASC']]
  });
};

Incident.getCriticalIncidents = function() {
  return this.findAll({
    where: {
      priority: 'CRITICAL',
      status: { [DataTypes.Op.in]: ['OPEN', 'IN_PROGRESS'] }
    },
    order: [['createdAt', 'ASC']]
  });
};

Incident.getOverdueIncidents = function() {
  return this.findAll({
    where: {
      estimatedResolutionTime: {
        [DataTypes.Op.lt]: new Date()
      },
      status: { [DataTypes.Op.in]: ['OPEN', 'IN_PROGRESS'] }
    },
    order: [['estimatedResolutionTime', 'ASC']]
  });
};

Incident.getIncidentsByLocation = function(latitude, longitude, radiusKm = 1) {
  // This is a simplified version - in production you'd use PostGIS or similar
  return this.findAll({
    where: sequelize.literal(`
      (
        6371 * acos(
          cos(radians(${latitude})) * 
          cos(radians(JSON_EXTRACT(location, '$.latitude'))) * 
          cos(radians(JSON_EXTRACT(location, '$.longitude')) - radians(${longitude})) + 
          sin(radians(${latitude})) * 
          sin(radians(JSON_EXTRACT(location, '$.latitude')))
        )
      ) <= ${radiusKm}
    `),
    order: [['createdAt', 'DESC']]
  });
};

module.exports = Incident;