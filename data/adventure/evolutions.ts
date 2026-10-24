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
      'A large, majestic hornbill creature standing tall, with broad black wings folded like a cloak, a clean white chest and long white tail feathers.',
    flavor: '兆をこえる数でも、ひと目で読みあげる。ヨミィが読みの力を極めた姿。' },
  { subtopic: '数直線(億・兆)', name: 'メモリューガ', reason: '土台',
    motif:
      'A long, elegant serpent dragon flying in a graceful S-curve, its body coiled close so the whole shape stays compact.',
    flavor: '体が一本の数直線になった。どんな大きさの数も、その上に置ける。' },
  { subtopic: '3けた×3けたのかけ算', name: 'サンケタイガ', reason: '中核',
    motif:
      'A sleek, powerful white tiger creature in a low, ready-to-pounce stance, with a long muscular body, a thick tail and sharp ear tufts.',
    flavor: '3列の玉を同時に弾いて、大きなかけ算を一気に片づける。' },

  // ---- 折れ線グラフと表 ----
  { subtopic: '折れ線グラフのよみとり', name: 'オレセンフウ', reason: '中核',
    motif:
      'a large violet falcon with one long curved tail feather trailing light',
    flavor: '飛んだあとに残る線で、これから何が起きるかを教えてくれる。' },
  { subtopic: '二次元表に整理する', name: 'セイリオン', reason: '中核',
    motif:
      'A tall, elegant secretary-bird creature on long powerful legs, with a crest of long quill-pen feathers, and folded wings whose feathers are patterned in a neat woven grid like a table.',
    flavor: 'たてとよこ、両方から見わたして、散らかった数をきれいに並べる。' },

  // ---- わり算の筆算(÷1けた) ----
  { subtopic: 'あまりのあるわり算', name: 'アマリオン', reason: '土台',
    motif:
      'A lean, four-legged volcanic hare beast crouched low and ready to sprint.',
    flavor: '「わりきれない」ことを、こわがらなくなった姿。あまりは大事な答えの一部。' },
  { subtopic: '2けた÷1けた', name: 'ニケタード', reason: '中核',
    motif:
      'A big, powerful snail creature with a tall two-tiered tower shell armored like a castle keep, with four glowing windows, one on each side, and a broad, muscular lavender-gray body with a strong armored head plate.',
    flavor: 'たてる・かける・ひく・おろす。4つの動きが体にしみこんでいる。' },
  { subtopic: '3けた÷1けた', name: 'ミケタード', reason: '中核',
    motif:
      'A tall, elegant giraffe-like dragon creature on long powerful legs, with a long neck divided into three sections by glowing bands, two swept-back horns and a short mane of dark fur along its neck.',
    flavor: 'けたが増えても、やることは同じだと知っている。' },
  { subtopic: '商に0がたつわり算', name: 'ゼロタツオー', reason: 'つまずき',
    motif:
      'A powerful, heavily built horned-lizard dragon on four thick legs, with a broad armored frill around its neck like a ring of stone horns.',
    flavor: '0を書きわすれない。それだけで、答えはまったく変わってしまうから。' },
  { subtopic: 'あまりを切り上げる', name: 'キリアゲル', reason: 'つまずき',
    motif:
      'A muscular, proud ibex creature with enormous ridged horns sweeping up and back in a tall arc.',
    flavor: '「もう1つ必要だ」と気づける子にだけ、この姿を見せる。' },

  // ---- 角の大きさ ----
  { subtopic: '分度器と角', name: 'ブンドキング', reason: '中核',
    motif:
      'a regal golden crystal beast with a protractor-shaped halo crown and long horns',
    flavor: '0°の線をどこに合わせるか、まよったことがない。' },
  { subtopic: '180°をこえる角', name: 'オオカクオン', reason: '土台',
    motif:
      'A great frilled dragon standing on four powerful legs, with a huge fan-shaped frill that opens almost all the way around its head like a turning dial, a long tail and a sharp crest.',
    flavor: '角とは「回った量」。そう分かった瞬間に、この姿になった。' },

  // ---- 小数のしくみ ----
  { subtopic: '数直線を読む', name: 'ミズモリュウ', reason: '土台',
    motif:
      'A graceful ribbon-eel dragon creature swimming in a smooth S-curve with its body coiled close, a long tick-marked dorsal fin running from head to tail, a flared nose and two short horns.',
    flavor: '1と2のあいだにも、数がぎっしりある。それを泳ぎながら数えられる。' },
  { subtopic: '何十倍・何分の一', name: 'バイブンガ', reason: '土台',
    motif:
      'A great koi dragon creature swimming upward in a powerful curve, with long flowing fins, two long whiskers, two short antler-like horns and a dragon-like head.',
    flavor: '10倍も10分の1も、位が動くだけだと知っている。' },
  { subtopic: '小数のたし算(けたがちがう)', name: 'ズレタシオン', reason: 'つまずき',
    motif:
      'A large, elegant water strider knight creature standing high on long, perfectly aligned legs, with a glassy armored body, a sharp head crest and two front legs held like blades.',
    flavor: '小数点をそろえる。ただそれだけを、けっして忘れない。' },
  { subtopic: '小数のひき算(空位に注意)', name: 'クウイオン', reason: 'つまずき',
    motif:
      'a translucent blue water-lion with a glowing hollow ring in its chest',
    flavor: '空っぽの位に0を入れる。見えないものを見る力。' },

  // ---- わり算の筆算(÷2けた) ----
  { subtopic: '仮の商の見当', name: 'カリショウガ', reason: '中核',
    motif:
      'A large armored clockwork scorpion knight with heavy brass plating, two broad pincers and a long segmented tail curving high overhead to a sharp pointer tip, standing in a steady aiming stance.',
    flavor: '遠くから数を見て、だいたいの答えをあてる。当たらなくても、あわてない。' },
  { subtopic: '2けた÷2けた', name: 'フタケタード', reason: '中核',
    motif:
      'A large armored clockwork crocodile with two big gear-shaped crests side by side on its back, long jaws, a heavy armored tail and a low, powerful stance.',
    flavor: '2けたでわることに、もう ひるまない。' },
  { subtopic: '3けた÷2けた', name: 'ミツケタード', reason: '中核',
    motif:
      'A large armored trilobite knight creature with a broad shell of three glowing lobes, a crescent-shaped head shield with two short horns and many strong legs.',
    flavor: '大きな数ほど、手順のありがたみがわかる。' },
  { subtopic: '仮の商の修正', name: 'ナオシオン', reason: 'つまずき',
    motif:
      'A large armored tapir creature with a broad trunk ending in a big eraser tip, a sturdy body with heat-proof plates on its shoulders and strong legs.',
    flavor: '直すことは、まちがえたことより ずっと えらい。' },

  // ---- がい数 ----
  { subtopic: '指定の位までのがい数', name: 'シテイオン', reason: '中核',
    motif:
      'A large, sleek deep-sea angler dragon swimming forward with a long curved lure stalk arching over its head to a bright glowing lantern tip, broad fan-like fins, a long powerful tail and a strong jaw lined with neat rows of teeth.',
    flavor: 'どの位で切るかを決めれば、あとは迷わない。' },
  { subtopic: '上から2けたのがい数', name: 'ウエフタガ', reason: '中核',
    motif:
      'a great cream cloud-stag with two tall glowing antlers',
    flavor: '上から2つだけを、くっきりと見せる。' },
  { subtopic: '十の位までのはんい', name: 'ハンイオン', reason: '土台',
    motif:
      'An elegant, large bat creature with broad wings spread wide in a commanding pose, tall pointed ears and a sleek, narrow face.',
    flavor: '「以上」と「未満」のちがいが、体で分かっている。' },
  { subtopic: 'かけ算の見積もり', name: 'ミツカケオン', reason: '土台',
    motif:
      'a great cream cloud-phoenix with layered overlapping wings',
    flavor: 'だいたいの答えを、計算する前に言いあてる。' },

  // ---- 計算のきまり ----
  { subtopic: '計算の順じょ', name: 'ジュンジョギア', reason: '土台',
    motif:
      'A large clockwork stag beetle knight with long armored jaws, a big wind-up key on its back and three great interlocking gears set into its shell, turning in order.',
    flavor: '世界じゅうのだれが計算しても同じ答えになる。その約束を守る番人。' },
  { subtopic: '計算のくふう', name: 'クフウギアード', reason: '土台',
    motif:
      'A sleek clockwork mongoose creature with a long low body, a spine of interlocking gears and a long tail wrapped in a belt drive, standing alert on its hind legs.',
    flavor: '歯車を組みかえて、長い計算を一瞬で終わらせる。' },

  // ---- 面積 ----
  { subtopic: '長方形の面積', name: 'チョウホウオン', reason: '中核',
    motif:
      'A mighty rhinoceros golem creature on four pillar legs, whose broad rectangular body is armored in a neat grid of large tiles, with a heavy rectangular horn plate on its nose and a low, unstoppable stance.',
    flavor: 'たて×よこ。この一行が、広さのすべてだと知っている。' },
  { subtopic: 'L字型の面積', name: 'エルジオン', reason: 'つまずき',
    motif:
      'A great block-built brachiosaurus golem creature with an L-shaped silhouette, its tall neck and long body built from fitted rectangular stone blocks, standing on four pillar legs with a strong blunt head.',
    flavor: '分けて考える。むずかしい形ほど、その力が生きる。' },

  // ---- 小数のかけ算とわり算 ----
  { subtopic: '小数×整数(小数第一位)', name: 'カケシオン', reason: '中核',
    motif:
      'A sleek, powerful river otter creature in a fast swimming dash, with a long streamlined body, webbed paws, a thick rudder-like tail and a fin-like crest of slicked-back fur on its head.',
    flavor: '整数だと思って計算し、最後に点を打つ。その順番をまちがえない。' },
  { subtopic: '小数÷整数(小数第一位)', name: 'ワリシオン', reason: '中核',
    motif:
      'A majestic narwhal creature diving upward in a graceful arc, with a long, perfectly straight spiral tusk pointing to the sky, a powerful tail fluke and broad side flippers.',
    flavor: '小数点は、わられる数の真上におろす。' },
  { subtopic: 'わり進むわり算', name: 'ススムオン', reason: 'つまずき',
    motif:
      'A great ocean-voyager sea turtle creature gliding forward with huge wing-like front flippers spread wide, a streamlined ridged shell and a strong beaked head.',
    flavor: 'わりきれるまで、0をつけてどこまでも進む。あきらめない姿。' },

  // ---- 分数 ----
  { subtopic: '真分数・仮分数・帯分数', name: 'サンキョウオン', reason: '中核',
    motif:
      'An elegant moth creature with a fluffy white collar, feathery antennae and four broad wings, each wing banded in three colors: pink, white and soft green.',
    flavor: '見た目がちがっても、同じ数のことがある。それを見ぬく目。' },
  { subtopic: '数直線をよむ(1より大きい)', name: 'イチコエオン', reason: '土台',
    motif:
      'An agile, powerful kangaroo creature leaping forward on huge hind legs, with a thick tail held straight out for balance, long ears and a lean athletic body.',
    flavor: '1をこえた先にも目もりはつづく。こわがらずにとんでいける。' },
  { subtopic: '仮分数を帯分数に(標準)', name: 'カリオビオン', reason: '中核',
    motif:
      'A sleek, large bee creature hovering in a confident stance, with a long striped abdomen, four clear wings patterned with neat hexagon cells like honeycomb, and armored forelegs.',
    flavor: 'かけらの山を、まるごと何個ぶんかに整えなおす。' },
  { subtopic: '帯分数を仮分数に(標準)', name: 'オビカリオン', reason: '中核',
    motif:
      'A proud ram creature standing tall on strong legs, with two big spiral horns patterned like rolled wafers, and a thick coat of dark cocoa-brown cream-puff-shaped wool.',
    flavor: 'まるごとをかけらに戻す。計算しやすい形を、自分で選べる。' },
  { subtopic: '等しい分数(数直線)', name: 'ヒトシオン', reason: '土台',
    motif:
      'A tall, elegant serval-like cat creature on long legs, with huge upright ears, a slender body and a long tail, perfectly symmetrical in shape, but with its left side striped and its right side spotted.',
    flavor: '見た目のちがう2つが、数直線では重なる。5年生の約分・通分への入口。' },
  { subtopic: 'くり上がりのあるたし算', name: 'クリアガリュウ', reason: 'つまずき',
    motif:
      'A sleek, rising dessert dragon creature standing tall, its body built from neat stacked layers like a mille-feuille, with thin crisp pastry plates and cream between them, two swept-back horns and broad wings held high.',
    flavor: 'かけらが1つ分たまったら、まるごとへ。分数のいちばん高い山をこえた証。' },
  { subtopic: 'くり下がりのあるひき算', name: 'クリサガリュウ', reason: 'つまずき',
    motif:
      'A powerful four-legged dragon creature with an armored back of chocolate-bar plates in a neat grid, with one plate broken off cleanly into smaller square pieces still attached at its shoulder.',
    flavor: '足りないときは、まるごとをくずす。その勇気を持った者だけの姿。' },

  // ---- 変わり方調べ ----
  { subtopic: '変わり方と表', name: 'カワリオン', reason: '中核',
    motif:
      'A tall heron-like creature shaped like a slender clock tower, with a round clock face on its chest, a pointed tower roof as its crest and a long tail ending in a round pendulum weight.',
    flavor: '2つの数のつながりを見つけて、まだ来ていない先を読む。' },

  // ---- 直方体と立方体 ----
  { subtopic: '展開図', name: 'テンカイオン', reason: '中核',
    motif:
      'A great origami dragon whose body is a folded paper cube and whose wings unfold into a flat cross-shaped pattern like the net of a cube, with an angular folded head and tail.',
    flavor: '頭の中で、開いたり閉じたりできる。立体を見る目。' },
  { subtopic: '位置の表し方', name: 'イチシメオン', reason: '土台',
    motif:
      'A great armored beetle creature with three long straight horns: one pointing forward, one pointing up and one pointing sideways, like the three axes of a graph, and a broad glossy shell.',
    flavor: 'たて・よこ・高さ。3つの数だけで、どこにいるかを伝えられる。' },

  // ---- 倍の見方 ----
  { subtopic: '何倍かを求める(きほん)', name: 'ナンバイオン', reason: '土台',
    motif:
      'A tall bamboo dragon creature standing upright on two strong legs, its long body made of evenly spaced bamboo segments, with narrow bamboo-leaf blades on its shoulders and tail and a sheath-like helmet crest.',
    flavor: 'くらべられる量 ÷ もとにする量。5年の割合へつづく道の入口。' },
  { subtopic: 'もとにする量を求める(きほん)', name: 'モトリョウオン', reason: 'つまずき',
    motif:
      'A mighty oak bear creature standing upright, with legs like thick tree roots spreading into the ground shape at its feet, a body of bark armor, and an acorn-cap helmet on its head.',
    flavor: 'どちらが「もと」なのか。そこを取りちがえない者だけが、この姿を見る。' },
  { subtopic: '割合でくらべる(差のわな)', name: 'サノワナオン', reason: 'つまずき',
    motif:
      'A great flytrap dragon creature on four powerful legs, whose huge head is a pair of Venus flytrap jaw leaves lined with spines, with vine-like tendrils along its back and a long tail.',
    flavor: '差で見るか、倍で見るか。公平なくらべ方を選べる目を持つ。' },
];

/** サブトピック名 → 進化定義 */
export const EVOLUTION_BY_SUBTOPIC: Record<string, EvolutionDef> = Object.fromEntries(
  EVOLUTIONS.map(e => [e.subtopic, e]),
);

export const hasEvolution = (subtopic: string): boolean => subtopic in EVOLUTION_BY_SUBTOPIC;
