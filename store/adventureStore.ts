/**
 * store/adventureStore.ts
 *
 * 3Dアドベンチャーモード「ナンバーランド」のセーブデータ (Zustand)。
 *
 * 方針は既存の progressionStore と同じで、
 *   ・ふだんは localStorage に書く(オフラインでも全機能が動く)
 *   ・Firebase が設定されているときだけ、区切りで1回だけ Firestore に書く
 * ようにして無料枠を使いきらないようにしている。
 * (フィールドを歩くたびに書き込むようなことはしない)
 */
import { create } from 'zustand';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MONSTER_DEX, MONSTERS_BY_UNIT, getMonster, statsAtLevel, expToNext } from '../data/adventure/monsters';
import { TOWNS, BADGE_NAMES, getTown } from '../data/adventure/towns';
import { GYM_REQUIREMENTS, requirementFor, type GymProgress } from '../data/adventure/gymRequirements';
import { ADVENTURE_TITLES, rankPoints, trainerRank, type AdventureTitleDef, type RankStatKey } from '../data/adventure/ranks';
import { ALL_LEGENDS, legendsInTown, type LegendDef } from '../data/adventure/legends';
import { TEAM_CHAPTERS, TEAM_HIDEOUT } from '../data/adventure/team';
import { getAllMastery } from '../services/learningLogService';
import type { KidnappedRecord, OwnedMonster, TownDef } from '../data/adventure/adventureTypes';

const KEY = 'bm_adventure_v1';
const SLOTS_KEY = 'bm_adventure_slots_v1';
export const SLOT_COUNT = 5;

export interface AdventureSave {
  /** ゲームを始めたか */
  started: boolean;
  playerName: string;
  appearance: 'boy' | 'girl';
  /** 現在いる町のID */
  townId: string;
  /** 手持ち(最大3体)の uid */
  party: string[];
  /** 所有しているモンスター */
  owned: OwnedMonster[];
  /**
   * 一度でも捕まえたモンスターの defId(図鑑の「捕まえた」欄)。
   * owned とはあえて別に持つ: リリースや誘拐で owned から抜けても、
   * 図鑑の達成度やジムの挑戦条件が巻きもどらないようにするため。
   */
  dexCaught: string[];
  /** テキトウ団の下っ端に さらわれた個体(手持ちからは抜けている) */
  kidnapped: KidnappedRecord[];
  /** 一度でも出会ったモンスターの defId(図鑑の「見た」欄) */
  seen: string[];
  /** 取得したバッジ(町ID) */
  badges: string[];
  /** 倒したトレーナーのNPC ID */
  defeatedNpcs: string[];
  /** 会話ずみのイベントID(導入テキストなどを2回出さないため) */
  seenEvents: string[];
  items: Record<string, number>;
  /** 自分のHP(バトルをまたいで持ちこす) */
  hp: number;
  maxHp: number;
  /** リーグの進行度(0=未挑戦, 1〜4=四天王, 5=チャンピオン撃破) */
  leagueProgress: number;
  champion: boolean;
  /** 進化ずみの個体 uid */
  evolved: string[];
  /** 仲間にした伝説・幻の ID */
  legends: string[];
  /** クリアずみのテキトウ団の章 ID */
  teamChapters: string[];
  /** テキトウ団アジトを制覇したか */
  teamCleared: boolean;
  updatedAt: number;
}

const emptySave = (): AdventureSave => ({
  started: false,
  playerName: '',
  appearance: 'boy',
  townId: TOWNS[0].id,
  party: [],
  owned: [],
  dexCaught: [],
  kidnapped: [],
  seen: [],
  badges: [],
  defeatedNpcs: [],
  seenEvents: [],
  items: { ball: 5, potion: 2 },
  hp: 60,
  maxHp: 60,
  leagueProgress: 0,
  champion: false,
  evolved: [],
  legends: [],
  teamChapters: [],
  teamCleared: false,
  updatedAt: 0,
});

