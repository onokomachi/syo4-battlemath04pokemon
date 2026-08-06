/**
 * MenuScreens.tsx — 図鑑・てもち・マップ・ショップ。
 *
 * どれも「フィールドの上にかぶせて開く」画面。iPadを横に持ったときに
 * 指がとどく位置に大きなボタンを置き、文字も大きめにしている。
 */
import React, { useMemo, useState } from 'react';
import {
  MONSTER_DEX, LEGEND_DEX, getMonster, getMonsterSprite, statsAtLevel, expToNext,
} from '../../data/adventure/monsters';
import { ELEMENTS, getStrongAgainst, getWeakAgainst } from '../../data/adventure/elements';
import { TOWNS, BADGE_NAMES } from '../../data/adventure/towns';
import { LEAGUE_TOWN } from '../../data/adventure/league';
import { ABILITIES, ITEMS, type ItemId } from '../../data/adventure/adventureTypes';
import {
  useAdventureStore, dexProgress, getPartyMonsters,
  adventureStats, earnedAdventureTitles, nextAdventureTitles, adventureRank, gymProgress,
  spriteIdFor, displayNameFor,
} from '../../store/adventureStore';
import { ADVENTURE_TITLES } from '../../data/adventure/ranks';
import { getPlayerSprite } from '../../data/adventure/people';

export const Panel: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; accent?: string }> = ({
  title, onClose, children, accent = '#0ea5e9',
}) => (
  <div className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm flex flex-col">
    <header
      className="shrink-0 flex items-center justify-between px-4 py-3 shadow-lg"
      style={{ backgroundColor: accent }}
    >
      <h2 className="text-white text-2xl sm:text-3xl font-black">{title}</h2>
      <button
        onClick={onClose}
        className="px-6 py-2.5 rounded-2xl bg-white/95 text-slate-800 font-black text-lg shadow active:scale-95"
      >
        とじる ✕
      </button>
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">{children}</div>
  </div>
);

// ============================================================
// 図鑑
// ============================================================

