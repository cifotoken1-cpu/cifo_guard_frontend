import { useUIStore } from '../../store/ui.store';
import { useCameras } from '../../hooks/useCamerasStream';
import { useRecentActivities } from '../../hooks/useActivitiesStream';
import { normalizeCameraList } from '../../services/camera.service';
import { CameraCard } from '../cameras/CameraCard';
import { useClock } from '../../hooks/useClock';
import { relativeTime } from '../../utils/format';
import styles from './RightPanel.module.css';

export function RightPanel() {
  const time = useClock();
  const openModal = useUIStore((s) => s.openModal);
  const sectionVisibility = useUIStore((s) => s.sectionVisibility);
  const { data: camerasData } = useCameras();
  const { data: activities } = useRecentActivities(15);

  // Normalize camera list from API response
  const cameras = normalizeCameraList(camerasData) ?? [];
  const visibleCams = cameras.slice(0, 3);

  const log = mapActivitiesToLog(activities);

  // Check if all CenterPanel sections are hidden for fullscreen layout
  const isCenterPanelEmpty =
    !sectionVisibility.overview &&
    !sectionVisibility.securityMode;

  return (
    <aside className={`${styles.right} ${isCenterPanelEmpty ? styles.fullscreen : ''}`}>
      <div className="section-hd">
        <div className="section-label">Live Cameras</div>
        <div className="section-action" onClick={() => openModal('cameras')}>
          Fullscreen
        </div>
      </div>

      {visibleCams.length === 0 ? (
        <div className={styles.empty} style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
          Connecting to cameras...
        </div>
      ) : (
        <div className={styles.camerasContainer}>
          {visibleCams.map((cam, i) => (
            <CameraCard key={cam.id} cam={cam} time={time} bgIndex={i} />
          ))}
        </div>
      )}

      {sectionVisibility.activityLog && (
        <>
          <div className="section-hd" style={{ marginTop: 4 }}>
            <div className="section-label">Activity Log</div>
            <div className="section-action">Clear</div>
          </div>

          <div className={styles.log}>
            {log.length === 0 ? (
              <div className={styles.empty}>No activity yet.</div>
            ) : (
              log.map((entry) => (
                <div key={entry.id} className={styles.logItem}>
                  <span className={`${styles.dot} ${styles[`dot_${entry.type}`]}`} />
                  <div className={styles.body}>
                    <div className={styles.msg}>{entry.msg}</div>
                    <div className={styles.time}>{entry.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function mapActivitiesToLog(activities) {
  if (!activities || !Array.isArray(activities)) return [];
  return activities.slice(0, 15).map((a) => ({
    id: a.id,
    type: deriveLogType(a),
    msg: <>{a.description || a.type}</>,
    time: relativeTime(a.timestamp),
  }));
}

function deriveLogType(activity) {
  const sev = (activity.severity || '').toUpperCase();
  if (sev === 'CRITICAL' || sev === 'ERROR') return 'alert';
  const t = (activity.type || '').toUpperCase();
  if (t.includes('DOOR')) return 'door';
  if (t.includes('MOTION') || t.includes('PIR')) return 'motion';
  return 'system';
}
