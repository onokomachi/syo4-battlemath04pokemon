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

## 学級ポータルの一部として動く（2026-10〜）

- **名乗りは学級コード＋出席番号**（learning-app-kit の JoinGate／子ども用ハブからの `#c=&n=`）。氏名・Googleアカウントは使わない。
- **Firebase は使わない**（`firebase.ts` は常に「未設定」。ログイン・PvP・ランキング・管理画面は動かない）。
  端末内保存のオフラインモード＋学級ポータル、で動く。Firebase のコードを消すのは後の段の片付け。
- **町（ぼうけん・スピードデュエルの単元）の解放とスタミナは `learning-app-kit/sanmon` が決める**（子ども用ハブと同じ関数）。
  ここで独自に判定しない。数（練習7割・テスト8割をちがう日に3回・階段の半分・ひとりで3日、バトル1回スタミナ5）を変えるときは kit を直す。
  れんしゅう・ふくしゅう・本番テストは学習そのものなので、町が開いていなくても使える（スタミナも使わない）。
- **ぼうけんのバトルは、必ず `AdventureMode` の `startBattle` を通す**（スタミナの関門）。`setBattle({...})` を直接呼ばない。
- 記録は `services/portal.ts` が学級ポータルへ送る（1問ごと→learning_event、本番テスト→test_result、セーブデータ→sanmon_save）。
  skill_id はサブトピック名そのもの（kit のカタログ `sanmon` と同じ）。サブトピックを足したら kit のカタログを作り直す。
- 環境変数: `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`（publishable キーだけ）。

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

<!-- platform:begin（learning-app-kit が配る。手で書きかえない。直すときは kit の platform/CLAUDE.common.md） -->
## 学級ポータル共通のルール（learning-app-kit が配る。ここは手で書きかえない）

このリポジトリは、複数のアプリがつながった1つの仕組み（学級ポータル）の一部です。
1つのアプリだけを見て直すと、ほかのアプリ・先生用画面（PRISM）・データベースとずれます。

- **構成**: `learning-app-kit`（共通部品・記録の送信・カタログ・実力の階段）／単元アプリ（算数・国語）／
  `class-portal-teacher`（PRISM・先生用）／`class-portal-kids`（子ども用ハブ）／Supabase `gakkyu-portal`／
  `onokomachi-master-DB`（知識集）。
- **始めと終わり**: 作業の前に kb スキルで関係する知見を引く。直したこと・分かったことは最後に kb save で残す。
- **共通ファイルは、このリポジトリで直さない。** どれが共通ファイルかは `npm run platform` が教える。
  直すときは learning-app-kit の `platform/families/<種類>/files/` を直して kit の版を上げ、
  各アプリで kit を上げてから `npx learning-app-kit-platform fix` で配る（1つのアプリだけ直すと、直しが届かない）。
- **記録の名前（skillId）はカタログの skill_id と同じ文字列にする。** レベルIDがすでに `compare-basic` なら、
  前に何かを足さない。問題・レベルを足したり名前を変えたりしたら、カタログを作り直して kit に入れる（portal-connect スキル）。
- **送る記録の形・データベースの表・PRISM の画面に関わる変更**は、関係するリポジトリを全部つないだセッションで行う。
  単体のセッションで気づいたら、直さずに PR とユーザーへの報告に「全体セッションで直すこと」として書く。
- **kit はコミットのSHAで固定している。** 上げるときは `npx learning-app-kit-platform update` → `npm run check`。
- **新しいアプリは、作りはじめに `npx learning-app-kit-platform init <種類>`**（math / kokugo / portal / standalone）。
  CLAUDE.md・共通ファイル・CI・build 前の点検がそろう。そのあと CLAUDE.md の上の段にアプリだけのことを書く。
- 子どもの氏名は扱わない（出席番号だけ）。APIキー・トークン・パスワードはファイルにも知識集にも書かない。
- **終わる前に `npm run check` を通す**（このルールの点検 `npm run platform` も入っている）。
- PR の本文に「ほかのアプリ・PRISM・データベースへの影響」を1行書く（無ければ「なし」）。
- 毎週月曜の朝、各アプリの CI が kit を最新に上げ、`npm run check` が通れば main に自動で反映する（Vercel が本番に出す。持ち主の操作は要らない）。
  失敗のメールが来たら（kit の変更でアプリが通らない／CI の設定が変わる更新）、全体セッションで直す。
  kit の変更は、全アプリに月曜の朝いっせいに届く。kit の PR では「ほかのアプリへの影響」を必ず書く。
- Vercel の build の前にもこの点検が走る（`prebuild`）。ずれたままでは本番に出ない。
<!-- platform:end -->
