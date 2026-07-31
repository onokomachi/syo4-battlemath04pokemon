/**
 * towns.ts — ナンバーランド地方の14の町(=14単元)。
 *
 * 町のならびは MATH_CATEGORIES(教科書の学習順)と一致している。ただし
 * 進行は自由で、先生が管理画面でロックした単元の町だけが閉じる。
 *
 * 各町には「村人(その単元のコツを教えてくれる)」「トレーナー2人」「単元マスター」
 * 「かいふく所」「ショップ」がいる。トレーナーの手持ちはその単元のモンスターから
 * 決定的に選ぶので、問題データを足しても手で直す必要はない。
 */

import { MONSTERS_BY_UNIT, BOSS_BY_UNIT } from './monsters';
import { UNIT_TO_ELEMENT } from './elements';
import type { Biome, FieldNpcDef, TownDef } from './adventureTypes';

// ---- フィールド上の定位置 ----
// フィールドは size×size の正方形。プレイヤーは南(z が +)からスタートし、
// 北(z が -)にある道場に単元マスターがいる。
const layout = (size: number) => ({
  spawn: { x: 0, z: size / 2 - 5 },
  nurse: { x: -7, z: size / 2 - 10 },
  shop: { x: 7, z: size / 2 - 10 },
  villager: { x: 0, z: size / 2 - 15 },
  trainerA: { x: -size * 0.26, z: size * 0.05 },
  trainerB: { x: size * 0.28, z: -size * 0.16 },
  master: { x: 0, z: -size / 2 + 9 },
});

interface TownSeed {
  id: string;
  name: string;
  subtitle: string;
  unit: string;
  biome: Biome;
  size: number;
  intro: string[];
  villagerSprite: string;
  villagerLines: string[];
  trainers: Array<{ name: string; sprite: string; lines: string[]; after: string[] }>;
  masterName: string;
  masterSprite: string;
  masterTitle: string;
  masterLines: string[];
  masterAfter: string[];
  ground: string;
}

