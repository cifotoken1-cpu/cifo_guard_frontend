# 🧪 USER TESTING GUIDE — L1-L3 Implementation

**Date:** May 4, 2026  
**Project:** cifo-frontend  
**Scope:** Testing L1 (Foundation), L2 (Backend Handoff), L3 (CRUD UI)

---

## 📋 Prerequisites

- ✅ Frontend running (`npm run dev` or production build)
- ✅ Backend running on `localhost:3001`
- ✅ Browser with DevTools (F12 or Ctrl+Shift+I)
- ✅ Network tab access in DevTools

---

## 📊 QUICK REFERENCE

| Layer | Feature | Test Time | Status |
|-------|---------|-----------|--------|
| L1 | Heartbeat Polling | 5 min | Ready |
| L1 | No Dummy Data | 3 min | Ready |
| L1 | Data Normalization | 5 min | Ready |
| L2 | Vigi HLS (Backend) | 5 min | Requires L2 impl |
| L3 | Add Camera | 5 min | Ready |
| L3 | Edit Camera | 5 min | Ready |
| L3 | Delete Camera | 5 min | Ready |
| L3 | Form Validation | 3 min | Ready |
| **TOTAL** | | ~40 min | |

---

# ✅ L1 TESTING — Foundation Layer

## Test 1.1: Kamera Tampil ONLINE (Heartbeat Active)

### Objective
Verify heartbeat polling is running and cameras show `online` status.

### Steps
1. Open dashboard in browser
2. Look at right panel "Live Cameras" (top 3 cameras)
3. **Check:** All cameras show status `online` ✅
   - *Before fix:* Cameras were always `offline`
   - *After fix:* Should be `online`
4. Open DevTools → **Network** tab (F12)
5. Filter: type `heartbeat` in search
6. **Observe:** Multiple `POST /api/cameras/cam-X/heartbeat` requests appearing
7. **Note the timing:** Requests should occur approximately every 30 seconds

### Expected Result ✅
- Cameras display `online` status in UI
- Network shows heartbeat POST requests every ~30 seconds
- Each request returns HTTP 200
- Request body contains: `status: 'online', responseTime, healthScore, streamAccessible`

### If FAIL ❌
- **Issue:** Cameras still show `offline`
  - Check Console (F12 → Console tab) for errors
  - Verify backend `/api/cameras/:id/heartbeat` endpoint accessible
  - Check `useCamerasStream.js` is properly integrated
  
- **Issue:** No heartbeat requests in Network
  - DevTools → Console → check for errors
  - Verify `useCameras()` hook is being called
  - Check if `camerasApi.heartbeat()` function exists in `cameras.api.js`

---

## Test 1.2: No FALLBACK_CAMS Dummy Data

### Objective
Verify hardcoded dummy camera data has been removed.

### Steps
1. Open DevTools → **Inspector** (F12 → Elements tab)
2. Press `Ctrl+F` to search in DOM
3. Search for: `"Driveway"` or `"CAM 01"` or `"Back Garden"`
4. **Expected:** ❌ No results found = PASS ✅
5. Search for actual API camera names instead
   - These should match real backend response
6. **Verify:** Camera names in UI match `/api/cameras` response

### Expected Result ✅
- Hardcoded names NOT found in DOM
- All camera names come from API response
- No fallback/placeholder data visible

### If FAIL ❌
- Dummy data strings found in DOM
  - Check `RightPanel.jsx` — `FALLBACK_CAMS` still present?
  - Verify import of `normalizeCameraList` from `camera.service.js`
  - Check if `FALLBACK_CAMS` fallback being used instead of API data

---

## Test 1.3: Data Normalization (Format Consistency)

### Objective
Verify camera data is normalized correctly across different API responses.

### Steps
1. Open DevTools → **Network** tab
2. Filter by `cameras` (request)
3. Click on `GET /api/cameras` request
4. Select **Response** tab
5. **Note the raw format:**
   - Fields like: `name`, `stream_url`, `status`, `resolution`
   - Status values like: `online`, `offline` (lowercase)
   - Snake_case fields: `stream_url`, `response_time`, etc.
