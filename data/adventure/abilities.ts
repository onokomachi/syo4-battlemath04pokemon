/**
 * アビリティ（個体ごとの能力。2026-11-12 先生と決めた）。
 *
 * 同じ種類のモンスターでも、つかまえるたびに ランダムで アビリティが つく（つかないことも多い）。
 * めずらしさは ★1〜★5。めずらしいほど 出にくい（★5 は 1000体に1体）。
 * 「にがす」と MP が もらえるので、いい アビリティの子を さがして 何度も つかまえられる。
 *
 * - 種類ごとの「とくせい」（MonsterDef.ability）とは別のもの。名前が まざらないよう「アビリティ」と よぶ。
 * - 効くのは ぼうけんのバトル（BattleScreen）と けいけんち・HP。モンスター対戦・クラス対戦（サーバが決める）には効かない。
 * - セーブには id（数文字）だけを足す。通信・サーバの負担は ほぼ増えない。
 */
export type PowerId =
  | 'gutsy' | 'sturdy' | 'patient'
  | 'keeneye' | 'tenacity' | 'shield'
  | 'healwind' | 'timeguard' | 'combo'
  | 'scholar' | 'fortune'
  | 'radiant';

export interface AbilityDef {
  id: PowerId;
  name: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  icon: string;
  /** 子ども向けの説明（短く） */
  desc: string;
}

export const ABILITIES: Record<PowerId, AbilityDef> = {
  // ★1
  gutsy:     { id: 'gutsy',     rarity: 1, icon: '💪', name: 'がんばりや',     desc: 'こうげきが 少し強い（+5%）' },
  sturdy:    { id: 'sturdy',    rarity: 1, icon: '🪨', name: 'がっしり',       desc: 'さいだいHPが 少し多い（+5%）' },
  patient:   { id: 'patient',   rarity: 1, icon: '🍵', name: 'おちつき',       desc: 'せいげん時間が 3びょう 長い' },
  // ★2
  keeneye:   { id: 'keeneye',   rarity: 2, icon: '🎯', name: 'きゅうしょのめ', desc: 'せいかいしたとき 10%で こうげき2ばい' },
  tenacity:  { id: 'tenacity',  rarity: 2, icon: '🦴', name: 'ねばりごし',     desc: 'バトルで1回だけ、たおれずに HP1で たえる' },
  shield:    { id: 'shield',    rarity: 2, icon: '🛡️', name: 'まもりのこころ', desc: 'まちがえたときの ダメージが 2わり へる' },
  // ★3
  healwind:  { id: 'healwind',  rarity: 3, icon: '🍃', name: 'いやしのかぜ',   desc: 'せいかいするたび HPが さいだいの5% もどる' },
  timeguard: { id: 'timeguard', rarity: 3, icon: '⏳', name: 'ときのまもり',   desc: 'せいげん時間 1.5ばい・時間の こうげき はんぶん' },
  combo:     { id: 'combo',     rarity: 3, icon: '⚡', name: 'れんげき',       desc: '2もん れんぞく せいかいで こうげき +25%' },
  // ★4
  scholar:   { id: 'scholar',   rarity: 4, icon: '📚', name: 'まなびのたね',   desc: 'けいけんちが +20%' },
  fortune:   { id: 'fortune',   rarity: 4, icon: '🪙', name: 'こがねのつめ',   desc: 'たおしたときの MPが +30%' },
  // ★5
  radiant:   { id: 'radiant',   rarity: 5, icon: '✨', name: 'ひかりのこ',     desc: 'こうげき・さいだいHP +10%、せいげん時間 +3びょう。からだが 光る' },
};

/** めずらしさごとの出やすさ（合計100）。なし55％・★1 28％・★2 12％・★3 4％・★4 0.9％・★5 0.1％ */
export const ABILITY_RARITY_WEIGHTS: Record<0 | 1 | 2 | 3 | 4 | 5, number> = {
  0: 55, 1: 28, 2: 12, 3: 4, 4: 0.9, 5: 0.1,
};

/** つかまえたときに アビリティを きめる（null＝なし） */
export function rollAbility(rand: () => number = Math.random): PowerId | null {
  let r = rand() * 100;
  let rarity: 0 | 1 | 2 | 3 | 4 | 5 = 0;
  for (const k of [0, 1, 2, 3, 4, 5] as const) {
    r -= ABILITY_RARITY_WEIGHTS[k];
    if (r < 0) { rarity = k; break; }
    rarity = k;
  }
  if (rarity === 0) return null;
  const pool = Object.values(ABILITIES).filter(a => a.rarity === rarity);
  return pool[Math.floor(rand() * pool.length)]?.id ?? null;
}

export const abilityOf = (id: PowerId | null | undefined): AbilityDef | null => (id ? ABILITIES[id] ?? null : null);

export const stars = (rarity: number): string => '★'.repeat(rarity);

/** さいだいHPの ばいりつ */
export const abilityHpMult = (id: PowerId | null | undefined): number =>
  id === 'sturdy' ? 1.05 : id === 'radiant' ? 1.1 : 1;
/** こうげきの ばいりつ */
export const abilityAtkMult = (id: PowerId | null | undefined): number =>
  id === 'gutsy' ? 1.05 : id === 'radiant' ? 1.1 : 1;
/** けいけんちの ばいりつ */
export const abilityExpMult = (id: PowerId | null | undefined): number => (id === 'scholar' ? 1.2 : 1);

/** にがしたときに もらえる MP（めずらしいほど多い） */
export const RELEASE_MP: Record<0 | 1 | 2 | 3 | 4 | 5, number> = { 0: 10, 1: 20, 2: 40, 3: 100, 4: 250, 5: 600 };
export const releaseMp = (id: PowerId | null | undefined): number => RELEASE_MP[(abilityOf(id)?.rarity ?? 0) as 0 | 1 | 2 | 3 | 4 | 5];
