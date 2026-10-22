/**
 * SpeedDuelBoard.tsx — スピードデュエル対戦画面
 *
 * 同じ問題を両プレイヤーに同時出題し、先に正解した方がラウンド勝利。
 * デッキ不要・カード選択なし。
 */
import React from 'react';
import type { Problem, BattleFormat } from '../types';
import DuelAnswerArea from './duel/DuelAnswerArea';

type SpeedPhase = 'countdown' | 'answering' | 'round_result' | 'match_over';

interface DuelMonster {
  name: string;
  sprite: string;
}

interface SpeedDuelBoardProps {
  problem: Problem | null;
  playerScore: number;
  opponentScore: number;
  round: number;
  totalRounds: number;
  format: BattleFormat;
  phase: SpeedPhase;
  onAnswer: (answer: string) => void;
  onNextRound: () => void;
  onExit: () => void;
  roundWinner: 'player' | 'opponent' | 'draw' | null;
  playerName: string;
  opponentName: string;
  isPlayerAnswered: boolean;
  isOpponentAnswered: boolean;
  timeLeft: number;
  gameResult: 'win' | 'lose' | 'draw' | null;
  /** モンスター対戦のときだけ渡す。見た目の演出のみで、勝敗には影響しない */
  playerMonster?: DuelMonster | null;
  opponentMonster?: DuelMonster | null;
  /** 1ラウンドの秒数（時間のバーの長さ）。クラス対戦は45秒 */
  timeLimit?: number;
  /** クラス対戦: ラウンドの結果のあと、サーバが決めた時刻に自動で次へ進む（「次のラウンドへ」を出さない） */
  autoNext?: boolean;
}

