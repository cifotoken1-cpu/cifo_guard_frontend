import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { alertsApi } from '../api/alerts.api';
import { onWsMessage } from '../api/ws';
import { useUIStore } from '../store/ui.store';

export function usePanicAlerts(params = {}) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    return onWsMessage((msg) => {
      if (msg.type === 'ALERT_CREATED' && msg.data?.category === 'PANIC_BUTTON') {
        qc.invalidateQueries({ queryKey: ['alerts', 'panic'] });
        addToast?.({ type: 'error', message: `Panic alert baru: ${msg.data?.title || msg.data?.alertId || 'Unknown'}` });
      }
      if (msg.type === 'ALERT_UPDATED' && msg.data?.category === 'PANIC_BUTTON') {
        qc.invalidateQueries({ queryKey: ['alerts', 'panic'] });
      }
    });
  }, [qc, addToast]);

  return useQuery({
    queryKey: ['alerts', 'panic', params],
    queryFn: () => alertsApi.listPanic(params),
    staleTime: 10_000,
  });
}

export function usePanicAlertDetail(id) {
  return useQuery({
    queryKey: ['alerts', 'panic', 'detail', id],
    queryFn: () => alertsApi.detail(id),
    enabled: !!id,
  });
}
