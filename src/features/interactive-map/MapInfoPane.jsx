import styles from './interactive-map.module.css';

const TYPE_LABEL = { incident: 'Insiden', panic: 'Panic Alert', cctv: 'Kamera CCTV' };
const TYPE_BADGE = { incident: 'badgeRed', panic: 'badgeRed', cctv: 'badgeCyan' };

const PRI_BADGE = { HIGH: 'badgeRed', CRITICAL: 'badgeRed', MEDIUM: 'badgeAmber', LOW: 'badgeCyan' };
const PRI_LABEL = { HIGH: 'Tinggi', CRITICAL: 'Kritis', MEDIUM: 'Sedang', LOW: 'Rendah' };

export function MapInfoPane({ pin }) {
  if (!pin) {
    return (
      <div className={styles.infoPane}>
        <div className={styles.infoHd}>
          <div className={styles.infoTitle}>Info Pin</div>
        </div>
        <div className={styles.empty}>Klik pin di peta untuk melihat detail.</div>
      </div>
    );
  }

  const { data } = pin;

  return (
    <div className={styles.infoPane}>
      <div className={styles.infoHd}>
        <div className={styles.pinTypeLabel} style={{ color: pin.color }}>
          {TYPE_LABEL[pin.type] || pin.type}
        </div>
        <div className={styles.infoTitle}>{pin.name}</div>
        {pin.sub && (
          <div style={{ fontSize: 11, color: 'var(--text-lo)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {pin.sub}
          </div>
        )}
      </div>

      <div className={styles.infoBody}>
        {pin.type === 'incident' && data && (
          <>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>ID Insiden</div>
              <div className={styles.fieldVal}>{data.incidentNumber || data.id}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Status</div>
              <div className={styles.fieldVal}>{data.status}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Prioritas</div>
              <div className={styles.fieldVal}>
                <span className={`${styles.badge} ${styles[PRI_BADGE[(data.priority || '').toUpperCase()] || 'badgeCyan']}`}>
                  {PRI_LABEL[(data.priority || '').toUpperCase()] || data.priority}
                </span>
              </div>
            </div>
            {(data.location?.latitude || data.location?.longitude) && (
              <div className={styles.field}>
                <div className={styles.fieldLbl}>Koordinat GPS</div>
                <div className={styles.fieldVal}>
                  {data.location.latitude?.toFixed(6)}, {data.location.longitude?.toFixed(6)}
                </div>
              </div>
            )}
          </>
        )}

        {pin.type === 'panic' && data && (
          <>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Alert ID</div>
              <div className={styles.fieldVal}>{data.alertId || data.id}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Status</div>
              <div className={styles.fieldVal}>{data.status}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Waktu</div>
              <div className={styles.fieldVal}>
                {new Date(data.createdAt).toLocaleString('id-ID')}
              </div>
            </div>
            {(data.location?.lat || data.location?.lng) && (
              <div className={styles.field}>
                <div className={styles.fieldLbl}>Koordinat GPS</div>
                <div className={styles.fieldVal}>
                  {data.location.lat?.toFixed(6)}, {data.location.lng?.toFixed(6)}
                </div>
              </div>
            )}
          </>
        )}

        {pin.type === 'cctv' && data && (
          <>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Nama Kamera</div>
              <div className={styles.fieldVal}>{data.name}</div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Status</div>
              <div className={styles.fieldVal}>
                <span className={`${styles.badge} ${data.status === 'online' ? styles.badgeCyan : styles.badgeRed}`}>
                  {data.status?.toUpperCase()}
                </span>
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLbl}>Resolusi</div>
              <div className={styles.fieldVal}>{data.res || '1080p'}</div>
            </div>
            {(data.lat || data.lng) && (
              <div className={styles.field}>
                <div className={styles.fieldLbl}>Koordinat GPS</div>
                <div className={styles.fieldVal}>
                  {data.lat?.toFixed(6)}, {data.lng?.toFixed(6)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
