/**
 * BasemapConfig.js
 * Model untuk konfigurasi basemap SVG
 * Mengelola SVG data, kalibrasi, dan pengaturan map
 */

const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');

const BasemapConfig = sequelize.define('BasemapConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  svgData: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'svg_data',
    validate: {
      notEmpty: true,
      isSVG(value) {
        if (!value.trim().startsWith('<svg') || !value.trim().endsWith('</svg>')) {
          throw new Error('SVG data must be valid SVG format');
        }
        // Basic security check - no script tags
        if (value.includes('<script') || value.includes('javascript:')) {
          throw new Error('SVG data contains potentially unsafe content');
        }
      }
    }
  },
  calibration: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      isValidCalibration(value) {
        if (!value || typeof value !== 'object') {
          throw new Error('Calibration must be a valid object');
        }
        
        // Validasi control points
        if (!Array.isArray(value.controlPoints) || value.controlPoints.length < 2) {
          throw new Error('Calibration must have at least 2 control points');
        }
        
        // Validasi setiap control point
        for (const point of value.controlPoints) {
          if (!point.svg || !point.geo) {
            throw new Error('Each control point must have svg and geo coordinates');
          }
          if (typeof point.svg.x !== 'number' || typeof point.svg.y !== 'number') {
            throw new Error('SVG coordinates must be numbers');
          }
          if (typeof point.geo.lat !== 'number' || typeof point.geo.lng !== 'number') {
            throw new Error('Geographic coordinates must be numbers');
          }
          if (point.geo.lat < -90 || point.geo.lat > 90) {
            throw new Error('Latitude must be between -90 and 90');
          }
          if (point.geo.lng < -180 || point.geo.lng > 180) {
            throw new Error('Longitude must be between -180 and 180');
          }
        }
        
        // Validasi bounds jika ada
        if (value.bounds) {
          const { north, south, east, west } = value.bounds;
          if (typeof north !== 'number' || typeof south !== 'number' ||
              typeof east !== 'number' || typeof west !== 'number') {
            throw new Error('Bounds must be numbers');
          }
          if (north <= south || east <= west) {
            throw new Error('Invalid bounds values');
          }
        }
      }
    }
  },
  dimensions: {
    type: DataTypes.JSONB,
    allowNull: false,
    validate: {
      isValidDimensions(value) {
        if (!value || typeof value !== 'object') {
          throw new Error('Dimensions must be a valid object');
        }
        if (typeof value.width !== 'number' || typeof value.height !== 'number') {
          throw new Error('Width and height must be numbers');
        }
        if (value.width <= 0 || value.height <= 0) {
          throw new Error('Width and height must be positive numbers');
        }
      }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    field: 'is_active'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    field: 'is_default'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      enableZoom: true,
      enablePan: true,
      minZoom: 0.1,
      maxZoom: 10,
      initialZoom: 1,
      backgroundColor: '#ffffff',
      showGrid: false,
      gridColor: '#cccccc',
      gridSize: 50
    },
    validate: {
      isValidSettings(value) {
        if (value && typeof value === 'object') {
          if (value.minZoom && (typeof value.minZoom !== 'number' || value.minZoom <= 0)) {
            throw new Error('minZoom must be a positive number');
          }
          if (value.maxZoom && (typeof value.maxZoom !== 'number' || value.maxZoom <= 0)) {
            throw new Error('maxZoom must be a positive number');
          }
          if (value.minZoom && value.maxZoom && value.minZoom >= value.maxZoom) {
            throw new Error('minZoom must be less than maxZoom');
          }
          if (value.backgroundColor && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value.backgroundColor)) {
            throw new Error('backgroundColor must be a valid hex color');
          }
        }
      }
    }
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata (file info, upload details, etc.)'
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'file_size',
    comment: 'SVG file size in bytes'
  },
  checksum: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'SVG data checksum for integrity verification'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'created_by'
  },
  updatedBy: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'updated_by'
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  tableName: 'basemap_configs',
  timestamps: true,
  indexes: [
    {
      fields: ['name'],
      unique: true
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['is_default']
    },
    {
      fields: ['version']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    beforeUpdate: (basemap) => {
      basemap.updatedAt = new Date();
    },
    beforeCreate: (basemap) => {
      // Calculate file size
      if (basemap.svgData) {
        basemap.fileSize = Buffer.byteLength(basemap.svgData, 'utf8');
      }
      
      // Generate checksum
      if (basemap.svgData) {
        const crypto = require('crypto');
        basemap.checksum = crypto.createHash('md5').update(basemap.svgData).digest('hex');
      }
    },
    beforeSave: async (basemap) => {
      // Ensure only one default basemap
      if (basemap.isDefault) {
        await BasemapConfig.update(
          { isDefault: false },
          { where: { isDefault: true, id: { [Op.ne]: basemap.id } } }
        );
      }
      
      // Ensure only one active basemap
      if (basemap.isActive) {
        await BasemapConfig.update(
          { isActive: false },
          { where: { isActive: true, id: { [Op.ne]: basemap.id } } }
        );
      }
    }
  }
});

