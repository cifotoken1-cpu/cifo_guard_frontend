const { Alert } = require('./models');
const sequelize = require('./config/database');

async function checkAlertStatus() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Get all alerts with their status
    const alerts = await Alert.findAll({
      attributes: ['id', 'alertId', 'title', 'status', 'type', 'severity', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    console.log(`\nFound ${alerts.length} alerts:`);
    alerts.forEach(alert => {
      console.log(`- ${alert.alertId}: status=${alert.status}, type=${alert.type}, severity=${alert.severity}`);
    });

    // Check specifically for ACTIVE status
    const activeAlerts = await Alert.findAll({
      where: { status: 'ACTIVE' },
      attributes: ['id', 'alertId', 'title', 'status']
    });

    console.log(`\nActive alerts: ${activeAlerts.length}`);
    activeAlerts.forEach(alert => {
      console.log(`- ${alert.alertId}: ${alert.title}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkAlertStatus();