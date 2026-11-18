/**
 * 伝説 HELL（2026-11-18 先生と決めた）。
 *
 * 伝説・幻を あわせて 5体 なかまにしたあと、祠で たたかう のこりの伝説・幻は HELL になる
 * （フィールドを歩いている 野生の伝説は 今のまま）。ボス戦 HELL（わり算の筆算アプリ）と同じ考え方：
 *  - 正解していても、時計で こうげきしてくる（制限時間の 3分の1 ごと）
 *  - 苦手な問題（その子の正答率が低い 3分の1）だけが つづけて出る
 *  - 制限時間は 0.6倍・まちがえたときの ダメージは重い
 *  - ヒント・しおり・どうぐ・おまもりは 使えない。まちがえても もう一度は なし（答えを見て 次へ）
 *  - 伝説は 少なくとも 16問 正解しないと たおれない（手持ちが強くても 短く終わらない）
 * 勝つと「🔥HELL」の しるしが つき、さいだいHP・こうげきが 1.1倍。
 */
import type { SkillMastery } from '../../services/learningLogService';

/** HELL が始まる、なかまにした 伝説・幻の数 */
export const HELL_MIN_LEGENDS = 5;
/** 制限時間の ばいりつ */
export const HELL_TIME_MULT = 0.6;
/** 時計の こうげき：制限時間の 何分の1 ごとに くるか */
export const HELL_CLOCK_DIV = 3;
/** 時計の こうげき 1回の ダメージ（いま出ている子の 最大HP に対する わりあい） */
export const HELL_CLOCK_RATIO = 0.07;
/** まちがえたときの ダメージの ばいりつ */
export const HELL_MISS_MULT = 1.5;
/** まちがえたときの ダメージの 下限（いま出ている子の 最大HP に対する わりあい） */
export const HELL_MISS_MIN_RATIO = 0.35;
/** 伝説を たおすのに いる 正解の数（少なくとも） */
export const HELL_MIN_HITS = 16;
/** HELL に勝った伝説の さいだいHP・こうげきの ばいりつ */
export const HELL_MARK_MULT = 1.1;

/** この子の いまの セーブで、祠の伝説が HELL になるか（なかまにした 伝説・幻の数で決める） */
export const isLegendHell = (ownedLegendIds: readonly string[]): boolean =>
  ownedLegendIds.length >= HELL_MIN_LEGENDS;

/**
 * 苦手な問題だけを のこす：正答率の低い順に 3分の1（少なくとも4つ）。
 * まだ やったことがない項目は 正答率 0.6 として まん中あたりに入れる。
 */
export const weakSubtopics = (subtopics: readonly string[], mastery: Record<string, SkillMastery | undefined>): string[] => {
  const uniq = Array.from(new Set(subtopics));
  if (uniq.length <= 4) return uniq;
  const acc = (s: string) => {
    const m = mastery[s];
    return m && m.attempts > 0 ? m.corrects / m.attempts : 0.6;
  };
  const keep = Math.max(4, Math.ceil(uniq.length / 3));
  return uniq
    .map((s, i) => ({ s, a: acc(s), i }))
    .sort((x, y) => x.a - y.a || x.i - y.i)
    .slice(0, keep)
    .map(x => x.s);
};
