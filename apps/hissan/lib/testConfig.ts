// このファイルは単元アプリ wari-hissann3 の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 * 実際の単元テスト「6. わり算の筆算(2)」（表=知識・技能100点 / 裏=思考・判断・表現50点 / いかそう算数=参考）
 * と同じ大問構成・同じ問題形式で再現する（数値はランダム生成）。
 * 各設問は既存ジェネレータを呼び、既存アクティビティで解く。
 * 採点: ノーミス完答=満点、ミスありで完答=0点（＝一発正解を採点）。
 */
import {
  MentalLevel, SimpleDivProblem, generateMental,
  RulesLevel, RulesProblem, generateRules,
  EstimateLevel, EstimateProblem, generateEstimate,
  CheckLevel, CheckProblem, generateCheck,
  WordLevel, DivWordProblem, generateWord,
  EhPreset, DivErrorExample, makeDivError,
} from './problems';
import { generateProblem } from '../components/ProblemGenerator';
import { Difficulty, Problem } from '../types';
import type { ModuleId } from '../store/progressStore';

export type TestProblem =
  | { kind: 'mental'; level: MentalLevel; p: SimpleDivProblem }
  | { kind: 'rules'; level: RulesLevel; p: RulesProblem }
  | { kind: 'estimate'; level: EstimateLevel; p: EstimateProblem }
  | { kind: 'check'; level: CheckLevel; p: CheckProblem }
  | { kind: 'word'; level: WordLevel; p: DivWordProblem }
  | { kind: 'error'; preset: EhPreset; p: DivErrorExample }
  | { kind: 'hissan'; diff: Difficulty; p: Problem };

export type Section = '表' | '裏' | '参考';

export interface TestStep {
  daimon: number;
  sub?: string;        // ①②③④
  title: string;       // 大問の説明（採点画面・ヘッダ用）
  section: Section;
  points: number;      // 配点（参考は 0）
  gen: () => TestProblem;
  /** 練習モードと同じ命名の習熟度キー（例: 'rules-tens'）。ボスモードの重点出題に使う。 */
  skillId: string;
}

function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

/* ---------- 形状指定つきの生成ヘルパー ---------- */

/** 条件を満たす筆算問題が出るまでリトライ */
function hissanShape(diff: Difficulty, pred: (p: Problem) => boolean): Problem {
  for (let i = 0; i < 800; i++) {
    const p = generateProblem(diff, true, true);
    if (pred(p)) return p;
  }
  return generateProblem(diff, true, true);
}

/** 最初の仮商（四捨五入の見当）が真の商とずれる＝仮商修正が必要か */
function needsTrialAdjust(p: Problem): boolean {
  const s = p.dividend.toString();
  let cur = 0;
  let i = 0;
  for (; i < s.length; i++) {
    cur = cur * 10 + Number(s[i]);
    if (cur >= p.divisor) break;
  }
  const trueDigit = Math.floor(cur / p.divisor);
  const rounded = Math.max(10, Math.round(p.divisor / 10) * 10);
  let est = Math.floor(cur / rounded);
  if (est < 1) est = 1;
  if (est > 9) est = 9;
  return est !== trueDigit;
}

/** 条件を満たすまでリトライする汎用ヘルパー */
function retry<T>(gen: () => T, pred: (x: T) => boolean, max = 800): T {
  for (let i = 0; i < max; i++) {
    const x = gen();
    if (pred(x)) return x;
  }
  return gen();
}

/** 大問11: 包含除（2けたずつ箱づめ）・あまりあり の文章題を組み立てる */
function makeGroup2Digit(): DivWordProblem {
  const size = rnd(11, 15);
  const q = rnd(5, 9);
  const r = rnd(1, size - 1);
  const total = size * q + r;
  const item = pick([
    { name: 'おかし', box: '箱', unit: 'こ', emoji: '🍪' },
    { name: 'ボール', box: 'かご', unit: 'こ', emoji: '⚾' },
    { name: 'えんぴつ', box: '箱', unit: '本', emoji: '✏️' },
  ]);
  const options = [`${total} ÷ ${size}`, `${size} ÷ ${total}`, `${total} × ${size}`].sort(() => Math.random() - 0.5);
  return {
    text: `${item.name}が ${total}${item.unit} あります。${size}${item.unit}ずつ ${item.box}に つめると、何${item.box} できて、何${item.unit} あまりますか？`,
    emoji: item.emoji,
    dividend: total, divisor: size,
    choices: options, correctIndex: options.indexOf(`${total} ÷ ${size}`),
    quotient: q, remainder: r,
    finalKind: 'quot-rem', finalAnswer: q, finalUnit: item.box,
    finalPrompt: `何${item.box}できて 何${item.unit}あまる？`,
    why: `「${size}${item.unit}ずつ とると いくつ分？」は わり算（包含除）だよ。`,
    finalWhy: `${total} ÷ ${size} ＝ ${q} あまり ${r}。${q}${item.box} できて ${r}${item.unit} あまるね。たしかめ算：${size} × ${q} ＋ ${r} ＝ ${total}。`,
  };
}

