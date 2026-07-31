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
import { MONSTER_DEX, getMonster, statsAtLevel, expToNext } from '../data/adventure/monsters';
import { TOWNS, BADGE_NAMES } from '../data/adventure/towns';
import type { OwnedMonster } from '../data/adventure/adventureTypes';

const KEY = 'bm_adventure_v1';

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
  updatedAt: number;
}

const emptySave = (): AdventureSave => ({
  started: false,
  playerName: '',
  appearance: 'boy',
  townId: TOWNS[0].id,
  party: [],
  owned: [],
  seen: [],
  badges: [],
  defeatedNpcs: [],
  seenEvents: [],
  items: { ball: 5, potion: 2 },
  hp: 60,
  maxHp: 60,
  leagueProgress: 0,
  champion: false,
  updatedAt: 0,
});

const load = (): AdventureSave => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptySave(), ...JSON.parse(raw) };
  } catch { /* 壊れていたら初期状態から始める */ }
  return emptySave();
};

const persist = (save: AdventureSave) => {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* 容量超過などは無視 */ }
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

  // --- 進行 ---
  startGame: (name: string, appearance: 'boy' | 'girl', starterDefId: string) => void;
  resetGame: () => void;
  setTown: (townId: string) => void;
  markEvent: (id: string) => boolean;
  markNpcDefeated: (npcId: string) => void;
  awardBadge: (townId: string) => void;
  setLeagueProgress: (n: number) => void;
  setChampion: () => void;

  // --- モンスター ---
  seeMonster: (defId: string) => void;
  catchMonster: (defId: string, level: number) => OwnedMonster;
  releaseMonster: (uid: string) => void;
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

    seeMonster: defId =>
      update(s => (s.seen.includes(defId) ? s : { ...s, seen: [...s.seen, defId] })),

    catchMonster: (defId, level) => {
      const mon: OwnedMonster = { uid: newUid(), defId, level, exp: 0, caughtAt: Date.now() };
      update(s => {
        const party = s.party.length < 3 ? [...s.party, mon.uid] : s.party;
        const seen = s.seen.includes(defId) ? s.seen : [...s.seen, defId];
        return { ...s, owned: [...s.owned, mon], party, seen };
      });
      return mon;
    },

    releaseMonster: uid =>
      update(s => ({
        ...s,
        owned: s.owned.filter(o => o.uid !== uid),
        party: s.party.filter(p => p !== uid),
      })),

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
          const merged = { ...emptySave(), ...remote };
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
  const caught = new Set(save.owned.map(o => o.defId));
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
