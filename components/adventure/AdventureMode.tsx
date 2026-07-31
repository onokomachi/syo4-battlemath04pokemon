/**
 * AdventureMode.tsx — 3Dアドベンチャー「ナンバーランド」の入口。
 *
 * 画面のきりかえ(フィールド / バトル / 図鑑 / てもち / マップ / ショップ / リーグ)と、
 * NPCとの会話・イベント進行をまとめている。学習データ(問題・採点・SRS・学習記録)は
 * すべて既存のものをそのまま使い、このモードは「入れもの」に徹している。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BattleResultSummary, BattleSetup, FieldNpcDef, TownDef,
} from '../../data/adventure/adventureTypes';
import type { ItemId } from '../../data/adventure/adventureTypes';
import { TOWNS, SPAWN, BADGE_NAMES, getTown } from '../../data/adventure/towns';
import { MONSTERS_BY_UNIT, getMonster, getMonsterSprite } from '../../data/adventure/monsters';
import { ELEMENTS } from '../../data/adventure/elements';
import { CHAMPION, ELITE_FOUR, RIVALS, getNpcSprite } from '../../data/adventure/people';
import { useAdventureStore, canChallengeLeague, gymProgress, earnedAdventureTitles } from '../../store/adventureStore';
import { missingLines } from '../../data/adventure/gymRequirements';
import FieldScene, { type FieldControl } from './field/FieldScene';
import { ActionButton, VirtualPad } from './ui/VirtualPad';
import { DialogueBox } from './ui/DialogueBox';
import BattleScreen from './BattleScreen';
import TitleScreen from './TitleScreen';
import { DexScreen, MapScreen, PartyScreen, ShopScreen, TrainerCardScreen } from './MenuScreens';

interface Props {
  onExit: () => void;
  /** 先生が管理画面でロックした単元 */
  lockedUnits: Set<string>;
  /** MPの残高と加算(既存の progressionStore につなぐ) */
  mathPoints: number;
  onAddMathPoints: (n: number) => void;
  onSpendMathPoints: (n: number) => boolean;
  /** 児童のログイン名(なまえの初期値に使う) */
  defaultName?: string;
  /** Firestore 同期用のUID(未ログインなら null) */
  uid?: string | null;
}

type Overlay = 'none' | 'dex' | 'party' | 'map' | 'shop' | 'card';

interface Dialogue {
  speaker?: string;
  portrait?: string;
  lines: string[];
  accent?: string;
  onDone: () => void;
}

