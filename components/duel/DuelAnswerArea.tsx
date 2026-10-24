/**
 * DuelAnswerArea.tsx — 対戦で1問を出して答えてもらう部分（問題の表示・キーパッド・解答ボタン）
 *
 * スピードデュエル（SpeedDuelBoard）とモンスター対戦（PartyDuelBoard）で同じものを使う
 * （「モードによって同じ問題の答え方がちがう」を起こさないため）。
 * アプリと同じ答え方の問題（guided）は、まちがえると '__guided_incorrect__' を返す。
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Problem, ProblemViewRef } from '../../types';
import { generateBattleKeypadLayout } from '../../utils/keypadLayoutGenerator';
import AngleDiagramView from '../AngleDiagramView';
import BentTransversalDiagramView from '../BentTransversalDiagramView';
import FillInProofProblemView from '../FillInProofProblemView';
import GuidedEquationProblemView from '../GuidedEquationProblemView';
import IntersectionGuidedEquationView from '../IntersectionGuidedEquationView';
import GraphingProblemView from '../GraphingProblemView';
import GraphingWithTableProblemView from '../GraphingWithTableProblemView';
import GraphToEquationProblemView from '../GraphToEquationProblemView';
import GraphWithDomainProblemView from '../GraphWithDomainProblemView';
import GraphProblemView from '../GraphProblemView';
import MultiTransversalAngleDiagramView from '../MultiTransversalAngleDiagramView';
import VerticalCalculationProblemView from '../VerticalCalculationProblemView';
import ProofProblemView from '../ProofProblemView';
import SimultaneousEquationProblemView from '../SimultaneousEquationProblemView';
import TriangleInParallelLinesView from '../TriangleInParallelLinesView';
import BoxPlotView from '../BoxPlotView';
import HistogramView from '../HistogramView';
import Keypad from '../Keypad';
import FractionText, { PartialFractionDisplay } from '../FractionText';
import GuidedAnswerHost from '../guided/GuidedAnswerHost';
import ProblemScratch from '../ProblemScratch';

export interface DuelAnswerAreaProps {
  problem: Problem;
  /** 問題が変わるたびに変える番号（入力を空にする・ガイドを作り直す） */
  round: number;
  /** 答えられる時間か */
  active: boolean;
  /** もう答えた */
  isPlayerAnswered: boolean;
  onAnswer: (answer: string) => void;
}

