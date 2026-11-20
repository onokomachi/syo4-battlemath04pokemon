// このファイルは単元アプリ syo4-tyokuhoutaitorippoutai の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 * 紙の単元テスト（新学社 4年東 下巻「14. 直方体と立方体」）と同じ大問・小問・配点にしてある。
 *   表＝知識・技能 100点（大問1〜7） / 裏＝思考・判断・表現 50点（大問8・9） / いかそう算数＝参考（0点）
 * 数や形は毎回ランダムに作る。各設問は lib/problems.ts のジェネレーターで作り、練習と同じ画面（QuestionRound）で解く。
 * 採点: ノーミス完答＝満点、ミスありで完答＝0点（＝一発正解を採点）。
 * 紙で「両方できて正答」の問い（2②・7①・9①②）は、1問の中の2ステップにしてある（両方できて満点）。
 */
import {
  generate, genKouseiCube, genKouseiCuboid, genHeikoFace, genHeikoEdge, genHeikoFaceEdge,
  genTenkaiCuboid, genTenkaiCube, genMitoriDraw, genIchiRead, genIchiPlot,
  genTenkaiPoint, genTenkaiEdge, genTenkaiFace, genKouseiPaper, genKatsuyoRibbonNet, genKatsuyoRibbon,
} from './problems';
import type { Question } from './question';
import { skillToModuleId, type ModuleId } from '../store/progressStore';

export type TestProblem = Question;

export type Section = '表' | '裏' | '参考';

export interface TestStep {
  daimon: number;
  sub?: string;        // ①②③④
  title: string;       // 大問の説明（採点画面・ヘッダ用）
  section: Section;
  points: number;      // 配点（参考は 0）
  gen: () => TestProblem;
  /** 練習モードと同じ命名の習熟度キー（例: 'calc-zero'）。ボスモード・実力の階段に使う。 */
  skillId: string;
}

const step = (daimon: number, sub: string | undefined, title: string, section: Section, points: number, skillId: string, gen?: () => TestProblem): TestStep => ({
  daimon, sub, title, section, points, skillId, gen: gen ?? (() => generate(skillId)),
});

