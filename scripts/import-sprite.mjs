/**
 * import-sprite.mjs — 手描き・手配布のイラストを、生成物と同じ形式で取りこむ。
 *
 * 生成AIに任せきれない絵(伝説のモンスターなど)は、外から用意した画像を
 * 使いたいことがある。そのとき問題になるのが「透過に見えて透過していない」
 * 画像で、市松模様(チェッカー柄)が画素として焼きこまれていることが多い。
 * このスクリプトはその市松模様を落として、他のスプライトと同じ
 * 256×256 の透過PNGにそろえる。
 *
 *   node scripts/import-sprite.mjs <入力画像> <出力名>
 *   node scripts/import-sprite.mjs ~/dl/ice.png monsters/legend-shosu
 *
 * 取りこんだ絵は scripts/manual-sprites.json に記録され、
 * gen-sprites.mjs が上書きしないようになる。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const OUT_ROOT = path.join(root, 'public', 'assets', 'adventure');
const MANUAL_LIST = path.join(root, 'scripts', 'manual-sprites.json');
const SPRITE_SIZE = 256;

const [input, outName] = process.argv.slice(2);
if (!input || !outName) {
  console.error('使い方: node scripts/import-sprite.mjs <入力画像> <出力名>');
  process.exit(1);
}

/**
 * 市松模様の背景を落とす。
 *
 * ふちから塗りつぶす方式は、模様の一部が圧縮ノイズでわずかに色づいていると
 * そこで止まってしまい、柄が帯状に残る(実際に残った)。
 * 市松模様は人工的な2色なので、つながりを見ずに「その2色に一致する画素」を
 * 全部消し、そのあと「外につながっていない透明部分」だけを塗りもどす。
 * こうすると、キャラの内側にある灰色(岩肌など)は穴として復元される。
 */
function removeChecker(data, w, h) {
  const at = (x, y) => (y * w + x) * 4;
  const lum = i => (data[i] + data[i + 1] + data[i + 2]) / 3;
  const sat = i =>
    Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
  const grey = i => sat(i) <= 14;

  // ふちにある灰色の明るさを集めて、市松の2色を拾う
  const tones = [];
  for (let x = 0; x < w; x += 2) {
    for (const y of [0, h - 1]) {
      const i = at(x, y);
      if (grey(i)) tones.push(lum(i));
    }
  }
  for (let y = 0; y < h; y += 2) {
    for (const x of [0, w - 1]) {
      const i = at(x, y);
      if (grey(i)) tones.push(lum(i));
    }
  }
  if (tones.length < 20) throw new Error('ふちに市松模様が見つからない');
  tones.sort((a, b) => a - b);
  const lo = tones[Math.floor(tones.length * 0.15)];
  const hi = tones[Math.floor(tones.length * 0.85)];
  console.log(`  市松模様: ${lo} と ${hi}`);

  // ① 市松模様とみなせる画素をすべて透明にする(つながりは見ない)
  //
  // 半透明の光が柄に重なると、柄がうっすら色づいて「灰色」判定から外れる。
  // 炎のキャラでこれが起き、翼のあいだに柄が残った。そこで彩度の許容を
  // ゆるめ、2色のあいだ(四角の境目のぼかし)も背景として扱う。
  const TOL = 24;
  const isChecker = i => {
    const s = sat(i);
    if (s > 44) return false;                       // はっきり色がついていれば絵の一部
    const v = lum(i);
    if (Math.abs(v - lo) <= TOL || Math.abs(v - hi) <= TOL) return true;
    return v > lo && v < hi && s <= 22;             // 四角の境目のぼかし
  };
  for (let p = 0; p < w * h; p++) {
    if (isChecker(p * 4)) data[p * 4 + 3] = 0;
  }

  // ② 外につながっていない小さな透明部分だけを塗りもどす。
  //
  // 「囲まれている＝キャラの内側」と単純に考えると、翼と胴のあいだのような
  // 大きな抜けまで塗りつぶしてしまい、そこに市松模様が残る(実際に残った)。
  // 岩肌の灰色などキャラ内部の抜けは小さいので、面積で分ける。
  const HOLE_MAX = Math.round(w * h * 0.0015);
  const seen = new Uint8Array(w * h);
  let restored = 0;
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || data[start * 4 + 3] !== 0) continue;
    const region = [];
    const stack = [start];
    seen[start] = 1;
    let touchesBorder = false;
    while (stack.length) {
      const p = stack.pop();
      region.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (seen[q] || data[q * 4 + 3] !== 0) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (touchesBorder || region.length > HOLE_MAX) continue;
    for (const p of region) { data[p * 4 + 3] = 255; restored++; }
  }
  if (restored) console.log(`  キャラ内側の灰色 ${restored}画素を塗りもどした`);
}

/**
 * 一色のクロマキー背景(グリーンバック)を落とす。
 *
 * 市松模様とちがい、こちらは色で見分けるだけでよい。JPEGだとふちに
 * 緑がにじむので、抜いたあとに残った緑かぶりも落としておく。
 */
