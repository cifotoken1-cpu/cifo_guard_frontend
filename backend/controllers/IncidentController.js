/**
 * Incident Controller
 * Handles incident management operations including creation, updates, escalation, and tracking
 */

const Incident = require('../models/Incident');
const SecurityActivity = require('../models/SecurityActivity');
const TeamMember = require('../models/TeamMember');
const { Op } = require('sequelize');

class IncidentController {
  /**
   * Check for duplicate incidents in the database
   * @param {Object} incidentData - Incident data to check
   * @returns {Object|null} Duplicate incident or null if no duplicate found
   */
  static async checkDuplicateIncident(incidentData) {
    try {
      const { type, location, description } = incidentData;
      
      // Look for similar incidents created in the last 1 second (for testing)
      const oneSecondAgo = new Date(Date.now() - 1 * 1000);
      
      // Search for incidents with the same type and similar location
      const potentialDuplicates = await Incident.findAll({
          where: {
            type: type,
            createdAt: { [Op.gte]: oneSecondAgo }
          },
        limit: 5,
        order: [['createdAt', 'DESC']]
      });
      
      // Check if any of the potential duplicates have similar location and description
      for (const incident of potentialDuplicates) {
        // Check if locations are close (within ~100m)
        if (incident.location && location) {
          const locationMatch = this.areLocationsClose(
            incident.location.latitude, 
            incident.location.longitude,
            location.latitude,
            location.longitude
          );
          
          // If location matches and description is similar, consider it a duplicate
          if (locationMatch && this.areDescriptionsSimilar(incident.description, description)) {
            return incident;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('[IncidentController] Error checking for duplicate incidents:', error);
      return null;
    }
  }
  
  /**
   * Check if two locations are close to each other
   * @param {number} lat1 - Latitude of first location
   * @param {number} lon1 - Longitude of first location
   * @param {number} lat2 - Latitude of second location
   * @param {number} lon2 - Longitude of second location
   * @param {number} maxDistanceKm - Maximum distance in kilometers (default: 0.1 = 100m)
   * @returns {boolean} True if locations are close
   */
  static areLocationsClose(lat1, lon1, lat2, lon2, maxDistanceKm = 0.1) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return false;
    
    // Convert coordinates to numbers to ensure proper calculation
    lat1 = Number(lat1);
    lon1 = Number(lon1);
    lat2 = Number(lat2);
    lon2 = Number(lon2);
    
    // Haversine formula to calculate distance between two points
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance <= maxDistanceKm;
  }
  
  /**
   * Convert degrees to radians
   * @param {number} deg - Degrees
   * @returns {number} Radians
   */
  static deg2rad(deg) {
    return deg * (Math.PI/180);
  }
  
  /**
   * Check if two descriptions are similar
   * @param {string} desc1 - First description
   * @param {string} desc2 - Second description
   * @returns {boolean} True if descriptions are similar
   */
  static areDescriptionsSimilar(desc1, desc2) {
    if (!desc1 || !desc2) return false;
    
    // Convert to lowercase and remove punctuation
    const normalize = (text) => text.toLowerCase().replace(/[^\w\s]/g, '');
    
    const normalizedDesc1 = normalize(desc1);
    const normalizedDesc2 = normalize(desc2);
    
    // Check if one description contains the other
    return normalizedDesc1.includes(normalizedDesc2) || normalizedDesc2.includes(normalizedDesc1);
  }
  
  /**
   * Create new incident
   * @param {Object} incidentData - Incident data
   * @returns {Object} Created incident
   */
  static async createIncident(incidentData) {
    try {
      // Generate incident ID and number
      const incidentId = `INC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const incidentNumber = `INC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      const incident = await Incident.create({
        id: incidentId,
        incidentNumber: incidentNumber,
        type: incidentData.type,
        priority: incidentData.priority,
        status: 'OPEN',
        title: incidentData.title || `${incidentData.type} - ${incidentData.priority}`,
        description: incidentData.description,
        location: incidentData.location,
        reportedBy: incidentData.reportedBy,
        createdBy: incidentData.createdBy,
        metadata: incidentData.metadata || {},
        createdAt: incidentData.createdAt
      });

      // Log incident creation activity
      const getSeverityFromPriority = (priority) => {
        switch (priority) {
          case 'CRITICAL': return 'CRITICAL';
          case 'HIGH': return 'ERROR';
          case 'MEDIUM': return 'WARNING';
          case 'LOW': return 'INFO';
          default: return 'INFO';
        }
      };

      await SecurityActivity.create({
        type: 'INCIDENT_CREATED',
        actor: incidentData.reportedBy || incidentData.createdBy || 'system',
        note: `New ${incidentData.priority} priority ${incidentData.type} incident created`,
        ref_id: incident.id,
        severity: getSeverityFromPriority(incidentData.priority),
        metadata: {
          incidentId: incident.id,
          incidentType: incidentData.type,
          priority: incidentData.priority,
          location: incidentData.location
        }
      });

      // Auto-assign based on priority and type
      if (incidentData.priority === 'CRITICAL') {
        await this.autoAssignCriticalIncident(incident.id);
      }

      return incident;
    } catch (error) {
      console.error('[IncidentController] Error creating incident:', error);
      console.error('[IncidentController] Error details:', {
        message: error.message,
        stack: error.stack,
        sql: error.sql,
        parameters: error.parameters
      });
      throw error; // Throw original error instead of generic message
    }
  }

  /**
   * Get incidents with filters
   * @param {Object} filters - Filter options
   * @returns {Object} Incidents and total count
   */
  static async getIncidents(filters = {}) {
    try {
      const whereClause = {};
      
      // Apply filters
      if (filters.status) {
        whereClause.status = filters.status;
      }
      
      if (filters.priority) {
        whereClause.priority = filters.priority;
      }
      
      if (filters.type) {
        whereClause.type = filters.type;
      }
      
      if (filters.assignedTo) {
        whereClause.assignedTo = filters.assignedTo;
      }
      
      if (filters.reportedBy) {
        whereClause.reportedBy = filters.reportedBy;
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        whereClause.createdAt = {};
        if (filters.startDate) {
          whereClause.createdAt[Op.gte] = new Date(filters.startDate);
        }
        if (filters.endDate) {
          whereClause.createdAt[Op.lte] = new Date(filters.endDate);
        }
      }

      const { count, rows } = await Incident.findAndCountAll({
        where: whereClause,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        order: [['createdAt', 'DESC']]
        // Note: TeamMember associations removed due to model incompatibility
        // TeamMember uses raw MySQL while Incident uses Sequelize
      });

      return {
        incidents: rows,
        total: count
      };
    } catch (error) {
      console.error('[IncidentController] Error getting incidents:', error);
      throw new Error('Failed to fetch incidents');
    }
  }

  /**
   * Get incident by ID
   * @param {string} id - Incident ID
   * @returns {Object} Incident details
   */
  static async getIncidentById(id) {
    try {
      const incident = await Incident.findOne({
        where: { id }
      });

      if (!incident) {
        return null;
      }

      const incidentData = incident.toJSON();
      
      // Fetch related data separately since they use raw MySQL
      const [activities, reporter, assignedMember] = await Promise.all([
        SecurityActivity.getByRefId(id),
        incidentData.reportedBy ? TeamMember.getById(incidentData.reportedBy) : null,
        incidentData.assignedTo ? TeamMember.getById(incidentData.assignedTo) : null
      ]);
      
      // Add related data to the incident object
      incidentData.activities = activities || [];
      incidentData.reporter = reporter;
      incidentData.assignedMember = assignedMember;

      return incidentData;
    } catch (error) {
      console.error('[IncidentController] Error getting incident:', error);
      throw new Error('Failed to fetch incident');
    }
  }

  /**
   * Update incident
   * @param {string} id - Incident ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated incident
   */
  static async updateIncident(id, updateData) {
    try {
      const incident = await Incident.findOne({ where: { id } });
      
      if (!incident) {
        return null;
      }

      const previousData = {
        status: incident.status,
        priority: incident.priority,
        assignedTo: incident.assignedTo
      };

      // Update incident
      await incident.update(updateData);

      // Log status change activity
      if (updateData.status && updateData.status !== previousData.status) {
        await SecurityActivity.create({
          type: 'INCIDENT_STATUS_CHANGED',
          note: `Incident status changed from ${previousData.status} to ${updateData.status}`,
          actor: updateData.updatedBy,
          ref_id: id,
          severity: 'INFO',
          metadata: {
            incidentId: id,
            previousStatus: previousData.status,
            newStatus: updateData.status,
            notes: updateData.notes
          }
        });
      }

      // Log assignment change
      if (updateData.assignedTo && updateData.assignedTo !== previousData.assignedTo) {
        await SecurityActivity.create({
          type: 'INCIDENT_ASSIGNED',
          note: `Incident assigned to team member`,
          actor: updateData.updatedBy,
          ref_id: id,
          severity: 'INFO',
          metadata: {
            incidentId: id,
            assignedTo: updateData.assignedTo,
            previousAssignee: previousData.assignedTo
          }
        });
      }

      // Log priority change
      if (updateData.priority && updateData.priority !== previousData.priority) {
        await SecurityActivity.create({
          type: 'INCIDENT_PRIORITY_CHANGED',
          note: `Incident priority changed from ${previousData.priority} to ${updateData.priority}`,
          actor: updateData.updatedBy,
          ref_id: id,
          severity: 'INFO',
          metadata: {
            incidentId: id,
            previousPriority: previousData.priority,
            newPriority: updateData.priority
          }
        });
      }

      // Return updated incident with relations
      return await this.getIncidentById(id);
    } catch (error) {
      console.error('[IncidentController] Error updating incident:', error);
      throw new Error('Failed to update incident');
    }
  }

  /**
   * Escalate incident
   * @param {string} id - Incident ID
   * @param {Object} escalationData - Escalation data
   * @returns {Object} Updated incident
   */
  static async escalateIncident(id, escalationData) {
    try {
      const incident = await Incident.findOne({ where: { id } });
      
      if (!incident) {
        return null;
      }

      const updateData = {
        escalatedAt: escalationData.escalatedAt,
        escalatedBy: escalationData.escalatedBy,
        escalationReason: escalationData.reason,
        updatedBy: escalationData.escalatedBy,
        updatedAt: escalationData.escalatedAt
      };

      // Update priority if specified
      if (escalationData.newPriority) {
        updateData.priority = escalationData.newPriority;
      }

      // Update assignment if specified
      if (escalationData.escalatedTo) {
        updateData.assignedTo = escalationData.escalatedTo;
      }

      await incident.update(updateData);

      // Log escalation activity
      await SecurityActivity.create({
        type: 'INCIDENT_ESCALATED',
        description: `Incident escalated: ${escalationData.reason}`,
        userId: escalationData.escalatedBy,
        performedBy: escalationData.escalatedBy,
        metadata: {
          incidentId: id,
          reason: escalationData.reason,
          escalatedTo: escalationData.escalatedTo,
          newPriority: escalationData.newPriority,
          escalatedAt: escalationData.escalatedAt
        }
      });

      return await this.getIncidentById(id);
    } catch (error) {
      console.error('[IncidentController] Error escalating incident:', error);
      throw new Error('Failed to escalate incident');
    }
  }

  /**
   * Get incident timeline
   * @param {string} id - Incident ID
   * @returns {Array} Timeline activities
   */
  static async getIncidentTimeline(id) {
    try {
      const activities = await SecurityActivity.findAll({
        where: {
          [Op.or]: [
            { 'metadata.incidentId': id },
            { refId: id }
          ]
        },
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: TeamMember,
            as: 'performer',
            attributes: ['id', 'name', 'role']
          }
        ]
      });

      return activities;
    } catch (error) {
      console.error('[IncidentController] Error getting incident timeline:', error);
      throw new Error('Failed to fetch incident timeline');
    }
  }

