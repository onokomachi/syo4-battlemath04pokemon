/**
 * gen-sprites.mjs — Pollinations.ai(無料・APIキー不要)でスプライトを生成する。
 *
 * 参照リポジトリ battlemath04catwars で確立したパイプラインと同じ考え方:
 *   ① Pollinations で 1枚ずつ画像を生成
 *   ② 自前の背景除去(クロマキー色からの塗りつぶし)で透過PNG化
 *   ③ 余白をトリムして 256×256 に正規化
 *
 * catwars では背景を白にしていたため白いキャラが溶ける問題が起きた。本作では
 * キャラの配色に使わないクロマグリーン(#19c37d)を背景に指定し、色距離で
 * 抜くようにしてある。テクスチャ(cutout:false)は背景除去せずタイルとして使う。
 *
 *   node scripts/build-sprite-manifest.mjs   # 先にジョブ一覧を作る
 *   node scripts/gen-sprites.mjs             # 生成(既存ファイルはスキップ)
 *   node scripts/gen-sprites.mjs --force     # 作り直す
 *   node scripts/gen-sprites.mjs --only monsters/mon-001
 *   node scripts/gen-sprites.mjs --force --list scripts/redo.txt
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toSprite, toTexture } from './sprite-image.mjs';

const root = path.resolve(import.meta.dirname, '..');
const OUT_ROOT = path.join(root, 'public', 'assets', 'adventure');
const MANIFEST = path.join(root, 'scripts', 'sprite-manifest.json');
/**
 * 手で用意した絵の一覧(import-sprite.mjs が書く)。
 * ここに載っているものは --force でも生成しない。
 * 載せておかないと、作り直しのたびに人が用意した絵が消える。
 */
const MANUAL_LIST = path.join(root, 'scripts', 'manual-sprites.json');
const MANUAL = new Set(
  existsSync(MANUAL_LIST) ? JSON.parse(readFileSync(MANUAL_LIST, 'utf8')) : [],
);

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
// --list <file>: 1行1件で out 名(monsters/mon-001 など)を並べたファイルから対象を読む
const LIST_FILE = args.includes('--list') ? args[args.indexOf('--list') + 1] : null;
// Pollinations は無料枠のため同時接続を上げすぎると 429/503 を返す。
const CONCURRENCY = Number(process.env.SPRITE_CONCURRENCY ?? 3);
/**
 * 種のずらし幅。
 *
 * Pollinations は (プロンプト, seed) ではなく seed でキャッシュしているらしく、
 * プロンプトを直して --force で作り直しても、まったく同じ画像が返ってきていた。
 * 失敗した数枚を何度回しても、検査の数値が1桁まで同じままで、
 * 直したはずのプロンプトが効いていないように見えていたのはこのため。
 *
 * そこで --force のときは既定で時刻から種をずらし、毎回ちがう絵を引く。
 * 再現したいときは SPRITE_SEED_SALT を明示すればよい。
 */
const SEED_SALT = Number(
  process.env.SPRITE_SEED_SALT ?? (args.includes('--force') ? Date.now() % 100000 : 0),
);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------
// 生成
// ------------------------------------------------------------

async function fetchImage(job, attempt) {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(job.prompt)}` +
    `?width=${job.size}&height=${job.size}&seed=${job.seed + attempt * 101 + SEED_SALT}` +
    `&model=flux&nologo=true&private=true&enhance=false`;
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    // 429/503 はこちらが速すぎるだけなので、長めに待って何度でもやり直す
    err.rateLimited = res.status === 429 || res.status === 503 || res.status === 502;
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error(`too small (${buf.length}B)`);
  return buf;
}

// ------------------------------------------------------------
// 実行
// ------------------------------------------------------------

async function runJob(job, stats) {
  const outPath = path.join(OUT_ROOT, `${job.out}.png`);
  if (!FORCE && existsSync(outPath)) { stats.skipped++; return; }
  mkdirSync(path.dirname(outPath), { recursive: true });

  const MAX_ATTEMPTS = 8;
  let rateLimitWaits = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await fetchImage(job, attempt);
      const png = job.cutout ? await toSprite(raw, job.chroma ?? 'green') : await toTexture(raw);
      await writeFile(outPath, png);
      stats.done++;
      process.stdout.write(`  ✓ ${job.out}  (${stats.done + stats.failed + stats.skipped}/${stats.total})\n`);
      return;
    } catch (err) {
      if (err.rateLimited && rateLimitWaits < 6) {
        // レート制限は失敗ではない。シードを変えずに待ち直す。
        rateLimitWaits++;
        attempt--;
        await sleep(8000 * rateLimitWaits);
        continue;
      }
      if (attempt >= MAX_ATTEMPTS - 1) {
        stats.failed++;
        stats.failures.push(`${job.out}: ${err.message}`);
        process.stdout.write(`  ✗ ${job.out}  (${err.message})\n`);
        return;
      }
      await sleep(1500 * (attempt + 1));
    }
  }
}

async function main() {
  if (!existsSync(MANIFEST)) {
    console.error('sprite-manifest.json がありません。先に build-sprite-manifest.mjs を実行してください。');
    process.exit(1);
  }
  let jobs = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  if (ONLY) jobs = jobs.filter(j => j.out.startsWith(ONLY));
  if (LIST_FILE) {
    const wanted = new Set(
      readFileSync(LIST_FILE, 'utf8')
        .split('\n')
        .map(l => l.trim())
        // 「#」ではじまる行は覚え書き。regen-pending.txt の先頭に使い方を書いてある。
        .filter(l => l && !l.startsWith('#')),
    );
    jobs = jobs.filter(j => wanted.has(j.out));
  }

  // 手で用意した絵は生成しない(--force でも上書きしない)
  const manualHits = jobs.filter(j => MANUAL.has(j.out)).map(j => j.out);
  if (manualHits.length > 0) {
    jobs = jobs.filter(j => !MANUAL.has(j.out));
    console.log(`手用意のため生成しない: ${manualHits.join(', ')}`);
  }

  const stats = { total: jobs.length, done: 0, skipped: 0, failed: 0, failures: [] };
  console.log(`スプライト生成: ${jobs.length}件 (同時${CONCURRENCY}件)`);

  const queue = jobs.slice();
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const job = queue.shift();
      if (job) await runJob(job, stats);
    }
  });
  await Promise.all(workers);

  console.log(`\n完了: 生成${stats.done} / スキップ${stats.skipped} / 失敗${stats.failed}`);
  if (stats.failures.length) {
    console.log('失敗した項目:');
    for (const f of stats.failures) console.log('  - ' + f);
    process.exitCode = 1;
  }
}

main();
