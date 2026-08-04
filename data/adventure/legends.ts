/**
 * legends.ts — 伝説のモンスター7体と、幻のモンスター2体。
 *
 * 設計方針:
 *  - **数を絞る**。7タイプに1体ずつ + 地方全体で幻2体。数が増えるほど
 *    「伝説」という言葉が軽くなる。単元ボス14体(マスターのエース)とは
 *    役割をはっきり分けている。
 *  - **出現条件は「その単元を制覇したこと」**。バッジを取っただけでは足りず、
 *    図鑑を埋め、問題で熟達している必要がある。つまり
 *    「その単元を本当に使いこなせた人にだけ姿を見せる」。
 *  - **見た目はかわいくしない**。圧倒的で、荘厳で、かっこいい存在にする。
 *    ただしグロテスク・写実的すぎる描写は避ける(小4対象のため)。
 *  - **倒すと必ず仲間になる**。地方に1体しかいないものを、最後の抽選で
 *    逃がされるのは小4にはつらすぎる。「みとめられた」という演出にする。
 */

import type { ElementId } from './elements';

export interface LegendDef {
  id: string;
  /** 図鑑番号(通常151体・ボスとは別の連番) */
  no: number;
  name: string;
  /** 二つ名 */
  title: string;
  kind: 'legend' | 'mythical';
  type: ElementId;
  /** 祠が置かれる町(伝説はそのタイプの最初の町) */
  townId: string;
  /** 出題に使う単元(そのタイプの全単元) */
  units: string[];
  baseHp: number;
  baseAtk: number;
  level: number;
  /** 図鑑の説明 */
  flavor: string;
  /** 祠の石碑に刻まれた伝承(条件を満たす前でも読める) */
  legendText: string[];
  /** 出現したときのセリフ・演出テキスト */
  awakenText: string[];
  /** 仲間になったときのテキスト */
  joinText: string[];
  /** スプライト生成用のモチーフ(英語) */
  motif: string;
  /** 祠の見た目(3D側で使う) */
  shrine: {
    /** 祠の色 */
    color: string;
    /** 祠の形 */
    style: 'monolith' | 'torii' | 'ring' | 'pillar';
  };
}

// ============================================================
// 伝説 — 7タイプに1体ずつ
// ============================================================

