/**
 * sfx.ts — 効果音(こうげき成功・勝利・レベルアップ)。
 *
 * 音声ファイルを増やさず、Web Audio API でその場で単純な音を作る。
 * 読みこみが増えないし、著作権の心配も無い。BGMのように「鳴らしっぱなし」
 * にする必要が無い短い音なので、bgm.ts とは別モジュールにしてある。
 */

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  // 自動再生ポリシーで suspended のままのことがある。効果音は必ずボタン操作の
  // 直後に呼ばれるので、ここで resume すれば実際にはほぼ通る。
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
};

interface Tone {
  /** 音の高さ(Hz) */
  freq: number;
  /** 呼び出しからの開始時刻(秒) */
  start: number;
  /** 長さ(秒) */
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

const playTones = (tones: Tone[]) => {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  for (const t of tones) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = t.type ?? 'square';
    osc.frequency.value = t.freq;
    const peak = t.gain ?? 0.18;
    const startAt = now + t.start;
    const endAt = startAt + t.dur;
    // 立ち上がりはわずかに、消えぎわは指数カーブで。急に0にすると「プツッ」と鳴る。
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + Math.min(0.015, t.dur * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(startAt);
    osc.stop(endAt + 0.02);
  }
};

/** もんだいに正解して、こうげきが当たったときの短い音。 */
export const playHitSfx = () => {
  playTones([
    { freq: 880, start: 0, dur: 0.06, type: 'square', gain: 0.16 },
    { freq: 660, start: 0.05, dur: 0.09, type: 'square', gain: 0.13 },
  ]);
};

/** バトルに勝った・つかまえたときの、明るく上がっていくファンファーレ。 */
export const playWinSfx = () => {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  playTones(notes.map((freq, i) => ({
    freq, start: i * 0.11, dur: 0.16, type: 'square' as OscillatorType, gain: 0.16,
  })));
};

/** レベルアップの、きらきらした上昇音。 */
export const playLevelUpSfx = () => {
  const notes = [659.25, 783.99, 987.77, 1318.51]; // E5 G5 B5 E6
  playTones(notes.map((freq, i) => ({
    freq, start: i * 0.07, dur: 0.14, type: 'triangle' as OscillatorType, gain: 0.15,
  })));
};
