/**
 * basemap-config-routes.js
 * Routes untuk Basemap Configuration API
 */

const express = require('express');
const BasemapConfigController = require('../controllers/BasemapConfigController');
const { verifyToken, requireRole } = require('../middleware/auth-config');
const { trackRequest } = require('../middleware/metrics');

const router = express.Router();

// Middleware untuk semua routes
router.use(trackRequest);
router.use(verifyToken);

// Validation schemas
const createBasemapSchema = {
  name: {
    in: ['body'],
    isLength: {
      options: { min: 1, max: 255 },
      errorMessage: 'Name must be between 1 and 255 characters'
    },
    trim: true
  },
  description: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 1000 },
      errorMessage: 'Description must not exceed 1000 characters'
    },
    trim: true
  },
  svgData: {
    in: ['body'],
    isLength: {
      options: { min: 1 },
      errorMessage: 'SVG data is required'
    }
  },
  'calibration.controlPoints': {
    in: ['body'],
    isArray: {
      options: { min: 3 },
      errorMessage: 'At least 3 control points are required for calibration'
    }
  },
  'dimensions.width': {
    in: ['body'],
    isInt: {
      options: { min: 100, max: 10000 },
      errorMessage: 'Width must be between 100 and 10000 pixels'
    }
  },
  'dimensions.height': {
    in: ['body'],
    isInt: {
      options: { min: 100, max: 10000 },
      errorMessage: 'Height must be between 100 and 10000 pixels'
    }
  }
};

const updateBasemapSchema = {
  name: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { min: 1, max: 255 },
      errorMessage: 'Name must be between 1 and 255 characters'
    },
    trim: true
  },
  description: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 1000 },
      errorMessage: 'Description must not exceed 1000 characters'
    },
    trim: true
  },
  svgData: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { min: 1 },
      errorMessage: 'SVG data cannot be empty'
    }
  },
  'calibration.controlPoints': {
    in: ['body'],
    optional: true,
    isArray: {
      options: { min: 3 },
      errorMessage: 'At least 3 control points are required for calibration'
    }
  },
  'dimensions.width': {
    in: ['body'],
    optional: true,
    isInt: {
      options: { min: 100, max: 10000 },
      errorMessage: 'Width must be between 100 and 10000 pixels'
    }
  },
  'dimensions.height': {
    in: ['body'],
    optional: true,
    isInt: {
      options: { min: 100, max: 10000 },
      errorMessage: 'Height must be between 100 and 10000 pixels'
    }
  }
};

const coordinateConversionSchema = {
  x: {
    in: ['body'],
    isNumeric: {
      errorMessage: 'X coordinate must be a number'
    }
  },
  y: {
    in: ['body'],
    isNumeric: {
      errorMessage: 'Y coordinate must be a number'
    }
  }
};

const geoCoordinateConversionSchema = {
  latitude: {
    in: ['body'],
    isFloat: {
      options: { min: -90, max: 90 },
      errorMessage: 'Latitude must be between -90 and 90'
    }
  },
  longitude: {
    in: ['body'],
    isFloat: {
      options: { min: -180, max: 180 },
      errorMessage: 'Longitude must be between -180 and 180'
    }
  }
};

const cleanupVersionsSchema = {
  keepVersions: {
    in: ['body'],
    optional: true,
    isInt: {
      options: { min: 1, max: 50 },
      errorMessage: 'Keep versions must be between 1 and 50'
    }
  },
  olderThanDays: {
    in: ['body'],
    optional: true,
    isInt: {
      options: { min: 1, max: 365 },
      errorMessage: 'Older than days must be between 1 and 365'
    }
  }
};

// Routes

/**
 * @route   POST /api/basemap-config
 * @desc    Membuat basemap configuration baru
 * @access  Private (Admin only)
 */
router.post('/',
  requireRole(['ADMIN']),
  BasemapConfigController.createBasemap
);

/**
 * @route   GET /api/basemap-config
 * @desc    Mendapatkan daftar basemap configurations
 * @access  Private (All authenticated users)
 */
router.get('/',
  BasemapConfigController.getBasemaps
);

/**
 * @route   GET /api/basemap-config/active
 * @desc    Mendapatkan basemap yang sedang aktif
 * @access  Private (All authenticated users)
 */
router.get('/active',
  BasemapConfigController.getActiveBasemap
);

/**
 * @route   GET /api/basemap-config/:id
 * @desc    Mendapatkan detail basemap configuration berdasarkan ID
 * @access  Private (All authenticated users)
 */
router.get('/:id',
  BasemapConfigController.getBasemapById
);

/**
 * @route   PUT /api/basemap-config/:id
 * @desc    Update basemap configuration
 * @access  Private (Admin only)
 */
router.put('/:id',
  requireRole(['ADMIN']),
  BasemapConfigController.updateBasemap
);

/**
 * @route   DELETE /api/basemap-config/:id
 * @desc    Hapus basemap configuration
 * @access  Private (Admin only)
 */
router.delete('/:id',
  requireRole(['ADMIN']),
  BasemapConfigController.deleteBasemap
);

/**
 * @route   PATCH /api/basemap-config/:id/activate
 * @desc    Mengaktifkan basemap
 * @access  Private (Admin, Operator)
 */
router.patch('/:id/activate',
  requireRole(['ADMIN', 'OPERATOR']),
  BasemapConfigController.activateBasemap
);

/**
 * @route   PATCH /api/basemap-config/:id/deactivate
 * @desc    Menonaktifkan basemap
 * @access  Private (Admin, Operator)
 */
router.patch('/:id/deactivate',
  requireRole(['ADMIN', 'OPERATOR']),
  BasemapConfigController.deactivateBasemap
);

/**
 * @route   PATCH /api/basemap-config/:id/set-default
 * @desc    Mengatur basemap sebagai default
 * @access  Private (Admin only)
 */
router.patch('/:id/set-default',
  requireRole(['ADMIN']),
  BasemapConfigController.setDefaultBasemap
);

/**
 * @route   POST /api/basemap-config/:id/convert/svg-to-geo
 * @desc    Mengkonversi koordinat SVG ke geografis
 * @access  Private (All authenticated users)
 */
router.post('/:id/convert/svg-to-geo',
  BasemapConfigController.convertSvgToGeo
);

/**
 * @route   POST /api/basemap-config/:id/convert/geo-to-svg
 * @desc    Mengkonversi koordinat geografis ke SVG
 * @access  Private (All authenticated users)
 */
router.post('/:id/convert/geo-to-svg',
  BasemapConfigController.convertGeoToSvg
);

/**
 * @route   DELETE /api/basemap-config/cleanup/versions
 * @desc    Membersihkan versi basemap lama
 * @access  Private (Admin only)
 */
router.delete('/cleanup/versions',
  requireRole(['ADMIN']),
  BasemapConfigController.cleanupVersions
);

module.exports = router;