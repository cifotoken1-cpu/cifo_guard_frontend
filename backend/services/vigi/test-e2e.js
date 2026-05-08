#!/usr/bin/env node
/**
 * End-to-End Test: VIGI Bridge Complete Workflow
 * Simulates camera events → AI analysis → Database persistence
 * Does NOT require ffmpeg or real camera
 * Usage: node services/vigi/test-e2e.js
 */

const path = require('path');
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
  console.log('\n' + colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(colors.bright + colors.cyan + `  ${title}` + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
}

// Create minimal JPEG for testing
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

async function simulateVigiEvent(eventType, eventTime) {
  log(colors.yellow, `→ Simulating ${eventType} event...`);

  try {
    // Step 1: Get snapshot
    log(colors.blue, '  [1/5] Capture snapshot');
    const imageBuffer = createTestImage();
    log(colors.green, `      ✓ ${imageBuffer.length} bytes`);

    // Step 2: Analyze with AI
    log(colors.blue, '  [2/5] AI analysis');
    const aiResult = await analyzeSnapshot({
      imageBuffer,
      eventMeta: {
        event_type: eventType,
        time: eventTime
      },
      location: process.env.VIGI_CAMERA_LOCATION || 'Test Location'
    });

    log(colors.green, `      ✓ severity=${aiResult.severity}, tokens=${aiResult._meta.tokens}`);

    // Step 3: Persist to database
    log(colors.blue, '  [3/5] Persist to database');
    const { alertId, panicAlertId } = await persistEnrichedAlert({
      eventMeta: {
        event_type: eventType,
        time: eventTime
      },
      snapshotBuffer: imageBuffer,
      aiResult,
      cameraId: process.env.VIGI_CAMERA_ID || 'C240-01',
      cameraLocation: process.env.VIGI_CAMERA_LOCATION || 'Test Location'
    });

    log(colors.green, `      ✓ Alert #${alertId.substring(0, 8)}...`);

    // Step 4: Verify in database
    log(colors.blue, '  [4/5] Verify in database');
    const [alert] = await sequelize.query(`
      SELECT id, title, severity, ai_severity, ai_description, ai_recommended_action
      FROM alerts
      WHERE id = ?
      LIMIT 1
    `, {
      replacements: [alertId],
      raw: true
    });

    if (alert && alert.length > 0) {
      log(colors.green, `      ✓ Found: ${alert[0].title}`);
    } else {
      throw new Error('Alert not found in database!');
    }

    // Step 5: Check panic escalation
    log(colors.blue, '  [5/5] Check escalation');
    if (panicAlertId) {
      const [panic] = await sequelize.query(`
        SELECT id, source_alert_id, severity
        FROM panic_alerts
        WHERE id = ?
      `, {
        replacements: [panicAlertId],
        raw: true
      });

      if (panic && panic.length > 0) {
        log(colors.green, `      ✓ Escalated to Panic #${panicAlertId}`);
      }
    } else {
      log(colors.green, `      ✓ No escalation needed`);
    }

    log(colors.green, `✓ ${eventType} processed successfully\n`);
    return { alertId, success: true };

  } catch (error) {
    log(colors.red, `✗ Error: ${error.message}\n`);
    return { success: false, error: error.message };
  }
}

async function verifyDatabase() {
  logSection('Database Verification');

  try {
    // Count alerts
    log(colors.yellow, '→ Checking alerts table...');
    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as total FROM alerts
    `, { raw: true });

    const totalAlerts = countResult[0]?.total || 0;
    log(colors.green, `  ✓ Total alerts: ${totalAlerts}`);

    if (totalAlerts === 0) {
      log(colors.red, `  ✗ No alerts in database!`);
      return false;
    }

    // Show recent alerts
    log(colors.yellow, '→ Recent alerts:');
    const [alerts] = await sequelize.query(`
      SELECT 
        id,
        title,
        severity,
        ai_severity,
        ai_person_count,
        ai_vehicle_count,
        ai_recommended_action,
        created_at
      FROM alerts
      ORDER BY created_at DESC
      LIMIT 5
    `, { raw: true });

    alerts.forEach((alert, idx) => {
      console.log(`  ${idx + 1}. ${alert.title}`);
      console.log(`     Severity: ${alert.severity} (AI: ${alert.ai_severity})`);
      console.log(`     Persons: ${alert.ai_person_count}, Vehicles: ${alert.ai_vehicle_count}`);
      console.log(`     Action: ${alert.ai_recommended_action}`);
      console.log();
    });

    // Severity breakdown
    log(colors.yellow, '→ Severity breakdown:');
    const [stats] = await sequelize.query(`
      SELECT 
        severity,
        COUNT(*) as count
      FROM alerts
      GROUP BY severity
      ORDER BY severity DESC
    `, { raw: true });

    stats.forEach(stat => {
      console.log(`  ${stat.severity}: ${stat.count}`);
    });

    // Check for panic alerts
    log(colors.yellow, '→ Checking panic alerts...');
    const [panicCount] = await sequelize.query(`
      SELECT COUNT(*) as total FROM panic_alerts
    `, { raw: true });

    const totalPanic = panicCount[0]?.total || 0;
    log(colors.green, `  ✓ Total panic alerts: ${totalPanic}`);

    return true;

  } catch (error) {
    log(colors.red, `✗ Verification failed: ${error.message}`);
    return false;
  }
}

async function runE2ETests() {
  logSection('End-to-End: VIGI Bridge Workflow');

  console.log(colors.blue + '\nConfiguration:' + colors.reset);
  console.log(`  Camera: ${process.env.VIGI_CAMERA_HOST || 'mock'}`);
  console.log(`  Location: ${process.env.VIGI_CAMERA_LOCATION || 'Test'}`);
  console.log(`  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log(`  API Key: ${process.env.OPENROUTER_API_KEY ? '✓ Set' : '✗ Missing'}\n`);

  try {
    // Connect to database
    log(colors.yellow, '→ Connecting to database...');
    await sequelize.authenticate();
    log(colors.green, '✓ Connected\n');

    // Test scenarios
    const baseTime = Math.floor(Date.now() / 1000);
    const testCases = [
      { eventType: 'PeopleDetection', eventTime: baseTime },
      { eventType: 'VehicleDetection', eventTime: baseTime + 1 },
      { eventType: 'MotionDetection', eventTime: baseTime + 2 },
      { eventType: 'InvasionDetection', eventTime: baseTime + 3 },
      { eventType: 'LoiterDetection', eventTime: baseTime + 4 }
    ];

    logSection('Processing Events');

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
      const result = await simulateVigiEvent(testCase.eventType, testCase.eventTime);
      if (result.success) {
        passed++;
      } else {
        failed++;
      }
      // Delay between events
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(colors.bright + `\nProcessing Results: ${passed}/${testCases.length} successful` + colors.reset);

    // Verify database
    const dbValid = await verifyDatabase();

    // Final summary
    logSection('Test Summary');

    console.log(colors.bright + `Events Processed: ${passed}/${testCases.length}` + colors.reset);
    console.log(colors.bright + `Database Valid: ${dbValid ? '✓ YES' : '✗ NO'}` + colors.reset);

    const overallSuccess = passed === testCases.length && dbValid;
    console.log(colors.bright + `\nOverall Result: ${overallSuccess ? colors.green + '✓ PASS' : colors.red + '✗ FAIL'}` + colors.reset);

    console.log();

    return overallSuccess ? 0 : 1;

  } catch (error) {
    log(colors.red, `Fatal error: ${error.message}`);
    return 1;
  } finally {
    await sequelize.close();
  }
}

// Run tests
runE2ETests().then(exitCode => process.exit(exitCode));
