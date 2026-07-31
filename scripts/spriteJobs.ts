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
import { LEAGUE_TOWN } from '../data/adventure/league';
import { PLAYER_APPEARANCES, NPC_SPRITES } from '../data/adventure/people';
import { EVOLUTIONS } from '../data/adventure/evolutions';
import { ALL_LEGENDS } from '../data/adventure/legends';
import { TEAM_SPRITES } from '../data/adventure/team';
import { MONSTER_DEX } from '../data/adventure/monsters';
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
  // 背景の指定は必ず先頭に置く。プロンプトが長いと後半が落ちることがあり、
  // 背景がクロマグリーンでないと背景除去でキャラが溶けるため。
  'SOLID FLAT CHROMA GREEN #19c37d BACKGROUND, one single flat green color, no gradient, no scenery, no floor, no shadow',
  'die-cut sticker illustration',
  'flat 2D vector character design, Sanrio-style kawaii, EXTREMELY SIMPLE shapes, chibi proportions',
  // 目の指定。緩めると、モチーフに「レンズ」等が入った個体で額に第3の目が生える。
  'EXACTLY TWO EYES, one left and one right on the face, same size and shape, level and symmetrical',
  'huge round glossy eyes with one white highlight dot, warm friendly happy expression',
  'bold clean outline, flat solid colors, no gradient shading, no fur texture, no painterly rendering',
  'ONE single character, full body, standing, centered, complete inside the frame',
].join(', ');

/**
 * モンスターは「人ではない生きもの」であることを強く指定する。
 * ここを弱めると、motif の "mascot" という語だけで人型の子どもが出てしまう。
 */
const CREATURE_STYLE =
  'an original ANIMAL CREATURE like a Pokemon-style pocket monster, round plush animal body, ' +
  'stubby paws instead of human hands — NOT a human, no human face, no human skin, no human hair';

/** 主人公・NPCは人物。こちらは逆に「動物ではない」と明示する */
const PEOPLE_STYLE =
  'a friendly human character in a cute storybook game art style, simple flat clothing, rosy cheeks ' +
  '— a person, not an animal';

/**
 * 伝説・幻は「かわいく」しない。圧倒的で荘厳な存在にする。
 * ただし小4対象なので、グロテスク・写実的すぎる描写は除外する。
 */
const LEGEND_STYLE = [
  'SOLID FLAT CHROMA GREEN #19c37d BACKGROUND, one single flat green color, no gradient, no scenery',
  'die-cut sticker illustration',
  // 画風は他のモンスターと同じ「フラットな2Dベクター」に揃える。
  // ここを崩すと、モデルが暗い映画風のコンセプトアートを描き、
  // ①アプリの絵と並ばない ②緑背景が体に回りこんで背景除去で溶ける、の両方が起きる。
  'flat 2D vector character design, bold clean outline, flat solid colors, cel shading with at most two tones',
  'BRIGHT and FULLY COLORED, evenly lit, every part clearly visible',
  'a LEGENDARY BEAST — an original mythical animal creature, majestic and powerful',
  'large imposing body with a long neck and tail, sweeping wings or a crest, curved horns, ' +
    'ornate glowing markings, flowing mane — NOT a human, no human body, no muscles, no bare skin',
  'EXACTLY TWO EYES, one left and one right, same size, level and symmetrical, sharp calm noble gaze',
  'ONE single creature, full body, side-three-quarter view, centered, complete inside the frame',
  'NOT cute, NOT chibi, NOT a baby, no big round kawaii eyes — this is a mythical guardian',
].join(', ');

const NEGATIVE_COMMON =
  'no text, no watermark, no logo, no photorealism, no gradient background, no white background, ' +
  'no multiple characters, no extra creatures, no cropped limbs, no scenery, no ground shadow, ' +
  // 背景に円や板を描かれると、それは緑ではないので背景除去で残り、
  // キャラのうしろに丸い板がついたままになる。名指しで止める。
  'no circle behind the character, no badge, no halo disc, no backdrop shape, no vignette, no frame, ' +
  'no third eye, no extra eyes, no forehead eye, no eyes on the body, no compound eyes, ' +
  'no asymmetric eyes, no lopsided eyes, no winking, no closed eye';

const NEGATIVE = `no human, no child, no person, no human face, no human skin, ${NEGATIVE_COMMON}`;
const NEGATIVE_PEOPLE = `no animal ears, no tail, no snout, no monster, ${NEGATIVE_COMMON}`;
// 伝説は「暗い実写風のコンセプトアート」に流れやすいので、そこを名指しで止める。
// 人型も止める(止めないと筋肉質の人間の怪物が出て、小4向けとして不適になる)。
const NEGATIVE_LEGEND =
  'no chibi, no baby, no plush toy, no gore, no blood, no horror, ' +
  'no human, no humanoid, no man, no muscles, no bare skin, no armor-clad warrior, ' +
  'no dark silhouette, no black shape, no backlighting, no rim light, no monochrome, ' +
  'no dark background, no misty atmosphere, no smoke, no painterly brush strokes, ' +
  `${NEGATIVE_COMMON}`;

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

  // ---- 進化後のすがた ----
  // 進化前と同系統に見えるよう、タイプの色と「進化前の名前」を手がかりに渡す。
  for (const e of EVOLUTIONS) {
    const base = MONSTER_DEX.find(m => m.subtopic === e.subtopic);
    if (!base) continue;
    const el = ELEMENTS[base.type];
    jobs.push({
      out: `monsters/evo-${base.id.replace('mon-', '')}`,
      cutout: true,
      size: 512,
      seed: nextSeed(),
      prompt: [
        CREATURE_STYLE,
        BASE_STYLE,
        // 進化後は一段かっこよく。ただし怖くはしない。
        'EVOLVED FORM: larger, stronger and cooler than its baby form, confident heroic stance, ' +
          'simple stylized armor or flowing accents, still rounded and friendly, never scary',
        `creature concept: ${e.motif}`,
        tint(el.color),
        'front view',
        `NEGATIVE: ${NEGATIVE}`,
      ].join('. '),
    });
  }

  // ---- 伝説・幻 ----
  for (const l of ALL_LEGENDS) {
    const el = ELEMENTS[l.type];
    jobs.push({
      out: `monsters/${l.id}`,
      cutout: true,
      size: 768,
      seed: nextSeed(),
      prompt: [
        LEGEND_STYLE,
        `legendary creature concept: ${l.motif}`,
        tint(el.color),
        `NEGATIVE: ${NEGATIVE_LEGEND}`,
      ].join('. '),
    });
  }

  // ---- テキトウ団 ----
  for (const t of TEAM_SPRITES) {
    jobs.push({
      out: `npc/${t.id}`,
      cutout: true,
      size: 512,
      seed: nextSeed(),
      prompt: [
        BASE_STYLE,
        PEOPLE_STYLE,
        t.motif,
        'viewed from the front, facing the viewer',
        `NEGATIVE: ${NEGATIVE_PEOPLE}`,
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
  for (const t of [...TOWNS, LEAGUE_TOWN]) {
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