const SpeedDuelBoard: React.FC<SpeedDuelBoardProps> = ({
  problem,
  playerScore,
  opponentScore,
  round,
  totalRounds,
  format,
  phase,
  onAnswer,
  onNextRound,
  onExit,
  roundWinner,
  playerName,
  opponentName,
  isPlayerAnswered,
  isOpponentAnswered,
  timeLeft,
  gameResult,
  playerMonster,
  opponentMonster,
  timeLimit = 30,
  autoNext = false,
}) => {
  const formatLabel = format === 'best_of_3' ? '3本勝負'
    : format === 'best_of_5' ? '5本勝負'
    : format === 'best_of_7' ? '7本勝負' : 'マスターデュエル';

  const getRequiredWins = (f: BattleFormat) => {
    if (f === 'best_of_3') return 2;
    if (f === 'best_of_5') return 3;
    if (f === 'best_of_7') return 4;
    return 0;
  };

  const requiredWins = getRequiredWins(format);
  const isBestOf = requiredWins > 0;

  // Match over screen
  if (phase === 'match_over') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-white">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            {gameResult === 'win' ? '🏆' : gameResult === 'lose' ? '😢' : '🤝'}
          </div>
          <h2 className="text-4xl font-black mb-2">
            {gameResult === 'win' ? '勝利！' : gameResult === 'lose' ? '敗北...' : '引き分け'}
          </h2>
          <p className="text-lg text-orange-400 font-bold">SPEED DUEL - {formatLabel}</p>
        </div>

        <div className="flex items-center gap-8 mb-8">
          <div className="text-center">
            {playerMonster && (
              <img src={playerMonster.sprite} alt="" className="w-16 h-16 object-contain mx-auto mb-1" />
            )}
            <p className="text-sm text-orange-400 font-bold">{playerMonster?.name ?? playerName}</p>
            <p className="text-5xl font-black text-white">{playerScore}</p>
          </div>
          <span className="text-2xl text-gray-500 font-bold">-</span>
          <div className="text-center">
            {opponentMonster && (
              <img src={opponentMonster.sprite} alt="" className="w-16 h-16 object-contain mx-auto mb-1" />
            )}
            <p className="text-sm text-gray-400 font-bold">{opponentMonster?.name ?? opponentName}</p>
            <p className="text-5xl font-black text-gray-400">{opponentScore}</p>
          </div>
        </div>

        <button
          onClick={onExit}
          className="btn-tactical px-8 py-4 rounded-xl text-lg font-bold"
        >
          メニューに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center p-3 sm:p-4 relative overflow-y-auto">
      {/* Header: Score & Round */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-3 flex-shrink-0">
        {/* Player Score */}
        <div className="flex items-center gap-3">
          {playerMonster && (
            <img src={playerMonster.sprite} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
          )}
          <div className="text-center">
            <p className="text-[10px] text-orange-400 font-bold">{playerMonster?.name ?? playerName}</p>
            <p className="text-3xl font-black text-white font-mono">{playerScore}</p>
          </div>
          {isPlayerAnswered && phase === 'answering' && (
            <span className="text-xs text-green-400 font-bold animate-pulse">✓ 解答済</span>
          )}
        </div>

        {/* Round Info */}
        <div className="text-center">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 text-lg">⚡</span>
            <span className="text-xs text-gray-400 font-bold tracking-widest">SPEED DUEL</span>
            <span className="text-orange-400 text-lg">⚡</span>
          </div>
          <p className="text-sm font-bold text-white mt-0.5">
            {isBestOf
              ? `Round ${round} / ${totalRounds}`
              : `Round ${round} / ${totalRounds}`
            }
          </p>
          <p className="text-[10px] text-gray-500">{formatLabel}</p>
        </div>

        {/* Opponent Score */}
        <div className="flex items-center gap-3">
          {isOpponentAnswered && phase === 'answering' && (
            <span className="text-xs text-red-400 font-bold animate-pulse">✓ 解答済</span>
          )}
          <div className="text-center">
            <p className="text-[10px] text-gray-400 font-bold">{opponentMonster?.name ?? opponentName}</p>
            <p className="text-3xl font-black text-gray-400 font-mono">{opponentScore}</p>
          </div>
          {opponentMonster && (
            <img src={opponentMonster.sprite} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Timer Bar */}
      {phase === 'answering' && (
        <div className="w-full max-w-3xl mb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 font-bold">残り時間</span>
            <span className={`text-sm font-bold font-mono ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-orange-400'}`}>
              {timeLeft}s
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-amber-500' : 'bg-orange-500'}`}
              style={{ width: `${(timeLeft / timeLimit) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Countdown */}
      {phase === 'countdown' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl text-orange-400 font-bold mb-4">Round {round}</p>
            <p className="text-8xl font-black text-white animate-pulse">⏳</p>
            <p className="text-lg text-gray-400 mt-4">問題が出題されます...</p>
          </div>
        </div>
      )}

      {/* Problem & Answer Area */}
      {phase === 'answering' && problem && (
        <div className="w-full max-w-3xl flex-1 overflow-y-auto">
          <div className="bg-slate-950/80 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-3 sm:p-5 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent" />

            <DuelAnswerArea problem={problem} round={round} active={phase === 'answering'} isPlayerAnswered={isPlayerAnswered} onAnswer={onAnswer} />
          </div>
        </div>
      )}

      {/* Round Result */}
      {phase === 'round_result' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">
              {roundWinner === 'player' ? '😎' : roundWinner === 'opponent' ? '💩' : '😐'}
            </div>
            <h3 className="text-2xl font-black mb-2">
              {roundWinner === 'player' ? '先に正解！' : roundWinner === 'opponent' ? '相手が先に正解...' : '両者不正解'}
            </h3>
            <p className="text-lg text-orange-400 font-bold mb-6">
              {playerScore} - {opponentScore}
            </p>
            {autoNext ? (
              <p className="text-sm text-gray-400 font-bold animate-pulse">つぎの もんだいが はじまるよ…</p>
            ) : (
              <button
                onClick={onNextRound}
                className="btn-tactical px-8 py-3 rounded-xl text-sm font-bold"
              >
                次のラウンドへ
              </button>
            )}
          </div>
        </div>
      )}

      {/* Exit button */}
      <div className="mt-3 flex-shrink-0">
        <button
          onClick={onExit}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          退出する
        </button>
      </div>
    </div>
  );
};

export default SpeedDuelBoard;
