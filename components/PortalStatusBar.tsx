/**
 * メニューの上に出す「スタミナ」と「町」の帯（学級ポータル）。
 * スタミナは文字で出す（共通の数・共通だけでバトルあと何回）。町のスタミナは単元アプリの正解と本番テストの点数でたまる。どの町が あと何で開くかは 子ども用ハブで くわしく見られる。
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
      <button onClick={() => setOpen((v) => !v)} className="w-full hud-panel rounded-xl px-4 py-2 text-left">
        <span className="flex items-center gap-3">
          <span className="text-amber-300 font-black text-sm shrink-0">スタミナ</span>
          <span className="text-amber-100 font-bold text-sm tabular-nums shrink-0">
            共通 {portal.student ? portal.stamina : '—'}<span className="text-amber-200/60"> / {SANMON_RULES.maxStamina}</span>
          </span>
          <span className="flex-1 h-2 rounded-full bg-black/50 overflow-hidden border border-amber-400/30">
            <span className="block h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-emerald-300 font-black text-xs shrink-0">ひらいた町 {openCount}/{portal.units.length}</span>
        </span>
        {portal.student && (
          <span className="mt-0.5 block text-[11px] text-amber-100/80">
            町のスタミナは 町ごと（ぼうけんの マップで 見られるよ）。<b className="text-emerald-300">▶ 共通だけで バトル あと {Math.floor(portal.stamina / SANMON_RULES.battleCost)}回</b>
            <span className="text-amber-100/50">　タップで くわしく</span>
          </span>
        )}
      </button>
      {open && (
        <div className="mt-2 hud-panel rounded-xl p-3 text-xs text-gray-200 space-y-2">
          {portal.student ? (
            <p>
              きょう たまった スタミナ：<b className="text-amber-300">{portal.earnedToday}</b>。
              スタミナは 2しゅるい。<b className="text-amber-300">町のスタミナ</b>（町ごとに {SANMON_RULES.townCap} まで・その町の ぼうけんで つかえる）：
              単元の アプリで 1問 正解すると その単元の 町に 1（1つの項目で 1日 5まで・もう熟達した項目は 半分）。アプリの ない 大きい数・折れ線グラフ・角は、SANMON の れんしゅう・ふくしゅうで 正解すると その町に 1。
              本番テスト（SANMON の テストも）：ぜんぶ（表と裏）で 100％なら 20、表だけ・裏だけは その分（その日 1回目。2・3回目は 半分）。
              実力の階段：のぼった 段 ×3（アプリごとに その日 1回目。2回目は 半分）。
              <b className="text-amber-300">共通スタミナ</b>（{SANMON_RULES.maxStamina} まで・どこでも つかえる）：実力の階段で はじめての段 +3・はじめて熟達 +2・まとめの テスト。
              スタミナに なるのは 4年の 算数だけ（国語・英語は ならないよ）。
              ぼうけんの バトル1回で {SANMON_RULES.battleCost}（町のスタミナ → 共通 の じゅん）。スピード・モンスター対戦・クラス対戦は 共通を つかう。
              れんしゅう・ふくしゅう・本番テストは スタミナなしで できるよ。
            </p>
          ) : (
            <p>
              いまは「おためし」。バトルは スタミナなしで できるけど、きろくは 先生に とどかないよ（セーブも べつ）。
              がっきゅうコードを 入れると、スタミナと 町が つかえるよ（はじめの画面の「がっきゅうコード」から）。
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {portal.units.map((u) => (
              <div key={u.key} className={`rounded-lg px-2 py-1.5 border ${u.open ? 'border-emerald-400/50 bg-emerald-900/30 text-emerald-100' : 'border-white/10 bg-black/30 text-gray-400'}`}>
                <div className="font-bold truncate">{u.open ? '🔓' : '🔒'} {u.name}</div>
                {portal.student && u.key in portal.towns && <div className="text-[10px] text-amber-200/80 tabular-nums">町のスタミナ {portal.towns[u.key] ?? 0}/{SANMON_RULES.townCap} ▶ バトル あと {Math.floor(((portal.towns[u.key] ?? 0) + portal.stamina) / SANMON_RULES.battleCost)}回</div>}
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
