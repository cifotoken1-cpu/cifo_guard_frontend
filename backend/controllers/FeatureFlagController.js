/**
 * FeatureFlagController.js
 * Controller untuk mengelola feature flags
 */

const FeatureFlag = require('../models/FeatureFlag');
const ActivityLogger = require('../services/ActivityLogger');
const WebSocketService = require('../services/WebSocketService');
const { Op } = require('sequelize');

class FeatureFlagController {
  /**
   * Membuat feature flag baru
   */
  static async createFlag(req, res) {
    try {
      const {
        key,
        name,
        description,
        type = 'BOOLEAN',
        value,
        defaultValue,
        environment = 'ALL',
        category,
        tags = [],
        conditions = {},
        rolloutPercentage = 100,
        userSegments = [],
        expiresAt,
        metadata = {}
      } = req.body;
      
      const userId = req.user?.id || 'system';
      
      // Validasi input
      if (!key || !name) {
        return res.status(400).json({
          success: false,
          message: 'Key and name are required',
          timestamp: new Date().toISOString()
        });
      }
      
      // Cek apakah key sudah ada
      const existingFlag = await FeatureFlag.getByKey(key);
      if (existingFlag) {
        return res.status(409).json({
          success: false,
          message: 'Feature flag with this key already exists',
          timestamp: new Date().toISOString()
        });
      }
      
      // Buat feature flag baru
      const flag = await FeatureFlag.create({
        key,
        name,
        description,
        type,
        value,
        defaultValue,
        environment,
        category,
        tags,
        conditions,
        rolloutPercentage,
        userSegments,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata,
        createdBy: userId
      });
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'CREATE_FEATURE_FLAG',
        resource: 'feature_flag',
        resourceId: flag.id,
        details: {
          key: flag.key,
          name: flag.name,
          type: flag.type,
          environment: flag.environment
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('feature_flag:created', {
        id: flag.id,
        key: flag.key,
        name: flag.name,
        isEnabled: flag.isEnabled,
        createdBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json({
        success: true,
        message: 'Feature flag created successfully',
        data: {
          id: flag.id,
          key: flag.key,
          name: flag.name,
          description: flag.description,
          type: flag.type,
          isEnabled: flag.isEnabled,
          environment: flag.environment,
          category: flag.category,
          rolloutPercentage: flag.rolloutPercentage,
          createdAt: flag.createdAt,
          createdBy: flag.createdBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error creating feature flag:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create feature flag',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan daftar feature flags
   */
  static async getFlags(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        isEnabled,
        environment,
        category,
        isArchived = 'false',
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const whereClause = {
        isArchived: isArchived === 'true'
      };
      
      // Filter berdasarkan pencarian
      if (search) {
        whereClause[Op.or] = [
          { key: { [Op.iLike]: `%${search}%` } },
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      // Filter berdasarkan status
      if (isEnabled !== undefined) {
        whereClause.isEnabled = isEnabled === 'true';
      }
      
      // Filter berdasarkan environment
      if (environment) {
        whereClause.environment = [environment, 'ALL'];
      }
      
      // Filter berdasarkan kategori
      if (category) {
        whereClause.category = category;
      }
      
      const { count, rows: flags } = await FeatureFlag.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]]
      });
      
      res.json({
        success: true,
        data: {
          flags: flags.map(flag => ({
            id: flag.id,
            key: flag.key,
            name: flag.name,
            description: flag.description,
            type: flag.type,
            isEnabled: flag.isEnabled,
            environment: flag.environment,
            category: flag.category,
            tags: flag.tags,
            rolloutPercentage: flag.rolloutPercentage,
            isArchived: flag.isArchived,
            isPermanent: flag.isPermanent,
            expiresAt: flag.expiresAt,
            lastEvaluatedAt: flag.lastEvaluatedAt,
            evaluationCount: flag.evaluationCount,
            createdAt: flag.createdAt,
            updatedAt: flag.updatedAt,
            createdBy: flag.createdBy,
            enabledAt: flag.enabledAt,
            enabledBy: flag.enabledBy
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit)),
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch feature flags',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan detail feature flag berdasarkan ID atau key
   */
  static async getFlagById(req, res) {
    try {
      const { id } = req.params;
      
      let flag;
      // Cek apakah ID adalah UUID atau key
      if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        flag = await FeatureFlag.findByPk(id);
      } else {
        flag = await FeatureFlag.getByKey(id);
      }
      
      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Feature flag not found',
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: {
          id: flag.id,
          key: flag.key,
          name: flag.name,
          description: flag.description,
          type: flag.type,
          value: flag.value,
          defaultValue: flag.defaultValue,
          isEnabled: flag.isEnabled,
          environment: flag.environment,
          category: flag.category,
          tags: flag.tags,
          conditions: flag.conditions,
          rolloutPercentage: flag.rolloutPercentage,
          userSegments: flag.userSegments,
          isArchived: flag.isArchived,
          isPermanent: flag.isPermanent,
          expiresAt: flag.expiresAt,
          lastEvaluatedAt: flag.lastEvaluatedAt,
          evaluationCount: flag.evaluationCount,
          metadata: flag.metadata,
          createdAt: flag.createdAt,
          updatedAt: flag.updatedAt,
          createdBy: flag.createdBy,
          updatedBy: flag.updatedBy,
          enabledAt: flag.enabledAt,
          enabledBy: flag.enabledBy,
          disabledAt: flag.disabledAt,
          disabledBy: flag.disabledBy,
          isExpired: flag.isExpired(),
          daysUntilExpiry: flag.getDaysUntilExpiry()
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching feature flag:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch feature flag',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Update feature flag
   */
  static async updateFlag(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        value,
        defaultValue,
        environment,
        category,
        tags,
        conditions,
        rolloutPercentage,
        userSegments,
        expiresAt,
        metadata
      } = req.body;
      
      const userId = req.user?.id || 'system';
      
      let flag;
      if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        flag = await FeatureFlag.findByPk(id);
      } else {
        flag = await FeatureFlag.getByKey(id);
      }
      
      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Feature flag not found',
          timestamp: new Date().toISOString()
        });
      }
      
      const updateData = {
        updatedBy: userId
      };
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (value !== undefined) updateData.value = value;
      if (defaultValue !== undefined) updateData.defaultValue = defaultValue;
      if (environment !== undefined) updateData.environment = environment;
      if (category !== undefined) updateData.category = category;
      if (tags !== undefined) updateData.tags = tags;
      if (conditions !== undefined) updateData.conditions = conditions;
      if (rolloutPercentage !== undefined) updateData.rolloutPercentage = rolloutPercentage;
      if (userSegments !== undefined) updateData.userSegments = userSegments;
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
      if (metadata !== undefined) updateData.metadata = { ...flag.metadata, ...metadata };
      
      await flag.update(updateData);
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'UPDATE_FEATURE_FLAG',
        resource: 'feature_flag',
        resourceId: flag.id,
        details: {
          key: flag.key,
          name: flag.name,
          changes: Object.keys(updateData).filter(key => key !== 'updatedBy')
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('feature_flag:updated', {
        id: flag.id,
        key: flag.key,
        name: flag.name,
        updatedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Feature flag updated successfully',
        data: {
          id: flag.id,
          key: flag.key,
          name: flag.name,
          description: flag.description,
          type: flag.type,
          isEnabled: flag.isEnabled,
          environment: flag.environment,
          category: flag.category,
          rolloutPercentage: flag.rolloutPercentage,
          updatedAt: flag.updatedAt,
          updatedBy: flag.updatedBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error updating feature flag:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update feature flag',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Hapus feature flag
   */
  static async deleteFlag(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';
      
      let flag;
      if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        flag = await FeatureFlag.findByPk(id);
      } else {
        flag = await FeatureFlag.getByKey(id);
      }
      
      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Feature flag not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Cek apakah flag permanent
      if (flag.isPermanent) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete permanent feature flag',
          timestamp: new Date().toISOString()
        });
      }
      
      const flagKey = flag.key;
      const flagName = flag.name;
      await flag.destroy();
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'DELETE_FEATURE_FLAG',
        resource: 'feature_flag',
        resourceId: id,
        details: {
          key: flagKey,
          name: flagName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('feature_flag:deleted', {
        id,
        key: flagKey,
        name: flagName,
        deletedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Feature flag deleted successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error deleting feature flag:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete feature flag',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Toggle feature flag (enable/disable)
   */
  static async toggleFlag(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';
      
      let flag;
      if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        flag = await FeatureFlag.findByPk(id);
      } else {
        flag = await FeatureFlag.getByKey(id);
      }
      
      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Feature flag not found',
          timestamp: new Date().toISOString()
        });
      }
      
      await flag.toggle(userId);
      
      const action = flag.isEnabled ? 'ENABLE_FEATURE_FLAG' : 'DISABLE_FEATURE_FLAG';
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action,
        resource: 'feature_flag',
        resourceId: flag.id,
        details: {
          key: flag.key,
          name: flag.name,
          isEnabled: flag.isEnabled
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('feature_flag:toggled', {
        id: flag.id,
        key: flag.key,
        name: flag.name,
        isEnabled: flag.isEnabled,
        toggledBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: `Feature flag ${flag.isEnabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          id: flag.id,
          key: flag.key,
          name: flag.name,
          isEnabled: flag.isEnabled,
          enabledAt: flag.enabledAt,
          enabledBy: flag.enabledBy,
          disabledAt: flag.disabledAt,
          disabledBy: flag.disabledBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error toggling feature flag:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle feature flag',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Evaluasi feature flag
   */
  static async evaluateFlag(req, res) {
    try {
      const { key } = req.params;
      const context = req.body || {};
      
      const flag = await FeatureFlag.getByKey(key);
      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Feature flag not found',
          timestamp: new Date().toISOString()
        });
      }
      
      const value = flag.evaluate(context);
      
      res.json({
        success: true,
        data: {
          key: flag.key,
          value,
          type: flag.type,
          evaluatedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error evaluating feature flag:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate feature flag',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Bulk evaluasi feature flags
   */
  static async bulkEvaluate(req, res) {
    try {
      const { keys, context = {} } = req.body;
      
      if (!Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Keys must be a non-empty array',
          timestamp: new Date().toISOString()
        });
      }
      
      const results = await FeatureFlag.bulkEvaluate(keys, context);
      
      res.json({
        success: true,
        data: {
          flags: results,
          evaluatedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error bulk evaluating feature flags:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk evaluate feature flags',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Archive/unarchive feature flag
   */
  static async archiveFlag(req, res) {
    try {
      const { id } = req.params;
      const { archive = true } = req.body;
      const userId = req.user?.id || 'system';
      
      let flag;
      if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        flag = await FeatureFlag.findByPk(id);
      } else {
        flag = await FeatureFlag.getByKey(id);
      }
      
      if (!flag) {
        return res.status(404).json({
          success: false,
          message: 'Feature flag not found',
          timestamp: new Date().toISOString()
        });
      }
      
      if (archive) {
        await flag.archive(userId);
      } else {
        await flag.unarchive(userId);
      }
      
      const action = archive ? 'ARCHIVE_FEATURE_FLAG' : 'UNARCHIVE_FEATURE_FLAG';
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action,
        resource: 'feature_flag',
        resourceId: flag.id,
        details: {
          key: flag.key,
          name: flag.name,
          isArchived: flag.isArchived
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('feature_flag:archived', {
        id: flag.id,
        key: flag.key,
        name: flag.name,
        isArchived: flag.isArchived,
        archivedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: `Feature flag ${archive ? 'archived' : 'unarchived'} successfully`,
        data: {
          id: flag.id,
          key: flag.key,
          name: flag.name,
          isArchived: flag.isArchived
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error archiving feature flag:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to archive feature flag',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan statistik feature flags
   */
  static async getStats(req, res) {
    try {
      const stats = await FeatureFlag.getStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching feature flag stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch feature flag statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan feature flags yang akan expired
   */
  static async getExpiring(req, res) {
    try {
      const { days = 7 } = req.query;
      
      const flags = await FeatureFlag.getExpiring(parseInt(days));
      
      res.json({
        success: true,
        data: {
          flags: flags.map(flag => ({
            id: flag.id,
            key: flag.key,
            name: flag.name,
            expiresAt: flag.expiresAt,
            daysUntilExpiry: flag.getDaysUntilExpiry(),
            isEnabled: flag.isEnabled
          })),
          count: flags.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching expiring feature flags:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch expiring feature flags',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Cleanup feature flags yang expired
   */
  static async cleanupExpired(req, res) {
    try {
      const userId = req.user?.id || 'system';
      
      const result = await FeatureFlag.cleanupExpired();
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'CLEANUP_EXPIRED_FLAGS',
        resource: 'feature_flag',
        details: {
          affectedRows: result[0]
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Expired feature flags cleaned up successfully',
        data: {
          disabledCount: result[0]
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error cleaning up expired feature flags:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup expired feature flags',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = FeatureFlagController;