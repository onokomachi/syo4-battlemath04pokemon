// このファイルは単元アプリ syo4-syousu-v2 の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 * 実際の単元テスト（東書・表=知識技能100点 / 裏=思考判断表現50点）を
 * 同じ大問順・同じ問題数で再現する。各設問は既存ジェネレータを呼び、既存アクティビティで解く。
 * テストは2つ: 「5. 小数のしくみ」（TEST_STEPS）と「13. 小数のかけ算とわり算」（MULDIV_TEST_STEPS）。
 * 採点: ノーミス完答=満点、ミスありで完答=0点（＝一発正解を採点）。
 */
import {
  generateDecompose, DecomposeProblem,
  generatePlaceId, PlaceIdProblem, PlaceIdLevel,
  generateUnit, UnitProblem, UnitLevel,
  generateCompose, ComposeProblem, ComposeLevel,
  generateCollect, CollectProblem, CollectLevel,
  generateScale, ScaleProblem, ScaleLevel,
} from './placeValue';
import { scaleOpLabel } from './placeValue';
import {
  generateLine, LineProblem, LineLevel,
  generateCompare, ComparePair, CompareLevel,
  generateOrder, OrderProblem, OrderLevel,
  relation,
} from './numberLine';
import { generateAddSub, AddSubProblem, AddSubLevel, buildColumns } from './decimal';
import { generateWordProblem, WordProblem } from './wordProblems';
import { makeError, ErrorExample, ErrorPreset } from './errorHunter';
import { skillToModuleId, type ModuleId } from './moduleOfSkill';
import { generateDressing as generateDressingProblem } from './mulDivQuestions';
import { generateMulDiv, generateTimesTable, describeMulDiv, type MulDivQ, type MulDivLevel, type GenOpts, type TimesTable } from './mulDivQuestions';

export type TestProblem =
  | { kind: 'decompose'; p: DecomposeProblem }
  | { kind: 'placeid'; p: PlaceIdProblem; level: PlaceIdLevel }
  | { kind: 'unit'; p: UnitProblem; level: UnitLevel }
  | { kind: 'compose'; p: ComposeProblem; level: ComposeLevel }
  | { kind: 'collect'; p: CollectProblem; level: CollectLevel }
  | { kind: 'lineRead'; p: LineProblem; level: LineLevel }
  | { kind: 'compare'; p: ComparePair; level: CompareLevel }
  | { kind: 'scale'; p: ScaleProblem; level: ScaleLevel }
  | { kind: 'addsub'; p: AddSubProblem; level: AddSubLevel; build: boolean }
  | { kind: 'word'; p: WordProblem }
  | { kind: 'error'; p: ErrorExample; preset: ErrorPreset }
  | { kind: 'order'; p: OrderProblem; level: OrderLevel }
  | { kind: 'muldiv'; q: MulDivQ };

export type Section = '表' | '裏' | '参考';

export interface TestStep {
  daimon: number;
  sub?: string;        // ①②③④
  title: string;       // 大問の説明（採点画面・ヘッダ用）
  section: Section;
  points: number;      // 配点（参考は 0）
  gen: () => TestProblem;
}

const addsub = (level: AddSubLevel, build: boolean): TestProblem => ({ kind: 'addsub', p: generateAddSub(level), level, build });
const errorStep = (preset: ErrorPreset): TestProblem => ({ kind: 'error', p: makeError(preset), preset });

