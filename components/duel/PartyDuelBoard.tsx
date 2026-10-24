/**
 * PartyDuelBoard.tsx — モンスター対戦（パーティ3匹か5匹・HPあり）の対戦画面
 *
 * CPU 戦（CpuPartyDuel）とクラス対戦（ClassDuel）で同じ画面を使う。数字（HP・ダメージ）は
 * CPU 戦は data/partyDuel.ts、クラス対戦はサーバが決めた値をそのまま出す。
 * 問題の部分は スピードデュエルと同じ DuelAnswerArea（答え方をそろえる）。
 */
import React from 'react';
import type { Problem } from '../../types';
import { getMonster, getMonsterSprite } from '../../data/adventure/monsters';
import { ELEMENTS } from '../../data/adventure/elements';
import { PARTY_DUEL, gritFactor } from '../../data/partyDuel';
import DuelAnswerArea from './DuelAnswerArea';

export interface BoardMon { defId: string; level: number; maxHp: number; hp: number }
export interface BoardSide { label: string; party: BoardMon[]; active: number }
/** guard = 受けた側も正解して まもった（ダメージが へっている） */
export interface BoardHit { damage: number; crit: boolean; type: number; grit: number; guard?: boolean }
export interface BoardTurn {
  myHit: BoardHit | null;
  oppHit: BoardHit | null;
  myKo: boolean;
  oppKo: boolean;
  myCorrect: boolean | null;
  oppCorrect: boolean | null;
  myDefId: string | null;
  oppDefId: string | null;
}

export type PartyPhase = 'countdown' | 'answering' | 'turn_result' | 'match_over';

interface Props {
  my: BoardSide;
  opp: BoardSide;
  phase: PartyPhase;
  turn: number;
  problem: Problem | null;
  /** このターンの問題は、どちらの場のモンスターの分野か */
  fieldOwner: 'mine' | 'theirs';
  isPlayerAnswered: boolean;
  isOpponentAnswered: boolean;
  /** しめきりまでの秒数。afterFirstSeconds より大きいあいだは「時間せいげん なし」（まだ だれも答えていない） */
  timeLeft: number;
  lastTurn: BoardTurn | null;
  /** 自分が攻撃できなかったターンの数（がんばり） */
  myMiss: number;
  result: 'win' | 'lose' | 'draw' | null;
  resultNote?: React.ReactNode;
  onAnswer: (answer: string) => void;
  onExit: () => void;
}

const nameOf = (defId: string | null | undefined) => (defId ? getMonster(defId)?.name ?? '？' : '？');

