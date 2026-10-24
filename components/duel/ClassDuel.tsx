/**
 * ClassDuel.tsx — クラス対戦（同じ学級の2人が、パーティ3匹か5匹で対戦。HPあり）
 *
 * へやの一覧 → 相手を待つ → 対戦、の3つの画面。対戦画面は CPU 戦と同じ PartyDuelBoard。
 * HP・ダメージ・勝ち負け・時間・ターンの進みは、すべてサーバ（services/duel.ts の sanmon_pduel_*）が決めた値で表示する
 * （端末の時計は、サーバの時刻とのずれを直してから使う）。モンスターのレベルはサーバのセーブから読むので、
 * へやを作る・入る前にセーブを送る。
 *
 * 1ターンの問題は「場に出ている2匹の分野」から交互に、2人が同じ番号を選ぶ（duelProblems の problemFor）。
 * 順位表は作らない（子どもに個人の順位を見せない、の決まり）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpeedProblem } from '../../types';
import { getMonster, getMonsterSprite } from '../../data/adventure/monsters';
import { useAdventureStore } from '../../store/adventureStore';
import { pushSave } from '../../services/portal';
import { BackIcon } from '../Icons';
import PartyDuelBoard, { type PartyPhase } from './PartyDuelBoard';
import { isDuelAnswerCorrect, problemFor } from './duelProblems';
import { duelApi, joinSignal, clockOffset, type DuelLobby, type DuelView } from '../../services/duel';

/** ターンの結果を見せる時間（サーバは結果のあと4秒で次のターンを始める。残りの1.5秒はカウントダウン） */
const RESULT_MS = 2500;
const POLL_MS = 2000;
const LOBBY_POLL_MS = 3000;

export interface ClassDuelProps {
  studentId: string;
  myNumber: number;
  /** つれていくモンスター（ぼうけんの個体の uid） */
  uids: string[];
  size: number;
  onExit: () => void;
  /** 1問答えるたび（学習の記録・弱点・ふくしゅう・モンスターが育つ） */
  onRecord: (problem: SpeedProblem, answer: string, isCorrect: boolean) => void;
  /** 対戦が終わったとき1回だけ（ごほうび） */
  onFinish: (result: 'win' | 'lose' | 'draw', myCorrect: number) => void;
  /** スタミナが変わったとき（ステータスの表示を読みなおす） */
  onStaminaChanged: () => void;
}