export const TEST_STEPS: TestStep[] = [
  /* ===== 表・知識技能（各5点・計100点） ===== */
  { daimon: 1, sub: '①', title: '位取りのしくみ（何個分）', section: '表', points: 5, gen: () => ({ kind: 'decompose', p: generateDecompose() }) },
  { daimon: 1, sub: '②', title: '位取りのしくみ（位の数字）', section: '表', points: 5, gen: () => ({ kind: 'placeid', p: generatePlaceId('placeid-3', -3), level: 'placeid-3' }) },

  { daimon: 2, sub: '①', title: '単位の換算（長さ m⇔cm）', section: '表', points: 5, gen: () => ({ kind: 'unit', p: generateUnit('unit-length'), level: 'unit-length' }) },
  { daimon: 2, sub: '②', title: '単位の換算（重さ g⇔kg）', section: '表', points: 5, gen: () => ({ kind: 'unit', p: generateUnit('unit-mass'), level: 'unit-mass' }) },

  { daimon: 3, sub: '①', title: '小数の構成（組み立て）', section: '表', points: 5, gen: () => ({ kind: 'compose', p: generateCompose('compose-3'), level: 'compose-3' }) },
  { daimon: 3, sub: '②', title: '小数の構成（0.01の何個分）', section: '表', points: 5, gen: () => ({ kind: 'collect', p: generateCollect('collect-basic', { unit: '0.01', direction: 'count' }), level: 'collect-basic' }) },

  { daimon: 4, sub: 'ア', title: '数直線の読み取り（0.01目盛り）', section: '表', points: 5, gen: () => ({ kind: 'lineRead', p: generateLine('line-hundredths'), level: 'line-hundredths' }) },
  { daimon: 4, sub: 'イ', title: '数直線の読み取り（0.01目盛り）', section: '表', points: 5, gen: () => ({ kind: 'lineRead', p: generateLine('line-hundredths'), level: 'line-hundredths' }) },

  { daimon: 5, sub: '①', title: '小数の大小比較（不等号）', section: '表', points: 5, gen: () => ({ kind: 'compare', p: generateCompare('compare-mixed'), level: 'compare-mixed' }) },
  { daimon: 5, sub: '②', title: '小数の大小比較（不等号）', section: '表', points: 5, gen: () => ({ kind: 'compare', p: generateCompare('compare-int'), level: 'compare-int' }) },

  { daimon: 6, sub: '①', title: '10倍した数', section: '表', points: 5, gen: () => ({ kind: 'scale', p: generateScale('scale-10'), level: 'scale-10' }) },
  { daimon: 6, sub: '②', title: '1/10にした数', section: '表', points: 5, gen: () => ({ kind: 'scale', p: generateScale('scale-tenth'), level: 'scale-tenth' }) },

  { daimon: 7, sub: '①', title: '筆算 たし算（位がそろっている）', section: '表', points: 5, gen: () => addsub('add-basic', false) },
  { daimon: 7, sub: '②', title: '筆算 たし算（位がそろっている）', section: '表', points: 5, gen: () => addsub('add-diff', false) },
  { daimon: 7, sub: '③', title: '筆算 ひき算（位がそろっている）', section: '表', points: 5, gen: () => addsub('sub-basic', false) },
  { daimon: 7, sub: '④', title: '筆算 ひき算（位がそろっている）', section: '表', points: 5, gen: () => addsub('sub-diff', false) },

  { daimon: 8, sub: '①', title: '筆算 たし算（自分で位をそろえる）', section: '表', points: 5, gen: () => addsub('add-basic', true) },
  { daimon: 8, sub: '②', title: '筆算 たし算（自分で位をそろえる）', section: '表', points: 5, gen: () => addsub('add-diff', true) },
  { daimon: 8, sub: '③', title: '筆算 ひき算（自分で位をそろえる）', section: '表', points: 5, gen: () => addsub('sub-basic', true) },
  { daimon: 8, sub: '④', title: '筆算 ひき算（自分で位をそろえる）', section: '表', points: 5, gen: () => addsub('sub-diff', true) },

  /* ===== 裏・思考判断表現（計50点） ===== */
  { daimon: 9, sub: '①', title: '多様な見方（0.001を何個）', section: '裏', points: 5, gen: () => ({ kind: 'collect', p: generateCollect('collect-regroup', { unit: '0.001', direction: 'count' }), level: 'collect-regroup' }) },
  { daimon: 9, sub: '②', title: '多様な見方（1/100にした数）', section: '裏', points: 5, gen: () => ({ kind: 'scale', p: generateScale('scale-100', '÷100'), level: 'scale-100' }) },

  { daimon: 10, title: 'たし算の文章題（式・答え）', section: '裏', points: 10, gen: () => ({ kind: 'word', p: generateWordProblem('+') }) },

  { daimon: 11, sub: '①', title: 'まちがい探し たし算（理由・正答）', section: '裏', points: 10, gen: () => errorStep('addAlign') },
  { daimon: 11, sub: '②', title: 'まちがい探し たし算（理由・正答）', section: '裏', points: 10, gen: () => errorStep('addCarry') },
  { daimon: 11, sub: '③', title: 'まちがい探し ひき算（理由・正答）', section: '裏', points: 10, gen: () => errorStep('subBorrow') },

  /* ===== 参考（点数なし・評価のみ） ===== */
  { daimon: 12, title: 'いかそう算数（100m走 速い順にならべる）', section: '参考', points: 0, gen: () => ({ kind: 'order', p: generateOrder('order-5'), level: 'order-5' }) },
];

