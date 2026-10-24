/**
 * components/ProblemScratch.tsx
 *
 * 問題の下に出す「けいさんらん」（📝 筆算で けいさんする）。
 * 単元アプリと同じ kit の ScratchPadToggle をそのまま使う（アプリと同じ道具・同じ見た目）。
 *
 * - 暗算ではきびしい計算（3けた÷2けた・小数のかけ算・文章題の裏の計算など）を、紙を使わずに筆算できる。
 * - **採点しない・保存しない・送らない。** 答えはいつもの入力欄で答える。記録やサーバの負荷は増えない。
 * - **数は子どもが自分で入れる**（initial を渡さない）。文章題で「何と何をどう計算するか」を先に答えないため。
 * - はじめは閉じている。計算のある単元で、問題文に数字が2つ以上あるときだけ出す
 *   （「六十二億を数字で書きましょう」のような よみかきの問題には出さない）。単元でよく使う計算を最初に選んでおく。
 * - 出すのは「自分で答えを打つ問題」（text と、guided のうち ヒントつきで答えを打つ retry-hint）だけ。
 *   筆算の画面がある guided（division-hissan など）と、アプリと同じ答え方の問題には出さない
 *   （アプリの画面に、必要なら けいさんらん が入っている）。「あんざんで」と書いてある問題にも出さない。
 *
 * れんしゅう・ぼうけん（ProblemQuestionView）・対戦（DuelAnswerArea）・本番テスト（MockTestMode）で同じものを出す。
 */
import React from 'react';
import { ScratchPadToggle, type ScratchOp } from 'learning-app-kit/react';
import { MATH_CATEGORIES } from '../constants';
import type { Problem } from '../types';

interface ScratchSetting { ops: ScratchOp[]; decimal?: boolean }

/** 単元ごとの けいさんらん。ops の先頭が はじめに選ばれる計算。載っていない単元には出さない */
const SCRATCH_BY_UNIT: Record<string, ScratchSetting> = {
  '大きい数のしくみ': { ops: ['×', '+', '-'] },
  '折れ線グラフと表': { ops: ['-', '+'] },
  'わり算の筆算(÷1けた)': { ops: ['÷', '×', '-', '+'] },
  '角の大きさ': { ops: ['+', '-'] },
  '小数のしくみ': { ops: ['+', '-'], decimal: true },
  'わり算の筆算(÷2けた)': { ops: ['÷', '×', '-', '+'] },
  'がい数': { ops: ['+', '-', '×', '÷'] },
  '計算のきまり': { ops: ['+', '-', '×', '÷'] },
  '面積': { ops: ['×', '÷', '+', '-'] },
  '小数のかけ算とわり算': { ops: ['×', '÷', '+', '-'], decimal: true },
  '変わり方調べ': { ops: ['×', '+', '-', '÷'] },
  '倍の見方': { ops: ['÷', '×'] },
};

const UNIT_OF: Record<string, string> = Object.fromEntries(
  MATH_CATEGORIES.flatMap(c => c.groups.flatMap(g => g.subtopics.map(st => [st, c.name]))),
);

/** 自分で答えを打つ問題か（図・筆算の画面がある問題は、それぞれの画面に答え方がある） */
const isTypedAnswer = (problem: Problem): boolean =>
  problem.type === 'text' || !problem.type
  || (problem.type === 'guided' && (problem.data as { guidedKind?: string })?.guidedKind === 'retry-hint');

/** 問題文の中の数（1,000 や 3.6 も1つ）が2つ以上あるか。計算する問題だけに出すための目安 */
const hasTwoNumbers = (text: string): boolean => (text.match(/\d[\d,]*(\.\d+)?/g) ?? []).length >= 2;

interface Props {
  problem: Problem | null | undefined;
  /** 問題に subTopic / category が付いていないときのサブトピック */
  subtopic?: string;
}

const ProblemScratch: React.FC<Props> = ({ problem, subtopic }) => {
  if (!problem || !isTypedAnswer(problem)) return null;
  const p = problem as Problem & { subTopic?: string; category?: string };
  const st = p.subTopic || p.category || subtopic || '';
  const setting = SCRATCH_BY_UNIT[UNIT_OF[st] ?? ''];
  if (!setting) return null;
  const question = String((problem.data as { question?: string })?.question ?? '');
  if (!hasTwoNumbers(question) || question.includes('あんざん')) return null;
  return (
    <div className="w-full max-w-lg mx-auto mt-2">
      {/* key: 問題が変わったら けいさんらんを白紙にもどす（前の問題の筆算を残さない） */}
      <ScratchPadToggle key={question} ops={setting.ops} decimal={!!setting.decimal} />
    </div>
  );
};

export default ProblemScratch;
