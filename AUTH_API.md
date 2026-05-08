# Auth & User Management API

Base URL: `http://localhost:3001/api`

---

## Authentication

Semua endpoint yang membutuhkan autentikasi harus menyertakan header:

```
Authorization: Bearer <token>
```

Token didapat dari endpoint `/auth/login`.

---

## Auth Endpoints

### 1. Login
**POST** `/api/auth/login`

Request:
```json
{
  "username": "admin",
  "password": "password123"
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "admin_001",
      "username": "admin",
      "email": "admin@cifo.com",
      "name": "Administrator",
      "role": "SUPER_ADMIN",
      "account_status": "ACTIVE",
      "last_login_at": "2026-05-05T11:29:53.000Z"
    }
  },
  "timestamp": 1777980605637
}
```

Response (401 - Username/password salah):
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

Response (403 - Akun terkunci):
```json
{
  "success": false,
  "error": "Account is locked. Contact administrator.",
  "code": "ACCOUNT_LOCKED"
}
```

> ⚠️ Akun otomatis terkunci setelah **5 kali login gagal**. Hubungi admin untuk unlock.

---

### 2. Logout
**POST** `/api/auth/logout`

Header: `Authorization: Bearer <token>` *(required)*

Response (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully",
  "timestamp": 1777980639029
}
```

---

### 3. Get Current User
**GET** `/api/auth/me`

Header: `Authorization: Bearer <token>` *(required)*

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "admin_001",
    "team_member_id": null,
    "username": "admin",
    "email": "admin@cifo.com",
    "name": "Administrator",
    "role": "SUPER_ADMIN",
    "account_status": "ACTIVE",
    "failed_login_attempts": 0,
    "last_login_at": "2026-05-05T11:30:05.000Z",
    "created_by": null,
    "created_at": "2026-05-05T11:28:37.000Z",
    "updated_at": "2026-05-05T11:28:37.000Z"
  },
  "timestamp": 1777980605637
}
```

---

### 4. Ganti Password (Self)
**PUT** `/api/auth/change-password`

Header: `Authorization: Bearer <token>` *(required)*

Request:
```json
{
  "current_password": "passwordlama",
  "new_password": "passwordbaru123"
}
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully",
  "timestamp": 1777980605637
}
```

Response (401 - Password lama salah):
```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

> Password minimal **8 karakter**.

---

### 5. Request Reset Password
**POST** `/api/auth/reset-password`

Digunakan untuk reset password user yang lupa password (admin-driven, token dikembalikan langsung di response).

Request:
```json
{
  "email": "user@cifo.com"
}
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Password reset token generated",
  "data": {
    "reset_token": "e2853e60d77390d8838c2af908c150874d3983c570ad9c1375ab6d189b134303",
    "expires_in": "1 hour",
    "user_id": "admin_001",
    "username": "admin"
  },
  "timestamp": 1777980614380
}
```

> Token berlaku **1 jam**. Gunakan token ini untuk konfirmasi reset password.

---

### 6. Konfirmasi Reset Password
**POST** `/api/auth/reset-password/confirm`

Request:
```json
{
  "token": "e2853e60d77390d8838c2af908c150874d3983c570ad9c1375ab6d189b134303",
  "new_password": "passwordbaru123"
}
```

Response (200 OK):
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now login with your new password.",
  "timestamp": 1777980622780
}
```

Response (400 - Token tidak valid/expired):
```json
{
  "success": false,
  "error": "Invalid or expired reset token",
  "code": "INVALID_RESET_TOKEN"
}
```

---

## User Management Endpoints

> Semua endpoint di bawah membutuhkan role **ADMIN** atau **SUPER_ADMIN**, kecuali yang disebutkan khusus.

---

### 7. Buat User Baru
**POST** `/api/users`

Header: `Authorization: Bearer <token>` *(ADMIN / SUPER_ADMIN)*

Request:
```json
{
  "username": "guard01",
  "email": "guard01@cifo.com",
  "name": "Penjaga Satu",
  "password": "password123",
  "role": "GUARD",
  "team_member_id": null
}
```

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| `username` | string | ✅ | Harus unik |
| `email` | string | ✅ | Harus unik |
| `name` | string | ✅ | Nama lengkap |
| `password` | string | ✅ | Min 8 karakter |
| `role` | string | ❌ | Default: `GUARD` |
| `team_member_id` | string | ❌ | Link ke team_members |

