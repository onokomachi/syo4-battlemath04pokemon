/**
 * people.ts — 主人公・博士・ライバル・トレーナー・単元マスター・四天王・チャンピオンの
 * 見た目定義。スプライト生成のプロンプト材料もここに置く。
 *
 * NPCの見た目は使い回す(村人4種・一般トレーナー8種)ことで生成枚数を抑え、
 * 物語上たいせつな人物(マスター14人・四天王・チャンピオン・ライバル)だけ専用絵にしている。
 */

export interface PlayerAppearance {
  id: string;
  label: string;
  motif: string;
}

/** 主人公は男女の2タイプ。名前はゲーム開始時にひらがなで入力する。 */
export const PLAYER_APPEARANCES: PlayerAppearance[] = [
  {
    id: 'boy',
    label: 'おとこのこ',
    motif:
      'a boy with short dark brown hair, a red and white cap, a blue hoodie, short pants, ' +
      'yellow sneakers and a small green backpack',
  },
  {
    id: 'girl',
    label: 'おんなのこ',
    motif:
      'a girl with shoulder-length dark hair tied with a mint ribbon, a white sun hat, ' +
      'a coral pink jacket, a yellow skirt, white sneakers and a small green backpack',
  },
];

export interface NpcSpriteDef {
  id: string;
  motif: string;
}

const villager = (id: string, motif: string): NpcSpriteDef => ({ id: `villager-${id}`, motif });
const trainer = (id: string, motif: string): NpcSpriteDef => ({ id: `trainer-${id}`, motif });
const master = (id: string, motif: string): NpcSpriteDef => ({ id: `master-${id}`, motif });

/** 生成するNPCスプライトの一覧 */
export const NPC_SPRITES: NpcSpriteDef[] = [
  // --- 村人(使い回し) ---
  villager('boy', 'a small cheerful village boy in a green shirt and brown shorts'),
  villager('girl', 'a small cheerful village girl in a yellow dress with pigtails'),
  villager('grandpa', 'a kind round old man with a white beard, a brown vest and a walking stick'),
  villager('grandma', 'a kind round old woman with silver hair in a bun and a lavender apron'),

  // --- 一般トレーナー(使い回し) ---
  trainer('bug', 'a boy in a straw hat and shorts holding a butterfly net, explorer look'),
  trainer('sport', 'a girl in a sporty tracksuit and headband, energetic pose'),
  trainer('scout', 'a boy in a khaki scout uniform with a compass around his neck'),
  trainer('artist', 'a girl in a paint-splattered smock holding a small palette'),
  trainer('chef', 'a round boy in a white chef hat and apron holding a wooden spoon'),
  trainer('diver', 'a girl in a light blue swim jacket with goggles on her forehead'),
  trainer('builder', 'a boy in a yellow hard hat and dungarees holding a folding ruler'),
  trainer('star', 'a girl in a dark blue cloak covered with small stars, holding a telescope'),

  // --- 単元マスター(14人・専用) ---
  master('01', 'a calm elderly teacher in a golden haori with a large abacus on his back'),
  master('02', 'a young woman in a windswept white coat with a kite and a wind vane'),
  master('03', 'a strong young man in a stonecutter apron holding a wide flat chisel'),
  master('04', 'a poised young woman in a marble-white toga holding a huge golden protractor'),
  master('05', 'a serene woman in a flowing aqua kimono with water droplet ornaments'),
  master('06', 'cheerful twin boys in matching blue raincoats standing shoulder to shoulder'),
  master('07', 'a mysterious hooded figure in a soft grey cloak, kind smiling eyes, holding a lantern'),
  master('08', 'a jolly inventor with round goggles, a leather apron and brass gear tools'),
  master('09', 'a broad friendly man in a tiler apron holding a large square tile'),
  master('10', 'a tanned young sailor in a navy jacket and captain cap holding a rope'),
  master('11', 'a smiling pastry chef in a pink chef coat holding a cake knife'),
  master('12', 'a slim clockmaker in a purple vest with a monocle and pocket watch'),
  master('13', 'a desert explorer in a sand-colored cloak with a cube-shaped lantern'),
  master('14', 'a serene guardian woman in a plain green cloak'),

  // --- 物語の人物 ---
  { id: 'prof', motif: 'a friendly professor with round glasses, a white lab coat and wild grey hair, holding a clipboard' },
  { id: 'rival-sora', motif: 'a confident boy with spiky blue-black hair, a white and navy jacket and a smirk' },
  { id: 'rival-mio', motif: 'a confident girl with long orange hair in a high ponytail and a white and red jacket' },
  { id: 'nurse', motif: 'a gentle nurse in a soft pink uniform with a white cap and a small heart badge' },
  { id: 'shop', motif: 'a friendly shopkeeper in a green apron standing behind a small counter, waving' },

  // --- 四天王・チャンピオン ---
  { id: 'elite-01', motif: 'an elegant woman in a starry indigo gown holding a glowing orb of numbers' },
  { id: 'elite-02', motif: 'a burly man in crimson martial arts robes with gear-shaped shoulder guards' },
  { id: 'elite-03', motif: 'a calm woman in a silver-blue dress made of flowing water and cake ribbons' },
  { id: 'elite-04', motif: 'a tall man in emerald armor shaped from geometric plates, holding a staff' },
  { id: 'champion', motif: 'a radiant young champion in a white and gold cape with a crown of seven colored gems' },
];

