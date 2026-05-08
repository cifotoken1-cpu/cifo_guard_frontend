import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { I } from '../../icons';
import { useUIStore } from '../../store/ui.store';
import { useActiveAlerts } from '../../hooks/useAlertsStream';
import { alertsApi } from '../../api/alerts.api';
import { relativeTime } from '../../utils/format';
import styles from './AlertsModal.module.css';

export function AlertsModal() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { data } = useActiveAlerts();
  const qc = useQueryClient();

  const alerts = Array.isArray(data) ? data : data?.alerts || [];
  const activeCount = alerts.length;

  const resolveAll = useMutation({
    mutationFn: async () => {
      const promises = alerts.map((a) => alertsApi.resolve(a.id).catch(() => null));
      return Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      closeModal();
    },
  });

  const resolveOne = useMutation({
    mutationFn: (id) => alertsApi.resolve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <Modal
      open={modal === 'alerts'}
      onClose={closeModal}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Active Alerts
          {activeCount > 0 && (
            <span className={styles.badge}>{activeCount} ACTIVE</span>
          )}
        </span>
      }
      titleIcon={I.alert}
      titleIconStyle={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}
      footer={
        <>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => resolveAll.mutate()}
            disabled={resolveAll.isPending || alerts.length === 0}
          >
            <span style={{ width: 14, height: 14 }}>{I.shield}</span>
            {resolveAll.isPending ? 'Resolving…' : 'Resolve All'}
          </button>
          <button className={`${styles.btn} ${styles.btnSec}`} onClick={closeModal}>
            Dismiss
          </button>
        </>
      }
    >
      {alerts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>✓</div>
          <div style={{ color: 'var(--green)', fontWeight: 600, marginBottom: 6 }}>
            All Clear
          </div>
          No active alerts at this time
        </div>
      ) : (
        alerts.map((a) => (
          <div
            key={a.id}
            className={styles.item}
            onClick={() => resolveOne.mutate(a.id)}
          >
            <div className={styles.itemIcon}>
              <span style={{ width: 18, height: 18 }}>{I.alert}</span>
            </div>
            <div className={styles.info}>
              <div className={styles.name}>
                {a.type || 'ALERT'} {a.priority && `· ${a.priority}`}
              </div>
              <div className={styles.loc}>
                {a.user_id || 'unknown'} · {relativeTime(a.created_at || a.timestamp)}
              </div>
              {a.description && (
                <div className={styles.desc}>{a.description}</div>
              )}
            </div>
            <span className={styles.alertBadge}>{a.status || 'ACTIVE'}</span>
          </div>
        ))
      )}
    </Modal>
  );
}
