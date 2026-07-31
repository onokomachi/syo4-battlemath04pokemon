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
    motif: 'a majestic owl-like creature wearing a scholar mantle, holding a glowing open scroll',
    flavor: '兆をこえる数でも、ひと目で読みあげる。ヨミィが読みの力を極めた姿。' },
  { subtopic: '数直線(億・兆)', name: 'メモリューガ', reason: '土台',
    motif: 'a long elegant serpent-like creature whose body is a glowing measured ribbon with tick marks',
    flavor: '体が一本の数直線になった。どんな大きさの数も、その上に置ける。' },
  { subtopic: '3けた×3けたのかけ算', name: 'サンケタイガ', reason: '中核',
    motif: 'a sturdy armored beast with three rows of glowing abacus beads across its chest',
    flavor: '3列の玉を同時に弾いて、大きなかけ算を一気に片づける。' },

  // ---- 折れ線グラフと表 ----
  { subtopic: '折れ線グラフのよみとり', name: 'オレセンフウ', reason: '中核',
    motif: 'a graceful long-tailed bird whose tail traces a bright rising zigzag line in the air',
    flavor: '飛んだあとに残る線で、これから何が起きるかを教えてくれる。' },
  { subtopic: '二次元表に整理する', name: 'セイリオン', reason: '中核',
    motif: 'a calm lion-like creature with a glowing grid pattern woven into its mane',
    flavor: 'たてとよこ、両方から見わたして、散らかった数をきれいに並べる。' },

  // ---- わり算の筆算(÷1けた) ----
  { subtopic: 'あまりのあるわり算', name: 'アマリオン', reason: '土台',
    motif: 'a noble beast carrying one glowing fragment on its back like a treasure',
    flavor: '「わりきれない」ことを、こわがらなくなった姿。あまりは大事な答えの一部。' },
  { subtopic: '2けた÷1けた', name: 'ニケタード', reason: '中核',
    motif: 'a two-tiered guardian creature with a bracket-shaped helm and steady stance',
    flavor: 'たてる・かける・ひく・おろす。4つの動きが体にしみこんでいる。' },
  { subtopic: '3けた÷1けた', name: 'ミケタード', reason: '中核',
    motif: 'a three-tiered guardian creature with a long bracket-shaped crest',
    flavor: 'けたが増えても、やることは同じだと知っている。' },
  { subtopic: '商に0がたつわり算', name: 'ゼロタツオー', reason: 'つまずき',
    motif: 'a proud creature holding a large glowing zero ring above its head like a halo',
    flavor: '0を書きわすれない。それだけで、答えはまったく変わってしまうから。' },
  { subtopic: 'あまりを切り上げる', name: 'キリアゲル', reason: 'つまずき',
    motif: 'a strong creature lifting a heavy crate upward with a determined expression',
    flavor: '「もう1つ必要だ」と気づける子にだけ、この姿を見せる。' },

  // ---- 角の大きさ ----
  { subtopic: '分度器と角', name: 'ブンドキング', reason: '中核',
    motif: 'a regal creature with a large golden protractor arc forming a crown behind its head',
    flavor: '0°の線をどこに合わせるか、まよったことがない。' },
  { subtopic: '180°をこえる角', name: 'オオカクオン', reason: '土台',
    motif: 'a majestic creature spreading a huge fan-shaped wing far past a half circle',
    flavor: '角とは「回った量」。そう分かった瞬間に、この姿になった。' },

  // ---- 小数のしくみ ----
  { subtopic: '数直線を読む', name: 'ミズモリュウ', reason: '土台',
    motif: 'a flowing water dragon whose body is marked with fine glowing measurement ticks',
    flavor: '1と2のあいだにも、数がぎっしりある。それを泳ぎながら数えられる。' },
  { subtopic: '何十倍・何分の一', name: 'バイブンガ', reason: '土台',
    motif: 'a shimmering creature surrounded by expanding and contracting rings of light',
    flavor: '10倍も10分の1も、位が動くだけだと知っている。' },
  { subtopic: '小数のたし算(けたがちがう)', name: 'ズレタシオン', reason: 'つまずき',
    motif: 'a water creature holding two droplets perfectly aligned on a glowing vertical line',
    flavor: '小数点をそろえる。ただそれだけを、けっして忘れない。' },
  { subtopic: '小数のひき算(空位に注意)', name: 'クウイオン', reason: 'つまずき',
    motif: 'a translucent water creature with one glowing empty slot filled by a shining zero',
    flavor: '空っぽの位に0を入れる。見えないものを見る力。' },

  // ---- わり算の筆算(÷2けた) ----
  { subtopic: '仮の商の見当', name: 'カリショウガ', reason: '中核',
    motif: 'a sharp-eyed hawk-like creature peering through a glowing telescope ring',
    flavor: '遠くから数を見て、だいたいの答えをあてる。当たらなくても、あわてない。' },
  { subtopic: '2けた÷2けた', name: 'フタケタード', reason: '中核',
    motif: 'twin-headed guardian creature sharing one bracket-shaped crest',
    flavor: '2けたでわることに、もう ひるまない。' },
  { subtopic: '3けた÷2けた', name: 'ミツケタード', reason: '中核',
    motif: 'a large three-tiered guardian creature with twin bracket crests',
    flavor: '大きな数ほど、手順のありがたみがわかる。' },
  { subtopic: '仮の商の修正', name: 'ナオシオン', reason: 'つまずき',
    motif: 'a gentle creature holding a glowing eraser orb, calmly correcting a floating number',
    flavor: '直すことは、まちがえたことより ずっと えらい。' },

  // ---- がい数 ----
  { subtopic: '指定の位までのがい数', name: 'シテイオン', reason: '中核',
    motif: 'a cloud beast with one sharply focused glowing digit and the rest softly blurred',
    flavor: 'どの位で切るかを決めれば、あとは迷わない。' },
  { subtopic: '上から2けたのがい数', name: 'ウエフタガ', reason: '中核',
    motif: 'a cloud beast whose upper two segments shine clearly above a misty body',
    flavor: '上から2つだけを、くっきりと見せる。' },
  { subtopic: '十の位までのはんい', name: 'ハンイオン', reason: '土台',
    motif: 'a cloud guardian standing between two tall glowing boundary pillars',
    flavor: '「以上」と「未満」のちがいが、体で分かっている。' },
  { subtopic: 'かけ算の見積もり', name: 'ミツカケオン', reason: '土台',
    motif: 'a cloud beast with a great glowing multiplication kite soaring above it',
    flavor: 'だいたいの答えを、計算する前に言いあてる。' },

  // ---- 計算のきまり ----
  { subtopic: '計算の順じょ', name: 'ジュンジョギア', reason: '土台',
    motif: 'a grand clockwork beast with numbered brass gears turning in perfect order',
    flavor: '世界じゅうのだれが計算しても同じ答えになる。その約束を守る番人。' },
  { subtopic: '計算のくふう', name: 'クフウギアード', reason: '土台',
    motif: 'a clever clockwork beast rearranging its own glowing gears mid-motion',
    flavor: '歯車を組みかえて、長い計算を一瞬で終わらせる。' },

  // ---- 面積 ----
  { subtopic: '長方形の面積', name: 'チョウホウオン', reason: '中核',
    motif: 'a mighty tile golem beast whose body is built from glowing unit squares',
    flavor: 'たて×よこ。この一行が、広さのすべてだと知っている。' },
  { subtopic: 'L字型の面積', name: 'エルジオン', reason: 'つまずき',
    motif: 'an L-shaped crystal golem beast splitting into two glowing rectangles',
    flavor: '分けて考える。むずかしい形ほど、その力が生きる。' },

  // ---- 小数のかけ算とわり算 ----
  { subtopic: '小数×整数(小数第一位)', name: 'カケシオン', reason: '中核',
    motif: 'a sleek sea creature riding a tall wave, a glowing decimal point on its brow',
    flavor: '整数だと思って計算し、最後に点を打つ。その順番をまちがえない。' },
  { subtopic: '小数÷整数(小数第一位)', name: 'ワリシオン', reason: '中核',
    motif: 'a sea creature cleanly splitting a wave into equal glowing parts',
    flavor: '小数点は、わられる数の真上におろす。' },
  { subtopic: 'わり進むわり算', name: 'ススムオン', reason: 'つまずき',
    motif: 'a determined deep-diving creature descending past a glowing decimal point',
    flavor: 'わりきれるまで、0をつけてどこまでも進む。あきらめない姿。' },

  // ---- 分数 ----
  { subtopic: '真分数・仮分数・帯分数', name: 'サンキョウオン', reason: '中核',
    motif: 'a three-crowned cake guardian beast holding three different glowing fraction forms',
    flavor: '見た目がちがっても、同じ数のことがある。それを見ぬく目。' },
  { subtopic: '数直線をよむ(1より大きい)', name: 'イチコエオン', reason: '土台',
    motif: 'a radiant creature striding past a glowing number-one gate onto a marked path',
    flavor: '1をこえた先にも目もりはつづく。こわがらずに歩いていける。' },
  { subtopic: '仮分数を帯分数に(標準)', name: 'カリオビオン', reason: '中核',
    motif: 'a cake guardian gathering many glowing slices into whole rounds plus one piece',
    flavor: 'かけらの山を、まるごと何個ぶんかに整えなおす。' },
  { subtopic: '帯分数を仮分数に(標準)', name: 'オビカリオン', reason: '中核',
    motif: 'a cake guardian breaking whole rounds back into a tall stack of glowing slices',
    flavor: 'まるごとをかけらに戻す。計算しやすい形を、自分で選べる。' },
  { subtopic: '等しい分数(数直線)', name: 'ヒトシオン', reason: '土台',
    motif: 'twin radiant creatures standing on the very same point of a glowing number line',
    flavor: '見た目のちがう2つが、数直線では重なる。5年生の約分・通分への入口。' },
  { subtopic: 'くり上がりのあるたし算', name: 'クリアガリュウ', reason: 'つまずき',
    motif: 'a soaring dragon-like creature lifting one glowing whole cake into the sky',
    flavor: 'かけらが1つ分たまったら、まるごとへ。分数のいちばん高い山をこえた証。' },
  { subtopic: 'くり下がりのあるひき算', name: 'クリサガリュウ', reason: 'つまずき',
    motif: 'a powerful dragon-like creature breaking one glowing whole cake into slices to share',
    flavor: '足りないときは、まるごとをくずす。その勇気を持った者だけの姿。' },

  // ---- 変わり方調べ ----
  { subtopic: '変わり方と表', name: 'カワリオン', reason: '中核',
    motif: 'a mystical clock-tower guardian beast with rotating rings of paired glowing numbers',
    flavor: '2つの数のつながりを見つけて、まだ来ていない先を読む。' },

  // ---- 直方体と立方体 ----
  { subtopic: '展開図', name: 'テンカイオン', reason: '中核',
    motif: 'a crystalline cube guardian unfolding into a glowing cross-shaped net in mid-air',
    flavor: '頭の中で、開いたり閉じたりできる。立体を見る目。' },
  { subtopic: '位置の表し方', name: 'イチシメオン', reason: '土台',
    motif: 'a cube guardian standing at the origin of three glowing coordinate arrows',
    flavor: 'たて・よこ・高さ。3つの数だけで、どこにいるかを伝えられる。' },

  // ---- 倍の見方 ----
  { subtopic: '何倍かを求める(きほん)', name: 'ナンバイオン', reason: '土台',
    motif: 'a great tree beast with glowing rings marking multiples along its trunk',
    flavor: 'くらべられる量 ÷ もとにする量。5年の割合へつづく道の入口。' },
  { subtopic: 'もとにする量を求める(きほん)', name: 'モトリョウオン', reason: 'つまずき',
    motif: 'a colossal tree beast with vast glowing roots spreading beneath the ground',
    flavor: 'どちらが「もと」なのか。そこを取りちがえない者だけが、この姿を見る。' },
  { subtopic: '割合でくらべる(差のわな)', name: 'サノワナオン', reason: 'つまずき',
    motif: 'a wise vine beast holding a perfectly balanced pair of glowing ratio scales',
    flavor: '差で見るか、倍で見るか。公平なくらべ方を選べる目を持つ。' },
];

/** サブトピック名 → 進化定義 */
export const EVOLUTION_BY_SUBTOPIC: Record<string, EvolutionDef> = Object.fromEntries(
  EVOLUTIONS.map(e => [e.subtopic, e]),
);

export const hasEvolution = (subtopic: string): boolean => subtopic in EVOLUTION_BY_SUBTOPIC;
