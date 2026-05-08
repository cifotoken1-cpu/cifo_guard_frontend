/**
 * FeatureFlag.js
 * Model untuk feature flags
 * Mengelola fitur yang dapat diaktifkan/dinonaktifkan secara dinamis
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FeatureFlag = sequelize.define('FeatureFlag', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 100],
      is: /^[a-zA-Z0-9_.-]+$/ // Only alphanumeric, underscore, dot, dash
    },
    comment: 'Unique identifier for the feature flag'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 200]
    },
    comment: 'Human-readable name for the feature flag'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Description of what this feature flag controls'
  },
  isEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    field: 'is_enabled',
    comment: 'Whether the feature flag is currently enabled'
  },
  type: {
    type: DataTypes.ENUM,
    values: ['BOOLEAN', 'STRING', 'NUMBER', 'JSON'],
    defaultValue: 'BOOLEAN',
    allowNull: false,
    comment: 'Type of value this feature flag holds'
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'The actual value of the feature flag (stored as string)'
  },
  defaultValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'default_value',
    comment: 'Default value when flag is disabled or not found'
  },
  environment: {
    type: DataTypes.ENUM,
    values: ['ALL', 'DEVELOPMENT', 'STAGING', 'PRODUCTION'],
    defaultValue: 'ALL',
    allowNull: false,
    comment: 'Environment where this flag is applicable'
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: [0, 50]
    },
    comment: 'Category for organizing feature flags'
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    validate: {
      isArray(value) {
        if (value && !Array.isArray(value)) {
          throw new Error('Tags must be an array');
        }
      }
    },
    comment: 'Tags for categorizing and filtering flags'
  },
  conditions: {
    type: DataTypes.JSONB,
    defaultValue: {},
    validate: {
      isValidConditions(value) {
        if (value && typeof value !== 'object') {
          throw new Error('Conditions must be an object');
        }
        
        // Validate condition structure
        if (value && value.rules) {
          if (!Array.isArray(value.rules)) {
            throw new Error('Conditions rules must be an array');
          }
          
          for (const rule of value.rules) {
            if (!rule.field || !rule.operator || rule.value === undefined) {
              throw new Error('Each rule must have field, operator, and value');
            }
            
            const validOperators = ['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in', 'greater_than', 'less_than', 'regex'];
            if (!validOperators.includes(rule.operator)) {
              throw new Error(`Invalid operator: ${rule.operator}`);
            }
          }
        }
      }
    },
    comment: 'Conditions for when this flag should be enabled'
  },
  rolloutPercentage: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    allowNull: false,
    field: 'rollout_percentage',
    validate: {
      min: 0,
      max: 100
    },
    comment: 'Percentage of users/requests that should see this flag enabled'
  },
  userSegments: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'user_segments',
    validate: {
      isArray(value) {
        if (value && !Array.isArray(value)) {
          throw new Error('User segments must be an array');
        }
      }
    },
    comment: 'User segments that should see this flag'
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    field: 'is_archived',
    comment: 'Whether this flag is archived (hidden from active use)'
  },
  isPermanent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    field: 'is_permanent',
    comment: 'Whether this flag is permanent (cannot be deleted)'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at',
    comment: 'When this flag should automatically be disabled'
  },
  lastEvaluatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_evaluated_at',
    comment: 'When this flag was last evaluated'
  },
  evaluationCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    field: 'evaluation_count',
    comment: 'Number of times this flag has been evaluated'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata for the feature flag'
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'created_by',
    comment: 'User who created this flag'
  },
  updatedBy: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'updated_by',
    comment: 'User who last updated this flag'
  },
  enabledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'enabled_at',
    comment: 'When this flag was last enabled'
  },
  enabledBy: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'enabled_by',
    comment: 'User who last enabled this flag'
  },
  disabledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'disabled_at',
    comment: 'When this flag was last disabled'
  },
  disabledBy: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'disabled_by',
    comment: 'User who last disabled this flag'
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
  tableName: 'feature_flags',
  timestamps: true,
  indexes: [
    {
      fields: ['key'],
      unique: true
    },
    {
      fields: ['isEnabled']
    },
    {
      fields: ['environment']
    },
    {
      fields: ['category']
    },
    {
      fields: ['isArchived']
    },
    {
      fields: ['expiresAt']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['lastEvaluatedAt']
    }
  ],
  hooks: {
    beforeUpdate: (flag) => {
      flag.updatedAt = new Date();
      
      // Track enable/disable events
      if (flag.changed('isEnabled')) {
        if (flag.isEnabled) {
          flag.enabledAt = new Date();
          flag.disabledAt = null;
          flag.disabledBy = null;
        } else {
          flag.disabledAt = new Date();
          flag.enabledAt = null;
          flag.enabledBy = null;
        }
      }
    },
    beforeCreate: (flag) => {
      // Set initial enable/disable timestamps
      if (flag.isEnabled) {
        flag.enabledAt = new Date();
      } else {
        flag.disabledAt = new Date();
      }
    }
  }
});

// Instance Methods
FeatureFlag.prototype.enable = function(enabledBy) {
  return this.update({
    isEnabled: true,
    enabledAt: new Date(),
    enabledBy: enabledBy || 'system',
    disabledAt: null,
    disabledBy: null
  });
};

FeatureFlag.prototype.disable = function(disabledBy) {
  return this.update({
    isEnabled: false,
    disabledAt: new Date(),
    disabledBy: disabledBy || 'system',
    enabledAt: null,
    enabledBy: null
  });
};

FeatureFlag.prototype.toggle = function(toggledBy) {
  if (this.isEnabled) {
    return this.disable(toggledBy);
  } else {
    return this.enable(toggledBy);
  }
};

FeatureFlag.prototype.archive = function(archivedBy) {
  return this.update({
    isArchived: true,
    isEnabled: false,
    updatedBy: archivedBy || 'system'
  });
};

FeatureFlag.prototype.unarchive = function(unarchivedBy) {
  return this.update({
    isArchived: false,
    updatedBy: unarchivedBy || 'system'
  });
};

FeatureFlag.prototype.getValue = function() {
  if (!this.isEnabled) {
    return this.getDefaultValue();
  }
  
  switch (this.type) {
    case 'BOOLEAN':
      return this.value === 'true' || this.value === true;
    case 'NUMBER':
      return parseFloat(this.value) || 0;
    case 'JSON':
      try {
        return JSON.parse(this.value || '{}');
      } catch (e) {
        return {};
      }
    case 'STRING':
    default:
      return this.value || '';
  }
};

FeatureFlag.prototype.getDefaultValue = function() {
  if (!this.defaultValue) {
    switch (this.type) {
      case 'BOOLEAN':
        return false;
      case 'NUMBER':
        return 0;
      case 'JSON':
        return {};
      case 'STRING':
      default:
        return '';
    }
  }
  
  switch (this.type) {
    case 'BOOLEAN':
      return this.defaultValue === 'true' || this.defaultValue === true;
    case 'NUMBER':
      return parseFloat(this.defaultValue) || 0;
    case 'JSON':
      try {
        return JSON.parse(this.defaultValue);
      } catch (e) {
        return {};
      }
    case 'STRING':
    default:
      return this.defaultValue;
  }
};

FeatureFlag.prototype.setValue = function(value, updatedBy) {
  let stringValue;
  
  switch (this.type) {
    case 'BOOLEAN':
      stringValue = Boolean(value).toString();
      break;
    case 'NUMBER':
      stringValue = Number(value).toString();
      break;
    case 'JSON':
      stringValue = JSON.stringify(value);
      break;
    case 'STRING':
    default:
      stringValue = String(value);
      break;
  }
  
  return this.update({
    value: stringValue,
    updatedBy: updatedBy || 'system'
  });
};

FeatureFlag.prototype.evaluate = function(context = {}) {
  // Update evaluation stats
  this.increment('evaluationCount');
  this.update({ lastEvaluatedAt: new Date() });
  
  // Check if expired
  if (this.expiresAt && new Date() > this.expiresAt) {
    return this.getDefaultValue();
  }
  
  // Check if archived
  if (this.isArchived) {
    return this.getDefaultValue();
  }
  
  // Check environment
  if (this.environment !== 'ALL') {
    const currentEnv = process.env.NODE_ENV || 'development';
    if (this.environment.toLowerCase() !== currentEnv.toLowerCase()) {
      return this.getDefaultValue();
    }
  }
  
  // Check rollout percentage
  if (this.rolloutPercentage < 100) {
    const hash = this.generateHash(context.userId || context.sessionId || 'anonymous');
    const percentage = hash % 100;
    if (percentage >= this.rolloutPercentage) {
      return this.getDefaultValue();
    }
  }
  
  // Check user segments
  if (this.userSegments.length > 0 && context.userSegments) {
    const hasMatchingSegment = this.userSegments.some(segment => 
      context.userSegments.includes(segment)
    );
    if (!hasMatchingSegment) {
      return this.getDefaultValue();
    }
  }
  
  // Check conditions
  if (this.conditions.rules && this.conditions.rules.length > 0) {
    const conditionsMet = this.evaluateConditions(context);
    if (!conditionsMet) {
      return this.getDefaultValue();
    }
  }
  
  return this.getValue();
};

FeatureFlag.prototype.evaluateConditions = function(context) {
  const { rules, operator = 'AND' } = this.conditions;
  
  if (!rules || rules.length === 0) {
    return true;
  }
  
  const results = rules.map(rule => this.evaluateRule(rule, context));
  
  if (operator === 'OR') {
    return results.some(result => result);
  } else {
    return results.every(result => result);
  }
};

FeatureFlag.prototype.evaluateRule = function(rule, context) {
  const { field, operator, value } = rule;
  const contextValue = this.getNestedValue(context, field);
  
  switch (operator) {
    case 'equals':
      return contextValue === value;
    case 'not_equals':
      return contextValue !== value;
    case 'contains':
      return String(contextValue).includes(String(value));
    case 'not_contains':
      return !String(contextValue).includes(String(value));
    case 'in':
      return Array.isArray(value) && value.includes(contextValue);
    case 'not_in':
      return Array.isArray(value) && !value.includes(contextValue);
    case 'greater_than':
      return Number(contextValue) > Number(value);
    case 'less_than':
      return Number(contextValue) < Number(value);
    case 'regex':
      try {
        const regex = new RegExp(value);
        return regex.test(String(contextValue));
      } catch (e) {
        return false;
      }
    default:
      return false;
  }
};

FeatureFlag.prototype.getNestedValue = function(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

FeatureFlag.prototype.generateHash = function(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

FeatureFlag.prototype.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

FeatureFlag.prototype.getDaysUntilExpiry = function() {
  if (!this.expiresAt) {
    return null;
  }
  
  const now = new Date();
  const expiry = new Date(this.expiresAt);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Class Methods
FeatureFlag.getByKey = function(key) {
  return this.findOne({
    where: { key, isArchived: false }
  });
};

FeatureFlag.getEnabled = function() {
  return this.findAll({
    where: { 
      isEnabled: true, 
      isArchived: false 
    },
    order: [['name', 'ASC']]
  });
};

FeatureFlag.getByCategory = function(category) {
  return this.findAll({
    where: { 
      category, 
      isArchived: false 
    },
    order: [['name', 'ASC']]
  });
};

FeatureFlag.getByEnvironment = function(environment) {
  return this.findAll({
    where: { 
      environment: [environment, 'ALL'],
      isArchived: false 
    },
    order: [['name', 'ASC']]
  });
};

FeatureFlag.getExpiring = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.findAll({
    where: {
      expiresAt: {
        [sequelize.Op.lte]: futureDate,
        [sequelize.Op.gte]: new Date()
      },
      isArchived: false
    },
    order: [['expiresAt', 'ASC']]
  });
};

FeatureFlag.getExpired = function() {
  return this.findAll({
    where: {
      expiresAt: {
        [sequelize.Op.lt]: new Date()
      },
      isArchived: false
    },
    order: [['expiresAt', 'DESC']]
  });
};

FeatureFlag.cleanupExpired = function() {
  return this.update(
    { 
      isEnabled: false,
      disabledAt: new Date(),
      disabledBy: 'system-cleanup'
    },
    {
      where: {
        expiresAt: {
          [sequelize.Op.lt]: new Date()
        },
        isEnabled: true
      }
    }
  );
};

FeatureFlag.bulkEvaluate = function(keys, context = {}) {
  return sequelize.transaction(async (transaction) => {
    const flags = await this.findAll({
      where: {
        key: keys,
        isArchived: false
      },
      transaction
    });
    
    const results = {};
    
    for (const flag of flags) {
      results[flag.key] = flag.evaluate(context);
    }
    
    // Add default values for missing flags
    for (const key of keys) {
      if (!(key in results)) {
        results[key] = false; // Default fallback
      }
    }
    
    return results;
  });
};

FeatureFlag.getStats = function() {
  return sequelize.transaction(async (transaction) => {
    const total = await this.count({ 
      where: { isArchived: false },
      transaction 
    });
    
    const enabled = await this.count({ 
      where: { isEnabled: true, isArchived: false },
      transaction 
    });
    
    const expired = await this.count({ 
      where: { 
        expiresAt: { [sequelize.Op.lt]: new Date() },
        isArchived: false 
      },
      transaction 
    });
    
    const categories = await this.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { isArchived: false },
      group: ['category'],
      transaction
    });
    
    return {
      total,
      enabled,
      disabled: total - enabled,
      expired,
      categories: categories.map(c => ({
        category: c.category || 'uncategorized',
        count: parseInt(c.dataValues.count)
      }))
    };
  });
};

module.exports = FeatureFlag;