/**
 * API Router for CIFO Security System
 * Handles all API endpoints for cameras, team, activities, and perumahan
 */

const express = require('express');
const { alertStore } = require('./store.js');
const { alertQueue } = require('./queue.js');

// Import Controllers
const AlertController = require('../controllers/AlertController');
const CameraController = require('../controllers/CameraController');
const Camera = require('../models/Camera');
const SensorController = require('../controllers/SensorController');
const TeamController = require('../controllers/TeamController');
const ActivityController = require('../controllers/ActivityController');
const PerumahanController = require('../controllers/PerumahanController');
const IncidentController = require('../controllers/IncidentController');
const GeofenceController = require('../controllers/GeofenceController');
const MapPinController = require('../controllers/MapPinController');
const BasemapConfigController = require('../controllers/BasemapConfigController');
const FeatureFlagController = require('../controllers/FeatureFlagController');

// Import Route Modules
const teamRoutes = require('./team-routes');
const incidentRoutes = require('./incident-routes');
const geofenceRoutes = require('./geofence-routes');
const mapPinRoutes = require('../routes/map-pin-routes');
const basemapConfigRoutes = require('../routes/basemap-config-routes');
const featureFlagRoutes = require('../routes/feature-flag-routes');
const mapsRoutes = require('../routes/maps-routes');
const visitorRoutes = require('../routes/visitor');
const residentialMapRoutes = require('../routes/residential-map-routes');
const countingRoutes = require('../routes/counting-routes');
const authRoutes = require('./auth-routes');
const userRoutes = require('./user-routes');

// Import Authentication Middleware
const { verifyToken, requireRole } = require('../middleware/auth-config');

const router = express.Router();

// Validation constants
const VALID_PANIC_TYPES = ['MEDICAL', 'CRIME', 'FIRE', 'OTHER'];
const GPS_ACCURACY_THRESHOLD = 100; // meters

// Metrics tracking
const metrics = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    duplicates: 0
  },
  latency: {
    total: 0,
    count: 0,
    avg: 0,
    min: Infinity,
    max: 0
  }
};

/**
 * Middleware to track request start time for latency metrics
 */
function trackLatency(req, res, next) {
  req.startTime = Date.now();
  next();
}

/**
 * Middleware to update latency metrics
 */
function updateLatencyMetrics(req) {
  const latency = Date.now() - req.startTime;
  metrics.latency.total += latency;
  metrics.latency.count++;
  metrics.latency.avg = metrics.latency.total / metrics.latency.count;
  metrics.latency.min = Math.min(metrics.latency.min, latency);
  metrics.latency.max = Math.max(metrics.latency.max, latency);
  return latency;
}

/**
 * Validate GPS coordinates
 * @param {Object} gps - GPS object
 * @returns {Object} Validation result
 */
function validateGPS(gps) {
  if (!gps) {
    return { valid: true }; // GPS is optional
  }

  if (typeof gps !== 'object') {
    return { valid: false, error: 'GPS must be an object' };
  }

  const { latitude, longitude, accuracy } = gps;

  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    return { valid: false, error: 'Invalid latitude: must be a number between -90 and 90' };
  }

  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    return { valid: false, error: 'Invalid longitude: must be a number between -180 and 180' };
  }

  if (accuracy !== undefined && (typeof accuracy !== 'number' || accuracy < 0)) {
    return { valid: false, error: 'Invalid accuracy: must be a positive number' };
  }

  if (accuracy && accuracy > GPS_ACCURACY_THRESHOLD) {
    return { valid: false, error: `GPS accuracy too low: ${accuracy}m (threshold: ${GPS_ACCURACY_THRESHOLD}m)` };
  }

  return { valid: true };
}

/**
 * Validate panic type
 * @param {string} type - Panic type
 * @returns {Object} Validation result
 */
