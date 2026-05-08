const db = require('./config/database');

const checkAlerts = async () => {
  try {
    console.log('Checking panic alerts in database...');
    
    // First, let's check the table structure
    const describeQuery = 'DESCRIBE alerts';
    
    db.query(describeQuery, (err, columns) => {
      if (err) {
        console.error('❌ Error describing table:', err);
        process.exit(1);
      }
      
      console.log('📋 Table structure:');
      columns.forEach(col => {
        console.log(`  ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      
      // Now query the data - using correct column names from Alert model
      const query = `
        SELECT id, alert_id, title, message, type, severity, status, 
               coordinates_lat, coordinates_lng, location, created_at, updated_at
        FROM alerts 
        WHERE type = 'EMERGENCY' OR is_emergency = 1
        ORDER BY created_at DESC 
        LIMIT 10
      `;
      
      db.query(query, (err, results) => {
        if (err) {
          console.error('❌ Database query error:', err);
          process.exit(1);
        }
        
        console.log(`\n✅ Found ${results.length} panic alerts:`);
        
        if (results.length === 0) {
          console.log('No panic alerts found in database.');
        } else {
          results.forEach((alert, index) => {
            console.log(`\n--- Alert ${index + 1} ---`);
            console.log(JSON.stringify(alert, null, 2));
          });
        }
        
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkAlerts();