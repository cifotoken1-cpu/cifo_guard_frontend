import { useState, useEffect } from 'react';
import styles from './panic-monitor.module.css';

export function PanicAlertDetail({ alert }) {
  const [tick, setTick] = useState(0);
  const isResolved = alert?.status === 'RESOLVED';

  useEffect(() => {
    if (isResolved) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [isResolved]);

  if (!alert) {
    return (
      <div className={styles.detail}>
        <div className={styles.empty} style={{ paddingTop: '4rem' }}>
          Pilih panic alert untuk melihat detail.
        </div>
      </div>
    );
  }

  const endTime = isResolved
    ? new Date(alert.resolvedAt || alert.updatedAt || Date.now()).getTime()
    : Date.now();
  const elapsedMs = endTime - new Date(alert.createdAt).getTime();
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  const elapsedStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const loc = alert.location;
  const hasGps = loc?.lat != null && loc?.lng != null;

  const responderCount =
    alert.acknowledgedCount ?? alert.recipients?.length ?? '—';

  const gps =
    (alert.gps?.latitude != null ? alert.gps : null) ||
    (alert.metadata?.originalRequest?.gps?.latitude != null
      ? alert.metadata.originalRequest.gps
      : null);
  const locationLabel =
    loc?.address ||
    loc?.zone ||
    loc?.building ||
    (gps ? `${Number(gps.latitude).toFixed(4)}, ${Number(gps.longitude).toFixed(4)}` : null) ||
    'Lokasi tidak tersedia';

  return (
    <div className={styles.detail}>
      <div className={styles.banner}>
        <div className={styles.bannerRow}>
          <div className={styles.bannerIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="26" height="26">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className={styles.bannerStatus}>
              ⚡ PANIC ALERT · {alert.alertId || alert.id}
            </div>
            <div className={styles.bannerTitle}>
              {alert.title || alert.alertId || 'Panic Alert'}
            </div>
            <div className={styles.bannerSub}>{locationLabel}</div>
          </div>
          <div className={styles.elapsed}>
            <div className={styles.elapsedLabel}>{isResolved ? 'RESPONSE TIME' : 'ELAPSED'}</div>
            <div className={styles.elapsedTime} style={isResolved ? { color: 'var(--green)' } : undefined}>
              {elapsedStr}
            </div>
            {isResolved && (
              <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2, textAlign: 'right' }}>
                Ditangani dalam {m > 0 ? `${m} mnt ` : ''}{s} dtk
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.detailContent}>
        <div className={styles.kpiRow}>
          <div className={styles.kpi}>
            <div className={styles.kpiLbl}>Status</div>
            <div className={styles.kpiVal} style={{ fontSize: 13 }}>
              {alert.status || '—'}
            </div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLbl}>Responder</div>
            <div className={styles.kpiVal}>{responderCount}</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLbl}>Severity</div>
            <div className={styles.kpiVal} style={{ fontSize: 13 }}>
              {alert.severity || '—'}
            </div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiLbl}>Waktu</div>
            <div className={styles.kpiVal} style={{ fontSize: 11 }}>
              {new Date(alert.createdAt).toLocaleTimeString('id-ID')}
            </div>
          </div>
        </div>

        {hasGps && (
          <div className={styles.gpsBlock}>
            <div className={styles.gpsLabel}>Koordinat GPS</div>
            <div className={styles.gpsCoords}>
              {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
            </div>
          </div>
        )}

        {alert.description && (
          <div className={styles.kpi} style={{ borderRadius: 9 }}>
            <div className={styles.kpiLbl}>Keterangan</div>
            <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-hi)', lineHeight: 1.5 }}>
              {alert.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
