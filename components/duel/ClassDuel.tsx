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
import { duelApi, joinSignal, clockOffset, withRetry, NetworkError, type DuelLobby, type DuelView } from '../../services/duel';

/** ターンの結果を見せる時間（サーバは結果のあと4秒で次のターンを始める。残りの1.5秒はカウントダウン） */
const RESULT_MS = 2500;
/**
 * 読みなおしの間かく（2026-11-19）。合図（Realtime）が つながっていれば、変わったときは合図で すぐ分かるので 少なくする
 * （教室の 30台が 同時に 読みなおすと Wi‑Fi が こむため）。つながらないときだけ 前と同じ 早さで読む。
 */
const POLL_MS = 2000;
const POLL_LIVE_MS = 5000;
const LOBBY_POLL_MS = 3000;
const LOBBY_POLL_LIVE_MS = 10000;
/** へやを作る・入る前に セーブを送るのを 待つ 上限（遅い回線で ずっと止まらないように。送れなければ前のセーブで続ける） */
const SAVE_WAIT_MS = 6000;
/** これより長く 返事を待っていたら「つうしんちゅう」と出す */
const SLOW_MS = 1200;

const pushSaveQuick = () => Promise.race([pushSave().catch(() => {}), new Promise<void>((r) => setTimeout(r, SAVE_WAIT_MS))]);

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
  const signalRef = useRef<{ ping: () => void; leave: () => void; live: () => boolean } | null>(null);
  const lobbySignalRef = useRef<{ ping: () => void; leave: () => void; live: () => boolean } | null>(null);
  /** 返事を待っている 問い合わせの数（「つうしんちゅう」の表示） */
  const [inflight, setInflight] = useState(0);
  const [slow, setSlow] = useState(false);
  /** 読みなおしが つづけて 失敗した回数（2回から「つうしんが よわいよ」） */
  const [pollFails, setPollFails] = useState(0);
  const track = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    setInflight((n) => n + 1);
    try { return await p; } finally { setInflight((n) => n - 1); }
  }, []);
  useEffect(() => {
    if (inflight <= 0) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [inflight]);
  /** 読みなおしが 重ならないように（遅い回線で 返事が来る前に 次を送らない） */
  const pollingRef = useRef(false);
  const againRef = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
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
      setPollFails(0);
      // 続きの部屋があれば戻る（まちがえて閉じた・リロードした）。古い形の部屋は続けない
      if (l.mine?.party_size) setView((cur) => cur ?? l.mine);
      return l;
    } catch (e) {
      if (e instanceof NetworkError) setPollFails((n) => n + 1); else setError((e as Error).message);
      return null;
    }
  }, [studentId]);

  useEffect(() => {
    if (view) return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (!pollingRef.current) {
        pollingRef.current = true;
        try { await loadLobby(); } finally { pollingRef.current = false; }
      }
      if (!stop) t = setTimeout(loop, lobbySignalRef.current?.live() ? LOBBY_POLL_LIVE_MS : LOBBY_POLL_MS);
    };
    void loop();
    return () => { stop = true; clearTimeout(t); };
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
    // 読みなおしの最中に 合図が来たら、終わってから もう一度 読む（合図より前に送った 問い合わせかも しれないため）
    if (pollingRef.current) { againRef.current = true; return; }
    pollingRef.current = true;
    againRef.current = false;
    const sentAt = Date.now();
    try {
      accept(await duelApi.state(studentId, view.id), sentAt);
      setPollFails(0);
      setError(null);
    } catch (e) {
      // 通信の失敗は 次の読みなおしで とりもどせるので、エラーの文は出さず「つうしんが よわい」だけ出す
      if (e instanceof NetworkError) setPollFails((n) => n + 1); else setError((e as Error).message);
    } finally {
      pollingRef.current = false;
      if (againRef.current) { againRef.current = false; setTimeout(() => { void refreshRef.current(); }, 0); }
    }
  }, [view?.id, studentId, accept]); // eslint-disable-line react-hooks/exhaustive-deps

  refreshRef.current = refresh;

  useEffect(() => {
    if (!view?.topic) return;
    const s = joinSignal(view.topic, () => { void refresh(); });
    signalRef.current = s;
    return () => { s.leave(); signalRef.current = null; };
  }, [view?.topic, refresh]);

  // 合図が届かない回線でも進むように、数秒ごとにも読む（「まだいるよ」の知らせも兼ねる。サーバは30秒で いなくなった あつかい）
  // 合図が つながっていれば 5秒ごと、つながらなければ 2秒ごと
  useEffect(() => {
    if (!view || view.status === 'finished') return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (!stop) t = setTimeout(loop, signalRef.current?.live() ? POLL_LIVE_MS : POLL_MS);
    };
    t = setTimeout(loop, POLL_MS);
    return () => { stop = true; clearTimeout(t); };
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

  /**
   * 通信が とちゅうで 切れたとき、サーバでは もう へやが できている（入れている）ことがある。
   * 自分の へやが あれば それを使う。なければ null（もう一度 送ってよい）。
   */
  const recoverMine = async (duelId?: string): Promise<DuelView | null> => {
    try {
      const l = await withRetry(() => duelApi.list(studentId));
      const m = l.mine;
      if (m?.party_size && (!duelId || m.id === duelId)) return m;
    } catch { /* わからない */ }
    return null;
  };

  const create = async () => {
    setBusy(true); setError(null);
    try {
      await track(pushSaveQuick()); // レベルはサーバのセーブから読む（先に送ってあれば すぐ終わる）
      for (let i = 0; ; i++) {
        const sentAt = Date.now();
        try {
          accept(await track(duelApi.createParty(studentId, uids, size)), sentAt);
          break;
        } catch (e) {
          if (!(e instanceof NetworkError) || i >= 2) throw e;
          const m = await track(recoverMine());
          if (m) { accept(m, Date.now()); break; }
        }
      }
      lobbySignalRef.current?.ping();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const join = async (duelId: string) => {
    setBusy(true); setError(null);
    try {
      await track(pushSaveQuick());
      let v: DuelView | null = null;
      for (let i = 0; !v; i++) {
        const sentAt = Date.now();
        try {
          v = await track(duelApi.joinParty(studentId, duelId, uids));
          accept(v, sentAt);
        } catch (e) {
          if (!(e instanceof NetworkError) || i >= 2) throw e;
          // とちゅうで 切れても、もう 入れていることがある（入れていれば その へやで続ける）
          v = await track(recoverMine(duelId));
          if (v) accept(v, Date.now());
        }
      }
      // 部屋を作った子へ知らせる（合図の部屋に入る前なので、いったん入って、つながったら送る）
      const s = joinSignal(v.topic, () => {}, () => { s.ping(); setTimeout(() => s.leave(), 500); });
      setTimeout(() => s.leave(), 10000);
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

  // しめきりを すぎたら すぐ 読みなおす（読みなおしを 5秒ごとに へらしたので、時間切れの 進みが おくれないように）
  useEffect(() => {
    if (!view || view.status !== 'playing' || !deadlineMs) return;
    const wait = deadlineMs - (Date.now() + offset) + 400;
    if (wait < 0 || wait > 10 * 60 * 1000) return;
    const t = setTimeout(() => { void refresh(); }, wait);
    return () => clearTimeout(t);
  }, [deadlineMs, view?.status, offset, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 通信の ようすの 表示（遅い・弱いときだけ） */
  const netNote = pollFails >= 2
    ? '📶 つうしんが よわいよ。つながるのを まっています…'
    : slow ? '📶 つうしんちゅう…' : null;
  const NetBadge = netNote ? (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[200] -translate-x-1/2 rounded-full border border-sky-400/40 bg-slate-900/90 px-4 py-1.5 text-xs font-black text-sky-200 shadow-lg">
      {netNote}
    </div>
  ) : null;

  const onAnswer = async (answer: string) => {
    if (!view || !problem || phase !== 'answering' || view.my_answered || pendingRound === view.round) return;
    const round = view.round;
    setPendingRound(round);
    const isCorrect = isDuelAnswerCorrect(problem, answer);
    onRecord(problem, answer, isCorrect);
    const sentAt = Date.now();
    try {
      // 答えは 同じものを2回送っても サーバが1回だけ数えるので、通信の失敗なら もう一度 送る
      const ms = Date.now() - answeringStartRef.current;
      accept(await track(withRetry(() => duelApi.answerParty(studentId, view.id, round, isCorrect, ms))), sentAt);
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
        {NetBadge}
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
      {NetBadge}
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
              <li>• スタミナは つかわないよ（いつでも あそべる）</li>
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
