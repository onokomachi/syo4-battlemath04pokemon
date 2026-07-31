/**
 * Scenery.tsx — 空・地面・水面・草むら。
 *
 * ポケモンのDS/3DS作品と同じ考え方で、地形とライティングは本物の3D、
 * キャラクターだけ2Dスプライトのビルボードにしている(SpriteActor.tsx)。
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BiomeStyle } from '../../../data/adventure/adventureTypes';
import { heightAt, makeRng, seedOf, type GrassPatch } from './terrain';
import { useSafeTexture } from './useSafeTexture';

// ------------------------------------------------------------
// 空(グラデーションのドーム)
// ------------------------------------------------------------

const SKY_VERT = `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  uniform vec3 top;
  uniform vec3 bottom;
  varying vec3 vWorld;
  void main() {
    float h = clamp((normalize(vWorld).y + 0.15) / 0.85, 0.0, 1.0);
    gl_FragColor = vec4(mix(bottom, top, pow(h, 0.75)), 1.0);
  }
`;

export const Sky: React.FC<{ style: BiomeStyle }> = ({ style }) => {
  const uniforms = useMemo(
    () => ({
      top: { value: new THREE.Color(style.skyTop) },
      bottom: { value: new THREE.Color(style.skyBottom) },
    }),
    [style.skyTop, style.skyBottom],
  );
  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[420, 24, 16]} />
      <shaderMaterial
        vertexShader={SKY_VERT}
        fragmentShader={SKY_FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
};

/** ふわふわした雲。ぐるりと遠くに浮かべて奥行きを出す。 */
export const Clouds: React.FC<{ seed: number }> = ({ seed }) => {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(() => {
    const rng = makeRng(seed ^ 0x51ed);
    return Array.from({ length: 14 }, () => {
      const a = rng() * Math.PI * 2;
      const r = 150 + rng() * 90;
      return {
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        y: 48 + rng() * 34,
        s: 10 + rng() * 16,
      };
    });
  }, [seed]);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.004;
  });

  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          {[[0, 0, 0, 1], [-0.8, -0.2, 0.2, 0.72], [0.85, -0.15, -0.2, 0.66]].map(
            ([dx, dy, dz, s], j) => (
              <mesh key={j} position={[dx * p.s, dy * p.s, dz * p.s]}>
                <sphereGeometry args={[p.s * (s as number), 10, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.82} fog={false} />
              </mesh>
            ),
          )}
        </group>
      ))}
    </group>
  );
};

// ------------------------------------------------------------
// 地面
// ------------------------------------------------------------

