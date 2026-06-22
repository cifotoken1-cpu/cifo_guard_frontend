# QA Testing Guide — CCTV AI Count

## Kredensial Default

| Field    | Value          |
|----------|----------------|
| Username | `admin`        |
| Password | `citranetbd9`  |
| Role     | SUPER_ADMIN    |

User kedua tersedia dengan credentials yang sama (lihat migration `012_create_users_table.sql`).

---

## Opsi 1 — Login lewat UI (Production Mode)

Ubah `NODE_ENV` di `backend/.env`:

```env
NODE_ENV=production
```

Restart backend, lalu buka frontend dan login dengan kredensial di atas.

---

## Opsi 2 — Dev Mode Tanpa Login (Setup Saat Ini)

`backend/.env` sudah set `NODE_ENV=development` — semua endpoint otomatis memakai mock user:

| Field    | Value          |
|----------|----------------|
| id       | `dev-user-001` |
| username | `devuser`      |
| role     | `ADMIN`        |

Buka frontend langsung tanpa perlu login. Semua fitur bisa diakses.

---

## Opsi 3 — Dapat JWT Token (Test API Manual)

### Langkah 1 — Login dan ambil token

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"citranetbd9"}'
```

Response:
```json
{
  "success": true,
  "token": "eyJ...",
  "user": { "id": "admin_001", "role": "SUPER_ADMIN" }
}
```

### Langkah 2 — Gunakan token di request selanjutnya

```bash
curl http://localhost:3001/api/counting/summary \
  -H "Authorization: Bearer eyJ..."
```

### Langkah 3 — Token untuk Python Worker

Salin token ke `worker/.env`:

```env
BACKEND_TOKEN=eyJ...
```

---

## Endpoint Utama untuk QA

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/auth/login` | POST | Login, dapat token |
| `/api/auth/me` | GET | Info user saat ini |
| `/api/counting/summary` | GET | Rekap crossing per kamera |
| `/api/counting/cameras/:id/count` | GET | Count in/out satu kamera |
| `/api/counting/event` | POST | Kirim event crossing (simulasi worker) |
| `/api/visits/duration-summary` | GET | Rata-rata durasi per kamera |
| `/api/visits/cameras/:id` | GET | List kunjungan satu kamera |
| `/api/reports/daily-summary` | GET | AI summary harian |
| `/api/reports/export/csv` | GET | Export CSV crossing + kunjungan |

### Query parameter umum

```
?date=2026-06-18        # filter tanggal (YYYY-MM-DD)
?status=open            # filter status kunjungan (open/closed)
```

---

## Simulasi Event dari Worker (Tanpa Python)

Kirim event crossing manual untuk test dashboard counting:

```bash
curl -X POST http://localhost:3001/api/counting/event \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "C240-01",
    "direction": "in",
    "crossed_at": "2026-06-18T08:00:00.000Z"
  }'
```

Kirim event kunjungan:

```bash
curl -X POST http://localhost:3001/api/visits \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "C240-01",
    "person_uid": "track_42",
    "entry_time": "2026-06-18T08:00:00.000Z",
    "exit_time": "2026-06-18T08:03:30.000Z",
    "confidence": 0.87,
    "match_method": "bytetrack"
  }'
```

---

## URL Frontend & Backend

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5174 |
| Backend API | http://localhost:3001/api |
| WebSocket | ws://localhost:3002 |

---

## Catatan

- Dev mode (`NODE_ENV=development`): token tidak wajib, role check lebih permisif.
- Production mode (`NODE_ENV=production`): token JWT wajib di semua endpoint yang dilindungi `verifyToken`.
- Token JWT tidak memiliki masa berlaku yang dikonfigurasi secara eksplisit — periksa `JWT_SECRET` di `backend/.env` jika token ditolak.
