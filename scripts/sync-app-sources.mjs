#!/usr/bin/env node
/**
 * 単元アプリのソースを SANMON に写す（apps/manifest.json の一覧どおり）。
 *
 * SANMON の問題は「各算数アプリと同じ問題・同じ答え方」にする（2026-10 先生と決めたこと）。
 * 問題の作り方と解答画面は アプリが正本。ここに写したものは手で直さず、アプリを直してから写し直す:
 *
 *   node scripts/sync-app-sources.mjs              # ../<repo>/src から写す（となりに clone してある前提）
 *   node scripts/sync-app-sources.mjs --check      # 写しが元とずれていないかだけ見る（ずれていたら exit 1）
 *   APPS_ROOT=/path/to/repos node scripts/sync-app-sources.mjs
 *
 * manifest の shims に書いたファイル（記録・設定・効果音など アプリ固有の部分の代わり）は写さない。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/manifest.json'), 'utf8'));
const appsRoot = process.env.APPS_ROOT ?? path.resolve(root, '..');
const check = process.argv.includes('--check');

const header = (repo, rel) =>
  `// このファイルは単元アプリ ${repo} の src/${rel} の写し（scripts/sync-app-sources.mjs）。手で直さない。\n`;

let drift = 0, copied = 0, missing = 0;
for (const [app, def] of Object.entries(manifest.apps)) {
  const src = path.join(appsRoot, def.repo, 'src');
  if (!fs.existsSync(src)) { console.warn(`! ${app}: ${src} が無い（clone してから写す）`); missing++; continue; }
  for (const rel of def.files) {
    const from = path.join(src, rel);
    const to = path.join(root, 'apps', app, rel);
    if (!fs.existsSync(from)) { console.warn(`! ${app}: ${rel} が元に無い`); missing++; continue; }
    const body = header(def.repo, rel) + fs.readFileSync(from, 'utf8');
    const cur = fs.existsSync(to) ? fs.readFileSync(to, 'utf8') : null;
    if (cur === body) continue;
    if (check) { console.log(`ずれ: apps/${app}/${rel}`); drift++; continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, body);
    copied++;
  }
  for (const rel of def.shims ?? []) {
    if (!fs.existsSync(path.join(root, 'apps', app, rel))) { console.warn(`! ${app}: 代わりの部品 ${rel} が無い`); missing++; }
  }
}
if (check) {
  console.log(drift ? `✗ ${drift} 件ずれています（node scripts/sync-app-sources.mjs で写し直す）` : '✓ 写しは元と同じです');
  process.exit(drift ? 1 : 0);
}
console.log(`✓ ${copied} 件を写しました${missing ? `（見つからないもの ${missing} 件）` : ''}`);
