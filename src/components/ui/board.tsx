'use client';

import { useEffect, useRef } from 'react';
import { BOARD_RATIO, BRUSHES, ERASER, PALETTE } from '@/lib/game/rules';
import type { Segment } from '@/lib/game/types';
import { useGame } from '../game-context';

/** Brush sizes are in units of a 1000px-wide board, so the drawing scales with the screen. */
function paint(canvas: HTMLCanvasElement, seg: Segment) {
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  ctx.strokeStyle = PALETTE[seg.c];
  ctx.lineWidth = Math.max(1, (seg.w * w) / 1000);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(seg.x0 * w, seg.y0 * h);
  ctx.lineTo(seg.x1 * w, seg.y1 * h);
  ctx.stroke();
}

type Props = {
  /** The blind draws on a covered board and sees nothing; everyone else just watches. */
  blindfold?: boolean;
  color?: number;
  brush?: number;
  className?: string;
  children?: React.ReactNode;
};

export function Board({ blindfold, color = 0, brush = BRUSHES[1], className = '', children }: Props) {
  const { session } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tool = useRef({ color, brush });
  tool.current = { color, brush };

  // Keep the canvas sharp at any size and repaint from the room's stroke list.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const redraw = () => {
      canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
      if (!blindfold) for (const s of session.strokes) paint(canvas, s);
    };
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      redraw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const off = session.onStrokes((e) => (e.kind === 'reset' ? redraw() : !blindfold && paint(canvas, e.seg)));
    return () => {
      ro.disconnect();
      off();
    };
  }, [session, blindfold]);

  // Drawing input, only for the blind.
  useEffect(() => {
    if (!blindfold) return;
    const canvas = canvasRef.current!;
    let last: [number, number] | null = null;
    const pos = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    };
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      last = pos(e);
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      const p = pos(e);
      const { color: c, brush: w } = tool.current;
      session.draw({ x0: last[0], y0: last[1], x1: p[0], y1: p[1], c, w });
      last = p;
    };
    const up = () => (last = null);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, [session, blindfold]);

  // The frame takes whatever space the layout gives; the board inside is always BOARD_RATIO, fitted and centred.
  return (
    <div className={`board-frame ${className}`} style={{ '--board-ratio': BOARD_RATIO } as React.CSSProperties}>
      <div className={`board${blindfold ? ' board--hidden' : ''}`}>
        <canvas ref={canvasRef} />
      {blindfold && (
        <div className="board__cover">
          <div className="board__title">Рисуй наугад!</div>
          <div className="board__sub">Доска скрыта. Глухой видит каждую линию.</div>
        </div>
      )}
        {children}
      </div>
    </div>
  );
}

const SWATCH_NAMES = ['Чёрный', 'Коралловый', 'Бирюзовый', 'Жёлтый', 'Зелёный'];

type ToolbarProps = {
  color: number;
  brush: number;
  onColor: (c: number) => void;
  onBrush: (b: number) => void;
  onClear: () => void;
};

/** Big targets (40px+) so the blind can hit them by the deaf's directions: "третий кружок слева". */
export function Toolbar({ color, brush, onColor, onBrush, onClear }: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar__group">
        {SWATCH_NAMES.map((name, i) => (
          <button key={name} className="swatch" style={{ background: PALETTE[i] }} aria-label={name}
            aria-pressed={color === i} onClick={() => onColor(i)} />
        ))}
      </div>
      <div className="toolbar__sep" />
      <div className="toolbar__group">
        {BRUSHES.slice(0, 3).map((b, i) => (
          <button key={b} className="size" style={{ '--d': `${8 + i * 8}px` } as React.CSSProperties}
            aria-label={['Тонкая', 'Средняя', 'Толстая'][i]} aria-pressed={brush === b} onClick={() => onBrush(b)} />
        ))}
      </div>
      <div className="toolbar__sep" />
      <div className="toolbar__group">
        <button className="tool" aria-pressed={color === ERASER} onClick={() => onColor(ERASER)}>Ластик</button>
        <button className="tool tool--danger" onClick={onClear}>Стереть всё</button>
      </div>
    </div>
  );
}
