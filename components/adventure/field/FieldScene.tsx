/**
 * FieldScene.tsx — 3Dフィールド本体。
 *
 * ・移動はバーチャルパッドと、地面タップの2通り(小4がどちらでも迷わないように)
 * ・カメラはプレイヤーのうしろ上から見おろす追従カメラ
 * ・草むらを歩くと野生モンスターに遭遇し、NPCに近づくと話しかけられる
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { FieldNpcDef, TownDef } from '../../../data/adventure/adventureTypes';
import { BIOME_STYLES } from '../../../data/adventure/biomes';
import { ELEMENTS } from '../../../data/adventure/elements';
import { getPlayerSprite, getNpcSprite } from '../../../data/adventure/people';
import { getMonsterSprite } from '../../../data/adventure/monsters';
import type { LeagueCorridorSpec } from '../../../data/adventure/league';
import { AMBUSH_SPEED, AMBUSH_CAPTURE_RANGE } from '../../../data/adventure/team';
import { LEGEND_WANDER_SPEED, LEGEND_WANDER_CAPTURE_RANGE } from '../../../data/adventure/legends';
import { Clouds, GrassPatches, Ground, Sky, Water } from './Scenery';
import { FieldProps } from './Props';
import { Building, Shrine, SpriteActor } from './Actors';
import { LeagueCorridor } from './League';
import {
  buildGrassPatches, buildProps, heightAt, inGrass, seedOf,
  type PropInstance,
} from './terrain';

/** 外から操作するための共有状態。毎フレーム React の state を更新しないための入れ物。 */
export interface FieldControl {
  /** バーチャルパッドの入力(-1〜1) */
  moveX: number;
  moveY: number;
  /** タップで指定した目的地 */
  target: { x: number; z: number } | null;
  /** プレイヤーの現在位置(読み取り用) */
  pos: { x: number; z: number };
  /** 近くにいるNPC(読み取り用) */
  nearNpc: FieldNpcDef | null;
  /** 入力を受け付けるか(会話中・バトル中は false) */
  enabled: boolean;
}

const PLAYER_SPEED = 7.2;
// 話しかけられる距離。ぴったり重ならないと反応しないと小4にはつらいので広めにとる。
const NPC_TALK_RANGE = 4.0;

interface SceneProps {
  town: TownDef;
  appearance: 'boy' | 'girl';
  control: React.MutableRefObject<FieldControl>;
  npcs: FieldNpcDef[];
  defeatedNpcs: string[];
  onEncounter: () => void;
  onNearNpcChange: (npc: FieldNpcDef | null) => void;
  startAt: { x: number; z: number };
  /** リーグの回廊のときだけ渡す。渡すと屋内の一本道になる。 */
  corridor?: LeagueCorridorSpec;
  /**
   * テキトウ団の下っ端の待ち伏せ。npcs とは別に持つ理由は、こちらだけ
   * 毎フレーム位置が動く(プレイヤーを追ってくる)ため。npcs は
   * save から決定的に組み立てる静的な一覧なので混ぜたくない。
   */
  ambush?: { id: string; sprite: string; x: number; z: number } | null;
  /** 下っ端がプレイヤーに追いついたとき(近づいて調べなくても自動で起きる) */
  onAmbushCatch?: () => void;
  /**
   * フィールドにまれに現れる、巨大な伝説モンスターの「おためし」遭遇。
   * ambush と同じ理由(毎フレーム位置が動く)で npcs とは別に持つ。
   */
  legendWander?: { id: string; defId: string; color: string; x: number; z: number } | null;
  /** 伝説にプレイヤーが追いついたとき */
  onLegendCatch?: () => void;
}

