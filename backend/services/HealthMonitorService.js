const cron = require('node-cron');
const Camera = require('../models/Camera');
const CameraHealthLog = require('../models/CameraHealthLog');
const TeamMember = require('../models/TeamMember');
const SecurityActivity = require('../models/SecurityActivity');
const WebSocketService = require('./WebSocketService');

class HealthMonitorService {
  constructor() {
    this.isRunning = false;
    this.monitoringTasks = new Map();
    this.healthThresholds = {
      camera: {
        offline_threshold: 5 * 60 * 1000, // 5 minutes
        response_time_threshold: 5000, // 5 seconds
        error_rate_threshold: 0.1 // 10%
      },
      team: {
        inactive_threshold: 30 * 60 * 1000, // 30 minutes
        location_update_threshold: 10 * 60 * 1000 // 10 minutes
      },
      system: {
        memory_threshold: 0.85, // 85%
        cpu_threshold: 0.80, // 80%
        disk_threshold: 0.90 // 90%
      }
    };
  }

  // Start health monitoring service
  start() {
    if (this.isRunning) {
      console.log('Health Monitor Service is already running');
      return;
    }

    console.log('Starting Health Monitor Service...');
    this.isRunning = true;

    // Schedule monitoring tasks
    this.scheduleCameraHealthCheck();
    this.scheduleTeamHealthCheck();
    this.scheduleSystemHealthCheck();
    this.scheduleDataCleanup();
    this.scheduleHealthReports();

    // Log service start
    this.logActivity({
      type: 'SYSTEM_SERVICE_STARTED',
      actor: 'HealthMonitorService',
      note: 'Health monitoring service started',
      severity: 'INFO'
    });

    console.log('Health Monitor Service started successfully');
  }

  // Stop health monitoring service
  stop() {
    if (!this.isRunning) {
      console.log('Health Monitor Service is not running');
      return;
    }

    console.log('Stopping Health Monitor Service...');
    this.isRunning = false;

    // Stop all scheduled tasks
    this.monitoringTasks.forEach((task, name) => {
      if (task && task.destroy) {
        task.destroy();
        console.log(`Stopped monitoring task: ${name}`);
      }
    });
    this.monitoringTasks.clear();

    // Log service stop
    this.logActivity({
      type: 'SYSTEM_SERVICE_STOPPED',
      actor: 'HealthMonitorService',
      note: 'Health monitoring service stopped',
      severity: 'INFO'
    });

    console.log('Health Monitor Service stopped');
  }

  // Schedule camera health checks
  scheduleCameraHealthCheck() {
    // Check camera health every 2 minutes
    const task = cron.schedule('*/2 * * * *', async () => {
      if (this.isRunning) {
        await this.checkCameraHealth();
      }
    }, {
      scheduled: false
    });

    this.monitoringTasks.set('camera_health', task);
    task.start();
    console.log('Camera health monitoring scheduled (every 2 minutes)');
  }

