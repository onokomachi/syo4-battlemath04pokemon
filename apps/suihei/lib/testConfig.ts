// このファイルは単元アプリ syo4-suityoku-heikotosikakkei の src/lib/testConfig.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 「本番テストモード」の設定表。
 *
 * 単元テストの形（表＝知識・技能100点／裏＝思考・判断・表現50点）を再現する。
 * 大問の構成と技能の配分は、外部基準として入手した現物相当のテスト
 * （啓林館「算数自己評価テスト 5. 垂直・平行と四角形」全6大問）の分類に合わせた:
 *   大問1 三角定規で 垂直・平行な直線をかく（作図）
 *   大問2 長方形をかく（作図）
 *   大問3 図の中から 垂直な組・平行な組を すべて見つける（判定）
 *   大問4 四角形の名前（判定・弁別）
 *   大問5 平行四辺形の 角・辺・対角線（計算・用語）
 *   大問6 平行四辺形をかく（作図）
 * 6大問中3大問（17小問中4問＝約24%）が作図なので、表でも作図に6問=30点を割いている。
 *
 * さらに指導要領解説（p.202-204）と東京書籍の指導内容から、現物テストに無い
 *   ・平行の性質（幅はどこでも等しい）
 *   ・平行線でできる角
 *   ・敷き詰め（内容の取扱い(7)の必須事項）
 *   ・包含関係（正方形は平行四辺形といえるか）
 * を足している。
 *
 * 採点は「一発正解のみ得点」。まちがえて直した場合は 0点にする（本番の答案と同じ扱い）。
 *
 * 各ステップは skillId の候補（pool）から1つを選んで出題する。すべての実装済みレベルが
 * どこかの pool に入っていることを検証スクリプトで機械的に確かめており、
 * 「実装したのに本番テストに1度も出ないレベル」が構造的に生まれないようにしている。
 */
import { GeoProblem } from './problemTypes';
import { ALL_SKILL_IDS, SkillId, generate } from './problems';
import { pick } from './problems/rng';
import { skillToModuleId, type ModuleId } from '../store/progressStore';

export type Section = '表' | '裏';

export interface TestStep {
  daimon: number;
  sub: string;
  title: string;
  section: Section;
  points: number;
  /** この設問で出題されうる skillId。実際の出題はここから1つ選ぶ。 */
  pool: SkillId[];
  /** 紙のテストと同じ形の問題だけを出すときの条件（問題文で見分ける） */
  want?: string;
}

/**
 * 表＝知識・技能（20問 × 5点 ＝ 100点）。
 * 現物テストは17小問中4問（約24%）が作図なので、表でも作図に6問（30点）を割いている。
 */
/*
 * 紙のテスト（新学社 4年東「9. 垂直、平行と四角形」）と同じ大問・配点にしている。
 * 表＝知識・技能100点（大問1〜7）、裏＝思考・判断・表現50点（大問8〜10）。図と数は毎回かわる。
 */
const OMOTE: TestStep[] = [
  // 大問1: 図を見て答える（垂直な直線の組10点・平行な直線5点）
  { daimon: 1, sub: '①', title: '垂直な 直線を 見つける', section: '表', points: 10, pool: ['rel-perp'] },
  { daimon: 1, sub: '②', title: '平行な 直線を 見つける', section: '表', points: 5, pool: ['rel-para'] },
  // 大問2: 平行四辺形（平行な辺・辺の長さ・角の大きさ）
  { daimon: 2, sub: '③', title: '平行四辺形の 辺と角', section: '表', points: 5, pool: ['prop-oppo'] },
  { daimon: 2, sub: '④', title: '平行四辺形の 辺と角', section: '表', points: 5, pool: ['prop-oppo'] },
  { daimon: 2, sub: '⑤', title: '平行四辺形の 角', section: '表', points: 5, pool: ['prop-oppo', 'prop-adj'] },
  // 大問3: ひし形（辺の長さ・角の大きさ）
  { daimon: 3, sub: '⑥', title: 'ひし形の 辺と角', section: '表', points: 5, pool: ['prop-rhombus'] },
  { daimon: 3, sub: '⑦', title: 'ひし形の 辺と角', section: '表', points: 5, pool: ['prop-rhombus'] },
  // 大問4: 2本の対角線が垂直な四角形
  { daimon: 4, sub: '⑧', title: '対角線が 垂直な 四角形', section: '表', points: 10, pool: ['diag-facts', 'diag-compare'] },
  // 大問5: 垂直な直線・平行な直線をひく
  { daimon: 5, sub: '⑨', title: '垂直な 直線を ひく', section: '表', points: 10, pool: ['draw-perp'] },
  { daimon: 5, sub: '⑩', title: '平行な 直線を ひく', section: '表', points: 10, pool: ['draw-para'] },
  // 大問6・7: 台形・平行四辺形・ひし形をかく
  { daimon: 6, sub: '⑪', title: '台形を かく', section: '表', points: 10, pool: ['draw-quad'], want: '**台形**' },
  { daimon: 7, sub: '⑫', title: '平行四辺形を かく', section: '表', points: 10, pool: ['draw-quad'], want: '**平行四辺形**' },
  { daimon: 7, sub: '⑬', title: 'ひし形を かく', section: '表', points: 10, pool: ['draw-quad'], want: '**ひし形**' },
];

