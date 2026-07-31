/**
 * contact-sheet.mjs — スプライトを一覧のシート画像にまとめる。
 *
 * 200枚以上を1枚ずつ開いて見るのは現実的でないので、格子状に並べた
 * コンタクトシートを作って目視監査する。目の数・左右対称性・画風のブレなど、
 * 機械判定が難しいものを人の目で拾うための道具。
 *
 *   node scripts/contact-sheet.mjs                 # monsters を6枚のシートに
 *   node scripts/contact-sheet.mjs npc             # npc だけ
 *   node scripts/contact-sheet.mjs monsters 40     # 1枚あたり40体
 */
import { readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const dirName = process.argv[2] ?? 'monsters';
const perSheet = Number(process.argv[3] ?? 30);

const SRC = path.join(root, 'public', 'assets', 'adventure', dirName);
const OUT = path.join(root, 'scripts', '.sheets');
mkdirSync(OUT, { recursive: true });

const CELL = 200;      // 1マスの大きさ
const LABEL = 22;      // 名前を書く帯の高さ
const COLS = 6;

const files = readdirSync(SRC).filter(f => f.endsWith('.png')).sort();

/** 名前の帯をSVGで作る(フォントに依存しないよう英数字のみ) */
const labelSvg = (text, w, h) =>
  Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#1e293b"/>` +
    `<text x="${w / 2}" y="${h - 6}" font-family="monospace" font-size="15" fill="#ffffff" text-anchor="middle">${text}</text></svg>`,
  );

for (let s = 0; s * perSheet < files.length; s++) {
  const chunk = files.slice(s * perSheet, (s + 1) * perSheet);
  const rows = Math.ceil(chunk.length / COLS);
  const W = COLS * CELL;
  const H = rows * (CELL + LABEL);

  const composites = [];
  for (let i = 0; i < chunk.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL;
    const y = row * (CELL + LABEL);
    const name = chunk[i].replace('.png', '');

    composites.push({
      input: await sharp(path.join(SRC, chunk[i]))
        .resize(CELL - 8, CELL - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer(),
      left: x + 4,
      top: y + 4,
    });
    composites.push({ input: labelSvg(name, CELL, LABEL), left: x, top: y + CELL });
  }

  const out = path.join(OUT, `${dirName}-${String(s + 1).padStart(2, '0')}.png`);
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 241, g: 245, b: 249, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toFile(out);
  console.log(out, `(${chunk.length}体)`);
}