const World: React.FC<SceneProps> = ({
  town, appearance, control, npcs, defeatedNpcs,
  onEncounter, onNearNpcChange, startAt, corridor, ambush, onAmbushCatch,
  legendWander, onLegendCatch,
}) => {
  const style = BIOME_STYLES[town.biome];
  const seed = useMemo(() => seedOf(town.id), [town.id]);
  const half = town.size / 2;
  const indoor = Boolean(corridor);

  const props = useMemo<PropInstance[]>(
    () => {
      if (corridor) return [];
      const all = buildProps(town.id, town.size, style.props);
      // 木や岩は町IDから機械的に置いているので、NPCの真上や、
      // 道(x≒0)からNPCまでの通り道をふさいでしまうことがある。
      // ふさがれると話しかけに行けないので、NPCのまわりと
      // 「道からNPCまでの一直線」にある当たり判定つきの飾りだけを取りのぞく。
      return all.filter(p => {
        if (p.radius <= 0) return true;
        for (const n of npcs) {
          const dx = p.x - n.x, dz = p.z - n.z;
          if (dx * dx + dz * dz < 4.0 * 4.0) return false;
          const inLane =
            Math.abs(p.z - n.z) < 2.6 &&
            p.x >= Math.min(0, n.x) - 1 && p.x <= Math.max(0, n.x) + 1;
          if (inLane) return false;
        }
        return true;
      });
    },
    [town.id, town.size, style.props, corridor, npcs],
  );
  const patches = useMemo(
    () => (corridor ? [] : buildGrassPatches(town.id, town.size)),
    [town.id, town.size, corridor],
  );

  /** 足元の高さ。屋内は平ら。 */
  const groundY = useCallback(
    (x: number, z: number) => (indoor ? 0 : heightAt(x, z, seed, town.size)),
    [indoor, seed, town.size],
  );

  // プレイヤーの状態(毎フレーム更新するので ref で持つ)
  const player = useRef({
    x: startAt.x, z: startAt.z, y: 0,
    dirX: 0, dirZ: 1,
    steps: 0, nextEncounter: 6 + Math.random() * 8,
    moving: false,
  });
  const playerGroup = useRef<THREE.Group>(null);
  const lastNear = useRef<string | null>(null);

  // テキトウ団の下っ端。プレイヤーと同じく毎フレーム位置を動かすので ref で持つ。
  const ambushLive = useRef<{ x: number; z: number } | null>(null);
  const ambushGroup = useRef<THREE.Group>(null);
  const ambushTriggered = useRef(false);
  useEffect(() => {
    ambushLive.current = ambush ? { x: ambush.x, z: ambush.z } : null;
    ambushTriggered.current = false;
  }, [ambush?.id]);

  // 野生の伝説。こちらも同じ理由で ref で毎フレーム動かす。
  const legendLive = useRef<{ x: number; z: number } | null>(null);
  const legendGroup = useRef<THREE.Group>(null);
  const legendTriggered = useRef(false);
  useEffect(() => {
    legendLive.current = legendWander ? { x: legendWander.x, z: legendWander.z } : null;
    legendTriggered.current = false;
  }, [legendWander?.id]);

  const { camera } = useThree();
  // 向きが変わったときだけ再描画する(毎フレームの setState は避ける)
  const [facing, setFacing] = React.useState<'front' | 'back' | 'side'>('front');
  const [flip, setFlip] = React.useState(false);

  // 建物の位置。NPCは入口の手前に立ち、建物はその奥に建つ。
  // 当たり判定はこの「建物の位置」で取る。NPCの位置で取ってしまうと、
  // NPC本人に近づけなくなって話しかけられない。
  const nurse = npcs.find(n => n.kind === 'nurse');
  const shop = npcs.find(n => n.kind === 'shop');
  const master = npcs.find(n => n.kind === 'master');

  const buildings = useMemo(() => {
    const out: Array<{ x: number; z: number; hw: number; hd: number; kind: 'nurse' | 'shop' | 'dojo' }> = [];
    if (corridor) return out;
    // Building.tsx の寸法(小屋 6×5 / 道場 9×7)に少し余裕を足したもの
    if (nurse) out.push({ x: nurse.x, z: nurse.z - 3.2, hw: 3.4, hd: 2.9, kind: 'nurse' });
    if (shop) out.push({ x: shop.x, z: shop.z - 3.2, hw: 3.4, hd: 2.9, kind: 'shop' });
    if (master) out.push({ x: master.x, z: master.z - 4.6, hw: 4.9, hd: 3.9, kind: 'dojo' });
    return out;
  }, [nurse, shop, master, corridor]);

  /** その場所へ行けるか(飾り・建物・フィールドのふち) */
  const canStand = useCallback(
    (x: number, z: number) => {
      if (corridor) {
        // 回廊は横にせまく、閉じている扉より奥へは進めない
        if (Math.abs(x) > corridor.halfWidth - 1.1) return false;
        if (Math.abs(z) > corridor.length / 2 - 2.2) return false;
        if (z < corridor.zLimit) return false;
        // 相手のからだをすりぬけない。話しかけられる距離では止まる。
        for (const n of npcs) {
          const dx = x - n.x, dz = z - n.z;
          if (dx * dx + dz * dz < 2.6 * 2.6) return false;
        }
        return true;
      }
      if (Math.abs(x) > half - 1.2 || Math.abs(z) > half - 1.2) return false;
      for (const p of props) {
        if (p.radius <= 0) continue;
        const dx = x - p.x, dz = z - p.z;
        const r = p.radius * p.scale;
        if (dx * dx + dz * dz < r * r) return false;
      }
      for (const b of buildings) {
        if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd) return false;
      }
      return true;
    },
    [props, half, buildings, corridor, npcs],
  );

  useFrame((state, dtRaw) => {
    // タブ復帰時に一気に飛ぶのを防ぐ上限。ただし小さくしすぎると、
    // フレームレートの低い端末で移動そのものが遅くなるので 0.1s にしてある。
    const dt = Math.min(dtRaw, 0.1);
    const c = control.current;
    const p = player.current;

    let vx = 0, vz = 0;
    if (c.enabled) {
      if (Math.abs(c.moveX) > 0.05 || Math.abs(c.moveY) > 0.05) {
        // パッドが押されたらタップ移動はやめる
        c.target = null;
        vx = c.moveX;
        vz = c.moveY;
      } else if (c.target) {
        const dx = c.target.x - p.x;
        const dz = c.target.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.6) {
          c.target = null;
        } else {
          vx = dx / d;
          vz = dz / d;
        }
      }
    }

    const speed = Math.min(1, Math.hypot(vx, vz));
    p.moving = speed > 0.05;

    if (p.moving) {
      const nx = p.x + (vx / (speed || 1)) * speed * PLAYER_SPEED * dt;
      const nz = p.z + (vz / (speed || 1)) * speed * PLAYER_SPEED * dt;
      // 斜めでつっかえないよう、XとZを別々に判定する
      if (canStand(nx, p.z)) p.x = nx;
      if (canStand(p.x, nz)) p.z = nz;
      p.dirX = vx; p.dirZ = vz;

      // 草むらを歩いた歩数で野生に遭遇する
      const onGrass = inGrass(p.x, p.z, patches);
      if (onGrass) {
        p.steps += speed * PLAYER_SPEED * dt;
        if (p.steps > p.nextEncounter) {
          p.steps = 0;
          p.nextEncounter = 7 + Math.random() * 11;
          onEncounter();
        }
      }
      // 開発時だけ、位置と草むら判定を覗けるようにしておく(自動テスト用)
      if ((import.meta as any).env?.DEV) {
        (window as any).__adv = { x: p.x, z: p.z, steps: p.steps, grass: onGrass, patches };
      }
    }
    // 自動テストから任意の場所へ飛ばすための口。開発ビルドにしか生えない。
    if ((import.meta as any).env?.DEV) {
      (window as any).__advTeleport = (x: number, z: number) => { p.x = x; p.z = z; };
    }

    p.y = groundY(p.x, p.z);
    c.pos.x = p.x;
    c.pos.z = p.z;

    if (playerGroup.current) {
      playerGroup.current.position.set(p.x, p.y, p.z);
    }

    // 進行方向に合わせて、正面・背面・横のスプライトを出しわける
    const nextFacing: 'front' | 'back' | 'side' = !p.moving
      ? facing
      : Math.abs(p.dirX) > Math.abs(p.dirZ) ? 'side' : p.dirZ < 0 ? 'back' : 'front';
    if (nextFacing !== facing) setFacing(nextFacing);
    const nextFlip = nextFacing === 'side' && p.dirX > 0;
    if (nextFlip !== flip) setFlip(nextFlip);

    // --- カメラ追従(うしろ上から見おろす) ---
    // 高さと距離はポケモンのDS/3DS作品に近い、ゆるい見下ろし角にしてある。
    const camTarget = new THREE.Vector3(p.x, p.y + 1.5, p.z);
    const desired = new THREE.Vector3(p.x, p.y + 7.6, p.z + 10.2);
    if (corridor) {
      // 回廊では、カメラが入口のかべを つきぬけないように 手前で止める
      desired.z = Math.min(desired.z, corridor.length / 2 - 1.5);
      desired.x = 0;
    }
    camera.position.lerp(desired, 1 - Math.pow(0.0015, dt));
    camera.lookAt(camTarget);

    // --- テキトウ団の下っ端(いれば、少しずつプレイヤーを追う) ---
    // 会話中・バトル中・メニュー中(c.enabled === false)は動かさない。
    // そのあいだに追いつかれて詰む、ということが起きないようにするため。
    if (c.enabled && ambush && ambushLive.current) {
      const a = ambushLive.current;
      const dx = p.x - a.x, dz = p.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < AMBUSH_CAPTURE_RANGE) {
        if (!ambushTriggered.current) {
          ambushTriggered.current = true;
          onAmbushCatch?.();
        }
      } else {
        const step = Math.min(d, AMBUSH_SPEED * dt);
        a.x += (dx / d) * step;
        a.z += (dz / d) * step;
      }
      if (ambushGroup.current) {
        ambushGroup.current.position.set(a.x, groundY(a.x, a.z), a.z);
      }
    }

    // --- 野生の伝説(いれば、少しずつプレイヤーを追う) ---
    if (c.enabled && legendWander && legendLive.current) {
      const l = legendLive.current;
      const dx = p.x - l.x, dz = p.z - l.z;
      const d = Math.hypot(dx, dz);
      if (d < LEGEND_WANDER_CAPTURE_RANGE) {
        if (!legendTriggered.current) {
          legendTriggered.current = true;
          onLegendCatch?.();
        }
      } else {
        const step = Math.min(d, LEGEND_WANDER_SPEED * dt);
        l.x += (dx / d) * step;
        l.z += (dz / d) * step;
      }
      if (legendGroup.current) {
        legendGroup.current.position.set(l.x, groundY(l.x, l.z), l.z);
      }
    }

    // --- 近くのNPC ---
    let near: FieldNpcDef | null = null;
    let bestD = NPC_TALK_RANGE;
    for (const n of npcs) {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < bestD) { bestD = d; near = n; }
    }
    c.nearNpc = near;
    const id = near?.id ?? null;
    if (id !== lastNear.current) {
      lastNear.current = id;
      onNearNpcChange(near);
    }
  });

  /** 地面タップで移動先を決める */
  const handleGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (!control.current.enabled) return;
    e.stopPropagation();
    const pt = e.point;
    control.current.target = { x: pt.x, z: pt.z };
  };

  const accent = ELEMENTS[town.type].color;

  return (
    <>
      <Sky style={style} />
      {!indoor && <Clouds seed={seed} />}
      <fog attach="fog" args={[style.fog, indoor ? 26 : 18, 1 / style.fogDensity]} />
      <hemisphereLight
        args={[style.skyBottom, style.ground, style.ambientIntensity]}
      />
      <ambientLight color={style.ambient} intensity={style.ambientIntensity * 0.45} />
      <directionalLight
        color={style.sun}
        intensity={style.sunIntensity}
        position={[40, 60, 25]}
      />

      {/* 地面(タップ移動の受け皿も兼ねる) */}
      <group onClick={handleGroundClick}>
        <Ground
          townId={town.id}
          size={town.size}
          style={style}
          flat={indoor}
          textureUrl={`${(import.meta as any).env?.BASE_URL ?? '/'}assets/adventure/terrain/${town.biome}-ground.png`}
        />
      </group>

      {corridor && <LeagueCorridor spec={corridor} style={style} />}

      {!indoor && style.water && <Water size={town.size} style={style} />}
      {!indoor && (
        <>
          <GrassPatches patches={patches} style={style} seed={seed} size={town.size} />
          <FieldProps items={props} />
        </>
      )}

      {/* 建物(当たり判定と同じ位置定義を使う) */}
      {buildings.map(b => (
        <Building
          key={b.kind}
          kind={b.kind}
          x={b.x}
          y={groundY(b.x, b.z)}
          z={b.z}
          accent={accent}
        />
      ))}

      {/* 祠(伝説のモンスターが眠る場所) */}
      {npcs.filter(n => n.kind === 'shrine').map(n => (
        <Shrine
          key={n.id}
          x={n.x}
          y={groundY(n.x, n.z)}
          z={n.z}
          color={n.shrineStyle?.color ?? '#f5b942'}
          style={n.shrineStyle?.style ?? 'monolith'}
          ready={n.afterLines?.[0] === 'ready'}
          taken={n.afterLines?.[0] === 'taken'}
        />
      ))}

      {/* NPC */}
      {npcs.filter(n => n.kind !== 'shrine').map((n, i) => {
        const beaten = defeatedNpcs.includes(n.id);
        const marker =
          n.kind === 'trainer' || n.kind === 'master' || n.kind === 'team'
            || n.kind === 'elite' || n.kind === 'champion'
            ? beaten ? 'none' : 'battle'
            : 'talk';
        return (
          <SpriteActor
            key={n.id}
            url={getNpcSprite(n.sprite)}
            x={n.x}
            y={groundY(n.x, n.z)}
            z={n.z}
            height={n.kind === 'master' ? 2.5 : 2.15}
            phase={i * 1.3}
            tint={accent}
            marker={marker as 'none' | 'talk' | 'battle'}
          />
        );
      })}

      {/* テキトウ団の下っ端(徘徊してプレイヤーを追ってくる) */}
      {ambush && (
        <group
          ref={ambushGroup}
          position={[ambushLive.current?.x ?? ambush.x, 0, ambushLive.current?.z ?? ambush.z]}
        >
          <SpriteActor
            url={getNpcSprite(ambush.sprite)}
            x={0} y={0} z={0}
            height={2.15}
            phase={2.4}
            tint="#f97316"
            marker="battle"
          />
        </group>
      )}

      {/* 野生の伝説(巨大なので、ふつうのモンスターより一回りも二回りも大きく描く) */}
      {legendWander && (
        <group
          ref={legendGroup}
          position={[legendLive.current?.x ?? legendWander.x, 0, legendLive.current?.z ?? legendWander.z]}
        >
          <SpriteActor
            url={getMonsterSprite(legendWander.defId)}
            x={0} y={0} z={0}
            height={6.5}
            phase={0.6}
            tint={legendWander.color}
            marker="legend"
          />
        </group>
      )}

      {/* プレイヤー */}
      <group ref={playerGroup}>
        <SpriteActor
          url={getPlayerSprite(appearance, facing)}
          x={0} y={0} z={0}
          height={2.2}
          bob
          tint="#ffd28a"
          flip={flip}
        />
      </group>
    </>
  );
};

