/**
 * map-pin-routes.js
 * Routes untuk Map Pin API
 */

const express = require('express');
const MapPinController = require('../controllers/MapPinController');
const { verifyToken, requireRole } = require('../middleware/auth-config');
const { trackRequest } = require('../middleware/metrics');

const router = express.Router();

// Middleware untuk semua routes
router.use(trackRequest);
router.use(verifyToken);

// Validation schemas
const createPinSchema = {
  type: {
    in: ['body'],
    isIn: {
      options: [[
        'ALERT', 'INCIDENT', 'TEAM_MEMBER', 'CAMERA', 'GEOFENCE',
        'CHECKPOINT', 'LANDMARK', 'HAZARD', 'RESOURCE', 'CUSTOM'
      ]],
      errorMessage: 'Invalid pin type'
    }
  },
  'coordinates.latitude': {
    in: ['body'],
    isFloat: {
      options: { min: -90, max: 90 },
      errorMessage: 'Latitude must be between -90 and 90'
    }
  },
  'coordinates.longitude': {
    in: ['body'],
    isFloat: {
      options: { min: -180, max: 180 },
      errorMessage: 'Longitude must be between -180 and 180'
    }
  },
  title: {
    in: ['body'],
    isLength: {
      options: { min: 1, max: 255 },
      errorMessage: 'Title must be between 1 and 255 characters'
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
  status: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['ACTIVE', 'INACTIVE', 'ARCHIVED']],
      errorMessage: 'Invalid status'
    }
  },
  priority: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']],
      errorMessage: 'Invalid priority'
    }
  },
  size: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['SMALL', 'MEDIUM', 'LARGE']],
      errorMessage: 'Invalid size'
    }
  },
  isVisible: {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'isVisible must be a boolean'
    }
  },
  isClickable: {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'isClickable must be a boolean'
    }
  }
};

const updatePinSchema = {
  'coordinates.latitude': {
    in: ['body'],
    optional: true,
    isFloat: {
      options: { min: -90, max: 90 },
      errorMessage: 'Latitude must be between -90 and 90'
    }
  },
  'coordinates.longitude': {
    in: ['body'],
    optional: true,
    isFloat: {
      options: { min: -180, max: 180 },
      errorMessage: 'Longitude must be between -180 and 180'
    }
  },
  title: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { min: 1, max: 255 },
      errorMessage: 'Title must be between 1 and 255 characters'
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
  status: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['ACTIVE', 'INACTIVE', 'ARCHIVED']],
      errorMessage: 'Invalid status'
    }
  },
  priority: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']],
      errorMessage: 'Invalid priority'
    }
  },
  size: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['SMALL', 'MEDIUM', 'LARGE']],
      errorMessage: 'Invalid size'
    }
  },
  isVisible: {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'isVisible must be a boolean'
    }
  },
  isClickable: {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'isClickable must be a boolean'
    }
  }
};

const radiusQuerySchema = {
  latitude: {
    in: ['query'],
    isFloat: {
      options: { min: -90, max: 90 },
      errorMessage: 'Latitude must be between -90 and 90'
    }
  },
  longitude: {
    in: ['query'],
    isFloat: {
      options: { min: -180, max: 180 },
      errorMessage: 'Longitude must be between -180 and 180'
    }
  },
  radius: {
    in: ['query'],
    isFloat: {
      options: { min: 0.1, max: 1000 },
      errorMessage: 'Radius must be between 0.1 and 1000 km'
    }
  }
};

const bulkUpdateSchema = {
  ids: {
    in: ['body'],
    isArray: {
      options: { min: 1 },
      errorMessage: 'IDs must be a non-empty array'
    }
  },
  'ids.*': {
    isUUID: {
      errorMessage: 'Each ID must be a valid UUID'
    }
  },
  updates: {
    in: ['body'],
    isObject: {
      errorMessage: 'Updates must be an object'
    }
  }
};

// Routes

/**
 * @route   POST /api/map-pins
 * @desc    Membuat map pin baru
 * @access  Private (Admin, Operator)
 */
router.post('/',
  requireRole(['ADMIN', 'SUPERVISOR']),
  MapPinController.createPin
);

/**
 * @route   GET /api/map-pins
 * @desc    Mendapatkan daftar map pins
 * @access  Private (All authenticated users)
 */
router.get('/',

  MapPinController.getPins
);

/**
 * @route   GET /api/map-pins/stats
 * @desc    Mendapatkan statistik map pins
 * @access  Private (Admin, Operator)
 */
router.get('/stats',
  requireRole(['ADMIN', 'SUPERVISOR']),
  MapPinController.getStats
);

/**
 * @route   GET /api/map-pins/radius
 * @desc    Mendapatkan pins dalam radius tertentu
 * @access  Private (All authenticated users)
 */
router.get('/radius',

  MapPinController.getPinsInRadius
);

/**
 * @route   GET /api/map-pins/:id
 * @desc    Mendapatkan detail map pin berdasarkan ID
 * @access  Private (All authenticated users)
 */
router.get('/:id',

  MapPinController.getPinById
);

/**
 * @route   PUT /api/map-pins/:id
 * @desc    Update map pin
 * @access  Private (Admin, Operator)
 */
router.put('/:id',
  requireRole(['ADMIN', 'SUPERVISOR']),
  MapPinController.updatePin
);

/**
 * @route   DELETE /api/map-pins/:id
 * @desc    Hapus map pin
 * @access  Private (Admin, Operator)
 */
router.delete('/:id',
  requireRole(['ADMIN', 'SUPERVISOR']),
  MapPinController.deletePin
);

/**
 * @route   PATCH /api/map-pins/:id/visibility
 * @desc    Toggle visibility map pin
 * @access  Private (Admin, Operator)
 */
router.patch('/:id/visibility',
  requireRole(['ADMIN', 'SUPERVISOR']),
  MapPinController.toggleVisibility
);

/**
 * @route   PUT /api/map-pins/bulk
 * @desc    Bulk update map pins
 * @access  Private (Admin, Operator)
 */
router.put('/bulk',
  requireRole(['ADMIN', 'SUPERVISOR']),
  MapPinController.bulkUpdate
);

/**
 * @route   POST /api/map-pins/sync
 * @desc    Sync pins dari entitas lain
 * @access  Private (Admin, Operator)
 */
router.post('/sync',
  requireRole(['ADMIN', 'SUPERVISOR']),
  MapPinController.syncPins
);

/**
 * @route   DELETE /api/map-pins/cleanup/expired
 * @desc    Cleanup pins yang expired
 * @access  Private (Admin only)
 */
router.delete('/cleanup/expired',
  requireRole(['ADMIN']),
  MapPinController.cleanupExpired
);

module.exports = router;