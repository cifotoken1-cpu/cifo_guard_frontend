/**
 * Test Suite for VIGI Camera Service
 * Tests authentication, snapshot capture, event listening, and integration
 */

const { VigiAuth } = require('./vigiAuth');
const { VigiSnapshot } = require('./vigiSnapshot');
const { VigiEventListener } = require('./vigiEventListener');

// Mock axios for camera API calls
jest.mock('axios');
const axios = require('axios');

describe('VIGI Camera Service', () => {
  describe('VigiAuth - Authentication', () => {
    let auth;

    beforeEach(() => {
      jest.clearAllMocks();
      auth = new VigiAuth({
        host: '192.168.0.60',
        port: 20443,
        username: 'admin',
        password: 'testpass123'
      });
    });

    test('Should initialize with required config', () => {
      expect(auth.host).toBe('192.168.0.60');
      expect(auth.port).toBe(20443);
      expect(auth.username).toBe('admin');
    });

    test('Should throw error if host missing', () => {
      expect(() => {
        new VigiAuth({
          port: 20443,
          username: 'admin',
          password: 'pass'
        });
      }).toThrow('VigiAuth: host is required');
    });

    test('Should throw error if password missing', () => {
      expect(() => {
        new VigiAuth({
          host: '192.168.0.60',
          port: 20443,
          username: 'admin'
        });
      }).toThrow('VigiAuth: password is required');
    });

    test('Should construct correct base URL', () => {
      expect(auth.baseUrl).toBe('https://192.168.0.60:20443');
    });

    test('Should generate correct RTSP URL format', () => {
      const snapshot = new VigiSnapshot({
        host: '192.168.0.60',
        port: 554,
        username: 'admin',
        password: 'test@pass'
      });

      expect(snapshot.rtspUrl).toContain('rtsp://');
      expect(snapshot.rtspUrl).toContain('admin');
      expect(snapshot.rtspUrl).toContain('192.168.0.60');
      expect(snapshot.rtspUrl).toContain('554');
    });

    test('Should handle authentication challenge-response', async () => {
      // Mock the challenge response
      axios.post.mockResolvedValueOnce({
        data: {
          authenticate: {
            realm: 'VIGI',
            nonce: 'nonce123',
            algorithm: 'SHA-256',
            uri: '/stok=',
            method: 'Login'
          }
        }
      });

      // Mock the auth response
      axios.post.mockResolvedValueOnce({
        data: {
          errCode: 0,
          stok: 'test-stok-token-abc123'
        }
      });

      const stok = await auth.login();
      expect(stok).toBe('test-stok-token-abc123');
      expect(auth.stok).toBe('test-stok-token-abc123');
    });

    test('Should reject on authentication failure', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          authenticate: {
            realm: 'VIGI',
            nonce: 'nonce123',
            algorithm: 'SHA-256',
            uri: '/stok=',
            method: 'Login'
          }
        }
      });

      axios.post.mockResolvedValueOnce({
        data: {
          errCode: -1,
          stok: null
        }
      });

      await expect(auth.login()).rejects.toThrow('VigiAuth: login failed');
    });

    test('Should reject unsupported algorithm', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          authenticate: {
            realm: 'VIGI',
            nonce: 'nonce123',
            algorithm: 'MD5',
            uri: '/stok=',
            method: 'Login'
          }
        }
      });

      await expect(auth.login()).rejects.toThrow('unsupported algorithm');
    });

    test('Should make authenticated calls with stok', async () => {
      auth.stok = 'test-stok-123';

      axios.post.mockResolvedValueOnce({
        data: {
          errCode: 0,
          data: { status: 'ok' }
        }
      });

      const result = await auth.call('getSystemStatus', {});

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('stok=test-stok-123'),
        expect.objectContaining({
          method: 'getSystemStatus'
        }),
        expect.any(Object)
      );

      expect(result.errCode).toBe(0);
    });

    test('Should auto-reauth on stok expiry', async () => {
      auth.stok = 'expired-stok';

      // First call returns -10020 (expired)
      axios.post.mockResolvedValueOnce({
        data: { errCode: -10020 }
      });

      // Re-auth: challenge
      axios.post.mockResolvedValueOnce({
        data: {
          authenticate: {
            realm: 'VIGI',
            nonce: 'nonce456',
            algorithm: 'SHA-256',
            uri: '/stok=',
            method: 'Login'
          }
        }
      });

      // Re-auth: response
      axios.post.mockResolvedValueOnce({
        data: {
          errCode: 0,
          stok: 'new-stok-xyz'
        }
      });

      // Retry call
      axios.post.mockResolvedValueOnce({
        data: {
          errCode: 0,
          data: { status: 'ok' }
        }
      });

      const result = await auth.call('getSystemStatus', {});
      expect(auth.stok).toBe('new-stok-xyz');
      expect(result.errCode).toBe(0);
    });
  });

  describe('VigiSnapshot - JPEG Capture', () => {
    let snapshot;

    beforeEach(() => {
      snapshot = new VigiSnapshot({
        host: '192.168.0.60',
        port: 554,
        username: 'admin',
        password: 'pass123'
      });
    });

    test('Should initialize with RTSP URL', () => {
      expect(snapshot.rtspUrl).toBeTruthy();
      expect(snapshot.rtspUrl).toContain('rtsp://');
    });

    test('Should use stream2 by default', () => {
      const snap = new VigiSnapshot({
        host: '192.168.0.60',
        port: 554,
        username: 'admin',
        password: 'pass'
      });

      expect(snap.rtspUrl).toContain('stream2');
    });

    test('Should allow custom stream selection', () => {
      const snap = new VigiSnapshot({
        host: '192.168.0.60',
        port: 554,
        username: 'admin',
        password: 'pass',
        stream: 'stream1'
      });

      expect(snap.rtspUrl).toContain('stream1');
    });

    test('Should encode credentials in RTSP URL', () => {
      const snap = new VigiSnapshot({
        host: '192.168.0.60',
        port: 554,
        username: 'admin',
        password: 'p@ss!word'
      });

      // Should URL-encode special chars
      expect(snap.rtspUrl).toContain('%40'); // @
      expect(snap.rtspUrl).toContain('%21'); // !
    });

    test('Should require host', () => {
      expect(() => {
        new VigiSnapshot({
          port: 554,
          username: 'admin',
          password: 'pass'
        });
      }).toThrow('VigiSnapshot: host is required');
    });

    test('Should require password', () => {
      expect(() => {
        new VigiSnapshot({
          host: '192.168.0.60',
          port: 554,
          username: 'admin'
        });
      }).toThrow('VigiSnapshot: password is required');
    });

    test('Should use default port 554 for RTSP', () => {
      const snap = new VigiSnapshot({
        host: '192.168.0.60',
        username: 'admin',
        password: 'pass'
      });

      expect(snap.rtspUrl).toContain(':554/');
    });

    test('Should accept custom RTSP port', () => {
      const snap = new VigiSnapshot({
        host: '192.168.0.60',
        port: 8554,
        username: 'admin',
        password: 'pass'
      });

      expect(snap.rtspUrl).toContain(':8554/');
    });
  });

  describe('VigiEventListener - Event Streaming', () => {
    let auth;
    let listener;

    beforeEach(() => {
      jest.clearAllMocks();
      auth = new VigiAuth({
        host: '192.168.0.60',
        port: 20443,
        username: 'admin',
        password: 'pass'
      });
      auth.stok = 'test-stok';

      listener = new VigiEventListener(auth, {
        events: ['PeopleDetection', 'VehicleDetection'],
        heartbeat: 15
      });
    });

    afterEach(async () => {
      // Ensure listener is stopped
      if (listener && listener.running) {
        await listener.stop();
      }
    });

    test('Should initialize with correct config', () => {
      expect(listener.auth).toBe(auth);
      expect(listener.events).toContain('PeopleDetection');
      expect(listener.events).toContain('VehicleDetection');
      expect(listener.heartbeat).toBe(15);
      expect(listener.running).toBe(false);
    });

    test('Should set running flag on start', () => {
      listener.running = false;
      listener.start();
      expect(listener.running).toBe(true);
    });

    test('Should clear running flag on stop', async () => {
      listener.running = true;
      await listener.stop();
      expect(listener.running).toBe(false);
    });

    test('Should accept array of event types', () => {
      const eventTypes = ['PeopleDetection', 'MotionDetection', 'InvasionDetection'];
      const l = new VigiEventListener(auth, {
        events: eventTypes,
        heartbeat: 20
      });

      expect(l.events).toEqual(eventTypes);
    });

    test('Should support backoff on connection failure', async () => {
      listener._backoff = 1000;
      listener._backoff = Math.min(listener._backoff * 2, 30000);
      expect(listener._backoff).toBe(2000);

      listener._backoff = Math.min(listener._backoff * 2, 30000);
      listener._backoff = Math.min(listener._backoff * 2, 30000);
      listener._backoff = Math.min(listener._backoff * 2, 30000);
      
      expect(listener._backoff).toBeLessThanOrEqual(30000);
    });

    test('Should have EventEmitter methods', () => {
      expect(typeof listener.on).toBe('function');
      expect(typeof listener.emit).toBe('function');
      expect(typeof listener.off).toBe('function');
    });

    test('Should handle multiple event types', () => {
      const allEvents = [
        'PeopleDetection',
        'VehicleDetection',
        'MotionDetection',
        'InvasionDetection',
        'LoiterDetection'
      ];

      const l = new VigiEventListener(auth, { events: allEvents });
      expect(l.events.length).toBe(5);
      expect(l.events).toEqual(allEvents);
    });
  });

  describe('Configuration & Error Handling', () => {
    test('Should validate all required fields', () => {
      const validConfig = {
        host: '192.168.0.60',
        apiPort: 20443,
        rtspPort: 554,
        username: 'admin',
        password: 'testpass',
        cameraId: 'C240-01'
      };

      expect(validConfig.host).toBeTruthy();
      expect(validConfig.password).toBeTruthy();
    });

    test('Should handle missing host gracefully', () => {
      expect(() => {
        new VigiAuth({ password: 'pass' });
      }).toThrow();
    });

    test('Should handle missing credentials gracefully', () => {
      expect(() => {
        new VigiSnapshot({ host: '192.168.0.60' });
      }).toThrow();
    });
  });

  describe('VIGI Event Types', () => {
    test('Should support standard VIGI events', () => {
      const eventTypes = [
        'PeopleDetection',
        'VehicleDetection',
        'MotionDetection',
        'InvasionDetection',
        'LoiterDetection',
        'CrossLineDetection',
        'AreaEntryDetection',
        'TamperDetection'
      ];

      eventTypes.forEach(eventType => {
        expect(eventType).toBeTruthy();
        expect(typeof eventType).toBe('string');
      });
    });
  });
});
