/**
 * components/guided/AppRoundHost.tsx — 単元アプリの解答画面を、そのまま SANMON に出す（guidedKind: 'app-round'）。
 *
 * SANMON の問題は「各算数アプリと同じ問題・同じ答え方」にする（2026-10 先生と決めたこと）。
 * 解答画面と問題の作り方は apps/<app>/ に写したアプリのソース（正本はアプリ）。
 *
 * 判定: SANMON のほかの guided と同じく、**1回目のまちがいで その問題は ×**（onComplete(false)）。
 * まちがえたあとも アプリのヒントで さいごまで解けるので、そのまま考えを直せる（記録は×のまま）。
 * 一度もまちがえずに解けたら ○。
 *
 * 見た目: アプリは明るい配色で作られているので、「白い紙」（.app-paper）の上に出す。
 * 暗い SANMON の画面の中でも、アプリで見たのと同じ見た目で読める。
 */
import React, { useEffect, useRef, useState } from 'react';
import type { GuidedAppRoundData } from '../../types';
import type { AppRoundDef } from '../../apps/types';
import { loadAppRounds, loadedAppRounds } from '../../services/appRounds';

const AppRoundHost: React.FC<{ data: GuidedAppRoundData; onComplete: (isCorrect: boolean) => void }> = ({ data, onComplete }) => {
  // そのアプリの分だけ読みこむ（前は10アプリぶんを一度に読みこんでいた）
  const [rounds, setRounds] = useState<Record<string, AppRoundDef> | null>(() => loadedAppRounds(data.app));
  const [missing, setMissing] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    if (rounds) return;
    let live = true;
    void loadAppRounds(data.app).then((r) => { if (!live) return; if (r) setRounds(r); else setMissing(true); });
    return () => { live = false; };
  }, [rounds, data.app]);

  const def = rounds?.[data.round];
  // レベルは問題ごとに1つだけ選ぶ（マウントのたびに新しい問題になる。再描画では変えない）
  const levelRef = useRef('');
  if (def && !levelRef.current) levelRef.current = def.levels[Math.floor(Math.random() * def.levels.length)];

  if (!rounds && !missing) return <div className="text-center text-sm text-emerald-300 p-6">よみこみ中…</div>;
  if (!def) return <div className="text-emerald-400 text-sm font-bold p-4 text-center">まだ ない もんだいです（{data.app}/{data.round}）</div>;

  const finish = (ok: boolean) => { if (done.current) return; done.current = true; onComplete(ok); };
  const { Round } = def;
  return (
    <div className="app-paper rounded-2xl text-left">
      <Round level={levelRef.current} onResult={(perfect) => finish(perfect)} onMiss={() => finish(false)} />
    </div>
  );
};

export default AppRoundHost;
