/**
 * partyDuel.ts — モンスター対戦（パーティ3匹か5匹・HPあり）のきまり
 *
 * 2026-10 先生と決めた形:
 * - ぼうけんでつかまえたモンスターで、パーティを3匹か5匹くむ。
 * - 毎ターン、2人に同じ問題（場に出ている2匹の分野を交互に）。
 * - 正解すれば2人とも攻撃できる（早押しの「速い方だけ」にしない。速いと少しだけダメージが多い）。まちがえたら0。
 * - 正解すると「まもり」：そのターンに受けるダメージが へる（guard）。答えられると 攻撃と守りの両方が得になる。
 *   まちがい・わからない・時間切れは 同じあつかい（こうげき・まもり なし、がんばり +1）。まちがいを 責めない。
 * - 時間（2026-10-24 先生と決めた）：さいしょの子が答えるまでは時間せいげん なし（けいさんらんで じっくり解ける）。
 *   どちらかが答えたら、のこりの子は afterFirstSeconds 秒まで。2人とも答えないときだけ capSeconds で打ち切り。
 * - HPが0になったら次のモンスター。相手のパーティをぜんぶ たおした方の勝ち。
 * - 強さはレベル（＝練習した量）で決まるが、効き目には上限をつける（強さの差は最大1.7倍）。
 *   家でたくさんやった子が有利なのは努力の成果としてよいが、まったく勝てないと やめてしまう子が出るため。
 *
 * クラス対戦はサーバ（Supabase の _pduel_* 関数）が同じ計算をする。数を変えるときは両方を変える
 * （scripts/sim-party-duel.ts でバランスを確かめてから）。
 */
import type { ElementId } from './adventure/elements';
import { getTypeMultiplier } from './adventure/elements';
import { getMonster, statsAtLevel } from './adventure/monsters';

export const PARTY_DUEL = {
  sizes: [3, 5] as const,
  /** 同じ強さ・相性ふつう・速さボーナスなしのとき、正解1回で けずる割合（最大HPに対して） */
  baseFraction: 0.36,
  /**
   * 強さの比の上限（これより差があっても1.7倍として計算する）。
   * まもり を入れると「2人とも正解」のターンの重みが下がり、レベルの差が効きにくくなるので 1.5 → 1.7 にした（2026-10-24）
   */
  maxRatio: 1.7,
  /** 相性（ぼうけんの ×2・×0.5 より やわらかくする。1回で勝負がつかないように） */
  typeStrong: 1.5,
  typeWeak: 0.67,
  /** 2人とも正解したとき、速かった方 */
  speedBonus: 1.05,
  /** ダメージのゆれ（0.8〜1.2倍）と「きゅうしょ」（まれに1.5倍）。にがてな子にも勝ち目を残す */
  spread: 0.3,
  critChance: 0.15,
  critMult: 1.6,
  /**
   * がんばり：攻撃できなかった（まちがえた・時間切れ）ターンが続くと、つぎに正解したときのダメージが上がる
   * （1ターンごとに +がんばり、上限まで）。あきらめずに解いた子が追いつける。
   */
  grit: 0.7,
  /**
   * がんばりは3ターンまで。1回 わからない を押してから正解（×1.7）より、2回とも正解（1+1）の方が得になる数にしてある
   * （わざと わからない を押して がんばりを ためる、が得にならないように）
   */
  gritMax: 3,
  /** 1回で けずれるのは最大HPの この割合まで（1回で勝負がつかないように） */
  maxFraction: 0.7,
  /** せいかいした子が受けるダメージの倍率（まもり）。2人とも正解したターンに効く */
  guard: 0.85,
  /** どちらかが答えてから、のこりの子が答えられる秒数 */
  afterFirstSeconds: 60,
  /** 2人とも答えないときの打ち切り（画面を開いたまま手が止まった子がいても、ずっと待たせない） */
  capSeconds: 300,
  /** これだけ続いたら、残りHPの多い方の勝ち（終わらない対戦をふせぐ） */
  maxTurns: 60,
} as const;

