/**
 * components/guided/MultiplicationColumnSimulator.tsx
 *
 * 2桁×2桁・3桁×3桁など、暗算では非現実的なかけ算の筆算専用エンジン。
 * かける数の各位ごとに部分積を求め、最後にすべての部分積をたした答えを入力する。
 *
 * 部分積の入力は、わる数のけた数によらず いつも1けたずつのマスに分けて行う
 * (wari-hissann3 の DivisionSimulator/MasterDivisionBoard と同じ考え方)。
 * 1マスに2けたまで入力でき、2けた目(十の位)は繰り上がりとして 左どなりの
 * マスに 小さく表示される(連鎖して伝わる)。これにより「482×6」のような
 * 部分積を、まるごと暗算してから入力する必要がなくなり、実際の筆記
 * (一の位から1けたずつ・繰り上がりは小さく書く)に近い体験になる。
 * すべての部分積をたす最後の一歩(合計)は、これまでどおり1つの答えとして
 * まとめて入力する(足し合わせる部分積の数は2〜3個程度で、繰り上がりの
 * 負担が部分積の計算ほど大きくないため)。
 * マスターモードでは 手順を示さず、部分積のマスを自由な順番でタップして
 * 入力し(合計だけは行ごと選択)、最後に一括採点する。
 *
 * エビデンスA: Sweller & Cooper (1985) のワークトイグザンプル効果、
 * および Brown & VanLehn (1980) の「手続き的バグ」理論
 * (位をそろえ間違える・くり上げを忘れる、といった典型的な誤りは
 * 各部分積を個別に確認できるほうが早期に気づける)。
 */
import React, { useMemo, useState, useEffect } from 'react';
import type { GuidedMultiplicationData } from '../../types';

interface Props {
  data: GuidedMultiplicationData;
  onComplete: (isCorrect: boolean) => void;
}

