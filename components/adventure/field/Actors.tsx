/**
 * Actors.tsx — フィールドに立つキャラクター(2Dスプライトのビルボード)と建物。
 *
 * キャラは Pollinations で生成した透過PNGを、つねにカメラの方を向く板に貼って
 * 立てている。3D空間の中に手描きのキャラが立つ、ポケモンのDS/3DS作品と同じ方式。
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSpriteTexture } from './useSafeTexture';
import { BlobShadow } from './Props';

// ------------------------------------------------------------
// キャラクターのビルボード
// ------------------------------------------------------------

export const SpriteActor: React.FC<{
  url: string;
  x: number;
  y: number;
  z: number;
  /** 見た目の高さ(ワールド単位) */
  height?: number;
  /** 上下にふわふわさせる */
  bob?: boolean;
  /** 位相をずらして、全員が同時に動かないようにする */
  phase?: number;
  tint?: string;
  /** 頭の上に「！」を出す */
  marker?: 'none' | 'talk' | 'battle';
  /** 左右反転(進行方向の表現に使う) */
  flip?: boolean;
  opacity?: number;
}> = ({
  url, x, y, z, height = 2.1, bob = true, phase = 0,
  tint = '#ffd28a', marker = 'none', flip = false, opacity = 1,
}) => {
  const group = useRef<THREE.Group>(null);
  const markerRef = useRef<THREE.Group>(null);
  const tex = useSpriteTexture(url, tint);
  // フックは条件分岐の外で呼ぶ(marker が none のときは描画しないだけ)
  const markerTex = useMarkerTexture(marker === 'battle' ? 'battle' : 'talk');

  const world = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    // 板をカメラの方へ向ける。Y軸まわりだけ回して、傾かないようにする。
    // 親が動く(プレイヤー)場合があるので、ワールド座標で向きを求める。
    const cam = state.camera.position;
    g.getWorldPosition(world);
    g.rotation.y = Math.atan2(cam.x - world.x, cam.z - world.z);
    if (bob) {
      g.position.y = y + Math.sin(state.clock.elapsedTime * 2.1 + phase) * 0.055;
    }
    if (markerRef.current) {
      markerRef.current.rotation.y = g.rotation.y;
      markerRef.current.position.y =
        y + height + 0.55 + Math.sin(state.clock.elapsedTime * 5 + phase) * 0.12;
    }
  });

  return (
    <group>
      <group ref={group} position={[x, y, z]}>
        <mesh position={[0, height / 2, 0]}>
          <planeGeometry args={[height * (flip ? -1 : 1), height]} />
          <meshBasicMaterial
            map={tex}
            transparent
            alphaTest={0.22}
            opacity={opacity}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
      <BlobShadow x={x} y={y} z={z} r={height * 0.28} opacity={0.26} />
      {marker !== 'none' && (
        <group ref={markerRef} position={[x, y + height + 0.55, z]}>
          <mesh>
            <planeGeometry args={[0.62, 0.62]} />
            <meshBasicMaterial map={markerTex} transparent alphaTest={0.1} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
};

/** 「！」「？」の吹き出しをその場で描いて使う(画像ファイル不要) */
const markerCache = new Map<string, THREE.Texture>();
const useMarkerTexture = (kind: 'talk' | 'battle'): THREE.Texture =>
  useMemo(() => {
    const key = kind;
    const hit = markerCache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = kind === 'battle' ? '#ff5a5a' : '#ffd35c';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    // まるい吹き出し
    ctx.beginPath();
    ctx.arc(64, 54, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, 92); ctx.lineTo(64, 122); ctx.lineTo(78, 92); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 68px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kind === 'battle' ? '!' : '?', 64, 56);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    markerCache.set(key, tex);
    return tex;
  }, [kind]);

// ------------------------------------------------------------
// 建物
// ------------------------------------------------------------

/** かいふく所・ショップ・道場。絵本のような単純な形で建てる。 */
export const Building: React.FC<{
  kind: 'nurse' | 'shop' | 'dojo';
  x: number;
  y: number;
  z: number;
  accent: string;
}> = ({ kind, x, y, z, accent }) => {
  const signTex = useSignTexture(kind);
  const palette = {
    nurse: { wall: '#fff2f4', roof: '#f2657f', sign: '#ffffff' },
    shop: { wall: '#f3f7ff', roof: '#4a8fd8', sign: '#ffffff' },
    dojo: { wall: '#f6efe0', roof: accent, sign: '#ffffff' },
  }[kind];

  const w = kind === 'dojo' ? 9 : 6;
  const h = kind === 'dojo' ? 4.2 : 3.2;
  const d = kind === 'dojo' ? 7 : 5;

  return (
    <group position={[x, y, z]}>
      {/* かべ */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshLambertMaterial color={palette.wall} />
      </mesh>
      {/* やね */}
      <mesh position={[0, h + 1.0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[w * 0.79, 2.0, 4]} />
        <meshLambertMaterial color={palette.roof} flatShading />
      </mesh>
      {/* 入口 */}
      <mesh position={[0, 1.1, d / 2 + 0.03]}>
        <planeGeometry args={[1.8, 2.2]} />
        <meshLambertMaterial color="#5c4a3a" />
      </mesh>
      {/* 窓 */}
      {[-1.9, 1.9].map((ox, i) => (
        <mesh key={i} position={[ox, 2.0, d / 2 + 0.03]}>
          <planeGeometry args={[1.1, 1.0]} />
          <meshLambertMaterial color="#bfe6ff" emissive="#7fc4ee" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {/* 看板。屋根の上だと見下ろし角で見えないので、かべの上部に貼る */}
      <mesh position={[0, h - 0.45, d / 2 + 0.06]}>
        <planeGeometry args={[w * 0.62, w * 0.155]} />
        <meshBasicMaterial map={signTex} transparent toneMapped={false} />
      </mesh>
      {kind === 'dojo' && (
        <>
          {/* 道場の柱 */}
          {[-w / 2 + 0.6, w / 2 - 0.6].map((ox, i) => (
            <mesh key={i} position={[ox, h / 2, d / 2 + 0.4]}>
              <cylinderGeometry args={[0.28, 0.32, h, 8]} />
              <meshLambertMaterial color="#8a6a4a" />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
};

const signCache = new Map<string, THREE.Texture>();
const useSignTexture = (kind: 'nurse' | 'shop' | 'dojo'): THREE.Texture =>
  useMemo(() => {
    const hit = signCache.get(kind);
    if (hit) return hit;
    const label = { nurse: 'かいふく所', shop: 'ショップ', dojo: 'どうじょう' }[kind];
    const bg = { nurse: '#f2657f', shop: '#4a8fd8', dojo: '#8a6a4a' }[kind];
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    const r = 24;
    ctx.beginPath();
    ctx.roundRect(4, 4, 504, 120, r);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    signCache.set(kind, tex);
    return tex;
  }, [kind]);


// ------------------------------------------------------------
// 祠(伝説のモンスターが眠る場所)
// ------------------------------------------------------------

/**
 * 石碑と、その上に浮かぶ封印のしるし。
 * 条件を満たすと しるしが 大きく光って回り、「ここに 何かが いる」と分かる。
 * 未達のときは くすんだまま(石碑の伝承だけ読める)。
 */
export const Shrine: React.FC<{
  x: number; y: number; z: number;
  color: string;
  style: 'monolith' | 'torii' | 'ring' | 'pillar';
  /** 条件を満たしているか */
  ready: boolean;
  /** すでに仲間にしたか */
  taken: boolean;
}> = ({ x, y, z, color, style, ready, taken }) => {
  const seal = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);

  useFrame(state => {
    const t = state.clock.elapsedTime;
    if (seal.current) {
      seal.current.rotation.y = t * (ready && !taken ? 0.9 : 0.15);
      seal.current.position.y = y + 3.6 + Math.sin(t * 1.4) * (ready && !taken ? 0.3 : 0.08);
    }
    if (glow.current) {
      const s = ready && !taken ? 1 + Math.sin(t * 2.2) * 0.18 : 1;
      glow.current.scale.setScalar(s);
    }
  });

  const lit = ready && !taken;
  const stone = taken ? '#8d8d8d' : lit ? '#efe7d4' : '#9c968a';

  return (
    <group position={[x, y, z]}>
      {/* 台座 */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[2.6, 3.0, 0.5, 12]} />
        <meshLambertMaterial color="#cfc7b4" />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[2.1, 2.4, 0.3, 12]} />
        <meshLambertMaterial color="#bdb5a2" />
      </mesh>

      {/* 本体 */}
      {style === 'monolith' && (
        <mesh position={[0, 2.2, 0]}>
          <boxGeometry args={[1.5, 3.4, 0.6]} />
          <meshLambertMaterial color={stone} />
        </mesh>
      )}
      {style === 'pillar' && (
        <>
          {[-1.2, 1.2].map((ox, i) => (
            <mesh key={i} position={[ox, 2.1, 0]}>
              <cylinderGeometry args={[0.36, 0.42, 3.2, 10]} />
              <meshLambertMaterial color={stone} />
            </mesh>
          ))}
          <mesh position={[0, 3.9, 0]}>
            <boxGeometry args={[3.4, 0.4, 0.7]} />
            <meshLambertMaterial color={stone} />
          </mesh>
        </>
      )}
      {style === 'torii' && (
        <>
          {[-1.5, 1.5].map((ox, i) => (
            <mesh key={i} position={[ox, 2.0, 0]} rotation={[0, 0, ox > 0 ? -0.05 : 0.05]}>
              <cylinderGeometry args={[0.3, 0.36, 3.2, 10]} />
              <meshLambertMaterial color={taken ? '#8d8d8d' : '#c0392b'} />
            </mesh>
          ))}
          <mesh position={[0, 3.75, 0]}>
            <boxGeometry args={[4.4, 0.36, 0.6]} />
            <meshLambertMaterial color={taken ? '#8d8d8d' : '#a93226'} />
          </mesh>
          <mesh position={[0, 3.25, 0]}>
            <boxGeometry args={[3.4, 0.26, 0.5]} />
            <meshLambertMaterial color={taken ? '#8d8d8d' : '#a93226'} />
          </mesh>
        </>
      )}
      {style === 'ring' && (
        <mesh position={[0, 2.6, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[1.6, 0.28, 8, 20]} />
          <meshLambertMaterial color={stone} />
        </mesh>
      )}

      {/* 封印のしるし */}
      <group ref={seal} position={[0, y + 3.6, 0]}>
        <mesh ref={glow}>
          <torusGeometry args={[0.9, 0.12, 6, 18]} />
          <meshBasicMaterial
            color={taken ? '#7a7a7a' : color}
            transparent
            opacity={lit ? 0.95 : 0.4}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.6, 0.09, 6, 16]} />
          <meshBasicMaterial
            color={taken ? '#7a7a7a' : color}
            transparent
            opacity={lit ? 0.85 : 0.3}
          />
        </mesh>
        {lit && (
          <mesh>
            <sphereGeometry args={[0.34, 12, 10]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        )}
      </group>

      {/* 光の柱(条件を満たしたときだけ) */}
      {lit && (
        <mesh position={[0, 8, 0]}>
          <cylinderGeometry args={[0.7, 1.1, 16, 12, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      <BlobShadow x={0} y={0} z={0} r={3.0} opacity={0.22} />
    </group>
  );
};