export const DexScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const save = useAdventureStore(s => s.save);
  const [unit, setUnit] = useState<string>('all');
  const [selected, setSelected] = useState<string | null>(null);

  // save.owned(いま手持ちにいる個体)ではなく save.dexCaught(捕獲履歴・永続)を見る。
  // でないと、テキトウ団に さらわれた/リリースした だけで図鑑のマークが消えてしまう。
  const caughtIds = useMemo(() => new Set(save.dexCaught), [save.dexCaught]);
  const seenIds = useMemo(() => new Set(save.seen), [save.seen]);
  /** すでに進化させた図鑑ID(セーブは個体uidで持っているので、defIdに直す) */
  const evolvedIds = useMemo(
    () => new Set(
      save.owned.filter(o => save.evolved.includes(o.uid)).map(o => o.defId),
    ),
    [save.owned, save.evolved],
  );
  const progress = dexProgress(save);

  // 「でんせつ」タブだけは別枠。ふだんの図鑑(151体)と混ざらないようにしている。
  const list = unit === 'legend'
    ? LEGEND_DEX
    : MONSTER_DEX.filter(m => unit === 'all' || m.unit === unit);
  const detail = selected ? getMonster(selected) ?? null : null;

  return (
    <Panel title={`ずかん  ${progress.caught} / ${progress.total}`} onClose={onClose} accent="#e11d48">
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        <button
          onClick={() => setUnit('all')}
          className={`shrink-0 px-4 py-2 rounded-2xl font-black text-sm ${unit === 'all' ? 'bg-white text-slate-900' : 'bg-white/25 text-white'}`}
        >
          ぜんぶ
        </button>
        <button
          onClick={() => setUnit('legend')}
          className={`shrink-0 px-4 py-2 rounded-2xl font-black text-sm ${
            unit === 'legend' ? 'bg-amber-300 text-slate-900' : 'bg-amber-400/40 text-white'
          }`}
        >
          ✦ でんせつ
        </button>
        {TOWNS.map(t => (
          <button
            key={t.id}
            onClick={() => setUnit(t.unit)}
            className={`shrink-0 px-4 py-2 rounded-2xl font-black text-sm ${unit === t.unit ? 'bg-white text-slate-900' : 'bg-white/25 text-white'}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {unit === 'legend' && (
        <p className="text-white/90 font-bold mb-3 text-sm sm:text-base">
          単元ぜんぶを ひとまとめにした、1体しか いない モンスター。
          町の 祠を しらべると、伝承が 読める。
        </p>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2 sm:gap-3">
        {list.map(m => {
          const got = caughtIds.has(m.id);
          const seen = seenIds.has(m.id);
          const el = ELEMENTS[m.type];
          return (
            <button
              key={m.id}
              onClick={() => (seen || got) && setSelected(m.id)}
              className={`rounded-2xl p-2 border-4 transition active:scale-95 ${
                got ? 'bg-white' : seen ? 'bg-white/70' : 'bg-slate-800/60'
              }`}
              style={{ borderColor: got ? el.color : 'transparent' }}
            >
              <div className="relative aspect-square">
                <img
                  src={getMonsterSprite(m.id)}
                  alt=""
                  className="w-full h-full object-contain"
                  style={{ filter: got ? 'none' : 'brightness(0) opacity(0.45)' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.15'; }}
                />
                {got && <span className="absolute -top-1 -right-1 text-lg">⚪</span>}
              </div>
              <p className={`text-[11px] sm:text-xs font-black truncate ${got || seen ? 'text-slate-800' : 'text-white/50'}`}>
                {got || seen ? m.name : '？？？'}
              </p>
              <p className="text-[10px] font-bold text-slate-400">No.{m.no}</p>
            </button>
          );
        })}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border-8"
            style={{ borderColor: ELEMENTS[detail.type].color }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex gap-4">
              <img
                src={getMonsterSprite(detail.id)}
                alt=""
                className="w-32 h-32 sm:w-44 sm:h-44 object-contain shrink-0"
                onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-400">No.{detail.no}</p>
                <h3 className="text-3xl font-black text-slate-800">{detail.name}</h3>
                <span
                  className="inline-block mt-1 px-3 py-1 rounded-full text-white text-sm font-black"
                  style={{ backgroundColor: ELEMENTS[detail.type].color }}
                >
                  {ELEMENTS[detail.type].icon} {ELEMENTS[detail.type].name}タイプ
                </span>
                <p className="mt-2 text-sm sm:text-base font-bold text-slate-600 leading-relaxed">
                  {detail.flavor}
                </p>
              </div>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-2 text-sm font-bold">
              <div className="rounded-2xl bg-slate-100 p-3">
                <p className="text-slate-500 text-xs">でるところ</p>
                <p className="text-slate-800">{detail.unit}</p>
                <p className="text-slate-800">{detail.subtopic}</p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3">
                <p className="text-slate-500 text-xs">とくせい</p>
                <p className="text-slate-800">
                  {ABILITIES[detail.ability].icon} {ABILITIES[detail.ability].name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{ABILITIES[detail.ability].description}</p>
              </div>
            </div>
            <div className="mt-2 rounded-2xl bg-slate-100 p-3 text-sm font-bold">
              <p className="text-slate-500 text-xs mb-1">タイプ相性</p>
              <p className="text-slate-800">
                {ELEMENTS[getStrongAgainst(detail.type)].name} に つよい ／{' '}
                {ELEMENTS[getWeakAgainst(detail.type)].name} に よわい
              </p>
            </div>

            {/* 進化。「レベルではなく、その項目を解けるようになると進化する」ことを
                その場で読めるようにしておく(何をすれば進むのかを迷わせないため)。 */}
            {detail.evolution && (
              <div className="mt-2 rounded-2xl bg-amber-50 border-2 border-amber-300 p-3">
                <p className="text-amber-700 text-xs font-black mb-2">しんか</p>
                <div className="flex items-center gap-3">
                  <img
                    src={getMonsterSprite(detail.id)}
                    alt=""
                    className="w-16 h-16 object-contain shrink-0"
                    style={{ filter: caughtIds.has(detail.id) ? 'none' : 'brightness(0) opacity(0.35)' }}
                  />
                  <span className="text-2xl">➡</span>
                  <img
                    src={getMonsterSprite(detail.evolution.id)}
                    alt=""
                    className="w-20 h-20 object-contain shrink-0"
                    style={{ filter: evolvedIds.has(detail.id) ? 'none' : 'brightness(0) opacity(0.35)' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
                  />
                  <div className="min-w-0">
                    <p className="text-lg font-black text-slate-800">
                      {evolvedIds.has(detail.id) ? detail.evolution.name : '？？？'}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      「{detail.subtopic}」を 5問れんぞくで 正解すると しんかする
                    </p>
                  </div>
                </div>
                {evolvedIds.has(detail.id) && (
                  <p className="mt-2 text-xs font-bold text-slate-600">{detail.evolution.flavor}</p>
                )}
              </div>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-4 w-full py-3 rounded-2xl bg-slate-800 text-white font-black text-xl"
            >
              とじる
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
};

// ============================================================
// てもち
// ============================================================

export const PartyScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const save = useAdventureStore(s => s.save);
  const setParty = useAdventureStore(s => s.setParty);
  const party = getPartyMonsters(save);
  // いま「いれかえる」対象として選んでいる手持ちのマス(0〜2)。null なら未選択。
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  /** 手持ちの2マス(どちらも埋まっているマス)を入れかえる */
  const swapSlots = (i: number, j: number) => {
    if (i === j) return;
    const next = save.party.slice();
    if (i < 0 || j < 0 || i >= next.length || j >= next.length) return;
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    setParty(next);
  };

  /** ◀▶ボタン: 左右のマスと順番を入れかえる(せんとうに出す子を選ぶときに使う) */
  const moveSlot = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= save.party.length) return;
    swapSlots(i, j);
  };

  const selectSlot = (i: number) => {
    setSelectedSlot(cur => (cur === i ? null : i));
  };

  /** 箱(つかまえたモンスター全部)をタップしたときの処理 */
  const pickFromBox = (uid: string) => {
    if (selectedSlot === null) {
      // 選択中でなければ、いままでどおり タップで手持ちに出し入れ
      if (save.party.includes(uid)) {
        // 手持ちが0になると戦えなくなるので、1体は必ず残す
        if (save.party.length <= 1) return;
        setParty(save.party.filter(p => p !== uid));
      } else if (save.party.length < 3) {
        setParty([...save.party, uid]);
      }
      return;
    }

    const existingIndex = save.party.indexOf(uid);
    if (existingIndex !== -1) {
      // すでに手持ちにいる子を選んだ場合は、選んだマスと順番を入れかえる
      // (選んでいたのが「あき」マスなら、もう手持ちにいる子なので何もしない)
      if (selectedSlot < save.party.length) swapSlots(selectedSlot, existingIndex);
    } else if (selectedSlot < save.party.length) {
      // マスが埋まっている: その子と入れかえる(外れた子は箱に戻るだけ)
      const next = save.party.slice();
      next[selectedSlot] = uid;
      setParty(next);
    } else if (save.party.length < 3) {
      // 「あき」のマスを選んでいた: そのまま追加する
      setParty([...save.party, uid]);
    }
    setSelectedSlot(null);
  };

  const box = save.owned;

  return (
    <Panel title={`てもち  ${save.party.length} / 3`} onClose={onClose} accent="#0284c7">
      <p className="text-white/90 font-bold mb-1 text-sm sm:text-base">
        せんとうに 出るのは いちばん左の1体。タイプ相性は その子で 決まるよ。
      </p>
      <p className="text-white/70 font-bold mb-3 text-xs sm:text-sm">
        ◀▶ で 順番を いれかえられるよ。マスを タップしてから 下の「つかまえた モンスター」を
        タップすると、その子と いれかわるよ。
      </p>
      {selectedSlot !== null && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-amber-400/90 px-4 py-2">
          <p className="text-amber-950 font-black text-sm sm:text-base flex-1">
            {selectedSlot + 1}ばんめと いれかえる子を、下から タップしてね。
          </p>
          <button
            onClick={() => setSelectedSlot(null)}
            className="px-3 py-1.5 rounded-xl bg-white text-amber-900 font-black text-xs sm:text-sm active:scale-95"
          >
            やめる
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map(i => {
          const p = party[i];
          const selected = selectedSlot === i;
          if (!p) {
            return (
              <button
                key={i}
                onClick={() => selectSlot(i)}
                className={`rounded-3xl border-4 border-dashed h-40 flex items-center justify-center font-black transition active:scale-95 ${
                  selected ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-white/40 text-white/60'
                }`}
              >
                あき{selected && '(ここに いれる)'}
              </button>
            );
          }
          const el = ELEMENTS[p.def.type];
          const st = statsAtLevel(p.def, p.owned.level);
          return (
            <div
              key={p.owned.uid}
              onClick={() => selectSlot(i)}
              className={`rounded-3xl bg-white p-3 border-4 shadow-lg cursor-pointer transition ${selected ? 'ring-4 ring-amber-400' : ''}`}
              style={{ borderColor: selected ? '#f59e0b' : el.color }}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <button
                  onClick={e => { e.stopPropagation(); moveSlot(i, -1); }}
                  disabled={i === 0}
                  className="px-2 py-1 rounded-lg bg-slate-100 disabled:opacity-30 text-slate-700 font-black text-sm active:scale-95"
                >
                  ◀
                </button>
                <span className="text-[10px] font-black text-slate-400">{i + 1}ばんめ</span>
                <button
                  onClick={e => { e.stopPropagation(); moveSlot(i, 1); }}
                  disabled={i === party.length - 1}
                  className="px-2 py-1 rounded-lg bg-slate-100 disabled:opacity-30 text-slate-700 font-black text-sm active:scale-95"
                >
                  ▶
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <img
                  src={getMonsterSprite(spriteIdFor(save, p.owned))}
                  alt=""
                  className="w-20 h-20 object-contain shrink-0"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
                />
                <div className="min-w-0">
                  <p className="font-black text-slate-800 text-lg truncate">
                    {displayNameFor(save, p.owned)}
                    {save.evolved.includes(p.owned.uid) && (
                      <span className="ml-1 text-xs text-amber-500">✦</span>
                    )}
                  </p>
                  <p className="text-xs font-bold text-slate-500">Lv.{p.owned.level} ／ こうげき {st.atk}</p>
                  <span
                    className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-white text-[10px] font-black"
                    style={{ backgroundColor: el.color }}
                  >
                    {el.icon} {el.name}
                  </span>
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${(p.owned.exp / expToNext(p.owned.level)) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                {ABILITIES[p.def.ability].icon} {ABILITIES[p.def.ability].name}
              </p>
              {i === 0 && (
                <p className="mt-1 text-[11px] font-black text-sky-600">せんとう</p>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="text-white text-xl font-black mb-2">つかまえた モンスター({box.length})</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2">
        {box.map(o => {
          // 伝説も箱に入るので MONSTER_DEX ではなく全体から引く
          const def = getMonster(o.defId);
          if (!def) return null;
          const inParty = save.party.includes(o.uid);
          const el = ELEMENTS[def.type];
          return (
            <button
              key={o.uid}
              onClick={() => pickFromBox(o.uid)}
              className={`rounded-2xl p-2 border-4 transition active:scale-95 ${inParty ? 'bg-sky-100' : 'bg-white'} ${
                selectedSlot !== null ? 'ring-2 ring-amber-300' : ''
              }`}
              style={{ borderColor: inParty ? '#0284c7' : el.color }}
            >
              <img
                src={getMonsterSprite(spriteIdFor(save, o))}
                alt=""
                className="w-full aspect-square object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
              />
              <p className="text-[11px] font-black text-slate-800 truncate">
                {displayNameFor(save, o)}
              </p>
              <p className="text-[10px] font-bold text-slate-500">Lv.{o.level}</p>
            </button>
          );
        })}
      </div>
    </Panel>
  );
};

// ============================================================
// マップ(町の いどう)
// ============================================================

export const MapScreen: React.FC<{
  onClose: () => void;
  onTravel: (townId: string) => void;
  onLeague: () => void;
  lockedUnits: Set<string>;
}> = ({ onClose, onTravel, onLeague, lockedUnits }) => {
  const save = useAdventureStore(s => s.save);
  const allBadges = TOWNS.every(t => save.badges.includes(t.id));
  const inLeague = save.townId === LEAGUE_TOWN.id;

  return (
    <Panel title="ナンバーランド ちほう" onClose={onClose} accent="#16a34a">
      <p className="text-white/90 font-bold mb-3 text-sm sm:text-base">
        行きたい 町を えらぼう。バッジは 何番目から 集めてもいいよ。
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOWNS.map(t => {
          const locked = lockedUnits.has(t.unit);
          const has = save.badges.includes(t.id);
          const el = ELEMENTS[t.type];
          const here = save.townId === t.id;
          return (
            <button
              key={t.id}
              disabled={locked}
              onClick={() => { onTravel(t.id); onClose(); }}
              className={`text-left rounded-3xl p-4 border-4 shadow-lg transition active:scale-95 ${
                locked ? 'bg-slate-700/70 border-slate-600' : 'bg-white'
              }`}
              style={{ borderColor: locked ? undefined : here ? '#facc15' : el.color }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-xl font-black truncate ${locked ? 'text-white/60' : 'text-slate-800'}`}>
                    {t.no}. {t.name}
                  </p>
                  <p className={`text-xs font-bold truncate ${locked ? 'text-white/40' : 'text-slate-500'}`}>
                    {t.subtitle}
                  </p>
                </div>
                {has && <span className="text-2xl shrink-0">🏅</span>}
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span
                  className="px-2.5 py-0.5 rounded-full text-white text-[11px] font-black"
                  style={{ backgroundColor: locked ? '#64748b' : el.color }}
                >
                  {el.icon} {el.name}
                </span>
                <span className={`text-[11px] font-bold ${locked ? 'text-white/50' : 'text-slate-500'}`}>
                  {t.unit}
                </span>
                {here && <span className="text-[11px] font-black text-amber-600">いまここ</span>}
              </div>
              {locked && (
                <p className="mt-2 text-xs font-black text-amber-300">
                  🔒 まだ 先生が ひらいていない 町
                </p>
              )}
              {has && !locked && (
                <p className="mt-2 text-xs font-black text-emerald-600">
                  {BADGE_NAMES[t.id]} かくとくずみ
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <button
          onClick={() => { if (allBadges) { onLeague(); onClose(); } }}
          disabled={!allBadges}
          className={`w-full rounded-3xl p-6 border-4 font-black text-2xl sm:text-3xl shadow-xl transition active:scale-95 ${
            allBadges
              ? 'bg-gradient-to-r from-amber-400 to-rose-400 text-white border-white animate-pulse'
              : 'bg-slate-700/70 text-white/50 border-slate-600'
          }`}
        >
          👑 ナンバーリーグ
          <span className="block text-sm font-bold mt-1">
            {!allBadges
              ? `バッジ ${save.badges.length} / 14 ―― ぜんぶ 集めると ちょうせんできる`
              : inLeague
                ? 'いま 回廊の 中にいる。町へ もどるには 上から 町を えらぼう'
                : save.champion
                  ? 'チャンピオンの間へ。何度でも いどめる'
                  : `さいごの回廊へ ―― 四天王 ${save.leagueProgress} / 4人`}
          </span>
        </button>
      </div>
    </Panel>
  );
};

// ============================================================
// ショップ
// ============================================================

export const ShopScreen: React.FC<{
  onClose: () => void;
  mathPoints: number;
  onBuy: (item: ItemId, cost: number) => void;
}> = ({ onClose, mathPoints, onBuy }) => {
  const save = useAdventureStore(s => s.save);
  const order: ItemId[] = ['ball', 'greatball', 'potion', 'hintbook'];

  return (
    <Panel title={`ショップ  もっているMP: ${mathPoints}`} onClose={onClose} accent="#7c3aed">
      <div className="grid sm:grid-cols-2 gap-3">
        {order.map(id => {
          const item = ITEMS[id];
          const can = mathPoints >= item.price;
          return (
            <div key={id} className="rounded-3xl bg-white p-4 border-4 border-violet-200 shadow-lg flex items-center gap-4">
              <span className="text-5xl shrink-0">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-black text-slate-800">{item.name}</p>
                <p className="text-xs font-bold text-slate-500 leading-snug">{item.description}</p>
                <p className="text-sm font-black text-violet-600 mt-1">
                  {item.price} MP ／ もっている数 {save.items[id] ?? 0}
                </p>
              </div>
              <button
                onClick={() => can && onBuy(id, item.price)}
                disabled={!can}
                className="shrink-0 px-5 py-3 rounded-2xl bg-violet-500 disabled:bg-slate-300 text-white font-black text-lg active:scale-95"
              >
                かう
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-white/80 font-bold text-sm">
        MPは バトルに かったり、れんしゅうモードで もんだいを といたり すると たまるよ。
      </p>
    </Panel>
  );
};


// ============================================================
// トレーナーカード(ステータス)
// ============================================================

const RARITY_STYLE: Record<string, string> = {
  common: 'bg-slate-100 text-slate-700 border-slate-300',
  rare: 'bg-sky-100 text-sky-800 border-sky-400',
  epic: 'bg-violet-100 text-violet-800 border-violet-400',
  legendary: 'bg-amber-100 text-amber-800 border-amber-400',
};

export const TrainerCardScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const save = useAdventureStore(s => s.save);
  const st = adventureStats(save);
  const rank = adventureRank(save);
  const earned = earnedAdventureTitles(save);
  const earnedIds = new Set(earned.map(t => t.id));
  const next = nextAdventureTitles(save, 3);

  const rows: Array<[string, string, number, number | null]> = [
    ['🏅', 'バッジ', st.badges, 14],
    ['📕', 'ずかん(つかまえた)', st.caught, st.dexTotal],
    ['👀', 'ずかん(出会った)', st.seen, st.dexTotal],
    ['⚔', 'かったトレーナー', st.trainersBeaten, null],
    ['✏️', 'せいかいした問題', st.correct, null],
    ['🗺', 'おとずれた町', st.towns, 14],
    ['⭐', '手持ちの最高レベル', st.maxLevel, null],
  ];

  return (
    <Panel title="トレーナーカード" onClose={onClose} accent="#0f766e">
      {/* ランク */}
      <div className="rounded-3xl bg-white p-4 sm:p-5 shadow-lg border-4 border-teal-300 mb-4">
        <div className="flex items-center gap-4">
          <img
            src={getPlayerSprite(save.appearance, 'front')}
            alt=""
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain shrink-0"
            onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-2xl sm:text-3xl font-black text-slate-800 truncate">
              {save.playerName || 'なまえなし'}
            </p>
            <p className="text-sm font-black text-teal-700 mt-0.5">
              トレーナーランク {rank.level} ／ {rank.name}
            </p>
            {earned.length > 0 && (
              <p className="text-xs font-bold text-slate-500 mt-1">
                いまの称号: {earned[earned.length - 1].icon} {earned[earned.length - 1].name}
              </p>
            )}
            <div className="mt-2 h-3 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all"
                style={{ width: `${Math.min(100, rank.progress * 100)}%` }}
              />
            </div>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5 text-right">
              {rank.nextPoints === null
                ? `${rank.points} ポイント(さいこうランク)`
                : `${rank.points} / ${rank.nextPoints} ポイント`}
            </p>
          </div>
        </div>
      </div>

      {/* ステータス */}
      <div className="grid sm:grid-cols-2 gap-2 mb-4">
        {rows.map(([icon, label, cur, max]) => (
          <div key={label} className="rounded-2xl bg-white p-3 shadow flex items-center gap-3">
            <span className="text-2xl shrink-0">{icon}</span>
            <span className="flex-1 text-sm font-bold text-slate-600 truncate">{label}</span>
            <span className="text-lg font-black text-slate-800 shrink-0">
              {cur}{max !== null && <span className="text-sm text-slate-400"> / {max}</span>}
            </span>
          </div>
        ))}
      </div>

      {/* つぎの称号 */}
      {next.length > 0 && (
        <>
          <h3 className="text-white text-lg font-black mb-2">もうすこしで もらえる 称号</h3>
          <div className="grid sm:grid-cols-3 gap-2 mb-4">
            {next.map(({ def, current }) => (
              <div key={def.id} className="rounded-2xl bg-white/95 p-3 shadow">
                <p className="font-black text-slate-800 text-sm">{def.icon} {def.name}</p>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">{def.description}</p>
                <div className="mt-1.5 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${Math.min(100, (current / def.value) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold text-slate-400 text-right mt-0.5">
                  {current} / {def.value}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 称号一覧 */}
      <h3 className="text-white text-lg font-black mb-2">
        称号 {earned.length} / {ADVENTURE_TITLES.length}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {ADVENTURE_TITLES.map(t => {
          const got = earnedIds.has(t.id);
          return (
            <div
              key={t.id}
              className={`rounded-2xl p-3 border-4 ${got ? RARITY_STYLE[t.rarity] : 'bg-slate-800/60 text-white/40 border-slate-700'}`}
            >
              <p className="font-black text-sm truncate">
                {got ? `${t.icon} ${t.name}` : '？？？'}
              </p>
              <p className="text-[11px] font-bold opacity-80 mt-0.5 leading-snug">
                {t.description}
              </p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};
