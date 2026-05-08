const { Alert, sequelize } = require('./models');

async function createSamplePanicAlerts() {
  try {
    console.log('🚨 Creating sample panic alerts...');
    
    const sampleAlerts = [
      {
        alertId: 'PANIC_001_' + Date.now(),
        title: 'Emergency Alert - Cluster A',
        type: 'EMERGENCY',
        severity: 'HIGH',
        status: 'ACTIVE',
        message: 'Emergency situation at Cluster A',
        location: {
          lat: -6.2088,
          lng: 106.8456,
          address: 'Cluster A, Blok A1 No. 15'
        },
        coordinatesLat: -6.2088,
        coordinatesLng: 106.8456,
        metadata: {
          device_id: 'panic_button_001',
          battery_level: 85,
          signal_strength: 'strong',
          user_info: {
            name: 'John Doe',
            phone: '+6281234567890',
            unit: 'A1-15'
          }
        },
        createdBy: 'system',
        updatedBy: 'system'
      },
      {
        alertId: 'PANIC_002_' + (Date.now() + 1),
        title: 'Medical Emergency - Cluster B',
        type: 'EMERGENCY',
        category: 'MEDICAL',
        severity: 'HIGH',
        status: 'ACTIVE',
        message: 'Medical emergency at Cluster B',
        location: {
          lat: -6.2092,
          lng: 106.8470,
          address: 'Cluster B, Blok B2 No. 08'
        },
        coordinatesLat: -6.2092,
        coordinatesLng: 106.8470,
        metadata: {
          device_id: 'panic_button_002',
          battery_level: 92,
          signal_strength: 'strong',
          user_info: {
            name: 'Jane Smith',
            phone: '+6281234567891',
            unit: 'B2-08'
          }
        },
        createdBy: 'system',
        updatedBy: 'system'
      },
      {
        alertId: 'PANIC_003_' + (Date.now() + 2),
        title: 'Security Alert - Main Gate',
        type: 'SECURITY',
        severity: 'MEDIUM',
        status: 'RESOLVED',
        message: 'Security concern at Main Gate',
        location: {
          lat: -6.2085,
          lng: 106.8465,
          address: 'Main Gate Security Post'
        },
        coordinatesLat: -6.2085,
        coordinatesLng: 106.8465,
        resolvedAt: new Date(Date.now() - 30 * 60 * 1000),
        metadata: {
          device_id: 'panic_button_003',
          battery_level: 78,
          signal_strength: 'medium',
          resolved_by: 'admin',
          user_info: {
            name: 'Security Guard',
            phone: '+6281234567892',
            unit: 'Security Post'
          }
        },
        createdBy: 'system',
        updatedBy: 'system',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        updatedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      },
      {
        alertId: 'PANIC_004_' + (Date.now() + 3),
        title: 'Fire Emergency - Clubhouse',
        type: 'EMERGENCY',
        category: 'FIRE',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        isEmergency: true,
        message: 'Fire alarm triggered at Clubhouse',
        location: {
          lat: -6.2087,
          lng: 106.8462,
          address: 'Clubhouse Building'
        },
        coordinatesLat: -6.2087,
        coordinatesLng: 106.8462,
        metadata: {
          device_id: 'fire_alarm_001',
          battery_level: 95,
          signal_strength: 'strong',
          sensor_type: 'smoke_detector',
          user_info: {
            name: 'Facility Manager',
            phone: '+6281234567893',
            unit: 'Clubhouse'
          }
        },
        createdBy: 'system',
        updatedBy: 'system',
        createdAt: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
      },
      {
        alertId: 'PANIC_005_' + (Date.now() + 4),
        title: 'Maintenance Request - Playground',
        type: 'MAINTENANCE',
        severity: 'LOW',
        status: 'ACTIVE',
        message: 'Maintenance request at Playground',
        location: {
          lat: -6.2090,
          lng: 106.8468,
          address: 'Children Playground Area'
        },
        coordinatesLat: -6.2090,
        coordinatesLng: 106.8468,
        metadata: {
          device_id: 'maintenance_button_001',
          battery_level: 67,
          signal_strength: 'weak',
          issue_type: 'equipment_malfunction',
          user_info: {
            name: 'Maintenance Staff',
            phone: '+6281234567894',
            unit: 'Maintenance'
          }
        },
        createdBy: 'system',
        updatedBy: 'system',
        createdAt: new Date(Date.now() - 45 * 60 * 1000) // 45 minutes ago
      }
    ];
    
    // Clear existing sample data first
    await Alert.destroy({
      where: {
        createdBy: 'system'
      }
    });
    console.log('🗑️ Cleared existing sample panic alerts');
    
    // Create new sample panic alerts
    const createdAlerts = await Alert.bulkCreate(sampleAlerts);
    
    console.log('✅ Sample panic alerts created successfully:');
    createdAlerts.forEach((alert, index) => {
      const location = alert.location;
      console.log(`   ${index + 1}. ${alert.type} - ${alert.severity} - ${alert.status} - ${location.address}`);
    });
    
    console.log('\n📊 Summary:');
    console.log(`   Total alerts: ${createdAlerts.length}`);
    console.log(`   Active alerts: ${createdAlerts.filter(a => a.status === 'ACTIVE').length}`);
    console.log(`   Resolved alerts: ${createdAlerts.filter(a => a.status === 'RESOLVED').length}`);
    console.log(`   Pending alerts: ${createdAlerts.filter(a => a.status === 'PENDING').length}`);
    console.log(`   Critical severity: ${createdAlerts.filter(a => a.severity === 'CRITICAL').length}`);
    console.log(`   High severity: ${createdAlerts.filter(a => a.severity === 'HIGH').length}`);
    console.log(`   Medium severity: ${createdAlerts.filter(a => a.severity === 'MEDIUM').length}`);
    console.log(`   Low severity: ${createdAlerts.filter(a => a.severity === 'LOW').length}`);
    
  } catch (error) {
    console.error('❌ Error creating sample panic alerts:', error);
  } finally {
    if (sequelize && sequelize.close) {
      await sequelize.close();
    }
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  createSamplePanicAlerts();
}

module.exports = createSamplePanicAlerts;