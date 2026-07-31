/**
 * check-sprites.mjs — 生成したスプライトの品質を機械的に検査する。
 *
 * 目視だけだと 200枚以上を見きれないので、次の3点を自動で拾う。
 *   ① 背景の抜け残り: 不透明なのに緑がかった画素が多い
 *   ② 抜きすぎ / 抜けなさすぎ: 不透明画素の割合が極端
 *   ③ 「食われ」: キャラの内側に穴が空いている(外周とつながっていない透明画素)
 *      — 旧い背景除去(四隅の色を基準にする方式)で、白い体のキャラが
 *        背景と同一視されて内側から溶けた場合に出る。見た目にいちばん響く。
 *   ④ 「複数キャラ」: 大きな不透明のかたまりが2つ以上ある
 *      — 生成が1体に収まらず、小さい仲間や分身を並べてしまった場合。
 *        画面では「1体のモンスター」として扱うので必ず作り直す。
 *
 *   node scripts/check-sprites.mjs            # 一覧
 *   node scripts/check-sprites.mjs --bad      # 問題のあるものだけ
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * 手で用意した絵は検査しない。
 *
 * 翼をひろげた竜や炎のように、輪郭がもともと複雑な絵は
 * 「ぼろぼろ度」や「内側の穴」で落ちてしまう。これらの検査は
 * 生成AIの失敗を拾うためのものなので、人が見て決めた絵には当てない。
 */
const MANUAL = new Set(
  existsSync(path.join(import.meta.dirname, 'manual-sprites.json'))
    ? JSON.parse(readFileSync(path.join(import.meta.dirname, 'manual-sprites.json'), 'utf8'))
    : [],
);

const root = path.resolve(import.meta.dirname, '..');
const ROOT = path.join(root, 'public', 'assets', 'adventure');
const ONLY_BAD = process.argv.includes('--bad');

const walk = dir => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.png')) out.push(p);
  }
  return out;
};

/**
 * 内側の穴の割合。外周からの塗りつぶしで届かない透明画素を数える。
 * 正常なスプライトでも、腕と胴のすきま等で少しは出るので、閾値は緩めに取る。
 */
const holeRatio = (data, w, h) => {
  const transparent = i => data[i * 4 + 3] < 40;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p] || !transparent(p)) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  let holes = 0, transparentTotal = 0;
  for (let p = 0; p < w * h; p++) {
    if (!transparent(p)) continue;
    transparentTotal++;
    if (!seen[p]) holes++;
  }
  return holes / (w * h);
};

/**
 * 大きな不透明のかたまりの数。2つ以上あれば「複数キャラが描かれた」とみなす。
 * 小さなかけら(全体の3%未満)は装飾やゴミなので数えない。
 */
/**
 * シルエットの「ぼろぼろ度」= 周囲長 / √面積。
 *
 * 背景除去がキャラを食うと、輪郭が外側とつながったまま細かく刻まれる。
 * こうなると「内側の穴」でも「塗りつぶし率」でも捕まらないが、
 * 周囲長だけが跳ね上がる。実測では、まともな絵は 3〜5、
 * 食われた絵は 11〜19 にはっきり分かれた。
 */
const raggedness = (data, w, h) => {
  const op = p => data[p * 4 + 3] > 40;
  let area = 0, per = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!op(p)) continue;
      area++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          !op(p - 1) || !op(p + 1) || !op(p - w) || !op(p + w)) per++;
    }
  }
  return area ? per / Math.sqrt(area) : 0;
};

/**
 * シルエットのふちの明るさ。
 *
 * ちゃんと切り抜けた絵は、まわりが「黒っぽい輪郭線」なのでふちが暗い。
 * 背景に丸い板を描かれると、その板は緑ではないので抜けずに残り、
 * ふちが板の色(たいてい明るい)になる。実測で、まともな絵のふちは
 * 平均40〜135、板が残った絵は186以上とはっきり分かれた。
 */
