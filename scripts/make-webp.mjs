/**
 * ぼうけんの絵（PNG）から、子どもに配る軽い絵（WebP・品質90）を作る（2026-11-11 先生と決めた）。
 *
 *   node scripts/make-webp.mjs          … 足りない・古い WebP を作る（絵を足した・描きかえたら流す）
 *   node scripts/make-webp.mjs --check  … 作り直しが要る絵があれば失敗する（npm run check に入っている）
 *
 * 元の PNG はそのまま残す（絵を作る・直すスクリプトは PNG のまま）。画面が読むのは .webp だけ
 * （monsters.ts・people.ts・FieldScene.tsx）。本番には PNG を出さない（scripts/strip-png-from-dist.mjs）。
 * PNG の中身のハッシュを scripts/webp-manifest.json に覚えておき、変わった絵だけ作り直す。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIRS = ['monsters', 'terrain', 'npc', 'player'].map((d) => path.join(ROOT, 'public/assets/adventure', d));
const MANIFEST = path.join(ROOT, 'scripts/webp-manifest.json');
const QUALITY = 90;
const check = process.argv.includes('--check');

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const next = {};
const stale = [];
let made = 0;
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
    const png = path.join(dir, name);
    const webp = png.replace(/\.png$/, '.webp');
    const rel = path.relative(ROOT, png).split(path.sep).join('/');
    const hash = crypto.createHash('sha1').update(fs.readFileSync(png)).digest('hex');
    next[rel] = hash;
    if (manifest[rel] === hash && fs.existsSync(webp)) continue;
    if (check) { stale.push(rel); continue; }
    await sharp(png).webp({ quality: QUALITY, effort: 6 }).toFile(webp);
    made++;
  }
}
// PNG を消した絵の WebP が残っていたら知らせる
const orphan = DIRS.flatMap((dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
  .filter((f) => f.endsWith('.webp') && !fs.existsSync(path.join(dir, f.replace(/\.webp$/, '.png'))))
  .map((f) => path.relative(ROOT, path.join(dir, f))));

if (check) {
  if (stale.length || orphan.length) {
    console.error(`✗ WebP の作り直しが要る絵: ${stale.length}（${stale.slice(0, 5).join(', ')}${stale.length > 5 ? ' …' : ''}）`);
    if (orphan.length) console.error(`✗ PNG が無い WebP: ${orphan.join(', ')}`);
    console.error('  node scripts/make-webp.mjs を流してコミットしてください。');
    process.exit(1);
  }
  console.log(`✓ WebP はそろっている（${Object.keys(next).length} 枚）`);
} else {
  fs.writeFileSync(MANIFEST, JSON.stringify(next, null, 0).replace(/,"/g, ',\n"') + '\n');
  console.log(`WebP を ${made} 枚 作った（ぜんぶで ${Object.keys(next).length} 枚）${orphan.length ? `。PNG が無い WebP: ${orphan.join(', ')}` : ''}`);
}
