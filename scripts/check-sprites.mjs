/**
 * check-sprites.mjs — 生成したスプライトの品質を機械的に検査する。
 *
 * 目視だけだと 200枚以上を見きれないので、次の2点を自動で拾う。
 *   ① 背景の抜け残り: 不透明なのに緑がかった画素が多い
 *   ② 抜きすぎ / 抜けなさすぎ: 不透明画素の割合が極端
 *
 *   node scripts/check-sprites.mjs            # 一覧
 *   node scripts/check-sprites.mjs --bad      # 問題のあるものだけ
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

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
  const rel = path.relative(ROOT, file);

  const problems = [];
  if (greenRatio > 0.12) problems.push(`緑の抜け残り ${(greenRatio * 100).toFixed(0)}%`);
  if (fill > 0.9) problems.push(`背景が抜けていない (${(fill * 100).toFixed(0)}%)`);
  if (fill < 0.06) problems.push(`ほぼ空 (${(fill * 100).toFixed(0)}%)`);

  if (problems.length) bad.push({ rel, problems });
  if (!ONLY_BAD) {
    console.log(`${problems.length ? '✗' : '✓'} ${rel}  fill=${(fill * 100).toFixed(0)}% green=${(greenRatio * 100).toFixed(0)}%`);
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
