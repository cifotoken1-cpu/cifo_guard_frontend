const { Alert } = require('./models');
const sequelize = require('./config/database');
const { Op } = require('sequelize');

async function testStatusFilter() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Test direct query with status filter
    console.log('\n=== Testing direct Sequelize query ===');
    const directQuery = await Alert.findAll({
      where: { 
        deletedAt: null,
        status: 'ACTIVE'
      },
      attributes: ['id', 'alertId', 'title', 'status'],
      limit: 5
    });
    
    console.log(`Direct query found: ${directQuery.length} alerts`);
    directQuery.forEach(alert => {
      console.log(`- ${alert.alertId}: ${alert.status}`);
    });

    // Test with different status values
    console.log('\n=== Testing different status values ===');
    const statusValues = ['ACTIVE', 'active', 'Active'];
    
    for (const statusValue of statusValues) {
      const results = await Alert.findAll({
        where: { 
          deletedAt: null,
          status: statusValue
        },
        attributes: ['id', 'alertId', 'status'],
        limit: 2
      });
      console.log(`Status '${statusValue}': ${results.length} alerts`);
    }

    // Test findAndCountAll like in controller
    console.log('\n=== Testing findAndCountAll ===');
    const where = { deletedAt: null, status: 'ACTIVE' };
    const { count, rows } = await Alert.findAndCountAll({
      where,
      limit: 10,
      offset: 0,
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`findAndCountAll: count=${count}, rows=${rows.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

testStatusFilter();