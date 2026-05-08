const SecurityActivity = require('../models/SecurityActivity');

class ActivityController {
  // Get all activities with optional filters
  static async getAllActivities(req, res) {
    try {
      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        type: req.query.type,
        severity: req.query.severity,
        actor: req.query.actor,
        startDate: req.query.start_date,
        endDate: req.query.end_date
      };

      const activities = await SecurityActivity.getAll(options);
      const total = await SecurityActivity.getCount({
        type: options.type,
        severity: options.severity,
        actor: options.actor,
        startDate: options.startDate,
        endDate: options.endDate
      });

      res.json({
        success: true,
        data: activities,
        pagination: {
          total,
          limit: options.limit,
          offset: options.offset,
          pages: Math.ceil(total / options.limit)
        }
      });
    } catch (error) {
      console.error('Error getting activities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activities',
        error: error.message
      });
    }
  }

  // Get activity by ID
  static async getActivityById(req, res) {
    try {
      const { id } = req.params;
      const activity = await SecurityActivity.getById(id);

      if (!activity) {
        return res.status(404).json({
          success: false,
          message: 'Activity not found'
        });
      }

      res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      console.error('Error getting activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity',
        error: error.message
      });
    }
  }

  // Create new activity log
  static async createActivity(req, res) {
    try {
      const activityData = req.body;
      
      // Validate required fields
      const requiredFields = ['type', 'actor', 'note'];
      for (const field of requiredFields) {
        if (!activityData[field]) {
          return res.status(400).json({
            success: false,
            message: `Field '${field}' is required`
          });
        }
      }

      // Set default source if not provided
      if (!activityData.source) {
        activityData.source = 'manual_entry';
      }

      const activity = await SecurityActivity.create(activityData);

      res.status(201).json({
        success: true,
        message: 'Activity logged successfully',
        data: activity
      });
    } catch (error) {
      console.error('Error creating activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to log activity',
        error: error.message
      });
    }
  }

  // Update activity
  static async updateActivity(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingActivity = await SecurityActivity.getById(id);
      if (!existingActivity) {
        return res.status(404).json({
          success: false,
          message: 'Activity not found'
        });
      }

      const success = await SecurityActivity.update(id, updateData);
      
      if (success) {
        const updatedActivity = await SecurityActivity.getById(id);
        
        res.json({
          success: true,
          message: 'Activity updated successfully',
          data: updatedActivity
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to update activity'
        });
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update activity',
        error: error.message
      });
    }
  }

  // Delete activity
  static async deleteActivity(req, res) {
    try {
      const { id } = req.params;
      
      const existingActivity = await SecurityActivity.getById(id);
      if (!existingActivity) {
        return res.status(404).json({
          success: false,
          message: 'Activity not found'
        });
      }

      const success = await SecurityActivity.delete(id);
      
      if (success) {
        res.json({
          success: true,
          message: 'Activity deleted successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to delete activity'
        });
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete activity',
        error: error.message
      });
    }
  }

  // Get recent activities
  static async getRecentActivities(req, res) {
    try {
      const { limit = 20 } = req.query;
      const activities = await SecurityActivity.getRecent(parseInt(limit));
      
      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('Error getting recent activities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recent activities',
        error: error.message
      });
    }
  }

  // Get activity statistics
  static async getStats(req, res) {
    try {
      const { period = '24h' } = req.query;
      const stats = await SecurityActivity.getStats(period);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting activity stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity statistics',
        error: error.message
      });
    }
  }

  // Get activities by type
  static async getActivitiesByType(req, res) {
    try {
      const { type } = req.params;
      const { limit = 50 } = req.query;
      
      const activities = await SecurityActivity.getByType(type, parseInt(limit));
      
      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('Error getting activities by type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activities by type',
        error: error.message
      });
    }
  }

  // Get activities by severity
  static async getActivitiesBySeverity(req, res) {
    try {
      const { severity } = req.params;
      const { limit = 50 } = req.query;
      
      const activities = await SecurityActivity.getBySeverity(severity, parseInt(limit));
      
      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('Error getting activities by severity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activities by severity',
        error: error.message
      });
    }
  }

  // Get activities by actor
  static async getActivitiesByActor(req, res) {
    try {
      const { actor } = req.params;
      const { limit = 50 } = req.query;
      
      const activities = await SecurityActivity.getByActor(actor, parseInt(limit));
      
      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('Error getting activities by actor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activities by actor',
        error: error.message
      });
    }
  }

  // Get activities by reference ID
  static async getActivitiesByRefId(req, res) {
    try {
      const { ref_id } = req.params;
      
      const activities = await SecurityActivity.getByRefId(ref_id);
      
      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('Error getting activities by ref_id:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activities by reference ID',
        error: error.message
      });
    }
  }

  // Helper method to get activities by reference ID directly (for internal use)
  static async getActivitiesByRefIdDirect(refId, options = {}) {
    try {
      const activities = await SecurityActivity.getByRefId(refId, options);
      return activities;
    } catch (error) {
      console.error('Error getting activities by ref_id (direct):', error);
      throw error;
    }
  }

  // Get activity trend
  static async getActivityTrend(req, res) {
    try {
      const { hours = 24 } = req.query;
      const trend = await SecurityActivity.getActivityTrend(parseInt(hours));
      
      res.json({
        success: true,
        data: trend
      });
    } catch (error) {
      console.error('Error getting activity trend:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity trend',
        error: error.message
      });
    }
  }

  // Get top actors
  static async getTopActors(req, res) {
    try {
      const { limit = 10, period = '24h' } = req.query;
      const actors = await SecurityActivity.getTopActors(parseInt(limit), period);
      
      res.json({
        success: true,
        data: actors
      });
    } catch (error) {
      console.error('Error getting top actors:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve top actors',
        error: error.message
      });
    }
  }

  // Get critical activities
  static async getCriticalActivities(req, res) {
    try {
      const { hours = 24 } = req.query;
      const activities = await SecurityActivity.getCriticalActivities(parseInt(hours));
      
      res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('Error getting critical activities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve critical activities',
        error: error.message
      });
    }
  }

  // Log security incident
  static async logIncident(req, res) {
    try {
      const {
        title,
        description,
        location,
        severity = 'WARNING',
        reporter,
        witnesses,
        evidence,
        actions_taken
      } = req.body;

      if (!title || !description || !location) {
        return res.status(400).json({
          success: false,
          message: 'Title, description, and location are required'
        });
      }

      const metadata = {
        location,
        reporter,
        witnesses,
        evidence,
        actions_taken
      };

      const activity = await SecurityActivity.create({
        type: 'SECURITY_INCIDENT',
        actor: reporter || req.user?.name || 'Unknown',
        note: `${title}: ${description}`,
        severity,
        metadata: JSON.stringify(metadata),
        source: 'incident_report'
      });

      res.status(201).json({
        success: true,
        message: 'Security incident logged successfully',
        data: activity
      });
    } catch (error) {
      console.error('Error logging incident:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to log security incident',
        error: error.message
      });
    }
  }

  // Log patrol activity
  static async logPatrol(req, res) {
    try {
      const {
        patrol_officer,
        route,
        start_time,
        end_time,
        observations,
        issues_found,
        actions_taken
      } = req.body;

      if (!patrol_officer || !route) {
        return res.status(400).json({
          success: false,
          message: 'Patrol officer and route are required'
        });
      }

      const metadata = {
        route,
        start_time,
        end_time,
        observations,
        issues_found,
        actions_taken
      };

      const activity = await SecurityActivity.create({
        type: 'PATROL_COMPLETED',
        actor: patrol_officer,
        note: `Patrol completed on route: ${route}`,
        severity: issues_found && issues_found.length > 0 ? 'WARNING' : 'INFO',
        metadata: JSON.stringify(metadata),
        source: 'patrol_log'
      });

      res.status(201).json({
        success: true,
        message: 'Patrol activity logged successfully',
        data: activity
      });
    } catch (error) {
      console.error('Error logging patrol:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to log patrol activity',
        error: error.message
      });
    }
  }

  // Log visitor entry
  static async logVisitor(req, res) {
    try {
      const {
        visitor_name,
        visitor_id,
        purpose,
        host_name,
        entry_time,
        exit_time,
        gate_officer
      } = req.body;

      if (!visitor_name || !purpose || !host_name) {
        return res.status(400).json({
          success: false,
          message: 'Visitor name, purpose, and host name are required'
        });
      }

      const metadata = {
        visitor_id,
        purpose,
        host_name,
        entry_time,
        exit_time
      };

      const activity = await SecurityActivity.create({
        type: 'VISITOR_ENTRY',
        actor: gate_officer || req.user?.name || 'Gate Officer',
        note: `Visitor ${visitor_name} entered to visit ${host_name}`,
        severity: 'INFO',
        metadata: JSON.stringify(metadata),
        source: 'visitor_log'
      });

      res.status(201).json({
        success: true,
        message: 'Visitor entry logged successfully',
        data: activity
      });
    } catch (error) {
      console.error('Error logging visitor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to log visitor entry',
        error: error.message
      });
    }
  }

  // Clean up old activities
  static async cleanupOldActivities(req, res) {
    try {
      const { days_to_keep = 90 } = req.body;
      
      const deletedCount = await SecurityActivity.cleanupOldActivities(parseInt(days_to_keep));
      
      // Log cleanup activity
      await SecurityActivity.create({
        type: 'SYSTEM_CLEANUP',
        actor: req.user?.name || 'System',
        note: `Cleaned up ${deletedCount} old activity records (older than ${days_to_keep} days)`,
        severity: 'INFO',
        source: 'system_maintenance'
      });

      res.json({
        success: true,
        message: `Successfully cleaned up ${deletedCount} old activity records`,
        data: { deleted_count: deletedCount }
      });
    } catch (error) {
      console.error('Error cleaning up activities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clean up old activities',
        error: error.message
      });
    }
  }

  // Export activities to CSV
  static async exportActivities(req, res) {
    try {
      const {
        start_date,
        end_date,
        type,
        severity,
        actor
      } = req.query;

      // Log export activity for audit trail
      await SecurityActivity.create({
        type: 'EXPORT_ACTIVITIES',
        actor: req.user.name || req.user.email,
        note: `Exported activities data with filters: ${JSON.stringify({
          start_date, end_date, type, severity, actor
        })}`,
        severity: 'INFO',
        source: 'system',
        metadata: {
          user_id: req.user.id,
          user_role: req.user.role,
          export_filters: { start_date, end_date, type, severity, actor },
          ip_address: req.ip || req.connection.remoteAddress,
          user_agent: req.get('User-Agent')
        }
      });

      const activities = await SecurityActivity.getAll({
        startDate: start_date,
        endDate: end_date,
        type,
        severity,
        actor,
        limit: 10000 // Large limit for export
      });

      // Sanitize sensitive data for export
      const sanitizedActivities = activities.map(activity => {
        const sanitized = { ...activity };
        
        // Mask sensitive information in notes
        if (sanitized.note) {
          sanitized.note = sanitized.note
            .replace(/password[\s]*[:=][\s]*[^\s,;]+/gi, 'password: [REDACTED]')
            .replace(/token[\s]*[:=][\s]*[^\s,;]+/gi, 'token: [REDACTED]')
            .replace(/key[\s]*[:=][\s]*[^\s,;]+/gi, 'key: [REDACTED]')
            .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD-REDACTED]')
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL-REDACTED]');
        }
        
        // Remove sensitive metadata
        if (sanitized.metadata && typeof sanitized.metadata === 'object') {
          const metadata = { ...sanitized.metadata };
          delete metadata.password;
          delete metadata.token;
          delete metadata.secret;
          delete metadata.key;
          sanitized.metadata = JSON.stringify(metadata);
        } else {
          sanitized.metadata = sanitized.metadata || '';
        }
        
        return sanitized;
      });

      // Convert to CSV format
      const csvHeader = 'ID,Type,Actor,Note,Severity,Timestamp,Source,Ref_ID,Metadata\n';
      const csvData = sanitizedActivities.map(activity => {
        return [
          activity.id,
          activity.type,
          activity.actor,
          `"${(activity.note || '').replace(/"/g, '""')}"`, // Escape quotes
          activity.severity,
          activity.timestamp,
          activity.source,
          activity.ref_id || '',
          `"${(activity.metadata || '').replace(/"/g, '""')}"`
        ].join(',');
      }).join('\n');

      const csv = csvHeader + csvData;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `security_activities_${timestamp}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(csv);
    } catch (error) {
      console.error('Error exporting activities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export activities',
        error: error.message
      });
    }
  }

  // Create activity directly with data (for internal use)
  static async createActivityDirect(activityData) {
    try {
      // Validate required fields
      const requiredFields = ['type', 'actor'];
      for (const field of requiredFields) {
        if (!activityData[field]) {
          throw new Error(`Field '${field}' is required`);
        }
      }

      // Map frontend fields to backend fields
      const mappedData = {
        type: activityData.type,
        actor: activityData.actor || activityData.performedBy,
        note: activityData.description || activityData.note,
        severity: activityData.severity || 'INFO',
        ref_id: activityData.referenceId,
        metadata: activityData.metadata || {},
        source: activityData.source || 'web-app',
        timestamp: activityData.timestamp || new Date().toISOString()
      };

      // Set default source if not provided
      if (!mappedData.source) {
        mappedData.source = 'manual_entry';
      }

      const activity = await SecurityActivity.create(mappedData);
      return activity;
    } catch (error) {
      console.error('Error creating activity directly:', error);
      throw error;
    }
  }
}

module.exports = ActivityController;