export type PartySize = (typeof PARTY_DUEL.sizes)[number];

export interface DuelMon {
  uid: string;
  defId: string;
  level: number;
  subtopic: string;
  type: ElementId;
  maxHp: number;
  hp: number;
  /** 強さ（HPとこうげきの かけ算の平方根） */
  power: number;
}

export interface DuelSide {
  party: DuelMon[];
  /** いま場に出ている番号 */
  active: number;
  /** 攻撃できなかったターンが いくつ続いているか（がんばり） */
  miss: number;
}

export function toDuelMon(o: { uid: string; defId: string; level: number }): DuelMon | null {
  const def = getMonster(o.defId);
  if (!def) return null;
  const st = statsAtLevel(def, o.level);
  return {
    uid: o.uid, defId: o.defId, level: o.level, subtopic: def.subtopic, type: def.type,
    maxHp: st.maxHp, hp: st.maxHp, power: Math.sqrt(st.maxHp * st.atk),
  };
}

const typeFactor = (att: ElementId, def: ElementId): number => {
  const m = getTypeMultiplier(att, def);
  return m > 1 ? PARTY_DUEL.typeStrong : m < 1 ? PARTY_DUEL.typeWeak : 1;
};

/**
 * 正解1回で、相手の最大HPの どれだけを けずるか。
 * 強さの比 r（maxRatio まで）を、攻める側に √r、受ける側に √(1/r) で分けて効かせる → 勝負全体では最大 r 倍の差になる。
 */
export function hitFraction(att: DuelMon, def: DuelMon, faster: boolean, roll = 1, miss = 0): number {
  const r = Math.min(PARTY_DUEL.maxRatio, Math.max(1 / PARTY_DUEL.maxRatio, att.power / def.power));
  const f = PARTY_DUEL.baseFraction * Math.sqrt(r) * typeFactor(att.type, def.type)
    * (faster ? PARTY_DUEL.speedBonus : 1) * gritFactor(miss) * roll;
  return Math.min(PARTY_DUEL.maxFraction, f);
}

export const gritFactor = (miss: number): number => 1 + PARTY_DUEL.grit * Math.min(PARTY_DUEL.gritMax, Math.max(0, miss));

/** ダメージのゆれ（rand は 0〜1） */
export function damageRoll(rand: () => number): { roll: number; crit: boolean } {
  const crit = rand() < PARTY_DUEL.critChance;
  const roll = (1 - PARTY_DUEL.spread + rand() * PARTY_DUEL.spread * 2) * (crit ? PARTY_DUEL.critMult : 1);
  return { roll, crit };
}

/**
 * そのターンの しめきり（ターンのはじめからの ミリ秒）。firstAt はさいしょの子が答えた時刻（まだなら null）。
 * サーバの sanmon_pduel_answer も同じ決まり（さいしょの答えで しめきりを ちぢめる）。
 */
export function turnDeadlineMs(firstAt: number | null): number {
  const cap = PARTY_DUEL.capSeconds * 1000;
  return firstAt === null ? cap : Math.min(cap, firstAt + PARTY_DUEL.afterFirstSeconds * 1000);
}

/** そのターンの問題の分野（奇数ターンは部屋を作った側＝host の場のモンスター、偶数ターンは guest） */
export function turnSubtopic(turn: number, host: DuelSide, guest: DuelSide): string {
  const side = turn % 2 === 1 ? host : guest;
  return side.party[side.active]?.subtopic ?? '';
}

export interface TurnAnswer { correct: boolean; at: number }

/** 1回の攻撃。guard = 受けた側が正解して まもった */
export interface DuelHit { damage: number; crit: boolean; type: number; grit: number; guard: boolean }

export interface TurnResult {
  host: DuelSide;
  guest: DuelSide;
  /** host が guest に与えたダメージ（0 = 攻撃なし） */
  hostHit: DuelHit | null;
  guestHit: DuelHit | null;
  hostKo: boolean;
  guestKo: boolean;
  winner: 'host' | 'guest' | 'draw' | null;
}

