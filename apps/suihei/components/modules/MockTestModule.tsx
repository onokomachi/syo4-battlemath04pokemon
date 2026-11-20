// このファイルは単元アプリ syo4-suityoku-heikotosikakkei の src/components/modules/MockTestModule.tsx の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 本番テストモード。単元テストと同じ大問順・同じ問題数で通しで解く。
 * 開始前に 表だけ / 裏だけ / 表＋裏（ぜんぶ）の範囲を選べる。
 *
 * 練習と同じ GeoRound を testMode で使うので、練習で解ける問題は必ずテストにも出せる。
 * testMode ではヒントを出さない（測る場面なので足場をかけない）、
 * 1回の解答で確定する（一発正解を採点する）という2点だけが練習と違う。
 * 表=知識技能100点 / 裏=思考判断表現50点。結果は学習のきろくに詳細つきで残す。
 */
import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ClipboardCheck, Home, RotateCcw, Trophy, HelpCircle, Lightbulb, Dumbbell } from 'lucide-react';
import { TEST_STEPS, TestStep, OMOTE_MAX, URA_MAX, generateTestProblem , howTo, practiceModuleOf } from '../../lib/testConfig';
import { GeoProblem } from '../../lib/problemTypes';
import { useProgressStore, TestDetail, ModuleId } from '../../store/progressStore';
import { GeoRound } from '../shared/GeoRound';
import { APP_SUBTITLE } from '../../constants';
import { forceSolo } from 'learning-app-kit/sync';

interface Props {
  onExit: () => void;
  /** テストのあと「れんしゅうする」で、その項目のモジュールへ飛ぶ */
  onPractice?: (id: ModuleId) => void;
}

type Phase = 'INTRO' | 'RUN' | 'RESULT';
type Mode = '表' | '裏' | 'ぜんぶ';

const TOTAL_MAX = OMOTE_MAX + URA_MAX;

const stepsForMode = (mode: Mode): TestStep[] => {
  if (mode === '表') return TEST_STEPS.filter((s) => s.section === '表');
  if (mode === '裏') return TEST_STEPS.filter((s) => s.section === '裏');
  return TEST_STEPS;
};

/** 答案の記録に残す「問題」と「正しい答え」の文字列。 */
function describe(p: GeoProblem): { q: string; a: string } {
  const q = p.prompt.replace(/\*\*/g, '').replace(/\n/g, ' ');
  const a = p.answer;
  let ans = '';
  switch (a.kind) {
    case 'choice':
      ans = a.choices[a.correct];
      break;
    case 'multi':
      ans = a.correct.map((i) => a.choices[i]).join('・');
      break;
    case 'name':
      ans = a.correct;
      break;
    case 'number':
      ans = `${a.correct}${a.unit}`;
      break;
    case 'pairs':
      ans = a.correct.map(([x, y]) => `（${a.symbols[x]}と${a.symbols[y]}）`).join('');
      break;
    case 'order':
      ans = a.correct.map((i) => a.steps[i]).join(' → ');
      break;
    case 'gridDraw':
      ans = a.accept[0].map((p2) => `(${p2.x},${p2.y})`).join(' ');
      break;
    case 'truth':
      ans = a.rows.map((r) => `${r.label}：${r.correct ? '○' : '×'}`).join(' / ');
      break;
    case 'errorFix':
      ans = a.fixChoices[a.fixIndex];
      break;
    default:
      ans = '';
  }
  return { q, a: ans.replace(/\*\*/g, '') };
}

