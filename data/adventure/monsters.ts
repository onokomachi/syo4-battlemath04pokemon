/**
 * monsters.ts — 図鑑(全151体 + 単元ボス14体)の組み立て。
 *
 * 名前や見た目は monsterRoster.ts に、タイプは elements.ts に、難易度は
 * 既存の constants.ts(difficultyMap) にある。ここではそれらを突き合わせて
 * MonsterDef を決定的に作るだけなので、問題データを足せば図鑑も自動で増える。
 */

import { MATH_CATEGORIES, difficultyMap } from '../../constants';
import { UNIT_TO_ELEMENT, type ElementId } from './elements';
import { MONSTER_ROSTER, type RosterRow } from './monsterRoster';
import { EVOLUTION_BY_SUBTOPIC } from './evolutions';
import { ALL_LEGENDS } from './legends';
import type { AbilityId, ArtTier, MonsterDef } from './adventureTypes';
import { LEGACY_DEX_ORDER, ADDED_DEX_ORDER } from './legacyDex';

const ABILITY_ORDER: AbilityId[] = ['hint', 'power', 'guard', 'lucky', 'heal', 'first'];

const tierOf = (difficulty: number): ArtTier => {
  if (difficulty >= 5) return 'dragon';
  if (difficulty === 4) return 'knight';
  if (difficulty === 3) return 'brave';
  return 'baby';
};

const pad3 = (n: number): string => String(n).padStart(3, '0');

/** サブトピック名 → ロスター行(単元をまたいで一意) */
const ROSTER_BY_SUBTOPIC: Record<string, RosterRow> = (() => {
  const map: Record<string, RosterRow> = {};
  for (const rows of Object.values(MONSTER_ROSTER)) {
    for (const row of rows) map[row[0]] = row;
  }
  return map;
})();

/**
 * MATH_CATEGORIES の並び順(=学習順)でサブトピックを走査し、図鑑番号を振る。
 * ロスターに無いサブトピックが出てきても落ちないよう、名前と説明は
 * 自動生成でうめる(問題を追加したときに図鑑が壊れないようにするため)。
 */
const LEGACY_NO: Record<string, number> = Object.fromEntries(
  [...LEGACY_DEX_ORDER, ...ADDED_DEX_ORDER].map((t, i) => [t, i + 1]),
);

const buildDex = (): MonsterDef[] => {
  const list: MonsterDef[] = [];
  // 図鑑番号は legacyDex.ts の名簿で決まる（はじめの151体＋あとから足した順）。単元の途中に足しても、
  // 前からの絵とつかまえた記録がずれないように。名簿に無いものは その後ろに仮に振る
  let nextNo = LEGACY_DEX_ORDER.length + ADDED_DEX_ORDER.length;

  for (const category of MATH_CATEGORIES) {
    const type: ElementId = UNIT_TO_ELEMENT[category.name] ?? 'kazu';
    for (const group of category.groups) {
      for (const subtopic of group.subtopics) {
        const no = LEGACY_NO[subtopic] ?? ++nextNo;
        const row = ROSTER_BY_SUBTOPIC[subtopic];
        const difficulty = difficultyMap[subtopic] ?? 2;
        const tier = tierOf(difficulty);
        const evo = EVOLUTION_BY_SUBTOPIC[subtopic];
        list.push({
          no,
          id: `mon-${pad3(no)}`,
          name: row ? row[1] : subtopic,
          unit: category.name,
          subtopic,
          type,
          difficulty,
          tier,
          // 強さはおもにレベル（＝練習した量）で決まる。難しい単元ほど少しだけ強い（1.5倍ほど）。
          // 差を大きくすると強いモンスターばかり使われ、ほかの単元が使われなくなる（2026-10 先生と決めた）
          baseHp: 28 + difficulty * 4,
          baseAtk: Math.round(8 + difficulty * 1.5),
          ability: ABILITY_ORDER[(no - 1) % ABILITY_ORDER.length],
          flavor: row ? row[3] : `${category.name}の「${subtopic}」からうまれたモンスター。`,
          motif: row ? row[2] : 'a round friendly mascot holding a small number tile',
          evolution: evo
            ? { id: `evo-${pad3(no)}`, name: evo.name, flavor: evo.flavor, reason: evo.reason }
            : undefined,
        });
      }
    }
  }
  return list;
};

export const MONSTER_DEX: MonsterDef[] = buildDex();

// ============================================================
// 単元ボス(各町の「単元マスター」のエースモンスター)
// ============================================================

