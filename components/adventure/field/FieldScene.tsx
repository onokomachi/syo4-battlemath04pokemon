/**
 * FieldScene.tsx — 3Dフィールド本体。
 *
 * ・移動はバーチャルパッドと、地面タップの2通り(小4がどちらでも迷わないように)
 * ・カメラはプレイヤーのうしろ上から見おろす追従カメラ
 * ・草むらを歩くと野生モンスターに遭遇し、NPCに近づくと話しかけられる
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { FieldNpcDef, TownDef } from '../../../data/adventure/adventureTypes';
import { BIOME_STYLES } from '../../../data/adventure/biomes';
import { ELEMENTS } from '../../../data/adventure/elements';
import { getPlayerSprite, getNpcSprite } from '../../../data/adventure/people';
import { Clouds, GrassPatches, Ground, Sky, Water } from './Scenery';
import { FieldProps } from './Props';
import { Building, SpriteActor } from './Actors';
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
const NPC_TALK_RANGE = 2.8;

interface SceneProps {
  town: TownDef;
  appearance: 'boy' | 'girl';
  control: React.MutableRefObject<FieldControl>;
  npcs: FieldNpcDef[];
  defeatedNpcs: string[];
  onEncounter: () => void;
  onNearNpcChange: (npc: FieldNpcDef | null) => void;
  startAt: { x: number; z: number };
}

const World: React.FC<SceneProps> = ({
  town, appearance, control, npcs, defeatedNpcs,
  onEncounter, onNearNpcChange, startAt,
}) => {
  const style = BIOME_STYLES[town.biome];
  const seed = useMemo(() => seedOf(town.id), [town.id]);
  const half = town.size / 2;

  const props = useMemo<PropInstance[]>(
    () => buildProps(town.id, town.size, style.props),
    [town.id, town.size, style.props],
  );
  const patches = useMemo(() => buildGrassPatches(town.id, town.size), [town.id, town.size]);

  // プレイヤーの状態(毎フレーム更新するので ref で持つ)
  const player = useRef({
    x: startAt.x, z: startAt.z, y: 0,
    dirX: 0, dirZ: 1,
    steps: 0, nextEncounter: 6 + Math.random() * 8,
    moving: false,
  });
  const playerGroup = useRef<THREE.Group>(null);
  const lastNear = useRef<string | null>(null);
  const { camera } = useThree();
  // 向きが変わったときだけ再描画する(毎フレームの setState は避ける)
  const [facing, setFacing] = React.useState<'front' | 'back' | 'side'>('front');
  const [flip, setFlip] = React.useState(false);

  // 建物と道場の位置(NPCの位置に合わせて建てる)
  const nurse = npcs.find(n => n.kind === 'nurse');
  const shop = npcs.find(n => n.kind === 'shop');
  const master = npcs.find(n => n.kind === 'master');

  /** その場所へ行けるか(飾りとフィールドのふち) */
  const canStand = useCallback(
    (x: number, z: number) => {
      if (Math.abs(x) > half - 1.2 || Math.abs(z) > half - 1.2) return false;
      for (const p of props) {
        if (p.radius <= 0) continue;
        const dx = x - p.x, dz = z - p.z;
        const r = p.radius * p.scale;
        if (dx * dx + dz * dz < r * r) return false;
      }
      // 建物の中には入れない
      for (const b of [nurse, shop, master]) {
        if (!b) continue;
        const w = b.kind === 'master' ? 5.2 : 3.6;
        if (Math.abs(x - b.x) < w && Math.abs(z - b.z) < w * 0.8) return false;
      }
      return true;
    },
    [props, half, nurse, shop, master],
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

    p.y = heightAt(p.x, p.z, seed, town.size);
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
    camera.position.lerp(desired, 1 - Math.pow(0.0015, dt));
    camera.lookAt(camTarget);

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
      <Clouds seed={seed} />
      <fog attach="fog" args={[style.fog, 18, 1 / style.fogDensity]} />
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
          textureUrl={`${(import.meta as any).env?.BASE_URL ?? '/'}assets/adventure/terrain/${town.biome}-ground.png`}
        />
      </group>

      {style.water && <Water size={town.size} style={style} />}
      <GrassPatches patches={patches} style={style} seed={seed} size={town.size} />
      <FieldProps items={props} />

      {/* 建物 */}
      {nurse && (
        <Building kind="nurse" x={nurse.x} y={heightAt(nurse.x, nurse.z - 3.2, seed, town.size)} z={nurse.z - 3.2} accent={accent} />
      )}
      {shop && (
        <Building kind="shop" x={shop.x} y={heightAt(shop.x, shop.z - 3.2, seed, town.size)} z={shop.z - 3.2} accent={accent} />
      )}
      {master && (
        <Building kind="dojo" x={master.x} y={heightAt(master.x, master.z - 4.6, seed, town.size)} z={master.z - 4.6} accent={accent} />
      )}

      {/* NPC */}
      {npcs.map((n, i) => {
        const beaten = defeatedNpcs.includes(n.id);
        const marker =
          n.kind === 'trainer' || n.kind === 'master'
            ? beaten ? 'none' : 'battle'
            : 'talk';
        return (
          <SpriteActor
            key={n.id}
            url={getNpcSprite(n.sprite)}
            x={n.x}
            y={heightAt(n.x, n.z, seed, town.size)}
            z={n.z}
            height={n.kind === 'master' ? 2.5 : 2.15}
            phase={i * 1.3}
            tint={accent}
            marker={marker as 'none' | 'talk' | 'battle'}
          />
        );
      })}

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

const FieldScene: React.FC<SceneProps> = props => (
  <Canvas
    shadows={false}
    dpr={[1, 1.75]}
    camera={{ fov: 46, near: 0.5, far: 500, position: [0, 10, 14] }}
    gl={{ antialias: true, powerPreference: 'high-performance' }}
    style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
  >
    <World {...props} />
  </Canvas>
);

export default FieldScene;
