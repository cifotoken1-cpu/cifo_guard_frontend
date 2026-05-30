import { MapPin } from './MapPin';
import styles from './interactive-map.module.css';

// Simplified basemap house grid (matches mockup layout)
const HOUSES = [
  ...Array.from({ length: 8 }, (_, i) => ({ block: 'A', x: 80 + i * 70, y: 120, w: 50, h: 55 })),
  ...Array.from({ length: 8 }, (_, i) => ({ block: 'A', x: 80 + i * 70, y: 195, w: 50, h: 55 })),
  ...Array.from({ length: 6 }, (_, i) => ({ block: 'B', x: 740 + i * 70, y: 120, w: 50, h: 55 })),
  ...Array.from({ length: 6 }, (_, i) => ({ block: 'B', x: 740 + i * 70, y: 195, w: 50, h: 55 })),
  ...Array.from({ length: 5 }, (_, i) => ({ block: 'C', x: 780 + i * 78, y: 300, w: 62, h: 70, vip: true })),
  ...Array.from({ length: 7 }, (_, i) => ({ block: 'D', x: 80 + i * 70, y: 480, w: 50, h: 55 })),
  ...Array.from({ length: 7 }, (_, i) => ({ block: 'D', x: 80 + i * 70, y: 555, w: 50, h: 55 })),
  ...Array.from({ length: 5 }, (_, i) => ({ block: 'E', x: 660 + i * 70, y: 480, w: 50, h: 55 })),
  ...Array.from({ length: 5 }, (_, i) => ({ block: 'E', x: 660 + i * 70, y: 555, w: 50, h: 55 })),
];

const ROADS = [
  { x1: 60, y1: 280, x2: 1140, y2: 280 },
  { x1: 60, y1: 420, x2: 1140, y2: 420 },
  { x1: 700, y1: 60, x2: 700, y2: 640 },
  { x1: 60, y1: 60, x2: 60, y2: 640 },
  { x1: 1140, y1: 60, x2: 1140, y2: 640 },
];

export function MapCanvas({ pins, layers, selectedPinId, onPinClick }) {
  const visiblePins = pins.filter((p) => {
    if (p.type === 'incident' && !layers.incidents) return false;
    if (p.type === 'panic' && !layers.panic) return false;
    if (p.type === 'cctv' && !layers.cctv) return false;
    return true;
  });

  return (
    <div className={styles.mapStage}>
      <svg
        className={styles.mapSvg}
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Roads */}
        {layers.roads && ROADS.map((r, i) => (
          <line
            key={i}
            x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={12}
          />
        ))}

        {/* Houses */}
        {layers.houses && HOUSES.map((h, i) => (
          <rect
            key={i}
            x={h.x} y={h.y} width={h.w} height={h.h}
            rx={4}
            fill={h.vip ? 'rgba(168,85,247,0.15)' : 'rgba(99,179,237,0.08)'}
            stroke={h.vip ? 'rgba(168,85,247,0.3)' : 'rgba(99,179,237,0.15)'}
            strokeWidth={1}
          />
        ))}

        {/* Block labels */}
        {layers.houses && ['A', 'B', 'C', 'D', 'E'].map((blk) => {
          const pts = { A: [300, 100], B: [940, 100], C: [980, 285], D: [280, 460], E: [820, 460] };
          return (
            <text
              key={blk}
              x={pts[blk][0]}
              y={pts[blk][1]}
              fontSize={11}
              fill="rgba(255,255,255,0.2)"
              fontFamily="var(--font-mono)"
              fontWeight={700}
              textAnchor="middle"
            >
              BLOK {blk}
            </text>
          );
        })}

        {/* Pins */}
        {visiblePins.map((pin) => (
          <MapPin
            key={pin.id}
            pin={pin}
            selected={selectedPinId === pin.id}
            onClick={() => onPinClick(pin)}
          />
        ))}
      </svg>

      {visiblePins.length === 0 && (
        <div className={styles.mapEmpty}>
          <div className={styles.mapEmptyIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
              <line x1="4" y1="4" x2="20" y2="20" strokeWidth="1.5" />
            </svg>
          </div>
          <div className={styles.mapEmptyText}>Tidak ada pin yang ditampilkan</div>
          <div className={styles.mapEmptyHint}>
            Pastikan layer aktif · Data GPS harus tersedia dari backend
          </div>
        </div>
      )}

      <div className={styles.mapLegend}>
        <div className={styles.legendRow}>
          <div className={styles.legendDot} style={{ background: 'var(--red)' }} />
          <span>Insiden / Panic</span>
        </div>
        <div className={styles.legendRow}>
          <div className={styles.legendDot} style={{ background: 'var(--cyan)' }} />
          <span>Kamera CCTV</span>
        </div>
      </div>
    </div>
  );
}
