/**
 * gymRequirements.ts — 単元マスター(ジムリーダー)への挑戦条件。
 *
 * いきなり道場へ突撃できてしまうと、
 *   ① その単元をほとんど解かないままマスター戦に入って連敗する
 *   ② 3Dフィールドを歩く意味がなくなる
 * の2つが起きる。そこで「その町でひととおり遊んだら挑める」ようにしている。
 *
 * 条件は3つだけ。小4が道場の前で読んで、すぐ理解できる数に絞ってある。
 *   1) 町のトレーナー2人に勝つ
 *   2) その単元のモンスターを N 体つかまえる
 *   3) その単元の問題を M 問正解する
 *
 * N・M はその単元のサブトピック数から決まるので、単元の大きさに自然に比例する
 * (分数のように項目が多い町は少し多め、変わり方調べのように小さい町はすぐ挑める)。
 */

import { MONSTERS_BY_UNIT } from './monsters';
import { TOWNS } from './towns';
import type { TownDef } from './adventureTypes';

export interface GymRequirement {
  /** 倒す必要のあるトレーナーのNPC ID */
  trainerIds: string[];
  /** つかまえる必要のある、その単元のモンスター数 */
  catchCount: number;
  /** その単元で正解する必要のある問題数 */
  correctCount: number;
}

/** 単元の大きさから条件を決める。小さい町でいきなり詰まらないよう上限を設けている。 */
export const requirementFor = (town: TownDef): GymRequirement => {
  const pool = MONSTERS_BY_UNIT[town.unit] ?? [];
  const size = pool.length;
  return {
    trainerIds: town.npcs.filter(n => n.kind === 'trainer').map(n => n.id),
    // サブトピックの約1/4。最低2体、最大6体。
    catchCount: Math.max(2, Math.min(6, Math.round(size / 4))),
    // サブトピック数の約1.5倍。最低6問、最大30問。
    correctCount: Math.max(6, Math.min(30, Math.round(size * 1.5))),
  };
};

export const GYM_REQUIREMENTS: Record<string, GymRequirement> = Object.fromEntries(
  TOWNS.map(t => [t.id, requirementFor(t)]),
);

export interface GymProgress {
  trainersBeaten: number;
  trainersNeeded: number;
  caught: number;
  caughtNeeded: number;
  correct: number;
  correctNeeded: number;
  /** すべて満たしたか */
  ready: boolean;
}

/** 表示用に「あと何が足りないか」を1行ずつ返す */
export const missingLines = (p: GymProgress): string[] => {
  const out: string[] = [];
  if (p.trainersBeaten < p.trainersNeeded) {
    out.push(`この町の トレーナーに かつ (${p.trainersBeaten} / ${p.trainersNeeded}人)`);
  }
  if (p.caught < p.caughtNeeded) {
    out.push(`この単元の モンスターを つかまえる (${p.caught} / ${p.caughtNeeded}体)`);
  }
  if (p.correct < p.correctNeeded) {
    out.push(`この単元の もんだいに 正解する (${p.correct} / ${p.correctNeeded}問)`);
  }
  return out;
};