const edgeBrightness = (data, w, h) => {
  const op = p => data[p * 4 + 3] > 40;
  let sum = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!op(p)) continue;
      if (op(p - 1) && op(p + 1) && op(p - w) && op(p + w)) continue;
      sum += (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
      n++;
    }
  }
  return n ? sum / n : 0;
};

const blobCount = (data, w, h) => {
  const opaque = p => data[p * 4 + 3] > 40;
  const seen = new Uint8Array(w * h);
  const sizes = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !opaque(start)) continue;
    let size = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % w, y = (p / w) | 0;
      const push = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const q = ny * w + nx;
        if (seen[q] || !opaque(q)) return;
        seen[q] = 1;
        stack.push(q);
      };
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    sizes.push(size);
  }
  sizes.sort((a, b) => b - a);
  const biggest = sizes[0] ?? 0;
  // いちばん大きいかたまりの30%以上のものを「もう1体」と数える
  return sizes.filter(v => v > Math.max(w * h * 0.02, biggest * 0.3)).length;
};

const files = walk(ROOT).filter(f => !f.includes(`${path.sep}terrain${path.sep}`));
const bad = [];

for (const file of files) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  let greenish = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    opaque++;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // 緑が明確に優勢で、かつ彩度がある画素を「抜け残り」候補とみなす
    if (g > r + 26 && g > b + 26) greenish++;
  }
  const total = info.width * info.height;
  const fill = opaque / total;
  const greenRatio = opaque ? greenish / opaque : 0;
  const holes = holeRatio(data, info.width, info.height);
  const blobs = blobCount(data, info.width, info.height);
  const ragged = raggedness(data, info.width, info.height);
  const edge = edgeBrightness(data, info.width, info.height);
  const rel = path.relative(ROOT, file);

  const problems = [];
  // 手用意の絵は、人が見て決めたものなので機械の判定にかけない
  const manual = MANUAL.has(rel.replace(/\.png$/, ''));
  if (manual) {
    if (!ONLY_BAD) console.log(`— ${rel}  (手用意のため検査しない)`);
    continue;
  }
  if (greenRatio > 0.08) problems.push(`緑の抜け残り ${(greenRatio * 100).toFixed(0)}%`);
  if (fill > 0.9) problems.push(`背景が抜けていない (${(fill * 100).toFixed(0)}%)`);
  // 10%を切るものは、目で見ると「体を食われた残骸」になっている
  if (fill < 0.10) problems.push(`体が食われている (${(fill * 100).toFixed(0)}%)`);
  if (holes > 0.02) problems.push(`内側が食われている ${(holes * 100).toFixed(1)}%`);
  if (blobs >= 2) problems.push(`複数キャラが描かれている (${blobs}体)`);
  if (ragged > 9) problems.push(`輪郭が食われている (ぼろぼろ度 ${ragged.toFixed(1)})`);
  if (edge > 150) problems.push(`背景の板が残っている (ふちの明るさ ${edge.toFixed(0)})`);

  if (problems.length) bad.push({ rel, problems });
  if (!ONLY_BAD) {
    console.log(`${problems.length ? '✗' : '✓'} ${rel}  fill=${(fill * 100).toFixed(0)}% green=${(greenRatio * 100).toFixed(0)}% holes=${(holes * 100).toFixed(1)}% blobs=${blobs} ragged=${ragged.toFixed(1)} edge=${edge.toFixed(0)}`);
  }
}

console.log(`\n検査 ${files.length}枚 / 要確認 ${bad.length}枚`);
if (bad.some(b => b.problems.some(p => p.includes('緑')))) {
  console.log('※ もともと緑色のキャラ(緑の服・緑の体)は「緑の抜け残り」に誤検出されます。');
  console.log('  作り直す前に、実際の画像を目で見て判断してください。');
}
for (const b of bad) console.log(`  - ${b.rel}: ${b.problems.join(', ')}`);
if (bad.length) {
  console.log('\n作り直すには:');
  console.log(bad.map(b => `  node scripts/gen-sprites.mjs --force --only ${b.rel.replace(/\\/g, '/').replace('.png', '')}`).join('\n'));
}
