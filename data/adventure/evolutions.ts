/**
 * evolutions.ts — 進化するモンスターと、その選定理由。
 *
 * 進化の条件は「そのサブトピックで5問連続正解(熟達)」。この判定は
 * `services/learningLogService.ts` が既に `perfectStreak >= 5 → mastered` として
 * 計算しているものをそのまま使う。**ゲームでいちばん嬉しい瞬間と、学習の到達点を
 * 同じタイミングにする**ことが目的。
 * 根拠: マスタリー・ラーニングのメタ分析(Guskey & Gates 1986;
 * Kulik, Kulik & Bangert-Drowns 1990 — エビデンスレベル1a)。
 *
 * 全151体を進化させることはしない。「進化する」こと自体が特別でなくなるのと、
 * 熟達を確認する価値が低い項目まで含めると、達成の意味が薄まるため。
 * 次の3基準のいずれかに当てはまる項目だけを選んだ(44項目)。
 *
 *   [中核] その単元の到達目標そのもの。ここができないと単元が成立しない
 *   [土台] 後の単元・後の学年の前提になる(縦のつながりが強い)
 *   [つまずき] 誤答が集中し、熟達を確認する価値がとくに高い
 */

export interface EvolutionDef {
  /** 進化前のサブトピック名(= モンスターの出どころ) */
  subtopic: string;
  /** 進化後の名前 */
  name: string;
  /** 進化後の見た目(生成プロンプト用の英語モチーフ) */
  motif: string;
  /** 選定理由 */
  reason: '中核' | '土台' | 'つまずき';
  /** 進化後の図鑑説明 */
  flavor: string;
}

