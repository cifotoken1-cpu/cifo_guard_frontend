import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { I } from '../../icons';
import { useClock } from '../../hooks/useClock';
import { useSystemStore } from '../../store/system.store';
import { useAuthStore } from '../../store/auth.store';
import { useAlertStats } from '../../hooks/useAlertsStream';
import { useMetrics } from '../../hooks/useSystemHealth';
import { usePanicAlerts } from '../../hooks/usePanicAlerts';
import { useIncidents } from '../../hooks/useIncidents';
import { authApi } from '../../api/auth.api';
import { pad, formatDate } from '../../utils/format';
import { SidebarPanelsControl } from './SidebarPanelsControl';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const time = useClock();
  const navigate = useNavigate();
  const activeNav = useSystemStore((s) => s.activeNav);
  const setActiveNav = useSystemStore((s) => s.setActiveNav);
  const sidebarCollapsed = useSystemStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useSystemStore((s) => s.setSidebarCollapsed);

  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);

  const [showChangePw, setShowChangePw] = useState(false);

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const { data: alertStats } = useAlertStats();
  const { data: metrics } = useMetrics();
  const { data: panicData } = usePanicAlerts({ status: 'ACTIVE', limit: 1 });
  const { data: incidentsData } = useIncidents({ status: 'OPEN', limit: 1 });

  const alertCount = alertStats?.active ?? 0;
  const activePanicCount = panicData?.count ?? panicData?.total ?? 0;
  const openIncidentCount = incidentsData?.count ?? incidentsData?.total ?? 0;

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      logout();
      navigate('/login', { replace: true });
    },
  });

  const navItems = [
    { id: 'security', label: 'Security', icon: I.shield, badge: alertCount },
    { id: 'media', label: 'Media', icon: I.media, badge: 0 },
    { id: 'panic', label: 'Panic', icon: I.panicBell, badge: activePanicCount },
    { id: 'incidents', label: 'Insiden', icon: I.incident, badge: openIncidentCount },
    { id: 'map', label: 'Peta', icon: I.map, badge: 0 },
    ...(isAdmin ? [{ id: 'users', label: 'Users', icon: I.users, badge: 0 }] : []),
  ];

  const cpu = metrics?.cpu ?? 28;
  const mem = metrics?.memory ?? 43;
  const storage = metrics?.storage ?? 71;
  const temp = metrics?.temperature ?? 34;

  const userInitials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}>
      <button
        className={styles.collapseBtn}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span style={{ width: 16, height: 16 }}>
          {sidebarCollapsed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </span>
      </button>

      <div className={styles.clockBlock}>
        <div className={styles.clockTime}>
          {pad(time.getHours())}:{pad(time.getMinutes())}
          <span className={styles.clockSecs}>{pad(time.getSeconds())}</span>
        </div>
        {!sidebarCollapsed && <div className={styles.clockDate}>{formatDate(time)}</div>}
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`${styles.navItem} ${activeNav === item.id ? styles.navActive : ''}`}
            onClick={() => setActiveNav(item.id)}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!sidebarCollapsed && item.label}
            {!sidebarCollapsed && item.badge > 0 && <span className={styles.navBadge}>{item.badge}</span>}
            {sidebarCollapsed && item.badge > 0 && <span className={styles.navBadgeDot} />}
          </div>
        ))}
      </nav>

      <div className={styles.divider} />

      {!sidebarCollapsed && <SidebarPanelsControl />}

      {!sidebarCollapsed && (
        <div className={styles.healthBlock}>
          <div className="section-label" style={{ marginBottom: 8 }}>
            System Health
          </div>
          <div className={styles.health}>
            <HealthBar label="CPU" pct={cpu} />
            <HealthBar label="Memory" pct={mem} />
            <HealthBar label="Storage" pct={storage} tone={storage > 70 ? 'warn' : 'ok'} />
            <div className={styles.row}>
              <span className={styles.label}>Network</span>
              <div className={styles.signalWrap}>
                <SignalBars lit={4} />
              </div>
              <span className={styles.val} style={{ color: 'var(--green)' }}>
                Excellent
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>
                <span style={{ width: 12, height: 12, display: 'inline-flex' }}>
                  {I.thermometer}
                </span>
                Temp
              </span>
              <div className={styles.bar}>
                <div className={`${styles.barFill} ${styles.fillOk}`} style={{ width: '35%' }} />
              </div>
              <span className={styles.val}>{temp}°C</span>
            </div>
          </div>
        </div>
      )}

      {/* User info block */}
      {!sidebarCollapsed && (
        <div className={styles.userBlock}>
          <div className={styles.userRow}>
            <div className={styles.userAvatar}>{userInitials}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.name || user?.username || '—'}</div>
              <div className={styles.userRole}>{role}</div>
            </div>
          </div>
          <div className={styles.userActions}>
            <button
              className={styles.userActionBtn}
              onClick={() => setShowChangePw(true)}
              title="Ganti password"
            >
              Ganti Password
            </button>
            <button
              className={`${styles.userActionBtn} ${styles.userActionLogout}`}
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              title="Logout"
            >
              <span style={{ width: 12, height: 12, display: 'inline-flex' }}>{I.logOut}</span>
              {logoutMutation.isPending ? '…' : 'Logout'}
            </button>
          </div>
        </div>
      )}

      {sidebarCollapsed && (
        <div className={styles.footer}>
          <button className={styles.footerBtn} title="Monitor">
            <span style={{ width: 14, height: 14 }}>{I.monitor}</span>
          </button>
          <button className={styles.footerBtn} title="Refresh" onClick={() => location.reload()}>
            <span style={{ width: 14, height: 14 }}>{I.refresh}</span>
          </button>
          <button
            className={styles.footerBtn}
            title="Logout"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <span style={{ width: 14, height: 14 }}>{I.logOut}</span>
          </button>
          <button className={styles.footerBtn} title="Settings">
            <span style={{ width: 14, height: 14 }}>{I.settings}</span>
          </button>
        </div>
      )}

      {!sidebarCollapsed && (
        <div className={styles.footerCompact}>
          <button className={styles.footerBtn} title="Monitor">
            <span style={{ width: 14, height: 14 }}>{I.monitor}</span>
          </button>
          <button className={styles.footerBtn} title="Refresh" onClick={() => location.reload()}>
            <span style={{ width: 14, height: 14 }}>{I.refresh}</span>
          </button>
          <button className={styles.footerBtn} title="WiFi">
            <span style={{ width: 14, height: 14 }}>{I.wifi}</span>
          </button>
          <button className={styles.footerBtn} title="Settings">
            <span style={{ width: 14, height: 14 }}>{I.settings}</span>
          </button>
        </div>
      )}

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </aside>
  );
}

function HealthBar({ label, pct, tone = 'ok' }) {
  const cls = pct > 85 ? 'fillBad' : tone === 'warn' || pct > 70 ? 'fillWarn' : 'fillOk';
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.bar}>
        <div className={`${styles.barFill} ${styles[cls]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.val}>{pct}%</span>
    </div>
  );
}

function SignalBars({ lit = 4 }) {
  return (
    <div className={styles.signalBars}>
      {[4, 7, 10, 13, 16].map((h, i) => (
        <div
          key={i}
          className={`${styles.sigBar} ${i < lit ? styles.sigLit : ''}`}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}
