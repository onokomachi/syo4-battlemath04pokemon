/**
 * BattleScreen.tsx — モンスターバトル。
 *
 * 「モンスターの こうげき = 算数の問題」という作りにしてある。問題に正解すると
 * こちらの こうげきが当たり、まちがえると こちらがダメージを受ける。
 *
 * 学習アプリとしていちばん大事な「まちがえたとき」の設計:
 *   ・その場でヒントが出て、もう一度だけ挑戦できる(1回で終わりにしない)
 *   ・やり直しで正解したらダメージは半分入る(直せたことをちゃんと評価する)
 *   ・まちがえた問題は自動で復習モード(SRS)に登録される
 * 問題の見た目と採点は練習モードとまったく同じものを使う(ProblemQuestionView /
 * answerChecker)ので、モードによって答え方が変わることはない。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Problem, ProblemViewRef } from '../../types';
import type { BattleSetup, BattleResultSummary, MonsterDef } from '../../data/adventure/adventureTypes';
import { ALL_PROBLEM_SETS } from '../../data';
import { getMonster, getMonsterSprite, statsAtLevel } from '../../data/adventure/monsters';
import { ELEMENTS, getTypeMatchupLabel, getTypeMultiplier } from '../../data/adventure/elements';
import { ABILITIES, ITEMS } from '../../data/adventure/adventureTypes';
import { getNpcSprite } from '../../data/adventure/people';
import {
  useAdventureStore, getPartyMonsters, partyAttack,
} from '../../store/adventureStore';
import { checkAnswer as evaluateAnswer } from '../../utils/answerChecker';
import { generateSubtopicKeypadLayout } from '../../utils/keypadLayoutGenerator';
import { addIncorrectToSrs } from '../../services/spacedRepetitionService';
import { recordProblemLog } from '../../services/learningLogService';
import { recordAttempt } from '../../services/weaknessAnalysisService';
import ProblemQuestionView from '../ProblemQuestionView';
import ProblemAnswerPad from '../ProblemAnswerPad';
import ProblemResultDisplay from '../ProblemResultDisplay';
import FractionText from '../FractionText';
import { DialogueBox } from './ui/DialogueBox';

type Phase =
  | 'intro'        // 登場のセリフ
  | 'command'      // たたかう/ボール/どうぐ/にげる
  | 'question'     // 問題に答えている
  | 'result'       // 正誤の表示
  | 'catch'        // ボールを投げている
  | 'faint'        // 相手をたおした
  | 'win'
  | 'lose';

interface Props {
  setup: BattleSetup;
  onFinish: (result: BattleResultSummary) => void;
}

const shuffle = <T,>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5);

/** 相手モンスターのサブトピックから問題を引く。足りなければ何周でも回す。 */
const pickProblems = (subtopics: string[], count: number): Array<Problem & { subTopic: string }> => {
  const pool = subtopics.flatMap(st =>
    (ALL_PROBLEM_SETS[st] ?? []).map(p => ({ ...p, subTopic: st })),
  );
  if (pool.length === 0) return [];
  const out: Array<Problem & { subTopic: string }> = [];
  let bag = shuffle(pool);
  while (out.length < count) {
    if (bag.length === 0) bag = shuffle(pool);
    out.push(bag.pop()!);
  }
  return out;
};

const hintOf = (p: Problem | null): string | string[] | null => {
  if (!p) return null;
  const d = p.data as any;
  return d?.hint ?? null;
};

// ------------------------------------------------------------