export const LEGENDS: LegendDef[] = [
  {
    id: 'legend-kazu', no: 2001, name: 'ムゲンドラ', title: 'かぎりなき数の王',
    kind: 'legend', type: 'kazu', townId: 'ketaba',
    units: ['大きい数のしくみ', 'がい数'],
    baseHp: 150, baseAtk: 34, level: 45,
    flavor: '一のつぎに十、十のつぎに百 ―― その果てを見ようとした者の前にだけ現れる、黄金の巨龍。',
    legendText: [
      '―― 石碑に、古い文字が きざまれている。',
      '『数に かぎりは ない。』',
      '『一のつぎに十、十のつぎに百。かぞえても かぞえても、終わりは 来ない。』',
      '『その果てを 見ようとした者の前にだけ、金色の翼が ひらく。』',
    ],
    awakenText: [
      '石碑が まばゆく 光った ――',
      'ゴォォォ……!!',
      '空がさけ、黄金のうろこを持つ 巨大な龍が すがたを あらわした！',
      'ムゲンドラ「……よくぞ、ここまで 数えた。」',
      'ムゲンドラ「ならば 見せてみよ。おまえの 数える力を！」',
    ],
    joinText: [
      'ムゲンドラ「……みごとだ。」',
      'ムゲンドラ「数に かぎりが ないように、おまえの のびしろにも かぎりは ない。」',
      'ムゲンドラは、あなたに ついてくることに 決めたようだ！',
    ],
    motif:
      'a big four-legged dragon of black obsidian with glowing golden lava veins, wide leathery wings and flames along its back',
    shrine: { color: '#f5b942', style: 'monolith' },
  },
  {
    id: 'legend-keisan', no: 2002, name: 'カラクリオン', title: 'めぐる歯車の獅子',
    kind: 'legend', type: 'keisan', townId: 'ishikiri',
    units: ['わり算の筆算(÷1けた)', 'わり算の筆算(÷2けた)', '計算のきまり'],
    baseHp: 160, baseAtk: 33, level: 45,
    flavor: '世界じゅうの計算を、たった一頭で回しつづけている鋼の獅子。止まれば すべての数が 狂う。',
    legendText: [
      '―― 石碑に、古い文字が きざまれている。',
      '『世界の計算は、たった一頭の獣が 回している。』',
      '『順じょを まちがえぬ者。手をぬかぬ者。』',
      '『その者のみが、鋼の たてがみに ふれることを ゆるされる。』',
    ],
    awakenText: [
      '石碑の奥で、無数の歯車が 回りはじめた ――',
      'ガコン……ガコン……ゴゴゴゴ!!',
      '鋼のたてがみを持つ 巨大な獅子が、地の底から せりあがってきた！',
      'カラクリオン「順じょを たがえぬか。手を ぬかぬか。」',
      'カラクリオン「―― ためさせて もらおう！」',
    ],
    joinText: [
      'カラクリオン「よかろう。おまえの手順に、くるいは なかった。」',
      'カラクリオン「これよりは、おまえの計算が わたしの歯車だ。」',
      'カラクリオンは、あなたに ついてくることに 決めたようだ！',
    ],
    motif:
      'a giant four-legged mechanical lion of brass and steel, with a mane of interlocking gears and a glowing amber core in its chest',
    shrine: { color: '#ef6a5a', style: 'pillar' },
  },
  {
    id: 'legend-shosu', no: 2003, name: 'シンカイオウ', title: 'しずくを統べる者',
    kind: 'legend', type: 'shosu', townId: 'shizuku',
    units: ['小数のしくみ', '小数のかけ算とわり算'],
    baseHp: 155, baseAtk: 33, level: 45,
    flavor: '0.1のつぶが 億も兆も集まって できた、深き水の王。1と2のあいだの世界を おさめる。',
    legendText: [
      '―― 石碑に、古い文字が きざまれている。',
      '『1と2のあいだにも、世界は ある。』',
      '『それを 見ようとしなかった者には、ただの すきまに 見えるだろう。』',
      '『こまかさを おそれぬ者にだけ、湖は 底を ひらく。』',
    ],
    awakenText: [
      '湖の水が、うずを まきはじめた ――',
      'ゴボゴボ……ザッパアアアン!!',
      '無数のしずくが 一つに あつまり、水の王が すがたを あらわした！',
      'シンカイオウ「こまかさを おそれぬか。」',
      'シンカイオウ「ならば 沈めてみよ。この深さを！」',
    ],
    joinText: [
      'シンカイオウ「……よい。おまえの目は、すきまを 見のがさなかった。」',
      'シンカイオウ「わが しずくを、おまえに あずけよう。」',
      'シンカイオウは、あなたに ついてくることに 決めたようだ！',
    ],
    motif:
      'a big four-legged dragon of pale blue ice crystal with translucent wings, standing on a frozen rune platform',
    shrine: { color: '#4aa8e0', style: 'ring' },
  },
  {
    id: 'legend-bunsu', no: 2004, name: 'イチノカミ', title: '一を分かつ白銀の神獣',
    kind: 'legend', type: 'bunsu', townId: 'cake',
    units: ['分数'],
    baseHp: 150, baseAtk: 35, level: 46,
    flavor: 'たった一つの「1」を、無限に分けつづける白銀の神獣。分けても分けても、なくならない。',
    legendText: [
      '―― 石碑に、古い文字が きざまれている。',
      '『1は、いくらでも 分けられる。』',
      '『分けても 分けても、1は 1のままで ある。』',
      '『それを 心から 分かった者の前に、白銀の獣は 降りてくる。』',
    ],
    awakenText: [
      '石碑が、まっぷたつに 分かれた ―― いや、分かれてなお 一つのままだ。',
      'シャアアアア……!!',
      '白銀の毛なみを持つ 気高い神獣が、光の中から あらわれた！',
      'イチノカミ「分けても なくならぬものが ある。」',
      'イチノカミ「それを 知る者か どうか ―― たしかめさせて もらおう。」',
    ],
    joinText: [
      'イチノカミ「……その手は、1を こわさなかった。」',
      'イチノカミ「わが半身を、おまえに 分けあたえよう。」',
      'イチノカミは、あなたに ついてくることに 決めたようだ！',
    ],
    motif:
      'a giant white-and-silver nine-tailed fox beast standing on four paws, with pearlescent fur and glowing rings wrapped around its tails',
    shrine: { color: '#e86fae', style: 'torii' },
  },
  {
    id: 'legend-bai', no: 2005, name: 'キョダイオン', title: '倍を司る業火の巨人',
    kind: 'legend', type: 'bai', townId: 'kyoju',
    units: ['倍の見方'],
    baseHp: 170, baseAtk: 32, level: 46,
    flavor: 'ひとつぶの火の粉から、山をのむ炎へ。「何倍か」という考えそのものが 姿を持った者。',
    legendText: [
      '―― 石碑に、古い文字が きざまれている。',
      '『小さきものが 大いなるものに なる。』',
      '『それは まほうではない。「何倍か」を 知ることだ。』',
      '『ひとつぶの 火の粉が、山を のむ。だから 森は これを 封じた。』',
      '『もとにする量を 見あやまらぬ者よ、封を といてみよ。』',
    ],
    awakenText: [
      '巨大樹の根もとの 岩が、まっぷたつに 割れた ――',
      'ゴォオオ……ドオオオン!!',
      '燃える翼を ひろげた 巨人が、地の底から 立ちあがった！',
      'キョダイオン「もとにする量を、見あやまらぬか。」',
      'キョダイオン「……その一点だけを、問う。」',
    ],
    joinText: [
      'キョダイオン「よし。おまえは、くらべ方を まちがえなかった。」',
      'キョダイオン「この炎、持っていくがいい。焼くためでは ない。」',
      'キョダイオン「どれだけ 大きくなれるかを、示すためだ。」',
      'キョダイオンは、あなたに ついてくることに 決めたようだ！',
    ],
    // 絵は手で用意したものを使っている(scripts/manual-sprites.json)。
    // この motif は、作り直すことになったときの手がかりとして残してある。
    motif:
      'a towering fire titan of black obsidian rock with glowing lava cracks, huge flaming wings and two curved horns',
    shrine: { color: '#e8622c', style: 'monolith' },
  },
  {
    id: 'legend-graph', no: 2006, name: 'ジクウオン', title: '時をよむ翼',
    kind: 'legend', type: 'graph', townId: 'kazeoka',
    units: ['折れ線グラフと表', '変わり方調べ'],
    baseHp: 145, baseAtk: 34, level: 45,
    flavor: '過去から未来へ、変わり方の線をたどる翼。この獣の目には、まだ来ていない明日が見えている。',
    legendText: [
      '―― 石碑に、古い文字が きざまれている。',
      '『変わり方を 見つけた者は、まだ 来ていない先を 読める。』',
      '『それは うらないでは ない。しるしを たどる 力だ。』',
      '『空を よむ者よ ―― 風の丘の いただきで 待つ。』',
    ],
    awakenText: [
      '風が ぴたりと やみ、空の色が 変わった ――',
      'ヒュオオオオ……!!',
      '巨大な翼を持つ 天空の獣が、雲を 切りさいて 舞いおりた！',
      'ジクウオン「おまえは 変わり方を 見つけたな。」',
      'ジクウオン「では ―― この先を 読んでみせよ！」',
    ],
    joinText: [
      'ジクウオン「……見えていたか。たしかに。」',
      'ジクウオン「これからの空は、おまえと ともに よもう。」',
      'ジクウオンは、あなたに ついてくることに 決めたようだ！',
    ],
    motif:
      'a giant violet-and-silver bird beast with vast feathered wings, long tail feathers and a sharp crest',
    shrine: { color: '#8f7ae5', style: 'ring' },
  },
  {
    id: 'legend-zukei', no: 2007, name: 'リッタイオン', title: 'かたちを定めし者',
    kind: 'legend', type: 'zukei', townId: 'kakudo',
    units: ['角の大きさ', '面積', '直方体と立方体'],
    baseHp: 165, baseAtk: 33, level: 45,
    flavor: '角も 広さも 立体も、この獣が 定めたかたちに したがっている。世界の骨組みそのもの。',
    legendText: [
      '―― 石碑に、古い文字が きざまれている。',
      '『世界には、かたちが ある。』',
      '『角も 広さも 立体も、はじめは 一頭の獣が 定めたものだ。』',
      '『かたちを 見ぬく目を 持つ者よ、遺跡の おくへ。』',
    ],
    awakenText: [
      '遺跡の柱が、ひとりでに ならびかわった ――',
      'ゴゴゴ……カッ!!',
      '幾何のかたまりでできた 巨大な獣が、光の中に すがたを あらわした！',
      'リッタイオン「かたちを 見ぬく目を 持つと いうか。」',
      'リッタイオン「……ならば、この身で ためすが よい！」',
    ],
    joinText: [
      'リッタイオン「みごと。おまえの目は、かたちの おくまで とどいた。」',
      'リッタイオン「世界の骨組みを、ともに 見にゆこう。」',
      'リッタイオンは、あなたに ついてくることに 決めたようだ！',
    ],
    motif:
      'a big golden armored beast standing on four legs, one solid body plated in smooth geometric panels, a long tail and short blunt horns',
    shrine: { color: '#c9a227', style: 'pillar' },
  },
];

