import styles from './panic-monitor.module.css';

const STATUS_LABEL = { ACTIVE: 'AKTIF', ACKNOWLEDGED: 'INVESTIGASI', RESOLVED: 'SELESAI' };
const STATUS_CLASS = { ACTIVE: 'badgeRed', ACKNOWLEDGED: 'badgeAmber', RESOLVED: 'badgeGreen' };

function initials(name) {
  if (!name) return '??';
  return name.split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase();
}

function locationLabel(alert) {
  return (
    alert.location?.address ||
    alert.location?.zone ||
    alert.location?.building ||
    (alert.gps?.latitude != null
      ? `${Number(alert.gps.latitude).toFixed(4)}, ${Number(alert.gps.longitude).toFixed(4)}`
      : null) ||
    'Lokasi tidak tersedia'
  );
}

export function PanicAlertList({ alerts = [], selectedId, onSelect }) {
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const activeCount = safeAlerts.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className={styles.listCard}>
      <div className={styles.listHd}>
        <div className={styles.listTitle}>Panic Alerts</div>
        {activeCount > 0 && (
          <span className={`${styles.badge} ${styles.badgeRed}`}>
            {activeCount} AKTIF
          </span>
        )}
      </div>

      <div className={styles.list}>
        {safeAlerts.length === 0 && (
          <div className={styles.empty}>Tidak ada panic alert.</div>
        )}
        {safeAlerts.map((a) => {
          const statusCls = (a.status || '').toUpperCase();
          const itemClass = [
            styles.alertItem,
            statusCls === 'ACTIVE' ? styles.active : '',
            statusCls === 'ACKNOWLEDGED' ? styles.acknowledged : '',
            statusCls === 'RESOLVED' ? styles.resolved : '',
            selectedId === a.id ? styles.selected : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={a.id} className={itemClass} onClick={() => onSelect(a)}>
              <div className={styles.alertRow}>
                <div className={styles.avatar}>{initials(a.title || a.alertId)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.alertName}>{a.title || a.alertId}</div>
                  <div className={styles.alertLoc}>📍 {locationLabel(a)}</div>
                </div>
              </div>
              <div className={styles.alertMeta}>
                <div className={styles.alertTime}>
                  {new Date(a.createdAt).toLocaleTimeString('id-ID')}
                </div>
                <span
                  className={`${styles.badge} ${styles[STATUS_CLASS[statusCls] || 'badgeGreen']}`}
                >
                  {STATUS_LABEL[statusCls] || statusCls}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
