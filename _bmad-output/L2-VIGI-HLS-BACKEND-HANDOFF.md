# L2 — Vigi HLS Service Implementation (Backend Task)

**Status:** Handoff to Backend Dev  
**Priority:** HIGH — Unblocks L3 CRUD UI in frontend  
**Dependencies:** 
- ffmpeg already installed on server ✅
- Vigi AI (C240-01) registered in database ✅
- RTSP credentials available ✅

---

## 📋 Overview

Vigi AI camera (C240-01) stores RTSP stream URL in database:
```
stream_url: rtsp://admin:PASSWORD@192.168.0.60:554/stream1
```

**Problem:** Browsers cannot play RTSP directly. Need to transcode RTSP → HLS (m3u8) format.

**Solution:** 
1. Create Node.js service to run ffmpeg RTSP→HLS transcoding continuously
2. Serve HLS files via `express.static('/hls')`
3. Update C240-01 `stream_url` in database to point to HLS endpoint
4. Frontend receives HLS URL → plays via hls.js (already integrated)

**Result:** Vigi AI video appears in browser exactly like the 18 in-memory cameras. No frontend changes needed.

---

## 🔧 Prerequisites

- ✅ ffmpeg installed: `ffmpeg -version` should work
- ✅ Vigi AI RTSP stream accessible: `ffprobe rtsp://admin:PASSWORD@192.168.0.60:554/stream1`
- ✅ `public/hls/C240-01/` directory writable by Node.js process
- ✅ Database: C240-01 record exists with all fields populated

**Verify Backend Readiness:**
```bash
# Check ffmpeg
ffmpeg -version | head -1
# Output: ffmpeg version N-105..., ...

# Check RTSP accessibility
ffprobe -v error -show_entries format=duration \
  rtsp://admin:PASSWORD@192.168.0.60:554/stream1
# Output: duration=<value> (or fails if unreachable)

# Check directory
mkdir -p public/hls/C240-01
ls -la public/hls/
```

---

## 🏗️ Implementation

### Step L2-1: Create HLS Streaming Service

**File:** `services/vigiHlsStream.js`

```javascript
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HLS_OUTPUT_DIR = path.join(__dirname, '../public/hls/C240-01');

// Ensure directory exists
if (!fs.existsSync(HLS_OUTPUT_DIR)) {
  fs.mkdirSync(HLS_OUTPUT_DIR, { recursive: true });
}

// Vigi AI RTSP stream URL
const RTSP_URL = process.env.VIGI_RTSP_URL || 'rtsp://admin:PASSWORD@192.168.0.60:554/stream1';
const HLS_PLAYLIST = path.join(HLS_OUTPUT_DIR, 'index.m3u8');

let ffmpegProcess = null;
let isHealthy = true;

/**
 * Start ffmpeg RTSP → HLS transcoding
 * Runs continuously, auto-restarts on crash
 */
export function startVigiHlsStream() {
  if (ffmpegProcess) {
    console.log('[VigiHLS] Already running');
    return;
  }

  console.log('[VigiHLS] Starting ffmpeg RTSP→HLS transcoding...');

  // ffmpeg command:
  // -rtsp_transport tcp — more reliable than udp for RTSP
  // -i {RTSP_URL} — input stream
  // -c:v copy — copy video codec (no re-encode, faster)
  // -c:a aac — encode audio to AAC
  // -f hls — HLS format
  // -hls_time 2 — 2 sec per segment (lower = lower latency)
  // -hls_list_size 5 — keep last 5 segments in playlist (10 sec buffer)
  // -hls_flags delete_segments — auto-cleanup old segments
  // {HLS_PLAYLIST} — output m3u8 file

  const ffmpegArgs = [
    '-rtsp_transport', 'tcp',
    '-i', RTSP_URL,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments',
    HLS_PLAYLIST,
  ];

  ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  ffmpegProcess.stdout?.on('data', (data) => {
    console.log(`[VigiHLS stdout] ${data}`);
  });

  ffmpegProcess.stderr?.on('data', (data) => {
    console.log(`[VigiHLS stderr] ${data}`);
  });

  ffmpegProcess.on('error', (err) => {
    console.error('[VigiHLS] Process error:', err);
    isHealthy = false;
    ffmpegProcess = null;
    // Auto-restart after 5 seconds
    setTimeout(() => startVigiHlsStream(), 5000);
  });

  ffmpegProcess.on('exit', (code, signal) => {
    console.warn(`[VigiHLS] Exited with code ${code}, signal ${signal}`);
    isHealthy = false;
    ffmpegProcess = null;
    // Auto-restart after 5 seconds
    setTimeout(() => startVigiHlsStream(), 5000);
  });

  isHealthy = true;
}

/**
 * Stop HLS streaming
 */
export function stopVigiHlsStream() {
  if (ffmpegProcess) {
    console.log('[VigiHLS] Stopping...');
    ffmpegProcess.kill();
    ffmpegProcess = null;
  }
  isHealthy = false;
}

/**
 * Check if HLS stream is healthy
 * Used by /health endpoint or monitoring dashboards
 */
export function isVigiHlsHealthy() {
  return isHealthy && !!ffmpegProcess;
}

/**
 * Get path to HLS playlist (for debugging)
 */
export function getVigiHlsPlaylistPath() {
  return HLS_PLAYLIST;
}

/**
 * Get public-facing HLS URL (what frontend receives)
 */
export function getVigiHlsUrl() {
  return '/hls/C240-01/index.m3u8';
}
```

**Environment Variables:**
Add to `.env`:
```
VIGI_RTSP_URL=rtsp://admin:PASSWORD@192.168.0.60:554/stream1
```

---

### Step L2-2: Integrate into Server Startup

**File:** `server.js` (or main entry point)

```javascript
import express from 'express';
import { startVigiHlsStream, stopVigiHlsStream, isVigiHlsHealthy, getVigiHlsUrl } from './services/vigiHlsStream.js';

const app = express();

// ── Serve HLS files statically ──
app.use('/hls', express.static('public/hls', {
  maxAge: '1h',
  etag: false,
  setHeaders: (res, path) => {
    // HLS playlists should not be cached long (contents change every few sec)
    if (path.endsWith('.m3u8')) {
      res.setHeader('Cache-Control', 'public, max-age=10');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    }
    // Segments can be cached longer (immutable once created)
    if (path.endsWith('.ts')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Type', 'video/mp2t');
    }
  },
}));

// ── Add HLS health to system health endpoint ──
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    services: {
      // ... existing services ...
      vigiHls: isVigiHlsHealthy() ? 'healthy' : 'unhealthy',
    },
  };
  res.json(health);
});

// ── Startup ──
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  
  // Start Vigi HLS transcoding
  startVigiHlsStream();
});

// ── Graceful shutdown ──
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stopVigiHlsStream();
  process.exit(0);
});
```

---

### Step L2-3: Update Database Record

**File:** Update C240-01 in database (one-time)

Change C240-01 `stream_url` from RTSP to HLS endpoint:

**Before:**
```json
{
  "id": "C240-01",
  "name": "Vigi AI",
  "stream_url": "rtsp://admin:PASSWORD@192.168.0.60:554/stream1",
  "status": "OFFLINE",
  "lat": 40.7128,
  "lng": -74.0060
}
```

**After:**
```json
{
  "id": "C240-01",
  "name": "Vigi AI",
  "stream_url": "/hls/C240-01/index.m3u8",
  "status": "ONLINE",
  "lat": 40.7128,
  "lng": -74.0060
}
```

**SQL:**
```sql
UPDATE cameras 
SET stream_url = '/hls/C240-01/index.m3u8',
    status = 'ONLINE'
WHERE id = 'C240-01';
```

**Endpoint (if using API):**
```http
PUT /api/api/cameras/C240-01
Content-Type: application/json

{
  "stream_url": "/hls/C240-01/index.m3u8",
  "status": "ONLINE"
}
```

---

## ✅ Testing Checklist

### Test 1: ffmpeg process running
```bash
ps aux | grep ffmpeg
# Should see: ffmpeg -rtsp_transport tcp -i rtsp://...
```

### Test 2: HLS playlist exists and updates
```bash
watch -n 1 'ls -la public/hls/C240-01/'
# Should see index.m3u8 + multiple .ts segment files
# .ts files should increase every 2 seconds (hls_time=2)
```

### Test 3: Playlist content is valid
```bash
cat public/hls/C240-01/index.m3u8
# Output should be valid m3u8:
# #EXTM3U
# #EXT-X-VERSION:3
# #EXT-X-TARGETDURATION:2
# #EXT-X-MEDIA-SEQUENCE:0
# #EXTINF:2.0,
# segment-0-v1-a1.ts
# ...
```

### Test 4: HTTP endpoint accessible
```bash
curl -i http://localhost:3001/hls/C240-01/index.m3u8
# Should return 200 + m3u8 content
# Check headers: Cache-Control: public, max-age=10
```

### Test 5: Database updated
```bash
curl http://localhost:3001/api/cameras/C240-01 \
  -H "Authorization: Bearer {token}"
# Should return: stream_url: "/hls/C240-01/index.m3u8"
```

### Test 6: Frontend playback
1. Open frontend dashboard in browser
2. Go to Fullscreen Cameras view
3. First camera (Vigi AI) should be playing live video
4. Open DevTools → Network
5. Filter by `index.m3u8` — should see request every ~10 sec
6. Filter by `.ts` — should see segment requests every ~2 sec
7. No red errors in Console

---

## 🔍 Troubleshooting

### Issue: ffmpeg exits immediately
**Check logs:**
```bash
tail -f logs/server.log | grep VigiHLS
```

**Likely causes:**
- RTSP URL wrong or stream unreachable
- ffmpeg not installed: `which ffmpeg`
- No write permission to `public/hls/C240-01`

**Fix:**
```bash
# Test RTSP reachability
ffprobe -v error rtsp://admin:PASSWORD@192.168.0.60:554/stream1

# Test ffmpeg directly
ffmpeg -rtsp_transport tcp -i rtsp://admin:PASSWORD@192.168.0.60:554/stream1 \
  -c:v copy -c:a aac -f hls -hls_time 2 -hls_list_size 5 \
  public/hls/C240-01/index.m3u8
# Press Ctrl+C after 10 sec, check public/hls/C240-01/
```

### Issue: HLS segments not updating
**Check:**
```bash
watch -n 1 'ls -lt public/hls/C240-01/ | head -5'
# Files should update every 2 seconds
```

**If not updating:**
- ffmpeg might be hung: `kill $(pgrep ffmpeg)` and restart
- RTSP stream might be stalled — reconnect device

### Issue: High CPU usage
**ffmpeg with codec copy (no re-encode) should use <20% CPU.** If higher:
- Check if RTSP stream quality is excessive (4K?)
- Consider adding `-s 1920x1080` to scale down
- Or reduce `-hls_list_size` to 3

### Issue: Latency > 15 seconds
**For lower latency, adjust ffmpeg settings:**
```javascript
// Lower latency = more CPU usage
const ffmpegArgs = [
  '-rtsp_transport', 'tcp',
  '-i', RTSP_URL,
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-f', 'hls',
  '-hls_time', '1',      // <- reduced from 2 to 1 sec
  '-hls_list_size', '3', // <- reduced from 5 to 3
  '-hls_flags', 'delete_segments',
  HLS_PLAYLIST,
];
```

---

## 📊 Success Criteria

- ✅ ffmpeg process starts on server boot and stays running
- ✅ `/hls/C240-01/index.m3u8` returns valid m3u8 file
- ✅ HLS segments (`.ts`) generated continuously every 2 sec
- ✅ C240-01 database `stream_url` updated to `/hls/C240-01/index.m3u8`
- ✅ Frontend dashboard shows Vigi AI playing live video
- ✅ Browser DevTools Network shows `.m3u8` + `.ts` requests
- ✅ No ffmpeg crashes or restart loops
- ✅ CPU usage reasonable (<25%)
- ✅ Latency acceptable (<15 sec)

---

## 📝 Notes

1. **Auto-restart on crash** — If ffmpeg crashes, service auto-restarts after 5 sec. Monitor logs for repeated crashes.

2. **Graceful shutdown** — On server stop, ffmpeg process is killed cleanly (no zombie processes).

3. **No frontend changes** — Frontend `CameraCard.jsx` doesn't need updates. hls.js already integrated. Just change database `stream_url`.

4. **Scalability** — Currently set up for 1 camera (Vigi). To add more RTSP cameras:
   - Create service instances for each (e.g., `vigiHlsStream.js`, `hikvisionHlsStream.js`)
   - Serve each under `/hls/{cameraId}/`
   - Update database with new URLs

---

## 🤝 Handoff Checklist

**Backend Dev:**
- [ ] Read this document
- [ ] Verify ffmpeg installed + RTSP accessible
- [ ] Create `services/vigiHlsStream.js`
- [ ] Integrate into `server.js` startup
- [ ] Update C240-01 database record
- [ ] Run testing checklist
- [ ] Deploy to staging/production
- [ ] Verify frontend dashboard shows Vigi AI video

**Frontend Lead (LENOVO):**
- [ ] L1 complete (✅ Done)
- [ ] Wait for backend to complete L2
- [ ] Once L2 done → verify Vigi AI video appears in dashboard
- [ ] Then start L3 (CRUD UI)

---

**Expected Completion Time:** ~30-45 min (assuming no RTSP/ffmpeg issues)

Questions? Check logs: `server.log` or `journalctl -u camera-service -f`