export const EVOLUTIONS: EvolutionDef[] = [
  // ---- 大きい数のしくみ ----
  { subtopic: '大きい数のよみかき', name: 'ヨミガミ', reason: '中核',
    motif:
      'a large armored horned beetle knight in gleaming golden plate, an unfurled scroll held like a banner',
    flavor: '兆をこえる数でも、ひと目で読みあげる。ヨミィが読みの力を極めた姿。' },
  { subtopic: '数直線(億・兆)', name: 'メモリューガ', reason: '土台',
    motif:
      'a regal cream-and-gold dragon with glowing measure marks along its back',
    flavor: '体が一本の数直線になった。どんな大きさの数も、その上に置ける。' },
  { subtopic: '3けた×3けたのかけ算', name: 'サンケタイガ', reason: '中核',
    motif:
      'a powerful golden tiger-beetle with three rows of gleaming bead armor across its back',
    flavor: '3列の玉を同時に弾いて、大きなかけ算を一気に片づける。' },

  // ---- 折れ線グラフと表 ----
  { subtopic: '折れ線グラフのよみとり', name: 'オレセンフウ', reason: '中核',
    motif:
      'a large violet falcon with one long curved tail feather trailing light',
    flavor: '飛んだあとに残る線で、これから何が起きるかを教えてくれる。' },
  { subtopic: '二次元表に整理する', name: 'セイリオン', reason: '中核',
    motif:
      'a regal violet lion-cat with a grid-patterned mantle draped over its back',
    flavor: 'たてとよこ、両方から見わたして、散らかった数をきれいに並べる。' },

  // ---- わり算の筆算(÷1けた) ----
  { subtopic: 'あまりのあるわり算', name: 'アマリオン', reason: '土台',
    motif:
      'a proud ember lion with a glowing crumb-shaped gem set in its chest',
    flavor: '「わりきれない」ことを、こわがらなくなった姿。あまりは大事な答えの一部。' },
  { subtopic: '2けた÷1けた', name: 'ニケタード', reason: '中核',
    motif:
      'a red oni warrior in dark armor holding one broad cleaving blade close to its body',
    flavor: 'たてる・かける・ひく・おろす。4つの動きが体にしみこんでいる。' },
  { subtopic: '3けた÷1けた', name: 'ミケタード', reason: '中核',
    motif:
      'a tall red oni warrior in heavy armor holding one wide cleaving blade close to its body',
    flavor: 'けたが増えても、やることは同じだと知っている。' },
  { subtopic: '商に0がたつわり算', name: 'ゼロタツオー', reason: 'つまずき',
    motif:
      'a red oni king in ornate armor holding a large glowing zero-shaped shield',
    flavor: '0を書きわすれない。それだけで、答えはまったく変わってしまうから。' },
  { subtopic: 'あまりを切り上げる', name: 'キリアゲル', reason: 'つまずき',
    motif:
      'a powerful crimson beast with upward-curving horns lifting a great stone',
    flavor: '「もう1つ必要だ」と気づける子にだけ、この姿を見せる。' },

  // ---- 角の大きさ ----
  { subtopic: '分度器と角', name: 'ブンドキング', reason: '中核',
    motif:
      'a regal golden crystal beast with a protractor-shaped halo crown and long horns',
    flavor: '0°の線をどこに合わせるか、まよったことがない。' },
  { subtopic: '180°をこえる角', name: 'オオカクオン', reason: '土台',
    motif:
      'a large golden crystal beast with a great sweeping horn arcing over its back',
    flavor: '角とは「回った量」。そう分かった瞬間に、この姿になった。' },

  // ---- 小数のしくみ ----
  { subtopic: '数直線を読む', name: 'ミズモリュウ', reason: '土台',
    motif:
      'a graceful blue water-dragon with glowing measure marks along its flowing body',
    flavor: '1と2のあいだにも、数がぎっしりある。それを泳ぎながら数えられる。' },
  { subtopic: '何十倍・何分の一', name: 'バイブンガ', reason: '土台',
    motif:
      'a large silver-blue koi-dragon with wide sweeping fins',
    flavor: '10倍も10分の1も、位が動くだけだと知っている。' },
  { subtopic: '小数のたし算(けたがちがう)', name: 'ズレタシオン', reason: 'つまずき',
    motif:
      'a noble blue water-lion formed from two merged streams',
    flavor: '小数点をそろえる。ただそれだけを、けっして忘れない。' },
  { subtopic: '小数のひき算(空位に注意)', name: 'クウイオン', reason: 'つまずき',
    motif:
      'a translucent blue water-lion with a glowing hollow ring in its chest',
    flavor: '空っぽの位に0を入れる。見えないものを見る力。' },

  // ---- わり算の筆算(÷2けた) ----
  { subtopic: '仮の商の見当', name: 'カリショウガ', reason: '中核',
    motif:
      'a large copper clockwork wolf with a glowing dial set on its brow',
    flavor: '遠くから数を見て、だいたいの答えをあてる。当たらなくても、あわてない。' },
  { subtopic: '2けた÷2けた', name: 'フタケタード', reason: '中核',
    motif:
      'a large copper clockwork wolf in heavy brass armor with twin crest-horns on its head',
    flavor: '2けたでわることに、もう ひるまない。' },
  { subtopic: '3けた÷2けた', name: 'ミツケタード', reason: '中核',
    motif:
      'a massive three-segmented copper clockwork wolf with layered plating',
    flavor: '大きな数ほど、手順のありがたみがわかる。' },
  { subtopic: '仮の商の修正', name: 'ナオシオン', reason: 'つまずき',
    motif:
      'a copper clockwork lion with a great winding key rising from its shoulders',
    flavor: '直すことは、まちがえたことより ずっと えらい。' },

  // ---- がい数 ----
  { subtopic: '指定の位までのがい数', name: 'シテイオン', reason: '中核',
    motif:
      'a large cream cloud-lion with one brightly glowing strand in its mane',
    flavor: 'どの位で切るかを決めれば、あとは迷わない。' },
  { subtopic: '上から2けたのがい数', name: 'ウエフタガ', reason: '中核',
    motif:
      'a great cream cloud-stag with two tall glowing antlers',
    flavor: '上から2つだけを、くっきりと見せる。' },
  { subtopic: '十の位までのはんい', name: 'ハンイオン', reason: '土台',
    motif:
      'a large pale-gold nine-tailed mist fox surrounded by a wide glowing ring',
    flavor: '「以上」と「未満」のちがいが、体で分かっている。' },
  { subtopic: 'かけ算の見積もり', name: 'ミツカケオン', reason: '土台',
    motif:
      'a great cream cloud-phoenix with layered overlapping wings',
    flavor: 'だいたいの答えを、計算する前に言いあてる。' },

  // ---- 計算のきまり ----
  { subtopic: '計算の順じょ', name: 'ジュンジョギア', reason: '土台',
    motif:
      'a tall steel gear-golem in knightly plate with three great interlocking gears on its back',
    flavor: '世界じゅうのだれが計算しても同じ答えになる。その約束を守る番人。' },
  { subtopic: '計算のくふう', name: 'クフウギアード', reason: '土台',
    motif:
      'a sleek steel gear-golem with a long belt-drive mantle across its body',
    flavor: '歯車を組みかえて、長い計算を一瞬で終わらせる。' },

  // ---- 面積 ----
  { subtopic: '長方形の面積', name: 'チョウホウオン', reason: '中核',
    motif:
      'a mighty golden tile-armored rhinoceros with a broad rectangular shield on its back',
    flavor: 'たて×よこ。この一行が、広さのすべてだと知っている。' },
  { subtopic: 'L字型の面積', name: 'エルジオン', reason: 'つまずき',
    motif:
      'a large golden tile-armored beast with an angular L-shaped crest',
    flavor: '分けて考える。むずかしい形ほど、その力が生きる。' },

  // ---- 小数のかけ算とわり算 ----
  { subtopic: '小数×整数(小数第一位)', name: 'カケシオン', reason: '中核',
    motif:
      'a great blue wave-dragon with one tall crest along its back',
    flavor: '整数だと思って計算し、最後に点を打つ。その順番をまちがえない。' },
  { subtopic: '小数÷整数(小数第一位)', name: 'ワリシオン', reason: '中核',
    motif:
      'a great blue wave-dragon whose tail splits into flowing streams',
    flavor: '小数点は、わられる数の真上におろす。' },
  { subtopic: 'わり進むわり算', name: 'ススムオン', reason: 'つまずき',
    motif:
      'a very long blue wave-dragon with an endlessly trailing tail',
    flavor: 'わりきれるまで、0をつけてどこまでも進む。あきらめない姿。' },

  // ---- 分数 ----
  { subtopic: '真分数・仮分数・帯分数', name: 'サンキョウオン', reason: '中核',
    motif:
      'a regal pink dessert-guardian beast with a three-tiered cake crown',
    flavor: '見た目がちがっても、同じ数のことがある。それを見ぬく目。' },
  { subtopic: '数直線をよむ(1より大きい)', name: 'イチコエオン', reason: '土台',
    motif:
      'a graceful pink ribbon-dragon coiling past a glowing full loop',
    flavor: '1をこえた先にも目もりはつづく。こわがらずに歩いていける。' },
  { subtopic: '仮分数を帯分数に(標準)', name: 'カリオビオン', reason: '中核',
    motif:
      'a stately pink dessert-beast carrying a whole cake and a fan of slices',
    flavor: 'かけらの山を、まるごと何個ぶんかに整えなおす。' },
  { subtopic: '帯分数を仮分数に(標準)', name: 'オビカリオン', reason: '中核',
    motif:
      'a stately pink dessert-beast holding a neat spiral stack of equal slices',
    flavor: 'まるごとをかけらに戻す。計算しやすい形を、自分で選べる。' },
  { subtopic: '等しい分数(数直線)', name: 'ヒトシオン', reason: '土台',
    motif:
      'a pink ribbon-lion with two perfectly matched ribbon manes',
    flavor: '見た目のちがう2つが、数直線では重なる。5年生の約分・通分への入口。' },
  { subtopic: 'くり上がりのあるたし算', name: 'クリアガリュウ', reason: 'つまずき',
    motif:
      'a rose candy-dragon rising on a spiral of stacked gumdrops',
    flavor: 'かけらが1つ分たまったら、まるごとへ。分数のいちばん高い山をこえた証。' },
  { subtopic: 'くり下がりのあるひき算', name: 'クリサガリュウ', reason: 'つまずき',
    motif:
      'a rose candy-dragon breaking a great sphere into descending pieces',
    flavor: '足りないときは、まるごとをくずす。その勇気を持った者だけの姿。' },

  // ---- 変わり方調べ ----
  { subtopic: '変わり方と表', name: 'カワリオン', reason: '中核',
    motif:
      'a large violet phoenix with a long tail arcing upward in a smooth curve',
    flavor: '2つの数のつながりを見つけて、まだ来ていない先を読む。' },

  // ---- 直方体と立方体 ----
  { subtopic: '展開図', name: 'テンカイオン', reason: '中核',
    motif:
      'a great golden cube-golem unfolding into radiant angular plates',
    flavor: '頭の中で、開いたり閉じたりできる。立体を見る目。' },
  { subtopic: '位置の表し方', name: 'イチシメオン', reason: '土台',
    motif:
      'a great golden cube-golem with three glowing axis spears on its back',
    flavor: 'たて・よこ・高さ。3つの数だけで、どこにいるかを伝えられる。' },

  // ---- 倍の見方 ----
  { subtopic: '何倍かを求める(きほん)', name: 'ナンバイオン', reason: '土台',
    motif:
      'a large green forest squirrel-beast with a mane of leaves and two great acorns',
    flavor: 'くらべられる量 ÷ もとにする量。5年の割合へつづく道の入口。' },
  { subtopic: 'もとにする量を求める(きほん)', name: 'モトリョウオン', reason: 'つまずき',
    motif:
      'a large green forest squirrel-beast standing on a great glowing root',
    flavor: 'どちらが「もと」なのか。そこを取りちがえない者だけが、この姿を見る。' },
  { subtopic: '割合でくらべる(差のわな)', name: 'サノワナオン', reason: 'つまずき',
    motif:
      'a large green forest squirrel-beast holding two leaves of clearly different size',
    flavor: '差で見るか、倍で見るか。公平なくらべ方を選べる目を持つ。' },
];

/** サブトピック名 → 進化定義 */
export const EVOLUTION_BY_SUBTOPIC: Record<string, EvolutionDef> = Object.fromEntries(
  EVOLUTIONS.map(e => [e.subtopic, e]),
);

export const hasEvolution = (subtopic: string): boolean => subtopic in EVOLUTION_BY_SUBTOPIC;