/**
 * テスト結果のきろく用に、各問題を「問題文」と「正しい答え」の文字列にする。
 * 児童の入力値そのものは保存せず、問題・正答・○×だけを残す。
 */
export function describeProblem(tp: TestProblem): { q: string; a: string } {
  switch (tp.kind) {
    case 'decompose': {
      const c = tp.p.counts;
      return {
        q: `${tp.p.valueStr} は それぞれ 何こ分？`,
        a: `1を${c.ones}こ・0.1を${c.tenths}こ・0.01を${c.hundredths}こ・0.001を${c.thousandths}こ`,
      };
    }
    case 'placeid':
      return { q: `${tp.p.valueStr} の ${tp.p.placeLabel}の数字`, a: tp.p.answer };
    case 'unit':
      return { q: tp.p.promptStr, a: `${tp.p.answer}${tp.p.answerUnit}` };
    case 'compose':
      return { q: `各位を 組み立てて 数をつくる`, a: String(tp.p.target) };
    case 'collect':
      return tp.p.direction === 'count'
        ? { q: `${tp.p.value} は ${tp.p.unitLabel}を 何こ 集めた数？`, a: `${tp.p.answer}こ` }
        : { q: `${tp.p.unitLabel}を ${tp.p.count}こ 集めた数`, a: tp.p.answer };
    case 'lineRead':
      return { q: `数直線の ◆ を よむ（${tp.p.min}〜${tp.p.max}）`, a: tp.p.targetStr };
    case 'compare':
      return { q: `${tp.p.aStr} ☐ ${tp.p.bStr}`, a: relation(tp.p.aStr, tp.p.bStr) };
    case 'scale':
      return { q: `${tp.p.value} を ${scaleOpLabel(tp.p.op)}`, a: tp.p.answer };
    case 'addsub':
      return { q: `${tp.p.a} ${tp.p.op} ${tp.p.b}`, a: String(buildColumns(tp.p).result) };
    case 'word':
      return { q: tp.p.text, a: `${tp.p.answer}${tp.p.unit}` };
    case 'error':
      return { q: `まちがい探し：${tp.p.expr}`, a: `正しい答え ${tp.p.correctAnswer}` };
    case 'order':
      return { q: `${tp.p.dir === 'asc' ? '小さい' : '大きい'}順に ならべる`, a: tp.p.sorted.join(' → ') };
    case 'muldiv':
      return describeMulDiv(tp.q);
  }
}

/* ===================== 13. 小数のかけ算とわり算 ===================== */

const md = (level: MulDivLevel, o: GenOpts = {}): TestProblem => ({ kind: 'muldiv', q: generateMulDiv(level, o) });

/**
 * 大問11は、①②で同じテープの表を使う。
 * テストは設問を上から順に1回ずつ作るので、①で作った表を②で使い回す。
 */