/**
 * 保存データを最新の形に補う。
 *
 * dexCaught はあとから足したフィールドなので、それより前に作られたセーブには
 * 存在しない。空のまま扱うと「もう捕まえたはずのモンスターが図鑑未達成に
 * 巻きもどる」ことになるので、そのときは owned から一度だけ埋めなおす
 * (リリースずみの分までは復元できないが、いま持っている分だけでも
 * 失わないほうがよい)。
 */
const hydrateSave = (partial: Partial<AdventureSave> | null | undefined): AdventureSave => {
  const merged: AdventureSave = { ...emptySave(), ...(partial ?? {}) };
  if (!merged.dexCaught || merged.dexCaught.length === 0) {
    merged.dexCaught = Array.from(new Set(merged.owned.map(o => o.defId)));
  }
  return merged;
};

const load = (): AdventureSave => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return hydrateSave(JSON.parse(raw));
  } catch { /* 壊れていたら初期状態から始める */ }
  return emptySave();
};

const persist = (save: AdventureSave) => {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* 容量超過などは無視 */ }
};

/**
 * セーブスロット(手動で5つまで)。
 *
 * ふだんの自動セーブ(KEY, bm_adventure_v1)とは別に持つ。「いまの進行」と
 * 「手でここまでと決めて残した記録」を分けたいので、スロットは明示的に
 * 保存ボタンを押したときだけ書きかわる。
 */
const loadSlots = (): (AdventureSave | null)[] => {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return Array.from({ length: SLOT_COUNT }, (_, i) => arr[i] ?? null);
      }
    }
  } catch { /* 壊れていたら空きスロットぶんとして扱う */ }
  return Array.from({ length: SLOT_COUNT }, () => null);
};

const persistSlots = (slots: (AdventureSave | null)[]) => {
  try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch { /* 容量超過などは無視 */ }
};

/** プレイヤー自身のHP。手持ちのレベルが上がるほど伸びる。 */
export const playerMaxHp = (save: AdventureSave): number => {
  const levels = save.party
    .map(uid => save.owned.find(o => o.uid === uid))
    .filter(Boolean)
    .map(o => (o as OwnedMonster).level);
  const avg = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 1;
  return Math.round(50 + avg * 4);
};