export const TEST_STEPS: TestStep[] = [
  /* ===== 表・知識技能（計100点） ===== */
  // 大問1: 立方体（各5点・20点）
  step(1, '①', '立方体の 面の 形', '表', 5, 'kousei-cube', () => genKouseiCube('shape')),
  step(1, '②面', '立方体の 面の 数', '表', 5, 'kousei-cube', () => genKouseiCube('face')),
  step(1, '②辺', '立方体の 辺の 数', '表', 5, 'kousei-cube', () => genKouseiCube('edge')),
  step(1, '②頂点', '立方体の 頂点の 数', '表', 5, 'kousei-cube', () => genKouseiCube('vertex')),
  // 大問2: 直方体（各5点・10点）
  step(2, '①', '長方形の 面は いくつ', '表', 5, 'kousei-cuboid', () => genKouseiCuboid('faces')),
  step(2, '②', '長さの 等しい 辺は いくつずつ 何組', '表', 5, 'kousei-cuboid', () => genKouseiCuboid('edges')),
  // 大問3: 平行・垂直（各5点・20点）
  step(3, '①', '面に 平行な 面', '表', 5, 'heiko-face', () => genHeikoFace('par')),
  step(3, '②', '面に 垂直な 面の 数', '表', 5, 'heiko-face', () => genHeikoFace('perp')),
  step(3, '③', '辺に 平行な 辺（全部）', '表', 5, 'heiko-edge', genHeikoEdge),
  step(3, '④', '面に 垂直な 辺（全部）', '表', 5, 'heiko-faceedge', () => genHeikoFaceEdge('perp')),
  // 大問4〜6: 作図（各10点）
  step(4, undefined, '直方体の 展開図の 続きを かく', '表', 10, 'tenkai-cuboid', () => genTenkaiCuboid(2)),
  step(5, undefined, '立方体の 展開図の 続きを かく', '表', 10, 'tenkai-cube', () => genTenkaiCube(2)),
  step(6, undefined, '直方体の 見取図の 続きを かく', '表', 10, 'mitori-draw', () => genMitoriDraw('test')),
  // 大問7: 平面上の点の位置（各10点・20点）
  step(7, '①', '点の 位置を 表す', '表', 10, 'ichi-read', genIchiRead),
  step(7, '②', '点を かく', '表', 10, 'ichi-plot', genIchiPlot),

  /* ===== 裏・思考判断表現（計50点） ===== */
  // 大問8: 展開図を組み立てる（各10点・30点）
  step(8, '①', '重なる 点', '裏', 10, 'tenkai-point', genTenkaiPoint),
  step(8, '②', '重なる 辺', '裏', 10, 'tenkai-edge', genTenkaiEdge),
  step(8, '③', '平行な 面', '裏', 10, 'tenkai-face', () => genTenkaiFace('par')),
  // 大問9: あつ紙で直方体（各10点・20点）
  step(9, '①', 'あつ紙を 何まいずつ（3種類）', '裏', 10, 'kousei-paper', () => genKouseiPaper('abc')),
  step(9, '②', 'あつ紙を 何まいずつ（4まい＋正方形）', '裏', 10, 'kousei-paper', () => genKouseiPaper('square')),

  /* ===== いかそう算数（参考・点数なし） ===== */
  step(10, '①', 'いかそう算数（リボンの 線を 展開図に）', '参考', 0, 'katsuyo-ribbonnet', genKatsuyoRibbonNet),
  step(10, '②', 'いかそう算数（リボンの 長さ）', '参考', 0, 'katsuyo-ribbon', genKatsuyoRibbon),
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
  'kousei-sort': '正方形だけで かこまれた 形が 立方体、長方形（と正方形）で かこまれた 形が 直方体。',
  'kousei-cube': '立方体は 正方形 6つ。面 6・辺 12・頂点 8。見えない ところも 数えよう。',
  'kousei-cuboid': '向かい合う 面は 同じ 形。同じ 向きの 辺は 4本ずつ、3組。',
  'kousei-higo': 'ひごは 辺、ねん土玉は 頂点。同じ 長さの 辺は 4本ずつ。',
  'kousei-paper': '直方体は 同じ形の 面が 2まいずつ。くっつく 辺の 長さが 合う 面を えらぼう。',
  'heiko-face': '向かい合う 面は 平行、となり合う 面は 垂直（4つ）。',
  'heiko-edge': '同じ 向きの 辺が 平行。はなれた ところも ふくめて 3本。',
  'heiko-edgeperp': '直角に 交わる 辺が 垂直。両はしの 頂点から 2本ずつ。',
  'heiko-faceedge': '面から まっすぐ 出て いる 4本が 垂直。向かいの 面の 4本が 平行。',
  'tenkai-cube': '向かい合う 面が 3組 そろうように、重ならない ところへ 面を 足そう。',
  'tenkai-cuboid': 'くっつく 辺の 長さを そろえる。同じ形の 面が 2まいずつ。',
  'tenkai-point': '面を 1つずつ 折り上げて、同じ 頂点に 集まる 点を さがそう。',
  'tenkai-edge': '辺の 両はしの 点と 重なる 点を さがし、その 点を むすんだ 辺が 答え。',
  'tenkai-face': 'まっすぐ 3つ ならんだ 面の 両はしは 向かい合う（平行）。',
  'mitori-draw': '平行な 辺は 同じ 向き・同じ長さ。見えない 3本は 点線で。',
  'ichi-read': '横（右へ）を 先、たて（上へ）を あとに 書く。',
  'ichi-plot': 'もとの 点から 右へ 横の 数、上へ たての 数 進もう。',
};

const HOW_BY_MODULE: Record<string, string> = {
  kousei: '見えない 面・辺・頂点も 数えよう。向かい合う 面は 同じ 形。',
  heiko: '平行は 交わらない、垂直は 直角に 交わる。',
  tenkai: '頭の 中で 組み立てよう。向かい合う 面が 3組 そろうか たしかめる。',
  mitori: '見えない 辺は 点線。平行な 辺は 平行に かく。',
  ichi: '横 → たて → 高さ の 順に 表そう。',
  katsuyo: 'リボンは 横に 2回、たてに 2回、高さを 4回 通る。',
  eh: 'Aさんの 考えを、見えない ところや 組み立てで たしかめよう。',
  mock: '見直しは「見えない ところを 数えたか」「組み立てて 重ならないか」から。',
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
