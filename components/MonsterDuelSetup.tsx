/**
 * MonsterDuelSetup.tsx — モンスター対戦の設定画面（パーティを3匹か5匹えらぶ）
 *
 * 2026-10〜 HPのある対戦（data/partyDuel.ts）。ぼうけんでつかまえたモンスターを、レベルごと連れていく。
 * 強さはレベル（＝そのモンスターの問題を練習した量）で決まる。問題は場に出ている2匹の分野から交互に出る。
 * 伝説・幻は分野が無い（問題が出せない）ので連れていけない。
 * つかまえたモンスターが パーティの数に たりないときは、さいしょの3体を かりられる（CPU 戦だけ。data/adventure/starters.ts）。
 * あいて（CPU）は data/partyDuel.ts の cpuParty が、こちらと同じ単元・同じくらいのレベルで くむ。
 */
import React, { useMemo, useState } from 'react';
import { useAdventureStore } from '../store/adventureStore';
import { getMonster, getMonsterSprite, statsAtLevel } from '../data/adventure/monsters';
import { ELEMENTS } from '../data/adventure/elements';
import { PARTY_DUEL, type PartySize } from '../data/partyDuel';
import { BackIcon } from './Icons';
import { isRentalUid, rentalMonsters } from '../data/adventure/starters';

interface MonsterDuelSetupProps {
  onStart: (uids: string[], size: PartySize, mode: 'cpu' | 'pvp') => void;
  onBack: () => void;
  /** 学級コードで名乗っていれば、同じ学級の友だちと対戦できる（クラス対戦） */
  pvpReady: boolean;
  /** 先生が開いているか（PRISM で学級ごとに決める） */
  cpuOpen?: boolean;
  classDuelOpen?: boolean;
  /** 閉じているときの文（平日モードなら「じゅぎょうの じかん」） */
  cpuLockText?: string | null;
  classDuelLockText?: string | null;
}

