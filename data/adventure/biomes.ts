/**
 * biomes.ts — 14のフィールドの見た目(色・光・霧・置くもの)。
 *
 * 3D側はここの値だけを見て地形・空・ライティングを組み立てるので、
 * 新しい町を足すときは BIOME_STYLES に1行足せばよい。
 */

import type { Biome, BiomeStyle } from './adventureTypes';

export const BIOME_STYLES: Record<Biome, BiomeStyle> = {
  meadow: {
    ground: '#7cc267', groundAccent: '#96d47f', grass: '#4e9e46',
    skyTop: '#4aa3e8', skyBottom: '#cdeaff',
    fog: '#cfe9ff', fogDensity: 0.012,
    sun: '#fff4d6', sunIntensity: 1.35, ambient: '#bcd9ff', ambientIntensity: 0.75,
    props: ['tree', 'flower', 'rock'], water: false,
  },
  highland: {
    ground: '#a8c46a', groundAccent: '#c2d886', grass: '#7fa84a',
    skyTop: '#3f92dd', skyBottom: '#e2f2ff',
    fog: '#dcefff', fogDensity: 0.010,
    sun: '#fff8e2', sunIntensity: 1.45, ambient: '#c6e2ff', ambientIntensity: 0.8,
    props: ['windmill', 'flower', 'rock'], water: false,
  },
  quarry: {
    ground: '#b9a894', groundAccent: '#cdbfa9', grass: '#8f9f5e',
    skyTop: '#5f9ed6', skyBottom: '#f0e3cf',
    fog: '#ead9c2', fogDensity: 0.016,
    sun: '#ffeccb', sunIntensity: 1.3, ambient: '#d8c9b4', ambientIntensity: 0.75,
    props: ['rock', 'pillar'], water: false,
  },
  ruins: {
    ground: '#cfc4a6', groundAccent: '#e0d8bd', grass: '#9aab63',
    skyTop: '#59a8e0', skyBottom: '#ffeecd',
    fog: '#f2e4c6', fogDensity: 0.014,
    sun: '#fff0cd', sunIntensity: 1.4, ambient: '#e6d9bd', ambientIntensity: 0.8,
    props: ['pillar', 'rock', 'flower'], water: false,
  },
  lake: {
    ground: '#8fce9b', groundAccent: '#a9dcb2', grass: '#54a86e',
    skyTop: '#3fa6e8', skyBottom: '#d6f2ff',
    fog: '#d3f0ff', fogDensity: 0.013,
    sun: '#f2fbff', sunIntensity: 1.3, ambient: '#bfe6ff', ambientIntensity: 0.9,
    props: ['tree', 'flower', 'rock'], water: true,
  },
  falls: {
    ground: '#7fb98c', groundAccent: '#9bcf9f', grass: '#3f9161',
    skyTop: '#3d9ada', skyBottom: '#cfeeff',
    fog: '#d8f1ff', fogDensity: 0.020,
    sun: '#eaf9ff', sunIntensity: 1.2, ambient: '#b8e2ff', ambientIntensity: 0.95,
    props: ['pine', 'rock', 'crystal'], water: true,
  },
  fog: {
    ground: '#8fa08a', groundAccent: '#a5b49f', grass: '#5f7a5c',
    skyTop: '#8fa7b8', skyBottom: '#dfe8ee',
    fog: '#dde7ec', fogDensity: 0.045,
    sun: '#e8eef2', sunIntensity: 0.85, ambient: '#cdd8de', ambientIntensity: 1.0,
    props: ['pine', 'mushroom', 'rock'], water: false,
  },
  workshop: {
    ground: '#a89170', groundAccent: '#c0a983', grass: '#8a9a52',
    skyTop: '#e0954a', skyBottom: '#ffdca8',
    fog: '#f5d9ae', fogDensity: 0.018,
    sun: '#ffd9a0', sunIntensity: 1.25, ambient: '#e8c79b', ambientIntensity: 0.85,
    props: ['gear', 'lamp', 'rock'], water: false,
  },
  tile: {
    ground: '#9fd0a8', groundAccent: '#bde0bf', grass: '#59a866',
    skyTop: '#48a9e6', skyBottom: '#dbf3ff',
    fog: '#ddf1ff', fogDensity: 0.011,
    sun: '#fff8e6', sunIntensity: 1.4, ambient: '#c8e6ff', ambientIntensity: 0.8,
    props: ['flower', 'rock', 'tree'], water: false,
  },
  cape: {
    ground: '#e3d7a8', groundAccent: '#f0e7c2', grass: '#8fb96a',
    skyTop: '#2f9fe0', skyBottom: '#ffe9c0',
    fog: '#e8f4ff', fogDensity: 0.014,
    sun: '#ffe6b8', sunIntensity: 1.45, ambient: '#c9e8ff', ambientIntensity: 0.9,
    props: ['pine', 'rock', 'flower'], water: true,
  },
  sweets: {
    ground: '#f4c9d9', groundAccent: '#fbdfe9', grass: '#e08bb2',
    skyTop: '#ef8fb8', skyBottom: '#fff0f6',
    fog: '#ffe3ef', fogDensity: 0.013,
    sun: '#fff2f7', sunIntensity: 1.35, ambient: '#ffd9e8', ambientIntensity: 0.9,
    props: ['cake', 'flower', 'lamp'], water: false,
  },
  clock: {
    ground: '#a99cc4', groundAccent: '#c0b4d8', grass: '#7a6ba3',
    skyTop: '#5b4a9e', skyBottom: '#e3d6ff',
    fog: '#ded2f5', fogDensity: 0.020,
    sun: '#f0e6ff', sunIntensity: 1.1, ambient: '#cfc2ee', ambientIntensity: 0.95,
    props: ['gear', 'lamp', 'pillar'], water: false,
  },
  desert: {
    ground: '#e8cf95', groundAccent: '#f3e0b0', grass: '#c2b463',
    skyTop: '#f0a54c', skyBottom: '#ffe6b3',
    fog: '#ffe6bb', fogDensity: 0.017,
    sun: '#ffdca4', sunIntensity: 1.5, ambient: '#f0d5a6', ambientIntensity: 0.85,
    props: ['cactus', 'pillar', 'rock'], water: false,
  },
  // ナンバーリーグの回廊。屋内なので空はほとんど見えず、
  // 松明の色の光と濃い霧で「奥へ進むほど緊張する」空気にする。
  //
  // 色をここまで明るくしてあるのは、地面が
  // 「素材の色 × 頂点カラー × テクスチャ」の3重がけで暗くなるため。
  // 実際に画面に出る床は、この値よりずっと沈んだ紫になる。
  league: {
    ground: '#8d7fc0', groundAccent: '#a294d4', grass: '#7a6bb0',
    skyTop: '#1a1430', skyBottom: '#2f2650',
    fog: '#3a2f5c', fogDensity: 0.022,
    sun: '#ffe6bd', sunIntensity: 1.3, ambient: '#b3a4e8', ambientIntensity: 1.2,
    props: ['pillar', 'lamp'], water: false,
  },
  forest: {
    ground: '#5fa05e', groundAccent: '#79b673', grass: '#347a3e',
    skyTop: '#2f8f5e', skyBottom: '#cdeecf',
    fog: '#c8e8cd', fogDensity: 0.028,
    sun: '#e8ffd9', sunIntensity: 1.05, ambient: '#b6ddb9', ambientIntensity: 1.0,
    props: ['tree', 'mushroom', 'flower'], water: false,
  },
};
