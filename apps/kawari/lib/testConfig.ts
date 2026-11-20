// このファイルは単元アプリ syo4-kawarikatasirabe の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 * 単元「変わり方調べ」の市販カラーテストと同じ形（表＝知識・技能100点／裏＝思考・判断・表現50点）で
 * 通しで解けるようにする。数値と場面は毎回ランダム生成。
 *
 * 外部基準（エビデンス）と、そこから決めた配点配分:
 *  A. 埼玉県教育委員会「東京書籍版 4年 単元11 変わり方調べ」プリント NO1〜NO3（解答・配点つき）
 *     …300点相当のうち「場面の文だけを読んで□と○の式を答える」が100点（33%）で最大。
 *       次いで 表にかく 60点（20%）、大きい数のとき・逆算 50点（17%）、表→式 40点（13%）。
 *       積が一定（24÷□＝○、□×○＝36）と 減法の形（□－4＝○）が実際に出題されている。
 *  B. 宮城県教育センター 単元11 ホップ／ステップ／ジャンプ（H16 宮城県学習状況調査より）
 *     …ふえる／へるの一覧判定、□×2＋2 の型と「100このとき」、まわりが同じ長方形の面積最大。
 *  C. 啓林館 わくわく算数 自己評価テスト「15．変わり方」…折れ線グラフ4問（かく／読む／
 *     目もりのあいだ／0のとき）。
 *  D. 学習指導要領解説 算数編 第4学年 C(1) p.214-217…表・式・折れ線グラフ、変化(横)と対応(たて)、
 *     伴って変わる二つの数量を見いだす。
 *
 * 設計（master-DB: patterns/answer-ui-dispatcher-with-pool-based-test.md）:
 *  設問に skillId を1つずつ直書きせず「候補プール」で書く。こうすると
 *  実装レベル数（43）> 設問数（25）でも、すべてのレベルがどこかの pool に入る。
 *  取りこぼしは skillsMissingFromTest() で機械的に検出できる。
 */
import { KawariProblem } from '../types';
import { ALL_SKILL_IDS, SkillId, generate } from './problems';
import { ALL_SCENARIOS } from './scenarios';
import type { RelKind } from '../types';
import { skillToModuleId, type ModuleId } from '../store/progressStore';

export type Section = '表' | '裏';

export interface TestStep {
  daimon: number;
  sub: string;      // ①②③…
  title: string;
  section: Section;
  points: number;
  /** この設問で出題されうるスキル（この中から毎回1つ抽選） */
  pool: SkillId[];
  /** 紙のテストと同じ場面の種類（和が一定・差が一定・倍）だけを出すときの条件 */
  rel?: RelKind[];
}

