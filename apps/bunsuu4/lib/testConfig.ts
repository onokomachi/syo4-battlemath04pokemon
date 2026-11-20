// このファイルは単元アプリ syo4-bunnsu の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 * 小4「10. 分数」の紙のテスト（新学社 4年東 下巻。表＝知識・技能 100点、裏＝思考・判断・表現 50点、いかそう算数＝参考）を見て、
 * 大問・小問・配点・問い方をそのまま写した（docs/DESIGN.md §5）。数値は毎回ランダムに作る。
 *
 * 採点: ノーミス完答＝満点、ミスありで完答＝0点（＝一発正解を採点）。
 * 大問7・8は紙では「式10点・答え10点」。アプリは式（カードで組み立てる）→答え の2手順を一発で通したら20点（紙との差。DESIGN.md §5）。
 */
import { generate, generateTagged, type Prob } from './problems';
import { generateError, describeError, type ErrProb } from './errorHunter';
import type { ModuleId } from '../store/progressStore';

export type TestProblem =
  | { kind: 'frac'; p: Prob }
  | { kind: 'error'; p: ErrProb };

export type Section = '表' | '裏' | '参考';

export interface TestStep {
  daimon: number;
  sub?: string;
  title: string;
  section: Section;
  points: number;
  gen: () => TestProblem;
  /** 練習モードと同じ命名の項目の記号（カタログの skill_id と同じ文字列） */
  skillId: string;
}

const frac = (skillId: string, tag?: string): TestProblem =>
  ({ kind: 'frac', p: tag ? generateTagged(skillId, tag) : generate(skillId) });
const err = (skillId: string): TestProblem => ({ kind: 'error', p: generateError(skillId) });
void err;

export const TEST_STEPS: TestStep[] = [
  /* ===== 表・知識技能（各5点・計100点） ===== */
  // 大問1: 色をぬったテープの長さ、水のかさを仮分数で
  { daimon: 1, sub: '①', title: 'テープの長さを仮分数で', section: '表', points: 5, skillId: 'hyo-tape', gen: () => frac('hyo-tape', 'tape') },
  { daimon: 1, sub: '②', title: '水のかさを仮分数で', section: '表', points: 5, skillId: 'hyo-tape', gen: () => frac('hyo-tape', 'cup') },
  // 大問2: 仮分数を帯分数か整数に、帯分数を仮分数に
  { daimon: 2, sub: '①', title: '仮分数を帯分数に', section: '表', points: 5, skillId: 'hen-mixed', gen: () => frac('hen-mixed', 'mixed') },
  { daimon: 2, sub: '②', title: '仮分数を整数に', section: '表', points: 5, skillId: 'hen-mixed', gen: () => frac('hen-mixed', 'whole') },
  { daimon: 2, sub: '③', title: '帯分数を仮分数に', section: '表', points: 5, skillId: 'hen-imp', gen: () => frac('hen-imp', 'mixed') },
  { daimon: 2, sub: '④', title: '帯分数を仮分数に', section: '表', points: 5, skillId: 'hen-imp', gen: () => frac('hen-imp', 'mixed') },
  // 大問3: 数直線で大きさの等しい分数
  { daimon: 3, sub: '①', title: '大きさの等しい分数（数直線）', section: '表', points: 5, skillId: 'eq-line', gen: () => frac('eq-line', 'up') },
  { daimon: 3, sub: '②', title: '大きさの等しい分数（数直線）', section: '表', points: 5, skillId: 'eq-line', gen: () => frac('eq-line', 'down') },
  // 大問4: 不等号
  { daimon: 4, sub: '①', title: '不等号（帯分数と仮分数）', section: '表', points: 5, skillId: 'cmp-same', gen: () => frac('cmp-same', 'mix') },
  { daimon: 4, sub: '②', title: '不等号（分子が同じ）', section: '表', points: 5, skillId: 'cmp-num', gen: () => frac('cmp-num') },
  // 大問5: たし算
  { daimon: 5, sub: '①', title: 'たし算（真分数＋真分数）', section: '表', points: 5, skillId: 'add-basic', gen: () => frac('add-basic', 'imp') },
  { daimon: 5, sub: '②', title: 'たし算（帯分数＋帯分数）', section: '表', points: 5, skillId: 'add-mixed', gen: () => frac('add-mixed') },
  { daimon: 5, sub: '③', title: 'たし算（整数＋帯分数）', section: '表', points: 5, skillId: 'add-whole', gen: () => frac('add-whole', 'wf') },
  { daimon: 5, sub: '④', title: 'たし算（くり上がり）', section: '表', points: 5, skillId: 'add-carry', gen: () => frac('add-carry', 'mf') },
  { daimon: 5, sub: '⑤', title: 'たし算（答えが整数）', section: '表', points: 5, skillId: 'add-one', gen: () => frac('add-one', 'mf') },
  // 大問6: ひき算
  { daimon: 6, sub: '①', title: 'ひき算（仮分数－真分数）', section: '表', points: 5, skillId: 'sub-basic', gen: () => frac('sub-basic') },
  { daimon: 6, sub: '②', title: 'ひき算（帯分数－帯分数）', section: '表', points: 5, skillId: 'sub-mixed', gen: () => frac('sub-mixed') },
  { daimon: 6, sub: '③', title: 'ひき算（帯分数－整数）', section: '表', points: 5, skillId: 'sub-whole', gen: () => frac('sub-whole') },
  { daimon: 6, sub: '④', title: 'ひき算（くり下がり）', section: '表', points: 5, skillId: 'sub-borrow', gen: () => frac('sub-borrow', 'mf') },
  { daimon: 6, sub: '⑤', title: 'ひき算（整数－分数）', section: '表', points: 5, skillId: 'sub-from', gen: () => frac('sub-from', 'one') },

  /* ===== 裏・思考判断表現（計50点） ===== */
  { daimon: 7, title: '文章題（たし算・式と答え）', section: '裏', points: 20, skillId: 'wp-add', gen: () => frac('wp-add', 'carry') },
  { daimon: 8, title: '文章題（ひき算・ちがい）', section: '裏', points: 20, skillId: 'wp-sub', gen: () => frac('wp-sub', 'borrow') },
  { daimon: 9, title: '仮分数を大きい順に', section: '裏', points: 10, skillId: 'cmp-order', gen: () => frac('cmp-order', 'paper') },

  /* ===== いかそう算数（参考・点数なし） ===== */
  { daimon: 10, title: 'いかそう算数（しゅくだい どこまで進んだ？）', section: '参考', points: 0, skillId: 'wp-prog', gen: () => frac('wp-prog') },
];

