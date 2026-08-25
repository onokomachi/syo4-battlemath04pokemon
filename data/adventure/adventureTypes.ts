/**
 * adventureTypes.ts — 3Dアドベンチャーモード(ナンバーランド)の型定義。
 *
 * 既存の学習資産(MATH_CATEGORIES / ALL_PROBLEM_SETS / difficultyMap)は
 * いっさい作り替えず、「サブトピック1つ = モンスター1体」という対応だけを
 * 新しく足している。したがって問題を増やせば図鑑もそのまま増える。
 */

import type { ElementId } from './elements';

// ============================================================
// モンスター
// ============================================================

/** とくせい。バトル中に1回だけ発動する、覚えやすい6種類。 */
export type AbilityId =
  | 'hint'      // ピンチのとき、1回だけヒントをタダで見られる
  | 'guard'     // 1回だけ、まちがえてもダメージを受けない
  | 'power'     // 正解のダメージが 1.3 倍
  | 'lucky'     // ボールの成功率アップ
  | 'heal'      // 2問れんぞく正解でHPが少し回復
  | 'first';    // さいしょの1問のダメージが2倍

export interface AbilityDef {
  id: AbilityId;
  name: string;
  description: string;
  icon: string;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  hint: { id: 'hint', name: 'ものしり', description: 'バトル中に1回だけ、ヒントをタダで見られる。', icon: '💡' },
  guard: { id: 'guard', name: 'ふんばり', description: '1回だけ、まちがえてもダメージを受けない。', icon: '🛡️' },
  power: { id: 'power', name: 'ちからもち', description: '正解したときのダメージが1.3ばいになる。', icon: '💪' },
  lucky: { id: 'lucky', name: 'しあわせ', description: 'ボールでつかまえやすくなる。', icon: '🍀' },
  heal: { id: 'heal', name: 'いやし', description: '2問れんぞくで正解するとHPが少し回復する。', icon: '✨' },
  first: { id: 'first', name: 'せんせいのいちげき', description: 'さいしょの1問だけダメージが2ばい。', icon: '⚡' },
};

/** 見た目のグレード。難易度から決まり、生成プロンプトのスタイル段を切り替える。 */
export type ArtTier = 'baby' | 'brave' | 'knight' | 'dragon';

export interface MonsterDef {
  /** 図鑑番号(1始まり)。ワールド順→サブトピック順で決まる。 */
  no: number;
  /** 安定ID。スプライトのファイル名にも使う(mon-001 など)。 */
  id: string;
  /** カタカナの名前 */
  name: string;
  /** 出題元の単元(MATH_CATEGORIES の name) */
  unit: string;
  /** 出題元のサブトピック(ALL_PROBLEM_SETS のキー) */
  subtopic: string;
  type: ElementId;
  /** difficultyMap 由来の 1〜5 */
  difficulty: number;
  tier: ArtTier;
  baseHp: number;
  baseAtk: number;
  ability: AbilityId;
  /** 図鑑の説明文 */
  flavor: string;
  /** スプライト生成プロンプトに差し込む英語のモチーフ */
  motif: string;
  /** 進化後の姿(熟達したときだけ現れる)。進化しないモンスターは undefined。 */
  evolution?: {
    id: string;
    name: string;
    flavor: string;
    /** 選定理由(なぜこの項目に進化を置いたか) */
    reason: string;
  };
  /** 伝説・幻のときだけ立つ */
  rarity?: 'legend' | 'mythical';
}

/** プレイヤーが所有している1体分の状態 */
export interface OwnedMonster {
  /** 個体の一意ID */
  uid: string;
  /** MonsterDef.id */
  defId: string;
  level: number;
  exp: number;
  /** ニックネーム(未設定なら図鑑名) */
  nickname?: string;
  caughtAt: number;
  /**
   * いまのHP。バトルで1体ずつ交代していくため、個体ごとに持つ。
   * undefined は「満タン」の意味(古いセーブデータとの互換のため)。
   * 最大HPは statsAtLevel(def, level).maxHp から毎回もとめる。
   */
  hp?: number;
}

