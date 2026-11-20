// このファイルは単元アプリ syo4-gaisu の src/components/modules/MockTestModule.tsx の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 本番テストモード。がい数単元の単元テストを同じ大問順・同じ問題数で通しで解く。
 * 開始前に 表だけ / 裏だけ / 表＋裏（ぜんぶ）の範囲を選べる。
 * 既存の各アクティビティを「1問だけ出す」形で再利用し、ノーミス完答（一発正解）を採点する。
 * 表=知識技能100点 / 裏=思考判断表現50点。結果は学習のきろくに詳細つきで残す。
 */
import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ClipboardCheck, Home, RotateCcw, Trophy, HelpCircle, Lightbulb, Dumbbell } from 'lucide-react';
import { TEST_STEPS, TestProblem, TestStep, describeProblem, OMOTE_MAX, URA_MAX, TOTAL_MAX , howTo, practiceModuleOf } from '../../lib/testConfig';
import { useProgressStore, TestDetail, ModuleId } from '../../store/progressStore';
import { MeaningRound } from './MeaningModule';
import { RoundRound } from './RoundModule';
import { RangeRound } from './RangeModule';
import { SumDiffRound } from './SumDiffModule';
import { ProdQuotRound } from './ProdQuotModule';
import { RoundJudgeRound } from './RoundJudgeModule';
import { forceSolo } from 'learning-app-kit/sync';

interface Props {
  onExit: () => void;
  /** テストのあと「れんしゅうする」で、その項目のモジュールへ飛ぶ */
  onPractice?: (id: ModuleId) => void;
}

type Phase = 'INTRO' | 'RUN' | 'RESULT';
type Mode = '表' | '裏' | 'ぜんぶ';

const stepsForMode = (mode: Mode): TestStep[] => {
  if (mode === '表') return TEST_STEPS.filter((s) => s.section === '表');
  if (mode === '裏') return TEST_STEPS.filter((s) => s.section === '裏' || s.section === '参考');
  return TEST_STEPS;
};

