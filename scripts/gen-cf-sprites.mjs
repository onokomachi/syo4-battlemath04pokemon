/**
 * gen-cf-sprites.mjs — Cloudflare Workers AI(flux-1-schnell)でスプライトを生成する。
 *
 * Pollinations 版(gen-sprites.mjs)との違いは「絵を取ってくるところ」だけで、
 * 背景除去と品質判定は scripts/sprite-image.mjs を共有している。
 *
 * なぜ乗りかえたか:
 *   Pollinations は無料な代わりに (プロンプト, seed) ではなく seed でキャッシュ
 *   していて、プロンプトを直して作り直しても同じ絵が返ってきていた。
 *   モンスター全体を設計しなおすには、直した文がそのまま効く必要がある。
 *
 * モデルの選定:
 *   stable-diffusion-xl-base-1.0 も試したが、背景を「クロマグリーンで塗れ」と
 *   いくら書いても灰色のスタジオ背景を描いてしまい、切り抜きができなかった。
 *   flux-1-schnell は指定どおりベタ塗りの背景を出すので、こちらを使う。
 *
 * 認証情報は環境変数からのみ読む(リポジトリには絶対に置かない)。
 *   .env.local に置いておけば自動で読む。*.local は .gitignore 済み。
 *     CF_ACCOUNT_ID=...
 *     CF_API_TOKEN=...
 *
 *   node scripts/build-sprite-manifest.mjs      # 先にジョブ一覧を作る
 *   node scripts/gen-cf-sprites.mjs             # 生成(既存ファイルはスキップ)
 *   node scripts/gen-cf-sprites.mjs --force     # 作り直す
 *   node scripts/gen-cf-sprites.mjs --only monsters/mon-001
 *   node scripts/gen-cf-sprites.mjs --force --list scripts/redo.txt
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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

// ------------------------------------------------------------
// 認証情報
// ------------------------------------------------------------

/** .env.local を読む。すでに環境変数にあるものは上書きしない。 */
const loadEnvLocal = () => {
  const f = path.join(root, '.env.local');
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
};
loadEnvLocal();

const ACCOUNT = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_API_TOKEN;
if (!ACCOUNT || !TOKEN) {
  console.error(
    'CF_ACCOUNT_ID と CF_API_TOKEN が必要です。\n' +
    '  .env.local に書くか、環境変数で渡してください(リポジトリには置かないこと)。',
  );
  process.exit(1);
}

