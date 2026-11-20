// このファイルは単元アプリ syo4-syousu-v2 の src/components/modules/MockTestModule.tsx の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 本番テストモード。実際の単元テストを同じ大問順・同じ問題数で通しで解く。
 * テストは「5. 小数のしくみ」と「13. 小数のかけ算とわり算」の2つから選ぶ。
 * 開始前に 表だけ / 裏だけ / 表＋裏（ぜんぶ）の範囲を選べる。
 * 既存の各アクティビティを「1問だけ出す」形で再利用し、ノーミス完答を採点する。
 * 表=知識技能100点 / 裏=思考判断表現50点 / 参考=評価のみ。結果は学習のきろくに詳細つきで残す。
 */
import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ClipboardCheck, Home, RotateCcw, Trophy, HelpCircle, Lightbulb, Dumbbell } from 'lucide-react';
import { TESTS, TestProblem, TestStep, TestDef, TestId, describeProblem, howTo, practiceModuleOf, skillIdOf } from '../../lib/testConfig';
import { useProgressStore, TestDetail, ModuleId } from '../../store/progressStore';
import { useReflectionStore } from '../../store/reflectionStore';
import { ConfidenceCheck, calibrationMessage } from '../shared/ConfidenceCheck';
import {
  ComposeActivity, CollectActivity, ScaleActivity, UnitActivity, PlaceIdActivity, DecomposeActivity,
} from './PlaceValueLab';
import { CompareActivity, LineReadActivity, OrderActivity } from './NumberLineModule';
import { AddSubSimulator, AddSubMasterSimulator } from './DecimalAddSubModule';
import { Round as WordRound } from './WordProblemModule';
import { ErrorRound } from './ErrorHunterModule';
import { MulDivRound } from './MulDivRounds';
import { forceSolo } from 'learning-app-kit/sync';

interface Props {
  onExit: () => void;
  /** テストのあと「れんしゅうする」で、その項目のモジュールへ飛ぶ */
  onPractice?: (id: ModuleId) => void;
}

type Phase = 'INTRO' | 'RUN' | 'RESULT';
type Mode = '表' | '裏' | 'ぜんぶ';

const stepsForMode = (test: TestDef, mode: Mode): TestStep[] => {
  if (mode === '表') return test.steps.filter((s) => s.section === '表');
  if (mode === '裏') return test.steps.filter((s) => s.section === '裏' || s.section === '参考');
  return test.steps;
};

/** さいごに選んだテスト（端末ごとの便利機能。読めなくても動く） */
const LAST_TEST_KEY = 'syousu_last_test';
const loadLastTest = (): TestId => {
  try {
    const v = localStorage.getItem(LAST_TEST_KEY);
    return v === 'muldiv' ? 'muldiv' : 'shikumi';
  } catch { return 'shikumi'; }
};