const MonPanel: React.FC<{ side: BoardSide; mine: boolean; shake?: boolean }> = ({ side, mine, shake }) => {
  const cur = side.party[Math.min(side.active, side.party.length - 1)];
  const def = cur ? getMonster(cur.defId) : undefined;
  const el = def ? ELEMENTS[def.type] : undefined;
  const pct = cur ? Math.max(0, Math.min(100, (cur.hp / Math.max(1, cur.maxHp)) * 100)) : 0;
  return (
    <div className={`flex items-center gap-3 ${mine ? 'flex-row' : 'flex-row-reverse'} w-full`}>
      {cur && (
        <img src={getMonsterSprite(cur.defId)} alt=""
          className={`w-20 h-20 sm:w-24 sm:h-24 object-contain shrink-0 ${shake ? 'animate-pulse' : ''} ${cur.hp <= 0 ? 'grayscale opacity-40' : ''}`} />
      )}
      <div className="flex-1 min-w-0">
        <div className={`flex items-baseline gap-2 ${mine ? '' : 'justify-end'}`}>
          <span className="text-[10px] text-gray-400 font-bold">{side.label}</span>
          <span className="text-sm sm:text-base font-black text-white truncate">{def?.name ?? ''}</span>
          {cur && <span className="text-xs font-bold text-gray-400">Lv.{cur.level}</span>}
          {el && <span className="text-[10px]" style={{ color: el.color }}>{el.icon}{el.name}</span>}
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mt-1 border border-slate-700">
          <div className={`h-full transition-all duration-700 ${pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-400' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }} />
        </div>
        <div className={`flex items-center gap-1 mt-1 ${mine ? '' : 'justify-end'}`}>
          {cur && <span className="text-[10px] font-mono text-gray-400 mr-1">{Math.max(0, cur.hp)} / {cur.maxHp}</span>}
          {side.party.map((m, i) => (
            <img key={i} src={getMonsterSprite(m.defId)} alt="" title={nameOf(m.defId)}
              className={`w-5 h-5 object-contain ${m.hp <= 0 ? 'grayscale opacity-30' : i === side.active ? 'ring-1 ring-emerald-400 rounded' : 'opacity-80'}`} />
          ))}
        </div>
      </div>
    </div>
  );
};

/** guardBy = まもった側の よび名（「あいて」「きみ」） */
function hitLine(who: string, hit: BoardHit | null, correct: boolean | null, guardBy: string): string[] {
  if (!hit) return [correct === null ? `${who}：じかんぎれ…` : `${who}：こうげき できなかった…`];
  const extra = [
    hit.guard ? `${guardBy}も せいかいして まもった！（ダメージ へった）` : '',
    hit.crit ? 'きゅうしょに あたった！' : '',
    hit.type > 1 ? 'こうかは ばつぐんだ！' : hit.type < 1 ? 'こうかは いまひとつ…' : '',
    hit.grit > 0 ? 'がんばりパワー！' : '',
  ].filter(Boolean);
  return [`${who}の こうげき！ ${hit.damage} ダメージ`, ...extra];
}

const PartyDuelBoard: React.FC<Props> = ({
  my, opp, phase, turn, problem, fieldOwner, isPlayerAnswered, isOpponentAnswered, timeLeft,
  lastTurn, myMiss, result, resultNote, onAnswer, onExit,
}) => {
  const myCur = my.party[Math.min(my.active, my.party.length - 1)];
  const oppCur = opp.party[Math.min(opp.active, opp.party.length - 1)];
  const fieldDef = getMonster((fieldOwner === 'mine' ? myCur : oppCur)?.defId ?? '');
  const limit = PARTY_DUEL.afterFirstSeconds;
  // だれも答えていないあいだは しめきりが遠い（capSeconds）。そのあいだは バーを出さない
  const untimed = timeLeft > limit;

  if (phase === 'match_over') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-white text-center overflow-y-auto">
        <div className="text-6xl mb-3">{result === 'win' ? '🏆' : result === 'lose' ? '😢' : '🤝'}</div>
        <h2 className="text-4xl font-black mb-2">{result === 'win' ? 'かち！' : result === 'lose' ? 'まけ…' : 'ひきわけ'}</h2>
        {resultNote && <div className="text-sm text-gray-300 mb-4 max-w-md">{resultNote}</div>}
        <div className="flex gap-6 mb-6">
          {[my, opp].map((s, k) => (
            <div key={k} className="text-center">
              <p className="text-xs font-bold text-gray-400 mb-1">{s.label}</p>
              <div className="flex gap-1">
                {s.party.map((m, i) => (
                  <img key={i} src={getMonsterSprite(m.defId)} alt="" className={`w-10 h-10 object-contain ${m.hp <= 0 ? 'grayscale opacity-30' : ''}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={onExit} className="btn-tactical px-8 py-3 rounded-xl text-lg font-bold">もどる</button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center p-3 sm:p-4 overflow-y-auto text-white">
      <div className="w-full max-w-3xl space-y-2 flex-shrink-0">
        <MonPanel side={opp} mine={false} shake={phase === 'turn_result' && !!lastTurn?.myHit} />
        <MonPanel side={my} mine shake={phase === 'turn_result' && !!lastTurn?.oppHit} />
      </div>

      <div className="w-full max-w-3xl mt-2 flex items-center justify-between text-[11px] font-bold flex-shrink-0">
        <span className="text-emerald-300">
          ターン {turn}：{fieldOwner === 'mine' ? 'きみの' : 'あいての'} {fieldDef?.name ?? ''} の もんだい（{fieldDef?.subtopic ?? ''}）
        </span>
        <span className="text-gray-400">
          {isPlayerAnswered && phase === 'answering' && <span className="text-green-400 mr-2">✓ こたえた</span>}
          {isOpponentAnswered && phase === 'answering' && <span className="text-red-300">あいて ✓</span>}
        </span>
      </div>

      {phase === 'answering' && (
        <div className="w-full max-w-3xl mt-1 flex-shrink-0">
          {untimed ? (
            <p className="text-center text-[11px] font-bold text-sky-300">
              ⏳ じかんせいげん なし。じっくり といてね（どちらかが こたえたら、のこりは {limit}びょう）
            </p>
          ) : (
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (timeLeft / limit) * 100)}%` }} />
            </div>
          )}
          <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
            <span>{myMiss > 0 ? `がんばりパワー ×${gritFactor(myMiss).toFixed(2)}（せいかいすると つよい こうげき）` : 'せいかいすると こうげき＋まもり！ 2人とも せいかいなら 2人とも こうげき（まもりで すこし へる）'}</span>
            {!untimed && <span className="font-mono">{timeLeft}s</span>}
          </div>
        </div>
      )}

      {phase === 'countdown' && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-lg text-emerald-300 font-bold animate-pulse">ターン {turn} … もんだいが でるよ</p>
        </div>
      )}

      {phase === 'answering' && problem && (
        <div className="w-full max-w-3xl flex-1 mt-2">
          <div className="bg-slate-950/80 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-3 sm:p-5">
            <DuelAnswerArea problem={problem} round={turn} active isPlayerAnswered={isPlayerAnswered} onAnswer={onAnswer} allowPass />
          </div>
        </div>
      )}

      {phase === 'turn_result' && lastTurn && (
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="hud-panel rounded-2xl p-4 sm:p-6 max-w-md w-full text-center space-y-1">
            {hitLine(`きみの ${nameOf(lastTurn.myDefId)}`, lastTurn.myHit, lastTurn.myCorrect, 'あいて').map((t, i) => (
              <p key={`m${i}`} className={i === 0 ? 'text-base font-black text-emerald-300' : 'text-xs font-bold text-amber-300'}>{t}</p>
            ))}
            {hitLine(`あいての ${nameOf(lastTurn.oppDefId)}`, lastTurn.oppHit, lastTurn.oppCorrect, 'きみ').map((t, i) => (
              <p key={`o${i}`} className={i === 0 ? 'text-base font-black text-red-300 mt-2' : 'text-xs font-bold text-amber-300'}>{t}</p>
            ))}
            {lastTurn.oppKo && <p className="text-sm font-black text-white mt-2">あいての {nameOf(lastTurn.oppDefId)} は たおれた！</p>}
            {lastTurn.myKo && <p className="text-sm font-black text-white mt-1">きみの {nameOf(lastTurn.myDefId)} は たおれた！</p>}
          </div>
        </div>
      )}

      <div className="mt-3 flex-shrink-0">
        <button onClick={onExit} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">たいせんを やめる</button>
      </div>
    </div>
  );
};

export default PartyDuelBoard;
