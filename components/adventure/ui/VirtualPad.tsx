/**
 * VirtualPad.tsx — 左下のバーチャルパッドと、右下の「しらべる」ボタン。
 *
 * iPadを横に持ったとき、親指がとどく位置に大きく置く。パッドは
 * 「置いたところが中心」になる方式にして、正確に真ん中を押さなくても
 * 動かせるようにしている(小4がつまずきやすい所なので)。
 */
import React, { useCallback, useRef, useState } from 'react';

const PAD_RADIUS = 62;   // つまみが動ける半径(px)
const PAD_SIZE = 168;    // 台座の見た目の大きさ(px)

export const VirtualPad: React.FC<{
  onMove: (x: number, y: number) => void;
  disabled?: boolean;
}> = ({ onMove, disabled }) => {
  const base = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const dx = clientX - origin.current.x;
      const dy = clientY - origin.current.y;
      const d = Math.hypot(dx, dy);
      const k = d > PAD_RADIUS ? PAD_RADIUS / d : 1;
      const nx = dx * k;
      const ny = dy * k;
      setKnob({ x: nx, y: ny });
      // 画面の下方向(+y)は、3D空間では手前(+z)
      onMove(nx / PAD_RADIUS, ny / PAD_RADIUS);
    },
    [onMove],
  );

  const start = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    pointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = base.current!.getBoundingClientRect();
    // 押した位置を中心にする(はしを押しても動く)
    const cx = Math.min(Math.max(e.clientX, rect.left + 40), rect.right - 40);
    const cy = Math.min(Math.max(e.clientY, rect.top + 40), rect.bottom - 40);
    origin.current = { x: cx, y: cy };
    setActive(true);
    update(e.clientX, e.clientY);
  };

  const move = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    e.preventDefault();
    update(e.clientX, e.clientY);
  };

  const end = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={base}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="absolute left-3 bottom-3 select-none"
      style={{ width: PAD_SIZE + 60, height: PAD_SIZE + 60, touchAction: 'none' }}
      aria-label="うごかす"
    >
      <div
        className="absolute rounded-full border-4 border-white/60 bg-black/25 backdrop-blur-sm transition-opacity"
        style={{
          width: PAD_SIZE, height: PAD_SIZE,
          left: active ? origin.current.x - (base.current?.getBoundingClientRect().left ?? 0) - PAD_SIZE / 2 : 30,
          top: active ? origin.current.y - (base.current?.getBoundingClientRect().top ?? 0) - PAD_SIZE / 2 : 30,
          opacity: disabled ? 0.25 : active ? 0.95 : 0.6,
        }}
      >
        {/* 十字のガイド。どちらに動かせばよいか ひと目でわかるように。 */}
        <span className="absolute inset-x-0 top-2 text-center text-white/70 text-xl leading-none">▲</span>
        <span className="absolute inset-x-0 bottom-2 text-center text-white/70 text-xl leading-none">▼</span>
        <span className="absolute inset-y-0 left-2 flex items-center text-white/70 text-xl leading-none">◀</span>
        <span className="absolute inset-y-0 right-2 flex items-center text-white/70 text-xl leading-none">▶</span>
        <div
          className="absolute rounded-full bg-white shadow-lg"
          style={{
            width: 74, height: 74,
            left: PAD_SIZE / 2 - 37 + knob.x,
            top: PAD_SIZE / 2 - 37 + knob.y,
          }}
        />
      </div>
    </div>
  );
};

export const ActionButton: React.FC<{
  label: string;
  sub?: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}> = ({ label, sub, onClick, disabled, highlight }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={[
      'relative w-32 h-32 rounded-full border-4 shadow-2xl select-none',
      'flex flex-col items-center justify-center transition-transform active:scale-95',
      disabled
        ? 'bg-slate-400/50 border-white/40 text-white/60'
        : highlight
          ? 'bg-amber-400 border-white text-amber-950 animate-pulse'
          : 'bg-sky-500 border-white text-white',
    ].join(' ')}
    style={{ touchAction: 'manipulation' }}
  >
    <span className="text-2xl font-black leading-tight">{label}</span>
    {sub && <span className="text-xs font-bold opacity-80 mt-0.5">{sub}</span>}
  </button>
);