const HpBar: React.FC<{ hp: number; max: number; label: string; level?: number; small?: boolean }> = ({
  hp, max, label, level, small,
}) => {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  const color = pct > 50 ? 'bg-emerald-400' : pct > 20 ? 'bg-amber-400' : 'bg-rose-500';
  return (
    <div className={`rounded-2xl bg-white/95 shadow-lg border-4 border-slate-800/10 ${small ? 'px-3 py-1.5' : 'px-4 py-2.5'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-black text-slate-800 ${small ? 'text-sm' : 'text-lg'}`}>{label}</span>
        {level !== undefined && (
          <span className={`font-bold text-slate-500 ${small ? 'text-[11px]' : 'text-sm'}`}>Lv.{level}</span>
        )}
      </div>
      <div className={`mt-1 w-full ${small ? 'h-2.5' : 'h-3.5'} rounded-full bg-slate-200 overflow-hidden`}>
        <div className={`h-full ${color} transition-all duration-500 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      {!small && (
        <div className="text-right text-xs font-bold text-slate-500 mt-0.5">
          {Math.max(0, Math.round(hp))} / {max}
        </div>
      )}
    </div>
  );
};

const BattleScreen: React.FC<Props> = ({ setup, onFinish }) => {
  const save = useAdventureStore(s => s.save);
  const store = useAdventureStore();

  // ---- 相手 ----
  const [oppIndex, setOppIndex] = useState(0);
  const opponents = setup.opponents;
  const oppDef: MonsterDef | undefined = getMonster(opponents[oppIndex]?.defId ?? '');
  const oppLevel = opponents[oppIndex]?.level ?? 5;
  const oppStats = oppDef ? statsAtLevel(oppDef, oppLevel) : { maxHp: 30, atk: 8 };
  const [oppHp, setOppHp] = useState(oppStats.maxHp);

  // ---- こちら ----
  const party = getPartyMonsters(save);
  const lead = party[0];
  const myAtk = partyAttack(save);
  const [hp, setHp] = useState(save.hp > 0 ? save.hp : save.maxHp);

  // ---- 進行 ----
  const [phase, setPhase] = useState<Phase>('intro');
  const [message, setMessage] = useState<string[]>([]);
  const [problems, setProblems] = useState<Array<Problem & { subTopic: string }>>([]);
  const [qIndex, setQIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [isRetry, setIsRetry] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [flash, setFlash] = useState<'none' | 'hit' | 'hurt'>('none');
  const [shakeOpp, setShakeOpp] = useState(false);
  const problemViewRef = useRef<ProblemViewRef | null>(null);
  const startedAt = useRef(Date.now());

  // とくせい(先頭の1体ぶんだけ使う。小4が把握できる量にするため)
  const ability = lead?.def.ability;
  const usedAbility = useRef({ hint: false, guard: false, first: true });
  const streak = useRef(0);

  const stats = useRef({ correct: 0, incorrect: 0, mp: 0, exp: 0 });
  const leveled = useRef<string[]>([]);
  const caught = useRef<string | undefined>(undefined);

  const subtopics = useMemo(() => {
    if (setup.subtopics?.length) return setup.subtopics;
    return opponents
      .map(o => getMonster(o.defId)?.subtopic)
      .filter((s): s is string => Boolean(s));
  }, [setup.subtopics, opponents]);

  // 相手が変わるたびに、その相手ぶんの問題を用意する
  useEffect(() => {
    const st = oppDef ? [oppDef.subtopic] : subtopics;
    setProblems(pickProblems(st.length ? st : subtopics, setup.questionsPerOpponent + 3));
    setQIndex(0);
    setOppHp(oppStats.maxHp);
    if (oppDef) store.seeMonster(oppDef.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppIndex]);

  useEffect(() => {
    const name = oppDef?.name ?? 'モンスター';
    if (setup.kind === 'wild') {
      setMessage([`やせいの ${name} が とびだしてきた！`]);
    } else if (setup.trainerLines?.length) {
      setMessage([...setup.trainerLines, `${setup.trainerName} は ${name} をくりだした！`]);
    } else {
      setMessage([`${setup.trainerName} は ${name} をくりだした！`]);
    }
    setPhase('intro');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const problem = problems[qIndex] ?? null;
  const problemData = (problem?.data ?? {}) as any;

  // マスターモード: ヒントを出さず、最後にまとめて答え合わせする自己選択モード。
  // 判定条件・データの渡し方は ProblemScreen とまったく同じ。
  const [masterModeOn, setMasterModeOn] = useState(false);
  const supportsMasterMode = ['division-hissan', 'decimal-addsub', 'decimal-muldiv', 'multiplication-hissan'].includes(
    (problemData as { guidedKind?: string } | undefined)?.guidedKind || '',
  );
  const guidedDisplayProblem = useMemo(() => {
    if (!problem || problem.type !== 'guided' || !supportsMasterMode) return problem;
    return { ...problem, data: { ...problem.data, masterMode: masterModeOn } };
  }, [problem, supportsMasterMode, masterModeOn]);
  // キーパッドは、この相手が出しうる問題ぜんぶから共通のキーを作る
  // (問題ごとにキーの位置が動くと小4が混乱するため)
  const keypadLayout = useMemo(() => {
    if (problems.length === 0) return [['0']];
    return generateSubtopicKeypadLayout(problems, problems[0]?.type || 'text');
  }, [problems]);
  const hint = hintOf(problem);

  const typeMult = useMemo(() => {
    if (!lead?.def || !oppDef) return 1;
    return getTypeMultiplier(lead.def.type, oppDef.type);
  }, [lead?.def, oppDef]);

  // ---- ダメージ計算 ----
  const damageToOpponent = (half: boolean): number => {
    let d = myAtk * 1.35 * typeMult;
    if (ability === 'power') d *= 1.3;
    if (ability === 'first' && usedAbility.current.first) {
      d *= 2;
      usedAbility.current.first = false;
    }
    if (half) d *= 0.5;
    // 相手の難易度が高いほど、少しだけタフにする
    d *= 1 - Math.min(0.25, ((oppDef?.difficulty ?? 2) - 1) * 0.05);
    return Math.max(4, Math.round(d));
  };

  const damageToPlayer = (): number => {
    if (ability === 'guard' && !usedAbility.current.guard) {
      usedAbility.current.guard = true;
      return 0;
    }
    return Math.max(3, Math.round(oppStats.atk * 0.8));
  };

  // ---- 採点 ----
  const submit = useCallback(() => {
    if (!problem || showAnswer) return;
    const correct = evaluateAnswer(userAnswer, problem.answer, {
      multiple: !!problemData?.multiple,
      requireForm: problemData?.requireForm,
    });
    setWasCorrect(correct);
    setShowAnswer(true);

    const timeSec = Math.round((Date.now() - startedAt.current) / 1000);
    recordProblemLog({
      mode: 'battle',
      subTopic: problem.subTopic,
      question: (problem.data as any)?.question ?? problem.subTopic,
      userAnswer,
      correct,
      timeSec,
    });
    recordAttempt(problem.subTopic, correct);

    if (correct) {
      stats.current.correct += 1;
      streak.current += 1;
      const dmg = damageToOpponent(isRetry);
      setOppHp(v => Math.max(0, v - dmg));
      setFlash('hit');
      setShakeOpp(true);
      window.setTimeout(() => { setFlash('none'); setShakeOpp(false); }, 520);
      // とくせい「いやし」: 2問れんぞく正解でHPが少し回復
      if (ability === 'heal' && streak.current % 2 === 0) {
        setHp(v => Math.min(save.maxHp, v + 8));
      }
    } else {
      streak.current = 0;
      if (!isRetry) {
        // 1回目のまちがい: ヒントを出してもう一度だけ挑戦させる
        stats.current.incorrect += 1;
        addIncorrectToSrs(
          problem.subTopic,
          (problem.data as any)?.question ?? problem.subTopic,
          problem.answer,
          problem.type,
        );
      }
      const dmg = damageToPlayer();
      setHp(v => Math.max(0, v - dmg));
      setFlash('hurt');
      window.setTimeout(() => setFlash('none'), 520);
    }
    setPhase('result');
  }, [problem, userAnswer, showAnswer, isRetry, ability, save.maxHp]);

  /** ガイド付き問題(筆算シミュレーターなど)は自分で正誤を返してくる */
  const handleGuidedComplete = (correct: boolean) => {
    if (showAnswer) return;
    setUserAnswer(correct ? problem?.answer ?? '' : '');
    window.setTimeout(() => {
      setWasCorrect(correct);
      setShowAnswer(true);
      if (problem) {
        recordProblemLog({
          mode: 'battle',
          subTopic: problem.subTopic,
          question: (problem.data as any)?.question ?? problem.subTopic,
          userAnswer: correct ? problem.answer : '(みちびき)',
          correct,
        });
        recordAttempt(problem.subTopic, correct);
      }
      if (correct) {
        stats.current.correct += 1;
        const dmg = damageToOpponent(false);
        setOppHp(v => Math.max(0, v - dmg));
        setFlash('hit'); setShakeOpp(true);
        window.setTimeout(() => { setFlash('none'); setShakeOpp(false); }, 520);
      } else {
        stats.current.incorrect += 1;
        if (problem) {
          addIncorrectToSrs(problem.subTopic, (problem.data as any)?.question ?? problem.subTopic, problem.answer, problem.type);
        }
        setHp(v => Math.max(0, v - damageToPlayer()));
        setFlash('hurt');
        window.setTimeout(() => setFlash('none'), 520);
      }
      setPhase('result');
    }, 350);
  };

  // ---- 次へ ----
  const proceed = () => {
    if (hp <= 0) { setPhase('lose'); return; }
    if (oppHp <= 0) { handleFaint(); return; }

    if (!wasCorrect && !isRetry) {
      // ヒントを見せて、もう一度おなじ問題に挑戦
      setIsRetry(true);
      setShowAnswer(false);
      setUserAnswer('');
      setHintOpen(true);
      setPhase('question');
      startedAt.current = Date.now();
      return;
    }
    // つぎの問題へ
    setIsRetry(false);
    setShowAnswer(false);
    setUserAnswer('');
    const next = qIndex + 1;
    if (next >= problems.length) {
      // 問題を使いきったら、相手の攻撃をしのぎきったことにして勝ち扱い
      setOppHp(0);
      handleFaint();
      return;
    }
    setQIndex(next);
    setPhase('command');
  };

  const handleFaint = () => {
    const gained = Math.round(12 + oppLevel * 3.5 + (oppDef?.difficulty ?? 2) * 4);
    stats.current.exp += gained;
    stats.current.mp += Math.round(8 + oppLevel * 1.5);
    for (const p of party) {
      const r = store.addExp(p.owned.uid, Math.round(gained / Math.max(1, party.length)));
      if (r.leveled) leveled.current.push(p.owned.uid);
    }
    setMessage([
      `${oppDef?.name ?? 'あいて'} を たおした！`,
      `けいけんちを ${gained} もらった！`,
    ]);
    setPhase('faint');
  };

  const advanceOpponent = () => {
    if (oppIndex + 1 < opponents.length) {
      setOppIndex(oppIndex + 1);
      setPhase('intro');
      const nextDef = getMonster(opponents[oppIndex + 1].defId);
      setMessage([`${setup.trainerName ?? 'あいて'} は ${nextDef?.name ?? '???'} をくりだした！`]);
    } else {
      finishWin();
    }
  };

  const finishWin = () => {
    const reward = setup.reward;
    if (reward) {
      stats.current.mp += reward.mp;
      if (reward.balls) store.addItem('ball', reward.balls);
    }
    const lines: string[] = [];
    if (setup.kind !== 'wild' && setup.trainerAfterLines?.length) {
      lines.push(...setup.trainerAfterLines);
    }
    if (reward?.mp) lines.push(`MPを ${reward.mp} もらった！`);
    if (reward?.balls) lines.push(`サンスウボールを ${reward.balls}こ もらった！`);
    setMessage(lines.length ? lines : ['バトルに かった！']);
    setPhase('win');
  };

  // ---- ボールを投げる ----
  const throwBall = (itemId: 'ball' | 'greatball') => {
    if (!oppDef || !setup.catchable) return;
    if (!store.useItem(itemId)) {
      setMessage(['ボールを もっていない…']);
      setPhase('faint');
      return;
    }
    const power = ITEMS[itemId].catchPower ?? 1;
    // HPが少ないほどつかまえやすい。失敗が続いてイヤにならないよう、成功率は高め。
    const hpRatio = oppHp / oppStats.maxHp;
    let rate = (0.42 + (1 - hpRatio) * 0.5) * power;
    if (ability === 'lucky') rate += 0.12;
    rate = Math.min(0.95, rate);
    const ok = Math.random() < rate;
    setPhase('catch');
    window.setTimeout(() => {
      if (ok) {
        store.catchMonster(oppDef.id, oppLevel);
        caught.current = oppDef.id;
        setMessage([
          `やった！ ${oppDef.name} を つかまえた！`,
          `${oppDef.name} は 「${oppDef.subtopic}」の モンスターだ。`,
        ]);
        setPhase('win');
      } else {
        setMessage([`ああっ！ ${oppDef.name} が でてきてしまった！`]);
        setHp(v => Math.max(0, v - Math.round(oppStats.atk * 0.4)));
        setPhase('faint');
      }
    }, 1400);
  };

  const useItem = (id: 'potion' | 'hintbook') => {
    if (!store.useItem(id)) return;
    if (id === 'potion') {
      setHp(v => Math.min(save.maxHp, v + 30));
      setMessage(['げんきドリンクを つかった！ HPが かいふくした。']);
      setPhase('faint');
    } else {
      setHintOpen(true);
      setPhase('question');
    }
  };

  const flee = () => {
    finish(false, true);
  };

  const finish = (won: boolean, fled = false) => {
    // バトルで減ったHPは持ちこす(かいふく所で回復する)
    store.damage(Math.max(0, save.hp - hp));
    if (stats.current.mp > 0) { /* MPは呼び出し側で progressionStore に加算する */ }
    onFinish({
      won,
      correct: stats.current.correct,
      incorrect: stats.current.incorrect,
      caughtDefId: caught.current,
      mpGained: fled ? 0 : stats.current.mp,
      expGained: stats.current.exp,
      leveledUp: leveled.current,
    });
  };

  // 相手を倒したあとの分岐(ダイアログを閉じたとき)
  const afterFaint = () => {
    if (hp <= 0) { setPhase('lose'); return; }
    if (oppHp <= 0) { advanceOpponent(); return; }
    setPhase('command');
  };

  const accent = oppDef ? ELEMENTS[oppDef.type].color : '#38bdf8';
  const oppSprite = oppDef ? getMonsterSprite(oppDef.id) : '';


  // ============================================================
  // 見た目
  // ============================================================

  const StatusBar = (
    <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-2 sm:p-3 gap-2 pointer-events-none">
      <HpBar
        hp={oppHp}
        max={oppStats.maxHp}
        label={oppDef?.name ?? 'あいて'}
        level={oppLevel}
        small
      />
      <div className="flex items-center gap-2">
        {typeMult !== 1 && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-black text-white shadow ${typeMult > 1 ? 'bg-emerald-500' : 'bg-slate-500'}`}
          >
            {typeMult > 1 ? 'こうかばつぐん' : 'いまひとつ'}
          </span>
        )}
        <HpBar hp={hp} max={save.maxHp} label="じぶん" small />
      </div>
    </div>
  );

  const Stage = (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 30%, ${accent}33, transparent 60%),
                     linear-gradient(180deg, #dff1ff 0%, #eafbe9 60%, #cfe9c8 100%)`,
      }}
    >
      {/* 足元の土俵。ここが無いと2体が空中に浮いて見える */}
      <div
        className="absolute right-[6%] top-[38%] w-[42%] max-w-[360px] aspect-[3/1] rounded-[50%] opacity-70"
        style={{ background: `radial-gradient(ellipse at center, ${accent}66 0%, ${accent}22 60%, transparent 72%)` }}
      />
      <div
        className="absolute left-[4%] bottom-[4%] w-[40%] max-w-[330px] aspect-[3/1] rounded-[50%] opacity-70"
        style={{ background: 'radial-gradient(ellipse at center, #ffffffaa 0%, #ffffff44 60%, transparent 72%)' }}
      />

      {/* 相手 */}
      <div
        className={`absolute right-[10%] top-[12%] w-[34%] max-w-[280px] transition-transform ${shakeOpp ? 'animate-bounce' : ''}`}
        style={{ filter: flash === 'hit' ? 'brightness(2.2)' : 'none' }}
      >
        <div className="relative">
          <img
            src={oppSprite}
            alt={oppDef?.name}
            className="w-full drop-shadow-2xl"
            style={{ imageRendering: 'auto' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25'; }}
          />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[70%] h-4 rounded-[50%] bg-black/20 blur-[2px]" />
        </div>
      </div>

      {/* こちらの先頭モンスター */}
      {lead && (
        <div
          className="absolute left-[8%] bottom-[6%] w-[30%] max-w-[240px]"
          style={{ filter: flash === 'hurt' ? 'brightness(0.55) saturate(0.4)' : 'none' }}
        >
          <div className="relative">
            <img
              src={getMonsterSprite(lead.def.id)}
              alt={lead.def.name}
              className="w-full drop-shadow-2xl"
              onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25'; }}
            />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[70%] h-4 rounded-[50%] bg-black/20 blur-[2px]" />
          </div>
          <div className="mt-1 text-center">
            <span className="inline-block px-3 py-0.5 rounded-full bg-white/90 text-xs font-black text-slate-700 shadow">
              {lead.def.name} Lv.{lead.owned.level}
            </span>
          </div>
        </div>
      )}

      {/* トレーナー */}
      {setup.kind !== 'wild' && setup.trainerSprite && phase === 'intro' && (
        <img
          src={getNpcSprite(setup.trainerSprite)}
          alt={setup.trainerName}
          className="absolute right-[6%] bottom-[8%] w-[26%] max-w-[210px] drop-shadow-2xl"
          onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
        />
      )}

      {flash === 'hit' && (
        <div className="absolute inset-0 bg-white/45 pointer-events-none animate-ping" />
      )}
      {flash === 'hurt' && (
        <div className="absolute inset-0 bg-rose-500/25 pointer-events-none" />
      )}
    </div>
  );

  const CommandMenu = (
    <div className="grid grid-cols-2 gap-3 p-3 sm:p-4">
      <button
        onClick={() => { setPhase('question'); startedAt.current = Date.now(); }}
        className="rounded-2xl bg-rose-500 hover:bg-rose-400 active:scale-95 transition text-white font-black text-2xl sm:text-3xl py-5 shadow-lg border-4 border-white/70"
      >
        ⚔ たたかう
        <span className="block text-xs font-bold opacity-90 mt-1">もんだいに こたえる</span>
      </button>
      <button
        onClick={() => throwBall('ball')}
        disabled={!setup.catchable || (save.items.ball ?? 0) <= 0}
        className="rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-300 disabled:text-slate-500 active:scale-95 transition text-amber-950 font-black text-2xl sm:text-3xl py-5 shadow-lg border-4 border-white/70"
      >
        ⚪ ボール
        <span className="block text-xs font-bold opacity-90 mt-1">
          {setup.catchable ? `のこり ${save.items.ball ?? 0}こ` : 'ここでは つかえない'}
        </span>
      </button>
      <button
        onClick={() => useItem('potion')}
        disabled={(save.items.potion ?? 0) <= 0}
        className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-300 disabled:text-slate-500 active:scale-95 transition text-white font-black text-xl sm:text-2xl py-4 shadow-lg border-4 border-white/70"
      >
        🧃 どうぐ
        <span className="block text-xs font-bold opacity-90 mt-1">
          げんきドリンク {save.items.potion ?? 0}こ
        </span>
      </button>
      <button
        onClick={flee}
        disabled={setup.kind !== 'wild'}
        className="rounded-2xl bg-slate-500 hover:bg-slate-400 disabled:bg-slate-300 disabled:text-slate-500 active:scale-95 transition text-white font-black text-xl sm:text-2xl py-4 shadow-lg border-4 border-white/70"
      >
        🏃 にげる
        <span className="block text-xs font-bold opacity-90 mt-1">
          {setup.kind === 'wild' ? 'フィールドに もどる' : 'しょうぶからは にげられない'}
        </span>
      </button>
    </div>
  );

  const QuestionPanel = (
    <div className="flex flex-col h-full min-h-0 bg-slate-900">
      {/* 上: この問題を出しているモンスター */}
      <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/90 border-b-2 border-white/10 shrink-0">
        <img
          src={oppSprite}
          alt=""
          className="w-12 h-12 object-contain shrink-0"
          onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-white font-black text-sm sm:text-base truncate">
            {oppDef?.name} が もんだいを だしてきた！
          </p>
          <p className="text-white/60 text-[11px] sm:text-xs truncate">
            {problem?.subTopic}
          </p>
        </div>
        {isRetry && (
          <span className="px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-xs font-black shrink-0">
            もういちど チャレンジ
          </span>
        )}
        <div className="w-28 sm:w-40 shrink-0">
          <HpBar hp={hp} max={save.maxHp} label="じぶん" small />
        </div>
      </div>

      {/* 中: iPadを横に持ったとき、左に問題・右に入力が並ぶようにする。
          縦に細長い端末では自動的に上下に積まれる。 */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row lg:gap-3 p-2 sm:p-3 text-white">
        {/* 問題 */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-slate-950/50 p-3 sm:p-4 flex items-center justify-center">
          {/* 小4が読みやすいよう、バトル中の問題文は練習モードより一回り大きくする */}
          <div className="mx-auto w-full max-w-3xl battle-question">
            <ProblemQuestionView
              currentProblem={problem}
              problemData={problemData}
              userAnswer={userAnswer}
              setUserAnswer={setUserAnswer}
              showAnswer={showAnswer}
              problemViewRef={problemViewRef}
              guidedDisplayProblem={guidedDisplayProblem}
              handleGuidedComplete={handleGuidedComplete}
              guidedKey={`${oppIndex}-${qIndex}-${isRetry}-${masterModeOn}`}
            />
          </div>
        </div>

        {/* 解答らんとキーパッド。練習モードとまったく同じ入力経路を使う。 */}
        <div className="shrink-0 lg:w-[380px] xl:w-[420px] mt-2 lg:mt-0 flex flex-col gap-2 overflow-y-auto">
          <ProblemAnswerPad
            currentProblem={problem}
            problemData={problemData}
            userAnswer={userAnswer}
            setUserAnswer={setUserAnswer}
            showAnswer={showAnswer}
            keypadLayout={keypadLayout}
            problemViewRef={problemViewRef}
            theme="battle"
            onSubmit={submit}
          />
          {/* 筆算などの「マスターモード」。練習モードと同じ切りかえを出す。 */}
          {supportsMasterMode && (
            <button
              onClick={() => setMasterModeOn(v => !v)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border-2 font-black text-sm transition ${
                masterModeOn
                  ? 'bg-amber-400 border-amber-200 text-amber-950'
                  : 'bg-slate-800 border-slate-600 text-slate-300'
              }`}
              title="ONにするとヒントなしで、最後にまとめて答え合わせします"
            >
              👑 マスターモード {masterModeOn ? 'ON' : 'OFF'}
            </button>
          )}
        </div>
      </div>

      {/* 下: 決定ボタン */}
      <div className="shrink-0 p-2 sm:p-3 bg-slate-800/90 border-t-2 border-white/10 flex items-center gap-2">
        {hint && (
          <button
            onClick={() => setHintOpen(true)}
            className="px-5 py-3 rounded-xl bg-amber-400 text-amber-950 font-black text-sm sm:text-base shadow active:scale-95 shrink-0"
          >
            💡 ヒント
          </button>
        )}
        {problem?.type !== 'guided' && (
          <button
            onClick={submit}
            disabled={showAnswer || (!userAnswer && problem?.type !== 'proof')}
            className="flex-1 py-3 sm:py-4 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-600 disabled:text-slate-400 text-white font-black text-xl sm:text-2xl shadow-lg active:scale-95 transition"
          >
            ⚔ こうげき！
          </button>
        )}
      </div>
    </div>
  );

  /**
   * 正誤の表示。まちがえたときは、練習モードとまったく同じ解説パネル
   * (ProblemResultDisplay)をそのまま出す。ここを自前の簡易表示にすると
   * 「バトルだと解説が出ない」という学習上いちばん困る差が生まれる。
   */
  const ResultOverlay = (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
      <div
        className={`w-full max-w-3xl rounded-3xl border-8 bg-white p-4 sm:p-6 shadow-2xl ${wasCorrect ? 'border-emerald-400' : 'border-rose-400'}`}
      >
        <p className={`text-3xl sm:text-4xl font-black text-center ${wasCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
          {wasCorrect ? 'せいかい！' : 'ざんねん…'}
        </p>
        <p className="mt-1 text-base sm:text-lg font-bold text-slate-700 text-center">
          {wasCorrect
            ? `${oppDef?.name} に こうげきが ヒット！`
            : isRetry
              ? 'つぎの もんだいへ いこう。'
              : 'かいせつを 見て、もういちど やってみよう！'}
        </p>
        {wasCorrect && typeMult !== 1 && (
          <p className={`mt-1 text-center text-base font-black ${typeMult > 1 ? 'text-emerald-600' : 'text-slate-500'}`}>
            {getTypeMatchupLabel(typeMult)}
          </p>
        )}

        {/* 練習モードと同じ、正解・自分の解答・解説の一覧 */}
        <div className="mt-4 max-h-[45vh] overflow-y-auto rounded-2xl bg-slate-900 p-2">
          <ProblemResultDisplay
            showAnswer={showAnswer}
            problemData={problem}
            result={wasCorrect ? 'correct' : 'incorrect'}
            userAnswer={userAnswer}
            timeTaken={null}
            score={null}
            hint={hint ?? undefined}
            hideAnswerGrid={problem?.type === 'guided'}
            getResultRingColor={() => (wasCorrect ? 'border-emerald-400' : 'border-red-500')}
          />
        </div>

        {!wasCorrect && isRetry && (
          <p className="mt-3 text-sm font-bold text-slate-500 text-center">
            この もんだいは「ふくしゅうモード」に 入れておいたよ。
          </p>
        )}
        <button
          onClick={proceed}
          className="mt-5 w-full py-4 rounded-2xl bg-slate-800 text-white font-black text-xl sm:text-2xl shadow active:scale-95"
        >
          {wasCorrect || isRetry ? 'つぎへ ▶' : 'もういちど やってみる ▶'}
        </button>
      </div>
    </div>
  );

  // 相手モンスターのとくせい・タイプを見せる小さなカード
  const InfoChip = oppDef && (
    <div className="absolute left-2 bottom-2 z-20 flex items-center gap-2">
      <span
        className="px-3 py-1 rounded-full text-white text-xs font-black shadow"
        style={{ backgroundColor: ELEMENTS[oppDef.type].color }}
      >
        {ELEMENTS[oppDef.type].icon} {ELEMENTS[oppDef.type].name}タイプ
      </span>
      {lead && (
        <span className="px-3 py-1 rounded-full bg-white/90 text-slate-700 text-xs font-black shadow">
          とくせい {ABILITIES[lead.def.ability].icon} {ABILITIES[lead.def.ability].name}
        </span>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-slate-900 flex flex-col">
      {phase === 'question' ? (
        QuestionPanel
      ) : (
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div className="relative flex-1 min-h-0">
            {Stage}
            {StatusBar}
            {InfoChip}
            {phase === 'catch' && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
                <div className="text-7xl animate-bounce">⚪</div>
              </div>
            )}
          </div>
          <div className="shrink-0 bg-slate-800">
            {phase === 'command' && CommandMenu}
          </div>
        </div>
      )}

      {phase === 'result' && ResultOverlay}

      {phase === 'intro' && (
        <DialogueBox
          lines={message}
          speaker={setup.kind === 'wild' ? undefined : setup.trainerName}
          portrait={setup.trainerSprite ? getNpcSprite(setup.trainerSprite) : undefined}
          accent={accent}
          onDone={() => setPhase('command')}
        />
      )}
      {phase === 'faint' && (
        <DialogueBox lines={message} accent={accent} onDone={afterFaint} />
      )}
      {phase === 'win' && (
        <DialogueBox
          lines={message}
          speaker={setup.kind === 'wild' ? undefined : setup.trainerName}
          portrait={setup.trainerSprite ? getNpcSprite(setup.trainerSprite) : undefined}
          accent="#22c55e"
          onDone={() => finish(true)}
        />
      )}
      {phase === 'lose' && (
        <DialogueBox
          lines={[
            'めのまえが まっくらに なった……',
            'いちばん近い かいふく所まで もどってきた。',
            'だいじょうぶ。なんども ちょうせんできるよ！',
          ]}
          accent="#f43f5e"
          onDone={() => { store.healFull(); finish(false); }}
        />
      )}

      {hintOpen && hint && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setHintOpen(false)}
        >
          <div className="w-full max-w-2xl rounded-3xl bg-white border-8 border-amber-400 p-6 shadow-2xl">
            <h3 className="text-2xl font-black text-amber-600 mb-3">💡 ヒント</h3>
            <div className="space-y-2 text-lg font-bold text-slate-700 leading-relaxed">
              {(Array.isArray(hint) ? hint : [hint]).map((h, i) => (
                <p key={i}><FractionText text={h} /></p>
              ))}
            </div>
            <button className="mt-5 w-full py-3 rounded-2xl bg-amber-400 text-amber-950 font-black text-xl">
              とじる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BattleScreen;