const mental = (level: MentalLevel): TestProblem => ({ kind: 'mental', level, p: generateMental(level) });
const rules = (level: RulesLevel, pred?: (p: RulesProblem) => boolean): TestProblem =>
  ({ kind: 'rules', level, p: pred ? retry(() => generateRules(level), pred) : generateRules(level) });
const estimate = (level: EstimateLevel, pred?: (p: EstimateProblem) => boolean): TestProblem =>
  ({ kind: 'estimate', level, p: pred ? retry(() => generateEstimate(level), pred) : generateEstimate(level) });
const check = (level: CheckLevel): TestProblem => ({ kind: 'check', level, p: generateCheck(level) });
const word = (level: WordLevel, pred?: (p: DivWordProblem) => boolean): TestProblem =>
  ({ kind: 'word', level, p: pred ? retry(() => generateWord(level), pred) : generateWord(level) });
const errorStep = (preset: EhPreset, pred?: (e: DivErrorExample) => boolean): TestProblem =>
  ({ kind: 'error', preset, p: pred ? retry(() => makeDivError(preset), pred) : makeDivError(preset) });
const hissan = (diff: Difficulty, pred: (p: Problem) => boolean): TestProblem =>
  ({ kind: 'hissan', diff, p: hissanShape(diff, pred) });

const placeAnswer = (p: EstimateProblem) => p.choices![p.answerIndex!];

