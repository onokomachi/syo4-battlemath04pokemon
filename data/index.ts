import type { Problem } from '../types';
import {
  fractionBasicsProblems,
  fractionKindsProblems,
  fractionConversionProblems,
  fractionSizeProblems,
  fractionAdditionProblems,
  fractionSubtractionProblems,
  fractionApplicationProblems,
} from './fractionProblems';
import { bigNumberProblems } from './bigNumberProblems';
import { graphTableProblems } from './graphTableProblems';
import { division1Problems, division2Problems } from './divisionProblems';
import { angleProblems } from './angleProblems';
import { decimalProblems, decimalMulDivProblems } from './decimalProblems';
import { roundingProblems } from './roundingProblems';
import { calcRulesProblems, areaProblems, changeProblems, solidProblems } from './mixedUnitsProblems';
import { ratioProblems } from './ratioProblems';
import { suiheiProblems } from './suiheiProblems';

/** サブトピック名 → 問題配列(小4全14単元を統合)。練習モード・スピードデュエル・本番テストの出題元。 */
export const ALL_PROBLEM_SETS: Record<string, Problem[]> = {
  ...bigNumberProblems,
  ...graphTableProblems,
  ...division1Problems,
  ...angleProblems,
  ...suiheiProblems,
  ...decimalProblems,
  ...division2Problems,
  ...roundingProblems,
  ...calcRulesProblems,
  ...areaProblems,
  ...decimalMulDivProblems,
  ...fractionBasicsProblems,
  ...fractionKindsProblems,
  ...fractionConversionProblems,
  ...fractionSizeProblems,
  ...fractionAdditionProblems,
  ...fractionSubtractionProblems,
  ...fractionApplicationProblems,
  ...changeProblems,
  ...solidProblems,
  ...ratioProblems,
};

/** アプリと同じ答え方の問題（appRound）か */
export const isAppRoundProblem = (p: Problem): boolean =>
  p.type === 'guided' && (p.data as { guidedKind?: string } | undefined)?.guidedKind === 'app-round';

/** アプリと同じ答え方の問題を1つでも持つサブトピック */
export const APP_ROUND_SUBTOPICS: ReadonlySet<string> = new Set(
  Object.entries(ALL_PROBLEM_SETS).filter(([, ps]) => ps.some(isAppRoundProblem)).map(([sub]) => sub),
);

/**
 * バトル（ぼうけん・スピードデュエル・クラス対戦）で出す問題。
 * アプリと同じ答え方の問題があるサブトピックは、それだけを出す（2026-10-22 先生の判断。前は SANMON の問題 約30問に3問まざるだけで、
 * アプリの答え方は1割しか出なかった）。SANMON にしかない問題は、れんしゅう・ふくしゅう・本番テストで出る。
 */
export function battleProblems(subtopic: string): Problem[] {
  const all = ALL_PROBLEM_SETS[subtopic] ?? [];
  return APP_ROUND_SUBTOPICS.has(subtopic) ? all.filter(isAppRoundProblem) : all;
}