6. Now inspect the UI in browser
7. DevTools → **Console** tab, run:
   ```javascript
   // Check normalized camera object structure
   const videoEl = document.querySelector('video');
   console.log('Video element:', videoEl?.parentElement?.textContent);
   
   // Or manually inspect CameraCard component
   console.log('Cameras rendered:', {
     count: document.querySelectorAll('[class*="card"]').length
   });
   ```
8. **Verify:** UI uses normalized field names

### Expected Normalized Format ✅
```javascript
{
  id: "cam-01",
  name: "Driveway Camera",        // Normalized from API
  res: "1080p",                    // From resolution field
  streamUrl: "/hls/...",          // Normalized from stream_url
  status: "online",                // Always lowercase
  healthScore: 90,
  responseTime: 150,
  lat: 40.7128,
  lng: -74.0060,
  area: "Front Door",
  bg: "cam-bg-1"
}
```

### If FAIL ❌
- Status shows uppercase (`ONLINE` instead of `online`)
  - Check `normalizeStatus()` function in `camera.service.js`
  - Verify `STATUS_MAP` constant is correct
  
- Fields show snake_case (`stream_url` instead of `streamUrl`)
  - Check `normalizeCamera()` function not applied
  - Verify component using `normalizeCameraList()` output

---

# 🎥 L2 TESTING — Vigi HLS Streaming

> ⚠️ **Note:** L2 is backend task. Only test if backend developer has completed implementation.

## Test 2.1: Vigi AI Positioned First (Vigi-First Ordering)

### Objective
Verify Vigi AI camera (C240-01) appears first in camera list.

### Steps
1. Dashboard → Click "Fullscreen" button in right panel
2. Open Live Camera Feeds modal
3. **Check grid layout:**
   - First camera (featured, larger) should be Vigi AI
   - Camera name should be "Vigi AI" or "C240-01"
4. **Verify:** Vigi-First ordering active
5. DevTools → **Console**, run:
   ```javascript
   // Verify normalization
   const cameras = document.querySelectorAll('[class*="card"]');
   console.log('First camera name:', cameras[0]?.textContent);
   ```

### Expected Result ✅
- Vigi AI is first (index 0) in camera grid
- Vigi card is featured/larger size
- Ordering persists across page reloads

### If FAIL ❌
- Vigi not first, or not at all
  - Check `normalizeCameraList()` in `camera.service.js`
  - Verify C240-01 exists in backend `/api/cameras` response
  - Check Vigi-First sorting logic

---

## Test 2.2: Vigi HLS Stream Playing

### Objective
Verify Vigi AI streams video via HLS (if backend L2 implemented).

### Steps
1. Open Dashboard → Fullscreen Cameras
2. **Look at first camera (Vigi AI):**
   - Should show LIVE VIDEO, not placeholder background
   - Video should have timestamp overlay
3. Open DevTools → **Network** tab
4. Filter: `.m3u8` (HLS playlist file)
5. **Expected requests:**
   - `GET /hls/C240-01/index.m3u8` → 200 ✅
   - Multiple subsequent requests to same file
6. Filter: `.ts` (video segments)
7. **Expected:** Segment requests every ~2-3 seconds
   - File names like: `segment-0-v1-a1.ts`, `segment-1-v1-a1.ts`, etc.
   - Status 200 with video content
8. **Check video playback:**
   - Video should be playing (not paused)
   - Timeline should advance
   - No red error indicators

### Expected Result ✅
- Vigi AI displays live video stream
- Network shows `/hls/C240-01/index.m3u8` requests
- Video segments (.ts files) loading continuously
- hls.js library handling playback
- Video plays without errors

