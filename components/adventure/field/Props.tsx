/**
 * Props.tsx — フィールドに置く木・岩・柱・ケーキなどの3Dオブジェクト。
 *
 * 数が多いので、同じ形はすべて InstancedMesh 1つにまとめている(iPadでも軽い)。
 * 1つの飾りは「いくつかの単純な立体の組み合わせ」で作り、影はまるい
 * ブロブシャドウで表す(実影を切ることでモバイルの負荷を下げている)。
 */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PropInstance } from './terrain';

type GeoKind = 'cone' | 'cylinder' | 'sphere' | 'box' | 'ico' | 'octa' | 'torus';

interface Part {
  geo: GeoKind;
  args: number[];
  color: string;
  /** 親からの相対位置(scale 適用前) */
  pos: [number, number, number];
  /** 相対スケール */
  scale?: [number, number, number];
  rot?: [number, number, number];
  opacity?: number;
  emissive?: string;
  flat?: boolean;
}

/** 飾りの見た目。単純な立体を積むだけで、絵本のような形にする。 */
const PROP_PARTS: Record<string, Part[]> = {
  tree: [
    { geo: 'cylinder', args: [0.16, 0.24, 1.5, 7], color: '#8a5a3b', pos: [0, 0.75, 0] },
    { geo: 'ico', args: [1.15, 0], color: '#4f9b45', pos: [0, 2.15, 0], scale: [1, 0.85, 1], flat: true },
    { geo: 'ico', args: [0.78, 0], color: '#5cb051', pos: [0.3, 2.95, -0.15], flat: true },
  ],
  pine: [
    { geo: 'cylinder', args: [0.15, 0.2, 1.0, 6], color: '#7a4f34', pos: [0, 0.5, 0] },
    { geo: 'cone', args: [1.05, 1.7, 7], color: '#2f7a4a', pos: [0, 1.7, 0], flat: true },
    { geo: 'cone', args: [0.82, 1.4, 7], color: '#378b54', pos: [0, 2.5, 0], flat: true },
    { geo: 'cone', args: [0.55, 1.1, 7], color: '#409a5d', pos: [0, 3.2, 0], flat: true },
  ],
  rock: [
    { geo: 'ico', args: [0.72, 0], color: '#9aa0a6', pos: [0, 0.5, 0], scale: [1.1, 0.85, 1], flat: true },
    { geo: 'ico', args: [0.36, 0], color: '#b0b6bc', pos: [0.55, 0.28, 0.3], flat: true },
  ],
  flower: [
    { geo: 'cylinder', args: [0.03, 0.03, 0.4, 4], color: '#4f9b45', pos: [0, 0.2, 0] },
    { geo: 'sphere', args: [0.13, 7, 6], color: '#ffd7e8', pos: [0, 0.44, 0] },
    { geo: 'sphere', args: [0.06, 6, 5], color: '#ffe98a', pos: [0, 0.5, 0] },
  ],
  crystal: [
    { geo: 'octa', args: [0.85, 0], color: '#7fe4ff', pos: [0, 0.9, 0], scale: [0.6, 1.3, 0.6], opacity: 0.75, emissive: '#2f9fd0', flat: true },
    { geo: 'octa', args: [0.45, 0], color: '#a8efff', pos: [0.45, 0.5, 0.2], scale: [0.6, 1.1, 0.6], opacity: 0.75, emissive: '#2f9fd0', flat: true },
  ],
  gear: [
    { geo: 'cylinder', args: [0.16, 0.16, 1.2, 8], color: '#7a6a52', pos: [0, 0.6, 0] },
    { geo: 'torus', args: [0.62, 0.16, 6, 10], color: '#c99b3f', pos: [0, 1.4, 0], rot: [Math.PI / 2, 0, 0] },
    { geo: 'cylinder', args: [0.2, 0.2, 0.22, 8], color: '#e0b45a', pos: [0, 1.4, 0], rot: [Math.PI / 2, 0, 0] },
  ],
  cake: [
    { geo: 'cylinder', args: [0.85, 0.95, 0.6, 14], color: '#fbe6c8', pos: [0, 0.3, 0] },
    { geo: 'cylinder', args: [0.68, 0.8, 0.55, 14], color: '#f7a8c4', pos: [0, 0.87, 0] },
    { geo: 'cylinder', args: [0.5, 0.6, 0.5, 14], color: '#fff4f8', pos: [0, 1.38, 0] },
    { geo: 'sphere', args: [0.18, 9, 8], color: '#e8465f', pos: [0, 1.75, 0] },
  ],
  cactus: [
    { geo: 'cylinder', args: [0.32, 0.36, 1.8, 9], color: '#4f9b5f', pos: [0, 0.9, 0] },
    { geo: 'sphere', args: [0.33, 9, 8], color: '#4f9b5f', pos: [0, 1.8, 0] },
    { geo: 'cylinder', args: [0.16, 0.18, 0.75, 8], color: '#57a869', pos: [0.42, 1.15, 0], rot: [0, 0, -0.5] },
    { geo: 'sphere', args: [0.17, 8, 7], color: '#57a869', pos: [0.6, 1.45, 0] },
  ],
  pillar: [
    { geo: 'cylinder', args: [0.42, 0.48, 3.0, 12], color: '#efe8d6', pos: [0, 1.5, 0] },
    { geo: 'box', args: [1.15, 0.28, 1.15], color: '#e2d9c2', pos: [0, 3.1, 0] },
    { geo: 'box', args: [1.25, 0.25, 1.25], color: '#e2d9c2', pos: [0, 0.12, 0] },
  ],
  lamp: [
    { geo: 'cylinder', args: [0.07, 0.09, 1.7, 6], color: '#57514a', pos: [0, 0.85, 0] },
    { geo: 'sphere', args: [0.26, 10, 9], color: '#ffe9a8', pos: [0, 1.85, 0], emissive: '#ffcf5c' },
  ],
  mushroom: [
    { geo: 'cylinder', args: [0.1, 0.13, 0.42, 7], color: '#f3ead6', pos: [0, 0.21, 0] },
    { geo: 'sphere', args: [0.3, 10, 8], color: '#e2604f', pos: [0, 0.46, 0], scale: [1, 0.62, 1] },
  ],
  // 風車だけは羽根を回すので、インスタンス化せず別に描く
  windmill: [],
};

