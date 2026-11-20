// このファイルは単元アプリ syo4-mennsekinokurabekatatoarawasikata の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 * 紙の単元テスト（新学社 4年東 下巻「12. 面積のくらべ方と表し方」）と同じ大問・小問・配点にしてある。
 *   表＝知識・技能 100点（大問1〜7）／裏＝思考・判断・表現 50点（大問8〜10）／いかそう算数＝参考（0点）
 * 数は毎回ランダムに作る。各設問は lib/problems.ts のジェネレーターで作り、練習と同じ画面（QuestionRound）で解く。
 * 採点: ノーミス完答＝満点、ミスありで完答＝0点（＝一発正解を採点）。
 * 紙で「式・答 各5点」の問いは、式と答えを1問のステップにまとめて 10点（部分点は無い。docs/DESIGN.md「紙との差」）。
 */
import {
  generate, genGridCount, genGridHalf, genFormulaWord, genUnitM2, genUnitAha, genUnitChoose,
  genFormulaSquare, genCalcKm, genCalcMixunit, genCalcA, genCalcHa,
} from './problems';
import type { Question } from './question';
import { skillToModuleId, type ModuleId } from '../store/progressStore';

export type TestProblem = Question;

export type Section = '表' | '裏' | '参考';

export interface TestStep {
  daimon: number;
  sub?: string;        // ①②③
  title: string;       // 大問の説明（採点画面・ヘッダ用）
  section: Section;
  points: number;      // 配点（参考は 0）
  gen: () => TestProblem;
  /** 練習モードと同じ命名の習熟度キー（例: 'calc-a'）。ボスモード・実力の階段に使う。 */
  skillId: string;
}

const step = (daimon: number, sub: string | undefined, title: string, section: Section, points: number, skillId: string, gen?: () => TestProblem): TestStep => ({
  daimon, sub, title, section, points, skillId, gen: gen ?? (() => generate(skillId)),
});

export const TEST_STEPS: TestStep[] = [
  /* ===== 表・知識技能（計100点） ===== */
  // 大問1: 方眼の図形の面積（各5点）
  step(1, 'あ', '方眼の 形の 面積', '表', 5, 'grid-count', genGridCount),
  step(1, 'い', 'ななめ半分を ふくむ 形の 面積', '表', 5, 'grid-half', genGridHalf),
  // 大問2: 面積を求める公式（各5点）
  step(2, '①', '長方形の 面積の 公式', '表', 5, 'formula-word', () => genFormulaWord('rect')),
  step(2, '②', '正方形の 面積の 公式', '表', 5, 'formula-word', () => genFormulaWord('square')),
  // 大問3: 1m²＝□cm²、1km²＝□m²（各5点）
  step(3, '①', 'm²と cm²', '表', 5, 'unit-m2', () => genUnitM2('m2', 5)),
  step(3, '②', 'km²と m²', '表', 5, 'unit-m2', () => genUnitM2('km2', 5)),
  // 大問4: 面積の単位 a・ha（各5点）
  step(4, '①', '1辺10mの 正方形の 面積', '表', 5, 'unit-aha', () => genUnitAha('10m')),
  step(4, '②', '1辺100mの 正方形の 面積', '表', 5, 'unit-aha', () => genUnitAha('100m')),
  // 大問5: 面積の単位えらび（cm²・m²）（各5点）
  step(5, '①', '面積の 単位えらび', '表', 5, 'unit-choose', () => genUnitChoose(true)),
  step(5, '②', '面積の 単位えらび（もう1問）', '表', 5, 'unit-choose', () => genUnitChoose(true)),
  // 大問6: 正方形・長方形の面積（式・答 各5点）
  step(6, '①', '正方形の 面積（式・答え）', '表', 10, 'formula-square', () => genFormulaSquare(false)),
  step(6, '②', '長方形の 面積 km²（式・答え）', '表', 10, 'calc-km', () => genCalcKm(true)),
  step(6, '③', 'cm と m の 長方形（式・答え）', '表', 10, 'calc-mixunit', () => genCalcMixunit('m')),
  // 大問7: a・ha の単位で求める（式・答 各5点）
  step(7, '①', 'a で 求める（式・答え）', '表', 10, 'calc-a', genCalcA),
  step(7, '②', 'ha で 求める（式・答え）', '表', 10, 'calc-ha', genCalcHa),

  /* ===== 裏・思考判断表現（計50点） ===== */
  // 大問8: まわりの長さが同じ長方形の面積の変わり方（各10点）
  step(8, '①', 'まわりが 同じ 長方形の 表', '裏', 10, 'change-table'),
  step(8, '②', '横の 長さと 面積の 折れ線グラフ', '裏', 10, 'change-graph'),
  // 大問9: 面積と横から たてを求める（式・答 各10点）
  step(9, undefined, '面積と 横から たての 長さ（式・答え）', '裏', 20, 'side-find'),
  // 大問10: L字形の面積の求め方を式から選ぶ（10点）
  step(10, undefined, '考え方を 表す 式を えらぶ', '裏', 10, 'comp-which'),

  /* ===== いかそう算数（参考・点数なし） ===== */
  step(11, undefined, 'いかそう算数（道を はしに よせて 広さを くらべる）', '参考', 0, 'comp-road'),
];

