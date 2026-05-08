import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { I } from '../../icons';
import { useUIStore } from '../../store/ui.store';
import { useCameras } from '../../hooks/useCamerasStream';
import { useClock } from '../../hooks/useClock';
import { normalizeCameraList } from '../../services/camera.service';
import { CameraCard } from './CameraCard';
import { CameraForm } from './CameraForm';
import styles from './CamerasModal.module.css';

export function CamerasModal() {
  const modal = useUIStore((s) => s.modal);
  const closeModal = useUIStore((s) => s.closeModal);
  const time = useClock();
  const { data: camerasData } = useCameras();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editCamera, setEditCamera] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const cameras = normalizeCameraList(camerasData) ?? [];
  const online = camerasData?.online || 0;
  const total = camerasData?.total || cameras.length;

  return (
    <>
      <Modal
        open={modal === 'cameras'}
        onClose={closeModal}
        width={680}
        fullscreen={isFullscreen}
        title="Live Camera Feeds"
        titleIcon={I.zoneCam}
        titleIconStyle={{ background: 'rgba(99,179,237,0.12)', color: 'var(--cyan)' }}
        footer={
          <div className={styles.footerInner}>
            <span>
              All streams healthy — <strong>{online}/{total}</strong> online
            </span>
            <button 
              className={styles.addCameraBtn} 
              onClick={() => {
                setEditCamera(null);
                setShowForm(true);
              }}
            >
              + Add Camera
            </button>
            <button 
              className={styles.fullscreenBtn}
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <span style={{ width: 16, height: 16 }}>
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                ) : (
                  I.expand
                )}
              </span>
            </button>
            <button className={styles.closeBtn} onClick={closeModal}>
              Close
            </button>
          </div>
        }
      >
        <div className={styles.grid}>
          {cameras.length === 0 && (
            <div className={styles.empty}>
              <div style={{ textAlign: 'center', padding: '20px' }}>
                No cameras configured. 
                <button
                  style={{
                    display: 'block',
                    marginTop: 12,
                    padding: '8px 16px',
                    background: 'var(--cyan)',
                    color: 'var(--bg)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setEditCamera(null);
                    setShowForm(true);
                  }}
                >
                  Add First Camera
                </button>
              </div>
            </div>
          )}
          {cameras.map((c, i) => (
            <div
              key={c.id}
              className={`${styles.cell} ${i === 0 ? styles.featured : ''}`}
            >
              <div className={styles.cardWrapper}>
                <CameraCard cam={c} time={time} bgIndex={i} />
                <div className={styles.cardActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => {
                      setEditCamera(c);
                      setShowForm(true);
                    }}
                    title="Edit camera"
                  >
                    ✎
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Camera Form Modal */}
      {showForm && (
        <div className={styles.formOverlay}>
          <div className={styles.formModal}>
            <CameraForm
              camera={editCamera}
              onClose={() => {
                setShowForm(false);
                setEditCamera(null);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