// ============================================================
// 物語の登場人物(名前とやくわり)
// ============================================================

export const PROFESSOR_NAME = 'スウジはかせ';

/** 主人公が男の子ならミオ、女の子ならソラがライバルになる */
export const RIVALS = {
  boy: { name: 'ミオ', sprite: 'rival-mio' },
  girl: { name: 'ソラ', sprite: 'rival-sora' },
} as const;

export interface EliteDef {
  id: string;
  name: string;
  title: string;
  sprite: string;
  /** 出題に使う単元 */
  units: string[];
  lines: string[];
  afterLines: string[];
}

export const ELITE_FOUR: EliteDef[] = [
  {
    id: 'elite-01',
    name: 'ホシミ',
    title: 'かずの しはい',
    sprite: 'elite-01',
    units: ['大きい数のしくみ', 'がい数', '折れ線グラフと表', '変わり方調べ'],
    lines: [
      'よくここまで来たわね。',
      'わたしは ナンバーリーグ 四天王のひとり、ホシミ。',
      '大きな数と、そのうつりかわり…… 星をよむように 数をよむの。',
      'あなたの目に、その星が見えるかしら？',
    ],
    afterLines: [
      'まぶしいくらい、はっきり見えていたのね。',
      'つぎの間へ おいきなさい。',
    ],
  },
  {
    id: 'elite-02',
    name: 'ゴウキ',
    title: 'けいさんの しはい',
    sprite: 'elite-02',
    units: ['わり算の筆算(÷1けた)', 'わり算の筆算(÷2けた)', '計算のきまり'],
    lines: [
      'ふん、ホシミを やぶったか。',
      'おれは ゴウキ。けいさんに ごまかしは きかねえ。',
      '一けたも まちがえるな。いくぞ！',
    ],
    afterLines: [
      '……みごとだ。ひとつも にげなかったな。',
      '行け。おまえの けいさんは 本物だ。',
    ],
  },
  {
    id: 'elite-03',
    name: 'ユキ',
    title: 'しょうすうと ぶんすうの しはい',
    sprite: 'elite-03',
    units: ['小数のしくみ', '小数のかけ算とわり算', '分数'],
    lines: [
      'ようこそ。ここは 1より 小さな世界。',
      'わたしは ユキ。小数と 分数を あずかっています。',
      '1を こまかく分けたとき、あなたは どこまで 見えるかしら。',
    ],
    afterLines: [
      'こまかいところまで、ちゃんと 見えていたのね。',
      'つぎが さいごの しはいよ。',
    ],
  },
  {
    id: 'elite-04',
    name: 'タイガ',
    title: 'かたちと ばいの しはい',
    sprite: 'elite-04',
    units: ['角の大きさ', '面積', '直方体と立方体', '倍の見方'],
    lines: [
      'おれで さいごだ。',
      'タイガという。かたちと、大きさの ばいを あずかっている。',
      'ここを こえれば、チャンピオンの間だ。……こえてみせろ。',
    ],
    afterLines: [
      'いい目をしている。かたちの おくまで 見ぬいたな。',
      '行け。チャンピオンが 待っている。',
    ],
  },
];

export const CHAMPION = {
  id: 'champion',
  name: 'カズハ',
  title: 'ナンバーランド チャンピオン',
  sprite: 'champion',
  lines: [
    'まってたよ。……本当に、ここまで 来たんだね。',
    'ぼくは カズハ。このナンバーランドの チャンピオンだ。',
    'ぼくが持っているのは、7つのタイプ すべての なかま。',
    'きみが 14の町で 学んだこと、ぜんぶ 見せてほしい。',
    'さあ ―― さいごの バトルを はじめよう！',
  ],
  afterLines: [
    '……まいったな。ぜんぶ、きみの方が 先に見えていた。',
    'ナンバーランドの あたらしい チャンピオンは、きみだ。',
    'でもね、これは おわりじゃない。',
    'きみが これから 出会う 数は、まだ 数えきれないほど あるんだから。',
    'いつでも 会いにおいで。まってるよ。',
  ],
};

export const getNpcSprite = (id: string): string =>
  `${(import.meta as any).env?.BASE_URL ?? '/'}assets/adventure/npc/${id}.png`;

export const getPlayerSprite = (appearance: string, dir: 'front' | 'back' | 'side'): string =>
  `${(import.meta as any).env?.BASE_URL ?? '/'}assets/adventure/player/${appearance}-${dir}.png`;