/**
 * ブラウザのズーム(Ctrl+ホイール等)に強い描画解像度をもとめる。
 *
 * dpr={[1, 1.75]} と固定していたときの問題:
 *  ・ズームアウトすると CSS ピクセルでの画面幅が増えるのに dpr の下限が1のままなので、
 *    実際に描く点の数が「画面幅 × 1」でふくらみ、素の表示より重くなっていた
 *    (50%まで縮めると横も縦も2倍 = 4倍の点を描くことになる)。
 * そこで「横おおよそ1600点ぶん」を目安に上限を決め、広い画面ほど dpr を下げる。
 * こうすると、ズームしても描く点の数がだいたい一定に保たれる。
 */
const dprForViewport = (): number => {
  const device = window.devicePixelRatio || 1;
  const budget = 1600;
  const cap = Math.min(1.75, Math.max(0.7, budget / Math.max(1, window.innerWidth)));
  return Math.min(Math.max(device, 0.7), cap);
};

/**
 * ズームや画面サイズが変わったときに、描画解像度を入れなおす。
 *
 * Canvas の dpr プロパティを後から変えても反映されないことがあるため、
 * r3f のストアの setDpr を直接呼ぶ(こうすると描画ループ側が
 * gl.setPixelRatio と gl.setSize をまとめてやり直してくれる)。
 */