const SEEDS: TownSeed[] = [
  {
    id: 'ketaba',
    name: 'ケタバ村',
    subtitle: 'はじまりの 数の村',
    unit: '大きい数のしくみ',
    biome: 'meadow',
    size: 46,
    intro: [
      'ナンバーランド地方 ―― ケタバ村。',
      'なだらかな丘に、そろばん玉のかたちの家がならんでいる。',
      'ここは、すべての数が うまれる村だ。',
    ],
    villagerSprite: 'villager-grandpa',
    villagerLines: [
      'おお、たびに出るのか。えらいのう。',
      '大きな数はな、4けたずつ 区切って読むんじゃ。',
      '一・十・百・千 …… そのつぎが「万」。',
      '万の4つとなりが「億」、そのまた4つとなりが「兆」じゃ。',
      '区切りさえ見えれば、どんな大きな数もこわくないぞい。',
    ],
    trainers: [
      {
        name: 'そろばんの ケン', sprite: 'trainer-scout',
        lines: ['お、たびの子だな！', 'ぼくのそろばん玉、いくつに見える？', 'かぞえられるなら、しょうぶだ！'],
        after: ['すごい、パチパチって数えたね！', '大きい数は、区切って読むのがコツだよ。'],
      },
      {
        name: 'カードあそびの ノン', sprite: 'trainer-artist',
        lines: ['数字カードを ならべて あそんでるの。', 'いちばん大きい数を つくるには？', 'わかるなら、しょうぶしましょ！'],
        after: ['大きい位から 大きい数字！ そのとおり。', 'あなた、センスあるわ。'],
      },
    ],
    masterName: 'ソロバン先生',
    masterSprite: 'master-01',
    masterTitle: '大きい数の マスター',
    masterLines: [
      'ようこそ、ケタバ道場へ。',
      'わしは ソロバン。この村で 60年、数をかぞえてきた。',
      '数とはな、大きくなるほど おもしろい。',
      'なぜなら ―― 大きくなっても、しくみは まったく同じだからじゃ。',
      'さあ、その目で たしかめてみなさい！',
    ],
    masterAfter: [
      'ふぉっふぉっ、みごと。',
      '億も兆も、おまえさんには もう ただの数じゃな。',
      'この「ケタバッジ」を 持っていきなさい。',
    ],
    ground: 'a gentle green grassy meadow with small soft grass tufts and tiny white flowers',
  },

  {
    id: 'kazeoka',
    name: 'カゼオカ町',
    subtitle: '風と グラフの 高原',
    unit: '折れ線グラフと表',
    biome: 'highland',
    size: 48,
    intro: [
      'カゼオカ町 ―― 一年じゅう 風がふきぬける高原。',
      '丘のうえには 大きな風車がならび、',
      'そのまわりを 折れ線のような鳥が とんでいる。',
    ],
    villagerSprite: 'villager-girl',
    villagerLines: [
      'ここの風車はね、風の強さを 毎日きろくしてるの。',
      '折れ線グラフは「かわり方」を見るためのグラフ。',
      '線が 急なほど、大きくかわったってこと！',
      '表は「整理する」ため。たてとよこ、両方見るのがコツだよ。',
    ],
    trainers: [
      {
        name: 'かざみの ハル', sprite: 'trainer-star',
        lines: ['ねえ、この折れ線 見て。', 'どこで いちばん 大きくかわった？', '当てられたら、しょうぶしてあげる！'],
        after: ['正解！ かたむきが 急なところ だよね。', '風みたいに するどい目してる。'],
      },
      {
        name: 'きろくがかりの トウマ', sprite: 'trainer-builder',
        lines: ['ぼく、町の記録がかりなんだ。', '二次元表は、たてとよこの 合計が命！', 'たしかめてみるかい？'],
        after: ['合計がぴったり合うと 気もちいいよね。', 'きみ、いい記録がかりになれるよ。'],
      },
    ],
    masterName: 'ミサキ',
    masterSprite: 'master-02',
    masterTitle: '折れ線グラフの マスター',
    masterLines: [
      'いらっしゃい。風の音、聞こえる？',
      'わたしは ミサキ。この高原の 風をよむ人。',
      'グラフはね、数を「絵」にしたもの。',
      '数字のままだと 気づけないことが、線にすると 見えてくる。',
      'さあ、あなたには なにが 見える？',
    ],
    masterAfter: [
      'うん、ちゃんと 見えていたね。',
      'これからは、どんな数字も グラフにしてごらん。',
      '「カゼバッジ」を どうぞ。',
    ],
    ground: 'a windswept highland grass field with pale yellow-green grass and small stones',
  },

  {
    id: 'ishikiri',
    name: 'イシキリ谷',
    subtitle: 'わけて つみあげる 谷',
    unit: 'わり算の筆算(÷1けた)',
    biome: 'quarry',
    size: 52,
    intro: [
      'イシキリ谷 ―― 大きな石を きれいに 切りわける谷。',
      'カン、カン、と つち音がひびいている。',
      'ここでは だれもが「同じ大きさに わけること」を 大切にしている。',
    ],
    villagerSprite: 'villager-boy',
    villagerLines: [
      'ここの石切りはね、ぜったい 上の位からやるんだ。',
      'たてる → かける → ひく → おろす。',
      'この4つを くりかえすだけ。じゅんばんが 命なんだよ。',
      'あ、それと ―― あまりは わる数より 小さくなるからね！',
    ],
    trainers: [
      {
        name: 'いしきりの ゴロ', sprite: 'trainer-builder',
        lines: ['よう、たびの子か。', 'この石、3人で 同じに わけられるか？', 'できるなら、うでくらべだ！'],
        after: ['きれいに わけたな。あまりも ぴったりだ。', 'いい うでを してる。'],
      },
      {
        name: 'パンやの ミナ', sprite: 'trainer-chef',
        lines: ['やきたてのパン、7人で わけたいの。', 'あまったパンは どうする？', 'こたえられたら、しょうぶよ！'],
        after: ['そう、あまりは 切り捨てるときと 切り上げるときがある。', 'ばめんで きめるのよね。'],
      },
    ],
    masterName: 'ゴウ',
    masterSprite: 'master-03',
    masterTitle: 'わり算(÷1けた)の マスター',
    masterLines: [
      'よく来た。おれは ゴウ。この谷の 石切りがしらだ。',
      'わり算はな、力ずくじゃ できねえ。',
      'たてる、かける、ひく、おろす。',
      'この4つを、あわてずに くりかえす。それだけだ。',
      '……見せてもらうぞ、おまえの てぎわを！',
    ],
    masterAfter: [
      'は、みごとだ。手が まったく まよわなかったな。',
      'あまりの あつかいも わかってる。',
      '「イシバッジ」だ。持っていけ。',
    ],
    ground: 'a rocky quarry ground of pale beige stone chips and flat cut stone slabs',
  },

  {
    id: 'kakudo',
    name: 'カクド遺跡',
    subtitle: '角を まもる 白い遺跡',
    unit: '角の大きさ',
    biome: 'ruins',
    size: 44,
    intro: [
      'カクド遺跡 ―― 白い石の柱が ならぶ 古い遺跡。',
      '柱と柱のあいだに、いくつもの 角ができている。',
      '風がふくたび、その角が かすかに 光った。',
    ],
    villagerSprite: 'villager-grandma',
    villagerLines: [
      'この遺跡はね、角の大きさで できているの。',
      '直角は90°、まっすぐは180°、ひとまわりで360°。',
      'この3つを おぼえておけば、たいていの角は もとめられるわ。',
      '180°をこえる角は、360°から ひけばいいのよ。',
    ],
    trainers: [
      {
        name: 'たんけんかの リク', sprite: 'trainer-scout',
        lines: ['この柱、かたむいてるだろ？', '分度器で はかれば すぐわかる。', 'はかれるか、しょうぶだ！'],
        after: ['0°の線を どっちに合わせるか、だよな。', 'ちゃんと わかってる。'],
      },
      {
        name: 'ずこうの アオイ', sprite: 'trainer-artist',
        lines: ['三角じょうぎ、2まい 持ってる？', '重ねると いろんな角ができるの。', '45°と30°で、いくつになるかしら？'],
        after: ['たしたり ひいたり、じゆうじざいね！', 'すてきな 角の使い手だわ。'],
      },
    ],
    masterName: 'アンヌ',
    masterSprite: 'master-04',
    masterTitle: '角の マスター',
    masterLines: [
      'ようこそ、カクドの間へ。わたしは アンヌ。',
      '角とは「回った量」のこと。',
      '長さでも 面積でもない ―― 「どれだけ 回ったか」なの。',
      'そう考えれば、180°をこえた角も こわくないでしょう？',
      'では、はじめましょうか。',
    ],
    masterAfter: [
      'すばらしい。まっすぐな目をしているわ。',
      'あなたには もう、角が「回った量」に見えているのね。',
      '「カクバッジ」を さしあげます。',
    ],
    ground: 'ancient pale marble ruins floor with cracked stone tiles and small grass tufts',
  },

  {
    id: 'shizuku',
    name: 'シズク湖',
    subtitle: '1より 小さな 水の町',
    unit: '小数のしくみ',
    biome: 'lake',
    size: 50,
    intro: [
      'シズク湖 ―― どこまでも すきとおった 湖の町。',
      '水面に 小さなしずくが 落ちるたび、',
      'ちいさな ちいさな 波の輪が 広がっていく。',
    ],
    villagerSprite: 'villager-girl',
    villagerLines: [
      'この湖のしずくは、ぜんぶ 0.1 の大きさなの。',
      '10こ集まると、ちょうど 1 になるのよ。',
      'たし算・ひき算のときはね ――',
      '小数点を たてに そろえる。それだけ 気をつければ だいじょうぶ！',
    ],
    trainers: [
      {
        name: 'つりびとの ナオ', sprite: 'trainer-diver',
        lines: ['きょうの つり果は 2.4kg！', 'きのうは 1.75kg だった。どっちが 重い？', 'わかるなら しょうぶだ！'],
        after: ['そう、位をそろえて くらべるんだ。', '2.4 は 2.40 と同じ。いいセンスだ。'],
      },
      {
        name: 'みずうみの ホタル', sprite: 'trainer-artist',
        lines: ['ねえ、この数直線 読める？', '目もりが こまかいの。', '読めたら、しょうぶしよ！'],
        after: ['1目もりが いくつか、まず見るのよね。', 'あなた、目がいいわ。'],
      },
    ],
    masterName: 'ミナモ',
    masterSprite: 'master-05',
    masterTitle: '小数の マスター',
    masterLines: [
      'ようこそ、シズクの水辺へ。わたしは ミナモ。',
      '整数だけの世界では、1と2のあいだには なにもなかった。',
      'でも 小数は、そのすきまを 教えてくれる。',
      '1.1、1.2、1.3 …… ほら、こんなにたくさん。',
      'この世界の こまかさを、あなたにも 見せてあげる。',
    ],
    masterAfter: [
      'ふふ、すきまが 見えるようになったのね。',
      'その目があれば、この先も こまらないわ。',
      '「シズクバッジ」を どうぞ。',
    ],
    ground: 'lush lakeside grass with damp soil patches, small pebbles and tiny blue flowers',
  },

  {
    id: 'futago',
    name: 'フタゴの滝',
    subtitle: 'ふたつの けたの 滝',
    unit: 'わり算の筆算(÷2けた)',
    biome: 'falls',
    size: 48,
    intro: [
      'フタゴの滝 ―― 2すじの滝が ならんで落ちる 谷。',
      'ごうごうと 水音がひびき、しぶきが 虹をつくる。',
      'ここでは わり算が、ひとまわり むずかしくなる。',
    ],
    villagerSprite: 'villager-boy',
    villagerLines: [
      '2けたで わるときはね、まず「見当をつける」んだ。',
      'わる数を 何十とみて、だいたいの商を さがす。',
      '大きすぎたら 1つへらす。小さすぎたら 1つふやす。',
      'なおすのは はずかしくないよ。みんな そうしてる！',
    ],
    trainers: [
      {
        name: 'たきのぼりの ソウタ', sprite: 'trainer-sport',
        lines: ['この滝、何メートルだと思う？', '2けたで わるのは 見当が いのち！', 'しょうぶだ、いくぞ！'],
        after: ['見当が ぴたりだったな！', '直す勇気も 持ってる。すごいよ。'],
      },
      {
        name: 'にじの ユメ', sprite: 'trainer-star',
        lines: ['商が 何けたになるか、わかる？', 'はじめる前に わかると、はやいのよ。', 'ためしてみない？'],
        after: ['そう、まず 上の位を見るのよね。', 'あなた、はやいわ！'],
      },
    ],
    masterName: 'リョウとソウ',
    masterSprite: 'master-06',
    masterTitle: 'わり算(÷2けた)の マスター',
    masterLines: [
      'ようこそ！ ぼくが リョウ。',
      'で、ぼくが ソウ。ふたごの 滝守りだよ。',
      '2けたのわり算はね、こわがらなくていいんだ。',
      '「たぶん このくらい」で まず立てる。ちがったら 直す。',
      'ぼくたち ふたりで 相手をするよ。かかっておいで！',
    ],
    masterAfter: [
      'すごい！ ぜんぜん まよわなかったね。',
      '見当をつけて、直す。それが できれば もう こわいものなし。',
      '「フタゴバッジ」だよ。受け取って！',
    ],
    ground: 'wet mossy riverside ground with dark damp soil, green moss and smooth round stones',
  },

  {
    id: 'kirino',
    name: 'キリノ森',
    subtitle: 'だいたいが 見える 霧の森',
    unit: 'がい数',
    biome: 'fog',
    size: 50,
    intro: [
      'キリノ森 ―― いつも うすい霧に つつまれた森。',
      'はっきりとは 見えないのに、',
      'なぜか「だいたいの かたち」は よくわかる。',
    ],
    villagerSprite: 'villager-grandma',
    villagerLines: [
      'この森ではね、はっきり見えないほうが よく見えるのよ。',
      '四捨五入は、もとめる位の 1つ下を見る。',
      '0〜4なら 切り捨て、5〜9なら 切り上げ。',
      'ぜんぶ かぞえなくても、だいたいで じゅうぶんな時があるの。',
    ],
    trainers: [
      {
        name: 'きりの ソウ', sprite: 'trainer-bug',
        lines: ['この森の木、何本あると思う？', '……ぜんぶ 数えなくていいんだ。', 'だいたいで しょうぶしよう！'],
        after: ['そう、それでじゅうぶんなんだ。', '見積もりって、便利だろ？'],
      },
      {
        name: 'かいものの リナ', sprite: 'trainer-chef',
        lines: ['1000円で 足りるかしら？', 'こういうときは 切り上げて 考えるの。', 'いっしょに 考えてくれる？'],
        after: ['多めに 見積もれば、足りなくならないものね。', 'かしこい 買いものができるわ。'],
      },
    ],
    masterName: 'オボロ',
    masterSprite: 'master-07',
    masterTitle: 'がい数の マスター',
    masterLines: [
      'よく この霧を こえてきたね。わたしは オボロ。',
      '人はね、「正しい答え」ばかり さがしてしまう。',
      'でも 世の中には、正しさより 早さが たいせつな時がある。',
      'だいたい わかれば 動ける。それが がい数の力だ。',
      'さあ ―― その力を 見せてもらおう。',
    ],
    masterAfter: [
      'ふむ。霧の中でも 迷わなかったな。',
      'きみは もう「だいたい」を 使いこなしている。',
      '「キリバッジ」を 授けよう。',
    ],
    ground: 'misty forest floor with dark green moss, fallen leaves and pale grey soil',
  },

  {
    id: 'karakuri',
    name: 'カラクリ工房',
    subtitle: 'じゅんばんの からくり町',
    unit: '計算のきまり',
    biome: 'workshop',
    size: 42,
    intro: [
      'カラクリ工房 ―― 歯車の音が やまない 工房の町。',
      'どの機械も、決まった じゅんばんでしか 動かない。',
      'ひとつでも 順番を まちがえると、ぜんぶ 止まってしまう。',
    ],
    villagerSprite: 'villager-grandpa',
    villagerLines: [
      'ここのきまりは 3つだけじゃ。',
      '① ふつうは 左から順に。',
      '② ×と÷は、+と−より 先。',
      '③ ( ) があれば、そこが いちばん先。',
      'この順番さえ 守れば、機械は ちゃんと 動くんじゃよ。',
    ],
    trainers: [
      {
        name: 'ねじまきの コウ', sprite: 'trainer-builder',
        lines: ['この式、どこから 計算する？', '順番を まちがえると 歯車が こわれるぞ。', 'ためしてみるか！'],
        after: ['カチッと はまったな！', 'いい順番だった。'],
      },
      {
        name: 'はぐるまの メイ', sprite: 'trainer-artist',
        lines: ['計算は、くふうすると 楽になるの。', '25×4 みたいな 組み合わせ、見つけられる？', 'しょうぶしましょ！'],
        after: ['きれいな数を さきに つくるのよね。', 'あなた、くふうが じょうずだわ。'],
      },
    ],
    masterName: 'ハグルマ博士',
    masterSprite: 'master-08',
    masterTitle: '計算のきまりの マスター',
    masterLines: [
      'おお、来たか！ わしが ハグルマじゃ。',
      '計算のきまりはな、めんどうな ルールではない。',
      '「世界じゅうの だれが計算しても、同じ答えになる」ための やくそくじゃ。',
      'この やくそくがあるから、みんなで 数を使えるんじゃよ。',
      'さあ、わしの からくりを 動かしてみよ！',
    ],
    masterAfter: [
      'ふむ、みごとに 動いた！',
      'きまりを 守り、しかも くふうまでした。たいしたものじゃ。',
      '「ハグルマバッジ」を 持っていきなさい。',
    ],
    ground: 'worn workshop ground of packed earth with scattered brass bolts and wooden planks',
  },

  {
    id: 'tile',
    name: 'タイル平原',
    subtitle: 'ひろさを はかる 平原',
    unit: '面積',
    biome: 'tile',
    size: 50,
    intro: [
      'タイル平原 ―― 地面が すべて 1辺1mのタイルでできた 平原。',
      '見わたすかぎり、四角い もようが つづいている。',
      'ここでは「広さ」が 目で見える。',
    ],
    villagerSprite: 'villager-boy',
    villagerLines: [
      'この平原のタイル、1まいが 1平方メートルなんだ。',
      '面積って つまり「タイルが何まい分か」ってこと。',
      'たてに3、よこに4 ならんでたら、3×4で 12まい。',
      'L字の形も、2つの長方形に 分ければ かんたんだよ！',
    ],
    trainers: [
      {
        name: 'タイルやの ダイ', sprite: 'trainer-builder',
        lines: ['この へや、タイル何まい いる？', '面積が わかれば すぐ出るぞ。', 'しょうぶだ！'],
        after: ['ぴったりだ！ むだが ないな。', 'いい仕事するよ、きみは。'],
      },
      {
        name: 'にわしの サキ', sprite: 'trainer-sport',
        lines: ['この庭、L字の形をしてるの。', '2つに分けると 楽になるわよ。', 'できるかしら？'],
        after: ['分けて たす。それだけなのよね。', 'とても きれいな 考え方だったわ。'],
      },
    ],
    masterName: 'ヒロシ',
    masterSprite: 'master-09',
    masterTitle: '面積の マスター',
    masterLines: [
      'よく来たな。おれは ヒロシ、この平原のタイル職人だ。',
      '面積ってのは、「1のかたまりが いくつ分か」ってことだ。',
      '長さは ものさし、面積は タイル。それだけの ちがいさ。',
      'a も ha も km² も、大きさが ちがうだけの タイルだよ。',
      'よし ―― おれの平原で しょうぶだ！',
    ],
    masterAfter: [
      'は、まいったな。ひろさが 見えてるじゃないか。',
      'その目があれば、どんな形の広さも もとめられる。',
      '「タイルバッジ」だ。受け取ってくれ。',
    ],
    ground: 'a neat plain of large square stone tiles with green grass growing between the joints',
  },

  {
    id: 'shiokaze',
    name: 'シオカゼ岬',
    subtitle: '小数が はたらく 海の岬',
    unit: '小数のかけ算とわり算',
    biome: 'cape',
    size: 48,
    intro: [
      'シオカゼ岬 ―― 潮風が ふきぬける 海べの岬。',
      '漁船が 魚の重さを、小数で 記録している。',
      'ここでは 小数が、生活の どうぐになっている。',
    ],
    villagerSprite: 'villager-grandpa',
    villagerLines: [
      '小数のかけ算はな、まず 整数だと思って 計算するんじゃ。',
      'そのあとで、小数点を つける。',
      'わり算は もっとかんたん。わられる数の 小数点の 真上じゃ。',
      'わりきれなければ、0をつけて わり進めばよい。',
    ],
    trainers: [
      {
        name: 'りょうしの トキ', sprite: 'trainer-diver',
        lines: ['この魚、1ぴき 0.8kg。6ぴきで 何kg？', '海の男は 計算も はやいぞ。', 'しょうぶだ！'],
        after: ['ぴったり 4.8kg！ みごとだ。', '小数点の場所も まちがえなかったな。'],
      },
      {
        name: 'かもめの ナミ', sprite: 'trainer-sport',
        lines: ['ロープ 7.2mを 3等分したいの。', '1本 何mになる？', 'わかったら しょうぶよ！'],
        after: ['2.4m。小数点は 真上に おろすのよね。', 'きれいな わり算だったわ。'],
      },
    ],
    masterName: 'ナギ',
    masterSprite: 'master-10',
    masterTitle: '小数のかけわりの マスター',
    masterLines: [
      'よう、たびの子。おれは ナギ、この岬の 船乗りだ。',
      '海の上じゃ、ぴったりの数なんて めったに出ない。',
      '3.6kg、0.45m、7.2L …… ぜんぶ 小数だ。',
      'だから 小数で 計算できるってのは、生きる力なんだよ。',
      'さあ、その力を 見せてくれ！',
    ],
    masterAfter: [
      'は、たいしたもんだ。小数点が ぶれなかったな。',
      'おまえなら、どんな海でも やっていける。',
      '「シオカゼバッジ」を 持っていけ。',
    ],
    ground: 'a coastal cape ground of pale sandy soil with sparse tough grass and small shells',
  },

  {
    id: 'cake',
    name: 'ケーキタウン',
    subtitle: '1を わけあう おかしの街',
    unit: '分数',
    biome: 'sweets',
    size: 54,
    intro: [
      'ケーキタウン ―― あまい においが ただよう おかしの街。',
      'どの家も ケーキのかたちをしていて、',
      '通りには 切り分けられた ケーキが ならんでいる。',
    ],
    villagerSprite: 'villager-girl',
    villagerLines: [
      'この街ではね、ケーキは かならず 同じ大きさに 切るの。',
      '分母は「いくつに分けたか」、分子は「そのうち いくつ分か」。',
      '分母が同じなら、分子だけ たしたり ひいたり すればいいのよ。',
      '分母が 大きいほど、1つ分は 小さくなるからね。ふしぎでしょ？',
    ],
    trainers: [
      {
        name: 'パティシエの ルル', sprite: 'trainer-chef',
        lines: ['このケーキ、8つに切ったうちの 5つ。', '5/8 って 書くのよ。', '分数が わかるなら、しょうぶ！'],
        after: ['分母と分子、ちゃんと わかってるのね。', 'あなた、いい パティシエになれるわ。'],
      },
      {
        name: 'おかしやの ボン', sprite: 'trainer-artist',
        lines: ['帯分数と 仮分数、どっちが 好き？', 'ぼくは どっちも 好きだよ。同じ数だからね。', 'なおせるかい？'],
        after: ['自由自在だね！ すごいや。', '見た目が ちがっても 同じ数、って わかってる。'],
      },
    ],
    masterName: 'パティ',
    masterSprite: 'master-11',
    masterTitle: '分数の マスター',
    masterLines: [
      'いらっしゃい！ わたしは パティ。この街の ケーキ長よ。',
      '分数はね、「1を どう分けたか」の 記録なの。',
      'だから 分母がちがう分数は、切り方が ちがうケーキ。',
      'そのままでは くらべられない ―― 同じ切り方に そろえればいいの。',
      'さあ、いちばん おおきな ケーキで しょうぶよ！',
    ],
    masterAfter: [
      'すばらしいわ！ 一切れも むだにしなかったわね。',
      'くり上がりも くり下がりも、こわくないでしょう？',
      '「ケーキバッジ」を どうぞ。',
    ],
    ground: 'a pastel pink cobblestone street with candy-colored round tiles and sugar sprinkles',
  },

  {
    id: 'tokino',
    name: 'トキノ塔',
    subtitle: 'かわり方を きざむ 時計塔',
    unit: '変わり方調べ',
    biome: 'clock',
    size: 40,
    intro: [
      'トキノ塔 ―― 町のまんなかに そびえる 大時計。',
      'カチ、カチ、と 針が動くたび、',
      'ふたつの数が いっしょに 変わっていく。',
    ],
    villagerSprite: 'villager-grandpa',
    villagerLines: [
      'この塔はな、2つの数の かんけいを きざんでおる。',
      '片方がふえると、もう片方も 決まった分だけ ふえる。',
      '表に書いてみると、そのきまりが 見えてくるんじゃ。',
      '「○が1ふえると、□は いくつふえるか」 ―― それを さがすのじゃよ。',
    ],
    trainers: [
      {
        name: 'とけいやの ジン', sprite: 'trainer-builder',
        lines: ['この歯車、1回まわすと あっちは 3回まわる。', 'きまりが 見えるかい？', 'しょうぶといこう！'],
        after: ['ぴったり 3ばい。よく 見えたね。', 'きまりが 見えると、先が わかるんだ。'],
      },
      {
        name: 'かねつきの ハナ', sprite: 'trainer-star',
        lines: ['表を たてに見る？ よこに見る？', '両方 見るのが コツなの。', 'ためしてみる？'],
        after: ['きまりが 見つかったわね。', '見つけたら、その先も わかるのよ。'],
      },
    ],
    masterName: 'トキヤ',
    masterSprite: 'master-12',
    masterTitle: '変わり方の マスター',
    masterLines: [
      'ようこそ、トキノ塔へ。わたしは トキヤ。',
      'この世界の ほとんどのものは、ひとりでは 変わらない。',
      '何かが変われば、何かも 変わる。',
      'そのつながりを 見つけられれば ―― 未来が 少しだけ 読める。',
      'さあ、あなたにも 読めるかな？',
    ],
    masterAfter: [
      'みごとだ。きまりを 見つけるのが はやいね。',
      'それは、先を よむ力だ。だいじにしなさい。',
      '「トキバッジ」を どうぞ。',
    ],
    ground: 'a purple-grey stone plaza with clock-face patterns engraved into round paving stones',
  },

  {
    id: 'hakoniwa',
    name: 'ハコニワ砂漠',
    subtitle: '立体が ねむる 砂の遺跡',
    unit: '直方体と立方体',
    biome: 'desert',
    size: 50,
    intro: [
      'ハコニワ砂漠 ―― 砂のなかに 四角い遺跡が 半分うまっている。',
      'どの遺跡も、きれいな 直方体や 立方体をしている。',
      '風が 砂をはらうと、面と辺と頂点が すがたを見せた。',
    ],
    villagerSprite: 'villager-grandma',
    villagerLines: [
      'この遺跡はね、ぜんぶ 6つの面でできているの。',
      '辺は12本、頂点は8つ。どの箱でも 同じよ。',
      '開いて 平らにしたものが 展開図。',
      '向かい合う面が どこに来るか、それを 見ぬくのが コツね。',
    ],
    trainers: [
      {
        name: 'たんけんの ゴウ', sprite: 'trainer-scout',
        lines: ['この石の箱、面はいくつだ？', '辺と頂点も 数えられるか？', 'しょうぶといこう！'],
        after: ['6面、12辺、8頂点。かんぺきだ。', '目で見なくても わかるんだな。'],
      },
      {
        name: 'ちずやの コハク', sprite: 'trainer-star',
        lines: ['この場所、どう伝える？', 'たて・よこ・高さの 3つの数で 表すの。', 'できるかしら？'],
        after: ['3つの数で ぴったり 決まるのよね。', 'いい 地図読みだわ。'],
      },
    ],
    masterName: 'リッキ',
    masterSprite: 'master-13',
    masterTitle: '直方体と立方体の マスター',
    masterLines: [
      'よくぞ 砂をこえてきた。わたしは リッキ。',
      'この砂漠の 箱たちはな、平らな紙から できている。',
      '開けば 展開図。組み立てれば 立体。',
      '頭の中で 開いたり 閉じたり できるようになれば ―― きみの勝ちだ。',
      'さあ、やってみせろ！',
    ],
    masterAfter: [
      'ほう。頭の中で ちゃんと 組み立てたな。',
      'それは 立体を 見る目だ。だれもが 持てるものではない。',
      '「ハコバッジ」を さずけよう。',
    ],
    ground: 'a desert ground of fine golden sand with wind ripples and half-buried square stones',
  },

  {
    id: 'kyoju',
    name: 'キョジュの森',
    subtitle: '何ばいにも のびる 巨大樹の森',
    unit: '倍の見方',
    biome: 'forest',
    size: 52,
    intro: [
      'キョジュの森 ―― 空を おおうほどの 巨大樹がそびえる森。',
      '小さな芽が、何十ばいにも のびて 木になる。',
      'ここは「くらべること」を 学ぶ さいごの森。',
    ],
    villagerSprite: 'villager-boy',
    villagerLines: [
      'この森の木はね、もとの高さの 何ばいかで よぶんだ。',
      '「くらべられる量 ÷ もとにする量 = 何ばい」。',
      'どっちが「もと」なのか ―― それを まちがえないのが 大事だよ。',
      '差でくらべるのと、倍でくらべるのは ちがうからね！',
    ],
    trainers: [
      {
        name: 'きこりの タケ', sprite: 'trainer-builder',
        lines: ['この木は 3m、あっちは 12m。', '何ばいだ？', 'わかるなら、しょうぶだ！'],
        after: ['4ばい。もとにするのは 3mの方だな。', 'よく わかってる。'],
      },
      {
        name: 'たねまきの リン', sprite: 'trainer-bug',
        lines: ['AとB、どっちが よくのびた？', '差で見るか、倍で見るかで 答えが かわるの。', 'いっしょに 考えて！'],
        after: ['そう、倍で見ると 公平になるのよね。', 'あなた、するどいわ。'],
      },
    ],
    masterName: 'バイコ',
    masterSprite: 'master-14',
    masterTitle: '倍の見方の マスター',
    masterLines: [
      'よく ここまで 来たね。わたしは バイコ、この森の 守り手。',
      '大きさを くらべるとき、人は つい「差」で 見てしまう。',
      'でも 3mが 12mになった木と、100mが 109mになった木。',
      'どちらが よく のびたと 思う？',
      '「倍」で 見れば、答えが 変わる。……さあ、見せてごらん。',
    ],
    masterAfter: [
      'みごとだ。あなたは もう「倍」の目を 持っている。',
      'これで 14の町、すべてを めぐったことになるね。',
      '「キョジュバッジ」を どうぞ。……リーグが、待っているよ。',
    ],
    ground: 'a deep forest floor of dark rich soil with green moss, ferns and fallen leaves',
  },
];

