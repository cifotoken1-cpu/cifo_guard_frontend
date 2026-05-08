import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users.api';
import { useAuthStore } from '../../store/auth.store';
import { I } from '../../icons';
import styles from './UsersPage.module.css';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'GUARD', 'VIEWER'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'LOCKED'];

const ROLE_BADGE = {
  SUPER_ADMIN: 'super',
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  GUARD: 'guard',
  VIEWER: 'viewer',
};

const STATUS_BADGE = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  LOCKED: 'locked',
};

export function UsersPage() {
  const currentRole = useAuthStore((s) => s.role);
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const [filters, setFilters] = useState({ role: '', account_status: '' });
  const [modal, setModal] = useState(null); // null | { type: 'create' } | { type: 'edit', user }

  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', filters],
    queryFn: () => {
      const params = {};
      if (filters.role) params.role = filters.role;
      if (filters.account_status) params.account_status = filters.account_status;
      return usersApi.list(params);
    },
  });

  const users = data?.data?.users ?? [];
  const total = data?.data?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const unlockMutation = useMutation({
    mutationFn: (id) => usersApi.unlock(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  function handleDelete(user) {
    if (!window.confirm(`Nonaktifkan user "${user.username}"?`)) return;
    deleteMutation.mutate(user.id);
  }

  function handleUnlock(user) {
    unlockMutation.mutate(user.id);
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className="section-label">Manajemen User</div>
          <div className={styles.sub}>Total {total} user terdaftar</div>
        </div>
        <button className={styles.btnCreate} onClick={() => setModal({ type: 'create' })}>
          + Tambah User
        </button>
      </div>

      <div className={styles.filters}>
        <select
          className={styles.select}
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value })}
        >
          <option value="">Semua Role</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          className={styles.select}
          value={filters.account_status}
          onChange={(e) => setFilters({ ...filters, account_status: e.target.value })}
        >
          <option value="">Semua Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading && <div className={styles.state}>Memuat data…</div>}
      {isError && <div className={styles.stateError}>Gagal memuat data user</div>}

      {!isLoading && !isError && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>Tidak ada user</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className={user.id === currentUser?.id ? styles.rowSelf : ''}>
                    <td className={styles.name}>{user.name}</td>
                    <td className={styles.mono}>{user.username}</td>
                    <td className={styles.email}>{user.email}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`role_${ROLE_BADGE[user.role]}`]}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[`status_${STATUS_BADGE[user.account_status]}`]}`}>
                        {user.account_status}
                      </span>
                    </td>
                    <td className={styles.dim}>
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setModal({ type: 'edit', user })}
                          title="Edit"
                        >
                          Edit
                        </button>
                        {user.account_status === 'LOCKED' && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionUnlock}`}
                            onClick={() => handleUnlock(user)}
                            disabled={unlockMutation.isPending}
                            title="Unlock akun"
                          >
                            Unlock
                          </button>
                        )}
                        {isSuperAdmin && user.id !== currentUser?.id && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionDel}`}
                            onClick={() => handleDelete(user)}
                            disabled={deleteMutation.isPending}
                            title="Nonaktifkan user"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'create' && (
        <UserFormModal
          onClose={() => setModal(null)}
          isSuperAdmin={isSuperAdmin}
        />
      )}
      {modal?.type === 'edit' && (
        <UserFormModal
          user={modal.user}
          onClose={() => setModal(null)}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </main>
  );
}

function UserFormModal({ user = null, onClose, isSuperAdmin }) {
  const qc = useQueryClient();
  const isEdit = !!user?.id;

  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    name: user?.name || '',
    password: '',
    role: user?.role || 'GUARD',
    team_member_id: user?.team_member_id || '',
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () => usersApi.create({
      username: form.username,
      email: form.email,
      name: form.name,
      password: form.password,
      role: form.role,
      team_member_id: form.team_member_id || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => setError(err.message || 'Gagal membuat user'),
  });

  const updateMutation = useMutation({
    mutationFn: () => usersApi.update(user.id, {
      email: form.email,
      name: form.name,
      ...(isSuperAdmin ? { role: form.role } : {}),
      team_member_id: form.team_member_id || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => setError(err.message || 'Gagal update user'),
  });

  const roleChangeMutation = useMutation({
    mutationFn: () => usersApi.changeRole(user.id, form.role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => setError(err.message || 'Gagal ganti role'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Nama dan email wajib diisi');
      return;
    }
    if (!isEdit) {
      if (!form.username.trim()) { setError('Username wajib diisi'); return; }
      if (form.password.length < 8) { setError('Password minimal 8 karakter'); return; }
      createMutation.mutate();
    } else {
      const roleChanged = isSuperAdmin && form.role !== user.role;
      if (roleChanged) {
        roleChangeMutation.mutate();
      }
      updateMutation.mutate();
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending || roleChangeMutation.isPending;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.formModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.formHeader}>
          <span>{isEdit ? 'Edit User' : 'Tambah User Baru'}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form className={styles.formGrid} onSubmit={handleSubmit}>
          {!isEdit && (
            <FormField label="Username *">
              <input
                className={styles.input}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={isPending}
                placeholder="guard01"
              />
            </FormField>
          )}

          <FormField label="Nama Lengkap *">
            <input
              className={styles.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={isPending}
              placeholder="Nama lengkap"
            />
          </FormField>

          <FormField label="Email *">
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={isPending}
              placeholder="user@cifo.com"
            />
          </FormField>

          {!isEdit && (
            <FormField label="Password * (min 8 karakter)">
              <input
                className={styles.input}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                disabled={isPending}
                autoComplete="new-password"
              />
            </FormField>
          )}

          {(isSuperAdmin || !isEdit) && (
            <FormField label="Role">
              <select
                className={styles.input}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                disabled={isPending || (!isSuperAdmin && isEdit)}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormField>
          )}

          <FormField label="Team Member ID (opsional)">
            <input
              className={styles.input}
              value={form.team_member_id}
              onChange={(e) => setForm({ ...form, team_member_id: e.target.value })}
              disabled={isPending}
              placeholder="guard_001"
            />
          </FormField>

          {error && <div className={`${styles.error} ${styles.fullWidth}`}>{error}</div>}

          <div className={`${styles.formActions} ${styles.fullWidth}`}>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={isPending}
            >
              {isPending ? 'Menyimpan…' : isEdit ? 'Update' : 'Buat User'}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSec}`}
              onClick={onClose}
              disabled={isPending}
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div className={styles.formField}>
      <label className={styles.formLabel}>{label}</label>
      {children}
    </div>
  );
}