const geometryFor = (part: Part): THREE.BufferGeometry => {
  const a = part.args;
  switch (part.geo) {
    case 'cone': return new THREE.ConeGeometry(a[0], a[1], a[2] ?? 8);
    case 'cylinder': return new THREE.CylinderGeometry(a[0], a[1], a[2], a[3] ?? 8);
    case 'sphere': return new THREE.SphereGeometry(a[0], a[1] ?? 10, a[2] ?? 8);
    case 'box': return new THREE.BoxGeometry(a[0], a[1], a[2]);
    case 'ico': return new THREE.IcosahedronGeometry(a[0], a[1] ?? 0);
    case 'octa': return new THREE.OctahedronGeometry(a[0], a[1] ?? 0);
    case 'torus': return new THREE.TorusGeometry(a[0], a[1], a[2] ?? 6, a[3] ?? 10);
  }
};

/** ひとつのパーツを、その形を使う全インスタンス分まとめて描く */
const PartInstances: React.FC<{ part: Part; items: PropInstance[] }> = ({ part, items }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => geometryFor(part), [part]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const ps = part.scale ?? [1, 1, 1];
    const pr = part.rot ?? [0, 0, 0];
    items.forEach((it, i) => {
      e.set(pr[0], pr[1] + it.rot, pr[2]);
      q.setFromEuler(e);
      pos.set(
        it.x + part.pos[0] * it.scale,
        it.y + part.pos[1] * it.scale,
        it.z + part.pos[2] * it.scale,
      );
      scl.set(ps[0] * it.scale, ps[1] * it.scale, ps[2] * it.scale);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, part, geometry]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined as any, items.length]}
      frustumCulled={false}
    >
      <meshLambertMaterial
        color={part.color}
        transparent={part.opacity !== undefined}
        opacity={part.opacity ?? 1}
        emissive={part.emissive ?? '#000000'}
        emissiveIntensity={part.emissive ? 0.55 : 0}
        flatShading={part.flat ?? false}
      />
    </instancedMesh>
  );
};

/** 風車。数が少ないので個別に描いて羽根を回す。 */
const Windmill: React.FC<{ item: PropInstance }> = ({ item }) => {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 0.65;
  });
  const s = item.scale * 1.35;
  return (
    <group position={[item.x, item.y, item.z]} rotation={[0, item.rot, 0]} scale={s}>
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.45, 0.75, 3.6, 10]} />
        <meshLambertMaterial color="#f0e7d2" />
      </mesh>
      <mesh position={[0, 3.8, 0]}>
        <coneGeometry args={[0.85, 0.9, 10]} />
        <meshLambertMaterial color="#c0563f" />
      </mesh>
      <group ref={blades} position={[0, 3.1, 0.8]}>
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[0, 0, 0]}>
            <boxGeometry args={[0.22, 2.4, 0.08]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[0.2, 8, 7]} />
          <meshLambertMaterial color="#8a7a5c" />
        </mesh>
      </group>
    </group>
  );
};

/** 地面に落とすまるい影。実影より軽く、この画風にもよく合う。 */
export const BlobShadow: React.FC<{
  x: number; y: number; z: number; r: number; opacity?: number;
}> = ({ x, y, z, r, opacity = 0.24 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y + 0.04, z]}>
    <circleGeometry args={[r, 16]} />
    <meshBasicMaterial color="#000000" transparent opacity={opacity} depthWrite={false} />
  </mesh>
);

export const FieldProps: React.FC<{ items: PropInstance[] }> = ({ items }) => {
  const grouped = useMemo(() => {
    const map: Record<string, PropInstance[]> = {};
    for (const it of items) (map[it.kind] ??= []).push(it);
    return map;
  }, [items]);

  return (
    <group>
      {Object.entries(grouped).map(([kind, list]) => {
        if (kind === 'windmill') {
          return list.map((it, i) => <Windmill key={`wm${i}`} item={it} />);
        }
        const parts = PROP_PARTS[kind];
        if (!parts || parts.length === 0) return null;
        return parts.map((part, i) => (
          <PartInstances key={`${kind}-${i}`} part={part} items={list} />
        ));
      })}
      {/* 大きな飾りにだけ影を落とす(小さな花や草には付けない) */}
      {items
        .filter(it => it.radius >= 0.7)
        .map((it, i) => (
          <BlobShadow key={`sh${i}`} x={it.x} y={it.y} z={it.z} r={it.scale * 0.85} opacity={0.18} />
        ))}
    </group>
  );
};
