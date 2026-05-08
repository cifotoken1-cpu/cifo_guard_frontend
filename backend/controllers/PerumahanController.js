const Perumahan = require('../models/Perumahan');
const SecurityActivity = require('../models/SecurityActivity');

class PerumahanController {
  // Get all perumahan with optional filters
  static async getAllPerumahan(req, res) {
    try {
      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        status: req.query.status,
        area: req.query.area,
        search: req.query.search
      };

      const perumahanList = await Perumahan.getAllPerumahan(options);
      
      // Get total count for pagination
      const totalOptions = {
        status: options.status,
        area: options.area,
        search: options.search
      };
      const allPerumahan = await Perumahan.getAllPerumahan(totalOptions);
      const total = allPerumahan.length;

      res.json({
        success: true,
        data: perumahanList,
        pagination: {
          total,
          limit: options.limit,
          offset: options.offset,
          pages: Math.ceil(total / options.limit)
        }
      });
    } catch (error) {
      console.error('Error getting perumahan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve perumahan data',
        error: error.message
      });
    }
  }

  // Get perumahan by ID
  static async getPerumahanById(req, res) {
    try {
      const { id } = req.params;
      const perumahan = await Perumahan.getPerumahanById(id);

      if (!perumahan) {
        return res.status(404).json({
          success: false,
          message: 'Perumahan not found'
        });
      }

      res.json({
        success: true,
        data: perumahan
      });
    } catch (error) {
      console.error('Error getting perumahan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve perumahan data',
        error: error.message
      });
    }
  }

  // Create new perumahan
  static async createPerumahan(req, res) {
    try {
      const perumahanData = req.body;
      
      // Validate required fields
      const requiredFields = ['name', 'address', 'area', 'total_units'];
      for (const field of requiredFields) {
        if (!perumahanData[field]) {
          return res.status(400).json({
            success: false,
            message: `Field '${field}' is required`
          });
        }
      }

      const perumahan = await Perumahan.createPerumahan(perumahanData);
      
      // Log activity
      await SecurityActivity.create({
        type: 'PERUMAHAN_CREATED',
        ref_id: perumahan.id,
        actor: req.user?.name || 'System',
        note: `Perumahan '${perumahan.name}' created in ${perumahan.area}`,
        severity: 'INFO',
        source: 'admin_panel'
      });

      res.status(201).json({
        success: true,
        message: 'Perumahan created successfully',
        data: perumahan
      });
    } catch (error) {
      console.error('Error creating perumahan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create perumahan',
        error: error.message
      });
    }
  }

  // Update perumahan
  static async updatePerumahan(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingPerumahan = await Perumahan.getPerumahanById(id);
      if (!existingPerumahan) {
        return res.status(404).json({
          success: false,
          message: 'Perumahan not found'
        });
      }

      const success = await Perumahan.updatePerumahan(id, updateData);
      
      if (success) {
        const updatedPerumahan = await Perumahan.getPerumahanById(id);
        
        // Log activity
        await SecurityActivity.create({
          type: 'PERUMAHAN_UPDATED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Perumahan '${existingPerumahan.name}' updated`,
          severity: 'INFO',
          source: 'admin_panel'
        });

        res.json({
          success: true,
          message: 'Perumahan updated successfully',
          data: updatedPerumahan
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to update perumahan'
        });
      }
    } catch (error) {
      console.error('Error updating perumahan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update perumahan',
        error: error.message
      });
    }
  }

  // Delete perumahan
  static async deletePerumahan(req, res) {
    try {
      const { id } = req.params;
      
      const existingPerumahan = await Perumahan.getPerumahanById(id);
      if (!existingPerumahan) {
        return res.status(404).json({
          success: false,
          message: 'Perumahan not found'
        });
      }

      const success = await Perumahan.deletePerumahan(id);
      
      if (success) {
        // Log activity
        await SecurityActivity.create({
          type: 'PERUMAHAN_DELETED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Perumahan '${existingPerumahan.name}' deleted from ${existingPerumahan.area}`,
          severity: 'WARNING',
          source: 'admin_panel'
        });

        res.json({
          success: true,
          message: 'Perumahan deleted successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to delete perumahan'
        });
      }
    } catch (error) {
      console.error('Error deleting perumahan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete perumahan',
        error: error.message
      });
    }
  }

  // Get perumahan statistics
  static async getStats(req, res) {
    try {
      const stats = await Perumahan.getPerumahanStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting perumahan stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve perumahan statistics',
        error: error.message
      });
    }
  }

  // Get perumahan by area
  static async getPerumahanByArea(req, res) {
    try {
      const { area } = req.params;
      const perumahanList = await Perumahan.getPerumahanByArea(area);
      
      res.json({
        success: true,
        data: perumahanList
      });
    } catch (error) {
      console.error('Error getting perumahan by area:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve perumahan by area',
        error: error.message
      });
    }
  }

  // Get perumahan by security level
  static async getPerumahanBySecurityLevel(req, res) {
    try {
      const { level } = req.params;
      const perumahanList = await Perumahan.getPerumahanBySecurityLevel(level);
      
      res.json({
        success: true,
        data: perumahanList
      });
    } catch (error) {
      console.error('Error getting perumahan by security level:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve perumahan by security level',
        error: error.message
      });
    }
  }

  // Get perumahan with facilities
  static async getPerumahanWithFacilities(req, res) {
    try {
      const { id } = req.params;
      const perumahan = await Perumahan.getPerumahanWithFacilities(id);

      if (!perumahan) {
        return res.status(404).json({
          success: false,
          message: 'Perumahan not found'
        });
      }

      res.json({
        success: true,
        data: perumahan
      });
    } catch (error) {
      console.error('Error getting perumahan with facilities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve perumahan with facilities',
        error: error.message
      });
    }
  }

  // Search perumahan
  static async searchPerumahan(req, res) {
    try {
      const { q: searchTerm } = req.query;
      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          message: 'Search term is required'
        });
      }

      const results = await Perumahan.searchPerumahan(searchTerm, options);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Error searching perumahan:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search perumahan',
        error: error.message
      });
    }
  }

  // Get occupancy report
  static async getOccupancyReport(req, res) {
    try {
      const report = await Perumahan.getOccupancyReport();
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error getting occupancy report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve occupancy report',
        error: error.message
      });
    }
  }

  // Get area summary
  static async getAreaSummary(req, res) {
    try {
      const summary = await Perumahan.getAreaSummary();
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting area summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve area summary',
        error: error.message
      });
    }
  }

  // FACILITIES ENDPOINTS

  // Get facilities by perumahan
  static async getFacilitiesByPerumahan(req, res) {
    try {
      const { perumahan_id } = req.params;
      const facilities = await Perumahan.getFacilitiesByPerumahan(perumahan_id);
      
      res.json({
        success: true,
        data: facilities
      });
    } catch (error) {
      console.error('Error getting facilities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve facilities',
        error: error.message
      });
    }
  }

  // Get facility by ID
  static async getFacilityById(req, res) {
    try {
      const { id } = req.params;
      const facility = await Perumahan.getFacilityById(id);

      if (!facility) {
        return res.status(404).json({
          success: false,
          message: 'Facility not found'
        });
      }

      res.json({
        success: true,
        data: facility
      });
    } catch (error) {
      console.error('Error getting facility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve facility',
        error: error.message
      });
    }
  }

  // Create new facility
  static async createFacility(req, res) {
    try {
      const facilityData = req.body;
      
      // Validate required fields
      const requiredFields = ['perumahan_id', 'name', 'type'];
      for (const field of requiredFields) {
        if (!facilityData[field]) {
          return res.status(400).json({
            success: false,
            message: `Field '${field}' is required`
          });
        }
      }

      // Verify perumahan exists
      const perumahan = await Perumahan.getPerumahanById(facilityData.perumahan_id);
      if (!perumahan) {
        return res.status(404).json({
          success: false,
          message: 'Perumahan not found'
        });
      }

      const facility = await Perumahan.createFacility(facilityData);
      
      // Log activity
      await SecurityActivity.create({
        type: 'FACILITY_CREATED',
        ref_id: facility.id,
        actor: req.user?.name || 'System',
        note: `Facility '${facility.name}' (${facility.type}) created in ${perumahan.name}`,
        severity: 'INFO',
        source: 'admin_panel'
      });

      res.status(201).json({
        success: true,
        message: 'Facility created successfully',
        data: facility
      });
    } catch (error) {
      console.error('Error creating facility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create facility',
        error: error.message
      });
    }
  }

  // Update facility
  static async updateFacility(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingFacility = await Perumahan.getFacilityById(id);
      if (!existingFacility) {
        return res.status(404).json({
          success: false,
          message: 'Facility not found'
        });
      }

      const success = await Perumahan.updateFacility(id, updateData);
      
      if (success) {
        const updatedFacility = await Perumahan.getFacilityById(id);
        
        // Log activity
        await SecurityActivity.create({
          type: 'FACILITY_UPDATED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Facility '${existingFacility.name}' updated`,
          severity: 'INFO',
          source: 'admin_panel'
        });

        res.json({
          success: true,
          message: 'Facility updated successfully',
          data: updatedFacility
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to update facility'
        });
      }
    } catch (error) {
      console.error('Error updating facility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update facility',
        error: error.message
      });
    }
  }

  // Delete facility
  static async deleteFacility(req, res) {
    try {
      const { id } = req.params;
      
      const existingFacility = await Perumahan.getFacilityById(id);
      if (!existingFacility) {
        return res.status(404).json({
          success: false,
          message: 'Facility not found'
        });
      }

      const success = await Perumahan.deleteFacility(id);
      
      if (success) {
        // Log activity
        await SecurityActivity.create({
          type: 'FACILITY_DELETED',
          ref_id: id,
          actor: req.user?.name || 'System',
          note: `Facility '${existingFacility.name}' (${existingFacility.type}) deleted`,
          severity: 'WARNING',
          source: 'admin_panel'
        });

        res.json({
          success: true,
          message: 'Facility deleted successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to delete facility'
        });
      }
    } catch (error) {
      console.error('Error deleting facility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete facility',
        error: error.message
      });
    }
  }

  // Get facilities by type
  static async getFacilitiesByType(req, res) {
    try {
      const { type } = req.params;
      const facilities = await Perumahan.getFacilitiesByType(type);
      
      res.json({
        success: true,
        data: facilities
      });
    } catch (error) {
      console.error('Error getting facilities by type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve facilities by type',
        error: error.message
      });
    }
  }

  // Get facility statistics
  static async getFacilityStats(req, res) {
    try {
      const stats = await Perumahan.getFacilityStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting facility stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve facility statistics',
        error: error.message
      });
    }
  }
}

module.exports = PerumahanController;