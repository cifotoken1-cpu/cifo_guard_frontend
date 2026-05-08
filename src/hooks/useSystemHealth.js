import { useQuery } from '@tanstack/react-query';
import { systemApi } from '../api/system.api';
import { REFETCH } from '../config';

export function useHealth() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => systemApi.health(),
    staleTime: REFETCH.health,
    refetchInterval: REFETCH.health,
    retry: 1,
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ['system', 'metrics'],
    queryFn: () => systemApi.metrics(),
    staleTime: REFETCH.metrics,
    refetchInterval: REFETCH.metrics,
    retry: 1,
  });
}
