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
const buildDex = (): MonsterDef[] => {
  const list: MonsterDef[] = [];
  let no = 0;

  for (const category of MATH_CATEGORIES) {
    const type: ElementId = UNIT_TO_ELEMENT[category.name] ?? 'kazu';
    for (const group of category.groups) {
      for (const subtopic of group.subtopics) {
        no += 1;
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
          baseHp: 18 + difficulty * 7,
          baseAtk: 5 + difficulty * 3,
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
  ['大きい数のしくみ', 'ケタゴラス', 'a huge golden scarab-beetle guardian in polished abacus-bead armor, a starry cape draped over its wing cases', '一兆までの数を、まばたきひとつで読みあげるという。', 'knight'],
  ['折れ線グラフと表', 'グラフェニクス', 'a graceful violet phoenix whose long tail feathers rise in a sharp zigzag line', '風にのって、これから起こる変わり方を先に見せる。', 'knight'],
  ['わり算の筆算(÷1けた)', 'ワリューガ', 'a noble crimson armored dragon knight holding a great cleaving blade', 'どんな数もきれいにわけてしまう、谷の守り手。', 'dragon'],
  // 「盾が分度器になる」と書くと、分度器が画面いっぱいの円形ハローとして
  // 描かれてしまい、生成し直すたびに背景の一部と誤認された。
  // (実際に使っている絵は、元の生成でたまたま出た「剣と盾を持つ子猫の騎士」)
  ['角の大きさ', 'カクセイバー', 'a small cat-eared knight in armor holding a sword and a round shield', '360°すべての角を、剣のひとふりで測るという。', 'knight'],
  ['小数のしくみ', 'シズクィーン', 'a large blue-and-silver water dragon with a clear crystal crown on its brow', '湖のぬし。0.1のつぶを自在にあやつる。', 'knight'],
  ['わり算の筆算(÷2けた)', 'ソウリュウガ', 'a twin-headed copper clockwork dragon in heavy brass armor', '双子の滝にすむ2頭の竜。2けたの数を軽々とわる。', 'dragon'],
  ['がい数', 'ミツモリオン', 'a vast serene cream-and-white cloud whale drifting in mist, soft glowing markings along its flank', '霧の森のぬし。すべてをだいたいで見とおす。', 'knight'],
  ['計算のきまり', 'カラクリード', 'a grand steel clockwork golem with polished brass gears set in perfect order', '工房のぬし。歯車の順じょをけっしてまちがえない。', 'knight'],
  ['面積', 'メンセキオン', 'a colossal golden tile-armored tortoise, its broad shell a grid of glowing squares', '広さをひとにらみで言いあてる、タイル平原の王。', 'knight'],
  ['小数のかけ算とわり算', 'シオカゼドラゴ', 'a sleek blue-and-white sea dragon with long fins, riding a curling wave', '岬の波にのって、小数の計算をあやつる海の竜。', 'dragon'],
  ['分数', 'ブンスウィート', 'a regal pink-and-cream cake-castle golem knight in layered dessert armor', 'お菓子の街の王。どんなケーキも公平に切りわける。', 'knight'],
  ['変わり方調べ', 'トキメクリ', 'a violet clock-tower owl spirit with slowly turning gear rings around it', '時計塔のぬし。2つの数のかんけいを時をこえて見せる。', 'knight'],
  ['直方体と立方体', 'キューブロス', 'an ancient golden cube-sphinx of carved sandstone with glowing edges', '砂漠の遺跡を守る立方体の番人。展開すると地図になる。', 'knight'],
  ['倍の見方', 'バイジュノキ', 'a colossal green ancient tree dragon with glowing growth rings and vast roots', '巨大樹の森のぬし。何ばいにでも大きくなれるという。', 'dragon'],
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

/** つぎのレベルまでに必要な経験値 */
export const expToNext = (level: number): number => 12 + level * 8;

/** 進化する図鑑番号の一覧(図鑑で「進化する」印を出すのに使う) */
export const EVOLVING_IDS: Set<string> = new Set(
  MONSTER_DEX.filter(m => m.evolution).map(m => m.id),
);
