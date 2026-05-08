# Fitur: Users

**Path:** `src/features/users/`

Admin interface untuk manajemen user: CRUD, ganti role, dan unlock akun terkunci.

---

## Tujuan

Memberi `ADMIN` & `SUPER_ADMIN` UI untuk mengelola user account: buat user baru, edit, soft-delete, ganti role (SUPER_ADMIN only), dan unlock akun yang kelock 5x login gagal.

---

## Komponen

### `UsersPage.jsx`

Page utama. Berisi:

- **Header** — total user count + tombol "Tambah User".
- **Filter** — dropdown `role` & `account_status`. Setiap perubahan invalidate `['users']`.
- **Tabel user** — kolom: name, username, email, role, status, last_login, actions.
- **Action per row** (kondisional):
  - Edit (selalu)
  - Delete (selalu, kecuali current user)
  - Unlock (hanya jika `account_status === 'LOCKED'`)
- **Highlight self** — row current user dapat class `rowSelf`.

### UserFormModal (di-mount inline di `UsersPage.jsx`)

Form create/edit reusable:

- Field: `username` (create-only), `name`, `email`, `password` (create-only), `role`, `team_member_id`.
- `role` dropdown disabled untuk non-`SUPER_ADMIN` saat edit mode.
- Submit:
  - Create → `usersApi.create(body)`
  - Edit → `usersApi.update(id, body)` + (kalau SUPER_ADMIN dan role berubah) panggil `usersApi.changeRole(id, role)` terpisah.

---

## API & Hook

| API | Endpoint | Konsumer |
|---|---|---|
| `usersApi.list(params)` | `GET /api/users` | List + filter |
| `usersApi.create(body)` | `POST /api/users` | Form create |
| `usersApi.update(id, body)` | `PUT /api/users/:id` | Form edit |
| `usersApi.delete(id)` | `DELETE /api/users/:id` | Action delete (soft delete) |
| `usersApi.changeRole(id, role)` | `PATCH /api/users/:id/role` | Form edit (SUPER_ADMIN only) |
| `usersApi.unlock(id)` | `POST /api/users/:id/unlock` | Action unlock |

Sumber: `src/api/users.api.js`. Spec lengkap di [`AUTH_API.md`](../../AUTH_API.md).

React Query: `useQuery(['users', filters])`, `useMutation` untuk semua aksi.

---

## State / Store

- **`useAuthStore`** — `user.id` (highlight self), `role` (gating SUPER_ADMIN-only actions).
- **Component state** — `filters: { role, account_status }`, `modal: 'create' | 'edit' | null`, `editingUser`.

---

## Props

| Komponen | Props |
|---|---|
| `UsersPage` | — |
| UserFormModal (inline) | `user?: User` (edit mode), `onClose: () => void`, `isSuperAdmin: boolean` |

---

## Role & Permission Gating

Sumber kebenaran ada di backend (lihat [`AUTH_API.md`](../../AUTH_API.md) §"Role & Permission"). Frontend hanya gate UI:

| Aksi | UI Gate |
|---|---|
| Tambah user | Visible untuk `ADMIN` & `SUPER_ADMIN` |
| Edit user | Visible untuk `ADMIN` & `SUPER_ADMIN` |
| Delete user | Visible untuk `SUPER_ADMIN` |
| Ganti role | Visible untuk `SUPER_ADMIN` |
| Unlock | Visible untuk `ADMIN` & `SUPER_ADMIN` |

Selain itu backend tetap akan reject 403 — frontend gate hanya untuk UX.

---

## Catatan Integrasi

- **Delete = soft delete:** akun di-set `INACTIVE`, tidak benar-benar dihapus. Setelah delete, user tetap muncul di list jika filter `account_status` tidak di-set.
- **Unlock alur:** akun ter-locked otomatis setelah 5 percobaan login gagal. Tombol unlock akan kena 400 jika status bukan `LOCKED` (lihat [`AUTH_API.md`](../../AUTH_API.md) §13).
- **Confirm delete** pakai `window.confirm()` — pertimbangkan ganti dengan custom modal untuk UX konsisten.
- **Format last_login** pakai `toLocaleString('id-ID')`.
- **Filter cache:** setiap perubahan filter membentuk query key baru, sehingga React Query refetch otomatis tanpa explicit `invalidateQueries()`.
- **Invalidate setelah mutation:** semua mutation panggil `qc.invalidateQueries(['users'])` di `onSuccess`.

---

## Lihat Juga

- [`AUTH_API.md`](../../AUTH_API.md) — Spesifikasi endpoint user management lengkap
- [Auth](./auth.md) — Login & ganti password (terkait dengan account lock)
