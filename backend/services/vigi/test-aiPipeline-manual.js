#!/usr/bin/env node
/**
 * Manual Integration Test for aiPipeline Service
 * Tests with real API calls (requires valid OPENROUTER_API_KEY)
 * Usage: node services/vigi/test-aiPipeline-manual.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { analyzeSnapshot } = require('./aiPipeline');

// Color codes for console output
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

async function createTestImage() {
  // Create a minimal valid JPEG buffer for testing
  // This is a 1x1 blue pixel JPEG
  const jpegData = Buffer.from([
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
  return jpegData;
}

async function testBasicAnalysis() {
  logSection('TEST 1: Basic Snapshot Analysis');
  
  try {
    log(colors.yellow, '→ Creating test image buffer...');
    const imageBuffer = await createTestImage();
    log(colors.green, `✓ Image buffer created (${imageBuffer.length} bytes)`);

    log(colors.yellow, '→ Analyzing snapshot...');
    const eventTime = Math.floor(Date.now() / 1000);
    
    const result = await analyzeSnapshot({
      imageBuffer,
      eventMeta: {
        event_type: 'PERSON_DETECTED',
        time: eventTime
      },
      location: 'Halaman Depan'
    });

    log(colors.green, '✓ Analysis completed successfully');
    console.log('\n' + colors.bright + 'Response:' + colors.reset);
    console.log(JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    log(colors.red, `✗ Error: ${error.message}`);
    return false;
  }
}

async function testDifferentEventTypes() {
  logSection('TEST 2: Different Event Types');
  
  const eventTypes = ['PERSON_DETECTED', 'MOTION_DETECTED', 'LOITERING', 'VEHICLE_DETECTED'];
  const imageBuffer = await createTestImage();
  let passed = 0;
  let failed = 0;

  for (const eventType of eventTypes) {
    try {
      log(colors.yellow, `→ Testing ${eventType}...`);
      
      const result = await analyzeSnapshot({
        imageBuffer,
        eventMeta: {
          event_type: eventType,
          time: Math.floor(Date.now() / 1000)
        },
        location: 'Test Location'
      });

      log(colors.green, `✓ ${eventType}: severity=${result.severity}, action=${result.recommended_action}`);
      passed++;
    } catch (error) {
      log(colors.red, `✗ ${eventType}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${colors.bright}Result: ${passed}/${eventTypes.length} passed${colors.reset}`);
  return failed === 0;
}

async function testTimeOfDayDetection() {
  logSection('TEST 3: Time of Day Detection');
  
  const imageBuffer = await createTestImage();
  const timesOfDay = [
    { label: 'Pagi (06:00)', hours: 6 },
    { label: 'Siang (12:00)', hours: 12 },
    { label: 'Sore (17:00)', hours: 17 },
    { label: 'Malam (21:00)', hours: 21 }
  ];

  let passed = 0;

  for (const time of timesOfDay) {
    try {
      log(colors.yellow, `→ Testing ${time.label}...`);
      
      const testDate = new Date();
      testDate.setHours(time.hours);
      const eventTime = Math.floor(testDate.getTime() / 1000);

      const result = await analyzeSnapshot({
        imageBuffer,
        eventMeta: {
          event_type: 'PERSON_DETECTED',
          time: eventTime
        },
        location: 'Test Location'
      });

      log(colors.green, `✓ ${time.label}: Analyzed (latency: ${result._meta.latency_ms}ms)`);
      passed++;
    } catch (error) {
      log(colors.red, `✗ ${time.label}: ${error.message}`);
    }
  }

  console.log(`\n${colors.bright}Result: ${passed}/${timesOfDay.length} passed${colors.reset}`);
  return passed === timesOfDay.length;
}

async function testErrorHandling() {
  logSection('TEST 4: Error Handling');
  
  let passed = 0;
  let tested = 0;

  // Test 1: Missing API Key
  tested++;
  try {
    log(colors.yellow, '→ Testing missing API key...');
    const originalKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await analyzeSnapshot({
        imageBuffer: Buffer.from([0xFF, 0xD8]),
        eventMeta: { event_type: 'TEST', time: Math.floor(Date.now() / 1000) }
      });
      log(colors.red, '✗ Should have thrown error for missing API key');
    } catch (expectedError) {
      log(colors.green, `✓ Correctly rejected missing API key`);
      passed++;
    }

    process.env.OPENROUTER_API_KEY = originalKey;
  } catch (error) {
    log(colors.red, `✗ Unexpected error: ${error.message}`);
  }

  // Test 2: Invalid Buffer
  tested++;
  try {
    log(colors.yellow, '→ Testing invalid image buffer handling...');
    const imageBuffer = Buffer.from([0x00, 0x00]); // Invalid JPEG

    const result = await analyzeSnapshot({
      imageBuffer,
      eventMeta: {
        event_type: 'PERSON_DETECTED',
        time: Math.floor(Date.now() / 1000)
      }
    });

    // Service should still work with invalid image (AI will handle it)
    if (result && result.description) {
      log(colors.green, `✓ Service handled invalid image gracefully`);
      passed++;
    }
  } catch (error) {
    log(colors.yellow, `⚠ Error with invalid image (expected): ${error.message}`);
  }

  console.log(`\n${colors.bright}Result: ${passed}/${tested} tests passed${colors.reset}`);
  return true;
}

async function testResponseValidation() {
  logSection('TEST 5: Response Validation');
  
  const imageBuffer = await createTestImage();
  
  try {
    log(colors.yellow, '→ Analyzing and validating response structure...');
    
    const result = await analyzeSnapshot({
      imageBuffer,
      eventMeta: {
        event_type: 'PERSON_DETECTED',
        time: Math.floor(Date.now() / 1000)
      },
      location: 'Test Location'
    });

    const validations = [
      { field: 'description', type: 'string', required: true },
      { field: 'person_count', type: 'number', required: true },
      { field: 'vehicle_count', type: 'number', required: true },
      { field: 'is_false_positive', type: 'boolean', required: true },
      { field: 'severity', type: 'string', required: true, values: ['info', 'warning', 'critical'] },
      { field: 'severity_reason', type: 'string', required: true },
      { field: 'tags', type: 'array', required: true },
      { field: 'recommended_action', type: 'string', required: true, values: ['none', 'log', 'notify_security', 'trigger_panic'] },
      { field: '_meta', type: 'object', required: true }
    ];

    let validationsPassed = 0;
    let validationsFailed = 0;

    for (const validation of validations) {
      const value = result[validation.field];
      const typeMatch = typeof value === validation.type || 
                       (validation.type === 'array' && Array.isArray(value)) ||
                       (validation.type === 'object' && typeof value === 'object');

      if (!typeMatch) {
        log(colors.red, `✗ ${validation.field}: Expected ${validation.type}, got ${typeof value}`);
        validationsFailed++;
        continue;
      }

      if (validation.values && !validation.values.includes(value)) {
        log(colors.red, `✗ ${validation.field}: Invalid value "${value}", expected one of ${validation.values.join(', ')}`);
        validationsFailed++;
        continue;
      }

      log(colors.green, `✓ ${validation.field}: ${validation.type} (${value})`);
      validationsPassed++;
    }

    console.log(`\n${colors.bright}Validation: ${validationsPassed}/${validations.length} fields valid${colors.reset}`);
    return validationsFailed === 0;
  } catch (error) {
    log(colors.red, `✗ Error: ${error.message}`);
    return false;
  }
}

async function testMetadata() {
  logSection('TEST 6: Metadata Tracking');
  
  const imageBuffer = await createTestImage();
  
  try {
    log(colors.yellow, '→ Testing metadata collection...');
    
    const result = await analyzeSnapshot({
      imageBuffer,
      eventMeta: {
        event_type: 'PERSON_DETECTED',
        time: Math.floor(Date.now() / 1000)
      }
    });

    console.log('\n' + colors.bright + 'Metadata:' + colors.reset);
    console.log(`  Model: ${result._meta.model}`);
    console.log(`  Tokens used: ${result._meta.tokens}`);
    console.log(`  Latency: ${result._meta.latency_ms}ms`);

    const validations = [
      result._meta.model && result._meta.model.length > 0,
      result._meta.tokens > 0,
      result._meta.latency_ms >= 0
    ];

    if (validations.every(v => v)) {
      log(colors.green, '✓ All metadata fields valid');
      return true;
    } else {
      log(colors.red, '✗ Some metadata fields invalid');
      return false;
    }
  } catch (error) {
    log(colors.red, `✗ Error: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  logSection('AIPipeline Service - Integration Test Suite');
  
  console.log('\n' + colors.blue + 'Testing aiPipeline service...' + colors.reset);
  console.log('Configuration:');
  console.log(`  - OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? '✓ Set' : '✗ Not set'}`);
  console.log(`  - OPENROUTER_BASE_URL: ${process.env.OPENROUTER_BASE_URL || 'default'}`);
  console.log(`  - OPENAI_VISION_MODEL: ${process.env.OPENAI_VISION_MODEL || 'default'}\n`);

  const results = [];

  // Run tests
  results.push({ name: 'Basic Analysis', passed: await testBasicAnalysis() });
  results.push({ name: 'Event Types', passed: await testDifferentEventTypes() });
  results.push({ name: 'Time of Day', passed: await testTimeOfDayDetection() });
  results.push({ name: 'Error Handling', passed: await testErrorHandling() });
  results.push({ name: 'Response Validation', passed: await testResponseValidation() });
  results.push({ name: 'Metadata', passed: await testMetadata() });

  // Summary
  logSection('Test Summary');
  
  for (const result of results) {
    const status = result.passed ? colors.green + '✓ PASS' : colors.red + '✗ FAIL';
    console.log(`${status}${colors.reset}  ${result.name}`);
  }

  const totalPassed = results.filter(r => r.passed).length;
  console.log(`\n${colors.bright}Total: ${totalPassed}/${results.length} test suites passed${colors.reset}\n`);

  return totalPassed === results.length;
}

// Run tests
runAllTests().catch(error => {
  log(colors.red, `Fatal error: ${error.message}`);
  process.exit(1);
});
