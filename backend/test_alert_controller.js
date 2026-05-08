const AlertController = require('./controllers/AlertController');

const testAlertController = async () => {
  try {
    console.log('Testing AlertController.getAlerts...');
    
    // Mock request and response objects
    const mockReq = {
      query: {
        status: 'ACTIVE',
        page: 1,
        limit: 10
      }
    };
    
    const mockRes = {
      json: (data) => {
        console.log('✅ Response received:');
        console.log(JSON.stringify(data, null, 2));
      },
      status: (code) => {
        console.log(`❌ Error status: ${code}`);
        return {
          json: (data) => {
            console.log('Error response:');
            console.log(JSON.stringify(data, null, 2));
          }
        };
      }
    };
    
    // Test the controller method
    await AlertController.getAlerts(mockReq, mockRes);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error testing AlertController:', error);
    process.exit(1);
  }
};

testAlertController();