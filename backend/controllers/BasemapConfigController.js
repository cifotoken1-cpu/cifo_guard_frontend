/**
 * BasemapConfigController.js
 * Controller untuk mengelola konfigurasi basemap SVG
 */

const BasemapConfig = require('../models/BasemapConfig');
const ActivityLogger = require('../services/ActivityLogger');
const WebSocketService = require('../services/WebSocketService');
const crypto = require('crypto');
const { Op } = require('sequelize');

class BasemapConfigController {
  /**
   * Membuat konfigurasi basemap baru
   */
  static async createBasemap(req, res) {
    try {
      const {
        name,
        description,
        svgData,
        calibration,
        dimensions,
        settings,
        metadata
      } = req.body;
      
      const userId = req.user?.id || 'system';
      
      // Validasi input
      if (!name || !svgData || !calibration || !dimensions) {
        return res.status(400).json({
          success: false,
          message: 'Name, SVG data, calibration, and dimensions are required',
          timestamp: new Date().toISOString()
        });
      }
      
      // Validasi SVG
      const svgValidation = BasemapConfig.validateSVG(svgData);
      if (!svgValidation.valid) {
        return res.status(400).json({
          success: false,
          message: `Invalid SVG: ${svgValidation.error}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Cek apakah nama sudah ada
      const existingBasemap = await BasemapConfig.getByName(name);
      if (existingBasemap) {
        return res.status(409).json({
          success: false,
          message: 'Basemap with this name already exists',
          timestamp: new Date().toISOString()
        });
      }
      
      // Buat basemap baru
      const basemap = await BasemapConfig.create({
        name,
        description,
        svgData,
        calibration,
        dimensions,
        settings: settings || {},
        metadata: metadata || {},
        createdBy: userId
      });
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'CREATE_BASEMAP',
        resource: 'basemap',
        resourceId: basemap.id,
        details: {
          name: basemap.name,
          dimensions: basemap.dimensions,
          controlPoints: basemap.calibration.controlPoints?.length || 0
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcastToAll('basemap:created', {
        id: basemap.id,
        name: basemap.name,
        isActive: basemap.isActive,
        createdBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json({
        success: true,
        message: 'Basemap created successfully',
        data: {
          id: basemap.id,
          name: basemap.name,
          description: basemap.description,
          dimensions: basemap.dimensions,
          isActive: basemap.isActive,
          isDefault: basemap.isDefault,
          version: basemap.version,
          settings: basemap.settings,
          createdAt: basemap.createdAt,
          createdBy: basemap.createdBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error creating basemap:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create basemap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan daftar basemap
   */
  static async getBasemaps(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        isActive,
        category,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const whereClause = {};
      
      // Filter berdasarkan pencarian
      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      // Filter berdasarkan status aktif
      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }
      
      // Filter berdasarkan kategori
      if (category) {
        whereClause['metadata.category'] = category;
      }
      
      const { count, rows: basemaps } = await BasemapConfig.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        attributes: {
          exclude: ['svgData'] // Exclude large SVG data from list
        }
      });
      
      res.json({
        success: true,
        data: {
          basemaps: basemaps.map(basemap => ({
            id: basemap.id,
            name: basemap.name,
            description: basemap.description,
            dimensions: basemap.dimensions,
            isActive: basemap.isActive,
            isDefault: basemap.isDefault,
            version: basemap.version,
            settings: basemap.settings,
            fileSize: basemap.fileSize,
            createdAt: basemap.createdAt,
            createdBy: basemap.createdBy,
            activatedAt: basemap.activatedAt,
            activatedBy: basemap.activatedBy
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
      console.error('Error fetching basemaps:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch basemaps',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan detail basemap berdasarkan ID
   */
  static async getBasemapById(req, res) {
    try {
      const { id } = req.params;
      const { includeSvg = 'false' } = req.query;
      
      const attributes = includeSvg === 'true' ? undefined : { exclude: ['svgData'] };
      
      const basemap = await BasemapConfig.findByPk(id, { attributes });
      
      if (!basemap) {
        return res.status(404).json({
          success: false,
          message: 'Basemap not found',
          timestamp: new Date().toISOString()
        });
      }
      
      const responseData = {
        id: basemap.id,
        name: basemap.name,
        description: basemap.description,
        calibration: basemap.calibration,
        dimensions: basemap.dimensions,
        isActive: basemap.isActive,
        isDefault: basemap.isDefault,
        version: basemap.version,
        settings: basemap.settings,
        metadata: basemap.metadata,
        fileSize: basemap.fileSize,
        checksum: basemap.checksum,
        createdAt: basemap.createdAt,
        updatedAt: basemap.updatedAt,
        createdBy: basemap.createdBy,
        updatedBy: basemap.updatedBy,
        activatedAt: basemap.activatedAt,
        activatedBy: basemap.activatedBy
      };
      
      // Include SVG data if requested
      if (includeSvg === 'true') {
        responseData.svgData = basemap.svgData;
      }
      
      res.json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching basemap:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch basemap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Update basemap
   */
  static async updateBasemap(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        svgData,
        calibration,
        dimensions,
        settings,
        metadata
      } = req.body;
      
      const userId = req.user?.id || 'system';
      
      const basemap = await BasemapConfig.findByPk(id);
      if (!basemap) {
        return res.status(404).json({
          success: false,
          message: 'Basemap not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Validasi SVG jika diupdate
      if (svgData) {
        const svgValidation = BasemapConfig.validateSVG(svgData);
        if (!svgValidation.valid) {
          return res.status(400).json({
            success: false,
            message: `Invalid SVG: ${svgValidation.error}`,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Cek nama unik jika diubah
      if (name && name !== basemap.name) {
        const existingBasemap = await BasemapConfig.getByName(name);
        if (existingBasemap) {
          return res.status(409).json({
            success: false,
            message: 'Basemap with this name already exists',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      const updateData = {
        updatedBy: userId
      };
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (svgData !== undefined) {
        updateData.svgData = svgData;
        updateData.fileSize = Buffer.byteLength(svgData, 'utf8');
        updateData.checksum = crypto.createHash('md5').update(svgData).digest('hex');
        updateData.version = basemap.version + 1;
      }
      if (calibration !== undefined) {
        updateData.calibration = calibration;
        updateData.version = basemap.version + 1;
      }
      if (dimensions !== undefined) updateData.dimensions = dimensions;
      if (settings !== undefined) updateData.settings = { ...basemap.settings, ...settings };
      if (metadata !== undefined) updateData.metadata = { ...basemap.metadata, ...metadata };
      
      await basemap.update(updateData);
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'UPDATE_BASEMAP',
        resource: 'basemap',
        resourceId: basemap.id,
        details: {
          name: basemap.name,
          changes: Object.keys(updateData).filter(key => key !== 'updatedBy')
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('basemap:updated', {
        id: basemap.id,
        name: basemap.name,
        version: basemap.version,
        updatedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Basemap updated successfully',
        data: {
          id: basemap.id,
          name: basemap.name,
          description: basemap.description,
          dimensions: basemap.dimensions,
          isActive: basemap.isActive,
          isDefault: basemap.isDefault,
          version: basemap.version,
          settings: basemap.settings,
          updatedAt: basemap.updatedAt,
          updatedBy: basemap.updatedBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error updating basemap:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update basemap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Hapus basemap
   */
  static async deleteBasemap(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';
      
      const basemap = await BasemapConfig.findByPk(id);
      if (!basemap) {
        return res.status(404).json({
          success: false,
          message: 'Basemap not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Cek apakah basemap sedang aktif
      if (basemap.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete active basemap. Please deactivate first.',
          timestamp: new Date().toISOString()
        });
      }
      
      // Cek apakah basemap adalah default
      if (basemap.isDefault) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete default basemap. Please set another basemap as default first.',
          timestamp: new Date().toISOString()
        });
      }
      
      const basemapName = basemap.name;
      await basemap.destroy();
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'DELETE_BASEMAP',
        resource: 'basemap',
        resourceId: id,
        details: {
          name: basemapName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('basemap:deleted', {
        id,
        name: basemapName,
        deletedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Basemap deleted successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error deleting basemap:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete basemap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Aktifkan basemap
   */
  static async activateBasemap(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';
      
      const basemap = await BasemapConfig.findByPk(id);
      if (!basemap) {
        return res.status(404).json({
          success: false,
          message: 'Basemap not found',
          timestamp: new Date().toISOString()
        });
      }
      
      if (basemap.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Basemap is already active',
          timestamp: new Date().toISOString()
        });
      }
      
      await basemap.activate(userId);
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'ACTIVATE_BASEMAP',
        resource: 'basemap',
        resourceId: basemap.id,
        details: {
          name: basemap.name
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('basemap:activated', {
        id: basemap.id,
        name: basemap.name,
        activatedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Basemap activated successfully',
        data: {
          id: basemap.id,
          name: basemap.name,
          isActive: true,
          activatedAt: basemap.activatedAt,
          activatedBy: basemap.activatedBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error activating basemap:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate basemap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Nonaktifkan basemap
   */
  static async deactivateBasemap(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';
      
      const basemap = await BasemapConfig.findByPk(id);
      if (!basemap) {
        return res.status(404).json({
          success: false,
          message: 'Basemap not found',
          timestamp: new Date().toISOString()
        });
      }
      
      if (!basemap.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Basemap is already inactive',
          timestamp: new Date().toISOString()
        });
      }
      
      await basemap.deactivate();
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'DEACTIVATE_BASEMAP',
        resource: 'basemap',
        resourceId: basemap.id,
        details: {
          name: basemap.name
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('basemap:deactivated', {
        id: basemap.id,
        name: basemap.name,
        deactivatedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Basemap deactivated successfully',
        data: {
          id: basemap.id,
          name: basemap.name,
          isActive: false
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error deactivating basemap:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate basemap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Set basemap sebagai default
   */
  static async setDefaultBasemap(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';
      
      const basemap = await BasemapConfig.findByPk(id);
      if (!basemap) {
        return res.status(404).json({
          success: false,
          message: 'Basemap not found',
          timestamp: new Date().toISOString()
        });
      }
      
      if (basemap.isDefault) {
        return res.status(400).json({
          success: false,
          message: 'Basemap is already set as default',
          timestamp: new Date().toISOString()
        });
      }
      
      await basemap.setAsDefault();
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'SET_DEFAULT_BASEMAP',
        resource: 'basemap',
        resourceId: basemap.id,
        details: {
          name: basemap.name
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('basemap:default_changed', {
        id: basemap.id,
        name: basemap.name,
        setBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Basemap set as default successfully',
        data: {
          id: basemap.id,
          name: basemap.name,
          isDefault: true
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error setting default basemap:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set default basemap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Konversi koordinat SVG ke geografis
   */
  static async convertSvgToGeo(req, res) {
    try {
      const { id } = req.params;
      const { x, y } = req.body;
      
      if (typeof x !== 'number' || typeof y !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'X and Y coordinates must be numbers',
          timestamp: new Date().toISOString()
        });
      }
      
      const basemap = await BasemapConfig.findByPk(id);
      if (!basemap) {
        return res.status(404).json({
          success: false,
          message: 'Basemap not found',
          timestamp: new Date().toISOString()
        });
      }
      
      const geoCoords = basemap.svgToGeo(x, y);
      
      res.json({
        success: true,
        data: {
          svg: { x, y },
          geo: geoCoords
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error converting coordinates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to convert coordinates',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Konversi koordinat geografis ke SVG
   */
  static async convertGeoToSvg(req, res) {
    try {
      const { id } = req.params;
      const { lat, lng } = req.body;
      
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude must be numbers',
          timestamp: new Date().toISOString()
        });
      }
      
      // Validasi koordinat geografis
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid geographic coordinates',
          timestamp: new Date().toISOString()
        });
      }
      
      const basemap = await BasemapConfig.findByPk(id);
      if (!basemap) {
        return res.status(404).json({
          success: false,
          message: 'Basemap not found',
          timestamp: new Date().toISOString()
        });
      }
      
      const svgCoords = basemap.geoToSvg(lat, lng);
      
      res.json({
        success: true,
        data: {
          geo: { lat, lng },
          svg: svgCoords
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error converting coordinates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to convert coordinates',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan basemap aktif
   */
  static async getActiveBasemap(req, res) {
    try {
      const { includeSvg = 'false' } = req.query;
      
      const attributes = includeSvg === 'true' ? undefined : { exclude: ['svgData'] };
      const basemap = await BasemapConfig.getActive();
      
      if (!basemap) {
        return res.status(404).json({
          success: false,
          message: 'No active basemap found',
          timestamp: new Date().toISOString()
        });
      }
      
      const responseData = {
        id: basemap.id,
        name: basemap.name,
        description: basemap.description,
        calibration: basemap.calibration,
        dimensions: basemap.dimensions,
        isActive: basemap.isActive,
        isDefault: basemap.isDefault,
        version: basemap.version,
        settings: basemap.settings,
        bounds: basemap.getBounds(),
        center: basemap.getCenter(),
        activatedAt: basemap.activatedAt,
        activatedBy: basemap.activatedBy
      };
      
      // Include SVG data if requested
      if (includeSvg === 'true') {
        responseData.svgData = basemap.svgData;
      }
      
      res.json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching active basemap:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active basemap',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Cleanup basemap versions lama
   */
  static async cleanupVersions(req, res) {
    try {
      const { keepVersions = 5 } = req.body;
      const userId = req.user?.id || 'system';
      
      await BasemapConfig.cleanup(parseInt(keepVersions));
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'CLEANUP_BASEMAP_VERSIONS',
        resource: 'basemap',
        details: {
          keepVersions: parseInt(keepVersions)
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Basemap versions cleaned up successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error cleaning up basemap versions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup basemap versions',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = BasemapConfigController;