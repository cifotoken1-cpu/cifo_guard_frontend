const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cifo_security',
  port:parseInt(process.env.DB_PORT) || 3306, 
  multipleStatements: true
};

// Migration files directory
const migrationsDir = path.join(__dirname, '..', 'migrations');

async function createDatabase() {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    port: dbConfig.port
  });

  try {
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    console.log(`✅ Database '${dbConfig.database}' created or already exists`);
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

async function runMigrations() {
  const connection = await mysql.createConnection(dbConfig);
  
  // Track migration statistics
  const stats = {
    totalFiles: 0,
    totalStatements: 0,
    successfulStatements: 0,
    skippedStatements: 0,
    skippedReasons: {}
  };

  try {
    // Get all migration files
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure proper order

    stats.totalFiles = migrationFiles.length;
    
    console.log(`\n📁 Found ${migrationFiles.length} migration files:`);
    migrationFiles.forEach(file => console.log(`   - ${file}`));

    // Run each migration
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');
      
      console.log(`\n🔄 Running migration: ${file}`);
      
      try {
        // Clean content first - remove comments and normalize line endings
        let cleanContent = sql
          .replace(/--.*$/gm, '') // Remove single line comments
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
          .replace(/\r\n/g, '\n') // Normalize line endings
          .replace(/\n\s*\n/g, '\n'); // Remove empty lines
        
        // Split SQL into individual statements and execute them one by one
        const statements = cleanContent
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 10); // Only keep substantial statements
        
        stats.totalStatements += statements.length;
        
        console.log(`   📋 Found ${statements.length} statements in file`);
        statements.forEach((stmt, index) => {
          console.log(`   ${index + 1}. ${stmt.substring(0, 80)}...`);
        });
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement.trim() && statement.length > 10) {
            try {
              console.log(`   ✅ Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
              await connection.execute(statement);
              stats.successfulStatements++;
              
              // Add small delay between statements to ensure proper execution order
              if (i < statements.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } catch (error) {
              // Comprehensive error handling for common MySQL errors
              const errorMessage = error.message.toLowerCase();
              const sqlState = error.sqlState;
              const errorCode = error.errno;
              
              // List of errors to skip (non-critical)
              const skipErrors = [
                // Duplicate errors
                { check: () => errorMessage.includes('duplicate key name'), msg: 'Duplicate index/key' },
                { check: () => errorMessage.includes('duplicate entry'), msg: 'Duplicate entry' },
                { check: () => errorMessage.includes('duplicate check constraint'), msg: 'Duplicate constraint' },
                { check: () => errorMessage.includes('duplicate constraint name'), msg: 'Duplicate constraint name' },
                { check: () => sqlState === '42000' && errorMessage.includes('duplicate'), msg: 'Duplicate object' },
                { check: () => errorCode === 3822, msg: 'Duplicate check constraint' }, // ER_CHECK_CONSTRAINT_DUP_NAME
                
                // Already exists errors
                { check: () => errorMessage.includes('already exists'), msg: 'Object already exists' },
                { check: () => errorMessage.includes('table') && errorMessage.includes('already exists'), msg: 'Table already exists' },
                { check: () => errorMessage.includes('column') && errorMessage.includes('already exists'), msg: 'Column already exists' },
                { check: () => errorCode === 1050, msg: 'Table already exists' }, // ER_TABLE_EXISTS_ERROR
                { check: () => errorCode === 1061, msg: 'Duplicate key name' }, // ER_DUP_KEYNAME
                
                // Drop non-existent errors (safe to ignore)
                { check: () => errorMessage.includes("can't drop") && errorMessage.includes('check if column/key exists'), msg: 'Column/key does not exist' },
                { check: () => errorMessage.includes("unknown column"), msg: 'Column does not exist' },
                { check: () => errorMessage.includes("unknown table"), msg: 'Table does not exist' },
                { check: () => errorMessage.includes("can't drop field or key"), msg: 'Field/key does not exist' },
                { check: () => errorCode === 1091, msg: 'Cannot drop - does not exist' }, // ER_CANT_DROP_FIELD_OR_KEY
                { check: () => errorCode === 1051, msg: 'Unknown table' }, // ER_BAD_TABLE_ERROR
                
                // Check constraint errors (MySQL 8.0.16+)
                { check: () => sqlState === 'HY000' && errorMessage.includes('check constraint'), msg: 'Check constraint issue' },
                { check: () => errorCode === 3820, msg: 'Check constraint refers to auto-increment column' },
                { check: () => errorCode === 3823, msg: 'Check constraint column not found' },
              ];
              
              // Check if error should be skipped
              const skipError = skipErrors.find(err => err.check());
              
              if (skipError) {
                console.log(`   ⚠️  Skipping: ${skipError.msg} - ${statement.substring(0, 80)}...`);
                console.log(`      Reason: ${error.message.substring(0, 100)}`);
                stats.skippedStatements++;
                stats.skippedReasons[skipError.msg] = (stats.skippedReasons[skipError.msg] || 0) + 1;
              } else {
                // Critical error - log details and throw
                console.error(`   ❌ Failed statement ${i + 1}: ${statement.substring(0, 100)}...`);
                console.error(`   Error: ${error.message}`);
                console.error(`   SQL State: ${error.sqlState || 'N/A'}`);
                console.error(`   Error Code: ${error.errno || 'N/A'}`);
                console.error(`   Full statement: ${statement}`);
                throw error;
              }
            }
          }
        }
        
        console.log(`✅ Migration completed: ${file}`);
      } catch (error) {
        console.error(`❌ Error in migration ${file}:`, error.message);
        throw error;
      }
    }

    console.log('\n🎉 All migrations completed successfully!');
    
    // Print statistics
    console.log('\n📊 Migration Statistics:');
    console.log(`   Total files processed: ${stats.totalFiles}`);
    console.log(`   Total statements: ${stats.totalStatements}`);
    console.log(`   Successful: ${stats.successfulStatements}`);
    console.log(`   Skipped: ${stats.skippedStatements}`);
    
    if (Object.keys(stats.skippedReasons).length > 0) {
      console.log('\n   Skipped breakdown:');
      Object.entries(stats.skippedReasons).forEach(([reason, count]) => {
        console.log(`      - ${reason}: ${count}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Print partial statistics
    if (stats.totalStatements > 0) {
      console.log('\n📊 Partial Statistics (before failure):');
      console.log(`   Total files attempted: ${stats.totalFiles}`);
      console.log(`   Total statements: ${stats.totalStatements}`);
      console.log(`   Successful: ${stats.successfulStatements}`);
      console.log(`   Skipped: ${stats.skippedStatements}`);
    }
    
    throw error;
  } finally {
    await connection.end();
  }
}

async function checkTables() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('\n📋 Database tables created:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   ✓ ${tableName}`);
    });
    
    // Check record counts
    const tableNames = ['cameras', 'team_members', 'security_activities', 'perumahan_info', 'perumahan_facilities'];
    console.log('\n📊 Record counts:');
    
    for (const tableName of tableNames) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`   ${tableName}: ${rows[0].count} records`);
      } catch (error) {
        console.log(`   ${tableName}: Table not found or error`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
  } finally {
    await connection.end();
  }
}

async function main() {
  console.log('🚀 Starting database migration process...');
  console.log(`📍 Target database: ${dbConfig.database}`);
  console.log(`🏠 Host: ${dbConfig.host}`);
  console.log(`👤 User: ${dbConfig.user}`);
  
  try {
    // Step 1: Create database if not exists
    await createDatabase();
    
    // Step 2: Run migrations
    await runMigrations();
    
    // Step 3: Verify tables and data
    await checkTables();
    
    console.log('\n✨ Migration process completed successfully!');
    console.log('\n💡 You can now start the backend server with: npm run dev');
    
  } catch (error) {
    console.error('\n💥 Migration process failed:', error.message);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, createDatabase, runMigrations, checkTables };
