/**
 * SaveSlotsModal.tsx — 手動セーブスロット(5つ)と「はじめから やりなおす」。
 *
 * ふだんの進行は操作のたびに自動で保存されている(bm_adventure_v1)。
 * このモーダルは、それとは別に「ここまでの記録」を明示的にスロットへ
 * 書きこむ/よみこむための画面。やりなおしても、スロットに残した記録は消えない。
 */
import React, { useState } from 'react';
import { Panel } from './MenuScreens';
import { useAdventureStore, SLOT_COUNT, type AdventureSave } from '../../store/adventureStore';
import { getTown } from '../../data/adventure/towns';

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatDate = (t: number) => {
  if (!t) return '';
  const d = new Date(t);
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const slotSummary = (s: AdventureSave) => {
  const town = getTown(s.townId);
  return {
    name: s.playerName || 'ななし',
    icon: s.appearance === 'girl' ? '👧' : '👦',
    town: town?.name ?? '???',
    badges: s.badges.length,
    caught: new Set(s.owned.map(o => o.defId)).size,
    savedAt: formatDate(s.updatedAt),
  };
};

type Confirm =
  | { kind: 'save'; index: number }
  | { kind: 'load'; index: number }
  | { kind: 'restart' };

const SaveSlotsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const save = useAdventureStore(s => s.save);
  const slots = useAdventureStore(s => s.slots);
  const saveToSlot = useAdventureStore(s => s.saveToSlot);
  const loadFromSlot = useAdventureStore(s => s.loadFromSlot);
  const resetGame = useAdventureStore(s => s.resetGame);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'save') saveToSlot(confirm.index);
    if (confirm.kind === 'load') { loadFromSlot(confirm.index); onClose(); }
    if (confirm.kind === 'restart') { resetGame(); onClose(); }
    setConfirm(null);
  };

  return (
    <Panel title="💾 セーブデータ" onClose={onClose} accent="#0891b2">
      <div className="max-w-2xl mx-auto space-y-3">
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const slot = slots[i];
          const info = slot ? slotSummary(slot) : null;
          return (
            <div
              key={i}
              className="rounded-2xl bg-white shadow-md border-2 border-slate-100 p-3 sm:p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-cyan-100 text-cyan-700 font-black flex items-center justify-center text-sm sm:text-base">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                {info ? (
                  <>
                    <p className="font-black text-slate-800 text-sm sm:text-base truncate">
                      {info.icon} {info.name} ・ {info.town}
                    </p>
                    <p className="text-[11px] sm:text-xs font-bold text-slate-400 truncate">
                      🏅{info.badges} ・ 図鑑{info.caught} ・ {info.savedAt}
                    </p>
                  </>
                ) : (
                  <p className="font-bold text-slate-400 text-sm sm:text-base">からっぽ</p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => setConfirm({ kind: 'save', index: i })}
                  disabled={!save.started}
                  className="px-2.5 py-2 sm:px-3 rounded-xl bg-cyan-500 disabled:bg-slate-200 text-white disabled:text-slate-400 font-black text-xs sm:text-sm active:scale-95"
                >
                  ここに{'\n'}セーブ
                </button>
                <button
                  onClick={() => info && setConfirm({ kind: 'load', index: i })}
                  disabled={!info}
                  className="px-2.5 py-2 sm:px-3 rounded-xl bg-white border-2 border-cyan-400 disabled:border-slate-200 text-cyan-600 disabled:text-slate-300 font-black text-xs sm:text-sm active:scale-95"
                >
                  よみこむ
                </button>
              </div>
            </div>
          );
        })}

        {!save.started && (
          <p className="text-center text-xs sm:text-sm font-bold text-slate-400 pt-1">
            ぼうけんを はじめると、ここにセーブできるようになるよ。
          </p>
        )}

        <div className="pt-3 border-t-2 border-slate-100">
          <button
            onClick={() => setConfirm({ kind: 'restart' })}
            className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-black text-base sm:text-lg active:scale-95 transition"
          >
            🔄 はじめから やりなおす
          </button>
          <p className="mt-1.5 text-center text-[11px] sm:text-xs font-bold text-slate-400">
            セーブスロットの記録は 消えないよ。いまの ぼうけんだけ 最初にもどるよ。
          </p>
        </div>
      </div>

      {confirm && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border-8 border-amber-400 p-6 shadow-2xl text-center"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-2xl mb-2">⚠️</p>
            <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-2">
              {confirm.kind === 'save' && `スロット${confirm.index + 1}に 上書きする？`}
              {confirm.kind === 'load' && `スロット${confirm.index + 1}を よみこむ？`}
              {confirm.kind === 'restart' && 'はじめから やりなおす？'}
            </h3>
            <p className="text-sm font-bold text-slate-500 mb-5">
              {confirm.kind === 'save' && 'このスロットに あった記録は 上書きされて 消えるよ。'}
              {confirm.kind === 'load' && 'いまの ぼうけんの 進み具合は、セーブしていなければ 消えるよ。'}
              {confirm.kind === 'restart' && 'いまの ぼうけんの 進み具合が、最初から やりなおしになるよ(スロットの記録は 残るよ)。'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="py-3 rounded-2xl bg-slate-200 text-slate-700 font-black text-lg active:scale-95 transition"
              >
                もどる
              </button>
              <button
                onClick={runConfirm}
                className="py-3 rounded-2xl bg-rose-500 text-white font-black text-lg active:scale-95 transition"
              >
                {confirm.kind === 'save' && 'セーブする'}
                {confirm.kind === 'load' && 'よみこむ'}
                {confirm.kind === 'restart' && 'やりなおす'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
};

export default SaveSlotsModal;
