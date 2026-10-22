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

type Registry = Record<string, Record<string, AppRoundDef>>;
let registry: Registry | null = null;
let loading: Promise<Registry> | null = null;
const loadRegistry = () => {
  if (registry) return Promise.resolve(registry);
  loading ??= import('../../apps/registry').then((m) => (registry = m.APP_ROUNDS));
  return loading;
};

const AppRoundHost: React.FC<{ data: GuidedAppRoundData; onComplete: (isCorrect: boolean) => void }> = ({ data, onComplete }) => {
  const [reg, setReg] = useState<Registry | null>(registry);
  const done = useRef(false);
  useEffect(() => { if (!reg) void loadRegistry().then(setReg); }, [reg]);

  const def = reg?.[data.app]?.[data.round];
  // レベルは問題ごとに1つだけ選ぶ（マウントのたびに新しい問題になる。再描画では変えない）
  const levelRef = useRef('');
  if (def && !levelRef.current) levelRef.current = def.levels[Math.floor(Math.random() * def.levels.length)];

  if (!reg) return <div className="text-center text-sm text-emerald-300 p-6">よみこみ中…</div>;
  if (!def) return <div className="text-red-400 text-sm font-bold p-4 text-center">まだ ない もんだいです（{data.app}/{data.round}）</div>;

  const finish = (ok: boolean) => { if (done.current) return; done.current = true; onComplete(ok); };
  const { Round } = def;
  return (
    <div className="app-paper rounded-2xl text-left">
      <Round level={levelRef.current} onResult={(perfect) => finish(perfect)} onMiss={() => finish(false)} />
    </div>
  );
};

export default AppRoundHost;
