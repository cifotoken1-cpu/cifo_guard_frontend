/**
 * Authentication Configuration
 * Selects appropriate auth middleware based on environment
 */

const NODE_ENV = process.env.NODE_ENV || 'development';

// Import both auth middlewares
const productionAuth = require('./auth');
const developmentAuth = require('./dev-auth');

// Select middleware based on environment
const authMiddleware = (NODE_ENV === 'development' || NODE_ENV === 'test') ? developmentAuth : productionAuth;

console.log(`[AUTH-CONFIG] Using ${(NODE_ENV === 'development' || NODE_ENV === 'test') ? 'development' : 'production'} authentication middleware`);

module.exports = {
  verifyToken: authMiddleware.verifyToken,
  requireRole: authMiddleware.requireRole,
  optionalAuth: authMiddleware.optionalAuth,
  // Export additional functions from production auth if needed
  generateToken: productionAuth.generateToken,
  adminOnly: authMiddleware.requireRole ? authMiddleware.requireRole(['ADMIN', 'SUPER_ADMIN']) : productionAuth.adminOnly,
  securityTeam: authMiddleware.requireRole ? authMiddleware.requireRole(['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR', 'GUARD']) : productionAuth.securityTeam
};