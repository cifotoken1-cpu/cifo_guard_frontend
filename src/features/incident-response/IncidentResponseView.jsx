import { useState } from 'react';
import { useIncidents } from '../../hooks/useIncidents';
import { IncidentStats } from './IncidentStats';
import { IncidentKanban } from './IncidentKanban';
import { IncidentDetailPane } from './IncidentDetailPane';
import styles from './incident-response.module.css';

function extractIncidents(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.incidents)) return data.incidents;
  if (Array.isArray(data.rows)) return data.rows;
  return [];
}

export function IncidentResponseView() {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const { data, isLoading } = useIncidents({ limit: 200 });

  const incidents = extractIncidents(data);

  if (isLoading) {
    return (
      <div className={styles.view} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-lo)', fontSize: 13 }}>Memuat data insiden...</div>
      </div>
    );
  }

  return (
    <div className={styles.view}>
      <IncidentStats incidents={incidents} />
      <div className={styles.grid}>
        <div className={styles.kanbanWrap}>
          <IncidentKanban
            incidents={incidents}
            selectedId={selectedIncident?.id}
            onSelect={setSelectedIncident}
          />
        </div>
        <IncidentDetailPane incident={selectedIncident} />
      </div>
    </div>
  );
}
