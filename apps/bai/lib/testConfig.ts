// このファイルは単元アプリ syo4-bainomikata の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 *
 * 実際の単元テスト「倍の見方」（表＝知識・技能100点／いかそう算数＝参考）を、
 * 大問の順序だけでなく「どの技能に何点ふられているか」まで一致させる。
 *
 * 現物のテストは丸数字❶〜⓴の20か所×5点＝100点で、その内訳は次のとおり：
 *   図（テープ図・数直線の□うめ）6か所 30点
 *   式                              6か所 30点
 *   答え                            5か所 25点
 *   「1とみると いくつにあたるか」  2か所 10点
 *   割合による判断                  1か所  5点
 * さらに「式の採点基準：計算の答えが誤っていても5点を配点してよい」と明記されており、
 * 式と答えは独立に採点される。よってここでも技能ごとに別々の設問として出す。
 *
 * 1つの大問の中の小問は同じ場面（同じ数値）を共有するので、
 * 問題は大問ごとに1回だけ生成し、小問はその problem を focus ちがいで解く。
 */
import {
  TimesLevel, BaseTimesProblem, generateTimes,
  CompareLevel, BaseCompareProblem, generateCompare,
  BaseLevel, BaseBaseProblem, generateBase,
  RatioCompareLevel, RatioCompareProblem, generateRatioCompare,
  WordLevel, BaiWordProblem,
  EhPreset, BaiErrorExample,
  KihonLevel, BaiTapeProblem,
} from './problems';
import { RoundFocus } from '../components/shared/roundTypes';
import { skillToModuleId, type ModuleId } from '../store/progressStore';

export type TestProblem =
  | { kind: 'kihon'; level: KihonLevel; p: BaiTapeProblem }
  | { kind: 'times'; level: TimesLevel; p: BaseTimesProblem }
  | { kind: 'compare'; level: CompareLevel; p: BaseCompareProblem }
  | { kind: 'base'; level: BaseLevel; p: BaseBaseProblem }
  | { kind: 'ratio'; level: RatioCompareLevel; p: RatioCompareProblem }
  | { kind: 'word'; level: WordLevel; p: BaiWordProblem }
  | { kind: 'error'; preset: EhPreset; p: BaiErrorExample };

export type Section = '表' | '参考';

/** 大問の中の1つの小問（＝採点の1単位） */
export interface TestPart {
  sub?: string;      // ①②③④
  title: string;     // 採点画面・ヘッダ用
  points: number;
  focus: RoundFocus; // どの技能を問うか
}

/** 大問（同じ場面を小問で共有する） */
export interface TestDaimon {
  daimon: number;
  section: Section;
  gen: () => TestProblem;
  parts: TestPart[];
}

const times = (level: TimesLevel): TestProblem => ({ kind: 'times', level, p: generateTimes(level) });
const compare = (level: CompareLevel): TestProblem => ({ kind: 'compare', level, p: generateCompare(level) });
const base = (level: BaseLevel): TestProblem => ({ kind: 'base', level, p: generateBase(level) });
const ratio = (level: RatioCompareLevel): TestProblem => ({ kind: 'ratio', level, p: generateRatioCompare(level) });

