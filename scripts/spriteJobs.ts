/**
 * spriteJobs.ts — スプライト生成ジョブの一覧を、実データから決定的に組み立てる。
 *
 * scripts/build-sprite-manifest.mjs が esbuild でこのファイルをバンドルして実行し、
 * scripts/sprite-manifest.json を書き出す。gen-sprites.mjs はその JSON だけを読む。
 * (画像生成側に日本語のドメイン知識を持ち込まないための分離)
 */

import { ALL_MONSTERS } from '../data/adventure/monsters';
import { ELEMENTS } from '../data/adventure/elements';
import { TOWNS } from '../data/adventure/towns';
import { PLAYER_APPEARANCES, NPC_SPRITES } from '../data/adventure/people';
import type { ArtTier } from '../data/adventure/adventureTypes';

export interface SpriteJob {
  /** 出力先(public/assets/adventure/ からの相対パス。拡張子なし) */
  out: string;
  prompt: string;
  /** 背景除去をするか(キャラは true、テクスチャは false) */
  cutout: boolean;
  size: number;
  seed: number;
}

/**
 * 全生成で共有する画風。catwars で「絵画的リアリズム→フラットなマスコット」に
 * 転換して成功した指定をベースに、本作向けに調整している。
 * ここを崩すと画風がばらけるので、系統ごとの差分は MOTIF 側だけで付ける。
 */
const BASE_STYLE = [
  'flat 2D vector character design, Sanrio-style kawaii',
  'EXTREMELY SIMPLE shapes, chibi proportions, big rounded head, tiny body, distinctive readable silhouette',
  'huge simple round glossy eyes with a single white highlight dot, both eyes identical size and perfectly symmetrical',
  'warm friendly happy expression, soft rounded silhouette',
  'bold clean uniform outline, flat solid colors, cel shading with at most one flat shadow tone',
  'ZERO gradient shading, ZERO fur or hair texture, ZERO realistic anatomy, ZERO painterly rendering',
  'full body, standing, centered, complete character inside the frame',
  // 背景は必ずクロマグリーン。ここが守られないと背景除去でキャラが溶けるため、
  // 先頭と末尾の両方で指定し、生成側で検証もしている(gen-sprites.mjs)。
  'die-cut sticker illustration placed on a COMPLETELY PLAIN SOLID chroma green (#19c37d) background',
  'the background is one single flat green color with no gradient, no pattern, no scenery, no floor, no shadow',
].join(', ');

/**
 * モンスターは「人ではない生きもの」であることを強く指定する。
 * ここを弱めると、motif の "mascot" という語だけで人型の子どもが出てしまう。
 */
const CREATURE_STYLE = [
  'an original imaginary ANIMAL CREATURE, like a Pokemon-style pocket monster',
  'it has a round plush animal body with a big head, stubby round paws instead of human hands, and stubby legs',
  'absolutely NOT a human: no human face, no human child, no human skin, no human hair, no human body',
].join(', ');

/** 主人公・NPCは人物。こちらは逆に「動物ではない」と明示する */
const PEOPLE_STYLE =
  'a friendly human character in a cute storybook game art style, simple flat clothing, rosy cheeks — a person, not an animal, not a creature';

const NEGATIVE_COMMON = [
  'no text, no letters, no numbers as decoration, no watermark, no signature, no logo',
  'no photorealism, no semi-realistic shading, no painterly digital art, no gradient shading',
  'no detailed fur or hair texture, no scary face, no sharp fangs, no blood, no gore',
  'no horror, no creepy, no dark atmosphere, no furrowed eyebrows, no angry glare',
  'no multiple characters, no cropped limbs, no busy background, no scenery, no shadow on the ground',
  'no asymmetric eyes, no winking, no missing eye',
].join(', ');

const NEGATIVE = [
  'no human, no human child, no person, no boy, no girl, no human face, no human hands, no human skin, no human hair',
  'no white background, no grey background, no gradient background',
  NEGATIVE_COMMON,
].join(', ');

