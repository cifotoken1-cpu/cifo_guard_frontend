import styles from './incident-response.module.css';

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function ago(ms) {
  return Date.now() - ms;
}

export function IncidentStats({ incidents }) {
  const all = Array.isArray(incidents) ? incidents : [];
  const todayStart = startOfDay();

  const todayCount = all.filter((i) => new Date(i.createdAt).getTime() >= todayStart).length;
  const criticalActive = all.filter(
    (i) => i.priority === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ).length;
  const inProgress = all.filter((i) => i.status === 'IN_PROGRESS').length;
  const resolved24h = all.filter((i) => {
    if (i.status !== 'RESOLVED' && i.status !== 'CLOSED') return false;
    const resolved = i.resolvedAt ? new Date(i.resolvedAt).getTime() : new Date(i.updatedAt).getTime();
    return ago(resolved) < 24 * 60 * 60 * 1000;
  }).length;

  // Avg resolution time from resolved incidents
  const resolvedWithTimes = all.filter((i) => (i.status === 'RESOLVED' || i.status === 'CLOSED') && i.createdAt && (i.resolvedAt || i.updatedAt));
  const avgMin =
    resolvedWithTimes.length > 0
      ? Math.round(
          resolvedWithTimes.reduce((sum, i) => {
            const end = new Date(i.resolvedAt || i.updatedAt).getTime();
            const start = new Date(i.createdAt).getTime();
            return sum + (end - start) / 60_000;
          }, 0) / resolvedWithTimes.length
        )
      : null;

  const statItems = [
    {
      label: 'Insiden Hari Ini',
      num: todayCount,
      color: 'var(--red)',
      bg: 'rgba(239,68,68,0.12)',
    },
    {
      label: 'Kritis Aktif',
      num: criticalActive,
      color: 'var(--red)',
      bg: 'rgba(239,68,68,0.10)',
    },
    {
      label: 'Dalam Proses',
      num: inProgress,
      color: 'var(--amber)',
      bg: 'rgba(251,191,36,0.10)',
    },
    {
      label: 'Selesai (24j)',
      num: resolved24h,
      color: 'var(--green)',
      bg: 'rgba(34,197,94,0.10)',
    },
    {
      label: 'Avg. Resolution',
      num: avgMin != null ? `${avgMin}m` : '—',
      color: 'var(--cyan)',
      bg: 'rgba(99,179,237,0.10)',
    },
  ];

  return (
    <div className={styles.stats}>
      {statItems.map((s) => (
        <div key={s.label} className={styles.stat}>
          <div className={styles.statIcon} style={{ background: s.bg, color: s.color }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <div className={styles.statNum} style={{ color: s.color }}>{s.num}</div>
            <div className={styles.statLbl}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
