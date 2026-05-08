const Camera = require('../models/Camera');
const CameraHealthLog = require('../models/CameraHealthLog');
const SecurityActivity = require('../models/SecurityActivity');

class CameraController {
  // Get all cameras with optional filters
  static async getAllCameras(req, res) {
    try {
      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        status: req.query.status,
        area: req.query.area,
        type: req.query.type,
        search: req.query.search
      };

      const cameras = await Camera.getAll(options);
      const total = await Camera.getCount({
        status: options.status,
        area: options.area,
        type: options.type,
        search: options.search
      });

      res.json({
        success: true,
        data: cameras,
        pagination: {
          total,
          limit: options.limit,
          offset: options.offset,
          pages: Math.ceil(total / options.limit)
        }
      });
    } catch (error) {
      console.error('Error getting cameras:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cameras',
        error: error.message
      });
    }
  }

  // Get camera by ID
  static async getCameraById(req, res) {
    try {
      const { id } = req.params;
      const camera = await Camera.getById(id);

      if (!camera) {
        return res.status(404).json({
          success: false,
          message: 'Camera not found'
        });
      }

      res.json({
        success: true,
        data: camera
      });
    } catch (error) {
      console.error('Error getting camera:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve camera',
        error: error.message
      });
    }
  }

  // Create new camera
  static async createCamera(req, res) {
    try {
      const cameraData = req.body;
      
      // Validate required fields
      const requiredFields = ['id', 'label', 'area'];
      for (const field of requiredFields) {
        if (!cameraData[field]) {
          return res.status(400).json({
            success: false,
            message: `Field '${field}' is required`
          });
        }
      }

      const camera = await Camera.create(cameraData);

      // Log activity
      await SecurityActivity.create({
        type: 'CAMERA_CREATED',
        ref_id: camera.id,
        actor: req.user?.name || 'System',
        note: `Camera '${camera.label}' created at ${camera.area}`,
        severity: 'INFO',
        source: 'admin_panel'
      });

      res.status(201).json({
        success: true,
        message: 'Camera created successfully',
        data: camera
      });
    } catch (error) {
      console.error('Error creating camera:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create camera',
        error: error.message
      });
    }
  }

  // Update camera
  static async updateCamera(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingCamera = await Camera.getById(id);
      if (!existingCamera) {
        return res.status(404).json({
          success: false,
          message: 'Camera not found'
        });
      }

      const success = await Camera.update(id, updateData);
      
      if (success) {
        const updatedCamera = await Camera.getById(id);
        
        // Log activity
        await SecurityActivity.create({
          type: 'CAMERA_UPDATED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Camera '${existingCamera.label}' updated`,
          severity: 'INFO',
          source: 'admin_panel'
        });

        res.json({
          success: true,
          message: 'Camera updated successfully',
          data: updatedCamera
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to update camera'
        });
      }
    } catch (error) {
      console.error('Error updating camera:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update camera',
        error: error.message
      });
    }
  }

  // Update camera status
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'ERROR'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
        });
      }

      const existingCamera = await Camera.getById(id);
      if (!existingCamera) {
        return res.status(404).json({
          success: false,
          message: 'Camera not found'
        });
      }

      const success = await Camera.updateStatus(id, { status });

      if (success) {
        // Log activity
        await SecurityActivity.create({
          type: 'CAMERA_STATUS_UPDATED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Camera '${existingCamera.label}' status changed from ${existingCamera.status} to ${status}`,
          severity: status === 'ERROR' ? 'ERROR' : 'INFO',
          source: 'admin_panel'
        });

        res.json({
          success: true,
          message: 'Camera status updated successfully',
          data: { id, status }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to update camera status'
        });
      }
    } catch (error) {
      console.error('Error updating camera status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update camera status',
        error: error.message
      });
    }
  }

  // Delete camera
  static async deleteCamera(req, res) {
    try {
      const { id } = req.params;
      
      const existingCamera = await Camera.getById(id);
      if (!existingCamera) {
        return res.status(404).json({
          success: false,
          message: 'Camera not found'
        });
      }

      const success = await Camera.delete(id);
      
      if (success) {
        // Log activity
        await SecurityActivity.create({
          type: 'CAMERA_DELETED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Camera '${existingCamera.label}' deleted from ${existingCamera.area}`,
          severity: 'WARNING',
          source: 'admin_panel'
        });

        res.json({
          success: true,
          message: 'Camera deleted successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to delete camera'
        });
      }
    } catch (error) {
      console.error('Error deleting camera:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete camera',
        error: error.message
      });
    }
  }

  // Camera heartbeat endpoint
  static async heartbeat(req, res) {
    try {
      const { camera_id } = req.params;
      const { status, cpu_usage, memory_usage, disk_usage, temperature, error_message } = req.body;

      // Validate camera exists
      const camera = await Camera.getById(camera_id);
      if (!camera) {
        return res.status(404).json({
          success: false,
          message: 'Camera not found'
        });
      }

      // Update camera status
      await Camera.updateStatus(camera_id, { status: status || 'ONLINE' });

      // Create health log entry
      const healthData = {
        camera_id,
        status: status || 'ONLINE',
        cpu_usage: cpu_usage || null,
        memory_usage: memory_usage || null,
        disk_usage: disk_usage || null,
        temperature: temperature || null,
        error_message: error_message || null
      };

      await CameraHealthLog.create(healthData);

      // Log critical issues
      if (status === 'OFFLINE' || status === 'ERROR') {
        await SecurityActivity.create({
          type: 'CAMERA_ISSUE',
          ref_id: camera_id,
          actor: 'System',
          note: `Camera '${camera.label}' status: ${status}${error_message ? ` - ${error_message}` : ''}`,
          severity: status === 'OFFLINE' ? 'ERROR' : 'CRITICAL',
          source: 'camera_heartbeat'
        });
      }

      res.json({
        success: true,
        message: 'Heartbeat received',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error processing heartbeat:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process heartbeat',
        error: error.message
      });
    }
  }

  // Get camera statistics
  static async getStats(req, res) {
    try {
      const stats = await Camera.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting camera stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve camera statistics',
        error: error.message
      });
    }
  }

  // Get cameras by area
  static async getCamerasByArea(req, res) {
    try {
      const { area } = req.params;
      const cameras = await Camera.getByArea(area);
      
      res.json({
        success: true,
        data: cameras
      });
    } catch (error) {
      console.error('Error getting cameras by area:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cameras by area',
        error: error.message
      });
    }
  }

  // Get cameras by status
  static async getCamerasByStatus(req, res) {
    try {
      const { status } = req.params;
      const cameras = await Camera.getByStatus(status);
      
      res.json({
        success: true,
        data: cameras
      });
    } catch (error) {
      console.error('Error getting cameras by status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cameras by status',
        error: error.message
      });
    }
  }

  // Get camera health logs
  static async getCameraHealthLogs(req, res) {
    try {
      const { camera_id } = req.params;
      const { limit = 50, hours = 24 } = req.query;

      const logs = await CameraHealthLog.getByCamera(camera_id, {
        limit: parseInt(limit),
        hours: parseInt(hours)
      });
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('Error getting camera health logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve camera health logs',
        error: error.message
      });
    }
  }

  // Get camera health analysis
  static async getCameraHealthAnalysis(req, res) {
    try {
      const { camera_id } = req.params;
      const { hours = 24 } = req.query;

      const analysis = await CameraHealthLog.getHealthAnalysis(camera_id, parseInt(hours));
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Error getting camera health analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve camera health analysis',
        error: error.message
      });
    }
  }

  // Get dashboard data
  static async getDashboardData(req, res) {
    try {
      const stats = await Camera.getDashboardStats();
      const recentIssues = await CameraHealthLog.getRecentIssues(10);
      
      res.json({
        success: true,
        data: {
          stats,
          recent_issues: recentIssues
        }
      });
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dashboard data',
        error: error.message
      });
    }
  }

  // Bulk update camera status
  static async bulkUpdateStatus(req, res) {
    try {
      const { camera_ids, status } = req.body;

      if (!Array.isArray(camera_ids) || camera_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'camera_ids must be a non-empty array'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'status is required'
        });
      }

      const results = [];
      for (const camera_id of camera_ids) {
        try {
          const success = await Camera.updateStatus(camera_id, { status });
          results.push({ camera_id, success });
          
          if (success) {
            const camera = await Camera.getById(camera_id);
            await SecurityActivity.create({
              type: 'CAMERA_STATUS_CHANGED',
              ref_id: camera_id,
              actor: req.user?.name || 'System',
              note: `Camera '${camera?.label || camera_id}' status changed to ${status}`,
              severity: 'INFO',
              source: 'bulk_update'
            });
          }
        } catch (error) {
          results.push({ camera_id, success: false, error: error.message });
        }
      }

      res.json({
        success: true,
        message: 'Bulk update completed',
        data: results
      });
    } catch (error) {
      console.error('Error in bulk update:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk update',
        error: error.message
      });
    }
  }
}

module.exports = CameraController;