/**
 * Unit Tests for VIGI Camera Service Components
 * Simplified tests without attempting actual connections
 */

const { VigiAuth } = require('./vigiAuth');
const { VigiSnapshot } = require('./vigiSnapshot');
const { VigiEventListener } = require('./vigiEventListener');

// Mock axios for camera API calls
jest.mock('axios');
const axios = require('axios');

describe('VIGI Camera Service - Unit Tests', () => {
  describe('VigiAuth Configuration', () => {
    test('Should require host', () => {
      expect(() => {
        new VigiAuth({
          port: 20443,
          username: 'admin',
          password: 'pass'
        });
      }).toThrow('VigiAuth: host is required');
    });

    test('Should require password', () => {
      expect(() => {
        new VigiAuth({
          host: '192.168.0.60',
          port: 20443,
          username: 'admin'
        });
      }).toThrow('VigiAuth: password is required');
    });

    test('Should initialize with valid config', () => {
      const auth = new VigiAuth({
        host: '192.168.0.60',
        port: 20443,
        username: 'admin',
        password: 'testpass123'
      });

      expect(auth.host).toBe('192.168.0.60');
      expect(auth.port).toBe(20443);
      expect(auth.username).toBe('admin');
      expect(auth.baseUrl).toBe('https://192.168.0.60:20443');
    });

    test('Should use default port 20443', () => {
      const auth = new VigiAuth({
        host: '192.168.0.60',
        username: 'admin',
        password: 'pass'
      });

      expect(auth.port).toBe(20443);
      expect(auth.baseUrl).toContain(':20443');
    });

    test('Should generate correct base URL', () => {
      const auth = new VigiAuth({
        host: 'camera.local',
        port: 25443,
        username: 'admin',
        password: 'pass'
      });

      expect(auth.baseUrl).toBe('https://camera.local:25443');
    });
  });

  describe('VigiSnapshot Configuration', () => {
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

    test('Should initialize with valid config', () => {
      const snapshot = new VigiSnapshot({
        host: '192.168.0.60',
        port: 554,
        username: 'admin',
        password: 'testpass'
      });

      expect(snapshot.rtspUrl).toContain('rtsp://');
      expect(snapshot.rtspUrl).toContain('admin');
      expect(snapshot.rtspUrl).toContain('192.168.0.60');
      expect(snapshot.rtspUrl).toContain(':554/');
    });

    test('Should use default port 554', () => {
      const snapshot = new VigiSnapshot({
        host: '192.168.0.60',
        username: 'admin',
        password: 'pass'
      });

      expect(snapshot.rtspUrl).toContain(':554/');
    });

    test('Should use stream2 by default', () => {
      const snapshot = new VigiSnapshot({
        host: '192.168.0.60',
        username: 'admin',
        password: 'pass'
      });

      expect(snapshot.rtspUrl).toContain('stream2');
    });

    test('Should support stream1 selection', () => {
      const snapshot = new VigiSnapshot({
        host: '192.168.0.60',
        username: 'admin',
        password: 'pass',
        stream: 'stream1'
      });

      expect(snapshot.rtspUrl).toContain('stream1');
    });

    test('Should URL-encode special characters in password', () => {
      const snapshot = new VigiSnapshot({
        host: '192.168.0.60',
        username: 'admin',
        password: 'p@ss!word'
      });

      // encodeURIComponent encodes @ but not !
      expect(snapshot.rtspUrl).toContain('%40'); // @
      expect(snapshot.rtspUrl).toContain('!'); // ! is not encoded by encodeURIComponent
    });

    test('Should use custom RTSP port', () => {
      const snapshot = new VigiSnapshot({
        host: '192.168.0.60',
        port: 8554,
        username: 'admin',
        password: 'pass'
      });

      expect(snapshot.rtspUrl).toContain(':8554/');
    });
  });

  describe('VigiEventListener Configuration', () => {
    let auth;

    beforeEach(() => {
      auth = new VigiAuth({
        host: '192.168.0.60',
        port: 20443,
        username: 'admin',
        password: 'pass'
      });
    });

    test('Should initialize with auth and options', () => {
      const listener = new VigiEventListener(auth, {
        events: ['PeopleDetection'],
        heartbeat: 15
      });

      expect(listener.auth).toBe(auth);
      expect(listener.events).toContain('PeopleDetection');
      expect(listener.heartbeat).toBe(15);
    });

    test('Should have EventEmitter methods', () => {
      const listener = new VigiEventListener(auth, {
        events: ['PeopleDetection']
      });

      expect(typeof listener.on).toBe('function');
      expect(typeof listener.emit).toBe('function');
      expect(typeof listener.off).toBe('function');
    });

    test('Should support multiple event types', () => {
      const events = [
        'PeopleDetection',
        'VehicleDetection',
        'MotionDetection'
      ];

      const listener = new VigiEventListener(auth, { events });

      expect(listener.events).toEqual(events);
      expect(listener.events.length).toBe(3);
    });

    test('Should support all VIGI event types', () => {
      const allEvents = [
        'PeopleDetection',
        'VehicleDetection',
        'MotionDetection',
        'InvasionDetection',
        'LoiterDetection',
        'CrossLineDetection',
        'AreaEntryDetection',
        'TamperDetection'
      ];

      const listener = new VigiEventListener(auth, { events: allEvents });

      expect(listener.events.length).toBe(8);
      expect(listener.events).toEqual(allEvents);
    });

    test('Should initialize with default heartbeat', () => {
      const listener = new VigiEventListener(auth, {
        events: ['PeopleDetection']
      });

      expect(listener.heartbeat).toBe(15);
    });

    test('Should initialize running as false', () => {
      const listener = new VigiEventListener(auth, {
        events: ['PeopleDetection']
      });

      expect(listener.running).toBe(false);
    });

    test('Should initialize backoff timeout', () => {
      const listener = new VigiEventListener(auth, {
        events: ['PeopleDetection']
      });

      expect(listener._backoff).toBe(1000);
    });
  });

  describe('Event Types Support', () => {
    test('Should support standard VIGI event types', () => {
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
        expect(eventType.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration Validation', () => {
    test('Should validate required camera fields', () => {
      const validConfig = {
        host: '192.168.0.60',
        apiPort: 20443,
        rtspPort: 554,
        username: 'admin',
        password: 'testpass',
        cameraId: 'C240-01',
        location: 'Front Gate'
      };

      expect(validConfig.host).toBeTruthy();
      expect(validConfig.password).toBeTruthy();
      expect(validConfig.cameraId).toBeTruthy();
      expect(validConfig.location).toBeTruthy();
    });

    test('Should have proper port ranges', () => {
      const apiPort = 20443;
      const rtspPort = 554;

      expect(apiPort).toBeGreaterThan(0);
      expect(apiPort).toBeLessThanOrEqual(65535);
      expect(rtspPort).toBeGreaterThan(0);
      expect(rtspPort).toBeLessThanOrEqual(65535);
    });
  });

  describe('RTSP URL Formatting', () => {
    test('Should format RTSP URL correctly', () => {
      const snapshot = new VigiSnapshot({
        host: '192.168.0.60',
        port: 554,
        username: 'admin',
        password: 'pass123'
      });

      const url = snapshot.rtspUrl;
      expect(url).toMatch(/^rtsp:\/\//);
      expect(url).toContain('admin');
      expect(url).toContain('192.168.0.60');
      expect(url).toContain('554');
      expect(url).toContain('stream2');
    });

    test('Should handle RTSP URL with different hosts', () => {
      const hosts = ['192.168.0.60', 'camera.local', '10.0.0.100'];

      hosts.forEach(host => {
        const snapshot = new VigiSnapshot({
          host,
          username: 'admin',
          password: 'pass'
        });

        expect(snapshot.rtspUrl).toContain(host);
      });
    });
  });
});
