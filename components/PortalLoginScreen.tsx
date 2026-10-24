/**
 * はじめの画面（学級ポータル版）。
 * 名乗りは 学級コード＋出席番号（learning-app-kit の JoinSettingsRow）。氏名・Googleアカウントは使わない。
 * コードを入れなくても（おためし）れんしゅうも バトルも できる。記録は サーバに残らず、セーブも学級とは別（services/saveProfile.ts）。
 * おためしで開く町は、単元アプリの いらない町だけ（学級と同じ）。スタミナは使わない。
 */
import React from 'react';
import { JoinSettingsRow } from 'learning-app-kit/react';
import { SANMON_RULES } from 'learning-app-kit/sanmon';
import type { SanmonPortal } from '../hooks/useSanmonPortal';
import { PORTAL, isPortalConfigured } from '../services/portal';

interface Props {
  portal: SanmonPortal;
  onStart: () => void;
}

const PortalLoginScreen: React.FC<Props> = ({ portal, onStart }) => {
  const openCount = portal.units.filter((u) => u.open).length;
  return (
    <div className="w-full h-full flex flex-col items-center justify-start sm:justify-center p-4 pt-8 sm:pt-4 text-white relative overflow-y-auto">
      <div className="absolute inset-0 bg-gradient-radial from-emerald-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="text-center mb-8 sm:mb-12 relative">
        <div className="absolute -inset-20 bg-emerald-600/15 blur-[120px] rounded-full animate-pulse" />
        <h1 className="text-5xl md:text-8xl font-black text-hologram mb-4 tracking-[0.02em] pr-[0.1em]">SANMON:04</h1>
        <div className="flex items-center justify-center gap-6 mb-2">
          <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
          <p className="text-xs md:text-sm text-emerald-300 font-bold tracking-[0.3em] opacity-80">4年生の算数 まるごと学習ゲーム</p>
          <div className="h-[1px] w-20 bg-gradient-to-l from-transparent via-emerald-500 to-transparent" />
        </div>
        <p className="text-xs text-emerald-500/60 font-mono tracking-widest">単元の アプリで がんばると、町が ひらいて スタミナが たまる!</p>
      </div>

      <div className="w-full max-w-md hud-panel rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-5">
        {portal.student ? (
          <>
            <div className="text-center">
              <p className="text-xs text-emerald-400 tracking-wide font-bold">がっきゅうコード {portal.student.joinCode}</p>
              <p className="text-2xl font-black text-white">{portal.student.number} ばん</p>
            </div>
            <div className="flex gap-4 text-center">
              <div className="hud-panel rounded-lg px-4 py-2">
                <p className="text-xs text-amber-300 font-bold">スタミナ</p>
                <p className="text-2xl font-black text-amber-300 tabular-nums">{portal.loaded ? portal.stamina : '…'}<span className="text-xs text-amber-200/70"> / {SANMON_RULES.maxStamina}</span></p>
              </div>
              <div className="hud-panel rounded-lg px-4 py-2">
                <p className="text-xs text-emerald-400 font-bold">ひらいた町</p>
                <p className="text-2xl font-black text-white tabular-nums">{openCount}<span className="text-xs text-emerald-200/70"> / {portal.units.length}</span></p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-200 mb-1">がっきゅうコードと 出席番号を 入れよう</p>
            <p className="text-xs text-gray-400">入れると、単元の アプリで がんばった分が スタミナになって、町が ひらくよ</p>
          </div>
        )}

        <button onClick={onStart} className="w-full btn-tactical py-4 rounded-xl text-xl tracking-[0.3em] font-bold">
          ゲームスタート
        </button>

        {isPortalConfigured && (
          <div className="w-full bg-white rounded-xl p-2">
            <JoinSettingsRow config={PORTAL} />
          </div>
        )}
        {!portal.student && (
          <p className="text-[11px] text-gray-500 text-center leading-relaxed">
            コードを 入れなくても「おためし」で れんしゅうも バトルも できるよ。
            ただし きろくは 先生に とどかないし、おためしの セーブは コードを 入れると べつになるよ。
          </p>
        )}
      </div>
    </div>
  );
};

export default PortalLoginScreen;