### If FAIL ❌
- Shows placeholder background instead of video
  - Check Network → is `/hls/C240-01/index.m3u8` returning 200?
  - If 404 → backend L2 service not running
  - If 200 but no video → ffmpeg might not be transcoding
  
- Console shows hls.js error
  - Common: "NetworkError", "BadRequest"
  - Check backend logs for ffmpeg process
  
- Video latency too high (>15 sec delay)
  - This is known issue, handled in L2 troubleshooting
  - Adjust ffmpeg `-hls_time` parameter

---

# ➕ L3 TESTING — CRUD UI

## Test 3.1: Add Camera Button & Form

### Objective
Verify camera addition interface is accessible and functional.

### Steps
1. Dashboard → Open "Fullscreen" (right panel)
2. Live Cameras modal opens
3. **Check footer:** Look for "+ Add Camera" button (right side)
4. **Click:** "+ Add Camera"
5. **Expected:** Modal overlays with "Add New Camera" form
6. **Check form fields:**
   - Name (required, red asterisk)
   - Label (required)
   - Area / Location
   - Resolution (dropdown)
   - Latitude, Longitude
   - Stream URL
   - Note about dual-field workaround

### Expected Result ✅
- "+ Add Camera" button visible in footer
- Clicking opens form modal
- Form displays all expected fields
- Required fields marked with *
- Form has cancel/submit buttons

### If FAIL ❌
- Button not visible
  - Check `CamerasModal.jsx` footer section
  - Verify CSS for `.addCameraBtn`
  
- Form not opening
  - Check `showForm` state logic
  - Verify `CameraForm.jsx` imported correctly

---

## Test 3.2: Form Input Validation

### Objective
Verify form validates required fields before submission.

### Steps
1. Open Add Camera form (see Test 3.1)
2. **Leave all fields empty**
3. Click "Add Camera" button
4. **Expected errors appear:**
   - "Name required" message shown in red
   - "Label required" message shown in red
5. **Fill only Name field:** "Test Camera"
6. Leave Label empty
7. Click "Add Camera"
8. **Expected:** Error "Label required" still shown ✅
9. **Test latitude/longitude validation:**
   - Enter non-numeric value in Latitude field
   - **Expected:** Error "Invalid latitude"
10. Enter valid coordinates: Lat="40.7128", Lng="-74.0060"
11. **Expected:** No error for coordinate fields

### Expected Validation Rules ✅
- Name: required ✓
- Label: required ✓
- Latitude: must be numeric (if provided)
- Longitude: must be numeric (if provided)
- Error messages display in red
- Submit button disabled during validation

### If FAIL ❌
- Form submits with empty required fields
  - Check `validate()` function in `CameraForm.jsx`
  - Verify error state is being checked before `mutate()`
  
- Error messages not shown
  - Check `.fieldError` CSS class exists
  - Verify error rendering in form JSX

---

## Test 3.3: Create New Camera

### Objective
Verify new camera can be added via form and appears in grid.

### Steps
1. Open Add Camera form
2. **Fill form with:**
   - Name: "Backyard Camera"
   - Label: "CAM-05"
   - Area: "Back Garden"
   - Latitude: "40.7100"
   - Longitude: "-74.0050"
   - Stream URL: (leave empty for test, or enter valid HLS URL)
   - Resolution: "1080p"
3. Click "Add Camera"
4. **Watch for:**
   - Submit button shows "Saving…" briefly
   - Loading state active
5. **After submit:**
   - Form modal closes automatically
   - Camera grid refreshes
   - **Expected:** "Backyard Camera" now visible in grid ✅
6. **Verify with DevTools → Network:**
   - See `POST /api/cameras` request
   - Status 200-201
   - Request body includes fields sent
7. **Check request body structure:**
   - Should have **dual-field** for backend compatibility
   - Both `name` AND `label`
   - Both `lat`/`lng` AND other location fields

### Expected Result ✅
- Form submits successfully
- New camera appears in grid
- Network shows POST 200
- Camera persists after page reload
- Request body has both field sets (dual-field workaround)