/**
 * テキトウ団の下っ端に さらわれた個体。
 * 手持ち(owned/party)からは抜けるが、個体データそのものは失われない。
 * さらわれた町のバッジを取れば、その町で奪還戦に挑めるようになる。
 */
export interface KidnappedRecord {
  mon: OwnedMonster;
  townId: string;
}

// ============================================================
// フィールド(町・ルート)
// ============================================================

export type Biome =
  | 'meadow'    // 草原
  | 'highland'  // 風の高原
  | 'quarry'    // 石切りの谷
  | 'ruins'     // 遺跡
  | 'lake'      // 湖
  | 'falls'     // 滝
  | 'fog'       // 霧の森
  | 'workshop'  // からくり工房
  | 'tile'      // タイル平原
  | 'cape'      // 岬
  | 'sweets'    // お菓子の街
  | 'clock'     // 時計塔
  | 'desert'    // 砂漠
  | 'forest'    // 巨大樹の森
  | 'league';   // ナンバーリーグの回廊(屋内)

export interface BiomeStyle {
  /** 地面のベース色 */
  ground: string;
  /** 地面の差し色(パッチ) */
  groundAccent: string;
  /** 草むらの色 */
  grass: string;
  /** 空の上側・下側 */
  skyTop: string;
  skyBottom: string;
  /** 霧の色と濃さ */
  fog: string;
  fogDensity: number;
  /** 太陽光の色と強さ */
  sun: string;
  sunIntensity: number;
  ambient: string;
  ambientIntensity: number;
  /** 装飾の種類 */
  props: Array<'tree' | 'pine' | 'rock' | 'flower' | 'crystal' | 'gear' | 'cake' | 'cactus' | 'pillar' | 'windmill' | 'lamp' | 'mushroom'>;
  /** 水面を張るか */
  water: boolean;
}

/** フィールド上に立つNPC(トレーナー・村人・マスター) */
export interface FieldNpcDef {
  id: string;
  kind: 'villager' | 'trainer' | 'master' | 'rival' | 'nurse' | 'shop' | 'elite' | 'champion'
    // 祠(伝説のモンスター)と、テキトウ団のイベント。どちらも
    // 「近づいて しらべる」という同じ操作で扱えるよう、NPCとして表す。
    | 'shrine' | 'team'
    // テキトウ団の下っ端の待ち伏せ。フィールドを ゆっくり徘徊し、近づくと
    // 話しかけなくても自動でバトルになる(FieldScene が npcs とは別に扱う)。
    | 'ambush';
  name: string;
  /** スプライトのファイル名(assets/adventure/npc/<sprite>.png) */
  sprite: string;
  /** フィールド座標 */
  x: number;
  z: number;
  /** 話しかけたときのセリフ(バトル前) */
  lines: string[];
  /** 倒したあとのセリフ */
  afterLines?: string[];
  /** トレーナーの手持ち(MonsterDef.id とレベル) */
  party?: Array<{ defId: string; level: number }>;
  /** 出題に使うサブトピック。省略時は party のモンスターのサブトピック */
  subtopics?: string[];
  /** 勝ったときにもらえる報酬 */
  reward?: { mp: number; balls?: number };
  /** このNPCを倒すと解放されるもの */
  grantsBadge?: boolean;
  /** kind:'shrine' のとき、対応する伝説のID */
  legendId?: string;
  /** kind:'team' のとき、対応する章のID('hideout' はアジト) */
  teamChapterId?: string;
  /** 祠の見た目 */
  shrineStyle?: { color: string; style: 'monolith' | 'torii' | 'ring' | 'pillar' };
}

