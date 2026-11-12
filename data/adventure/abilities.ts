/**
 * アビリティ（個体ごとの能力。2026-11-12 先生と決めた。同じ日に「種類＋Lv1〜5＋複数もち」に作りなおした）。
 *
 * - アビリティの「種類」は11。どれも同じ出やすさ（種類ごとの めずらしさは つけない）。
 * - 1つ1つに Lv1〜Lv5 があり、Lv が高いほど よく効き、出にくい。
 * - たまに 2つ・3つ もっている子がいる。「どのアビリティか・Lv・いくつもっているか」で いい子を さがせる（厳選）。
 * - 出やすさ（きびしめ）：数 なし55％・1つ40％・2つ4.5％・3つ0.5％／Lv（それぞれ）Lv1 55％・Lv2 28％・Lv3 12％・Lv4 4.5％・Lv5 0.5％。
 * - 「✦ひかりのこ」（色ちがい）は アビリティとは別。1000体に1体。からだが光るだけで 強さは変わらない。
 *
 * - 種類ごとの「とくせい」（MonsterDef.ability）とは別のもの。
 * - 効くのは ぼうけんのバトル（BattleScreen）と さいだいHP・けいけんち。モンスター対戦・クラス対戦（サーバが決める）には効かない。
 * - セーブには 種類と Lv（数十文字）だけを足す。通信・サーバの負担は ほぼ増えない。
 */
export type PowerId =
  | 'gutsy' | 'sturdy' | 'patient'
  | 'keeneye' | 'tenacity' | 'shield'
  | 'healwind' | 'timeguard' | 'combo'
  | 'scholar' | 'fortune';

export type PowerLv = 1 | 2 | 3 | 4 | 5;
export interface OwnedPower { id: PowerId; lv: PowerLv }

