/**
 * gacha.ts — ガチャガチャ「サンスウカプセル」と、学習でもらえるアイテムのきまり。
 *
 * 子ども向けのガチャで気をつけたこと（根拠: Zendle & Cairns 2018 ガチャへの支出とギャンブルの問題の相関、
 * Deci, Koestner & Ryan 1999 「やっただけでもらえる」ごほうびは意欲を下げる）:
 *   ・お金では回せない。コインは「正解した・熟達した・マスターに勝った」ときにだけもらえる。
 *   ・MPでも回せるが、1日の回数に上限がある（MPのつかい道を作りつつ、回しつづけられないように）。
 *   ・出る確率をすべて画面に出す。10回でかならずシールが出る「天井」がある。
 *   ・シールは図鑑のモンスター（進化・ボス・伝説も）。めずらしいほど出にくく、その確率も画面に出す。
 *   ・シールを集めきっても、ごほうびは出さない（そろえるために回させる「コンプガチャ」にしない）。
 *   ・強さは買えない。中身は、バトルを少し楽にする道具と、見て楽しむシールだけ（シールではモンスターは手に入らない）。
 */
import type { ItemId, MonsterDef } from './adventureTypes';
import { BOSS_DEX, LEGEND_DEX, MONSTER_DEX } from './monsters';
import { ELEMENTS } from './elements';

export const GACHA_RULES = {
  /** MPで回すときの値段（2026-10-24 先生と決めた） */
  mpCost: 300,
  /** MPで回せるのは1日にこの回数まで */
  mpPullsPerDay: 3,
  /** この回数まわしてシールが出なければ、つぎはかならずシール */
  pity: 10,
} as const;

/** 道具は N・R、シールは 4つの めずらしさ */
export type GachaRarity = 'N' | 'R' | StickerTier;

/**
 * シールの めずらしさ。
 * normal = ふつうのモンスター／rare = 進化した すがた／super = 単元ボス／legend = 伝説・幻
 */
export type StickerTier = 'normal' | 'rare' | 'super' | 'legend';

export const RARITY_LABEL: Record<GachaRarity, string> = {
  N: 'ふつう', R: 'レア',
  normal: 'シール', rare: 'レアシール', super: 'スーパーレアシール', legend: 'でんせつシール',
};

export interface GachaItemPrize {
  kind: 'item';
  item: ItemId;
  count: number;
  rarity: 'N' | 'R';
  /** 重み（シールの重みと合わせて合計100で、そのまま％になる） */
  weight: number;
}

/** 道具の当たり（合計60％）。シールは STICKER_TIER_WEIGHT から */
export const GACHA_ITEM_TABLE: GachaItemPrize[] = [
  { kind: 'item', item: 'ball', count: 3, rarity: 'N', weight: 15 },
  { kind: 'item', item: 'potion', count: 1, rarity: 'N', weight: 13 },
  { kind: 'item', item: 'hintbook', count: 1, rarity: 'N', weight: 12 },
  { kind: 'item', item: 'greatball', count: 2, rarity: 'R', weight: 7 },
  { kind: 'item', item: 'revive', count: 1, rarity: 'R', weight: 5 },
  { kind: 'item', item: 'charm', count: 1, rarity: 'R', weight: 4 },
  { kind: 'item', item: 'scroll', count: 1, rarity: 'R', weight: 4 },
];

/** シールが出る確率（％）。めずらしいシールほど出にくい。合計40％ */
export const STICKER_TIER_WEIGHT: Record<StickerTier, number> = { normal: 30, rare: 7, super: 2, legend: 1 };
export const STICKER_TIERS: StickerTier[] = ['normal', 'rare', 'super', 'legend'];
export const STICKER_WEIGHT = STICKER_TIERS.reduce((a, t) => a + STICKER_TIER_WEIGHT[t], 0);

/**
 * シール = 図鑑のモンスター1体（進化した すがた・単元ボス・伝説・幻も）。
 * シール帳では 絵と「生態」（図鑑の説明）だけが見られる（強さ・つかまえ方は出さない）。
 */
export interface StickerDef {
  /** モンスターの id（mon-001・evo-001・boss-003・legend-kazu など）。絵のファイル名と同じ */
  id: string;
  name: string;
  /** 生態（図鑑の説明） */
  flavor: string;
  tier: StickerTier;
  /** タイプ（ふちの色） */
  type: keyof typeof ELEMENTS;
}

const toSticker = (m: MonsterDef, tier: StickerTier): StickerDef =>
  ({ id: m.id, name: m.name, flavor: m.flavor, tier, type: m.type });

/** シール帳の並び：ふつう → 進化（それぞれ進化前のとなり）→ 単元ボス → 伝説・幻 */
export const STICKERS: StickerDef[] = [
  ...MONSTER_DEX.flatMap(m => [
    toSticker(m, 'normal'),
    ...(m.evolution ? [{ id: m.evolution.id, name: m.evolution.name, flavor: m.evolution.flavor, tier: 'rare' as const, type: m.type }] : []),
  ]),
  ...BOSS_DEX.map(m => toSticker(m, 'super')),
  ...LEGEND_DEX.map(m => toSticker(m, 'legend')),
];

