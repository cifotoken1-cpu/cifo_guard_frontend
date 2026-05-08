import { useUIStore } from '../../store/ui.store';
import { I } from '../../icons';
import styles from './SidebarPanelsControl.module.css';

export function SidebarPanelsControl() {
  const sectionVisibility = useUIStore((s) => s.sectionVisibility);
  const toggleSection = useUIStore((s) => s.toggleSection);
  const resetSectionVisibility = useUIStore((s) => s.resetSectionVisibility);

  const panels = [
    { id: 'overview', label: 'Overview' },
    { id: 'securityMode', label: 'Emergency' },
    { id: 'sensorStatus', label: 'Sensor Status' },
    { id: 'liveCameras', label: 'Live Cameras' },
    { id: 'activityLogPanel', label: 'Activity Log' },
  ];

  const hiddenCount = panels.filter((p) => !sectionVisibility[p.id]).length;

  return (
    <div className={styles.panelsControl}>
      <div className={styles.header}>
        <div className={styles.label}>
          <span style={{ width: 12, height: 12, display: 'inline-flex', marginRight: 6 }}>
            {I.settings}
          </span>
          Dashboard Panels
        </div>
        {hiddenCount > 0 && (
          <span className={styles.badge}>{hiddenCount} hidden</span>
        )}
      </div>

      <div className={styles.checkboxList}>
        {panels.map((panel) => (
          <label
            key={panel.id}
            className={styles.checkboxItem}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSection(panel.id);
              }
            }}
          >
            <input
              type="checkbox"
              checked={sectionVisibility[panel.id]}
              onChange={() => toggleSection(panel.id)}
              className={styles.checkbox}
              aria-label={`Toggle ${panel.label} panel visibility`}
              aria-pressed={sectionVisibility[panel.id]}
            />
            <span className={styles.eyeIcon}>
              {sectionVisibility[panel.id] ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 5c-4.5 0-8.5 2.5-10 6.5 1.5 4 5.5 6.5 10 6.5s8.5-2.5 10-6.5-5.5-6.5-10-6.5m0 11c-2.5 0-4.5-2-4.5-4.5S9.5 7 12 7s4.5 2 4.5 4.5-2 4.5-4.5 4.5m0-7c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 7c2.5 0 4.5 2 4.5 4.5S14.5 16 12 16c-.8 0-1.5-.2-2.2-.5l3-3c.3-.7.5-1.4.5-2.2 0-2.5-2-4.5-4.5-4.5-.8 0-1.5.2-2.2.5l3 3m-5-2.4C5.2 5.7 3.8 6 2 6.5c1.5 4 5.5 6.5 10 6.5.7 0 1.4-.1 2-.2l-1.6-1.6C11.5 10.4 11.8 10 12 10c1.4 0 2.5-1.1 2.5-2.5 0-.8-.4-1.5-1-1.9L6.4 4.6m5.6-1.8l-1.5 1.5C13 4.1 12.5 4 12 4c-2.5 0-4.5 2-4.5 4.5 0 .5.1 1 .2 1.5L5.2 7.2c-.1-.7-.2-1.4-.2-2.2 0-4 5-8 10-8z" />
                </svg>
              )}
            </span>
            <span className={styles.checkboxLabel}>{panel.label}</span>
          </label>
        ))}
      </div>

      <button
        className={styles.resetBtn}
        onClick={resetSectionVisibility}
        title="Restore default panel visibility"
      >
        Restore Defaults
      </button>
    </div>
  );
}
