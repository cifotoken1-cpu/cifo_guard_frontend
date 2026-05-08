const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cifo_security',
  multipleStatements: true
};

async function runVisitorMigration() {
  let connection;
  
  try {
    console.log('🚀 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📋 Creating visitor system tables...');
    
    // Create qr_codes table first (referenced by visitor_registrations)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entry_point VARCHAR(100) NOT NULL,
        qr_data VARCHAR(500) NOT NULL UNIQUE,
        location_lat DECIMAL(10, 8) NOT NULL,
        location_lng DECIMAL(11, 8) NOT NULL,
        geofence_radius INT NOT NULL DEFAULT 50,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        description TEXT,
        max_daily_registrations INT,
        operating_hours JSON,
        security_level ENUM('low', 'medium', 'high', 'restricted') NOT NULL DEFAULT 'medium',
        requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
        auto_approve_roles JSON DEFAULT ('[]'),
        metadata JSON DEFAULT ('{}'),
        last_used_at DATETIME,
        usage_count INT NOT NULL DEFAULT 0,
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ QR codes table created');

    // Create visitor_registrations table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS visitor_registrations (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        photo_url VARCHAR(500),
        purpose VARCHAR(100) DEFAULT 'Visit',
        entry_point VARCHAR(100) NOT NULL,
        location_lat DECIMAL(10, 8),
        location_lng DECIMAL(11, 8),
        qr_code_id VARCHAR(36),
        status ENUM('pending', 'approved', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
        approved_by VARCHAR(255),
        approved_at DATETIME,
        rejected_by VARCHAR(255),
        rejected_at DATETIME,
        rejection_reason TEXT,
        expires_at DATETIME,
        checked_in_at DATETIME,
        checked_out_at DATETIME,
        metadata JSON DEFAULT ('{}'),
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    console.log('✅ Visitor registrations table created');

    // Add indexes for qr_codes table
    const qrIndexes = [
      'CREATE INDEX idx_qr_codes_entry_point ON qr_codes(entry_point)',
      'CREATE INDEX idx_qr_codes_is_active ON qr_codes(is_active)',
      'CREATE INDEX idx_qr_codes_security_level ON qr_codes(security_level)',
      'CREATE INDEX idx_qr_codes_created_at ON qr_codes(created_at)',
      'CREATE INDEX idx_qr_codes_last_used_at ON qr_codes(last_used_at)'
    ];

    for (const indexSql of qrIndexes) {
      try {
        await connection.execute(indexSql);
      } catch (error) {
        if (!error.message.includes('Duplicate key name')) {
          throw error;
        }
      }
    }
    console.log('✅ QR codes indexes created');

    // Add indexes for visitor_registrations table
    const visitorIndexes = [
      'CREATE INDEX idx_visitor_registrations_status ON visitor_registrations(status)',
      'CREATE INDEX idx_visitor_registrations_entry_point ON visitor_registrations(entry_point)',
      'CREATE INDEX idx_visitor_registrations_qr_code_id ON visitor_registrations(qr_code_id)',
      'CREATE INDEX idx_visitor_registrations_created_at ON visitor_registrations(created_at)',
      'CREATE INDEX idx_visitor_registrations_status_created_at ON visitor_registrations(status, created_at)',
      'CREATE INDEX idx_visitor_registrations_phone ON visitor_registrations(phone)',
      'CREATE INDEX idx_visitor_registrations_expires_at ON visitor_registrations(expires_at)'
    ];

    for (const indexSql of visitorIndexes) {
      try {
        await connection.execute(indexSql);
      } catch (error) {
        if (!error.message.includes('Duplicate key name')) {
          throw error;
        }
      }
    }
    console.log('✅ Visitor registrations indexes created');

    // Insert sample QR codes for testing
    const sampleQRCodes = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        entry_point: 'Main Gate',
        qr_data: 'main-gate-' + Date.now() + '-sample1',
        location_lat: -6.2088,
        location_lng: 106.8456,
        geofence_radius: 50,
        is_active: true,
        description: 'Main entrance gate for visitors',
        security_level: 'medium',
        requires_approval: true,
        metadata: JSON.stringify({ zone: 'entrance', building: 'main' })
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        entry_point: 'Security Office',
        qr_data: 'security-office-' + Date.now() + '-sample2',
        location_lat: -6.2090,
        location_lng: 106.8458,
        geofence_radius: 30,
        is_active: true,
        description: 'Security office entrance',
        security_level: 'high',
        requires_approval: true,
        metadata: JSON.stringify({ zone: 'security', building: 'admin' })
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        entry_point: 'Parking Area',
        qr_data: 'parking-area-' + Date.now() + '-sample3',
        location_lat: -6.2085,
        location_lng: 106.8460,
        geofence_radius: 100,
        is_active: true,
        description: 'Visitor parking area',
        security_level: 'low',
        requires_approval: false,
        auto_approve_roles: JSON.stringify(['visitor', 'guest']),
        metadata: JSON.stringify({ zone: 'parking', capacity: 50 })
      }
    ];

    // Check if sample data already exists
    const [existingQRCodes] = await connection.execute('SELECT COUNT(*) as count FROM qr_codes');
    
    if (existingQRCodes[0].count === 0) {
      for (const qrCode of sampleQRCodes) {
        await connection.execute(`
          INSERT INTO qr_codes (
            id, entry_point, qr_data, location_lat, location_lng, geofence_radius,
            is_active, description, security_level, requires_approval, auto_approve_roles, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          qrCode.id, qrCode.entry_point, qrCode.qr_data, qrCode.location_lat, qrCode.location_lng,
          qrCode.geofence_radius, qrCode.is_active, qrCode.description, qrCode.security_level,
          qrCode.requires_approval, qrCode.auto_approve_roles || null, qrCode.metadata
        ]);
      }
      console.log('✅ Sample QR codes inserted');
    } else {
      console.log('⚠️  Sample QR codes already exist, skipping insertion');
    }

    console.log('\n✨ Visitor system migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - qr_codes table: ✅ Created');
    console.log('   - visitor_registrations table: ✅ Created');
    console.log('   - Indexes: ✅ Created');
    console.log('   - Sample data: ✅ Inserted');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runVisitorMigration()
    .then(() => {
      console.log('\n🎉 Migration process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration process failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runVisitorMigration };