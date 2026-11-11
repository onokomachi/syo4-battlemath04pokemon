/**
 * ぼうけんのバトル1回のスタミナ（町の「達成度」で安くなる。2026-11-11 先生と決めた）。
 *
 * 達成度＝その町の単元の練習の項目のうち、熟達（5問れんぞくノーミス）した割合。
 *   100％ → 2、75％以上 → 3、50％以上 → 4、それより下 → 5。アプリの無い町は 5。
 * 決めるのはサーバ（sanmon_spend が _sanmon_town_cost で計算する。表 sanmon_town_skill）。
 * ここは画面に「1回 n」「あと n回」を出すための同じ数え方（kit の町の解放の「練習」のメーターと同じ項目・同じ熟達）。
 * 項目の一覧は kit のカタログ。カタログを変えたら、サーバの表も作り直す（scripts/export-town-skills.mjs）。
 */
import { SANMON_RULES, SANMON_UNITS, type SanmonStatus } from 'learning-app-kit/sanmon';
import { CATALOGS } from 'learning-app-kit/catalog';

const unitSkills = new Map<string, string[]>(
  SANMON_UNITS.filter((u) => u.appId && CATALOGS[u.appId]).map((u) => [
    u.key,
    CATALOGS[u.appId!].modules
      .filter((m) => !u.modules || u.modules.includes(m.module_id))
      .flatMap((m) => m.skills.map((s) => s.skill_id)),
  ]),
);

/** その町の達成度（0〜1）。アプリの無い町は null */
export function townMastery(status: Pick<SanmonStatus, 'apps'> | null | undefined, townKey: string | null | undefined): number | null {
  if (!townKey) return null;
  const skills = unitSkills.get(townKey);
  const unit = SANMON_UNITS.find((u) => u.key === townKey);
  if (!skills || skills.length === 0 || !unit?.appId) return null;
  const mastered = new Set(status?.apps?.[unit.appId]?.mastered ?? []);
  return skills.filter((s) => mastered.has(s)).length / skills.length;
}

/** その町のバトル1回のスタミナ */
export function townBattleCost(status: Pick<SanmonStatus, 'apps'> | null | undefined, townKey: string | null | undefined): number {
  const r = townMastery(status, townKey);
  if (r == null) return SANMON_RULES.battleCost;
  if (r >= 1) return 2;
  if (r >= 0.75) return 3;
  if (r >= 0.5) return 4;
  return SANMON_RULES.battleCost;
}
