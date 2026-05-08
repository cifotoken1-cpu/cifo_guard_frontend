import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/auth.api';
import styles from './ChangePasswordModal.module.css';

export function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      }),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(onClose, 1500);
    },
    onError: (err) => {
      setError(err.message || 'Gagal mengganti password');
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.current_password || !form.new_password || !form.confirm_password) {
      setError('Semua field wajib diisi');
      return;
    }
    if (form.new_password.length < 8) {
      setError('Password baru minimal 8 karakter');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError('Konfirmasi password tidak cocok');
      return;
    }
    mutation.mutate();
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Ganti Password</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className={styles.successMsg}>Password berhasil diubah!</div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <Field
              label="Password Lama"
              type="password"
              value={form.current_password}
              onChange={(v) => setForm({ ...form, current_password: v })}
              disabled={mutation.isPending}
              autoComplete="current-password"
            />
            <Field
              label="Password Baru"
              type="password"
              value={form.new_password}
              onChange={(v) => setForm({ ...form, new_password: v })}
              disabled={mutation.isPending}
              autoComplete="new-password"
              hint="Minimal 8 karakter"
            />
            <Field
              label="Konfirmasi Password Baru"
              type="password"
              value={form.confirm_password}
              onChange={(v) => setForm({ ...form, confirm_password: v })}
              disabled={mutation.isPending}
              autoComplete="new-password"
            />

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSec}`}
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, disabled, autoComplete, hint }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input
        className={styles.input}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