export const TEST_DAIMONS: TestDaimon[] = [
  /* 大問1（イルカ型）: 何倍かを もとめる。図2＋式1＋答1＋1とみる1 ＝ 25点 */
  {
    daimon: 1, section: '表', gen: () => times('times-big'),
    parts: [
      { sub: '①', title: '図の□に あてはまる数を書く', points: 10, focus: 'diagram' },
      { sub: '②', title: '何倍かを もとめる式', points: 5, focus: 'shiki' },
      { sub: '②', title: '何倍かを もとめる（答え）', points: 5, focus: 'answer' },
      { sub: '③', title: '1とみると いくつに あたるか', points: 5, focus: 'asview' },
    ],
  },
  /* 大問2（学校・ビル型）: 何倍かにあたる量。図2＋式1＋答1＋1とみる1 ＝ 25点 */
  {
    daimon: 2, section: '表', gen: () => compare('compare-big'),
    parts: [
      { sub: '①', title: '図の□に あてはまる数を書く', points: 10, focus: 'diagram' },
      { sub: '②', title: '何倍かにあたる量を もとめる式', points: 5, focus: 'shiki' },
      { sub: '②', title: '何倍かにあたる量（答え）', points: 5, focus: 'answer' },
      { sub: '③', title: '1とみると いくつに あたるか', points: 5, focus: 'asview' },
    ],
  },
  /* 大問3（りんご・メロン型）: もとにする量。図2＋関係式1＋式1＋答1 ＝ 25点 */
  {
    daimon: 3, section: '表', gen: () => base('base-big'),
    parts: [
      { sub: '①', title: '図の□に あてはまる数を書く', points: 10, focus: 'diagram' },
      { sub: '②', title: '□を使った かけ算の式に表す', points: 5, focus: 'relation' },
      { sub: '③', title: '□を もとめる式', points: 5, focus: 'shiki' },
      { sub: '③', title: 'もとにする量（答え）', points: 5, focus: 'answer' },
    ],
  },
  /* 大問4（ゴムA・B型）: 割合でくらべる。式2＋答2＋判断1 ＝ 25点 */
  {
    daimon: 4, section: '表', gen: () => ratio('ratio-compare-basic'),
    parts: [
      { sub: '①', title: 'A・Bの 倍を もとめる式', points: 10, focus: 'shiki' },
      { sub: '①', title: 'A・Bの 倍（答え）', points: 10, focus: 'answer' },
      { sub: '②', title: '割合で くらべて 判断する', points: 5, focus: 'judge' },
    ],
  },
  /* いかそう算数（参考・配点なし）: 差を自分で求めてから 倍でくらべる */
  {
    daimon: 5, section: '参考', gen: () => ratio('ratio-compare-diff'),
    parts: [
      { title: 'いかそう算数（差ではなく 倍で くらべる）', points: 0, focus: 'full' },
    ],
  },
];

/**
 * テスト結果のきろく用に、各設問を「問題文」と「正しい答え」の文字列にする。
 * 児童の入力値そのものは保存せず、問題・正答・○×だけを残す。
 */
export function describeProblem(tp: TestProblem, focus: RoundFocus): { q: string; a: string } {
  switch (tp.kind) {
    case 'times': {
      const { base: b, times: t, compare: c, scene } = tp.p;
      if (focus === 'diagram') return { q: `図の□（${scene.compareName}の${scene.measure}と、もとにする量の目もり）`, a: `${c}${scene.unit} と 1` };
      if (focus === 'shiki') return { q: `${scene.compareName}は ${scene.baseName}の 何倍かを もとめる式`, a: `${c} ÷ ${b}` };
      if (focus === 'asview') return { q: `${b}${scene.unit}を1とみると ${c}${scene.unit}は いくつに あたるか`, a: `${t}` };
      return { q: `${c} ÷ ${b}`, a: `${t}倍` };
    }
    case 'compare': {
      const { base: b, times: t, compare: c, scene } = tp.p;
      if (focus === 'diagram') return { q: `図の□（${scene.baseName}の${scene.measure}と、倍の目もり）`, a: `${b}${scene.unit} と ${t}` };
      if (focus === 'shiki') return { q: `${scene.compareName}の${scene.measure}を もとめる式`, a: `${b} × ${t}` };
      if (focus === 'asview') return { q: `${scene.baseName}を1とみると ${scene.compareName}は いくつに あたるか`, a: `${t}` };
      return { q: `${b} × ${t}`, a: `${c}${scene.unit}` };
    }
    case 'base': {
      const { base: b, times: t, compare: c, scene } = tp.p;
      if (focus === 'diagram') return { q: `図の□（${scene.compareName}の${scene.measure}と、もとにする量の目もり）`, a: `${c}${scene.unit} と 1` };
      if (focus === 'relation') return { q: `${scene.baseName}の${scene.measure}を□として かけ算の式に表す`, a: `□ × ${t} ＝ ${c}` };
      if (focus === 'shiki') return { q: `□を もとめる式`, a: `${c} ÷ ${t}` };
      return { q: `${c} ÷ ${t}`, a: `${b}${scene.unit}` };
    }
    case 'ratio': {
      const { pair, beforeA, afterA, timesA, beforeB, afterB, timesB, askSmaller, answerLabel, diffA } = tp.p;
      const label = answerLabel === 'A' ? pair.itemA : pair.itemB;
      if (focus === 'diff') return { q: `${pair.itemA}・${pair.itemB}は それぞれ 何${pair.unit} ふえたか`, a: `どちらも ${diffA}${pair.unit}` };
      if (focus === 'shiki') return { q: `${pair.itemA}・${pair.itemB}の 倍を もとめる式`, a: `${afterA} ÷ ${beforeA} と ${afterB} ÷ ${beforeB}` };
      if (focus === 'judge') return { q: `変化が ${askSmaller ? '小さい' : '大きい'}のは どちらか`, a: label };
      if (focus === 'full') {
        return {
          q: `${pair.itemA}(${beforeA}→${afterA}) と ${pair.itemB}(${beforeB}→${afterB})：差と倍で くらべる`,
          a: `${timesA}倍 と ${timesB}倍 → 変化が ${askSmaller ? '小さい' : '大きい'}のは ${label}`,
        };
      }
      return { q: `${pair.itemA}・${pair.itemB}は もとの 何倍か`, a: `${timesA}倍 と ${timesB}倍` };
    }
    case 'kihon': {
      const { base: b, times: t, compare: c, scene, missing } = tp.p;
      const ans = missing === 'compare' ? c : missing === 'times' ? t : b;
      return { q: `${scene.baseName} と ${scene.compareName}（${missing} を もとめる）`, a: String(ans) };
    }
    case 'word':
      if (tp.p.kind === 'ratio') {
        return { q: tp.p.text, a: `${tp.p.answerLabel === 'A' ? tp.p.pair?.itemA : tp.p.pair?.itemB}` };
      }
      return { q: tp.p.text, a: `${tp.p.finalAnswer}${tp.p.finalUnit}` };
    case 'error':
      return { q: `まちがい探し「${tp.p.wrongExpr}」`, a: `正しくは ${tp.p.correctExpr}` };
  }
}