/** 開発ビルドだけ、いま実際に使われている解像度を覗けるようにしておく(自動テスト用) */
const DprProbe: React.FC = () => {
  const gl = useThree(s => s.gl);
  const viewport = useThree(s => s.viewport);
  if ((import.meta as any).env?.DEV) {
    (window as any).__advGlDpr = () => ({ gl: gl.getPixelRatio(), viewport: viewport.dpr });
  }
  return null;
};

const FieldScene: React.FC<SceneProps> = props => {
  // 解像度は Canvas の dpr プロパティ「だけ」で決める。
  // r3f は Canvas が再描画されるたびに configure() を走らせ、そのときの dpr
  // プロパティで解像度を上書きする。そのため内側から setDpr を呼んでも
  // すぐ元に戻されてしまう ―― プロパティ側を変えるのが唯一たしかな方法。
  const [dpr, setDpr] = useState(dprForViewport);

  useEffect(() => {
    let timer: number | undefined;
    // ズーム中は resize が連続で飛んでくる。そのたびに解像度を変えると
    // WebGLのバッファを作りなおして「一瞬固まる」ので、落ち着いてから1回だけ変える。
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setDpr(dprForViewport()), 250);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <Canvas
      shadows={false}
      dpr={dpr}
      // Canvas自体のサイズ追従もまとめて行う(ズーム中の作りなおしを減らすため)
      resize={{ debounce: 200 }}
      camera={{ fov: 46, near: 0.5, far: 500, position: [0, 10, 14] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    >
      <DprProbe />
      <World {...props} />
    </Canvas>
  );
};

export default FieldScene;
