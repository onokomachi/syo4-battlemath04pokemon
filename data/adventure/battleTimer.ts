/**
 * バトルの制限時間（2026-11-12 先生と決めた）。
 *
 * バッジを 7こ以上 もっている子だけ、すべてのバトル（野生もふくむ）で、問題ごとに制限時間がつく。
 * 制限時間は 問題（サブトピック）の むずかしさで決まる：むずかしさ1 → 15秒 … むずかしさ5 → 35秒。
 * 筆算シミュレーターのように 1問の操作が多い問題は 3倍。
 * 時間を超えると、3秒ごとに 相手の こうげき（いま出ている子の 最大HPの 4％）。こうげきの演出つき。
 * 答えを見ているあいだ・どうぐを えらんでいるあいだは 止まる。もう一度チャレンジ（ヒントのあと）は 0 から。
 */
import { difficultyMap } from '../../constants';

/** 制限時間が つきはじめる バッジの数（14この半分） */
export const TIME_LIMIT_MIN_BADGES = 7;
/** 時間を超えたあと、こうげきが くる間かく（秒） */
export const TIME_ATTACK_EVERY_SEC = 3;
/** 1回の こうげきで へる HP（いま出ている子の 最大HP に対する わりあい） */
export const TIME_ATTACK_RATIO = 0.04;

/** 1問の操作が多い問題（筆算シミュレーターなど）。AdventureMode の出題数の調整と同じ見分け方 */
const HEAVY_GUIDED = new Set(['division-hissan', 'multiplication-hissan', 'decimal-addsub', 'decimal-muldiv']);
export const isHeavyProblem = (data: unknown): boolean => {
  const d = data as { guidedKind?: string; round?: string } | undefined;
  if (!d?.guidedKind) return false;
  if (d.guidedKind === 'app-round') return /^hissan-/.test(d.round ?? '');
  return HEAVY_GUIDED.has(d.guidedKind);
};

/** その問題の制限時間（秒） */
export const timeLimitSec = (subTopic: string | undefined, data: unknown): number => {
  const diff = Math.min(5, Math.max(1, (subTopic ? difficultyMap[subTopic] : undefined) ?? 2));
  const base = 10 + diff * 5;
  return isHeavyProblem(data) ? base * 3 : base;
};
