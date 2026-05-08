import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the axios client BEFORE importing the module under test
vi.mock('./client', () => {
  const get = vi.fn();
  const patch = vi.fn();
  return {
    api: { get, patch },
  };
});

// Now import — will pick up the mocked client
import { sensorsApi } from './sensors.api';
import { api } from './client';

describe('sensorsApi', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.patch.mockReset();
  });

  describe('list', () => {
    it('calls GET /sensors and returns data', async () => {
      const mockResponse = {
        data: { success: true, sensors: [{ id: 'sen-1' }], total: 1 },
      };
      api.get.mockResolvedValueOnce(mockResponse);

      const result = await sensorsApi.list();

      expect(api.get).toHaveBeenCalledWith('/sensors', { params: undefined });
      expect(result).toEqual(mockResponse.data);
    });

    it('passes filter params to axios', async () => {
      api.get.mockResolvedValueOnce({ data: {} });

      await sensorsApi.list({ type: 'door', status: 'open' });

      expect(api.get).toHaveBeenCalledWith('/sensors', {
        params: { type: 'door', status: 'open' },
      });
    });
  });

  describe('get', () => {
    it('calls GET /sensors/:id', async () => {
      api.get.mockResolvedValueOnce({ data: { success: true, data: { id: 'sen-3' } } });

      const result = await sensorsApi.get('sen-3');

      expect(api.get).toHaveBeenCalledWith('/sensors/sen-3');
      expect(result.data.id).toBe('sen-3');
    });
  });

  describe('updateStatus', () => {
    it('calls PATCH /sensors/:id/status with body { status }', async () => {
      api.patch.mockResolvedValueOnce({ data: { success: true } });

      await sensorsApi.updateStatus('sen-1', 'alert');

      expect(api.patch).toHaveBeenCalledWith('/sensors/sen-1/status', { status: 'alert' });
    });
  });
});
