const Alert = require('../models/Alert');
const AlertRecipient = require('../models/AlertRecipient');
const TeamMember = require('../models/TeamMember');
const Incident = require('../models/Incident');
const { Op } = require('sequelize');
const { broadcastAlert, broadcastAlertUpdate } = require('../services/websocket-service');
const { logActivity } = require('../services/activity-service');
const { validateCoordinates, calculateDistance } = require('../utils/geo-utils');
const { sanitizeInput, validateUUID } = require('../utils/validation-utils');

class AlertController {
  /**
   * Create a new alert
   */
  async createAlert(req, res) {
    try {
      const {
        title,
        message,
        type,
        category,
        severity = 'WARNING',
        priority = 'MEDIUM',
        isEmergency = false,
        isBroadcast = false,
        isRecurring = false,
        location,
        targetZones = [],
        targetBuildings = [],
        targetRoles = [],
        targetTeams = [],
        targetUsers = [],
        geofenceIds = [],
        scheduledAt,
        startsAt,
        endsAt,
        expiresAt,
        recurrencePattern,
        content = {},
        attachments = [],
        mediaUrls = [],
        actionButtons = [],
        channels = ['app'],
        deliveryConfig = {},
        source = 'manual',
        sourceId,
        context = {},
        incidentId,
        cameraIds = [],
        relatedAlerts = [],
        tags = [],
        metadata = {},
        customFields = {}
      } = req.body;

      // Validate required fields
      if (!title || !message || !type) {
        return res.status(400).json({
          success: false,
          message: 'Title, message, and type are required'
        });
      }

      // Validate location if provided
      if (location && (!validateCoordinates(location.lat, location.lng))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates provided'
        });
      }

