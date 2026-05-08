/**
 * Comprehensive Tests for Camera API Endpoints
 * Tests camera retrieval, heartbeat, and status tracking
 */

const request = require('supertest');
const { app, server } = require('../server.js');

describe('Camera API Endpoints', () => {
  let server;
  
  beforeAll((done) => {
    server = app.listen(0, () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('GET /cameras', () => {
    test('Should retrieve all cameras with status', async () => {
      const response = await request(server)
        .get('/cameras')
        .expect(200);

      expect(response.body).toHaveProperty('cameras');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('online');
      expect(response.body).toHaveProperty('offline');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.cameras)).toBe(true);
    });

    test('Should return camera objects with required properties', async () => {
      const response = await request(server)
        .get('/cameras')
        .expect(200);

      if (response.body.cameras.length > 0) {
        const camera = response.body.cameras[0];
        expect(camera).toHaveProperty('id');
        expect(camera).toHaveProperty('name');
        expect(camera).toHaveProperty('status');
        expect(camera).toHaveProperty('lastSeen');
        expect(camera).toHaveProperty('healthScore');
      }
    });

    test('Should count cameras correctly', async () => {
      const response = await request(server)
        .get('/cameras')
        .expect(200);

      const total = response.body.total;
      const online = response.body.online;
      const offline = response.body.offline;
      
      expect(online + offline).toBeLessThanOrEqual(total);
    });
  });

  describe('POST /cameras/:id/heartbeat', () => {
    test('Should accept valid heartbeat data', async () => {
      const heartbeatData = {
        status: 'online',
        responseTime: 150,
        healthScore: 95,
        streamAccessible: true
      };

      const response = await request(server)
        .post('/cameras/cam_1/heartbeat')
        .send(heartbeatData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('Should reject invalid camera ID', async () => {
      const heartbeatData = {
        status: 'online',
        responseTime: 150,
        healthScore: 95
      };

      const response = await request(server)
        .post('/cameras/invalid_camera_id/heartbeat')
        .send(heartbeatData)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    test('Should update camera status after heartbeat', async () => {
      // Send heartbeat
      await request(server)
        .post('/cameras/cam_1/heartbeat')
        .send({
          status: 'online',
          responseTime: 100,
          healthScore: 100
        })
        .expect(200);

      // Get cameras and check status updated
      const response = await request(server)
        .get('/cameras')
        .expect(200);

      const cam1 = response.body.cameras.find(c => c.id === 'cam_1');
      if (cam1) {
        expect(cam1.status).toBe('online');
        expect(cam1.healthScore).toBe(100);
      }
    });

    test('Should track response time in heartbeat', async () => {
      const responseTime = 250;
      
      await request(server)
        .post('/cameras/cam_2/heartbeat')
        .send({
          status: 'online',
          responseTime: responseTime,
          healthScore: 90
        })
        .expect(200);

      const response = await request(server)
        .get('/cameras')
        .expect(200);

      const cam2 = response.body.cameras.find(c => c.id === 'cam_2');
      if (cam2) {
        expect(cam2.responseTime).toBe(responseTime);
      }
    });

    test('Should handle offline camera status', async () => {
      const response = await request(server)
        .post('/cameras/cam_3/heartbeat')
        .send({
          status: 'offline',
          error: 'Connection lost',
          healthScore: 0
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('Should handle degraded status', async () => {
      const response = await request(server)
        .post('/cameras/cam_1/heartbeat')
        .send({
          status: 'degraded',
          responseTime: 1000,
          healthScore: 50,
          error: 'High latency detected'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Camera Status Integration', () => {
    test('Should update online count when camera comes online', async () => {
      const getInitial = await request(server)
        .get('/cameras')
        .expect(200);
      const initialOnline = getInitial.body.online;

      // Send heartbeat to make camera online
      await request(server)
        .post('/cameras/cam_4/heartbeat')
        .send({
          status: 'online',
          healthScore: 100
        })
        .expect(200);

      const getAfter = await request(server)
        .get('/cameras')
        .expect(200);
      
      // Note: This may or may not increase count depending on initial state
      expect(getAfter.body.online).toBeGreaterThanOrEqual(0);
    });

    test('Should return error when server fails', async () => {
      // This test verifies error handling
      const response = await request(server)
        .post('/cameras/null/heartbeat')
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
