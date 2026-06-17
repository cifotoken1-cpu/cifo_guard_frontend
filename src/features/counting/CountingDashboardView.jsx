import { useState } from 'react';
import { I } from '../../icons';
import { useCountingSummary } from '../../hooks/useGateCount';
import styles from './CountingDashboardView.module.css';

export function CountingDashboardView() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { data, isLoading, isError } = useCountingSummary(date);

  const summary = data?.data ?? [];
  const totals = data?.totals ?? { in: 0, out: 0, inside: 0 };

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
            </tr>
          </thead>
          <tbody>
            {summary.map((cam) => (
              <tr key={cam.camera_id}>
                <td>{cam.camera_label}</td>
                <td className={styles.mono}>{cam.in}</td>
                <td className={styles.mono}>{cam.out}</td>
                <td>
                  <span className={styles.insideBadge}>{cam.inside}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
