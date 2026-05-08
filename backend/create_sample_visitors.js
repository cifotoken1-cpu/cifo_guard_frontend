const { VisitorRegistration, QRCode, sequelize } = require('./models');

async function createSampleVisitors() {
  try {
    console.log('🎯 Creating sample visitors with check-in data...');
    
    // First, let's check if we have any QR codes
    const qrCodes = await QRCode.findAll({ limit: 5 });
    console.log('📱 Found QR codes:', qrCodes.length);
    
    if (qrCodes.length === 0) {
      console.log('⚠️ No QR codes found. Creating sample QR code first...');
      
      const sampleQR = await QRCode.create({
        qr_data: 'GATE_MAIN_001',
        entry_point: 'gate-main',
        description: 'Main Gate Entry',
        location_lat: -6.2088,
        location_lng: 106.8456,
        geofence_radius: 50,
        security_level: 'medium',
        requires_approval: true,
        is_active: true,
        operating_hours: JSON.stringify({
          monday: { start: '06:00', end: '22:00' },
          tuesday: { start: '06:00', end: '22:00' },
          wednesday: { start: '06:00', end: '22:00' },
          thursday: { start: '06:00', end: '22:00' },
          friday: { start: '06:00', end: '22:00' },
          saturday: { start: '06:00', end: '22:00' },
          sunday: { start: '06:00', end: '22:00' }
        }),
        created_by: 'system',
        updated_by: 'system'
      });
      
      qrCodes.push(sampleQR);
      console.log('✅ Sample QR code created');
    }
    
    const sampleVisitors = [
      {
        name: 'John Doe',
        phone: '+6281234567890',
        purpose: 'Keluarga',
        entry_point: 'gate-main',
        status: 'approved',
        qr_code_id: qrCodes[0].id,
        approved_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        checked_in_at: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        location_lat: -6.2088,
        location_lng: 106.8456,
        created_by: 'system',
        updated_by: 'system'
      },
      {
        name: 'Jane Smith',
        phone: '+6281234567891',
        purpose: 'Teman',
        entry_point: 'gate-main',
        status: 'approved',
        qr_code_id: qrCodes[0].id,
        approved_at: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        checked_in_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        checked_out_at: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location_lat: -6.2088,
        location_lng: 106.8456,
        created_by: 'system',
        updated_by: 'system'
      },
      {
        name: 'Bob Wilson',
        phone: '+6281234567892',
        purpose: 'Delivery',
        entry_point: 'gate-main',
        status: 'approved',
        qr_code_id: qrCodes[0].id,
        approved_at: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        checked_in_at: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location_lat: -6.2088,
        location_lng: 106.8456,
        created_by: 'system',
        updated_by: 'system'
      },
      {
        name: 'Alice Brown',
        phone: '+6281234567893',
        purpose: 'Keluarga',
        entry_point: 'gate-main',
        status: 'pending',
        qr_code_id: qrCodes[0].id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location_lat: -6.2088,
        location_lng: 106.8456,
        created_by: 'system',
        updated_by: 'system'
      },
      {
        name: 'Charlie Davis',
        phone: '+6281234567894',
        purpose: 'Maintenance',
        entry_point: 'gate-main',
        status: 'approved',
        qr_code_id: qrCodes[0].id,
        approved_at: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        location_lat: -6.2088,
        location_lng: 106.8456,
        created_by: 'system',
        updated_by: 'system'
      }
    ];
    
    // Clear existing sample data first
    await VisitorRegistration.destroy({
      where: {
        created_by: 'system'
      }
    });
    console.log('🗑️ Cleared existing sample visitors');
    
    // Create new sample visitors
    const createdVisitors = await VisitorRegistration.bulkCreate(sampleVisitors);
    
    console.log('✅ Sample visitors created successfully:');
    createdVisitors.forEach((visitor, index) => {
      console.log(`   ${index + 1}. ${visitor.name} - Status: ${visitor.status} - Check-in: ${visitor.checked_in_at ? 'Yes' : 'No'} - Check-out: ${visitor.checked_out_at ? 'Yes' : 'No'}`);
    });
    
    console.log('\n📊 Summary:');
    console.log(`   Total visitors: ${createdVisitors.length}`);
    console.log(`   With check-in: ${createdVisitors.filter(v => v.checked_in_at).length}`);
    console.log(`   With check-out: ${createdVisitors.filter(v => v.checked_out_at).length}`);
    console.log(`   Pending approval: ${createdVisitors.filter(v => v.status === 'pending').length}`);
    console.log(`   Approved: ${createdVisitors.filter(v => v.status === 'approved').length}`);
    
  } catch (error) {
    console.error('❌ Error creating sample visitors:', error);
  } finally {
    if (sequelize && sequelize.close) {
      await sequelize.close();
    }
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  createSampleVisitors();
}

module.exports = createSampleVisitors;