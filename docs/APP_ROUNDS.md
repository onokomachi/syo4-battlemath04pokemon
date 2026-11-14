# 問題は 各単元アプリと同じ（写し・図鑑番号・けいさんらん）

> CLAUDE.md から移した（2026-11-14）。文はそのまま。ここを直したら、CLAUDE.md の「必ず守ること」に関係するかも見なおす。

## 問題は 各単元アプリと同じ（2026-10〜）

- **単元アプリの問題の作り方と解答画面を `apps/<app_id>/` に写して使う**（正本はアプリ。ここは手で直さない）。
  写し直しは `npm run sync-apps`（となりに各アプリを clone してある前提。一覧は `apps/manifest.json`）。
  アプリ固有の部分（記録・設定・効果音・レベル選択画面）は `apps/_shims/` の代わりの部品に置きかえてある。
- 問題データでは `appRound(app, round, 見出し)`（`data/appRounds.ts`）で「どの画面を出すか」だけを書く。
  出すたびに アプリの作り方で問題を作り、`components/guided/AppRoundHost.tsx` が「白い紙」（`.app-paper`）の上に出す。
  判定は ほかの guided と同じく **1回目のまちがいで ×**。ラウンドの定義は `apps/<app>/sanmon.tsx`、一覧は `apps/registry.ts`。
- **図鑑番号は `data/adventure/legacyDex.ts` の名簿で決まる。** サブトピックを足したら `ADDED_DEX_ORDER` の いちばん後ろに書き足す
  （番号＝絵のファイル名・つかまえた記録。途中に入れると ずれる）。単元ボスも `BOSS_ROWS` の いちばん後ろに足す。
  絵が無いものは `node scripts/make-placeholder-sprites.mjs` で仮の絵（色ちがい）を作り、本番の絵で上書きする。
- サブトピックを足したら、learning-app-kit のカタログ `sanmon` も作り直す（PRISM の項目名）。
- **バトル（ぼうけん・スピードデュエル・クラス対戦）では、アプリと同じ答え方の問題があるサブトピックは それだけを出す**（`data/index.ts` の `battleProblems`・`APP_ROUND_SUBTOPICS`。2026-10-22 先生の判断）。
  SANMON にしかない問題は れんしゅう・ふくしゅう・本番テストで出る。わり算の筆算は アプリの筆算シミュレーター（`apps/hissan` の `hissan-*`）。
- **けいさんらん（📝 筆算で けいさんする）**: 単元アプリと同じ kit の `ScratchPadToggle` を `components/ProblemScratch.tsx` が出す。
  れんしゅう・ぼうけん・対戦・本番テストで同じ。自分で答えを打つ問題（text と guided の retry-hint）で、問題文に数字が2つ以上あるときだけ。
  採点・保存・送信はしない。数は子どもが入れる（文章題の立式を先に答えないため）。単元ごとの計算の並びは同じファイルの `SCRATCH_BY_UNIT`。
- `scripts/verify-app-rounds.mjs`（`npm run check` に入っている）: すべてのレベルで問題が作れる／data の app-round が registry にある／
  図鑑の名簿と絵がそろっている／写しが元とずれていない、を確かめる。
