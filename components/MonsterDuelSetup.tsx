/**
 * MonsterDuelSetup.tsx — モンスター対戦(つかまえたモンスターでスピードデュエル)の設定画面
 *
 * 勝敗はスピードデュエルと全く同じ「算数の正答のみ」で決まる。モンスターは
 * 見た目の演出だけで、ステータス(HP・レベル・タイプ相性)は対戦結果に影響しない。
 * 出題範囲は、選んだモンスターの担当サブトピック(151体=151サブトピックの対応)から
 * 自動的に決まるので、カテゴリを手で選ぶ手間がない。
 */
import React, { useMemo, useState } from 'react';
import type { BattleFormat } from '../types';
import { useAdventureStore } from '../store/adventureStore';
import { getMonster, getMonsterSprite } from '../data/adventure/monsters';
import { ELEMENTS } from '../data/adventure/elements';
import { BackIcon } from './Icons';

interface MonsterDuelSetupProps {
  onStart: (monsterDefIds: string[], format: BattleFormat, mode: 'cpu' | 'pvp') => void;
  onBack: () => void;
  isLoggedIn: boolean;
}

const DUEL_FORMATS: { key: BattleFormat; label: string; desc: string }[] = [
  { key: 'best_of_3', label: '3本勝負', desc: '先に2問正解で勝利' },
  { key: 'best_of_5', label: '5本勝負', desc: '先に3問正解で勝利' },
  { key: 'best_of_7', label: '7本勝負', desc: '先に4問正解で勝利' },
  { key: 'master_duel', label: 'マスターデュエル', desc: '10問勝負・最多正解で決着' },
];

/** 手持ちと同じ上限(3体まで)を連れていける */
const MAX_PICK = 3;

const MonsterDuelSetup: React.FC<MonsterDuelSetupProps> = ({ onStart, onBack, isLoggedIn }) => {
  const dexCaught = useAdventureStore(s => s.save.dexCaught);

  const caughtMonsters = useMemo(
    () => dexCaught.map(id => getMonster(id)).filter((m): m is NonNullable<typeof m> => !!m),
    [dexCaught],
  );

  const [picked, setPicked] = useState<string[]>(() => (caughtMonsters[0] ? [caughtMonsters[0].id] : []));
  const [format, setFormat] = useState<BattleFormat>('best_of_5');

  const togglePick = (id: string) => {
    setPicked(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // 最低1体は連れていく
        return prev.filter(x => x !== id);
      }
      if (prev.length >= MAX_PICK) return prev;
      return [...prev, id];
    });
  };

  const handleStart = (mode: 'cpu' | 'pvp') => {
    if (picked.length === 0) return;
    onStart(picked, format, mode);
  };

  if (caughtMonsters.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-6xl mb-4">🐾</div>
        <h2 className="text-2xl font-black mb-2">まだ モンスターを つかまえていません</h2>
        <p className="text-sm text-gray-400 mb-8 max-w-sm">
          ぼうけんモードで モンスターを 1体つかまえると、その子を つれて対戦できるようになります。
        </p>
        <button onClick={onBack} className="btn-tactical px-8 py-3 rounded-xl text-sm font-bold">
          もどる
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center p-4 text-white relative overflow-y-auto">
      <div className="absolute inset-0 bg-gradient-radial from-emerald-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors p-2">
            <BackIcon className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black tracking-wider flex items-center gap-3">
              <span className="text-emerald-400">🐾</span>
              <span className="text-hologram">モンスター対戦</span>
            </h2>
            <p className="text-xs text-emerald-400 font-bold mt-1">
              つかまえたモンスターで早押し勝負 — 勝敗は算数の正答のみで決まる
            </p>
          </div>
        </div>

        {/* Monster Selection */}
        <div className="hud-panel rounded-xl p-4 sm:p-5 mb-6 border border-emerald-800/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-emerald-400 tracking-widest uppercase">つれていく なかま</h3>
            <span className="text-[10px] text-gray-500">{picked.length}/{MAX_PICK}体</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-3">
            選んだモンスターの担当分野から問題が出題されます(複数選ぶと出題範囲が広がります)。
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
            {caughtMonsters.map(m => {
              const isSelected = picked.includes(m.id);
              const el = ELEMENTS[m.type];
              return (
                <button
                  key={m.id}
                  onClick={() => togglePick(m.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-emerald-900/30 border-emerald-500/50'
                      : 'bg-slate-900/30 border-slate-700/20 hover:border-gray-600'
                  }`}
                  title={m.subtopic}
                >
                  <img src={getMonsterSprite(m.id)} alt="" className="w-12 h-12 object-contain" />
                  <span className={`text-[10px] font-bold truncate w-full text-center ${isSelected ? 'text-emerald-200' : 'text-gray-400'}`}>
                    {m.name}
                  </span>
                  <span className="text-[9px]" style={{ color: el.color }}>{el.icon} {el.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Format Selection */}
        <div className="hud-panel rounded-xl p-4 sm:p-5 mb-6 border border-emerald-800/30">
          <h3 className="text-sm font-bold text-emerald-400 tracking-widest uppercase mb-4">対戦形式</h3>
          <div className="grid grid-cols-2 gap-3">
            {DUEL_FORMATS.map(f => (
              <button
                key={f.key}
                onClick={() => setFormat(f.key)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  format === f.key
                    ? 'border-emerald-500/50 bg-emerald-900/20'
                    : 'border-slate-700/30 bg-slate-900/30 hover:border-gray-600'
                }`}
              >
                <div className={`text-sm font-bold ${format === f.key ? 'text-emerald-300' : 'text-gray-400'}`}>
                  {f.label}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="hud-panel rounded-xl p-4 mb-6 border border-slate-700/30">
          <h3 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">ルール</h3>
          <ul className="space-y-1 text-[11px] text-gray-400">
            <li>• 同じ問題が両プレイヤーに同時出題</li>
            <li>• 先に正解した方がラウンド勝利</li>
            <li>• モンスターのHP・レベル・タイプ相性は勝敗に関係しません(見た目だけ)</li>
          </ul>
        </div>

        {/* Start Buttons */}
        <div className="grid grid-cols-2 gap-4 pb-4">
          <button
            onClick={() => handleStart('cpu')}
            disabled={picked.length === 0}
            className="btn-tactical py-5 rounded-2xl font-bold tracking-[0.15em] text-base group relative overflow-hidden disabled:opacity-40"
          >
            <div className="absolute -right-4 -bottom-4 text-5xl opacity-[0.08] group-hover:opacity-[0.15] transition-all">🤖</div>
            <div className="text-lg font-black">CPU対戦</div>
            <div className="text-[10px] text-emerald-400 opacity-70 mt-1">コンピュータと早押し勝負</div>
          </button>
          <button
            onClick={() => handleStart('pvp')}
            disabled={!isLoggedIn || picked.length === 0}
            className="btn-tactical py-5 rounded-2xl font-bold tracking-[0.15em] text-base group relative overflow-hidden disabled:opacity-40"
          >
            <div className="absolute -right-4 -bottom-4 text-5xl opacity-[0.08] group-hover:opacity-[0.15] transition-all">⚔</div>
            <div className="text-lg font-black">プレイヤー対戦</div>
            <div className="text-[10px] text-emerald-400 opacity-70 mt-1">
              {isLoggedIn ? 'オンラインで早押し勝負' : 'ログインが必要です'}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonsterDuelSetup;
