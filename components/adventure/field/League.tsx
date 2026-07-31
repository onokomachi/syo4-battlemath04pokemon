/**
 * League.tsx — ナンバーリーグ「さいごの回廊」の3D。
 *
 * ふだんの町が「四角い野原」なのに対し、ここだけは細長い屋内の一本道にしてある。
 * 見た目のルールを1つだけ守っている ―― 「奥へ行くほど、色が強くなる」。
 *   ・自分の間の床の紋章と、かべの旗が、その相手の色に光る
 *   ・倒した相手の間は明るくなり、扉が開く
 *   ・まだの扉は閉じていて、そこから先へは進めない
 * 小4が地図を見なくても「どこまで来たか」「つぎはどっちか」が分かるようにするため。
 */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BiomeStyle } from '../../../data/adventure/adventureTypes';
import type { LeagueCorridorSpec } from '../../../data/adventure/league';

const WALL_H = 12;
const CEIL_Y = 12.4;

// ------------------------------------------------------------
// かべ
// ------------------------------------------------------------

const Walls: React.FC<{ spec: LeagueCorridorSpec; style: BiomeStyle }> = ({ spec, style }) => {
  const { halfWidth, length } = spec;
  // 柱は 6.5 ごと。等間隔にならべると、歩いたときに「進んでいる」のが分かる。
  const pillarZ = useMemo(() => {
    const out: number[] = [];
    for (let z = -length / 2 + 3; z <= length / 2 - 3; z += 6.5) out.push(z);
    return out;
  }, [length]);

  return (
    <group>
      {[-1, 1].map(s => (
        <group key={s}>
          {/* かべ本体 */}
          <mesh position={[s * (halfWidth + 0.6), WALL_H / 2 - 0.5, 0]}>
            <boxGeometry args={[1.2, WALL_H, length]} />
            <meshLambertMaterial color="#514573" />
          </mesh>
          {/* 腰板(足元の帯) */}
          <mesh position={[s * (halfWidth - 0.05), 0.9, 0]}>
            <boxGeometry args={[0.35, 1.8, length]} />
            <meshLambertMaterial color={style.groundAccent} />
          </mesh>
          {/* 柱 */}
          {pillarZ.map((z, i) => (
            <mesh key={i} position={[s * (halfWidth - 0.35), WALL_H / 2 - 1, z]}>
              <boxGeometry args={[1.1, WALL_H - 1, 1.5]} />
              <meshLambertMaterial color="#65578e" />
            </mesh>
          ))}
        </group>
      ))}

      {/* いちばん奥のかべ(チャンピオンの間の むこう) */}
      <mesh position={[0, WALL_H / 2 - 0.5, -length / 2 - 0.6]}>
        <boxGeometry args={[halfWidth * 2 + 2.4, WALL_H, 1.2]} />
        <meshLambertMaterial color="#453a63" />
      </mesh>
      {/* 入口のかべ(うしろ) */}
      <mesh position={[0, WALL_H / 2 - 0.5, length / 2 + 0.6]}>
        <boxGeometry args={[halfWidth * 2 + 2.4, WALL_H, 1.2]} />
        <meshLambertMaterial color="#453a63" />
      </mesh>

      {/* 天井。空が見えないので「屋内だ」と一目で分かる。 */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEIL_Y, 0]}>
        <planeGeometry args={[halfWidth * 2 + 2.4, length + 2.4]} />
        <meshLambertMaterial color="#372e52" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// ------------------------------------------------------------
// 部屋(床の紋章・旗・かがり火)
// ------------------------------------------------------------

const Brazier: React.FC<{ x: number; z: number; color: string; lit: boolean }> = ({
  x, z, color, lit,
}) => {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(state => {
    if (!flame.current || !lit) return;
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 7 + x) * 0.13 + Math.sin(t * 11.3) * 0.06;
    flame.current.scale.set(s, s * 1.15, s);
  });
  return (
    <group position={[x, 0, z]}>
      {/* 台 */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.16, 0.26, 3.2, 8]} />
        <meshLambertMaterial color="#6f6294" />
      </mesh>
      <mesh position={[0, 3.4, 0]}>
        <cylinderGeometry args={[0.75, 0.42, 0.7, 10]} />
        <meshLambertMaterial color="#847799" />
      </mesh>
      {/* 炎 */}
      <mesh ref={flame} position={[0, 4.15, 0]}>
        <sphereGeometry args={[0.55, 10, 8]} />
        <meshBasicMaterial color={lit ? color : '#6b5f8f'} transparent opacity={lit ? 0.95 : 0.6} />
      </mesh>
      {lit && (
        <>
          <mesh position={[0, 4.15, 0]}>
            <sphereGeometry args={[1.15, 10, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
          </mesh>
          <pointLight position={[0, 4.4, 0]} color={color} intensity={9} distance={22} decay={2} />
        </>
      )}
    </group>
  );
};

const Room: React.FC<{ spec: LeagueCorridorSpec; z: number; color: string; cleared: boolean }> = ({
  spec, z, color, cleared,
}) => {
  const seal = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (seal.current) seal.current.rotation.z += dt * (cleared ? 0.28 : 0.09);
    if (seal.current) {
      const m = seal.current.material as THREE.MeshBasicMaterial;
      m.opacity = cleared
        ? 0.85
        : 0.42 + Math.sin(state.clock.elapsedTime * 1.6) * 0.14;
    }
  });

  const r = Math.min(spec.halfWidth - 1.2, 7.6);

  return (
    <group position={[0, 0, z]}>
      {/* 床の紋章 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[r, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh ref={seal} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[r * 0.62, r * 0.78, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[r - 0.5, r, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} />
      </mesh>

      {/* かがり火(両かべ)。倒すと ともる。 */}
      <Brazier x={-spec.halfWidth + 1.4} z={-3.5} color={color} lit={cleared} />
      <Brazier x={spec.halfWidth - 1.4} z={-3.5} color={color} lit={cleared} />
      <Brazier x={-spec.halfWidth + 1.4} z={3.5} color={color} lit={cleared} />
      <Brazier x={spec.halfWidth - 1.4} z={3.5} color={color} lit={cleared} />

      {/* 旗(相手の色) */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * (spec.halfWidth - 0.1), 7.4, 0]} rotation={[0, s * Math.PI / 2, 0]}>
          <planeGeometry args={[5.6, 6.4]} />
          <meshBasicMaterial color={color} transparent opacity={cleared ? 0.9 : 0.55} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

