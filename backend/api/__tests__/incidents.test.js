/**
 * Comprehensive Unit & Integration Tests for Incident Management (Story C3)
 * Tests incident creation, activity logging, validation, and integration
 */

const request = require('supertest');

// Import modules to test
const { app, server } = require('../server.js');
// incidentStore telah dihapus karena implementasi telah dipindahkan ke database
const { alertQueue } = require('../queue.js');

describe('Incident Management API (Story C3)', () => {
  let testIncidentId;
  let testActivityId;

  beforeAll(async () => {
    // Create test team members for foreign key constraints
    const TeamMember = require('../../models/TeamMember');
    try {
      await TeamMember.create({
        id: 'guard_001',
        nama: 'Test Guard',
        role: 'GUARD',
        status: 'ACTIVE'
      });
      await TeamMember.create({
        id: 'Test Officer',
        nama: 'Test Officer',
        role: 'OFFICER',
        status: 'ACTIVE'
      });
      await TeamMember.create({
        id: 'Performance Tester',
        nama: 'Performance Tester',
        role: 'TESTER',
        status: 'ACTIVE'
      });
      await TeamMember.create({
        id: 'Officer 1',
        nama: 'Officer 1',
        role: 'OFFICER',
        status: 'ACTIVE'
      });
      await TeamMember.create({
        id: 'Technician 1',
        nama: 'Technician 1',
        role: 'TECHNICIAN',
        status: 'ACTIVE'
      });
      // Create officers for concurrent tests
      for (let i = 0; i <= 10; i++) {
        await TeamMember.create({
          id: `Officer ${i}`,
          nama: `Officer ${i}`,
          role: 'OFFICER',
          status: 'ACTIVE'
        });
      }
    } catch (error) {
      // Ignore if team members already exist
      console.log('Test team members may already exist:', error.message);
    }
  });

  beforeEach(() => {
    // Clear stores before each test
    // incidentStore telah dihapus karena implementasi telah dipindahkan ke database
    if (alertQueue && alertQueue.clear) {
      alertQueue.clear();
    }
    
    // Reset test variables
    testIncidentId = null;
    testActivityId = null;
  });

  afterAll(async () => {
    // Clean up after all tests
    
    // Stop queue processor by clearing any pending timeouts
    if (alertQueue && alertQueue.stop) {
      alertQueue.stop();
    }
    
    // Close WebSocket connections
    const { wsConnections } = require('../server.js');
    if (wsConnections) {
      wsConnections.forEach(ws => {
        if (ws.readyState === 1) { // OPEN
          ws.close();
        }
      });
      wsConnections.clear();
    }
    
    // Close server
    if (server && server.close) {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('POST /api/incidents - Incident Creation', () => {
    const validIncidentData = {
      title: 'Security Breach in Building A',
      description: 'Unauthorized access detected in server room',
      type: 'SECURITY',
      priority: 'HIGH',
      location: 'Building A, Floor 3, Server Room',
      reportedBy: 'guard_001',
      coordinates: {
        latitude: -6.2088,
        longitude: 106.8456
      }
    };

    test('P0: should create incident with valid data', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .send(validIncidentData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('incidentId');
      expect(response.body.data).toHaveProperty('activityId');
      expect(response.body.data).toHaveProperty('status', 'OPEN');
      
      testIncidentId = response.body.data.incidentId;
      testActivityId = response.body.data.activityId;
    });

    test('P0: should validate required fields', async () => {
      const invalidData = {
        description: 'Missing required fields'
      };

      const response = await request(app)
        .post('/api/incidents')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.details).toContain('title');
      expect(response.body.details).toContain('type');
      expect(response.body.details).toContain('reportedBy');
    });

    test('P0: should validate incident type enum', async () => {
      const invalidTypeData = {
        ...validIncidentData,
        type: 'INVALID_TYPE'
      };

      const response = await request(app)
        .post('/api/incidents')
        .send(invalidTypeData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.message).toContain('Invalid incident type');
    });

    test('P0: should validate incident priority enum', async () => {
      const invalidPriorityData = {
        ...validIncidentData,
        priority: 'INVALID_PRIORITY'
      };

      const response = await request(app)
        .post('/api/incidents')
        .send(invalidPriorityData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.message).toContain('Invalid incident priority');
    });

    test('P0: should detect duplicate incidents within time window', async () => {
      // Create first incident
      await request(app)
        .post('/api/incidents')
        .send(validIncidentData)
        .expect(201);

      // Try to create similar incident within 5 minutes
      const duplicateData = {
        ...validIncidentData,
        title: 'Similar Security Breach in Building A' // Slightly different title
      };

      const response = await request(app)
        .post('/api/incidents')
        .send(duplicateData)
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'DUPLICATE_INCIDENT');
      expect(response.body.message).toContain('Similar incident already exists');
    });

    test('P1: should handle oversized description', async () => {
      const oversizedData = {
        ...validIncidentData,
        description: 'A'.repeat(1001) // Over 1000 character limit
      };

      const response = await request(app)
        .post('/api/incidents')
        .send(oversizedData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.message).toContain('Description too long');
    });

    test('P1: should validate GPS coordinates format', async () => {
      const invalidCoordinatesData = {
        ...validIncidentData,
        coordinates: {
          latitude: 'invalid',
          longitude: 'invalid'
        }
      };

      const response = await request(app)
        .post('/api/incidents')
        .send(invalidCoordinatesData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body.message).toContain('Invalid coordinates');
    });
  });

  describe('Activity Logging Integration', () => {
    beforeEach(async () => {
      // Create a test incident first
      const response = await request(app)
        .post('/api/incidents')
        .send({
          title: 'Test Incident for Activity Logging',
          description: 'Test incident for activity logging tests',
          type: 'SECURITY',
          priority: 'MEDIUM',
          location: 'Test Location',
          reportedBy: 'Test Officer',
          coordinates: {
            latitude: -6.2088,
            longitude: 106.8456
          }
        });
      
      testIncidentId = response.body.data.incidentId;
    });

    test('P0: should automatically create activity on incident creation', async () => {
      const response = await request(app)
        .get(`/api/incidents/${testIncidentId}/activities`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.activities).toHaveLength(1);
      
      const activity = response.body.data.activities[0];
      expect(activity).toHaveProperty('type', 'INCIDENT_CREATED');
      expect(activity).toHaveProperty('description', 'Incident created');
      expect(activity).toHaveProperty('performedBy', 'Test Officer');
      expect(activity).toHaveProperty('timestamp');
    });

    test('P0: should add activity when incident status changes', async () => {
      // Update incident status
      await request(app)
        .patch(`/api/incidents/${testIncidentId}`)
        .send({
          status: 'IN_PROGRESS',
          updatedBy: 'Security Manager'
        })
        .expect(200);

      // Check activities
      const response = await request(app)
        .get(`/api/incidents/${testIncidentId}/activities`)
        .expect(200);

      expect(response.body.data.activities).toHaveLength(2);
      
      const statusActivity = response.body.data.activities.find(
        activity => activity.type === 'STATUS_CHANGED'
      );
      expect(statusActivity).toBeDefined();
      expect(statusActivity.description).toContain('Status changed to IN_PROGRESS');
      expect(statusActivity.performedBy).toBe('Security Manager');
    });

    test('P0: should add activity when adding comments', async () => {
      // Add activity/comment
      const activityData = {
        type: 'COMMENT_ADDED',
        description: 'Investigation started, checking CCTV footage',
        performedBy: 'Detective Smith'
      };

      await request(app)
        .post(`/api/incidents/${testIncidentId}/activities`)
        .send(activityData)
        .expect(201);

      // Check activities
      const response = await request(app)
        .get(`/api/incidents/${testIncidentId}/activities`)
        .expect(200);

      expect(response.body.data.activities).toHaveLength(2);
      
      const commentActivity = response.body.data.activities.find(
        activity => activity.type === 'COMMENT_ADDED'
      );
      expect(commentActivity).toBeDefined();
      expect(commentActivity.description).toBe('Investigation started, checking CCTV footage');
      expect(commentActivity.performedBy).toBe('Detective Smith');
    });

    test('P1: should validate activity data', async () => {
      const invalidActivityData = {
        description: 'Missing required fields'
      };

      const response = await request(app)
        .post(`/api/incidents/${testIncidentId}/activities`)
        .send(invalidActivityData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    test('P1: should return activities in chronological order', async () => {
      // Add multiple activities
      const activities = [
        {
          type: 'COMMENT_ADDED',
          description: 'First comment',
          performedBy: 'Officer A'
        },
        {
          type: 'COMMENT_ADDED', 
          description: 'Second comment',
          performedBy: 'Officer B'
        },
        {
          type: 'COMMENT_ADDED',
          description: 'Third comment', 
          performedBy: 'Officer C'
        }
      ];

      for (const activity of activities) {
        await request(app)
          .post(`/api/incidents/${testIncidentId}/activities`)
          .send(activity);
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const response = await request(app)
        .get(`/api/incidents/${testIncidentId}/activities`)
        .expect(200);

      const activityList = response.body.data.activities;
      expect(activityList.length).toBeGreaterThanOrEqual(4); // 1 creation + 3 added
      
      // Check chronological order (newest first)
      for (let i = 0; i < activityList.length - 1; i++) {
        const current = new Date(activityList[i].timestamp);
        const next = new Date(activityList[i + 1].timestamp);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });
  });

  describe('GET /api/incidents - Incident Retrieval', () => {
    beforeEach(async () => {
      // Create test incidents
      const incidents = [
        {
          title: 'Security Incident 1',
          description: 'First security incident',
          type: 'SECURITY',
          priority: 'HIGH',
          location: 'Building A',
          reportedBy: 'Officer 1',
          coordinates: {
            latitude: -6.2088,
            longitude: 106.8456
          }
        },
        {
          title: 'Maintenance Issue',
          description: 'HVAC system failure',
          type: 'MAINTENANCE',
          priority: 'MEDIUM',
          location: 'Building B',
          reportedBy: 'Technician 1',
          coordinates: {
            latitude: -6.2089,
            longitude: 106.8457
          }
        }
      ];

      for (const incident of incidents) {
        await request(app)
          .post('/api/incidents')
          .send(incident);
      }
    });

    test('P0: should retrieve all incidents', async () => {
      const response = await request(app)
        .get('/api/incidents')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('incidents');
      expect(response.body.data.incidents.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page', 1);
      expect(response.body.data).toHaveProperty('limit', 10);
    });

    test('P1: should filter incidents by status', async () => {
      const response = await request(app)
        .get('/api/incidents?status=OPEN')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      response.body.data.incidents.forEach(incident => {
        expect(incident.status).toBe('OPEN');
      });
    });

    test('P1: should filter incidents by type', async () => {
      const response = await request(app)
        .get('/api/incidents?type=SECURITY')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      response.body.data.incidents.forEach(incident => {
        expect(incident.type).toBe('SECURITY');
      });
    });

    test('P1: should support pagination', async () => {
      const response = await request(app)
        .get('/api/incidents?page=1&limit=1')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.incidents).toHaveLength(1);
      expect(response.body.data).toHaveProperty('page', 1);
      expect(response.body.data).toHaveProperty('limit', 1);
    });
  });

  describe('GET /api/incidents/:id - Single Incident Retrieval', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/incidents')
        .send({
          title: 'Test Incident for Retrieval',
          description: 'Test incident for single retrieval',
          type: 'SECURITY',
          priority: 'HIGH',
          location: 'Test Location',
          reportedBy: 'Test Officer'
        });
      
      testIncidentId = response.body.data.incidentId;
    });

    test('P0: should retrieve incident by ID', async () => {
      const response = await request(app)
        .get(`/api/incidents/${testIncidentId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('incident');
      expect(response.body.data.incident).toHaveProperty('id', testIncidentId);
      expect(response.body.data.incident).toHaveProperty('title', 'Test Incident for Retrieval');
    });

    test('P1: should return 404 for non-existent incident', async () => {
      const response = await request(app)
        .get('/api/incidents/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'INCIDENT_NOT_FOUND');
    });
  });

  describe('Error Handling', () => {
    test('P0: should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/incidents')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('P1: should handle server errors gracefully', async () => {
      // This test would require mocking internal errors
      // For now, we'll test that the error handling middleware exists
      const response = await request(app)
        .get('/api/incidents/trigger-error')
        .expect(404); // Should hit 404 handler instead of crashing

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance Tests', () => {
    test('P1: should handle multiple concurrent incident creations', async () => {
      const concurrentRequests = 10;
      const promises = [];
      const baseTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/incidents')
          .send({
            title: `Concurrent Incident ${i}-${baseTime}`,
            description: `Unique test incident ${i} for concurrency testing at ${baseTime + i}. This is a completely different description for incident ${i}.`,
            type: i % 2 === 0 ? 'SECURITY' : 'MAINTENANCE', // Alternate types
            priority: i % 3 === 0 ? 'HIGH' : (i % 3 === 1 ? 'MEDIUM' : 'LOW'), // Rotate priorities
            location: `Unique Location ${i} - Building ${Math.floor(i/2)} Floor ${i % 5}`,
            reportedBy: `Officer ${i}`,
            coordinates: {
              latitude: -6.2088 + (i * 0.01), // More significant coordinate differences
              longitude: 106.8456 + (i * 0.01)
            }
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach((response, index) => {
        if (response.status !== 201) {
          console.error(`Request ${index} failed:`, response.status, response.body);
        }
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
      });

      // All incidents should have unique IDs
      const incidentIds = responses.map(r => r.body.data.incidentId);
      const uniqueIds = new Set(incidentIds);
      expect(uniqueIds.size).toBe(concurrentRequests);
    });

    test('P1: should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post('/api/incidents')
        .send({
          title: `Performance Test Incident ${Date.now()}`,
          description: `Testing response time at ${new Date().toISOString()}`,
          type: 'SECURITY',
          priority: 'HIGH',
          location: 'Performance Test Location',
          reportedBy: 'Performance Tester',
          coordinates: {
            latitude: -6.2088,
            longitude: 106.8456
          }
        })
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
});

// Additional helper functions for testing
const testHelpers = {
  createTestIncident: async (app, overrides = {}) => {
    const defaultData = {
      title: 'Test Incident',
      description: 'Test incident description',
      type: 'SECURITY',
      priority: 'MEDIUM',
      location: 'Test Location',
      reportedBy: 'Test Officer'
    };

    const response = await request(app)
      .post('/api/incidents')
      .send({ ...defaultData, ...overrides });

    return response.body.data;
  },

  waitForProcessing: (ms = 100) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  generateUniqueTitle: () => {
    return `Test Incident ${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

module.exports = { testHelpers };