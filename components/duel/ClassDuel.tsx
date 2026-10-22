/**
 * ClassDuel.tsx — クラス対戦（同じ学級の2人が、つかまえたモンスターの問題で早押し）
 *
 * へやの一覧 → 相手を待つ → 対戦、の3つの画面。対戦画面は CPU 戦と同じ SpeedDuelBoard を使う。
 * 勝ち負け・時間・ラウンドの進みは、すべてサーバ（services/duel.ts）が決めた値で表示する
 * （端末の時計は、サーバの時刻とのずれを直してから使う）。
 *
 * 1ラウンドの問題は「そのラウンドのモンスターの分野」から、2人が同じ番号を選ぶ（pickIndex）。
 * アプリと同じ答え方の問題は数字が出るたびに変わるので「同じレベル・ちがう数字」になる。
 * 順位表は作らない（子どもに個人の順位を見せない、の決まり）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BattleFormat, SpeedProblem } from '../../types';
import { CARD_DEFINITIONS } from '../../constants';
import { getMonster, getMonsterSprite } from '../../data/adventure/monsters';
import { checkAnswer } from '../../utils/answerChecker';
import SpeedDuelBoard from '../SpeedDuelBoard';
import { BackIcon } from '../Icons';
import {
  duelApi, joinSignal, clockOffset, pickIndex,
  type DuelFormat, type DuelLobby, type DuelView,
} from '../../services/duel';

const ROUND_SECONDS = 45;
/** ラウンドの結果を見せる時間（サーバは結果のあと4秒で次のラウンドを始める。残りの1.5秒はカウントダウン） */
const RESULT_MS = 2500;
const POLL_MS = 2000;
const LOBBY_POLL_MS = 3000;

export interface ClassDuelProps {
  studentId: string;
  myNumber: number;
  monsterIds: string[];
  format: BattleFormat;
  onExit: () => void;
  /** 1問答えるたび（学習の記録・弱点・ふくしゅうへ） */
  onRecord: (problem: SpeedProblem, answer: string, isCorrect: boolean) => void;
  /** 対戦が終わったとき1回だけ（ごほうび） */
  onFinish: (result: 'win' | 'lose' | 'draw', myCorrect: number) => void;
  /** スタミナが変わったとき（ステータスの表示を読みなおす） */
  onStaminaChanged: () => void;
}

const toDuelFormat = (f: BattleFormat): DuelFormat => (f === 'best_of_3' ? 'best_of_3' : 'best_of_5');
const subtopicsOf = (ids: string[]) => ids.map((id) => getMonster(id)?.subtopic ?? '');
const monsterView = (id?: string | null) => {
  const m = id ? getMonster(id) : undefined;
  return m ? { name: m.name, sprite: getMonsterSprite(m.id) } : null;
};

/** ラウンドの問題（2人が同じものを選ぶ） */
function problemFor(topic: string, subtopic: string, round: number): SpeedProblem | null {
  const pool = CARD_DEFINITIONS.filter((c) => c.category === subtopic);
  if (pool.length === 0) return null;
  const card = pool[pickIndex(topic, subtopic, round, pool.length)]!;
  return { ...card.problem, category: card.category, difficulty: card.difficulty };
}