export const TEST_STEPS: TestStep[] = [
  /*
   * 紙のテスト（新学社 4年東「11. 変わり方調べ」）と同じ大問・配点にしている。
   * 紙の表面は 3つの場面（和が一定・差が一定・倍）を「表をうめる → 変わり方 → 式 → いくつのとき」の順に聞く。
   * アプリでも 大問ごとに同じ種類の場面だけを出す（rel）。数と場面の中身は毎回かわる。
   * 紙は表面が思考・判断・表現100点、裏面が知識・技能50点。アプリは表100点・裏50点の枠で同じ中身を出す。
   */

  /* ===== 表（100点） ===== */
  // 大問1 和が一定（まわりの長さが決まった長方形のたてと横 など）
  { daimon: 1, sub: '①', title: '表に かく（たすと 同じ）', section: '表', points: 15, pool: ['tbl-sum'] },
  { daimon: 1, sub: '②', title: '横の長さは どう 変わる？', section: '表', points: 5, pool: ['tbl-yoko'], rel: ['sum'] },
  { daimon: 1, sub: '③', title: '□と○の 関係を 式に', section: '表', points: 5, pool: ['exp-sum'] },
  { daimon: 1, sub: '④', title: '□が □こ の とき ○は？', section: '表', points: 5, pool: ['app-nth'], rel: ['sum'] },
  // 大問2 差が一定（2人の年れい など）
  { daimon: 2, sub: '⑤', title: '表に かく（ちがいが 同じ）', section: '表', points: 15, pool: ['tbl-diff'] },
  { daimon: 2, sub: '⑥', title: 'いくつ たした ものか（たてに 見る）', section: '表', points: 5, pool: ['tbl-tate'], rel: ['diff', 'less'] },
  { daimon: 2, sub: '⑦', title: '□と○の 関係を 式に', section: '表', points: 5, pool: ['exp-diff'] },
  { daimon: 2, sub: '⑧', title: '□が □ の とき ○は？', section: '表', points: 5, pool: ['app-nth'], rel: ['diff', 'less'] },
  // 大問3 倍（正三角形を ならべた まわりの長さ など）
  { daimon: 3, sub: '⑨', title: '表に かく（何ばい）', section: '表', points: 15, pool: ['tbl-times'] },
  { daimon: 3, sub: '⑩', title: '□が1ふえると ○は いくつ ふえる？', section: '表', points: 5, pool: ['tbl-yoko'], rel: ['times'] },
  { daimon: 3, sub: '⑪', title: '○は □の 何ばい？（たてに 見る）', section: '表', points: 5, pool: ['tbl-tate'], rel: ['times'] },
  { daimon: 3, sub: '⑫', title: '□と○の 関係を 式に', section: '表', points: 5, pool: ['exp-times'] },
  { daimon: 3, sub: '⑬', title: '□が 大きい 数の とき ○は？', section: '表', points: 5, pool: ['app-nth'], rel: ['times'] },
  { daimon: 3, sub: '⑭', title: '○が わかっている とき □は？', section: '表', points: 5, pool: ['app-inv'], rel: ['times'] },

  /* ===== 裏（50点） ===== */
  // 大問4 2つの量の関係を 表に 整理する
  { daimon: 4, sub: '⑮', title: '表に 整理する（たすと 同じ）', section: '裏', points: 10, pool: ['tbl-sum'] },
  { daimon: 4, sub: '⑯', title: '表に 整理する（何ばい）', section: '裏', points: 10, pool: ['tbl-times'] },
  // 大問5 年れいの 変わり方（差が一定）
  { daimon: 5, sub: '⑰', title: '表の あいた ところ', section: '裏', points: 10, pool: ['tbl-diff'] },
  { daimon: 5, sub: '⑱', title: '1ずつ ふえると どう なる？', section: '裏', points: 10, pool: ['tbl-yoko'], rel: ['diff'] },
  { daimon: 5, sub: '⑲', title: '□と○の 関係を 式に', section: '裏', points: 10, pool: ['exp-diff'] },
];

/**
 * 紙のテストには出ないが、単元で学ぶので練習に残している項目（本番テストには出さない）。
 * skillsMissingFromTest は「テストにも、ここにも無い項目」を返す（verify が0件を確かめる）。
 */
export const PRACTICE_ONLY_SKILLS: SkillId[] = [
  'find-decide', 'find-direction', 'find-pair', 'find-change',
  'tbl-prod', 'tbl-linear', 'rule-kind', 'rule-const', 'rule-word', 'rule-hidden',
  'exp-prod', 'exp-linear', 'exp-scene', 'exp-equiv', 'exp-build', 'exp-totable', 'exp-toscene',
  'gra-plot', 'gra-read', 'gra-half', 'gra-zero', 'gra-next', 'gra-kind',
  'app-limit', 'app-life', 'app-sumdiff', 'app-maxarea',
  'eh-changecorr', 'eh-reverse', 'eh-plusb', 'eh-sumdir', 'eh-rowmix', 'eh-zero',
];

const SCENARIO_KIND = new Map(ALL_SCENARIOS.map((sc) => [sc.id, sc.kind]));
/** 問題の署名（skillId|場面id|…）から、場面の種類を引く */
export function relOf(p: KawariProblem): RelKind | undefined {
  return SCENARIO_KIND.get(p.signature.split('|')[1] ?? '');
}