function validatePanicType(type) {
  if (!type || typeof type !== 'string') {
    return { valid: false, error: 'Panic type is required and must be a string' };
  }

  if (!VALID_PANIC_TYPES.includes(type.toUpperCase())) {
    return { valid: false, error: `Invalid panic type: ${type}. Must be one of: ${VALID_PANIC_TYPES.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Validate request ID
 * @param {string} requestId - Request ID
 * @returns {Object} Validation result
 */
function validateRequestId(requestId) {
  if (!requestId || typeof requestId !== 'string') {
    return { valid: false, error: 'Request ID is required and must be a string' };
  }

  if (requestId.length < 8 || requestId.length > 128) {
    return { valid: false, error: 'Request ID must be between 8 and 128 characters' };
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(requestId)) {
    return { valid: false, error: 'Request ID contains invalid characters. Only alphanumeric, hyphens, and underscores allowed' };
  }

  return { valid: true };
}

/**
 * Validate user ID
 * @param {string} userId - User ID
 * @returns {Object} Validation result
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: 'User ID is required and must be a string' };
  }

  if (userId.length < 3 || userId.length > 64) {
    return { valid: false, error: 'User ID must be between 3 and 64 characters' };
  }

  return { valid: true };
}

/**
 * POST /panic - Create new panic alert using AlertController
 */
router.post('/panic', trackLatency, async (req, res) => {
  metrics.requests.total++;
  
  try {
    // Add metrics tracking to request for AlertController
    req.startTime = req.startTime || Date.now();
    
    // Call AlertController.createPanicAlert
    await AlertController.createPanicAlert(req, res);
    
    // Update metrics if response was successful
    if (res.statusCode >= 200 && res.statusCode < 300) {
      metrics.requests.successful++;
    } else {
      metrics.requests.failed++;
    }
    
    const latency = updateLatencyMetrics(req);
    console.log(`[Router] Panic alert processed with latency: ${latency}ms`);
    
  } catch (error) {
    metrics.requests.failed++;
    const latency = updateLatencyMetrics(req);
    
    console.error('[Router] Error processing panic request:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to process panic alert',
        ingest_latency_ms: latency
      });
    }
  }
});

/**
 * PATCH /alerts/:id - Update alert status
 */
router.patch('/alerts/:id', trackLatency, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, metadata } = req.body;

    if (!id) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Alert ID is required'
      });
    }

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Status is required and must be a string'
      });
    }

    const validStatuses = ['ACTIVE', 'RESOLVED', 'CANCELLED', 'IN_PROGRESS'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updatedAlert = alertStore.updateAlertStatus(id, status.toUpperCase(), metadata);
    
    if (!updatedAlert) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Alert not found'
      });
    }

    // Broadcast status update via WebSocket
    if (req.app.locals.wss) {
      const broadcastData = {
        kind: 'ALERT_UPDATED',
        data: {
          id: updatedAlert.id,
          status: updatedAlert.status,
          updatedAt: updatedAlert.timestamps.updatedAt
        },
        timestamp: Date.now()
      };

      // Broadcast via Socket.IO
      const WebSocketService = require('../services/WebSocketService');
      WebSocketService.broadcastToRoom('alerts_room', 'alert_updated', broadcastData);
    }

    const latency = updateLatencyMetrics(req);

    res.json({
      message: 'Alert updated successfully',
      alert: {
        id: updatedAlert.id,
        status: updatedAlert.status,
        updatedAt: updatedAlert.timestamps.updatedAt
      },
      ingest_latency_ms: latency
    });

  } catch (error) {
    const latency = updateLatencyMetrics(req);
    
    console.error('[Router] Error updating alert:', error);
    
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update alert',
      ingest_latency_ms: latency
    });
  }
});

/**
 * GET /alerts - DEPRECATED: Use AlertController instead
 * This route has been replaced by /api/alerts using AlertController
 */
// router.get('/alerts', (req, res) => {
//   try {
//     const { userId, status, type, limit = 50, since } = req.query;
//     
//     let alerts;
//     
//     if (userId) {
//       alerts = alertStore.getAlertsByUser(userId, {
//         status,
//         type,
//         limit: parseInt(limit),
//         since: since ? parseInt(since) : undefined
//       });
//     } else {
//       alerts = alertStore.getActiveAlerts({
//         type,
//         limit: parseInt(limit),
//         since: since ? parseInt(limit) : undefined
//       });
//     }

//     res.json({
//       alerts: alerts.map(alert => ({
//         id: alert.id,
//         requestId: alert.requestId,
//         userId: alert.userId,
//         type: alert.type,
//         status: alert.status,
//         priority: alert.priority,
//         gps: alert.gps,
//         createdAt: alert.timestamps.createdAt,
//         updatedAt: alert.timestamps.updatedAt
//       })),
//       count: alerts.length,
//       timestamp: Date.now()
//     });

//   } catch (error) {
//     console.error('[Router] Error fetching alerts:', error);
//     
//     res.status(500).json({
//       error: 'INTERNAL_ERROR',
//       message: 'Failed to fetch alerts'
//     });
//   }
// });

/**
 * GET /alerts/:id/activity - Get activity log for specific alert
 */
router.get('/alerts/:id/activity', trackLatency, (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if alert exists
    const alert = alertStore.get(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    // Mock activities data for now - in real implementation this would come from database
    const mockActivities = [
      {
        id: 'act_001',
        type: 'ALERT_ACKNOWLEDGED',
        actor: 'Ahmad Wijaya',
        ts: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        note: 'Alert acknowledged by security team',
        severity: 'INFO'
      },
      {
        id: 'act_002', 
        type: 'ALERT_RESPONSE',
        actor: 'Budi Santoso',
        ts: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        note: 'Security team dispatched to location',
        severity: 'INFO'
      }
    ];
    
    // Sort by timestamp (newest first)
    const sortedActivities = mockActivities.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    const latency = updateLatencyMetrics(req);

    res.json({
      success: true,
      data: sortedActivities,
      alertId: id,
      total: sortedActivities.length
    });
  } catch (error) {
    const latency = updateLatencyMetrics(req);
    console.error('[Router] Error fetching alert activities:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert activities'
    });
  }
});

/**
 * GET /metrics - Get API and system metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const storeStats = alertStore.getStats();
    const queueStats = alertQueue.getStats();

    res.json({
      api: {
        requests: metrics.requests,
        latency: {
          avg_ms: Math.round(metrics.latency.avg * 100) / 100,
          min_ms: metrics.latency.min === Infinity ? 0 : metrics.latency.min,
          max_ms: metrics.latency.max
        }
      },
      store: storeStats,
      queue: queueStats,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[Router] Error fetching metrics:', error);
    
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch metrics'
    });
  }
});

// Camera heartbeat storage (in-memory for demo)
const cameraHeartbeats = new Map();

// NOTE: Konstanta CCTV_CAMERAS hardcoded (18 kamera) dihapus pada migrasi DB-backed.
// Sumber kamera sekarang dari Camera.getAll() di model. Lihat #10 di GitHub +
// docs/INTEGRATION_STATUS.md row #1.


/**
 * GET /cameras - Get all cameras with current status
 * Returns list of all CCTV cameras with their current health status
 */
router.get('/cameras', trackLatency, async (req, res) => {
  try {
    const now = Date.now();
    const HEARTBEAT_TIMEOUT = 60000; // 1 minute timeout

    // Source kamera dari DB (sebelumnya dari konstanta CCTV_CAMERAS hardcoded).
    const dbCameras = await Camera.getAll();

    // Enrich camera data with heartbeat status
    const camerasWithStatus = dbCameras.map(camera => {
      const heartbeat = cameraHeartbeats.get(camera.id);
      
      let currentStatus = 'offline';
      let lastSeen = null;
      let responseTime = null;
      let healthScore = 0;
      let error = null;
      
      if (heartbeat) {
        const timeSinceLastHeartbeat = now - heartbeat.timestamp;
        
        if (timeSinceLastHeartbeat <= HEARTBEAT_TIMEOUT) {
          currentStatus = heartbeat.status || 'online';
          lastSeen = heartbeat.timestamp;
          responseTime = heartbeat.responseTime;
          healthScore = heartbeat.healthScore || 100;
          error = heartbeat.error;
        } else {
          // Heartbeat expired
          currentStatus = 'offline';
          lastSeen = heartbeat.timestamp;
          error = 'Heartbeat timeout';
        }
      }
      
      return {
        ...camera,
        status: currentStatus,
        lastSeen,
        responseTime,
        healthScore,
        error,
        lastHeartbeat: heartbeat ? new Date(heartbeat.timestamp).toISOString() : null
      };
    });
    
    // Update metrics
    metrics.requests.total++;
    metrics.requests.successful++;
    updateLatencyMetrics(req);
    
    res.json({
      cameras: camerasWithStatus,
      total: camerasWithStatus.length,
      online: camerasWithStatus.filter(c => c.status === 'online').length,
      offline: camerasWithStatus.filter(c => c.status === 'offline').length,
      degraded: camerasWithStatus.filter(c => c.status === 'degraded').length,
      error: camerasWithStatus.filter(c => c.status === 'error').length,
      timestamp: now
    });
    
  } catch (error) {
    console.error('[Router] Error fetching cameras:', error);
    
    metrics.requests.total++;
    metrics.requests.failed++;
    updateLatencyMetrics(req);
    
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch cameras'
    });
  }
});

/**
 * POST /cameras/:id/heartbeat - Update camera heartbeat status
 * Receives heartbeat data from camera health monitoring
 */
router.post('/cameras/:id/heartbeat', trackLatency, async (req, res) => {
  try {
    const cameraId = req.params.id;
    const {
      status,
      responseTime,
      healthScore,
      error,
      streamAccessible,
      lastCheck
    } = req.body;

    // Validate camera ID via DB lookup (sebelumnya pakai CCTV_CAMERAS.find).
    const camera = await Camera.getById(cameraId);
    if (!camera) {
      metrics.requests.total++;
      metrics.requests.failed++;
      updateLatencyMetrics(req);
      
      return res.status(404).json({
        error: 'CAMERA_NOT_FOUND',
        message: `Camera with ID '${cameraId}' not found`
      });
    }
    
    // Validate required fields
    if (!status) {
      metrics.requests.total++;
      metrics.requests.failed++;
      updateLatencyMetrics(req);
      
      return res.status(400).json({
        error: 'MISSING_STATUS',
        message: 'Status field is required'
      });
    }
    
    // Validate status values
    const validStatuses = ['online', 'offline', 'degraded', 'error'];
    if (!validStatuses.includes(status)) {
      metrics.requests.total++;
      metrics.requests.failed++;
      updateLatencyMetrics(req);
      
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Store heartbeat data
    const heartbeatData = {
      cameraId,
      status,
      responseTime: responseTime || null,
      healthScore: healthScore || 0,
      error: error || null,
      streamAccessible: streamAccessible || false,
      lastCheck: lastCheck || new Date().toISOString(),
      timestamp: Date.now(),
      receivedAt: new Date().toISOString()
    };
    
    cameraHeartbeats.set(cameraId, heartbeatData);
    
    // Log heartbeat for monitoring
    console.log(`[Heartbeat] Camera ${cameraId}: ${status} (${responseTime}ms, score: ${healthScore})`);
    
    // Update metrics
    metrics.requests.total++;
    metrics.requests.successful++;
    updateLatencyMetrics(req);
    
    res.json({
      success: true,
      cameraId,
      status,
      timestamp: heartbeatData.timestamp,
      message: 'Heartbeat received successfully'
    });
    
  } catch (error) {
    console.error('[Router] Error processing heartbeat:', error);
    
    metrics.requests.total++;
    metrics.requests.failed++;
    updateLatencyMetrics(req);
    
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to process heartbeat'
    });
  }
});

// Incident Management - menggunakan IncidentController

// Incident validation constants
const VALID_INCIDENT_TYPES = [
  'SECURITY_BREACH', 'FIRE', 'MEDICAL_EMERGENCY', 'THEFT', 'VANDALISM',
  'SUSPICIOUS_ACTIVITY', 'EQUIPMENT_FAILURE', 'POWER_OUTAGE', 'FLOOD',
  'EARTHQUAKE', 'PANIC_ALERT', 'UNAUTHORIZED_ACCESS', 'OTHER',
  // Tambahkan tipe lama untuk kompatibilitas
  'SECURITY', 'MAINTENANCE', 'EMERGENCY', 'TECHNICAL'
];
const VALID_INCIDENT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_INCIDENT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];

// Incident validation has been moved to incident-routes.js

/**
 * Check for duplicate incidents using IncidentController
 * @param {Object} incident - Incident object
 * @returns {Object} Duplicate check result
 */
async function checkDuplicateIncident(incident) {
  try {
    // Use IncidentController to check for duplicates in the database
    return await IncidentController.checkDuplicateIncident({
      type: incident.type.toUpperCase(),
      location: {
        latitude: incident.coordinates?.latitude || incident.gps?.latitude,
        longitude: incident.coordinates?.longitude || incident.gps?.longitude
      },
      description: incident.description
    });
  } catch (error) {
    console.error('[Router] Error checking for duplicate incidents:', error);
    return null;
  }
}

/**
 * POST /incidents - Redirect to the consolidated endpoint in incident-routes.js
 * COMMENTED OUT: Legacy handler was interfering with proper route mounting
 */
// router.post('/incidents', trackLatency, (req, res, next) => {
//   console.log('[Router] Redirecting legacy POST /incidents to consolidated endpoint');
//   // Forward to the incident-routes handler
//   req.url = '/';
//   req.baseUrl = '/api/incidents';
//   
//   // Track metrics
//   metrics.requests.total++;
//   metrics.requests.redirected = (metrics.requests.redirected || 0) + 1;
//   
//   // Add a note to the request to indicate it came from the legacy endpoint
//   req.fromLegacyEndpoint = true;
//   
//   // Forward to the incident-routes handler
//   next('route');
// });


/**
 * GET /incidents - Get all incidents (redirects to consolidated endpoint)
 * COMMENTED OUT: Legacy handler was interfering with proper route mounting
 */
// router.get('/incidents', trackLatency, (req, res, next) => {
//   try {
//     console.log('[Router] Redirecting legacy GET /incidents to consolidated endpoint');
//     // Forward to the incident-routes handler
//     req.url = '/';
//     req.baseUrl = '/api/incidents';
//     
//     // Track metrics
//     metrics.requests.total++;
//     metrics.requests.redirected = (metrics.requests.redirected || 0) + 1;
//     
//     // Add a note to the request to indicate it came from the legacy endpoint
//     req.fromLegacyEndpoint = true;
//     
//     // Forward to the incident-routes handler
//     next('route');
//   } catch (error) {
//     const latency = updateLatencyMetrics(req);
//     console.error('Error fetching incidents:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Internal server error',
//       latency: `${latency}ms`,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

/**
 * GET /incidents/:id - Get specific incident (redirects to consolidated endpoint)
 * COMMENTED OUT: Legacy handler was interfering with proper route mounting
 */
// router.get('/incidents/:id', trackLatency, (req, res, next) => {
//   try {
//     console.log('[Router] Redirecting legacy GET /incidents/:id to consolidated endpoint');
//     // Forward to the incident-routes handler
//     req.url = `/${req.params.id}`;
//     req.baseUrl = '/api/incidents';
//     
//     // Track metrics
//     metrics.requests.total++;
//     metrics.requests.redirected = (metrics.requests.redirected || 0) + 1;
//     
//     // Add a note to the request to indicate it came from the legacy endpoint
//     req.fromLegacyEndpoint = true;
//     
//     // Forward to the incident-routes handler
//     next('route');
//   } catch (error) {
//     console.error('Error fetching incident:', error);
//     const latency = updateLatencyMetrics(req);
//     res.status(500).json({
//       success: false,
//       error: 'Internal server error',
//       latency: `${latency}ms`,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

/**
 * PATCH /incidents/:id - Update incident (redirects to consolidated endpoint)
 * COMMENTED OUT: Legacy handler was interfering with proper route mounting
 */
// router.patch('/incidents/:id', trackLatency, (req, res, next) => {
//   try {
//     console.log('[Router] Redirecting legacy PATCH /incidents/:id to consolidated endpoint');
//     // Forward to the incident-routes handler
//     req.url = `/${req.params.id}`;
//     req.baseUrl = '/api/incidents';
//     req.method = 'PATCH';
//     
//     // Track metrics
//     metrics.requests.total++;
//     metrics.requests.redirected = (metrics.requests.redirected || 0) + 1;
//     
//     // Add a note to the request to indicate it came from the legacy endpoint
//     req.fromLegacyEndpoint = true;
//     
//     // Forward to the incident-routes handler
//     next('route');
//   } catch (error) {
//     const latency = updateLatencyMetrics(req);
//     console.error('Error updating incident:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Internal server error',
//       latency: `${latency}ms`,
//       timestamp: new Date().toISOString()
//     });
// 
//   }
// });

/**
 * POST /incidents/:id/activities - Add activity to incident
 * COMMENTED OUT: Legacy handler was interfering with proper route mounting
 */
// router.post('/incidents/:id/activities', trackLatency, (req, res, next) => {
//   try {
//     console.log('[Router] Redirecting legacy POST /incidents/:id/activities to consolidated endpoint');
//     // Forward to the incident-routes handler
//     req.url = `/${req.params.id}/activities`;
//     req.baseUrl = '/api/incidents';
//     
//     // Track metrics
//     metrics.requests.total++;
//     metrics.requests.redirected = (metrics.requests.redirected || 0) + 1;
//     
//     // Add a note to the request to indicate it came from the legacy endpoint
//     req.fromLegacyEndpoint = true;
//     
//     // Forward to the incident-routes handler
//     next('route');
//   } catch (error) {
//     const latency = updateLatencyMetrics(req);
//     console.error('Error adding activity to incident:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Internal server error',
//       latency: `${latency}ms`,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

/**
 * GET /incidents/:id/activities - Get incident activities
 * COMMENTED OUT: Legacy handler was interfering with proper route mounting
 */
// router.get('/incidents/:id/activities', trackLatency, (req, res, next) => {
//   try {
//     console.log('[Router] Redirecting legacy GET /incidents/:id/activities to consolidated endpoint');
//     // Forward to the incident-routes handler
//     req.url = `/${req.params.id}/activities`;
//     req.baseUrl = '/api/incidents';
//     
//     // Track metrics
//     metrics.requests.total++;
//     metrics.requests.redirected = (metrics.requests.redirected || 0) + 1;
//     
//     // Add a note to the request to indicate it came from the legacy endpoint
//     req.fromLegacyEndpoint = true;
//     
//     // Forward to the incident-routes handler
//     next('route');
//   } catch (error) {
//     const latency = updateLatencyMetrics(req);
//     console.error('Error redirecting to consolidated endpoint:', error);
//     return res.status(500).json({
//       success: false,
//       error: 'Internal server error',
//       latency: `${latency}ms`,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// Team roster mock data
const TEAM_ROSTER = [
  {
    id: 'guard_001',
    nama: 'Ahmad Wijaya',
    status: 'ON_DUTY',
    lastUpdate: new Date().toISOString(),
    phone: '+62812345001',
    role: 'Security Guard',
    location: 'Main Gate'
  },
  {
    id: 'guard_002', 
    nama: 'Budi Santoso',
    status: 'PATROLLING',
    lastUpdate: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    phone: '+62812345002',
    role: 'Patrol Officer',
    location: 'Building A'
  },
  {
    id: 'guard_003',
    nama: 'Citra Dewi',
    status: 'OFF_DUTY',
    lastUpdate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    phone: '+62812345003',
    role: 'Supervisor',
    location: 'Control Room'
  },
  {
    id: 'guard_004',
    nama: 'Dedi Kurniawan',
    status: 'BREAK',
    lastUpdate: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    phone: '+62812345004',
    role: 'Security Guard',
    location: 'Parking Area'
  },
  {
    id: 'guard_005',
    nama: 'Eka Pratama',
    status: 'ON_DUTY',
    lastUpdate: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    phone: '+62812345005',
    role: 'Security Guard',
    location: 'Building B'
  }
];

/**
 * GET /team - Retrieve team roster
 * Query parameters:
 * - status: Filter by status (ON_DUTY, OFF_DUTY, PATROLLING, BREAK)
 * - role: Filter by role
 */
router.get('/team', trackLatency, (req, res) => {
  const startTime = Date.now();
  
  try {
    metrics.requests.total++;
    
    const { status, role } = req.query;
    let filteredTeam = [...TEAM_ROSTER];
    
    // Filter by status if provided
    if (status) {
      const validStatuses = ['ON_DUTY', 'OFF_DUTY', 'PATROLLING', 'BREAK'];
      if (!validStatuses.includes(status.toUpperCase())) {
        metrics.requests.failed++;
        return res.status(400).json({
          success: false,
          error: 'Invalid status filter',
          validStatuses
        });
      }
      filteredTeam = filteredTeam.filter(member => member.status === status.toUpperCase());
    }
    
    // Filter by role if provided
    if (role) {
      filteredTeam = filteredTeam.filter(member => 
        member.role.toLowerCase().includes(role.toLowerCase())
      );
    }
    
    // Update latency metrics
    updateLatencyMetrics(req);
    metrics.requests.successful++;
    
    res.json({
      success: true,
      data: {
        team: filteredTeam,
        total: filteredTeam.length,
        filters: { status, role },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    metrics.requests.failed++;
    console.error('Error fetching team roster:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Camera Routes
router.get('/api/cameras', CameraController.getAllCameras);
router.get('/api/cameras/stats', CameraController.getStats);
router.get('/api/cameras/dashboard', CameraController.getDashboardData);
router.get('/api/cameras/area/:area', CameraController.getCamerasByArea);
router.get('/api/cameras/status/:status', CameraController.getCamerasByStatus);
router.get('/api/cameras/:id', CameraController.getCameraById);
router.post('/api/cameras', CameraController.createCamera);
router.put('/api/cameras/:id', CameraController.updateCamera);
router.patch('/api/cameras/:id/status', CameraController.updateStatus);
router.patch('/api/cameras/bulk-status', CameraController.bulkUpdateStatus);
router.delete('/api/cameras/:id', CameraController.deleteCamera);
router.post('/api/cameras/:id/heartbeat', CameraController.heartbeat);
router.get('/api/cameras/:id/health-logs', CameraController.getCameraHealthLogs);

// Team Routes
router.get('/api/team', TeamController.getAllTeamMembers);
router.get('/api/team/stats', TeamController.getStats);
router.get('/api/team/on-duty', TeamController.getMembersOnDuty);
router.get('/api/team/by-role/:role', TeamController.getMembersByRole);
router.get('/api/team/by-shift/:shift', TeamController.getMembersByShift);
router.get('/api/team/:id', TeamController.getTeamMemberById);
router.post('/api/team', TeamController.createTeamMember);
router.put('/api/team/:id', TeamController.updateTeamMember);
router.patch('/api/team/:id/status', TeamController.updateStatus);
router.patch('/api/team/:id/location', TeamController.updateLocation);
router.delete('/api/team/:id', TeamController.deleteTeamMember);
router.get('/api/team/:id/location-history', TeamController.getLocationHistory);
router.get('/api/team/locations/current', TeamController.getCurrentLocations);
router.get('/api/team/patrol/routes', TeamController.getPatrolRoutes);
router.get('/api/team/activity/summary', TeamController.getActivitySummary);

// Security Team Status endpoint
router.get('/security/team/status', trackLatency, (req, res) => {
  try {
    // Get team status summary
    const teamStatus = {
      total: TEAM_ROSTER.length,
      onDuty: TEAM_ROSTER.filter(member => member.status === 'ON_DUTY').length,
      patrolling: TEAM_ROSTER.filter(member => member.status === 'PATROLLING').length,
      offDuty: TEAM_ROSTER.filter(member => member.status === 'OFF_DUTY').length,
      onBreak: TEAM_ROSTER.filter(member => member.status === 'BREAK').length,
      lastUpdate: new Date().toISOString(),
      members: TEAM_ROSTER.map(member => ({
        id: member.id,
        nama: member.nama,
        status: member.status,
        role: member.role,
        location: member.location,
        lastUpdate: member.lastUpdate
      }))
    };

    const latency = updateLatencyMetrics(req);
    metrics.requests.total++;
    metrics.requests.successful++;

    res.json({
      success: true,
      data: teamStatus,
      latency: `${latency}ms`
    });
  } catch (error) {
    console.error('Error getting team status:', error);
    const latency = updateLatencyMetrics(req);
    metrics.requests.total++;
    metrics.requests.failed++;

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve team status',
      error: error.message,
      latency: `${latency}ms`
    });
  }
});

// Sensor endpoints — resolves #8
router.get('/sensors', SensorController.getAllSensors);
router.get('/sensors/:id', SensorController.getSensorById);
router.patch('/sensors/:id/status', SensorController.updateSensorStatus);

// Activity endpoints
router.get('/activities', ActivityController.getAllActivities);
router.get('/activities/stats', ActivityController.getStats);
router.get('/activities/recent', ActivityController.getRecentActivities);
router.get('/activities/type/:type', ActivityController.getActivitiesByType);
router.get('/activities/severity/:severity', ActivityController.getActivitiesBySeverity);
router.get('/activities/actor/:actor', ActivityController.getActivitiesByActor);
router.get('/activities/reference/:refId', ActivityController.getActivitiesByRefId);
router.get('/activities/trends', ActivityController.getActivityTrend);
router.get('/activities/top-actors', ActivityController.getTopActors);
router.get('/activities/critical', ActivityController.getCriticalActivities);
router.get('/activities/:id', ActivityController.getActivityById);
router.post('/activities', ActivityController.createActivity);
router.put('/activities/:id', ActivityController.updateActivity);
router.delete('/activities/:id', ActivityController.deleteActivity);
router.post('/activities/log-incident', ActivityController.logIncident);
router.post('/activities/log-patrol', ActivityController.logPatrol);
router.post('/activities/log-visitor', ActivityController.logVisitor);
router.delete('/activities/cleanup/:days', ActivityController.cleanupOldActivities);
router.get('/activities/export/csv', verifyToken, requireRole(['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR']), ActivityController.exportActivities);

// Alert Activity Routes
router.post('/alerts/:id/activities', trackLatency, verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description, metadata, severity } = req.body;

    if (!type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Activity type and description are required'
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
      referenceType: 'ALERT',
      timestamp: new Date().toISOString(),
      ipAddress: req.ip
    };

    const activity = await ActivityController.createActivityDirect(activityData);
    const latency = updateLatencyMetrics(req);
    metrics.requests.successful++;

    res.json({
      success: true,
      data: activity,
      message: 'Activity added to alert successfully',
      latency: `${latency}ms`
    });
  } catch (error) {
    const latency = updateLatencyMetrics(req);
    metrics.requests.failed++;
    console.error('[Alert API] Error adding activity to alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add activity to alert',
      message: error.message,
      latency: `${latency}ms`
    });
  }
});

// System Activity Routes
router.post('/system/:id/activities', trackLatency, verifyToken, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description, metadata, severity } = req.body;

    if (!type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Activity type and description are required'
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
      referenceType: 'SYSTEM',
      timestamp: new Date().toISOString(),
      ipAddress: req.ip
    };

    const activity = await ActivityController.createActivityDirect(activityData);
    const latency = updateLatencyMetrics(req);
    metrics.requests.successful++;

    res.json({
      success: true,
      data: activity,
      message: 'System activity logged successfully',
      latency: `${latency}ms`
    });
  } catch (error) {
    const latency = updateLatencyMetrics(req);
    metrics.requests.failed++;
    console.error('[System API] Error logging system activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log system activity',
      message: error.message,
      latency: `${latency}ms`
    });
  }
});

// Alert Controller routes
router.get('/alerts', AlertController.getAlerts);
router.get('/alerts/:id', AlertController.getAlertById);
router.post('/alerts', AlertController.createAlert);
router.put('/alerts/:id', AlertController.updateAlert);
router.patch('/alerts/:id/acknowledge', AlertController.acknowledgeAlert);
router.patch('/alerts/:id/resolve', AlertController.resolveAlert);
router.get('/alerts/stats', AlertController.getAlertStats);

// Perumahan Routes
router.get('/api/perumahan', PerumahanController.getAllPerumahan);
router.get('/api/perumahan/stats', PerumahanController.getStats);
router.get('/api/perumahan/search', PerumahanController.searchPerumahan);
router.get('/api/perumahan/occupancy-report', PerumahanController.getOccupancyReport);
router.get('/api/perumahan/:id', PerumahanController.getPerumahanById);
router.post('/api/perumahan', PerumahanController.createPerumahan);
router.put('/api/perumahan/:id', PerumahanController.updatePerumahan);
router.delete('/api/perumahan/:id', PerumahanController.deletePerumahan);
router.get('/api/perumahan/:id/facilities', PerumahanController.getFacilitiesByPerumahan);
router.post('/api/perumahan/:id/facilities', PerumahanController.createFacility);
router.put('/api/perumahan/facilities/:facilityId', PerumahanController.updateFacility);
router.delete('/api/perumahan/facilities/:facilityId', PerumahanController.deleteFacility);

// Telemetry Routes
router.post('/telemetry/map', (req, res) => {
  try {
    // Handle both single event and batch formats
    const { event, data, timestamp, events, batchId, source } = req.body;
    
    // Check for batch format (from FeatureFlagService)
    if (events && Array.isArray(events)) {
      // Validate batch format
      if (events.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Events array cannot be empty'
        });
      }

      // Log each event in the batch
      events.forEach((eventItem, index) => {
        console.log(`[TELEMETRY BATCH ${batchId || 'unknown'}][${index + 1}/${events.length}]`, {
          event: eventItem.event,
          data: eventItem.data,
          timestamp: eventItem.timestamp,
          sessionId: eventItem.sessionId,
          userId: eventItem.userId,
          userAgent: eventItem.userAgent || req.headers['user-agent'],
          url: eventItem.url,
          source: source || 'unknown',
          ip: req.ip
        });
      });

      res.json({
        success: true,
        message: `Telemetry batch received: ${events.length} events`,
        batchId: batchId,
        eventsProcessed: events.length
      });
    } else {
      // Handle single event format (legacy)
      if (!event || !data) {
        return res.status(400).json({
          success: false,
          message: 'Event and data are required'
        });
      }

      // Log the single telemetry event
      console.log('[TELEMETRY SINGLE]', {
        event,
        data,
        timestamp: timestamp || new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Telemetry data received'
      });
    }
  } catch (error) {
    console.error('Telemetry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Integrate new route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/team', teamRoutes);
router.use('/incidents', incidentRoutes);
router.use('/geofences', geofenceRoutes);
router.use('/map-pins', mapPinRoutes);
router.use('/basemap-config', basemapConfigRoutes);
router.use('/feature-flags', featureFlagRoutes);
router.use('/maps', mapsRoutes);
router.use('/visitor', visitorRoutes);
router.use('/residential-map', residentialMapRoutes);
router.use('/counting', countingRoutes);

module.exports = { router, metrics };
module.exports.default = router;