// Instance Methods
BasemapConfig.prototype.activate = function(activatedBy) {
  return this.update({
    isActive: true,
    updatedBy: activatedBy || 'system'
  });
};

BasemapConfig.prototype.deactivate = function() {
  return this.update({
    isActive: false
  });
};

BasemapConfig.prototype.setAsDefault = function() {
  return this.update({
    isDefault: true
  });
};

BasemapConfig.prototype.updateCalibration = function(calibration, updatedBy) {
  return this.update({
    calibration,
    version: this.version + 1,
    updatedBy: updatedBy || 'system'
  });
};

BasemapConfig.prototype.updateSettings = function(settings, updatedBy) {
  return this.update({
    settings: { ...this.settings, ...settings },
    updatedBy: updatedBy || 'system'
  });
};

BasemapConfig.prototype.svgToGeo = function(svgX, svgY) {
  const { controlPoints } = this.calibration;
  
  if (controlPoints.length < 2) {
    throw new Error('Insufficient control points for conversion');
  }
  
  // Simple linear interpolation for 2 points
  if (controlPoints.length === 2) {
    const [p1, p2] = controlPoints;
    
    // Calculate ratios
    const xRatio = (svgX - p1.svg.x) / (p2.svg.x - p1.svg.x);
    const yRatio = (svgY - p1.svg.y) / (p2.svg.y - p1.svg.y);
    
    // Interpolate geographic coordinates
    const lat = p1.geo.lat + (p2.geo.lat - p1.geo.lat) * yRatio;
    const lng = p1.geo.lng + (p2.geo.lng - p1.geo.lng) * xRatio;
    
    return { lat, lng };
  }
  
  // For more than 2 points, use more sophisticated interpolation
  // This is a simplified implementation
  const p1 = controlPoints[0];
  const p2 = controlPoints[1];
  
  const xRatio = (svgX - p1.svg.x) / (p2.svg.x - p1.svg.x);
  const yRatio = (svgY - p1.svg.y) / (p2.svg.y - p1.svg.y);
  
  const lat = p1.geo.lat + (p2.geo.lat - p1.geo.lat) * yRatio;
  const lng = p1.geo.lng + (p2.geo.lng - p1.geo.lng) * xRatio;
  
  return { lat, lng };
};

BasemapConfig.prototype.geoToSvg = function(lat, lng) {
  const { controlPoints } = this.calibration;
  
  if (controlPoints.length < 2) {
    throw new Error('Insufficient control points for conversion');
  }
  
  // Simple linear interpolation for 2 points
  if (controlPoints.length === 2) {
    const [p1, p2] = controlPoints;
    
    // Calculate ratios
    const latRatio = (lat - p1.geo.lat) / (p2.geo.lat - p1.geo.lat);
    const lngRatio = (lng - p1.geo.lng) / (p2.geo.lng - p1.geo.lng);
    
    // Interpolate SVG coordinates
    const x = p1.svg.x + (p2.svg.x - p1.svg.x) * lngRatio;
    const y = p1.svg.y + (p2.svg.y - p1.svg.y) * latRatio;
    
    return { x, y };
  }
  
  // For more than 2 points, use more sophisticated interpolation
  const p1 = controlPoints[0];
  const p2 = controlPoints[1];
  
  const latRatio = (lat - p1.geo.lat) / (p2.geo.lat - p1.geo.lat);
  const lngRatio = (lng - p1.geo.lng) / (p2.geo.lng - p1.geo.lng);
  
  const x = p1.svg.x + (p2.svg.x - p1.svg.x) * lngRatio;
  const y = p1.svg.y + (p2.svg.y - p1.svg.y) * latRatio;
  
  return { x, y };
};

BasemapConfig.prototype.getBounds = function() {
  if (this.calibration && this.calibration.bounds) {
    return this.calibration.bounds;
  }
  
  // Calculate bounds from control points
  if (!this.calibration || !this.calibration.controlPoints || this.calibration.controlPoints.length === 0) {
    return {
      north: 0,
      south: 0,
      east: 0,
      west: 0
    };
  }
  
  const { controlPoints } = this.calibration;
  const lats = controlPoints.map(p => p.geo.lat);
  const lngs = controlPoints.map(p => p.geo.lng);
  
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs)
  };
};

BasemapConfig.prototype.getCenter = function() {
  const bounds = this.getBounds();
  if (!bounds) {
    return { lat: 0, lng: 0 };
  }
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2
  };
};

// Class Methods
BasemapConfig.getActive = function() {
  return this.findOne({
    where: { isActive: true }
  });
};

BasemapConfig.getDefault = function() {
  return this.findOne({
    where: { isDefault: true }
  });
};

BasemapConfig.getAllActive = function() {
  return this.findAll({
    where: { isActive: true },
    order: [['updatedAt', 'DESC']]
  });
};

BasemapConfig.getByName = function(name) {
  return this.findOne({
    where: { name }
  });
};

BasemapConfig.getLatestVersion = function(name) {
  return this.findOne({
    where: { name },
    order: [['version', 'DESC']]
  });
};

