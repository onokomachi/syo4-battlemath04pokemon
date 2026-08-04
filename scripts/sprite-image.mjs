/**
 * sprite-image.mjs — 背景除去と品質判定。生成器と検査器で共有する。
 *
 * もともと gen-sprites.mjs と check-sprites.mjs に同じ関数が二重にあり、
 * しきい値を片方だけ直して食いちがう事故が起きかけていた。
 * 生成器がもう1つ増える(Cloudflare 版)ので、ここに1本化した。
 *
 * 判定はすべて「AIの失敗を機械的に拾う」ためのもので、
 * 人が用意した絵には当てない(scripts/manual-sprites.json)。
 */
import sharp from 'sharp';

/** 出力サイズ */
export const SPRITE_SIZE = 256;
export const TEXTURE_SIZE = 512;

/**
 * 生成プロンプトで指定しているクロマキー色。
 *
 * 緑1色ではだめで、緑色のキャラは緑背景だと体まで抜けてしまう
 * (コケと樹皮でできた緑の鹿が、何度作り直しても輪郭を食われつづけた)。
 * job.chroma で1枚ごとに選べるようにしてある。
 */
export const CHROMA_COLORS = {
  green: { r: 0x19, g: 0xc3, b: 0x7d },
  magenta: { r: 0xe6, g: 0x00, b: 0xb4 },
};

/** その色が、指定したクロマ色の側に十分寄っているか */
export const chromaScore = (kind, r, g, b) =>
  kind === 'magenta'
    ? Math.min(r, b) - g          // マゼンタは赤と青が強く、緑が弱い
    : g - Math.max(r, b);         // 緑は緑だけが強い

const dist2 = (r, g, b, c) => {
  const dr = r - c.r, dg = g - c.g, db = b - c.b;
  return dr * dr + dg * dg + db * db;
};

/**
 * 「囲まれたクロマ色」を、連結ではなく色だけで消す。
 *
 * 翼と胴のあいだ、マントの内側のように、キャラに囲まれた背景は
 * ふちからの塗りつぶしでは届かず、クロマ色のまま残る。
 * 実際、青いタコのマントの内側と、竜の翼の膜が、まるごと
 * クロマグリーンで塗られたまま出てきた。
 *
 * 条件はきつくしてある。「緑っぽい画素を全部消す」にすると、
 * 妖精の淡い黄緑の羽(176,240,144)のような、描かれるべき色まで消える。
 * 消すのは「他の2色がはっきり低い、純度の高いクロマ色」だけ。
 * 生成が背景として塗ったものは必ずこの範囲に入り、体の色はまず入らない。
 *
 * 消した画素数を返す。
 */
export function stripPureChroma(data, w, h, kind = 'green') {
  let removed = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (chromaScore(kind, r, g, b) < 90) continue;
    const pure = kind === 'magenta'
      ? Math.min(r, b) > 170 && g < 110
      : g > 170 && Math.max(r, b) < 130;
    if (!pure) continue;
    data[i + 3] = 0;
    removed++;
  }
  return removed;
}

/**
 * ふちから塗りつぶして背景を抜く。
 *
 * 「四隅の実際の色」を背景とみなす方式は、白い服や白い体のキャラで
 * キャラ本体まで溶けてしまう(参照リポジトリ catwars で実際に起きた不具合)。
 * そこで本作は必ずクロマ色を背景に生成させ、その色からの距離だけで抜く。
 * 隅がクロマ色でなければ「モデルが指示を無視した」と判断して生成し直す。
 */
