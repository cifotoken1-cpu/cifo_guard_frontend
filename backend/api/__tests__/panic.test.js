const request = require('supertest');
const { app, server, wss } = require('../server');

// Helper to clear in-memory stores between tests
function clearStores() {
  // Access the module's internal state
  const serverModule = require('../server');
  // Clear arrays and maps
  if (serverModule.panicAlerts) serverModule.panicAlerts.length = 0;
  if (serverModule.processedRequestIds) serverModule.processedRequestIds.clear();
  if (serverModule.userRateLimit) serverModule.userRateLimit.clear();
}

// Helper to wait between tests to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('POST /panic', () => {
  beforeEach(async () => {
    clearStores();
    await delay(1000); // Longer delay to avoid rate limiting
  });
  
  afterEach(async () => {
    await delay(500); // Additional delay after each test
  });
  
  afterAll(async () => {
    // Close server and WebSocket connections
    if (wss) {
      wss.clients.forEach(ws => ws.terminate());
      wss.close();
    }
    if (server) {
      server.close();
    }
    await delay(100);
  });
  // Helper function to create valid panic alert payload
  const createValidPayload = (overrides = {}) => ({
    requestId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    user_id: `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, // Unique user per test
    type: 'MEDICAL',
    gps: {
      latitude: -6.2088,
      longitude: 106.8456,
      accuracy: 15
    },
    message: 'Emergency medical assistance needed',
    ...overrides
  });

  describe('AC1: GPS Validation (±30m accuracy)', () => {
    test('should accept valid GPS coordinates with good accuracy', async () => {
      const payload = createValidPayload({
        gps: {
          latitude: -6.2088,
          longitude: 106.8456,
          accuracy: 25 // within 30m threshold
        }
      });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body.message).toBe('Panic alert received and processed');
      expect(response.body.alertId).toBeDefined();
      expect(response.body.requestId).toBe(payload.requestId);
    });

    test('should reject GPS with poor accuracy (>30m)', async () => {
      const payload = createValidPayload({
        gps: {
          latitude: -6.2088,
          longitude: 106.8456,
          accuracy: 50 // exceeds 30m threshold
        }
      });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.message).toContain('GPS accuracy must be within 30 meters');
    });

    test('should reject invalid latitude', async () => {
      const payload = createValidPayload({
        gps: {
          latitude: 95, // invalid latitude > 90
          longitude: 106.8456,
          accuracy: 15
        }
      });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(400);

      expect(response.body.message).toContain('GPS latitude must be between -90 and 90');
    });

    test('should reject invalid longitude', async () => {
      const payload = createValidPayload({
        gps: {
          latitude: -6.2088,
          longitude: 185, // invalid longitude > 180
          accuracy: 15
        }
      });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(400);

      expect(response.body.message).toContain('GPS longitude must be between -180 and 180');
    });

    test('should reject missing GPS coordinates', async () => {
      const payload = createValidPayload();
      delete payload.gps;

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(400);

      expect(response.body.message).toBe('GPS coordinates are required');
    });
  });

  describe('AC2: Panic Type Validation (MEDICAL|CRIME|FIRE|OTHER)', () => {
    test('should accept valid panic type MEDICAL', async () => {
      const payload = createValidPayload({ type: 'MEDICAL' });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body.message).toBe('Panic alert received and processed');
    });

    test('should accept valid panic type CRIME', async () => {
      const payload = createValidPayload({ type: 'CRIME' });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body.message).toBe('Panic alert received and processed');
    });

    test('should accept valid panic type FIRE', async () => {
      const payload = createValidPayload({ type: 'FIRE' });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body.message).toBe('Panic alert received and processed');
    });

    test('should accept valid panic type OTHER', async () => {
      const payload = createValidPayload({ type: 'OTHER' });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body.message).toBe('Panic alert received and processed');
    });

    test('should accept lowercase panic type and convert to uppercase', async () => {
      const payload = createValidPayload({ type: 'medical' });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body.message).toBe('Panic alert received and processed');
    });

    test('should reject invalid panic type', async () => {
      const payload = createValidPayload({ type: 'INVALID_TYPE' });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.message).toContain('Panic type must be one of: MEDICAL, CRIME, FIRE, OTHER');
    });

    test('should reject missing panic type', async () => {
      const payload = createValidPayload();
      delete payload.type;

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(400);

      expect(response.body.message).toBe('Panic type is required');
    });
  });

  describe('AC3: Rate Limiting (max 1 request / 5s per user)', () => {
    test('should allow first request from user', async () => {
      const payload = createValidPayload({ user_id: 'rate-test-user-1' });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body.message).toBe('Panic alert received and processed');
    });

    test('should reject second request within 5 seconds from same user', async () => {
      const userId = 'rate-test-user-2';
      const payload1 = createValidPayload({ user_id: userId });
      const payload2 = createValidPayload({ user_id: userId });

      // First request should succeed
      await request(app)
        .post('/panic')
        .send(payload1)
        .expect(202);

      // Second request within 5 seconds should be rate limited
      const response = await request(app)
        .post('/panic')
        .send(payload2)
        .expect(429);

      expect(response.body.error).toBe('Rate limit exceeded');
      expect(response.body.message).toBe('Maximum 1 panic alert per 5 seconds');
      expect(response.body.retryAfter).toBeDefined();
      expect(typeof response.body.retryAfter).toBe('number');
    });

    test('should allow request after rate limit window expires', async () => {
      const userId = 'rate-test-user-3';
      const payload1 = createValidPayload({ user_id: userId });

      // First request
      await request(app)
        .post('/panic')
        .send(payload1)
        .expect(202);

      // Wait for rate limit window to expire (5+ seconds)
      await new Promise(resolve => setTimeout(resolve, 5100));

      // Second request after window should succeed
      const payload2 = createValidPayload({ user_id: userId });
      const response = await request(app)
        .post('/panic')
        .send(payload2)
        .expect(202);

      expect(response.body.message).toBe('Panic alert received and processed');
    }, 10000); // Increase timeout for this test

    test('should allow simultaneous requests from different users', async () => {
      const payload1 = createValidPayload({ user_id: 'user-a' });
      const payload2 = createValidPayload({ user_id: 'user-b' });

      // Both requests should succeed
      const [response1, response2] = await Promise.all([
        request(app).post('/panic').send(payload1),
        request(app).post('/panic').send(payload2)
      ]);

      expect(response1.status).toBe(202);
      expect(response2.status).toBe(202);
    });
  });

  describe('AC4: Request ID Uniqueness and Idempotency', () => {
    test('should accept valid requestId', async () => {
      const payload = createValidPayload({
        requestId: 'valid-request-id-123456789'
      });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body.requestId).toBe(payload.requestId);
    });

    test('should reject short requestId', async () => {
      const payload = createValidPayload({
        requestId: 'short' // less than 10 characters
      });

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(400);

      expect(response.body.message).toBe('Request ID must be at least 10 characters');
    });

    test('should reject missing requestId', async () => {
      const payload = createValidPayload();
      delete payload.requestId;

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(400);

      expect(response.body.message).toBe('Request ID is required');
    });

    test('should handle duplicate requestId idempotently (return 202)', async () => {
      const requestId = 'duplicate-test-' + Date.now();
      const userId = 'idempotent-user-' + Date.now();
      const payload = createValidPayload({ requestId, user_id: userId });

      // First request
      const response1 = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response1.body.message).toBe('Panic alert received and processed');
      const alertId1 = response1.body.alertId;

      // Wait to avoid rate limiting
      await delay(6000);

      // Second request with same requestId (should be idempotent)
      const response2 = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response2.body.message).toBe('Panic alert already processed (idempotent)');
      expect(response2.body.requestId).toBe(requestId);
      expect(response2.body.alertId).toBe(alertId1); // Same alert ID
    });

    test('should allow same requestId from different users (edge case)', async () => {
      const requestId = 'shared-request-id-' + Date.now();
      const payload1 = createValidPayload({ requestId, user_id: 'user-1' });
      const payload2 = createValidPayload({ requestId, user_id: 'user-2' });

      // First request
      const response1 = await request(app)
        .post('/panic')
        .send(payload1)
        .expect(202);

      // Second request with same requestId but different user (should be idempotent)
      const response2 = await request(app)
        .post('/panic')
        .send(payload2)
        .expect(202);

      expect(response2.body.message).toBe('Panic alert already processed (idempotent)');
    });
  });

  describe('AC5: Success Response (2xx when accepted)', () => {
    test('should return 202 Accepted for valid panic alert', async () => {
      const payload = createValidPayload();

      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body).toHaveProperty('message', 'Panic alert received and processed');
      expect(response.body).toHaveProperty('alertId');
      expect(response.body).toHaveProperty('requestId', payload.requestId);
      expect(response.body).toHaveProperty('timestamp');
      
      // Validate timestamp format
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    test('should return 202 for idempotent requests', async () => {
      const userId = 'ac5-user-' + Date.now();
      const payload = createValidPayload({ user_id: userId });

      // First request
      await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      // Wait to avoid rate limiting
      await delay(6000);

      // Duplicate request should also return 202
      const response = await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      expect(response.body.message).toBe('Panic alert already processed (idempotent)');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/panic')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      // Express will handle malformed JSON automatically
    });

    test('should handle empty request body', async () => {
      const response = await request(app)
        .post('/panic')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Integration Tests', () => {
    test('should store panic alert in memory', async () => {
      const payload = createValidPayload();

      await request(app)
        .post('/panic')
        .send(payload)
        .expect(202);

      // Verify alert is stored by retrieving all alerts
      const getResponse = await request(app)
        .get('/panic')
        .expect(200);

      const storedAlert = getResponse.body.alerts.find(
        alert => alert.requestId === payload.requestId
      );

      expect(storedAlert).toBeDefined();
      expect(storedAlert.type).toBe(payload.type.toUpperCase());
      expect(storedAlert.user_id).toBe(payload.user_id);
      expect(storedAlert.gps.latitude).toBe(payload.gps.latitude);
      expect(storedAlert.gps.longitude).toBe(payload.gps.longitude);
    });
  });
});

describe('GET /panic', () => {
  test('should return all panic alerts', async () => {
    const response = await request(app)
      .get('/panic')
      .expect(200);

    expect(response.body).toHaveProperty('alerts');
    expect(response.body).toHaveProperty('total');
    expect(Array.isArray(response.body.alerts)).toBe(true);
    expect(typeof response.body.total).toBe('number');
  });
});

describe('GET /health', () => {
  test('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('alerts');
    expect(response.body).toHaveProperty('connections');
  });
});

describe('404 Handler', () => {
  test('should return 404 for unknown endpoints', async () => {
    const response = await request(app)
      .get('/unknown-endpoint')
      .expect(404);

    expect(response.body.error).toBe('Not found');
    expect(response.body.message).toBe('Endpoint not found');
  });
});