/**
 * DialogueBox.tsx — 会話ウィンドウ。
 *
 * 小4が読みやすいよう、1文ずつ・大きな文字・1文字ずつ表示にしている。
 * どこをタップしても進み、もう一度タップすると残りを全部出す。
 */
import React, { useEffect, useRef, useState } from 'react';

export const DialogueBox: React.FC<{
  speaker?: string;
  portrait?: string;
  lines: string[];
  onDone: () => void;
  accent?: string;
}> = ({ speaker, portrait, lines, onDone, accent = '#38bdf8' }) => {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState('');
  const timer = useRef<number | null>(null);
  const line = lines[index] ?? '';

  useEffect(() => {
    setShown('');
    let i = 0;
    const tick = () => {
      i += 1;
      setShown(line.slice(0, i));
      if (i < line.length) timer.current = window.setTimeout(tick, 28);
    };
    timer.current = window.setTimeout(tick, 28);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [line]);

  const advance = () => {
    if (shown.length < line.length) {
      // まだ表示中なら、残りを一気に出す
      if (timer.current) window.clearTimeout(timer.current);
      setShown(line);
      return;
    }
    if (index < lines.length - 1) setIndex(index + 1);
    else onDone();
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-center p-3 sm:p-5"
      onClick={advance}
      style={{ touchAction: 'manipulation' }}
    >
      <div
        className="w-full max-w-5xl rounded-3xl border-4 bg-white/95 shadow-2xl p-4 sm:p-6 relative"
        style={{ borderColor: accent }}
      >
        {speaker && (
          <div
            className="absolute -top-5 left-6 px-5 py-1.5 rounded-full text-white font-black text-lg shadow-lg"
            style={{ backgroundColor: accent }}
          >
            {speaker}
          </div>
        )}
        <div className="flex items-center gap-4">
          {portrait && (
            <img
              src={portrait}
              alt=""
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain shrink-0 drop-shadow"
              onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />
          )}
          <p className="flex-1 text-xl sm:text-2xl leading-relaxed font-bold text-slate-800 min-h-[3.5rem]">
            {shown}
          </p>
        </div>
        <div className="absolute right-5 bottom-3 text-slate-400 text-sm font-bold animate-bounce">
          {index < lines.length - 1 || shown.length < line.length ? '▼ タップでつぎへ' : '▼ タップでとじる'}
        </div>
      </div>
    </div>
  );
};
