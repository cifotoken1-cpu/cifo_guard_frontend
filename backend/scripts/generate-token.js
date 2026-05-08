/**
 * Token Generator Script
 * Generate JWT token untuk testing API endpoints
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWT Secret dari environment atau default
const JWT_SECRET = process.env.JWT_SECRET || 'cifo-security-secret-key';

/**
 * Generate token untuk testing
 * @param {Object} payload - Data user untuk token
 * @param {string} expiresIn - Waktu expired (default: 24h)
 */
function generateTestToken(payload = {}, expiresIn = '24h') {
  // Default payload untuk testing
  const defaultPayload = {
    userId: 'test-user-001',
    id: 'test-user-001',
    name: 'Test User',
    email: 'test@cifo.com',
    role: 'ADMIN',
    status: 'ACTIVE',
    ...payload
  };
  
  const token = jwt.sign(defaultPayload, JWT_SECRET, { expiresIn });
  return token;
}

/**
 * Verify token untuk testing
 * @param {string} token - Token yang akan diverify
 */
function verifyTestToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { success: true, decoded };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Jika script dijalankan langsung
if (require.main === module) {
  console.log('=== CIFO Security Token Generator ===\n');
  
  // Generate token default
  const defaultToken = generateTestToken();
  console.log('Default Test Token:');
  console.log(defaultToken);
  console.log('\n');
  
  // Generate token untuk berbagai role
  const roles = ['ADMIN', 'SUPERVISOR', 'GUARD'];
  
  roles.forEach(role => {
    const token = generateTestToken({ role });
    console.log(`${role} Token:`);
    console.log(token);
    console.log('');
  });
  
  console.log('=== Cara Penggunaan ===');
  console.log('1. Copy token yang diinginkan');
  console.log('2. Akses frontend dengan URL:');
  console.log('   http://localhost:3000/dashboard/security/control-center?token=YOUR_TOKEN_HERE');
  console.log('3. Atau set manual di browser console:');
  console.log('   localStorage.setItem("token", "YOUR_TOKEN_HERE")');
  console.log('\n=== Test Token Verification ===');
  
  // Test verify token
  const testResult = verifyTestToken(defaultToken);
  if (testResult.success) {
    console.log('✅ Token valid!');
    console.log('Decoded payload:', JSON.stringify(testResult.decoded, null, 2));
  } else {
    console.log('❌ Token invalid:', testResult.error);
  }
}

module.exports = {
  generateTestToken,
  verifyTestToken
};