export const Ground: React.FC<{
  townId: string;
  size: number;
  style: BiomeStyle;
  textureUrl: string;
  /** 屋内(リーグの回廊)は起伏をつけず、平らにする */
  flat?: boolean;
}> = ({ townId, size, style, textureUrl, flat = false }) => {
  const tex = useSafeTexture(textureUrl, style.ground, 'noise');
  const seed = useMemo(() => seedOf(townId), [townId]);

  const geometry = useMemo(() => {
    const seg = Math.min(120, Math.round(size * 2));
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(style.ground);
    const accent = new THREE.Color(style.groundAccent);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, flat ? 0 : heightAt(x, z, seed, size));
      // 色のムラ。べた塗りに見えないようにするだけの弱い変化。
      const n = (Math.sin(x * 0.21 + seed) * Math.cos(z * 0.17 - seed) + 1) / 2;
      tmp.copy(base).lerp(accent, n * 0.85);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [size, seed, style.ground, style.groundAccent, flat]);

  const mapped = useMemo(() => {
    const t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // 1タイル4ワールド単位。粗いと足元がのっぺりして見える
    t.repeat.set(size / 4, size / 4);
    t.needsUpdate = true;
    return t;
  }, [tex, size]);

  // フィールドの外側。これが無いと、ふちの向こうに空が見えて
  // 「板の上を歩いている」ように見えてしまう。
  const skirtTex = useMemo(() => {
    const t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(size / 4, size / 4);
    t.needsUpdate = true;
    return t;
  }, [tex, size]);

  const hills = useMemo(() => {
    const rng = makeRng(seed ^ 0x7f4a);
    return Array.from({ length: 26 }, () => {
      const a = rng() * Math.PI * 2;
      const r = size * (1.1 + rng() * 0.9);
      return {
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        s: size * (0.18 + rng() * 0.22),
      };
    });
  }, [seed, size]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow renderOrder={1}>
        <meshLambertMaterial map={mapped} vertexColors />
      </mesh>
      {/* 外側の地面(遠景)と丘。屋内では見えないので出さない。 */}
      {!flat && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
            <planeGeometry args={[size * 6, size * 6]} />
            <meshLambertMaterial map={skirtTex} color={style.groundAccent} />
          </mesh>
          {hills.map((h, i) => (
            <mesh key={i} position={[h.x, -0.4, h.z]}>
              <sphereGeometry args={[h.s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshLambertMaterial color={style.grass} flatShading />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
};

// ------------------------------------------------------------
// 水面
// ------------------------------------------------------------

export const Water: React.FC<{ size: number; style: BiomeStyle }> = ({ size, style }) => {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);

  const ripple = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(size / 12, size / 12);
    return t;
  }, [size]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // 2枚をゆっくり逆向きに流して、波のゆらぎに見せる
    if (a.current) {
      const m = a.current.material as THREE.MeshStandardMaterial;
      if (m.map) { m.map.offset.x = t * 0.012; m.map.offset.y = t * 0.008; }
      a.current.position.y = -0.55 + Math.sin(t * 0.6) * 0.03;
    }
    if (b.current) {
      const m = b.current.material as THREE.MeshStandardMaterial;
      if (m.map) { m.map.offset.x = -t * 0.009; m.map.offset.y = t * 0.014; }
    }
  });

  const rippleB = useMemo(() => {
    const t = ripple.clone();
    t.needsUpdate = true;
    return t;
  }, [ripple]);

  return (
    <group>
      <mesh ref={a} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <planeGeometry args={[size * 1.6, size * 1.6]} />
        <meshStandardMaterial
          color={style.skyTop}
          map={ripple}
          transparent
          opacity={0.72}
          roughness={0.15}
          metalness={0.25}
        />
      </mesh>
      <mesh ref={b} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[size * 1.6, size * 1.6]} />
        <meshStandardMaterial
          color="#ffffff"
          map={rippleB}
          transparent
          opacity={0.16}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
};

// ------------------------------------------------------------
// 草むら(野生モンスターが出る場所)
// ------------------------------------------------------------

/**
 * 草むらは「歩くと出る場所」なので、ひと目でそれとわかる必要がある。
 * 濃い色の丸い区画 + 立った草の葉で、遠くからでも見分けられるようにする。
 */
export const GrassPatches: React.FC<{
  patches: GrassPatch[];
  style: BiomeStyle;
  seed: number;
  size: number;
}> = ({ patches, style, seed, size }) => {
  const bladesRef = useRef<THREE.InstancedMesh>(null);

  const blades = useMemo(() => {
    const rng = makeRng(seed ^ 0x2b1f);
    const out: Array<{ x: number; z: number; y: number; s: number; rot: number }> = [];
    for (const p of patches) {
      const n = Math.round(p.r * p.r * 1.5);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * p.r * 0.94;
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r;
        out.push({
          x, z,
          y: heightAt(x, z, seed, size),
          s: 0.55 + rng() * 0.6,
          rot: rng() * Math.PI,
        });
      }
    }
    return out;
  }, [patches, seed, size]);

  useFrame(state => {
    const mesh = bladesRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (let i = 0; i < blades.length; i++) {
      const b = blades[i];
      // 風でゆれる。位置でずらして、そろって揺れないようにする。
      const sway = Math.sin(t * 1.6 + b.x * 0.4 + b.z * 0.3) * 0.14;
      e.set(sway, b.rot, sway * 0.6);
      q.setFromEuler(e);
      pos.set(b.x, b.y + 0.3 * b.s, b.z);
      scl.set(b.s, b.s, b.s);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (patches.length === 0) return null;

  return (
    <group>
      {/* 区画そのもの(濃い色の円) */}
      {patches.map((p, i) => (
        <group key={i}>
          {/* ふちの明るい輪。「ここが草むら」とひと目でわかるようにする */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[p.x, heightAt(p.x, p.z, seed, size) + 0.05, p.z]}
          >
            <circleGeometry args={[p.r + 0.5, 28]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.28} depthWrite={false} />
          </mesh>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[p.x, heightAt(p.x, p.z, seed, size) + 0.07, p.z]}
          >
            <circleGeometry args={[p.r, 28]} />
            <meshLambertMaterial color={style.grass} />
          </mesh>
        </group>
      ))}
      {/* 立った草 */}
      <instancedMesh
        ref={bladesRef}
        args={[undefined as any, undefined as any, blades.length]}
        frustumCulled={false}
        castShadow
      >
        <coneGeometry args={[0.26, 1.05, 4]} />
        <meshLambertMaterial color={style.grass} />
      </instancedMesh>
    </group>
  );
};
