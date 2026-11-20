/**
 * components/adventure/DojoScreen.tsx — スタミナ道場（2026-11-20〜）
 *
 * ぼうけんの町の「スタミナ道場」。その町の単元アプリと同じ問題・同じ解答画面で
 * れんしゅう（じぶんで えらぶ／おまかせ）・ふくしゅう ができる。くわしいきまりは services/dojo.ts。
 *
 * - 項目ごとに「きょう あと いくつ たまるか」を出す（1日1項目5まで。熟達した項目は半分）。
 * - 解いた答えは 単元アプリで解いたのと同じ記録として送る。スタミナに入るのは サーバが数えなおしたとき（2分ほど）。
 *   それまでは「さっき ためた分」として 画面の中だけで 足して見せる。
 * - まちがえても、アプリと同じように ヒントを見ながら さいごまで解ける（記録は「まちがいあり」）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppRoundDef, AppTestDef } from '../../apps/types';
import { setDojoSink, clearDojoSink, type DojoSink } from '../../apps/_shims/progressStore';
import {
  dojoItems, fetchDojoToday, fetchMyRows, loadTownRounds, loadTownTests, recordDojo, TEST_ITEM_SUFFIX, remainingToday, isMasteredItem, setSeeds,
  dojoMasteryStreak, dojoTodaySkillCount, dueItems, TOWN_CAP, DAILY_SKILL_CAP,
  type DojoItem, type DojoToday,
} from '../../services/dojo';
import type { MySkillRow } from 'learning-app-kit/sync';

interface Props {
  townKey: string;
  townName: string;
  /** その町のスタミナ・共通スタミナ（いまサーバにある分） */
  townStamina: number;
  commonStamina: number;
  onClose: () => void;
}

type Tab = 'practice' | 'review' | 'test';
/** 本番テストを解いているところ */
interface TestRun { app: string; def: AppTestDef }
interface Playing { item: DojoItem; omakase: boolean; review: boolean }

const ACCENT = '#b45309';

