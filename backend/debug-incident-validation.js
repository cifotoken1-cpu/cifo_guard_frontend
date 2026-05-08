const request = require('supertest');
const { app } = require('./api/server.js');

async function debugIncidentValidation() {
  console.log('🔍 Debugging incident validation...');
  
  const testData = {
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
  
  console.log('📤 Sending test data:', JSON.stringify(testData, null, 2));
  
  try {
    const response = await request(app)
      .post('/api/incidents')
      .send(testData);
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response body:', JSON.stringify(response.body, null, 2));
    
    if (response.status === 400) {
      console.log('❌ Validation failed!');
    } else if (response.status === 201) {
      console.log('✅ Incident created successfully!');
    } else {
      console.log('⚠️ Unexpected status:', response.status);
    }
    
  } catch (error) {
    console.error('💥 Error during request:', error.message);
  }
}

debugIncidentValidation().then(() => {
  console.log('🏁 Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});