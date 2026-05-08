/**
 * Incident Management API Routes
 * Handles incident creation, updates, escalation, and tracking
 */

const express = require('express');
const IncidentController = require('../controllers/IncidentController');
const { verifyToken, requireRole } = require('../middleware/auth-config');
const { trackRequest } = require('../middleware/metrics');

const router = express.Router();

/**
 * POST /api/incidents - Create new incident
 * Body: { type, priority, location, description, reportedBy, metadata? }
 */
router.post('/', trackRequest, verifyToken, async (req, res) => {
  try {
    const startTime = Date.now();
    let { type, priority, location, description, reportedBy, metadata, title, coordinates, gps } = req.body;
    
    // Track if this is from the legacy endpoint
    const isLegacyRequest = req.fromLegacyEndpoint || false;
    
    // Normalize data from both endpoints
    const normalizedLocation = {};
    
    // Handle location data from both formats
    if (typeof location === 'string') {
      // Legacy format: location is a string
      normalizedLocation.name = location;
      
      // Use coordinates if provided
      if (coordinates && coordinates.latitude && coordinates.longitude) {
        normalizedLocation.latitude = parseFloat(coordinates.latitude);
        normalizedLocation.longitude = parseFloat(coordinates.longitude);
      } else if (gps && gps.latitude && gps.longitude) {
        normalizedLocation.latitude = parseFloat(gps.latitude);
        normalizedLocation.longitude = parseFloat(gps.longitude);
      }
    } else if (location && typeof location === 'object') {
      // New format: location is an object with coordinates
      normalizedLocation.name = location.name || 'Unknown';
      normalizedLocation.latitude = parseFloat(location.latitude);
      normalizedLocation.longitude = parseFloat(location.longitude);
    } else if (!location && coordinates && coordinates.latitude && coordinates.longitude) {
      // Handle case where only coordinates are provided
      normalizedLocation.name = 'Unknown Location';
      normalizedLocation.latitude = parseFloat(coordinates.latitude);
      normalizedLocation.longitude = parseFloat(coordinates.longitude);
    }

    // Validate required fields
    if (!type || !priority || !description) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: type, priority, description',
        details: ['type', 'priority', 'description']
      });
    }

    // Validate location coordinates
    if (!normalizedLocation.latitude || !normalizedLocation.longitude || 
        isNaN(normalizedLocation.latitude) || isNaN(normalizedLocation.longitude)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Location must include valid latitude and longitude coordinates',
        details: {
          received: {
            location,
            coordinates,
            gps,
            normalized: normalizedLocation
          }
        }
      });
    }

    // Validate priority level
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validPriorities.includes(priority.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid priority level',
        validPriorities
      });
    }

    // Validate incident type
    const validTypes = [
      'SECURITY_BREACH', 'FIRE', 'MEDICAL_EMERGENCY', 'THEFT', 'VANDALISM',
      'SUSPICIOUS_ACTIVITY', 'EQUIPMENT_FAILURE', 'POWER_OUTAGE', 'FLOOD',
      'EARTHQUAKE', 'PANIC_ALERT', 'UNAUTHORIZED_ACCESS', 'OTHER',
      // Tambahkan tipe yang ada di model Incident.js untuk kompatibilitas
      'SECURITY', 'MAINTENANCE', 'EMERGENCY', 'TECHNICAL'
    ];
    if (!validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid incident type',
        validTypes
      });
    }

    const incidentData = {
      type: type.toUpperCase(),
      priority: priority.toUpperCase(),
      location: normalizedLocation,
      title: title || `${type.toUpperCase()} - ${priority.toUpperCase()}`,
      description,
      reportedBy: reportedBy || (req.user ? req.user.id : 'system'),
      metadata: metadata || {},
      createdBy: req.user ? req.user.id : 'system',
      createdAt: new Date().toISOString()
    };
    
    // Check for duplicate incidents
    const duplicateIncident = await IncidentController.checkDuplicateIncident(incidentData);
    if (duplicateIncident) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_INCIDENT',
        message: 'Similar incident already exists within the time window',
        existingIncidentId: duplicateIncident.id,
        timestamp: new Date().toISOString()
      });
    }

    const incident = await IncidentController.createIncident(incidentData);

    // Broadcast incident creation via WebSocket
    if (req.app && req.app.locals && req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'incident_created', {
        incident,
        timestamp: Date.now()
      });

      // Send high priority incidents to all supervisors
      if (['HIGH', 'CRITICAL'].includes(incidentData.priority)) {
        WebSocketService.broadcastToRole('SUPERVISOR', 'high_priority_incident', {
          incident,
          timestamp: Date.now()
        });
      }
    }
    
    // Format response based on request source
    if (isLegacyRequest) {
      // Format response for legacy endpoint
      const latency = Date.now() - startTime;
      res.status(201).json({
        success: true,
        data: {
          incidentId: incident.id,
          status: incident.status,
          incident: incident
        },
        latency: `${latency}ms`,
        timestamp: new Date().toISOString()
      });
    } else {
      // Standard response format
      res.status(201).json({
        success: true,
        data: {
          incidentId: incident.id,
          activityId: incident.activityId,
          status: incident.status
        },
        message: 'Incident created successfully'
      });
    }
  } catch (error) {
    console.error('[Incident API] Error creating incident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create incident',
      message: error.message
    });
  }
});

