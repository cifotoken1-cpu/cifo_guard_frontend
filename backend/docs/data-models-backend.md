# Model Data & Skema Database — CIFO Security System Backend

> Dokumen ini dihasilkan dari pemindaian codebase pada 2026-04-30.
> Database: MySQL, ORM: Sequelize 6.x, Charset: utf8mb4

---

## Konfigurasi Database

| Parameter | Nilai Default | Env Variable |
|-----------|--------------|-------------|
| Host | localhost | `DB_HOST` |
| Port | 3306 | `DB_PORT` |
| Database | cifo_security | `DB_NAME` |
| User | root | `DB_USER` |
| Password | _(kosong)_ | `DB_PASSWORD` |
| Connection Pool Max | 10 | — |
| Timestamps | true (otomatis) | — |
| Charset | utf8mb4 | — |

---

## Daftar Model & Tabel

### 1. Camera (`cameras`)

File: `models/Camera.js` | Migrasi: `001_create_cameras_table.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK, auto increment) | Identifier unik |
| name | VARCHAR | Nama kamera |
| location | VARCHAR | Lokasi fisik |
| ip_address | VARCHAR | Alamat IP kamera |
| status | ENUM | online/offline/degraded/error |
| area_id | INT/VARCHAR | Referensi area |
| stream_url | VARCHAR | URL stream HLS (.m3u8) |
| last_heartbeat | DATETIME | Heartbeat terakhir |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |

---

### 2. CameraHealthLog (`camera_health_logs`)

File: `models/CameraHealthLog.js` | Migrasi: `001_create_cameras_table.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| camera_id | INT (FK → cameras) | Referensi kamera |
| status | ENUM | Status kesehatan |
| response_time | INT | Waktu respons (ms) |
| error_message | TEXT | Pesan error (nullable) |
| cpu_usage | FLOAT | Penggunaan CPU (%) |
| memory_usage | FLOAT | Penggunaan memori (%) |
| disk_usage | FLOAT | Penggunaan disk (%) |
| timestamp | DATETIME | Waktu pencatatan |

---

### 3. TeamMember (`team_members`)

File: `models/TeamMember.js` | Migrasi: `002_create_team_members_table.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| name | VARCHAR | Nama lengkap |
| role | VARCHAR | Role (Security Guard, Supervisor, dll.) |
| shift | VARCHAR | Shift kerja |
| phone | VARCHAR | Nomor telepon |
| email | VARCHAR | Alamat email |
| duty_status | ENUM | ON_DUTY/OFF_DUTY/PATROLLING/BREAK |
| current_location | VARCHAR/JSON | Lokasi saat ini |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |

---

### 4. TeamLocationHistory (`team_location_history`)

File: `models/TeamLocationHistory.js` | Migrasi: `002_create_team_members_table.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| member_id | INT (FK → team_members) | Referensi anggota |
| latitude | DECIMAL | Koordinat lintang |
| longitude | DECIMAL | Koordinat bujur |
| area_id | VARCHAR | Area lokasi |
| activity_type | VARCHAR | Tipe aktivitas saat itu |
| timestamp | DATETIME | Waktu pencatatan lokasi |

---

### 5. SecurityActivity (`security_activities`)

File: `models/SecurityActivity.js` | Migrasi: `003_create_activities_table.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| type | VARCHAR | Tipe aktivitas |
| severity | ENUM | INFO/WARNING/ERROR/CRITICAL |
| description | TEXT | Deskripsi aktivitas |
| actor_id | VARCHAR | ID aktor |
| actor_type | VARCHAR | Tipe aktor (USER/SYSTEM/CAMERA) |
| reference_id | VARCHAR | ID referensi (alert, incident, dll.) |
| reference_type | VARCHAR | Tipe referensi (ALERT/INCIDENT/SYSTEM) |
| timestamp | DATETIME | Waktu aktivitas |
| ip_address | VARCHAR | IP address aktor |
| metadata | JSON | Data tambahan |

---

### 6. Perumahan (`perumahan_info`)

File: `models/Perumahan.js` | Migrasi: `004_create_perumahan_tables.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| name | VARCHAR | Nama perumahan |
| address | TEXT | Alamat lengkap |
| total_units | INT | Total unit hunian |
| occupied_units | INT | Unit yang dihuni |
| contact_person | VARCHAR | Narahubung |
| phone | VARCHAR | Nomor telepon |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |

*(Juga tabel: `perumahan_facilities` — fasilitas perumahan)*

---

### 7. Geofence (`geofences`)

File: `models/Geofence.js` | Migrasi: `005_create_geofence_tables.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| name | VARCHAR | Nama geofence |
| type | ENUM | circle/polygon/rectangle |
| coordinates | JSON | Koordinat batas geofence |
| rules | JSON | Aturan trigger (masuk/keluar) |
| alerts_enabled | BOOLEAN | Aktifkan alert |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |

### 8. GeofenceBreach (`geofence_breaches`)

File: `models/GeofenceBreach.js` | Migrasi: `005_create_geofence_tables.sql`

Pencatatan pelanggaran geofence (siapa, kapan, di mana).

---

### 9. MapPin (`map_pins`)

File: `models/MapPin.js` | Migrasi: `006_create_map_pin_table.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| type | VARCHAR | Tipe pin (CAMERA, ALERT, INCIDENT, dll.) |
| coordinates | JSON | `{ lat, lng }` |
| metadata | JSON | Data kontekstual tambahan |
| alert_id | INT (FK, nullable) | Referensi alert |
| incident_id | INT (FK, nullable) | Referensi insiden |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |

---

### 10. BasemapConfig (`basemap_configs`)

