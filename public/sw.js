/*
 * SANMON の Service Worker（2026-11-14。docs/OFFLINE_ASSETS.md）
 *
 * ねらい：ぼうけんの絵と曲（/assets/adventure/ の .webp・.png・.jpg・.mp3。約50MB）を端末に残し、2回目から すぐ出す。
 *
 * - 扱うのは /assets/adventure/ の絵と曲だけ。プログラム本体（HTML・JS・CSS）・サーバとのやりとりは さわらない
 *   （本体まで端末に残すと、月曜の自動更新が届かない端末が出るため）。
 * - 出し方は stale-while-revalidate：端末にあれば それを すぐ出し、入れてから12時間（REVALIDATE_MS）より たっていれば
 *   うらで サーバに新しい版があるかを確かめて入れかえる。同じ名前で絵を描きかえても、遅くとも半日あとの 次の次の表示で新しくなる
 *   （1年古いまま、にはならない）。毎回は確かめない（絵は 300 まいあるので、通信がへらないため）。
 * - 曲は <audio> が範囲を区切って読む（Range）。端末にあれば その範囲を切り出して 206 で返す。
 *   無ければ そのまま サーバに通し、うらで曲の全体を読んで端末に入れる。
 * - 入れる数の上限：絵 600・曲 30（古いものから消す）。
 * - 止めたいとき：このファイルを「入れたものを全部消して自分を外す」版に差しかえる（docs/OFFLINE_ASSETS.md）。
 */
const VERSION = 'v1';
const IMG_CACHE = `sanmon-img-${VERSION}`;
const AUDIO_CACHE = `sanmon-audio-${VERSION}`;
const LIMITS = { [IMG_CACHE]: 600, [AUDIO_CACHE]: 30 };
const PREFIX = '/assets/adventure/';
const REVALIDATE_MS = 12 * 60 * 60 * 1000;
const STAMP = 'x-sanmon-cached-at';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 版の変わった古い入れ物を消す
    const keep = new Set([IMG_CACHE, AUDIO_CACHE]);
    for (const name of await caches.keys()) {
      if (name.startsWith('sanmon-') && !keep.has(name)) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

function kindOf(url) {
  if (url.origin !== self.location.origin || !url.pathname.startsWith(PREFIX)) return null;
  if (/\.(webp|png|jpe?g)$/i.test(url.pathname)) return IMG_CACHE;
  if (/\.mp3$/i.test(url.pathname)) return AUDIO_CACHE;
  return null;
}

/** 入れ物の数を上限までにする（古く入れた順に消す） */
async function trim(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const over = keys.length - LIMITS[cacheName];
  for (let i = 0; i < over; i++) await cache.delete(keys[i]);
}

/** サーバから全体を読んで入れる（?v= などの問い合わせは そのまま。Range は付けない） */
async function refresh(cacheName, url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.ok && res.status === 200) {
      // 入れた時刻を見出しに足して入れる（12時間たったかを見るため）
      const headers = new Headers(res.headers);
      headers.set(STAMP, String(Date.now()));
      const body = await res.clone().arrayBuffer();
      const cache = await caches.open(cacheName);
      await cache.put(url, new Response(body, { status: 200, statusText: 'OK', headers }));
      await trim(cacheName);
    }
    return res;
  } catch {
    return null;
  }
}

/** 端末の曲から Range の部分を切り出す */
async function rangeResponse(cached, rangeHeader) {
  const buf = await cached.arrayBuffer();
  const size = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  let start = m[1] === '' ? NaN : Number(m[1]);
  let end = m[2] === '' ? NaN : Number(m[2]);
  if (Number.isNaN(start)) { start = Math.max(0, size - end); end = size - 1; }   // bytes=-N（最後の N バイト）
  if (Number.isNaN(end) || end >= size) end = size - 1;
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheName = kindOf(url);
  if (!cacheName) return; // 絵と曲のほかは さわらない（ブラウザのふつうの読み方）

  const key = url.href;
  const range = req.headers.get('range');

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(key);

    if (cached) {
      // すぐ出す ＋ 12時間たっていれば うらで新しい版を確かめる
      const at = Number(cached.headers.get(STAMP) || 0);
      if (Date.now() - at > REVALIDATE_MS) event.waitUntil(refresh(cacheName, key));
      return range ? rangeResponse(cached, range) : cached;
    }

    if (range) {
      // 曲で まだ端末に無い：そのままサーバへ（すぐ鳴らす）＋ うらで全体を入れる
      event.waitUntil(refresh(cacheName, key));
      return fetch(req);
    }

    const res = await refresh(cacheName, key);
    return res ?? fetch(req);
  })());
});