const MODEL = process.env.CF_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-1-schnell';
const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${MODEL}`;

// ------------------------------------------------------------
// 引数
// ------------------------------------------------------------

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
// --list <file>: 1行1件で out 名(monsters/mon-001 など)を並べたファイルから対象を読む
const LIST_FILE = args.includes('--list') ? args[args.indexOf('--list') + 1] : null;
// Workers AI にも同時実行の上限がある。既定は控えめにしておく。
const CONCURRENCY = Number(process.env.SPRITE_CONCURRENCY ?? 3);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------
// 生成
// ------------------------------------------------------------

/**
 * 安全フィルタに引っかかりやすい語の言いかえ表。
 *
 * 実際に 400 AiError: Input prompt contains NSFW content を出したのは
 * 「elegant / serpentine / queen」を並べたシズクィーンだった。
 * 生きものの姿を述べているだけなのに、人の姿と読まれると弾かれる。
 * そこで、人を連想させる語だけを機械的に生きもの寄りへ置きかえる。
 * 意味はほとんど変わらないので、絵の方向はぶれない。
 */
const SAFE_WORDS = [
  [/\bqueen\b/gi, 'crowned beast'],
  [/\bking\b/gi, 'crowned beast'],
  [/\bgoddess\b/gi, 'guardian beast'],
  [/\bprincess\b/gi, 'crowned beast'],
  [/\bmaiden\b/gi, 'guardian beast'],
  [/\bfairy\b/gi, 'sprite creature'],
  [/\belegant\b/gi, 'graceful'],
  [/\bseductive\b/gi, 'calm'],
  [/\bslender\b/gi, 'slim'],
  [/\bcurvy\b/gi, 'rounded'],
  [/\bbody\b/gi, 'form'],
  [/\bskin\b/gi, 'hide'],
  [/\bbare\b/gi, 'plain'],
  [/\bnude\b/gi, 'plain'],
  [/\bflesh\b/gi, 'scales'],
  [/\bknight\b/gi, 'armored beast'],
  [/\bwarrior\b/gi, 'armored beast'],
  [/\bwoman\b/gi, 'creature'],
  [/\bman\b/gi, 'creature'],
  [/\bgirl\b/gi, 'creature'],
  [/\bboy\b/gi, 'creature'],
];

/**
 * 言いかえの段階。
 *   0: そのまま
 *   1: 人を連想させる語を置きかえる
 *   2: さらに「これは動物である」と前置きする
 *   3: 置きかえたまま、そのまま引き直す
 *
 * 3段目があるのは、この判定がかなり揺れるため。まったく同じ文で
 * 400 が返ったり通ったりする(小さい・丸い、といった語だけで落ちる回がある)。
 * 前置きに「子ども向け」と書くのは逆効果だったので入れていない。
 * 幼さを表す語そのものが判定を引きよせているらしく、書くほど落ちやすくなった。
 */
const MAX_SAFETY_LEVEL = 3;

const rephrase = (prompt, level) => {
  if (level <= 0) return prompt;
  let out = prompt;
  for (const [re, to] of SAFE_WORDS) out = out.replace(re, to);
  if (level === 2) {
    out = `a friendly cartoon animal creature in a video game. ${out}`;
  }
  return out;
};

const isNsfwError = msg => /nsfw|safety|content policy/i.test(msg);

async function fetchImage(prompt, seed) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    // flux-1-schnell は negative_prompt を受けつけない。
    // 否定はプロンプト側では書かず、spriteJobs.ts で肯定文だけを組んでいる。
    body: JSON.stringify({ prompt, seed }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const text = await res.text();
    // 1日ぶんの無料枠を使いきったときも 429 で返ってくるが、これは待っても直らない。
    // レート制限と同じ扱いにすると、残りのジョブぶんだけ無駄に待ってから
    // 全部失敗する(実際に76件を数分かけて空振りさせた)。すぐ止める。
    const quotaGone = /daily free allocation|neurons/i.test(text);
    const err = new Error(
      quotaGone
        ? '1日ぶんの無料枠(10,000 neurons)を使いきりました'
        : `HTTP ${res.status} ${text.slice(0, 300)}`,
    );
    err.quotaGone = quotaGone;
    // 429/5xx はこちらが速すぎるだけなので、待って何度でもやり直す
    err.rateLimited = !quotaGone && (res.status === 429 || res.status >= 500);
    err.nsfw = res.status === 400 && isNsfwError(text);
    throw err;
  }

  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const j = await res.json();
    const b64 = j?.result?.image;
    if (!b64) throw new Error(`no image in JSON: ${JSON.stringify(j).slice(0, 200)}`);
    return Buffer.from(b64, 'base64');
  }
  // モデルによっては画像バイナリを直接返す
  return Buffer.from(await res.arrayBuffer());
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
  let safetyLevel = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      // seed を試行ごとにずらす。同じ seed のまま引き直しても同じ絵が返る。
      const seed = (job.seed + attempt * 9973) % 2_000_000_000;
      const raw = await fetchImage(rephrase(job.prompt, safetyLevel), seed);
      const png = job.cutout ? await toSprite(raw, job.chroma ?? 'green') : await toTexture(raw);
      await writeFile(outPath, png);
      stats.done++;
      const n = stats.done + stats.failed + stats.skipped;
      process.stdout.write(`  ✓ ${job.out}  (${n}/${stats.total})\n`);
      return;
    } catch (err) {
      if (err.quotaGone) {
        // 待っても直らないので、このジョブも残りのジョブも打ちきる
        stats.quotaGone = true;
        stats.failed++;
        stats.failures.push(`${job.out}: ${err.message}`);
        return;
      }
      if (err.nsfw && safetyLevel < MAX_SAFETY_LEVEL) {
        // 言いかえて即やり直す。試行回数は消費しない。
        safetyLevel++;
        attempt--;
        process.stdout.write(`  … ${job.out}  安全フィルタ → 言いかえ(レベル${safetyLevel})\n`);
        // 判定が揺れるので、同じ文でも少し待ってから引き直す
        await sleep(1500);
        continue;
      }
      if (err.rateLimited && rateLimitWaits < 6) {
        // レート制限は失敗ではない。待ち直す。
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
  console.log(`Cloudflare Workers AI (${MODEL})`);
  console.log(`スプライト生成: ${jobs.length}件 (同時${CONCURRENCY}件)`);

  const queue = jobs.slice();
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length && !stats.quotaGone) {
      const job = queue.shift();
      if (job) await runJob(job, stats);
    }
  });
  await Promise.all(workers);

  console.log(`\n完了: 生成${stats.done} / スキップ${stats.skipped} / 失敗${stats.failed}`);

  // やり残しを redo.txt に書いておく。枠が戻ったら --list で続きから流せる。
  const remaining = [
    ...queue.map(j => j.out),
    ...stats.failures.map(f => f.split(':')[0]),
  ];
  if (remaining.length) {
    const redo = path.join(root, 'scripts', 'redo.txt');
    writeFileSync(redo, `${remaining.join('\n')}\n`);
    console.log(`\nやり残し ${remaining.length}件 を scripts/redo.txt に書きました。`);
    console.log(`  node scripts/gen-cf-sprites.mjs --force --list scripts/redo.txt`);
  }

  if (stats.quotaGone) {
    console.log('\n1日ぶんの無料枠を使いきったため、途中で止めました。');
    console.log('UTC 0時に枠が戻ります(または Workers Paid に切りかえてください)。');
  }
  if (stats.failures.length) {
    console.log('失敗した項目:');
    for (const f of stats.failures) console.log('  - ' + f);
    process.exitCode = 1;
  }
}

main();
