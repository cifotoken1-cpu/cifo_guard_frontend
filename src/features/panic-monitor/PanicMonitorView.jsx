import { useState } from 'react';
import { usePanicAlerts } from '../../hooks/usePanicAlerts';
import { PanicAlertList } from './PanicAlertList';
import { PanicAlertDetail } from './PanicAlertDetail';
import { PanicBroadcastPanel } from './PanicBroadcastPanel';
import styles from './panic-monitor.module.css';

function extractAlerts(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.alerts)) return data.alerts;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.rows)) return data.rows;
  return [];
}

export function PanicMonitorView() {
  const [selectedAlert, setSelectedAlert] = useState(null);
  const { data, isLoading } = usePanicAlerts();

  const alerts = extractAlerts(data);

  // Auto-select first active alert on load
  const displayAlert = selectedAlert ?? alerts.find((a) => a.status === 'ACTIVE') ?? alerts[0] ?? null;

  if (isLoading) {
    return (
      <div className={styles.view} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-lo)', fontSize: 13 }}>Memuat panic alerts...</div>
      </div>
    );
  }

  return (
    <div className={styles.view}>
      <PanicAlertList
        alerts={alerts}
        selectedId={displayAlert?.id}
        onSelect={setSelectedAlert}
      />
      <PanicAlertDetail alert={displayAlert} />
      <PanicBroadcastPanel alert={displayAlert} />
    </div>
  );
}