function removeChroma(data, w, h, bg) {
  const at = (x, y) => (y * w + x) * 4;
  const greenish = i => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return g - Math.max(r, b) > 45;
  };

  const visited = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, 0); stack.push(x, h - 1); }
  for (let y = 0; y < h; y++) { stack.push(0, y); stack.push(w - 1, y); }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (visited[p]) continue;
    const i = p * 4;
    if (!greenish(i)) continue;
    visited[p] = 1;
    data[i + 3] = 0;
    stack.push(x + 1, y); stack.push(x - 1, y);
    stack.push(x, y + 1); stack.push(x, y - 1);
  }

  // 翼と胴のあいだのように「キャラに囲まれた背景」は、ふちからの
  // 塗りつぶしでは届かず、緑のまま残る。ここは色だけで判断して消す。
  // (取りこむ絵に緑色のキャラがいないことが前提。いる場合は
  //  グリーンバック以外で用意してもらう)
  let enclosed = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    if (greenish(i)) { data[i + 3] = 0; enclosed++; }
  }
  if (enclosed) console.log(`  囲まれた緑 ${enclosed}画素も消した`);

  // ふちの緑かぶりを落とす(JPEGのにじみ対策で2周ぶん)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = at(x, y);
        if (data[i + 3] === 0) continue;
        const touches =
          data[at(x + 1, y) + 3] === 0 || data[at(x - 1, y) + 3] === 0 ||
          data[at(x, y + 1) + 3] === 0 || data[at(x, y - 1) + 3] === 0;
        if (!touches) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (g > r && g > b) {
          const cap = Math.round((r + b) / 2);
          // 緑が強く残っている画素は、背景のにじみなので消してしまう
          if (g - Math.max(r, b) > 30) { data[i + 3] = 0; continue; }
          data[i + 1] = Math.max(cap, Math.round(g * 0.75));
        }
      }
    }
  }
  console.log(`  グリーンバック (${bg.r},${bg.g},${bg.b}) を抜いた`);
}

/** いちばん大きなかたまりだけ残す(隅の透かしなどを落とすため) */
function keepLargestBlob(data, w, h) {
  const opaque = p => data[p * 4 + 3] > 40;
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] >= 0 || !opaque(start)) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % w, y = (p / w) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (label[q] >= 0 || !opaque(q)) continue;
        label[q] = id;
        stack.push(q);
      }
    }
    sizes.push(size);
  }
  if (sizes.length <= 1) return;
  const biggest = sizes.indexOf(Math.max(...sizes));
  let dropped = 0;
  for (let p = 0; p < w * h; p++) {
    if (label[p] >= 0 && label[p] !== biggest) { data[p * 4 + 3] = 0; dropped++; }
  }
  if (dropped) console.log(`  小さなかたまり ${sizes.length - 1}個を落とした`);
}

function alphaBounds(data, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const src = sharp(input).ensureAlpha();
const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
console.log(`${input} → ${outName}`);

// 背景が「一色の緑」なのか「市松模様」なのかを、ふちの色から見分ける
{
  const w = info.width, h = info.height;
  const at = (x, y) => (y * w + x) * 4;
  const samples = [];
  for (let x = 0; x < w; x += 4) { samples.push(at(x, 0), at(x, h - 1)); }
  for (let y = 0; y < h; y += 4) { samples.push(at(0, y), at(w - 1, y)); }
  const med = ch => {
    const v = samples.map(i => data[i + ch]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const bg = { r: med(0), g: med(1), b: med(2) };
  if (bg.g - Math.max(bg.r, bg.b) > 60) removeChroma(data, w, h, bg);
  else removeChecker(data, w, h);
}
keepLargestBlob(data, info.width, info.height);

const bounds = alphaBounds(data, info.width, info.height);
if (!bounds) throw new Error('背景を落としたら何も残らなかった');

const cropped = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
}).extract(bounds).png().toBuffer();

const png = await sharp({
  create: {
    width: SPRITE_SIZE, height: SPRITE_SIZE, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{
    input: await sharp(cropped)
      .resize(SPRITE_SIZE - 12, SPRITE_SIZE - 12, { fit: 'inside', withoutEnlargement: false })
      .toBuffer(),
    gravity: 'center',
  }])
  .png({ compressionLevel: 9 })
  .toBuffer();

const outPath = path.join(OUT_ROOT, `${outName}.png`);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`  ✓ ${outPath} (${(png.length / 1024).toFixed(0)}KB)`);

// 生成スクリプトに上書きさせないよう記録する
const list = existsSync(MANUAL_LIST)
  ? JSON.parse(readFileSync(MANUAL_LIST, 'utf8'))
  : [];
if (!list.includes(outName)) {
  list.push(outName);
  list.sort();
  writeFileSync(MANUAL_LIST, JSON.stringify(list, null, 2) + '\n');
  console.log(`  scripts/manual-sprites.json に登録した(生成で上書きされない)`);
}