const AdventureMode: React.FC<Props> = ({
  onExit, lockedUnits, mathPoints, onAddMathPoints, onSpendMathPoints, defaultName, uid,
}) => {
  const save = useAdventureStore(s => s.save);
  const store = useAdventureStore();

  const [overlay, setOverlay] = useState<Overlay>('none');
  const [battle, setBattle] = useState<BattleSetup | null>(null);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [nearNpc, setNearNpc] = useState<FieldNpcDef | null>(null);
  const [leagueStage, setLeagueStage] = useState<number | null>(null);
  /** 直前に持っていた称号ID。増えたぶんだけ「もらった」と知らせる。 */
  const knownTitles = useRef<Set<string> | null>(null);
  const [titleToast, setTitleToast] = useState<{ icon: string; name: string } | null>(null);

  const control = useRef<FieldControl>({
    moveX: 0, moveY: 0, target: null,
    pos: { x: 0, z: 0 }, nearNpc: null, enabled: true,
  });

  // 起動時に、Firebaseが設定されていれば新しい方のセーブを取りこむ
  useEffect(() => {
    if (uid) void store.loadFromCloud(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const town: TownDef = useMemo(
    () => getTown(save.townId) ?? TOWNS[0],
    [save.townId],
  );

  // ロックされている町にいたら、行ける町へ移す(先生が途中でロックした場合の保険)
  useEffect(() => {
    if (!save.started) return;
    if (lockedUnits.has(town.unit)) {
      const open = TOWNS.find(t => !lockedUnits.has(t.unit));
      if (open) {
        store.setTown(open.id);
        setDialogue({
          lines: [
            'この町は、まだ 先生が ひらいていないみたい。',
            `${open.name} に もどってきたよ。`,
          ],
          accent: '#f59e0b',
          onDone: () => setDialogue(null),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [town.unit, lockedUnits, save.started]);

  // 町に初めて来たときの導入テキスト
  useEffect(() => {
    if (!save.started) return;
    if (store.markEvent(`intro:${town.id}`)) {
      setDialogue({
        speaker: town.name,
        accent: ELEMENTS[town.type].color,
        lines: town.intro,
        onDone: () => setDialogue(null),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [town.id, save.started]);

  // 称号の新規獲得を見つけて知らせる(バトル終了などで実績が動いたとき)
  useEffect(() => {
    const now = earnedAdventureTitles(save);
    const ids = new Set(now.map(t => t.id));
    if (knownTitles.current === null) {
      // 初回はいまの状態を覚えるだけ(過去ぶんを一度に出さない)
      knownTitles.current = ids;
      return;
    }
    const fresh = now.filter(t => !knownTitles.current!.has(t.id));
    knownTitles.current = ids;
    if (fresh.length > 0) {
      const t = fresh[fresh.length - 1];
      setTitleToast({ icon: t.icon, name: t.name });
      window.setTimeout(() => setTitleToast(null), 4200);
    }
  }, [save.badges.length, save.owned.length, save.defeatedNpcs.length, save.leagueProgress, save.champion, save]);

  // 会話中・バトル中・メニュー中は移動できないようにする
  const inputEnabled = !dialogue && !battle && overlay === 'none';
  useEffect(() => {
    control.current.enabled = inputEnabled;
    if (!inputEnabled) { control.current.moveX = 0; control.current.moveY = 0; control.current.target = null; }
  }, [inputEnabled]);

  // ---- 野生のエンカウント ----
  const handleEncounter = useCallback(() => {
    if (battle || dialogue) return;
    const pool = MONSTERS_BY_UNIT[town.unit] ?? [];
    if (pool.length === 0) return;
    const def = pool[Math.floor(Math.random() * pool.length)];
    const level = Math.max(2, town.wildLevel + Math.floor(Math.random() * 3) - 1);
    setBattle({
      kind: 'wild',
      opponents: [{ defId: def.id, level }],
      questionsPerOpponent: 3 + Math.floor(Math.random() * 3),  // 3〜5問
      catchable: true,
      townId: town.id,
    });
  }, [battle, dialogue, town]);

  // ---- NPCに話しかける ----
  const interact = useCallback(() => {
    const npc = control.current.nearNpc;
    if (!npc || !inputEnabled) return;

    const accent = ELEMENTS[town.type].color;
    const portrait = getNpcSprite(npc.sprite);

    if (npc.kind === 'nurse') {
      store.healFull();
      setDialogue({
        speaker: npc.name, portrait, accent: '#f472b6',
        lines: npc.lines,
        onDone: () => setDialogue(null),
      });
      return;
    }
    if (npc.kind === 'shop') {
      setDialogue({
        speaker: npc.name, portrait, accent: '#7c3aed',
        lines: npc.lines,
        onDone: () => { setDialogue(null); setOverlay('shop'); },
      });
      return;
    }
    if (npc.kind === 'villager') {
      setDialogue({
        speaker: npc.name, portrait, accent,
        lines: npc.lines,
        onDone: () => setDialogue(null),
      });
      return;
    }

    // 単元マスター(ジムリーダー)は、その町でひととおり遊んでからでないと挑めない
    if (npc.kind === 'master' && !save.defeatedNpcs.includes(npc.id)) {
      const prog = gymProgress(save, town);
      if (!prog.ready) {
        setDialogue({
          speaker: npc.name, portrait, accent,
          lines: [
            `わしに いどむには、まだ 早いようじゃな。`,
            'この町で もう少し 修行してから おいで。',
            'ひつような ことは ―― ',
            ...missingLines(prog),
          ],
          onDone: () => setDialogue(null),
        });
        return;
      }
    }

    // トレーナー・単元マスター
    const beaten = save.defeatedNpcs.includes(npc.id);
    if (beaten) {
      setDialogue({
        speaker: npc.name, portrait, accent,
        lines: npc.afterLines ?? ['また しょうぶ しようね！'],
        onDone: () => setDialogue(null),
      });
      return;
    }
    setDialogue({
      speaker: npc.name, portrait, accent,
      lines: npc.lines,
      onDone: () => {
        setDialogue(null);
        setBattle({
          kind: npc.kind === 'master' ? 'master' : 'trainer',
          trainerName: npc.name,
          trainerSprite: npc.sprite,
          trainerAfterLines: npc.afterLines,
          opponents: npc.party ?? [],
          subtopics: npc.subtopics,
          questionsPerOpponent: npc.kind === 'master' ? 4 : 3,
          catchable: false,
          reward: npc.reward,
          townId: town.id,
          grantsBadge: npc.grantsBadge,
        });
      },
    });
  }, [inputEnabled, town, save.defeatedNpcs, store]);

  // ---- バトル終了 ----
  const handleBattleFinish = (result: BattleResultSummary) => {
    const setup = battle;
    setBattle(null);
    if (!setup) return;

    if (result.mpGained > 0) onAddMathPoints(result.mpGained);

    const after: Dialogue[] = [];

    if (result.won && setup.kind !== 'wild' && setup.trainerName) {
      const npc = town.npcs.find(n => n.name === setup.trainerName);
      if (npc) store.markNpcDefeated(npc.id);
    }

    if (result.won && setup.grantsBadge && setup.townId) {
      store.awardBadge(setup.townId);
      after.push({
        accent: '#facc15',
        lines: [
          `${BADGE_NAMES[setup.townId] ?? 'バッジ'} を 手に入れた！`,
          `これで バッジは ${new Set([...save.badges, setup.townId]).size} こ。`,
          ...(new Set([...save.badges, setup.townId]).size >= TOWNS.length
            ? ['14この バッジが そろった！ ナンバーリーグへ 行こう！']
            : []),
        ],
        onDone: () => setDialogue(null),
      });
    }

    // リーグ戦の進行
    if (leagueStage !== null) {
      if (result.won) {
        if (leagueStage < ELITE_FOUR.length) {
          store.setLeagueProgress(leagueStage + 1);
          const next = leagueStage + 1;
          setLeagueStage(next);
          startLeagueBattle(next);
          return;
        }
        // チャンピオン撃破
        store.setChampion();
        setLeagueStage(null);
        setDialogue({
          speaker: CHAMPION.name, portrait: getNpcSprite(CHAMPION.sprite), accent: '#f59e0b',
          lines: CHAMPION.afterLines,
          onDone: () => {
            setDialogue({
              accent: '#f59e0b',
              lines: [
                '―― ナンバーランド地方に、あたらしい チャンピオンが うまれた。',
                `${save.playerName} の 名前は、この地方の いちばん高い ところに きざまれた。`,
                'でも、ぼうけんは まだ おわらない。',
                'つかまえていない モンスターも、まだ たくさん いるのだから。',
                'おめでとう！',
              ],
              onDone: () => { setDialogue(null); void store.syncToCloud(uid ?? null); },
            });
          },
        });
        return;
      }
      // 負けたらリーグは最初から
      setLeagueStage(null);
      setDialogue({
        accent: '#f43f5e',
        lines: ['リーグは また はじめから ちょうせんできるよ。', 'てもちを 育ててから もう一度 来よう！'],
        onDone: () => setDialogue(null),
      });
      return;
    }

    if (result.caughtDefId) {
      const def = getMonster(result.caughtDefId);
      after.push({
        accent: '#22c55e',
        lines: [
          `${def?.name} が なかまに なった！`,
          `ずかんに ${def?.name} の データが 追加された。`,
        ],
        onDone: () => setDialogue(null),
      });
    }

    if (after.length > 0) {
      // 続けて出す(1つ目が閉じたら2つ目)
      const chain = (i: number) => {
        if (i >= after.length) { setDialogue(null); void store.syncToCloud(uid ?? null); return; }
        setDialogue({ ...after[i], onDone: () => chain(i + 1) });
      };
      chain(0);
    } else {
      void store.syncToCloud(uid ?? null);
    }
  };

  // ---- リーグ ----
  const startLeagueBattle = (stage: number) => {
    // stage 0〜3 = 四天王、4 = チャンピオン
    if (stage < ELITE_FOUR.length) {
      const e = ELITE_FOUR[stage];
      const pool = e.units.flatMap(u => MONSTERS_BY_UNIT[u] ?? []);
      const sorted = pool.slice().sort((a, b) => b.difficulty - a.difficulty);
      const level = 30 + stage * 3;
      setDialogue({
        speaker: `${e.title} ${e.name}`,
        portrait: getNpcSprite(e.sprite),
        accent: '#7c3aed',
        lines: e.lines,
        onDone: () => {
          setDialogue(null);
          setBattle({
            kind: 'elite',
            trainerName: e.name,
            trainerSprite: e.sprite,
            trainerAfterLines: e.afterLines,
            opponents: sorted.slice(0, 3).map(m => ({ defId: m.id, level })),
            questionsPerOpponent: 3,
            catchable: false,
            reward: { mp: 400 + stage * 100 },
          });
        },
      });
    } else {
      // チャンピオンは7タイプすべてから1体ずつ…は長すぎるので、代表3体
      const picks = ['大きい数のしくみ', '分数', '倍の見方']
        .flatMap(u => (MONSTERS_BY_UNIT[u] ?? []).slice().sort((a, b) => b.difficulty - a.difficulty)[0])
        .filter(Boolean);
      setDialogue({
        speaker: CHAMPION.name,
        portrait: getNpcSprite(CHAMPION.sprite),
        accent: '#f59e0b',
        lines: CHAMPION.lines,
        onDone: () => {
          setDialogue(null);
          setBattle({
            kind: 'champion',
            trainerName: CHAMPION.name,
            trainerSprite: CHAMPION.sprite,
            opponents: picks.map(m => ({ defId: m.id, level: 45 })),
            questionsPerOpponent: 4,
            catchable: false,
            reward: { mp: 2000 },
          });
        },
      });
    }
  };

  const enterLeague = () => {
    if (!canChallengeLeague(save)) return;
    setLeagueStage(0);
    setDialogue({
      accent: '#7c3aed',
      lines: [
        'ナンバーリーグ ―― 地方で いちばん つよい人たちが 待つ 場所。',
        '四天王を 4人 ぬいたら、その先に チャンピオンが いる。',
        'とちゅうで まけたら、また はじめから。……いくよ！',
      ],
      onDone: () => { setDialogue(null); startLeagueBattle(0); },
    });
  };

  const handleBuy = (item: ItemId, cost: number) => {
    if (!onSpendMathPoints(cost)) return;
    store.addItem(item, 1);
  };

  // ---- ゲームを始めていないとき ----
  if (!save.started) {
    return (
      <TitleScreen
        defaultName={defaultName}
        onExit={onExit}
        onStart={(name, appearance, starterDefId) => {
          store.startGame(name, appearance, starterDefId);
        }}
      />
    );
  }

  const startAt = SPAWN(town);
  const rival = RIVALS[save.appearance];
  const gym = gymProgress(save, town);
  const hasBadge = save.badges.includes(town.id);

  return (
    <div className="fixed inset-0 z-30 bg-black overflow-hidden select-none">
      {/* 3Dフィールド */}
      <FieldScene
        key={town.id}
        town={town}
        appearance={save.appearance}
        control={control}
        npcs={town.npcs}
        defeatedNpcs={save.defeatedNpcs}
        onEncounter={handleEncounter}
        onNearNpcChange={setNearNpc}
        startAt={startAt}
      />

      {/* 上部のHUD */}
      <div className="absolute top-0 inset-x-0 p-2 sm:p-3 flex items-start justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-white/90 shadow-lg px-3 py-2 sm:px-4 sm:py-2.5 max-w-[16rem] sm:max-w-xs">
          <p className="text-lg sm:text-xl font-black text-slate-800 leading-none">{town.name}</p>
          <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5">{town.unit}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs font-black text-slate-600">🏅 {save.badges.length}/14</span>
            <span className="text-xs font-black text-slate-600">⚪ {save.items.ball ?? 0}</span>
            <span className="text-xs font-black text-amber-600">MP {mathPoints}</span>
          </div>
          <div className="mt-1 w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{ width: `${(save.hp / Math.max(1, save.maxHp)) * 100}%` }}
            />
          </div>

          {/* この町の「つぎに やること」。小4が迷わないよう常に出しておく。 */}
          <div className="mt-2 pt-2 border-t-2 border-slate-200">
            {hasBadge ? (
              <p className="text-xs font-black text-emerald-600">
                🏅 {BADGE_NAMES[town.id]} かくとくずみ！
              </p>
            ) : gym.ready ? (
              <p className="text-xs font-black text-rose-600 animate-pulse">
                ⚔ どうじょうに いどめる！(北へ)
              </p>
            ) : (
              <>
                <p className="text-[11px] font-black text-slate-500 mb-1">どうじょうに いどむには</p>
                <div className="space-y-0.5">
                  {([
                    ['トレーナー', gym.trainersBeaten, gym.trainersNeeded, '人'],
                    ['つかまえる', gym.caught, gym.caughtNeeded, '体'],
                    ['せいかい', gym.correct, gym.correctNeeded, '問'],
                  ] as const).map(([label, cur, need, unit]) => {
                    const done = cur >= need;
                    return (
                      <div key={label} className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black w-16 shrink-0 ${done ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {done ? '✓' : '・'}{label}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full ${done ? 'bg-emerald-400' : 'bg-sky-400'}`}
                            style={{ width: `${Math.min(100, (cur / need) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 w-12 text-right shrink-0">
                          {Math.min(cur, need)}/{need}{unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5 sm:gap-2 max-w-[62%]">
          {([
            ['🗺 マップ', () => setOverlay('map')],
            ['📕 ずかん', () => setOverlay('dex')],
            ['🐾 てもち', () => setOverlay('party')],
            ['🪪 カード', () => setOverlay('card')],
            ['🏠 もどる', onExit],
          ] as const).map(([label, fn]) => (
            <button
              key={label}
              onClick={fn}
              className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-white/90 shadow-lg font-black text-slate-700 text-sm sm:text-base active:scale-95"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 操作 */}
      <VirtualPad
        disabled={!inputEnabled}
        onMove={(x, y) => { control.current.moveX = x; control.current.moveY = y; }}
      />
      <div className="absolute right-4 bottom-6">
        <ActionButton
          label={nearNpc ? 'はなす' : 'しらべる'}
          sub={nearNpc ? nearNpc.name : 'ちかくを しらべる'}
          onClick={interact}
          disabled={!inputEnabled || !nearNpc}
          highlight={Boolean(nearNpc) && inputEnabled}
        />
      </div>

      {/* 草むらの案内(はじめの町だけ) */}
      {town.no === 1 && save.owned.length <= 1 && !dialogue && !battle && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 pointer-events-none">
          <p className="px-5 py-2.5 rounded-full bg-black/60 text-white font-black text-sm sm:text-base shadow-lg">
            こい色の 草むらを 歩くと、モンスターが 出てくるよ！
          </p>
        </div>
      )}

      {/* 称号を手に入れたときの知らせ */}
      {titleToast && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="rounded-3xl bg-gradient-to-r from-amber-400 to-yellow-300 px-7 py-3 shadow-2xl border-4 border-white animate-bounce">
            <p className="text-xs font-black text-amber-900">しょうごうを 手に入れた！</p>
            <p className="text-xl font-black text-amber-950">{titleToast.icon} {titleToast.name}</p>
          </div>
        </div>
      )}

      {/* 会話 */}
      {dialogue && (
        <DialogueBox
          speaker={dialogue.speaker}
          portrait={dialogue.portrait}
          lines={dialogue.lines}
          accent={dialogue.accent}
          onDone={dialogue.onDone}
        />
      )}

      {/* メニュー */}
      {overlay === 'dex' && <DexScreen onClose={() => setOverlay('none')} />}
      {overlay === 'card' && <TrainerCardScreen onClose={() => setOverlay('none')} />}
      {overlay === 'party' && <PartyScreen onClose={() => setOverlay('none')} />}
      {overlay === 'shop' && (
        <ShopScreen onClose={() => setOverlay('none')} mathPoints={mathPoints} onBuy={handleBuy} />
      )}
      {overlay === 'map' && (
        <MapScreen
          onClose={() => setOverlay('none')}
          onTravel={id => { store.setTown(id); void store.syncToCloud(uid ?? null); }}
          onLeague={enterLeague}
          lockedUnits={lockedUnits}
        />
      )}

      {/* バトル */}
      {battle && <BattleScreen setup={battle} onFinish={handleBattleFinish} />}

      {/* ライバルの名前は物語で使う(将来のイベント用に保持) */}
      <span className="hidden">{rival.name}</span>
    </div>
  );
};

export default AdventureMode;
