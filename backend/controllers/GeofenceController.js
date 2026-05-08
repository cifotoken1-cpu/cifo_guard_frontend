/**
 * GeofenceController.js
 * Controller untuk menangani operasi geofence dan area monitoring
 * Mendukung berbagai jenis geofence (POLYGON, CIRCLE, RECTANGLE)
 */

const { Geofence, GeofenceBreach, TeamMember, SecurityActivity } = require('../models');
const { Op } = require('sequelize');
const WebSocketService = require('../services/WebSocketService');

class GeofenceController {
  /**
   * Membuat geofence baru
   */
  static async createGeofence(req, res) {
    try {
      const {
        name,
        type,
        coordinates,
        alertSettings,
        description,
        isActive = true,
        priority = 'MEDIUM'
      } = req.body;

      // Validasi input wajib
      if (!name || !type || !coordinates) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Name, type, dan coordinates wajib diisi'
        });
      }

      // Validasi type geofence
      const validTypes = ['POLYGON', 'CIRCLE', 'RECTANGLE'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_TYPE',
          message: `Type harus salah satu dari: ${validTypes.join(', ')}`
        });
      }

      // Validasi koordinat berdasarkan type
      if (type === 'CIRCLE') {
        if (!coordinates.center || !coordinates.radius) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_COORDINATES',
            message: 'Circle geofence memerlukan center dan radius'
          });
        }
      } else if (type === 'RECTANGLE') {
        if (!coordinates.bounds || !coordinates.bounds.north || !coordinates.bounds.south ||
            !coordinates.bounds.east || !coordinates.bounds.west) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_COORDINATES',
            message: 'Rectangle geofence memerlukan bounds (north, south, east, west)'
          });
        }
      } else if (type === 'POLYGON') {
        if (!Array.isArray(coordinates.points) || coordinates.points.length < 3) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_COORDINATES',
            message: 'Polygon geofence memerlukan minimal 3 points'
          });
        }
      }

      // Buat geofence baru
      const geofence = await Geofence.create({
        name,
        type,
        coordinates,
        alertSettings: alertSettings || {
          onEntry: true,
          onExit: true,
          notifyRoles: ['supervisor', 'coordinator']
        },
        description,
        isActive,
        priority,
        createdBy: req.user?.id || 'system'
      });

      // Log aktivitas
      await SecurityActivity.create({
        type: 'GEOFENCE_CREATED',
        actor: req.user?.name || 'System',
        description: `Geofence '${name}' berhasil dibuat`,
        severity: 'INFO',
        metadata: {
          geofenceId: geofence.id,
          type: geofence.type,
          isActive: geofence.isActive
        },
        referenceId: geofence.id.toString()
      });

      // Broadcast ke WebSocket
      WebSocketService.broadcast('geofence:created', {
        geofence,
        message: `Geofence baru '${name}' telah dibuat`,
        timestamp: new Date().toISOString()
      });

      res.status(201).json({
        success: true,
        data: geofence,
        message: 'Geofence berhasil dibuat',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[GeofenceController] Error creating geofence:', error);
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Gagal membuat geofence',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Mendapatkan daftar geofence dengan filter
   */
  static async getGeofences(req, res) {
    try {
      const {
        isActive,
        type,
        priority,
        page = 1,
        limit = 20,
        search
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const whereClause = {};

      // Filter berdasarkan status aktif
      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }

      // Filter berdasarkan type
      if (type) {
        whereClause.type = type;
      }

      // Filter berdasarkan priority
      if (priority) {
        whereClause.priority = priority;
      }

      // Search berdasarkan nama atau deskripsi
      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: geofences } = await Geofence.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          geofences,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit))
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[GeofenceController] Error fetching geofences:', error);
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Gagal mengambil data geofence',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Mendapatkan detail geofence berdasarkan ID
   */
  static async getGeofenceById(req, res) {
    try {
      const { id } = req.params;

      const geofence = await Geofence.findByPk(id, {
        include: [
          {
            model: GeofenceBreach,
            as: 'breaches',
            limit: 10,
            order: [['createdAt', 'DESC']],
            include: [
              {
                model: TeamMember,
                as: 'teamMember',
                attributes: ['id', 'name', 'role', 'employeeId']
              }
            ]
          }
        ]
      });

      if (!geofence) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Geofence tidak ditemukan'
        });
      }

      res.json({
        success: true,
        data: geofence,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[GeofenceController] Error fetching geofence:', error);
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Gagal mengambil detail geofence',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update geofence
   */
  static async updateGeofence(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const geofence = await Geofence.findByPk(id);
      if (!geofence) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Geofence tidak ditemukan'
        });
      }

      // Validasi koordinat jika diupdate
      if (updateData.coordinates && updateData.type) {
        const { type, coordinates } = updateData;
        
        if (type === 'CIRCLE' && (!coordinates.center || !coordinates.radius)) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_COORDINATES',
            message: 'Circle geofence memerlukan center dan radius'
          });
        }
      }

      // Update geofence
      await geofence.update({
        ...updateData,
        updatedBy: req.user?.id || 'system'
      });

      // Log aktivitas
      await SecurityActivity.create({
        type: 'GEOFENCE_UPDATED',
        actor: req.user?.name || 'System',
        description: `Geofence '${geofence.name}' berhasil diupdate`,
        severity: 'INFO',
        metadata: {
          geofenceId: geofence.id,
          changes: Object.keys(updateData)
        },
        referenceId: geofence.id.toString()
      });

      // Broadcast update
      WebSocketService.broadcast('geofence:updated', {
        geofence,
        message: `Geofence '${geofence.name}' telah diupdate`,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        data: geofence,
        message: 'Geofence berhasil diupdate',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[GeofenceController] Error updating geofence:', error);
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Gagal mengupdate geofence',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Hapus geofence
   */
  static async deleteGeofence(req, res) {
    try {
      const { id } = req.params;

      const geofence = await Geofence.findByPk(id);
      if (!geofence) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Geofence tidak ditemukan'
        });
      }

      const geofenceName = geofence.name;
      await geofence.destroy();

      // Log aktivitas
      await SecurityActivity.create({
        type: 'GEOFENCE_DELETED',
        actor: req.user?.name || 'System',
        description: `Geofence '${geofenceName}' berhasil dihapus`,
        severity: 'WARNING',
        metadata: {
          geofenceId: id,
          geofenceName
        },
        referenceId: id
      });

      // Broadcast delete
      WebSocketService.broadcast('geofence:deleted', {
        geofenceId: id,
        message: `Geofence '${geofenceName}' telah dihapus`,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Geofence berhasil dihapus',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[GeofenceController] Error deleting geofence:', error);
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Gagal menghapus geofence',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Cek apakah lokasi berada dalam geofence
   */
  static async checkLocation(req, res) {
    try {
      const { latitude, longitude, teamMemberId } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Latitude dan longitude wajib diisi'
        });
      }

      // Ambil semua geofence aktif
      const activeGeofences = await Geofence.findAll({
        where: { isActive: true }
      });

      const results = [];
      const breaches = [];

      for (const geofence of activeGeofences) {
        const isInside = this.isPointInGeofence(
          { lat: parseFloat(latitude), lng: parseFloat(longitude) },
          geofence
        );

        results.push({
          geofenceId: geofence.id,
          name: geofence.name,
          type: geofence.type,
          isInside,
          priority: geofence.priority
        });

        // Jika ada pelanggaran dan teamMemberId disediakan
        if (isInside && geofence.alertSettings?.onEntry && teamMemberId) {
          // Cek apakah sudah ada breach dalam 5 menit terakhir
          const recentBreach = await GeofenceBreach.findOne({
            where: {
              geofenceId: geofence.id,
              teamMemberId,
              createdAt: {
                [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // 5 menit
              }
            }
          });

          if (!recentBreach) {
            const breach = await GeofenceBreach.create({
              geofenceId: geofence.id,
              teamMemberId,
              breachType: 'ENTRY',
              location: { latitude, longitude },
              severity: geofence.priority === 'HIGH' ? 'ERROR' : 'WARNING'
            });

            breaches.push(breach);

            // Broadcast breach alert
            WebSocketService.broadcast('geofence:breach', {
              breach,
              geofence,
              message: `Pelanggaran geofence: ${geofence.name}`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          location: { latitude, longitude },
          geofences: results,
          breaches: breaches.length > 0 ? breaches : undefined
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[GeofenceController] Error checking location:', error);
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Gagal mengecek lokasi',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Mendapatkan riwayat pelanggaran geofence
   */
  static async getGeofenceBreaches(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, severity } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const whereClause = { geofenceId: id };

      if (severity) {
        whereClause.severity = severity;
      }

      const { count, rows: breaches } = await GeofenceBreach.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: TeamMember,
            as: 'teamMember',
            attributes: ['id', 'name', 'role', 'employeeId']
          },
          {
            model: Geofence,
            as: 'geofence',
            attributes: ['id', 'name', 'type', 'priority']
          }
        ],
        limit: parseInt(limit),
        offset,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          breaches,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit))
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[GeofenceController] Error fetching breaches:', error);
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Gagal mengambil riwayat pelanggaran',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Toggle status aktif geofence
   */
  static async toggleGeofence(req, res) {
    try {
      const { id } = req.params;

      const geofence = await Geofence.findByPk(id);
      if (!geofence) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Geofence tidak ditemukan'
        });
      }

      const newStatus = !geofence.isActive;
      await geofence.update({ 
        isActive: newStatus,
        updatedBy: req.user?.id || 'system'
      });

      // Log aktivitas
      await SecurityActivity.create({
        type: 'GEOFENCE_TOGGLED',
        actor: req.user?.name || 'System',
        description: `Geofence '${geofence.name}' ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
        severity: 'INFO',
        metadata: {
          geofenceId: geofence.id,
          previousStatus: !newStatus,
          newStatus
        },
        referenceId: geofence.id.toString()
      });

      // Broadcast status change
      WebSocketService.broadcast('geofence:toggled', {
        geofence,
        message: `Geofence '${geofence.name}' ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        data: geofence,
        message: `Geofence berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[GeofenceController] Error toggling geofence:', error);
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Gagal mengubah status geofence',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Mendapatkan statistik dashboard geofence
   */
  static async getDashboardStats(req, res) {
    try {
      const { period = '24h' } = req.query;
      
      let startDate;
      switch (period) {
        case '1h':
          startDate = new Date(Date.now() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }

      // Total geofences
      const totalGeofences = await Geofence.count();
      const activeGeofences = await Geofence.count({ where: { isActive: true } });

      // Breaches dalam periode
      const totalBreaches = await GeofenceBreach.count({
        where: {
          createdAt: { [Op.gte]: startDate }
        }
      });

      const criticalBreaches = await GeofenceBreach.count({
        where: {
          severity: 'ERROR',
          createdAt: { [Op.gte]: startDate }
        }
      });

      // Geofences berdasarkan type
      const geofencesByType = await Geofence.findAll({
        attributes: [
          'type',
          [Geofence.sequelize.fn('COUNT', Geofence.sequelize.col('id')), 'count']
        ],
        group: ['type']
      });

      // Top geofences dengan breach terbanyak
      const topBreachedGeofences = await GeofenceBreach.findAll({
        attributes: [
          'geofenceId',
          [GeofenceBreach.sequelize.fn('COUNT', GeofenceBreach.sequelize.col('id')), 'breachCount']
        ],
        include: [
          {
            model: Geofence,
            as: 'geofence',
            attributes: ['name', 'type', 'priority']
          }
        ],
        where: {
          createdAt: { [Op.gte]: startDate }
        },
        group: ['geofenceId', 'geofence.id'],
        order: [[GeofenceBreach.sequelize.fn('COUNT', GeofenceBreach.sequelize.col('GeofenceBreach.id')), 'DESC']],
        limit: 5
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalGeofences,
            activeGeofences,
            inactiveGeofences: totalGeofences - activeGeofences,
            totalBreaches,
            criticalBreaches
          },
          geofencesByType: geofencesByType.map(item => ({
            type: item.type,
            count: parseInt(item.dataValues.count)
          })),
          topBreachedGeofences: topBreachedGeofences.map(item => ({
            geofence: item.geofence,
            breachCount: parseInt(item.dataValues.breachCount)
          })),
          period
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[GeofenceController] Error fetching dashboard stats:', error);
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Gagal mengambil statistik dashboard',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Helper method untuk mengecek apakah point berada dalam geofence
   */
  static isPointInGeofence(point, geofence) {
    const { type, coordinates } = geofence;

    switch (type) {
      case 'CIRCLE':
        return this.isPointInCircle(point, coordinates);
      case 'RECTANGLE':
        return this.isPointInRectangle(point, coordinates);
      case 'POLYGON':
        return this.isPointInPolygon(point, coordinates);
      default:
        return false;
    }
  }

  /**
   * Cek apakah point berada dalam circle
   */
  static isPointInCircle(point, coordinates) {
    const { center, radius } = coordinates;
    const distance = this.calculateDistance(
      point.lat, point.lng,
      center.lat, center.lng
    );
    return distance <= radius;
  }

  /**
   * Cek apakah point berada dalam rectangle
   */
  static isPointInRectangle(point, coordinates) {
    const { bounds } = coordinates;
    return point.lat >= bounds.south &&
           point.lat <= bounds.north &&
           point.lng >= bounds.west &&
           point.lng <= bounds.east;
  }

  /**
   * Cek apakah point berada dalam polygon (Ray casting algorithm)
   */
  static isPointInPolygon(point, coordinates) {
    const { points } = coordinates;
    let inside = false;
    
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      if (((points[i].lat > point.lat) !== (points[j].lat > point.lat)) &&
          (point.lng < (points[j].lng - points[i].lng) * (point.lat - points[i].lat) / (points[j].lat - points[i].lat) + points[i].lng)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Hitung jarak antara dua koordinat (Haversine formula)
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}

module.exports = GeofenceController;