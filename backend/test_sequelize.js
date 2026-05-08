const Alert = require('./models/Alert');
const sequelize = require('./config/database');

const testSequelize = async () => {
  try {
    console.log('Testing Sequelize connection and Alert model...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Test Alert model - get all alerts
    const allAlerts = await Alert.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`📊 Total alerts found: ${allAlerts.length}`);
    
    if (allAlerts.length > 0) {
      console.log('\n📋 Sample alerts:');
      allAlerts.forEach((alert, index) => {
        console.log(`${index + 1}. ${alert.alertId} - ${alert.title} (${alert.status})`);
      });
    } else {
      console.log('❌ No alerts found in database');
      
      // Check if table exists
      const tableExists = await sequelize.getQueryInterface().showAllTables();
      console.log('\n📋 Available tables:', tableExists);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testSequelize();