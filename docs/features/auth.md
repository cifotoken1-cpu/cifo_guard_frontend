# Fitur: Auth

**Path:** `src/features/auth/`

Fitur autentikasi: login, logout, dan ganti password.

---

## Tujuan

Menangani siklus hidup sesi pengguna — dari halaman login publik hingga ganti password dari dalam aplikasi.

---

## Komponen

### `LoginPage.jsx`

Halaman login publik dengan form `username` + `password`.

- Validasi field non-kosong di sisi client.
- Memanggil `authApi.login()` lewat `useMutation`.
- Setelah sukses: simpan `token` & `user` ke `useAuthStore`, lalu `navigate('/security')`.
- Khusus error `code: 'ACCOUNT_LOCKED'` → tampilkan pesan kontak admin (akun terkunci setelah 5x gagal — lihat [`AUTH_API.md`](../../AUTH_API.md)).

### `ChangePasswordModal.jsx`

Modal yang dipanggil dari Sidebar untuk ganti password sendiri.

- Field `current_password`, `new_password`, `confirm_password`.
- Validasi: password baru min 8 karakter, `new === confirm`.
- Memanggil `authApi.changePassword()`.
- Tampilkan success message singkat sebelum `onClose()` dipanggil.

---

## API & Hook

| API | Endpoint | Konsumer |
|---|---|---|
| `authApi.login(credentials)` | `POST /auth/login` | `LoginPage` |
| `authApi.changePassword(body)` | `PUT /auth/change-password` | `ChangePasswordModal` |
| `authApi.logout()` | `POST /auth/logout` | (dipanggil dari Sidebar) |
| `authApi.me()` | `GET /auth/me` | (rehydrate session) |

Sumber: `src/api/auth.api.js`.

---

## State / Store

- **`useAuthStore`** — `token`, `user`, `role`, action `login()` / `logout()` / `setUser()`. Persisted ke `localStorage` key `cifo-auth`.

---

## Props

| Komponen | Props |
|---|---|
| `LoginPage` | — (route component) |
| `ChangePasswordModal` | `onClose: () => void` |

---

## Catatan Integrasi

- Token JWT di-attach otomatis ke setiap request via Axios interceptor (`src/api/client.js`).
- Setelah `logout()`, store di-clear; `App.jsx` me-redirect ke `/login`.
- Error format dari backend dinormalisasi oleh `client.js` — komponen hanya perlu read `err.message` dan `err.code`.
- Error code yang perlu di-handle khusus:
  - `ACCOUNT_LOCKED` (403) — akun terkunci
  - `INVALID_RESET_TOKEN` (400) — token reset expired/salah

---

## Lihat Juga

- [`AUTH_API.md`](../../AUTH_API.md) — Spesifikasi endpoint lengkap