Response (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "user_1777980632489",
    "username": "guard01",
    "email": "guard01@cifo.com",
    "name": "Penjaga Satu",
    "role": "GUARD",
    "account_status": "ACTIVE",
    "created_by": "admin_001",
    "created_at": "2026-05-05T11:30:32.000Z"
  },
  "message": "User guard01 created successfully",
  "timestamp": 1777980632489
}
```

Response (409 - Username sudah ada):
```json
{
  "success": false,
  "error": "Username already exists"
}
```

---

### 8. Daftar Semua User
**GET** `/api/users`

Header: `Authorization: Bearer <token>` *(ADMIN / SUPER_ADMIN)*

Query Parameters:
| Param | Keterangan | Contoh |
|-------|------------|--------|
| `role` | Filter by role | `?role=GUARD` |
| `account_status` | Filter by status | `?account_status=ACTIVE` |
| `limit` | Jumlah data per halaman | `?limit=20` (default: 50) |
| `offset` | Skip N data | `?offset=0` |

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "admin_001",
        "username": "admin",
        "email": "admin@cifo.com",
        "name": "Administrator",
        "role": "SUPER_ADMIN",
        "account_status": "ACTIVE",
        "last_login_at": "2026-05-05T11:30:05.000Z",
        "created_at": "2026-05-05T11:28:37.000Z"
      }
    ],
    "total": 3,
    "filters": {
      "role": null,
      "account_status": null
    },
    "pagination": {
      "limit": 50,
      "offset": 0
    }
  },
  "timestamp": 1777980605637
}
```

---

### 9. Detail User
**GET** `/api/users/:id`

Header: `Authorization: Bearer <token>` *(ADMIN / SUPER_ADMIN)*

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "guard01",
    "username": "guard01",
    "email": "guard01@cifo.com",
    "name": "Penjaga Satu",
    "role": "GUARD",
    "account_status": "ACTIVE",
    "failed_login_attempts": 0,
    "last_login_at": null,
    "created_by": "admin_001",
    "created_at": "2026-05-05T11:30:32.000Z",
    "updated_at": "2026-05-05T11:30:32.000Z"
  },
  "timestamp": 1777980605637
}
```

Response (404):
```json
{
  "success": false,
  "error": "User not found"
}
```

---

### 10. Update User
**PUT** `/api/users/:id`

Header: `Authorization: Bearer <token>` *(ADMIN / SUPER_ADMIN)*

Request (semua field opsional):
```json
{
  "email": "newemail@cifo.com",
  "name": "Nama Baru",
  "role": "SUPERVISOR",
  "team_member_id": "guard_001"
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": { ... },
  "message": "User updated successfully",
  "timestamp": 1777980605637
}
```

---

### 11. Hapus User (Soft Delete)
**DELETE** `/api/users/:id`

Header: `Authorization: Bearer <token>` *(SUPER_ADMIN only)*

> User tidak benar-benar dihapus dari database, status diubah menjadi `INACTIVE`.

Response (200 OK):
```json
{
  "success": true,
  "message": "User guard01 deleted successfully",
  "timestamp": 1777980605637
}
```

---

### 12. Ganti Role User
**PATCH** `/api/users/:id/role`

Header: `Authorization: Bearer <token>` *(SUPER_ADMIN only)*

Request:
```json
{
  "role": "SUPERVISOR"
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": { ... },
  "message": "User role changed to SUPERVISOR",
  "timestamp": 1777980605637
}
```

---

### 13. Unlock Akun Terkunci
**POST** `/api/users/:id/unlock`

Header: `Authorization: Bearer <token>` *(ADMIN / SUPER_ADMIN)*

Response (200 OK):
```json
{
  "success": true,
  "data": { ... },
  "message": "User account unlocked successfully",
  "timestamp": 1777980605637
}
```

Response (400 - Akun tidak terkunci):
```json
{
  "success": false,
  "error": "User account is not locked",
  "current_status": "ACTIVE"
}
```

---

## Role & Permission

| Role | Keterangan |
|------|------------|
| `SUPER_ADMIN` | Akses penuh, bisa hapus user & ganti role |
| `ADMIN` | Bisa create/edit/unlock user |
| `SUPERVISOR` | Akses fitur supervisory |
| `GUARD` | Akses fitur lapangan |
| `VIEWER` | Akses baca saja |

---

## Status Akun

| Status | Keterangan |
|--------|------------|
| `ACTIVE` | Akun aktif, bisa login |
| `INACTIVE` | Akun dinonaktifkan oleh admin |
| `LOCKED` | Akun terkunci karena 5x login gagal |

---

## Default Accounts (Development)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | SUPER_ADMIN |
| `supervisor_lead` | `admin123` | ADMIN |

> ⚠️ Ganti password default sebelum production!

---

## Error Response Format

Semua error response menggunakan format:
```json
{
  "success": false,
  "error": "Pesan error singkat",
  "message": "Detail error (opsional)",
  "code": "ERROR_CODE (opsional)"
}
```

## HTTP Status Codes

| Code | Keterangan |
|------|------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (input tidak valid) |
| `401` | Unauthorized (token tidak valid/expired) |
| `403` | Forbidden (akun locked, atau role tidak cukup) |
| `404` | Not Found |
| `409` | Conflict (username/email sudah dipakai) |
| `500` | Internal Server Error |
