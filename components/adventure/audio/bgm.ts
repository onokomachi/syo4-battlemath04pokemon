/**
 * bgm.ts — BGMの再生。
 *
 * フィールドの曲とバトルの曲は、別々の <audio> 要素で持つ。
 *
 * 最初は1つの要素を使い回していたが、それだと「バトルに入る→町の曲が止まる→
 * バトルが終わって町の曲を鳴らしなおす」の最後の一手が必ず頭出しになり、
 * バトルのたびに町の曲が最初から流れなおして煩わしい、という声があった。
 *
 * バトル中のフィールド曲の無音化は、音量を0にするのではなく pause() でやる。
 * iOS Safari(iPadのWebView含む)は HTMLMediaElement.volume の書きかえを無視し、
 * 実機の音量ボタンにしか従わない仕様があり、volume=0 にしても実際には
 * 無音にならず「バトル中もフィールドの曲が聞こえて二重に鳴る」形で
 * 実際に報告があった。pause() は currentTime を巻きもどさないので、
 * 再開すれば続きから聞こえる点は volume=0 方式と同じまま保てる。
 *
 * パフォーマンスへの配慮:
 *  - 起動時には何も読みこまない。音声ファイルを作るのは初めて鳴らすときだけ
 *    (アドベンチャーを開かない子には1バイトも届かない)。
 *  - 音声はビルド後も public/ 配下の静的ファイルのまま配信される
 *    (JSバンドルには一切含まれない。import で埋めこむと初期読みこみが
 *    重くなるので、パスを文字列で持つだけにしてある)。
 *
 * 曲を増やすとき:
 *  TRACKS に 1行足すだけでよい。フィールドの曲は、町の unit
 *  (data/adventure/towns.ts の unit 文字列)をそのままキーにしている
 *  (例: playFieldBgm(town.unit))。まだ曲が無い単元は TRACKS にキーが
 *  無いだけでよく、playFieldBgm 側が自動で無音にする。
 *  「小数のしくみ」と「小数のかけ算とわり算」のように、単元が違っても
 *  同じ曲を使いたいときは、同じパスを2つのキーに割り当てればよい。
 */

const BASE = (import.meta as any).env?.BASE_URL ?? '/';
const FIELD_VOLUME = 0.5;
const BATTLE_VOLUME = 0.5;

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
  '計算のきまり': `${BASE}assets/adventure/audio/unit-calc-rules.mp3`,
  '直方体と立方体': `${BASE}assets/adventure/audio/unit-cuboid-cube.mp3`,
  '倍の見方': `${BASE}assets/adventure/audio/unit-multiples.mp3`,
  '面積': `${BASE}assets/adventure/audio/unit-area.mp3`,
  '分数': `${BASE}assets/adventure/audio/unit-fractions.mp3`,
};

let fieldEl: HTMLAudioElement | null = null;
let fieldTrack: string | null = null;
let battleEl: HTMLAudioElement | null = null;

const getFieldEl = (): HTMLAudioElement => {
  if (!fieldEl) {
    fieldEl = new Audio();
    fieldEl.loop = true;
    fieldEl.volume = FIELD_VOLUME;
    fieldEl.preload = 'auto';
  }
  return fieldEl;
};

const getBattleEl = (): HTMLAudioElement => {
  if (!battleEl) {
    battleEl = new Audio();
    battleEl.loop = true;
    battleEl.volume = BATTLE_VOLUME;
    battleEl.preload = 'auto';
  }
  return battleEl;
};

/**
 * フィールドの曲を鳴らす。同じ曲がすでに読みこまれている(バトルからの復帰など)
 * ときは頭出ししない(pause で止まっていた場合、そこから再開するだけ)。
 * 存在しない曲名(まだBGMが無い単元)は無音にする。
 */
export const playFieldBgm = (track: string) => {
  const src = TRACKS[track];
  const a = getFieldEl();
  if (!src) {
    a.pause();
    fieldTrack = null;
    return;
  }
  if (fieldTrack !== track) {
    fieldTrack = track;
    a.src = src;
    a.currentTime = 0;
  }
  // 自動再生がブラウザにブロックされても例外を投げない
  void a.play().catch(() => {});
};

/** バトル中、フィールドの曲を止める(currentTimeは巻きもどさないので、続きから聞こえる)。 */
export const muteFieldBgm = () => {
  if (fieldEl) fieldEl.pause();
};

export const playBattleBgm = () => {
  const src = TRACKS.battle;
  if (!src) return;
  const a = getBattleEl();
  a.src = src;
  a.currentTime = 0;
  void a.play().catch(() => {});
};

export const stopBattleBgm = () => {
  if (!battleEl) return;
  battleEl.pause();
  battleEl.currentTime = 0;
};

/** アドベンチャーそのものを抜けるときに、フィールド・バトルどちらも完全に止める。 */
export const stopAllBgm = () => {
  if (fieldEl) { fieldEl.pause(); fieldEl.currentTime = 0; }
  if (battleEl) { battleEl.pause(); battleEl.currentTime = 0; }
  fieldTrack = null;
};
