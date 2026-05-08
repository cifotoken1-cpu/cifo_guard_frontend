import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { incidentsApi } from '../api/incidents.api';
import { onSocket } from '../api/socket';

export function useIncidents(params = {}) {
  const qc = useQueryClient();

  useEffect(() => {
    return onSocket(
      ['incident_created', 'incident_updated', 'incident_assigned'],
      () => qc.invalidateQueries({ queryKey: ['incidents'] })
    );
  }, [qc]);

  return useQuery({
    queryKey: ['incidents', params],
    queryFn: () => incidentsApi.list(params),
    staleTime: 15_000,
  });
}

export function useIncidentDetail(id) {
  return useQuery({
    queryKey: ['incidents', 'detail', id],
    queryFn: () => incidentsApi.detail(id),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useUpdateIncidentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => incidentsApi.updateStatus(id, { status }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      qc.invalidateQueries({ queryKey: ['incidents', 'detail', id] });
    },
  });
}