const MultiplicationColumnSimulator: React.FC<Props> = ({ data, onComplete }) => {
  const { a, b, masterMode = false } = data;
  const bStr = b.toString();
  const digitsOfB = bStr.split('').reverse().map(Number); // [ones, tens, hundreds, ...]
  const partials = useMemo(() => digitsOfB.map((d) => a * d), [a, b]); // eslint-disable-line react-hooks/exhaustive-deps
  const partialStrs = useMemo(() => partials.map((p) => p.toString()), [partials]);
  const finalAnswer = a * b;
  const needsSum = digitsOfB.length > 1;
  const totalWidth = Math.max(a.toString().length + bStr.length, finalAnswer.toString().length, ...partials.map((p) => p.toString().length));
  const rightOffset = totalWidth - 1;

  const CELL = 40;

  // --- 共通の採点判定 ---
  const isSumCorrect = (val: string) => val !== '' && parseInt(val, 10) === finalAnswer;

  // ============ マスターモード: 自由選択入力 ============
  // 部分積は1マスずつ(繰り上がり表示つき)、合計は1行まとめて入力する。
  const [masterPartialBuffers, setMasterPartialBuffers] = useState<Record<string, string[]>>({});
  const [masterSum, setMasterSum] = useState('');
  type MasterSelection = { kind: 'partial'; idx: number; col: number } | { kind: 'sum' } | null;
  const [masterSelection, setMasterSelection] = useState<MasterSelection>(null);
  const [isGraded, setIsGraded] = useState(false);
  const [hasMistakes, setHasMistakes] = useState(false);
  const [finished, setFinished] = useState(false);

  const buildMasterPartialBuffers = (): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    partialStrs.forEach((s, idx) => { out[`p-${idx}`] = Array(s.length).fill(''); });
    return out;
  };

  useEffect(() => {
    if (!masterMode) return;
    setMasterPartialBuffers(buildMasterPartialBuffers());
    setMasterSum('');
    setMasterSelection({ kind: 'partial', idx: 0, col: partialStrs[0].length - 1 });
    setIsGraded(false);
    setHasMistakes(false);
    setFinished(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, masterMode]);

  const handleMasterDigit = (d: string) => {
    if (!masterSelection || finished) return;
    if (masterSelection.kind === 'sum') {
      if (masterSum.length < Math.max(finalAnswer.toString().length, 1)) setMasterSum((prev) => prev + d);
      return;
    }
    const key = `p-${masterSelection.idx}`;
    setMasterPartialBuffers((prev) => {
      const cur = prev[key]?.[masterSelection.col] ?? '';
      if (cur.length >= 2) return prev;
      const cols = [...(prev[key] ?? [])];
      cols[masterSelection.col] = cur + d;
      return { ...prev, [key]: cols };
    });
  };
  const handleMasterBackspace = () => {
    if (!masterSelection || finished) return;
    if (masterSelection.kind === 'sum') {
      setMasterSum((prev) => prev.slice(0, -1));
      return;
    }
    const key = `p-${masterSelection.idx}`;
    setMasterPartialBuffers((prev) => {
      const cols = [...(prev[key] ?? [])];
      cols[masterSelection.col] = (cols[masterSelection.col] ?? '').slice(0, -1);
      return { ...prev, [key]: cols };
    });
  };
  const doMasterGrading = () => {
    let errors = false;
    partialStrs.forEach((correct, idx) => {
      const buf = masterPartialBuffers[`p-${idx}`] ?? [];
      for (let c = 0; c < correct.length; c++) {
        if ((buf[c] ?? '').slice(-1) !== correct[c]) errors = true;
      }
    });
    if (needsSum && !isSumCorrect(masterSum)) errors = true;
    setIsGraded(true);
    setHasMistakes(errors);
    setFinished(!errors);
    onComplete(!errors);
  };
  const resetMaster = () => {
    setMasterPartialBuffers(buildMasterPartialBuffers());
    setMasterSum('');
    setMasterSelection({ kind: 'partial', idx: 0, col: partialStrs[0].length - 1 });
    setIsGraded(false);
    setHasMistakes(false);
    setFinished(false);
  };

  // ============ 通常モード: 部分積を1つずつ確認 → 最後に合計 ============
  const [stepIdx, setStepIdx] = useState(0); // 0..partials.length-1 は部分積、その後 'SUM'
  const [enteredPartials, setEnteredPartials] = useState<string[]>([]);
  // 部分積の入力: 位を選んで1マスずつ入力する(2桁入力すると繰り上がりが左のマスに小さく出る)
  const [cellBuffers, setCellBuffers] = useState<string[]>([]);
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [userInput, setUserInput] = useState(''); // 合計(SUMステップ)の入力
  const [mistakeCount, setMistakeCount] = useState(0);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [normalFinished, setNormalFinished] = useState(false);
  const [enteredSum, setEnteredSum] = useState('');

  const isSumStep = stepIdx >= partials.length;
  const currentDigit = digitsOfB[stepIdx];

  // 部分積のステップに入るたび、必要なマス数ぶんの入力バッファを用意し、
  // いちばん右(一の位)のマスをはじめに選んでおく。
  useEffect(() => {
    if (isSumStep || masterMode) return;
    const len = Math.max(1, partialStrs[stepIdx]?.length ?? 1);
    setCellBuffers(Array(len).fill(''));
    setSelectedCol(len - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, isSumStep, masterMode]);

  const handleCellTap = (col: number) => {
    if (normalFinished || isSumStep) return;
    setSelectedCol(col);
  };

  const handleKeypad = (d: string) => {
    if (normalFinished) return;
    if (isSumStep) {
      setUserInput((prev) => prev + d);
      return;
    }
    if (selectedCol === null) return;
    setCellBuffers((prev) => {
      const cur = prev[selectedCol] ?? '';
      if (cur.length >= 2) return prev;
      const next = [...prev];
      next[selectedCol] = cur + d;
      return next;
    });
  };
  const handleBackspace = () => {
    if (normalFinished) return;
    if (isSumStep) {
      setUserInput((prev) => prev.slice(0, -1));
      return;
    }
    if (selectedCol === null) return;
    setCellBuffers((prev) => {
      const next = [...prev];
      next[selectedCol] = (next[selectedCol] ?? '').slice(0, -1);
      return next;
    });
  };

  const shake = () => {
    const el = document.getElementById('mcs-input-area');
    el?.classList.add('mcs-shake');
    setTimeout(() => el?.classList.remove('mcs-shake'), 500);
  };

  const checkStep = () => {
    if (normalFinished) return;
    if (!isSumStep) {
      const allFilled = cellBuffers.length > 0 && cellBuffers.every((c) => c !== '');
      const combined = cellBuffers.map((c) => c.slice(-1)).join('');
      if (allFilled && parseInt(combined, 10) === a * currentDigit) {
        setEnteredPartials((prev) => [...prev, combined]);
        setCellBuffers([]);
        setSelectedCol(null);
        setHintRevealed(false);
        if (stepIdx + 1 >= partials.length && !needsSum) {
          setNormalFinished(true);
          onComplete(mistakeCount === 0);
        } else {
          setStepIdx((prev) => prev + 1);
        }
      } else {
        setMistakeCount((prev) => prev + 1);
        setHintRevealed(true);
        setFeedback(`${a} × ${currentDigit} を もういちど計算してみよう。`);
        shake();
        setCellBuffers((prev) => prev.map(() => ''));
      }
    } else {
      if (userInput === '') return;
      if (parseInt(userInput, 10) === finalAnswer) {
        setEnteredSum(userInput);
        setUserInput('');
        setNormalFinished(true);
        onComplete(mistakeCount === 0);
      } else {
        setMistakeCount((prev) => prev + 1);
        setHintRevealed(true);
        setFeedback('それぞれの部分積を たてに たしてみよう。くり上がりに 気をつけてね。');
        shake();
        setUserInput('');
      }
    }
  };

  const placeDigitLabel = ['一', '十', '百', '千', '万'];

  if (masterMode) {
    return (
      <div className="w-full flex flex-col gap-3">
        <style>{`
          @keyframes mcs-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
          .mcs-shake { animation: mcs-shake 0.2s ease-in-out infinite; }
        `}</style>

        <div className="bg-gradient-to-br from-indigo-950/40 to-amber-950/40 p-4 rounded-2xl border border-red-500/20">
          <h3 className="text-amber-300 font-black text-sm mb-1">👑 マスターモード</h3>
          <p className="text-red-200/80 font-bold text-xs leading-relaxed">
            ヒントはなしだよ！部分積のマスをタップして、じぶんで じゅんばんを決めながら すべてうめてね。
            1マスに2けたまで入力すると、十の位が繰り上がりとして左のマスに小さく出るよ。
            うめおわったら「答え合わせ」だよ。
          </p>
        </div>

        <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6 flex justify-center overflow-x-auto">
          <div className="font-mono text-2xl sm:text-3xl leading-none tracking-widest text-white select-none">
            <Row label="" valStr={a.toString()} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} />
            <div className="relative">
              <Row label="×" valStr={bStr} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} borderBottom />
            </div>
            {partialStrs.map((correct, idx) => {
              const buf = masterPartialBuffers[`p-${idx}`] ?? [];
              return (
                <CellRow
                  key={idx}
                  shift={idx}
                  totalWidth={totalWidth}
                  rightOffset={rightOffset}
                  cellW={CELL}
                  width={correct.length}
                  buffers={buf}
                  selectedCol={masterSelection?.kind === 'partial' && masterSelection.idx === idx ? masterSelection.col : null}
                  onSelectCol={(col) => !finished && setMasterSelection({ kind: 'partial', idx, col })}
                  isGraded={isGraded}
                  correctVal={correct}
                  disabled={finished}
                />
              );
            })}
            {needsSum && (
              <SelectableRow
                label=""
                valStr={masterSum}
                shift={0}
                totalWidth={totalWidth}
                rightOffset={rightOffset}
                cellW={CELL}
                isSelected={masterSelection?.kind === 'sum'}
                onSelect={() => !finished && setMasterSelection({ kind: 'sum' })}
                isGraded={isGraded}
                correctVal={finalAnswer.toString()}
                disabled={finished}
                borderTop
              />
            )}
          </div>
        </div>

        {isGraded && !hasMistakes && (
          <div className="flex flex-col items-center p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center">
            <span className="text-4xl mb-2">🏆</span>
            <h3 className="text-lg font-black text-emerald-300 mb-1">パーフェクト！</h3>
            <p className="text-emerald-400/80 text-sm font-bold">全問せいかいです！</p>
          </div>
        )}

        {isGraded && hasMistakes && (
          <div className="flex flex-col items-center p-5 bg-rose-950/40 border border-rose-500/30 rounded-2xl text-center gap-3">
            <span className="text-4xl">💡</span>
            <h3 className="text-lg font-black text-rose-300">おしい！</h3>
            <p className="text-rose-300/80 text-xs font-bold leading-relaxed">赤いマスのまちがっている数字を、もういちど見なおしてみてね。</p>
            <button onClick={() => setIsGraded(false)} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black transition-all active:scale-95">
              まちがいをなおす
            </button>
            <button onClick={resetMaster} className="w-full py-2 bg-slate-900 border border-red-500/20 text-red-200 rounded-xl font-bold transition-all">
              はじめからやりなおす
            </button>
          </div>
        )}

        {!isGraded && !finished && (
          <div id="mcs-input-area" className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                <button
                  key={n}
                  onClick={() => handleMasterDigit(n.toString())}
                  className="h-12 bg-slate-900/60 hover:bg-red-900/40 active:bg-red-600 active:text-white border border-red-900/50 rounded-xl text-xl font-black text-white transition-all"
                >
                  {n}
                </button>
              ))}
              <button onClick={handleMasterBackspace} className="h-12 bg-red-950/40 text-red-400 border border-red-500/20 rounded-xl flex items-center justify-center transition-all">
                ⌫
              </button>
            </div>
            <button
              onClick={doMasterGrading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-[0.98]"
            >
              答え合わせをする
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <style>{`
        @keyframes mcs-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .mcs-shake { animation: mcs-shake 0.2s ease-in-out infinite; }
      `}</style>

      {feedback && (
        <div
          onClick={() => setFeedback(null)}
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 cursor-pointer"
        >
          <div className="bg-slate-950 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center border-2 border-amber-400/60">
            <div className="text-4xl mb-3">💡</div>
            <h3 className="text-lg font-black text-amber-200 mb-4 whitespace-pre-wrap leading-relaxed">{feedback}</h3>
            <button onClick={() => setFeedback(null)} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black transition-all active:scale-95">
              わかった！
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-950/60 rounded-2xl border border-red-500/20 p-4 sm:p-6 flex justify-center overflow-x-auto">
        <div className="font-mono text-2xl sm:text-3xl leading-none tracking-widest text-white select-none">
          <Row label="" valStr={a.toString()} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} />
          <Row label="×" valStr={bStr} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} borderBottom />

          {enteredPartials.map((val, idx) => (
            <Row key={idx} label="" valStr={val} shift={idx} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} />
          ))}

          {/* 現在の部分積の入力ゾーン: 位を選んでマスに入力する。
              2桁入力すると十の位が繰り上がりとして左のマスに小さく出る。 */}
          {!isSumStep && !normalFinished && (
            <CellRow
              shift={stepIdx}
              totalWidth={totalWidth}
              rightOffset={rightOffset}
              cellW={CELL}
              width={cellBuffers.length || 1}
              buffers={cellBuffers}
              selectedCol={selectedCol}
              onSelectCol={handleCellTap}
              isGraded={false}
              correctVal=""
              disabled={false}
              activeInput
            />
          )}

          {needsSum && (enteredPartials.length === partials.length) && (
            <div className="border-t-2 border-white my-1" style={{ marginLeft: 0 }} />
          )}

          {normalFinished && needsSum && (
            <Row label="" valStr={enteredSum} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} />
          )}
          {isSumStep && !normalFinished && (
            <Row label="" valStr={userInput || '？'} shift={0} totalWidth={totalWidth} rightOffset={rightOffset} cellW={CELL} highlight />
          )}
        </div>
      </div>

      {normalFinished && (
        <div className="flex flex-col items-center p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center">
          <span className="text-4xl mb-2">🎉</span>
          <h3 className="text-lg font-black text-emerald-300">せいかい！よくできました！</h3>
        </div>
      )}

      {!normalFinished && (
        <>
          {hintRevealed ? (
            <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
              <h3 className="text-red-300 font-black text-sm mb-1">💡 ヒント</h3>
              <p className="text-red-100/80 font-medium text-xs leading-relaxed whitespace-pre-line">
                {!isSumStep
                  ? `${a} × ${currentDigit}(${placeDigitLabel[stepIdx] ?? ''}の位)を、一の位から1けたずつ 計算しよう。2けたになったら 十の位は 左のマスに 小さく書くよ。`
                  : `部分積を すべて たてに たそう。${partials.join(' + ')} = ${finalAnswer}`}
              </p>
            </div>
          ) : (
            <button
              onClick={() => setHintRevealed(true)}
              className="w-full py-2.5 bg-slate-900/60 border border-red-500/20 text-red-300/80 rounded-xl text-xs font-black transition-all hover:bg-red-950/30"
            >
              💡 まずは じぶんで考えてみよう（ヒントを見る）
            </button>
          )}

          <p className="text-center text-xs text-red-300/70 font-bold">
            {!isSumStep ? `${a} × ${currentDigit}(${bStr.length - 1 - stepIdx === 0 ? '一' : placeDigitLabel[stepIdx]}の位)は？` : 'すべての部分積を たした 答えは？'}
          </p>

          <div id="mcs-input-area" className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                <button
                  key={n}
                  onClick={() => handleKeypad(n.toString())}
                  className="h-12 bg-slate-900/60 hover:bg-red-900/40 active:bg-red-600 active:text-white border border-red-900/50 rounded-xl text-xl font-black text-white transition-all"
                >
                  {n}
                </button>
              ))}
              <button onClick={handleBackspace} className="h-12 bg-red-950/40 text-red-400 border border-red-500/20 rounded-xl flex items-center justify-center transition-all">
                ⌫
              </button>
            </div>
            <button
              onClick={checkStep}
              disabled={isSumStep ? userInput === '' : !cellBuffers.some((c) => c !== '')}
              className={`w-full py-4 rounded-2xl text-lg font-black shadow-lg transition-all ${
                (isSumStep ? userInput !== '' : cellBuffers.some((c) => c !== ''))
                  ? 'bg-red-600 text-white hover:bg-red-500 active:scale-95'
                  : 'bg-slate-900 text-red-900'
              }`}
            >
              チェック
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/** 1行ぶんの数字を右づめ・位ずらしで描画する共通行コンポーネント */
const Row: React.FC<{
  label: string; valStr: string; shift: number; totalWidth: number; rightOffset: number; cellW: number;
  borderBottom?: boolean; highlight?: boolean;
}> = ({ label, valStr, shift, totalWidth, rightOffset, cellW, borderBottom, highlight }) => {
  const offset = rightOffset - shift;
  const startIdx = offset - valStr.length + 1;
  return (
    <div className={`grid items-center text-center relative h-11 ${borderBottom ? 'border-b-2 border-white' : ''}`} style={{ gridTemplateColumns: `28px repeat(${totalWidth}, ${cellW}px)` }}>
      <div className="text-red-400 font-black text-lg flex justify-end pr-1">{label}</div>
      {Array(totalWidth).fill(0).map((_, i) => {
        const inRange = i >= startIdx && i <= offset;
        const char = inRange ? valStr[i - startIdx] : '';
        return (
          <div key={i} className={`w-9 h-11 sm:w-10 flex items-center justify-center ${highlight && inRange ? 'bg-red-500/10 ring-2 ring-red-400 ring-inset rounded-lg' : ''}`}>
            <span className={highlight ? 'text-red-400 animate-pulse' : 'text-white'}>{char}</span>
          </div>
        );
      })}
    </div>
  );
};