### Expected Network Body (Dual-Field):
```json
{
  "name": "Backyard Camera",
  "ip_address": "0.0.0.0",
  "location": "Back Garden",
  "label": "Backyard Camera",
  "area": "Back Garden",
  "lat": 40.71,
  "lng": -74.005,
  "stream_url": "",
  "status": "OFFLINE",
  "resolution": "1080p"
}
```

### If FAIL ❌
- Form won't submit
  - Check Console for errors
  - DevTools Network → see error response (400/500)?
  
- Camera doesn't appear after submit
  - Check if POST response was 200 or error
  - Verify React Query invalidation working
  - Check backend created record correctly
  
- Only one set of fields in POST (not dual-field)
  - Check `buildCameraPostBody()` in `camera.service.js`
  - Verify both field names are being sent

---

## Test 3.4: Edit Camera

### Objective
Verify existing camera can be edited and changes persist.

### Steps
1. Open Fullscreen Cameras modal
2. **Hover over any camera card**
3. **Expected:** Edit button "✎" appears in top-right ✅
4. Click "✎" button
5. **Expected:** Form modal opens with title "Edit Camera"
6. **Check form is pre-filled:**
   - Name: existing camera name
   - Label: existing label
   - Other fields: existing values
   - Buttons show "Update Camera" + "Delete" button
7. **Edit one field:**
   - Name: change to "Updated Backyard"
8. Click "Update Camera"
9. **Expected:**
   - Form closes
   - Grid refreshes
   - Camera name changed to "Updated Backyard" ✅
10. **Verify with Network tab:**
    - See `PUT /api/cameras/{id}` request
    - Status 200

### Expected Result ✅
- Edit button appears on hover
- Form pre-fills with existing data
- Changes submit successfully
- Grid reflects changes immediately
- PUT request sent to backend

### If FAIL ❌
- Edit button not showing
  - Hover might not be working
  - Check `.cardActions` CSS and visibility logic
  
- Form shows "Add" instead of "Edit"
  - Check `isEdit` prop logic in `CameraForm.jsx`
  - Verify `camera` prop passed correctly
  
- Changes not persisted
  - Check PUT response status
  - Verify React Query `invalidateQueries` called

---

## Test 3.5: Delete Camera

### Objective
Verify camera can be deleted with confirmation.

### Steps
1. Open Fullscreen Cameras
2. Hover camera → click edit "✎" button
3. Form opens with "Edit Camera" title
4. **Check:** "Delete" button visible (red) ✅
   - Should only appear in Edit mode, not Add mode
5. Click "Delete" button
6. **Expected:** Confirmation dialog appears
   - Text: "Delete 'Updated Backyard'? This cannot be undone."
   - Two buttons: "OK" and "Cancel"
7. Click "OK" in confirmation
8. **Expected:**
   - Dialog closes
   - Form closes
   - Camera disappears from grid ✅
   - **Verify:** Grid count decreased
9. **Check Network tab:**
   - See `DELETE /api/cameras/{id}` request
   - Status 200
10. **Refresh page (F5):**
    - **Verify:** Camera still deleted (persisted)

### Expected Result ✅
- Delete button only in Edit mode
- Confirmation dialog shown before delete
- Camera removed from grid after confirmation
- DELETE request sent with status 200
- Deletion persists after page reload

### If FAIL ❌
- Delete button showing in Add mode
  - Check `isEdit` condition in form
  
- Delete happens without confirmation
  - Add confirmation dialog check in delete handler
  
- Camera not actually deleted from grid
  - Check DELETE response status
  - Verify React Query cache invalidation

---

## Test 3.6: React Query Cache Invalidation

### Objective
Verify camera data is properly cached and invalidated on changes.

