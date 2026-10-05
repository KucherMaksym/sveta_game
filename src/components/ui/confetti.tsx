const COLORS = ['var(--mute)', 'var(--deaf)', 'var(--blind)', 'var(--card)', 'var(--ok)'];

/** Pure-CSS confetti burst; deterministic so server and client render the same pieces. */
export function Confetti({ count = 60 }: { count?: number }) {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const r = (n: number) => ((i * 9301 + n * 49297) % 233280) / 233280;
        return (
          <i key={i} style={{
            left: `${r(1) * 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${r(2) * 0.8}s`,
            animationDuration: `${2.2 + r(3) * 1.8}s`,
            '--drift': `${(r(4) - 0.5) * 200}px`,
            '--spin': `${360 + r(5) * 720}deg`,
            width: `${8 + r(6) * 8}px`,
            height: `${12 + r(7) * 10}px`,
          } as React.CSSProperties} />
        );
      })}
    </div>
  );
}