export function describeProblem(tp: TestProblem): { q: string; a: string } {
  return tp.kind === 'frac' ? { q: tp.p.q, a: tp.p.a } : describeError(tp.p);
}

export const OMOTE_MAX = TEST_STEPS.filter((s) => s.section === '表').reduce((a, s) => a + s.points, 0); // 100
export const URA_MAX = TEST_STEPS.filter((s) => s.section === '裏').reduce((a, s) => a + s.points, 0);   // 50
export const TOTAL_MAX = OMOTE_MAX + URA_MAX; // 150

/* ---------------- テストのあとに出す「やり方の一言」 ---------------- */

/**
 * まちがえた問題に添える、やり方のひとこと。
 * テスト中は出さない（テストとして成り立たなくなる）。終わってから、まちがえた問題にだけ添える。
 * 項目ごとに書いたものが無ければ、モジュール（記号の前半）のものを使う。
 */
const HOW_BY_SKILL: Record<string, string> = {
  'hyo-kind': '真分数＝分子＜分母、仮分数＝分子≧分母、帯分数＝整数＋真分数。',
  'hyo-unit': '1 は 1/□ の □こ分。仮分数の 分子が「何こ分」を あらわす。',
  'hyo-tape': '1目もりが 何分の1かを 見て、ぜんぶで 何目もり あるかを 数える。分母は 1を いくつに 分けたか（ぜんぶの 目もりの 数では ない）。',
  'hyo-draw': '1目もりは 1/□。仮分数の 分子の 数だけ ぬる。帯分数なら 整数 × 分母 ＋ 分子。',
  'hyo-line': '0から 1までを いくつに 分けたかを 見て、0から 目もりを 数える。',
  'hen-mixed': '分子 ÷ 分母。商が 整数、あまりが 分子、分母は そのまま。わりきれたら 整数。',
  'hen-div': '分子 ÷ 分母 の 商と あまりを 出して、商が 整数、あまりが 分子。',
  'hen-imp': '整数 × 分母 ＋ 分子 が 仮分数の 分子。分母は そのまま。',
  'eq-line': '数直線で、その 分数の 目もりから まっすぐ たどって、ぴったり そろう 目もりを さがす。',
  'eq-tap': '同じ 大きさの 分数は、数直線で たてに ぴったり そろう。',
  'eq-pick': '分母と 分子に 同じ数を たしても 等しく ならない。数直線で たしかめよう。',
  'cmp-same': '帯分数と 仮分数は、どちらかの 形に そろえてから くらべる。分母が 同じなら 分子で くらべる。',
  'cmp-num': '分子が 同じなら、分母が 小さい ほうが 大きい（1つ分が 大きい）。',
  'cmp-order': '仮分数を 帯分数か 整数に なおして、整数の ところ → 分数の ところ の じゅんに くらべる。',
  'add-fig': '1/□ の 何こ分かを たす。分母は そのまま。',
  'add-basic': '分母は そのまま、分子だけ たす。仮分数に なったら 帯分数に なおしても よい。',
  'add-mixed': '整数どうし、分数どうしを たす。',
  'add-whole': '整数は 整数どうしで たす。分子に たさない。',
  'add-carry': '分数の ところが 1より 大きく なったら、1を 整数に くり上げる。',
  'add-one': '分数の ところが 分母と 同じ（＝1）に なったら、整数に 1 たす。',
  'sub-basic': '分母は そのまま、分子だけ ひく。',
  'sub-mixed': '整数どうし、分数どうしを ひく。',
  'sub-whole': '整数どうしを ひいて、分数の ところは そのまま。',
  'sub-borrow': '分数の ところが ひけない ときは、整数から 1 くり下げて 分数に たしてから ひく。',
  'sub-from': '整数から 1 くり下げて、分母が 同じ 分数（1 ＝ □/□）に なおしてから ひく。',
  'wp-add': '「あわせて」「全体」は たし算。帯分数の たし算で くり上がりに 気をつける。',
  'wp-sub': '「ちがい」は 大きい ほうから 小さい ほうを ひく。くり下がりに 気をつける。',
  'wp-rem': '「のこり」は はじめの 量 － 使った 量。',
  'wp-prog': '「のこり」で 言って いる 人は、1 － のこり で 終わった ぶんに なおして くらべる。',
};