      // Validate incident reference if provided
      if (incidentId && !validateUUID(incidentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid incident ID format'
        });
      }

      // Validate date fields
      const now = new Date();
      if (scheduledAt && new Date(scheduledAt) <= now) {
        return res.status(400).json({
          success: false,
          message: 'Scheduled time must be in the future'
        });
      }

      if (expiresAt && new Date(expiresAt) <= now) {
        return res.status(400).json({
          success: false,
          message: 'Expiration time must be in the future'
        });
      }

      // Validate channels
      const validChannels = ['app', 'email', 'sms', 'push', 'webhook'];
      const invalidChannels = channels.filter(channel => !validChannels.includes(channel));
      if (invalidChannels.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid channels: ${invalidChannels.join(', ')}`
        });
      }

      // Create alert
      const alertData = {
        title: sanitizeInput(title),
        message: sanitizeInput(message),
        type,
        category: category ? sanitizeInput(category) : null,
        severity,
        priority,
        isEmergency,
        isBroadcast,
        isRecurring,
        location,
        targetZones,
        targetBuildings,
        targetRoles,
        targetTeams,
        targetUsers,
        geofenceIds,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        startsAt: startsAt ? new Date(startsAt) : now,
        endsAt: endsAt ? new Date(endsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        recurrencePattern,
        content,
        attachments,
        mediaUrls,
        actionButtons,
        channels,
        deliveryConfig,
        source,
        sourceId,
        context,
        incidentId,
        cameraIds,
        relatedAlerts,
        tags,
        metadata,
        customFields,
        createdBy: req.user?.id || 'system'
      };

      const alert = await Alert.create(alertData);

      // Create alert recipients based on targeting
      await this.createAlertRecipients(alert, {
        targetZones,
        targetBuildings,
        targetRoles,
        targetTeams,
        targetUsers,
        channels
      });

      // Log activity
      await logActivity({
        type: 'ALERT_CREATED',
        description: `Alert created: ${alert.title}`,
        entityType: 'Alert',
        entityId: alert.id,
        userId: req.user?.id,
        metadata: {
          alertId: alert.alertId,
          type: alert.type,
          severity: alert.severity,
          isEmergency: alert.isEmergency
        }
      });

      // Broadcast alert if not scheduled
      if (!scheduledAt || new Date(scheduledAt) <= now) {
        await broadcastAlert(alert);
      }

      res.status(201).json({
        success: true,
        message: 'Alert created successfully',
        data: alert
      });
    } catch (error) {
      console.error('Error creating alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create alert',
        error: error.message
      });
    }
  }

  /**
   * Get alerts with filtering and pagination
   */
  async getAlerts(req, res) {
    try {

      
      const {
        page = 1,
        limit = 20,
        type,
        category,
        severity,
        priority,
        status,
        isEmergency,
        isBroadcast,
        source,
        incidentId,
        search,
        startDate,
        endDate,
        tags,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const where = { deletedAt: null };
      const include = [];

      // Apply filters
      if (type) where.type = type;
      if (category) where.category = category;
      if (severity) where.severity = severity;
      if (priority) where.priority = priority;
      if (status) {
        // Handle multiple status values (comma-separated)
        const statusArray = status.split(',').map(s => s.trim());
        where.status = statusArray.length > 1 ? { [Op.in]: statusArray } : status;
      }
      if (isEmergency !== undefined) where.isEmergency = isEmergency === 'true';
      if (isBroadcast !== undefined) where.isBroadcast = isBroadcast === 'true';
      if (source) where.source = source;
      if (incidentId) where.incidentId = incidentId;

      // Date range filter
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      // Search filter
      if (search) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { message: { [Op.iLike]: `%${search}%` } },
          { alertId: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Tags filter
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        where.tags = { [Op.contains]: tagArray };
      }

      // Include related data
      include.push({
        model: Incident,
        as: 'incident',
        attributes: ['id', 'incidentNumber', 'title', 'status']
      });

      include.push({
        model: AlertRecipient,
        as: 'recipients',
        attributes: ['id', 'recipientType', 'channel', 'deliveryStatus']
      });

      const { count, rows: alerts } = await Alert.findAndCountAll({
        where,
        include,
        limit: parseInt(limit),
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        distinct: true
      });

      res.json({
        alerts,
        count,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alerts',
        error: error.message
      });
    }
  }

  /**
   * Get alert by ID
   */
  async getAlertById(req, res) {
    try {
      const { id } = req.params;

      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid alert ID format'
        });
      }

      const alert = await Alert.findOne({
        where: { id, deletedAt: null },
        include: [
          {
            model: Incident,
            as: 'incident',
            attributes: ['id', 'incidentNumber', 'title', 'status', 'severity']
          },
          {
            model: AlertRecipient,
            as: 'recipients',
            include: [
              {
                model: Alert,
                as: 'alert',
                attributes: ['id', 'alertId', 'title']
              }
            ]
          }
        ]
      });

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      console.error('Error fetching alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alert',
        error: error.message
      });
    }
  }

  /**
   * Update alert
   */
  async updateAlert(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid alert ID format'
        });
      }

      const alert = await Alert.findOne({
        where: { id, deletedAt: null }
      });

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      // Validate location if provided
      if (updateData.location && !validateCoordinates(updateData.location.lat, updateData.location.lng)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates provided'
        });
      }

      // Sanitize text fields
      if (updateData.title) updateData.title = sanitizeInput(updateData.title);
      if (updateData.message) updateData.message = sanitizeInput(updateData.message);
      if (updateData.category) updateData.category = sanitizeInput(updateData.category);

      // Update alert
      updateData.updatedBy = req.user?.id || 'system';
      await alert.update(updateData);

      // Log activity
      await logActivity({
        type: 'ALERT_UPDATED',
        description: `Alert updated: ${alert.title}`,
        entityType: 'Alert',
        entityId: alert.id,
        userId: req.user?.id,
        metadata: {
          alertId: alert.alertId,
          changes: Object.keys(updateData)
        }
      });

      // Broadcast update
      await broadcastAlertUpdate(alert);

      res.json({
        success: true,
        message: 'Alert updated successfully',
        data: alert
      });
    } catch (error) {
      console.error('Error updating alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update alert',
        error: error.message
      });
    }
  }

  /**
   * Delete alert (soft delete)
   */
  async deleteAlert(req, res) {
    try {
      const { id } = req.params;

      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid alert ID format'
        });
      }

      const alert = await Alert.findOne({
        where: { id, deletedAt: null }
      });

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      // Soft delete
      await alert.update({
        deletedAt: new Date(),
        deletedBy: req.user?.id || 'system'
      });

      // Log activity
      await logActivity({
        type: 'ALERT_DELETED',
        description: `Alert deleted: ${alert.title}`,
        entityType: 'Alert',
        entityId: alert.id,
        userId: req.user?.id,
        metadata: {
          alertId: alert.alertId
        }
      });

      res.json({
        success: true,
        message: 'Alert deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete alert',
        error: error.message
      });
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(req, res) {
    try {
      const { id } = req.params;
      const { recipientId, channel, responseData } = req.body;

      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid alert ID format'
        });
      }

      const alert = await Alert.findOne({
        where: { id, deletedAt: null }
      });

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      if (!alert.canBeAcknowledged()) {
        return res.status(400).json({
          success: false,
          message: 'Alert cannot be acknowledged'
        });
      }

      // Update alert status if not already acknowledged
      if (alert.status === 'ACTIVE') {
        await alert.update({
          status: 'ACKNOWLEDGED',
          acknowledgedAt: new Date(),
          updatedBy: req.user?.id || 'system'
        });
      }

      // Update recipient status if specified
      if (recipientId && channel) {
        await AlertRecipient.update({
          deliveryStatus: 'ACKNOWLEDGED',
          acknowledgedAt: new Date(),
          responseData
        }, {
          where: {
            alertId: id,
            recipientId,
            channel
          }
        });
      }

      // Log activity
      await logActivity({
        type: 'ALERT_ACKNOWLEDGED',
        description: `Alert acknowledged: ${alert.title}`,
        entityType: 'Alert',
        entityId: alert.id,
        userId: req.user?.id,
        metadata: {
          alertId: alert.alertId,
          recipientId,
          channel
        }
      });

      // Broadcast update
      await broadcastAlertUpdate(alert);

      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
        data: alert
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to acknowledge alert',
        error: error.message
      });
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(req, res) {
    try {
      const { id } = req.params;
      const { resolution, responseData } = req.body;

      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid alert ID format'
        });
      }

      const alert = await Alert.findOne({
        where: { id, deletedAt: null }
      });

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      if (!alert.canBeResolved()) {
        return res.status(400).json({
          success: false,
          message: 'Alert cannot be resolved'
        });
      }

      // Update alert
      const updateData = {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        updatedBy: req.user?.id || 'system'
      };

      if (resolution) {
        updateData.metadata = {
          ...alert.metadata,
          resolution: sanitizeInput(resolution),
          resolvedBy: req.user?.id || 'system'
        };
      }

      if (responseData) {
        updateData.metadata = {
          ...updateData.metadata,
          responseData
        };
      }

      await alert.update(updateData);

      // Log activity
      await logActivity({
        type: 'ALERT_RESOLVED',
        description: `Alert resolved: ${alert.title}`,
        entityType: 'Alert',
        entityId: alert.id,
        userId: req.user?.id,
        metadata: {
          alertId: alert.alertId,
          resolution
        }
      });

      // Broadcast update
      await broadcastAlertUpdate(alert);

      res.json({
        success: true,
        message: 'Alert resolved successfully',
        data: alert
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve alert',
        error: error.message
      });
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(req, res) {
    try {
      const { startDate, endDate, type, severity } = req.query;
      const where = { deletedAt: null };

      // Apply filters
      if (type) where.type = type;
      if (severity) where.severity = severity;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      const stats = await Alert.findAll({
        where,
        attributes: [
          [Alert.sequelize.fn('COUNT', '*'), 'totalAlerts'],
          [Alert.sequelize.fn('COUNT', Alert.sequelize.literal("CASE WHEN status = 'ACTIVE' THEN 1 END")), 'activeAlerts'],
          [Alert.sequelize.fn('COUNT', Alert.sequelize.literal("CASE WHEN status = 'ACKNOWLEDGED' THEN 1 END")), 'acknowledgedAlerts'],
          [Alert.sequelize.fn('COUNT', Alert.sequelize.literal("CASE WHEN status = 'RESOLVED' THEN 1 END")), 'resolvedAlerts'],
          [Alert.sequelize.fn('COUNT', Alert.sequelize.literal("CASE WHEN is_emergency = true THEN 1 END")), 'emergencyAlerts'],
          [Alert.sequelize.fn('COUNT', Alert.sequelize.literal("CASE WHEN severity = 'CRITICAL' THEN 1 END")), 'criticalAlerts'],
          [Alert.sequelize.fn('AVG', Alert.sequelize.literal('delivered_count::float / NULLIF(total_recipients, 0)')), 'avgDeliveryRate'],
          [Alert.sequelize.fn('AVG', Alert.sequelize.literal('acknowledged_count::float / NULLIF(total_recipients, 0)')), 'avgAcknowledgmentRate']
        ],
        raw: true
      });

      // Get alerts by type
      const alertsByType = await Alert.findAll({
        where,
        attributes: [
          'type',
          [Alert.sequelize.fn('COUNT', '*'), 'count']
        ],
        group: ['type'],
        raw: true
      });

      // Get alerts by severity
      const alertsBySeverity = await Alert.findAll({
        where,
        attributes: [
          'severity',
          [Alert.sequelize.fn('COUNT', '*'), 'count']
        ],
        group: ['severity'],
        raw: true
      });

      res.json({
        success: true,
        data: {
          overview: stats[0] || {},
          byType: alertsByType,
          bySeverity: alertsBySeverity
        }
      });
    } catch (error) {
      console.error('Error fetching alert statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alert statistics',
        error: error.message
      });
    }
  }

  /**
   * Get alerts in radius
   */
  async getAlertsInRadius(req, res) {
    try {
      const { lat, lng, radius = 1000 } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
      }

      if (!validateCoordinates(parseFloat(lat), parseFloat(lng))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates provided'
        });
      }

      const alerts = await Alert.findAll({
          where: {
            deletedAt: null,
            coordinatesLat: {
              [Op.ne]: null
            },
            coordinatesLng: {
              [Op.ne]: null
            },
            [Op.and]: Alert.sequelize.literal(
              `ST_DWithin(ST_Point(coordinates_lng, coordinates_lat)::geography, ST_Point(${lng}, ${lat})::geography, ${radius})`
            )
          },
        include: [
          {
            model: AlertRecipient,
            as: 'recipients',
            attributes: ['deliveryStatus', 'channel']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // Calculate distances
      const alertsWithDistance = alerts.map(alert => {
        const distance = alert.location && alert.location.lat && alert.location.lng
          ? calculateDistance(
              parseFloat(lat),
              parseFloat(lng),
              alert.location.lat,
              alert.location.lng
            )
          : null;

        return {
          ...alert.toJSON(),
          distance
        };
      });

      res.json({
        success: true,
        data: {
          alerts: alertsWithDistance,
          center: { lat: parseFloat(lat), lng: parseFloat(lng) },
          radius: parseInt(radius)
        }
      });
    } catch (error) {
      console.error('Error fetching alerts in radius:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch alerts in radius',
        error: error.message
      });
    }
  }

  /**
   * Cleanup expired alerts
   */
  async cleanupExpired(req, res) {
    try {
      const expiredAlerts = await Alert.findExpired();
      
      for (const alert of expiredAlerts) {
        await alert.update({
          status: 'EXPIRED',
          updatedBy: 'system'
        });
      }

      // Log activity
      if (expiredAlerts.length > 0) {
        await logActivity({
          type: 'ALERTS_CLEANUP',
          description: `Cleaned up ${expiredAlerts.length} expired alerts`,
          entityType: 'Alert',
          userId: req.user?.id || 'system',
          metadata: {
            count: expiredAlerts.length,
            alertIds: expiredAlerts.map(a => a.alertId)
          }
        });
      }

      res.json({
        success: true,
        message: `Cleaned up ${expiredAlerts.length} expired alerts`,
        data: {
          count: expiredAlerts.length
        }
      });
    } catch (error) {
      console.error('Error cleaning up expired alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup expired alerts',
        error: error.message
      });
    }
  }

  /**
   * Create alert recipients based on targeting criteria
   */
  async createAlertRecipients(alert, targeting) {
    const {
      targetZones,
      targetBuildings,
      targetRoles,
      targetTeams,
      targetUsers,
      channels
    } = targeting;

    const recipients = new Set();

    try {
      // Add specific users
      if (targetUsers && targetUsers.length > 0) {
        const users = await TeamMember.getAll({
          id: targetUsers.join(','),
          isActive: true
        });
        
        users.forEach(user => {
          recipients.add({
            type: 'USER',
            id: user.id,
            name: user.name,
            contact: {
              email: user.email,
              phone: user.phone
            }
          });
        });
      }

      // Add users by role
      if (targetRoles && targetRoles.length > 0) {
        const users = await TeamMember.getAll({
          role: targetRoles.join(','),
          isActive: true
        });
        
        users.forEach(user => {
          recipients.add({
            type: 'USER',
            id: user.id,
            name: user.name,
            contact: {
              email: user.email,
              phone: user.phone
            }
          });
        });
      }

      // Add users by team
      if (targetTeams && targetTeams.length > 0) {
        const users = await TeamMember.getAll({
          team: targetTeams.join(','),
          isActive: true
        });
        
        users.forEach(user => {
          recipients.add({
            type: 'USER',
            id: user.id,
            name: user.name,
            contact: {
              email: user.email,
              phone: user.phone
            }
          });
        });
      }

      // Create AlertRecipient records
      const recipientRecords = [];
      const uniqueRecipients = Array.from(recipients);
      
      for (const recipient of uniqueRecipients) {
        for (const channel of channels) {
          recipientRecords.push({
            alertId: alert.id,
            recipientType: recipient.type,
            recipientId: recipient.id,
            recipientName: recipient.name,
            recipientContact: recipient.contact,
            channel,
            deliveryStatus: 'PENDING'
          });
        }
      }

      if (recipientRecords.length > 0) {
        await AlertRecipient.bulkCreate(recipientRecords);
      }

      return recipientRecords.length;
    } catch (error) {
      console.error('Error creating alert recipients:', error);
      throw error;
    }
  }

  /**
   * Create a panic alert with emergency configuration
   */
  async createPanicAlert(req, res) {
    try {
      const {
        requestId,
        userId,
        type = 'EMERGENCY',
        gps: rawGps,
        metadata = {},
        accuracy,
        timestamp
      } = req.body;

      // Normalize GPS: accept both {lat,lng} and {latitude,longitude}
      const gps = rawGps ? {
        lat: rawGps.lat ?? rawGps.latitude,
        lng: rawGps.lng ?? rawGps.longitude,
        accuracy: rawGps.accuracy
      } : null;

      // Validate required fields
      if (!requestId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Request ID and User ID are required'
        });
      }

      // Validate GPS coordinates if provided
      if (gps && (!validateCoordinates(gps.lat, gps.lng))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid GPS coordinates provided'
        });
      }

      // Check for duplicate request ID (idempotency)
      const existingAlert = await Alert.findOne({
        where: { sourceId: requestId }
      });

      if (existingAlert) {
        return res.status(200).json({
          success: true,
          message: 'Panic alert already exists',
          data: existingAlert
        });
      }

      // Create panic alert with emergency configuration
      const alertData = {
        alertId: requestId,
        title: `Panic Alert - ${type}`,
        message: `Emergency alert from user ${userId}`,
        type: 'EMERGENCY',
        category: 'PANIC_BUTTON',
        severity: 'CRITICAL',
        priority: 'URGENT',
        isEmergency: true,
        isBroadcast: true,
        location: gps ? {
          lat: gps.lat,
          lng: gps.lng,
          accuracy: accuracy || gps.accuracy
        } : null,
        coordinatesLat: gps ? gps.lat : null,
        coordinatesLng: gps ? gps.lng : null,
        targetRoles: ['SECURITY', 'ADMIN'],
        channels: ['app', 'push'],
        source: 'panic_button',
        sourceId: requestId,
        context: {
          userId,
          panicType: type,
          timestamp: timestamp || new Date().toISOString()
        },
        metadata: {
          ...metadata,
          accuracy,
          originalRequest: {
            requestId,
            userId,
            type,
            gps,
            timestamp
          }
        },
        createdBy: userId
      };

      const alert = await Alert.create(alertData);

      // Create alert recipients for security team
      await this.createAlertRecipients(alert, {
        targetRoles: ['SECURITY', 'ADMIN'],
        channels: ['app', 'push']
      });

      // Log activity
      await logActivity({
        type: 'PANIC_ALERT_CREATED',
        description: `Panic alert created by user ${userId}`,
        entityType: 'Alert',
        entityId: alert.id,
        userId: userId,
        metadata: {
          alertId: alert.alertId,
          requestId,
          panicType: type,
          location: gps,
          isEmergency: true
        }
      });

      // Broadcast alert immediately
      await broadcastAlert(alert);

      // Auto-create linked Incident for formal case tracking
      let incident = null;
      try {
        const now = Date.now();
        const incidentLocation = gps
          ? { latitude: gps.lat, longitude: gps.lng }
          : { latitude: 0, longitude: 0 };

        incident = await Incident.create({
          id: `INC_${now}_${Math.random().toString(36).substr(2, 9)}`,
          incidentNumber: `INC-${new Date().getFullYear()}-${String(now).slice(-6)}`,
          type: 'PANIC_ALERT',
          priority: 'CRITICAL',
          status: 'OPEN',
          title: `[AUTO] Panic Alert - ${type} dari ${userId}`,
          description: `Panic alert otomatis dibuat dari panic button. Alert ID: ${alert.alertId}. User: ${userId}. Tipe: ${type}.`,
          location: incidentLocation,
          reportedBy: userId,
          metadata: {
            sourceAlertId: alert.id,
            sourceAlertAlertId: alert.alertId,
            panicType: type,
            gps,
            autoCreated: true
          }
        });

        // Link alert → incident
        await alert.update({ incidentId: incident.id });
      } catch (incidentErr) {
        console.error('[AlertController] Auto-create incident failed (non-fatal):', incidentErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'Panic alert created successfully',
        data: {
          id: alert.id,
          alertId: alert.alertId,
          requestId,
          status: 'ACTIVE',
          timestamp: alert.createdAt,
          incidentId: incident?.id || null
        }
      });
    } catch (error) {
      console.error('Error creating panic alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create panic alert',
        error: error.message
      });
    }
  }
}

module.exports = new AlertController();