/**
 * ranks.ts — 冒険の進み具合で増えていく「称号」と「トレーナーランク」。
 *
 * 目的は2つ。
 *   ① バッジ以外にも、こまめに達成が見える目盛りを置く
 *      (バッジは1つ取るのに時間がかかるので、その間の手ごたえが薄くなる)
 *   ② 「何をすると増えるか」を1行で言えるものだけにする
 *      (小4が理由を説明できない指標は、やる気につながらない)
 *
 * 既存アプリの称号(constants.ts の TITLE_DEFS)は残したまま、
 * ぼうけん専用の称号をここに足している。判定はすべてセーブと学習記録から
 * 計算するだけなので、あとから条件を変えても過去のデータで再判定される。
 */

export type RankStatKey =
  | 'badges'        // 取得バッジ数
  | 'caught'        // つかまえたモンスターの種類数
  | 'seen'          // 出会ったモンスターの種類数
  | 'trainersBeaten'// 倒したトレーナー・マスターの数
  | 'correct'       // ぼうけんで正解した問題数(学習記録から)
  | 'maxLevel'      // 手持ちの最高レベル
  | 'towns'         // 訪れた町の数
  | 'league';       // リーグの進行度(0〜5)

export interface AdventureTitleDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  stat: RankStatKey;
  /** この値以上で獲得 */
  value: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const ADVENTURE_TITLES: AdventureTitleDef[] = [
  // --- はじまり ---
  { id: 'adv_start', name: 'かけだしトレーナー', description: 'ぼうけんを はじめた', icon: '🌱', stat: 'caught', value: 1, rarity: 'common' },
  { id: 'adv_catch5', name: 'モンスターずき', description: 'モンスターを 5しゅるい つかまえた', icon: '🐾', stat: 'caught', value: 5, rarity: 'common' },
  { id: 'adv_catch20', name: 'コレクター', description: 'モンスターを 20しゅるい つかまえた', icon: '📦', stat: 'caught', value: 20, rarity: 'rare' },
  { id: 'adv_catch50', name: 'ずかんマスター', description: 'モンスターを 50しゅるい つかまえた', icon: '📕', stat: 'caught', value: 50, rarity: 'epic' },
  { id: 'adv_catch100', name: 'ナンバーランドの生き字引', description: 'モンスターを 100しゅるい つかまえた', icon: '📚', stat: 'caught', value: 100, rarity: 'legendary' },
  { id: 'adv_catch151', name: 'ずかん かんせい', description: '151しゅるい すべてを つかまえた', icon: '👑', stat: 'caught', value: 151, rarity: 'legendary' },

  // --- 出会い ---
  { id: 'adv_seen30', name: 'たびびと', description: '30しゅるいの モンスターに 出会った', icon: '👣', stat: 'seen', value: 30, rarity: 'common' },
  { id: 'adv_seen80', name: 'ものしり', description: '80しゅるいの モンスターに 出会った', icon: '🔍', stat: 'seen', value: 80, rarity: 'rare' },

  // --- バッジ ---
  { id: 'adv_badge1', name: 'はじめの一歩', description: 'バッジを 1つ 手に入れた', icon: '🏅', stat: 'badges', value: 1, rarity: 'common' },
  { id: 'adv_badge4', name: 'たびのとちゅう', description: 'バッジを 4つ 集めた', icon: '🎖', stat: 'badges', value: 4, rarity: 'rare' },
  { id: 'adv_badge8', name: 'ベテラントレーナー', description: 'バッジを 8つ 集めた', icon: '🥈', stat: 'badges', value: 8, rarity: 'epic' },
  { id: 'adv_badge14', name: 'ぜんバッジ せいは', description: '14この バッジを すべて集めた', icon: '🥇', stat: 'badges', value: 14, rarity: 'legendary' },

  // --- しょうぶ ---
  { id: 'adv_win5', name: 'しょうぶ好き', description: 'トレーナーに 5回 かった', icon: '⚔', stat: 'trainersBeaten', value: 5, rarity: 'common' },
  { id: 'adv_win20', name: 'つわもの', description: 'トレーナーに 20回 かった', icon: '🛡', stat: 'trainersBeaten', value: 20, rarity: 'rare' },
  { id: 'adv_win40', name: 'むはい', description: 'トレーナーに 40回 かった', icon: '💪', stat: 'trainersBeaten', value: 40, rarity: 'epic' },

  // --- べんきょう ---
  { id: 'adv_correct100', name: 'がんばりや', description: '100問 正解した', icon: '✏️', stat: 'correct', value: 100, rarity: 'common' },
  { id: 'adv_correct500', name: 'けいさんの達人', description: '500問 正解した', icon: '🧮', stat: 'correct', value: 500, rarity: 'rare' },
  { id: 'adv_correct1000', name: '算数の申し子', description: '1000問 正解した', icon: '🌟', stat: 'correct', value: 1000, rarity: 'epic' },
  { id: 'adv_correct2000', name: 'ナンバーランドの賢者', description: '2000問 正解した', icon: '🔮', stat: 'correct', value: 2000, rarity: 'legendary' },

  // --- そだてる ---
  { id: 'adv_lv20', name: 'よき あいぼう', description: '手持ちを レベル20まで 育てた', icon: '🤝', stat: 'maxLevel', value: 20, rarity: 'common' },
  { id: 'adv_lv40', name: 'そだてやさん', description: '手持ちを レベル40まで 育てた', icon: '🌿', stat: 'maxLevel', value: 40, rarity: 'rare' },

  // --- たび ---
  { id: 'adv_towns7', name: 'はんぶん せいは', description: '7つの 町を おとずれた', icon: '🗺', stat: 'towns', value: 7, rarity: 'common' },
  { id: 'adv_towns14', name: '地方めぐり かんりょう', description: '14の 町すべてを おとずれた', icon: '🧭', stat: 'towns', value: 14, rarity: 'epic' },

  // --- リーグ ---
  { id: 'adv_elite1', name: '四天王への挑戦者', description: '四天王に 1人 かった', icon: '⚡', stat: 'league', value: 1, rarity: 'rare' },
  { id: 'adv_elite4', name: '四天王 突破', description: '四天王 4人 すべてに かった', icon: '🔥', stat: 'league', value: 4, rarity: 'legendary' },
  { id: 'adv_champion', name: 'ナンバーランド チャンピオン', description: 'チャンピオンに かった', icon: '👑', stat: 'league', value: 5, rarity: 'legendary' },
];

