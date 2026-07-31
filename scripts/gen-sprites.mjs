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
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const OUT_ROOT = path.join(root, 'public', 'assets', 'adventure');
const MANIFEST = path.join(root, 'scripts', 'sprite-manifest.json');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
// Pollinations は無料枠のため同時接続を上げすぎると 429/503 を返す。
const CONCURRENCY = Number(process.env.SPRITE_CONCURRENCY ?? 3);

/** 生成プロンプトで指定しているクロマキー色 */
const CHROMA = { r: 0x19, g: 0xc3, b: 0x7d };
/** 出力サイズ */
const SPRITE_SIZE = 256;
const TEXTURE_SIZE = 512;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------
// 生成
// ------------------------------------------------------------

async function fetchImage(job, attempt) {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(job.prompt)}` +
    `?width=${job.size}&height=${job.size}&seed=${job.seed + attempt * 101}` +
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
// 背景除去
// ------------------------------------------------------------

const dist2 = (r, g, b, c) => {
  const dr = r - c.r, dg = g - c.g, db = b - c.b;
  return dr * dr + dg * dg + db * db;
};

/**
 * ふちから塗りつぶして背景を抜く。
 *
 * 「四隅の実際の色」を背景とみなす方式は、白い服や白い体のキャラで
 * キャラ本体まで溶けてしまう(参照リポジトリ catwars で実際に起きた不具合)。
 * そこで本作は必ずクロマグリーンを背景に生成させ、その色からの距離だけで抜く。
 * 隅がクロマグリーンでなければ「モデルが指示を無視した」と判断して生成し直す。
 */
function removeBackground(data, w, h) {
  const at = (x, y) => (y * w + x) * 4;

  // ふちの画素の中央値を「実際に描かれた背景色」とする。
  // (四隅だけだと、隅にゴミが乗ったときに大きく外す)
  const edge = [];
  for (let x = 0; x < w; x += 2) {
    edge.push(at(x, 0), at(x, h - 1));
  }
  for (let y = 0; y < h; y += 2) {
    edge.push(at(0, y), at(w - 1, y));
  }
  const median = ch => {
    const v = edge.map(i => data[i + ch]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const bg = { r: median(0), g: median(1), b: median(2) };

  // 背景が緑でなければ、モデルが指示を無視している。
  // そのまま抜くと白い服や白い体のキャラが背景ごと溶けるので、生成し直す。
  if (!(bg.g > bg.r + 10 && bg.g > bg.b + 10)) {
    throw new Error(`background is not green (${bg.r},${bg.g},${bg.b})`);
  }

  // 実際の背景色まわりを広めに、指定したクロマキー色まわりも念のため抜く
  const TOL_BG = 62 * 62 * 3;
  const TOL_CHROMA = 70 * 70 * 3;
  const isBg = i => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return dist2(r, g, b, bg) < TOL_BG || dist2(r, g, b, CHROMA) < TOL_CHROMA;
  };

  const visited = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, 0); stack.push(x, h - 1); }
  for (let y = 0; y < h; y++) { stack.push(0, y); stack.push(w - 1, y); }

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (visited[p]) continue;
    const i = p * 4;
    if (!isBg(i)) continue;
    visited[p] = 1;
    data[i + 3] = 0;
    stack.push(x + 1, y); stack.push(x - 1, y);
    stack.push(x, y + 1); stack.push(x, y - 1);
  }

  // ふちに残る緑かぶり(スピル)を落とす。透明画素にとなり合う画素だけ処理する。
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = at(x, y);
      if (data[i + 3] === 0) continue;
      const touchesAlpha =
        data[at(x + 1, y) + 3] === 0 || data[at(x - 1, y) + 3] === 0 ||
        data[at(x, y + 1) + 3] === 0 || data[at(x, y - 1) + 3] === 0;
      if (!touchesAlpha) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (g > r && g > b) {
        const cap = Math.round((r + b) / 2);
        data[i + 1] = Math.max(cap, Math.round(g * 0.6));
      }
    }
  }
  return data;
}

/** 透明でない画素の外接矩形 */
function alphaBounds(data, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function toSprite(buf) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  removeBackground(data, info.width, info.height);
  const bounds = alphaBounds(data, info.width, info.height);
  if (!bounds) throw new Error('background removal left nothing');
  // 抜きすぎ(キャラまで消えた)を検出する
  if (bounds.width < info.width * 0.12 || bounds.height < info.height * 0.12) {
    throw new Error('subject too small after cutout');
  }
  // 背景がまったく抜けていない(全面が残った)ときも失敗とみなす
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 24) opaque++;
  const ratio = opaque / (info.width * info.height);
  if (ratio > 0.92) throw new Error('background was not removed');
  if (ratio < 0.04) throw new Error('almost everything was removed');

  const raw = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  const cropped = await raw.extract(bounds).png().toBuffer();

  // 正方形に収めつつ、上下左右に少し余白を残す
  return sharp({
    create: {
      width: SPRITE_SIZE, height: SPRITE_SIZE, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: await sharp(cropped)
        .resize(SPRITE_SIZE - 12, SPRITE_SIZE - 12, { fit: 'inside', withoutEnlargement: false })
        .toBuffer(),
      gravity: 'center',
    }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function toTexture(buf) {
  return sharp(buf)
    .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer();
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
      const png = job.cutout ? await toSprite(raw) : await toTexture(raw);
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