File: `models/BasemapConfig.js` | Migrasi: `007_create_basemap_config_table.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| name | VARCHAR | Nama konfigurasi |
| svg_data | LONGTEXT | Data SVG basemap |
| calibration | JSON | Data kalibrasi koordinat |
| is_active | BOOLEAN | Basemap aktif |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |

---

### 11. FeatureFlag (`feature_flags`)

File: `models/FeatureFlag.js` | Migrasi: `008_create_feature_flag_table.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| key | VARCHAR (UNIQUE) | Kunci unik feature flag |
| value | BOOLEAN/JSON | Nilai flag |
| description | TEXT | Deskripsi fitur |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |

---

### 12. Incident (`incidents`)

File: `models/Incident.js` | Migrasi: `009_create_incident_tables.sql`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| title | VARCHAR | Judul insiden |
| description | TEXT | Deskripsi insiden |
| type | ENUM | Tipe insiden (lihat API contracts) |
| status | ENUM | OPEN/IN_PROGRESS/RESOLVED/CLOSED/CANCELLED |
| priority | ENUM | LOW/MEDIUM/HIGH/CRITICAL |
| created_by | VARCHAR | ID pembuat |
| assigned_to | VARCHAR (nullable) | ID yang ditugaskan |
| location | JSON | Koordinat lokasi insiden |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |
| resolved_at | DATETIME (nullable) | Waktu penyelesaian |

---

### 13. Alert (`alerts`)

File: `models/Alert.js` | Migrasi: `010_create_alert_tables.sql`
*(dengan kolom AI tambahan: `20260428_120000_add_ai_columns_to_alerts.sql`)*

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| type | ENUM | MEDICAL/CRIME/FIRE/OTHER/PANIC |
| status | ENUM | ACTIVE/RESOLVED/CANCELLED/IN_PROGRESS |
| priority | ENUM | LOW/MEDIUM/HIGH/CRITICAL |
| user_id | VARCHAR | ID pengguna yang membuat alert |
| request_id | VARCHAR | ID request unik (idempotency) |
| gps | JSON | `{ latitude, longitude, accuracy }` |
| location | JSON | Lokasi terstruktur |
| description | TEXT | Deskripsi alert |
| ai_analysis | JSON | Hasil analisis AI (OpenAI) _(ditambahkan 2026-04-28)_ |
| ai_confidence | FLOAT | Skor kepercayaan AI _(ditambahkan 2026-04-28)_ |
| ai_processed_at | DATETIME | Waktu proses AI _(ditambahkan 2026-04-28)_ |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |

### 14. AlertRecipient (`alert_recipients`)

File: `models/AlertRecipient.js` | Migrasi: `010_create_alert_tables.sql`

Penerima notifikasi alert (many-to-many dengan alerts).

---

### 15. QRCode (`qr_codes`)

File: `models/QRCode.js`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| code | VARCHAR (UNIQUE) | Kode QR unik |
| type | VARCHAR | Tipe QR (VISITOR, CAMERA, dll.) |
| reference_id | VARCHAR | ID referensi |
| is_active | BOOLEAN | Status aktif |
| expires_at | DATETIME (nullable) | Waktu kedaluwarsa |
| created_at | DATETIME | Timestamp dibuat |

---

### 16. VisitorRegistration (`visitor_registrations`)

File: `models/VisitorRegistration.js` | Migrasi: `20250127-create-visitor-system.js`
*(Update enum: `20250127-update-visitor-status-enum.js`)*

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT (PK) | Identifier unik |
| name | VARCHAR | Nama pengunjung |
| id_number | VARCHAR | Nomor KTP |
| id_photo | VARCHAR | Path foto KTP (OCR Tesseract.js) |
| purpose | TEXT | Tujuan kunjungan |
| host_name | VARCHAR | Nama tuan rumah |
| status | ENUM | PENDING/APPROVED/REJECTED/CHECKED_OUT |
| check_in_time | DATETIME | Waktu masuk |
| check_out_time | DATETIME (nullable) | Waktu keluar |
| created_at | DATETIME | Timestamp dibuat |
| updated_at | DATETIME | Timestamp diperbarui |

---

## Relasi Antar Tabel

```
cameras ──< camera_health_logs
team_members ──< team_location_history
security_activities (referensi polimorfik ke alerts/incidents/systems)
alerts ──< alert_recipients
alerts ──> map_pins (nullable FK)
incidents ──> map_pins (nullable FK)
geofences ──< geofence_breaches
perumahan_info ──< perumahan_facilities
```

---

## Migrasi

| File | Deskripsi |
|------|-----------|
| `001_create_cameras_table.sql` | Tabel cameras & camera_health_logs |
| `002_create_team_members_table.sql` | Tabel team_members & location_history |
| `003_create_activities_table.sql` | Tabel security_activities |
| `004_create_perumahan_tables.sql` | Tabel perumahan_info & fasilitas |
| `005_create_geofence_tables.sql` | Tabel geofences & breaches |
| `006_create_map_pin_table.sql` | Tabel map_pins |
| `007_create_basemap_config_table.sql` | Tabel basemap_configs |
| `008_create_feature_flag_table.sql` | Tabel feature_flags |
| `009_create_incident_tables.sql` | Tabel incidents |
| `010_create_alert_tables.sql` | Tabel alerts & recipients |
| `20250127-create-visitor-system.js` | Tabel visitor_registrations (Sequelize migration) |
| `20250127-update-visitor-status-enum.js` | Update enum status visitor |
| `20260428_120000_add_ai_columns_to_alerts.sql` | Tambah kolom AI ke alerts |

Menjalankan migrasi:
```bash
npm run migrate
# atau: node scripts/migrate.js
```