/** マスターモード用: 行全体をタップで選択できる版(合計の入力に使う) */
const SelectableRow: React.FC<{
  label: string; valStr: string; shift: number; totalWidth: number; rightOffset: number; cellW: number;
  isSelected: boolean; onSelect: () => void; isGraded: boolean; correctVal: string; disabled?: boolean;
  borderTop?: boolean;
}> = ({ label, valStr, shift, totalWidth, rightOffset, cellW, isSelected, onSelect, isGraded, correctVal, disabled, borderTop }) => {
  const offset = rightOffset - shift;
  const startIdx = offset - valStr.length + 1;
  const isCorrect = isGraded && valStr !== '' && parseInt(valStr, 10) === parseInt(correctVal, 10);
  return (
    <div className={`grid items-center text-center relative h-11 ${borderTop ? 'border-t-2 border-white mt-1' : ''}`} style={{ gridTemplateColumns: `28px repeat(${totalWidth}, ${cellW}px)` }}>
      <div className="text-red-400 font-black text-lg flex justify-end pr-1">{label}</div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={`col-span-full row-start-1 absolute inset-0 rounded-xl border-2 border-dashed transition-all ${
          isSelected ? 'border-red-400 bg-red-500/5 ring-2 ring-red-400/40 ring-inset' : 'border-transparent hover:bg-slate-900/40'
        }`}
        style={{ gridColumn: `2 / span ${totalWidth}` }}
        title="タップして このマスを えらぶ"
      />
      {Array(totalWidth).fill(0).map((_, i) => {
        const inRange = i >= startIdx && i <= offset;
        const char = inRange ? valStr[i - startIdx] : '';
        if (isGraded && char) {
          return (
            <div key={i} className="w-9 h-11 sm:w-10 flex items-center justify-center relative pointer-events-none">
              <span className={isCorrect ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold bg-rose-950/60 px-1 rounded'}>{char}</span>
            </div>
          );
        }
        return (
          <div key={i} className="w-9 h-11 sm:w-10 flex items-center justify-center relative pointer-events-none">
            <span className="text-white">{char}</span>
            {isSelected && !char && i === offset && <span className="text-red-800 animate-pulse">？</span>}
          </div>
        );
      })}
    </div>
  );
};

/**
 * 部分積を1マスずつ入力する行。2けた入力すると、十の位が繰り上がりとして
 * 左どなりのマスに小さく表示される(wari-hissann3 と同じ仕組み)。
 * `activeInput` のときは通常モードの「いま計算中」の行として使う。
 */
const CellRow: React.FC<{
  shift: number; totalWidth: number; rightOffset: number; cellW: number;
  width: number; buffers: string[]; selectedCol: number | null; onSelectCol: (col: number) => void;
  isGraded: boolean; correctVal: string; disabled?: boolean; activeInput?: boolean;
}> = ({ shift, totalWidth, rightOffset, cellW, width, buffers, selectedCol, onSelectCol, isGraded, correctVal, disabled, activeInput }) => {
  const offset = rightOffset - shift;
  const startIdx = offset - width + 1;
  return (
    <div className={`grid items-center text-center relative h-11 ${activeInput ? 'bg-red-500/10 ring-2 ring-red-400/40 rounded-xl mx-1' : ''}`} style={{ gridTemplateColumns: `28px repeat(${totalWidth}, ${cellW}px)` }}>
      <div className="text-red-400 font-black text-lg flex justify-end pr-1" />
      {Array(totalWidth).fill(0).map((_, i) => {
        const within = i >= startIdx && i <= offset;
        if (!within) return <div key={i} className="w-9 h-11 sm:w-10" />;
        const localIdx = i - startIdx; // 0=いちばん左(大きい位)
        const cellBuf = buffers[localIdx] ?? '';
        const mainChar = cellBuf.slice(-1);
        const isSelected = selectedCol === localIdx;
        const rightBuf = buffers[localIdx + 1] ?? '';
        const carry = rightBuf.length >= 2 ? rightBuf.slice(0, -1) : null;
        let display: React.ReactNode = mainChar;
        if (mainChar && isGraded) {
          const correct = mainChar === correctVal[localIdx];
          display = <span className={correct ? 'text-emerald-400 font-extrabold' : 'text-rose-400 font-extrabold bg-rose-950/60 px-1 rounded'}>{mainChar}</span>;
        }
        return (
          <div key={i} className="w-9 h-11 sm:w-10 flex items-center justify-center relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelectCol(localIdx)}
              className={`w-9 h-11 sm:w-10 flex items-center justify-center rounded-lg transition-all ${
                isSelected ? 'bg-slate-900 ring-2 ring-red-400 ring-inset' : 'bg-red-500/5 ring-1 ring-red-500/20 hover:bg-red-500/10'
              }`}
            >
              <span className="text-white">{display}</span>
              {isSelected && !mainChar && <span className="text-red-800 animate-pulse absolute">？</span>}
            </button>
            {carry && (
              <span className="absolute -top-1 right-0.5 text-[11px] font-black text-amber-400 bg-amber-950/80 border border-amber-500/40 rounded px-1 leading-tight z-10">
                {carry}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MultiplicationColumnSimulator;
