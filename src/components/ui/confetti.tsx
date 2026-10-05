const COLORS = ['var(--mute)', 'var(--deaf)', 'var(--blind)', 'var(--card)', 'var(--ok)'];

/** Independent pseudo-random numbers in [0, 1) per piece and parameter (deterministic, no hydration mismatch). */
function rand(i: number, n: number) {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(n + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Pure-CSS confetti burst: pieces shoot out from behind the "Угадали!" title in every direction
 * (mostly upwards), then fall off the bottom of the screen. The burst point is set in CSS.
 */
export function Confetti({ count = 90 }: { count?: number }) {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const r = (n: number) => rand(i, n);
        // Aim upwards-ish: from straight left (180°) over the top to straight right (360°), with some below.
        const angle = Math.PI * (0.85 + r(1) * 1.3);
        const power = 18 + r(2) * 42; // vmin
        return (
          <i key={i} style={{
            background: COLORS[i % COLORS.length],
            width: `${7 + r(3) * 9}px`,
            height: `${10 + r(4) * 12}px`,
            borderRadius: r(5) < 0.3 ? '50%' : '3px',
            animationDelay: `${r(6) * 0.25}s`,
            animationDuration: `${2.4 + r(7) * 1.6}s`,
            '--x': `${Math.cos(angle) * power * 1.3}vmin`,
            '--y': `${Math.sin(angle) * power}vmin`,
            '--fall': `${(r(8) - 0.5) * 30}vmin`,
            '--spin': `${(r(9) < 0.5 ? -1 : 1) * (360 + r(10) * 900)}deg`,
          } as React.CSSProperties} />
        );
      })}
    </div>
  );
}