export function removeBackground(data, w, h, kind = 'green') {
  const CHROMA = CHROMA_COLORS[kind] ?? CHROMA_COLORS.green;
  const at = (x, y) => (y * w + x) * 4;

  // ふちの画素の中央値を「実際に描かれた背景色」とする。
  // (四隅だけだと、隅にゴミが乗ったときに大きく外す)
  const edge = [];
  for (let x = 0; x < w; x += 2) edge.push(at(x, 0), at(x, h - 1));
  for (let y = 0; y < h; y += 2) edge.push(at(0, y), at(w - 1, y));
  const median = ch => {
    const v = edge.map(i => data[i + ch]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const bg = { r: median(0), g: median(1), b: median(2) };

  // 背景がクロマ色でなければ、モデルが指示を外している。
  // 白・灰色・肌色の背景は、この先の塗りつぶしでキャラごと溶けるので受けつけない。
  //
  // 閾値を「はっきり緑(30)」ではなく「緑寄り(12)」にしてあるのは、
  // 白い体が溶けるのを防いでいるのが、この関門ではなく下の isBg にある
  // 画素ごとの緑判定だから。30 にすると、モデルがよく描く淡いセージ色の背景
  // (175,205,184 など)を8回とも弾いてしまい、抜けば普通に使える絵まで
  // 作り直しに回りつづけていた。
  const score = chromaScore(kind, bg.r, bg.g, bg.b);
  if (score < 12) {
    throw new Error(`background is not ${kind} (${bg.r},${bg.g},${bg.b})`);
  }

  // 抜く条件は2つの積。
  //   ① その画素自体がクロマ色寄りであること
  //   ② 背景色(または指定したクロマキー色)に十分近いこと
  // ①を入れているのが要点で、これがないと「背景色から半径100前後」という
  // 広い球に白や淡い肌色が入ってしまい、キャラの内側まで消える。
  const TOL_BG = 62 * 62 * 3;
  const TOL_CHROMA = 70 * 70 * 3;
  const isBg = i => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (chromaScore(kind, r, g, b) < 10) return false;
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

  // 翼と胴のあいだ、マントの内側のように「キャラに囲まれた背景」は、
  // ふちからの塗りつぶしでは届かず、クロマ色のまま残る。
  //
  // 実際、青いタコのマントの内側と、竜の翼の膜が、まるごとクロマグリーンで
  // 塗られたまま出てきた。ここは連結ではなく色だけで判断して消す。
  //
  // ただし条件はきつくする。「緑っぽい画素を全部消す」にすると、
  // 妖精の淡い黄緑の羽(176,240,144)のような、描かれるべき色まで消えてしまう。
  // 消すのは「他の2色がはっきり低い、純度の高いクロマ色」だけ。
  // 生成が背景として塗ったものは必ずこの範囲に入り、体の色はまず入らない。
  stripPureChroma(data, w, h, kind);

  // ふちに残るクロマかぶり(スピル)を落とす。透明画素にとなり合う画素だけ処理する。
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = at(x, y);
      if (data[i + 3] === 0) continue;
      const touchesAlpha =
        data[at(x + 1, y) + 3] === 0 || data[at(x - 1, y) + 3] === 0 ||
        data[at(x, y + 1) + 3] === 0 || data[at(x, y - 1) + 3] === 0;
      if (!touchesAlpha) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (kind === 'magenta') {
        // マゼンタかぶり: 赤と青だけが浮いている画素を、緑に合わせて落とす
        if (r > g && b > g) {
          data[i] = Math.max(g, Math.round(r * 0.7));
          data[i + 2] = Math.max(g, Math.round(b * 0.7));
        }
      } else if (g > r && g > b) {
        const cap = Math.round((r + b) / 2);
        data[i + 1] = Math.max(cap, Math.round(g * 0.6));
      }
    }
  }
  return data;
}

/**
 * シルエットの「ぼろぼろ度」= 周囲長 / √面積。
 *
 * 背景除去がキャラを食うと、輪郭が外側とつながったまま細かく刻まれる。
 * こうなると「内側の穴」でも「塗りつぶし率」でも捕まらないが、
 * 周囲長だけが跳ね上がる。実測では、まともな絵は 3〜5、
 * 食われた絵は 11〜19 にはっきり分かれた。
 */
export function raggedness(data, w, h) {
  const op = p => data[p * 4 + 3] > 40;
  let area = 0, per = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!op(p)) continue;
      area++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          !op(p - 1) || !op(p + 1) || !op(p - w) || !op(p + w)) per++;
    }
  }
  return area ? per / Math.sqrt(area) : 0;
}

/**
 * シルエットのふちの明るさ。
 *
 * ちゃんと切り抜けた絵は、まわりが「黒っぽい輪郭線」なのでふちが暗い。
 * 背景に丸い板を描かれると、その板はクロマ色ではないので抜けずに残り、
 * ふちが板の色(たいてい明るい)になる。実測で、まともな絵のふちは
 * 平均40〜135、板が残った絵は186以上とはっきり分かれた。
 */