export const MockTestModule: React.FC<Props> = ({ onExit, onPractice }) => {
  const [phase, setPhase] = useState<Phase>('INTRO');
  const [mode, setMode] = useState<Mode>('ぜんぶ');
  const [testId, setTestId] = useState<TestId>(loadLastTest);
  const test = TESTS.find((t) => t.id === testId) ?? TESTS[0]!;
  const [seed, setSeed] = useState(0); // 「もう一度」で問題を作り直す
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({}); // index -> ノーミス
  const [misses, setMisses] = useState<Record<number, number>>({});     // index -> まちがえた回数
  const [gaveUp, setGaveUp] = useState<Record<number, boolean>>({});    // index -> 「わからない」で進んだか
  const recordResult = useProgressStore((s) => s.recordResult);
  const addCalibration = useReflectionStore((s) => s.addCalibration);
  const [recorded, setRecorded] = useState(false);
  const [predicted, setPredicted] = useState<number | null>(null); // できたつもり（やる前の自己予想）

  // 選んだ範囲のステップ
  const activeSteps = useMemo<TestStep[]>(() => stepsForMode(test, mode), [test, mode]);
  // マウント（または もう一度・範囲変更）時に全問を一度だけ生成して固定
  const problems = useMemo<TestProblem[]>(() => activeSteps.map((s) => s.gen()), [activeSteps, seed]);

  const pickTest = (id: TestId) => {
    setTestId(id);
    try { localStorage.setItem(LAST_TEST_KEY, id); } catch { /* 保存できなくても動く */ }
  };
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
    setResults((r) => ({ ...r, [index]: perfect }));
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
          skillId: skillIdOf(problems[i]), misses: misses[i] ?? 0, gaveUp: !!gaveUp[i] };
      }),
    };
    // 小数のしくみは前からの記録（skillId 'mock-test'・ラベル）のまま。かけ算とわり算は 'mock-test-muldiv'
    const labelHead = test.id === 'shikumi' ? '本番テスト' : `本番テスト「${test.short}」`;
    recordResult({ moduleId: 'mock-test', skillId: test.recordSkillId, label: `${labelHead}（${mode}）${totalScore}/${totalMax}点`, correct: totalScore === totalMax, detail });
    // できたつもりチェック：予想していれば 実際（得点率）とのズレを記録（メタ認知キャリブレーション）
    if (predicted !== null && totalMax > 0) {
      addCalibration({ skillId: test.recordSkillId, predicted, actual: totalScore / totalMax });
    }
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
            <ChevronLeft size={24} /> 小数ランドへ
          </button>
          <div className="bg-surface rounded-[36px] shadow-2xl border border-line p-8 md:p-12 text-center mt-4">
            <div className="w-24 h-24 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-6"><ClipboardCheck size={44} /></div>
            <h1 className="text-3xl font-black text-content mb-2">本番テストモード</h1>
            <p className="text-muted font-bold leading-relaxed mb-3">どの テストに ちょうせんする？</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {TESTS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickTest(t.id)}
                  aria-pressed={t.id === testId}
                  className={`rounded-2xl border-2 p-4 text-left transition-all active:scale-95 ${t.id === testId ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300' : 'border-line bg-surface hover:border-blue-300'}`}
                >
                  <div className="text-lg font-black text-content">{t.title}</div>
                  <div className="text-xs font-bold text-muted mt-1">表 {t.omoteMax}点・裏 {t.uraMax}点</div>
                </button>
              ))}
            </div>
            <p className="text-muted font-bold leading-relaxed mb-2">「{test.title}」の テストに ちょうせん！</p>
            <p className="text-faint font-bold text-sm mb-6">どこに ちょうせんする？ 範囲を えらんでね。まちがえても 正しい こたえまで すすめるよ。一発で 正解できると 点が もらえるよ。</p>
            <div className="mb-6 text-left bg-surface-2 rounded-2xl border border-line p-4">
              <ConfidenceCheck value={predicted} onChange={setPredicted} label="はじめる前に：きょうは どれくらい できそう？" />
            </div>
            <div className="flex flex-wrap gap-3">
              <RangeButton m="表" title="表だけ" sub="知識・ぎのう" max={test.omoteMax} color="border-blue-300 hover:border-blue-400 bg-blue-50/40" />
              <RangeButton m="裏" title="裏だけ" sub="考える力（参考つき）" max={test.uraMax} color="border-rose-300 hover:border-rose-400 bg-rose-50/40" />
              <RangeButton m="ぜんぶ" title="表＋裏" sub="ぜんぶ通し（参考つき）" max={test.totalMax} color="border-amber-300 hover:border-amber-400 bg-amber-50/40" />
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
      const practice = practiceModuleOf(skillIdOf(problems[i]));
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
                {howTo(skillIdOf(problems[i]))}
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
              <p className="text-sm font-bold text-muted mt-1">{test.title}</p>
              <div className="text-5xl font-black text-blue-600 tabular-nums mt-2">{totalScore}<span className="text-2xl text-muted"> / {totalMax}点</span></div>
              <div className="flex justify-center gap-3 mt-3">
                {omoteMax > 0 && <span className="px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 font-black text-sm">表 {omoteScore}/{omoteMax}</span>}
                {uraMax > 0 && <span className="px-4 py-1.5 rounded-full bg-rose-50 text-rose-600 font-black text-sm">裏 {uraScore}/{uraMax}</span>}
              </div>
            </div>

            {/* できたつもり vs けっか（メタ認知キャリブレーション） */}
            {predicted !== null && totalMax > 0 && (
              <div className="rounded-2xl border border-line bg-surface-2 p-4 mb-3 text-center">
                <p className="text-xs font-black text-faint mb-1">できたつもり チェック</p>
                <p className="text-sm font-bold text-content">{calibrationMessage(predicted, totalScore / totalMax)}</p>
              </div>
            )}

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
                <p className="text-xs font-black text-faint mb-1">参考（点数なし・評価）</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-content text-sm">{activeSteps[refIndex]!.title}</span>
                  <span className={`font-black ${refPerfect ? 'text-emerald-600' : 'text-amber-500'}`}>{refPerfect ? 'A' : 'がんばろう'}</span>
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
  const scoredSteps = activeSteps.filter((s) => s.section !== '参考').length;
  const scoredDone = activeSteps.slice(0, index).filter((s) => s.section !== '参考').length;
  const progress = (index / activeSteps.length) * 100;

  const renderActivity = () => (
    <TestActivity tp={tp} onNext={advance} onResult={onResult} onMiss={onMiss} />
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
      <div className="flex-1 min-h-0" key={`${test.id}-${mode}-${seed}-${index}`}>
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
}> = ({ tp, onNext, onResult, onMiss, nextLabel = 'つぎの もんだいへ' }) => {
  const common = { onNext, onResult, onMiss, nextLabel };
  switch (tp.kind) {
    case 'decompose': return <DecomposeActivity {...common} problem={tp.p} />;
    case 'placeid': return <PlaceIdActivity {...common} problem={tp.p} level={tp.level} />;
    case 'unit': return <UnitActivity {...common} problem={tp.p} level={tp.level} />;
    case 'compose': return <ComposeActivity {...common} problem={tp.p} level={tp.level} />;
    case 'collect': return <CollectActivity {...common} problem={tp.p} level={tp.level} />;
    case 'lineRead': return <LineReadActivity {...common} problem={tp.p} level={tp.level} />;
    case 'compare': return <CompareActivity {...common} pair={tp.p} level={tp.level} />;
    case 'scale': return <ScaleActivity {...common} problem={tp.p} level={tp.level} />;
    case 'addsub': return tp.build
      ? <AddSubMasterSimulator {...common} problem={tp.p} level={tp.level} />
      : <AddSubSimulator {...common} problem={tp.p} level={tp.level} buildMode={tp.build} />;
    case 'word': return <WordRound {...common} problem={tp.p} />;
    case 'error': return <ErrorRound ex={tp.p} startStage="fix" onNext={onNext} onResult={onResult} />;
    case 'order': return <OrderActivity {...common} problem={tp.p} level={tp.level} />;
    case 'muldiv': return <MulDivRound {...common} q={tp.q} />;
  }
  return null;
};
