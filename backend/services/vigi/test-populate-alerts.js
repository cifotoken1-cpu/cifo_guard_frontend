#!/usr/bin/env node
/**
 * Test Script: Simulate VIGI Camera Events & Populate Alerts
 * Simulates security camera detections and creates AI-enriched alerts in database
 * Usage: node services/vigi/test-populate-alerts.js
 */

const path = require('path');
const fs = require('fs/promises');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const sequelize = require('../../config/database');
const { analyzeSnapshot } = require('./aiPipeline');
const { persistEnrichedAlert } = require('./alertEnricher');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function logSection(title) {
  console.log('\n' + colors.bright + colors.cyan + '═'.repeat(60) + colors.reset);
  console.log(colors.bright + colors.cyan + `  ${title}` + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(60) + colors.reset);
}

// Create minimal valid JPEG for testing
function createTestImage() {
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
    0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
    0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
    0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD3, 0xFF, 0xD9
  ]);
}

async function testCreateAlert(eventType, scenario) {
  try {
    log(colors.yellow, `→ Creating ${eventType} alert: ${scenario}`);
    
    const imageBuffer = createTestImage();
    const eventTime = Math.floor(Date.now() / 1000);

    // Analyze snapshot
    log(colors.blue, '  Analyzing with AI...');
    const aiResult = await analyzeSnapshot({
      imageBuffer,
      eventMeta: {
        event_type: eventType,
        time: eventTime
      },
      location: process.env.VIGI_CAMERA_LOCATION || 'Test Location'
    });

    log(colors.green, `  ✓ AI Analysis: severity=${aiResult.severity}, action=${aiResult.recommended_action}`);

    // Persist to database
    log(colors.blue, '  Persisting to database...');
    const { alertId, panicAlertId, snapshotPath } = await persistEnrichedAlert({
      eventMeta: {
        event_type: eventType,
        time: eventTime
      },
      snapshotBuffer: imageBuffer,
      aiResult,
      cameraId: process.env.VIGI_CAMERA_ID || 'C240-01',
      cameraLocation: process.env.VIGI_CAMERA_LOCATION || 'Test Location'
    });

    log(colors.green, `✓ Alert created successfully`);
    console.log(`  Alert ID: ${alertId}`);
    console.log(`  Severity: ${aiResult.severity.toUpperCase()}`);
    console.log(`  Description: ${aiResult.description}`);
    if (panicAlertId) {
      console.log(`  Panic Alert ID: ${panicAlertId} (ESCALATED)`);
    }
    
    return true;
  } catch (error) {
    log(colors.red, `✗ Error: ${error.message}`);
    return false;
  }
}

async function testQueryAlerts() {
  logSection('Query Results');
  
  try {
    log(colors.yellow, '→ Querying recent alerts from database...');
    
    const alerts = await sequelize.query(`
      SELECT 
        id, 
        title,
        message,
        severity, 
        priority,
        status,
        source_id as camera_id,
        ai_severity,
        ai_description,
        ai_person_count,
        ai_vehicle_count,
        ai_is_false_positive,
        ai_recommended_action,
        created_at
      FROM alerts 
      ORDER BY created_at DESC 
      LIMIT 10
    `, { raw: true });

    if (alerts.length === 0) {
      log(colors.yellow, '⚠ No alerts found in database');
      return;
    }

    log(colors.green, `✓ Found ${alerts.length} alerts\n`);

    alerts.forEach((alert, idx) => {
      console.log(`${idx + 1}. ${alert.title}`);
      console.log(`   ID: ${alert.id}`);
      console.log(`   Severity: ${alert.severity} | Priority: ${alert.priority}`);
      console.log(`   Status: ${alert.status}`);
      console.log(`   Message: ${alert.message.substring(0, 60)}...`);
      if (alert.ai_description) {
        console.log(`   AI: ${alert.ai_description.substring(0, 60)}...`);
      }
      console.log(`   Created: ${alert.created_at}`);
      console.log();
    });
  } catch (error) {
    log(colors.red, `✗ Query failed: ${error.message}`);
  }
}

async function runAllTests() {
  logSection('VIGI Alert Population Test');
  
  console.log('\n' + colors.blue + 'Testing alert creation & persistence...' + colors.reset);
  console.log('Configuration:');
  console.log(`  - Camera: ${process.env.VIGI_CAMERA_HOST || 'N/A'}`);
  console.log(`  - Location: ${process.env.VIGI_CAMERA_LOCATION || 'Unknown'}`);
  console.log(`  - Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}\n`);

  try {
    // Connect to database
    log(colors.yellow, '→ Connecting to database...');
    await sequelize.authenticate();
    log(colors.green, '✓ Database connected');

    // Create test scenarios
    const scenarios = [
      { eventType: 'PeopleDetection', scenario: 'Person detected (info)' },
      { eventType: 'MotionDetection', scenario: 'Motion detected (info)' },
      { eventType: 'InvasionDetection', scenario: 'Intrusion attempt (warning)' },
      { eventType: 'LoiterDetection', scenario: 'Loitering suspicious (warning)' }
    ];

    let passed = 0;
    for (const { eventType, scenario } of scenarios) {
      if (await testCreateAlert(eventType, scenario)) {
        passed++;
      }
      // Small delay between requests
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n${colors.bright}Created: ${passed}/${scenarios.length} alerts${colors.reset}`);

    // Query results
    await testQueryAlerts();

    // Verify data was saved
    const count = await sequelize.query(`SELECT COUNT(*) as total FROM alerts`, { raw: true });
    console.log(`\n${colors.bright}Total alerts in database: ${count[0]?.total || 0}${colors.reset}\n`);

  } catch (error) {
    log(colors.red, `Fatal error: ${error.message}`);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runAllTests();
