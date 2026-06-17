const CrossingEvent = require('../models/CrossingEvent');
const PersonVisit = require('../models/PersonVisit');
const Camera = require('../models/Camera');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

let _aiClient = null;
function getAIClient() {
  if (_aiClient) return _aiClient;
  if (!process.env.OPENROUTER_API_KEY) return null;

  const OpenAI = require('openai');
  _aiClient = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/cifo/cctv-ai-count',
      'X-Title': 'CCTV AI Count Reports',
    },
  });
  return _aiClient;
}

const REPORT_MODEL = process.env.OPENROUTER_REPORT_MODEL || 'openai/gpt-4o-mini';

async function gatherDayStats(dateStr) {
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const crossings = await CrossingEvent.findAll({
    attributes: [
      [sequelize.col('camera_id'), 'camera_id'],
      'direction',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: { crossedAt: { [Op.between]: [startOfDay, endOfDay] } },
    group: [sequelize.col('camera_id'), 'direction'],
    raw: true
  });

  const visits = await PersonVisit.findAll({
    attributes: [
      [sequelize.col('camera_id'), 'camera_id'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_visits'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN exit_time IS NOT NULL THEN 1 ELSE 0 END')), 'completed'],
      [sequelize.fn('AVG', sequelize.col('duration_seconds')), 'avg_duration'],
      [sequelize.fn('MAX', sequelize.col('duration_seconds')), 'max_duration']
    ],
    where: { entryTime: { [Op.between]: [startOfDay, endOfDay] } },
    group: [sequelize.col('camera_id')],
    raw: true
  });

  const cameraIds = new Set([
    ...crossings.map(c => c.camera_id),
    ...visits.map(v => v.camera_id)
  ]);

  const cameras = {};
  for (const id of cameraIds) {
    const cam = await Camera.getById(id);
    cameras[id] = cam?.label || id;
  }

  const perCamera = {};
  for (const row of crossings) {
    if (!perCamera[row.camera_id]) {
      perCamera[row.camera_id] = { label: cameras[row.camera_id], in: 0, out: 0 };
    }
    perCamera[row.camera_id][row.direction] = Number(row.count);
  }
  for (const row of visits) {
    if (!perCamera[row.camera_id]) {
      perCamera[row.camera_id] = { label: cameras[row.camera_id], in: 0, out: 0 };
    }
    perCamera[row.camera_id].total_visits = Number(row.total_visits);
    perCamera[row.camera_id].completed = Number(row.completed);
    perCamera[row.camera_id].avg_duration = row.avg_duration ? Math.round(Number(row.avg_duration)) : null;
    perCamera[row.camera_id].max_duration = row.max_duration ? Number(row.max_duration) : null;
  }

  const totalIn = Object.values(perCamera).reduce((s, c) => s + (c.in || 0), 0);
  const totalOut = Object.values(perCamera).reduce((s, c) => s + (c.out || 0), 0);

  return {
    date: startOfDay.toISOString().slice(0, 10),
    total_in: totalIn,
    total_out: totalOut,
    total_inside: Math.max(0, totalIn - totalOut),
    cameras: perCamera
  };
}

class ReportController {
  static async getDailySummary(req, res) {
    try {
      const { date } = req.query;
      const stats = await gatherDayStats(date);

      const client = getAIClient();
      if (!client) {
        return res.json({
          success: true,
          data: {
            ...stats,
            narrative: null,
            ai_unavailable: true
          }
        });
      }

      const prompt = `Kamu adalah analis data visitor counting untuk gedung. Buat ringkasan harian dalam Bahasa Indonesia (2-4 paragraf) berdasarkan data ini:

Tanggal: ${stats.date}
Total masuk: ${stats.total_in}
Total keluar: ${stats.total_out}
Saat ini di dalam: ${stats.total_inside}

Data per kamera:
${Object.entries(stats.cameras).map(([id, c]) =>
  `- ${c.label}: masuk ${c.in || 0}, keluar ${c.out || 0}, avg durasi ${c.avg_duration ? c.avg_duration + ' detik' : 'N/A'}`
).join('\n')}

Tulis ringkasan yang informatif: highlight pola traffic, durasi kunjungan, dan rekomendasi jika ada anomali. Jangan gunakan markdown.`;

      const completion = await client.chat.completions.create({
        model: REPORT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });

      const narrative = completion.choices?.[0]?.message?.content || null;

      return res.json({
        success: true,
        data: { ...stats, narrative }
      });
    } catch (error) {
      console.error('[ReportController] getDailySummary error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  static async exportCSV(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date) : new Date();
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date' });
      }
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const crossings = await CrossingEvent.findAll({
        where: { crossedAt: { [Op.between]: [startOfDay, endOfDay] } },
        order: [['crossed_at', 'ASC']],
        raw: true
      });

      const visits = await PersonVisit.findAll({
        where: { entryTime: { [Op.between]: [startOfDay, endOfDay] } },
        order: [['entry_time', 'ASC']],
        raw: true
      });

      let csv = 'type,camera_id,timestamp,direction,person_uid,entry_time,exit_time,duration_seconds\n';

      for (const c of crossings) {
        csv += `crossing,${c.camera_id},${c.crossed_at},${c.direction},,,, \n`;
      }

      for (const v of visits) {
        csv += `visit,${v.camera_id},,, ${v.person_uid},${v.entry_time},${v.exit_time || ''},${v.duration_seconds || ''}\n`;
      }

      const dateStr = startOfDay.toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="counting-report-${dateStr}.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error('[ReportController] exportCSV error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

module.exports = ReportController;