// ---- 手持ちの決定的な組み立て ----
// その単元のモンスターを難易度順にならべ、決まった位置から取る。
// 問題データが増えても手で直す必要がないようにしている。
const pickParty = (unit: string, slots: number, offset: number, level: number) => {
  const pool = (MONSTERS_BY_UNIT[unit] ?? []).slice().sort((a, b) => a.difficulty - b.difficulty || a.no - b.no);
  if (pool.length === 0) return [];
  const party: Array<{ defId: string; level: number }> = [];
  for (let i = 0; i < slots; i++) {
    const m = pool[(offset + i * 3) % pool.length];
    party.push({ defId: m.id, level });
  }
  return party;
};

const buildTown = (seed: TownSeed, index: number): TownDef => {
  const pos = layout(seed.size);
  const wildLevel = 3 + Math.round(index * 1.25);
  const boss = BOSS_BY_UNIT[seed.unit];

  const npcs: FieldNpcDef[] = [
    {
      id: `${seed.id}-nurse`, kind: 'nurse', name: 'かいふく所の おねえさん',
      sprite: 'nurse', x: pos.nurse.x, z: pos.nurse.z,
      lines: [
        'いらっしゃい、かいふく所へ。',
        'てもちの みんなを 元気にするね。……はい、おわり！',
        'いってらっしゃい。気をつけてね。',
      ],
    },
    {
      id: `${seed.id}-shop`, kind: 'shop', name: 'ショップの おじさん',
      sprite: 'shop', x: pos.shop.x, z: pos.shop.z,
      lines: ['いらっしゃい！ ボールは 足りてるかい？'],
    },
    {
      id: `${seed.id}-villager`, kind: 'villager', name: '村の ひと',
      sprite: seed.villagerSprite, x: pos.villager.x, z: pos.villager.z,
      lines: seed.villagerLines,
    },
    {
      id: `${seed.id}-trainer-a`, kind: 'trainer', name: seed.trainers[0].name,
      sprite: seed.trainers[0].sprite, x: pos.trainerA.x, z: pos.trainerA.z,
      lines: seed.trainers[0].lines, afterLines: seed.trainers[0].after,
      party: pickParty(seed.unit, 2, 0, wildLevel + 1),
      reward: { mp: 40 + index * 6, balls: 1 },
    },
    {
      id: `${seed.id}-trainer-b`, kind: 'trainer', name: seed.trainers[1].name,
      sprite: seed.trainers[1].sprite, x: pos.trainerB.x, z: pos.trainerB.z,
      lines: seed.trainers[1].lines, afterLines: seed.trainers[1].after,
      party: pickParty(seed.unit, 2, 4, wildLevel + 2),
      reward: { mp: 50 + index * 6, balls: 1 },
    },
    {
      id: `${seed.id}-master`, kind: 'master', name: seed.masterName,
      sprite: seed.masterSprite, x: pos.master.x, z: pos.master.z,
      lines: seed.masterLines, afterLines: seed.masterAfter,
      party: [
        ...pickParty(seed.unit, 2, 2, wildLevel + 3),
        ...(boss ? [{ defId: boss.id, level: wildLevel + 5 }] : []),
      ],
      reward: { mp: 150 + index * 20, balls: 3 },
      grantsBadge: true,
    },
  ];

  return {
    no: index + 1,
    id: seed.id,
    name: seed.name,
    subtitle: seed.subtitle,
    unit: seed.unit,
    type: UNIT_TO_ELEMENT[seed.unit] ?? 'kazu',
    biome: seed.biome,
    size: seed.size,
    intro: seed.intro,
    masterTitle: seed.masterTitle,
    wildLevel,
    npcs,
    groundTexturePrompt: seed.ground,
  };
};

export const TOWNS: TownDef[] = SEEDS.map(buildTown);

export const getTown = (id: string): TownDef | undefined => TOWNS.find(t => t.id === id);

export const getTownByUnit = (unit: string): TownDef | undefined => TOWNS.find(t => t.unit === unit);

/** プレイヤーの初期位置(ケタバ村の南) */
export const SPAWN = (town: TownDef) => layout(town.size).spawn;

/** バッジ名。町の名前の頭を取って「◯◯バッジ」にする。 */
export const BADGE_NAMES: Record<string, string> = {
  ketaba: 'ケタバッジ', kazeoka: 'カゼバッジ', ishikiri: 'イシバッジ',
  kakudo: 'カクバッジ', shizuku: 'シズクバッジ', futago: 'フタゴバッジ',
  kirino: 'キリバッジ', karakuri: 'ハグルマバッジ', tile: 'タイルバッジ',
  shiokaze: 'シオカゼバッジ', cake: 'ケーキバッジ', tokino: 'トキバッジ',
  hakoniwa: 'ハコバッジ', kyoju: 'キョジュバッジ',
};
