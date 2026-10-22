/**
 * CpuPartyDuel.tsx — モンスター対戦（パーティ・HPあり）をコンピュータと
 *
 * きまりはクラス対戦と同じ（data/partyDuel.ts）。コンピュータのパーティは、きみのパーティと同じ単元の
 * モンスターを、同じくらいのレベルで。コンピュータは「ふつう」の子くらいの正しさ・速さで答える。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpeedProblem } from '../../types';
import { MONSTER_DEX } from '../../data/adventure/monsters';
import { PARTY_DUEL, cpuParty, resolveTurn, turnSubtopic, type DuelMon, type DuelSide, type TurnAnswer } from '../../data/partyDuel';
import PartyDuelBoard, { type BoardTurn, type PartyPhase } from './PartyDuelBoard';
import { isDuelAnswerCorrect, problemFor } from './duelProblems';

/** コンピュータの答え方（ふつうの子くらい） */
const CPU = { acc: 0.72, sec: [9, 22] as const };
const COUNTDOWN_MS = 1500;
const RESULT_MS = 2800;

export interface CpuPartyDuelProps {
  party: DuelMon[];
  onRecord: (problem: SpeedProblem, answer: string, isCorrect: boolean) => void;
  onFinish: (result: 'win' | 'lose' | 'draw', myCorrect: number) => void;
  onExit: () => void;
}

const CpuPartyDuel: React.FC<CpuPartyDuelProps> = ({ party, onRecord, onFinish, onExit }) => {
  const topic = useMemo(() => `cpu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, []);
  const [me, setMe] = useState<DuelSide>(() => ({ party, active: 0, miss: 0 }));
  const [cpu, setCpu] = useState<DuelSide>(() => ({
    party: cpuParty(party, MONSTER_DEX.filter((m) => m.subtopic)), active: 0, miss: 0,
  }));
  const [turn, setTurn] = useState(1);
  const [phase, setPhase] = useState<PartyPhase>('countdown');
  const [myAnswer, setMyAnswer] = useState<TurnAnswer | null>(null);
  const [cpuAnswer, setCpuAnswer] = useState<TurnAnswer | null>(null);
  const [lastTurn, setLastTurn] = useState<BoardTurn | null>(null);
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startRef = useRef(0);
  const resolvedRef = useRef(0);
  const correctRef = useRef(0);

  const subtopic = turnSubtopic(turn, me, cpu);
  const problem = useMemo(() => problemFor(topic, subtopic, turn), [topic, subtopic, turn]);

  // ターンのはじまり：カウントダウン → 答える時間（コンピュータも答えを用意する）
  useEffect(() => {
    if (result) return;
    setPhase('countdown'); setMyAnswer(null); setCpuAnswer(null);
    const t1 = setTimeout(() => {
      startRef.current = Date.now();
      setPhase('answering');
    }, COUNTDOWN_MS);
    const sec = CPU.sec[0] + Math.random() * (CPU.sec[1] - CPU.sec[0]);
    const t2 = setTimeout(() => {
      setCpuAnswer({ correct: Math.random() < CPU.acc, at: sec * 1000 });
    }, COUNTDOWN_MS + sec * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [turn, result]);

  useEffect(() => {
    if (phase !== 'answering') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

  const timeLeft = Math.max(0, Math.ceil((startRef.current + PARTY_DUEL.turnSeconds * 1000 - now) / 1000));

  const resolve = useCallback(() => {
    if (resolvedRef.current === turn) return;
    resolvedRef.current = turn;
    const r = resolveTurn(turn, me, cpu, myAnswer, cpuAnswer);
    setLastTurn({
      myHit: r.hostHit, oppHit: r.guestHit, myKo: r.hostKo, oppKo: r.guestKo,
      myCorrect: myAnswer ? myAnswer.correct : null, oppCorrect: cpuAnswer ? cpuAnswer.correct : null,
      myDefId: me.party[me.active]?.defId ?? null, oppDefId: cpu.party[cpu.active]?.defId ?? null,
    });
    setMe(r.host); setCpu(r.guest);
    setPhase('turn_result');
    setTimeout(() => {
      if (r.winner) {
        const res = r.winner === 'draw' ? 'draw' : r.winner === 'host' ? 'win' : 'lose';
        setResult(res);
        setPhase('match_over');
        onFinish(res, correctRef.current);
      } else {
        setTurn((t) => t + 1);
      }
    }, RESULT_MS);
  }, [turn, me, cpu, myAnswer, cpuAnswer, onFinish]);

  // 2人とも答えた・時間切れ で結果へ
  useEffect(() => {
    if (phase !== 'answering') return;
    if ((myAnswer && cpuAnswer) || timeLeft <= 0) resolve();
  }, [phase, myAnswer, cpuAnswer, timeLeft, resolve]);

  const onAnswer = (answer: string) => {
    if (!problem || phase !== 'answering' || myAnswer) return;
    const ok = isDuelAnswerCorrect(problem, answer);
    if (ok) correctRef.current += 1;
    onRecord(problem, answer, ok);
    setMyAnswer({ correct: ok, at: Date.now() - startRef.current });
  };

  return (
    <PartyDuelBoard
      my={{ label: 'きみ', party: me.party, active: me.active }}
      opp={{ label: 'コンピュータ', party: cpu.party, active: cpu.active }}
      phase={phase}
      turn={turn}
      problem={problem}
      fieldOwner={turn % 2 === 1 ? 'mine' : 'theirs'}
      isPlayerAnswered={!!myAnswer}
      isOpponentAnswered={!!cpuAnswer}
      timeLeft={timeLeft}
      timeLimit={PARTY_DUEL.turnSeconds}
      lastTurn={lastTurn}
      myMiss={me.miss}
      result={result}
      resultNote={<>せいかい {correctRef.current}もん。せいかいした もんだいの モンスターが そだつよ</>}
      onAnswer={onAnswer}
      onExit={onExit}
    />
  );
};

export default CpuPartyDuel;