/**
 * トレーナーランク。ぜんぶの達成をひとつの数にまとめて、
 * 「いまどのくらい進んだか」をひと目でわかるようにする。
 */
export interface TrainerRank {
  level: number;
  name: string;
  /** つぎのランクまでの進み具合(0〜1) */
  progress: number;
  points: number;
  nextPoints: number | null;
}

const RANK_NAMES = [
  'かけだし', 'みならい', 'たまご', 'ルーキー', 'チャレンジャー',
  'エキスパート', 'ベテラン', 'エース', 'マスター', 'レジェンド',
];

/** ランクポイント。何をすると増えるか、子どもに説明できる重みにしてある。 */
export const rankPoints = (s: {
  badges: number; caught: number; trainersBeaten: number; correct: number; league: number;
}): number =>
  s.badges * 40 +
  s.caught * 6 +
  s.trainersBeaten * 10 +
  Math.floor(s.correct / 5) +
  s.league * 60;

const RANK_THRESHOLDS = [0, 60, 150, 300, 520, 820, 1200, 1700, 2300, 3000];

export const trainerRank = (points: number): TrainerRank => {
  let level = 0;
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
    if (points >= RANK_THRESHOLDS[i]) level = i;
  }
  const cur = RANK_THRESHOLDS[level];
  const next = RANK_THRESHOLDS[level + 1] ?? null;
  return {
    level: level + 1,
    name: RANK_NAMES[level],
    points,
    nextPoints: next,
    progress: next === null ? 1 : (points - cur) / (next - cur),
  };
};
