import { I } from '../../icons';
import { useSystemStore } from '../../store/system.store';
import { useUIStore } from '../../store/ui.store';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { PanicMonitorView } from '../panic-monitor/PanicMonitorView';
import { IncidentResponseView } from '../incident-response/IncidentResponseView';
import { InteractiveMapView } from '../interactive-map/InteractiveMapView';
import { MediaView } from '../media/MediaView';
import { UsersPage } from '../users/UsersPage';
import { useActiveAlerts } from '../../hooks/useAlertsStream';
import { useCameras } from '../../hooks/useCamerasStream';
import { useRecentActivities } from '../../hooks/useActivitiesStream';
import { useClock } from '../../hooks/useClock';
import { relativeTime } from '../../utils/format';
import { normalizeCameraList } from '../../services/camera.service';
import { CameraCard } from '../cameras/CameraCard';
import styles from './CenterPanel.module.css';

const MODES = [
  { id: 'panic', label: 'Panic', icon: I.alert },
];

export function CenterPanel() {
  const activeNav = useSystemStore((s) => s.activeNav);
  const openModal = useUIStore((s) => s.openModal);
  const sectionVisibility = useUIStore((s) => s.sectionVisibility);
  const time = useClock();

  const { data: alertsData } = useActiveAlerts();
  const { data: camerasData } = useCameras();
  const { data: activities } = useRecentActivities(20);

  // New dedicated views for panic, incidents, map, and media
  if (activeNav === 'panic')
    return (
      <ErrorBoundary>
        <PanicMonitorView />
      </ErrorBoundary>
    );
  if (activeNav === 'incidents')
    return (
      <ErrorBoundary>
        <IncidentResponseView />
      </ErrorBoundary>
    );
  if (activeNav === 'map')
    return (
      <ErrorBoundary>
        <InteractiveMapView />
      </ErrorBoundary>
    );
  if (activeNav === 'media')
    return (
      <ErrorBoundary>
        <MediaView />
      </ErrorBoundary>
    );
  if (activeNav === 'users')
    return (
      <ErrorBoundary>
        <UsersPage />
      </ErrorBoundary>
    );

  const activeAlerts = alertsData?.alerts ?? alertsData ?? [];
  const alertCount = Array.isArray(activeAlerts) ? activeAlerts.length : 0;
  const camerasOnline = camerasData?.online ?? 0;
  const sensors = deriveSensors(activities);
  const sensorsClear = sensors.filter((s) => s.status === 'clear').length;
  const openCount = sensors.filter((s) => s.status === 'open').length;

  // Camera data
  const cameras = normalizeCameraList(camerasData) ?? [];
  const visibleCams = cameras.slice(0, 3);

  // Activity log data
  const log = mapActivitiesToLog(activities);

  function handleModeClick(id) {
    if (id === 'panic') {
      // Open panic confirmation modal — actual POST happens after confirm
      openModal('panic-confirm');
    }
  }

  return (
    <main className={styles.center}>
      {/* Metrics */}
      {sectionVisibility.overview && (
        <section>
          <div className="section-hd">
            <div className="section-label">Overview</div>
          </div>
          <div className={styles.metrics}>
            <MetricCard
              num={alertCount}
              label="Active Alerts"
              sub={alertCount > 0 ? 'Requires attention' : 'All clear'}
              tone={alertCount > 0 ? 'red' : 'green'}
            />
            <MetricCard
              num={openCount}
              label="Open Sensors"
              sub={openCount > 0 ? `${openCount} unsecured` : 'All secured'}
              tone={openCount > 0 ? 'amber' : 'green'}
            />
            <MetricCard num={camerasOnline} label="Cameras Live" sub="Streams active" tone="cyan" />
            <MetricCard num={sensorsClear} label="Sensors Clear" sub={`of ${sensors.length} total`} tone="green" />
          </div>
        </section>
      )}

      {/* Emergency */}
      {sectionVisibility.securityMode && (
        <section>
          <div className="section-hd">
            <div className="section-label">Emergency</div>
          </div>
          <div className={styles.modeRow}>
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`${styles.modeBtn} ${m.id === 'panic' ? styles.panicActive : ''}`}
                onClick={() => handleModeClick(m.id)}
              >
                <span style={{ width: 16, height: 16 }}>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Sensors */}
      {sectionVisibility.sensorStatus && (
        <section>
          <div className="section-hd">
            <div className="section-label">Sensor Status</div>
            <div className="section-action" onClick={() => openModal('alerts')}>
              View all
            </div>
          </div>
          <div className={styles.sensorList}>
            {sensors.length === 0 && (
              <div className={styles.sensorEmpty}>No sensor activity yet.</div>
            )}
            {sensors.slice(0, 6).map((sen) => (
              <div key={sen.id} className={styles.sensorItem}>
                <span className={styles.sensorIcon}>
                  {sen.type === 'door' ? I.doorOpen : I.motion}
                </span>
                <div className={styles.sensorInfo}>
                  <div className={styles.sensorName}>{sen.name}</div>
                  <div className={styles.sensorTime}>
                    {sen.loc} · {sen.time}
                  </div>
                </div>
                <span className={`${styles.sensorStatus} ${styles[`status_${sen.status}`]}`}>
                  {STATUS_LABEL[sen.status]}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live Cameras */}
      {sectionVisibility.liveCameras && (
        <section>
          <div className="section-hd">
            <div className="section-label">Live Cameras</div>
            <div className="section-action" onClick={() => openModal('cameras')}>
              Fullscreen
            </div>
          </div>
          {visibleCams.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#999', fontSize: '0.875rem' }}>
              Connecting to cameras...
            </div>
          ) : (
            <div className={styles.camerasGrid}>
              {visibleCams.map((cam, i) => (
                <CameraCard key={cam.id} cam={cam} time={time} bgIndex={i} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Activity Log */}
      {sectionVisibility.activityLogPanel && (
        <section>
          <div className="section-hd">
            <div className="section-label">Activity Log</div>
            <div className="section-action">Clear</div>
          </div>
          <div className={styles.logList}>
            {log.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#999', fontSize: '0.875rem' }}>
                No activity yet.
              </div>
            ) : (
              log.map((entry) => (
                <div key={entry.id} className={styles.logItem}>
                  <span className={`${styles.dot} ${styles[`dot_${entry.type}`]}`} />
                  <div className={styles.logBody}>
                    <div className={styles.logMsg}>{entry.msg}</div>
                    <div className={styles.logTime}>{entry.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function MetricCard({ num, label, sub, tone = 'green' }) {
  return (
    <div className={`${styles.metric} ${styles[`mc_${tone}`]}`}>
      <div className={`${styles.metricNum} ${styles[`c_${tone}`]}`}>{num}</div>
      <div className={styles.metricLbl}>{label}</div>
      <div className={styles.metricSub}>{sub}</div>
    </div>
  );
}

const STATUS_LABEL = {
  open: 'Open',
  clear: 'Clear',
  alert: 'Alert!',
  offline: 'Offline',
};

/**
 * Derive sensor list from recent activities.
 * Backend doesn't have a dedicated /sensors endpoint yet, so we infer from activity types.
 *
 * @stub: backend-blocked — /api/sensors endpoint belum ada, sensor di-derive dari activities/recent (fragile, race-prone). Lihat #8, INTEGRATION_STATUS.md #4.
 */
function deriveSensors(activities) {
  if (!activities || !Array.isArray(activities)) return DEFAULT_SENSORS;
  if (activities.length === 0) return DEFAULT_SENSORS;

  // Filter for sensor-related activities
  const sensorActs = activities.filter((a) => {
    const t = (a.type || '').toUpperCase();
    return t.includes('DOOR') || t.includes('MOTION') || t.includes('SENSOR') || t.includes('PIR');
  });

  if (sensorActs.length === 0) return DEFAULT_SENSORS;

  return sensorActs.slice(0, 8).map((a, i) => ({
    id: a.id ?? i,
    type: (a.type || '').toUpperCase().includes('MOTION') ? 'motion' : 'door',
    name: a.description?.slice(0, 40) || a.type || 'Sensor',
    loc: a.metadata?.location || a.actor_type || 'Unknown',
    time: relativeTime(a.timestamp),
    status: deriveStatus(a),
  }));
}

function deriveStatus(activity) {
  const sev = (activity.severity || '').toUpperCase();
  if (sev === 'CRITICAL' || sev === 'ERROR') return 'alert';
  if (sev === 'WARNING') return 'open';
  return 'clear';
}

// @stub: backend-blocked — 6 sensor hardcoded sebagai fallback saat activities kosong (UX dev). Hapus saat /api/sensors siap. Lihat #8, INTEGRATION_STATUS.md #4.
// Fallback when no real data yet — keeps UI looking populated during dev
const DEFAULT_SENSORS = [
  { id: 0, type: 'door', name: 'Living Room Door', loc: 'Ground Floor', time: '23 hrs ago', status: 'open' },
  { id: 1, type: 'door', name: 'Guest Bedroom Door', loc: 'First Floor', time: '12 hrs ago', status: 'open' },
  { id: 2, type: 'motion', name: 'TV Cabinet PIR', loc: 'Living Room', time: '7 min ago', status: 'clear' },
  { id: 3, type: 'motion', name: 'First Hallway Motion', loc: 'Ground Floor', time: '7 min ago', status: 'clear' },
  { id: 4, type: 'door', name: 'Front Door Sensor', loc: 'Exterior', time: '2 days ago', status: 'clear' },
  { id: 5, type: 'motion', name: 'Garage Motion', loc: 'Exterior', time: '1 hr ago', status: 'alert' },
];

/**
 * Map activities to activity log entries
 */
function mapActivitiesToLog(activities) {
  if (!activities || !Array.isArray(activities)) return [];
  return activities.slice(0, 15).map((a) => ({
    id: a.id,
    type: deriveLogType(a),
    msg: <>{a.description || a.type}</>,
    time: relativeTime(a.timestamp),
  }));
}

/**
 * Derive log entry type from activity
 */
function deriveLogType(activity) {
  const sev = (activity.severity || '').toUpperCase();
  if (sev === 'CRITICAL' || sev === 'ERROR') return 'alert';
  const t = (activity.type || '').toUpperCase();
  if (t.includes('DOOR')) return 'door';
  if (t.includes('MOTION') || t.includes('PIR')) return 'motion';
  return 'system';
}
