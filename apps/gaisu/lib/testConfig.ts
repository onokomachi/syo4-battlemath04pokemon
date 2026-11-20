// このファイルは単元アプリ syo4-gaisu の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 * 実際の単元テスト「7. がい数の表し方と使い方」（表=知識・技能100点 / 裏=思考・判断・表現50点 /
 * いかそう算数=参考）と同じ大問構成・同じ問題形式で再現する（数値はランダム生成）。
 * 各設問は既存ジェネレータを呼び、既存アクティビティで解く。
 * 採点: ノーミス完答=満点、ミスありで完答=0点（＝一発正解を採点）。
 */
import {
  MeaningLevel, MeaningNumberProblem, MeaningSceneProblem, generateMeaningNumber, generateMeaningScene,
  RoundPlaceProblem, RoundDigitProblem, RoundChooseProblem, generateRoundPlace, generateRoundDigit, generateRoundChoose,
  RangeLevel, RangeProblem, generateRange,
  SumDiffLevel, SumDiffProblem, generateSumDiff,
  ProdQuotLevel, ProdQuotProblem, generateProdQuot,
  RoundJudgeBudgetProblem, generateRoundJudgeBudget,
} from './problems';
import { skillToModuleId, type ModuleId } from '../store/progressStore';

export type TestProblem =
  | { kind: 'meaning-num'; level: MeaningLevel; p: MeaningNumberProblem }
  | { kind: 'meaning-scene'; p: MeaningSceneProblem }
  | { kind: 'round-place'; p: RoundPlaceProblem }
  | { kind: 'round-digit'; k: 1 | 2; p: RoundDigitProblem }
  | { kind: 'round-choose'; p: RoundChooseProblem }
  | { kind: 'range'; level: RangeLevel; p: RangeProblem }
  | { kind: 'sumdiff'; level: SumDiffLevel; p: SumDiffProblem }
  | { kind: 'prodquot'; level: ProdQuotLevel; p: ProdQuotProblem }
  | { kind: 'roundjudge-budget'; p: RoundJudgeBudgetProblem };

export type Section = '表' | '裏' | '参考';

export interface TestStep {
  daimon: number;
  sub?: string;
  title: string;
  section: Section;
  points: number;
  /** モジュールが recordResult に記録するのと同じ skillId（ボス戦の苦手スキル重みづけに使う） */
  skillId: string;
  gen: () => TestProblem;
}

function retry<T>(gen: () => T, pred: (x: T) => boolean, max = 500): T {
  for (let i = 0; i < max; i++) {
    const x = gen();
    if (pred(x)) return x;
  }
  return gen();
}

const meaningNum = (level: MeaningLevel): TestProblem => ({ kind: 'meaning-num', level, p: generateMeaningNumber(level as 'meaning-man' | 'meaning-sen') });
const roundPlace = (pred?: (p: RoundPlaceProblem) => boolean): TestProblem =>
  ({ kind: 'round-place', p: pred ? retry(generateRoundPlace, pred) : generateRoundPlace() });
const roundDigit = (k: 1 | 2): TestProblem => ({ kind: 'round-digit', k, p: generateRoundDigit(k) });
const roundChoose = (): TestProblem => ({ kind: 'round-choose', p: generateRoundChoose() });
const range = (level: RangeLevel): TestProblem => ({ kind: 'range', level, p: generateRange(level) });
const sumdiff = (level: SumDiffLevel): TestProblem => ({ kind: 'sumdiff', level, p: generateSumDiff(level) });
const prodquot = (level: ProdQuotLevel): TestProblem => ({ kind: 'prodquot', level, p: generateProdQuot(level) });
const roundjudgeBudget = (): TestProblem => ({ kind: 'roundjudge-budget', p: generateRoundJudgeBudget() });

