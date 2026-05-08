import { useEffect } from 'react';
import { useUIStore } from '../../store/ui.store';
import { onSocket } from '../../api/socket';
import { I } from '../../icons';
import styles from './ToastStack.module.css';

const AUTO_DISMISS_MS = 6_000;

export function ToastStack() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  const addToast = useUIStore((s) => s.addToast);

  // Auto-dismiss old toasts
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => removeToast(t.id), AUTO_DISMISS_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  // Subscribe to WS alert_created — show as toast
  useEffect(() => {
    return onSocket('alert_created', (payload) => {
      const a = payload?.alert || payload || {};
      addToast({
        type: 'incoming',
        title: `${a.type || 'ALERT'} alert received`,
        msg: `${a.user_id || 'unknown'} · ${a.priority || 'HIGH'}`,
      });
    });
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[`t_${t.type}`]}`}>
          <div className={styles.icon}>
            <span style={{ width: 16, height: 16 }}>{I.alert}</span>
          </div>
          <div className={styles.body}>
            <div className={styles.title}>{t.title}</div>
            {t.msg && <div className={styles.msg}>{t.msg}</div>}
          </div>
          <button className={styles.close} onClick={() => removeToast(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
