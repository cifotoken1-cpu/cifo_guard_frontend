import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { I } from '../../icons';
import { pad } from '../../utils/format';
import styles from './CameraCard.module.css';

/**
 * Camera card with cyberpunk HUD overlay.
 * If `cam.streamUrl` is provided, attempts HLS playback via hls.js.
 * Otherwise shows a stylized animated background placeholder.
 */
export function CameraCard({ cam, time, bgIndex = 0 }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    if (!cam.streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(cam.streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hlsRef.current = hls;
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = cam.streamUrl;
      video.play().catch(() => {});
    }
  }, [cam.streamUrl]);

  const bgClass = ['bg1', 'bg2', 'bg3'][bgIndex % 3];

  return (
    <div className={styles.card}>
      {cam.streamUrl ? (
        <video
          ref={videoRef}
          className={styles.video}
          muted
          playsInline
          autoPlay
        />
      ) : (
        // @stub: hybrid — animated background placeholder saat HLS stream tidak tersedia (UX). Lihat INTEGRATION_STATUS.md #6.
        <div className={`${styles.bg} ${styles[bgClass]}`} />
      )}

      <div className={styles.scanline} />
      <div className={styles.noise} />
      <div className={styles.overlay} />

      <div className={styles.corners}>
        <div className={`${styles.corner} ${styles.tl}`} />
        <div className={`${styles.corner} ${styles.tr}`} />
        <div className={`${styles.corner} ${styles.bl}`} />
        <div className={`${styles.corner} ${styles.br}`} />
      </div>

      <div className={styles.hud}>
        <div className={styles.top}>
          <div className={styles.live}>
            <span className={styles.liveDot} />
            LIVE
          </div>
          <div className={styles.controls}>
            <CtrlBtn title="Snapshot" icon={I.snapshot} />
            <CtrlBtn title="Record" icon={I.rec} />
            <CtrlBtn title="Expand" icon={I.expand} />
          </div>
          <div className={styles.res}>{cam.res}</div>
        </div>
        <div className={styles.bottom}>
          <div className={styles.name}>{cam.name}</div>
          <div className={styles.meta}>
            <div className={styles.timeLbl}>
              {pad(time.getHours())}:{pad(time.getMinutes())}:{pad(time.getSeconds())}
            </div>
            {cam.detect && <div className={styles.detect}>⚠ {cam.detect}</div>}
          </div>
        </div>
      </div>

      {cam.motion && <div className={styles.motionAlert} />}
    </div>
  );
}

function CtrlBtn({ title, icon }) {
  return (
    <button className={styles.ctrlBtn} title={title} onClick={(e) => e.stopPropagation()}>
      <span style={{ width: 10, height: 10 }}>{icon}</span>
    </button>
  );
}
