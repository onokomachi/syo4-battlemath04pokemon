/**
 * repair-chroma.mjs — 切り抜きずみのスプライトに残ったクロマ色を消す。
 *
 * ふちからの塗りつぶしでは、翼と胴のあいだやマントの内側のように
 * 「キャラに囲まれた背景」に届かない。そこがクロマ色のまま残る。
 * この後始末を、作り直さずにその場で当てるための道具。
 * (無料枠を使いきったあとでも直せるようにしてある)
 *
 * どのクロマ色で撮ったかは sprite-manifest.json の chroma を見る。
 * 緑で撮った絵からは緑を、マゼンタで撮った絵からはマゼンタを消すので、
 * 緑いろのキャラ(マゼンタ背景)を誤って削ることはない。
 *
 *   node scripts/repair-chroma.mjs            # 直すものを一覧するだけ
 *   node scripts/repair-chroma.mjs --write    # 実際に書きかえる
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { stripPureChroma, alphaBounds } from './sprite-image.mjs';

const root = path.resolve(import.meta.dirname, '..');
const OUT_ROOT = path.join(root, 'public', 'assets', 'adventure');
const MANIFEST = path.join(root, 'scripts', 'sprite-manifest.json');
const MANUAL = new Set(
  JSON.parse(readFileSync(path.join(root, 'scripts', 'manual-sprites.json'), 'utf8')),
);

const WRITE = process.argv.includes('--write');
const jobs = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  .filter(j => j.cutout && !MANUAL.has(j.out));

let touched = 0;
for (const job of jobs) {
  const file = path.join(OUT_ROOT, `${job.out}.png`);
  if (!existsSync(file)) continue;

  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const removed = stripPureChroma(data, info.width, info.height, job.chroma ?? 'green');
  if (removed === 0) continue;

  const total = info.width * info.height;
  console.log(`${job.out}: ${removed}画素 (${((removed / total) * 100).toFixed(1)}%)`);
  touched++;
  if (!WRITE) continue;

  // 消したぶん外接矩形が変わることがあるので、切りつめ直さずそのまま書く。
  // (位置がずれると図鑑の並びで見え方が変わるため、大きさは動かさない)
  const bounds = alphaBounds(data, info.width, info.height);
  if (!bounds) {
    console.log('  → 全部消えてしまうので、この絵は書きかえない');
    continue;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
}

console.log(`\n${touched}枚に残っていました${WRITE ? '(書きかえました)' : '(--write で書きかえます)'}`);
