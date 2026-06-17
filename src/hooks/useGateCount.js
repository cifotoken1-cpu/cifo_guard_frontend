import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { countingApi } from '../api/counting.api';
import { onSocket } from '../api/socket';

export function useCountingSummary(date) {
  const qc = useQueryClient();

  useEffect(() => {
    return onSocket('counting_event', () => {
      qc.invalidateQueries({ queryKey: ['counting'] });
    });
  }, [qc]);

  return useQuery({
    queryKey: ['counting', 'summary', date],
    queryFn: () => countingApi.getSummary(date),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useCameraCount(cameraId, date) {
  const qc = useQueryClient();

  useEffect(() => {
    return onSocket('counting_event', (evt) => {
      if (evt.camera_id === cameraId) {
        qc.invalidateQueries({ queryKey: ['counting', 'camera', cameraId] });
      }
    });
  }, [qc, cameraId]);

  return useQuery({
    queryKey: ['counting', 'camera', cameraId, date],
    queryFn: () => countingApi.getCameraCount(cameraId, date),
    enabled: !!cameraId,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}