### Steps
1. **Initial state:** Note cameras in grid (e.g., 5 cameras)
2. Add new camera (see Test 3.3)
3. **After add:** Grid now shows 6 cameras ✅
4. **Refresh page (F5)**
5. **Expected:** Grid STILL shows 6 cameras (data persisted) ✅
6. Edit camera name
7. **Before invalidation:** Old name still showing (cached)
8. **After invalidation:** New name appears ✅
9. Delete camera
10. **Expected:** Camera removed immediately (cache updated)

### Expected Result ✅
- New cameras appear immediately after creation
- Edits reflected in UI immediately
- Deletions reflected in UI immediately
- Data persists after page refresh
- No stale data displayed

### Debug Cache with DevTools:
```javascript
// In Console, check React Query state
// (requires React Query DevTools extension)
console.log('React Query Cache:', window.__REACT_QUERY_DEVTOOLS_PANEL__);
```

### If FAIL ❌
- Data not persisting after refresh
  - Backend might not have created record
  - Check backend logs for persistence errors
  
- Changes not showing in real-time
  - Check `invalidateQueries` call in mutation `onSuccess`
  - Verify query key is correct: `['cameras']`

---

# 🎯 COMBINED TESTING SCENARIO (20-30 minutes)

Follow this full flow for complete validation:

```
1. ✅ Load Dashboard (1 min)
   - See 3 cameras in right panel
   - All showing "online" status

2. ✅ Verify Heartbeat (2 min)
   - DevTools Network → filter "heartbeat"
   - See POST requests every ~30 sec

3. ✅ Check No Dummy Data (1 min)
   - DevTools Inspector → search "Driveway"
   - No results = PASS

4. ✅ Fullscreen Cameras (1 min)
   - Open modal
   - Verify Vigi AI first (if available)

5. ✅ Add Camera (5 min)
   - Click "+ Add Camera"
   - Fill form (name, label, location)
   - Submit
   - Verify appears in grid

6. ✅ Edit Camera (5 min)
   - Hover camera → edit button
   - Change name
   - Submit
   - Verify change in grid

7. ✅ Delete Camera (3 min)
   - Edit → delete button
   - Confirm deletion
   - Verify removed from grid

8. ✅ Refresh & Verify Persistence (2 min)
   - F5 page reload
   - Verify added/edited/deleted cameras persist

9. ✅ Final Validation (1 min)
   - DevTools Console → check for errors
   - No red errors = PASS
```

---

# 🔍 DEVTOOLS INSPECTION REFERENCE

## Network Tab Filters

### L1 Expected Requests
```
GET /api/cameras → 200 ✅
- Response: Array of camera objects
- Status: online/offline
- Fields: name, stream_url, resolution

POST /api/cameras/:id/heartbeat → 200 ✅
- Repeats every ~30 seconds
- Body: {status, responseTime, healthScore, streamAccessible}
- Response: {success: true}
```

### L3 Expected Requests
```
POST /api/cameras → 200-201 ✅
- Body: Dual-field structure
- Response: Created camera object

PUT /api/cameras/:id → 200 ✅
- Response: Updated camera object

DELETE /api/cameras/:id → 200 ✅
- Response: {success: true} or empty
```

## Console Tab Expected Output

### ✅ OK (No Errors)
```
Camera list loaded
Heartbeat ping sent
Camera form validated
Mutation success
```

### ❌ NOT OK (Errors to Fix)
```
Cannot read property 'cameras' of undefined
404 /api/cameras
ValidationError: field required
hls.js NetworkError
```

## Performance Expectations

| Metric | Expected | Actual |
|--------|----------|--------|
| Page load | < 3 sec | _____ |
| Add camera form | < 1 sec submit | _____ |
| Grid refresh | < 500ms | _____ |
| Heartbeat requests | Every ~30 sec | _____ |
| No console errors | 0 | _____ |

---

# 📝 TESTING REPORT TEMPLATE