  /**
   * Add note to incident
   * @param {string} id - Incident ID
   * @param {Object} noteData - Note data
   * @returns {Object} Updated incident
   */
  static async addIncidentNote(id, noteData) {
    try {
      const incident = await Incident.findOne({ where: { id } });
      
      if (!incident) {
        return null;
      }

      // Add note to incident notes array
      const currentNotes = incident.notes || [];
      const newNote = {
        id: `NOTE_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        content: noteData.note,
        isInternal: noteData.isInternal,
        addedBy: noteData.addedBy,
        addedAt: noteData.addedAt
      };
      
      currentNotes.push(newNote);
      
      await incident.update({ notes: currentNotes });

      // Log note addition activity
      await SecurityActivity.create({
        type: 'INCIDENT_NOTE_ADDED',
        description: noteData.isInternal ? 'Internal note added to incident' : 'Note added to incident',
        userId: noteData.addedBy,
        performedBy: noteData.addedBy,
        metadata: {
          incidentId: id,
          noteId: newNote.id,
          isInternal: noteData.isInternal,
          notePreview: noteData.note.substring(0, 100)
        }
      });

      return await this.getIncidentById(id);
    } catch (error) {
      console.error('[IncidentController] Error adding incident note:', error);
      throw new Error('Failed to add incident note');
    }
  }

  /**
   * Get dashboard statistics
   * @param {string} period - Time period (today, week, month, year)
   * @returns {Object} Dashboard statistics
   */
  static async getDashboardStats(period = 'today') {
    try {
      let startDate;
      const endDate = new Date();

      switch (period) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
      }

      // Get incident counts by status
      const statusStats = await Incident.findAll({
        where: {
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate
          }
        },
        attributes: [
          'status',
          [Incident.sequelize.fn('COUNT', Incident.sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      // Get incident counts by priority
      const priorityStats = await Incident.findAll({
        where: {
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate
          }
        },
        attributes: [
          'priority',
          [Incident.sequelize.fn('COUNT', Incident.sequelize.col('id')), 'count']
        ],
        group: ['priority'],
        raw: true
      });

      // Get incident counts by type
      const typeStats = await Incident.findAll({
        where: {
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate
          }
        },
        attributes: [
          'type',
          [Incident.sequelize.fn('COUNT', Incident.sequelize.col('id')), 'count']
        ],
        group: ['type'],
        raw: true
      });

      // Get total incidents
      const totalIncidents = await Incident.count({
        where: {
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate
          }
        }
      });

      // Get active incidents
      const activeIncidents = await Incident.count({
        where: {
          status: { [Op.in]: ['OPEN', 'IN_PROGRESS'] },
          createdAt: {
            [Op.gte]: startDate,
            [Op.lte]: endDate
          }
        }
      });

      // Format statistics
      const statusCounts = {};
      statusStats.forEach(stat => {
        statusCounts[stat.status] = parseInt(stat.count);
      });

      const priorityCounts = {};
      priorityStats.forEach(stat => {
        priorityCounts[stat.priority] = parseInt(stat.count);
      });

      const typeCounts = {};
      typeStats.forEach(stat => {
        typeCounts[stat.type] = parseInt(stat.count);
      });

      return {
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: {
          total: totalIncidents,
          active: activeIncidents,
          resolved: statusCounts.RESOLVED || 0,
          critical: priorityCounts.CRITICAL || 0
        },
        byStatus: statusCounts,
        byPriority: priorityCounts,
        byType: typeCounts
      };
    } catch (error) {
      console.error('[IncidentController] Error getting dashboard stats:', error);
      throw new Error('Failed to fetch dashboard statistics');
    }
  }

  /**
   * Auto-assign critical incidents to available supervisors
   * @param {string} incidentId - Incident ID
   */
  static async autoAssignCriticalIncident(incidentId) {
    try {
      // Find available supervisors
      const availableSupervisors = await TeamMember.findAll({
        where: {
          role: { [Op.in]: ['SUPERVISOR', 'COORDINATOR'] },
          status: 'ON_DUTY',
          isActive: true
        },
        order: [['lastAssignedAt', 'ASC']] // Assign to least recently assigned
      });

      if (availableSupervisors.length > 0) {
        const assignedSupervisor = availableSupervisors[0];
        
        await Incident.update(
          { 
            assignedTo: assignedSupervisor.id,
            assignedAt: new Date().toISOString()
          },
          { where: { id: incidentId } }
        );

        // Update supervisor's last assigned time
        await TeamMember.update(
          { lastAssignedAt: new Date().toISOString() },
          { where: { id: assignedSupervisor.id } }
        );

        // Log auto-assignment
        await SecurityActivity.create({
          type: 'INCIDENT_AUTO_ASSIGNED',
          description: `Critical incident auto-assigned to ${assignedSupervisor.name}`,
          userId: 'SYSTEM',
          performedBy: 'SYSTEM',
          metadata: {
            incidentId,
            assignedTo: assignedSupervisor.id,
            assignedName: assignedSupervisor.name,
            reason: 'Critical incident auto-assignment'
          }
        });
      }
    } catch (error) {
      console.error('[IncidentController] Error auto-assigning critical incident:', error);
      // Don't throw error as this is a background operation
    }
  }
}

module.exports = IncidentController;