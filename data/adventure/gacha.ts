/**
 * gacha.ts — ガチャガチャ「サンスウカプセル」と、学習でもらえるアイテムのきまり。
 *
 * 子ども向けのガチャで気をつけたこと（根拠: Zendle & Cairns 2018 ガチャへの支出とギャンブルの問題の相関、
 * Deci, Koestner & Ryan 1999 「やっただけでもらえる」ごほうびは意欲を下げる）:
 *   ・お金では回せない。コインは「正解した・熟達した・マスターに勝った」ときにだけもらえる。
 *   ・MPでも回せるが、1日の回数に上限がある（MPのつかい道を作りつつ、回しつづけられないように）。
 *   ・出る確率をすべて画面に出す。10回でかならずシールが出る「天井」がある。
 *   ・シールを集めきっても、ごほうびは出さない（そろえるために回させる「コンプガチャ」にしない）。
 *   ・強さは買えない。中身は、バトルを少し楽にする道具と、見て楽しむシールだけ。
 */
import type { ItemId } from './adventureTypes';
import { ELEMENTS } from './elements';

export const GACHA_RULES = {
  /** MPで回すときの値段 */
  mpCost: 150,
  /** MPで回せるのは1日にこの回数まで */
  mpPullsPerDay: 3,
  /** この回数まわしてシールが出なければ、つぎはかならずシール */
  pity: 10,
} as const;

export type GachaRarity = 'N' | 'R' | 'SR';

export const RARITY_LABEL: Record<GachaRarity, string> = { N: 'ふつう', R: 'レア', SR: 'シール' };

export interface GachaItemPrize {
  kind: 'item';
  item: ItemId;
  count: number;
  rarity: GachaRarity;
  /** 重み(合計100で、そのまま％になる) */
  weight: number;
}

/** 道具の当たり。シール(SR)は STICKERS から1枚えらぶ */
export const GACHA_ITEM_TABLE: GachaItemPrize[] = [
  { kind: 'item', item: 'ball', count: 3, rarity: 'N', weight: 22 },
  { kind: 'item', item: 'potion', count: 1, rarity: 'N', weight: 20 },
  { kind: 'item', item: 'hintbook', count: 1, rarity: 'N', weight: 18 },
  { kind: 'item', item: 'greatball', count: 2, rarity: 'R', weight: 10 },
  { kind: 'item', item: 'revive', count: 1, rarity: 'R', weight: 8 },
  { kind: 'item', item: 'charm', count: 1, rarity: 'R', weight: 7 },
  { kind: 'item', item: 'scroll', count: 1, rarity: 'R', weight: 7 },
];
/** シールが出る確率(％) */
export const STICKER_WEIGHT = 8;

export interface StickerDef {
  id: string;
  name: string;
  icon: string;
  /** タイプ(色に使う) */
  type: keyof typeof ELEMENTS;
}

/** シール帳。7タイプ×3まい。かさなったシールは「キラ」になる(見た目だけ) */
export const STICKERS: StickerDef[] = [
  { id: 'kazu-star', name: 'ほしの シール', icon: '⭐', type: 'kazu' },
  { id: 'kazu-moon', name: 'つきの シール', icon: '🌙', type: 'kazu' },
  { id: 'kazu-idea', name: 'ひらめき シール', icon: '💡', type: 'kazu' },
  { id: 'keisan-fire', name: 'ほのおの シール', icon: '🔥', type: 'keisan' },
  { id: 'keisan-volcano', name: 'かざんの シール', icon: '🌋', type: 'keisan' },
  { id: 'keisan-gear', name: 'はぐるまの シール', icon: '⚙️', type: 'keisan' },
  { id: 'shosu-drop', name: 'しずくの シール', icon: '💧', type: 'shosu' },
  { id: 'shosu-wave', name: 'なみの シール', icon: '🌊', type: 'shosu' },
  { id: 'shosu-shell', name: 'かいがらの シール', icon: '🐚', type: 'shosu' },
  { id: 'bunsu-cake', name: 'ケーキの シール', icon: '🍰', type: 'bunsu' },
  { id: 'bunsu-ribbon', name: 'リボンの シール', icon: '🎀', type: 'bunsu' },
  { id: 'bunsu-candy', name: 'キャンディの シール', icon: '🍬', type: 'bunsu' },
  { id: 'bai-clover', name: 'クローバーの シール', icon: '🍀', type: 'bai' },
  { id: 'bai-sunflower', name: 'ひまわりの シール', icon: '🌻', type: 'bai' },
  { id: 'bai-tree', name: 'たいじゅの シール', icon: '🌳', type: 'bai' },
  { id: 'graph-kite', name: 'たこの シール', icon: '🪁', type: 'graph' },
  { id: 'graph-cloud', name: 'くもの シール', icon: '☁️', type: 'graph' },
  { id: 'graph-dove', name: 'はとの シール', icon: '🕊️', type: 'graph' },
  { id: 'zukei-gem', name: 'ほうせきの シール', icon: '🔷', type: 'zukei' },
  { id: 'zukei-ruler', name: 'じょうぎの シール', icon: '📐', type: 'zukei' },
  { id: 'zukei-cube', name: 'はこの シール', icon: '🧊', type: 'zukei' },
];

export type GachaPrize =
  | { kind: 'item'; item: ItemId; count: number; rarity: GachaRarity }
  | { kind: 'sticker'; sticker: StickerDef; rarity: 'SR'; duplicate: boolean };

/**
 * 1回まわす。rand は 0以上1未満を返す関数(テストで固定できるように外から渡せる)。
 * sinceSticker = 前にシールが出てから何回まわしたか。天井に届いていれば、かならずシール。
 */
export function rollGacha(sinceSticker: number, owned: Record<string, number>, rand: () => number = Math.random): GachaPrize {
  const pity = sinceSticker + 1 >= GACHA_RULES.pity;
  const total = STICKER_WEIGHT + GACHA_ITEM_TABLE.reduce((a, p) => a + p.weight, 0);
  let r = rand() * total;
  if (!pity) {
    for (const p of GACHA_ITEM_TABLE) {
      if (r < p.weight) return { kind: 'item', item: p.item, count: p.count, rarity: p.rarity };
      r -= p.weight;
    }
  }
  // シール: まだ持っていないものを少し出やすくする(持っていない子は2倍の重み)
  const weights = STICKERS.map(s => ((owned[s.id] ?? 0) > 0 ? 1 : 2));
  let w = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < STICKERS.length; i++) {
    if (w < weights[i]) return { kind: 'sticker', sticker: STICKERS[i], rarity: 'SR', duplicate: (owned[STICKERS[i].id] ?? 0) > 0 };
    w -= weights[i];
  }
  const last = STICKERS[STICKERS.length - 1];
  return { kind: 'sticker', sticker: last, rarity: 'SR', duplicate: (owned[last.id] ?? 0) > 0 };
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
