/**
 * Metrics Middleware
 * Handles API performance monitoring and request tracking
 */

const os = require('os');
const { ActivityLogger } = require('../services');

// Store metrics in memory (in production, use Redis or database)
const metrics = {
  requests: {
    total: 0,
    success: 0,
    error: 0,
    byEndpoint: {},
    byMethod: {},
    responseTime: []
  },
  system: {
    startTime: Date.now(),
    uptime: 0,
    memory: {},
    cpu: {}
  }
};

/**
 * Request tracking middleware
 * Logs request details and response times
 */
const trackRequest = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Override res.send to capture response
  res.send = function(data) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Update metrics
    metrics.requests.total++;
    
    if (res.statusCode >= 200 && res.statusCode < 400) {
      metrics.requests.success++;
    } else {
      metrics.requests.error++;
    }
    
    // Track by endpoint
    const endpoint = req.route ? req.route.path : req.path;
    if (!metrics.requests.byEndpoint[endpoint]) {
      metrics.requests.byEndpoint[endpoint] = {
        count: 0,
        avgResponseTime: 0,
        totalResponseTime: 0
      };
    }
    
    const endpointMetrics = metrics.requests.byEndpoint[endpoint];
    endpointMetrics.count++;
    endpointMetrics.totalResponseTime += responseTime;
    endpointMetrics.avgResponseTime = endpointMetrics.totalResponseTime / endpointMetrics.count;
    
    // Track by method
    if (!metrics.requests.byMethod[req.method]) {
      metrics.requests.byMethod[req.method] = 0;
    }
    metrics.requests.byMethod[req.method]++;
    
    // Store response time (keep last 1000 requests)
    metrics.requests.responseTime.push(responseTime);
    if (metrics.requests.responseTime.length > 1000) {
      metrics.requests.responseTime.shift();
    }
    
    // Log slow requests (> 1 second)
    if (responseTime > 1000) {
      console.warn(`Slow request detected: ${req.method} ${req.path} - ${responseTime}ms`);
      
      // Log to activity logger if available
      try {
        ActivityLogger.logSystemEvent(
          'SLOW_REQUEST',
          `Slow API request: ${req.method} ${req.path}`,
          {
            method: req.method,
            path: req.path,
            responseTime: responseTime,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          }
        );
      } catch (error) {
        // Ignore logging errors
      }
    }
    
    // Add response time header
    res.set('X-Response-Time', `${responseTime}ms`);
    
    // Call original send
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Error tracking middleware
 * Should be used after error handling middleware
 */
const trackError = (err, req, res, next) => {
  metrics.requests.error++;
  
  // Log error details
  try {
    ActivityLogger.logSystemEvent(
      'API_ERROR',
      `API Error: ${err.message}`,
      {
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    );
  } catch (error) {
    // Ignore logging errors
  }
  
  next(err);
};

/**
 * Get current metrics
 * @returns {Object} Current system and request metrics
 */
const getMetrics = () => {
  // Update system metrics
  metrics.system.uptime = Date.now() - metrics.system.startTime;
  metrics.system.memory = process.memoryUsage();
  metrics.system.cpu = {
    loadAverage: os.loadavg(),
    cpuCount: os.cpus().length,
    platform: os.platform(),
    arch: os.arch()
  };
  
  // Calculate response time statistics
  const responseTimes = metrics.requests.responseTime;
  let avgResponseTime = 0;
  let minResponseTime = 0;
  let maxResponseTime = 0;
  
  if (responseTimes.length > 0) {
    avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    minResponseTime = Math.min(...responseTimes);
    maxResponseTime = Math.max(...responseTimes);
  }
  
  return {
    ...metrics,
    requests: {
      ...metrics.requests,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      minResponseTime,
      maxResponseTime,
      successRate: metrics.requests.total > 0 
        ? Math.round((metrics.requests.success / metrics.requests.total) * 100 * 100) / 100
        : 0
    },
    system: {
      ...metrics.system,
      uptimeFormatted: formatUptime(metrics.system.uptime)
    }
  };
};

/**
 * Reset metrics
 */
const resetMetrics = () => {
  metrics.requests = {
    total: 0,
    success: 0,
    error: 0,
    byEndpoint: {},
    byMethod: {},
    responseTime: []
  };
  
  metrics.system.startTime = Date.now();
};

/**
 * Format uptime in human readable format
 * @param {number} uptime - Uptime in milliseconds
 * @returns {string} Formatted uptime
 */
const formatUptime = (uptime) => {
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Health check middleware
 * Returns system health status
 */
const healthCheck = (req, res) => {
  const currentMetrics = getMetrics();
  const memoryUsage = process.memoryUsage();
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: currentMetrics.system.uptimeFormatted,
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
      percentage: Math.round(memoryUsagePercent * 100) / 100
    },
    requests: {
      total: currentMetrics.requests.total,
      successRate: currentMetrics.requests.successRate,
      avgResponseTime: currentMetrics.requests.avgResponseTime
    }
  };
  
  // Determine health status
  if (memoryUsagePercent > 90) {
    health.status = 'critical';
  } else if (memoryUsagePercent > 75 || currentMetrics.requests.avgResponseTime > 2000) {
    health.status = 'warning';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'warning' ? 200 : 503;
  
  res.status(statusCode).json(health);
};

module.exports = {
  trackRequest,
  trackError,
  getMetrics,
  resetMetrics,
  healthCheck
};