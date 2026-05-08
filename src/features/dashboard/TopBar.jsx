import { I } from '../../icons';
import { useSystemStore } from '../../store/system.store';
import { useUIStore } from '../../store/ui.store';
import { useAlertStats } from '../../hooks/useAlertsStream';
import { useCameras } from '../../hooks/useCamerasStream';
import { useHealth } from '../../hooks/useSystemHealth';
import { formatUptime } from '../../utils/format';
import styles from './TopBar.module.css';

export function TopBar() {
  const armed = useSystemStore((s) => s.armed);
  const openModal = useUIStore((s) => s.openModal);

  const { data: alertStats } = useAlertStats();
  const { data: camerasData } = useCameras();
  const { data: health } = useHealth();

  const alertCount = alertStats?.active ?? alertStats?.total ?? 0;
  const camerasOnline = camerasData?.online ?? 0;
  const camerasTotal = camerasData?.total ?? 0;
  const sensorsActive = camerasData?.total ?? 0; // placeholder
  const uptime = formatUptime(health?.uptime || 0);
  const version = health?.version || 'v0.0.0';

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <span style={{ width: 16, height: 16, color: 'rgba(99,179,237,0.9)' }}>
            {I.shield}
          </span>
        </div>
        CIFO GUARD
      </div>

      <div className={styles.stats}>
        <Stat label="System" value={armed ? 'ARMED' : 'DISARMED'} tone={armed ? 'bad' : 'ok'} dot />
        <Stat
          label="Alerts"
          value={alertCount}
          tone={alertCount > 0 ? 'bad' : 'ok'}
          clickable
          onClick={() => openModal('alerts')}
          title="View active alerts"
        />
        <Stat
          label="Cameras"
          value={`${camerasOnline}/${camerasTotal} Online`}
          tone="info"
          clickable
          onClick={() => openModal('cameras')}
          title="View all cameras"
        />
        <Stat label="Sensors" value={`${sensorsActive} Active`} tone="ok" />
        <Stat label="Backup" value="100%" tone="ok" icon={I.battery} />
      </div>

      <div className={styles.right}>
        <div className={styles.chip}>UPTIME {uptime}</div>
        <div className={styles.chipDim}>{version}</div>
      </div>
    </header>
  );
}

function Stat({ label, value, tone = 'ok', dot, clickable, onClick, title, icon }) {
  return (
    <div
      className={`${styles.stat} ${clickable ? styles.clickable : ''}`}
      onClick={onClick}
      title={title}
    >
      {dot && <span className={`${styles.dot} ${styles[`dot_${tone}`]}`} />}
      {icon && (
        <span style={{ width: 12, height: 12, display: 'inline-flex' }}>{icon}</span>
      )}
      <span>{label}</span>
      <span className={`${styles.val} ${styles[`val_${tone}`]}`}>{value}</span>
    </div>
  );
}