const STICKER_BY_ID: Record<string, StickerDef> = Object.fromEntries(STICKERS.map(s => [s.id, s]));
export const getSticker = (id: string): StickerDef | undefined => STICKER_BY_ID[id];

export const stickersOfTier = (tier: StickerTier): StickerDef[] => STICKERS.filter(s => s.tier === tier);

export type GachaPrize =
  | { kind: 'item'; item: ItemId; count: number; rarity: 'N' | 'R' }
  | { kind: 'sticker'; sticker: StickerDef; rarity: StickerTier; duplicate: boolean };

/** めずらしさの中から1枚。まだ持っていないシールは2倍出やすい */
function pickSticker(tier: StickerTier, owned: Record<string, number>, rand: () => number): GachaPrize {
  const pool = stickersOfTier(tier);
  const weights = pool.map(s => ((owned[s.id] ?? 0) > 0 ? 1 : 2));
  let w = rand() * weights.reduce((a, b) => a + b, 0);
  let pick = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    if (w < weights[i]) { pick = pool[i]; break; }
    w -= weights[i];
  }
  return { kind: 'sticker', sticker: pick, rarity: tier, duplicate: (owned[pick.id] ?? 0) > 0 };
}

/** シールのとき、どの めずらしさか（重みの比のとおり） */
function pickTier(rand: () => number): StickerTier {
  let r = rand() * STICKER_WEIGHT;
  for (const t of STICKER_TIERS) {
    if (r < STICKER_TIER_WEIGHT[t]) return t;
    r -= STICKER_TIER_WEIGHT[t];
  }
  return 'normal';
}

/**
 * 1回まわす。rand は 0以上1未満を返す関数(テストで固定できるように外から渡せる)。
 * sinceSticker = 前にシールが出てから何回まわしたか。天井に届いていれば、かならずシール
 * （天井のシールの めずらしさも、ふだんと同じ比で決まる）。
 */
export function rollGacha(sinceSticker: number, owned: Record<string, number>, rand: () => number = Math.random): GachaPrize {
  const pity = sinceSticker + 1 >= GACHA_RULES.pity;
  if (!pity) {
    const total = STICKER_WEIGHT + GACHA_ITEM_TABLE.reduce((a, p) => a + p.weight, 0);
    let r = rand() * total;
    for (const p of GACHA_ITEM_TABLE) {
      if (r < p.weight) return { kind: 'item', item: p.item, count: p.count, rarity: p.rarity };
      r -= p.weight;
    }
  }
  return pickSticker(pickTier(rand), owned, rand);
}

/**
 * 前の形のシール（⭐ほしの シール など21種）を、同じ枚数の「ふつう」のモンスターシールにかえる（1回だけ）。
 * モンスターシールでない id は、すべて前の形とみなす。
 */
export function migrateOldStickers(stickers: Record<string, number>, rand: () => number = Math.random): Record<string, number> {
  const old = Object.entries(stickers).filter(([id]) => !STICKER_BY_ID[id]);
  if (old.length === 0) return stickers;
  const next: Record<string, number> = Object.fromEntries(Object.entries(stickers).filter(([id]) => STICKER_BY_ID[id]));
  const n = old.reduce((a, [, c]) => a + Math.max(0, c), 0);
  for (let i = 0; i < n; i++) {
    const p = pickSticker('normal', next, rand);
    if (p.kind === 'sticker') next[p.sticker.id] = (next[p.sticker.id] ?? 0) + 1;
  }
  return next;
}

/* ---------------- 学習でもらえるもの ---------------- */

/**
 * 学習でもらえるアイテム・コイン。どれも「正解したこと」にむすびつけ、1日の上限をつける
 * (知識集 bugs/reward-inflation-trap.md: ごほうびがふえすぎると、意味がなくなる)。
 */
export const LEARNING_REWARDS = {
  /** ふくしゅうモードで、この数だけ正解するごとに ヒントのしおり 1まい */
  reviewPerHintbook: 3,
  /** ふくしゅうモードで、この数だけ正解するごとに ふくしゅうのおまもり 1こ */
  reviewPerCharm: 5,
  /** ミックスれんしゅうで、この数だけ正解するごとに まぜこぜの巻物 1まい */
  mixPerScroll: 5,
  /** 1日にもらえる上限 */
  dailyMax: { hintbook: 3, charm: 2, scroll: 2, coin: 5 },
  /** ガチャコイン: その日はじめて正解したとき */
  coinFirstCorrectOfDay: 1,
  /** ガチャコイン: はじめて熟達したとき(5問れんぞく正解。サブトピックごとに1回だけ) */
  coinNewMastery: 1,
  /** ガチャコイン: 町のマスターに勝ったとき(1日の上限とは別) */
  coinMasterWin: 2,
} as const;