/** [単元名, 名前, モチーフ, 説明, 見た目グレード] */
const BOSS_ROWS: Array<[string, string, string, string, ArtTier]> = [
  ['大きい数のしくみ', 'ケタゴラス', 'A colossal, elegant sky manta ray creature gliding with its broad diamond-shaped wings spread wide.', '一兆までの数を、まばたきひとつで読みあげるという。', 'knight'],
  ['折れ線グラフと表', 'グラフェニクス', 'a graceful violet phoenix with one long smoothly curved tail feather rising behind it', '風にのって、これから起こる変わり方を先に見せる。', 'knight'],
  ['わり算の筆算(÷1けた)', 'ワリューガ', 'A tall, lean four-legged dragon built for speed, like a cross between a greyhound and a wyvern, with a narrow wedge-shaped head and two long horns swept straight back.', 'どんな数もきれいにわけてしまう、谷の守り手。', 'dragon'],
  // 「盾が分度器になる」と書くと、分度器が画面いっぱいの円形ハローとして
  // 描かれてしまい、生成し直すたびに背景の一部と誤認された。
  // (実際に使っている絵は、元の生成でたまたま出た「剣と盾を持つ子猫の騎士」)
  ['角の大きさ', 'カクセイバー', 'A tall, elegant praying-mantis swordmaster creature standing upright on four slender legs, with its long body held in a ready guard.', '360°すべての角を、三角じょうぎのカマのひとふりで測るという。', 'knight'],
  ['小数のしくみ', 'シズクィーン', 'A large, regal axolotl-like water dragon with a long, elegant body standing on four short legs, its flowing ribbon-like tail fin curled around its side.', '湖のぬし。0.1のつぶを自在にあやつる。', 'knight'],
  ['わり算の筆算(÷2けた)', 'ソウリュウガ', 'A colossal four-legged dragon with obsidian-black armored scales, a twin-crested head with two swept-back horns side by side, and two long tails that flow down and curl together like twin waterfalls of molten light.', '双子の滝にすむ竜。2本のしっぽの流れで、2けたの数を軽々とわる。', 'dragon'],
  ['がい数', 'ミツモリオン', 'A majestic giant moth creature hovering with four huge, broad wings spread wide.', '霧の森のぬし。すべてをだいたいで見とおす。', 'knight'],
  ['計算のきまり', 'カラクリード', 'A massive armored hermit-crab creature whose shell is a blacksmith\'s furnace built from dark iron plates riveted together, with a short chimney on top whose mouth glows.', '工房のぬし。（　）の形のハサミで、先に計算するところをけっしてまちがえない。', 'knight'],
  ['面積', 'メンセキオン', 'A colossal ankylosaur-like armored beast on four pillar legs, with a broad, low body and a heavy club tail.', '広さをひとにらみで言いあてる、タイル平原の王。', 'knight'],
  ['小数のかけ算とわり算', 'シオカゼドラゴ', 'a sleek blue-and-white sea dragon with long fins curled close against its body', '岬の波にのって、小数の計算をあやつる海の竜。', 'dragon'],
  ['分数', 'ブンスウィート', 'A regal peacock-like creature with a long, graceful neck and a huge upright tail fan.', 'お菓子の街の王。どんなケーキも公平に切りわける。', 'knight'],
  ['変わり方調べ', 'トキメクリ', 'A colossal clockwork dragon coiled like a clock spring, with a round clock-face shield set in its chest, two long horns shaped like clock hands and a long tail ending in a heavy pendulum weight.', '時計塔のぬし。2つの数のかんけいを時をこえて見せる。', 'knight'],
  ['直方体と立方体', 'キューブロス', 'A lean, majestic desert jackal beast standing tall on four long legs, with tall pointed ears and a long, narrow muzzle.', '砂漠の遺跡を守る立方体の番人。展開すると地図になる。', 'knight'],
  ['倍の見方', 'バイジュノキ', 'A towering ancient elk creature on four powerful legs, with an enormous crown of antlers that grow like tree branches: each branch splits into two, then two again, then two again, doubling at every fork.', '巨大樹の森のぬし。何ばいにでも大きくなれるという。', 'dragon'],
  // ↓ 2026-10 に足した町のボス。ボスの番号（boss-NNN＝絵のファイル名）がずれないよう、いつも いちばん後ろに足す
  ['垂直・平行と四角形', 'パラレオン', 'a grand white stone guardian golem with perfectly parallel pillar arms and a right-angle crest', '台地の道を すべて 垂直と平行に しいた、石の守り手。', 'knight'],
];

