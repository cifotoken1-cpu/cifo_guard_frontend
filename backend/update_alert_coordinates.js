const Alert = require('./models/Alert');
const sequelize = require('./config/database');

const updateAlertCoordinates = async () => {
  try {
    console.log('Updating alert coordinates for better map distribution...');
    
    // More varied coordinates across Jakarta area
    const coordinateUpdates = [
      { alertId: 'PANIC-001', lat: -6.1950, lng: 106.8200 },
      { alertId: 'PANIC-002', lat: -6.2150, lng: 106.8650 },
      { alertId: 'PANIC-003', lat: -6.1800, lng: 106.8500 },
      { alertId: 'PANIC-004', lat: -6.2300, lng: 106.8100 },
      { alertId: 'PANIC-005', lat: -6.2050, lng: 106.8750 }
    ];

    let updatedCount = 0;
    
    for (const update of coordinateUpdates) {
      const alert = await Alert.findOne({
        where: { alertId: update.alertId }
      });
      
      if (alert) {
        await alert.update({
          coordinatesLat: update.lat,
          coordinatesLng: update.lng,
          location: {
            ...alert.location,
            lat: update.lat,
            lng: update.lng
          }
        });
        
        console.log(`✅ Updated ${update.alertId}: ${update.lat}, ${update.lng}`);
        updatedCount++;
      } else {
        console.log(`⚠️  Alert ${update.alertId} not found`);
      }
    }
    
    // Create additional alerts with varied coordinates if needed
    const additionalAlerts = [
      {
        alertId: 'PANIC-006',
        title: 'Panic Alert - Shopping Mall',
        message: 'Emergency panic button activated at Shopping Mall',
        type: 'EMERGENCY',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'ACTIVE',
        isEmergency: true,
        location: {
          lat: -6.1700,
          lng: 106.8300,
          address: 'Shopping Mall, Jalan Raya Cifo',
          zone: 'Commercial Area',
          building: 'Shopping Mall'
        },
        coordinatesLat: -6.1700,
        coordinatesLng: 106.8300
      },
      {
        alertId: 'PANIC-007',
        title: 'Panic Alert - Office Complex',
        message: 'Emergency panic button activated at Office Complex',
        type: 'EMERGENCY',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'ACTIVE',
        isEmergency: true,
        location: {
          lat: -6.2400,
          lng: 106.8800,
          address: 'Office Complex, Jalan Raya Cifo',
          zone: 'Business District',
          building: 'Office Complex'
        },
        coordinatesLat: -6.2400,
        coordinatesLng: 106.8800
      },
      {
        alertId: 'PANIC-008',
        title: 'Panic Alert - Hospital',
        message: 'Emergency panic button activated at Hospital',
        type: 'EMERGENCY',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'ACTIVE',
        isEmergency: true,
        location: {
          lat: -6.1600,
          lng: 106.8600,
          address: 'Hospital, Jalan Raya Cifo',
          zone: 'Medical District',
          building: 'Hospital'
        },
        coordinatesLat: -6.1600,
        coordinatesLng: 106.8600
      }
    ];
    
    // Create new alerts if they don't exist
    for (const alertData of additionalAlerts) {
      const existingAlert = await Alert.findOne({
        where: { alertId: alertData.alertId }
      });
      
      if (!existingAlert) {
        const newAlert = await Alert.create(alertData);
        console.log(`✅ Created new alert: ${newAlert.title} at ${alertData.coordinatesLat}, ${alertData.coordinatesLng}`);
        updatedCount++;
      } else {
        console.log(`ℹ️  Alert ${alertData.alertId} already exists`);
      }
    }
    
    console.log(`\n🎉 Successfully updated/created ${updatedCount} alerts with varied coordinates!`);
    
    // Show final coordinates
    const allAlerts = await Alert.findAll({
      where: {
        type: 'EMERGENCY',
        isEmergency: true
      },
      attributes: ['alertId', 'title', 'coordinatesLat', 'coordinatesLng'],
      order: [['alertId', 'ASC']]
    });
    
    console.log('\n📍 Current alert coordinates:');
    allAlerts.forEach(alert => {
      console.log(`${alert.alertId}: ${alert.coordinatesLat}, ${alert.coordinatesLng} - ${alert.title}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error updating alert coordinates:', error);
    process.exit(1);
  }
};

updateAlertCoordinates();