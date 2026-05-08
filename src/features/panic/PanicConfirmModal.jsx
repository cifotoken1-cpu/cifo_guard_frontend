import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { I } from '../../icons';
import { useUIStore } from '../../store/ui.store';
import { useSystemStore } from '../../store/system.store';
import { alertsApi } from '../../api/alerts.api';
import { getGPS, FALLBACK_GPS } from '../../utils/geo';
import { DEFAULT_USER_ID, PANIC_TYPES } from '../../config';
import styles from './PanicConfirmModal.module.css';

const TYPE_META = {
  MEDICAL: { label: 'Medical', icon: I.alert, tone: 'red' },
  CRIME:   { label: 'Crime',   icon: I.shield, tone: 'red' },
  FIRE:    { label: 'Fire',    icon: I.alert, tone: 'amber' },
  OTHER:   { label: 'Other',   icon: I.alert, tone: 'cyan' },
};

export function PanicConfirmModal() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);
  const addToast = useUIStore((s) => s.addToast);
  const setMode = useSystemStore((s) => s.setMode);

  const [type, setType] = useState('MEDICAL');
  const [gpsState, setGpsState] = useState({ status: 'idle', coords: null, error: null });
  const qc = useQueryClient();

  const open = modal === 'panic-confirm';

  // Fetch GPS when modal opens
  if (open && gpsState.status === 'idle') {
    setGpsState({ status: 'loading', coords: null, error: null });
    getGPS()
      .then((coords) => setGpsState({ status: 'ok', coords, error: null }))
      .catch((err) => {
        setGpsState({ status: 'error', coords: FALLBACK_GPS, error: err.message });
      });
  }

  const triggerPanic = useMutation({
    mutationFn: () =>
      alertsApi.triggerPanic({
        type,
        userId: DEFAULT_USER_ID,
        gps: gpsState.coords || FALLBACK_GPS,
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      setMode('panic');
      addToast({
        type: 'panic',
        title: 'Panic alert sent',
        msg: `Alert ID: ${data.alertId} · ${data.ingest_latency_ms}ms`,
      });
      handleClose();
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Failed to send panic',
        msg: err.message || 'Network error — please retry',
      });
    },
  });

  function handleClose() {
    closeModal();
    // Reset for next open
    setTimeout(() => {
      setType('MEDICAL');
      setGpsState({ status: 'idle', coords: null, error: null });
    }, 200);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      width={460}
      title="Panic Alert"
      titleIcon={I.alert}
      titleIconStyle={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}
      footer={
        <>
          <button
            className={`${styles.btn} ${styles.btnPanic}`}
            onClick={() => triggerPanic.mutate()}
            disabled={triggerPanic.isPending || gpsState.status === 'loading'}
          >
            <span style={{ width: 14, height: 14 }}>{I.alert}</span>
            {triggerPanic.isPending ? 'Sending…' : 'Send Panic Alert'}
          </button>
          <button className={`${styles.btn} ${styles.btnSec}`} onClick={handleClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className={styles.warn}>
        ⚠ This will broadcast a panic alert to all connected guards and trigger AI enrichment.
      </div>

      <div className={styles.label}>Alert Type</div>
      <div className={styles.typeGrid}>
        {PANIC_TYPES.map((t) => {
          const meta = TYPE_META[t];
          return (
            <button
              key={t}
              className={`${styles.typeBtn} ${type === t ? styles[`active_${meta.tone}`] : ''}`}
              onClick={() => setType(t)}
            >
              <span style={{ width: 18, height: 18 }}>{meta.icon}</span>
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className={styles.label}>Location (GPS)</div>
      <div className={styles.gpsBox}>
        {gpsState.status === 'loading' && (
          <div className={styles.gpsRow}>
            <span className={styles.gpsDot} style={{ background: 'var(--amber)' }} />
            Detecting GPS…
          </div>
        )}
        {gpsState.status === 'ok' && (
          <>
            <div className={styles.gpsRow}>
              <span className={styles.gpsDot} style={{ background: 'var(--green)' }} />
              Location locked
            </div>
            <div className={styles.gpsCoords}>
              {gpsState.coords.latitude.toFixed(6)}, {gpsState.coords.longitude.toFixed(6)}
              <span className={styles.acc}>±{Math.round(gpsState.coords.accuracy)}m</span>
            </div>
          </>
        )}
        {gpsState.status === 'error' && (
          <>
            <div className={styles.gpsRow}>
              <span className={styles.gpsDot} style={{ background: 'var(--red)' }} />
              GPS unavailable — sending without precise location
            </div>
            <div className={styles.gpsCoords} style={{ fontSize: 10, opacity: 0.6 }}>
              {gpsState.error}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
