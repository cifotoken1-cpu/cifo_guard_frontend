const Sensor = require('../models/Sensor');

class SensorController {
  // GET /sensors — list sensors with optional filters
  static async getAllSensors(req, res) {
    try {
      const options = {
        type: req.query.type,
        status: req.query.status,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
      };

      const sensors = await Sensor.getAll(options);
      const total = await Sensor.getCount({ type: options.type, status: options.status });

      // Compute per-status summary so frontend dashboard tidak perlu hitung sendiri
      const summary = sensors.reduce(
        (acc, s) => {
          acc[s.status] = (acc[s.status] || 0) + 1;
          return acc;
        },
        { clear: 0, open: 0, alert: 0, offline: 0 }
      );

      res.json({
        success: true,
        data: sensors,
        sensors, // alias supaya konsisten dengan endpoint /cameras
        total,
        summary,
      });
    } catch (error) {
      console.error('Error getting sensors:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sensors',
        error: error.message,
      });
    }
  }

  // GET /sensors/:id — single sensor
  static async getSensorById(req, res) {
    try {
      const sensor = await Sensor.getById(req.params.id);
      if (!sensor) {
        return res.status(404).json({ success: false, message: 'Sensor not found' });
      }
      res.json({ success: true, data: sensor });
    } catch (error) {
      console.error('Error getting sensor:', error);
      res.status(500).json({ success: false, message: 'Failed to retrieve sensor', error: error.message });
    }
  }

  // PATCH /sensors/:id/status — update status (untuk integration ke device sensor di masa depan)
  static async updateSensorStatus(req, res) {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, message: 'Status field is required' });
      }
      const updated = await Sensor.updateStatus(req.params.id, status);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Sensor not found' });
      }
      const sensor = await Sensor.getById(req.params.id);
      res.json({ success: true, data: sensor });
    } catch (error) {
      console.error('Error updating sensor status:', error);
      const code = error.message.startsWith('Invalid status') ? 400 : 500;
      res.status(code).json({ success: false, message: error.message });
    }
  }
}

module.exports = SensorController;