const ClassDuel: React.FC<ClassDuelProps> = ({
  studentId, myNumber, uids, size, onExit, onRecord, onFinish, onStaminaChanged,
}) => {
  const owned = useAdventureStore((s) => s.save.owned);
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

  const myMons = uids.map((u) => owned.find((o) => o.uid === u)).filter((o): o is NonNullable<typeof o> => !!o);

  const accept = useCallback((v: DuelView, sentAt: number) => {
    setOffset(clockOffset(v, (sentAt + Date.now()) / 2));
    setView(v);
  }, []);

  // ---- へやの一覧 ----
  const loadLobby = useCallback(async () => {
    try {
      const l = await duelApi.list(studentId);
      setLobby(l);
      // 続きの部屋があれば戻る（まちがえて閉じた・リロードした）。古い形の部屋は続けない
      if (l.mine?.party_size) setView((cur) => cur ?? l.mine);
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
    try {
      await pushSave(); // レベルはサーバのセーブから読む
      const sentAt = Date.now();
      accept(await duelApi.createParty(studentId, uids, size), sentAt);
      lobbySignalRef.current?.ping();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const join = async (duelId: string) => {
    setBusy(true); setError(null);
    try {
      await pushSave();
      const sentAt = Date.now();
      const v = await duelApi.joinParty(studentId, duelId, uids);
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

  let phase: PartyPhase = 'countdown';
  if (view?.status === 'finished') phase = 'match_over';
  else if (view && serverNow < startMs) phase = view.round > 1 && view.last_turn && serverNow < startMs - (4000 - RESULT_MS) ? 'turn_result' : 'countdown';
  else phase = 'answering';

  useEffect(() => { if (phase === 'answering') answeringStartRef.current = Date.now(); }, [phase === 'answering', view?.round]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeLeft = Math.max(0, Math.ceil((deadlineMs - serverNow) / 1000));

  const onAnswer = async (answer: string) => {
    if (!view || !problem || phase !== 'answering' || view.my_answered || pendingRound === view.round) return;
    const round = view.round;
    setPendingRound(round);
    const isCorrect = isDuelAnswerCorrect(problem, answer);
    onRecord(problem, answer, isCorrect);
    const sentAt = Date.now();
    try {
      accept(await duelApi.answerParty(studentId, view.id, round, isCorrect, Date.now() - answeringStartRef.current), sentAt);
      signalRef.current?.ping();
    } catch (e) { setError((e as Error).message); }
  };

  // ---- 画面 ----
  if (view && view.status !== 'waiting' && !(view.status === 'finished' && !view.winner) && view.my_party && view.opp_party) {
    const lt = view.last_turn;
    // 奇数ターンは部屋を作った子の場のモンスター、偶数ターンは入った子の場のモンスターの分野
    const fieldOwner = (view.round % 2 === 1) === (view.role === 'host') ? 'mine' : 'theirs';
    return (
      <div className="w-full h-full flex flex-col">
        {error && <div className="mx-3 mt-2 rounded-lg border border-amber-500/40 bg-amber-900/20 p-2 text-xs text-amber-200 font-bold">{error}</div>}
        <div className="flex-1 min-h-0">
          <PartyDuelBoard
            my={{ label: `${myNumber}ばん（きみ）`, party: view.my_party, active: view.my_active }}
            opp={{ label: `${view.opp_number ?? '?'}ばん`, party: view.opp_party, active: view.opp_active }}
            phase={phase}
            // 結果を見せている間は、サーバはもう次のターンに進んでいるので、終わったターンの番号を出す
            turn={phase === 'turn_result' ? view.round - 1 : view.round}
            problem={problem}
            fieldOwner={fieldOwner}
            isPlayerAnswered={view.my_answered || pendingRound === view.round}
            isOpponentAnswered={view.opp_answered}
            timeLeft={timeLeft}
            lastTurn={lt ? {
              myHit: lt.my_hit, oppHit: lt.opp_hit, myKo: lt.my_ko, oppKo: lt.opp_ko,
              myCorrect: lt.my_correct, oppCorrect: lt.opp_correct, myDefId: lt.my_defid, oppDefId: lt.opp_defid,
            } : null}
            myMiss={view.my_miss}
            result={view.winner === 'draw' ? 'draw' : view.winner === view.role ? 'win' : view.winner ? 'lose' : null}
            resultNote={<>
              {view.end_reason === 'left' && (view.winner === view.role ? 'あいてが たいせんを やめたよ。' : 'たいせんを やめたので、あいての かちに なったよ。')}
              せいかい {view.my_correct}もん。かっても まけても、せいかいした ぶんの MP が もらえて、その もんだいの モンスターが そだつよ
            </>}
            onAnswer={onAnswer}
            onExit={() => { void leave(); }}
          />
        </div>
      </div>
    );
  }

  const partyRooms = (lobby?.rooms ?? []).filter((r) => r.party_size);
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
            <p className="text-xs text-emerald-400 font-bold mt-1">同じ学級の ともだちと、パーティ {size}匹で たいせん</p>
          </div>
        </div>

        <div className="hud-panel rounded-xl p-4 mb-5 border border-emerald-800/30 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-400 font-bold">きみの パーティ</span>
          {myMons.map((o) => {
            const m = getMonster(o.defId);
            return m && (
              <span key={o.uid} className="flex items-center gap-1 text-xs font-bold text-emerald-200">
                <img src={getMonsterSprite(m.id)} alt="" className="w-8 h-8 object-contain" />{m.name} <span className="text-gray-400">Lv.{o.level}</span>
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
            <p className="text-xs text-gray-400 mt-2">ともだちに「{myNumber}ばんの へやに 入って」と つたえてね（{size}匹で えらんでもらってね）。</p>
            <button onClick={() => { void leave(); }} className="btn-tactical mt-6 px-6 py-2.5 rounded-xl text-sm font-bold">やめる</button>
          </div>
        ) : (
          <>
            <div className="hud-panel rounded-xl p-4 sm:p-5 mb-5 border border-emerald-800/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-emerald-400 tracking-widest">あいてを まっている へや</h3>
                <span className="text-[10px] text-gray-500">{lobby ? `${partyRooms.length}へや` : 'よみこみ中…'}</span>
              </div>
              {lobby && partyRooms.length === 0 && (
                <p className="text-xs text-gray-500 py-4 text-center">まだ へやが ないよ。下の「へやを つくる」から はじめよう。</p>
              )}
              <div className="space-y-2">
                {partyRooms.map((r) => {
                  const same = r.party_size === size;
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-700/40 bg-slate-900/40 p-2.5">
                      <span className="text-lg font-black text-white w-14 shrink-0">{r.host_number}ばん</span>
                      <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
                        {(r.host_party ?? []).map((m, i) => {
                          const def = getMonster(m.defId);
                          return def && (
                            <span key={i} className="flex flex-col items-center">
                              <img src={getMonsterSprite(def.id)} alt={def.name} title={def.name} className="w-8 h-8 object-contain" />
                              <span className="text-[9px] text-gray-400">Lv.{m.level}</span>
                            </span>
                          );
                        })}
                        <span className="text-[10px] text-gray-500 ml-1">{r.party_size}匹</span>
                      </div>
                      <button disabled={busy || !same} onClick={() => { void join(r.id); }}
                        className="btn-tactical px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-40">
                        {same ? 'この へやに 入る' : `${r.party_size}匹で えらぶと 入れる`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <button disabled={busy} onClick={() => { void create(); }}
              className="btn-tactical w-full py-4 rounded-2xl font-black text-base disabled:opacity-40">
              へやを つくる（{size}匹）
            </button>
            <ul className="mt-5 space-y-1 text-[11px] text-gray-400">
              <li>• へやに 入った ときに、2人とも スタミナを 5 つかうよ</li>
              <li>• 2人に 同じ もんだい。場に 出ている 2匹の 分野から こうたいで 出るよ</li>
              <li>• せいかいすると こうげき。HPが 0に なったら つぎの モンスター。ぜんぶ たおしたら かち</li>
              <li>• かっても まけても、せいかいした ぶんの MP が もらえるよ</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default ClassDuel;
