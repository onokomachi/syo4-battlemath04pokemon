/**
 * メニューの上に出す「スタミナ」と「町」の帯（学級ポータル）。
 * スタミナは単元アプリで正解するとたまる。どの町が あと何で開くかは 子ども用ハブで くわしく見られる。
 */
import React, { useState } from 'react';
import { SANMON_RULES } from 'learning-app-kit/sanmon';
import type { SanmonPortal } from '../hooks/useSanmonPortal';

const PortalStatusBar: React.FC<{ portal: SanmonPortal }> = ({ portal }) => {
  const [open, setOpen] = useState(false);
  const pct = Math.min(100, (portal.stamina / SANMON_RULES.maxStamina) * 100);
  const openCount = portal.units.filter((u) => u.open).length;
  return (
    <div className="relative z-30 w-full max-w-3xl mx-auto px-3 pt-3">
      <button onClick={() => setOpen((v) => !v)} className="w-full hud-panel rounded-xl px-4 py-2 flex items-center gap-3 text-left">
        <span className="text-amber-300 font-black text-sm shrink-0">⚡ スタミナ</span>
        <span className="flex-1 h-2.5 rounded-full bg-black/50 overflow-hidden border border-amber-400/30">
          <span className="block h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-amber-200 font-black tabular-nums text-sm shrink-0">{portal.student ? portal.stamina : '—'}</span>
        <span className="text-emerald-300 font-black text-xs shrink-0">🗺 {openCount}/{portal.units.length}</span>
      </button>
      {open && (
        <div className="mt-2 hud-panel rounded-xl p-3 text-xs text-gray-200 space-y-2">
          {portal.student ? (
            <p>
              きょう たまった スタミナ：<b className="text-amber-300">{portal.earnedToday}</b> / {SANMON_RULES.dailyCap}。
              単元の アプリで 1問 正解すると 1 たまるよ（ためられるのは {SANMON_RULES.maxStamina} まで）。
              バトル1回で {SANMON_RULES.battleCost} つかう。れんしゅう・ふくしゅう・本番テストは スタミナなしで できるよ。
            </p>
          ) : (
            <p>がっきゅうコードを 入れると、スタミナと 町が つかえるよ（右下の「がっきゅうコードを 入れる」）。</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {portal.units.map((u) => (
              <div key={u.key} className={`rounded-lg px-2 py-1.5 border ${u.open ? 'border-emerald-400/50 bg-emerald-900/30 text-emerald-100' : 'border-white/10 bg-black/30 text-gray-400'}`}>
                <div className="font-bold truncate">{u.open ? '🔓' : '🔒'} {u.name}</div>
                {!u.open && u.practice && (
                  <div className="text-[10px] mt-0.5 tabular-nums">
                    練習{u.practice.have}/{u.practice.need}・テスト{u.test!.have}/{u.test!.need}・階段{u.trial!.have}/{u.trial!.need}・{u.days!.have}/{u.days!.need}日
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalStatusBar;
