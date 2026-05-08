import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { activitiesApi } from '../api/activities.api';
import { onSocket } from '../api/socket';
import { REFETCH } from '../config';

/** Recent activity log for right panel + sensor list. */
export function useRecentActivities(limit = 20) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['activities', 'recent', limit],
    queryFn: () => activitiesApi.recent({ limit }),
    staleTime: REFETCH.activitiesRecent,
    refetchInterval: REFETCH.activitiesRecent,
  });

  useEffect(() => {
    return onSocket(['alert_created', 'alert_updated'], () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
    });
  }, [qc]);

  return query;
}