/** その設問の問題を1つ作る（pool から抽選） */
export function genStep(step: TestStep): KawariProblem {
  for (let i = 0; i < 400; i++) {
    const id = step.pool[Math.floor(Math.random() * step.pool.length)]!;
    const p = generate(id);
    const k = relOf(p);
    if (!step.rel || (k && step.rel.includes(k))) return p;
  }
  return generate(step.pool[0]!);
}

export function skillsMissingFromTest(): SkillId[] {
  const inTest = new Set<string>([...TEST_STEPS.flatMap((s) => s.pool), ...PRACTICE_ONLY_SKILLS]);
  return ALL_SKILL_IDS.filter((id) => !inTest.has(id));
}

/** 学習のきろく用に、問題と正答を文字列にする（児童の入力値そのものは保存しない）。 */
export function describeProblem(p: KawariProblem): { q: string; a: string } {
  const q = `${p.story ? p.story + ' ' : ''}${p.prompt}`;
  const ans = p.answer;
  let a = '';
  switch (ans.kind) {
    case 'number': a = `${ans.correct}${ans.unit}`; break;
    case 'choice': a = ans.choices[ans.correct]; break;
    case 'multi': a = ans.correct.map((i) => ans.choices[i]).join(' と '); break;
    case 'tableFill': a = ans.correct.join('、'); break;
    case 'graphPlot': a = ans.correct.map((pt) => `(${pt.x}, ${pt.y})`).join(' '); break;
    case 'exprBuild': a = ans.correct.join(' '); break;
    case 'truth': a = ans.rows.map((r) => `${r.label}→${r.correct ? ans.yesLabel : ans.noLabel}`).join(' / '); break;
    case 'errorFix': a = `${ans.fixChoices[ans.fixCorrect]}（りゆう: ${ans.reasonChoices[ans.reasonCorrect]}）`; break;
  }
  return { q, a };
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
  'find-change': 'ふえる方と へる方を、表の 左から右へ 見ていこう。',
  'find-pair': '2つの量が 対に なって 変わっているところを さがそう。',
  'rule-const': '「ふえ方が いつも 同じ」なら、□＋△＝いつも同じ か □×△ の形だよ。',
  'rule-hidden': '表の となりどうしで、差か 商を くらべると きまりが 見えるよ。',
  'exp-build': '○と△の どちらが 変わると、もう一方が どう 変わるかを 式にしよう。',
  'exp-equiv': '同じ関係を 表す式は 何通りも 書ける。移項して たしかめよう。',
  'gra-plot': '横が ○、たてが △。表の 1組を 1つの点に すると 打てるよ。',
  'gra-next': '点の ならびが まっすぐなら、その先も 同じ間かくで つづくよ。',
  'app-nth': 'まず きまりを 式にしてから、□に 数を 入れて もとめよう。',
  'app-inv': '式を 先に つくると、逆から 聞かれても 同じ式で もとめられるよ。',
  'eh-additive': '「いくつ ふえたか」ではなく「何倍か」で 見る問題も あるよ。読み直そう。',
};

const HOW_BY_MODULE: Record<string, string> = {
  find: '変わる2つの量が 何と何かを、先に 見つけよう。',
  tbl: '表は 左から右へ。となりどうしを くらべると 変わり方が 見えるよ。',
  rule: 'となりどうしの 差か 商を 見て、いつも同じに なるものを さがそう。',
  exp: '「○が □ 変わると △が ◇ 変わる」を そのまま 式にしよう。',
  gra: '横が ○、たてが △。表の 1組が グラフの 1つの点に なるよ。',
  app: 'まず きまりを 式にしてから、数を 入れて もとめよう。',
  eh: '表の 見方（差か 倍か）を まちがえていないか たしかめよう。',
  mock: '見直しは 表から。となりどうしの 変わり方を もう一度 見よう。',
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