const DojoScreen: React.FC<Props> = ({ townKey, townName, townStamina, commonStamina, onClose }) => {
  const [tab, setTab] = useState<Tab>('practice');
  const [items, setItems] = useState<DojoItem[] | null>(null);
  const [today, setToday] = useState<DojoToday | null>(null);
  const [rows, setRows] = useState<MySkillRow[]>([]);
  const [reg, setReg] = useState<Record<string, Record<string, AppRoundDef>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** きょうの分・じぶんの記録は、あとから届く（一覧は待たずに出す）。loading＝まだ／ok／failed */
  const [todayState, setTodayState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [rowsState, setRowsState] = useState<'loading' | 'ok' | 'failed'>('loading');
  /** サーバに まだ入っていない「さっき ためた分」（"app|skill" → 数） */
  const [pending, setPending] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<null | { perfect: boolean; gained: number }>(null);
  const [reviewDone, setReviewDone] = useState<Set<string>>(new Set());
  const [tests, setTests] = useState<AppTestDef[] | null>(null);
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const testRunRef = useRef<TestRun | null>(null);
  /** 本番テストの記録（解答画面の1問ごと・テストの点数）の受け取り先。テストを閉じたあとに来る「とちゅうでやめた」記録も その項目に付ける */
  const lastTestRef = useRef<TestRun | null>(null);
  testRunRef.current = testRun;
  if (testRun) lastTestRef.current = testRun;

  const playingRef = useRef<Playing | null>(null);
  /** さいごに解いていた項目。「もどる」で画面を とじたあとに 解答画面から来る「とちゅうでやめた」記録も その項目に付ける */
  const lastPlayingRef = useRef<Playing | null>(null);
  playingRef.current = playing;
  if (playing) lastPlayingRef.current = playing;
  const todayRef = useRef<DojoToday | null>(null);
  todayRef.current = today;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const gainedRef = useRef(0);

  const townAdded = useMemo(() => Object.values(pending).reduce((a, b) => a + b, 0), [pending]);
  const townNow = Math.min(TOWN_CAP, Math.floor(townStamina + townAdded));
  const townFull = townNow >= TOWN_CAP;

  const load = useCallback(async () => {
    // 一覧は「その町のアプリの解答画面」だけで出せるので、サーバの返事は待たない（弱い回線で、まず一覧を見せる）
    void Promise.all([loadTownRounds(townKey), dojoItems(townKey)])
      .then(([rg, its]) => { setReg(rg); setItems(its); })
      .catch(() => { setError('よみこめませんでした'); setItems((v) => v ?? []); });
    void loadTownTests(townKey).then(setTests).catch(() => setTests([]));
    void fetchDojoToday().then((td) => {
      if (td) { setToday(td); setPending({}); setTodayState('ok'); } else setTodayState('failed');
    });
    void fetchMyRows().then((my) => {
      if (my) { setRows(my); setSeeds(my); setRowsState('ok'); } else setRowsState('failed');
    });
  }, [townKey]);
  useEffect(() => { void load(); }, [load]);

  // 解答画面の記録を受け取る（道場が開いているあいだだけ）。
  // とじるとき、解答画面の「とちゅうでやめた」記録が あとから来るので、少し待ってから はずす
  useEffect(() => {
    const mine: DojoSink = {
      recordResult: (r) => {
        // 本番テストを解いているあいだ（閉じた直後をふくむ）は、テストの記録。れんしゅうを解いているときは れんしゅうの記録
        const tr = testRunRef.current ?? (playingRef.current ? null : lastTestRef.current);
        const p = tr ? null : (playingRef.current ?? lastPlayingRef.current);
        if (!tr && !p) return;
        const rec = r as { moduleId: string; skillId: string; label: string; correct: boolean; mistakes?: number; abandoned?: boolean; missType?: string; missAnswer?: string };
        if (tr) { recordDojo(tr.app, tr.app + TEST_ITEM_SUFFIX, rec as Parameters<typeof recordDojo>[2]); return; }
        if (!p) return;
        recordDojo(p.item.app, p.item.key, rec);
        if (rec.correct && !rec.abandoned) {
          const k = `${p.item.app}|${rec.skillId}`;
          const already = (todayRef.current?.earned[k] ?? 0) + (pendingRef.current[k] ?? 0);
          const w = todayRef.current?.mastered.has(k) ? 0.5 : 1;
          const add = Math.max(0, Math.min(w, DAILY_SKILL_CAP - already));
          if (add > 0) {
            gainedRef.current += add;
            setPending((prev) => ({ ...prev, [k]: (prev[k] ?? 0) + add }));
          }
        }
      },
      getMasteryStreak: (sk) => { const a = testRunRef.current?.app ?? playingRef.current?.item.app; return a ? dojoMasteryStreak(a, sk) : 0; },
      getTodaySkillCount: (sk) => { const a = testRunRef.current?.app ?? playingRef.current?.item.app; return a ? dojoTodaySkillCount(a, sk) : 0; },
    };
    setDojoSink(mine);
    return () => { setTimeout(() => clearDojoSink(mine), 50); };
  }, []);

  const remaining = useCallback((it: DojoItem) => remainingToday(it, today, pending), [today, pending]);

  /** おまかせ：まだ たまる項目のうち、熟達していない・つづけて正解が少ないものから */
  const pickOmakase = useCallback((exclude?: string): DojoItem | null => {
    if (!items?.length) return null;
    const pool = items.filter((it) => it.key !== exclude);
    const open = pool.filter((it) => remaining(it) > 0);
    const base = open.length ? open : pool;
    const scored = base
      .map((it) => ({ it, s: (isMasteredItem(it, today) ? 10 : 0) + dojoMasteryStreak(it.app, it.skills[0]) * 5 + Math.random() * 2 }))
      .sort((a, b) => a.s - b.s);
    return scored[0]?.it ?? null;
  }, [items, today, remaining]);

  const start = (item: DojoItem, omakase: boolean, review = false) => {
    gainedRef.current = 0;
    setResult(null);
    setPlaying({ item, omakase, review });
    setRound((n) => n + 1);
  };

  const next = () => {
    if (!playing) return;
    if (playing.review) { backToList(); return; }
    const it = playing.omakase ? pickOmakase(playing.item.key) ?? playing.item : playing.item;
    start(it, playing.omakase);
  };

  const backToList = () => {
    if (playing?.review) setReviewDone((s) => new Set(s).add(playing.item.key));
    setPlaying(null);
    setResult(null);
    // きょうの分を読みなおす（サーバが数えなおしていれば、さっきの分が入る）
    void fetchDojoToday().then((td) => {
      if (!td) return;
      setToday(td);
      // サーバに入った分は「さっき ためた分」から のぞく
      setPending((prev) => {
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          const was = todayRef.current?.earned[k] ?? 0;
          const now = td.earned[k] ?? 0;
          const left = v - Math.max(0, now - was);
          if (left > 0) out[k] = left;
        }
        return out;
      });
    });
  };

  const due = useMemo(() => (items ? dueItems(items, rows).filter((it) => !reviewDone.has(it.key)) : []), [items, rows, reviewDone]);

  const groups = useMemo(() => {
    const m = new Map<string, DojoItem[]>();
    for (const it of items ?? []) {
      const g = it.moduleTitle || 'そのほか';
      m.set(g, [...(m.get(g) ?? []), it]);
    }
    return [...m.entries()];
  }, [items]);

  const openCount = items?.filter((it) => remaining(it) > 0).length ?? 0;

  /* ---------------- 本番テストを解いているところ ---------------- */
  if (testRun) {
    const exitTest = () => {
      setTestRun(null);
      // きょうの分を読みなおす（サーバが数えなおしていれば、さっきの分が入る）
      void fetchDojoToday().then((td) => { if (td) { setToday(td); setPending({}); } });
    };
    const { Module } = testRun.def;
    return (
      <div className="fixed inset-0 z-40 bg-slate-900/90 backdrop-blur-sm flex flex-col">
        <header className="shrink-0 flex items-center gap-3 px-3 py-2 shadow-lg" style={{ backgroundColor: ACCENT }}>
          <button onClick={exitTest} className="px-4 py-2 rounded-2xl bg-white/95 text-slate-800 font-black active:scale-95">← やめる</button>
          <div className="min-w-0 flex-1 text-white">
            <p className="text-xs font-bold opacity-90 truncate">ほんばんテスト</p>
            <p className="text-lg font-black truncate">{testRun.def.title}</p>
          </div>
          <div className="shrink-0 text-right text-white">
            <p className="text-[11px] font-bold opacity-90">町のスタミナ</p>
            <p className="text-xl font-black">⚡{townNow}<span className="text-xs opacity-80">/{TOWN_CAP}</span></p>
          </div>
        </header>
        <div className="shrink-0 px-3 py-1.5 text-center text-sm font-black" style={{ background: '#fef3c7', color: '#78350f' }}>
          テストが おわると、てんすうに おうじて スタミナが たまるよ（2分ほどで 入るよ）
        </div>
        <div className="flex-1 min-h-0 p-2 sm:p-4">
          <div className="app-paper rounded-2xl text-left max-w-3xl mx-auto h-full overflow-hidden">
            <Module onExit={exitTest} onPractice={() => { exitTest(); setTab('practice'); }} />
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- 解いているところ ---------------- */
  if (playing && reg) {
    const def = reg[playing.item.regApp]?.[playing.item.round];
    const left = remaining(playing.item);
    const Round = def?.Round;
    return (
      <div className="fixed inset-0 z-40 bg-slate-900/90 backdrop-blur-sm flex flex-col">
        <header className="shrink-0 flex items-center gap-3 px-3 py-2 shadow-lg" style={{ backgroundColor: ACCENT }}>
          <button onClick={backToList} className="px-4 py-2 rounded-2xl bg-white/95 text-slate-800 font-black active:scale-95">← もどる</button>
          <div className="min-w-0 flex-1 text-white">
            <p className="text-xs font-bold opacity-90 truncate">{playing.review ? 'ふくしゅう' : playing.omakase ? 'おまかせ' : 'れんしゅう'}・{playing.item.moduleTitle}</p>
            <p className="text-lg font-black truncate">{playing.item.label}</p>
          </div>
          <div className="shrink-0 text-right text-white">
            <p className="text-[11px] font-bold opacity-90">町のスタミナ</p>
            <p className="text-xl font-black">⚡{townNow}<span className="text-xs opacity-80">/{TOWN_CAP}</span></p>
          </div>
        </header>
        <div className="shrink-0 px-3 py-1.5 text-center text-sm font-black" style={{ background: '#fef3c7', color: '#78350f' }}>
          {townFull
            ? '町の スタミナは まんタン（50）。れんしゅうの きろくは のこるよ'
            : left > 0
              ? `この もんだいで きょうは あと ${left} たまる${isMasteredItem(playing.item, today) ? '（熟達ずみ：1問で 0.5）' : '（ノーミスで 1問 1）'}`
              : 'この もんだいは きょうは もう たまらない。ほかの もんだいで ためよう'}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4">
          {Round ? (
            <div className="app-paper rounded-2xl text-left max-w-3xl mx-auto">
              <Round
                key={round}
                level={playing.item.level}
                onMiss={() => { /* 道場では まちがえても さいごまで解ける（アプリと同じ） */ }}
                onResult={(perfect) => setResult({ perfect, gained: gainedRef.current })}
              />
            </div>
          ) : (
            <p className="text-center text-white font-bold p-6">この もんだいは まだ 出せません</p>
          )}
          {result && (
            <div className="max-w-3xl mx-auto mt-3 rounded-3xl bg-white p-4 shadow-xl text-center">
              <p className="text-2xl font-black" style={{ color: result.perfect ? '#15803d' : '#b45309' }}>
                {result.perfect ? 'ノーミス！' : 'さいごまで とけたね'}
              </p>
              <p className="text-sm font-bold text-slate-600 mt-1">
                {result.gained > 0
                  ? `⚡ スタミナ +${result.gained}（町の スタミナに 2分ほどで 入るよ）`
                  : result.perfect
                    ? (townFull ? '町の スタミナは まんタン' : 'この もんだいは きょうは もう たまらないよ')
                    : 'まちがえた もんだいは スタミナに ならないけど、きろくは のこるよ'}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button onClick={backToList} className="px-5 py-3 rounded-2xl bg-slate-200 text-slate-800 font-black active:scale-95">もどる</button>
                {!playing.review && (
                  <button onClick={next} className="px-6 py-3 rounded-2xl text-white font-black text-lg active:scale-95" style={{ backgroundColor: ACCENT }}>
                    {playing.omakase ? 'おまかせで つぎへ ▶' : 'もう1問 ▶'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- 項目のえらび ---------------- */
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm flex flex-col">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 shadow-lg" style={{ backgroundColor: ACCENT }}>
        <div className="min-w-0">
          <h2 className="text-white text-2xl sm:text-3xl font-black truncate">スタミナ道場</h2>
          <p className="text-white/90 text-xs font-bold truncate">{townName}の 道場 ― アプリと 同じ もんだいで スタミナを ためよう</p>
        </div>
        <button onClick={onClose} className="shrink-0 px-6 py-2.5 rounded-2xl bg-white/95 text-slate-800 font-black text-lg shadow active:scale-95">とじる ✕</button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-4xl mx-auto">
          {/* スタミナ */}
          <div className="rounded-3xl bg-white p-4 shadow-lg flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[12rem]">
              <p className="text-xs font-black text-amber-700">この町の スタミナ</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-800">⚡{townNow}</span>
                <span className="text-sm font-bold text-slate-500">/ {TOWN_CAP}</span>
                {townAdded > 0 && <span className="text-xs font-black text-emerald-600">（さっき +{townAdded}。2分ほどで 入るよ）</span>}
              </div>
              <div className="mt-1 h-3 rounded-full bg-amber-100 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${(townNow / TOWN_CAP) * 100}%` }} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-sky-700">共通スタミナ</p>
              <p className="text-2xl font-black text-slate-800">⚡{commonStamina}</p>
            </div>
          </div>
          <p className="mt-2 text-white/90 text-xs font-bold leading-relaxed">
            1つの もんだいで ためられるのは 1日 {DAILY_SKILL_CAP}まで（ノーミスで 1問 1。熟達した もんだいは 0.5）。町の スタミナは {TOWN_CAP}まで。
            ここで といた きろくは、アプリで といたのと 同じように せんせいに とどくよ。
          </p>

          {(error || todayState === 'failed' || rowsState === 'failed') && (
            <p className="mt-2 rounded-2xl bg-amber-100 text-amber-900 text-sm font-black px-3 py-2">
              {error ?? 'つうしんが よわいみたい。きょうの のこりは あとで でるよ'}
            </p>
          )}
          {townFull && (
            <p className="mt-2 rounded-2xl bg-emerald-100 text-emerald-900 text-sm font-black px-3 py-2">
              町の スタミナは まんタン！ バトルで つかうと、また ためられるよ。
            </p>
          )}

          {/* タブ */}
          <div className="mt-3 flex gap-2">
            {([['practice', 'れんしゅう'], ['review', `ふくしゅう${due.length ? `（${due.length}）` : ''}`], ['test', 'ほんばんテスト']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 py-3 rounded-2xl font-black text-base sm:text-lg ${tab === k ? 'bg-white text-amber-800 shadow-lg' : 'bg-white/20 text-white'}`}
              >{label}</button>
            ))}
          </div>

          {!items && <p className="text-center text-white font-bold p-6">よみこみちゅう…</p>}

          {items && tab === 'practice' && (
            <>
              <button
                onClick={() => { const it = pickOmakase(); if (it) start(it, true); }}
                disabled={!items.length}
                className="mt-3 w-full rounded-3xl p-4 text-left text-white shadow-lg flex items-center gap-4 active:scale-[0.99] disabled:opacity-50"
                style={{ background: 'linear-gradient(90deg,#d97706,#f59e0b)' }}
              >
                <span className="text-5xl shrink-0">🎯</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-black">おまかせ</span>
                  <span className="block text-xs font-bold opacity-95">
                    {todayState === 'loading'
                      ? 'きょうの のこりを しらべています…'
                      : openCount > 0
                      ? `まだ スタミナが たまる もんだい（${openCount}こ）から、にがてそうな じゅんに 出すよ`
                      : 'きょうは どの もんだいも まんタン。れんしゅうは できるよ'}
                  </span>
                </span>
              </button>

              {groups.map(([title, its]) => (
                <section key={title} className="mt-4">
                  <h3 className="text-white font-black text-lg mb-2">{title}</h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {its.map((it) => {
                      const left = remaining(it);
                      const mastered = isMasteredItem(it, today);
                      return (
                        <button
                          key={it.key}
                          onClick={() => start(it, false)}
                          className={`rounded-2xl p-3 text-left shadow flex items-center gap-3 active:scale-[0.99] border-4 ${(left > 0 || todayState === 'loading') && !townFull ? 'bg-white border-amber-300' : 'bg-slate-100 border-slate-200'}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-black text-slate-800 leading-snug">{it.label}</span>
                            {mastered && <span className="inline-block mt-1 text-[11px] font-black text-violet-700 bg-violet-100 rounded-full px-2">★ 熟達（1問 0.5）</span>}
                          </span>
                          <span className={`shrink-0 text-center rounded-xl px-2 py-1 font-black ${(left > 0 || todayState === 'loading') && !townFull ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                            {todayState === 'loading'
                              ? <span className="text-xs">…</span>
                              : left > 0
                                ? <><span className="block text-[10px] leading-none">きょう あと</span><span className="text-lg leading-tight">⚡{left}</span></>
                                : <span className="text-xs">✓ まんタン</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
              {items.length === 0 && <p className="text-center text-white font-bold p-6">この町には まだ 道場の もんだいが ないよ</p>}
            </>
          )}

          {tab === 'test' && (
            <div className="mt-3">
              <p className="text-white/90 text-sm font-bold mb-2 leading-relaxed">
                アプリの 本番テストと 同じ もんだいで ちょうせん。てんすうが 高いほど スタミナが たくさん たまるよ
                （ぜんぶ 満点で 20。その日 1回目は ぜんぶ、2・3回目は 半分）。8わり いじょうの 日が 3日で、町が ひらく じょうけんにも なるよ。
              </p>
              {!tests && <p className="text-center text-white font-bold p-6">よみこみちゅう…</p>}
              {tests && tests.length === 0 && (
                <p className="rounded-3xl bg-white/90 p-6 text-center font-black text-slate-700">この町の 本番テストは、まだ ここには ないよ（アプリで うけられるよ）</p>
              )}
              <div className="grid gap-2">
                {tests?.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTestRun({ app: t.app, def: t })}
                    className="rounded-3xl p-4 text-left shadow-lg flex items-center gap-4 active:scale-[0.99] bg-white border-4 border-rose-300"
                  >
                    <span className="text-5xl shrink-0">📝</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xl font-black text-slate-800">{t.title}</span>
                      <span className="block text-xs font-bold text-slate-500 leading-snug">{t.desc}</span>
                    </span>
                    <span className="shrink-0 rounded-2xl px-4 py-2 bg-rose-500 text-white font-black">ちょうせん</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {items && tab === 'review' && (
            <div className="mt-3">
              <p className="text-white/90 text-sm font-bold mb-2">
                まえに といた もんだいを、わすれかけた ころに もう一度。アプリで といた もんだいも ここに 出るよ。
              </p>
              {due.length === 0 && (
                <p className="rounded-3xl bg-white/90 p-6 text-center font-black text-slate-700">
                  {rowsState === 'loading' ? 'しらべています…' : rowsState === 'failed' ? 'つうしんが よわくて しらべられなかったよ。あとで また ひらいてね' : 'いまは ふくしゅうする もんだいは ないよ 🎉'}
                </p>
              )}
              <div className="grid sm:grid-cols-2 gap-2">
                {due.map((it) => {
                  const left = remaining(it);
                  return (
                    <button
                      key={it.key}
                      onClick={() => start(it, false, true)}
                      className="rounded-2xl p-3 text-left shadow flex items-center gap-3 active:scale-[0.99] bg-white border-4 border-sky-300"
                    >
                      <span className="text-3xl shrink-0">🔁</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-slate-500">{it.moduleTitle}</span>
                        <span className="block font-black text-slate-800 leading-snug">{it.label}</span>
                      </span>
                      {left > 0 && !townFull && <span className="shrink-0 rounded-xl px-2 py-1 bg-amber-500 text-white font-black text-sm">⚡{left}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DojoScreen;