export function edgeBrightness(data, w, h) {
  const op = p => data[p * 4 + 3] > 40;
  let sum = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (!op(p)) continue;
      if (op(p - 1) && op(p + 1) && op(p - w) && op(p + w)) continue;
      sum += (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
      n++;
    }
  }
  return n ? sum / n : 0;
}

/**
 * 大きな不透明のかたまりの数。2つ以上なら「1体に収まっていない」ので作り直す。
 * (生成が小さな仲間や分身を並べてしまうことがある)
 */
export function blobCount(data, w, h) {
  const opaque = p => data[p * 4 + 3] > 40;
  const seen = new Uint8Array(w * h);
  const sizes = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !opaque(start)) continue;
    let size = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % w, y = (p / w) | 0;
      const push = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const q = ny * w + nx;
        if (seen[q] || !opaque(q)) return;
        seen[q] = 1;
        stack.push(q);
      };
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    sizes.push(size);
  }
  sizes.sort((a, b) => b - a);
  const biggest = sizes[0] ?? 0;
  // いちばん大きいかたまりの30%以上のものを「もう1体」と数える
  return sizes.filter(v => v > Math.max(w * h * 0.02, biggest * 0.3)).length;
}

/** 内側の穴(外周とつながっていない透明画素)の割合。食われの検出。 */
export function holeRatio(data, w, h) {
  const transparent = p => data[p * 4 + 3] < 40;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p] || !transparent(p)) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  let holes = 0;
  for (let p = 0; p < w * h; p++) if (transparent(p) && !seen[p]) holes++;
  return holes / (w * h);
}

/** 透明でない画素の外接矩形 */
export function alphaBounds(data, w, h) {
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

/**
 * 画面全体の平均の明るさ。
 *
 * Cloudflare の画像モデルは、安全フィルタに触れたとき HTTP 200 のまま
 * 真っ黒の画像を返してくることがある。エラーが返らないので、
 * これを見ないと「まっ黒なスプライト」が静かに保存される。
 */
export function meanLuma(data) {
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    n++;
  }
  return n ? sum / n : 0;
}

/**
 * 生成画像 → 透過スプライト。判定に落ちたら例外を投げ、呼び手が引き直す。
 */
export async function toSprite(buf, chroma = 'green') {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  // 安全フィルタに触れると真っ黒が返る。抜く前に弾く。
  const luma = meanLuma(data);
  if (luma < 6) throw new Error(`blank black image (luma ${luma.toFixed(1)})`);

  removeBackground(data, info.width, info.height, chroma);
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

  // 「食われた残骸」の判定は、画面全体ではなく外接矩形に対する詰まり具合で見る。
  //
  // 画面全体に対する割合で見ていたときは、余白を大きく取って小さく描かれた絵
  // (虫のような小さいモチーフでよく起きる)が、正しく抜けているのに
  // fill 6% で落ちていた。このあと外接矩形に切りつめて拡大するので、
  // 画面のどれだけを占めていたかは品質と関係がない。
  // 残骸になった絵は、外接矩形の中身がすかすかになるので、こちらでは確実に落ちる。
  const boxRatio = opaque / (bounds.width * bounds.height);
  if (boxRatio < 0.16) {
    throw new Error(`too much was removed (fill ${(boxRatio * 100).toFixed(0)}% of bounds)`);
  }
  // 1体に収まっていない / 内側が食われている生成は保存せずに引き直す
  const blobs = blobCount(data, info.width, info.height);
  if (blobs >= 2) throw new Error(`multiple characters (${blobs})`);
  const holes = holeRatio(data, info.width, info.height);
  if (holes > 0.02) throw new Error(`subject has holes (${(holes * 100).toFixed(1)}%)`);
  const ragged = raggedness(data, info.width, info.height);
  if (ragged > 9) throw new Error(`silhouette was eaten (ragged ${ragged.toFixed(1)})`);
  const edge = edgeBrightness(data, info.width, info.height);
  if (edge > 150) throw new Error(`a backdrop plate was left behind (edge ${edge.toFixed(0)})`);

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

export async function toTexture(buf) {
  return sharp(buf)
    .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
