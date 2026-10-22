/**
 * growth.ts — モンスターの育ち方（2026-10 先生と決めた）
 *
 * - けいけんちは、正解した問題の「出どころのモンスター」に満額入る（151サブトピック＝151体）。
 *   ぼうけんで野生のAと戦えば問題はAの分野から出るので、手持ちのAが育つ。ほかの手持ちには2割だけ。
 *   れんしゅう・ふくしゅう・対戦でも、解いた問題のモンスターが育つ（れんしゅう＝トレーニング）。
 * - 1日に満額もらえるのは、同じモンスターで20問まで。そのあとは4分の1（毎日少しずつが いちばん伸びる）。
 * - まちがえても減らない。
 * - レベルの上限は、その単元の「かけら」で上がる（learning-app-kit の sanmonShards。単元アプリのテスト・実力の階段）。
 *   学級ポータルで名乗っていない（おためし）ときは上限なし。
 */
import { create } from 'zustand';
import type { SanmonShards } from 'learning-app-kit/sanmon';
import { UNIT_KEYS } from '../../constants';
import type { MonsterDef } from './adventureTypes';

export const MAX_LEVEL = 60;

export const GROWTH_RULES = {
  /** 出どころでない手持ちに入る割合（ぼうけん） */
  othersShare: 0.2,
  /** 1日に満額もらえる正解の数（モンスターごと） */
  dailyFull: 20,
  /** それをこえたぶんの割合 */
  afterDailyFactor: 0.25,
} as const;

/** れんしゅう・ふくしゅう・対戦で、正解1問ぶんのけいけんち（むずかしい分野ほど少し多い） */
export const expPerCorrect = (difficulty: number): number => 8 + difficulty * 2;

/** 端末の日付（YYYY-MM-DD）。1日の数えなおしに使う */
export const todayKey = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * 今日すでに満額でもらった数（used）のあとに corrects 問ぶん正解したとき、
 * 満額に直すと何問ぶんになるか（effective）と、新しい used。
 */
export function dailyEffective(used: number, corrects: number): { effective: number; used: number } {
  const full = Math.max(0, Math.min(corrects, GROWTH_RULES.dailyFull - used));
  const rest = Math.max(0, corrects - full);
  return { effective: full + rest * GROWTH_RULES.afterDailyFactor, used: used + corrects };
}

/* ---------------- レベルの上限（かけら） ---------------- */

interface CapsState {
  /** 単元の記号 → かけら・上限。null = 上限なし（学級ポータルで名乗っていない） */
  shards: SanmonShards[] | null;
  setShards: (s: SanmonShards[] | null) => void;
}

const CAPS_KEY = 'sanmon_level_caps_v1';
const loadCaps = (): SanmonShards[] | null => {
  try { const raw = localStorage.getItem(CAPS_KEY); return raw ? (JSON.parse(raw) as SanmonShards[]) : null; } catch { return null; }
};

/** 最後に読めた上限を端末にも覚えておく（ネットが切れていても、上限なしにならないように） */
export const useLevelCaps = create<CapsState>((set) => ({
  shards: loadCaps(),
  setShards: (shards) => {
    try {
      if (shards) localStorage.setItem(CAPS_KEY, JSON.stringify(shards));
      else localStorage.removeItem(CAPS_KEY);
    } catch { /* 保存できなくても動く */ }
    set({ shards });
  },
}));

/** そのモンスターの単元のかけら（なければ undefined） */
export function shardsOf(def: MonsterDef | undefined, shards = useLevelCaps.getState().shards): SanmonShards | undefined {
  if (!def || !shards) return undefined;
  const key = UNIT_KEYS[def.unit];
  return shards.find((s) => s.key === key);
}

/**
 * そのモンスターのレベルの上限。単元が分からないモンスター（伝説など）は、いちばん高い単元に合わせる。
 */
export function levelCapOf(def: MonsterDef | undefined, shards = useLevelCaps.getState().shards): number {
  if (!shards) return MAX_LEVEL;
  const own = shardsOf(def, shards);
  if (own) return Math.min(MAX_LEVEL, own.cap);
  return Math.min(MAX_LEVEL, Math.max(...shards.map((s) => s.cap)));
}