/**
 * テスト結果のきろく用に、各問題を「問題文」と「正しい答え」の文字列にする。
 * 児童の入力値そのものは保存せず、問題・正答・○×だけを残す。
 */
export function describeProblem(tp: TestProblem): { q: string; a: string } {
  return { q: tp.q, a: tp.a };
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
  'grid-count': '1マス（1辺1cmの 正方形）が 1cm²。しるしを つけながら 数えよう。',
  'grid-half': 'ななめ半分の 三角は 2つで 1cm²。全部の マスと 分けて 数えよう。',
  'grid-compare': '1cm²の いくつ分かを 数えて くらべる。ちがいは ひき算。',
  'formula-word': '長方形の 面積 ＝ たて × 横、正方形の 面積 ＝ 1辺 × 1辺。',
  'formula-rect': '長方形の 面積 ＝ たて × 横。答えの 単位は cm² や m²。',
  'formula-square': '正方形の 面積 ＝ 1辺 × 1辺。',
  'unit-m2': '1m² ＝ 100cm × 100cm ＝ 10000cm²、1km² ＝ 1000m × 1000m ＝ 1000000m²。',
  'unit-aha': '1辺 10m の 正方形 ＝ 1a、1辺 100m の 正方形 ＝ 1ha。',
  'unit-choose': '1辺 1cm・1m・10m・100m・1km の 正方形を 思いうかべて、くらべよう。',
  'calc-km': '長方形の 面積 ＝ たて × 横。km どうしを かけると km²。',
  'calc-mixunit': 'かける前に 単位を そろえる（100cm ＝ 1m）。',
  'calc-a': 'まず m² で 求めて、100m² ＝ 1a で なおす。',
  'calc-ha': 'まず m² で 求めて、10000m² ＝ 1ha で なおす。',
  'change-table': 'たて ＋ 横 ＝ まわりの 長さの 半分。面積 ＝ たて × 横。',
  'change-graph': '横の 長さの 位置に、表の 数の 高さで 点を うつ。',
  'side-find': '□ × 横 ＝ 面積。□ ＝ 面積 ÷ 横。',
  'comp-which': '図の 点線で 分けた 長方形 1つが、式の かけ算 1つ。',
  'comp-road': '道を はしに よせると、のこりが 1つの 長方形に なって 求めやすい。',
};

const HOW_BY_MODULE: Record<string, string> = {
  grid: '1cm²の いくつ分で 面積を 表す。',
  formula: '長方形 ＝ たて × 横、正方形 ＝ 1辺 × 1辺。',
  unit: '面積の 単位は 1辺が 10倍 → 100倍。1a＝100m²、1ha＝10000m²。',
  calc: '単位を そろえて から 公式に あてはめよう。',
  side: '面積 ÷ 横 ＝ たて。',
  comp: '長方形に 分ける・大きい 長方形から ひく。',
  change: 'たて ＋ 横 は いつも 同じ。面積は 正方形の とき いちばん 大きい。',
  eh: '公式・単位の かんけいを 見なおそう。',
  mock: '見直しは「単位」と「たて × 横」から。',
};

export function howTo(skillId: string): string {
  return HOW_BY_SKILL[skillId]
    ?? HOW_BY_MODULE[skillId.split('-')[0] ?? '']
    ?? 'もう一度 ゆっくり やってみよう。';
}

/** その項目を練習できるモジュール。テストのあと「れんしゅうする」で飛ぶ先。 */
export function practiceModuleOf(skillId: string): ModuleId | null {
  const id = skillToModuleId(skillId);
  return id && id !== 'mock-test' && id !== 'boss-battle' ? id : null;
}
