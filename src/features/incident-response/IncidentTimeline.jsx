import styles from './incident-response.module.css';

const TYPE_DOT = {
  INCIDENT_CREATED: 'tlDotRed',
  STATUS_CHANGED: 'tlDotAmber',
  INCIDENT_ASSIGNED: 'tlDotCyan',
  INCIDENT_UPDATED: 'tlDotAmber',
};

export function IncidentTimeline({ activities }) {
  if (!activities || activities.length === 0) {
    return <div className={styles.empty}>Belum ada riwayat aktivitas.</div>;
  }

  return (
    <div className={styles.timeline}>
      {activities.map((act) => {
        const typeKey = (act.type || '').toUpperCase();
        const dotClass = TYPE_DOT[typeKey] || 'tlDotGray';

        return (
          <div key={act.id} className={styles.tlItem}>
            <div className={`${styles.tlDot} ${styles[dotClass]}`} />
            <div className={styles.tlTime}>
              {new Date(act.createdAt || act.timestamp).toLocaleString('id-ID')}
            </div>
            <div className={styles.tlMsg}>{act.description || act.type}</div>
            {act.userId && (
              <div className={styles.tlBy}>{act.userId}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
