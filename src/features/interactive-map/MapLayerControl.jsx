import styles from './interactive-map.module.css';

export function MapLayerControl({ layers, onToggle, counts }) {
  const layerDefs = [
    { key: 'incidents', label: 'Insiden Aktif', color: 'var(--red)' },
    { key: 'panic', label: 'Panic Alert', color: 'var(--red)' },
    { key: 'cctv', label: 'Kamera CCTV', color: 'var(--cyan)' },
  ];

  return (
    <div className={styles.layerCard}>
      <div>
        <div className={styles.layerTitle}>Layer Pin</div>
        {layerDefs.map((l) => (
          <div
            key={l.key}
            className={`${styles.layerRow} ${layers[l.key] ? styles.on : ''}`}
            onClick={() => onToggle(l.key)}
          >
            <div className={`${styles.toggle} ${layers[l.key] ? styles.on : ''}`} />
            <div
              className={styles.swatch}
              style={{ background: l.color }}
            />
            <span>{l.label}</span>
            <span className={`${styles.layerCount} ${(counts[l.key] ?? 0) === 0 ? styles.layerCountZero : ''}`}>{counts[l.key] ?? 0}</span>
          </div>
        ))}
      </div>

      <div>
        <div className={styles.layerTitle}>Basemap</div>
        {[
          { key: 'houses', label: 'Bangunan', color: 'rgba(99,179,237,0.3)' },
          { key: 'roads', label: 'Jalan', color: 'rgba(255,255,255,0.1)' },
        ].map((l) => (
          <div
            key={l.key}
            className={`${styles.layerRow} ${layers[l.key] ? styles.on : ''}`}
            onClick={() => onToggle(l.key)}
          >
            <div className={`${styles.toggle} ${layers[l.key] ? styles.on : ''}`} />
            <div className={styles.swatch} style={{ background: l.color }} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
