import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { I } from '../../icons';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => authApi.login(form),
    onSuccess: (data) => {
      const { token, user } = data.data;
      login({ token, user, role: user.role });
      navigate('/security', { replace: true });
    },
    onError: (err) => {
      const code = err.details?.code;
      if (code === 'ACCOUNT_LOCKED') {
        setError('Akun terkunci setelah 5x gagal. Hubungi administrator.');
      } else {
        setError(err.message || 'Username atau password salah');
      }
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.username.trim() || !form.password.trim()) {
      setError('Username dan password wajib diisi');
      return;
    }
    mutation.mutate();
  }

  return (
    <div className={styles.page}>
      <div className={styles.scanline} />

      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>{I.shield}</span>
          <div>
            <div className={styles.brandName}>CIFO GUARD</div>
            <div className={styles.brandSub}>Security Command Center</div>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <input
              className={styles.input}
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="Masukkan username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              disabled={mutation.isPending}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              placeholder="Masukkan password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              disabled={mutation.isPending}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            className={styles.btn}
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Memverifikasi…' : 'Login'}
          </button>
        </form>

        <div className={styles.footer}>
          CIFO Security System &nbsp;·&nbsp; Authorized Access Only
        </div>
      </div>
    </div>
  );
}
