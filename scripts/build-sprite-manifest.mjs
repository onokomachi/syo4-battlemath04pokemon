/**
 * build-sprite-manifest.mjs
 *
 * scripts/spriteJobs.ts を esbuild でバンドルして実行し、生成ジョブ一覧を
 * scripts/sprite-manifest.json に書き出す。画像生成側(gen-sprites.mjs)は
 * この JSON だけを読むので、ゲームのデータ構造に依存しない。
 *
 *   node scripts/build-sprite-manifest.mjs
 */
import { build } from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tmp = path.join(root, 'scripts', '.sprite-jobs.bundle.mjs');

await build({
  entryPoints: [path.join(root, 'scripts', 'spriteJobs.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile: tmp,
  logLevel: 'warning',
});
// Vite 固有の import.meta.env は Node の ESM では undefined になるが、
// アプリ側はすべて (import.meta as any).env?.… で参照しているため安全に読める。

const { buildJobs } = await import(pathToFileURL(tmp).href);
const jobs = buildJobs();

writeFileSync(
  path.join(root, 'scripts', 'sprite-manifest.json'),
  JSON.stringify(jobs, null, 2),
);
rmSync(tmp, { force: true });

const byKind = jobs.reduce((acc, j) => {
  const kind = j.out.split('/')[0];
  acc[kind] = (acc[kind] ?? 0) + 1;
  return acc;
}, {});
console.log(`sprite-manifest.json: ${jobs.length} jobs`, byKind);
