// このファイルは単元アプリ syo4-kawarikatasirabe の src/components/modules/MockTestModule.tsx の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 本番テストモード。単元テストと同じ大問順・同じ配点で通しで解く。
 * 表＝知識・技能100点（5点×20問）／裏＝思考・判断・表現50点（10点×5問）。
 * 採点はノーミス完答（一発正解）のみ。結果は学習のきろくに答案の詳細つきで残す。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ClipboardCheck, Home, RotateCcw, Trophy, Check, X, HelpCircle, Lightbulb, Dumbbell } from 'lucide-react';
import { TEST_STEPS, TestStep, genStep, describeProblem, OMOTE_MAX, URA_MAX, TOTAL_MAX , howTo, practiceModuleOf } from '../../lib/testConfig';
import { KawariProblem } from '../../types';
import { useProgressStore, TestDetail, ModuleId } from '../../store/progressStore';
import { KawariRound } from '../shared/KawariRound';
import { AppShell } from '../shared/AppShell';
import { APP_NAME } from '../../constants';
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
  if (mode === '裏') return TEST_STEPS.filter((s) => s.section === '裏');
  return TEST_STEPS;
};

export const MockTestModule: React.FC<Props> = ({ onExit, onPractice }) => {
  const [phase, setPhase] = useState<Phase>('INTRO');
  const [mode, setMode] = useState<Mode>('ぜんぶ');
  const [seed, setSeed] = useState(0);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [misses, setMisses] = useState<Record<number, number>>({});     // index -> まちがえた回数
  const [gaveUp, setGaveUp] = useState<Record<number, boolean>>({});    // index -> 「わからない」で進んだか
  const [recorded, setRecorded] = useState(false);
  const recordResult = useProgressStore((s) => s.recordResult);

  const activeSteps = useMemo<TestStep[]>(() => stepsForMode(mode), [mode]);
  // 開始時（および「もう一度」）に 全問を一度だけ生成して固定する
  const problems = useMemo<KawariProblem[]>(() => activeSteps.map((s) => genStep(s)), [activeSteps, seed]);

  const start = (m: Mode) => {
    // 本番テストは実力を測る場面。ペア（1台を2人）のままなら、ここでソロに切り替える
    forceSolo();
    setMode(m); setIndex(0); setResults({}); setMisses({}); setGaveUp({}); setRecorded(false); setPhase('RUN');
  };
  const restart = () => {
    // 本番テストは実力を測る場面。ペア（1台を2人）のままなら、ここでソロに切り替える
    forceSolo();
    setSeed((s) => s + 1); setIndex(0); setResults({}); setMisses({}); setGaveUp({}); setRecorded(false); setPhase('RUN');
  };

  const onAnswered = (perfect: boolean) => {
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

  /* ---------------- 採点 ---------------- */
  const detail: TestDetail = useMemo(() => {
    let omote = 0, ura = 0, omoteMax = 0, uraMax = 0;
    const steps = activeSteps.map((s, i) => {
      const ok = !!results[i];
      const earned = ok ? s.points : 0;
      if (s.section === '表') { omoteMax += s.points; omote += earned; }
      else { uraMax += s.points; ura += earned; }
      const d = describeProblem(problems[i]);
      return {
        daimon: s.daimon, sub: s.sub, title: s.title, section: s.section,
        q: d.q, a: d.a, points: s.points, earned, correct: ok,
        // 記号を残す。これが無いと「どの種類の問題が学級全体で弱いか」が出せない
        skillId: problems[i].skillId, misses: misses[i] ?? 0, gaveUp: !!gaveUp[i],
      };
    });
    return {
      mode, omoteScore: omote, omoteMax, uraScore: ura, uraMax,
      total: omote + ura, totalMax: omoteMax + uraMax, steps,
    };
  }, [activeSteps, problems, results, mode, misses, gaveUp]);

  // 結果画面に入ったときに 1回だけ きろくする（レンダー中に store を書きかえない）
  useEffect(() => {
    if (phase !== 'RESULT' || recorded) return;
    setRecorded(true);
    recordResult({
      moduleId: 'mock-test',
      skillId: 'mock-test',
      label: `本番テスト（${mode}） ${detail.total}/${detail.totalMax}点`,
      correct: detail.total === detail.totalMax,
      detail,
    });
  }, [phase, recorded, recordResult, mode, detail]);

  /* ---------------- INTRO ---------------- */
  if (phase === 'INTRO') {
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={onExit} className="flex items-center gap-2 text-muted hover:text-content font-bold px-3 py-2 rounded-xl hover:bg-surface-3 transition-colors mb-4">
            <ChevronLeft size={24} /> {APP_NAME}へ
          </button>

          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck size={44} />
            </div>
            <h1 className="text-3xl font-black text-content mb-2">本番テストモード</h1>
            <p className="text-muted font-bold">「変わり方調べ」の 単元テストと 同じ 形で ちょうせん！</p>
            <p className="text-sm text-faint font-bold mt-2">一発で 正かいしたときだけ 点に なります。ヒントは 出ません。</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {([
              { m: '表' as Mode, title: '表（知識・技能）', desc: `5点 × ${TEST_STEPS.filter((s) => s.section === '表').length}問 ＝ ${OMOTE_MAX}点`, cls: 'from-blue-500 to-indigo-500' },
              { m: '裏' as Mode, title: '裏（思考・判断・表現）', desc: `10点 × ${TEST_STEPS.filter((s) => s.section === '裏').length}問 ＝ ${URA_MAX}点`, cls: 'from-violet-500 to-fuchsia-500' },
              { m: 'ぜんぶ' as Mode, title: 'ぜんぶ（表＋裏）', desc: `${TEST_STEPS.length}問 ＝ ${TOTAL_MAX}点`, cls: 'from-emerald-500 to-teal-500' },
            ]).map((o) => (
              <motion.button
                key={o.m} whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} onClick={() => start(o.m)}
                className={`w-full p-5 rounded-[24px] bg-gradient-to-r ${o.cls} text-white shadow-lg text-left`}
              >
                <div className="text-xl font-black">{o.title}</div>
                <div className="text-sm text-white/85 font-medium">{o.desc}</div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- RESULT ---------------- */
  if (phase === 'RESULT') {
    const rate = detail.totalMax > 0 ? detail.total / detail.totalMax : 0;
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center mx-auto mb-3">
              <Trophy size={44} />
            </div>
            <h1 className="text-3xl font-black text-content">{detail.total} / {detail.totalMax} 点</h1>
            <p className="text-muted font-bold mt-1">
              {rate === 1 ? '満点！ すばらしい！' : rate >= 0.8 ? 'よく できました！' : 'まちがえた ところが のびしろだよ。'}
            </p>
            <div className="flex justify-center gap-3 mt-3 text-sm font-black">
              {detail.omoteMax > 0 && <span className="px-4 py-1.5 rounded-full bg-blue-100 text-blue-700">表 {detail.omoteScore}/{detail.omoteMax}</span>}
              {detail.uraMax > 0 && <span className="px-4 py-1.5 rounded-full bg-violet-100 text-violet-700">裏 {detail.uraScore}/{detail.uraMax}</span>}
            </div>
          </div>

          {detail.steps.some((s) => !s.correct) && (
            <div className="rounded-2xl bg-surface-2 border border-line p-4 mb-4 text-center">
              <p className="font-black text-content text-sm">まちがえた ところに やり方を つけたよ</p>
              <p className="text-xs text-muted font-bold mt-1">
                下を 見て、「れんしゅうする」から やり直そう。まちがいは 学びの たからもの！
              </p>
            </div>
          )}

          <div className="bg-surface border border-line rounded-3xl divide-y divide-[var(--color-line)] mb-6 overflow-hidden">
            {/* まちがえた問題にだけ「やり方」を添える。
                できた問題にも解説を並べると、見るべきところが埋もれる */}
            {detail.steps.map((s, i) => {
              const practice = s.skillId ? practiceModuleOf(s.skillId) : null;
              return (
                <div key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${s.correct ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                      {s.correct ? <Check size={18} /> : <X size={18} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-faint">{s.sub} {s.title}（{s.section}・{s.points}点）</p>
                      <p className="text-sm font-bold text-content">{s.q}</p>
                      <p className="text-sm font-bold text-emerald-700">こたえ: {s.a}</p>
                    </div>
                  </div>
                  {!s.correct && (
                    <div className="mt-2 ml-11 rounded-2xl bg-amber-50 border border-amber-200 p-3">
                      <p className="flex items-start gap-1.5 text-sm font-bold text-amber-900 leading-relaxed">
                        <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        {howTo(s.skillId ?? '')}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {s.gaveUp && <span className="text-xs font-bold text-amber-700">「わからない」で つぎへ すすんだ問題</span>}
                        {!s.gaveUp && (s.misses ?? 0) >= 2 && <span className="text-xs font-bold text-amber-700">2回まちがえた問題</span>}
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
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={restart} className="py-4 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
              <RotateCcw size={20} /> もう一度
            </button>
            <button onClick={onExit} className="py-4 rounded-2xl bg-surface border-2 border-line text-content font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
              <Home size={20} /> ホームへ
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- RUN ---------------- */
  const step = activeSteps[index];
  return (
    <AppShell
      title="本番テストモード"
      subtitle={`${step.sub} ${step.title}（${step.points}点）`}
      onBack={onExit}
    >
      <div className="h-full flex flex-col">
        <div className="h-2 bg-surface-3 shrink-0">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${((index + 1) / activeSteps.length) * 100}%` }} />
        </div>
        <div className="px-4 py-2 flex items-center justify-center gap-2 shrink-0">
          {/* あと何回まちがえられるか。黙って×になると、何が起きたか分からない */}
          {(misses[index] ?? 0) > 0 && (
            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-500 text-xs font-black">
              あと{Math.max(0, 2 - (misses[index] ?? 0))}回
            </span>
          )}
          <span className="text-sm font-black text-muted">第 {index + 1} 問 / {activeSteps.length}</span>
          <button
            onClick={giveUp}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-line text-muted
                       hover:text-content hover:border-faint font-bold text-sm transition-colors"
          >
            <HelpCircle size={16} /> わからない
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <KawariRound
            key={`${seed}-${index}`}
            problem={problems[index]}
            testMode
            onAnswered={onAnswered}
            onMissed={onMiss}
            onNext={advance}
            nextLabel={index < activeSteps.length - 1 ? 'つぎの もんだいへ' : 'けっかを 見る'}
          />
        </div>
      </div>
    </AppShell>
  );
};