const NEGATIVE_PEOPLE = [
  'no animal ears, no tail, no snout, no fursona, no monster',
  'no white background, no grey background, no gradient background',
  NEGATIVE_COMMON,
].join(', ');

/** 見た目グレードごとの追加指定。難易度が上がるほど「かっこいい」方向へ寄せる。 */
const TIER_STYLE: Record<ArtTier, string> = {
  baby: 'baby-like tiny mascot, extra round and squishy, pastel colors, no weapons, no armor, utterly harmless and adorable',
  brave: 'slightly adventurous mascot, small scarf or tiny cape and a simple round accessory, cheerful and plucky, still very round and cute',
  knight: 'cool heroic mascot, simple stylized armor plates and a small cape, confident brave smile, still chibi and round, never scary',
  dragon:
    'cool cute chibi dragon-like creature, small rounded wings and a stubby tail, simple smooth plating, sparkling determined eyes, heroic and impressive but still round and friendly, absolutely not scary or grotesque',
};

const tint = (hex: string) => `dominant color palette around ${hex}`;

let seedCounter = 1000;
const nextSeed = () => (seedCounter += 7);

export const buildJobs = (): SpriteJob[] => {
  const jobs: SpriteJob[] = [];

  // ---- モンスター(151体 + ボス14体) ----
  for (const m of ALL_MONSTERS) {
    const el = ELEMENTS[m.type];
    jobs.push({
      out: `monsters/${m.id}`,
      cutout: true,
      size: 512,
      seed: nextSeed(),
      prompt: [
        CREATURE_STYLE,
        BASE_STYLE,
        TIER_STYLE[m.tier],
        // motif 側の "mascot" は人型を誘発するので creature に寄せる
        `creature concept: ${m.motif.replace(/\bmascot\b/g, 'animal creature')}`,
        tint(el.color),
        'front view',
        `NEGATIVE: ${NEGATIVE}`,
      ].join('. '),
    });
  }

  // ---- 主人公 ----
  for (const p of PLAYER_APPEARANCES) {
    for (const dir of ['front', 'back', 'side'] as const) {
      jobs.push({
        out: `player/${p.id}-${dir}`,
        cutout: true,
        size: 512,
        seed: nextSeed(),
        prompt: [
          BASE_STYLE,
          PEOPLE_STYLE,
          'a cheerful 10-year-old elementary school child adventurer, chibi proportions with a big round head',
          p.motif,
          dir === 'front'
            ? 'viewed from the front, facing the viewer, waving'
            : dir === 'back'
              ? 'viewed from directly behind, back of the head and backpack visible, walking away'
              : 'viewed from the side in profile, walking',
          `NEGATIVE: ${NEGATIVE_PEOPLE}`,
        ].join('. '),
      });
    }
  }

  // ---- NPC・トレーナー ----
  for (const n of NPC_SPRITES) {
    jobs.push({
      out: `npc/${n.id}`,
      cutout: true,
      size: 512,
      seed: nextSeed(),
      prompt: [
        BASE_STYLE,
        PEOPLE_STYLE,
        n.motif,
        'viewed from the front, facing the viewer',
        `NEGATIVE: ${NEGATIVE_PEOPLE}`,
      ].join('. '),
    });
  }

  // ---- フィールドのテクスチャ(タイル可能なパターン) ----
  const textureBase =
    'seamless tileable repeating texture, flat 2D vector art, simple stylized game texture, top-down view, ' +
    'soft cel-shaded, clean flat colors, low detail, cute storybook style, no characters, no text, no watermark, ' +
    'evenly lit with no strong shadows and no vignette';
  for (const t of TOWNS) {
    jobs.push({
      out: `terrain/${t.biome}-ground`,
      cutout: false,
      size: 512,
      seed: nextSeed(),
      prompt: `${textureBase}. ${t.groundTexturePrompt}`,
    });
  }

  // 同じ biome の町があるとテクスチャが重複するので、out で一意化する
  const seen = new Set<string>();
  return jobs.filter(j => {
    if (seen.has(j.out)) return false;
    seen.add(j.out);
    return true;
  });
};