export const MockTestModule: React.FC<Props> = ({ onExit, onPractice }) => {
  const [phase, setPhase] = useState<Phase>('INTRO');
  const [mode, setMode] = useState<Mode>('ぜんぶ');
  const [seed, setSeed] = useState(0); // 「もう一度」で問題を作り直す
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [gaveUp, setGaveUp] = useState<Record<number, boolean>>({});    // index -> 「わからない」で進んだか
  const recordResult = useProgressStore((s) => s.recordResult);
  const [recorded, setRecorded] = useState(false);

  const activeSteps = useMemo<TestStep[]>(() => stepsForMode(mode), [mode]);
  // 範囲を決めた時点で全問を一度だけ生成して固定する（再描画で問題が変わらないように）
  const problems = useMemo<GeoProblem[]>(() => activeSteps.map((s) => generateTestProblem(s)), [activeSteps, seed]);

  const choose = (m: Mode) => {
    // 本番テストは実力を測る場面。ペア（1台を2人）のままなら、ここでソロに切り替える
    forceSolo();
    setMode(m);
    setIndex(0);
    setResults({}); setGaveUp({});
    setRecorded(false);
    setPhase('RUN');
  };
  const restart = () => {
    // 本番テストは実力を測る場面。ペア（1台を2人）のままなら、ここでソロに切り替える
    forceSolo();
    setSeed((s) => s + 1);
    setIndex(0);
    setResults({}); setGaveUp({});
    setRecorded(false);
    setPhase('RUN');
  };

  const onAnswered = (correct: boolean) => {
    setResults((r) => (index in r ? r : { ...r, [index]: correct }));
  };

  const advance = () => {
    if (index < activeSteps.length - 1) setIndex((i) => i + 1);
    else setPhase('RESULT');
  };

  /**
   * 「わからない」。
   *
   * このアプリのテストは1回答えたら確定するので、回数で打ち切る必要はない。
   * ただし作図の問題は「何も描けない」ことがあり、そのままでは答えを確定できず
   * 先に進めない。分からない問題で止まらずに最後まで終えられるようにする。
   */
  const giveUp = () => {
    const at = index;
    setResults((r) => (at in r ? r : { ...r, [at]: false }));
    setGaveUp((g) => ({ ...g, [at]: true }));
    advance();
  };


  const earnedAt = (i: number) => (results[i] ? activeSteps[i].points : 0);
  const omoteMax = activeSteps.filter((s) => s.section === '表').reduce((a, s) => a + s.points, 0);
  const uraMax = activeSteps.filter((s) => s.section === '裏').reduce((a, s) => a + s.points, 0);
  const totalMax = omoteMax + uraMax;
  const omoteScore = activeSteps.reduce((a, s, i) => a + (s.section === '表' ? earnedAt(i) : 0), 0);
  const uraScore = activeSteps.reduce((a, s, i) => a + (s.section === '裏' ? earnedAt(i) : 0), 0);
  const totalScore = omoteScore + uraScore;

  // 結果画面に入ったら1回だけ詳細つきで記録
  if (phase === 'RESULT' && !recorded) {
    const detail: TestDetail = {
      mode,
      omoteScore,
      omoteMax,
      uraScore,
      uraMax,
      total: totalScore,
      totalMax,
      steps: activeSteps.map((s, i) => {
        const d = describe(problems[i]);
        return {
          daimon: s.daimon,
          sub: s.sub,
          title: s.title,
          section: s.section,
          q: d.q,
          a: d.a,
          points: s.points,
          earned: earnedAt(i),
          correct: !!results[i],
          // 記号を残す。これが無いと「どの種類の問題が学級全体で弱いか」が出せない
          skillId: problems[i].skillId, gaveUp: !!gaveUp[i],
        };
      }),
    };
    recordResult({
      moduleId: 'mock-test',
      skillId: 'mock-test',
      label: `本番テスト（${mode}）${totalScore}/${totalMax}点`,
      correct: totalScore === totalMax,
      detail,
    });
    setRecorded(true);
  }

  /* ---------------- INTRO ---------------- */
  if (phase === 'INTRO') {
    const RangeButton: React.FC<{ m: Mode; title: string; sub: string; max: number; color: string }> = ({ m, title, sub, max, color }) => (
      <button
        onClick={() => choose(m)}
        className={`flex-1 min-w-[8rem] rounded-2xl border-2 ${color} p-5 text-left transition-all active:scale-95 hover:shadow-lg`}
      >
        <div className="text-xl font-black text-content">{title}</div>
        <div className="text-sm font-bold text-muted mt-0.5">{sub}</div>
        <div className="text-2xl font-black tabular-nums mt-2">
          {max}
          <span className="text-base text-muted">点</span>
        </div>
      </button>
    );
    return (
      <div className="w-full h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button
            onClick={onExit}
            className="flex items-center gap-2 text-muted hover:text-content font-bold px-3 py-2 rounded-xl hover:bg-surface-3 transition-colors mb-2"
          >
            <ChevronLeft size={24} /> ホームへ
          </button>
          <div className="bg-surface rounded-[36px] shadow-2xl border border-line p-8 md:p-12 text-center mt-4">
            <div className="w-24 h-24 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-6">
              <ClipboardCheck size={44} />
            </div>
            <h1 className="text-3xl font-black text-content mb-2">本番テストモード</h1>
            <p className="text-muted font-bold leading-relaxed mb-2">「{APP_SUBTITLE}」の テストに ちょうせん！</p>
            <p className="text-faint font-bold text-sm mb-6">
              どこに ちょうせんする？ 範囲を えらんでね。テストでは ヒントは 出ないよ。一発で 正解できると 点が もらえるよ。
            </p>
            <div className="flex flex-wrap gap-3">
              <RangeButton m="表" title="表だけ" sub="知識・ぎのう" max={OMOTE_MAX} color="border-blue-300 hover:border-blue-400 bg-blue-50/40" />
              <RangeButton m="裏" title="裏だけ" sub="考える力" max={URA_MAX} color="border-rose-300 hover:border-rose-400 bg-rose-50/40" />
              <RangeButton m="ぜんぶ" title="表＋裏" sub="ぜんぶ通し" max={TOTAL_MAX} color="border-amber-300 hover:border-amber-400 bg-amber-50/40" />
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
     * 1行＝1つの設問。**まちがえた問題にだけ「やり方」を添える。**
     * できた問題にも解説を並べると、見るべきところが埋もれる。
     */
    const Row: React.FC<{ s: TestStep; i: number }> = ({ s, i }) => {
      const d = describe(problems[i]);
      const ok = !!results[i];
      const skill = problems[i].skillId;
      const practice = practiceModuleOf(skill);
      return (
        <div className="py-2 border-b border-line/60 last:border-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="font-bold text-content text-sm">大問{s.daimon}{s.sub}　{s.title}</span>
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
                {howTo(skill)}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {gaveUp[i] && <span className="text-xs font-bold text-amber-700">「わからない」で つぎへ すすんだ問題</span>}
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
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-50 text-amber-500 mb-3"
              >
                <Trophy size={40} />
              </motion.div>
              <h1 className="text-2xl font-black text-content">テスト けっか（{mode}）</h1>
              <div className="text-5xl font-black text-blue-600 tabular-nums mt-2">
                {totalScore}
                <span className="text-2xl text-muted"> / {totalMax}点</span>
              </div>
              <div className="flex justify-center gap-3 mt-3">
                {omoteMax > 0 && (
                  <span className="px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 font-black text-sm">
                    表 {omoteScore}/{omoteMax}
                  </span>
                )}
                {uraMax > 0 && (
                  <span className="px-4 py-1.5 rounded-full bg-rose-50 text-rose-600 font-black text-sm">
                    裏 {uraScore}/{uraMax}
                  </span>
                )}
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
                {omoteSteps.map(({ s, i }) => (
                  <Row key={i} s={s} i={i} />
                ))}
              </div>
            )}
            {uraSteps.length > 0 && (
              <div className="rounded-2xl border border-line p-4 mb-6">
                <p className="text-xs font-black text-rose-500 mb-2">裏・思考はんだん表現</p>
                {uraSteps.map(({ s, i }) => (
                  <Row key={i} s={s} i={i} />
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={restart}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95"
              >
                <RotateCcw size={20} /> もう一度
              </button>
              <button
                onClick={() => setPhase('INTRO')}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface border-2 border-line text-content rounded-2xl font-black text-lg hover:bg-surface-2 transition-all active:scale-95"
              >
                範囲をえらぶ
              </button>
              <button
                onClick={onExit}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface border-2 border-line text-content rounded-2xl font-black text-lg hover:bg-surface-2 transition-all active:scale-95"
              >
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
  const progress = (index / activeSteps.length) * 100;
  const sectionColor = step.section === '表' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-600';

  return (
    <div className="w-full h-full flex flex-col bg-bg">
      {/* テスト用ヘッダ（得点は隠す） */}
      <div className="shrink-0 border-b border-line bg-surface/80 backdrop-blur px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1 text-muted hover:text-content font-bold px-2 py-1.5 rounded-lg hover:bg-surface-3 transition-colors shrink-0"
          >
            <ChevronLeft size={20} /> やめる
          </button>
          <span className={`px-3 py-1 rounded-full text-xs font-black shrink-0 ${sectionColor}`}>{step.section}</span>
          <div className="font-black text-content truncate">
            大問{step.daimon}
            {step.sub}　<span className="text-muted font-bold">{step.title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={giveUp}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-line text-muted
                         hover:text-content hover:border-faint font-bold text-sm transition-colors"
            >
              <HelpCircle size={16} /> わからない
            </button>
            <span className="text-sm font-black text-muted tabular-nums">
              {index + 1} / {activeSteps.length}問
            </span>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-2 h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* 本体（設問ごとに remount して内部状態をリセット） */}
      <div className="flex-1 min-h-0" key={`${mode}-${seed}-${index}`}>
        <GeoRound
          problem={problems[index]}
          testMode
          onAnswered={onAnswered}
          onNext={advance}
          nextLabel="つぎの もんだいへ"
        />
      </div>
    </div>
  );
};