// ------------------------------------------------------------
// 扉
// ------------------------------------------------------------

const Gate: React.FC<{ spec: LeagueCorridorSpec; z: number; color: string; open: boolean }> = ({
  spec, z, color, open,
}) => {
  const doorL = useRef<THREE.Mesh>(null);
  const doorR = useRef<THREE.Mesh>(null);
  const w = spec.halfWidth - 0.6;   // 扉1枚ぶんの横幅
  const H = 9.5;

  // 開いた扉は、かべの中へすべりこんだように 横へどける
  useFrame((_, dt) => {
    const target = open ? w : w / 2;
    for (const d of [doorL.current, doorR.current]) {
      if (!d) continue;
      const s = Math.sign(d.position.x || 1);
      d.position.x += (s * target - d.position.x) * Math.min(1, dt * 3.2);
    }
  });

  return (
    <group position={[0, 0, z]}>
      {/* 門がまえ */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * (spec.halfWidth - 0.2), (H + 1) / 2, 0]}>
          <boxGeometry args={[1.6, H + 1, 2.2]} />
          <meshLambertMaterial color="#7566ab" />
        </mesh>
      ))}
      <mesh position={[0, H + 0.9, 0]}>
        <boxGeometry args={[spec.halfWidth * 2 + 1.2, 1.8, 2.4]} />
        <meshLambertMaterial color="#7566ab" />
      </mesh>
      {/* まぐさの紋章 */}
      <mesh position={[0, H + 0.9, 1.3]}>
        <ringGeometry args={[0.7, 1.15, 6]} />
        <meshBasicMaterial color={color} transparent opacity={open ? 0.95 : 0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* 扉(2枚びらき) */}
      <mesh ref={doorL} position={[-w / 2, H / 2, 0]}>
        <boxGeometry args={[w, H, 0.7]} />
        <meshLambertMaterial color={open ? '#5a4f7d' : '#9182d4'} />
      </mesh>
      <mesh ref={doorR} position={[w / 2, H / 2, 0]}>
        <boxGeometry args={[w, H, 0.7]} />
        <meshLambertMaterial color={open ? '#5a4f7d' : '#9182d4'} />
      </mesh>

      {/* 閉じているあいだは、しきいが赤く光って「行き止まり」と伝える */}
      {!open && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 1.6]}>
          <planeGeometry args={[spec.halfWidth * 2 - 1, 0.7]} />
          <meshBasicMaterial color="#f43f5e" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}
      {open && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <planeGeometry args={[spec.halfWidth * 2 - 1, 1.1]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

// ------------------------------------------------------------
// 全体
// ------------------------------------------------------------

export const LeagueCorridor: React.FC<{ spec: LeagueCorridorSpec; style: BiomeStyle }> = ({
  spec, style,
}) => (
  <group>
    <Walls spec={spec} style={style} />

    {/* まん中の赤いじゅうたん。まっすぐ奥へ ―― という道しるべ。 */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[5.2, spec.length]} />
      <meshBasicMaterial color="#8c2f4a" transparent opacity={0.55} depthWrite={false} />
    </mesh>

    {spec.rooms.map((r, i) => (
      <Room key={i} spec={spec} z={r.z} color={r.color} cleared={r.cleared} />
    ))}
    {spec.gates.map((g, i) => (
      <Gate key={i} spec={spec} z={g.z} color={g.color} open={g.open} />
    ))}
  </group>
);

export default LeagueCorridor;