const DuelAnswerArea: React.FC<DuelAnswerAreaProps> = ({ problem, round, active, isPlayerAnswered, onAnswer }) => {
  const phase = active ? 'answering' : 'locked';
  const [answer, setAnswer] = useState('');
  const problemViewRef = useRef<ProblemViewRef>(null);

  // Reset answer on new round
  useEffect(() => {
    setAnswer('');
  }, [round, problem]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phase !== 'answering' || isPlayerAnswered) return;
    const autoTypes = ['graphing', 'graphing_with_table', 'proof', 'guided_equation', 'intersection_guided_equation', 'simultaneous_equation', 'vertical_calculation', 'fill_in_proof'];
    if (answer.trim() || (problem && autoTypes.includes(problem.type))) {
      onAnswer(answer.trim());
    }
  }, [answer, onAnswer, phase, isPlayerAnswered, problem]);

  const handleKeypadClick = useCallback((key: string) => {
    if (phase !== 'answering' || isPlayerAnswered) return;
    const interactiveTypes = ['fill_in_proof', 'graphing', 'graphing_with_table', 'vertical_calculation', 'guided_equation', 'simultaneous_equation', 'intersection_guided_equation', 'proof'];
    if (problem && interactiveTypes.includes(problem.type)) {
      problemViewRef.current?.handleKeyClick(key);
      return;
    }
    if (key === 'BACKSPACE') {
      setAnswer(prev => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setAnswer('');
    } else {
      setAnswer(prev => prev + key);
    }
  }, [phase, isPlayerAnswered, problem]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'answering' || isPlayerAnswered) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const keyMap: Record<string, string> = {
        'Backspace': 'BACKSPACE', 'Escape': 'CLEAR', 'Delete': 'CLEAR',
        '*': '×', 'p': 'π', '^': '^', 'd': '°', '<': '<', '>': '>',
      };
      if (keyMap[e.key]) handleKeypadClick(keyMap[e.key]);
      else if (/^[0-9xya b=+\-/,().]$/.test(e.key)) handleKeypadClick(e.key);
      else if (e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypadClick, handleSubmit, phase, isPlayerAnswered]);

  const keypadLayout = useMemo(() => {
    if (!problem) return undefined;
    return generateBattleKeypadLayout(problem);
  }, [problem]);

  // 分数キーパッド使用時は、入力を積み上げ表記でライブ表示する
  const isFractionKeypad = useMemo(
    () => keypadLayout.some(row => row.includes('と')),
    [keypadLayout],
  );


  const problemType = problem?.type || 'text';
  const problemData = (problem?.data || {}) as any;

  const renderProblem = () => {
    if (!problem) return null;
    return (
      <div className="w-full">
        {problemType === 'angle_diagram' && <AngleDiagramView data={problemData} userAnswer={answer} isSubmitted={false} />}
        {problemType === 'bent_transversal_diagram' && <BentTransversalDiagramView data={problemData} userAnswer={answer} isSubmitted={false} />}
        {problemType === 'fill_in_proof' && <FillInProofProblemView data={problemData} onAnswerChange={setAnswer} isSubmitted={false} submittedAnswer="" correctAnswer={problem.answer} ref={problemViewRef} />}
        {problemType === 'graphing' && <GraphingProblemView data={problemData} onAnswerChange={setAnswer} ref={problemViewRef} />}
        {problemType === 'graphing_with_table' && <GraphingWithTableProblemView data={problemData} onAnswerChange={setAnswer} ref={problemViewRef} />}
        {problemType === 'graph_to_equation' && <GraphToEquationProblemView data={problemData} />}
        {problemType === 'graph_with_domain' && <GraphWithDomainProblemView data={problemData} isVisualHintVisible={false} />}
        {problemType === 'guided_equation' && <GuidedEquationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} submittedAnswer={answer} correctAnswer={problem.answer} />}
        {problemType === 'intersection_guided_equation' && <IntersectionGuidedEquationView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} submittedAnswer={answer} correctAnswer={problem.answer} />}
        {problemType === 'multi_transversal_angle' && <MultiTransversalAngleDiagramView data={problemData} userAnswer={answer} isSubmitted={false} />}
        {problemType === 'vertical_calculation' && <VerticalCalculationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} submittedAnswer={answer} correctAnswer={problem.answer} />}
        {problemType === 'proof' && <ProofProblemView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} />}
        {problemType === 'simultaneous_equation' && <SimultaneousEquationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setAnswer} isSubmitted={false} />}
        {problemType === 'triangle_in_parallel_lines' && <TriangleInParallelLinesView data={problemData} userAnswer={answer} isSubmitted={false} />}
        {problemType === 'guided' && !isPlayerAnswered && (
          // key必須: ラウンドが変わったらエンジンを作り直す(前問の完了状態の持ち越し防止)
          <GuidedAnswerHost key={round} problem={problem} onComplete={(isCorrect) => onAnswer(isCorrect ? problem.answer : '__guided_incorrect__')} />
        )}
        {problemType === 'box_plot' && (
          <div className="w-full text-center">
            <p className="text-base sm:text-xl mb-2 font-mono">{problemData?.question}</p>
            <BoxPlotView datasets={problemData?.datasets || []} hideValue={problemData?.hideValue} />
            {problemData?.options && renderOptions(problemData.options)}
          </div>
        )}
        {problemType === 'histogram' && (
          <div className="w-full text-center">
            <p className="text-base sm:text-xl mb-2 font-mono">{problemData?.question}</p>
            <HistogramView bars={problemData?.bars || []} xLabel={problemData?.xLabel} yLabel={problemData?.yLabel} />
            {problemData?.options && renderOptions(problemData.options)}
          </div>
        )}
        {problemType === 'graph_with_area' && (
          <div className="text-center w-full">
            <p className="text-base sm:text-xl mb-2 font-mono">{problemData?.question || "面積を求めよ"}</p>
            <div className="w-full max-w-[200px] sm:max-w-[280px] mx-auto aspect-square bg-slate-900 rounded-xl p-2 border border-red-500/10">
              <GraphProblemView lines={problemData?.graphLines || []} polygon={problemData?.polygon} />
            </div>
          </div>
        )}
        {(problemType === 'text' || !problemType) && (
          <div className="w-full min-h-[4rem] bg-slate-900/50 border border-orange-500/10 rounded-xl p-3 sm:p-5 flex flex-col items-center justify-center text-center text-white text-base sm:text-xl font-mono">
            <p><FractionText text={problemData?.question || problemData?.questionText || "問題"} /></p>
            {problemData?.svg ? (
              <div className="svg-container w-full max-w-xs mx-auto my-2 p-1.5 bg-slate-950 rounded-lg border border-orange-500/10 max-h-[180px] sm:max-h-[220px] flex items-center justify-center" dangerouslySetInnerHTML={{ __html: problemData.svg }} />
            ) : problemData?.imageUrl ? (
              <img src={problemData.imageUrl} alt="DOC" className="max-w-full max-h-40 sm:max-h-52 mx-auto rounded-lg shadow-xl border border-orange-500/10 p-1 bg-slate-900 my-2" />
            ) : null}
            {problemData?.options && renderOptions(problemData.options)}
          </div>
        )}
      </div>
    );
  };

  const renderOptions = (options: string[]) => (
    <div className="grid gap-2 w-full max-w-lg mt-3 text-lg">
      {options.map((opt: string, i: number) => {
        const isSelected = answer === opt;
        return (
          <button key={i} type="button"
            onClick={() => { if (phase === 'answering' && !isPlayerAnswered) setAnswer(opt); }}
            disabled={phase !== 'answering' || isPlayerAnswered}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all
              ${isSelected ? 'border-orange-400 bg-orange-900/30 text-orange-200' : 'border-orange-900/30 bg-slate-900/60 text-white hover:border-orange-600/50'}
              disabled:opacity-50`}>
            <span className="text-orange-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span><FractionText text={opt} auto />
          </button>
        );
      })}
    </div>
  );


  return (
    <>
      {renderProblem()}
      <ProblemScratch problem={problem} />

      <form onSubmit={handleSubmit} className="w-full mt-4">
        {!['proof', 'guided'].includes(problemType) && (
          <div className="w-full flex flex-col items-center">
            {!problemData?.options && !['fill_in_proof', 'graphing', 'graphing_with_table', 'vertical_calculation', 'guided_equation', 'simultaneous_equation', 'intersection_guided_equation'].includes(problemType) && (
              <div className="w-full max-w-xl mb-3">
                <div className="min-h-[3rem] p-3 bg-slate-950 rounded-xl border-2 border-orange-500/30 flex items-center shadow-inner">
                  <span className="text-sm font-bold text-orange-400 mr-3">解答:</span>
                  {isFractionKeypad ? (
                    <span className="text-2xl font-mono text-orange-200 flex-grow font-bold">
                      <PartialFractionDisplay raw={answer} placeholder="キーパッドで入力..." />
                    </span>
                  ) : (problemType === 'text' || !problemType) ? (
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => !isPlayerAnswered && setAnswer(e.target.value)}
                      disabled={isPlayerAnswered}
                      placeholder="ここに入力..."
                      autoFocus
                      className="flex-grow bg-transparent text-2xl font-mono text-orange-200 font-bold tracking-wide outline-none placeholder:text-orange-800 placeholder:text-lg"
                    />
                  ) : (
                    <span className="text-2xl font-mono text-orange-200 flex-grow font-bold" style={{ wordBreak: 'break-all' }}>
                      {answer || <span className="text-orange-800 text-lg">入力してください...</span>}
                    </span>
                  )}
                </div>
              </div>
            )}
            {!problemData?.options && <Keypad onKeyClick={handleKeypadClick} layout={keypadLayout} disabled={isPlayerAnswered} />}
            <button
              type="submit"
              disabled={isPlayerAnswered}
              className="w-full mt-4 bg-orange-600 text-white font-bold py-3 px-10 rounded-xl hover:bg-orange-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-lg border border-orange-400/30 shadow-xl"
            >
              {isPlayerAnswered ? '解答済み ✓' : '解答する'}
            </button>
          </div>
        )}
      </form>
    </>
  );
};

export default DuelAnswerArea;
