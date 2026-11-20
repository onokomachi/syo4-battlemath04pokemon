// このファイルは単元アプリ syo4-keisannokimari の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 * 実際の単元テスト（表=知識・技能100点 / 裏=思考・判断・表現50点）と同じ考え方で構成する。
 * 大問の並びと技能の配分は、市販の単元テストを丸数字単位で分類した結果に合わせている
 * （docs/COVERAGE_ANALYSIS.md 参照）。
 * 採点: ノーミス完答=満点、ミスありで完答=0点（＝一発正解を採点）。
 */
import {
  OrderLevel, OrderProblem, generateOrder,
  FirstProblem, generateFirst,
  ExpressLevel, ExpressProblem, generateExpress, type ExpressForm,
  KufuuLevel, KufuuProblem, generateKufuu,
  LawCheckLevel, LawCheckProblem, generateLawCheck,
  TimesLevel, TimesProblem, generateTimes,
  DotsLevel, DotsProblem, generateDots,
  ReadLevel, ReadProblem, generateRead,
  InverseLevel, InverseProblem, generateInverse,
} from './problems';
import { skillToModuleId, type ModuleId } from '../store/progressStore';

export type TestProblem =
  | { kind: 'order'; level: OrderLevel; p: OrderProblem }
  | { kind: 'first'; level: 'order-first'; p: FirstProblem }
  | { kind: 'express'; level: ExpressLevel; p: ExpressProblem }
  | { kind: 'kufuu'; level: KufuuLevel; p: KufuuProblem }
  | { kind: 'lawcheck'; level: LawCheckLevel; p: LawCheckProblem }
  | { kind: 'times'; level: TimesLevel; p: TimesProblem }
  | { kind: 'dots'; level: DotsLevel; p: DotsProblem }
  | { kind: 'read'; level: ReadLevel; p: ReadProblem }
  | { kind: 'inverse'; level: InverseLevel; p: InverseProblem };

export type Section = '表' | '裏' | '参考';

export interface TestStep {
  daimon: number;
  sub?: string;
  title: string;
  section: Section;
  points: number;
  gen: () => TestProblem;
  skillId: string;
}

/** 条件を満たすまでリトライする汎用ヘルパー */
function retry<T>(gen: () => T, pred: (x: T) => boolean, max = 500): T {
  for (let i = 0; i < max; i++) {
    const x = gen();
    if (pred(x)) return x;
  }
  return gen();
}

/* 式の形をねらって出題するための判定（テストに必ず出る形を確実に含めるため） */
const opsOf = (expr: string) => expr.replace(/[\d()]/g, '').split('');
const rankOf = (o: string) => (o === '×' || o === '÷' ? 2 : 1);
/** 24÷4×2 のように、同じ順位の演算子が( )なしで並ぶ式（左から順に計算する） */
const hasSameRankChain = (expr: string) =>
  !expr.includes('(') && opsOf(expr).some((o, i) => i > 0 && rankOf(opsOf(expr)[i - 1]) === rankOf(o));
/** 80÷4＋15×2 のように、かけ算・わり算が2か所ある式 */
const hasTwoMulDiv = (expr: string) => opsOf(expr).filter((o) => o === '×' || o === '÷').length >= 2;
/** (3×9－6)÷3 のように、( )の中が2つの計算になっている式 */
const hasInnerTwoOps = (expr: string) => ((expr.match(/\(([^)]*)\)/)?.[1] ?? '').replace(/\d/g, '').length >= 2);

const order = (level: OrderLevel, pred?: (p: OrderProblem) => boolean): TestProblem =>
  ({ kind: 'order', level, p: pred ? retry(() => generateOrder(level), pred) : generateOrder(level) });
const express = (level: ExpressLevel, form?: ExpressForm): TestProblem => ({ kind: 'express', level, p: generateExpress(level, form) });
const first = (pred?: (p: FirstProblem) => boolean): TestProblem =>
  ({ kind: 'first', level: 'order-first', p: pred ? retry(generateFirst, pred) : generateFirst() });