const alive = (s: DuelSide) => s.active < s.party.length;
const remaining = (s: DuelSide) => s.party.reduce((a, m) => a + Math.max(0, m.hp) / m.maxHp, 0);

/** 1ターンぶんの結果（2人の答えがそろったか、時間切れのとき）。2人のダメージは同時に入る */
export function resolveTurn(
  turn: number, host: DuelSide, guest: DuelSide,
  ha: TurnAnswer | null, ga: TurnAnswer | null, rand: () => number = Math.random,
): TurnResult {
  const h: DuelSide = { active: host.active, miss: host.miss, party: host.party.map((m) => ({ ...m })) };
  const g: DuelSide = { active: guest.active, miss: guest.miss, party: guest.party.map((m) => ({ ...m })) };
  const hm = h.party[h.active]!;
  const gm = g.party[g.active]!;
  const bothCorrect = !!ha?.correct && !!ga?.correct;
  const hit = (att: DuelMon, def: DuelMon, faster: boolean, miss: number, guard: boolean): DuelHit => {
    const { roll, crit } = damageRoll(rand);
    const f = hitFraction(att, def, faster, roll, miss) * (guard ? PARTY_DUEL.guard : 1);
    const damage = Math.max(1, Math.round(def.maxHp * f));
    return { damage, crit, type: getTypeMultiplier(att.type, def.type), grit: Math.min(PARTY_DUEL.gritMax, miss), guard };
  };
  // 受ける側が正解していれば まもり（2人とも正解のターン）
  const hostHit = ha?.correct ? hit(hm, gm, bothCorrect && ha.at < ga!.at, h.miss, bothCorrect) : null;
  const guestHit = ga?.correct ? hit(gm, hm, bothCorrect && ga.at < ha!.at, g.miss, bothCorrect) : null;
  h.miss = hostHit ? 0 : h.miss + 1;
  g.miss = guestHit ? 0 : g.miss + 1;
  if (hostHit) gm.hp = Math.max(0, gm.hp - hostHit.damage);
  if (guestHit) hm.hp = Math.max(0, hm.hp - guestHit.damage);
  const hostKo = hm.hp <= 0;
  const guestKo = gm.hp <= 0;
  if (hostKo) h.active += 1;
  if (guestKo) g.active += 1;
  let winner: TurnResult['winner'] = null;
  if (!alive(h) && !alive(g)) {
    // さいごの1匹どうしが同時に たおれたら、そのターンに速く正解した方の勝ち
    winner = ha && ga && ha.at !== ga.at ? (ha.at < ga.at ? 'host' : 'guest') : 'draw';
  } else if (!alive(h) || !alive(g)) winner = alive(h) ? 'host' : 'guest';
  else if (turn >= PARTY_DUEL.maxTurns) {
    const rh = remaining(h); const rg = remaining(g);
    winner = Math.abs(rh - rg) < 1e-9 ? 'draw' : rh > rg ? 'host' : 'guest';
  }
  return { host: h, guest: g, hostHit, guestHit, hostKo, guestKo, winner };
}

/** CPU のパーティ：きみのパーティと同じ単元のモンスターから、同じくらいのレベルで */
export function cpuParty(
  mine: DuelMon[], pool: { id: string; unit: string }[], rand: () => number = Math.random,
): DuelMon[] {
  const units = new Set(mine.map((m) => getMonster(m.defId)?.unit));
  const candidates = pool.filter((p) => units.has(p.unit));
  const from = candidates.length >= mine.length ? candidates : pool;
  const avg = mine.reduce((a, m) => a + m.level, 0) / Math.max(1, mine.length);
  const picked: DuelMon[] = [];
  const used = new Set<string>();
  while (picked.length < mine.length && used.size < from.length) {
    const c = from[Math.floor(rand() * from.length)]!;
    if (used.has(c.id)) continue;
    used.add(c.id);
    const lv = Math.max(1, Math.round(avg + (rand() * 4 - 2)));
    const m = toDuelMon({ uid: `cpu-${picked.length}`, defId: c.id, level: lv });
    if (m) picked.push(m);
  }
  return picked;
}