/**
 * GET /api/incidents - Get incidents with filters
 * Query params: status, priority, type, assignedTo, reportedBy, limit, offset, startDate, endDate
 */
router.get('/', trackRequest, verifyToken, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      type: req.query.type,
      assignedTo: req.query.assignedTo,
      reportedBy: req.query.reportedBy,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await IncidentController.getIncidents(filters);

    res.json({
      success: true,
      data: {
        incidents: result.incidents,
        total: result.total,
        filters: filters,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('[Incident API] Error getting incidents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch incidents',
      message: error.message
    });
  }
});

/**
 * GET /api/incidents/:id - Get specific incident
 */
router.get('/:id', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await IncidentController.getIncidentById(id);

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }

    res.json({
      success: true,
      data: incident
    });
  } catch (error) {
    console.error('[Incident API] Error getting incident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch incident',
      message: error.message
    });
  }
});

/**
 * PUT /api/incidents/:id - Update incident
 * Body: { status?, priority?, assignedTo?, notes?, resolution? }
 */
router.put('/:id', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];
      if (!validStatuses.includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          validStatuses
        });
      }
    }

    // Validate priority if provided
    if (updateData.priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (!validPriorities.includes(updateData.priority)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid priority level',
          validPriorities
        });
      }
    }

    updateData.updatedBy = req.user.id;
    updateData.updatedAt = new Date().toISOString();

    const updatedIncident = await IncidentController.updateIncident(id, updateData);

    if (!updatedIncident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }

    // Broadcast incident update via WebSocket
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'incident_updated', {
        incident: updatedIncident,
        changes: updateData,
        timestamp: Date.now()
      });

      // Notify assigned team member if assignment changed
      if (updateData.assignedTo) {
        WebSocketService.broadcastToUser(updateData.assignedTo, 'incident_assigned', {
          incident: updatedIncident,
          timestamp: Date.now()
        });
      }
    }

    res.json({
      success: true,
      data: updatedIncident,
      message: 'Incident updated successfully'
    });
  } catch (error) {
    console.error('[Incident API] Error updating incident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update incident',
      message: error.message
    });
  }
});

/**
 * PATCH /api/incidents/:id - Update incident (alias for PUT)
 * Body: { status?, priority?, assignedTo?, notes?, resolution? }
 */
router.patch('/:id', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];
      if (!validStatuses.includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          validStatuses
        });
      }
    }

    // Validate priority if provided
    if (updateData.priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (!validPriorities.includes(updateData.priority)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid priority level',
          validPriorities
        });
      }
    }

    updateData.updatedBy = req.user.id;
    updateData.updatedAt = new Date().toISOString();

    const updatedIncident = await IncidentController.updateIncident(id, updateData);

    if (!updatedIncident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }

    // Broadcast incident update via WebSocket
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'incident_updated', {
        incident: updatedIncident,
        changes: updateData,
        timestamp: Date.now()
      });

      // Notify assigned team member if assignment changed
      if (updateData.assignedTo) {
        WebSocketService.broadcastToUser(updateData.assignedTo, 'incident_assigned', {
          incident: updatedIncident,
          timestamp: Date.now()
        });
      }
    }

    res.json({
      success: true,
      data: updatedIncident,
      message: 'Incident updated successfully'
    });
  } catch (error) {
    console.error('[Incident API] Error updating incident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update incident',
      message: error.message
    });
  }
});

/**
 * POST /api/incidents/:id/escalate - Escalate incident
 * Body: { reason, escalatedTo?, newPriority? }
 */
