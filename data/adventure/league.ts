/**
 * league.ts — ナンバーリーグの回廊。
 *
 * 14個のバッジがそろうと入れる、専用のフィールド。
 * 細長い回廊に5つの間がならび、奥へ進むほど四天王が待っている。
 * 勝つと次の扉が開き、負けると入口へもどる(持ち物は失わない)。
 *
 * 「後戻りできない一本道」にしているのは、ここだけ空気を変えるため。
 * ふだんの町は自由に行き来できるので、対比で緊張感が出る。
 */

import { ELITE_FOUR, CHAMPION } from './people';
import type { FieldNpcDef, TownDef } from './adventureTypes';

/** 回廊の長さ。1つの間ごとの間隔。 */
const ROOM_GAP = 26;
export const LEAGUE_ROOMS = ELITE_FOUR.length + 1; // 四天王4 + チャンピオン
const LENGTH = ROOM_GAP * (LEAGUE_ROOMS + 1);

/** 回廊の半分の横幅。町とちがって、横にはほとんど広がっていない。 */
export const LEAGUE_HALF_WIDTH = 9;

/** 各部屋の中心のz座標(手前が大きい値、奥がマイナス) */
export const roomZ = (index: number): number => LENGTH / 2 - ROOM_GAP * (index + 1);

/** 扉のz座標(部屋のすぐ奥) */
export const gateZ = (index: number): number => roomZ(index) - ROOM_GAP / 2;

/** 入口(プレイヤーがあらわれる場所) */
export const LEAGUE_SPAWN = { x: 0, z: LENGTH / 2 - 6 };

export const LEAGUE_TOWN: TownDef = {
  no: 99,
  id: 'league',
  name: 'ナンバーリーグ',
  subtitle: 'さいごの 回廊',
  unit: 'ナンバーリーグ',
  type: 'kazu',
  biome: 'league',
  // 回廊なので細長い。canStand の判定は正方形なので、横幅は別途せまく見せる。
  size: LENGTH,
  intro: [
    'ナンバーリーグ ―― 地方じゅうの トレーナーが めざす 場所。',
    '重い扉が、ゆっくりと ひらいた。',
    '奥へ つづく 長い回廊。かべには 14の バッジの もようが きざまれている。',
    'ここから先は、一本道だ。',
  ],
  masterTitle: 'チャンピオン',
  wildLevel: 0,
  npcs: [],
  groundTexturePrompt:
    'a grand indoor hall floor of dark polished purple-grey marble tiles with thin gold inlay lines',
};

/** リーグの進行度から、いま立っているべきNPCを組み立てる */
export const buildLeagueNpcs = (progress: number): FieldNpcDef[] => {
  const npcs: FieldNpcDef[] = [];

  ELITE_FOUR.forEach((e, i) => {
    // 倒した相手はもう間にいない(扉が開き、その先へ進める)
    if (progress !== i) return;
    npcs.push({
      id: `league-elite-${i}`,
      kind: 'elite',
      name: `${e.title} ${e.name}`,
      sprite: e.sprite,
      x: 0,
      z: roomZ(i),
      lines: e.lines,
      afterLines: e.afterLines,
    });
  });

  // チャンピオンは、いちど勝ったあとも同じ場所に立っている(何度でも挑める)
  if (progress >= ELITE_FOUR.length) {
    npcs.push({
      id: 'league-champion',
      kind: 'champion',
      name: CHAMPION.name,
      sprite: CHAMPION.sprite,
      x: 0,
      z: roomZ(ELITE_FOUR.length),
      lines: CHAMPION.lines,
      afterLines: CHAMPION.afterLines,
    });
  }

  return npcs;
};

/** 部屋の見た目(3D側が使う) */
export const LEAGUE_ROOM_COLORS = [
  '#6d5bd0', // ホシミ
  '#c0392b', // ゴウキ
  '#3fa8d8', // ユキ
  '#2f9e63', // タイガ
  '#f5b942', // チャンピオン
];

/** 部屋の名前(扉の上にかかげる) */
export const LEAGUE_ROOM_LABELS = [
  ...ELITE_FOUR.map(e => e.name),
  CHAMPION.name,
];

// ============================================================
// 3D側に渡す回廊のかたち
// ============================================================

export interface LeagueGate {
  z: number;
  open: boolean;
  color: string;
}

export interface LeagueRoom {
  z: number;
  color: string;
  /** すでに勝った相手の間か(勝つと灯りがつく) */
  cleared: boolean;
}

export interface LeagueCorridorSpec {
  halfWidth: number;
  length: number;
  rooms: LeagueRoom[];
  gates: LeagueGate[];
  /** これより奥(zがこれ未満)へは進めない。扉が閉まっているため。 */
  zLimit: number;
}

/**
 * いまの進行度から回廊のかたちを組み立てる。
 *
 * progress は「倒した四天王の人数」。progress 人目までの扉が開き、
 * その先の扉は閉じたまま ―― という一本道になる。
 */
export const leagueCorridor = (progress: number, champion: boolean): LeagueCorridorSpec => {
  const rooms: LeagueRoom[] = LEAGUE_ROOM_COLORS.map((color, i) => ({
    z: roomZ(i),
    color,
    cleared: i < ELITE_FOUR.length ? progress > i : champion,
  }));
  // 扉は四天王の間のうしろに1枚ずつ(チャンピオンの間のうしろには無い)
  const gates: LeagueGate[] = ELITE_FOUR.map((_, i) => ({
    z: gateZ(i),
    open: progress > i,
    color: LEAGUE_ROOM_COLORS[i + 1],
  }));
  const closed = gates.filter(g => !g.open);
  const zLimit = closed.length > 0
    ? Math.max(...closed.map(g => g.z)) + 1.8
    : -LENGTH / 2 + 3;
  return { halfWidth: LEAGUE_HALF_WIDTH, length: LENGTH, rooms, gates, zLimit };
};