const URA: TestStep[] = [
  // 大問8: 角の大きさから、平行な直線を見つける
  { daimon: 8, sub: '⑭', title: '角の大きさから 平行を 見ぬく', section: '裏', points: 10, pool: ['prop-parallel'] },
  // 大問9: 対角線から四角形の名前を考える（2問）
  { daimon: 9, sub: '⑮', title: '対角線から 四角形を 考える', section: '裏', points: 10, pool: ['diag-reverse'] },
  { daimon: 9, sub: '⑯', title: '対角線から 四角形を 考える', section: '裏', points: 10, pool: ['diag-reverse'] },
  // 大問10: 組み合わせてできた四角形の名前と、そういえるわけ
  { daimon: 10, sub: '⑰', title: 'できた 四角形の 名前（平行な辺の組）', section: '裏', points: 10, pool: ['name-pairs', 'name-basic'] },
  { daimon: 10, sub: '⑱', title: 'そう いえる わけ（せいしつの ことば）', section: '裏', points: 10, pool: ['prop-fact'] },
];

/**
 * 紙のテストには出ないが、単元で学ぶので練習に残している項目。
 * 本番テストには出さない（テスト予想を正直に保つ）。scripts/verify-problems.ts が「全項目 − テストの項目」と一致することを確かめる。
 */
export const PRACTICE_ONLY_SKILLS: SkillId[] = [
  'rel-extend', 'rel-find', 'rel-prop', 'draw-order', 'draw-rect',
  'name-counter', 'name-find', 'name-include', 'name-table', 'name-sort',
  'diag-mean', 'diag-cut', 'tile-fit', 'tile-inside', 'tile-angle',
  'life-map', 'life-object', 'eh-line', 'eh-quad', 'eh-diag',
];

export const TEST_STEPS: TestStep[] = [...OMOTE, ...URA];

export const OMOTE_MAX = OMOTE.reduce((s, t) => s + t.points, 0); // 100
export const URA_MAX = URA.reduce((s, t) => s + t.points, 0); // 50

/** 指定した設問の問題を1つ作る。 */
export function generateTestProblem(step: TestStep): GeoProblem {
  for (let i = 0; i < 300; i++) {
    const p = generate(pick(step.pool));
    if (!step.want || p.prompt.includes(step.want)) return p;
  }
  return generate(pick(step.pool));
}

/**
 * 本番テストの出題プールに載っていないスキルの一覧。
 * 空でなければ「実装したのにテストに出ないレベル」があるということなので、
 * 検証スクリプトで失敗として扱う。
 */
export function skillsMissingFromTest(): SkillId[] {
  const inTest = new Set(TEST_STEPS.flatMap((s) => s.pool));
  return ALL_SKILL_IDS.filter((id) => !inTest.has(id));
}

/* ---------------- テストのあとに出す「やり方の一言」 ---------------- */

/**
 * まちがえた問題に添える、やり方のひとこと。
 * テスト中は出さない。**終わってから**まちがえた問題にだけ添える。
 * 項目ごとに書いたものが無ければ、モジュール（記号の前半）のものを使う。
 */
const HOW_BY_SKILL: Record<string, string> = {
  'rel-perp': '2本の 直線が 交わって できる角が 直角なら 垂直だよ。',
  'rel-extend': 'のばして 交わるかどうかで 見る。今 交わっていなくても 垂直・平行は きまるよ。',
  'rel-para': '1本の 直線に 垂直な 2本は、たがいに 平行だよ。',
  'prop-rhombus': 'ひし形は 4つの辺が すべて 同じ長さ。向かい合う辺は 平行だよ。',
  'prop-parallel': '平行四辺形は 向かい合う 2組の辺が 平行。向かい合う角も 等しいよ。',
  'diag-mean': '対角線は 向かい合う 頂点どうしを 結んだ 直線だよ。',
  'diag-facts': 'ひし形・正方形の 対角線は 垂直に 交わる。長方形・正方形は 長さが 等しいよ。',
  'diag-reverse': '対角線の 性質から 形を 決めるときは、「垂直か」「長さが等しいか」「まん中で交わるか」の3つを 見よう。',
  'draw-perp': '三角じょうぎの 直角を 直線に あててから、もう1つで すべらせよう。',
  'draw-para': '三角じょうぎを 1つ 固定して、もう1つを すべらせると 平行が かけるよ。',
  'tile-angle': 'しきつめでは、1つの点に 集まる角の 大きさの 合計が 360°に なるよ。',
};

const HOW_BY_MODULE: Record<string, string> = {
  rel: '交わって できる角が 直角なら 垂直。1本に 垂直な 2本は 平行。',
  draw: '三角じょうぎは 1つを 固定して、もう1つを すべらせるのが こつだよ。',
  name: '辺の 平行が 何組あるかで 名前が きまるよ（1組＝台形、2組＝平行四辺形）。',
  prop: '辺の長さ・角の大きさ・平行の組の 3つを 順に たしかめよう。',
  diag: '対角線は「垂直か」「長さが等しいか」「まん中で交わるか」の3つで 見分けるよ。',
  tile: '1つの点に 集まる角の 合計が 360°に なるかで 考えよう。',
  life: '身のまわりでも、直角に なっているか・のばしたら 交わるかで 見よう。',
  eh: 'その図の 辺が ほんとうに 平行か、のばして たしかめよう。',
  mock: '見直しは 垂直・平行の 見分けから。のばして 交わるかで 考えよう。',
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
