import { useCameras } from '../../hooks/useCamerasStream';
import { normalizeCameraList } from '../../services/camera.service';
import { useClock } from '../../hooks/useClock';
import { CameraCard } from '../cameras/CameraCard';
import styles from './media.module.css';

export function MediaView() {
  const { data: camerasData } = useCameras();
  const time = useClock();

  const cameras = normalizeCameraList(camerasData) ?? [];

  if (cameras.length === 0) {
    return (
      <main className={styles.mediaView}>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-lo)' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>No cameras available</div>
          <div style={{ fontSize: '12px' }}>CCTV streams will appear here when connected.</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.mediaView}>
      <section>
        <div className="section-hd">
          <div className="section-label">Live Cameras ({cameras.length})</div>
        </div>
        <div className={styles.camerasGrid}>
          {cameras.map((cam, i) => (
            <CameraCard key={cam.id} cam={cam} time={time} bgIndex={i % 3} fullscreen={true} />
          ))}
        </div>
      </section>
    </main>
  );
}