const hasParen = (expr: string) => expr.includes('(');
/** ( )の中が たし算・ひき算（( )がないと じゅんばんが かわる形。280÷(28－8) など） */
const parenMatters = (expr: string) => /\([^)]*[＋－][^)]*\)/.test(expr);
const kufuu = (level: KufuuLevel, pred?: (p: KufuuProblem) => boolean): TestProblem =>
  ({ kind: 'kufuu', level, p: pred ? retry(() => generateKufuu(level), pred) : generateKufuu(level) });
const lawcheck = (level: LawCheckLevel): TestProblem => ({ kind: 'lawcheck', level, p: generateLawCheck(level) });
const times = (level: TimesLevel): TestProblem => ({ kind: 'times', level, p: generateTimes(level) });
const dots = (level: DotsLevel): TestProblem => ({ kind: 'dots', level, p: generateDots(level) });
const read = (level: ReadLevel): TestProblem => ({ kind: 'read', level, p: generateRead(level) });
const inverse = (level: InverseLevel): TestProblem => ({ kind: 'inverse', level, p: generateInverse(level) });

export const TEST_STEPS: TestStep[] = [
  /*
   * 紙のテスト（新学社 4年東「8. 計算のきまり」）と同じ大問・配点にしている。
   * 表＝知識・技能100点（大問1〜4）、裏＝思考・判断・表現50点（大問5〜9）。数は毎回かわる。
   * 紙では「式」と「答え」が5点ずつの問題は、ここでは1問10点（式を組み立てて答えまで出す）にしている。
   */

  /* ===== 表・知識技能（100点） ===== */
  // 大問1: 計算をしましょう（6問×5点）— ( )つき2問・×÷が先2問・×÷が2つ・( )の中も2つ
  { daimon: 1, sub: '①', title: '計算（( )の中を先に）', section: '表', points: 5, skillId: 'order-2step', gen: () => order('order-2step', (p) => parenMatters(p.expr) && /^\d/.test(p.expr) && p.expr.includes('－(')) },
  { daimon: 1, sub: '②', title: '計算（( )の中を先に）', section: '表', points: 5, skillId: 'order-2step', gen: () => order('order-2step', (p) => parenMatters(p.expr) && /[×÷]\(/.test(p.expr)) },
  { daimon: 1, sub: '③', title: '計算（×÷を先に）', section: '表', points: 5, skillId: 'order-2step', gen: () => order('order-2step', (p) => !hasParen(p.expr) && !hasSameRankChain(p.expr)) },
  { daimon: 1, sub: '④', title: '計算（×÷を先に）', section: '表', points: 5, skillId: 'order-2step', gen: () => order('order-2step', (p) => !hasParen(p.expr) && !hasSameRankChain(p.expr)) },
  { daimon: 1, sub: '⑤', title: '計算（×÷が2つ）', section: '表', points: 5, skillId: 'order-3step', gen: () => order('order-3step', (p) => hasTwoMulDiv(p.expr) && !hasParen(p.expr)) },
  { daimon: 1, sub: '⑥', title: '計算（( )の中も2つ）', section: '表', points: 5, skillId: 'order-3step', gen: () => order('order-3step', (p) => hasInnerTwoOps(p.expr)) },

  // 大問2: いちばんはじめに計算するところ（4問×5点）
  { daimon: 2, sub: '①', title: 'はじめに計算するところ（( )）', section: '表', points: 5, skillId: 'order-first', gen: () => first((p) => p.opAt.length === 2 && parenMatters(p.expr)) },
  { daimon: 2, sub: '②', title: 'はじめに計算するところ（( )の中の×÷）', section: '表', points: 5, skillId: 'order-first', gen: () => first((p) => hasInnerTwoOps(p.expr)) },
  { daimon: 2, sub: '③', title: 'はじめに計算するところ（( )の中が2つ）', section: '表', points: 5, skillId: 'order-first', gen: () => first((p) => hasParen(p.expr) && p.opAt.length === 3) },
  { daimon: 2, sub: '④', title: 'はじめに計算するところ（×÷が先）', section: '表', points: 5, skillId: 'order-first', gen: () => first((p) => !hasParen(p.expr) && p.opAt.length === 3) },

  // 大問3: くふうして計算（4問×10点。紙は □うめ5点＋答え5点）
  { daimon: 3, sub: '①', title: 'くふうして計算（(○＋△)×□ を分ける）', section: '表', points: 10, skillId: 'kufuu-distribute', gen: () => kufuu('kufuu-distribute', (p) => p.kind === 'compute' && /\(\d+＋\d+\)×/.test(p.text)) },
  { daimon: 3, sub: '②', title: 'くふうして計算（97 ＝ 100－3 とみる）', section: '表', points: 10, skillId: 'kufuu-distribute', gen: () => kufuu('kufuu-distribute', (p) => p.kind === 'compute' && p.text.includes('100－')) },
  { daimon: 3, sub: '③', title: 'くふうして計算（小数のたし算）', section: '表', points: 10, skillId: 'kufuu-decimal', gen: () => kufuu('kufuu-decimal') },
  { daimon: 3, sub: '④', title: 'くふうして計算（4×25 を先に）', section: '表', points: 10, skillId: 'kufuu-assoc', gen: () => kufuu('kufuu-assoc', (p) => p.kind === 'compute' && /^\d+×\d+×\d+ を/.test(p.text)) },

  // 大問4: 九九をもとにして積を求める（2問×5点）
  { daimon: 4, sub: '①', title: '九九をもとに（りょうほう10ばい）', section: '表', points: 5, skillId: 'times-both', gen: () => times('times-both') },
  { daimon: 4, sub: '②', title: '九九をもとに（かける数が何ばい）', section: '表', points: 5, skillId: 'times-single', gen: () => times('times-single') },

  /* ===== 裏・思考判断表現（50点） ===== */
  // 大問5〜8: 1つの式に表して答えを求める（各10点）
  { daimon: 5, title: '1つの式に（おつり・( )でまとめる）', section: '裏', points: 10, skillId: 'express-money', gen: () => express('express-money', 'change') },
  { daimon: 6, title: '1つの式に（テープを切り取ったのこり）', section: '裏', points: 10, skillId: 'express-mixed', gen: () => express('express-mixed', 'cut') },
  { daimon: 7, title: '1つの式に（2しゅるいを買った代金）', section: '裏', points: 10, skillId: 'express-money', gen: () => express('express-money', 'two') },
  { daimon: 8, title: '( )を使って1つの式に（組で買う）', section: '裏', points: 10, skillId: 'express-money', gen: () => express('express-money', 'sets') },
  // 大問9: 式はどの図で考えたものか（2問×5点）
  { daimon: 9, sub: '①', title: 'この式は どの数え方？', section: '裏', points: 5, skillId: 'read-dots', gen: () => read('read-dots') },
  { daimon: 9, sub: '②', title: 'この式は どの数え方？', section: '裏', points: 5, skillId: 'read-dots', gen: () => read('read-dots') },

  /* ===== いかそう算数（参考・点数なし）: 計算のじゅんばんを考える ===== */
  { daimon: 10, title: 'いかそう算数（場面に合う式は？）', section: '参考', points: 0, skillId: 'read-scene', gen: () => read('read-scene') },
];

/**
 * テスト結果のきろく用に、各問題を「問題文」と「正しい答え」の文字列にする。
 * 児童の入力値そのものは保存せず、問題・正答・○×だけを残す。
 */
export function describeProblem(tp: TestProblem): { q: string; a: string } {
  switch (tp.kind) {
    case 'order':
      return { q: tp.p.expr, a: String(tp.p.checkpoints[tp.p.checkpoints.length - 1].value) };
    case 'first':
      return { q: `${tp.p.expr} で はじめに計算するところ`, a: ['あ', 'い', 'う', 'え'][tp.p.correct] ?? '' };
    case 'express':
      return { q: tp.p.text, a: tp.p.choices[tp.p.correctIndex] };
    case 'kufuu':
      if (tp.p.kind === 'transform') return { q: tp.p.text, a: tp.p.choices[tp.p.correctIndex] };
      if (tp.p.kind === 'blank') return { q: `${tp.p.exprLeft} ＝ ${tp.p.exprRight}`, a: `□＝${tp.p.blankAnswer}` };
      return { q: tp.p.text, a: String(tp.p.answer) };
    case 'lawcheck':
      return { q: `${tp.p.claimLeft} ＝ ${tp.p.claimRight}`, a: tp.p.isTrue ? 'なりたつ' : 'なりたたない' };
    case 'times':
      return { q: tp.p.scaledText, a: String(tp.p.answer) };
    case 'dots':
      return { q: `${tp.p.rows}×${tp.p.cols}のL字（${tp.p.total}こ）`, a: tp.p.choices[tp.p.correctIndex] };
    case 'read':
      return tp.p.kind === 'dots'
        ? { q: `${tp.p.expr} は どの 数え方？`, a: tp.p.correctMode === 'subtract' ? '大きい長方形からひく' : '2つに分ける' }
        : { q: `${tp.p.expr} は どの 場面？`, a: tp.p.choices[tp.p.correctIndex] };
    case 'inverse':
      return { q: tp.p.expr, a: `□＝${tp.p.answer}` };
  }
}

export const OMOTE_MAX = TEST_STEPS.filter((s) => s.section === '表').reduce((a, s) => a + s.points, 0); // 100
export const URA_MAX = TEST_STEPS.filter((s) => s.section === '裏').reduce((a, s) => a + s.points, 0);   // 50
export const TOTAL_MAX = OMOTE_MAX + URA_MAX; // 150

/* ---------------- テストのあとに出す「やり方の一言」 ---------------- */

/**
 * まちがえた問題に添える、やり方のひとこと。
 * テスト中は出さない。**終わってから**まちがえた問題にだけ添える。
 * 項目ごとに書いたものが無ければ、モジュール（記号の前半）のものを使う。
 */
const HOW_BY_SKILL: Record<string, string> = {
  'order-first': '（　）の中 → かけ算・わり算 → たし算・ひき算。同じなかまは 左から。',
  'order-2step': '（　）の中 → かけ算・わり算 → たし算・ひき算 の 順だよ。',
  'order-3step': '計算の順は「（　）→ ×÷ → ＋−」。左から順ではないよ。',
  'kufuu-distribute': '（◯＋△）×□ は ◯×□＋△×□ に 分けられるよ。',
  'kufuu-assoc': 'かける順を 入れかえて、キリのいい数（10や100）を 先に作ろう。',
  'law-comm': 'たし算・かけ算は 順番を 入れかえても 答えは 同じ。ひき算・わり算は ちがうよ。',
  'law-assoc': 'まとめる場所を 変えても 答えは 同じ。（ ）の 付けかえで 楽になるよ。',
  'inverse-addsub': 'たし算の 逆は ひき算。□を もとめるときは 反対の計算を しよう。',
  'inverse-muldiv': 'かけ算の 逆は わり算。□を もとめるときは 反対の計算を しよう。',
  'dots-basic': '同じ形の かたまりを 見つけて、かけ算で まとめて数えよう。',
};

const HOW_BY_MODULE: Record<string, string> = {
  order: '計算の順は「（　）→ ×÷ → ＋−」。左から順ではないよ。',
  express: '場面を そのまま 1つの式に すると、順番の きまりが 生きてくるよ。',
  kufuu: 'キリのいい数（10・100）を 先に作ると、計算が ぐっと 楽になるよ。',
  law: 'たし算・かけ算は 入れかえても 同じ。ひき算・わり算は ちがうよ。',
  times: '「1つ分 × いくつ分」の かたちに あてはめて 考えよう。',
  dots: '同じ形の かたまりを 見つけて、かけ算で まとめて数えよう。',
  read: '式が どんな 数え方を 表しているかを、図と 見くらべよう。',
  inverse: '□を もとめるときは、反対の計算（逆算）を しよう。',
  eh: 'どの順で 計算したのかを、1つずつ 声に出して たどってみよう。',
  fix: 'どの順で 計算したのかを、1つずつ 声に出して たどってみよう。',
  mock: '見直しは 計算の順から。（　）と ×÷ を 先に していたか 見よう。',
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