```markdown
# Testing Report

**Date:** [Date]
**Tester:** [Name]
**Environment:** localhost:3001
**Browser:** [Chrome/Firefox/Safari] v[version]

## L1 Tests

- [ ] Test 1.1: Heartbeat polling
  - Result: ✅ PASS / ❌ FAIL
  - Notes: _______________

- [ ] Test 1.2: No dummy data
  - Result: ✅ PASS / ❌ FAIL
  - Notes: _______________

- [ ] Test 1.3: Data normalization
  - Result: ✅ PASS / ❌ FAIL
  - Notes: _______________

## L2 Tests (Backend)

- [ ] Test 2.1: Vigi-First ordering
  - Result: ✅ PASS / ❌ FAIL / ⏭️ SKIPPED
  - Notes: _______________

- [ ] Test 2.2: Vigi HLS streaming
  - Result: ✅ PASS / ❌ FAIL / ⏭️ SKIPPED
  - Notes: _______________

## L3 Tests

- [ ] Test 3.1: Add camera button
  - Result: ✅ PASS / ❌ FAIL
  - Notes: _______________

- [ ] Test 3.2: Form validation
  - Result: ✅ PASS / ❌ FAIL
  - Notes: _______________

- [ ] Test 3.3: Create camera
  - Result: ✅ PASS / ❌ FAIL
  - Notes: _______________

- [ ] Test 3.4: Edit camera
  - Result: ✅ PASS / ❌ FAIL
  - Notes: _______________

- [ ] Test 3.5: Delete camera
  - Result: ✅ PASS / ❌ FAIL
  - Notes: _______________

- [ ] Test 3.6: Cache invalidation
  - Result: ✅ PASS / ❌ FAIL
  - Notes: _______________

## Issues Found

### Critical 🔴
1. [Issue Title]
   - Steps: ...
   - Expected: ...
   - Actual: ...
   - Impact: Blocking production

### Major 🟠
2. [Issue Title]
   - Steps: ...
   - Expected: ...
   - Actual: ...
   - Impact: Affects main workflow

### Minor 🟡
3. [Issue Title]
   - Steps: ...
   - Expected: ...
   - Actual: ...
   - Impact: Cosmetic/non-blocking

## Summary

**Total Tests:** X  
**Passed:** X  
**Failed:** X  
**Skipped:** X  

**Overall Status:** ✅ READY FOR PRODUCTION / ❌ BLOCKERS FOUND

**Recommendations:**
- Fix critical/major issues before deployment
- ...

**Sign-off:**

Tester: ________________  
Date: ________________  
```

---

# 🆘 COMMON ISSUES & FIXES

| Issue | Cause | Solution |
|-------|-------|----------|
| Cameras always offline | Heartbeat not running | Check `useCamerasStream.js` → verify interval is 30000ms |
| Dummy data appears | FALLBACK_CAMS still active | Remove FALLBACK_CAMS from RightPanel.jsx |
| Form won't submit | Validation errors | Check error messages in form, fill all required fields |
| Camera not persisted | Backend error | Check Network tab → POST response status/body |
| Edit button not showing | CSS/hover issue | Check `.cardActions` visibility in CamerasModal.module.css |
| Delete button missing | Not in Edit mode | Delete only available when editing existing camera |
| HLS video not playing | ffmpeg service not running | Verify backend L2 completed |

---

# ✅ FINAL CHECKLIST

Before marking as "Ready for Production":

- [ ] All L1 tests passing
- [ ] All L3 tests passing
- [ ] No red errors in Console
- [ ] Network requests all 200 status
- [ ] Form validation working
- [ ] CRUD operations all working
- [ ] Data persists after page reload
- [ ] Performance acceptable (<3sec load time)
- [ ] No obvious UI/UX issues
- [ ] Backend L2 status: _____ (Complete / In Progress / Not Started)

---

## 📞 Need Help?

- Check **Network tab** in DevTools first (80% of issues)
- Check **Console tab** for error messages
- Check **backend logs** if API returns errors
- Verify **prerequisites** are met

---

**Last Updated:** May 4, 2026  
**Version:** 1.0
