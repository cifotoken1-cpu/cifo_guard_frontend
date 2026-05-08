/**
 * In-Memory Store Implementation for Alert Management
 * Handles alerts storage and idempotency tracking
 */

const { v4: uuidv4 } = require('uuid');

class AlertStore {
  constructor() {
    this.alerts = new Map(); // alertId -> alert object
    this.requestIdIndex = new Map(); // requestId -> alertId (for idempotency)
    this.userAlerts = new Map(); // userId -> Set of alertIds
    this.metrics = {
      totalAlerts: 0,
      activeAlerts: 0,
      resolvedAlerts: 0,
      duplicateRequests: 0
    };
    this.startTime = Date.now();
  }

  /**
   * Create a new alert
   * @param {Object} alertData - Alert data
   * @returns {Object} Created alert or existing alert if duplicate requestId
   */
  createAlert(alertData) {
    const { requestId, userId, type, gps, metadata = {} } = alertData;
    
    // Check for idempotency
    if (this.requestIdIndex.has(requestId)) {
      const existingAlertId = this.requestIdIndex.get(requestId);
      const existingAlert = this.alerts.get(existingAlertId);
      this.metrics.duplicateRequests++;
      console.log(`[Store] Duplicate requestId ${requestId}, returning existing alert ${existingAlertId}`);
      return { alert: existingAlert, isDuplicate: true };
    }

    // Generate new alert
    const alertId = uuidv4();
    const now = Date.now();
    
    const alert = {
      id: alertId,
      requestId,
      userId,
      type,
      gps: gps || null,
      status: 'ACTIVE',
      priority: this.calculatePriority(type),
      metadata: {
        ...metadata,
        source: 'api',
        version: '1.0'
      },
      timestamps: {
        createdAt: now,
        updatedAt: now,
        statusChangedAt: now
      },
      geotag: gps ? this.generateGeotag(gps) : null,
      cluster: null // Stub for future clustering logic
    };

    // Store alert
    this.alerts.set(alertId, alert);
    this.requestIdIndex.set(requestId, alertId);
    
    // Update user alerts index
    if (!this.userAlerts.has(userId)) {
      this.userAlerts.set(userId, new Set());
    }
    this.userAlerts.get(userId).add(alertId);

    // Update metrics
    this.metrics.totalAlerts++;
    this.metrics.activeAlerts++;

    console.log(`[Store] Created new alert ${alertId} for user ${userId} with type ${type}`);
    return { alert, isDuplicate: false };
  }

  /**
   * Get alert by ID
   * @param {string} alertId - Alert ID
   * @returns {Object|null} Alert object or null if not found
   */
  getAlert(alertId) {
    return this.alerts.get(alertId) || null;
  }

  /**
   * Get alert by requestId
   * @param {string} requestId - Request ID
   * @returns {Object|null} Alert object or null if not found
   */
  getAlertByRequestId(requestId) {
    const alertId = this.requestIdIndex.get(requestId);
    return alertId ? this.alerts.get(alertId) : null;
  }

  /**
   * Update alert status
   * @param {string} alertId - Alert ID
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata
   * @returns {Object|null} Updated alert or null if not found
   */
  updateAlertStatus(alertId, status, metadata = {}) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return null;
    }

    const oldStatus = alert.status;
    const now = Date.now();

    alert.status = status;
    alert.timestamps.updatedAt = now;
    alert.timestamps.statusChangedAt = now;
    alert.metadata = { ...alert.metadata, ...metadata };

    // Update metrics
    if (oldStatus === 'ACTIVE' && status !== 'ACTIVE') {
      this.metrics.activeAlerts--;
      this.metrics.resolvedAlerts++;
    } else if (oldStatus !== 'ACTIVE' && status === 'ACTIVE') {
      this.metrics.activeAlerts++;
      this.metrics.resolvedAlerts--;
    }

    console.log(`[Store] Updated alert ${alertId} status from ${oldStatus} to ${status}`);
    return alert;
  }

  /**
   * Get alerts by user ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Array of alerts
   */
  getAlertsByUser(userId, options = {}) {
    const userAlertIds = this.userAlerts.get(userId);
    if (!userAlertIds) {
      return [];
    }

    let alerts = Array.from(userAlertIds)
      .map(id => this.alerts.get(id))
      .filter(alert => alert); // Remove any null entries

    // Apply filters
    if (options.status) {
      alerts = alerts.filter(alert => alert.status === options.status);
    }
    if (options.type) {
      alerts = alerts.filter(alert => alert.type === options.type);
    }
    if (options.since) {
      alerts = alerts.filter(alert => alert.timestamps.createdAt >= options.since);
    }

    // Sort by creation time (newest first)
    alerts.sort((a, b) => b.timestamps.createdAt - a.timestamps.createdAt);

    // Apply pagination
    if (options.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Get all active alerts
   * @param {Object} options - Query options
   * @returns {Array} Array of active alerts
   */
  getActiveAlerts(options = {}) {
    let alerts = Array.from(this.alerts.values())
      .filter(alert => alert.status === 'ACTIVE');

    // Apply filters
    if (options.type) {
      alerts = alerts.filter(alert => alert.type === options.type);
    }
    if (options.since) {
      alerts = alerts.filter(alert => alert.timestamps.createdAt >= options.since);
    }

    // Sort by priority and creation time
    alerts.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return b.timestamps.createdAt - a.timestamps.createdAt; // Newer first
    });

    if (options.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  /**
   * Check if requestId already exists (idempotency check)
   * @param {string} requestId - Request ID to check
   * @returns {boolean} True if requestId exists
   */
  hasRequestId(requestId) {
    return this.requestIdIndex.has(requestId);
  }

  /**
   * Get store statistics
   * @returns {Object} Store metrics and statistics
   */
  getStats() {
    return {
      ...this.metrics,
      totalUsers: this.userAlerts.size,
      requestIdIndexSize: this.requestIdIndex.size,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear() {
    this.alerts.clear();
    this.requestIdIndex.clear();
    this.userAlerts.clear();
    this.metrics = {
      totalAlerts: 0,
      activeAlerts: 0,
      resolvedAlerts: 0,
      duplicateRequests: 0
    };
    console.log('[Store] Cleared all data');
  }

  /**
   * Calculate alert priority based on type
   * @param {string} type - Alert type
   * @returns {number} Priority score (higher = more urgent)
   */
  calculatePriority(type) {
    const priorities = {
      'MEDICAL': 10,
      'FIRE': 9,
      'CRIME': 8,
      'OTHER': 5
    };
    return priorities[type] || 1;
  }

  /**
   * Generate geotag from GPS coordinates (stub implementation)
   * @param {Object} gps - GPS coordinates
   * @returns {Object} Geotag information
   */
  generateGeotag(gps) {
    if (!gps || !gps.latitude || !gps.longitude) {
      return null;
    }

    return {
      coordinates: {
        lat: gps.latitude,
        lng: gps.longitude,
        accuracy: gps.accuracy || null
      },
      address: null, // Stub for reverse geocoding
      region: null,  // Stub for region detection
      generatedAt: Date.now()
    };
  }
}

const alertStore = new AlertStore();

module.exports = { AlertStore, alertStore };
module.exports.default = alertStore;