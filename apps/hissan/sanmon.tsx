/** わり算の筆算（hissan）の解答画面を SANMON に出すための対応表（SANMON 用に手で書く）。ラウンド名＝アプリの skill_id */
import type { AppRoundDef } from '../types';
import * as P from './lib/problems';
import { MentalRound } from './components/modules/MentalModule';
import { RulesRound } from './components/modules/RulesModule';
import { CheckRound } from './components/modules/CheckModule';
import { EstimateRound } from './components/modules/EstimateModule';
import { WordRound } from './components/modules/WordProblemModule';
import { DivErrorRound } from './components/modules/ErrorHunterModule';

const noop = () => {};
type H = { onResult: (p: boolean) => void; onMiss: () => void };
const one = (level: string, make: () => unknown, render: (h: H) => React.ReactNode): AppRoundDef => ({
  levels: [level], make, Round: ({ onResult, onMiss }) => <>{render({ onResult, onMiss })}</>,
});
const c = (h: H) => ({ onNext: noop, onResult: h.onResult, onMiss: h.onMiss });
const each = <L extends string>(levels: { id: L }[], make: (l: L) => unknown, render: (l: L, h: H) => React.ReactNode) =>
  Object.fromEntries(levels.map(({ id }) => [id, one(id, () => make(id), (h) => render(id, h))]));

export const HISSAN_ROUNDS: Record<string, AppRoundDef> = {
  ...each(P.MENTAL_LEVELS, P.generateMental, (l, h) => <MentalRound level={l} {...c(h)} />),
  ...each(P.RULES_LEVELS, P.generateRules, (l, h) => <RulesRound level={l} {...c(h)} />),
  ...each(P.CHECK_LEVELS, P.generateCheck, (l, h) => <CheckRound level={l} {...c(h)} />),
  ...each(P.ESTIMATE_LEVELS, P.generateEstimate, (l, h) => <EstimateRound level={l} {...c(h)} />),
  ...each(P.WORD_LEVELS, P.generateWord, (l, h) => <WordRound level={l} {...c(h)} />),
  error: one('eh-div', () => P.generateDivError(), (h) => <DivErrorRound {...c(h)} />),
};