export const TEST_STEPS: TestStep[] = [
  /* ===== 表・知識技能（計100点） ===== */
  // 大問1: がい数の意味がわかる（約何万人）
  { daimon: 1, sub: '①', title: 'がい数の いみ（約何万）', section: '表', points: 5, skillId: 'meaning-man', gen: () => meaningNum('meaning-man') },
  { daimon: 1, sub: '②', title: 'がい数の いみ（約何万）', section: '表', points: 5, skillId: 'meaning-man', gen: () => meaningNum('meaning-man') },

  // 大問2: 四捨五入して指定の位までのがい数に（3問）
  { daimon: 2, sub: '①', title: '四捨五入（千の位までの がい数）', section: '表', points: 5, skillId: 'round-place', gen: () => roundPlace((p) => p.unit === 1000) },
  { daimon: 2, sub: '②', title: '四捨五入（一万の位までの がい数）', section: '表', points: 5, skillId: 'round-place', gen: () => roundPlace((p) => p.unit === 10000) },
  { daimon: 2, sub: '③', title: '四捨五入（一万の位までの がい数・くり上がりあり）', section: '表', points: 5, skillId: 'round-place', gen: () => roundPlace((p) => p.unit === 10000 && String(p.n).length >= 6) },

  // 大問3: 四捨五入して上から2けたのがい数に（2問）
  { daimon: 3, sub: '①', title: '上から2けたの がい数', section: '表', points: 5, skillId: 'round-digit2', gen: () => roundDigit(2) },
  { daimon: 3, sub: '②', title: '上から2けたの がい数', section: '表', points: 5, skillId: 'round-digit2', gen: () => roundDigit(2) },

  // 大問4: がい数のもとの数の はんい（いちばん小さい数・大きい数・以上未満）
  { daimon: 4, title: 'もとの数の はんい（以上・未満）', section: '表', points: 15, skillId: 'range-hundreds', gen: () => range('range-hundreds') },

  // 大問5: 和や差の見積もり（3問）
  { daimon: 5, sub: '①', title: 'たし算の 見積もり', section: '表', points: 10, skillId: 'sumdiff-add', gen: () => sumdiff('sumdiff-add') },
  { daimon: 5, sub: '②', title: 'ひき算の 見積もり', section: '表', points: 10, skillId: 'sumdiff-sub', gen: () => sumdiff('sumdiff-sub') },
  { daimon: 5, sub: '③', title: '3つの数の 見積もり', section: '表', points: 10, skillId: 'sumdiff-triple', gen: () => sumdiff('sumdiff-triple') },

  // 大問6: 積や商の見積もり（2問）
  { daimon: 6, sub: '①', title: 'かけ算の 見積もり', section: '表', points: 10, skillId: 'prodquot-mul', gen: () => prodquot('prodquot-mul') },
  { daimon: 6, sub: '②', title: 'わり算の 見積もり', section: '表', points: 10, skillId: 'prodquot-div', gen: () => prodquot('prodquot-div') },

  /* ===== 裏・思考判断表現（計50点） ===== */
  // 大問7: 2つの条件（上から1けた・2けた）に合う数を選ぶ
  { daimon: 7, title: '条件に合う数を えらぶ', section: '裏', points: 10, skillId: 'round-choose', gen: () => roundChoose() },
  // 大問8: 積の見積もり文章題（入館料 × 人数）
  { daimon: 8, title: '見積もりの文章題（代金）', section: '裏', points: 20, skillId: 'prodquot-word', gen: () => prodquot('prodquot-word') },
  // 大問9: 切り上げて見積もり、予算内で買えるか判断する
  { daimon: 9, title: '切り上げの見積もりと 予算判定', section: '裏', points: 20, skillId: 'roundjudge-budget', gen: () => roundjudgeBudget() },

  /* ===== いかそう算数（参考・点数なし） ===== */
  { daimon: 10, title: 'いかそう算数（がい数を つかう場面）', section: '参考', points: 0, skillId: 'meaning-scene', gen: () => ({ kind: 'meaning-scene', p: generateMeaningScene() }) },
];

/**
 * テスト結果のきろく用に、各問題を「問題文」と「正しい答え」の文字列にする。
 * 児童の入力値そのものは保存せず、問題・正答・○×だけを残す。
 */
