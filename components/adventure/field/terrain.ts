/**
 * terrain.ts — フィールドの地形と配置の「決めごと」。
 *
 * 地形の高さも、木や岩の位置も、草むらの場所も、すべて町IDから決まる
 * 疑似乱数で作る。こうしておくと ①端末や再訪でフィールドが変わらない
 * ②座標をセーブしなくてよい ③地形の高さをどこからでも同じ式で引ける。
 */

/** 文字列 → 32bit の種 */
export const seedOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32: 軽くて質のよい決定的乱数 */
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * 地形の高さ。なだらかな起伏だけにして、小4がつまずかないようにしている。
 * 町の中心(スポーン地点〜道場)は平らに近くなるよう、中心からの距離で弱める。
 */
export const heightAt = (x: number, z: number, seed: number, size: number): number => {
  const s = seed % 1000;
  const h =
    Math.sin((x + s) * 0.085) * Math.cos((z - s) * 0.075) * 1.05 +
    Math.sin((x * 0.031 + z * 0.043) + s) * 0.75 +
    Math.cos((x * 0.19 - z * 0.15) + s * 0.7) * 0.22;
  // 南北にのびる「道」の部分を平らにする(移動でつまずかないように)
  const road = Math.exp(-(x * x) / 70);
  return h * (1 - road * 0.85);
};

export interface PropInstance {
  x: number;
  z: number;
  y: number;
  scale: number;
  rot: number;
  kind: string;
  /** 当たり判定の半径(0なら通りぬけできる) */
  radius: number;
}

export interface GrassPatch {
  x: number;
  z: number;
  r: number;
}

const COLLIDE_RADIUS: Record<string, number> = {
  tree: 0.9, pine: 0.9, rock: 0.8, crystal: 0.7, gear: 1.0,
  cake: 1.0, cactus: 0.7, pillar: 1.0, windmill: 1.4, lamp: 0.4,
  flower: 0, mushroom: 0,
};

/** 町ごとの装飾配置。フィールドのふちほど密にして、外に出にくく見せる。 */
export const buildProps = (
  townId: string,
  size: number,
  kinds: string[],
): PropInstance[] => {
  const seed = seedOf(townId);
  const rng = makeRng(seed);
  const half = size / 2;
  const out: PropInstance[] = [];
  const count = Math.round(size * 3.2);

  for (let i = 0; i < count; i++) {
    const x = (rng() * 2 - 1) * (half - 1.5);
    const z = (rng() * 2 - 1) * (half - 1.5);
    // 道(x≒0)と町の広場(南側)には置かない
    if (Math.abs(x) < 3.2) continue;
    if (z > half - 18 && Math.abs(x) < 11) continue;
    // 道場の前は空ける
    if (z < -half + 14 && Math.abs(x) < 8) continue;

    const kind = kinds[Math.floor(rng() * kinds.length)];
    const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
    // ふちに近いほど木を増やして「壁」に見せる
    if (edge < 0.45 && rng() < 0.55) continue;

    out.push({
      x, z,
      y: heightAt(x, z, seed, size),
      scale: 0.75 + rng() * 0.7,
      rot: rng() * Math.PI * 2,
      kind,
      radius: COLLIDE_RADIUS[kind] ?? 0.6,
    });
  }

  // フィールドのふちを木でぐるりと囲む(見えない壁の理由づけ)
  const wallKind = kinds.includes('tree') ? 'tree' : kinds.includes('pine') ? 'pine' : 'rock';
  const step = 2.6;
  for (let t = -half; t <= half; t += step) {
    for (const [x, z] of [[t, -half], [t, half], [-half, t], [half, t]] as const) {
      // 南の入口と北の道場前だけは開けておく
      if (z === half && Math.abs(x) < 5) continue;
      if (z === -half && Math.abs(x) < 5) continue;
      out.push({
        x: x + (rng() - 0.5) * 1.2,
        z: z + (rng() - 0.5) * 1.2,
        y: heightAt(x, z, seed, size),
        scale: 1.0 + rng() * 0.6,
        rot: rng() * Math.PI * 2,
        kind: wallKind,
        radius: 0,   // ふちの木は当たり判定なし(境界は別で止める)
      });
    }
  }
  return out;
};

/** 草むら(野生モンスターが出る場所)。丸い区画をいくつか置く。 */
export const buildGrassPatches = (townId: string, size: number): GrassPatch[] => {
  const rng = makeRng(seedOf(townId) ^ 0x9e3779b9);
  const half = size / 2;
  const patches: GrassPatch[] = [];
  const count = 5 + Math.floor(size / 12);
  for (let i = 0; i < count; i++) {
    const x = (rng() * 2 - 1) * (half - 8);
    const z = (rng() * 2 - 1) * (half - 12);
    // 町の広場には草むらを作らない
    if (z > half - 16) continue;
    patches.push({ x, z, r: 4.5 + rng() * 3.5 });
  }
  return patches;
};

export const inGrass = (x: number, z: number, patches: GrassPatch[]): boolean =>
  patches.some(p => (x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r);
