#!/usr/bin/env node
/**
 * 単元アプリの解答画面（apps/）の検査。
 *  1. apps/registry.ts の すべてのラウンドの すべてのレベルで、問題が 30問ずつ 作れる（例外が出ない）
 *  2. 問題データ（data/）で使っている app-round が、registry に ちゃんとある
 *  3. 写しが元のアプリとずれていないか（元のリポジトリが となりに あるときだけ）
 */
import esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const bundle = (entry, name) => {
  const out = path.join(os.tmpdir(), `sanmon-${name}-${process.pid}.cjs`);
  esbuild.buildSync({
    entryPoints: [path.join(root, entry)], bundle: true, format: 'cjs', platform: 'node', outfile: out,
    logLevel: 'error', jsx: 'automatic', define: { 'import.meta.env': '{}' }, loader: { '.png': 'empty', '.css': 'empty' },
  });
  try { return req(out); } finally { fs.rmSync(out, { force: true }); }
};

let fails = 0;
const { APP_ROUNDS } = bundle('apps/registry.ts', 'registry');
let made = 0;
for (const [app, rounds] of Object.entries(APP_ROUNDS)) {
  for (const [name, def] of Object.entries(rounds)) {
    if (!def.levels.length) { console.log(`✗ ${app}/${name}: レベルが 0`); fails++; }
    if (!def.make) { console.log(`✗ ${app}/${name}: make が無い（検査できない）`); fails++; continue; }
    for (const level of def.levels) {
      for (let i = 0; i < 30; i++) {
        try { if (!def.make(level)) throw new Error('空の問題'); made++; }
        catch (e) { console.log(`✗ ${app}/${name}/${level}: ${e.message}`); fails++; break; }
      }
    }
  }
}
console.log(`  問題を ${made} 問 作れた（${Object.keys(APP_ROUNDS).length} アプリ）`);

// 本番テスト（スタミナ道場。apps/<app>/sanmonTest.tsx）：読みこみ口があり、定義が1つ以上あって、記録の app_id がその単元アプリになっている
{
  const { APP_TEST_LOADERS } = bundle('apps/registryLoaders.ts', 'testloaders');
  const MANIFEST_APPS = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'apps/manifest.json'), 'utf8')).apps);
  for (const app of MANIFEST_APPS) {
    const defs = await APP_TEST_LOADERS[app]?.();
    if (!defs?.length) { console.log(`✗ ${app}: 本番テストの読みこみ口（APP_TEST_LOADERS）が無い／空`); fails++; continue; }
    for (const d of defs) if (d.app !== app || typeof d.Module !== 'function') { console.log(`✗ ${app}/${d.key}: 本番テストの定義がおかしい（app=${d.app}）`); fails++; }
  }
  console.log(`  本番テスト ${MANIFEST_APPS.length} アプリぶんの読みこみ口を確認`);
}

// アプリごとの読みこみ口（apps/registryLoaders.ts）が registry.ts と同じ一覧で、同じラウンドを返す
const { APP_ROUND_LOADERS } = bundle('apps/registryLoaders.ts', 'loaders');
const regKeys = Object.keys(APP_ROUNDS).sort().join(',');
const loadKeys = Object.keys(APP_ROUND_LOADERS).sort().join(',');
if (regKeys !== loadKeys) { console.log(`✗ registryLoaders.ts の一覧が registry.ts とちがう\n    registry: ${regKeys}\n    loaders : ${loadKeys}`); fails++; }
for (const k of Object.keys(APP_ROUNDS)) {
  const got = await APP_ROUND_LOADERS[k]?.();
  if (!got || Object.keys(got).sort().join(',') !== Object.keys(APP_ROUNDS[k]).sort().join(',')) { console.log(`✗ registryLoaders.ts の ${k} が registry.ts と同じラウンドを返さない`); fails++; }
}

const { ALL_PROBLEM_SETS } = bundle('data/index.ts', 'data');
let used = 0;
for (const [sub, ps] of Object.entries(ALL_PROBLEM_SETS)) {
  for (const p of ps) {
    if (p.type !== 'guided' || p.data?.guidedKind !== 'app-round') continue;
    used++;
    if (!APP_ROUNDS[p.data.app]?.[p.data.round]) { console.log(`✗ ${sub}: ${p.data.app}/${p.data.round} が registry に無い`); fails++; }
  }
}
console.log(`  data の app-round ${used} 件は すべて registry にある`);

// 図鑑番号の名簿（data/adventure/legacyDex.ts）に、すべてのサブトピックが載っているか。
// 載っていないと 仮の番号になり、あとで名簿に足したときに 番号（絵・つかまえた記録）がずれる
const dexMod = bundle('data/adventure/monsters.ts', 'dex');
const { LEGACY_DEX_ORDER, ADDED_DEX_ORDER } = bundle('data/adventure/legacyDex.ts', 'legacy');
const listed = new Set([...LEGACY_DEX_ORDER, ...ADDED_DEX_ORDER]);
for (const m of dexMod.MONSTER_DEX) {
  if (!listed.has(m.subtopic)) { console.log(`✗ 図鑑の名簿に無い: ${m.subtopic}（legacyDex.ts の ADDED_DEX_ORDER の いちばん後ろに足す）`); fails++; }
  if (!fs.existsSync(path.join(root, 'public/assets/adventure/monsters', `${m.id}.png`))) { console.log(`✗ 絵が無い: ${m.id} ${m.name}（node scripts/make-placeholder-sprites.mjs）`); fails++; }
}
const dupNo = dexMod.MONSTER_DEX.length - new Set(dexMod.MONSTER_DEX.map((m) => m.no)).size;
if (dupNo) { console.log(`✗ 図鑑番号が重なっている（${dupNo}件）`); fails++; }
console.log(`  図鑑 ${dexMod.MONSTER_DEX.length} 体：番号は名簿どおり・絵はぜんぶある`);

try { execFileSync('node', [path.join(root, 'scripts/sync-app-sources.mjs'), '--check'], { stdio: 'inherit' }); }
catch { fails++; }

if (fails) { console.log(`✗ ${fails} 件の問題`); process.exit(1); }
console.log('✓ アプリの解答画面の検査に合格');
