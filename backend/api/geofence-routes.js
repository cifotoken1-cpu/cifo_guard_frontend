/**
 * Geofence Management API Routes
 * Handles geofence creation, updates, monitoring, and breach detection
 */

const express = require('express');
const GeofenceController = require('../controllers/GeofenceController');
const { verifyToken, requireRole } = require('../middleware/auth-config');
const { trackRequest } = require('../middleware/metrics');

const router = express.Router();

/**
 * POST /api/geofences - Create new geofence
 * Body: { name, type, coordinates, isActive, alertSettings, metadata? }
 */
router.post('/', trackRequest, verifyToken, requireRole(['SUPERVISOR', 'COORDINATOR']), async (req, res) => {
  try {
    const { name, type, coordinates, isActive, alertSettings, metadata } = req.body;

    // Validate required fields
    if (!name || !type || !coordinates) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, type, coordinates'
      });
    }

    // Validate geofence type
    const validTypes = ['POLYGON', 'CIRCLE', 'RECTANGLE'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid geofence type',
        validTypes
      });
    }

    // Validate coordinates based on type
    if (type === 'POLYGON' && (!Array.isArray(coordinates) || coordinates.length < 3)) {
      return res.status(400).json({
        success: false,
        error: 'Polygon geofence requires at least 3 coordinate points'
      });
    }

    if (type === 'CIRCLE' && (!coordinates.center || !coordinates.radius)) {
      return res.status(400).json({
        success: false,
        error: 'Circle geofence requires center coordinates and radius'
      });
    }

    if (type === 'RECTANGLE' && (!coordinates.bounds || !coordinates.bounds.north)) {
      return res.status(400).json({
        success: false,
        error: 'Rectangle geofence requires bounds (north, south, east, west)'
      });
    }

    const geofenceData = {
      name,
      type,
      coordinates,
      isActive: isActive !== undefined ? isActive : true,
      alertSettings: alertSettings || {
        onEntry: true,
        onExit: true,
        notifyRoles: ['SUPERVISOR'],
        escalateAfter: 300 // 5 minutes
      },
      metadata: metadata || {},
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };

    const geofence = await GeofenceController.createGeofence(geofenceData);

    // Broadcast geofence creation via WebSocket
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'geofence_created', {
        geofence,
        timestamp: Date.now()
      });
    }

    res.status(201).json({
      success: true,
      data: geofence,
      message: 'Geofence created successfully'
    });
  } catch (error) {
    console.error('[Geofence API] Error creating geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create geofence',
      message: error.message
    });
  }
});

/**
 * GET /api/geofences - Get geofences with filters
 * Query params: isActive, type, limit, offset
 */
router.get('/', trackRequest, verifyToken, GeofenceController.getGeofences);

/**
 * GET /api/geofences/:id - Get specific geofence
 */
router.get('/:id', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const geofence = await GeofenceController.getGeofenceById(id);

    if (!geofence) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }

    res.json({
      success: true,
      data: geofence
    });
  } catch (error) {
    console.error('[Geofence API] Error getting geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch geofence',
      message: error.message
    });
  }
});

/**
 * PUT /api/geofences/:id - Update geofence
 * Body: { name?, coordinates?, isActive?, alertSettings?, metadata? }
 */
router.put('/:id', trackRequest, verifyToken, requireRole(['SUPERVISOR', 'COORDINATOR']), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate coordinates if provided
    if (updateData.coordinates) {
      const geofence = await GeofenceController.getGeofenceById(id);
      if (!geofence) {
        return res.status(404).json({
          success: false,
          error: 'Geofence not found'
        });
      }

      // Validate coordinates based on geofence type
      if (geofence.type === 'POLYGON' && (!Array.isArray(updateData.coordinates) || updateData.coordinates.length < 3)) {
        return res.status(400).json({
          success: false,
          error: 'Polygon geofence requires at least 3 coordinate points'
        });
      }
    }

    updateData.updatedBy = req.user.id;
    updateData.updatedAt = new Date().toISOString();

    const updatedGeofence = await GeofenceController.updateGeofence(id, updateData);

    if (!updatedGeofence) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }

    // Broadcast geofence update via WebSocket
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'geofence_updated', {
        geofence: updatedGeofence,
        changes: updateData,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      data: updatedGeofence,
      message: 'Geofence updated successfully'
    });
  } catch (error) {
    console.error('[Geofence API] Error updating geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update geofence',
      message: error.message
    });
  }
});

/**
 * DELETE /api/geofences/:id - Delete geofence
 */
router.delete('/:id', trackRequest, verifyToken, requireRole(['SUPERVISOR', 'COORDINATOR']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const success = await GeofenceController.deleteGeofence(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }

    // Broadcast geofence deletion via WebSocket
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'geofence_deleted', {
        geofenceId: id,
        deletedBy: req.user.id,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      message: 'Geofence deleted successfully'
    });
  } catch (error) {
    console.error('[Geofence API] Error deleting geofence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete geofence',
      message: error.message
    });
  }
});

/**
 * POST /api/geofences/check-location - Check if location is within any geofences
 * Body: { latitude, longitude, memberId? }
 */
router.post('/check-location', trackRequest, verifyToken, async (req, res) => {
  try {
    const { latitude, longitude, memberId } = req.body;

    // Validate coordinates
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude'
      });
    }

    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid longitude'
      });
    }

    const result = await GeofenceController.checkLocationInGeofences({
      latitude,
      longitude,
      memberId: memberId || req.user.id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Geofence API] Error checking location:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check location',
      message: error.message
    });
  }
});

/**
 * GET /api/geofences/:id/breaches - Get geofence breach history
 * Query params: startDate, endDate, limit, offset
 */
router.get('/:id/breaches', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await GeofenceController.getGeofenceBreaches(id, filters);

    res.json({
      success: true,
      data: {
        breaches: result.breaches,
        total: result.total,
        geofenceId: id,
        filters: filters,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('[Geofence API] Error getting geofence breaches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch geofence breaches',
      message: error.message
    });
  }
});

/**
 * POST /api/geofences/:id/toggle - Toggle geofence active status
 */
router.post('/:id/toggle', trackRequest, verifyToken, requireRole(['SUPERVISOR', 'COORDINATOR']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await GeofenceController.toggleGeofenceStatus(id, req.user.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Geofence not found'
      });
    }

    // Broadcast status change via WebSocket
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'geofence_status_changed', {
        geofenceId: id,
        isActive: result.isActive,
        changedBy: req.user.id,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      data: result,
      message: `Geofence ${result.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('[Geofence API] Error toggling geofence status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle geofence status',
      message: error.message
    });
  }
});

/**
 * GET /api/geofences/stats/dashboard - Get geofence statistics for dashboard
 * Query params: period (today, week, month)
 */
router.get('/stats/dashboard', trackRequest, verifyToken, async (req, res) => {
  try {
    const { period } = req.query;
    const stats = await GeofenceController.getDashboardStats(period || 'today');

    res.json({
      success: true,
      data: stats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Geofence API] Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message
    });
  }
});

module.exports = router;