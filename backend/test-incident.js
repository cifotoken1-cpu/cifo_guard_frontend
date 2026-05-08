const request = require('supertest');
const { app } = require('./api/server.js');

process.env.NODE_ENV = 'test';

const testData = {
  title: 'Security Breach in Building A',
  description: 'Unauthorized access detected in server room',
  type: 'SECURITY',
  priority: 'HIGH',
  location: 'Building A, Floor 3, Server Room',
  reportedBy: 'guard_001', // Use existing team member ID
  coordinates: {
    latitude: -6.2088,
    longitude: 106.8456
  }
};

async function testIncident() {
  try {
    console.log('Testing incident creation...');
    console.log('Test data:', JSON.stringify(testData, null, 2));
    
    const response = await request(app)
      .post('/api/incidents')
      .send(testData);
    
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(response.body, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

testIncident();