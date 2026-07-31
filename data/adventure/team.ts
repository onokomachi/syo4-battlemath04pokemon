/**
 * team.ts — 悪の組織「テキトウ団」のサブイベント。
 *
 * この物語は、既存のサブトピック「がい数をつかう場面は？」「どの見積もり方がいい？」
 * にそのまま重なるように書いてある。
 *
 *   テキトウ団の主張 : 「ちゃんと数えるなんて むだ。ぜんぶ だいたいで いい。」
 *   物語が示す答え   : 「がい数は 便利な道具。でも、道具は 使う場面を えらぶもの。」
 *
 * つまり団は「がい数そのもの」が悪なのではなく、**場面を考えずに使うこと**の
 * たとえになっている。ボス「マルメ」には、そうなってしまった理由がある。
 * 悪役を単純な敵にせず、児童が「どちらの言い分も分かる」状態から
 * 自分で判断する形にしたかったため。
 */

export interface TeamMemberDef {
  id: string;
  name: string;
  /** 肩書き */
  role: string;
  sprite: string;
  /** 出題に使う単元 */
  units: string[];
  level: number;
  /** 手持ちの数 */
  partySize: number;
}

export const TEAM_NAME = 'テキトウ団';

export const TEAM_MEMBERS: Record<string, TeamMemberDef> = {
  grunt: {
    id: 'grunt', name: 'テキトウだんいん', role: 'したっぱ',
    sprite: 'team-grunt', units: ['大きい数のしくみ'], level: 8, partySize: 1,
  },
  zatsu: {
    id: 'zatsu', name: 'ザツ', role: 'テキトウ団 かんぶ',
    sprite: 'team-zatsu', units: ['わり算の筆算(÷1けた)'], level: 16, partySize: 2,
  },
  oozappa: {
    id: 'oozappa', name: 'オオザッパ', role: 'テキトウ団 かんぶ',
    sprite: 'team-oozappa', units: ['小数のしくみ'], level: 24, partySize: 2,
  },
  about: {
    id: 'about', name: 'アバウト', role: 'テキトウ団 かんぶ',
    sprite: 'team-about', units: ['がい数'], level: 32, partySize: 3,
  },
  marume: {
    id: 'marume', name: 'マルメ', role: 'テキトウ団 ボス',
    sprite: 'team-marume',
    units: ['がい数', '大きい数のしくみ', '計算のきまり', '倍の見方'],
    level: 42, partySize: 3,
  },
};

export interface TeamChapter {
  id: string;
  /** 何個目のバッジで発生するか */
  requiredBadges: number;
  /** どの町で起きるか */
  townId: string;
  title: string;
  /** 出会ったときのセリフ */
  lines: string[];
  /** 戦う相手(TEAM_MEMBERS のキー) */
  opponent: string;
  /** 勝ったあとのセリフ */
  afterLines: string[];
  /** 報酬 */
  reward: { mp: number; balls: number };
}

