import { useState } from 'react';
import { I } from '../../icons';
import { useCountingSummary, useDurationSummary, useCameraVisits, useDailyReport } from '../../hooks/useGateCount';
import { reportsApi } from '../../api/counting.api';
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
  const [showReport, setShowReport] = useState(false);
  const [expandedCam, setExpandedCam] = useState(null);
  const { data, isLoading, isError } = useCountingSummary(date);
  const { data: durationData } = useDurationSummary(date);
  const { data: reportData, isLoading: reportLoading } = useDailyReport(showReport ? date : null);

  const summary = data?.data ?? [];
  const totals = data?.totals ?? { in: 0, out: 0, inside: 0 };

  const durationMap = {};
  for (const d of durationData?.data ?? []) {
    durationMap[d.camera_id] = d;
  }
  const overall = durationData?.overall ?? {};

  const narrative = reportData?.data?.narrative;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Visitor Counting</div>
        <div className={styles.headerActions}>
          <button
            className={styles.actionBtn}
            onClick={() => setShowReport(!showReport)}
          >
            {I.clipboard} {showReport ? 'Tutup Laporan' : 'Laporan AI'}
          </button>
          <a
            className={styles.actionBtn}
            href={reportsApi.getExportCSVUrl(date)}
            download
          >
            {I.download} Export CSV
          </a>
          <input
            type="date"
            className={styles.dateInput}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
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

      {showReport && (
        <div className={styles.reportCard}>
          <div className={styles.reportHeader}>Ringkasan Harian AI</div>
          {reportLoading && <div className={styles.loading}>Generating report...</div>}
          {narrative && <div className={styles.reportBody}>{narrative}</div>}
          {!reportLoading && !narrative && reportData?.data?.ai_unavailable && (
            <div className={styles.reportBody}>
              OpenRouter API key belum dikonfigurasi. Set OPENROUTER_API_KEY di .env backend.
            </div>
          )}
          {!reportLoading && !narrative && !reportData?.data?.ai_unavailable && (
            <div className={styles.reportBody}>Belum ada data untuk generate laporan.</div>
          )}
        </div>
      )}

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
              const isExpanded = expandedCam === cam.camera_id;
              return (
                <>
                  <tr
                    key={cam.camera_id}
                    className={styles.clickableRow}
                    onClick={() => setExpandedCam(isExpanded ? null : cam.camera_id)}
                  >
                    <td>
                      <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                      {cam.camera_label}
                    </td>
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
                  {isExpanded && (
                    <tr key={`${cam.camera_id}-detail`}>
                      <td colSpan={6} className={styles.detailCell}>
                        <VisitorDetailTable cameraId={cam.camera_id} date={date} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function VisitorDetailTable({ cameraId, date }) {
  const { data, isLoading } = useCameraVisits(cameraId, date);
  const visits = data?.data ?? [];
  const [expandedVisit, setExpandedVisit] = useState(null);

  if (isLoading) return <div className={styles.loading}>Memuat data visitor...</div>;
  if (visits.length === 0) return <div className={styles.empty} style={{ padding: '1rem' }}>Belum ada data visit.</div>;

  return (
    <table className={styles.detailTable}>
      <thead>
        <tr>
          <th>#</th>
          <th>Visitor ID</th>
          <th>Masuk</th>
          <th>Keluar</th>
          <th>Durasi</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {visits.map((v, i) => {
          const entryTime = v.entry_time ? new Date(v.entry_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
          const exitTime = v.exit_time ? new Date(v.exit_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
          const isOpen = !v.exit_time;
          const hasMetadata = v.metadata && Object.keys(v.metadata).length > 0;
          const isExpanded = expandedVisit === v.id;
          return (
            <>
              <tr
                key={v.id}
                className={hasMetadata ? styles.clickableRow : undefined}
                onClick={() => hasMetadata && setExpandedVisit(isExpanded ? null : v.id)}
              >
                <td className={styles.mono}>
                  {hasMetadata && <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>}
                  {i + 1}
                </td>
                <td className={styles.mono}>{v.person_uid}</td>
                <td className={styles.mono}>{entryTime}</td>
                <td className={styles.mono}>{exitTime}</td>
                <td className={styles.mono}>{formatDuration(v.duration_seconds)}</td>
                <td>
                  <span className={isOpen ? styles.statusOpen : styles.statusClosed}>
                    {isOpen ? 'Di Dalam' : 'Selesai'}
                  </span>
                </td>
              </tr>
              {isExpanded && hasMetadata && (
                <tr key={`${v.id}-meta`}>
                  <td colSpan={6} className={styles.metadataCell}>
                    <div className={styles.metadataGrid}>
                      {v.metadata.appearance && (
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Penampilan</span>
                          <span className={styles.metaValue}>{v.metadata.appearance}</span>
                        </div>
                      )}
                      {v.metadata.exit_method && (
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>Metode Keluar</span>
                          <span className={styles.metaValue}>{v.metadata.exit_method}</span>
                        </div>
                      )}
                      {Object.entries(v.metadata)
                        .filter(([k]) => k !== 'appearance' && k !== 'exit_method')
                        .map(([k, val]) => (
                          <div className={styles.metaItem} key={k}>
                            <span className={styles.metaLabel}>{k}</span>
                            <span className={styles.metaValue}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                          </div>
                        ))
                      }
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
        })}
      </tbody>
    </table>
  );
}
