/**
 * feature-flag-routes.js
 * Routes untuk Feature Flag API
 */

const express = require('express');
const FeatureFlagController = require('../controllers/FeatureFlagController');
const { verifyToken, requireRole } = require('../middleware/auth-config');
const { trackRequest } = require('../middleware/metrics');

const router = express.Router();

// Middleware untuk semua routes
router.use(trackRequest);
router.use(verifyToken);

// Validation schemas
const createFlagSchema = {
  key: {
    in: ['body'],
    matches: {
      options: [/^[a-zA-Z0-9_-]+$/],
      errorMessage: 'Key can only contain letters, numbers, underscores, and hyphens'
    },
    isLength: {
      options: { min: 1, max: 100 },
      errorMessage: 'Key must be between 1 and 100 characters'
    },
    trim: true
  },
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
  type: {
    in: ['body'],
    isIn: {
      options: [['BOOLEAN', 'STRING', 'NUMBER', 'JSON']],
      errorMessage: 'Invalid flag type'
    }
  },
  environment: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['development', 'staging', 'production', 'all']],
      errorMessage: 'Invalid environment'
    }
  },
  category: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 100 },
      errorMessage: 'Category must not exceed 100 characters'
    },
    trim: true
  },
  rolloutPercentage: {
    in: ['body'],
    optional: true,
    isFloat: {
      options: { min: 0, max: 100 },
      errorMessage: 'Rollout percentage must be between 0 and 100'
    }
  },
  isPermanent: {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'isPermanent must be a boolean'
    }
  }
};

const updateFlagSchema = {
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
  type: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['BOOLEAN', 'STRING', 'NUMBER', 'JSON']],
      errorMessage: 'Invalid flag type'
    }
  },
  environment: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['development', 'staging', 'production', 'all']],
      errorMessage: 'Invalid environment'
    }
  },
  category: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 100 },
      errorMessage: 'Category must not exceed 100 characters'
    },
    trim: true
  },
  rolloutPercentage: {
    in: ['body'],
    optional: true,
    isFloat: {
      options: { min: 0, max: 100 },
      errorMessage: 'Rollout percentage must be between 0 and 100'
    }
  },
  isPermanent: {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'isPermanent must be a boolean'
    }
  }
};

const evaluateFlagSchema = {
  key: {
    in: ['body'],
    isLength: {
      options: { min: 1, max: 100 },
      errorMessage: 'Key must be between 1 and 100 characters'
    },
    trim: true
  },
  context: {
    in: ['body'],
    optional: true,
    isObject: {
      errorMessage: 'Context must be an object'
    }
  }
};

const bulkEvaluateSchema = {
  keys: {
    in: ['body'],
    isArray: {
      options: { min: 1, max: 50 },
      errorMessage: 'Keys must be an array with 1-50 items'
    }
  },
  'keys.*': {
    isLength: {
      options: { min: 1, max: 100 },
      errorMessage: 'Each key must be between 1 and 100 characters'
    }
  },
  context: {
    in: ['body'],
    optional: true,
    isObject: {
      errorMessage: 'Context must be an object'
    }
  }
};

const cleanupExpiredSchema = {
  dryRun: {
    in: ['body'],
    optional: true,
    isBoolean: {
      errorMessage: 'dryRun must be a boolean'
    }
  }
};

// Routes

/**
 * @route   POST /api/feature-flags
 * @desc    Membuat feature flag baru
 * @access  Private (Admin only)
 */
router.post('/',
  requireRole(['ADMIN']),
  FeatureFlagController.createFlag
);

/**
 * @route   GET /api/feature-flags
 * @desc    Mendapatkan daftar feature flags
 * @access  Private (Admin, Operator)
 */
router.get('/',
  requireRole(['ADMIN', 'OPERATOR']),
  FeatureFlagController.getFlags
);

/**
 * @route   GET /api/feature-flags/stats
 * @desc    Mendapatkan statistik feature flags
 * @access  Private (Admin, Operator)
 */
router.get('/stats',
  requireRole(['ADMIN', 'OPERATOR']),
  FeatureFlagController.getStats
);

/**
 * @route   GET /api/feature-flags/expiring
 * @desc    Mendapatkan feature flags yang akan kadaluarsa
 * @access  Private (Admin, Operator)
 */
router.get('/expiring',
  requireRole(['ADMIN', 'OPERATOR']),
  FeatureFlagController.getExpiring
);

/**
 * @route   GET /api/feature-flags/:identifier
 * @desc    Mendapatkan detail feature flag berdasarkan ID atau key
 * @access  Private (Admin, Operator)
 */
router.get('/:identifier',
  requireRole(['ADMIN', 'OPERATOR']),
  FeatureFlagController.getFlagById
);

/**
 * @route   PUT /api/feature-flags/:id
 * @desc    Update feature flag
 * @access  Private (Admin only)
 */
router.put('/:id',
  requireRole(['ADMIN']),
  FeatureFlagController.updateFlag
);

/**
 * @route   DELETE /api/feature-flags/:id
 * @desc    Hapus feature flag
 * @access  Private (Admin only)
 */
router.delete('/:id',
  requireRole(['ADMIN']),
  FeatureFlagController.deleteFlag
);

/**
 * @route   PATCH /api/feature-flags/:id/toggle
 * @desc    Toggle feature flag (enable/disable)
 * @access  Private (Admin, Operator)
 */
router.patch('/:id/toggle',
  requireRole(['ADMIN', 'OPERATOR']),
  FeatureFlagController.toggleFlag
);

/**
 * @route   PATCH /api/feature-flags/:id/archive
 * @desc    Archive/unarchive feature flag
 * @access  Private (Admin only)
 */
router.patch('/:id/archive',
  requireRole(['ADMIN']),
  FeatureFlagController.archiveFlag
);

/**
 * @route   POST /api/feature-flags/evaluate
 * @desc    Evaluate single feature flag
 * @access  Private (All authenticated users)
 */
router.post('/evaluate',
  FeatureFlagController.evaluateFlag
);

/**
 * @route   POST /api/feature-flags/evaluate/bulk
 * @desc    Evaluate multiple feature flags
 * @access  Private (All authenticated users)
 */
router.post('/evaluate/bulk',
  FeatureFlagController.bulkEvaluate
);

/**
 * @route   DELETE /api/feature-flags/cleanup/expired
 * @desc    Cleanup feature flags yang expired
 * @access  Private (Admin only)
 */
router.delete('/cleanup/expired',
  requireRole(['ADMIN']),
  FeatureFlagController.cleanupExpired
);

module.exports = router;