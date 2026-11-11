/**
 * 本番に出す dist から、ぼうけんの絵の PNG を外す（画面は .webp だけを読む。scripts/make-webp.mjs）。
 * 同じ絵を2つずつ出さないため（Vercel のデプロイの容量を使いすぎない）。build のあとに走る。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const base = path.join(ROOT, 'dist/assets/adventure');
let n = 0;
for (const d of ['monsters', 'terrain', 'npc', 'player']) {
  const dir = path.join(base, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.png')) continue;
    if (!fs.existsSync(path.join(dir, f.replace(/\.png$/, '.webp')))) throw new Error(`WebP が無いので PNG を外せない: ${d}/${f}`);
    fs.rmSync(path.join(dir, f)); n++;
  }
}
console.log(`dist から PNG を ${n} 枚 外した（.webp を使う）`);