  // Schedule team health checks
  scheduleTeamHealthCheck() {
    // Check team health every 5 minutes
    const task = cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        await this.checkTeamHealth();
      }
    }, {
      scheduled: false
    });

    this.monitoringTasks.set('team_health', task);
    task.start();
    console.log('Team health monitoring scheduled (every 5 minutes)');
  }

  // Schedule system health checks
  scheduleSystemHealthCheck() {
    // Check system health every 10 minutes
    const task = cron.schedule('*/10 * * * *', async () => {
      if (this.isRunning) {
        await this.checkSystemHealth();
      }
    }, {
      scheduled: false
    });

    this.monitoringTasks.set('system_health', task);
    task.start();
    console.log('System health monitoring scheduled (every 10 minutes)');
  }

  // Schedule data cleanup
  scheduleDataCleanup() {
    // Clean up old data daily at 2 AM
    const task = cron.schedule('0 2 * * *', async () => {
      if (this.isRunning) {
        await this.performDataCleanup();
      }
    }, {
      scheduled: false
    });

    this.monitoringTasks.set('data_cleanup', task);
    task.start();
    console.log('Data cleanup scheduled (daily at 2 AM)');
  }

  // Schedule health reports
  scheduleHealthReports() {
    // Generate health reports every hour
    const task = cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        await this.generateHealthReport();
      }
    }, {
      scheduled: false
    });

    this.monitoringTasks.set('health_reports', task);
    task.start();
    console.log('Health reports scheduled (every hour)');
  }

  // Check camera health
  async checkCameraHealth() {
    try {
      console.log('Checking camera health...');
      const cameras = await Camera.getAll().catch(err => {
        console.error('Error fetching cameras:', err.message);
        return []; // Return empty array if camera fetch fails
      });
      const now = new Date();
      const issues = [];

      for (const camera of cameras) {
        const healthData = {
          camera_id: camera.id,
          timestamp: now,
          status: camera.status,
          response_time: 0, // Default to 0 instead of null
          health_score: 100,
          error_message: null,
          stream_accessible: true,
          error_count: 0,
          metadata: {}
        };

        // Check if camera is offline for too long
        if (camera.status === 'OFFLINE') {
          const offlineTime = now - new Date(camera.last_seen);
          if (offlineTime > this.healthThresholds.camera.offline_threshold) {
            issues.push({
              type: 'CAMERA_OFFLINE_TOO_LONG',
              camera_id: camera.id,
              camera_name: camera.name,
              offline_duration: offlineTime,
              severity: 'ERROR'
            });
          }
        }

        // Simulate health check (in real implementation, you would ping the camera)
        if (camera.status === 'ONLINE') {
          const responseTime = Math.random() * 3000 + 500; // Simulate 500-3500ms response
          healthData.response_time = responseTime;
          
          if (responseTime > this.healthThresholds.camera.response_time_threshold) {
            issues.push({
              type: 'CAMERA_SLOW_RESPONSE',
              camera_id: camera.id,
              camera_name: camera.name,
              response_time: responseTime,
              severity: 'WARNING'
            });
          }
        }

        // Log health data
        await CameraHealthLog.create(healthData);
      }

      // Process and report issues
      if (issues.length > 0) {
        await this.handleCameraIssues(issues);
      }

      console.log(`Camera health check completed. Found ${issues.length} issues.`);

    } catch (error) {
      console.error('Error checking camera health:', error);
      await this.logActivity({
        type: 'HEALTH_CHECK_ERROR',
        actor: 'HealthMonitorService',
        note: `Camera health check failed: ${error.message}`,
        severity: 'ERROR'
      });
    }
  }

  // Check team health
  async checkTeamHealth() {
    try {
      console.log('Checking team health...');
      const teamMembers = await TeamMember.getAll();
      const now = new Date();
      const issues = [];

      for (const member of teamMembers) {
        if (member.duty_status === 'ON_DUTY') {
          // Check if member hasn't updated location recently
          if (member.last_location_update) {
            const locationUpdateTime = now - new Date(member.last_location_update);
            if (locationUpdateTime > this.healthThresholds.team.location_update_threshold) {
              issues.push({
                type: 'TEAM_MEMBER_LOCATION_STALE',
                member_id: member.id,
                member_name: member.name,
                last_update: member.last_location_update,
                stale_duration: locationUpdateTime,
                severity: 'WARNING'
              });
            }
          }

          // Check if member has been inactive for too long
          if (member.last_activity) {
            const inactiveTime = now - new Date(member.last_activity);
            if (inactiveTime > this.healthThresholds.team.inactive_threshold) {
              issues.push({
                type: 'TEAM_MEMBER_INACTIVE',
                member_id: member.id,
                member_name: member.name,
                last_activity: member.last_activity,
                inactive_duration: inactiveTime,
                severity: 'WARNING'
              });
            }
          }
        }
      }

      // Process and report issues
      if (issues.length > 0) {
        await this.handleTeamIssues(issues);
      }

      console.log(`Team health check completed. Found ${issues.length} issues.`);

    } catch (error) {
      console.error('Error checking team health:', error);
      await this.logActivity({
        type: 'HEALTH_CHECK_ERROR',
        actor: 'HealthMonitorService',
        note: `Team health check failed: ${error.message}`,
        severity: 'ERROR'
      });
    }
  }

  // Check system health
  async checkSystemHealth() {
    try {
      console.log('Checking system health...');
      const systemHealth = await this.getSystemMetrics();
      const issues = [];

      // Check memory usage
      if (systemHealth.memory.usage_percentage > this.healthThresholds.system.memory_threshold) {
        issues.push({
          type: 'HIGH_MEMORY_USAGE',
          value: systemHealth.memory.usage_percentage,
          threshold: this.healthThresholds.system.memory_threshold,
          severity: 'WARNING'
        });
      }

      // Check CPU usage
      if (systemHealth.cpu.usage_percentage > this.healthThresholds.system.cpu_threshold) {
        issues.push({
          type: 'HIGH_CPU_USAGE',
          value: systemHealth.cpu.usage_percentage,
          threshold: this.healthThresholds.system.cpu_threshold,
          severity: 'WARNING'
        });
      }

      // Check disk usage
      if (systemHealth.disk.usage_percentage > this.healthThresholds.system.disk_threshold) {
        issues.push({
          type: 'HIGH_DISK_USAGE',
          value: systemHealth.disk.usage_percentage,
          threshold: this.healthThresholds.system.disk_threshold,
          severity: 'ERROR'
        });
      }

      // Process and report issues
      if (issues.length > 0) {
        await this.handleSystemIssues(issues);
      }

      // Broadcast system health to monitoring clients
      WebSocketService.broadcastToRoom('monitoring_room', 'system_health_update', {
        health: systemHealth,
        issues: issues,
        timestamp: new Date()
      });

      console.log(`System health check completed. Found ${issues.length} issues.`);

    } catch (error) {
      console.error('Error checking system health:', error);
      await this.logActivity({
        type: 'HEALTH_CHECK_ERROR',
        actor: 'HealthMonitorService',
        note: `System health check failed: ${error.message}`,
        severity: 'ERROR'
      });
    }
  }

  // Handle camera issues
  async handleCameraIssues(issues) {
    for (const issue of issues) {
      // Log the issue
      await this.logActivity({
        type: issue.type,
        ref_id: issue.camera_id,
        actor: 'HealthMonitorService',
        note: `Camera ${issue.camera_name}: ${this.getIssueDescription(issue)}`,
        severity: issue.severity,
        metadata: JSON.stringify(issue)
      });

      // Send alert for critical issues
      if (issue.severity === 'ERROR') {
        WebSocketService.broadcastToRoom('alerts_room', 'camera_health_alert', {
          ...issue,
          timestamp: new Date()
        });
      }
    }
  }

  // Handle team issues
  async handleTeamIssues(issues) {
    for (const issue of issues) {
      // Log the issue
      await this.logActivity({
        type: issue.type,
        ref_id: issue.member_id,
        actor: 'HealthMonitorService',
        note: `Team member ${issue.member_name}: ${this.getIssueDescription(issue)}`,
        severity: issue.severity,
        metadata: JSON.stringify(issue)
      });

      // Send alert for critical issues
      if (issue.severity === 'ERROR') {
        WebSocketService.broadcastToRoom('alerts_room', 'team_health_alert', {
          ...issue,
          timestamp: new Date()
        });
      }
    }
  }

  // Handle system issues
  async handleSystemIssues(issues) {
    for (const issue of issues) {
      // Log the issue
      await this.logActivity({
        type: issue.type,
        actor: 'HealthMonitorService',
        note: `System ${issue.type.toLowerCase().replace('_', ' ')}: ${issue.value.toFixed(2)}% (threshold: ${(issue.threshold * 100).toFixed(0)}%)`,
        severity: issue.severity,
        metadata: JSON.stringify(issue)
      });

      // Send alert for critical issues
      if (issue.severity === 'ERROR') {
        WebSocketService.broadcastToRoom('alerts_room', 'system_health_alert', {
          ...issue,
          timestamp: new Date()
        });
      }
    }
  }

  // Get system metrics
  async getSystemMetrics() {
    const os = require('os');
    const process = require('process');

    // Memory metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // CPU metrics (simplified)
    const cpus = os.cpus();
    const loadAverage = os.loadavg();

    // Process metrics
    const processMemory = process.memoryUsage();

    return {
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usage_percentage: usedMemory / totalMemory
      },
      cpu: {
        count: cpus.length,
        load_average: loadAverage,
        usage_percentage: Math.min(loadAverage[0] / cpus.length, 1) // Simplified CPU usage
      },
      disk: {
        usage_percentage: 0.3 // Placeholder - would need additional library for real disk usage
      },
      process: {
        memory: processMemory,
        uptime: process.uptime(),
        pid: process.pid
      },
      timestamp: new Date()
    };
  }

  // Perform data cleanup
  async performDataCleanup() {
    try {
      console.log('Performing data cleanup...');
      
      // Clean up old camera health logs (older than 30 days)
      const healthLogsDeleted = await CameraHealthLog.cleanup(30);
      
      // Clean up old security activities (older than 90 days)
      const activitiesDeleted = await SecurityActivity.cleanup(90);
      
      // Clean up old team location history (older than 60 days)
      // This would be implemented in TeamLocationHistory model
      
      await this.logActivity({
        type: 'DATA_CLEANUP_COMPLETED',
        actor: 'HealthMonitorService',
        note: `Data cleanup completed. Deleted ${healthLogsDeleted} health logs, ${activitiesDeleted} activities`,
        severity: 'INFO'
      });

      console.log(`Data cleanup completed. Deleted ${healthLogsDeleted} health logs, ${activitiesDeleted} activities`);

    } catch (error) {
      console.error('Error during data cleanup:', error);
      await this.logActivity({
        type: 'DATA_CLEANUP_ERROR',
        actor: 'HealthMonitorService',
        note: `Data cleanup failed: ${error.message}`,
        severity: 'ERROR'
      });
    }
  }

  // Generate health report
  async generateHealthReport() {
    try {
      console.log('Generating health report...');
      
      const [cameraStats, teamStats, activityStats, systemHealth] = await Promise.all([
        Camera.getStats(),
        TeamMember.getStats(),
        SecurityActivity.getStats('1h'),
        this.getSystemMetrics()
      ]);

      const healthReport = {
        timestamp: new Date(),
        cameras: {
          total: cameraStats.total,
          online: cameraStats.online,
          offline: cameraStats.offline,
          health_percentage: cameraStats.total > 0 ? (cameraStats.online / cameraStats.total) * 100 : 0
        },
        team: {
          total: teamStats.total,
          on_duty: teamStats.on_duty,
          off_duty: teamStats.off_duty,
          availability_percentage: teamStats.total > 0 ? (teamStats.on_duty / teamStats.total) * 100 : 0
        },
        activities: {
          total_last_hour: activityStats.total,
          errors_last_hour: activityStats.error,
          warnings_last_hour: activityStats.warning
        },
        system: {
          memory_usage: (systemHealth.memory.usage_percentage * 100).toFixed(2),
          cpu_usage: (systemHealth.cpu.usage_percentage * 100).toFixed(2),
          uptime: systemHealth.process.uptime
        },
        overall_health: this.calculateOverallHealth(cameraStats, teamStats, systemHealth)
      };

      // Broadcast health report
      WebSocketService.broadcastToRoom('monitoring_room', 'health_report', healthReport);

      // Log report generation
      await this.logActivity({
        type: 'HEALTH_REPORT_GENERATED',
        actor: 'HealthMonitorService',
        note: `Health report generated. Overall health: ${healthReport.overall_health}%`,
        severity: 'INFO',
        metadata: JSON.stringify(healthReport)
      });

      console.log(`Health report generated. Overall health: ${healthReport.overall_health}%`);

    } catch (error) {
      console.error('Error generating health report:', error);
      await this.logActivity({
        type: 'HEALTH_REPORT_ERROR',
        actor: 'HealthMonitorService',
        note: `Health report generation failed: ${error.message}`,
        severity: 'ERROR'
      });
    }
  }

  // Calculate overall system health percentage
  calculateOverallHealth(cameraStats, teamStats, systemHealth) {
    let healthScore = 0;
    let maxScore = 0;

    // Camera health (30% weight)
    if (cameraStats.total > 0) {
      healthScore += (cameraStats.online / cameraStats.total) * 30;
    }
    maxScore += 30;

    // Team health (25% weight)
    if (teamStats.total > 0) {
      healthScore += (teamStats.on_duty / teamStats.total) * 25;
    }
    maxScore += 25;

    // System health (45% weight)
    const memoryHealth = Math.max(0, 1 - systemHealth.memory.usage_percentage) * 15;
    const cpuHealth = Math.max(0, 1 - systemHealth.cpu.usage_percentage) * 15;
    const diskHealth = Math.max(0, 1 - systemHealth.disk.usage_percentage) * 15;
    
    healthScore += memoryHealth + cpuHealth + diskHealth;
    maxScore += 45;

    return maxScore > 0 ? Math.round((healthScore / maxScore) * 100) : 0;
  }

  // Get issue description
  getIssueDescription(issue) {
    switch (issue.type) {
      case 'CAMERA_OFFLINE_TOO_LONG':
        return `offline for ${Math.round(issue.offline_duration / 60000)} minutes`;
      case 'CAMERA_SLOW_RESPONSE':
        return `slow response time: ${Math.round(issue.response_time)}ms`;
      case 'TEAM_MEMBER_LOCATION_STALE':
        return `location not updated for ${Math.round(issue.stale_duration / 60000)} minutes`;
      case 'TEAM_MEMBER_INACTIVE':
        return `inactive for ${Math.round(issue.inactive_duration / 60000)} minutes`;
      case 'HIGH_MEMORY_USAGE':
        return `high memory usage: ${(issue.value * 100).toFixed(1)}%`;
      case 'HIGH_CPU_USAGE':
        return `high CPU usage: ${(issue.value * 100).toFixed(1)}%`;
      case 'HIGH_DISK_USAGE':
        return `high disk usage: ${(issue.value * 100).toFixed(1)}%`;
      default:
        return 'unknown issue';
    }
  }

  // Log activity
  async logActivity(activityData) {
    try {
      await SecurityActivity.createActivity({
        ...activityData,
        source: 'health_monitor'
      });
    } catch (error) {
      console.error('Error logging activity:', error.message);
      // Don't throw error to prevent service startup failure
      // The health monitor service should continue running even if logging fails
    }
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.monitoringTasks.keys()),
      thresholds: this.healthThresholds,
      startedAt: this.startedAt
    };
  }

  // Update health thresholds
  updateThresholds(newThresholds) {
    this.healthThresholds = {
      ...this.healthThresholds,
      ...newThresholds
    };
    
    console.log('Health thresholds updated:', this.healthThresholds);
  }
}

// Export singleton instance
module.exports = new HealthMonitorService();