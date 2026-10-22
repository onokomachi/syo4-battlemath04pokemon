/** 小数のかけ算とわり算（syousu）の解答画面を SANMON に出すための対応表（SANMON 用に手で書く） */
import { useState } from 'react';
import type { AppRoundDef } from '../types';
import { generateMulDiv, type MulDivLevel } from './lib/mulDivQuestions';
import { MulDivRound } from './components/modules/MulDivRounds';

const noop = () => {};
const Round: AppRoundDef['Round'] = ({ level, onResult, onMiss }) => {
  const [q] = useState(() => generateMulDiv(level as MulDivLevel));
  return <MulDivRound q={q} onNext={noop} onResult={onResult} onMiss={onMiss} />;
};
const def = (levels: string[]): AppRoundDef => ({ levels, Round, make: (l) => generateMulDiv(l as MulDivLevel) });

export const SYOUSU_ROUNDS: Record<string, AppRoundDef> = {
  mul1: def(['mul-tenths']),
  mul2: def(['mul-hundredths']),
  div1: def(['div-basic', 'div-carry']),
  divInt: def(['div-int']),
  divRem: def(['div-remainder']),
  mulWord: def(['mul-word']),
  divWord: def(['div-word', 'div-word-remainder']),
  mul2digit: def(['mul-2digit', 'mul-zero-end']),
  div2digit: def(['div-2digit']),
  divRound: def(['div-round', 'div-check']),
  mental: def(['mul-mental', 'div-mental']),
  point: def(['mul-method', 'mul-point', 'div-point']),
  times: def(['div-times']),
};