let timesTable: TimesTable | null = null;
const times11 = (which: 'big' | 'small'): TestProblem => {
  if (which === 'big' || !timesTable) timesTable = generateTimesTable();
  return md('div-times', { times: which, timesTable });
};

export const MULDIV_TEST_STEPS: TestStep[] = [
  /* ===== 表・知識技能（各5点・計100点） ===== */
  { daimon: 1, sub: '①', title: 'あんざん（小数 × 整数）', section: '表', points: 5, gen: () => md('mul-mental') },
  { daimon: 1, sub: '②', title: 'あんざん（小数 ÷ 整数）', section: '表', points: 5, gen: () => md('div-mental') },

  { daimon: 2, sub: '①', title: 'かけ算の筆算（小数第一位 × 1けた）', section: '表', points: 5, gen: () => md('mul-tenths') },
  { daimon: 2, sub: '②', title: 'かけ算の筆算（小数第一位 × 1けた）', section: '表', points: 5, gen: () => md('mul-tenths', { mulVariant: 'big' }) },
  { daimon: 2, sub: '③', title: 'かけ算の筆算（小数 × 2けた）', section: '表', points: 5, gen: () => md('mul-2digit') },
  { daimon: 2, sub: '④', title: 'かけ算の筆算（× 何十・終わりの0を消す）', section: '表', points: 5, gen: () => md('mul-zero-end', { mulVariant: 'tens' }) },
  { daimon: 2, sub: '⑤', title: 'かけ算の筆算（小数第二位 × 1けた）', section: '表', points: 5, gen: () => md('mul-hundredths') },
  { daimon: 2, sub: '⑥', title: 'かけ算の筆算（終わりの0を消す）', section: '表', points: 5, gen: () => md('mul-zero-end', { mulVariant: 'hundredths' }) },

  { daimon: 3, sub: '①', title: 'わりきれるまで（小数 ÷ 1けた）', section: '表', points: 5, gen: () => md('div-basic', { divVariant: 'tenths' }) },
  { daimon: 3, sub: '②', title: 'わりきれるまで（商が1より小さい）', section: '表', points: 5, gen: () => md('div-basic', { divVariant: 'small' }) },
  { daimon: 3, sub: '③', title: 'わりきれるまで（整数 ÷ 2けた）', section: '表', points: 5, gen: () => md('div-int', { divVariant: 'two' }) },
  { daimon: 3, sub: '④', title: 'わりきれるまで（小数 ÷ 2けた）', section: '表', points: 5, gen: () => md('div-2digit', { divVariant: 'small' }) },

  { daimon: 4, sub: '①', title: '商を四捨五入して上から2けた', section: '表', points: 5, gen: () => md('div-round', { divVariant: 'tenths' }) },
  { daimon: 4, sub: '②', title: '商を四捨五入して上から2けた（÷ 2けた）', section: '表', points: 5, gen: () => md('div-round', { divVariant: 'two' }) },

  { daimon: 5, sub: '①', title: '計算のしかた（積を求める）', section: '表', points: 5, gen: () => md('mul-method', { methodAsk: 'product' }) },
  { daimon: 5, sub: '②', title: '計算のしかた（1/10にする）', section: '表', points: 5, gen: () => md('mul-method', { methodAsk: 'ratio' }) },

  { daimon: 6, sub: '①', title: '積に小数点をうつ', section: '表', points: 5, gen: () => md('mul-point') },
  { daimon: 6, sub: '②', title: '商に小数点をうつ', section: '表', points: 5, gen: () => md('div-point') },

  { daimon: 7, sub: '①', title: '商は一の位まで・あまり', section: '表', points: 5, gen: () => md('div-remainder', { divVariant: 'big' }) },
  { daimon: 7, sub: '②', title: 'あまりのあるわり算のけん算', section: '表', points: 5, gen: () => md('div-check') },

  /* ===== 裏・思考判断表現（計50点） ===== */
  { daimon: 8, title: 'かけ算の文章題（式・答え）', section: '裏', points: 10, gen: () => md('mul-word') },
  { daimon: 9, title: 'わり算の文章題 等分（式・答え）', section: '裏', points: 10, gen: () => md('div-word') },
  { daimon: 10, title: 'あまりのある文章題（式・答え）', section: '裏', points: 10, gen: () => md('div-word-remainder') },
  { daimon: 11, sub: '①', title: '小数倍（1より大きい）', section: '裏', points: 10, gen: () => times11('big') },
  { daimon: 11, sub: '②', title: '小数倍（1より小さい）', section: '裏', points: 10, gen: () => times11('small') },

  /* ===== 参考（点数なし・評価のみ） ===== */
  { daimon: 12, title: 'いかそう算数（ドレッシング 何倍）', section: '参考', points: 0, gen: () => ({ kind: 'muldiv', q: { ui: 'times', level: 'div-times', p: generateDressingProblem() } }) },
];

