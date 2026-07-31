/**
 * components/ProblemQuestionView.tsx
 *
 * 「問題そのものの見た目」だけを描くコンポーネント。
 * ProblemScreen.tsx のインライン記述から切り出したもので、内容は同一。
 *
 * 練習モード(ProblemScreen)と、3Dアドベンチャーのバトル画面(BattleScreen)の
 * 両方から同じものを呼ぶことで、「どのモードでも同じ問題は同じ見た目・同じ
 * 解答方法」を1箇所で保証する。
 */
import React from 'react';
import type { Problem, ProblemViewRef } from '../types';
import FractionText from './FractionText';

import AngleDiagramView from './AngleDiagramView';
import BentTransversalDiagramView from './BentTransversalDiagramView';
import FillInProofProblemView from './FillInProofProblemView';
import GraphingProblemView from './GraphingProblemView';
import GraphingWithTableProblemView from './GraphingWithTableProblemView';
import GraphToEquationProblemView from './GraphToEquationProblemView';
import GraphWithDomainProblemView from './GraphWithDomainProblemView';
import GuidedEquationProblemView from './GuidedEquationProblemView';
import IntersectionGuidedEquationView from './IntersectionGuidedEquationView';
import MultiTransversalAngleDiagramView from './MultiTransversalAngleDiagramView';
import VerticalCalculationProblemView from './VerticalCalculationProblemView';
import ProofProblemView from './ProofProblemView';
import SimultaneousEquationProblemView from './SimultaneousEquationProblemView';
import TriangleInParallelLinesView from './TriangleInParallelLinesView';
import GraphProblemView from './GraphProblemView';
import BoxPlotView from './BoxPlotView';
import HistogramView from './HistogramView';
import GuidedAnswerHost from './guided/GuidedAnswerHost';

interface Props {
  currentProblem: Problem | null;
  /** currentProblem.data を any として扱ったもの(型ごとの分岐は各ビューが行う) */
  problemData: any;
  userAnswer: string;
  setUserAnswer: (v: string) => void;
  showAnswer: boolean;
  problemViewRef?: React.RefObject<ProblemViewRef | null>;
  /** type:'guided' のときに実際に描画する Problem(マスターモード切替後のもの) */
  guidedDisplayProblem?: Problem | null;
  handleGuidedComplete?: (isCorrect: boolean) => void;
  /** guided エンジンを作り直すためのキー */
  guidedKey?: string | number;
}

