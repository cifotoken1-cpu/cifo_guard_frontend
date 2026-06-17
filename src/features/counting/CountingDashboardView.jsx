import { useState } from 'react';
import { I } from '../../icons';
import { useCountingSummary, useDurationSummary } from '../../hooks/useGateCount';
import styles from './CountingDashboardView.module.css';

function formatDuration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function CountingDashboardView() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { data, isLoading, isError } = useCountingSummary(date);
  const { data: durationData } = useDurationSummary(date);

  const summary = data?.data ?? [];
  const totals = data?.totals ?? { in: 0, out: 0, inside: 0 };

  const durationMap = {};
  for (const d of durationData?.data ?? []) {
    durationMap[d.camera_id] = d;
  }
  const overall = durationData?.overall ?? {};

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Visitor Counting</div>
        <input
          type="date"
          className={styles.dateInput}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className={styles.totals}>
        <div className={`${styles.totalCard} ${styles.totalIn}`}>
          <div className={`${styles.totalNum} ${styles.numIn}`}>{totals.in}</div>
          <div className={styles.totalLabel}>Masuk</div>
        </div>
        <div className={`${styles.totalCard} ${styles.totalOut}`}>
          <div className={`${styles.totalNum} ${styles.numOut}`}>{totals.out}</div>
          <div className={styles.totalLabel}>Keluar</div>
        </div>
        <div className={`${styles.totalCard} ${styles.totalInside}`}>
          <div className={`${styles.totalNum} ${styles.numInside}`}>{totals.inside}</div>
          <div className={styles.totalLabel}>Di Dalam</div>
        </div>
        <div className={`${styles.totalCard} ${styles.totalDuration}`}>
          <div className={`${styles.totalNum} ${styles.numDuration}`}>
            {formatDuration(overall.avg_duration)}
          </div>
          <div className={styles.totalLabel}>Rata-rata Durasi</div>
        </div>
      </div>

      {isLoading && <div className={styles.loading}>Memuat data...</div>}

      {isError && <div className={styles.error}>Gagal memuat data counting.</div>}

      {!isLoading && !isError && summary.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>{I.media}</div>
          Belum ada data crossing untuk tanggal ini.
        </div>
      )}

      {!isLoading && summary.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Kamera</th>
              <th>Masuk</th>
              <th>Keluar</th>
              <th>Di Dalam</th>
              <th>Avg Durasi</th>
              <th>Visits</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((cam) => {
              const dur = durationMap[cam.camera_id];
              return (
                <tr key={cam.camera_id}>
                  <td>{cam.camera_label}</td>
                  <td className={styles.mono}>{cam.in}</td>
                  <td className={styles.mono}>{cam.out}</td>
                  <td>
                    <span className={styles.insideBadge}>{cam.inside}</span>
                  </td>
                  <td className={styles.mono}>{formatDuration(dur?.avg_duration)}</td>
                  <td className={styles.mono}>
                    {dur ? `${dur.completed_visits}/${dur.total_visits}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
