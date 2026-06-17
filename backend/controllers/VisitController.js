const PersonVisit = require('../models/PersonVisit');
const Camera = require('../models/Camera');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

class VisitController {
  static async createVisit(req, res) {
    try {
      const { camera_id, person_uid, entry_time, exit_time, confidence, match_method, metadata } = req.body;

      if (!camera_id || !person_uid || !entry_time) {
        return res.status(400).json({
          success: false,
          message: 'camera_id, person_uid, and entry_time are required'
        });
      }

      const parsedEntry = new Date(entry_time);
      if (isNaN(parsedEntry.getTime())) {
        return res.status(400).json({ success: false, message: 'entry_time must be a valid date' });
      }

      let parsedExit = null;
      let duration = null;
      if (exit_time) {
        parsedExit = new Date(exit_time);
        if (isNaN(parsedExit.getTime())) {
          return res.status(400).json({ success: false, message: 'exit_time must be a valid date' });
        }
        duration = Math.round((parsedExit - parsedEntry) / 1000);
        if (duration < 0) {
          return res.status(400).json({ success: false, message: 'exit_time must be after entry_time' });
        }
      }

      const camera = await Camera.getById(camera_id);
      if (!camera) {
        return res.status(404).json({ success: false, message: `Camera ${camera_id} not found` });
      }

      const visit = await PersonVisit.create({
        cameraId: camera_id,
        personUid: person_uid,
        entryTime: parsedEntry,
        exitTime: parsedExit,
        durationSeconds: duration,
        confidence: confidence ?? null,
        matchMethod: match_method ?? null,
        metadata: metadata || {}
      });

      const wsService = req.app.get('wsService');
      if (wsService) {
        wsService.broadcastVisitEvent({
          camera_id,
          person_uid,
          visit_id: visit.id,
          has_exit: !!exit_time
        });
      }

      return res.status(201).json({
        success: true,
        data: {
          id: visit.id,
          camera_id: visit.cameraId,
          person_uid: visit.personUid,
          entry_time: visit.entryTime,
          exit_time: visit.exitTime,
          duration_seconds: visit.durationSeconds,
          confidence: visit.confidence,
          match_method: visit.matchMethod
        }
      });
    } catch (error) {
      console.error('[VisitController] createVisit error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async closeVisit(req, res) {
    try {
      const { id } = req.params;
      const { exit_time } = req.body;

      if (!exit_time) {
        return res.status(400).json({ success: false, message: 'exit_time is required' });
      }

      const parsedExit = new Date(exit_time);
      if (isNaN(parsedExit.getTime())) {
        return res.status(400).json({ success: false, message: 'exit_time must be a valid date' });
      }

      const visit = await PersonVisit.findByPk(id);
      if (!visit) {
        return res.status(404).json({ success: false, message: 'Visit not found' });
      }

      if (visit.exitTime) {
        return res.status(409).json({ success: false, message: 'Visit already closed' });
      }

      const duration = Math.round((parsedExit - visit.entryTime) / 1000);
      if (duration < 0) {
        return res.status(400).json({ success: false, message: 'exit_time must be after entry_time' });
      }

      await visit.update({ exitTime: parsedExit, durationSeconds: duration });

      const wsService = req.app.get('wsService');
      if (wsService) {
        wsService.broadcastVisitEvent({
          camera_id: visit.cameraId,
          person_uid: visit.personUid,
          visit_id: visit.id,
          has_exit: true,
          duration_seconds: duration
        });
      }

      return res.json({
        success: true,
        data: {
          id: visit.id,
          camera_id: visit.cameraId,
          person_uid: visit.personUid,
          entry_time: visit.entryTime,
          exit_time: visit.exitTime,
          duration_seconds: visit.durationSeconds
        }
      });
    } catch (error) {
      console.error('[VisitController] closeVisit error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getCameraVisits(req, res) {
    try {
      const { id } = req.params;
      const { date, status } = req.query;

      const camera = await Camera.getById(id);
      if (!camera) {
        return res.status(404).json({ success: false, message: `Camera ${id} not found` });
      }

      const targetDate = date ? new Date(date) : new Date();
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date parameter' });
      }
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const where = {
        cameraId: id,
        entryTime: { [Op.between]: [startOfDay, endOfDay] }
      };

      if (status === 'open') where.exitTime = null;
      if (status === 'closed') where.exitTime = { [Op.ne]: null };

      const visits = await PersonVisit.findAll({
        where,
        order: [['entry_time', 'DESC']],
        limit: 100,
        raw: true
      });

      return res.json({
        success: true,
        data: visits.map(v => ({
          id: v.id,
          camera_id: v.camera_id,
          person_uid: v.person_uid,
          entry_time: v.entry_time,
          exit_time: v.exit_time,
          duration_seconds: v.duration_seconds,
          confidence: v.confidence,
          match_method: v.match_method
        }))
      });
    } catch (error) {
      console.error('[VisitController] getCameraVisits error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async getDurationSummary(req, res) {
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

      const stats = await PersonVisit.findAll({
        attributes: [
          [sequelize.col('camera_id'), 'camera_id'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_visits'],
          [sequelize.fn('SUM', sequelize.literal('CASE WHEN exit_time IS NOT NULL THEN 1 ELSE 0 END')), 'completed_visits'],
          [sequelize.fn('AVG', sequelize.col('duration_seconds')), 'avg_duration'],
          [sequelize.fn('MIN', sequelize.col('duration_seconds')), 'min_duration'],
          [sequelize.fn('MAX', sequelize.col('duration_seconds')), 'max_duration']
        ],
        where: {
          entryTime: { [Op.between]: [startOfDay, endOfDay] }
        },
        group: [sequelize.col('camera_id')],
        raw: true
      });

      const summary = [];
      for (const row of stats) {
        const camera = await Camera.getById(row.camera_id);
        summary.push({
          camera_id: row.camera_id,
          camera_label: camera?.label || row.camera_id,
          total_visits: Number(row.total_visits),
          completed_visits: Number(row.completed_visits),
          avg_duration: row.avg_duration ? Math.round(Number(row.avg_duration)) : null,
          min_duration: row.min_duration ? Number(row.min_duration) : null,
          max_duration: row.max_duration ? Number(row.max_duration) : null
        });
      }

      const allAvg = summary.filter(s => s.avg_duration !== null);
      const overallAvg = allAvg.length > 0
        ? Math.round(allAvg.reduce((sum, s) => sum + s.avg_duration * s.completed_visits, 0) / allAvg.reduce((sum, s) => sum + s.completed_visits, 0))
        : null;

      return res.json({
        success: true,
        date: startOfDay.toISOString().slice(0, 10),
        data: summary,
        overall: {
          total_visits: summary.reduce((s, c) => s + c.total_visits, 0),
          completed_visits: summary.reduce((s, c) => s + c.completed_visits, 0),
          avg_duration: overallAvg
        }
      });
    } catch (error) {
      console.error('[VisitController] getDurationSummary error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

module.exports = VisitController;