export const TEAM_CHAPTERS: TeamChapter[] = [
  {
    id: 'team-1', requiredBadges: 1, townId: 'ketaba',
    title: '第1章 きえた 数字',
    opponent: 'grunt',
    lines: [
      '村の入口に、見なれない かっこうの 二人組が いる ――',
      'テキトウだんいん「へへっ、この村の 数字、ぜんぶ けしちまえ。」',
      'テキトウだんいん「……あ？ なんだ おまえ。」',
      'テキトウだんいん「おれたちは テキトウ団。」',
      'テキトウだんいん「一の位まで きっちり数えるなんて、めんどくせえだろ？」',
      'テキトウだんいん「ぜんぶ『だいたい』で いいんだよ。そのほうが ラクだ。」',
      'テキトウだんいん「じゃまする気なら、しょうぶだ！」',
    ],
    afterLines: [
      'テキトウだんいん「うわあ、ちゃんと 数えられてる……!?」',
      'テキトウだんいん「く、くそっ。おぼえてろ！」',
      '二人組は 走って 逃げていった。',
      '(村の おじいさん)「あいつら……最近、地方じゅうで 見かけるんじゃ。」',
      '(村の おじいさん)「気をつけて 旅を つづけなさい。」',
    ],
    reward: { mp: 120, balls: 2 },
  },
  {
    id: 'team-2', requiredBadges: 3, townId: 'ishikiri',
    title: '第2章 石の数を ごまかす者',
    opponent: 'zatsu',
    lines: [
      '石切り場が、なぜか さわがしい ――',
      'ザツ「はい はい、この石の山は だいたい 100こね。はい つぎ。」',
      '石切りの人「ちょっと待った！ さっきから 数が 合わないぞ！」',
      'ザツ「え〜? 細かいなあ。だいたい 合ってれば いいじゃん。」',
      'ザツ「……お。バッジを 3つ 持ってるガキか。」',
      'ザツ「あたしは ザツ。テキトウ団の かんぶ。」',
      'ザツ「言っとくけど、きっちり 数えるやつって、めんどくさいだけだよ？」',
      'ザツ「証明してあげる。かかっておいで！」',
    ],
    afterLines: [
      'ザツ「……なんで。なんで そんなに 正確なの。」',
      '石切りの人「あんたが ごまかした分、この人たちの 給料が へるんだよ。」',
      '石切りの人「『だいたい』で いい場面と、そうじゃない場面が あるんだ。」',
      'ザツ「……ふん。ボスに 言いつけてやる。」',
      'ザツは 谷の おくへ 消えていった。',
    ],
    reward: { mp: 250, balls: 3 },
  },
  {
    id: 'team-3', requiredBadges: 5, townId: 'shizuku',
    title: '第3章 こわされた 水位計',
    opponent: 'oozappa',
    lines: [
      '湖の ほとりで、大きな体の男が 何かを こわしている ――',
      'オオザッパ「こんな こまかい 目もり、いらねえよなあ。」',
      '湖の人「やめてくれ！ それは 水の高さを はかる 大事な計器だ！」',
      'オオザッパ「0.1メートル? そんな ちがい、だれも 気にしねえって。」',
      '湖の人「気にするんだ！ 0.1メートル上がったら、この村は 水に つかる！」',
      'オオザッパ「……お、じゃまする気か。」',
      'オオザッパ「オオザッパってんだ。テキトウ団 かんぶ。」',
      'オオザッパ「こまけえことに こだわるやつは、きらいでな。」',
    ],
    afterLines: [
      'オオザッパ「……ぐっ。0.1の ちがいで、負けた……?」',
      '湖の人「そうだ。小さいから どうでもいい、なんてことは ないんだ。」',
      'オオザッパ「…………。」',
      'オオザッパ「ボスの 言ってたことと、ちがう じゃねえか……。」',
      'オオザッパは、だまって 去っていった。',
    ],
    reward: { mp: 400, balls: 3 },
  },
  {
    id: 'team-4', requiredBadges: 8, townId: 'kirino',
    title: '第4章 霧の中の 見積もり',
    opponent: 'about',
    lines: [
      '霧の森の 入口に、細身の男が 立っている ――',
      'アバウト「やあ。きみが うわさの 子だね。」',
      'アバウト「ぼくは アバウト。テキトウ団の かんぶさ。」',
      'アバウト「この森を、テキトウ団の ものに させてもらう。」',
      'アバウト「なに、書類上は もう すんでいる。」',
      'アバウト「『この森の 木は 約1000本』―― そう書いたからね。」',
      '(森の人)「じっさいは 4000本 以上 あるのに……!」',
      'アバウト「がい数だよ。まちがっては いない。だいたいの話だ。」',
      'アバウト「……ふふ。きみは、この使い方を どう思う？」',
      'アバウト「言葉で 言うより、しょうぶで 聞こうか。」',
    ],
    afterLines: [
      'アバウト「……まいったね。ぼくの 見積もりは、はずれたか。」',
      'アバウト「きみの 言うとおりだ。」',
      'アバウト「がい数は 便利な 道具さ。すばやく 判断するための ね。」',
      'アバウト「でも ぼくは それを、ごまかすために 使った。」',
      'アバウト「……道具に つみは ない。使った ぼくの 問題だ。」',
      'アバウト「ボスに 会いに 行くといい。ハコニワ砂漠の 地下だ。」',
      'アバウト「あの人にも……たぶん、それを 言ってやる人が 必要なんだ。」',
    ],
    reward: { mp: 600, balls: 4 },
  },
  {
    id: 'team-5', requiredBadges: 11, townId: 'tokino',
    title: '第5章 時計塔の ボス',
    opponent: 'marume',
    lines: [
      '時計塔の 前に、ひとりの人が 立っていた ――',
      '長い ローブ。しずかな 目。',
      'マルメ「きみが、うちの かんぶを 三人とも 止めた 子だね。」',
      'マルメ「わたしが マルメ。テキトウ団を つくった 者だ。」',
      'マルメ「……きみは、こう 思っているだろう。」',
      'マルメ「『きちんと 数えれば いいのに』と。」',
      'マルメ「わたしも、むかしは そう 思っていた。」',
      'マルメ「一の位まで、きっちり 計算しないと 気がすまなかった。」',
      'マルメ「……ある日、その せいで まにあわなかった。」',
      'マルメ「たった一つの 数を 出すのに 時間を かけすぎて、」',
      'マルメ「わたしは、たいせつなものを 守れなかったんだ。」',
      'マルメ「だから 決めた。もう 正確さなんて いらない、と。」',
      'マルメ「……きみは どう 思う？」',
      'マルメ「言葉は いい。しょうぶで 教えてくれ。」',
    ],
    afterLines: [
      'マルメ「……つよいな。」',
      'マルメ「だが、まだ わたしは 納得していない。」',
      'マルメ「14の バッジを ぜんぶ 集めて、アジトへ 来なさい。」',
      'マルメ「そのときは ―― 全力で 相手を しよう。」',
      'マルメは、時計塔の 影に 消えていった。',
    ],
    reward: { mp: 800, balls: 5 },
  },
];