/* ===================== テストの一覧 ===================== */

export type TestId = 'shikumi' | 'muldiv';

export interface TestDef {
  id: TestId;
  /** 紙のテストの題（「5. 小数のしくみ」） */
  title: string;
  short: string;
  steps: TestStep[];
  /** 記録の名前。小数のしくみは前からの 'mock-test' のまま（記録を切らない） */
  recordSkillId: string;
  omoteMax: number;
  uraMax: number;
  totalMax: number;
}

const defOf = (id: TestId, title: string, short: string, steps: TestStep[], recordSkillId: string): TestDef => {
  const omoteMax = steps.filter((s) => s.section === '表').reduce((a, s) => a + s.points, 0);
  const uraMax = steps.filter((s) => s.section === '裏').reduce((a, s) => a + s.points, 0);
  return { id, title, short, steps, recordSkillId, omoteMax, uraMax, totalMax: omoteMax + uraMax };
};

export const TESTS: TestDef[] = [
  defOf('shikumi', '5. 小数のしくみ', '小数のしくみ', TEST_STEPS, 'mock-test'),
  defOf('muldiv', '13. 小数のかけ算とわり算', '小数のかけ算とわり算', MULDIV_TEST_STEPS, 'mock-test-muldiv'),
];

export const OMOTE_MAX = TESTS[0]!.omoteMax; // 100
export const URA_MAX = TESTS[0]!.uraMax;   // 50
export const TOTAL_MAX = OMOTE_MAX + URA_MAX; // 150

/* ---------------- 答案に残す記号と、テストのあとの「やり方」 ---------------- */

/**
 * 出題から項目の記号を取り出す。カタログと同じ文字列にする。
 * 大問の題名は問題を作り直すたびに変わりうるので、集計の軸にはできない。
 */
export function skillIdOf(tp: TestProblem): string {
  switch (tp.kind) {
    case 'decompose': return 'decompose-3';
    case 'word': return 'wp-mixed';
    case 'error': return tp.preset as string;
    case 'lineRead': return `line-read-${tp.level}`;
    case 'addsub': return tp.build ? `addsub-build-${tp.level}` : `addsub-${tp.level}`;
    case 'muldiv': return tp.q.level;
    default: return (tp as { level?: string }).level ?? tp.kind;
  }
}

/**
 * まちがえた問題に添える、やり方のひとこと。
 * テスト中は出さない。**終わってから**まちがえた問題にだけ添える。
 */
