/**
 * Team Management API Routes
 * Handles team roster, status updates, and dispatch operations
 */

const express = require('express');
const TeamController = require('../controllers/TeamController');
const { verifyToken, requireRole } = require('../middleware/auth-config');
const { trackRequest } = require('../middleware/metrics');

const router = express.Router();

/**
 * GET /api/team - Get team roster with filters
 * Query params: status, role, shift, limit, offset
 */
router.get('/', trackRequest, verifyToken, async (req, res) => {
  try {
    const filters = {
      status: req.query.status, // ON_DUTY, OFF_DUTY, PATROLLING, BREAK, EMERGENCY
      role: req.query.role, // SECURITY_OFFICER, SUPERVISOR, COORDINATOR
      shift: req.query.shift, // MORNING, AFTERNOON, NIGHT
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await TeamController.getTeamRoster(filters);
    
    res.json({
      success: true,
      data: {
        team: result.members,
        total: result.total,
        filters: filters,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('[Team API] Error getting team roster:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team roster',
      message: error.message
    });
  }
});

/**
 * GET /api/team/:id - Get specific team member details
 */
router.get('/:id', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const member = await TeamController.getTeamMemberById(id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Team member not found'
      });
    }

    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    console.error('[Team API] Error getting team member:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team member',
      message: error.message
    });
  }
});

/**
 * PUT /api/team/:id/status - Update team member status
 * Body: { status, location?, notes? }
 */
router.put('/:id/status', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, location, notes } = req.body;

    // Validate status
    const validStatuses = ['ON_DUTY', 'OFF_DUTY', 'PATROLLING', 'BREAK', 'EMERGENCY', 'UNAVAILABLE'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        validStatuses
      });
    }

    const updatedMember = await TeamController.updateMemberStatus(id, {
      status,
      location,
      notes,
      updatedBy: req.user.id,
      updatedAt: new Date().toISOString()
    });

    // Broadcast status change via WebSocket
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'team_status_changed', {
        memberId: id,
        status,
        location,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      data: updatedMember,
      message: 'Team member status updated successfully'
    });
  } catch (error) {
    console.error('[Team API] Error updating team status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update team status',
      message: error.message
    });
  }
});

/**
 * POST /api/team/:id/location - Update team member location
 * Body: { latitude, longitude, accuracy?, timestamp? }
 */
router.post('/:id/location', trackRequest, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, accuracy, timestamp } = req.body;

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

    const locationData = {
      latitude,
      longitude,
      accuracy: accuracy || null,
      timestamp: timestamp || new Date().toISOString(),
      updatedBy: req.user.id
    };

    const result = await TeamController.updateMemberLocation(id, locationData);

    // Broadcast location update via WebSocket
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('control_center', 'team_location_updated', {
        memberId: id,
        location: locationData,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      data: result,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('[Team API] Error updating location:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update location',
      message: error.message
    });
  }
});

/**
 * POST /api/team/dispatch - Dispatch team to location
 * Body: { memberIds[], location, priority, description, incidentId? }
 */
router.post('/dispatch', trackRequest, verifyToken, requireRole(['SUPERVISOR', 'COORDINATOR']), async (req, res) => {
  try {
    const { memberIds, location, priority, description, incidentId } = req.body;

    // Validate input
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Member IDs array is required'
      });
    }

    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Valid location coordinates are required'
      });
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority level',
        validPriorities
      });
    }

    const dispatchData = {
      memberIds,
      location,
      priority,
      description,
      incidentId,
      dispatchedBy: req.user.id,
      dispatchedAt: new Date().toISOString()
    };

    const result = await TeamController.dispatchTeam(dispatchData);

    // Broadcast dispatch notification
    if (req.app.locals.wss) {
      const WebSocketService = require('../services/WebSocketService');
      
      // Notify control center
      WebSocketService.broadcastToRoom('control_center', 'team_dispatched', {
        dispatchId: result.id,
        memberIds,
        location,
        priority,
        timestamp: Date.now()
      });

      // Notify dispatched team members
      memberIds.forEach(memberId => {
        WebSocketService.broadcastToUser(memberId, 'dispatch_notification', {
          dispatchId: result.id,
          location,
          priority,
          description,
          timestamp: Date.now()
        });
      });
    }

    res.json({
      success: true,
      data: result,
      message: 'Team dispatched successfully'
    });
  } catch (error) {
    console.error('[Team API] Error dispatching team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dispatch team',
      message: error.message
    });
  }
});

/**
 * GET /api/team/shifts - Get shift schedules
 * Query params: date, memberId
 */
router.get('/shifts', trackRequest, verifyToken, async (req, res) => {
  try {
    const { date, memberId } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const shifts = await TeamController.getShiftSchedules({
      date: targetDate,
      memberId
    });

    res.json({
      success: true,
      data: {
        shifts,
        date: targetDate.toISOString().split('T')[0],
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('[Team API] Error getting shifts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shift schedules',
      message: error.message
    });
  }
});

module.exports = router;