// ============================================================
// アジト戦(バッジ14個で解放)
// ============================================================

export const TEAM_HIDEOUT = {
  id: 'team-hideout',
  requiredBadges: 14,
  townId: 'hakoniwa',
  title: 'さいしゅうしょう テキトウ団アジト',
  /** アジトに入るときのテキスト */
  enterLines: [
    'ハコニワ砂漠の 遺跡の おくに、地下へ つづく 階段が あった ――',
    'ひんやりとした 空気。かべには 数字が びっしりと きざまれている。',
    'そのすべてが、乱暴に 消されていた。',
  ],
  /** 幹部3人との連戦 */
  guards: ['zatsu', 'oozappa', 'about'],
  guardLines: {
    zatsu: [
      'ザツ「また あんたか！ 今度は 負けない！」',
      'ザツ「……ボスを、あれ以上 苦しめないで。」',
    ],
    oozappa: [
      'オオザッパ「……来たか。」',
      'オオザッパ「おれは ボスに 助けられた。だから ここに いる。」',
      'オオザッパ「通したければ、力ずくで 来い！」',
    ],
    about: [
      'アバウト「やあ、待っていたよ。」',
      'アバウト「ぼくは きみに 賛成だ。でも、ここは 通せない。」',
      'アバウト「……ボスに 言葉を 届けるには、まず ぼくを こえてくれ。」',
    ],
  } as Record<string, string[]>,
  /** ボス戦の前 */
  bossLines: [
    'いちばん おくの 部屋。',
    'マルメは、こわれた 大時計の 前に 立っていた。',
    'マルメ「……よく 来たね。」',
    'マルメ「三人とも こえてきたか。たいしたものだ。」',
    'マルメ「わたしは まだ、答えを 見つけられていない。」',
    'マルメ「正確に 数えれば まにあわない。だいたいで すませば ごまかしになる。」',
    'マルメ「……どちらも だめなら、どうすれば よかったんだ。」',
    'マルメ「教えてくれ。きみの 答えを ―― この しょうぶで！」',
  ],
  /** ボスに勝ったあと */
  afterLines: [
    'マルメ「…………。」',
    'マルメ「そうか。……そうだったのか。」',
    'マルメ「きみは、どちらも 使っていたね。」',
    'マルメ「急ぐところは がい数で ざっと つかんで、」',
    'マルメ「だいじなところだけ、きっちり 計算していた。」',
    'マルメ「……えらぶ、ということか。」',
    'マルメ「正確さか、だいたいか ―― どちらかを 選ぶんじゃない。」',
    'マルメ「場面に 合わせて、道具を えらぶんだ。」',
    'マルメ「わたしは あの日、それを 知らなかっただけだった。」',
    '',
    'マルメ「テキトウ団は、きょうで かいさんだ。」',
    'マルメ「……ありがとう。ずっと、だれかに 言って ほしかったのかもしれない。」',
    'マルメは、こわれた大時計に そっと 手を あてた。',
    '止まっていた針が、カチリ、と 動きだした。',
  ],
  reward: { mp: 3000, balls: 10 },
};

/** いま発生すべき章を返す(バッジ数と、その町にいるかで判定) */
export const pendingChapter = (
  badgeCount: number,
  townId: string,
  clearedIds: string[],
): TeamChapter | null =>
  TEAM_CHAPTERS.find(
    c => c.townId === townId && badgeCount >= c.requiredBadges && !clearedIds.includes(c.id),
  ) ?? null;

/** 団員のスプライト生成用モチーフ */
export const TEAM_SPRITES: Array<{ id: string; motif: string }> = [
  {
    id: 'team-grunt',
    motif:
      'a mischievous cartoon henchman in a matching grey-and-orange uniform with a tilted cap ' +
      'and a big lazy grin, arms crossed, comical villain but not scary',
  },
  {
    id: 'team-zatsu',
    motif:
      'a bored-looking young woman commander in a sharp grey-and-orange uniform jacket, ' +
      'short messy orange hair, hands in pockets, smirking',
  },
  {
    id: 'team-oozappa',
    motif:
      'a big burly commander in a grey-and-orange uniform stretched over broad shoulders, ' +
      'shaved head, thick arms folded, gruff but not frightening',
  },
  {
    id: 'team-about',
    motif:
      'a slim elegant commander in a neat grey-and-orange uniform with round glasses, ' +
      'silver hair, holding a clipboard, calm polite smile',
  },
  {
    id: 'team-marume',
    motif:
      'a tall dignified leader in a long flowing charcoal robe with orange trim, ' +
      'calm sorrowful eyes, silver hair, a broken pocket watch hanging from one hand, ' +
      'imposing and melancholy rather than evil',
  },
];
