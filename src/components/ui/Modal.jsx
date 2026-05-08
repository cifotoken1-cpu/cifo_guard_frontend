import { useEffect } from 'react';
import styles from './Modal.module.css';

export function Modal({
  open,
  onClose,
  title,
  titleIcon,
  titleIconStyle,
  width,
  fullscreen,
  children,
  footer,
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`${styles.backdrop} ${fullscreen ? styles.fullscreen : ''}`} onClick={onClose}>
      <div
        className={`${styles.modal} ${fullscreen ? styles.fullscreen : ''}`}
        style={!fullscreen && width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.header}>
          <div className={styles.title}>
            {titleIcon && (
              <div className={styles.titleIcon} style={titleIconStyle}>
                <span style={{ width: 18, height: 18 }}>{titleIcon}</span>
              </div>
            )}
            {title}
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
