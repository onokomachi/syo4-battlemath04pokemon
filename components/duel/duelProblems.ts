/**
 * duelProblems.ts — 対戦のターンの問題をえらぶ（CPU 戦・クラス対戦で同じ）
 *
 * アプリと同じ答え方の問題があれば それだけ（ぼうけんと同じ battleProblems の決まり）。
 * クラス対戦は、2人が同じ番号を選ぶように部屋の名前とターンから決める（pickIndex）。
 * アプリと同じ答え方の問題は数字が出るたびに変わるので「同じレベル・ちがう数字」になる。
 */
import type { SpeedProblem } from '../../types';
import { CARD_DEFINITIONS } from '../../constants';
import { APP_ROUND_SUBTOPICS, isAppRoundProblem } from '../../data';
import { pickIndex } from '../../services/duel';
import { checkAnswer } from '../../utils/answerChecker';

export function problemFor(topic: string, subtopic: string, round: number): SpeedProblem | null {
  const pool = CARD_DEFINITIONS.filter((c) => c.category === subtopic && (!APP_ROUND_SUBTOPICS.has(subtopic) || isAppRoundProblem(c.problem)));
  if (pool.length === 0) return null;
  const card = pool[pickIndex(topic, subtopic, round, pool.length)]!;
  return { ...card.problem, category: card.category, difficulty: card.difficulty };
}

/** 採点は CPU 戦と同じ checkAnswer（アプリと同じ答え方の問題は、まちがえると '__guided_incorrect__' が来る） */
export function isDuelAnswerCorrect(problem: SpeedProblem, answer: string): boolean {
  const data = problem.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return answer !== '__guided_incorrect__'
    && checkAnswer(answer, problem.answer, { multiple: !!data?.multiple, requireForm: data?.requireForm });
}
