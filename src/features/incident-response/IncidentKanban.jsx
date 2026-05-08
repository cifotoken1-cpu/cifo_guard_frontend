import { IncidentCard } from './IncidentCard';
import styles from './incident-response.module.css';

const COLUMNS = [
  { id: 'OPEN', title: 'Dilaporkan', dotColor: '#8a99b8' },
  { id: 'IN_PROGRESS', title: 'Dalam Proses', dotColor: 'var(--amber)' },
  { id: 'RESOLVED', title: 'Selesai', dotColor: 'var(--green)' },
];

export function IncidentKanban({ incidents, selectedId, onSelect }) {
  const all = Array.isArray(incidents) ? incidents : [];

  return (
    <div className={styles.kanban}>
      {COLUMNS.map((col) => {
        const items = all.filter((i) => {
          if (col.id === 'RESOLVED') return i.status === 'RESOLVED' || i.status === 'CLOSED';
          return i.status === col.id;
        });

        return (
          <div key={col.id} className={styles.col}>
            <div className={styles.colHd}>
              <div className={styles.colTitle}>
                <span
                  className={styles.colDot}
                  style={{ background: col.dotColor }}
                />
                {col.title}
              </div>
              <div className={styles.colCount}>{items.length}</div>
            </div>
            {items.map((inc) => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                selected={selectedId === inc.id}
                onClick={() => onSelect(inc)}
              />
            ))}
            {items.length === 0 && (
              <div className={styles.empty} style={{ padding: '1rem 0.5rem' }}>
                Tidak ada insiden.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
