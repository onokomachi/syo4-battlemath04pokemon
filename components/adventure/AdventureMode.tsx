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
import {
  useAdventureStore, canChallengeLeague, gymProgress, earnedAdventureTitles,
  shrinesInTown, pendingTeamChapter, canEnterHideout, evolvableInParty,
} from '../../store/adventureStore';
import { missingLines } from '../../data/adventure/gymRequirements';
import { getLegend } from '../../data/adventure/legends';
import { TEAM_MEMBERS, TEAM_HIDEOUT, TEAM_CHAPTERS } from '../../data/adventure/team';
import {
  LEAGUE_TOWN, LEAGUE_SPAWN, buildLeagueNpcs, leagueCorridor,
} from '../../data/adventure/league';
import FieldScene, { type FieldControl } from './field/FieldScene';
import { playBgm, stopBgm } from './audio/bgm';
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
  /** 直前に持っていた称号ID。増えたぶんだけ「もらった」と知らせる。 */
  const knownTitles = useRef<Set<string> | null>(null);
  const [titleToast, setTitleToast] = useState<{ icon: string; name: string } | null>(null);
  /** 進化の演出(バトル後にかぶせて出す) */
  const [evolveEffect, setEvolveEffect] =
    useState<{ from: string; to: string; name: string } | null>(null);

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
    () => (save.townId === LEAGUE_TOWN.id ? LEAGUE_TOWN : getTown(save.townId) ?? TOWNS[0]),
    [save.townId],
  );
  const inLeague = town.id === LEAGUE_TOWN.id;

  // 町のBGM。バトル中は BattleScreen 側が鳴らすのでここでは触らず、
  // バトルが終わったとき(battle が null に戻ったとき)にこの effect が
  // 動いて町の曲に戻す(曲が無い町なら無音に戻す)。
  useEffect(() => {
    if (!save.started || battle) return;
    playBgm(town.unit);
  }, [town.unit, battle, save.started]);

  // アドベンチャーそのものを抜けるとき(メインメニューに戻るとき)は、
  // 町の曲・バトル曲を問わず必ず止める。
  useEffect(() => () => stopBgm(), []);

  /** リーグの回廊のかたち(扉の開き具合)。町にいるときは undefined。 */
  const corridor = useMemo(
    () => (inLeague ? leagueCorridor(save.leagueProgress, save.champion) : undefined),
    [inLeague, save.leagueProgress, save.champion],
  );

  // ロックされている町にいたら、行ける町へ移す(先生が途中でロックした場合の保険)
  useEffect(() => {
    if (!save.started || inLeague) return;
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

    // --- 祠(伝説のモンスター) ---
    if (npc.kind === 'shrine' && npc.legendId) {
      const legend = getLegend(npc.legendId);
      if (!legend) return;
      const st = shrinesInTown(save, town.id).find(x => x.legend.id === npc.legendId);
      if (!st) return;

      if (st.taken) {
        setDialogue({
          speaker: `${legend.name}の祠`, accent: legend.shrine.color,
          lines: ['祠は しずかに ねむっている。', `${legend.name}は、いま あなたの となりに いる。`],
          onDone: () => setDialogue(null),
        });
        return;
      }
      if (!st.ready) {
        // 条件未達 — 伝承だけ読める
        setDialogue({
          speaker: `${legend.name}の祠`, accent: legend.shrine.color,
          lines: [
            ...legend.legendText,
            '……しるしは、まだ くすんだままだ。',
            '(ひつような ことは ――)',
            ...st.missing,
          ],
          onDone: () => setDialogue(null),
        });
        return;
      }
      // 出現
      setDialogue({
        speaker: `${legend.name}の祠`, accent: legend.shrine.color,
        lines: [...legend.legendText, ...legend.awakenText],
        onDone: () => {
          setDialogue(null);
          setBattle({
            kind: 'legend',
            trainerName: legend.name,
            opponents: [{ defId: legend.id, level: legend.level }],
            subtopics: undefined,
            questionsPerOpponent: legend.kind === 'mythical' ? 6 : 5,
            catchable: false,
            reward: { mp: legend.kind === 'mythical' ? 2500 : 1200, balls: 5 },
            townId: town.id,
            legendId: legend.id,
          });
        },
      });
      return;
    }

    // --- テキトウ団 ---
    if (npc.kind === 'team' && npc.teamChapterId) {
      if (npc.teamChapterId === 'hideout') {
        startHideout();
        return;
      }
      const chapter = TEAM_CHAPTERS.find(c => c.id === npc.teamChapterId);
      if (!chapter) return;
      const member = TEAM_MEMBERS[chapter.opponent];
      setDialogue({
        speaker: member.name, portrait: getNpcSprite(member.sprite), accent: '#f97316',
        lines: chapter.lines,
        onDone: () => {
          setDialogue(null);
          setBattle({
            kind: 'team',
            trainerName: member.name,
            trainerSprite: member.sprite,
            trainerAfterLines: chapter.afterLines,
            opponents: pickTeamParty(member.units, member.level, member.partySize),
            questionsPerOpponent: 3,
            catchable: false,
            reward: chapter.reward,
            townId: town.id,
            teamChapterId: chapter.id,
          });
        },
      });
      return;
    }

    // --- リーグの回廊: 四天王とチャンピオン ---
    if (npc.kind === 'elite') {
      const idx = Number(npc.id.replace('league-elite-', ''));
      const e = ELITE_FOUR[idx];
      if (!e) return;
      const pool = e.units.flatMap(u => MONSTERS_BY_UNIT[u] ?? [])
        .slice().sort((a, b) => b.difficulty - a.difficulty);
      const level = 30 + idx * 3;
      setDialogue({
        speaker: `${e.title} ${e.name}`, portrait, accent: '#7c3aed',
        lines: e.lines,
        onDone: () => {
          setDialogue(null);
          setBattle({
            kind: 'elite',
            trainerName: e.name,
            trainerSprite: e.sprite,
            trainerAfterLines: e.afterLines,
            opponents: pool.slice(0, 3).map(m => ({ defId: m.id, level })),
            questionsPerOpponent: 3,
            catchable: false,
            reward: { mp: 400 + idx * 100 },
            townId: LEAGUE_TOWN.id,
          });
        },
      });
      return;
    }
    if (npc.kind === 'champion') {
      // チャンピオンは7タイプすべてから…では長すぎるので、地方を代表する3体
      const picks = ['大きい数のしくみ', '分数', '倍の見方']
        .map(u => (MONSTERS_BY_UNIT[u] ?? []).slice().sort((a, b) => b.difficulty - a.difficulty)[0])
        .filter(Boolean);
      setDialogue({
        speaker: CHAMPION.name, portrait, accent: '#f59e0b',
        lines: save.champion
          ? ['また 会えたね。……もう一度、やるかい？']
          : CHAMPION.lines,
        onDone: () => {
          setDialogue(null);
          setBattle({
            kind: 'champion',
            trainerName: CHAMPION.name,
            trainerSprite: CHAMPION.sprite,
            trainerAfterLines: CHAMPION.afterLines,
            opponents: picks.map(m => ({ defId: m.id, level: 45 })),
            questionsPerOpponent: 4,
            catchable: false,
            reward: { mp: save.champion ? 600 : 2000 },
            townId: LEAGUE_TOWN.id,
          });
        },
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

  /** テキトウ団の手持ち。担当単元のモンスターから決定的に選ぶ。 */
  const pickTeamParty = useCallback(
    (units: string[], level: number, size: number) => {
      const pool = units.flatMap(u => MONSTERS_BY_UNIT[u] ?? [])
        .slice()
        .sort((a, b) => b.difficulty - a.difficulty);
      if (pool.length === 0) return [];
      return Array.from({ length: size }, (_, i) => ({
        defId: pool[(i * 2) % pool.length].id,
        level,
      }));
    },
    [],
  );

  /** アジト戦: 幹部3人 → ボス の連戦 */
  const hideoutStage = useRef(0);
  const startHideoutBattle = useCallback((stage: number) => {
    if (stage < TEAM_HIDEOUT.guards.length) {
      const key = TEAM_HIDEOUT.guards[stage];
      const member = TEAM_MEMBERS[key];
      setDialogue({
        speaker: member.name, portrait: getNpcSprite(member.sprite), accent: '#f97316',
        lines: TEAM_HIDEOUT.guardLines[key] ?? [],
        onDone: () => {
          setDialogue(null);
          setBattle({
            kind: 'team',
            trainerName: member.name,
            trainerSprite: member.sprite,
            opponents: pickTeamParty(member.units, member.level + 6, member.partySize),
            questionsPerOpponent: 3,
            catchable: false,
            reward: { mp: 500, balls: 2 },
            teamChapterId: `hideout-${stage}`,
          });
        },
      });
    } else {
      const boss = TEAM_MEMBERS.marume;
      setDialogue({
        speaker: boss.name, portrait: getNpcSprite(boss.sprite), accent: '#f97316',
        lines: TEAM_HIDEOUT.bossLines,
        onDone: () => {
          setDialogue(null);
          setBattle({
            kind: 'team',
            trainerName: boss.name,
            trainerSprite: boss.sprite,
            trainerAfterLines: TEAM_HIDEOUT.afterLines,
            opponents: pickTeamParty(boss.units, boss.level, boss.partySize),
            questionsPerOpponent: 4,
            catchable: false,
            reward: TEAM_HIDEOUT.reward,
            teamChapterId: 'hideout-boss',
          });
        },
      });
    }
  }, [pickTeamParty]);

  const startHideout = useCallback(() => {
    hideoutStage.current = 0;
    setDialogue({
      accent: '#f97316',
      lines: TEAM_HIDEOUT.enterLines,
      onDone: () => { setDialogue(null); startHideoutBattle(0); },
    });
  }, [startHideoutBattle]);

  // ---- バトル終了 ----
  const handleBattleFinish = (result: BattleResultSummary) => {
    const setup = battle;
    setBattle(null);
    if (!setup) return;

    if (result.mpGained > 0) onAddMathPoints(result.mpGained);

    const after: Dialogue[] = [];

    // --- 伝説・幻: 勝てば必ず仲間になる ---
    if (setup.kind === 'legend' && setup.legendId) {
      const legend = getLegend(setup.legendId);
      if (result.won && legend) {
        store.addLegend(legend.id);
        store.catchMonster(legend.id, legend.level);
        after.push({
          speaker: legend.name, accent: legend.shrine.color,
          lines: legend.joinText,
          onDone: () => setDialogue(null),
        });
      } else if (legend) {
        after.push({
          accent: legend.shrine.color,
          lines: [
            `${legend.name}は、しずかに 祠へ もどっていった……`,
            'また いつでも、ちょうせんできる。',
          ],
          onDone: () => setDialogue(null),
        });
      }
    }

    // --- テキトウ団 ---
    if (setup.kind === 'team' && setup.teamChapterId && result.won) {
      if (setup.teamChapterId.startsWith('hideout')) {
        if (setup.teamChapterId === 'hideout-boss') {
          store.clearTeamHideout();
        } else {
          // 幹部を1人倒したら、つぎの相手へ
          hideoutStage.current += 1;
          const next = hideoutStage.current;
          setBattle(null);
          window.setTimeout(() => startHideoutBattle(next), 400);
          return;
        }
      } else {
        store.clearTeamChapter(setup.teamChapterId);
      }
    }

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

    // --- リーグの回廊 ---
    if (setup.kind === 'elite') {
      if (result.won) {
        // 扉が開く。フィールドはそのままなので、歩いて奥へ進む。
        const idx = ELITE_FOUR.findIndex(e => e.name === setup.trainerName);
        store.setLeagueProgress(idx + 1);
        after.push({
          accent: '#7c3aed',
          lines: [
            'おくの 扉が、ゆっくりと ひらいた。',
            idx + 1 >= ELITE_FOUR.length
              ? 'この先が ―― チャンピオンの間だ。'
              : `四天王を ${idx + 1}人 ぬいた。まだ 先がある。`,
          ],
          onDone: () => setDialogue(null),
        });
      } else {
        after.push({
          accent: '#f43f5e',
          lines: [
            'まけて しまった……',
            'でも 扉は しまっていない。かいふくして、もう一度 いどもう！',
          ],
          onDone: () => setDialogue(null),
        });
      }
    }

    if (setup.kind === 'champion') {
      if (result.won) {
        const first = !save.champion;
        store.setChampion();
        after.push({
          speaker: CHAMPION.name, portrait: getNpcSprite(CHAMPION.sprite), accent: '#f59e0b',
          lines: CHAMPION.afterLines,
          onDone: () => setDialogue(null),
        });
        if (first) {
          after.push({
            accent: '#f59e0b',
            lines: [
              '―― ナンバーランド地方に、あたらしい チャンピオンが うまれた。',
              `${save.playerName} の 名前は、この地方の いちばん高い ところに きざまれた。`,
              'でも、ぼうけんは まだ おわらない。',
              'つかまえていない モンスターも、まだ たくさん いるのだから。',
              'おめでとう！',
            ],
            onDone: () => setDialogue(null),
          });
        }
      } else {
        after.push({
          accent: '#f43f5e',
          lines: [
            'チャンピオンには とどかなかった……',
            'てもちを 育てて、もう一度 この間へ おいで。',
          ],
          onDone: () => setDialogue(null),
        });
      }
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

    // --- 進化: そのサブトピックで熟達(5問連続正解)した手持ちがいれば進化する ---
    for (const { owned, def } of evolvableInParty(save)) {
      if (!def.evolution) continue;
      store.markEvolved(owned.uid);
      after.push({
        accent: '#facc15',
        lines: [
          'おや……? ようすが……!',
          `${def.name}は ${def.evolution.name}に しんかした！`,
          def.evolution.flavor,
          `(「${def.subtopic}」を 5問れんぞくで 正解できるように なったからだ)`,
        ],
        onDone: () => setDialogue(null),
      });
      setEvolveEffect({ from: def.id, to: def.evolution.id, name: def.evolution.name });
      window.setTimeout(() => setEvolveEffect(null), 3200);
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

  // ---- リーグの回廊へ入る ----
  // バトルを連続で流していた以前の方式をやめ、専用フィールドへ「歩いて入る」形にした。
  // 自分の足で扉をくぐるほうが、ここが特別な場所だと伝わるため。
  const enterLeague = () => {
    if (!canChallengeLeague(save)) return;
    store.setTown(LEAGUE_TOWN.id);
    void store.syncToCloud(uid ?? null);
  };

  const handleBuy = (item: ItemId, cost: number) => {
    if (!onSpendMathPoints(cost)) return;
    store.addItem(item, 1);
  };

  // 町の常設NPCに、その時点だけ現れるもの(祠・テキトウ団)を足す
  //
  // この useMemo は、以前は「ゲームを始めていないとき」の早期returnより
  // 後ろにあった。すると、タイトル画面(save.started=false)の描画では
  // この行が呼ばれず、ゲームを始めた瞬間(save.started=true)に呼ばれる数が
  // 増えてしまい、「Rendered more hooks than during the previous render」で
  // 落ちていた(実際に起きた)。フックは常に同じ回数・同じ順番で呼ぶ必要があるため、
  // 早期returnより前に置く。
  const fieldNpcs = useMemo<FieldNpcDef[]>(() => {
    // リーグの回廊には、四天王とチャンピオンしかいない
    if (inLeague) return buildLeagueNpcs(save.leagueProgress);

    const extra: FieldNpcDef[] = [];
    const half = town.size / 2;

    // 祠 — 町の東側の少し奥に置く
    shrinesInTown(save, town.id).forEach((st, i) => {
      extra.push({
        id: `shrine-${st.legend.id}`,
        kind: 'shrine',
        name: `${st.legend.name}の祠`,
        sprite: '',
        x: half * 0.55,
        z: -half * 0.25 + i * 10,
        lines: st.legend.legendText,
        // FieldScene に状態を渡すための小さな約束(見た目の切りかえに使う)
        afterLines: [st.taken ? 'taken' : st.ready ? 'ready' : 'locked'],
        legendId: st.legend.id,
        shrineStyle: st.legend.shrine,
      });
    });

    // テキトウ団 — 発生条件を満たした章があれば、町の入口近くに立たせる
    const chapter = pendingTeamChapter(save, town.id);
    if (chapter) {
      const member = TEAM_MEMBERS[chapter.opponent];
      extra.push({
        id: `team-${chapter.id}`,
        kind: 'team',
        name: member.name,
        sprite: member.sprite,
        x: -half * 0.42,
        z: half * 0.30,
        lines: chapter.lines,
        afterLines: chapter.afterLines,
        teamChapterId: chapter.id,
        reward: chapter.reward,
      });
    }

    // アジトの入口(ハコニワ砂漠)
    if (town.id === TEAM_HIDEOUT.townId && canEnterHideout(save)) {
      extra.push({
        id: 'team-hideout',
        kind: 'team',
        name: 'アジトの 入口',
        sprite: 'team-grunt',
        x: -half * 0.3,
        z: -half * 0.42,
        lines: TEAM_HIDEOUT.enterLines,
        teamChapterId: 'hideout',
      });
    }

    return [...town.npcs, ...extra];
  }, [town, save, inLeague]);

  const startAt = inLeague ? LEAGUE_SPAWN : SPAWN(town);
  const rival = RIVALS[save.appearance];
  const gym = gymProgress(save, town);
  const hasBadge = save.badges.includes(town.id);

  // ---- ゲームを始めていないとき ----
  // (フックをすべて呼び終えたあとで分岐する。上の fieldNpcs のコメント参照)
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

  return (
    <div className="fixed inset-0 z-30 bg-black overflow-hidden select-none">
      {/* 3Dフィールド */}
      <FieldScene
        key={town.id}
        town={town}
        appearance={save.appearance}
        control={control}
        npcs={fieldNpcs}
        defeatedNpcs={save.defeatedNpcs}
        onEncounter={handleEncounter}
        onNearNpcChange={setNearNpc}
        startAt={startAt}
        corridor={corridor}
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
            {inLeague ? (
              <>
                <p className="text-[11px] font-black text-slate-500 mb-1">さいごの 回廊</p>
                <div className="flex items-center gap-1">
                  {ELITE_FOUR.map((e, i) => (
                    <span
                      key={e.id}
                      className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black ${
                        save.leagueProgress > i
                          ? 'bg-emerald-400 text-white'
                          : save.leagueProgress === i
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {e.name}
                    </span>
                  ))}
                  <span
                    className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black ${
                      save.champion
                        ? 'bg-amber-400 text-white'
                        : save.leagueProgress >= ELITE_FOUR.length
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    👑
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  {save.champion
                    ? 'チャンピオン！ 何度でも いどめるよ。'
                    : 'かった相手の 扉が ひらく。おくへ すすもう。'}
                </p>
              </>
            ) : hasBadge ? (
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

      {/* 進化の演出。光につつまれて、すがたが 入れかわる。 */}
      {evolveEffect && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 pointer-events-none">
          <div className="relative flex flex-col items-center">
            <div className="absolute inset-0 -m-24 rounded-full bg-amber-200/40 blur-3xl animate-ping" />
            <div className="relative w-56 h-56 sm:w-72 sm:h-72">
              <img
                src={getMonsterSprite(evolveEffect.from)}
                alt=""
                className="absolute inset-0 w-full h-full object-contain evolve-out"
              />
              <img
                src={getMonsterSprite(evolveEffect.to)}
                alt=""
                className="absolute inset-0 w-full h-full object-contain evolve-in"
              />
            </div>
            <p className="relative mt-4 text-3xl sm:text-4xl font-black text-amber-200 drop-shadow-lg">
              ✨ {evolveEffect.name} に しんか！ ✨
            </p>
          </div>
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
