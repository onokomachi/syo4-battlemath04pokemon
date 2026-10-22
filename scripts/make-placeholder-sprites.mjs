#!/usr/bin/env node
/**
 * 絵がまだ無いモンスター（あとから足したサブトピック）に、仮の絵を作る。
 *
 * 同じ町の はじめのモンスターの絵を、モンスターごとに ちがう色あいに回して使う。
 * 本番の絵は docs/SPRITE_PIPELINE.md の手順で作り、同じファイル名で上書きする（このスクリプトは既にある絵を上書きしない）。
 *
 *   node scripts/make-placeholder-sprites.mjs
 */
import esbuild from 'esbuild';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(os.tmpdir(), `sanmon-monsters-${process.pid}.cjs`);
esbuild.buildSync({
  entryPoints: [path.join(root, 'data/adventure/monsters.ts')], bundle: true, format: 'cjs', platform: 'node',
  outfile: out, logLevel: 'error', define: { 'import.meta.env': '{}' },
});
const { MONSTER_DEX, BOSS_DEX } = createRequire(import.meta.url)(out);
const dir = path.join(root, 'public/assets/adventure/monsters');
let made = 0;
for (const m of MONSTER_DEX) {
  const file = path.join(dir, `${m.id}.png`);
  if (fs.existsSync(file)) continue;
  // 同じ町の はじめの絵。新しい町で まだ無ければ、同じタイプの町の絵を使う
  const base = MONSTER_DEX.filter((x) => x.unit === m.unit && x.no <= 151).sort((a, b) => a.no - b.no)[0]
    ?? MONSTER_DEX.filter((x) => x.type === m.type && x.no <= 151).sort((a, b) => a.no - b.no)[0];
  if (!base) { console.warn(`! ${m.id} ${m.name}: 同じ町に 元の絵が無い`); continue; }
  const hue = (m.no * 47) % 300 + 30;
  await sharp(path.join(dir, `${base.id}.png`)).modulate({ hue, saturation: 1.1 }).png().toFile(file);
  console.log(`  ${m.id} ${m.name}（${m.subtopic}）← ${base.id} の色ちがい`);
  made++;
}
// 単元ボス（boss-NNN）とマスター（npc/master-NN）も、無ければ仮の絵を作る
for (const b of BOSS_DEX ?? []) {
  const file = path.join(dir, `${b.id}.png`);
  if (fs.existsSync(file)) continue;
  await sharp(path.join(dir, 'boss-004.png')).modulate({ hue: (b.no * 53) % 300 + 30 }).png().toFile(file);
  console.log(`  ${b.id} ${b.name} ← boss-004 の色ちがい`);
  made++;
}
const npcDir = path.join(root, 'public/assets/adventure/npc');
for (let n = 1; n <= 30; n++) {
  const id = `master-${String(n).padStart(2, '0')}`;
  if (fs.existsSync(path.join(npcDir, `${id}.png`))) continue;
  const used = fs.readFileSync(path.join(root, 'data/adventure/towns.ts'), 'utf8').includes(`'${id}'`);
  if (!used) continue;
  await sharp(path.join(npcDir, 'master-04.png')).modulate({ hue: (n * 61) % 300 + 30 }).png().toFile(path.join(npcDir, `${id}.png`));
  console.log(`  npc/${id} ← master-04 の色ちがい`);
  made++;
}
fs.rmSync(out, { force: true });
console.log(`✓ 仮の絵を ${made} 枚 作りました`);
