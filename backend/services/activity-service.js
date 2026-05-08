/**
 * Activity logging service untuk tracking user actions dan system events
 */
class ActivityService {
  constructor() {
    this.activities = [];
    this.maxActivities = 1000; // Keep last 1000 activities in memory
  }

  /**
   * Log activity dengan timestamp dan metadata
   */
  logActivity(type, description, metadata = {}) {
    const activity = {
      id: this.generateId(),
      type,
      description,
      metadata,
      timestamp: new Date().toISOString(),
      userId: metadata.userId || 'system'
    };

    this.activities.unshift(activity);
    
    // Keep only recent activities
    if (this.activities.length > this.maxActivities) {
      this.activities = this.activities.slice(0, this.maxActivities);
    }

    console.log(`[Activity] ${type}: ${description}`, metadata);
    return activity;
  }

  /**
   * Get recent activities
   */
  getActivities(limit = 50, type = null) {
    let filtered = this.activities;
    
    if (type) {
      filtered = this.activities.filter(activity => activity.type === type);
    }
    
    return filtered.slice(0, limit);
  }

  /**
   * Clear all activities
   */
  clearActivities() {
    this.activities = [];
    console.log('[Activity] All activities cleared');
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Create singleton instance
const activityService = new ActivityService();

module.exports = {
  activityService,
  logActivity: (type, description, metadata) => activityService.logActivity(type, description, metadata),
  getActivities: (limit, type) => activityService.getActivities(limit, type),
  clearActivities: () => activityService.clearActivities()
};