let uidCounter = 0;
const newUid = () => `o${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

interface AdventureState {
  save: AdventureSave;
  /** 手動セーブスロット(SLOT_COUNT個ぶん。空きは null) */
  slots: (AdventureSave | null)[];

  // --- 進行 ---
  startGame: (name: string, appearance: 'boy' | 'girl', starterDefId: string) => void;
  resetGame: () => void;
  /** いまの進行をスロットに書きこむ(上書き) */
  saveToSlot: (index: number) => void;
  /** スロットの記録を、いまの進行として読みこむ */
  loadFromSlot: (index: number) => void;
  setTown: (townId: string) => void;
  markEvent: (id: string) => boolean;
  markNpcDefeated: (npcId: string) => void;
  awardBadge: (townId: string) => void;
  setLeagueProgress: (n: number) => void;
  setChampion: () => void;
  markEvolved: (uid: string) => void;
  addLegend: (legendId: string) => void;
  clearTeamChapter: (chapterId: string) => void;
  clearTeamHideout: () => void;

  // --- モンスター ---
  seeMonster: (defId: string) => void;
  catchMonster: (defId: string, level: number) => OwnedMonster;
  releaseMonster: (uid: string) => void;
  /** テキトウ団の下っ端に負けたとき、手持ちの1体をさらわれた記録にする */
  kidnapMonster: (uid: string, townId: string) => void;
  /** その町の奪還戦に勝ったとき、さらわれていた個体をすべて手持ちに戻す */
  rescueMonsters: (townId: string) => void;
  addExp: (uid: string, exp: number) => { leveled: boolean; newLevel: number };
  setParty: (uids: string[]) => void;

  // --- HP・アイテム ---
  damage: (n: number) => void;
  healFull: () => void;
  heal: (n: number) => void;
  addItem: (id: string, n: number) => void;
  useItem: (id: string) => boolean;

  // --- 同期 ---
  syncToCloud: (uid: string | null) => Promise<void>;
  loadFromCloud: (uid: string | null) => Promise<void>;
}

export const useAdventureStore = create<AdventureState>((set, get) => {
  /** 変更を1か所でまとめて localStorage へ書く */
  const update = (fn: (s: AdventureSave) => AdventureSave) => {
    set(state => {
      const next = { ...fn(state.save), updatedAt: Date.now() };
      persist(next);
      return { save: next };
    });
  };

  return {
    save: load(),
    slots: loadSlots(),

    saveToSlot: index => {
      const { save, slots } = get();
      const next = slots.slice();
      next[index] = { ...save, updatedAt: Date.now() };
      persistSlots(next);
      set({ slots: next });
    },

    loadFromSlot: index => {
      const { slots } = get();
      const slot = slots[index];
      if (!slot) return;
      const next = { ...hydrateSave(slot), updatedAt: Date.now() };
      persist(next);
      set({ save: next });
    },

    startGame: (playerName, appearance, starterDefId) => {
      const starter: OwnedMonster = {
        uid: newUid(), defId: starterDefId, level: 5, exp: 0, caughtAt: Date.now(),
      };
      const base = emptySave();
      const next: AdventureSave = {
        ...base,
        started: true,
        playerName,
        appearance,
        owned: [starter],
        party: [starter.uid],
        seen: [starterDefId],
        dexCaught: [starterDefId],
      };
      next.maxHp = playerMaxHp(next);
      next.hp = next.maxHp;
      persist(next);
      set({ save: next });
    },

    resetGame: () => {
      const next = emptySave();
      persist(next);
      set({ save: next });
    },

    setTown: townId => update(s => ({ ...s, townId })),

    /** はじめて見るイベントなら true を返し、記録する */
    markEvent: id => {
      const { save } = get();
      if (save.seenEvents.includes(id)) return false;
      update(s => ({ ...s, seenEvents: [...s.seenEvents, id] }));
      return true;
    },

    markNpcDefeated: npcId =>
      update(s =>
        s.defeatedNpcs.includes(npcId) ? s : { ...s, defeatedNpcs: [...s.defeatedNpcs, npcId] },
      ),

    awardBadge: townId =>
      update(s => (s.badges.includes(townId) ? s : { ...s, badges: [...s.badges, townId] })),

    setLeagueProgress: n => update(s => ({ ...s, leagueProgress: Math.max(s.leagueProgress, n) })),

    setChampion: () => update(s => ({ ...s, champion: true, leagueProgress: 5 })),

    markEvolved: uid =>
      update(s => (s.evolved.includes(uid) ? s : { ...s, evolved: [...s.evolved, uid] })),

    addLegend: legendId =>
      update(s => (s.legends.includes(legendId) ? s : { ...s, legends: [...s.legends, legendId] })),

    clearTeamChapter: chapterId =>
      update(s =>
        s.teamChapters.includes(chapterId) ? s : { ...s, teamChapters: [...s.teamChapters, chapterId] },
      ),

    clearTeamHideout: () => update(s => ({ ...s, teamCleared: true })),

    seeMonster: defId =>
      update(s => (s.seen.includes(defId) ? s : { ...s, seen: [...s.seen, defId] })),

    catchMonster: (defId, level) => {
      const mon: OwnedMonster = { uid: newUid(), defId, level, exp: 0, caughtAt: Date.now() };
      update(s => {
        const party = s.party.length < 3 ? [...s.party, mon.uid] : s.party;
        const seen = s.seen.includes(defId) ? s.seen : [...s.seen, defId];
        const dexCaught = s.dexCaught.includes(defId) ? s.dexCaught : [...s.dexCaught, defId];
        return { ...s, owned: [...s.owned, mon], party, seen, dexCaught };
      });
      return mon;
    },

    releaseMonster: uid =>
      update(s => ({
        ...s,
        owned: s.owned.filter(o => o.uid !== uid),
        party: s.party.filter(p => p !== uid),
      })),

    kidnapMonster: (uid, townId) =>
      update(s => {
        const mon = s.owned.find(o => o.uid === uid);
        if (!mon) return s;
        return {
          ...s,
          owned: s.owned.filter(o => o.uid !== uid),
          party: s.party.filter(p => p !== uid),
          kidnapped: [...s.kidnapped, { mon, townId }],
        };
      }),

    rescueMonsters: townId =>
      update(s => {
        const back = s.kidnapped.filter(k => k.townId === townId);
        if (back.length === 0) return s;
        const kidnapped = s.kidnapped.filter(k => k.townId !== townId);
        let party = s.party;
        for (const k of back) {
          if (party.length < 3) party = [...party, k.mon.uid];
        }
        return { ...s, owned: [...s.owned, ...back.map(k => k.mon)], party, kidnapped };
      }),

    addExp: (uid, exp) => {
      let leveled = false;
      let newLevel = 1;
      update(s => {
        const owned = s.owned.map(o => {
          if (o.uid !== uid) return o;
          let lv = o.level;
          let ex = o.exp + exp;
          while (ex >= expToNext(lv) && lv < 60) {
            ex -= expToNext(lv);
            lv += 1;
            leveled = true;
          }
          newLevel = lv;
          return { ...o, level: lv, exp: ex };
        });
        const next = { ...s, owned };
        // 手持ちが育つとプレイヤーのHP上限も上がる
        const maxHp = playerMaxHp(next);
        return { ...next, maxHp, hp: Math.min(next.hp + (maxHp - s.maxHp), maxHp) };
      });
      return { leveled, newLevel };
    },

    setParty: uids => update(s => ({ ...s, party: uids.slice(0, 3) })),

    damage: n => update(s => ({ ...s, hp: Math.max(0, s.hp - n) })),

    healFull: () => update(s => ({ ...s, hp: playerMaxHp(s), maxHp: playerMaxHp(s) })),

    heal: n => update(s => ({ ...s, hp: Math.min(s.maxHp, s.hp + n) })),

    addItem: (id, n) =>
      update(s => ({ ...s, items: { ...s.items, [id]: (s.items[id] ?? 0) + n } })),

    useItem: id => {
      const { save } = get();
      if ((save.items[id] ?? 0) <= 0) return false;
      update(s => ({ ...s, items: { ...s.items, [id]: (s.items[id] ?? 0) - 1 } }));
      return true;
    },

    // ---- Firestore 同期(任意) ----
    // 書き込みはセッションの区切り(町の移動・バトル終了後のまとめ)でのみ呼ぶ。
    syncToCloud: async uid => {
      if (!db || !uid) return;
      try {
        await setDoc(doc(db, 'adventures', uid), get().save, { merge: true });
      } catch { /* オフラインでも学習は続けられるので握りつぶす */ }
    },

    loadFromCloud: async uid => {
      if (!db || !uid) return;
      try {
        const snap = await getDoc(doc(db, 'adventures', uid));
        if (!snap.exists()) return;
        const remote = snap.data() as AdventureSave;
        const local = get().save;
        // 新しい方を採用する(端末をまたいでも進行が巻きもどらない)
        if ((remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
          const merged = hydrateSave(remote);
          persist(merged);
          set({ save: merged });
        }
      } catch { /* 読めなければ端末内のデータで続行 */ }
    },
  };
});

// ============================================================
// 参照ヘルパー
// ============================================================

export const getOwned = (save: AdventureSave, uid: string): OwnedMonster | undefined =>
  save.owned.find(o => o.uid === uid);

export const getPartyMonsters = (save: AdventureSave) =>
  save.party
    .map(uid => save.owned.find(o => o.uid === uid))
    .filter((o): o is OwnedMonster => Boolean(o))
    .map(o => ({ owned: o, def: getMonster(o.defId)! }))
    .filter(x => Boolean(x.def));

/** 手持ちの合計こうげき力。バトルのダメージ計算に使う。 */
export const partyAttack = (save: AdventureSave): number => {
  const party = getPartyMonsters(save);
  if (party.length === 0) return 8;
  return party.reduce((sum, p) => sum + statsAtLevel(p.def, p.owned.level).atk, 0) / party.length;
};

/** 図鑑の達成率(ゲットした数 / 全151体) */
export const dexProgress = (save: AdventureSave) => {
  const caught = new Set(save.dexCaught);
  const total = MONSTER_DEX.length;
  return {
    caught: MONSTER_DEX.filter(m => caught.has(m.id)).length,
    seen: MONSTER_DEX.filter(m => save.seen.includes(m.id)).length,
    total,
  };
};

/** バッジ名の一覧(獲得順ではなく町の順) */
export const badgeList = (save: AdventureSave) =>
  TOWNS.filter(t => save.badges.includes(t.id)).map(t => ({
    townId: t.id, name: BADGE_NAMES[t.id] ?? t.name, type: t.type,
  }));

/** リーグに挑戦できるか(14バッジすべて) */
export const canChallengeLeague = (save: AdventureSave): boolean =>
  TOWNS.every(t => save.badges.includes(t.id));


// ============================================================
// ジム(単元マスター)への挑戦条件
// ============================================================

/**
 * その町のマスターに挑めるか。
 *
 * 「正解数」は学習記録(learningLogService)の単元別集計をそのまま見るので、
 * 練習モードでその単元をやりこんだ子は、バトルをしなくても条件を満たせる。
 * 学習の実績とゲームの進行を別々にしないための設計。
 */
export const gymProgress = (save: AdventureSave, town: TownDef): GymProgress => {
  // リーグの回廊など、14の町にない場所でも落ちないようにその場で計算する
  const req = GYM_REQUIREMENTS[town.id] ?? requirementFor(town);
  const trainersBeaten = req.trainerIds.filter(id => save.defeatedNpcs.includes(id)).length;

  const unitDefIds = new Set((MONSTERS_BY_UNIT[town.unit] ?? []).map(m => m.id));
  const caught = save.dexCaught.filter(id => unitDefIds.has(id)).length;

  const mastery = getAllMastery();
  const correct = (MONSTERS_BY_UNIT[town.unit] ?? []).reduce(
    (sum, m) => sum + (mastery[m.subtopic]?.corrects ?? 0),
    0,
  );

  return {
    trainersBeaten,
    trainersNeeded: req.trainerIds.length,
    caught,
    caughtNeeded: req.catchCount,
    correct,
    correctNeeded: req.correctCount,
    ready:
      trainersBeaten >= req.trainerIds.length &&
      caught >= req.catchCount &&
      correct >= req.correctCount,
  };
};

export const gymProgressById = (save: AdventureSave, townId: string): GymProgress | null => {
  const town = getTown(townId);
  return town ? gymProgress(save, town) : null;
};


// ============================================================
// ステータス(トレーナーカード)と称号
// ============================================================

export interface AdventureStats extends Record<RankStatKey, number> {
  /** 図鑑の総数(151) */
  dexTotal: number;
}

/**
 * 冒険の実績をまとめて数える。
 * すべてセーブと学習記録から毎回計算するだけなので、条件を後から変えても
 * 過去のプレイに さかのぼって反映される(別に集計を持たないための設計)。
 */
export const adventureStats = (save: AdventureSave): AdventureStats => {
  const mastery = getAllMastery();
  const correct = MONSTER_DEX.reduce(
    (sum, m) => sum + (mastery[m.subtopic]?.corrects ?? 0),
    0,
  );
  const caught = new Set(save.dexCaught);
  const visited = new Set(
    save.seenEvents.filter(e => e.startsWith('intro:')).map(e => e.slice(6)),
  );
  // 現在いる町は必ず訪問ずみとして数える
  visited.add(save.townId);

  return {
    badges: save.badges.length,
    caught: MONSTER_DEX.filter(m => caught.has(m.id)).length,
    seen: MONSTER_DEX.filter(m => save.seen.includes(m.id)).length,
    trainersBeaten: save.defeatedNpcs.length,
    correct,
    maxLevel: save.owned.reduce((mx, o) => Math.max(mx, o.level), 0),
    towns: visited.size,
    league: save.champion ? 5 : save.leagueProgress,
    dexTotal: MONSTER_DEX.length,
  };
};

/** いま獲得している称号 */
export const earnedAdventureTitles = (save: AdventureSave): AdventureTitleDef[] => {
  const st = adventureStats(save);
  return ADVENTURE_TITLES.filter(t => st[t.stat] >= t.value);
};

/** つぎに手が届きそうな称号(達成率の高い順に3つ) */
export const nextAdventureTitles = (save: AdventureSave, count = 3) => {
  const st = adventureStats(save);
  return ADVENTURE_TITLES
    .filter(t => st[t.stat] < t.value)
    .map(t => ({ def: t, current: st[t.stat], ratio: st[t.stat] / t.value }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, count);
};

export const adventureRank = (save: AdventureSave) => {
  const st = adventureStats(save);
  return trainerRank(rankPoints(st));
};


// ============================================================
// 進化(熟達したときだけ起きる)
// ============================================================

/**
 * その個体が進化できるか。条件は「そのサブトピックで5問連続正解(熟達)」で、
 * 判定は learningLogService の mastered をそのまま見る。
 * 根拠: マスタリー・ラーニングのメタ分析(エビデンスレベル1a)。
 * ゲームでいちばん嬉しい瞬間を、学習の到達点と同じタイミングにするための設計。
 */
export const canEvolve = (save: AdventureSave, owned: OwnedMonster): boolean => {
  if (save.evolved.includes(owned.uid)) return false;
  const def = getMonster(owned.defId);
  if (!def?.evolution) return false;
  return Boolean(getAllMastery()[def.subtopic]?.mastered);
};

/** いま進化できる手持ちを返す(バトル終了後にまとめて演出するため) */
export const evolvableInParty = (save: AdventureSave) =>
  save.party
    .map(uid => save.owned.find(o => o.uid === uid))
    .filter((o): o is OwnedMonster => Boolean(o))
    .filter(o => canEvolve(save, o))
    .map(o => ({ owned: o, def: getMonster(o.defId)! }));

/** 表示に使うスプライトID(進化ずみなら進化後) */
export const spriteIdFor = (save: AdventureSave, owned: OwnedMonster): string => {
  const def = getMonster(owned.defId);
  if (!def) return owned.defId;
  return save.evolved.includes(owned.uid) && def.evolution ? def.evolution.id : def.id;
};

/** 表示に使う名前(進化ずみなら進化後) */
export const displayNameFor = (save: AdventureSave, owned: OwnedMonster): string => {
  if (owned.nickname) return owned.nickname;
  const def = getMonster(owned.defId);
  if (!def) return '???';
  return save.evolved.includes(owned.uid) && def.evolution ? def.evolution.name : def.name;
};

// ============================================================
// 伝説の祠
// ============================================================

export interface ShrineState {
  legend: LegendDef;
  /** 条件を満たして挑戦できるか */
  ready: boolean;
  /** すでに仲間にしたか */
  taken: boolean;
  /** あと何が足りないか(表示用) */
  missing: string[];
}

/**
 * 祠の状態。「その単元を制覇した」ことを条件にしている。
 * バッジを取っただけでは足りず、図鑑を8割埋め、問題で熟達している必要がある。
 * = その単元を本当に使いこなせた人にだけ姿を見せる。
 */
export const shrineState = (save: AdventureSave, legend: LegendDef): ShrineState => {
  const taken = save.legends.includes(legend.id);
  const missing: string[] = [];

  if (legend.kind === 'mythical') {
    // 幻は地方ぜんたいの達成が条件
    if (legend.id === 'mythical-zero') {
      const caught = dexProgress(save).caught;
      if (caught < 100) missing.push(`モンスターを 100しゅるい つかまえる (${caught} / 100)`);
    } else {
      if (!save.champion) missing.push('チャンピオンに かつ');
      const badges = save.badges.length;
      if (badges < TOWNS.length) missing.push(`14この バッジを 集める (${badges} / 14)`);
      const legendCount = save.legends.filter(id => id.startsWith('legend-')).length;
      if (legendCount < 7) missing.push(`7体の 伝説を 仲間にする (${legendCount} / 7)`);
    }
    return { legend, taken, ready: missing.length === 0, missing };
  }

  // 伝説はそのタイプの全単元を「制覇」していること
  const mastery = getAllMastery();
  for (const unit of legend.units) {
    const town = TOWNS.find(t => t.unit === unit);
    if (town && !save.badges.includes(town.id)) {
      missing.push(`${town.name}の バッジを 取る`);
    }
    const pool = MONSTERS_BY_UNIT[unit] ?? [];
    const caughtIds = new Set(save.dexCaught);
    const caught = pool.filter(m => caughtIds.has(m.id)).length;
    const need = Math.ceil(pool.length * 0.8);
    if (caught < need) {
      missing.push(`${unit}の モンスターを あと${need - caught}体 つかまえる`);
    }
    const mastered = pool.filter(m => mastery[m.subtopic]?.mastered).length;
    const needMastered = Math.max(2, Math.ceil(pool.length * 0.5));
    if (mastered < needMastered) {
      missing.push(`${unit}で あと${needMastered - mastered}項目 熟達する(5問れんぞく正解)`);
    }
  }

  return { legend, taken, ready: missing.length === 0, missing };
};

/** その町にある祠の状態一覧 */
export const shrinesInTown = (save: AdventureSave, townId: string): ShrineState[] =>
  legendsInTown(townId).map(l => shrineState(save, l));

// ============================================================
// テキトウ団
// ============================================================

/** その町で発生すべき章(バッジ数の条件を満たし、未クリアのもの) */
export const pendingTeamChapter = (save: AdventureSave, townId: string) =>
  TEAM_CHAPTERS.find(
    c =>
      c.townId === townId &&
      save.badges.length >= c.requiredBadges &&
      !save.teamChapters.includes(c.id),
  ) ?? null;

/** アジトに入れるか(5章すべてクリア + 14バッジ) */
export const canEnterHideout = (save: AdventureSave): boolean =>
  !save.teamCleared &&
  save.badges.length >= TEAM_HIDEOUT.requiredBadges &&
  TEAM_CHAPTERS.every(c => save.teamChapters.includes(c.id));

/** 伝説をまだ仲間にしていない数(図鑑表示用) */
export const legendProgress = (save: AdventureSave) => ({
  taken: save.legends.length,
  total: ALL_LEGENDS.length,
});

// ============================================================
// テキトウ団の下っ端(待ち伏せ・奪還)
// ============================================================

/**
 * その町で下っ端が待ち伏せしはじめる条件。
 * 「その町のモンスターを3体捕まえた」か「その町のサブトピックを1つ熟達した」の
 * どちらか一方で成立する(捕獲派・練習派、どちらの遊び方でも起きるように)。
 */
export const ambushCondition = (save: AdventureSave, town: TownDef): boolean => {
  const pool = MONSTERS_BY_UNIT[town.unit] ?? [];
  const unitIds = new Set(pool.map(m => m.id));
  const caught = save.dexCaught.filter(id => unitIds.has(id)).length;
  if (caught >= 3) return true;
  const mastery = getAllMastery();
  return pool.some(m => mastery[m.subtopic]?.mastered);
};

/** その町でさらわれたままの個体一覧 */
export const kidnappedInTown = (save: AdventureSave, townId: string): KidnappedRecord[] =>
  save.kidnapped.filter(k => k.townId === townId);

/**
 * 下っ端に負けたとき、手持ちからさらう1体を選ぶ。
 * その町のモンスターを優先し、手持ちが1体だけなら詰まないよう何もさらわない。
 */
export const pickKidnapCandidate = (save: AdventureSave, townId: string): string | null => {
  if (save.party.length <= 1) return null;
  const town = getTown(townId);
  const unitIds = new Set((town ? MONSTERS_BY_UNIT[town.unit] : undefined)?.map(m => m.id) ?? []);
  const inUnit = save.party.filter(uid => {
    const o = save.owned.find(x => x.uid === uid);
    return o && unitIds.has(o.defId);
  });
  return inUnit[0] ?? save.party[Math.floor(Math.random() * save.party.length)] ?? null;
};
