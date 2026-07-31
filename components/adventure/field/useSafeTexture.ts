/**
 * useSafeTexture.ts — 画像が無くても落ちないテクスチャ読み込み。
 *
 * スプライトは Pollinations で後から生成する運用なので、まだファイルが
 * 無い状態でも 3D が真っ黒にならないよう、読み込み失敗時は色だけの
 * ダミーテクスチャに差し替える。
 */
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

const makeFallback = (color: string, kind: 'flat' | 'noise'): THREE.Texture => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 64);
  if (kind === 'noise') {
    // 単色べた塗りだと 3D が安っぽく見えるので、軽くムラをつける
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`;
      ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

export const useSafeTexture = (
  url: string,
  fallbackColor = '#8fbf7f',
  fallbackKind: 'flat' | 'noise' = 'noise',
): THREE.Texture => {
  const fallback = useMemo(
    () => makeFallback(fallbackColor, fallbackKind),
    [fallbackColor, fallbackKind],
  );
  const [tex, setTex] = useState<THREE.Texture>(() => cache.get(url) ?? fallback);

  useEffect(() => {
    const hit = cache.get(url);
    if (hit) { setTex(hit); return; }
    let alive = true;
    new THREE.TextureLoader().load(
      url,
      loaded => {
        if (!alive) return;
        loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
        loaded.colorSpace = THREE.SRGBColorSpace;
        cache.set(url, loaded);
        setTex(loaded);
      },
      undefined,
      () => { /* 未生成のときは色だけのテクスチャのままで見た目を保つ */ },
    );
    return () => { alive = false; };
  }, [url]);

  return tex;
};

/** スプライト(透過PNG)用。読み込めないときは透明にせず、色の丸を出す。 */
export const useSpriteTexture = (url: string, tintColor = '#ffffff'): THREE.Texture => {
  const fallback = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = tintColor;
    ctx.beginPath();
    ctx.arc(64, 70, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(50, 62, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(80, 62, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(51, 63, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(81, 63, 6, 0, Math.PI * 2); ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [tintColor]);

  const [tex, setTex] = useState<THREE.Texture>(() => cache.get(url) ?? fallback);

  useEffect(() => {
    const hit = cache.get(url);
    if (hit) { setTex(hit); return; }
    let alive = true;
    new THREE.TextureLoader().load(
      url,
      loaded => {
        if (!alive) return;
        loaded.colorSpace = THREE.SRGBColorSpace;
        // スプライトは拡大されるので、にじみを抑えて輪郭を残す
        loaded.minFilter = THREE.LinearMipmapLinearFilter;
        loaded.magFilter = THREE.LinearFilter;
        loaded.anisotropy = 4;
        cache.set(url, loaded);
        setTex(loaded);
      },
      undefined,
      () => { /* 未生成のあいだは仮のまるいキャラで表示する */ },
    );
    return () => { alive = false; };
  }, [url]);

  return tex;
};