const HOW_BY_MODULE: Record<string, string> = {
  hyo: '1目もりが 何分の1かを 見て、何こ分かを 数えよう。',
  hen: '仮分数 → 帯分数は 分子 ÷ 分母、帯分数 → 仮分数は 整数 × 分母 ＋ 分子。',
  eq: '数直線を ならべて、たてに そろう 目もりを さがそう。',
  cmp: '形を そろえて くらべよう。分子が 同じなら 分母が 小さい ほうが 大きい。',
  add: '分母は そのまま、分子だけ たす。1を こえたら くり上げ。',
  sub: '分母は そのまま、分子だけ ひく。ひけない ときは くり下げ。',
  wp: '場面を 図に して、何を もとめるのか 決めてから 式を たてよう。',
  eh: 'まず 自分で 計算して、ノートの 答えと くらべよう。',
  mock: '見直しは「分母は そのままか」「くり上がり・くり下がり」を たしかめると いいよ。',
};

export function howTo(skillId: string): string {
  return HOW_BY_SKILL[skillId]
    ?? HOW_BY_MODULE[skillId.split('-')[0] ?? '']
    ?? 'もう一度 ゆっくり やってみよう。';
}

/** その項目を練習できるモジュール。テストのあと「れんしゅうする」で飛ぶ先。 */
export function practiceModuleOf(skillId: string): ModuleId | null {
  const head = skillId.split('-')[0] ?? '';
  const map: Record<string, ModuleId> = {
    hyo: 'hyo', hen: 'hen', eq: 'eq', cmp: 'cmp', add: 'add', sub: 'sub', wp: 'word-problem', eh: 'error-hunter',
  };
  return map[head] ?? null;
}
