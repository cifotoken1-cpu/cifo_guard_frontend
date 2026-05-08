const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// Simple database connection
const sequelize = new Sequelize(
  process.env.DB_NAME || 'cifo_security',
  process.env.DB_USER || 'root', 
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

async function checkQRData() {
  try {
    console.log('🔍 Connecting to database...');
    await sequelize.authenticate();
    
    console.log('📋 Fetching available QR codes...');
    const [rows] = await sequelize.query(`
      SELECT id, qr_data, entry_point, location_lat, location_lng, requires_approval 
      FROM qr_codes 
      WHERE is_active = 1 
      LIMIT 3
    `);
    
    console.log('\n✅ Available QR Codes for Testing:');
    console.log('=' .repeat(50));
    
    rows.forEach((row, index) => {
      console.log(`\n${index + 1}. Entry Point: ${row.entry_point}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   QR Data: ${row.qr_data}`);
      console.log(`   Location: ${row.location_lat}, ${row.location_lng}`);
      console.log(`   Requires Approval: ${row.requires_approval}`);
      console.log(`   Test URL: http://localhost:5173/visitor/register?qr=${encodeURIComponent(row.qr_data)}`);
    });
    
    console.log('\n🎯 Use any of the QR Data values above for testing!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkQRData();