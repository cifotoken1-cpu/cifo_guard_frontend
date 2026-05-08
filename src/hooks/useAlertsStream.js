import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '../api/alerts.api';
import { onSocket } from '../api/socket';
import { REFETCH } from '../config';

/**
 * List active alerts, kept in sync via WebSocket events.
 * Backend emits: 'alert_created', 'alert_updated' on alerts_room.
 */
export function useActiveAlerts() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: () => alertsApi.list({ status: 'ACTIVE', limit: 50 }),
    staleTime: REFETCH.alertsStats,
  });

  useEffect(() => {
    return onSocket(['alert_created', 'alert_updated'], () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alerts', 'stats'] });
    });
  }, [qc]);

  return query;
}

/** Just the stats counter (lighter than full list). */
export function useAlertStats() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['alerts', 'stats'],
    queryFn: () => alertsApi.stats(),
    staleTime: REFETCH.alertsStats,
    refetchInterval: REFETCH.alertsStats,
  });

  useEffect(() => {
    return onSocket(['alert_created', 'alert_updated'], () => {
      qc.invalidateQueries({ queryKey: ['alerts', 'stats'] });
    });
  }, [qc]);

  return query;
}
