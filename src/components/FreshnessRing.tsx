import { expiryColor, EXPIRY_HEX } from '../utils/format';

const CIRC = 138.2; // 2πr with r = 22

/**
 * Circular freshness indicator: a ring around an emoji encoding days-until-expiry.
 * `size` controls the outer SVG box; the ring geometry (r=22 in a 58×58
 * viewBox) always scales to fill it.
 */
export default function FreshnessRing({
  days,
  size = 58,
  strokeWidth = 5,
  emoji,
  emojiSize = 25,
  medallion = false,
}: {
  days: number;
  size?: number;
  strokeWidth?: number;
  emoji: string;
  emojiSize?: number;
  medallion?: boolean;
}) {
  const pct = Math.min(1, days / 30);
  const status = expiryColor(days);
  const color = EXPIRY_HEX[status];
  const dashOffset = (CIRC * (1 - pct)).toFixed(1);

  return (
    <div className="freshness-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 58 58">
        <circle className="freshness-ring-track" cx="29" cy="29" r="22" strokeWidth={strokeWidth} />
        <circle
          className="freshness-ring-progress"
          cx="29"
          cy="29"
          r="22"
          strokeWidth={strokeWidth}
          stroke={color}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div
        className="freshness-ring-emoji medallion"
        style={
          medallion
            ? { width: size - strokeWidth * 4, height: size - strokeWidth * 4, fontSize: emojiSize }
            : { fontSize: emojiSize, background: 'transparent' }
        }
      >
        {emoji}
      </div>
    </div>
  );
}
