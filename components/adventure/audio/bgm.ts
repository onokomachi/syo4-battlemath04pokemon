/**
 * bgm.ts — BGMの再生。
 *
 * パフォーマンスへの配慮:
 *  - 起動時には何も読みこまない。音声ファイルを作るのは初めて鳴らすときだけ
 *    (アドベンチャーを開かない子には1バイトも届かない)。
 *  - <audio> 要素を1つだけ使い回す。バトルのたびに new Audio() すると、
 *    連戦時に読みこみ待ちや GC が発生する。
 *  - 音声はビルド後も public/ 配下の静的ファイルのまま配信される
 *    (JSバンドルには一切含まれない。import で埋めこむと初期読みこみが
 *    重くなるので、パスを文字列で持つだけにしてある)。
 *  - 同じ曲を続けて呼んでも巻きもどさない(連戦のたびに頭出ししない)。
 *
 * 曲を増やすとき:
 *  TRACKS に 1行足して `playBgm('その名前')` を呼ぶだけでよい。
 *  フィールドごとのBGMは、町の unit (data/adventure/towns.ts の unit 文字列)
 *  をそのままキーにしている(例: playBgm(town.unit))。まだ曲が無い単元は
 *  TRACKS にキーが無いだけでよく、playBgm 側が自動で無音にする。
 *  「小数のしくみ」と「小数のかけ算とわり算」のように、単元が違っても
 *  同じ曲を使いたいときは、同じパスを2つのキーに割り当てればよい。
 */

const BASE = (import.meta as any).env?.BASE_URL ?? '/';

const TRACKS: Record<string, string> = {
  battle: `${BASE}assets/adventure/audio/battle.mp3`,

  // --- フィールドBGM(町の unit をキーにする) ---
  '大きい数のしくみ': `${BASE}assets/adventure/audio/unit-big-numbers.mp3`,
  'わり算の筆算(÷1けた)': `${BASE}assets/adventure/audio/unit-division-1digit.mp3`,
  '角の大きさ': `${BASE}assets/adventure/audio/unit-angles.mp3`,
  '小数のしくみ': `${BASE}assets/adventure/audio/unit-decimals.mp3`,
  'わり算の筆算(÷2けた)': `${BASE}assets/adventure/audio/unit-division-2digit.mp3`,
  'がい数': `${BASE}assets/adventure/audio/unit-rounding.mp3`,
  '小数のかけ算とわり算': `${BASE}assets/adventure/audio/unit-decimals.mp3`,
};

let el: HTMLAudioElement | null = null;
let currentTrack: string | null = null;

const getEl = (): HTMLAudioElement => {
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.volume = 0.5;
    el.preload = 'auto';
  }
  return el;
};

/**
 * 曲を鳴らす。存在しない曲名は無音にする(まだBGMが無いフィールド用)。
 * ここで「止める」まで面倒を見るのは、曲つきの町から曲なしの町へ移ったときに
 * 前の町の曲が鳴りっぱなしにならないようにするため。
 */
export const playBgm = (track: string) => {
  const src = TRACKS[track];
  if (!src) {
    stopBgm();
    return;
  }
  const a = getEl();
  if (currentTrack !== track) {
    currentTrack = track;
    a.src = src;
    a.currentTime = 0;
  }
  // 自動再生がブラウザにブロックされても例外を投げない
  // (ユーザー操作を経ずに呼ばれた場合の保険。バトルは必ず操作の後に始まるので
  //  実際にはほぼ通る)。
  void a.play().catch(() => {});
};

export const stopBgm = () => {
  if (!el) return;
  el.pause();
  el.currentTime = 0;
  currentTrack = null;
};
