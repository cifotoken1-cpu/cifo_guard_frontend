const CrossingEvent = require('../models/CrossingEvent');
const Camera = require('../models/Camera');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

class CountingController {
  static async createEvent(req, res) {
    try {
      const { camera_id, direction, crossed_at, metadata } = req.body;

      if (!camera_id || !direction || !crossed_at) {
        return res.status(400).json({
          success: false,
          message: 'camera_id, direction, and crossed_at are required'
        });
      }

      if (!['in', 'out'].includes(direction)) {
        return res.status(400).json({
          success: false,
          message: 'direction must be "in" or "out"'
        });
      }

      const parsedCrossedAt = new Date(crossed_at);
      if (isNaN(parsedCrossedAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'crossed_at must be a valid date'
        });
      }

      const camera = await Camera.getById(camera_id);
      if (!camera) {
        return res.status(404).json({
          success: false,
          message: `Camera ${camera_id} not found`
        });
      }

      const event = await CrossingEvent.create({
        cameraId: camera_id,
        direction,
        crossedAt: parsedCrossedAt,
        metadata: metadata || {}
      });

      // Broadcast via WebSocket if available
      const wsService = req.app.get('wsService');
      if (wsService) {
        wsService.broadcastCountingEvent({
          camera_id,
          direction,
          crossed_at,
          event_id: event.id
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          id: event.id,
          camera_id: event.cameraId,
          direction: event.direction,
          crossed_at: event.crossedAt
        }
      });
    } catch (error) {
      console.error('[CountingController] createEvent error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getCameraCount(req, res) {
    try {
      const { id } = req.params;
      const { date } = req.query;

      const camera = await Camera.getById(id);
      if (!camera) {
        return res.status(404).json({
          success: false,
          message: `Camera ${id} not found`
        });
      }

      const targetDate = date ? new Date(date) : new Date();
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date parameter' });
      }
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const counts = await CrossingEvent.findAll({
        attributes: [
          'direction',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          cameraId: id,
          crossedAt: { [Op.between]: [startOfDay, endOfDay] }
        },
        group: ['direction'],
        raw: true
      });

      const inCount = Number(counts.find(c => c.direction === 'in')?.count || 0);
      const outCount = Number(counts.find(c => c.direction === 'out')?.count || 0);

      return res.json({
        success: true,
        data: {
          camera_id: id,
          camera_label: camera.label,
          date: startOfDay.toISOString().slice(0, 10),
          in: inCount,
          out: outCount,
          inside: Math.max(0, inCount - outCount)
        }
      });
    } catch (error) {
      console.error('[CountingController] getCameraCount error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  static async getSummary(req, res) {
    try {
      const { date } = req.query;

      const targetDate = date ? new Date(date) : new Date();
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date parameter' });
      }
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const counts = await CrossingEvent.findAll({
        attributes: [
          [sequelize.col('camera_id'), 'camera_id'],
          'direction',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          crossedAt: { [Op.between]: [startOfDay, endOfDay] }
        },
        group: [sequelize.col('camera_id'), 'direction'],
        raw: true
      });

      // Group by camera
      const cameraMap = {};
      for (const row of counts) {
        const camId = row.camera_id;
        if (!cameraMap[camId]) {
          cameraMap[camId] = { camera_id: camId, in: 0, out: 0 };
        }
        cameraMap[camId][row.direction] = Number(row.count);
      }

      // Enrich with camera labels
      const summary = [];
      for (const [camId, data] of Object.entries(cameraMap)) {
        const camera = await Camera.getById(camId);
        summary.push({
          ...data,
          camera_label: camera?.label || camId,
          inside: Math.max(0, data.in - data.out)
        });
      }

      return res.json({
        success: true,
        date: startOfDay.toISOString().slice(0, 10),
        data: summary,
        totals: {
          in: summary.reduce((sum, c) => sum + c.in, 0),
          out: summary.reduce((sum, c) => sum + c.out, 0),
          inside: summary.reduce((sum, c) => sum + c.inside, 0)
        }
      });
    } catch (error) {
      console.error('[CountingController] getSummary error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = CountingController;
