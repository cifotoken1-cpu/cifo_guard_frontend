// backend/services/vigi/alertEnricher.js
// Persists the AI-enriched VIGI alert using the existing Sequelize Alert model.
// AI metadata is stored in the context JSON field (compatible with existing schema)
// and individually in ai_* columns once the migration has been run.

const fs = require('node:fs/promises');
const path = require('node:path');

const Alert = require('../../models/Alert');
const sequelize = require('../../config/database');
const { QueryTypes } = require('sequelize');

const SNAPSHOT_DIR = path.resolve(process.cwd(), 'uploads', 'snapshots');

async function ensureDir() {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
}

const AI_SEVERITY_TO_ALERT = { info: 'LOW', warning: 'HIGH', critical: 'CRITICAL' };
const AI_SEVERITY_TO_PRIORITY = { info: 'LOW', warning: 'HIGH', critical: 'URGENT' };

/**
 * @param {object} args
 * @param {object} args.eventMeta            { event_type, time }
 * @param {Buffer} args.snapshotBuffer       JPEG bytes
 * @param {object} args.aiResult             output of analyzeSnapshot()
 * @param {string} args.cameraId
 * @param {string} [args.cameraLocation]
 */
async function persistEnrichedAlert({
  eventMeta,
  snapshotBuffer,
  aiResult,
  cameraId,
  cameraLocation,
}) {
  await ensureDir();

  const ts = eventMeta.time || Math.floor(Date.now() / 1000);
  const filename = `${cameraId}_${ts}_${Date.now()}.jpg`;
  await fs.writeFile(path.join(SNAPSHOT_DIR, filename), snapshotBuffer);
  const publicPath = `/uploads/snapshots/${filename}`;

  const alertSeverity = AI_SEVERITY_TO_ALERT[aiResult.severity] || 'MEDIUM';
  const alertPriority = AI_SEVERITY_TO_PRIORITY[aiResult.severity] || 'MEDIUM';
  const isCritical = aiResult.severity === 'critical';
  const generatedAlertId = `VIGI-${cameraId}-${ts}-${Date.now()}`;

  const alert = await Alert.create({
    alertId: generatedAlertId,
    title: `${eventMeta.event_type} — ${cameraLocation || cameraId}`,
    message: aiResult.description || `${eventMeta.event_type} detected`,
    type: 'SECURITY',
    severity: alertSeverity,
    priority: alertPriority,
    status: 'ACTIVE',
    isEmergency: isCritical,
    source: 'camera',
    sourceId: cameraId,
    mediaUrls: [publicPath],
    context: {
      vigi: {
        event_type: eventMeta.event_type,
        event_time: ts,
        camera_id: cameraId,
        camera_location: cameraLocation || null,
        ai_severity: aiResult.severity,
        ai_severity_reason: aiResult.severity_reason,
        ai_tags: aiResult.tags || [],
        ai_is_false_positive: aiResult.is_false_positive,
        ai_recommended_action: aiResult.recommended_action,
        ai_person_count: aiResult.person_count || 0,
        ai_vehicle_count: aiResult.vehicle_count || 0,
        ai_snapshot_path: publicPath,
        ai_model: aiResult._meta?.model || null,
        ai_tokens_used: aiResult._meta?.tokens || 0,
        ai_latency_ms: aiResult._meta?.latency_ms || 0,
      },
    },
  });

  // If migration has been run, also populate the dedicated AI columns
  try {
    await sequelize.query(
      `UPDATE alerts SET
        camera_id = ?, camera_location = ?, event_type = ?, event_time = FROM_UNIXTIME(?),
        ai_description = ?, ai_person_count = ?, ai_vehicle_count = ?,
        ai_severity = ?, ai_severity_reason = ?, ai_tags = ?,
        ai_is_false_positive = ?, ai_recommended_action = ?,
        ai_snapshot_path = ?, ai_processed_at = NOW(),
        ai_model = ?, ai_tokens_used = ?, ai_latency_ms = ?
       WHERE id = ?`,
      {
        replacements: [
          cameraId, cameraLocation || null, eventMeta.event_type, ts,
          aiResult.description, aiResult.person_count || 0, aiResult.vehicle_count || 0,
          aiResult.severity, aiResult.severity_reason, JSON.stringify(aiResult.tags || []),
          aiResult.is_false_positive ? 1 : 0, aiResult.recommended_action,
          publicPath,
          aiResult._meta?.model || null, aiResult._meta?.tokens || 0, aiResult._meta?.latency_ms || 0,
          alert.id,
        ],
        type: QueryTypes.UPDATE,
      }
    );
  } catch (_) {
    // AI columns not yet present — run the migration to enable them
  }

  // Auto-escalate to panic_alerts if critical
  let panicAlertId = null;
  const shouldEscalate = isCritical || aiResult.recommended_action === 'trigger_panic';

  if (shouldEscalate) {
    try {
      const [, meta] = await sequelize.query(
        `INSERT INTO panic_alerts
           (source, source_alert_id, camera_id, message, severity, reason, triggered_at, status)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
        {
          replacements: [
            'ai_auto_escalation', alert.id, cameraId,
            aiResult.description, 'critical', aiResult.severity_reason, 'open',
          ],
          type: QueryTypes.INSERT,
        }
      );
      panicAlertId = meta;
    } catch (err) {
      console.warn('[alertEnricher] panic_alerts insert failed (run migration?):', err.message);
    }
  }

  return { alertId: alert.id, panicAlertId, snapshotPath: publicPath };
}

module.exports = { persistEnrichedAlert };
