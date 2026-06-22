/**
 * CIFO Security System Server - Modular Architecture
 * Integrates Express API, WebSocket broadcasting, Queue processing, Alert storage,
 * Health monitoring, and real-time communication
 */

require('dotenv').config();
const path = require('node:path');
const express = require('express');
const http = require('http');
const cors = require('cors');

// Initialize models and associations
require('../models');

// Import modular components
const { router } = require('./router.js');
const { alertStore } = require('./store.js');
const { alertQueue } = require('./queue.js');
const WebSocketService = require('../services/WebSocketService');
const HealthMonitorService = require('../services/HealthMonitorService');

// Track server start time
const startTime = Date.now();

const app = express();
const server = http.createServer(app);

// Middleware
console.log('[CORS] CORS_ORIGIN from env:', process.env.CORS_ORIGIN);
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true
}));

app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));

// Handle malformed JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'MALFORMED_JSON',
      message: 'Request body contains malformed JSON'
    });
  }
  next(err);
});

// Initialize WebSocket Service
const io = WebSocketService.initialize(server);
app.set('wsService', WebSocketService);

// Legacy WebSocket connections tracking (for compatibility)
const wsConnections = new Set();

// Queue processing worker
function startQueueProcessor() {
  const processQueue = async () => {
    try {
      // Check if queue is still running
      if (!alertQueue.running) {
        return; // Stop processing if queue is stopped
      }
      
      const item = alertQueue.dequeue();
      if (!item) {
        // No items to process, wait and try again
        setTimeout(processQueue, 100);
        return;
      }

      console.log(`[Server] Processing queue item: ${item.id}`);
      
      // Process the alert broadcast
      if (item.data.type === 'ALERT_CREATED') {
        const { alert } = item.data;
        
        // Broadcast via new WebSocket service
        WebSocketService.broadcastToRoom('alerts_room', 'alert_created', {
          id: alert.id,
          type: alert.type,
          location: alert.location,
          timestamp: alert.timestamp,
          severity: alert.severity || 'WARNING'
        });
        
        // Legacy WebSocket broadcast
        const broadcastData = {
          kind: 'ALERT_CREATED',
          data: {
            id: alert.id,
            requestId: alert.requestId,
            userId: alert.userId,
            type: alert.type,
            status: alert.status,
            gps: alert.gps,
            priority: alert.priority,
            createdAt: alert.timestamps.createdAt
          },
          timestamp: Date.now(),
          processedAt: Date.now()
        };

        // Broadcast to all connected WebSocket clients
        let broadcastCount = 0;
        wsConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(broadcastData));
            broadcastCount++;
          }
        });

        console.log(`[Server] Broadcasted ALERT_CREATED to ${broadcastCount} clients for alert ${alert.id}`);
        
        // Mark as successfully processed
        alertQueue.ack(item.id);
      }
      
    } catch (error) {
      console.error('[Server] Queue processing error:', error);
      if (item) {
        alertQueue.nack(item.id, error);
      }
    }
    
    // Continue processing only if queue is still running
    if (alertQueue.running) {
      setTimeout(processQueue, 10);
    }
  };
  
  // Start the queue processor
  processQueue();
  console.log('[Server] Queue processor started');
}

// Broadcast function for immediate WebSocket messages via Socket.IO
function broadcastMessage(message) {
  if (io) {
    io.emit('message', message);
    console.log(`[Server] Broadcasted message via Socket.IO`);
    return io.engine.clientsCount;
  }
  return 0;
}

// Static files — snapshots, HLS segments, visitor photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api', router);

// Health check endpoint
app.get('/health', (req, res) => {
  const storeStats = alertStore.getStats();
  const queueStats = alertQueue.getStats();
  
  res.json({
    status: 'OK',
    timestamp: Date.now(),
    alerts: storeStats.totalAlerts,
    connections: wsConnections.size,
    services: {
      api: 'running',
      websocket: `${wsConnections.size} connections`,
      store: `${storeStats.totalAlerts} alerts`,
      queue: `${queueStats.queueSize} pending`
    },
    uptime: Date.now() - startTime,
    version: '1.0.0'
  });
});

// Legacy /panic endpoint (redirect to new API)
app.all('/panic', (req, res) => {
  res.status(301).json({
    error: 'ENDPOINT_MOVED',
    message: 'This endpoint has moved to /api/panic',
    newEndpoint: '/api/panic'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found'
  });
});

// Start services
startQueueProcessor();

// Start Health Monitor Service (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  HealthMonitorService.start();
}

// Start VIGI HLS transcoder (always on — needed for live stream in dashboard)
{
  const path = require('node:path');
  const { VigiHLSTranscoder } = require('../services/vigi/vigiHLS');
  const Camera = require('../models/Camera');
  const cfg = {
    host: process.env.VIGI_CAMERA_HOST,
    port: parseInt(process.env.VIGI_CAMERA_RTSP_PORT || '554', 10),
    username: process.env.VIGI_CAMERA_USER || 'admin',
    password: process.env.VIGI_CAMERA_PASS,
    cameraId: process.env.VIGI_CAMERA_ID || 'C240-01',
    outputDir: path.join(__dirname, '../uploads/hls'),
  };
  if (cfg.host && cfg.password) {
    const transcoder = new VigiHLSTranscoder(cfg);
    const hlsUrl = transcoder.start();
    Camera.getById(cfg.cameraId)
      .then((cam) => cam && Camera.update(cfg.cameraId, { label: cam.label, area: cam.area, lat: cam.lat, lng: cam.lng, stream_url: hlsUrl }))
      .catch(() => {});
    console.log(`[HLS] Transcoder started: ${cfg.cameraId} → ${hlsUrl}`);
  }
}

// Start VIGI Crossline Counting — camera-native in/out counting (optional)
if (process.env.VIGI_CROSSLINE_ENABLED === 'true') {
  const { startCrosslineCounting } = require('../services/vigi/vigiCrosslineCounting');
  startCrosslineCounting({ wsService: WebSocketService })
    .then(() => console.log('[boot] VIGI crossline counting online'))
    .catch((err) => console.error('[boot] VIGI crossline counting failed:', err.message));
}

// Start VIGI AI Bridge — snapshot analysis + security alerts (optional)
if (process.env.VIGI_AI_ENABLED === 'true') {
  const { startVigiAIBridge } = require('../services/vigi');
  startVigiAIBridge()
    .then(() => console.log('[boot] VIGI AI bridge online'))
    .catch((err) => console.error('[boot] VIGI AI bridge failed to start:', err.message));
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  HealthMonitorService.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  HealthMonitorService.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3001;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[Server] Alert Ingestion Server running on port ${PORT}`);
    console.log(`[Server] WebSocket server ready for real-time alerts`);
    console.log(`[Server] API endpoints available at /api/*`);
    console.log(`[Server] Health check available at /health`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

module.exports = { 
  app, 
  server, 
  wsConnections,
  broadcastMessage
};