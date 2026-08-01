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
  /**
   * 背景に使う色。省略時は緑。
   *
   * 緑色のキャラを緑背景で撮ると、体まで一緒に抜けてしまう(クロマキーの
   * 基本的な失敗)。実際、コケと樹皮でできた緑の鹿は、何度作り直しても
   * 「輪郭が食われている」で弾かれつづけていた。
   * そこで、体の色が緑に寄っているものだけ背景をマゼンタに切りかえる。
   */
  chroma?: 'green' | 'magenta';
}

/**
 * その色が緑に近いか(色相がおよそ 60〜190度)。
 * 近いなら、背景は緑ではなくマゼンタを使う。
 */
const isGreenish = (hex: string): boolean => {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return false;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h >= 60 && h <= 190;
};

/** 背景の指定文を、使う色に合わせて作る */
const bgFor = (chroma: 'green' | 'magenta') =>
  chroma === 'magenta'
    ? 'a die-cut game sprite floating in mid-air on a PURE MAGENTA SCREEN, ' +
      'the entire background is one solid flat chroma magenta #e600b4, chroma key studio shot, ' +
      'magenta empty space above below and all around the character'
    : 'a die-cut game sprite floating in mid-air on a PURE GREEN SCREEN, ' +
      'the entire background is one solid flat chroma green #19c37d, chroma key studio shot, ' +
      'green empty space above below and all around the character';

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
// 「グリーンスクリーン」という言い方が、いちばん強く効く。
// 単に「緑の背景」と書くと、伝説のように「荘厳」「壮大」と指定した絵で
// モデルが勝手に暗い情景を描き、背景が緑でなくなって作り直しになっていた。
const BG =
  'a die-cut game sprite photographed on a PURE GREEN SCREEN, ' +
  'solid flat chroma green #19c37d filling the whole background, chroma key studio shot, ' +
  'nothing at all behind the character';

/** 否定語をいっさい使わない背景指定(伝説用) */
const BG_POSITIVE =
  'a die-cut game sprite floating in mid-air on a PURE GREEN SCREEN, ' +
  'the entire background is one solid flat chroma green #19c37d, chroma key studio shot, ' +
  'green empty space above below and all around the creature';

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
 * 伝説・幻は「かわいく」しない。ただし画風まで変えてはいけない。
 *
 * 一度「壮大な神話の獣」「荘厳」と書いてみたところ、モデルが
 * 西洋ファンタジーの人型(半裸の女神・筋肉質の獣人)を描いた。
 * 小4向けとして不適で、しかも "no humanoid" の除外指定では止まらない。
 *
 * そこで、ほかのモンスターと同じ「ポケモン風の生きもの」という土台は
 * 変えずに、大きさ・シルエット・装飾だけで格を上げる方針にした。
 * 本家の伝説ポケモンも、画風は通常個体と同じで、姿の作りこみだけが違う。
 */
const LEGEND_STYLE =
  'an original Pokemon-style LEGENDARY pocket monster, a giant beast with animal anatomy: ' +
  'four legs with paws or claws, a long tail, a muzzle, scales and fur, tall horns, ' +
  'sharp angular armor plates and glowing ornate runes along its flanks, ' +
  'a fully grown powerful adult creature, dignified and imposing, ' +
  // 明るさを言っておかないと、モデルが夜や洞窟の情景を描いてしまい、
  // 背景が緑でなくなって作り直しに落ちる。
  'brightly lit in clear daylight, light vivid colors, every part clearly visible';

const NEG_BASE =
  // 背景まわりを厚めに書いてある。ここが薄いと、モデルが情景を描いてしまい
  // 背景が緑でなくなって、8回とも作り直しに落ちる。
  'no gradient background, no white background, no dark background, no colored background, ' +
  'no scenery, no landscape, no sky, no clouds, no floor, no ground shadow, no dramatic lighting, ' +
  'no circle or plate behind it, no text, no watermark, no multiple characters, no cropped limbs, ' +
  'no third eye, no extra eyes, no forehead eye, no compound eyes, no asymmetric eyes, no closed eye';

const NEGATIVE = `no human, no person, no human face, ${NEG_BASE}`;
const NEGATIVE_PEOPLE = `no animal ears, no tail, no snout, no monster, ${NEG_BASE}`;
const NEGATIVE_LEGEND =
  // 人型を止める語を厚めに並べてある。1〜2語では止まらず、
  // 半裸の女神や筋肉質の獣人が出てくる。
  'no human, no humanoid, no person, no woman, no man, no girl, no human body, ' +
  'no human face, no breasts, no muscles, no bare skin, no nudity, ' +
  'no goddess, no angel, no fairy, no elf, no warrior, no armor-clad knight, ' +
  'no chibi, no baby animal, no plush toy, no round blob mascot, ' +
  'no gore, no horror, no dark silhouette, no backlighting, no monochrome, ' +
  `no oil painting, no photorealism, ${NEG_BASE}`;

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
      chroma: isGreenish(el.color) ? 'magenta' : 'green',
      prompt: [
        bgFor(isGreenish(el.color) ? 'magenta' : 'green'),
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
      chroma: isGreenish(el.color) ? 'magenta' : 'green',
      prompt: [
        bgFor(isGreenish(el.color) ? 'magenta' : 'green'),
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
      // 伝説だけは「no 〜」を1つも書かない。
      //
      // flux は否定を解さないので、"no human" と書くと human という語が
      // 効いてしまい、かえって人型が出る(実際に半裸の女神と獣人が出た)。
      // 何を描くかだけを、動物であることが疑いようのない言葉で書く。
      // 伝説はつねにマゼンタ背景。大きくて色が濃く、金や深い青緑をまとうため、
      // 緑背景だと体の一部が背景と見なされて食われる。緑で通っていた個体も
      // マゼンタで問題なく抜けるので、条件分岐にせず一律にしてある。
      chroma: 'magenta',
      prompt: [
        bgFor('magenta'),
        l.motif,
        tint(el.color),
        LEGEND_STYLE,
        ART_STYLE,
        'two symmetrical eyes, a proud fierce expression',
        'ONE creature, full body, side three-quarter view, centered in frame',
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
  // 服の色が緑いろのNPC(例: バイコの「緑の服」)は、緑背景だと
  // 服ごと抜けてしまう。個別に上書きできるようにしておく。
  const NPC_CHROMA_OVERRIDE: Record<string, 'green' | 'magenta'> = {
    'master-14': 'magenta', // バイコ(森の守り手、緑の服)
  };
  for (const n of NPC_SPRITES) {
    const chroma = NPC_CHROMA_OVERRIDE[n.id] ?? 'green';
    jobs.push({
      out: `npc/${n.id}`,
      cutout: true,
      size: 512,
      seed: nextSeed(),
      chroma,
      prompt: [
        bgFor(chroma),
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
