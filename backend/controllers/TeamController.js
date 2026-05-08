const TeamMember = require('../models/TeamMember');
const TeamLocationHistory = require('../models/TeamLocationHistory');
const SecurityActivity = require('../models/SecurityActivity');

class TeamController {
  // Get all team members with optional filters
  static async getAllTeamMembers(req, res) {
    try {
      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        status: req.query.status,
        role: req.query.role,
        shift: req.query.shift,
        duty_status: req.query.duty_status,
        search: req.query.search
      };

      const members = await TeamMember.getAll(options);
      const total = await TeamMember.getCount({
        status: options.status,
        role: options.role,
        shift: options.shift,
        duty_status: options.duty_status,
        search: options.search
      });

      res.json({
        success: true,
        data: members,
        pagination: {
          total,
          limit: options.limit,
          offset: options.offset,
          pages: Math.ceil(total / options.limit)
        }
      });
    } catch (error) {
      console.error('Error getting team members:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve team members',
        error: error.message
      });
    }
  }

  // Get team member by ID
  static async getTeamMemberById(req, res) {
    try {
      const { id } = req.params;
      const member = await TeamMember.getById(id);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Team member not found'
        });
      }

      res.json({
        success: true,
        data: member
      });
    } catch (error) {
      console.error('Error getting team member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve team member',
        error: error.message
      });
    }
  }

  // Create new team member
  static async createTeamMember(req, res) {
    try {
      const memberData = req.body;
      
      // Validate required fields
      const requiredFields = ['name', 'employee_id', 'role', 'phone'];
      for (const field of requiredFields) {
        if (!memberData[field]) {
          return res.status(400).json({
            success: false,
            message: `Field '${field}' is required`
          });
        }
      }

      const member = await TeamMember.create(memberData);
      
      // Log activity
      await SecurityActivity.create({
        type: 'TEAM_MEMBER_ADDED',
        ref_id: member.id,
        actor: req.user?.name || 'System',
        note: `Team member '${member.name}' (${member.role}) added`,
        severity: 'INFO',
        source: 'admin_panel'
      });

      res.status(201).json({
        success: true,
        message: 'Team member created successfully',
        data: member
      });
    } catch (error) {
      console.error('Error creating team member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create team member',
        error: error.message
      });
    }
  }

  // Update team member
  static async updateTeamMember(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingMember = await TeamMember.getById(id);
      if (!existingMember) {
        return res.status(404).json({
          success: false,
          message: 'Team member not found'
        });
      }

      const success = await TeamMember.update(id, updateData);
      
      if (success) {
        const updatedMember = await TeamMember.getById(id);
        
        // Log activity
        await SecurityActivity.create({
          type: 'TEAM_MEMBER_UPDATED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Team member '${existingMember.name}' updated`,
          severity: 'INFO',
          source: 'admin_panel'
        });

        res.json({
          success: true,
          message: 'Team member updated successfully',
          data: updatedMember
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to update team member'
        });
      }
    } catch (error) {
      console.error('Error updating team member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update team member',
        error: error.message
      });
    }
  }

  // Delete team member
  static async deleteTeamMember(req, res) {
    try {
      const { id } = req.params;
      
      const existingMember = await TeamMember.getById(id);
      if (!existingMember) {
        return res.status(404).json({
          success: false,
          message: 'Team member not found'
        });
      }

      const success = await TeamMember.delete(id);
      
      if (success) {
        // Log activity
        await SecurityActivity.create({
          type: 'TEAM_MEMBER_REMOVED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Team member '${existingMember.name}' removed`,
          severity: 'WARNING',
          source: 'admin_panel'
        });

        res.json({
          success: true,
          message: 'Team member deleted successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to delete team member'
        });
      }
    } catch (error) {
      console.error('Error deleting team member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete team member',
        error: error.message
      });
    }
  }

  // Update team member status
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const member = await TeamMember.getById(id);
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Team member not found'
        });
      }

      const success = await TeamMember.updateStatus(id, status);
      
      if (success) {
        // Log activity
        await SecurityActivity.create({
          type: 'TEAM_STATUS_CHANGED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Team member '${member.name}' status changed to ${status}`,
          severity: 'INFO',
          source: 'status_update'
        });

        res.json({
          success: true,
          message: 'Status updated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to update status'
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update status',
        error: error.message
      });
    }
  }

  // Update team member location
  static async updateLocation(req, res) {
    try {
      const { id } = req.params;
      const { latitude, longitude, area, notes } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required'
        });
      }

      const member = await TeamMember.getById(id);
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Team member not found'
        });
      }

      // Update current location
      const locationData = {
        current_latitude: latitude,
        current_longitude: longitude,
        current_area: area || null
      };
      
      await TeamMember.updateLocation(id, locationData);

      // Create location history entry
      const historyData = {
        member_id: id,
        latitude,
        longitude,
        area: area || null,
        notes: notes || null
      };
      
      await TeamLocationHistory.create(historyData);

      // Log activity if significant location change
      if (area && area !== member.current_area) {
        await SecurityActivity.create({
          type: 'TEAM_LOCATION_CHANGED',
          ref_id: id,
          actor: member.name,
          note: `Team member '${member.name}' moved to ${area}`,
          severity: 'INFO',
          source: 'location_update'
        });
      }

      res.json({
        success: true,
        message: 'Location updated successfully'
      });
    } catch (error) {
      console.error('Error updating location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location',
        error: error.message
      });
    }
  }

  // Get team statistics
  static async getStats(req, res) {
    try {
      const stats = await TeamMember.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting team stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve team statistics',
        error: error.message
      });
    }
  }

  // Get members on duty
  static async getMembersOnDuty(req, res) {
    try {
      const members = await TeamMember.getByDutyStatus('ON_DUTY');
      
      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      console.error('Error getting members on duty:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve members on duty',
        error: error.message
      });
    }
  }

  // Get members by role
  static async getMembersByRole(req, res) {
    try {
      const { role } = req.params;
      const members = await TeamMember.getByRole(role);
      
      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      console.error('Error getting members by role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve members by role',
        error: error.message
      });
    }
  }

  // Get members by shift
  static async getMembersByShift(req, res) {
    try {
      const { shift } = req.params;
      const members = await TeamMember.getByShift(shift);
      
      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      console.error('Error getting members by shift:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve members by shift',
        error: error.message
      });
    }
  }

  // Get team member location history
  static async getLocationHistory(req, res) {
    try {
      const { id } = req.params;
      const { limit = 50, hours = 24 } = req.query;

      const history = await TeamLocationHistory.getByMember(id, {
        limit: parseInt(limit),
        hours: parseInt(hours)
      });
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting location history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve location history',
        error: error.message
      });
    }
  }

  // Get current locations of all team members
  static async getCurrentLocations(req, res) {
    try {
      const locations = await TeamLocationHistory.getCurrentLocations();
      
      res.json({
        success: true,
        data: locations
      });
    } catch (error) {
      console.error('Error getting current locations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve current locations',
        error: error.message
      });
    }
  }

  // Get patrol routes
  static async getPatrolRoutes(req, res) {
    try {
      const { member_id, hours = 8 } = req.query;
      
      if (!member_id) {
        return res.status(400).json({
          success: false,
          message: 'member_id is required'
        });
      }

      const routes = await TeamLocationHistory.getPatrolRoutes(member_id, parseInt(hours));
      
      res.json({
        success: true,
        data: routes
      });
    } catch (error) {
      console.error('Error getting patrol routes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve patrol routes',
        error: error.message
      });
    }
  }

  // Get team activity summary
  static async getActivitySummary(req, res) {
    try {
      const { hours = 24 } = req.query;
      const summary = await TeamLocationHistory.getActivitySummary(parseInt(hours));
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting activity summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve activity summary',
        error: error.message
      });
    }
  }

  // Get team movement summary
  static async getMovementSummary(req, res) {
    try {
      const { hours = 24 } = req.query;
      const summary = await TeamLocationHistory.getTeamMovementSummary(parseInt(hours));
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting movement summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve movement summary',
        error: error.message
      });
    }
  }

  // Get patrol coverage
  static async getPatrolCoverage(req, res) {
    try {
      const { hours = 24 } = req.query;
      const coverage = await TeamLocationHistory.getPatrolCoverage(parseInt(hours));
      
      res.json({
        success: true,
        data: coverage
      });
    } catch (error) {
      console.error('Error getting patrol coverage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve patrol coverage',
        error: error.message
      });
    }
  }

  // Dispatch team to location (Emergency Dispatch Implementation)
  static async dispatchTeam(dispatchData) {
    try {
      const { memberIds, location, priority, description, incidentId, dispatchedBy, dispatchedAt } = dispatchData;
      
      // Generate dispatch ID
      const dispatchId = `DISPATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Update team members status to EMERGENCY if high priority
      const isEmergency = ['HIGH', 'CRITICAL'].includes(priority);
      const newStatus = isEmergency ? 'EMERGENCY' : 'PATROLLING';
      
      const dispatchResults = [];
      
      for (const memberId of memberIds) {
        try {
          // Update member status
          const updateSuccess = await TeamMember.updateDutyStatus(memberId, newStatus);
          
          if (updateSuccess) {
            // Record location history
            await TeamLocationHistory.create({
              member_id: memberId,
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy || 10,
              timestamp: new Date(),
              activity_type: isEmergency ? 'EMERGENCY_DISPATCH' : 'DISPATCH',
              notes: `Dispatched: ${description}`
            });
            
            // Log security activity
            const member = await TeamMember.getById(memberId);
            await SecurityActivity.create({
              type: isEmergency ? 'EMERGENCY_DISPATCH' : 'TEAM_DISPATCH',
              ref_id: dispatchId,
              actor: dispatchedBy || 'System',
              note: `${member?.name || memberId} dispatched to ${description} (Priority: ${priority})`,
              severity: isEmergency ? 'CRITICAL' : 'HIGH',
              source: 'dispatch_system',
              metadata: JSON.stringify({
                location,
                priority,
                incidentId,
                memberId
              })
            });
            
            dispatchResults.push({
              memberId,
              success: true,
              status: newStatus
            });
          } else {
            dispatchResults.push({
              memberId,
              success: false,
              error: 'Failed to update member status'
            });
          }
        } catch (error) {
          dispatchResults.push({
            memberId,
            success: false,
            error: error.message
          });
        }
      }
      
      // Create dispatch record in activities
      await SecurityActivity.create({
        type: 'DISPATCH_CREATED',
        ref_id: dispatchId,
        actor: dispatchedBy || 'System',
        note: `Emergency dispatch created: ${description}`,
        severity: isEmergency ? 'CRITICAL' : 'HIGH',
        source: 'dispatch_system',
        metadata: JSON.stringify({
          dispatchId,
          memberIds,
          location,
          priority,
          description,
          incidentId,
          results: dispatchResults
        })
      });
      
      return {
        id: dispatchId,
        memberIds,
        location,
        priority,
        description,
        incidentId,
        dispatchedBy,
        dispatchedAt,
        results: dispatchResults,
        success: dispatchResults.some(r => r.success)
      };
      
    } catch (error) {
      console.error('Error in dispatchTeam:', error);
      throw error;
    }
  }

  // Bulk update duty status
  static async bulkUpdateDutyStatus(req, res) {
    try {
      const { member_ids, duty_status } = req.body;

      if (!Array.isArray(member_ids) || member_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'member_ids must be a non-empty array'
        });
      }

      if (!duty_status) {
        return res.status(400).json({
          success: false,
          message: 'duty_status is required'
        });
      }

      const results = [];
      for (const member_id of member_ids) {
        try {
          const success = await TeamMember.updateDutyStatus(member_id, duty_status);
          results.push({ member_id, success });
          
          if (success) {
            const member = await TeamMember.getById(member_id);
            await SecurityActivity.create({
              type: 'TEAM_DUTY_STATUS_CHANGED',
              ref_id: member_id,
              actor: req.user?.name || 'System',
              note: `Team member '${member?.name || member_id}' duty status changed to ${duty_status}`,
              severity: 'INFO',
              source: 'bulk_update'
            });
          }
        } catch (error) {
          results.push({ member_id, success: false, error: error.message });
        }
      }

      res.json({
        success: true,
        message: 'Bulk duty status update completed',
        data: results
      });
    } catch (error) {
      console.error('Error in bulk duty status update:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk duty status update',
        error: error.message
      });
    }
  }

  // Get team roster (alias for getAllTeamMembers)
  static async getTeamRoster(filters = {}) {
    try {
      const members = await TeamMember.getAll(filters);
      const total = await TeamMember.getCount({
        status: filters.status,
        role: filters.role,
        shift: filters.shift,
        duty_status: filters.duty_status,
        search: filters.search
      });

      return {
        members,
        total
      };
    } catch (error) {
      console.error('Error getting team roster:', error);
      throw error;
    }
  }
}

module.exports = TeamController;