const MonsterDuelSetup: React.FC<MonsterDuelSetupProps> = ({ onStart, onBack, pvpReady, cpuOpen = true, classDuelOpen = true, cpuLockText, classDuelLockText }) => {
  const owned = useAdventureStore(s => s.save.owned);
  const partyUids = useAdventureStore(s => s.save.party);

  // つれていけるモンスター（分野のあるもの）。レベルの高い順。たりなければ、さいしょの3体を かりた なかまとして うしろに足す
  const candidates = useMemo(() => {
    const mine = owned
      .map(o => ({ o, def: getMonster(o.defId), rental: false }))
      .filter((x): x is { o: typeof owned[number]; def: NonNullable<ReturnType<typeof getMonster>>; rental: boolean } => !!x.def && !!x.def.subtopic)
      .sort((a, b) => b.o.level - a.o.level);
    if (mine.length >= Math.max(...PARTY_DUEL.sizes)) return mine;
    const rentals = rentalMonsters(owned)
      .map(o => ({ o, def: getMonster(o.defId)!, rental: true }))
      .filter(x => !!x.def);
    return [...mine, ...rentals];
  }, [owned]);
  const ownCount = candidates.filter(c => !c.rental).length;

  const [size, setSize] = useState<PartySize>(3);
  const [picked, setPicked] = useState<string[]>(() => {
    const fromParty = partyUids.filter(uid => candidates.some(c => c.o.uid === uid));
    const rest = candidates.map(c => c.o.uid).filter(uid => !fromParty.includes(uid));
    return [...fromParty, ...rest].slice(0, 3);
  });

  const togglePick = (uid: string) => {
    setPicked(prev => {
      if (prev.includes(uid)) return prev.filter(x => x !== uid);
      if (prev.length >= size) return prev;
      return [...prev, uid];
    });
  };

  const changeSize = (s: PartySize) => {
    setSize(s);
    setPicked(prev => {
      if (prev.length > s) return prev.slice(0, s);
      const rest = candidates.map(c => c.o.uid).filter(uid => !prev.includes(uid));
      return [...prev, ...rest].slice(0, s);
    });
  };

  const ready = picked.length === size;
  // かりた なかまが いると クラス対戦には出られない（クラス対戦のレベルは サーバのセーブから読むため）
  const usesRental = picked.some(isRentalUid);
  const handleStart = (mode: 'cpu' | 'pvp') => { if (ready) onStart(picked, size, mode); };

  if (candidates.length < 3) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-6xl mb-4">🐾</div>
        <h2 className="text-2xl font-black mb-2">モンスターが あと {3 - candidates.length}匹 いるよ</h2>
        <p className="text-sm text-gray-400 mb-8 max-w-sm">
          ぼうけんモードで モンスターを 3匹 つかまえると、パーティを くんで 対戦できるようになります。
        </p>
        <button onClick={onBack} className="btn-tactical px-8 py-3 rounded-xl text-sm font-bold">もどる</button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center p-4 text-white relative overflow-y-auto">
      <div className="w-full max-w-2xl relative z-10">
        <div className="flex items-center gap-4 mb-5">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors p-2" aria-label="もどる">
            <BackIcon className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black tracking-wider flex items-center gap-3">
              <span className="text-emerald-400">🐾</span>
              <span className="text-hologram">モンスター対戦</span>
            </h2>
            <p className="text-xs text-emerald-400 font-bold mt-1">パーティを くんで、あいての モンスターを ぜんぶ たおそう</p>
          </div>
        </div>

        <div className="hud-panel rounded-xl p-4 mb-4 border border-emerald-800/30">
          <h3 className="text-sm font-bold text-emerald-400 tracking-widest mb-3">なんびきで たたかう？</h3>
          <div className="grid grid-cols-2 gap-3">
            {PARTY_DUEL.sizes.map(s => (
              <button key={s} onClick={() => changeSize(s)} disabled={candidates.length < s}
                className={`p-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 ${size === s ? 'border-emerald-500/60 bg-emerald-900/20' : 'border-slate-700/30 bg-slate-900/30'}`}>
                <div className={`text-base font-black ${size === s ? 'text-emerald-300' : 'text-gray-400'}`}>{s}匹</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{s === 3 ? 'やく5分' : 'やく10分'}{candidates.length < s ? `（あと${s - candidates.length}匹 つかまえよう）` : ownCount < s ? '（かりた なかまで CPU対戦）' : ''}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="hud-panel rounded-xl p-4 mb-4 border border-emerald-800/30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-emerald-400 tracking-widest">パーティ（えらんだ じゅんに たたかう）</h3>
            <span className="text-[11px] text-gray-400 font-bold">{picked.length}/{size}匹</span>
          </div>
          <div className="flex gap-2 mb-3 min-h-[3.5rem]">
            {picked.map((uid, i) => {
              const c = candidates.find(x => x.o.uid === uid);
              return c && (
                <button key={uid} onClick={() => togglePick(uid)} className="flex flex-col items-center w-16" title="もういちど おすと はずす">
                  <img src={getMonsterSprite(c.def.id)} alt="" className="w-10 h-10 object-contain" />
                  <span className="text-[9px] font-bold text-emerald-200 truncate w-full text-center">{i + 1}. {c.def.name}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
            {candidates.map(({ o, def, rental }) => {
              const isSelected = picked.includes(o.uid);
              const el = ELEMENTS[def.type];
              const st = statsAtLevel(def, o.level);
              return (
                <button key={o.uid} onClick={() => togglePick(o.uid)}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-all ${isSelected ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-slate-900/30 border-slate-700/20 hover:border-gray-600'}`}
                  title={def.subtopic}>
                  <img src={getMonsterSprite(def.id)} alt="" className="w-12 h-12 object-contain" />
                  <span className={`text-[10px] font-bold truncate w-full text-center ${isSelected ? 'text-emerald-200' : 'text-gray-300'}`}>{def.name}</span>
                  <span className="text-[10px] font-black text-white">Lv.{o.level}</span>
                  <span className="text-[9px] text-gray-500">HP {st.maxHp}・こうげき {st.atk}</span>
                  <span className="text-[9px]" style={{ color: el.color }}>{el.icon} {el.name}</span>
                  {rental && <span className="text-[9px] font-black text-amber-300">かりた なかま</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hud-panel rounded-xl p-4 mb-5 border border-slate-700/30">
          <h3 className="text-[10px] font-bold text-gray-500 tracking-widest mb-2">ルール</h3>
          <ul className="space-y-1 text-[11px] text-gray-400">
            <li>• 2人に 同じ もんだい。場に 出ている 2匹の 分野から こうたいで 出るよ</li>
            <li>• せいかいすると こうげき！ 2人とも せいかいなら 2人とも こうげき（はやい方が すこし つよい）</li>
            <li>• HPが 0に なったら つぎの モンスター。あいてを ぜんぶ たおしたら かち</li>
            <li>• レベルが 高いほど つよい（そのモンスターの もんだいを とくと そだつ）。タイプの あいしょうも あるよ</li>
            <li>• まちがえが つづいても、つぎに せいかいすると「がんばりパワー」で つよい こうげきに なる</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4 pb-4">
          <button onClick={() => handleStart('cpu')} disabled={!ready || !cpuOpen}
            className="btn-tactical py-5 rounded-2xl font-bold tracking-[0.15em] text-base disabled:opacity-40">
            <div className="text-lg font-black">CPU対戦</div>
            <div className="text-[10px] text-emerald-400 opacity-70 mt-1">{cpuOpen ? 'コンピュータと たいせん' : (cpuLockText ?? '🔒 先生が まだ ひらいていないよ')}</div>
          </button>
          <button onClick={() => handleStart('pvp')} disabled={!ready || !pvpReady || !classDuelOpen || usesRental}
            className="btn-tactical py-5 rounded-2xl font-bold tracking-[0.15em] text-base disabled:opacity-40">
            <div className="text-lg font-black">クラス対戦</div>
            <div className="text-[10px] text-emerald-400 opacity-70 mt-1">
              {!classDuelOpen ? (classDuelLockText ?? '🔒 先生が まだ ひらいていないよ') : !pvpReady ? 'がっきゅうコードを 入れると あそべるよ' : usesRental ? 'かりた なかまでは 出られないよ' : '同じ学級の ともだちと'}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonsterDuelSetup;