const sumPoints = (section: Section) =>
  TEST_DAIMONS.filter((d) => d.section === section)
    .reduce((a, d) => a + d.parts.reduce((x, p) => x + p.points, 0), 0);

export const OMOTE_MAX = sumPoints('表');    // 100
export const SANKOU_MAX = sumPoints('参考'); // 0
export const TOTAL_MAX = OMOTE_MAX + SANKOU_MAX;

/* ---------------- 答案に残す記号と、テストのあとの「やり方」 ---------------- */

/**
 * 出題から項目の記号を取り出す。カタログと同じ文字列にする。
 * 大問の題名は問題を作り直すたびに変わりうるので、集計の軸にはできない。
 */
export function skillIdOf(tp: TestProblem): string {
  return tp.kind === 'error' ? (tp.preset as string) : (tp.level as string);
}

/**
 * まちがえた問題に添える、やり方のひとこと。
 * テスト中は出さない。**終わってから**まちがえた問題にだけ添える。
 */
const HOW_BY_SKILL: Record<string, string> = {
  'times-big': 'もとにする量を 1と 見て、くらべる量が その 何こ分かを 考えよう。',
  'compare-big': 'くらべる量 ÷ もとにする量 で 倍が もとめられるよ。',
  'base-big': 'もとにする量は、くらべる量 ÷ 倍 で もとめられるよ。',
  'ratio-compare-diff': '「どちらが よく のびたか」は 差ではなく 倍で くらべるよ。',
  'ratio-compare-basic': 'もとにする量が ちがうときは、倍に して そろえてから くらべよう。',
};

const HOW_BY_MODULE: Record<string, string> = {
  kihon: 'まず テープ図の どこが「もとにする量」かを 決めよう。そこが 1だよ。',
  times: 'もとにする量を 1と 見て、その 何こ分かを 考えよう。',
  compare: 'くらべる量 ÷ もとにする量 ＝ 倍。',
  base: 'もとにする量 ＝ くらべる量 ÷ 倍。',
  ratio: '差では なく 倍で くらべると、もとの大きさが ちがっても くらべられるよ。',
  wp: '文から「もとにする量」と「くらべる量」を 先に 見つけよう。',
  eh: 'どれを 1と 見たのかを たしかめよう。そこが ちがうと 答えも ずれるよ。',
  mock: '見直しは「もとにする量は どれか」から。1と 見るものを まちがえていないか 見よう。',
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