// ============================================================
// 幻 — 地方全体で2体
// ============================================================

export const MYTHICALS: LegendDef[] = [
  {
    id: 'mythical-zero', no: 2101, name: 'ゼロディア', title: '無より来たりし者',
    kind: 'mythical', type: 'kazu', townId: 'kirino',
    units: ['がい数', '大きい数のしくみ', '計算のきまり'],
    baseHp: 180, baseAtk: 38, level: 55,
    flavor: 'すべての数が 消えた場所に、たった一つ 残るもの。だれも その姿を 見たことがない ―― はずだった。',
    legendText: [
      '―― 苔むした石碑。文字は ほとんど 読めない。',
      '『……なにも ない、ということもまた、一つの数である。』',
      '『0を おそれた者は、ここへ たどりつけない。』',
      '『百の すがたを 見た者にのみ、無は ひらかれる。』',
      '(モンスターを 100しゅるい つかまえると、なにかが 起きそうだ……)',
    ],
    awakenText: [
      '霧が、音もなく 晴れた ――',
      '……しん、と 世界から 音が 消えた。',
      '黒曜のような 影が、なにもない空間から にじみ出てくる。',
      'ゼロディア「…………。」',
      'ゼロディア「……なにも ないことを、おまえは こわがらなかったな。」',
    ],
    joinText: [
      'ゼロディア「……いいだろう。」',
      'ゼロディア「無から すべては はじまる。おまえの 旅も また。」',
      'ゼロディアは、音もなく あなたの となりに 立った！',
    ],
    motif:
      'a giant sleek panther-like beast on four paws, deep indigo scales with glowing violet ring markings and a long whip tail',
    shrine: { color: '#4b3f72', style: 'monolith' },
  },
  {
    id: 'mythical-number', no: 2102, name: 'ナンバリオン', title: 'ナンバーランドの創り手',
    kind: 'mythical', type: 'graph', townId: 'tokino',
    units: [
      '大きい数のしくみ', '折れ線グラフと表', 'わり算の筆算(÷1けた)', '角の大きさ',
      '小数のしくみ', 'わり算の筆算(÷2けた)', 'がい数', '計算のきまり', '面積',
      '小数のかけ算とわり算', '分数', '変わり方調べ', '直方体と立方体', '倍の見方',
    ],
    baseHp: 220, baseAtk: 42, level: 65,
    flavor: 'この地方そのものを つくったと言われる存在。14の町、151のいのち ―― そのすべての はじまり。',
    legendText: [
      '―― 時計塔の最上階。文字盤の裏に、小さな石碑が ある。',
      '『この地方を つくった者が いる。』',
      '『その者は 14の町を 置き、151の いのちを 生んだ。』',
      '『すべてを めぐり、すべてを 知り、頂に 立った者。』',
      '『その者の前にだけ ―― 創り手は、みずから 姿を あらわす。』',
      '(チャンピオンに 勝ち、14のバッジを 集め、7体の伝説を 手にした者だけが……)',
    ],
    awakenText: [
      '時計塔の針が、いっせいに 止まった ――',
      'カチ……カチ……ゴォーーーン!!',
      '天井が ひらき、七色の光を まとった 巨大な存在が 降りてきた！',
      'ナンバリオン「よく ここまで 来たね。」',
      'ナンバリオン「14の町。151のいのち。……ぜんぶ、きみが 見つけたものだ。」',
      'ナンバリオン「さいごに、ひとつだけ。」',
      'ナンバリオン「―― この世界を、きみは どこまで 知ったのか。見せてくれ。」',
    ],
    joinText: [
      'ナンバリオン「……ああ。きみは、この世界の すべてを 見たんだね。」',
      'ナンバリオン「ぼくが つくったこの地方は、きみのものだ。」',
      'ナンバリオンは、しずかに あなたの となりに 立った！',
      '―― ナンバーランドの 物語は、ここで ひとつの 区切りを むかえた。',
    ],
    motif:
      'a big iridescent violet dragon with pearlescent scales shifting through rainbow colors and wide feathered-crystal wings',
    shrine: { color: '#a99cc4', style: 'torii' },
  },
];

export const ALL_LEGENDS: LegendDef[] = [...LEGENDS, ...MYTHICALS];

export const getLegend = (id: string): LegendDef | undefined =>
  ALL_LEGENDS.find(l => l.id === id);

/** その町に祠があるか */
export const legendsInTown = (townId: string): LegendDef[] =>
  ALL_LEGENDS.filter(l => l.townId === townId);