export const MockTestModule: React.FC<Props> = ({ onExit, onPractice }) => {
  const [phase, setPhase] = useState<Phase>('INTRO');
  const [mode, setMode] = useState<Mode>('ぜんぶ');
  const [seed, setSeed] = useState(0); // 「もう一度」で問題を作り直す
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({}); // index -> ノーミス
  const [misses, setMisses] = useState<Record<number, number>>({});     // index -> まちがえた回数
  const [gaveUp, setGaveUp] = useState<Record<number, boolean>>({});    // index -> 「わからない」で進んだか
  const recordResult = useProgressStore((s) => s.recordResult);
  const [recorded, setRecorded] = useState(false);

  // 選んだ範囲のステップ
  const activeSteps = useMemo<TestStep[]>(() => stepsForMode(mode), [mode]);
  // マウント（または もう一度・範囲変更）時に全問を一度だけ生成して固定
  const problems = useMemo<TestProblem[]>(() => activeSteps.map((s) => s.gen()), [activeSteps, seed]);

  const choose = (m: Mode) => {
    // 本番テストは実力を測る場面。ペア（1台を2人）のままなら、ここでソロに切り替える
    forceSolo();
    setMode(m);
    setIndex(0);
    setResults({}); setMisses({}); setGaveUp({});
    setRecorded(false);
    setPhase('RUN');
  };
  const restart = () => {
    // 本番テストは実力を測る場面。ペア（1台を2人）のままなら、ここでソロに切り替える
    forceSolo();
    setSeed((s) => s + 1);
    setIndex(0);
    setResults({}); setMisses({}); setGaveUp({});
    setRecorded(false);
    setPhase('RUN');
  };

  const onResult = (perfect: boolean) => {
    // 一発目の結果だけを得点にする
    setResults((r) => (index in r ? r : { ...r, [index]: perfect }));
  };

  const advance = () => {
    if (index < activeSteps.length - 1) setIndex((i) => i + 1);
    else setPhase('RESULT');
  };

  /**
   * 2回まちがえたら×にして、つぎの問題へ。
   * 正解するまで進めない作りだと、分からない子がそこで止まり、
   * テストが最後まで終わらない（＝点数も出ず、記録も残らない）。
   */
  const MAX_MISS = 2;
  const onMiss = () => {
    const at = index;
    setMisses((m) => {
      const n = (m[at] ?? 0) + 1;
      if (n >= MAX_MISS) {
        // 先に×を確定させてから進める（進んだあとの index に×が付かないように）
        setResults((r) => (at in r ? r : { ...r, [at]: false }));
        setTimeout(advance, 650);   // 「×」を見せてから切り替える
      }
      return { ...m, [at]: n };
    });
  };

  /** 「わからない」。分からない問題で止まらずに、最後まで終えられるようにする */
  const giveUp = () => {
    const at = index;
    setResults((r) => (at in r ? r : { ...r, [at]: false }));
    setGaveUp((g) => ({ ...g, [at]: true }));
    advance();
  };


  // 採点（選んだ範囲の最大点）
  const earnedAt = (i: number) => (results[i] ? activeSteps[i].points : 0);
  const omoteMax = activeSteps.filter((s) => s.section === '表').reduce((a, s) => a + s.points, 0);
  const uraMax = activeSteps.filter((s) => s.section === '裏').reduce((a, s) => a + s.points, 0);
  const totalMax = omoteMax + uraMax;
  const omoteScore = activeSteps.reduce((a, s, i) => a + (s.section === '表' ? earnedAt(i) : 0), 0);
  const uraScore = activeSteps.reduce((a, s, i) => a + (s.section === '裏' ? earnedAt(i) : 0), 0);
  const totalScore = omoteScore + uraScore;
  const refIndex = activeSteps.findIndex((s) => s.section === '参考');
  const refPerfect = refIndex >= 0 && results[refIndex];

  // 結果画面に入ったら1回だけ詳細つきで記録
  if (phase === 'RESULT' && !recorded) {
    const detail: TestDetail = {
      mode,
      omoteScore, omoteMax, uraScore, uraMax,
      total: totalScore, totalMax,
      steps: activeSteps.map((s, i) => {
        const d = describeProblem(problems[i]);
        return { daimon: s.daimon, sub: s.sub, title: s.title, section: s.section, q: d.q, a: d.a, points: s.points, earned: earnedAt(i), correct: !!results[i],
          // 記号を残す。これが無いと「どの種類の問題が学級全体で弱いか」が出せない
          skillId: s.skillId, misses: misses[i] ?? 0, gaveUp: !!gaveUp[i] };
      }),
    };
    recordResult({ moduleId: 'mock-test', skillId: 'mock-test', label: `本番テスト（${mode}）${totalScore}/${totalMax}点`, correct: totalScore === totalMax, detail });
    setRecorded(true);
  }

  /* ---------------- INTRO ---------------- */
  if (phase === 'INTRO') {
    const RangeButton: React.FC<{ m: Mode; title: string; sub: string; max: number; color: string }> = ({ m, title, sub, max, color }) => (
      <button onClick={() => choose(m)} className={`flex-1 min-w-[8rem] rounded-2xl border-2 ${color} p-5 text-left transition-all active:scale-95 hover:shadow-lg`}>
        <div className="text-xl font-black text-content">{title}</div>
        <div className="text-sm font-bold text-muted mt-0.5">{sub}</div>
        <div className="text-2xl font-black tabular-nums mt-2">{max}<span className="text-base text-muted">点</span></div>
      </button>
    );
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={onExit} className="flex items-center gap-2 text-muted hover:text-content font-bold px-3 py-2 rounded-xl hover:bg-surface-3 transition-colors mb-2">
            <ChevronLeft size={24} /> ホームへ
          </button>
          <div className="bg-surface rounded-[36px] shadow-2xl border border-line p-8 md:p-12 text-center mt-4">
            <div className="w-24 h-24 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-6"><ClipboardCheck size={44} /></div>
            <h1 className="text-3xl font-black text-content mb-2">本番テストモード</h1>
            <p className="text-muted font-bold leading-relaxed mb-2">「がい数の表し方と使い方」の テストに ちょうせん！</p>
            <p className="text-faint font-bold text-sm mb-6">どこに ちょうせんする？ 範囲を えらんでね。まちがえても 正しい こたえまで すすめるよ。一発で 正解できると 点が もらえるよ。</p>
            <div className="flex flex-wrap gap-3">
              <RangeButton m="表" title="表だけ" sub="知識・ぎのう" max={OMOTE_MAX} color="border-blue-300 hover:border-blue-400 bg-blue-50/40" />
              <RangeButton m="裏" title="裏だけ" sub="考える力（参考つき）" max={URA_MAX} color="border-rose-300 hover:border-rose-400 bg-rose-50/40" />
              <RangeButton m="ぜんぶ" title="表＋裏" sub="ぜんぶ通し（参考つき）" max={TOTAL_MAX} color="border-amber-300 hover:border-amber-400 bg-amber-50/40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- RESULT ---------------- */
  if (phase === 'RESULT') {
    const omoteSteps = activeSteps.map((s, i) => ({ s, i })).filter((x) => x.s.section === '表');
    const uraSteps = activeSteps.map((s, i) => ({ s, i })).filter((x) => x.s.section === '裏');
    /**
     * 1行＝1つの大問。**まちがえた問題にだけ「やり方」を添える。**
     * できた問題にも解説を並べると、見るべきところが埋もれる。
     */
    const Row: React.FC<{ s: TestStep; i: number }> = ({ s, i }) => {
      const d = describeProblem(problems[i]);
      const ok = !!results[i];
      const practice = practiceModuleOf(s.skillId);
      return (
        <div className="py-2 border-b border-line/60 last:border-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="font-bold text-content text-sm">大問{s.daimon}{s.sub ?? ''}　{s.title}</span>
              <div className="text-xs text-muted font-bold mt-0.5">{d.q}　→　<span className="text-content">{d.a}</span></div>
            </div>
            <span className={`font-black tabular-nums shrink-0 ${ok ? 'text-emerald-600' : 'text-rose-400'}`}>
              {ok ? '○' : '×'} {earnedAt(i)}/{s.points}
            </span>
          </div>

          {!ok && (
            <div className="mt-2 rounded-2xl bg-amber-50 border border-amber-200 p-3">
              <p className="flex items-start gap-1.5 text-sm font-bold text-amber-900 leading-relaxed">
                <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
                {howTo(s.skillId)}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {gaveUp[i] && <span className="text-xs font-bold text-amber-700">「わからない」で つぎへ すすんだ問題</span>}
                {!gaveUp[i] && (misses[i] ?? 0) >= 2 && <span className="text-xs font-bold text-amber-700">2回まちがえた問題</span>}
                {practice && onPractice && (
                  <button
                    onClick={() => onPractice(practice)}
                    className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600
                               text-white font-black text-xs transition-colors active:scale-95"
                  >
                    <Dumbbell size={14} /> れんしゅうする
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    };
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="bg-surface rounded-[36px] shadow-2xl border border-line p-6 md:p-10 mt-4">
            <div className="text-center mb-6">
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-50 text-amber-500 mb-3"><Trophy size={40} /></motion.div>
              <h1 className="text-2xl font-black text-content">テスト けっか（{mode}）</h1>
              <div className="text-5xl font-black text-blue-600 tabular-nums mt-2">{totalScore}<span className="text-2xl text-muted"> / {totalMax}点</span></div>
              <div className="flex justify-center gap-3 mt-3">
                {omoteMax > 0 && <span className="px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 font-black text-sm">表 {omoteScore}/{omoteMax}</span>}
                {uraMax > 0 && <span className="px-4 py-1.5 rounded-full bg-rose-50 text-rose-600 font-black text-sm">裏 {uraScore}/{uraMax}</span>}
              </div>
            </div>

            {activeSteps.some((_, i) => !results[i]) && (
              <div className="rounded-2xl bg-surface-2 border border-line p-4 mb-4 text-center">
                <p className="font-black text-content text-sm">まちがえた ところに やり方を つけたよ</p>
                <p className="text-xs text-muted font-bold mt-1">
                  下を 見て、「れんしゅうする」から やり直そう。まちがいは 学びの たからもの！
                </p>
              </div>
            )}

            {omoteSteps.length > 0 && (
              <div className="rounded-2xl border border-line p-4 mb-3">
                <p className="text-xs font-black text-blue-600 mb-2">表・知識ぎのう</p>
                {omoteSteps.map(({ s, i }) => <Row key={i} s={s} i={i} />)}
              </div>
            )}
            {uraSteps.length > 0 && (
              <div className="rounded-2xl border border-line p-4 mb-3">
                <p className="text-xs font-black text-rose-500 mb-2">裏・思考はんだん表現</p>
                {uraSteps.map(({ s, i }) => <Row key={i} s={s} i={i} />)}
              </div>
            )}
            {refIndex >= 0 && (
              <div className="rounded-2xl border border-line p-4 mb-6">
                <p className="text-xs font-black text-faint mb-1">いかそう算数（点数なし・評価）</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-content text-sm">がい数を つかう場面を 見ぬく</span>
                  <span className={`font-black ${refPerfect ? 'text-emerald-600' : 'text-amber-500'}`}>{refPerfect ? 'A（一発で見ぬけた！）' : 'がんばろう'}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={restart} className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95">
                <RotateCcw size={20} /> もう一度
              </button>
              <button onClick={() => setPhase('INTRO')} className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface border-2 border-line text-content rounded-2xl font-black text-lg hover:bg-surface-2 transition-all active:scale-95">
                範囲をえらぶ
              </button>
              <button onClick={onExit} className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface border-2 border-line text-content rounded-2xl font-black text-lg hover:bg-surface-2 transition-all active:scale-95">
                <Home size={20} /> ホームへ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- RUN ---------------- */
  const step = activeSteps[index];
  const tp = problems[index];
  const progress = (index / activeSteps.length) * 100;
  const scoredSteps = activeSteps.filter((s) => s.section !== '参考').length;
  const scoredDone = activeSteps.slice(0, index).filter((s) => s.section !== '参考').length;

  const renderActivity = () => (
    <TestActivity tp={tp} onNext={advance} onResult={onResult} onMiss={onMiss} nextLabel="つぎの もんだいへ" />
  );

  const sectionColor = step.section === '表' ? 'bg-blue-100 text-blue-700' : step.section === '裏' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700';

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      {/* テスト用ヘッダ（得点は隠す） */}
      <div className="shrink-0 border-b border-line bg-surface/80 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={onExit} className="flex items-center gap-1 text-muted hover:text-content font-bold px-2 py-1.5 rounded-lg hover:bg-surface-3 transition-colors shrink-0">
            <ChevronLeft size={20} /> やめる
          </button>
          <span className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ${sectionColor}`}>{step.section}</span>
          <div className="font-black text-content truncate">大問{step.daimon}{step.sub ?? ''}　<span className="text-muted font-bold">{step.title}</span></div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* あと何回まちがえられるか。黙って×になると、何が起きたか分からない */}
            {(misses[index] ?? 0) > 0 && (
              <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-500 text-xs font-black">
                あと{Math.max(0, 2 - (misses[index] ?? 0))}回
              </span>
            )}
            <button
              onClick={giveUp}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-line text-muted
                         hover:text-content hover:border-faint font-bold text-sm transition-colors"
            >
              <HelpCircle size={16} /> わからない
            </button>
            <span className="text-sm font-black text-muted tabular-nums">{step.section === '参考' ? '参考もんだい' : `${scoredDone + 1} / ${scoredSteps}問`}</span>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-2 h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* 本体（ステップごとに remount して内部状態をリセット） */}
      <div className="flex-1 min-h-0" key={`${mode}-${seed}-${index}`}>
        {renderActivity()}
      </div>
    </div>
  );
};

/**
 * 本番テストの1問を、練習と同じ解答画面で出す。
 * 神域の試練もこれを使う（練習・テスト・試練で、同じ問題は同じ画面で解く）。
 */
export const TestActivity: React.FC<{
  tp: TestProblem;
  onNext: () => void;
  onResult: (perfect: boolean) => void;
  onMiss?: () => void;
  nextLabel?: string;
}> = ({ tp, ...common }) => {
  switch (tp.kind) {
    case 'meaning-num': return <MeaningRound {...common} level={tp.level} numberProblem={tp.p} />;
    case 'meaning-scene': return <MeaningRound {...common} level="meaning-scene" sceneProblem={tp.p} />;
    case 'round-place': return <RoundRound {...common} level="round-place" placeProblem={tp.p} />;
    case 'round-digit': return <RoundRound {...common} level={tp.k === 1 ? 'round-digit1' : 'round-digit2'} digitProblem={tp.p} />;
    case 'round-choose': return <RoundRound {...common} level="round-choose" chooseProblem={tp.p} />;
    case 'range': return <RangeRound {...common} level={tp.level} problem={tp.p} />;
    case 'sumdiff': return <SumDiffRound {...common} level={tp.level} problem={tp.p} />;
    case 'prodquot': return <ProdQuotRound {...common} level={tp.level} problem={tp.p} />;
    case 'roundjudge-budget': return <RoundJudgeRound {...common} level="roundjudge-budget" budgetProblem={tp.p} />;
  }
};
