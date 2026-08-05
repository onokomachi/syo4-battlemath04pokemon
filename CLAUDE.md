# SANMON:04 — 作業メモ

小4算数(全14単元・151サブトピック・3,341問)の学習ゲーム。
このファイルは「毎回ゼロから調べ直さなくていいように」の申し送り。

## スタック(まちがえやすい)

**Vite 6 + React 19 + TypeScript + Tailwind 3 + Zustand 5。Next.js ではない。**
3Dは react-three-fiber v9 / drei v10 / three 0.180。バックエンドは Firebase。

- Tailwind の設定は `tailwind.config.js`、**グローバルCSSは `index.html` の `<style>` に直接書いてある**
  (`.btn-tactical` `.hud-panel` `.text-hologram` `.corner-accent` `.adventure-cta` など)。
  CSSファイルを探しても見つからないので注意。
- ぼうけんモードは動的インポートで分割している(初期読み込みを遅くしないため)。

```bash
npm run dev      # 開発サーバ
npx tsc --noEmit # 型チェック(コミット前に必ず)
npm run build    # 本番ビルド(コミット前に必ず)
```

## いちばん大事な設計

**「図鑑を埋める = 小4算数をひととおり解く」が構造的に成立している。**
151サブトピック = 151体のモンスター。`constants.ts` の `MATH_CATEGORIES` を
学習順に走査して図鑑番号を振っているだけなので、問題を足せば図鑑も自動で増える。
ゲームの目標と学習の目標を絶対にずらさないこと。

**学習まわり(問題データ・採点・ガイド付き解答UI・SRS・学習記録)は
バトルと練習モードで同じコンポーネントを共有している**(`ProblemQuestionView.tsx`)。
「モードによって同じ問題の答え方が違う」が起きないようにするため。
どちらか片方だけ直す、ということをしない。

くわしい設計根拠は `docs/ADVENTURE.md` `docs/DESIGN.md` `docs/GAME_ELEMENTS_PROPOSAL.md`。

## 問題を足す・直すとき

```bash
node scripts/audit-problems.mjs   # 全問題の機械監査。コミット前に流す
```

過去に実際にあったバグの型と、監査で出ても直してはいけないものは
**`docs/PROBLEM_QA.md`** にまとめてある。問題データを触る前に読むこと。

いちばん多いバグは **答えが問題文の中に書いてある**。
とくに「偶然そうなってしまう」タイプ(144 ÷ 12 = 12 など)は目視ではまず見つからない。

## スプライト(モンスターの絵)を作り直すとき

**`docs/SPRITE_PIPELINE.md` を読んでから触ること。** 25回以上の試行錯誤の結果が書いてある。
何も読まずにプロンプトを書くと、輪郭が食われた絵を量産して無料枠を溶かす。

```bash
node scripts/check-sprites.mjs --bad          # 機械で検査
node scripts/import-sprite.mjs <画像> <出力名> # 手描き・外部生成の絵を取りこむ
```

`scripts/manual-sprites.json` に載っている絵は手で用意したものなので、
生成スクリプトで上書きしない(スクリプト側が自動で避ける)。

## 秘密情報

Cloudflare の APIトークンは **環境変数か `.env.local` からしか読まない**。
`.env.local` は `.gitignore` の `*.local` で除外ずみ。
**どのファイルにも直接書かないこと。**

## UIで踏んだ地雷

- **`window.confirm()` / `alert()` を使わない。** 一部のスマホ・WebViewでは
  ダイアログを出さずに false を返す。「ボタンを押しても何も起きない」の原因になる
  (本番テストモードの中止ボタンで実際に起きた)。アプリ内モーダルで作ること。
- **配列インデックスで表示対象を切りかえる画面では、切りかわったときに
  その対象に紐づく state を全部リセットする。** トレーナー戦で2体目に移ったとき
  `showAnswer` が前の勝負の true のまま残り、入力欄が永久に無効になった。

## 動作確認(Playwright)

この環境でブラウザを動かすときの決まりごと:

```js
chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--no-proxy-server', '--proxy-bypass-list=<-loopback>'],
});
await page.goto('http://127.0.0.1:5173/');  // localhost ではなく 127.0.0.1
```

`localhost` だとプロキシに吸われてタイムアウトする。`playwright install` は不要。
ログイン画面の「おためしプレイ」を押すとメニューに入れる。

## Node スクリプトから TypeScript のデータを読む

`esbuild.buildSync({ format: 'cjs' })` で束ねて `createRequire` + `require()` で読む。
**`import()` では読めない**(cjs出力とESM動的インポートの食いちがいでエラーになる)。
`scripts/audit-problems.mjs` が実例。
