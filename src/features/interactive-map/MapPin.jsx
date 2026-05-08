const PIN_ICONS = {
  incident: (
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="#fff" />
  ),
  panic: <circle cx="12" cy="12" r="8" fill="#fff" />,
  cctv: (
    <path
      d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"
      fill="#fff"
    />
  ),
};

export function MapPin({ pin, selected, onClick }) {
  const isActive = pin.type === 'incident' || pin.type === 'panic';

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* pulse ring for active types */}
      {isActive && (
        <circle
          cx={pin.x}
          cy={pin.y}
          r={14}
          fill="none"
          stroke={pin.color}
          strokeWidth={1.5}
          opacity={0.4}
          style={{
            animation: 'pinPulse 1.8s infinite',
            pointerEvents: 'none'
          }}
        />
      )}
      {/* pin body */}
      <circle
        cx={pin.x}
        cy={pin.y}
        r={selected ? 11 : 9}
        fill={pin.color}
        opacity={0.9}
        stroke={selected ? '#fff' : 'none'}
        strokeWidth={selected ? 2 : 0}
      />
      {/* icon */}
      <svg
        x={pin.x - 8}
        y={pin.y - 8}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        style={{ pointerEvents: 'none' }}
      >
        {PIN_ICONS[pin.type]}
      </svg>
    </g>
  );
}
