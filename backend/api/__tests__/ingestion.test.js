/**
 * Comprehensive Unit & Integration Tests for Alert Ingestion (Story S3)
 * Tests API endpoints, validation, idempotency, WebSocket broadcasting, and queue processing
 */

import request from 'supertest';
import { jest } from '@jest/globals';
import { WebSocket } from 'ws';

// Import modules to test
import { app, server, wss, wsConnections, broadcastMessage } from '../server.js';
import { alertStore } from '../store.js';
import { alertQueue } from '../queue.js';
import { metrics } from '../router.js';

// Test utilities
function createValidPayload(overrides = {}) {
  const basePayload = {
    requestId: `test-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    type: 'MEDICAL',
    gps: {
      latitude: -6.2088,
      longitude: 106.8456,
      accuracy: 10
    },
    metadata: {
      source: 'mobile_app',
      version: '1.0.0'
    }
  };
  
  return { ...basePayload, ...overrides };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock WebSocket for testing
class MockWebSocket {
  constructor() {
    this.readyState = 1; // WebSocket.OPEN
    this.messages = [];
    this.onMessage = null;
    this.onClose = null;
    this.onError = null;
  }
  
  send(data) {
    this.messages.push(data);
    if (this.onMessage) {
      this.onMessage(data);
    }
  }
  
  close() {
    this.readyState = 3; // WebSocket.CLOSED
    if (this.onClose) {
      this.onClose();
    }
  }
  
  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }
  
  getAllMessages() {
    return [...this.messages];
  }
  
  clearMessages() {
    this.messages = [];
  }
}

describe('Alert Ingestion System (Story S3)', () => {
  let mockWs;
  let testServer;
  
  beforeAll(async () => {
    // Set test port to avoid conflicts
    process.env.PORT = '0'; // Use random available port
  });
  
  beforeEach(async () => {
    // Clear all stores and queues
    alertStore.clear();
    
    // Clear queue (reset to initial state)
    while (!alertQueue.isEmpty()) {
      const item = alertQueue.dequeue();
      if (item) {
        alertQueue.ack(item.id);
      }
    }
    
    // Clear WebSocket connections
    wsConnections.clear();
    
    // Create mock WebSocket
    mockWs = new MockWebSocket();
    wsConnections.add(mockWs);
    
    // Reset metrics
    Object.assign(metrics.requests, {
      total: 0,
      successful: 0,
      failed: 0,
      duplicates: 0
    });
    
    Object.assign(metrics.latency, {
      total: 0,
      count: 0,
      avg: 0,
      min: Infinity,
      max: 0
    });
    
    // Small delay to ensure clean state
    await delay(50);
  });
  
  afterEach(async () => {
    // Clean up WebSocket connections
    wsConnections.clear();
    await delay(50);
  });
  
  afterAll(async () => {
    // Close server and WebSocket connections
    if (wss) {
      wss.close();
    }
    if (server) {
      server.close();
    }
    await delay(100);
  });

  describe('POST /api/panic - Valid Payloads', () => {
    test('should create alert with valid payload and return 201', async () => {
      const payload = createValidPayload();
      
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      expect(response.body).toMatchObject({
        message: 'Alert created successfully',
        alert: {
          requestId: payload.requestId,
          status: 'ACTIVE',
          type: 'MEDICAL',
          priority: 10
        }
      });
      
      expect(response.body.alert.id).toBeDefined();
      expect(response.body.alert.createdAt).toBeDefined();
      expect(response.body.queueId).toBeDefined();
      expect(response.body.ingest_latency_ms).toBeGreaterThan(0);
    });
    
    test('should handle GPS coordinates correctly', async () => {
      const payload = createValidPayload({
        gps: {
          latitude: -6.2088,
          longitude: 106.8456,
          accuracy: 15
        }
      });
      
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      // Verify alert was stored with GPS data
      const storedAlert = alertStore.getAlertByRequestId(payload.requestId);
      expect(storedAlert.gps).toEqual(payload.gps);
      expect(storedAlert.geotag).toBeDefined();
      expect(storedAlert.geotag.coordinates.lat).toBe(payload.gps.latitude);
    });
    
    test('should handle optional GPS (no GPS provided)', async () => {
      const payload = createValidPayload();
      delete payload.gps;
      
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      const storedAlert = alertStore.getAlertByRequestId(payload.requestId);
      expect(storedAlert.gps).toBeNull();
      expect(storedAlert.geotag).toBeNull();
    });
    
    test('should assign correct priority based on panic type', async () => {
      const testCases = [
        { type: 'MEDICAL', expectedPriority: 10 },
        { type: 'FIRE', expectedPriority: 9 },
        { type: 'CRIME', expectedPriority: 8 },
        { type: 'OTHER', expectedPriority: 5 }
      ];
      
      for (const testCase of testCases) {
        const payload = createValidPayload({ type: testCase.type });
        
        const response = await request(app)
          .post('/api/panic')
          .send(payload)
          .expect(201);
        
        expect(response.body.alert.priority).toBe(testCase.expectedPriority);
      }
    });
  });

  describe('POST /api/panic - Validation Tests', () => {
    test('should reject invalid panic type', async () => {
      const payload = createValidPayload({ type: 'INVALID_TYPE' });
      
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        field: 'type'
      });
      expect(response.body.message).toContain('Invalid panic type');
    });
    
    test('should reject missing requestId', async () => {
      const payload = createValidPayload();
      delete payload.requestId;
      
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        field: 'requestId'
      });
    });
    
    test('should reject invalid requestId format', async () => {
      const payload = createValidPayload({ requestId: 'short' });
      
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        field: 'requestId'
      });
    });
    
    test('should reject missing userId', async () => {
      const payload = createValidPayload();
      delete payload.userId;
      
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        field: 'userId'
      });
    });
    
    test('should reject invalid GPS coordinates', async () => {
      const invalidGpsTests = [
        { gps: { latitude: 91, longitude: 0 }, error: 'latitude' },
        { gps: { latitude: 0, longitude: 181 }, error: 'longitude' },
        { gps: { latitude: 0, longitude: 0, accuracy: -5 }, error: 'accuracy' },
        { gps: { latitude: 0, longitude: 0, accuracy: 150 }, error: 'accuracy' }
      ];
      
      for (const testCase of invalidGpsTests) {
        const payload = createValidPayload(testCase);
        
        const response = await request(app)
          .post('/api/panic')
          .send(payload)
          .expect(400);
        
        expect(response.body).toMatchObject({
          error: 'VALIDATION_ERROR',
          field: 'gps'
        });
      }
    });
  });

  describe('POST /api/panic - Idempotency Tests', () => {
    test('should return 202 for duplicate requestId', async () => {
      const payload = createValidPayload();
      
      // First request
      const firstResponse = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      // Wait to avoid any timing issues
      await delay(100);
      
      // Second request with same requestId
      const secondResponse = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(202);
      
      expect(secondResponse.body).toMatchObject({
        message: 'Alert already exists',
        duplicate: true,
        alert: {
          id: firstResponse.body.alert.id,
          requestId: payload.requestId
        }
      });
      
      // Verify only one alert was created
      const alerts = alertStore.getAlertsByUser(payload.userId);
      expect(alerts).toHaveLength(1);
    });
    
    test('should handle concurrent duplicate requests', async () => {
      const payload = createValidPayload();
      
      // Send multiple concurrent requests
      const promises = Array(5).fill().map(() => 
        request(app).post('/api/panic').send(payload)
      );
      
      const responses = await Promise.all(promises);
      
      // One should be 201 (created), others should be 202 (duplicate)
      const createdResponses = responses.filter(r => r.status === 201);
      const duplicateResponses = responses.filter(r => r.status === 202);
      
      expect(createdResponses).toHaveLength(1);
      expect(duplicateResponses.length).toBeGreaterThanOrEqual(1);
      
      // Verify only one alert was created
      const alerts = alertStore.getAlertsByUser(payload.userId);
      expect(alerts).toHaveLength(1);
    });
  });

  describe('WebSocket Broadcasting Tests', () => {
    test('should broadcast ALERT_CREATED immediately on alert creation', async () => {
      const payload = createValidPayload();
      
      // Clear previous messages
      mockWs.clearMessages();
      
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      // Wait a bit for broadcast
      await delay(50);
      
      const messages = mockWs.getAllMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      // Find the ALERT_CREATED message
      const alertMessage = messages.find(msg => {
        try {
          const parsed = JSON.parse(msg);
          return parsed.kind === 'ALERT_CREATED';
        } catch {
          return false;
        }
      });
      
      expect(alertMessage).toBeDefined();
      
      const parsedMessage = JSON.parse(alertMessage);
      expect(parsedMessage).toMatchObject({
        kind: 'ALERT_CREATED',
        data: {
          id: response.body.alert.id,
          requestId: payload.requestId,
          userId: payload.userId,
          type: 'MEDICAL',
          status: 'ACTIVE'
        }
      });
    });
    
    test('should broadcast within 1 second requirement', async () => {
      const payload = createValidPayload();
      mockWs.clearMessages();
      
      const startTime = Date.now();
      
      await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      // Wait for broadcast
      await delay(100);
      
      const messages = mockWs.getAllMessages();
      const alertMessage = messages.find(msg => {
        try {
          const parsed = JSON.parse(msg);
          return parsed.kind === 'ALERT_CREATED';
        } catch {
          return false;
        }
      });
      
      expect(alertMessage).toBeDefined();
      
      const parsedMessage = JSON.parse(alertMessage);
      const broadcastLatency = parsedMessage.timestamp - startTime;
      
      // Should be well under 1 second (1000ms)
      expect(broadcastLatency).toBeLessThan(1000);
    });
    
    test('should not broadcast for duplicate requests', async () => {
      const payload = createValidPayload();
      
      // First request
      await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      await delay(50);
      mockWs.clearMessages();
      
      // Second request (duplicate)
      await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(202);
      
      await delay(50);
      
      // Should not have new ALERT_CREATED messages
      const messages = mockWs.getAllMessages();
      const alertMessages = messages.filter(msg => {
        try {
          const parsed = JSON.parse(msg);
          return parsed.kind === 'ALERT_CREATED';
        } catch {
          return false;
        }
      });
      
      expect(alertMessages).toHaveLength(0);
    });
  });

  describe('PATCH /api/alerts/:id - Update Alert Status', () => {
    let alertId;
    
    beforeEach(async () => {
      // Create an alert first
      const payload = createValidPayload();
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      alertId = response.body.alert.id;
      await delay(50);
    });
    
    test('should update alert status successfully', async () => {
      const response = await request(app)
        .patch(`/api/alerts/${alertId}`)
        .send({ status: 'RESOLVED' })
        .expect(200);
      
      expect(response.body).toMatchObject({
        message: 'Alert updated successfully',
        alert: {
          id: alertId,
          status: 'RESOLVED'
        }
      });
      
      // Verify in store
      const updatedAlert = alertStore.getAlert(alertId);
      expect(updatedAlert.status).toBe('RESOLVED');
    });
    
    test('should reject invalid status', async () => {
      const response = await request(app)
        .patch(`/api/alerts/${alertId}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR'
      });
    });
    
    test('should return 404 for non-existent alert', async () => {
      const response = await request(app)
        .patch('/api/alerts/non-existent-id')
        .send({ status: 'RESOLVED' })
        .expect(404);
      
      expect(response.body).toMatchObject({
        error: 'NOT_FOUND'
      });
    });
  });

  describe('GET /api/alerts - Retrieve Alerts', () => {
    beforeEach(async () => {
      // Create multiple alerts for testing
      const alerts = [
        createValidPayload({ type: 'MEDICAL' }),
        createValidPayload({ type: 'FIRE' }),
        createValidPayload({ type: 'CRIME' })
      ];
      
      for (const alert of alerts) {
        await request(app)
          .post('/api/panic')
          .send(alert)
          .expect(201);
      }
      
      await delay(100);
    });
    
    test('should retrieve all active alerts', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .expect(200);
      
      expect(response.body.alerts).toHaveLength(3);
      expect(response.body.count).toBe(3);
      
      // Should be sorted by priority (MEDICAL=10, FIRE=9, CRIME=8)
      expect(response.body.alerts[0].type).toBe('MEDICAL');
      expect(response.body.alerts[1].type).toBe('FIRE');
      expect(response.body.alerts[2].type).toBe('CRIME');
    });
    
    test('should filter alerts by type', async () => {
      const response = await request(app)
        .get('/api/alerts?type=MEDICAL')
        .expect(200);
      
      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.alerts[0].type).toBe('MEDICAL');
    });
  });

  describe('GET /api/metrics - System Metrics', () => {
    test('should return comprehensive metrics', async () => {
      // Create some alerts to generate metrics
      const payload = createValidPayload();
      await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      const response = await request(app)
        .get('/api/metrics')
        .expect(200);
      
      expect(response.body).toHaveProperty('api');
      expect(response.body).toHaveProperty('store');
      expect(response.body).toHaveProperty('queue');
      expect(response.body).toHaveProperty('timestamp');
      
      expect(response.body.api.requests.total).toBeGreaterThan(0);
      expect(response.body.api.latency.avg_ms).toBeGreaterThan(0);
    });
  });

  describe('Error Handling & Malformed JSON', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/panic')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
      
      expect(response.body).toMatchObject({
        error: 'MALFORMED_JSON',
        message: 'Request body contains malformed JSON'
      });
    });
    
    test('should handle server errors gracefully', async () => {
      // Mock a store error
      const originalCreateAlert = alertStore.createAlert;
      alertStore.createAlert = jest.fn(() => {
        throw new Error('Simulated store error');
      });
      
      const payload = createValidPayload();
      
      const response = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(500);
      
      expect(response.body).toMatchObject({
        error: 'INTERNAL_ERROR',
        message: 'Failed to process panic alert'
      });
      
      // Restore original function
      alertStore.createAlert = originalCreateAlert;
    });
  });

  describe('Integration Tests - End-to-End Flow', () => {
    test('should complete full alert lifecycle', async () => {
      const payload = createValidPayload();
      mockWs.clearMessages();
      
      // 1. Create alert
      const createResponse = await request(app)
        .post('/api/panic')
        .send(payload)
        .expect(201);
      
      const alertId = createResponse.body.alert.id;
      
      // 2. Verify WebSocket broadcast
      await delay(100);
      const messages = mockWs.getAllMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      // 3. Update alert status
      await request(app)
        .patch(`/api/alerts/${alertId}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      
      // 4. Resolve alert
      await request(app)
        .patch(`/api/alerts/${alertId}`)
        .send({ status: 'RESOLVED' })
        .expect(200);
      
      // 5. Verify final state
      const finalAlert = alertStore.getAlert(alertId);
      expect(finalAlert.status).toBe('RESOLVED');
      
      // 6. Check metrics
      const metricsResponse = await request(app)
        .get('/api/metrics')
        .expect(200);
      
      expect(metricsResponse.body.store.totalAlerts).toBe(1);
      expect(metricsResponse.body.store.resolvedAlerts).toBe(1);
      expect(metricsResponse.body.store.activeAlerts).toBe(0);
    });
  });
});