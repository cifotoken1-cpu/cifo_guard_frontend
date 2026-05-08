const express = require('express');
const router = express.Router();
const { verifyToken: auth } = require('../middleware/auth');

/**
 * Google Maps API Key Proxy
 * Provides secure, tenant-aware access to Google Maps API keys
 * Prevents client-side API key exposure
 */

/**
 * Get tenant-specific Google Maps configuration
 * @route GET /api/maps/config
 * @access Private (requires authentication)
 */
router.get('/config', auth, async (req, res) => {
  try {
    const { tenant } = req.user;
    
    if (!tenant) {
      return res.status(400).json({
        success: false,
        message: 'Tenant information required'
      });
    }

    // Get tenant-specific API key from environment
    const apiKey = getTenantApiKey(tenant);
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Maps API key not configured for tenant'
      });
    }

    // Get tenant-specific map configuration
    const mapConfig = getTenantMapConfig(tenant);

    // Generate temporary token (optional security layer)
    const temporaryToken = generateMapToken(tenant, apiKey);

    res.json({
      success: true,
      data: {
        // Use temporary token instead of direct API key
        apiKey: process.env.VITE_ENABLE_API_KEY_PROXY === 'true' ? temporaryToken : apiKey,
        mapConfig,
        expiresIn: 3600, // 1 hour
        tenant
      }
    });

  } catch (error) {
    console.error('Maps config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get maps configuration'
    });
  }
});

/**
 * Proxy Google Maps API requests (optional additional security)
 * @route POST /api/maps/proxy
 * @access Private
 */
router.post('/proxy', auth, async (req, res) => {
  try {
    const { tenant } = req.user;
    const { endpoint, params } = req.body;

    // Validate tenant access to requested endpoint
    if (!isValidMapRequest(tenant, endpoint, params)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized map request'
      });
    }

    // Make request to Google Maps API on behalf of client
    const apiKey = getTenantApiKey(tenant);
    const response = await makeGoogleMapsRequest(endpoint, params, apiKey);

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Maps proxy error:', error);
    res.status(500).json({
      success: false,
      message: 'Maps request failed'
    });
  }
});

/**
 * Get tenant-specific Google Maps API key
 * @param {string} tenant - Tenant identifier
 * @returns {string} API key for the tenant
 */
function getTenantApiKey(tenant) {
  // Try tenant-specific key first
  const tenantKey = process.env[`VITE_GOOGLE_MAPS_API_KEY_${tenant.toUpperCase()}`];
  
  if (tenantKey && tenantKey !== 'your-perumahan-a-api-key-here' && tenantKey !== 'your-perumahan-b-api-key-here') {
    return tenantKey;
  }
  
  // Fallback to default key
  const defaultKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (defaultKey && defaultKey !== 'your-default-google-maps-api-key-here') {
    return defaultKey;
  }
  
  return null;
}

/**
 * Get tenant-specific map configuration
 * @param {string} tenant - Tenant identifier
 * @returns {object} Map configuration for the tenant
 */
function getTenantMapConfig(tenant) {
  // Tenant-specific map bounds and settings
  const tenantConfigs = {
    'perumahan_a': {
      center: { lat: -6.2088, lng: 106.8456 }, // Jakarta area example
      bounds: {
        north: -6.2000,
        south: -6.2200,
        east: 106.8600,
        west: 106.8300
      },
      minZoom: 14,
      maxZoom: 20,
      restriction: {
        strictBounds: true
      }
    },
    'perumahan_b': {
      center: { lat: -6.1751, lng: 106.8650 },
      bounds: {
        north: -6.1650,
        south: -6.1850,
        east: 106.8800,
        west: 106.8500
      },
      minZoom: 14,
      maxZoom: 20,
      restriction: {
        strictBounds: true
      }
    }
  };

  return tenantConfigs[tenant] || {
    center: { lat: -6.2088, lng: 106.8456 },
    bounds: null,
    minZoom: 10,
    maxZoom: 18,
    restriction: null
  };
}

/**
 * Generate temporary map token (additional security layer)
 * @param {string} tenant - Tenant identifier
 * @param {string} apiKey - Google Maps API key
 * @returns {string} Temporary token
 */
function generateMapToken(tenant, apiKey) {
  // In production, implement proper JWT or similar token system
  // For now, return the API key (will be enhanced in Phase 2)
  return apiKey;
}

/**
 * Validate if map request is allowed for tenant
 * @param {string} tenant - Tenant identifier
 * @param {string} endpoint - Google Maps API endpoint
 * @param {object} params - Request parameters
 * @returns {boolean} Whether request is valid
 */
function isValidMapRequest(tenant, endpoint, params) {
  // Implement validation logic based on tenant permissions
  // For now, allow all requests (will be enhanced in Phase 2)
  return true;
}

/**
 * Make request to Google Maps API
 * @param {string} endpoint - API endpoint
 * @param {object} params - Request parameters
 * @param {string} apiKey - API key
 * @returns {object} API response
 */
async function makeGoogleMapsRequest(endpoint, params, apiKey) {
  // Implement actual Google Maps API requests
  // This is a placeholder for the proxy functionality
  throw new Error('Google Maps proxy not yet implemented');
}

module.exports = router;