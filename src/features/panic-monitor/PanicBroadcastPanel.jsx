import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '../../api/alerts.api';
import { usePanicAlertDetail } from '../../hooks/usePanicAlerts';
import styles from './panic-monitor.module.css';

const DELIVERY_LABEL = {
  SENT: 'On Route',
  DELIVERED: 'Terkirim',
  ACKNOWLEDGED: 'Diterima',
  PENDING: 'Pending',
};

const DELIVERY_CLASS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  ACKNOWLEDGED: 'acknowledged',
  PENDING: 'pending',
};

function initials(name) {
  if (!name) return '??';
  return name.split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase();
}

export function PanicBroadcastPanel({ alert }) {
  const qc = useQueryClient();
  const { data: detail } = usePanicAlertDetail(alert?.id);

  const resolveMutation = useMutation({
    mutationFn: () => alertsApi.resolve(alert.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', 'panic'] }),
  });

  if (!alert) {
    return (
      <div className={styles.bcastCard}>
        <div className={styles.bcastHd}>
          <div className={styles.bcastTitle}>Broadcast Responden</div>
        </div>
        <div className={styles.empty} style={{ paddingTop: '2rem' }}>
          Pilih alert untuk melihat responden.
        </div>
      </div>
    );
  }

  const recipients = detail?.recipients ?? [];
  const isResolved = alert.status === 'RESOLVED';

  return (
    <div className={styles.bcastCard}>
      <div className={styles.bcastHd}>
        <div className={styles.bcastTitle}>Broadcast Responden</div>
        <span className={`${styles.badge} ${styles.badgeRed}`}>
          {recipients.length} penerima
        </span>
      </div>

      <div className={styles.bcastBody}>
        {recipients.length === 0 && (
          <div className={styles.empty}>Belum ada responden terdaftar.</div>
        )}
        {recipients.map((r) => {
          const statusKey = (r.deliveryStatus || 'PENDING').toUpperCase();
          return (
            <div key={r.id} className={styles.recipient}>
              <div className={styles.rcpAvatar}>{initials(r.userId)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.rcpName}>{r.userId}</div>
                <div className={styles.rcpMeta}>
                  {new Date(r.sentAt || alert.createdAt).toLocaleTimeString('id-ID')}
                </div>
              </div>
              <span className={`${styles.rcpStatus} ${styles[DELIVERY_CLASS[statusKey] || 'pending']}`}>
                {DELIVERY_LABEL[statusKey] || statusKey}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.bcastActions}>
        <button
          className={styles.resolveBtn}
          onClick={() => resolveMutation.mutate()}
          disabled={isResolved || resolveMutation.isPending}
        >
          {isResolved ? '✓ Sudah Terkendali' : resolveMutation.isPending ? 'Memproses...' : 'Tandai Terkendali'}
        </button>
      </div>
    </div>
  );
}
