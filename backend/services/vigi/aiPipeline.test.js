/**
 * Test Suite for aiPipeline Service
 * Tests AI snapshot analysis, response parsing, and error handling
 */

const fs = require('fs');
const path = require('path');
const { analyzeSnapshot } = require('./aiPipeline');

// Mock OpenAI response untuk testing
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            model: 'gpt-4o-mini',
            usage: { total_tokens: 245 },
            choices: [{
              message: {
                content: JSON.stringify({
                  description: 'Seorang laki-laki berusia 30-40 tahun, mengenakan kaos berwarna biru tua, sedang berjalan di area halaman depan dengan langkah santai.',
                  person_count: 1,
                  vehicle_count: 0,
                  is_false_positive: false,
                  severity: 'info',
                  severity_reason: 'Aktivitas normal - orang yang tampak seperti residen berjalan di siang hari',
                  tags: ['person', 'daylight', 'calm', 'single'],
                  recommended_action: 'log'
                })
              }
            }]
          })
        }
      }
    };
  });
});

describe('aiPipeline Service', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
    process.env.OPENROUTER_API_KEY = 'test-key-123';
    process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.OPENAI_VISION_MODEL = 'gpt-4o-mini';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Environment Validation', () => {
    test('Should require OPENROUTER_API_KEY or OPENAI_API_KEY', async () => {
      const invalidEnv = process.env;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const mockImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF]); // minimal JPEG header
      
      await expect(
        analyzeSnapshot({
          imageBuffer: mockImageBuffer,
          eventMeta: { event_type: 'PERSON', time: Date.now() / 1000 }
        })
      ).rejects.toThrow();

      process.env.OPENROUTER_API_KEY = invalidEnv.OPENROUTER_API_KEY;
    });
  });

  describe('Snapshot Analysis', () => {
    let testImageBuffer;

    beforeEach(() => {
      // Create minimal JPEG buffer for testing
      testImageBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46
      ]);
    });

    test('Should analyze snapshot and return structured response', async () => {
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: { 
          event_type: 'PERSON_DETECTED',
          time: Math.floor(Date.now() / 1000)
        },
        location: 'Halaman depan'
      });

      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('person_count');
      expect(result).toHaveProperty('vehicle_count');
      expect(result).toHaveProperty('is_false_positive');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('severity_reason');
      expect(result).toHaveProperty('tags');
      expect(result).toHaveProperty('recommended_action');
      expect(result).toHaveProperty('_meta');
    });

    test('Should parse AI response correctly', async () => {
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: { 
          event_type: 'PERSON_DETECTED',
          time: Math.floor(Date.now() / 1000)
        }
      });

      expect(result.description).toBeTruthy();
      expect(typeof result.person_count).toBe('number');
      expect(typeof result.vehicle_count).toBe('number');
      expect(typeof result.is_false_positive).toBe('boolean');
      expect(['info', 'warning', 'critical']).toContain(result.severity);
      expect(['none', 'log', 'notify_security', 'trigger_panic']).toContain(result.recommended_action);
    });

    test('Should include metadata in response', async () => {
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: { 
          event_type: 'PERSON_DETECTED',
          time: Math.floor(Date.now() / 1000)
        }
      });

      expect(result._meta).toBeDefined();
      expect(result._meta).toHaveProperty('model');
      expect(result._meta).toHaveProperty('tokens');
      expect(result._meta).toHaveProperty('latency_ms');
      expect(typeof result._meta.latency_ms).toBe('number');
    });

    test('Should handle different time of day correctly', async () => {
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: { 
          event_type: 'MOTION_DETECTED',
          time: Math.floor(Date.now() / 1000)
        },
        location: 'Halaman depan',
        timeOfDay: 'malam'
      });

      expect(result).toBeDefined();
      expect(result.description).toBeTruthy();
    });

    test('Should handle various event types', async () => {
      const eventTypes = ['PERSON_DETECTED', 'MOTION_DETECTED', 'LOITERING', 'VEHICLE_DETECTED'];
      
      for (const eventType of eventTypes) {
        const result = await analyzeSnapshot({
          imageBuffer: testImageBuffer,
          eventMeta: { 
            event_type: eventType,
            time: Math.floor(Date.now() / 1000)
          }
        });

        expect(result).toHaveProperty('severity');
        expect(result).toHaveProperty('recommended_action');
      }
    });
  });

  describe('Severity Levels', () => {
    let testImageBuffer;

    beforeEach(() => {
      testImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    });

    test('Should default missing severity to info', async () => {
      // Mock response without severity
      const OpenAI = require('openai');
      const mockClient = new OpenAI();
      mockClient.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-4o-mini',
        usage: { total_tokens: 100 },
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'Test image',
              person_count: 0,
              // severity missing
            })
          }
        }]
      });

      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: { event_type: 'TEST', time: Math.floor(Date.now() / 1000) }
      });

      expect(['info', 'warning', 'critical']).toContain(result.severity);
    });

    test('Should validate severity values', async () => {
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: { event_type: 'PERSON', time: Math.floor(Date.now() / 1000) }
      });

      expect(['info', 'warning', 'critical']).toContain(result.severity);
    });

    test('Should match action to severity level', async () => {
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: { event_type: 'PERSON', time: Math.floor(Date.now() / 1000) }
      });

      // Should have logical action for severity
      if (result.severity === 'critical') {
        expect(result.recommended_action).toBe('trigger_panic');
      } else if (result.severity === 'warning') {
        expect(result.recommended_action).toBe('notify_security');
      }
    });
  });

  describe('Error Handling', () => {
    let testImageBuffer;

    beforeEach(() => {
      testImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
    });

    test('Should handle invalid JSON response from AI', async () => {
      const OpenAI = require('openai');
      const mockClient = new OpenAI();
      mockClient.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-4o-mini',
        usage: { total_tokens: 50 },
        choices: [{
          message: {
            content: 'Invalid JSON {not valid'
          }
        }]
      });

      await expect(
        analyzeSnapshot({
          imageBuffer: testImageBuffer,
          eventMeta: { event_type: 'TEST', time: Math.floor(Date.now() / 1000) }
        })
      ).rejects.toThrow();
    });

    test('Should handle missing required fields with defaults', async () => {
      const OpenAI = require('openai');
      const mockClient = new OpenAI();
      mockClient.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-4o-mini',
        usage: { total_tokens: 100 },
        choices: [{
          message: {
            content: JSON.stringify({
              // Missing many fields
            })
          }
        }]
      });

      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: { event_type: 'TEST', time: Math.floor(Date.now() / 1000) }
      });

      expect(result.description).toBe('(no description)');
      expect(result.person_count).toBe(0);
      expect(result.vehicle_count).toBe(0);
      expect(result.is_false_positive).toBe(false);
      expect(result.tags).toEqual([]);
    });

    test('Should handle empty choices response', async () => {
      const OpenAI = require('openai');
      const mockClient = new OpenAI();
      mockClient.chat.completions.create.mockResolvedValueOnce({
        model: 'gpt-4o-mini',
        usage: { total_tokens: 0 },
        choices: [{}]
      });

      await expect(
        analyzeSnapshot({
          imageBuffer: testImageBuffer,
          eventMeta: { event_type: 'TEST', time: Math.floor(Date.now() / 1000) }
        })
      ).rejects.toThrow();
    });
  });

  describe('Buffer Handling', () => {
    test('Should accept Buffer image input', async () => {
      const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      
      const result = await analyzeSnapshot({
        imageBuffer,
        eventMeta: { event_type: 'PERSON', time: Math.floor(Date.now() / 1000) }
      });

      expect(result).toBeDefined();
      expect(result._meta).toBeDefined();
    });

    test('Should convert Buffer to base64 correctly', async () => {
      const imageBuffer = Buffer.from('test-image-data');
      const OpenAI = require('openai');
      const mockClient = new OpenAI();
      
      let capturedRequest = null;
      mockClient.chat.completions.create.mockImplementationOnce(async (config) => {
        capturedRequest = config;
        return {
          model: 'gpt-4o-mini',
          usage: { total_tokens: 100 },
          choices: [{
            message: {
              content: JSON.stringify({
                description: 'Test',
                person_count: 0,
                vehicle_count: 0,
                severity: 'info',
                recommended_action: 'log',
                tags: []
              })
            }
          }]
        };
      });

      await analyzeSnapshot({
        imageBuffer,
        eventMeta: { event_type: 'TEST', time: Math.floor(Date.now() / 1000) }
      });

      // Verify base64 was included in request
      if (capturedRequest && capturedRequest.messages) {
        const userMessage = capturedRequest.messages.find(m => m.role === 'user');
        if (userMessage && userMessage.content) {
          const imageContent = userMessage.content.find(c => c.type === 'image_url');
          expect(imageContent).toBeDefined();
        }
      }
    });
  });

  describe('Event Metadata', () => {
    let testImageBuffer;

    beforeEach(() => {
      testImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
    });

    test('Should handle Unix timestamp correctly', async () => {
      const unixTime = Math.floor(Date.now() / 1000);
      
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: {
          event_type: 'PERSON_DETECTED',
          time: unixTime
        }
      });

      expect(result).toBeDefined();
      expect(result._meta.latency_ms).toBeGreaterThanOrEqual(0);
    });

    test('Should extract time of day from timestamp', async () => {
      // Morning: 08:00
      const morningTime = new Date('2026-04-29T08:00:00').getTime() / 1000;
      
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: {
          event_type: 'PERSON_DETECTED',
          time: morningTime
        },
        location: 'Test Location'
      });

      expect(result).toBeDefined();
    });

    test('Should include camera location in analysis', async () => {
      const location = 'Pintu Depan';
      
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: {
          event_type: 'PERSON_DETECTED',
          time: Math.floor(Date.now() / 1000)
        },
        location
      });

      expect(result.description).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('Should record latency in metadata', async () => {
      const testImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
      
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: {
          event_type: 'PERSON_DETECTED',
          time: Math.floor(Date.now() / 1000)
        }
      });

      expect(result._meta.latency_ms).toBeGreaterThanOrEqual(0);
      expect(typeof result._meta.latency_ms).toBe('number');
    });

    test('Should track token usage', async () => {
      const testImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
      
      const result = await analyzeSnapshot({
        imageBuffer: testImageBuffer,
        eventMeta: {
          event_type: 'PERSON_DETECTED',
          time: Math.floor(Date.now() / 1000)
        }
      });

      expect(result._meta.tokens).toBeGreaterThan(0);
      expect(typeof result._meta.tokens).toBe('number');
    });
  });
});
