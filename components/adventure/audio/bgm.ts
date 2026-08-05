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
 *  フィールドごとのBGMを足すときは、町の biome をキーにすればそのまま使える
 *  (例: playBgm(town.biome))。今は battle 用の1曲だけ配線ずみ。
 */

const BASE = (import.meta as any).env?.BASE_URL ?? '/';

const TRACKS: Record<string, string> = {
  battle: `${BASE}assets/adventure/audio/battle.mp3`,
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

/** 曲を鳴らす。存在しない曲名は何もしない(まだBGMが無いフィールド用)。 */
export const playBgm = (track: string) => {
  const src = TRACKS[track];
  if (!src) return;
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