router.post('/:id/escalate', trackRequest, verifyToken, requireRole(['SUPERVISOR', 'COORDINATOR']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, escalatedTo, newPriority } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Escalation reason is required'
      });
    }

    const escalationData = {
      reason,
      escalatedTo,
      newPriority,
      escalatedBy: req.user.id,
      escalatedAt: new Date().toISOString()
    };

    const result = await IncidentController.escalateIncident(id, escalationData);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }

    // Broadcast escalation notification
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'incident_escalated', {
        incident: result,
        escalation: escalationData,
        timestamp: Date.now()
      });

      // Notify escalation target
      if (escalatedTo) {
        WebSocketService.broadcastToUser(escalatedTo, 'incident_escalated_to_you', {
          incident: result,
          reason,
          timestamp: Date.now()
        });
      }
    }

    res.json({
      success: true,
      data: result,
      message: 'Incident escalated successfully'
    });
  } catch (error) {
    console.error('[Incident API] Error escalating incident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to escalate incident',
      message: error.message
    });
  }
});

/**
 * GET /api/incidents/:id/timeline - Get incident timeline/activity log
 */
router.get('/:id/timeline', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const timeline = await IncidentController.getIncidentTimeline(id);

    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    console.error('[Incident API] Error getting incident timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch incident timeline',
      message: error.message
    });
  }
});

/**
 * POST /api/incidents/:id/notes - Add note to incident
 * Body: { note, isInternal? }
 */
router.post('/:id/notes', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { note, isInternal } = req.body;

    if (!note || note.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Note content is required'
      });
    }

    const noteData = {
      note: note.trim(),
      isInternal: isInternal || false,
      addedBy: req.user.id,
      addedAt: new Date().toISOString()
    };

    const result = await IncidentController.addIncidentNote(id, noteData);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }

    res.json({
      success: true,
      data: result,
      message: 'Note added successfully'
    });
  } catch (error) {
    console.error('[Incident API] Error adding incident note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add incident note',
      message: error.message
    });
  }
});

/**
 * GET /api/incidents/:id/activities - Get activities for incident
 */
router.get('/:id/activities', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, type, severity } = req.query;

    // Validate incident exists
    const incident = await IncidentController.getIncidentById(id);
    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }

    const ActivityController = require('../controllers/ActivityController');
    
    // Validate and set default values for pagination
    const validLimit = limit && !isNaN(parseInt(limit)) ? parseInt(limit) : 50;
    const validOffset = offset && !isNaN(parseInt(offset)) ? parseInt(offset) : 0;
    
    const activities = await ActivityController.getActivitiesByRefIdDirect(id, {
      limit: validLimit,
      offset: validOffset,
      type,
      severity
    });

    res.json({
      success: true,
      data: activities,
      pagination: {
        limit: validLimit,
        offset: validOffset,
        total: activities.length
      }
    });
  } catch (error) {
    console.error('[Incident API] Error getting incident activities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get incident activities',
      message: error.message
    });
  }
});

/**
 * POST /api/incidents/:id/activities - Add activity to incident
 * Body: { type, description, metadata?, severity? }
 */
router.post('/:id/activities', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description, metadata, severity } = req.body;

    if (!type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Activity type and description are required'
      });
    }

    // Validate incident exists
    const incident = await IncidentController.getIncidentById(id);
    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }

    const activityData = {
      type,
      description,
      metadata: metadata || {},
      severity: severity || 'INFO',
      actor: req.user.username || req.user.id,
      actorId: req.user.id,
      referenceId: id,
      referenceType: 'INCIDENT',
      timestamp: new Date().toISOString(),
      ipAddress: req.ip
    };

    const ActivityController = require('../controllers/ActivityController');
    const activity = await ActivityController.createActivityDirect(activityData);

    res.json({
      success: true,
      data: activity,
      message: 'Activity added to incident successfully'
    });
  } catch (error) {
    console.error('[Incident API] Error adding activity to incident:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add activity to incident',
      message: error.message
    });
  }
});

/**
 * GET /api/incidents/stats/dashboard - Get incident statistics for dashboard
 * Query params: period (today, week, month, year)
 */
router.get('/stats/dashboard', trackRequest, verifyToken, async (req, res) => {
  try {
    const { period } = req.query;
    const stats = await IncidentController.getDashboardStats(period || 'today');

    res.json({
      success: true,
      data: stats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Incident API] Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message
    });
  }
});

module.exports = router;