/**
 * Development Authentication Middleware
 * Provides hardcoded fallback authentication for development environment
 * This bypasses JWT validation and provides mock user data
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Secret from environment or default
const JWT_SECRET = process.env.JWT_SECRET || 'cifo-security-secret-key';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Mock user data for development
const DEV_USER = {
  id: 'dev-user-001',
  username: 'devuser',
  name: 'Development User',
  email: 'dev@cifo.com',
  role: 'ADMIN',
  account_status: 'ACTIVE'
};

/**
 * Development-friendly verify token middleware
 * Falls back to mock user in development environment
 */
const verifyTokenDev = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // In development/test, if no token provided, use mock user
    if (!authHeader && (NODE_ENV === 'development' || NODE_ENV === 'test')) {
      // console.log('[DEV-AUTH] No token provided, using mock user for development/test');
      req.user = DEV_USER;
      return next();
    }

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      // In development/test, fallback to mock user
      if (NODE_ENV === 'development' || NODE_ENV === 'test') {
        // console.log('[DEV-AUTH] Invalid token format, using mock user for development/test');
        req.user = DEV_USER;
        return next();
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    try {
      // Try to verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Get user information from users table
      const user = await User.findById(decoded.userId || decoded.id);

      if (!user) {
        // In development, fallback to mock user if user not found
        if (NODE_ENV === 'development') {
          // console.log('[DEV-AUTH] User not found in database, using mock user for development');
          req.user = DEV_USER;
          return next();
        }

        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user account is active
      if (user.account_status !== 'ACTIVE') {
        // In development, still allow inactive users
        if (NODE_ENV === 'development') {
          // console.log('[DEV-AUTH] User inactive, but allowing for development');
          req.user = {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            account_status: 'ACTIVE' // Override status for dev
          };
          return next();
        }

        return res.status(401).json({
          success: false,
          message: 'User account is not active'
        });
      }

      // Add user info to request object
      req.user = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        account_status: user.account_status
      };

      next();
    } catch (jwtError) {
      // JWT verification failed
      if (NODE_ENV === 'development') {
        // console.log('[DEV-AUTH] JWT verification failed, using mock user for development:', jwtError.message);
        req.user = DEV_USER;
        return next();
      }

      // Re-throw for production error handling
      throw jwtError;
    }

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Development-friendly role check
 * More permissive in development environment
 */
const requireRoleDev = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // In development, be more permissive with roles
    if (NODE_ENV === 'development') {
      console.log(`[DEV-AUTH] Role check: user has '${req.user.role}', required: [${roles.join(', ')}]`);

      // Allow ADMIN role to access everything in development
      if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
        return next();
      }
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Optional authentication for development
 */
const optionalAuthDev = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // In development, provide mock user even for optional auth
      if (NODE_ENV === 'development') {
        req.user = DEV_USER;
      }
      return next();
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      if (NODE_ENV === 'development') {
        req.user = DEV_USER;
      }
      return next();
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);

      // Get user information from users table
      const user = await User.findById(decoded.userId || decoded.id);

      if (user && user.account_status === 'ACTIVE') {
        req.user = {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          account_status: user.account_status
        };
      } else if (NODE_ENV === 'development') {
        req.user = DEV_USER;
      }
    } catch (jwtError) {
      // In development, still provide mock user on JWT errors
      if (NODE_ENV === 'development') {
        req.user = DEV_USER;
      }
    }

    next();
  } catch (error) {
    // Ignore auth errors in optional auth, but provide mock user in dev
    if (NODE_ENV === 'development') {
      req.user = DEV_USER;
    }
    next();
  }
};

module.exports = {
  verifyToken: verifyTokenDev,
  requireRole: requireRoleDev,
  optionalAuth: optionalAuthDev,
  DEV_USER
};