export interface TownDef {
  /** 1始まりのワールド番号(MATH_CATEGORIES の並び順と一致) */
  no: number;
  id: string;
  /** 町の名前 */
  name: string;
  /** ふりがな付きの副題 */
  subtitle: string;
  /** 対応する単元名 */
  unit: string;
  type: ElementId;
  biome: Biome;
  /** フィールドの広さ(1辺のタイル数) */
  size: number;
  /** 導入テキスト(初回入場時) */
  intro: string[];
  /** 単元マスターの説明 */
  masterTitle: string;
  /** 野生モンスターの平均レベル */
  wildLevel: number;
  npcs: FieldNpcDef[];
  /** 地面テクスチャの生成プロンプト */
  groundTexturePrompt: string;
}

// ============================================================
// バトル
// ============================================================

export type BattleKind =
  | 'wild' | 'trainer' | 'master' | 'rival' | 'elite' | 'champion'
  | 'legend'      // 伝説・幻(祠。勝つと必ず仲間になる)
  | 'legend-wild' // 伝説がフィールドにまれに現れる「おためし」の遭遇(仲間にはならない)
  | 'team'        // テキトウ団(本筋: 5章+アジト戦)
  | 'ambush';     // テキトウ団の下っ端(日常的な待ち伏せ・奪還戦)

export interface BattleOpponentMonster {
  defId: string;
  level: number;
}

export interface BattleSetup {
  kind: BattleKind;
  /** トレーナー戦のときの相手情報 */
  trainerName?: string;
  trainerSprite?: string;
  trainerLines?: string[];
  trainerAfterLines?: string[];
  opponents: BattleOpponentMonster[];
  /** 出題に使うサブトピック(空なら相手モンスターのサブトピック) */
  subtopics?: string[];
  /** 何問で決着させるか(相手1体あたり) */
  questionsPerOpponent: number;
  /** 捕まえられるか */
  catchable: boolean;
  reward?: { mp: number; balls?: number };
  townId?: string;
  grantsBadge?: boolean;
  /** kind:'legend' のとき、勝ったら必ず仲間になる伝説のID */
  legendId?: string;
  /** kind:'team' のとき、クリア扱いにする章ID */
  teamChapterId?: string;
  /** kind:'ambush' のとき、奪還戦(下っ端のかくれ家)かどうか。false/省略なら日常の待ち伏せ */
  isRescue?: boolean;
}

export interface BattleResultSummary {
  won: boolean;
  correct: number;
  incorrect: number;
  caughtDefId?: string;
  mpGained: number;
  expGained: number;
  /** レベルが上がった手持ちの uid */
  leveledUp: string[];
  /** 「にげる/こうさんする」で自分から退いたか(HP0の敗北と区別する) */
  fled: boolean;
  /** kind:'legend-wild' で、HPを半分以上けずって「みとめられた」か */
  recognized: boolean;
}

// ============================================================
// アイテム
// ============================================================

export type ItemId = 'ball' | 'greatball' | 'potion' | 'hintbook' | 'teamshard';

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  icon: string;
  price: number;
  /** ボールの基礎捕獲力 */
  catchPower?: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  ball: {
    id: 'ball',
    name: 'サンスウボール',
    description: 'よわらせたモンスターに投げてつかまえる、いちばんふつうのボール。',
    icon: '⚪',
    price: 30,
    catchPower: 1,
  },
  greatball: {
    id: 'greatball',
    name: 'スーパーボール',
    description: 'サンスウボールよりつかまえやすい、青いボール。',
    icon: '🔵',
    price: 90,
    catchPower: 1.8,
  },
  potion: {
    id: 'potion',
    name: 'げんきドリンク',
    description: '自分のHPを30かいふくする。バトル中にも使える。',
    icon: '🧃',
    price: 60,
  },
  hintbook: {
    id: 'hintbook',
    name: 'ヒントのしおり',
    description: 'バトル中に1回、ヒントをタダで見られる。',
    icon: '🔖',
    price: 50,
  },
  teamshard: {
    id: 'teamshard',
    name: 'テキトウ団のバッジのかけら',
    description: 'テキトウ団の下っ端をたおすと手に入る。ショップでは売っていない。たくさん集めると、アジトのボス戦で使える特別な交換ができる。',
    icon: '🔶',
    price: 0,
  },
};