const ProblemQuestionView: React.FC<Props> = ({
  currentProblem,
  problemData,
  userAnswer,
  setUserAnswer,
  showAnswer,
  problemViewRef,
  guidedDisplayProblem,
  handleGuidedComplete,
  guidedKey,
}) => {
  return (
    <>
                    {currentProblem?.type === 'angle_diagram' && <AngleDiagramView data={problemData} userAnswer={userAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'bent_transversal_diagram' && <BentTransversalDiagramView data={problemData} userAnswer={userAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'fill_in_proof' && <FillInProofProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} submittedAnswer={userAnswer} correctAnswer={currentProblem.answer} />}
                    {currentProblem?.type === 'graphing' && <GraphingProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} />}
                    {currentProblem?.type === 'graphing_with_table' && <GraphingWithTableProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} />}
                    {currentProblem?.type === 'graph_to_equation' && <GraphToEquationProblemView data={problemData} />}
                    {currentProblem?.type === 'graph_with_domain' && <GraphWithDomainProblemView data={problemData} isVisualHintVisible={showAnswer} />}
                    {currentProblem?.type === 'guided_equation' && <GuidedEquationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} submittedAnswer={userAnswer} correctAnswer={currentProblem.answer} />}
                    {currentProblem?.type === 'intersection_guided_equation' && <IntersectionGuidedEquationView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} submittedAnswer={userAnswer} correctAnswer={currentProblem.answer} />}
                    {currentProblem?.type === 'multi_transversal_angle' && <MultiTransversalAngleDiagramView data={problemData} userAnswer={userAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'vertical_calculation' && <VerticalCalculationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} submittedAnswer={userAnswer} correctAnswer={currentProblem.answer} />}
                    {/* 完了後もアンマウントしない: エビデンスA(ワークトイグザンプル効果, Sweller & Cooper 1985; Renkl 2014)
                        誤答時にguidedエンジン自身のまちがい箇所ハイライト・かいせつ表示をそのまま見せることで、
                        単なる正解の文字列提示より定着しやすい振り返りになる。
                        key必須: 問題(またはマスターモードの切り替え)が変わったらエンジンを作り直す
                        (前問の「完了」状態の持ち越し防止) */}
                    {currentProblem?.type === 'guided' && guidedDisplayProblem && (
                      <GuidedAnswerHost key={guidedKey} problem={guidedDisplayProblem} onComplete={handleGuidedComplete!} />
                    )}
                    {currentProblem?.type === 'proof' && <ProofProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'simultaneous_equation' && <SimultaneousEquationProblemView ref={problemViewRef} data={problemData} onAnswerChange={setUserAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'triangle_in_parallel_lines' && <TriangleInParallelLinesView data={problemData} userAnswer={userAnswer} isSubmitted={showAnswer} />}
                    {currentProblem?.type === 'box_plot' && (
                      <div className="w-full text-center">
                        <p className="text-base sm:text-lg lg:text-xl leading-snug mb-2 sm:mb-3 font-mono tracking-tight">{problemData?.question}</p>
                        <BoxPlotView datasets={problemData?.datasets || []} hideValue={problemData?.hideValue} />
                        {problemData?.options && (
                          <div className="grid gap-2 max-w-lg mx-auto mt-2">
                            {(problemData.options as string[]).map((opt: string, i: number) => {
                              const isSelected = userAnswer === opt;
                              return (
                                <button key={i} onClick={() => { if (!showAnswer) setUserAnswer(opt); }} disabled={showAnswer}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm sm:text-base font-mono
                                    ${isSelected ? 'border-red-400 bg-red-900/30 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50 hover:bg-slate-800/60'}
                                    ${showAnswer ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <span className="text-red-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {currentProblem?.type === 'histogram' && (
                      <div className="w-full text-center">
                        <p className="text-base sm:text-lg lg:text-xl leading-snug mb-2 sm:mb-3 font-mono tracking-tight">{problemData?.question}</p>
                        <HistogramView bars={problemData?.bars || []} xLabel={problemData?.xLabel} yLabel={problemData?.yLabel} />
                        {problemData?.options && (
                          <div className="grid gap-2 max-w-lg mx-auto mt-2">
                            {(problemData.options as string[]).map((opt: string, i: number) => {
                              const isSelected = userAnswer === opt;
                              return (
                                <button key={i} onClick={() => { if (!showAnswer) setUserAnswer(opt); }} disabled={showAnswer}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm sm:text-base font-mono
                                    ${isSelected ? 'border-red-400 bg-red-900/30 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50 hover:bg-slate-800/60'}
                                    ${showAnswer ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <span className="text-red-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>{opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {currentProblem?.type === 'graph_with_area' &&
                        <div className="text-center w-full">
                          <p className="text-sm sm:text-base lg:text-lg mb-2 font-mono">{problemData?.question || "面積を求めよ"}</p>
                          <div className="w-full max-w-[200px] sm:max-w-[240px] mx-auto aspect-square">
                            <GraphProblemView lines={problemData?.graphLines || []} polygon={problemData?.polygon} />
                          </div>
                        </div>
                    }
                    {(currentProblem?.type === 'text' || !currentProblem?.type) && (
                      <div className="w-full text-center">
                        <p className="text-base sm:text-lg lg:text-xl leading-snug mb-2 sm:mb-3 font-mono tracking-tight"><FractionText text={problemData?.question || problemData?.questionText || "問題文の解析に失敗しました"} /></p>
                        {problemData?.svg ? (
                          <div className="svg-container w-full max-w-xs mx-auto my-2 p-1.5 bg-slate-950 rounded-lg border border-red-500/10 overflow-visible" dangerouslySetInnerHTML={{ __html: problemData.svg }} />
                        ) : problemData?.imageUrl ? (
                          <img src={problemData.imageUrl} alt="DOC" className="max-w-full max-h-40 sm:max-h-52 mx-auto rounded-lg shadow-xl border border-red-500/10 p-1 bg-slate-900 mb-2" />
                        ) : null}
                        {problemData?.options && (
                          <div className="grid gap-2 max-w-lg mx-auto mt-2">
                            {(problemData.options as string[]).map((opt: string, i: number) => {
                              const isSelected = problemData.multiple
                                ? userAnswer.split(',').map((s: string) => s.trim()).includes(opt)
                                : userAnswer === opt;
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    if (showAnswer) return;
                                    if (problemData.multiple) {
                                      const current = userAnswer ? userAnswer.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                                      if (current.includes(opt)) {
                                        setUserAnswer(current.filter((s: string) => s !== opt).join(','));
                                      } else {
                                        setUserAnswer([...current, opt].join(','));
                                      }
                                    } else {
                                      setUserAnswer(opt);
                                    }
                                  }}
                                  disabled={showAnswer}
                                  className={`w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all text-sm sm:text-base font-mono
                                    ${isSelected
                                      ? 'border-red-400 bg-red-900/30 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                      : 'border-red-900/30 bg-slate-900/60 text-white hover:border-red-600/50 hover:bg-slate-800/60'}
                                    ${showAnswer ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  <span className="text-red-500 mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>
                                  <FractionText text={opt} auto />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
    </>
  );
};

export default ProblemQuestionView;