export const TEST_STEPS: TestStep[] = [
  /* ===== 表・知識技能（計100点） ===== */
  // 大問1: 何十でわる計算（90÷30 / 740÷90=8あまり20）
  { daimon: 1, sub: '①', title: '何十でわる計算（わりきれる）', section: '表', points: 5, skillId: 'rules-tens', gen: () => rules('rules-tens') },
  { daimon: 1, sub: '②', title: '何十でわる計算（あまりあり）', section: '表', points: 5, skillId: 'rules-rem', gen: () => rules('rules-rem') },

  // 大問2: わり算の筆算 6問（2÷2 修正なし/あり・3÷2 商1けた/2けた/末尾0・3÷3）
  { daimon: 2, sub: '①', title: '筆算 2けた÷2けた（仮商修正なし）', section: '表', points: 5, skillId: 'hissan-2-2', gen: () => hissan('2-2', (p) => !needsTrialAdjust(p)) },
  { daimon: 2, sub: '②', title: '筆算 2けた÷2けた（仮商修正あり）', section: '表', points: 5, skillId: 'hissan-2-2', gen: () => hissan('2-2', (p) => needsTrialAdjust(p)) },
  { daimon: 2, sub: '③', title: '筆算 3けた÷2けた（商1けた・仮商修正あり）', section: '表', points: 5, skillId: 'hissan-3-2', gen: () => hissan('3-2', (p) => p.quotient <= 9 && needsTrialAdjust(p)) },
  { daimon: 2, sub: '④', title: '筆算 3けた÷2けた（商2けた）', section: '表', points: 5, skillId: 'hissan-3-2', gen: () => hissan('3-2', (p) => p.quotient >= 12 && p.quotient % 10 !== 0) },
  { daimon: 2, sub: '⑤', title: '筆算 3けた÷2けた（商の末尾に0）', section: '表', points: 5, skillId: 'hissan-3-2', gen: () => hissan('3-2', (p) => p.quotient >= 20 && p.quotient % 10 === 0) },
  { daimon: 2, sub: '⑥', title: '筆算 3けた÷3けた', section: '表', points: 5, skillId: 'hissan-3-3', gen: () => hissan('3-3', () => true) },

  // 大問3: くふうして筆算（6400÷800 / 8200÷300=27あまり100）
  { daimon: 3, sub: '①', title: 'くふうして筆算（わりきれる）', section: '表', points: 5, skillId: 'rules-kufu', gen: () => rules('rules-kufu', (p) => p.remainder === 0) },
  { daimon: 3, sub: '②', title: 'くふうして筆算（あまりに消した0をつける）', section: '表', points: 5, skillId: 'rules-kufu', gen: () => rules('rules-kufu', (p) => p.remainder > 0) },

  // 大問4: 商は何の位からたちますか（31)80・73)258・29)714・182)635）
  { daimon: 4, sub: '①', title: '商のたつ位（2けた÷2けた）', section: '表', points: 5, skillId: 'est-place', gen: () => estimate('est-place', (p) => p.dividend < 100 && p.divisor >= 10) },
  { daimon: 4, sub: '②', title: '商のたつ位（3けた÷2けた・一の位）', section: '表', points: 5, skillId: 'est-place', gen: () => estimate('est-place', (p) => p.dividend >= 100 && p.divisor >= 10 && p.divisor < 100 && placeAnswer(p) === '一の位') },
  { daimon: 4, sub: '③', title: '商のたつ位（3けた÷2けた・十の位）', section: '表', points: 5, skillId: 'est-place', gen: () => estimate('est-place', (p) => p.dividend >= 100 && p.divisor >= 10 && p.divisor < 100 && placeAnswer(p) === '十の位') },
  { daimon: 4, sub: '④', title: '商のたつ位（3けた÷3けた）', section: '表', points: 5, skillId: 'est-place', gen: () => estimate('est-place', (p) => p.divisor >= 100) },

  // 大問5: けん算の式を書く（997÷49=20あまり17 → 49×20＋17＝997）
  { daimon: 5, title: 'けん算の式を書く', section: '表', points: 5, skillId: 'check-shiki', gen: () => check('check-shiki') },

  // 大問6: まちがっている筆算を正しく直す
  { daimon: 6, sub: '①', title: 'まちがい直し（あまりが大きすぎる筆算）', section: '表', points: 5, skillId: 'eh-rembig', gen: () => errorStep('eh-rembig', (e) => e.divisorN >= 10) },
  { daimon: 6, sub: '②', title: 'まちがい直し（商の0の書きわすれ）', section: '表', points: 5, skillId: 'eh-zerotail', gen: () => errorStep('eh-zerotail') },

  // 大問7: 商が等しい式を2つ選ぶ（120÷60 → 12÷6 と 20÷10）
  { daimon: 7, title: '商が等しい式を2つ選ぶ', section: '表', points: 10, skillId: 'rules-equal', gen: () => rules('rules-equal') },

  // 大問8: 末尾に0のある筆算の正しい答えを選ぶ（6500÷700 → 9あまり200）
  { daimon: 8, title: '末尾0のわり算・正しい答えを選ぶ', section: '表', points: 5, skillId: 'rules-trap', gen: () => rules('rules-trap') },

  /* ===== 裏・思考判断表現（計50点） ===== */
  // 大問9: 62)6□9 で商が10より小さくなる□をぜんぶ
  { daimon: 9, title: '商が10より小さくなる□', section: '裏', points: 10, skillId: 'est-cond', gen: () => estimate('est-cond') },
  // 大問10: 等分除（72さつを18人で分ける）
  { daimon: 10, title: '文章題（同じ数ずつ分ける・わりきれる）', section: '裏', points: 10, skillId: 'wp-big', gen: () => word('wp-big', (p) => p.remainder === 0) },
  // 大問11: 包含除・あまりあり（98こを12こずつ箱に）
  { daimon: 11, title: '文章題（箱づめして あまり）', section: '裏', points: 10, skillId: 'wp-rem', gen: () => ({ kind: 'word', level: 'wp-rem', p: makeGroup2Digit() }) },
  // 大問12: 何倍（64kg→320kg）
  { daimon: 12, title: '文章題（何倍かを もとめる）', section: '裏', points: 10, skillId: 'wp-times', gen: () => word('wp-times') },
  // 大問13: ある数を35でわると26あまり14。この数を33でわると？
  { daimon: 13, title: 'けん算で ある数を もとめる', section: '裏', points: 10, skillId: 'check-findnum', gen: () => check('check-findnum') },

  /* ===== いかそう算数（参考・点数なし） ===== */
  { daimon: 14, title: 'いかそう算数（なぜ まちがえたか 見ぬく）', section: '参考', points: 0, skillId: 'eh-place', gen: () => errorStep('eh-place') },
];

/**
 * テスト結果のきろく用に、各問題を「問題文」と「正しい答え」の文字列にする。
 * 児童の入力値そのものは保存せず、問題・正答・○×だけを残す。
 */
