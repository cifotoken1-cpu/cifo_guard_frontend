import styles from './incident-response.module.css';

const PRI_CLASS = {
  HIGH: 'priHigh',
  CRITICAL: 'priCritical',
  MEDIUM: 'priMedium',
  LOW: 'priLow',
};

const PRI_BADGE_CLASS = {
  HIGH: 'badgeRed',
  CRITICAL: 'badgeRed',
  MEDIUM: 'badgeAmber',
  LOW: 'badgeCyan',
};

const PRI_LABEL = {
  HIGH: 'TINGGI',
  CRITICAL: 'KRITIS',
  MEDIUM: 'SEDANG',
  LOW: 'RENDAH',
};

export function IncidentCard({ incident, selected, onClick }) {
  const pri = (incident.priority || '').toUpperCase();

  return (
    <div
      className={[
        styles.card,
        styles[PRI_CLASS[pri]] || '',
        selected ? styles.selected : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      <div className={styles.cardId}>{incident.incidentNumber || incident.id}</div>
      <div className={styles.cardTitle}>{incident.title}</div>
      <div className={styles.cardMeta}>
        <span>📍 {incident.location?.name || 'Lokasi tidak diketahui'}</span>
        <span className={`${styles.badge} ${styles[PRI_BADGE_CLASS[pri]] || styles.badgeGray}`}>
          {PRI_LABEL[pri] || pri}
        </span>
      </div>
    </div>
  );
}
