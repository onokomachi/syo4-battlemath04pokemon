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
import { holeRatio, blobCount, raggedness, edgeBrightness, chromaScore } from './sprite-image.mjs';

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

/**
 * out名 → 撮影に使ったクロマ色。
 *
 * タイプが緑寄り(くさタイプなど)のモンスターは、背景を緑にすると体まで
 * 抜けてしまうため、生成時にマゼンタ背景へ切りかえている(spriteJobs.ts の
 * isGreenish)。「緑の抜け残り」を一律に緑画素の割合で見ると、これらの
 * 正しい緑色の体が軒並み誤検出される(実測で最大81%!)。
 * マニフェストから実際の撮影色を引き、その色の抜け残りだけを見る。
 */
const MANIFEST_PATH = path.join(import.meta.dirname, 'sprite-manifest.json');
const CHROMA_BY_OUT = new Map(
  existsSync(MANIFEST_PATH)
    ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')).map(j => [j.out, j.chroma ?? 'green'])
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

const files = walk(ROOT).filter(f => !f.includes(`${path.sep}terrain${path.sep}`));
const bad = [];

for (const file of files) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rel = path.relative(ROOT, file);
  const out = rel.replace(/\.png$/, '').split(path.sep).join('/');
  const chroma = CHROMA_BY_OUT.get(out) ?? 'green';

  let opaque = 0;
  let residue = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    opaque++;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // 実際に撮影に使ったクロマ色だけを「抜け残り」候補とみなす。
    // 緑タイプのキャラをマゼンタで撮った絵は、体が緑でも問題ない。
    if (chromaScore(chroma, r, g, b) > 26) residue++;
  }
  const total = info.width * info.height;
  const fill = opaque / total;
  const residueRatio = opaque ? residue / opaque : 0;
  const holes = holeRatio(data, info.width, info.height);
  const blobs = blobCount(data, info.width, info.height);
  const ragged = raggedness(data, info.width, info.height);
  const edge = edgeBrightness(data, info.width, info.height);

  const problems = [];
  // 手用意の絵は、人が見て決めたものなので機械の判定にかけない
  const manual = MANUAL.has(out);
  if (manual) {
    if (!ONLY_BAD) console.log(`— ${rel}  (手用意のため検査しない)`);
    continue;
  }
  if (residueRatio > 0.08) problems.push(`${chroma === 'magenta' ? 'マゼンタ' : '緑'}の抜け残り ${(residueRatio * 100).toFixed(0)}%`);
  if (fill > 0.9) problems.push(`背景が抜けていない (${(fill * 100).toFixed(0)}%)`);
  // 10%を切るものは、目で見ると「体を食われた残骸」になっている
  if (fill < 0.10) problems.push(`体が食われている (${(fill * 100).toFixed(0)}%)`);
  if (holes > 0.02) problems.push(`内側が食われている ${(holes * 100).toFixed(1)}%`);
  if (blobs >= 2) problems.push(`複数キャラが描かれている (${blobs}体)`);
  if (ragged > 9) problems.push(`輪郭が食われている (ぼろぼろ度 ${ragged.toFixed(1)})`);
  if (edge > 150) problems.push(`背景の板が残っている (ふちの明るさ ${edge.toFixed(0)})`);

  if (problems.length) bad.push({ rel, problems });
  if (!ONLY_BAD) {
    console.log(`${problems.length ? '✗' : '✓'} ${rel}  fill=${(fill * 100).toFixed(0)}% ${chroma}=${(residueRatio * 100).toFixed(0)}% holes=${(holes * 100).toFixed(1)}% blobs=${blobs} ragged=${ragged.toFixed(1)} edge=${edge.toFixed(0)}`);
  }
}

console.log(`\n検査 ${files.length}枚 / 要確認 ${bad.length}枚`);
for (const b of bad) console.log(`  - ${b.rel}: ${b.problems.join(', ')}`);
if (bad.length) {
  console.log('\n作り直すには:');
  console.log(bad.map(b => `  node scripts/gen-cf-sprites.mjs --force --only ${b.rel.replace(/\\/g, '/').replace('.png', '')}`).join('\n'));
}