export interface AbilityDef {
  id: PowerId;
  name: string;
  icon: string;
  /** Lv1〜Lv5 の 効き目の数（index 0 が Lv1） */
  values: [number, number, number, number, number];
  /** 効き目を 子ども向けの ことばに する（v＝その Lv の数） */
  text: (v: number) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * 効き目の表（2026-11-12 先生と決めた。6つは そのまま・5つは 2倍）。
 * そのまま：がんばりや・がっしり・ねばりごし・まもりのこころ・ときのまもり・れんげき
 * 2倍：おちつき・きゅうしょのめ・いやしのかぜ・まなびのたね・こがねのつめ
 */
export const ABILITIES: Record<PowerId, AbilityDef> = {
  gutsy:     { id: 'gutsy',     icon: '💪', name: 'がんばりや',     values: [0.02, 0.04, 0.06, 0.08, 0.10], text: v => `こうげき +${pct(v)}` },
  sturdy:    { id: 'sturdy',    icon: '🪨', name: 'がっしり',       values: [0.02, 0.04, 0.06, 0.08, 0.10], text: v => `さいだいHP +${pct(v)}` },
  patient:   { id: 'patient',   icon: '🍵', name: 'おちつき',       values: [2, 4, 6, 8, 10],               text: v => `せいげん時間 +${v}びょう` },
  keeneye:   { id: 'keeneye',   icon: '🎯', name: 'きゅうしょのめ', values: [0.08, 0.12, 0.16, 0.20, 0.24], text: v => `せいかいで ${pct(v)}の かくりつで こうげき2ばい` },
  tenacity:  { id: 'tenacity',  icon: '🦴', name: 'ねばりごし',     values: [0.2, 0.4, 0.6, 0.8, 1.0],      text: v => `バトルで1回、${pct(v)}の かくりつで HP1で たえる` },
  shield:    { id: 'shield',    icon: '🛡️', name: 'まもりのこころ', values: [0.04, 0.08, 0.12, 0.16, 0.20], text: v => `まちがえたときの ダメージ −${pct(v)}` },
  healwind:  { id: 'healwind',  icon: '🍃', name: 'いやしのかぜ',   values: [0.02, 0.04, 0.06, 0.08, 0.10], text: v => `せいかいで HPが さいだいの${pct(v)} もどる` },
  timeguard: { id: 'timeguard', icon: '⏳', name: 'ときのまもり',   values: [1.1, 1.2, 1.3, 1.4, 1.5],      text: v => `せいげん時間 ×${v}` },
  combo:     { id: 'combo',     icon: '⚡', name: 'れんげき',       values: [0.05, 0.10, 0.15, 0.20, 0.25], text: v => `2もん れんぞく せいかいで こうげき +${pct(v)}` },
  scholar:   { id: 'scholar',   icon: '📚', name: 'まなびのたね',   values: [0.08, 0.16, 0.24, 0.32, 0.40], text: v => `けいけんち +${pct(v)}` },
  fortune:   { id: 'fortune',   icon: '🪙', name: 'こがねのつめ',   values: [0.12, 0.24, 0.36, 0.48, 0.60], text: v => `たおしたときの MP +${pct(v)}` },
};
export const POWER_IDS = Object.keys(ABILITIES) as PowerId[];

/** いくつ もつか（きびしめ。合計100） */
export const POWER_COUNT_WEIGHTS: [number, number, number, number] = [55, 40, 4.5, 0.5];
/** Lv の出やすさ（それぞれ。Lv1〜Lv5。合計100） */
export const POWER_LV_WEIGHTS: [number, number, number, number, number] = [55, 28, 12, 4.5, 0.5];
/** 色ちがい（✦ひかりのこ）の かくりつ */
export const SHINY_RATE = 0.001;

const pickWeighted = (weights: number[], rand: () => number): number => {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
};

/** つかまえたときに アビリティ（0〜3つ）と 色ちがいを きめる */
export function rollPowers(rand: () => number = Math.random): { powers: OwnedPower[]; shiny: boolean } {
  const count = pickWeighted(POWER_COUNT_WEIGHTS, rand);
  const pool = POWER_IDS.slice();
  const powers: OwnedPower[] = [];
  for (let i = 0; i < count; i++) {
    const id = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    powers.push({ id, lv: (pickWeighted(POWER_LV_WEIGHTS, rand) + 1) as PowerLv });
  }
  return { powers, shiny: rand() < SHINY_RATE };
}

type HasPowers = { powers?: OwnedPower[] | null } | null | undefined;
/** その子が もつ その アビリティの Lv（なければ 0） */
export const powerLv = (o: HasPowers, id: PowerId): number => o?.powers?.find(p => p.id === id)?.lv ?? 0;
/** その子の その アビリティの 効き目の数（なければ null） */
export const powerValue = (o: HasPowers, id: PowerId): number | null => {
  const lv = powerLv(o, id);
  return lv ? ABILITIES[id].values[lv - 1] : null;
};

export const powerLabel = (p: OwnedPower): string => `${ABILITIES[p.id].icon} ${ABILITIES[p.id].name} Lv${p.lv}`;
export const powerEffect = (p: OwnedPower): string => ABILITIES[p.id].text(ABILITIES[p.id].values[p.lv - 1]);

/** さいだいHPの ばいりつ */
export const abilityHpMult = (o: HasPowers): number => 1 + (powerValue(o, 'sturdy') ?? 0);
/** こうげきの ばいりつ */
export const abilityAtkMult = (o: HasPowers): number => 1 + (powerValue(o, 'gutsy') ?? 0);
/** けいけんちの ばいりつ */
export const abilityExpMult = (o: HasPowers): number => 1 + (powerValue(o, 'scholar') ?? 0);

/** にがしたときに もらえる MP（Lv が高いほど・数が多いほど・色ちがいは 多い） */
export const RELEASE_MP_BY_LV = [0, 10, 25, 60, 150, 400];
export const releaseMp = (o: (HasPowers & { shiny?: boolean }) | null | undefined): number =>
  10 + (o?.powers ?? []).reduce((a, p) => a + RELEASE_MP_BY_LV[p.lv], 0) + (o?.shiny ? 300 : 0);