export function describeProblem(tp: TestProblem): { q: string; a: string } {
  const qr = (q: number, r: number) => `${q}${r > 0 ? ` あまり ${r}` : ''}`;
  switch (tp.kind) {
    case 'mental':
      return { q: `${tp.p.dividend} ÷ ${tp.p.divisor}`, a: qr(tp.p.quotient, tp.p.remainder) };
    case 'rules':
      if (tp.p.kind === 'blank') return { q: `${tp.p.exprLeft} ＝ ${tp.p.exprRight}`, a: `□ ＝ ${tp.p.blankAnswer}` };
      if (tp.p.kind === 'choice') return { q: `${tp.p.dividend} ÷ ${tp.p.divisor} の正しい答えを選ぶ`, a: tp.p.choices![tp.p.answerIndex!] };
      if (tp.p.kind === 'multi') return { q: `${tp.p.dividend} ÷ ${tp.p.divisor} と商が等しい式`, a: tp.p.answerIndices!.map((i) => tp.p.choices![i]).join(' と ') };
      return { q: `${tp.p.dividend} ÷ ${tp.p.divisor}`, a: qr(tp.p.quotient, tp.p.remainder) };
    case 'estimate':
      if (tp.p.kind === 'multi-digit') {
        return { q: `${tp.p.divisor})${tp.p.dividendTemplate} の商が10より小さくなる□`, a: (tp.p.answerDigits ?? []).join('・') };
      }
      return {
        q: tp.p.kind === 'choice' ? `「${tp.p.dividend} ÷ ${tp.p.divisor}」${tp.p.text}` : tp.p.text,
        a: tp.p.kind === 'choice' ? tp.p.choices![tp.p.answerIndex!] : String(tp.p.answerValue),
      };
    case 'check':
      if (tp.p.kind === 'findnum') {
        return {
          q: `ある数を${tp.p.divisor}でわると ${qr(tp.p.quotient, tp.p.remainder)}。この数を${tp.p.secondDivisor}でわると？`,
          a: `ある数=${tp.p.dividend}、答え ${qr(tp.p.secondQuotient!, tp.p.secondRemainder!)}`,
        };
      }
      return {
        q: `${tp.p.dividend} ÷ ${tp.p.divisor} = ${qr(tp.p.quotient, tp.p.remainder)} の けん算`,
        a: `${tp.p.divisor} × ${tp.p.quotient}${tp.p.remainder > 0 ? ` ＋ ${tp.p.remainder}` : ''} ＝ ${tp.p.dividend}`,
      };
    case 'word':
      return { q: tp.p.text, a: `${tp.p.finalKind === 'quot-rem' ? qr(tp.p.quotient, tp.p.remainder) : tp.p.finalAnswer}${tp.p.finalUnit}` };
    case 'error':
      return { q: `まちがい探し：${tp.p.expr}`, a: `正しくは ${qr(tp.p.correctQ, tp.p.correctR)}` };
    case 'hissan':
      return { q: `筆算：${tp.p.dividend} ÷ ${tp.p.divisor}`, a: qr(tp.p.quotient, tp.p.remainder) };
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
  'mental-tens': '0を 同じ数だけ 消してから、九九で 考えよう。',
  'mental-rem': 'あまりにも 消した0を もどすのを わすれずに。',
  'rules-equal': 'わられる数と わる数を 同じ数で わっても、商は 変わらないよ。',
  'rules-rem': 'わり算のきまりで あまりも 同じ数で わられる。もどすのを わすれずに。',
  'est-place': 'わられる数の 上から2けたと わる数を くらべて、商を立てる位を きめよう。',
  'est-cond': 'まず いちばん小さい場合と 大きい場合を ためして、あてはまる はんいを さがそう。',
  'check-shiki': 'たしかめ算は「わる数 × 商 ＋ あまり ＝ わられる数」。',
  'check-findnum': 'まず たしかめ算で もとの数を もどしてから、もう一度 わろう。',
  'check-rem': 'あまりは かならず わる数より 小さくなるよ。',
  'wp-rem': 'あまりを どうするかは 場面で きまる。切り上げか 切り捨てかを 考えよう。',
  'wp-big': '大きい数でも やり方は 同じ。位をそろえて 筆算にしよう。',
  'eh-zerotail': '商の おわりに 0が立つことを わすれずに。けた数を 数えて たしかめよう。',
  'eh-rembig': 'あまりが わる数より 大きいときは、商を 1 大きくできるよ。',
  'eh-place': '商を 立てる位が ずれていないか、けた数で たしかめよう。',
  'hissan-3-2': '仮商が 大きすぎたら 1つ小さく、小さすぎたら 1つ大きくして やり直そう。',
  'hissan-3-3': 'わる数を 何十とみて 見当をつけてから、たしかめて 直そう。',
};

const HOW_BY_MODULE: Record<string, string> = {
  mental: '0を 同じ数だけ 消してから、九九で 考えよう。',
  rules: 'わられる数と わる数を 同じ数で わっても、商は 変わらないよ。',
  est: '上から2けたと わる数を くらべて、商を立てる位を きめよう。',
  check: 'たしかめ算は「わる数 × 商 ＋ あまり ＝ わられる数」。',
  wp: '場面を 図にしてから、何を もとめるのか 決めよう。',
  eh: 'まず たしかめ算で 答えが 合っているか しらべよう。',
  hissan: '「たてる → かける → ひく → おろす」を 1けたずつ くりかえそう。',
  mock: '見直しは たしかめ算から。あまりが わる数より 小さいかも 見よう。',
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
    mental: 'mental', rules: 'rules', est: 'estimate', check: 'check',
    wp: 'word-problem', eh: 'error-hunter', hissan: 'hissan',
  };
  return map[head] ?? null;
}
