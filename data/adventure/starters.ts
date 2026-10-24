/**
 * starters.ts — さいしょの なかま3体（タイトル画面で1体えらぶ）と、モンスター対戦の「かりた なかま」。
 *
 * モンスター対戦（CPU 戦）で、つかまえたモンスターが パーティの数に たりないときは、
 * さいしょの3体を かりて たたかえる（2026-10-24 先生と決めた）。かりた子は育たない・クラス対戦には つれていけない
 * （クラス対戦のレベルは サーバのセーブから読むので）。
 */
import { MONSTER_DEX } from './monsters';
import type { OwnedMonster } from './adventureTypes';

/** さいしょの なかま3体の分野。タイプがばらけるように選んである */
export const STARTER_SUBTOPICS = ['何の位・いくつ分', '分度器と角', '分数のよみかき'];

export const STARTERS = STARTER_SUBTOPICS
  .map(st => MONSTER_DEX.find(m => m.subtopic === st))
  .filter((m): m is NonNullable<typeof m> => Boolean(m));

/** かりた なかまの レベル（タイトルで えらんだときと同じ） */
export const RENTAL_LEVEL = 5;
export const RENTAL_PREFIX = 'rental-';
export const isRentalUid = (uid: string): boolean => uid.startsWith(RENTAL_PREFIX);

/** かりた なかま（持っていない さいしょの3体）。持っている子と同じ種類は かさねない */
export function rentalMonsters(owned: OwnedMonster[]): OwnedMonster[] {
  const have = new Set(owned.map(o => o.defId));
  return STARTERS.filter(m => !have.has(m.id)).map(m => ({
    uid: `${RENTAL_PREFIX}${m.id}`, defId: m.id, level: RENTAL_LEVEL, exp: 0, caughtAt: 0,
  }));
}