BasemapConfig.createVersion = function(basemapId, updates, createdBy) {
  return sequelize.transaction(async (transaction) => {
    const original = await this.findByPk(basemapId, { transaction });
    if (!original) {
      throw new Error('Original basemap not found');
    }
    
    const newVersion = await this.create({
      ...original.toJSON(),
      id: undefined, // Let it generate new UUID
      version: original.version + 1,
      isActive: false,
      isDefault: false,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...updates
    }, { transaction });
    
    return newVersion;
  });
};

BasemapConfig.cleanup = function(keepVersions = 5) {
  return sequelize.transaction(async (transaction) => {
    // Get all basemap names
    const names = await this.findAll({
      attributes: ['name'],
      group: ['name'],
      transaction
    });
    
    for (const { name } of names) {
      // Keep only the latest N versions for each name
      const versions = await this.findAll({
        where: { name },
        order: [['version', 'DESC']],
        transaction
      });
      
      if (versions.length > keepVersions) {
        const toDelete = versions.slice(keepVersions);
        const idsToDelete = toDelete
          .filter(v => !v.isActive && !v.isDefault)
          .map(v => v.id);
        
        if (idsToDelete.length > 0) {
          await this.destroy({
            where: { id: idsToDelete },
            transaction
          });
        }
      }
    }
  });
};

BasemapConfig.validateSVG = function(svgData) {
  // Basic SVG validation
  if (!svgData || typeof svgData !== 'string') {
    return { valid: false, error: 'SVG data must be a string' };
  }
  
  const trimmed = svgData.trim();
  if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>')) {
    return { valid: false, error: 'Invalid SVG format - must start with <svg and end with </svg>' };
  }
  
  // File size validation (max 10MB)
  const sizeInBytes = Buffer.byteLength(trimmed, 'utf8');
  const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
  if (sizeInBytes > maxSizeInBytes) {
    return { valid: false, error: `SVG file too large. Maximum size is ${maxSizeInBytes / (1024 * 1024)}MB` };
  }
  
  // Security checks - Enhanced
  const securityPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick, onload, etc.
    /<iframe[^>]*>/i,
    /<object[^>]*>/i,
    /<embed[^>]*>/i,
    /<link[^>]*>/i,
    /<meta[^>]*>/i,
    /<form[^>]*>/i,
    /<input[^>]*>/i,
    /data:text\/html/i,
    /vbscript:/i,
    /expression\s*\(/i // CSS expressions
  ];
  
  for (const pattern of securityPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'SVG contains potentially unsafe content or scripts' };
    }
  }
  
  // Check for external references
  const externalRefPatterns = [
    /xlink:href\s*=\s*["']https?:/i,
    /href\s*=\s*["']https?:/i,
    /@import\s+url\s*\(\s*["']?https?:/i,
    /url\s*\(\s*["']?https?:/i
  ];
  
  for (const pattern of externalRefPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'SVG contains external references which are not allowed' };
    }
  }
  
  // Validate SVG structure
  try {
    // Check for proper XML structure
    const svgTagMatch = trimmed.match(/<svg[^>]*>/i);
    if (!svgTagMatch) {
      return { valid: false, error: 'Invalid SVG structure - missing svg tag' };
    }
    
    // Check for required attributes
    const svgTag = svgTagMatch[0];
    const hasViewBox = /viewBox\s*=/i.test(svgTag);
    const hasWidth = /width\s*=/i.test(svgTag);
    const hasHeight = /height\s*=/i.test(svgTag);
    
    if (!hasViewBox && (!hasWidth || !hasHeight)) {
      return { valid: false, error: 'SVG must have either viewBox or both width and height attributes' };
    }
    
    // Check for balanced tags (basic check)
    const openTags = (trimmed.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (trimmed.match(/<\/[^>]*>/g) || []).length;
    const selfClosingTags = (trimmed.match(/<[^>]*\/>/g) || []).length;
    
    // Basic balance check (not perfect but catches obvious issues)
    if (openTags - selfClosingTags !== closeTags) {
      return { valid: false, error: 'SVG has unbalanced tags' };
    }
    
  } catch (error) {
    return { valid: false, error: 'SVG structure validation failed: ' + error.message };
  }
  
  // Content validation
  const minContentLength = 50; // Minimum reasonable SVG content
  if (trimmed.length < minContentLength) {
    return { valid: false, error: 'SVG content too short to be valid' };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\beval\s*\(/i,
    /\bsetTimeout\s*\(/i,
    /\bsetInterval\s*\(/i,
    /\bdocument\./i,
    /\bwindow\./i,
    /\balert\s*\(/i
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'SVG contains suspicious JavaScript-like content' };
    }
  }
  
  return { 
    valid: true, 
    metadata: {
      size: sizeInBytes,
      hasViewBox: /viewBox\s*=/i.test(trimmed),
      hasTitle: /<title[^>]*>/i.test(trimmed),
      hasDescription: /<desc[^>]*>/i.test(trimmed)
    }
  };
};

module.exports = BasemapConfig;