export function describeProblem(tp: TestProblem): { q: string; a: string } {
  switch (tp.kind) {
    case 'meaning-num':
      return { q: `${tp.p.n}${tp.p.itemUnit}（${tp.p.noun}）`, a: `約${tp.p.answerDigit}${tp.p.kind === 'man' ? '万' : '千'}` };
    case 'meaning-scene':
      return { q: tp.p.text, a: tp.p.correct === 'gaisu' ? 'がい数が よい' : '正確な数が よい' };
    case 'round-place':
      return { q: `${tp.p.n}（${tp.p.placeLabel}まで）`, a: String(tp.p.answer) };
    case 'round-digit':
      return { q: `${tp.p.n}（上から${tp.p.k}けた）`, a: String(tp.p.answer) };
    case 'round-choose':
      return { q: `上から1けたで${tp.p.v1}、上から2けたで${tp.p.v2}に なる数`, a: tp.p.choices[tp.p.answerIndex] };
    case 'range':
      return { q: `${tp.p.placeLabel}までの がい数にすると${tp.p.target}になる整数の はんい`, a: `${tp.p.min}〜${tp.p.max}（${tp.p.choices[tp.p.answerIndex]}）` };
    case 'sumdiff':
      return { q: tp.p.op, a: `≒ ${tp.p.answer}` };
    case 'prodquot':
      return { q: tp.p.text ?? tp.p.op, a: `≒ ${tp.p.answer}${tp.p.finalUnit ?? ''}` };
    case 'roundjudge-budget':
      return {
        q: `${tp.p.items.map((x) => `${x.name}${x.price}円`).join('・')}／予算${tp.p.budget}円`,
        a: `切り上げ／${tp.p.canBuy ? '買える' : '買えない'}`,
      };
  }
}

export const OMOTE_MAX = TEST_STEPS.filter((s) => s.section === '表').reduce((a, s) => a + s.points, 0); // 100
export const URA_MAX = TEST_STEPS.filter((s) => s.section === '裏').reduce((a, s) => a + s.points, 0);   // 50
export const TOTAL_MAX = OMOTE_MAX + URA_MAX; // 150

/* ---------------- テストのあとに出す「やり方の一言」 ---------------- */

/**
 * まちがえた問題に添える、やり方のひとこと。
 *
 * テスト中は出さない（テストとして成り立たなくなる）。**終わってから**
 * まちがえた問題にだけ添える。長い解説は読まれないので、1文にする。
 *
 * 項目ごとに書いたものが無ければ、モジュール（記号の前半）のものを使う。
 * 新しいレベルを足しても、説明が空になることがない。
 */
const HOW_BY_SKILL: Record<string, string> = {
  'round-place': '上から何けた目を 見るのかを 先に きめてから、その1つ下の位を 四捨五入しよう。',
  'round-digit2': '「上から2けたのがい数」は、上から3けた目を 四捨五入するよ。',
  'round-choose': '何の位までの がい数に するかで、見る位が 変わるよ。',
  'range-hundreds': 'いちばん小さい数は「◯◯0」、いちばん大きい数は「◯◯9」と考えよう。',
  'sumdiff-triple': '3つ以上でも やり方は 同じ。先に それぞれを がい数にしてから 計算しよう。',
  'prodquot-word': 'かけ算・わり算の 見積もりは、上から1けたの がい数に そろえると 速いよ。',
  'roundjudge-budget': '買い物は 多めに 見つもる（切り上げ）。足りなくなると こまるからだよ。',
};

const HOW_BY_MODULE: Record<string, string> = {
  meaning: 'がい数は「だいたいの数」。どのくらい ざっくり見るのかを 先に きめよう。',
  round: '四捨五入は、もとめる位の **1つ下** の位を 見るよ。',
  range: 'はんいは「いちばん小さい数」と「いちばん大きい数」を 両方 考えよう。',
  sumdiff: 'たし算・ひき算の 見積もりは、もとめる位に そろえてから 計算しよう。',
  prodquot: 'かけ算・わり算の 見積もりは、上から1けたに そろえると 計算しやすいよ。',
  roundjudge: '切り上げ・切り捨て・四捨五入は、場面で 使い分けるよ。',
  eh: 'どの位を 見て 四捨五入したのかを、順に たしかめよう。',
  mock: '見直しは「どの位まで もとめるのか」から。見る位を まちがえていないか 見よう。',
};

export function howTo(skillId: string): string {
  return HOW_BY_SKILL[skillId]
    ?? HOW_BY_MODULE[skillId.split('-')[0] ?? '']
    ?? 'もう一度 ゆっくり やってみよう。';
}

/** その項目を練習できるモジュール。テストのあと「れんしゅうする」で飛ぶ先。 */
export function practiceModuleOf(skillId: string): ModuleId | null {
  const m = skillToModuleId(skillId);
  return m === 'mock-test' || m === 'boss-battle' ? null : m;
}