const ClassDuel: React.FC<ClassDuelProps> = ({
  studentId, myNumber, monsterIds, format, onExit, onRecord, onFinish, onStaminaChanged,
}) => {
  const [lobby, setLobby] = useState<DuelLobby | null>(null);
  const [view, setView] = useState<DuelView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [pendingRound, setPendingRound] = useState(0);
  const signalRef = useRef<{ ping: () => void; leave: () => void } | null>(null);
  const lobbySignalRef = useRef<{ ping: () => void; leave: () => void } | null>(null);
  const finishedRef = useRef<string | null>(null);
  const answeringStartRef = useRef<number>(0);
  const duelFormat = toDuelFormat(format);

  const accept = useCallback((v: DuelView, sentAt: number) => {
    setOffset(clockOffset(v, (sentAt + Date.now()) / 2));
    setView(v);
  }, []);

  // ---- へやの一覧 ----
  const loadLobby = useCallback(async () => {
    try {
      const l = await duelApi.list(studentId);
      setLobby(l);
      // 続きの部屋があれば戻る（まちがえて閉じた・リロードした）
      if (l.mine) setView((cur) => cur ?? l.mine);
    } catch (e) { setError((e as Error).message); }
  }, [studentId]);

  useEffect(() => {
    if (view) return;
    void loadLobby();
    const t = setInterval(() => { void loadLobby(); }, LOBBY_POLL_MS);
    return () => clearInterval(t);
  }, [view, loadLobby]);

  useEffect(() => {
    if (!lobby?.lobby) return;
    const s = joinSignal(lobby.lobby, () => { void loadLobby(); });
    lobbySignalRef.current = s;
    return () => { s.leave(); lobbySignalRef.current = null; };
  }, [lobby?.lobby, loadLobby]);

  // ---- 対戦の部屋 ----
  const refresh = useCallback(async () => {
    if (!view) return;
    const sentAt = Date.now();
    try { accept(await duelApi.state(studentId, view.id), sentAt); } catch (e) { setError((e as Error).message); }
  }, [view?.id, studentId, accept]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!view?.topic) return;
    const s = joinSignal(view.topic, () => { void refresh(); });
    signalRef.current = s;
    return () => { s.leave(); signalRef.current = null; };
  }, [view?.topic, refresh]);

  // 合図が届かない回線でも進むように、数秒ごとにも読む（「まだいるよ」の知らせも兼ねる）
  useEffect(() => {
    if (!view || view.status === 'finished') return;
    const t = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(t);
  }, [view?.id, view?.status, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // 画面の切りかえ（カウントダウン・時間）のための時計
  useEffect(() => {
    if (!view || view.status !== 'playing') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [view?.status, view?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 待っている部屋が閉じた（やめた・放置で片付いた）ら、へやの一覧にもどる
  useEffect(() => {
    if (view?.status === 'finished' && !view.winner) setView(null);
  }, [view?.status, view?.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  // 終わったら1回だけ ごほうび
  useEffect(() => {
    if (!view || view.status !== 'finished' || !view.winner || finishedRef.current === view.id) return;
    finishedRef.current = view.id;
    const result = view.winner === 'draw' ? 'draw' : view.winner === view.role ? 'win' : 'lose';
    onFinish(result, view.my_correct);
  }, [view, onFinish]);

  const create = async () => {
    setBusy(true); setError(null);
    const sentAt = Date.now();
    try {
      accept(await duelApi.create(studentId, monsterIds, subtopicsOf(monsterIds), duelFormat), sentAt);
      lobbySignalRef.current?.ping();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const join = async (duelId: string) => {
    setBusy(true); setError(null);
    const sentAt = Date.now();
    try {
      const v = await duelApi.join(studentId, duelId, monsterIds, subtopicsOf(monsterIds));
      accept(v, sentAt);
      // 部屋を作った子へ知らせる（合図の部屋に入る前なので、いったん入って送る）
      const s = joinSignal(v.topic, () => {});
      setTimeout(() => { s.ping(); setTimeout(() => s.leave(), 500); }, 400);
      lobbySignalRef.current?.ping();
      onStaminaChanged();
    } catch (e) { setError((e as Error).message); void loadLobby(); }
    setBusy(false);
  };

  const leave = async () => {
    if (view && view.status !== 'finished') {
      try { await duelApi.leave(studentId, view.id); signalRef.current?.ping(); lobbySignalRef.current?.ping(); } catch { /* 出るだけ */ }
    }
    onExit();
  };

  // ---- 対戦中の表示 ----
  const serverNow = now + offset;
  const startMs = view?.round_start ? new Date(view.round_start).getTime() : 0;
  const deadlineMs = view?.round_deadline ? new Date(view.round_deadline).getTime() : 0;
  const problem = useMemo(
    () => (view?.round_subtopic ? problemFor(view.topic, view.round_subtopic, view.round) : null),
    [view?.topic, view?.round_subtopic, view?.round], // eslint-disable-line react-hooks/exhaustive-deps
  );

  let phase: 'countdown' | 'answering' | 'round_result' | 'match_over' = 'countdown';
  if (view?.status === 'finished') phase = 'match_over';
  else if (view && serverNow < startMs) phase = view.round > 1 && serverNow < startMs - (4000 - RESULT_MS) ? 'round_result' : 'countdown';
  else phase = 'answering';

  useEffect(() => { if (phase === 'answering') answeringStartRef.current = Date.now(); }, [phase === 'answering', view?.round]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = view?.history[view.history.length - 1];
  const roundWinner = !last ? null : last === 'draw' ? 'draw' : last === view?.role ? 'player' : 'opponent';
  const timeLeft = Math.max(0, Math.ceil((deadlineMs - serverNow) / 1000));

  const onAnswer = async (answer: string) => {
    if (!view || !problem || phase !== 'answering' || view.my_answered || pendingRound === view.round) return;
    const round = view.round;
    setPendingRound(round);
    // 採点は CPU 戦と同じ checkAnswer（アプリと同じ答え方の問題は、まちがえると '__guided_incorrect__' が来る）
    const data = problem.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const isCorrect = answer !== '__guided_incorrect__'
      && checkAnswer(answer, problem.answer, { multiple: !!data?.multiple, requireForm: data?.requireForm });
    onRecord(problem, answer, isCorrect);
    const sentAt = Date.now();
    try {
      accept(await duelApi.answer(studentId, view.id, round, isCorrect, Date.now() - answeringStartRef.current), sentAt);
      signalRef.current?.ping();
    } catch (e) { setError((e as Error).message); }
  };

  // ---- 画面 ----
  if (view && view.status !== 'waiting' && !(view.status === 'finished' && !view.winner)) {
    const roundMonster = view.round % 2 === 1
      ? (view.role === 'host' ? 'mine' : 'theirs')
      : (view.role === 'host' ? 'theirs' : 'mine');
    const roundMonsterName = view.round_subtopic ?? '';
    return (
      <div className="w-full h-full flex flex-col">
        {view.status === 'playing' && phase !== 'round_result' && (
          <div className="text-center text-[11px] sm:text-xs text-emerald-300 font-bold pt-2 px-3">
            {roundMonster === 'mine' ? 'きみの モンスター' : `${view.opp_number}ばんの モンスター`}の もんだい：{roundMonsterName}
          </div>
        )}
        {view.status === 'finished' && view.end_reason === 'left' && (
          <div className="text-center text-xs text-amber-300 font-bold pt-3 px-3">
            {view.winner === view.role ? 'あいてが たいせんを やめたよ。' : 'たいせんを やめたので、あいての かちに なったよ。'}
          </div>
        )}
        {view.status === 'finished' && (
          <div className="text-center text-xs text-gray-400 pt-2 px-3">
            せいかい {view.my_correct}もん。かっても まけても、せいかいした ぶんの MP が もらえるよ
          </div>
        )}
        <div className="flex-1 min-h-0">
          <SpeedDuelBoard
            problem={problem}
            playerScore={view.my_score}
            opponentScore={view.opp_score}
            // 結果を見せている間は、サーバはもう次のラウンドに進んでいるので、終わったラウンドの番号を出す
            round={phase === 'round_result' ? view.round - 1 : view.round}
            totalRounds={view.total_rounds}
            format={view.format}
            phase={phase}
            onAnswer={onAnswer}
            onNextRound={() => {}}
            onExit={() => { void leave(); }}
            roundWinner={roundWinner}
            playerName={`${myNumber}ばん（きみ）`}
            opponentName={`${view.opp_number ?? '?'}ばん`}
            isPlayerAnswered={view.my_answered || pendingRound === view.round}
            isOpponentAnswered={view.opp_answered}
            timeLeft={timeLeft}
            gameResult={view.winner === 'draw' ? 'draw' : view.winner === view.role ? 'win' : view.winner ? 'lose' : null}
            playerMonster={monsterView(view.my_monsters[0])}
            opponentMonster={monsterView(view.opp_monsters?.[0])}
            timeLimit={ROUND_SECONDS}
            autoNext
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center p-4 text-white overflow-y-auto">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => { void leave(); }} className="text-gray-400 hover:text-white transition-colors p-2" aria-label="もどる">
            <BackIcon className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-wider flex items-center gap-3">
              <span className="text-emerald-400">⚔</span>
              <span className="text-hologram">クラス対戦</span>
            </h2>
            <p className="text-xs text-emerald-400 font-bold mt-1">
              同じ学級の ともだちと、モンスターの もんだいで 早押し（{duelFormat === 'best_of_3' ? '3本勝負' : '5本勝負'}）
            </p>
          </div>
        </div>

        <div className="hud-panel rounded-xl p-4 mb-5 border border-emerald-800/30 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400 font-bold">つれていく なかま</span>
          {monsterIds.map((id) => {
            const m = monsterView(id);
            return m && (
              <span key={id} className="flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                <img src={m.sprite} alt="" className="w-8 h-8 object-contain" />{m.name}
              </span>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-900/20 p-3 text-sm text-amber-200 font-bold">{error}</div>
        )}

        {view?.status === 'waiting' ? (
          <div className="hud-panel rounded-xl p-6 border border-emerald-800/30 text-center">
            <div className="text-5xl mb-3 animate-pulse">⏳</div>
            <p className="text-lg font-black">あいてを まっているよ</p>
            <p className="text-xs text-gray-400 mt-2">ともだちに「{myNumber}ばんの へやに 入って」と つたえてね。</p>
            <button onClick={() => { void leave(); }} className="btn-tactical mt-6 px-6 py-2.5 rounded-xl text-sm font-bold">
              やめる
            </button>
          </div>
        ) : (
          <>
            <div className="hud-panel rounded-xl p-4 sm:p-5 mb-5 border border-emerald-800/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-emerald-400 tracking-widest">あいてを まっている へや</h3>
                <span className="text-[10px] text-gray-500">{lobby ? `${lobby.rooms.length}へや` : 'よみこみ中…'}</span>
              </div>
              {lobby && lobby.rooms.length === 0 && (
                <p className="text-xs text-gray-500 py-4 text-center">まだ へやが ないよ。下の「へやを つくる」から はじめよう。</p>
              )}
              <div className="space-y-2">
                {lobby?.rooms.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-700/40 bg-slate-900/40 p-2.5">
                    <span className="text-lg font-black text-white w-16 shrink-0">{r.host_number}ばん</span>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {r.host_monsters.map((id) => {
                        const m = monsterView(id);
                        return m && <img key={id} src={m.sprite} alt={m.name} title={m.name} className="w-9 h-9 object-contain" />;
                      })}
                      <span className="text-[10px] text-gray-500 ml-1">{r.format === 'best_of_3' ? '3本勝負' : '5本勝負'}</span>
                    </div>
                    <button disabled={busy} onClick={() => { void join(r.id); }}
                      className="btn-tactical px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40">
                      この へやに 入る
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button disabled={busy} onClick={() => { void create(); }}
              className="btn-tactical w-full py-4 rounded-2xl font-black text-base disabled:opacity-40">
              へやを つくる（{duelFormat === 'best_of_3' ? '3本勝負' : '5本勝負'}）
            </button>
            <ul className="mt-5 space-y-1 text-[11px] text-gray-400">
              <li>• へやに 入った ときに、2人とも スタミナを 5 つかうよ</li>
              <li>• 1本目は へやを つくった子の モンスター、2本目は 入った子の モンスターの もんだい（こうたいで出る）</li>
              <li>• さきに せいかいした ほうが 1本。まちがえたら その もんだいは もう こたえられないよ</li>
              <li>• かっても まけても、せいかいした ぶんの MP が もらえるよ</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default ClassDuel;
