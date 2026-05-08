/**
 * MapPinController.js
 * Controller untuk mengelola map pins/markers
 */

const MapPin = require('../models/MapPin');
const ActivityLogger = require('../services/ActivityLogger');
const WebSocketService = require('../services/WebSocketService');
const { Op } = require('sequelize');

class MapPinController {
  /**
   * Membuat map pin baru
   */
  static async createPin(req, res) {
    try {
      const {
        type,
        coordinates,
        title,
        description,
        status = 'ACTIVE',
        priority = 'MEDIUM',
        iconType,
        iconColor,
        size = 'MEDIUM',
        isVisible = true,
        isClickable = true,
        metadata = {},
        alertId,
        incidentId,
        teamMemberId,
        cameraId,
        geofenceId
      } = req.body;
      
      const userId = req.user?.id || 'system';
      
      // Validasi input
      if (!type || !coordinates || !title) {
        return res.status(400).json({
          success: false,
          message: 'Type, coordinates, and title are required',
          timestamp: new Date().toISOString()
        });
      }
      
      // Validasi koordinat
      if (!coordinates.latitude || !coordinates.longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required in coordinates',
          timestamp: new Date().toISOString()
        });
      }
      
      // Buat map pin baru
      const pin = await MapPin.create({
        type,
        coordinates,
        title,
        description,
        status,
        priority,
        iconType,
        iconColor,
        size,
        isVisible,
        isClickable,
        metadata,
        alertId,
        incidentId,
        teamMemberId,
        cameraId,
        geofenceId,
        createdBy: userId
      });
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'CREATE_MAP_PIN',
        resource: 'map_pin',
        resourceId: pin.id,
        details: {
          type: pin.type,
          title: pin.title,
          coordinates: pin.coordinates,
          priority: pin.priority
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('map_pin:created', {
        id: pin.id,
        type: pin.type,
        title: pin.title,
        coordinates: pin.coordinates,
        status: pin.status,
        priority: pin.priority,
        isVisible: pin.isVisible,
        createdBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json({
        success: true,
        message: 'Map pin created successfully',
        data: {
          id: pin.id,
          type: pin.type,
          coordinates: pin.coordinates,
          title: pin.title,
          description: pin.description,
          status: pin.status,
          priority: pin.priority,
          iconType: pin.iconType,
          iconColor: pin.iconColor,
          size: pin.size,
          isVisible: pin.isVisible,
          isClickable: pin.isClickable,
          createdAt: pin.createdAt,
          createdBy: pin.createdBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error creating map pin:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create map pin',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan daftar map pins
   */
  static async getPins(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        type,
        status,
        priority,
        isVisible,
        bounds,
        radius,
        center,
        search,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const whereClause = {};
      
      // Filter berdasarkan type
      if (type) {
        if (Array.isArray(type)) {
          whereClause.type = { [Op.in]: type };
        } else {
          whereClause.type = type;
        }
      }
      
      // Filter berdasarkan status
      if (status) {
        if (Array.isArray(status)) {
          whereClause.status = { [Op.in]: status };
        } else {
          whereClause.status = status;
        }
      }
      
      // Filter berdasarkan priority
      if (priority) {
        if (Array.isArray(priority)) {
          whereClause.priority = { [Op.in]: priority };
        } else {
          whereClause.priority = priority;
        }
      }
      
      // Filter berdasarkan visibility
      if (isVisible !== undefined) {
        whereClause.isVisible = isVisible === 'true';
      }
      
      // Filter berdasarkan pencarian
      if (search) {
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      // Filter berdasarkan bounds (bounding box)
      if (bounds) {
        try {
          const { north, south, east, west } = JSON.parse(bounds);
          whereClause['coordinates.latitude'] = {
            [Op.between]: [south, north]
          };
          whereClause['coordinates.longitude'] = {
            [Op.between]: [west, east]
          };
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Invalid bounds format',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      const { count, rows: pins } = await MapPin.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]]
      });
      
      // Filter berdasarkan radius jika ada
      let filteredPins = pins;
      if (radius && center) {
        try {
          const { latitude, longitude } = JSON.parse(center);
          const radiusKm = parseFloat(radius);
          
          filteredPins = pins.filter(pin => {
            const distance = pin.calculateDistance(latitude, longitude);
            return distance <= radiusKm;
          });
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Invalid center or radius format',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      res.json({
        success: true,
        data: {
          pins: filteredPins.map(pin => ({
            id: pin.id,
            type: pin.type,
            coordinates: pin.coordinates,
            title: pin.title,
            description: pin.description,
            status: pin.status,
            priority: pin.priority,
            iconType: pin.iconType,
            iconColor: pin.iconColor,
            size: pin.size,
            isVisible: pin.isVisible,
            isClickable: pin.isClickable,
            metadata: pin.metadata,
            alertId: pin.alertId,
            incidentId: pin.incidentId,
            teamMemberId: pin.teamMemberId,
            cameraId: pin.cameraId,
            geofenceId: pin.geofenceId,
            createdAt: pin.createdAt,
            updatedAt: pin.updatedAt,
            createdBy: pin.createdBy
          })),
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit)),
            totalItems: count,
            itemsPerPage: parseInt(limit),
            filteredItems: filteredPins.length
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching map pins:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch map pins',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan detail map pin berdasarkan ID
   */
  static async getPinById(req, res) {
    try {
      const { id } = req.params;
      
      const pin = await MapPin.findByPk(id);
      
      if (!pin) {
        return res.status(404).json({
          success: false,
          message: 'Map pin not found',
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: {
          id: pin.id,
          type: pin.type,
          coordinates: pin.coordinates,
          title: pin.title,
          description: pin.description,
          status: pin.status,
          priority: pin.priority,
          iconType: pin.iconType,
          iconColor: pin.iconColor,
          size: pin.size,
          isVisible: pin.isVisible,
          isClickable: pin.isClickable,
          metadata: pin.metadata,
          alertId: pin.alertId,
          incidentId: pin.incidentId,
          teamMemberId: pin.teamMemberId,
          cameraId: pin.cameraId,
          geofenceId: pin.geofenceId,
          createdAt: pin.createdAt,
          updatedAt: pin.updatedAt,
          createdBy: pin.createdBy,
          updatedBy: pin.updatedBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching map pin:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch map pin',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Update map pin
   */
  static async updatePin(req, res) {
    try {
      const { id } = req.params;
      const {
        coordinates,
        title,
        description,
        status,
        priority,
        iconType,
        iconColor,
        size,
        isVisible,
        isClickable,
        metadata
      } = req.body;
      
      const userId = req.user?.id || 'system';
      
      const pin = await MapPin.findByPk(id);
      if (!pin) {
        return res.status(404).json({
          success: false,
          message: 'Map pin not found',
          timestamp: new Date().toISOString()
        });
      }
      
      const updateData = {
        updatedBy: userId
      };
      
      if (coordinates !== undefined) updateData.coordinates = coordinates;
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (iconType !== undefined) updateData.iconType = iconType;
      if (iconColor !== undefined) updateData.iconColor = iconColor;
      if (size !== undefined) updateData.size = size;
      if (isVisible !== undefined) updateData.isVisible = isVisible;
      if (isClickable !== undefined) updateData.isClickable = isClickable;
      if (metadata !== undefined) updateData.metadata = { ...pin.metadata, ...metadata };
      
      await pin.update(updateData);
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'UPDATE_MAP_PIN',
        resource: 'map_pin',
        resourceId: pin.id,
        details: {
          type: pin.type,
          title: pin.title,
          changes: Object.keys(updateData).filter(key => key !== 'updatedBy')
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('map_pin:updated', {
        id: pin.id,
        type: pin.type,
        title: pin.title,
        coordinates: pin.coordinates,
        status: pin.status,
        priority: pin.priority,
        isVisible: pin.isVisible,
        updatedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Map pin updated successfully',
        data: {
          id: pin.id,
          type: pin.type,
          coordinates: pin.coordinates,
          title: pin.title,
          description: pin.description,
          status: pin.status,
          priority: pin.priority,
          isVisible: pin.isVisible,
          updatedAt: pin.updatedAt,
          updatedBy: pin.updatedBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error updating map pin:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update map pin',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Hapus map pin
   */
  static async deletePin(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';
      
      const pin = await MapPin.findByPk(id);
      if (!pin) {
        return res.status(404).json({
          success: false,
          message: 'Map pin not found',
          timestamp: new Date().toISOString()
        });
      }
      
      const pinType = pin.type;
      const pinTitle = pin.title;
      await pin.destroy();
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'DELETE_MAP_PIN',
        resource: 'map_pin',
        resourceId: id,
        details: {
          type: pinType,
          title: pinTitle
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('map_pin:deleted', {
        id,
        type: pinType,
        title: pinTitle,
        deletedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Map pin deleted successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error deleting map pin:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete map pin',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Toggle visibility map pin
   */
  static async toggleVisibility(req, res) {
    try {
      const { id } = req.params;
      const { isVisible } = req.body;
      const userId = req.user?.id || 'system';
      
      const pin = await MapPin.findByPk(id);
      if (!pin) {
        return res.status(404).json({
          success: false,
          message: 'Map pin not found',
          timestamp: new Date().toISOString()
        });
      }
      
      const newVisibility = isVisible !== undefined ? isVisible : !pin.isVisible;
      
      if (newVisibility) {
        await pin.show();
      } else {
        await pin.hide();
      }
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: newVisibility ? 'SHOW_MAP_PIN' : 'HIDE_MAP_PIN',
        resource: 'map_pin',
        resourceId: pin.id,
        details: {
          type: pin.type,
          title: pin.title,
          isVisible: pin.isVisible
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('map_pin:visibility_changed', {
        id: pin.id,
        type: pin.type,
        title: pin.title,
        isVisible: pin.isVisible,
        changedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: `Map pin ${pin.isVisible ? 'shown' : 'hidden'} successfully`,
        data: {
          id: pin.id,
          type: pin.type,
          title: pin.title,
          isVisible: pin.isVisible
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error toggling map pin visibility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle map pin visibility',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Bulk update map pins
   */
  static async bulkUpdate(req, res) {
    try {
      const { ids, updates } = req.body;
      const userId = req.user?.id || 'system';
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'IDs must be a non-empty array',
          timestamp: new Date().toISOString()
        });
      }
      
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Updates must be an object',
          timestamp: new Date().toISOString()
        });
      }
      
      const updateData = {
        ...updates,
        updatedBy: userId,
        updatedAt: new Date()
      };
      
      const result = await MapPin.update(updateData, {
        where: {
          id: { [Op.in]: ids }
        }
      });
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'BULK_UPDATE_MAP_PINS',
        resource: 'map_pin',
        details: {
          affectedPins: result[0],
          updates: Object.keys(updates)
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Broadcast ke WebSocket
      WebSocketService.broadcast('map_pin:bulk_updated', {
        affectedPins: result[0],
        updates: Object.keys(updates),
        updatedBy: userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Map pins updated successfully',
        data: {
          affectedPins: result[0]
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error bulk updating map pins:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk update map pins',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan pins dalam radius tertentu
   */
  static async getPinsInRadius(req, res) {
    try {
      const { latitude, longitude, radius } = req.query;
      
      if (!latitude || !longitude || !radius) {
        return res.status(400).json({
          success: false,
          message: 'Latitude, longitude, and radius are required',
          timestamp: new Date().toISOString()
        });
      }
      
      const pins = await MapPin.getInRadius(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(radius)
      );
      
      res.json({
        success: true,
        data: {
          pins: pins.map(pin => ({
            id: pin.id,
            type: pin.type,
            coordinates: pin.coordinates,
            title: pin.title,
            description: pin.description,
            status: pin.status,
            priority: pin.priority,
            iconType: pin.iconType,
            iconColor: pin.iconColor,
            size: pin.size,
            isVisible: pin.isVisible,
            distance: pin.calculateDistance(parseFloat(latitude), parseFloat(longitude))
          })),
          center: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
          },
          radius: parseFloat(radius),
          count: pins.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching pins in radius:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pins in radius',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Cleanup pins yang expired
   */
  static async cleanupExpired(req, res) {
    try {
      const { olderThanDays = 30 } = req.body;
      const userId = req.user?.id || 'system';
      
      const result = await MapPin.cleanupExpired(parseInt(olderThanDays));
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'CLEANUP_EXPIRED_PINS',
        resource: 'map_pin',
        details: {
          deletedPins: result,
          olderThanDays: parseInt(olderThanDays)
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Expired map pins cleaned up successfully',
        data: {
          deletedPins: result
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error cleaning up expired pins:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup expired pins',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Mendapatkan statistik map pins
   */
  static async getStats(req, res) {
    try {
      const stats = await MapPin.getStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching map pin stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch map pin statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Sync pins dari entitas lain (Alert, Incident, TeamMember)
   */
  static async syncPins(req, res) {
    try {
      const { entityType, entityId } = req.body;
      const userId = req.user?.id || 'system';
      
      if (!entityType || !entityId) {
        return res.status(400).json({
          success: false,
          message: 'Entity type and ID are required',
          timestamp: new Date().toISOString()
        });
      }
      
      let pin;
      
      switch (entityType.toLowerCase()) {
        case 'alert':
          // Implementasi sync dari Alert akan ditambahkan setelah model Alert dibuat
          break;
        case 'incident':
          // Implementasi sync dari Incident akan ditambahkan setelah model Incident dibuat
          break;
        case 'team_member':
          // Implementasi sync dari TeamMember akan ditambahkan setelah model TeamMember dibuat
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid entity type',
            timestamp: new Date().toISOString()
          });
      }
      
      // Log aktivitas
      await ActivityLogger.log({
        userId,
        action: 'SYNC_MAP_PIN',
        resource: 'map_pin',
        details: {
          entityType,
          entityId
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Map pin synced successfully',
        data: pin ? {
          id: pin.id,
          type: pin.type,
          title: pin.title,
          coordinates: pin.coordinates
        } : null,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error syncing map pin:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync map pin',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = MapPinController;