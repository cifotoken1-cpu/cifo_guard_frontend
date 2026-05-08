import { useQuery } from '@tanstack/react-query';
import { sensorsApi } from '../api/sensors.api';
import { REFETCH } from '../config';

/**
 * Sensor list dengan polling.
 *
 * - Polls /api/sensors setiap REFETCH.sensors ms (default 15s)
 * - WebSocket subscription `sensor_status_changed` di-defer ke iterasi berikutnya
 *   (cukup polling untuk MVP — server side sudah punya last_event_at column).
 */
export function useSensors() {
  return useQuery({
    queryKey: ['sensors'],
    queryFn: () => sensorsApi.list(),
    staleTime: REFETCH.sensors,
    refetchInterval: REFETCH.sensors,
  });
}