const buildBosses = (): MonsterDef[] =>
  BOSS_ROWS.map(([unit, name, motif, flavor, tier], i) => {
    const category = MATH_CATEGORIES.find(c => c.name === unit);
    // ボスの出題は、その単元でいちばん難しいサブトピックから引く
    const subtopics = category ? category.groups.flatMap(g => g.subtopics) : [];
    const hardest = subtopics.slice().sort(
      (a, b) => (difficultyMap[b] ?? 1) - (difficultyMap[a] ?? 1),
    )[0] ?? subtopics[0] ?? '';
    const difficulty = Math.min(5, (difficultyMap[hardest] ?? 3) + 1);
    return {
      no: 1000 + i + 1,
      id: `boss-${pad3(i + 1)}`,
      name,
      unit,
      subtopic: hardest,
      type: UNIT_TO_ELEMENT[unit] ?? 'kazu',
      difficulty,
      tier,
      baseHp: 40 + difficulty * 10,
      baseAtk: 9 + difficulty * 3,
      ability: ABILITY_ORDER[i % ABILITY_ORDER.length],
      flavor,
      motif,
    };
  });

export const BOSS_DEX: MonsterDef[] = buildBosses();

// ============================================================
// 伝説・幻(legends.ts の定義を MonsterDef に変換して図鑑に載せる)
// ============================================================

export const LEGEND_DEX: MonsterDef[] = ALL_LEGENDS.map(l => ({
  no: l.no,
  id: l.id,
  name: l.name,
  unit: l.units[0] ?? '',
  subtopic: '',
  type: l.type,
  difficulty: 5,
  tier: 'dragon',
  baseHp: l.baseHp,
  baseAtk: l.baseAtk,
  // 伝説はどれも「ものしり」。バトルが長くなるので、ヒントを1回もらえる方が
  // 小4にとってはフェアになる。
  ability: 'hint',
  flavor: l.flavor,
  motif: l.motif,
  rarity: l.kind,
}));

export const ALL_MONSTERS: MonsterDef[] = [...MONSTER_DEX, ...BOSS_DEX, ...LEGEND_DEX];

const BY_ID: Record<string, MonsterDef> = Object.fromEntries(
  ALL_MONSTERS.map(m => [m.id, m]),
);

export const getMonster = (id: string): MonsterDef | undefined => BY_ID[id];

/** 単元名 → その単元のモンスター(図鑑順) */
export const MONSTERS_BY_UNIT: Record<string, MonsterDef[]> = (() => {
  const map: Record<string, MonsterDef[]> = {};
  for (const m of MONSTER_DEX) {
    (map[m.unit] ??= []).push(m);
  }
  return map;
})();

/** 単元名 → その単元のボス */
export const BOSS_BY_UNIT: Record<string, MonsterDef> = Object.fromEntries(
  BOSS_DEX.map(b => [b.unit, b]),
);

/** スプライトのパス。生成前でもレイアウトが崩れないようフォールバックを用意する。 */
export const getMonsterSprite = (id: string): string =>
  `${(import.meta as any).env?.BASE_URL ?? '/'}assets/adventure/monsters/${id}.png`;

// ---- レベルとステータス ----

export const statsAtLevel = (def: MonsterDef, level: number) => ({
  maxHp: Math.round(def.baseHp + def.baseHp * 0.12 * (level - 1)),
  atk: Math.round(def.baseAtk + def.baseAtk * 0.10 * (level - 1)),
});

/** Lv20 から上は、必要な経験値を この倍にする（やりこみ。2026-10-24 先生と決めた） */
export const LATE_LEVEL_FROM = 20;
export const LATE_LEVEL_MULT = 3;

/**
 * つぎのレベルまでに必要な経験値。Lv20 までは そのまま（はじめは気持ちよく上がる）、Lv20→21 からは3倍。
 * 目安（正解1問 約12）：Lv5→20 約135問・Lv20→40 約1,240問・Lv40→60 約2,040問（その分野の正解）。
 */
export const expToNext = (level: number): number =>
  (12 + level * 8) * (level >= LATE_LEVEL_FROM ? LATE_LEVEL_MULT : 1);

/** 進化する図鑑番号の一覧(図鑑で「進化する」印を出すのに使う) */
export const EVOLVING_IDS: Set<string> = new Set(
  MONSTER_DEX.filter(m => m.evolution).map(m => m.id),
);
