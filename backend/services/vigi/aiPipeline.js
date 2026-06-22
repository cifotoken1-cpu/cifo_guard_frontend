// backend/services/vigi/aiPipeline.js
// Sends snapshot + event metadata to GPT-4o-mini and returns a structured
// security analysis object: description (Bahasa Indonesia), severity, action.

const OpenAI = require('openai');

let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('aiPipeline: OPENROUTER_API_KEY is not set in .env');
    }
    _client = new OpenAI({
      apiKey:  process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/cifo/security-backend',
        'X-Title':      'CIFO Security VIGI Bridge',
      },
    });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a security analyst AI for a CCTV-based security system in Indonesia. You receive snapshots from a security camera together with the event type that triggered the capture. Analyze the image and produce a single JSON object — no prose, no markdown fences.

Output schema (return EXACTLY these fields):
{
  "description": string,            // 1-2 sentences in Bahasa Indonesia. Describe people (estimated gender, age range, clothing, distinguishing features), objects, and behavior. Be specific but neutral and factual. Do NOT identify named individuals.
  "person_count": integer,
  "vehicle_count": integer,
  "is_false_positive": boolean,     // true if the event seems triggered by a shadow, animal, image-of-person on a poster/screen, light change, or environmental artifact rather than an actual person/vehicle.
  "severity": "info" | "warning" | "critical",
  "severity_reason": string,        // Brief explanation in Bahasa Indonesia for why this severity was chosen.
  "tags": string[],                 // 3-6 short keywords in lowercase English, e.g. ["person", "unknown", "entering", "daylight", "calm"].
  "recommended_action": "none" | "log" | "notify_security" | "trigger_panic"
}

Severity rubric:
- "info"     — normal/expected activity (e.g. apparent resident, daytime delivery person, owner returning, registered visitor pattern). Most events fall here.
- "warning"  — suspicious but not immediate danger (e.g. unknown person loitering, unusual hours, attempting to test access, masked face WITHOUT other threat signals, vehicle in restricted area).
- "critical" — clear threat or emergency (e.g. forced entry, weapon visible, fight, fire/smoke, person fallen and motionless, breaking-in, intrusion at restricted hours combined with concealment behavior).

Action rubric:
- "trigger_panic"     — only when severity is "critical".
- "notify_security"   — for "warning".
- "log"               — for "info" events worth keeping.
- "none"              — for is_false_positive=true or trivial environmental events.

Be CONSERVATIVE with "critical" — only use it when you can name a specific threat in severity_reason. Ambiguous suspicion goes to "warning".

Respond with ONLY the JSON object. No markdown. No explanation.`;

/**
 * Analyze a snapshot with GPT-4o-mini.
 * @param {object} args
 * @param {Buffer} args.imageBuffer   JPEG bytes
 * @param {object} args.eventMeta     { event_type, time }  from VIGI subscribeMsg
 * @param {string} [args.location]    human-readable camera location
 * @param {string} [args.timeOfDay]   optional override (auto-derived if missing)
 * @returns {Promise<object>} parsed AI response with extra _meta fields
 */
async function analyzeSnapshot({ imageBuffer, eventMeta, location = 'unknown', timeOfDay }) {
  if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('aiPipeline: OPENROUTER_API_KEY or OPENAI_API_KEY is not set');
  }

  const eventTime = new Date(eventMeta.time * 1000);
  const hour = eventTime.getHours();
  const tod = timeOfDay
    || (hour < 5 ? 'dini hari'
      : hour < 11 ? 'pagi'
      : hour < 15 ? 'siang'
      : hour < 18 ? 'sore'
      : hour < 22 ? 'malam'
      : 'larut malam');

  const userText = `Camera event:
- type: ${eventMeta.event_type}
- timestamp: ${eventTime.toISOString()}
- time of day: ${tod}
- camera location: ${location}

Analyze the attached snapshot and return the JSON object as specified.`;

  const base64 = imageBuffer.toString('base64');
  const startedAt = Date.now();

  const client = getClient();
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 250, // JSON respons pendek — generation lebih cepat
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`,
              detail: 'low', // ~85 image tokens; enough for security framing
            },
          },
        ],
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  let result;
  try {
    result = JSON.parse(raw);
  } catch (e) {
    throw new Error(`aiPipeline: model returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Sanity defaults so downstream never crashes on missing fields.
  result.description ||= '(no description)';
  result.person_count = Number(result.person_count) || 0;
  result.vehicle_count = Number(result.vehicle_count) || 0;
  result.is_false_positive = Boolean(result.is_false_positive);
  result.severity = ['info', 'warning', 'critical'].includes(result.severity) ? result.severity : 'info';
  result.severity_reason ||= '';
  result.tags = Array.isArray(result.tags) ? result.tags : [];
  result.recommended_action = ['none', 'log', 'notify_security', 'trigger_panic'].includes(result.recommended_action)
    ? result.recommended_action
    : (result.severity === 'critical' ? 'trigger_panic'
      : result.severity === 'warning' ? 'notify_security'
      : 'log');

  result._meta = {
    model: completion.model,
    tokens: completion.usage?.total_tokens || 0,
    latency_ms: Date.now() - startedAt,
  };

  return result;
}

module.exports = { analyzeSnapshot };
