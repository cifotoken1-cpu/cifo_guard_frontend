import { describe, it, expect } from 'vitest';
import {
  STATUS_MAP,
  normalizeCamera,
  normalizeCameraList,
  buildCameraPostBody,
} from './camera.service';

describe('STATUS_MAP', () => {
  it('maps backend uppercase to frontend lowercase', () => {
    expect(STATUS_MAP.ONLINE).toBe('online');
    expect(STATUS_MAP.OFFLINE).toBe('offline');
    expect(STATUS_MAP.MAINTENANCE).toBe('degraded');
    expect(STATUS_MAP.ERROR).toBe('error');
  });
});

describe('normalizeCamera', () => {
  it('returns null for null/undefined input', () => {
    expect(normalizeCamera(null)).toBeNull();
    expect(normalizeCamera(undefined)).toBeNull();
  });

  it('preserves id from camera, falls back to index', () => {
    expect(normalizeCamera({ id: 'cam-1' }).id).toBe('cam-1');
    expect(normalizeCamera({}, 5).id).toBe(5);
  });

  it('uses label, falls back to name, then "Camera N"', () => {
    expect(normalizeCamera({ label: 'Front Door' }).name).toBe('Front Door');
    expect(normalizeCamera({ name: 'Backup' }).name).toBe('Backup');
    expect(normalizeCamera({}, 2).name).toBe('Camera 3'); // index+1
  });

  it('normalizes uppercase status to lowercase', () => {
    expect(normalizeCamera({ status: 'ONLINE' }).status).toBe('online');
    expect(normalizeCamera({ status: 'MAINTENANCE' }).status).toBe('degraded');
  });

  it('lowercases unknown status as fallback', () => {
    expect(normalizeCamera({ status: 'WeIrD' }).status).toBe('weird');
  });

  it('defaults status to "offline" when missing', () => {
    expect(normalizeCamera({}).status).toBe('offline');
  });

  it('handles snake_case and camelCase fields', () => {
    const snake = normalizeCamera({ stream_url: 'a.m3u8', last_heartbeat: 't1', health_score: 80 });
    const camel = normalizeCamera({ streamUrl: 'a.m3u8', lastHeartbeat: 't1', healthScore: 80 });

    expect(snake.streamUrl).toBe('a.m3u8');
    expect(snake.lastHeartbeat).toBe('t1');
    expect(snake.healthScore).toBe(80);

    expect(camel.streamUrl).toBe('a.m3u8');
    expect(camel.lastHeartbeat).toBe('t1');
    expect(camel.healthScore).toBe(80);
  });

  it('parses lat/lng to floats', () => {
    const out = normalizeCamera({ lat: '-6.91', lng: '107.61' });
    expect(out.lat).toBeCloseTo(-6.91);
    expect(out.lng).toBeCloseTo(107.61);
  });

  it('returns null for unparseable lat/lng', () => {
    const out = normalizeCamera({ lat: 'invalid', lng: 'bad' });
    expect(out.lat).toBeNull();
    expect(out.lng).toBeNull();
  });

  it('cycles bg classname based on index', () => {
    expect(normalizeCamera({}, 0).bg).toBe('cam-bg-1');
    expect(normalizeCamera({}, 1).bg).toBe('cam-bg-2');
    expect(normalizeCamera({}, 2).bg).toBe('cam-bg-3');
    expect(normalizeCamera({}, 3).bg).toBe('cam-bg-1'); // wraps
  });
});

describe('normalizeCameraList', () => {
  it('returns null when data is missing or invalid shape', () => {
    expect(normalizeCameraList(null)).toBeNull();
    expect(normalizeCameraList({})).toBeNull();
    expect(normalizeCameraList({ cameras: 'not array' })).toBeNull();
  });

  it('returns array when shape is valid', () => {
    const out = normalizeCameraList({ cameras: [{ id: 'a' }, { id: 'b' }] });
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(2);
  });

  it('moves Vigi C240-01 to index 0 (Vigi-First)', () => {
    const out = normalizeCameraList({
      cameras: [
        { id: 'cam-1' },
        { id: 'cam-2' },
        { id: 'C240-01' },
        { id: 'cam-3' },
      ],
    });
    expect(out[0].id).toBe('C240-01');
    expect(out).toHaveLength(4);
    // Other cameras retain relative order
    expect(out[1].id).toBe('cam-1');
    expect(out[2].id).toBe('cam-2');
    expect(out[3].id).toBe('cam-3');
  });

  it('does not reorder when Vigi already at index 0', () => {
    const out = normalizeCameraList({
      cameras: [{ id: 'C240-01' }, { id: 'cam-1' }],
    });
    expect(out[0].id).toBe('C240-01');
    expect(out[1].id).toBe('cam-1');
  });

  it('preserves order when Vigi camera is absent', () => {
    const out = normalizeCameraList({
      cameras: [{ id: 'cam-1' }, { id: 'cam-2' }],
    });
    expect(out[0].id).toBe('cam-1');
    expect(out[1].id).toBe('cam-2');
  });
});

describe('buildCameraPostBody', () => {
  it('produces dual-field body satisfying both controller and model', () => {
    const body = buildCameraPostBody({
      label: 'Front Camera',
      area: 'Main Gate',
      lat: -6.2,
      lng: 106.8,
      streamUrl: 'http://x.m3u8',
    });

    // Controller expects:
    expect(body.name).toBe('Front Camera');
    expect(body.location).toBe('Main Gate');

    // Model expects:
    expect(body.label).toBe('Front Camera');
    expect(body.area).toBe('Main Gate');
    expect(body.lat).toBe(-6.2);
    expect(body.lng).toBe(106.8);
    expect(body.stream_url).toBe('http://x.m3u8');
  });

  it('falls back to name when label missing', () => {
    const body = buildCameraPostBody({ name: 'Backup' });
    expect(body.name).toBe('Backup');
    expect(body.label).toBe('Backup');
  });

  it('defaults missing fields safely', () => {
    const body = buildCameraPostBody({});
    expect(body.ip_address).toBe('0.0.0.0');
    expect(body.lat).toBe(0);
    expect(body.lng).toBe(0);
    expect(body.status).toBe('OFFLINE');
    expect(body.resolution).toBe('1080p');
  });
});
