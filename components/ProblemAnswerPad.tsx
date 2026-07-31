/**
 * components/ProblemAnswerPad.tsx
 *
 * 「解答らん + キーパッド」だけを描くコンポーネント。
 * ProblemScreen.tsx のインライン記述から切り出したもので、挙動は同一。
 *
 * 練習モード(ProblemScreen)と3Dバトル(BattleScreen)の両方がこれを使う。
 * 以前はバトル側にキー処理を書き写していたため、Keypad が送る 'CLEAR' /
 * 'BACKSPACE' を取りこぼして解答欄に文字列が混入する不具合が出ていた。
 * 入力経路を1本にして、そういうズレが構造的に起きないようにしている。
 */
import React, { useCallback, useMemo } from 'react';
import type { Problem, ProblemViewRef } from '../types';
import Keypad from './Keypad';
import { PartialFractionDisplay } from './FractionText';

/** 問題ビューが自前で入力を持つ型。キー入力はそのビューへ丸ごと委譲する。 */
export const INTERACTIVE_TYPES = [
  'fill_in_proof', 'graphing', 'graphing_with_table', 'vertical_calculation',
  'guided_equation', 'intersection_guided_equation', 'simultaneous_equation',
];

/** キーパッド自体を出さない型(自前で完結する / 選択肢問題) */
export const hidesAnswerPad = (problem: Problem | null, problemData: any): boolean =>
  problem?.type === 'proof' || problem?.type === 'guided' || Boolean(problemData?.options);

/**
 * 分数の積み上げ表示を使うか。
 * 帯分数の「と」がキーパッドに含まれるかで判定する(ProblemScreen と同じ条件)。
 */
export const usesFractionDisplay = (layout: string[][]): boolean =>
  layout.some(row => row.includes('と'));

interface Props {
  currentProblem: Problem | null;
  problemData: any;
  userAnswer: string;
  setUserAnswer: React.Dispatch<React.SetStateAction<string>>;
  showAnswer: boolean;
  keypadLayout: string[][];
  problemViewRef?: React.RefObject<ProblemViewRef | null>;
  /** 見た目のテーマ。練習モードは赤、3Dバトルは青。 */
  theme?: 'practice' | 'battle';
  /** Enterキー相当(バトルでは「こうげき！」)。省略時は何もしない。 */
  onSubmit?: () => void;
}

const ProblemAnswerPad: React.FC<Props> = ({
  currentProblem,
  problemData,
  userAnswer,
  setUserAnswer,
  showAnswer,
  keypadLayout,
  problemViewRef,
  theme = 'practice',
  onSubmit,
}) => {
  // ProblemScreen.tsx の handleKeypadClick と同一。
  const handleKeypadClick = useCallback((key: string) => {
    if (showAnswer) return;

    if (INTERACTIVE_TYPES.includes(currentProblem?.type || '')) {
      problemViewRef?.current?.handleKeyClick(key);
      return;
    }

    if (key === 'BACKSPACE') {
      setUserAnswer(prev => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setUserAnswer('');
    } else if (key === 'ENTER') {
      onSubmit?.();
    } else {
      setUserAnswer(prev => prev + key);
    }
  }, [showAnswer, currentProblem, problemViewRef, setUserAnswer, onSubmit]);

  const isFractionKeypad = useMemo(() => usesFractionDisplay(keypadLayout), [keypadLayout]);

  if (hidesAnswerPad(currentProblem, problemData)) return null;

  const showsAnswerBox = !INTERACTIVE_TYPES.includes(currentProblem?.type || '');
  const battle = theme === 'battle';

  const boxClass = battle
    ? 'min-h-[3.25rem] px-3 py-2 rounded-2xl bg-slate-950/70 border-2 border-sky-400/40 flex items-center'
    : 'min-h-[3rem] sm:min-h-[3.5rem] p-2 sm:p-3 bg-slate-950/60 rounded-xl border-2 border-red-500/30 flex items-center shadow-inner';
  const labelClass = battle
    ? 'text-xs font-bold text-sky-300 mr-3 shrink-0'
    : 'text-xs sm:text-sm font-bold text-red-400 mr-2 sm:mr-3 whitespace-nowrap';
  const valueClass = battle
    ? 'flex-1 min-w-0 text-xl sm:text-2xl font-mono font-bold text-white'
    : 'text-lg sm:text-xl lg:text-2xl font-mono text-red-200 flex-grow font-bold tracking-wide';
  const placeholder = battle ? 'キーパッドで にゅうりょく' : 'キーパッドで入力...';

  return (
    <>
      {showsAnswerBox && (
        <div className={battle ? 'w-full shrink-0' : 'w-full max-w-lg'}>
          <div className={boxClass}>
            <span className={labelClass}>{battle ? 'こたえ' : '解答:'}</span>
            {isFractionKeypad ? (
              <span className={valueClass}>
                <PartialFractionDisplay raw={userAnswer} placeholder={placeholder} />
              </span>
            ) : (currentProblem?.type === 'text' || !currentProblem?.type) ? (
              <input
                type="text"
                value={userAnswer}
                onChange={e => !showAnswer && setUserAnswer(e.target.value)}
                disabled={showAnswer}
                placeholder={battle ? 'ここに にゅうりょく' : 'ここに入力...'}
                className={
                  battle
                    ? 'flex-1 min-w-0 bg-transparent text-xl sm:text-2xl font-mono font-bold text-white outline-none placeholder:text-slate-600 placeholder:text-sm'
                    : 'flex-grow bg-transparent text-lg sm:text-xl lg:text-2xl font-mono text-red-200 font-bold tracking-wide outline-none placeholder:text-red-800 placeholder:text-sm'
                }
              />
            ) : (
              <span className={valueClass} style={{ wordBreak: 'break-all' }}>
                {userAnswer || (
                  <span className={battle ? 'text-slate-600 text-sm' : 'text-red-800 text-sm'}>
                    {placeholder}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
      <div className={battle ? 'w-full' : 'w-full max-w-lg'}>
        <Keypad onKeyClick={handleKeypadClick} layout={keypadLayout} disabled={showAnswer} />
      </div>
    </>
  );
};

export default ProblemAnswerPad;
