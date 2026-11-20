// このファイルは単元アプリ syo4-syousu-v2 の src/components/shared/ConfidenceCheck.tsx の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「できたつもり」チェック（メタ認知キャリブレーション, エビレベルB）。
 * やる前に「できそう度」を3段階で自己予想 → あとで実際とのズレに気づくと学習調整が進む。
 * 0=ちょっと不安 / 0.5=ふつう / 1=できそう、で予想値を 0..1 で返す。
 */
import React from 'react';

interface Props {
  value: number | null;
  onChange: (v: number) => void;
  label?: string;
}

const OPTIONS: { v: number; emoji: string; label: string }[] = [
  { v: 0, emoji: '😟', label: 'ちょっと 不安' },
  { v: 0.5, emoji: '🙂', label: 'ふつう' },
  { v: 1, emoji: '😎', label: 'できそう！' },
];

export const ConfidenceCheck: React.FC<Props> = ({ value, onChange, label = 'きょうは どれくらい できそう？' }) => (
  <div>
    <p className="text-sm font-black text-muted mb-2">{label}</p>
    <div className="flex gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
            value === o.v ? 'border-blue-400 bg-blue-50' : 'border-line bg-surface hover:border-faint'
          }`}
        >
          <span className="text-2xl">{o.emoji}</span>
          <span className="text-[11px] font-black text-content">{o.label}</span>
        </button>
      ))}
    </div>
  </div>
);

/** 予想と実際のズレを子ども向けの一言に。 */
export function calibrationMessage(predicted: number, actual: number): string {
  const diff = predicted - actual;
  if (Math.abs(diff) <= 0.25) return 'よそうと ぴったり！ じぶんの ことが よく わかってるね。';
  if (diff > 0.25) return 'よそうより むずかしかったね。どこが むずかしかったか ふりかえろう。';
  return 'よそうより よく できたね！ じしんを もっていいよ。';
}
