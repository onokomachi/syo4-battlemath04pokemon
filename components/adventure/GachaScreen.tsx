/**
 * GachaScreen.tsx — ガチャガチャ「サンスウカプセル」とシール帳。
 *
 * きまりは data/adventure/gacha.ts。画面では、確率をすべて見せ、天井まであと何回かを出す。
 * カプセルの演出は「開くだけ」にして、あと少しで当たりだったように見せる演出(ニアミス)は入れない。
 * ぼうけんの ショップ（MenuScreens の ShopScreen）からだけ開く。
 * シール帳は、図鑑のモンスターのシール。持っているシールは、絵と「生態」（図鑑の説明）だけが見られる。
 */
import React, { useMemo, useState } from 'react';
import { Panel } from './MenuScreens';
import { useAdventureStore } from '../../store/adventureStore';
import { ITEMS } from '../../data/adventure/adventureTypes';
import { ELEMENTS } from '../../data/adventure/elements';
import { getMonsterSprite } from '../../data/adventure/monsters';
import {
  GACHA_ITEM_TABLE, GACHA_RULES, LEARNING_REWARDS, RARITY_LABEL, STICKERS, STICKER_TIERS, STICKER_TIER_WEIGHT,
  STICKER_WEIGHT, stickersOfTier, type GachaPrize, type StickerDef, type StickerTier,
} from '../../data/adventure/gacha';

const RARITY_COLOR: Record<string, string> = {
  N: '#64748b', R: '#0ea5e9', normal: '#16a34a', rare: '#7c3aed', super: '#ea580c', legend: '#d97706',
};

/** シール帳のなかの説明（何のシールか） */
const TIER_NOTE: Record<StickerTier, string> = {
  normal: 'モンスター', rare: '進化した すがた', super: '単元ボス', legend: '伝説・幻',
};

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
  const [bookTier, setBookTier] = useState<StickerTier>('normal');
  const [detail, setDetail] = useState<StickerDef | null>(null);
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
  const bookList = useMemo(() => stickersOfTier(bookTier), [bookTier]);

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
      return { icon: <span>{it.icon}</span>, title: `${it.name} ×${p.count}`, sub: it.description };
    }
    return {
      icon: <img src={getMonsterSprite(p.sticker.id)} alt="" className="w-28 h-28 object-contain mx-auto" />,
      title: `${p.sticker.name} の シール`,
      sub: p.duplicate ? 'もう もっている シール。かさなって キラキラに なった！' : 'あたらしい シールを シール帳に はった！ シール帳で 生態が 読めるよ',
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
            <p className="text-sm font-bold text-slate-500">
              あつめた シールを おすと、その モンスターの 生態が 読めるよ。おなじ シールが かさなると キラキラに なるよ。
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {STICKER_TIERS.map(t => {
                const list = stickersOfTier(t);
                const got = list.filter(x => (stickers[x.id] ?? 0) > 0).length;
                return (
                  <button key={t} onClick={() => setBookTier(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-black border-2 ${bookTier === t ? 'text-white' : 'bg-white'}`}
                    style={{ borderColor: RARITY_COLOR[t], background: bookTier === t ? RARITY_COLOR[t] : undefined, color: bookTier === t ? '#fff' : RARITY_COLOR[t] }}>
                    {RARITY_LABEL[t]}（{TIER_NOTE[t]}） {got}/{list.length}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {bookList.map(st => {
                const n = stickers[st.id] ?? 0;
                return (
                  <button
                    key={st.id}
                    onClick={() => n > 0 && setDetail(st)}
                    disabled={n === 0}
                    className="rounded-2xl border-4 p-1.5 text-center"
                    style={{ borderColor: n > 0 ? ELEMENTS[st.type].color : '#e2e8f0', background: n > 1 ? '#fffbeb' : '#fff' }}
                  >
                    <img src={getMonsterSprite(st.id)} alt="" loading="lazy"
                      className={`w-full aspect-square object-contain ${n > 0 ? '' : 'brightness-0 opacity-15'}`} />
                    <p className="text-[10px] font-black text-slate-700 leading-tight mt-0.5 truncate">{n > 0 ? st.name : '？？？'}</p>
                    {n > 1 && <p className="text-[9px] font-black text-amber-500">✨ ×{n}</p>}
                  </button>
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
                {STICKER_TIERS.map(t => (
                  <tr key={t} className="border-t border-slate-100">
                    <td className="py-1.5" style={{ color: RARITY_COLOR[t] }}>{RARITY_LABEL[t]}</td>
                    <td>{TIER_NOTE[t]}の シール（{stickersOfTier(t).length}しゅるいの どれか）</td>
                    <td className="text-right tabular-nums">{STICKER_TIER_WEIGHT[t]}％</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs font-bold text-slate-500">
              シールは あわせて {STICKER_WEIGHT}％。まだ もっていない シールは、おなじ めずらしさの なかで 2ばい 出やすい。
              シールが {GACHA_RULES.pity - 1}回 つづけて 出なかったら、つぎの 1回は かならず シール（めずらしさは 上の わりあいの とおり）。
              シールで モンスターが なかまに なることは ないよ。
              シールを ぜんぶ あつめても、とくべつな ごほうびは ないよ（ながめて たのしむ ための シールだよ）。
              お金では まわせないよ。
            </p>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl border-8"
            style={{ borderColor: ELEMENTS[detail.type].color }} onClick={e => e.stopPropagation()}>
            <p className="text-xs font-black" style={{ color: RARITY_COLOR[detail.tier] }}>{RARITY_LABEL[detail.tier]}（{TIER_NOTE[detail.tier]}）</p>
            <img src={getMonsterSprite(detail.id)} alt="" className="w-44 h-44 object-contain mx-auto my-2" />
            <p className="text-2xl font-black text-slate-800">{detail.name}</p>
            <p className="text-[11px] font-black text-slate-400 mt-2">せいたい</p>
            <p className="text-sm font-bold text-slate-600 leading-relaxed">{detail.flavor}</p>
            {(stickers[detail.id] ?? 0) > 1 && <p className="text-xs font-black text-amber-500 mt-2">✨ キラ ×{stickers[detail.id]}</p>}
            <button onClick={() => setDetail(null)} className="mt-4 px-8 py-2.5 rounded-2xl bg-slate-800 text-white font-black">とじる</button>
          </div>
        </div>
      )}
    </Panel>
  );
};