const HOW_BY_SKILL: Record<string, string> = {
  'decompose-3': '1が何こ・0.1が何こ・0.01が何こ、に 分けて 考えよう。',
  'addsub-sub-whole': '空いている位には 0が あると 考えて、位を そろえよう。',
  'addsub-add-diff': 'けた数が ちがっても、**小数点を そろえて** たてに 書こう。',
  'addsub-sub-diff': 'けた数が ちがっても、**小数点を そろえて** たてに 書こう。',
  'compare-mixed': '上の位から 順に くらべよう。けた数の 多さでは 決まらないよ。',
  'mul-mental': '0.1 の いくつ分で 考えよう。0.8 × 3 は 0.1 が 8×3＝24こ で 2.4。',
  'div-mental': '0.1 の いくつ分で 考えよう。2.6 ÷ 2 は 0.1 が 26÷2＝13こ で 1.3。',
  'mul-2digit': 'かける数の 一の位・十の位を じゅんに かけて、十の位の 答えは 1けた 左に ずらして 書こう。',
  'mul-zero-end': '小数点を うったあと、小数点より 右の 終わりの 0 は 消そう。',
  'mul-method': '10倍して 整数の かけ算に し、答えを 1/10 に もどすよ。',
  'mul-point': '積の 小数点は、かけられる数と 同じ けた数だけ 右から 数えて うつ。',
  'div-point': '商の 小数点は、わられる数の 小数点の 真上に うつ。',
  'div-2digit': 'わる数を 何十と 見て 商の 見当を つけよう。たてる→かける→ひく→おろす。',
  'div-int': 'わりきれないときは、わられる数の 終わりに 0が あると 考えて、0を おろして わり進もう。',
  'div-round': '上から 3けためまで 商を 出して、3けための 数字を 四捨五入しよう。',
  'div-remainder': '商は 一の位まで。あまりの 小数点は、わられる数の 小数点に そろえる。',
  'div-check': 'けん算は「わる数 × 商 ＋ あまり ＝ わられる数」。',
  'mul-word': '「1つ分 × いくつ分」で ぜんぶの 量。',
  'div-word': '「同じように 分けた 1人分」は ぜんぶ ÷ 人数。',
  'div-word-remainder': '本数は 整数だから 商は 一の位まで。あまりも 答えよう。',
  'div-times': '何倍かは「くらべる量 ÷ もとにする量」。1より 小さい 倍も あるよ。',
};

const HOW_BY_MODULE: Record<string, string> = {
  addsub: '小数点を そろえて、同じ位どうしを たてに そろえよう。',
  div: '商の 小数点は、わられる数の 小数点の 真上に うつよ。',
  mul: '整数と みて 計算し、積の 小数点は かけられる数と 同じ けた数に うつよ。',
  compare: '上の位から 順に くらべよう。けた数の 多さでは 決まらないよ。',
  line: '1めもりが いくつかを 先に 読みとろう。',
  order: '同じ位で そろえてから、上の位の 順に ならべよう。',
  collect: '0.1が10こで 1、0.01が10こで 0.1 だよ。',
  compose: '1が何こ・0.1が何こ…を たし合わせると もとの数に なるよ。',
  placeid: '小数点の すぐ左が 一の位。そこから 数えよう。',
  scale: '10倍で 小数点が 右へ1つ、10でわると 左へ1つ 動くよ。',
  unit: '1m＝100cm、1kg＝1000g。単位を そろえてから 直そう。',
  wp: '場面から「たすのか・ひくのか・かけるのか・わるのか」を 先に 決めよう。',
  fix: 'まず 小数点の 位置が そろっているかを 見よう。',
  judge: '小数点の 位置と 位の そろえ方を、順に たしかめよう。',
  mock: '見直しは 小数点の 位置から。位が そろっているか 見よう。',
};

export function howTo(skillId: string): string {
  return HOW_BY_SKILL[skillId]
    ?? HOW_BY_MODULE[skillId.split('-')[0] ?? '']
    ?? 'もう一度 ゆっくり やってみよう。';
}

/** その項目を練習できるモジュール。テストのあと「れんしゅうする」で飛ぶ先。 */
export function practiceModuleOf(skillId: string): ModuleId | null {
  const m = skillToModuleId(skillId);
  return m === 'mock-test' ? null : m;
}
