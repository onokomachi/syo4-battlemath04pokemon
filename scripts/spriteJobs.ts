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
 * プロンプトの組み立て方について。
 *
 * Pollinations(flux)は長いプロンプトの後半を落とす。1500字ほど書いていた
 * ときは、末尾に置いた motif と色指定がまるごと無視され、どのモンスターも
 * 同じ「丸っこい白い動物」になっていた。
 *
 * そこで並び順を
 *   ① 背景(抜けないと使えない) → ② 何を描くか(motif) → ③ 画風 → ④ 除外
 * に固定し、全体を700字前後に切りつめてある。②を前に出すのが要点。
 */
const BG = 'SOLID FLAT CHROMA GREEN #19c37d BACKGROUND, one flat green color, nothing else behind the character';

const EYES = 'EXACTLY TWO EYES, one left one right, same size, level and symmetrical';

/** 全生成で共有する下地。ここだけは崩さない(画風がばらけるため) */
const ART_STYLE =
  'flat 2D vector die-cut sticker illustration, bold clean outline, flat solid colors';

/** ふつうのモンスター(151体+ボス14体+進化44体)の画風 */
const MON_STYLE = `${ART_STYLE}, Sanrio-style kawaii, chibi proportions, huge round glossy eyes`;

/** 人物の画風。モンスターほど丸くはしない。 */
const HUMAN_STYLE = `${ART_STYLE}, cute storybook game art, chibi proportions, big friendly eyes`;

/** 主人公・NPCは人物。こちらは逆に「動物ではない」と明示する */
const PEOPLE_STYLE =
  'a friendly human character in a cute storybook game art style, simple flat clothing, rosy cheeks ' +
  '— a person, not an animal';

/**
 * 伝説・幻は「かわいく」しない。圧倒的で荘厳な存在にする。
 * ただし小4対象なので、グロテスク・写実的すぎる描写は除外する。
 */
const LEGEND_STYLE =
  'a HUGE LEGENDARY MYTHICAL BEAST, imposing and majestic, regal and powerful, ' +
  'bold cel-shaded anime illustration, bright saturated colors, clean outline, evenly lit, ' +
  'NOT cute, NOT chibi, NOT a plush toy, NOT a round mascot, no kawaii face';

const NEG_BASE =
  'no text, no watermark, no scenery, no floor, no ground shadow, no circle or plate behind it, ' +
  'no multiple characters, no cropped limbs, ' +
  'no third eye, no extra eyes, no forehead eye, no compound eyes, no asymmetric eyes, no closed eye';

const NEGATIVE = `no human, no person, no human face, ${NEG_BASE}`;
const NEGATIVE_PEOPLE = `no animal ears, no tail, no snout, no monster, ${NEG_BASE}`;
const NEGATIVE_LEGEND =
  `no chibi, no baby animal, no plush toy, no round mascot, no kawaii, ` +
  `no human, no humanoid, no muscles, no bare skin, no gore, ` +
  `no dark silhouette, no backlighting, no monochrome, ${NEG_BASE}`;

/** 見た目グレードごとの追加指定。難易度が上がるほど「かっこいい」方向へ寄せる。 */
const TIER_STYLE: Record<ArtTier, string> = {
  baby: 'a tiny round baby mascot, pastel, no armor, utterly harmless',
  brave: 'wearing a small scarf or tiny cape, cheerful and plucky, still round',
  knight: 'wearing simple stylized armor plates and a small cape, brave, still round',
  dragon: 'a chibi dragon with small rounded wings and a stubby tail, heroic but friendly, never scary',
};

const tint = (hex: string) => `colored mainly ${hex}`;

let seedCounter = 1000;
const nextSeed = () => (seedCounter += 7);

export const buildJobs = (): SpriteJob[] => {
  const jobs: SpriteJob[] = [];

  // ---- モンスター(151体 + ボス14体) ----
  // ALL_MONSTERS には伝説・幻も入っているが、あれは画風が別なので必ず外す。
  // 外し忘れると、末尾の重複除去(先勝ち)でチビ可愛い版のほうが採用され、
  // 伝説がただの丸い動物になる。
  for (const m of ALL_MONSTERS.filter(x => !x.rarity)) {
    const el = ELEMENTS[m.type];
    jobs.push({
      out: `monsters/${m.id}`,
      cutout: true,
      size: 512,
      seed: nextSeed(),
      prompt: [
        BG,
        // motif 側の "mascot" は人型を誘発するので creature に寄せる
        m.motif.replace(/\bmascot\b/g, 'animal creature'),
        tint(el.color),
        'an original Pokemon-style pocket monster, an animal creature, not a human',
        TIER_STYLE[m.tier],
        MON_STYLE,
        EYES,
        'ONE character, full body, front view, centered',
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
        BG,
        e.motif,
        tint(el.color),
        // 進化後は一段かっこよく。ただし怖くはしない。
        'an EVOLVED Pokemon-style pocket monster, bigger and cooler than its baby form, ' +
          'confident heroic stance, still rounded and friendly, never scary',
        MON_STYLE,
        EYES,
        'ONE character, full body, front view, centered',
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
        BG,
        l.motif,
        tint(el.color),
        LEGEND_STYLE,
        EYES,
        'ONE creature, full body, three-quarter view, centered',
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
        BG,
        t.motif,
        PEOPLE_STYLE,
        HUMAN_STYLE,
        EYES,
        'ONE character, full body, viewed from the front, facing the viewer, centered',
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
          BG,
          'a cheerful 10-year-old elementary school child adventurer, chibi proportions with a big round head',
          p.motif,
          PEOPLE_STYLE,
          HUMAN_STYLE,
          EYES,
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
        BG,
        n.motif,
        PEOPLE_STYLE,
        HUMAN_STYLE,
        EYES,
        'ONE character, full body, viewed from the front, facing the viewer, centered',
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
