const Alert = require('./models/Alert');
const sequelize = require('./config/database');

const createPanicAlerts = async () => {
  try {
    console.log('Creating panic alerts in database...');
    
    // Sample panic alert data
    const panicAlerts = [
      {
        alertId: 'PANIC-001',
        title: 'Panic Alert - Cluster A-12',
        message: 'Emergency panic button activated at Cluster A-12',
        type: 'EMERGENCY',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'ACTIVE',
        isEmergency: true,
        location: {
          lat: -6.2088,
          lng: 106.8456,
          address: 'Cluster A-12, Jalan Raya Cifo',
          zone: 'Residential Area A',
          building: 'Cluster A-12'
        },
        coordinatesLat: -6.2088,
        coordinatesLng: 106.8456
      },
      {
        alertId: 'PANIC-002',
        title: 'Panic Alert - Cluster B-05',
        message: 'Emergency panic button activated at Cluster B-05',
        type: 'EMERGENCY',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'ACTIVE',
        isEmergency: true,
        location: {
          lat: -6.2090,
          lng: 106.8458,
          address: 'Cluster B-05, Jalan Raya Cifo',
          zone: 'Residential Area B',
          building: 'Cluster B-05'
        },
        coordinatesLat: -6.2090,
        coordinatesLng: 106.8458
      },
      {
        alertId: 'PANIC-003',
        title: 'Panic Alert - Main Gate',
        message: 'Emergency panic button activated at Main Gate',
        type: 'EMERGENCY',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'ACTIVE',
        isEmergency: true,
        location: {
          lat: -6.2085,
          lng: 106.8460,
          address: 'Main Gate, Jalan Raya Cifo',
          zone: 'Security Area',
          building: 'Main Gate'
        },
        coordinatesLat: -6.2085,
        coordinatesLng: 106.8460
      },
      {
        alertId: 'PANIC-004',
        title: 'Panic Alert - Community Center',
        message: 'Emergency panic button activated at Community Center',
        type: 'EMERGENCY',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'ACTIVE',
        isEmergency: true,
        location: {
          lat: -6.2092,
          lng: 106.8454,
          address: 'Community Center, Jalan Raya Cifo',
          zone: 'Public Area',
          building: 'Community Center'
        },
        coordinatesLat: -6.2092,
        coordinatesLng: 106.8454
      },
      {
        alertId: 'PANIC-005',
        title: 'Panic Alert - Cluster C-08',
        message: 'Emergency panic button activated at Cluster C-08',
        type: 'EMERGENCY',
        severity: 'CRITICAL',
        priority: 'URGENT',
        status: 'ACTIVE',
        isEmergency: true,
        location: {
          lat: -6.2087,
          lng: 106.8462,
          address: 'Cluster C-08, Jalan Raya Cifo',
          zone: 'Residential Area C',
          building: 'Cluster C-08'
        },
        coordinatesLat: -6.2087,
        coordinatesLng: 106.8462
      }
    ];

    // Create alerts
    const createdAlerts = [];
    for (const alertData of panicAlerts) {
      const alert = await Alert.create(alertData);
      createdAlerts.push(alert);
      console.log(`✅ Created panic alert: ${alert.title} (ID: ${alert.id})`);
    }

    console.log(`\n🎉 Successfully created ${createdAlerts.length} panic alerts!`);
    
    // Verify by querying
    const allAlerts = await Alert.findAll({
      where: {
        type: 'EMERGENCY',
        isEmergency: true
      },
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`\n📊 Total emergency alerts in database: ${allAlerts.length}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating panic alerts:', error);
    process.exit(1);
  }
};

createPanicAlerts();