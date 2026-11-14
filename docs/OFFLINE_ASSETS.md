# ぼうけんの絵と曲を端末に残す（Service Worker。2026-11-14）

`public/sw.js`（登録は `index.tsx` の最後。本番のビルドだけ）。

## なにをするか

- `/assets/adventure/` の絵（`.webp`・`.png`・`.jpg`）と曲（`.mp3`）だけを端末（Cache Storage）に入れ、2回目から すぐ出す。
  絵は約7MB・曲は約45MB。上限は 絵600・曲30（古く入れた順に消す）。
- **プログラム本体（HTML・JS・CSS）・サーバとのやりとりは さわらない。** 本体まで端末に残すと、月曜の自動更新が届かない端末が出るため。
- 出し方は stale-while-revalidate：端末にあれば すぐ出す。入れてから **12時間** より たっていたら、うらでサーバに新しい版があるかを確かめて入れかえる。
- 曲は `<audio>` が範囲を区切って読む（Range）。端末にあれば その範囲を切り出して 206 で返す。無ければ そのままサーバに通し、うらで全体を入れる。

## 絵・曲を描きかえるとき

- 同じ名前で上書きしても、**遅くとも半日あとの 次の次の表示**で新しくなる（端末に入れてから12時間たつと、うらで確かめるため）。
- ただし 2026-11-11 の数時間に開いた端末は、ブラウザのキャッシュに1年古い版を持っている（`vercel.json` の件。CLAUDE.md の「スタック」）。
  そのため**新しい名前で足す（または `?v=2`）**、は変わらず守る。
- すぐに全員の端末を入れかえたいときは、`sw.js` の `VERSION` を上げる（`v1` → `v2`）。古い入れ物は、新しい SW が動いたときに消える。

## 止めたいとき（不具合が出たとき）

`public/sw.js` の中身を次に差しかえて出す（`index.tsx` の登録は そのままでよい）。開いた端末から順に、入れたものを消して自分を外す。

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('sanmon-')) await caches.delete(name);
    await self.registration.unregister();
  })());
});
```

## 確かめ方（2026-11-14 に通した）

`npm run build` のあと、`dist` を静的サーバで配り、Playwright で次を確かめた（13項目）。
SW がページを制御する／絵と曲だけ入り HTML・JS は入らない／通信を切っても絵と曲の Range（`bytes=100-199`・`bytes=-50`・範囲外は416）が出て、中身が元のファイルと同じ／
再読みこみで HTML はサーバから／2回目の絵はサーバに行かない（サーバの記録で数える）／描きかえ（12時間たった扱い）で、1回目は古い版・次は新しい版。
ブラウザの request イベントは SW が端末から出したときも数えるので、**サーバに行ったかは サーバの記録で数える**。
