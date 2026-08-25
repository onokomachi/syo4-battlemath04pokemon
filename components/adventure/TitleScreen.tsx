/**
 * TitleScreen.tsx — ぼうけんのはじまり。
 *
 * ①なまえを入れる ②すがたを えらぶ ③さいしょの なかまを えらぶ、の3ステップ。
 * 小4がひとりで進められるよう、1画面につき1つのことだけを聞く。
 */
import React, { useState } from 'react';
import { MONSTER_DEX, getMonsterSprite } from '../../data/adventure/monsters';
import { ELEMENTS } from '../../data/adventure/elements';
import { PLAYER_APPEARANCES, PROFESSOR_NAME, getNpcSprite, getPlayerSprite } from '../../data/adventure/people';
import { DialogueBox } from './ui/DialogueBox';

/** さいしょの なかま3体。タイプがばらけるように選んである。 */
const STARTER_SUBTOPICS = ['何の位・いくつ分', '分度器と角', '分数のよみかき'];

const STARTERS = STARTER_SUBTOPICS
  .map(st => MONSTER_DEX.find(m => m.subtopic === st))
  .filter((m): m is NonNullable<typeof m> => Boolean(m));

const HIRAGANA_ROWS = [
  'あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの',
  'はひふへほ', 'まみむめも', 'やゆよ', 'らりるれろ', 'わをん',
  'がぎぐげご', 'ざじずぜぞ', 'だぢづでど', 'ばびぶべぼ', 'ぱぴぷぺぽ',
  'ゃゅょっー',
];

const TitleScreen: React.FC<{
  onStart: (name: string, appearance: 'boy' | 'girl', starterDefId: string) => void;
  onExit: () => void;
  /** セーブスロットの画面を開く(すでにある記録から続きを選べるように) */
  onOpenSaveSlots: () => void;
  defaultName?: string;
}> = ({ onStart, onExit, onOpenSaveSlots, defaultName }) => {
  const [step, setStep] = useState<'opening' | 'name' | 'look' | 'starter' | 'closing'>('opening');
  const [name, setName] = useState(defaultName ?? '');
  const [appearance, setAppearance] = useState<'boy' | 'girl'>('boy');
  const [starter, setStarter] = useState<string>(STARTERS[0]?.id ?? '');

  const starterDef = STARTERS.find(s => s.id === starter);

  if (step === 'opening') {
    return (
      <div className="fixed inset-0 z-40 bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-100">
        <DialogueBox
          speaker={PROFESSOR_NAME}
          portrait={getNpcSprite('prof')}
          accent="#f59e0b"
          lines={[
            'やあ、よく来たね。わたしは スウジはかせ。',
            'ここは ナンバーランド地方 ―― 数から うまれた モンスターたちが すむ 世界だ。',
            'この地方には 14の町がある。町にはそれぞれ「単元マスター」がいてね。',
            'マスターに かつと、バッジが もらえる。',
            '14この バッジを ぜんぶ 集めたら、ナンバーリーグに ちょうせんできる。',
            'その先で まっているのが ―― チャンピオンだ。',
            'さあ、きみの ぼうけんを はじめよう。まずは 名前を おしえてくれるかい？',
          ]}
          onDone={() => setStep('name')}
        />
        <button
          onClick={onOpenSaveSlots}
          className="absolute top-4 right-4 z-50 px-4 py-2.5 rounded-2xl bg-white/90 shadow-lg font-black text-slate-700 text-sm sm:text-base active:scale-95"
        >
          💾 セーブデータ
        </button>
      </div>
    );
  }

  if (step === 'name') {
    // 上下中央ぞろえ(justify-center)は内側の min-h-full ラッパーに掛ける。
    // スクロールする枠に直接かけると、画面の高さが足りないときに はみ出した
    // 「上側」へスクロールで到達できなくなる(実測で353px 読めなくなっていた)。
    return (
      <div className="fixed inset-0 z-40 bg-gradient-to-b from-sky-300 to-emerald-100 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center p-4">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-2">なまえを きめよう</h2>
        <p className="text-slate-600 font-bold mb-4 text-sm sm:text-base">ひらがな 6もじまで</p>

        <div className="w-full max-w-xl bg-white rounded-3xl border-4 border-sky-400 p-4 shadow-xl">
          <div className="h-16 flex items-center justify-center text-4xl font-black text-slate-800 tracking-widest bg-sky-50 rounded-2xl mb-3">
            {name || <span className="text-slate-300 text-2xl">なまえ</span>}
          </div>
          <div className="space-y-1.5">
            {HIRAGANA_ROWS.map((row, i) => (
              <div key={i} className="flex justify-center gap-1.5">
                {[...row].map(ch => (
                  <button
                    key={ch}
                    onClick={() => name.length < 6 && setName(name + ch)}
                    className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-sky-100 hover:bg-sky-200 active:scale-90 transition text-xl sm:text-2xl font-black text-slate-700"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setName(name.slice(0, -1))}
              className="flex-1 py-3 rounded-2xl bg-slate-200 font-black text-slate-700 text-lg active:scale-95"
            >
              ← けす
            </button>
            <button
              onClick={() => name.trim() && setStep('look')}
              disabled={!name.trim()}
              className="flex-[2] py-3 rounded-2xl bg-sky-500 disabled:bg-slate-300 text-white font-black text-lg active:scale-95"
            >
              これで けってい ▶
            </button>
          </div>
        </div>
        <button onClick={onExit} className="mt-4 text-slate-500 font-bold underline">
          メニューに もどる
        </button>
      </div>
      </div>
    );
  }

  if (step === 'look') {
    return (
      <div className="fixed inset-0 z-40 bg-gradient-to-b from-sky-300 to-emerald-100 flex flex-col items-center justify-center p-4">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-6">すがたを えらぼう</h2>
        <div className="flex gap-4 sm:gap-8">
          {PLAYER_APPEARANCES.map(p => (
            <button
              key={p.id}
              onClick={() => setAppearance(p.id as 'boy' | 'girl')}
              className={`w-40 sm:w-56 rounded-3xl border-8 p-4 bg-white shadow-xl transition active:scale-95 ${
                appearance === p.id ? 'border-amber-400 scale-105' : 'border-white'
              }`}
            >
              <img
                src={getPlayerSprite(p.id, 'front')}
                alt={p.label}
                className="w-full aspect-square object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
              />
              <p className="mt-2 text-xl sm:text-2xl font-black text-slate-800">{p.label}</p>
            </button>
          ))}
        </div>
        <button
          onClick={() => setStep('starter')}
          className="mt-8 px-12 py-4 rounded-3xl bg-sky-500 text-white font-black text-2xl shadow-lg active:scale-95"
        >
          これで けってい ▶
        </button>
      </div>
    );
  }

  if (step === 'starter') {
    // 中央ぞろえは内側の min-h-full ラッパーに(理由は なまえ画面と同じ)
    return (
      <div className="fixed inset-0 z-40 bg-gradient-to-b from-amber-100 to-emerald-100 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl sm:text-4xl font-black text-slate-800 mb-1">さいしょの なかまを えらぼう</h2>
        <p className="text-slate-600 font-bold mb-5 text-sm sm:text-base text-center px-4">
          タイプは じゃんけんの わ。かず ▶ けいさん ▶ しょうすう ▶ ぶんすう ▶ ばい ▶ グラフ ▶ ずけい ▶ かず…
        </p>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
          {STARTERS.map(m => {
            const el = ELEMENTS[m.type];
            const on = starter === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setStarter(m.id)}
                className={`w-44 sm:w-56 rounded-3xl border-8 p-3 bg-white shadow-xl transition active:scale-95 ${
                  on ? 'scale-105' : 'border-white'
                }`}
                style={{ borderColor: on ? el.color : undefined }}
              >
                <img
                  src={getMonsterSprite(m.id)}
                  alt={m.name}
                  className="w-full aspect-square object-contain"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }}
                />
                <p className="text-xl sm:text-2xl font-black text-slate-800">{m.name}</p>
                <span
                  className="inline-block mt-1 px-3 py-0.5 rounded-full text-white text-xs font-black"
                  style={{ backgroundColor: el.color }}
                >
                  {el.icon} {el.name}
                </span>
                <p className="mt-2 text-[11px] sm:text-xs font-bold text-slate-500 leading-snug">{m.flavor}</p>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setStep('closing')}
          className="mt-6 px-12 py-4 rounded-3xl bg-emerald-500 text-white font-black text-2xl shadow-lg active:scale-95"
        >
          この子に きめた！ ▶
        </button>
      </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-sky-300 to-emerald-100">
      <DialogueBox
        speaker={PROFESSOR_NAME}
        portrait={getNpcSprite('prof')}
        accent="#f59e0b"
        lines={[
          `おお、${starterDef?.name} を えらんだか。いい なかまだ。`,
          `${name} くん、いや ${name} ―― これが きみの さいしょの なかまだ。`,
          'それと、これを 持っていきなさい。「サンスウボール」だ。',
          'よわった モンスターに 投げると、なかまに なってくれる。',
          'モンスターは 算数の もんだいで こうげきしてくる。',
          'その もんだいを といた分だけ、こちらの こうげきが 当たる。',
          'まちがえても だいじょうぶ。ヒントが 出て、もう一度 ちょうせんできるからね。',
          'さあ ―― ケタバ村から、ぼうけんの はじまりだ！',
        ]}
        onDone={() => onStart(name.trim(), appearance, starter)}
      />
    </div>
  );
};

export default TitleScreen;
