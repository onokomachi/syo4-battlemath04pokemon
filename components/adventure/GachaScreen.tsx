/**
 * GachaScreen.tsx — ガチャガチャ「サンスウカプセル」とシール帳。
 *
 * きまりは data/adventure/gacha.ts。画面では、確率をすべて見せ、天井まであと何回かを出す。
 * カプセルの演出は「開くだけ」にして、あと少しで当たりだったように見せる演出(ニアミス)は入れない。
 */
import React, { useState } from 'react';
import { Panel } from './MenuScreens';
import { useAdventureStore } from '../../store/adventureStore';
import { ITEMS } from '../../data/adventure/adventureTypes';
import { ELEMENTS } from '../../data/adventure/elements';
import {
  GACHA_ITEM_TABLE, GACHA_RULES, LEARNING_REWARDS, RARITY_LABEL, STICKERS, STICKER_WEIGHT, type GachaPrize,
} from '../../data/adventure/gacha';

const RARITY_COLOR: Record<string, string> = { N: '#64748b', R: '#0ea5e9', SR: '#f59e0b' };

export const GachaScreen: React.FC<{
  onClose: () => void;
  mathPoints: number;
  /** MPを払う。払えたら true */
  onSpendMathPoints: (n: number) => boolean;
}> = ({ onClose, mathPoints, onSpendMathPoints }) => {
  const save = useAdventureStore(s => s.save);
  const pullGacha = useAdventureStore(s => s.pullGacha);
  const mpPullsLeft = useAdventureStore(s => s.mpPullsLeft);
  const [tab, setTab] = useState<'gacha' | 'book' | 'odds'>('gacha');
  const [opening, setOpening] = useState(false);
  const [prize, setPrize] = useState<GachaPrize | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const g = save.gacha;
  const coins = g?.coins ?? 0;
  const sinceSticker = g?.sinceSticker ?? 0;
  const untilPity = Math.max(1, GACHA_RULES.pity - sinceSticker);
  const mpLeft = mpPullsLeft();
  const stickers = g?.stickers ?? {};
  const ownedKinds = STICKERS.filter(s => (stickers[s.id] ?? 0) > 0).length;

  const pull = (method: 'coin' | 'mp') => {
    if (opening) return;
    setNotice(null);
    if (method === 'mp') {
      if (mpLeft <= 0) { setNotice(`MPで まわせるのは 1日 ${GACHA_RULES.mpPullsPerDay}回までだよ`); return; }
      if (mathPoints < GACHA_RULES.mpCost) { setNotice('MPが たりないよ'); return; }
      if (!onSpendMathPoints(GACHA_RULES.mpCost)) { setNotice('MPが たりないよ'); return; }
    }
    const r = pullGacha(method);
    if (!('prize' in r)) { setNotice(r.reason); return; }
    const got = r.prize;
    setPrize(null);
    setOpening(true);
    window.setTimeout(() => { setOpening(false); setPrize(got); }, 900);
  };

  const prizeView = (p: GachaPrize) => {
    if (p.kind === 'item') {
      const it = ITEMS[p.item];
      return { icon: it.icon, title: `${it.name} ×${p.count}`, sub: it.description };
    }
    return {
      icon: p.sticker.icon,
      title: p.sticker.name,
      sub: p.duplicate ? 'もう もっている シール。かさなって キラキラに なった！' : 'あたらしい シールを シール帳に はった！',
    };
  };

  const itemOdds = GACHA_ITEM_TABLE.map(p => ({ ...p, pct: p.weight }));

  return (
    <Panel title="🎰 サンスウカプセル" onClose={onClose} accent="#db2777">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex gap-2">
          {([['gacha', 'まわす'], ['book', `シール帳 ${ownedKinds}/${STICKERS.length}`], ['odds', 'かくりつ']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-3 rounded-2xl font-black text-base ${tab === k ? 'bg-white text-pink-600' : 'bg-white/20 text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'gacha' && (
          <div className="rounded-3xl bg-white p-4 sm:p-6 space-y-4 text-center">
            <div className="flex justify-center gap-3 flex-wrap text-sm font-black">
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700">🪙 コイン {coins}まい</span>
              <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-700">MP {mathPoints.toLocaleString()}</span>
              <span className="px-3 py-1 rounded-full bg-pink-100 text-pink-700">あと {untilPity}回で かならず シール</span>
            </div>

            <div className="h-40 flex items-center justify-center">
              {opening ? (
                <div className="text-7xl animate-bounce" aria-label="カプセルが ころがっている">🔮</div>
              ) : prize ? (
                <div className="space-y-1">
                  <div className="text-7xl">{prizeView(prize).icon}</div>
                  <p className="text-xs font-black" style={{ color: RARITY_COLOR[prize.rarity] }}>{RARITY_LABEL[prize.rarity]}</p>
                  <p className="text-xl font-black text-slate-800">{prizeView(prize).title}</p>
                  <p className="text-xs font-bold text-slate-500 max-w-sm mx-auto">{prizeView(prize).sub}</p>
                </div>
              ) : (
                <div className="text-7xl">🎰</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => pull('coin')}
                disabled={opening || coins <= 0}
                className="py-4 rounded-2xl bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-amber-950 font-black text-lg active:scale-95"
              >
                🪙 コインで まわす
                <span className="block text-xs font-bold">1まい</span>
              </button>
              <button
                onClick={() => pull('mp')}
                disabled={opening || mpLeft <= 0 || mathPoints < GACHA_RULES.mpCost}
                className="py-4 rounded-2xl bg-violet-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-lg active:scale-95"
              >
                MPで まわす
                <span className="block text-xs font-bold">{GACHA_RULES.mpCost} MP（きょう あと {mpLeft}回）</span>
              </button>
            </div>
            {notice && <p className="text-sm font-black text-rose-600">{notice}</p>}

            <div className="text-left rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600 space-y-1">
              <p className="font-black text-slate-700">🪙 コインの もらいかた</p>
              <p>・きょう はじめて もんだいに せいかいする（{LEARNING_REWARDS.coinFirstCorrectOfDay}まい）</p>
              <p>・はじめて 熟達する（5もん れんぞく せいかい・{LEARNING_REWARDS.coinNewMastery}まい）</p>
              <p>・町の マスターに はじめて かつ（{LEARNING_REWARDS.coinMasterWin}まい）</p>
              <p>コインは 1日 {LEARNING_REWARDS.dailyMax.coin}まいまで（マスターの ぶんは べつ）。</p>
            </div>
          </div>
        )}

        {tab === 'book' && (
          <div className="rounded-3xl bg-white p-4 space-y-3">
            <p className="text-sm font-bold text-slate-500">あつめた シールを ながめよう。おなじ シールが かさなると キラキラに なるよ。</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {STICKERS.map(st => {
                const n = stickers[st.id] ?? 0;
                return (
                  <div
                    key={st.id}
                    className="rounded-2xl border-4 p-2 text-center"
                    style={{ borderColor: n > 0 ? ELEMENTS[st.type].color : '#e2e8f0', background: n > 1 ? '#fffbeb' : '#fff' }}
                  >
                    <div className={`text-4xl ${n > 0 ? '' : 'grayscale opacity-20'}`}>{st.icon}</div>
                    <p className="text-[11px] font-black text-slate-700 leading-tight mt-1">{n > 0 ? st.name : '？？？'}</p>
                    {n > 1 && <p className="text-[10px] font-black text-amber-500">✨ キラ ×{n}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'odds' && (
          <div className="rounded-3xl bg-white p-4 space-y-3">
            <p className="text-sm font-bold text-slate-600">1回 まわしたときに 出る かくりつ（ぜんぶで 100％）</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500"><th className="py-1">しゅるい</th><th>なかみ</th><th className="text-right">かくりつ</th></tr>
              </thead>
              <tbody className="font-bold text-slate-700">
                {itemOdds.map(p => (
                  <tr key={p.item} className="border-t border-slate-100">
                    <td className="py-1.5" style={{ color: RARITY_COLOR[p.rarity] }}>{RARITY_LABEL[p.rarity]}</td>
                    <td>{ITEMS[p.item].icon} {ITEMS[p.item].name} ×{p.count}</td>
                    <td className="text-right tabular-nums">{p.pct}％</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-100">
                  <td className="py-1.5" style={{ color: RARITY_COLOR.SR }}>{RARITY_LABEL.SR}</td>
                  <td>シール（{STICKERS.length}しゅるいの どれか。まだ もっていない シールは 2ばい 出やすい）</td>
                  <td className="text-right tabular-nums">{STICKER_WEIGHT}％</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs font-bold text-slate-500">
              シールが {GACHA_RULES.pity - 1}回 つづけて 出なかったら、つぎの 1回は かならず シール。
              そのため、ならすと 7回に 1回くらい シールが 出るよ。
              シールを ぜんぶ あつめても、とくべつな ごほうびは ないよ（ながめて たのしむ ための シールだよ）。
              お金では まわせないよ。
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
};
