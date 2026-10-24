# SANMON:04 — 作業メモ

小4算数(全14単元・151サブトピック・3,341問)の学習ゲーム。
このファイルは「毎回ゼロから調べ直さなくていいように」の申し送り。

## スタック(まちがえやすい)

**Vite 6 + React 19 + TypeScript + Tailwind 3 + Zustand 5。Next.js ではない。**
3Dは react-three-fiber v9 / drei v10 / three 0.180。バックエンドは 学級ポータル（Supabase）。

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
  端末内保存のオフラインモード＋学級ポータル、で動く。Firebase の SDK は入れていない（`firebase.ts` と `services/firebaseOff.ts` は名前だけの代わり。サーバとやりとりする関数は呼ばれない。`increment` などの値を作る関数は、古いコードが `db` を確かめる前に呼ぶので投げずに値を返す）。古い PvP・ランキングの画面のコードを消すのは後の片付け。
- **町（ぼうけん・スピードデュエルの単元）の解放とスタミナは `learning-app-kit/sanmon` が決める**（子ども用ハブと同じ関数）。
  ここで独自に判定しない。数（練習7割・テスト8割をちがう日に3回・階段の半分・ひとりで3日、バトル1回スタミナ5）を変えるときは kit を直す。
  ぼうけんの マップでは、とじた町に この4つを1行で出す（`MapScreen` の `unitProgress`＝kit の `sanmonUnits`）。
  れんしゅう・ふくしゅう・本番テストは学習そのものなので、町が開いていなくても使える（スタミナも使わない）。
- **スタミナの たまり方（2026-10-25〜、サーバの `_sanmon_stamina`。SQL は `supabase-sql/2026-10-25-sanmon-stamina.sql`）**：
  単元アプリの正解1問 +1（ペア 0.5）。**1つの項目で1日5まで・もう熟達した項目（5問れんぞく正解のあと）は半分。1日の上限（前は30）はなし**。
  がんばりボーナス：本番テスト8割合格 +5・実力の階段の新しい段 +3・はじめての熟達 +2。ためられるのは100まで。前の日までは前のきまりのまま。
  かんたんな項目の周回では たまりにくく、いろいろな項目・苦手・テスト・階段で よく たまる。kit の `SANMON_RULES.dailyCap` は もう使っていない（子ども用ハブの説明が「30まで」なら 全体セッションで直す）。
- **ぼうけんのバトルは、必ず `AdventureMode` の `startBattle` を通す**（スタミナの関門）。`setBattle({...})` を直接呼ばない。
- 記録は `services/portal.ts` が学級ポータルへ送る（1問ごと→learning_event、本番テスト→test_result、セーブデータ→sanmon_save）。
  skill_id はサブトピック名そのもの（kit のカタログ `sanmon` と同じ）。サブトピックを足したら kit のカタログを作り直す。
- 環境変数: `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`（publishable キーだけ）。
- **おためし（学級コードなし）でもバトルできる**（2026-10-24 先生と決めた）。スタミナは使わない（`useSanmonPortal` の `spendForBattle`）。
  町は 学級と同じ（単元アプリの いらない3町だけ）。**記録はサーバに送らない**（`syncLearningToPortal` は名乗っていないと何もしない。
  kit は名乗っていない端末の記録も送って、あとで名乗ったとき その子に まとめるため）。
  **セーブは学級と別**（`services/saveProfile.ts`：bm_・battleMath・fb_ の中身を、学級コードを入れた・消したときに入れかえて読みなおす。
  index.tsx で いちばん先に読みこむ）。おためしの進み具合は 学級に引きつがない（上限・スタミナの すりぬけ を防ぐ）。
  kit の右下の入口（JoinGate の chip）は出さない（おためしで バトルの「わからない」に重なって押せなかった）。入口は はじめの画面の JoinSettingsRow。

## モンスターの育ち方（2026-10〜 先生と決めた）

- **けいけんちは、正解した問題の「出どころのモンスター」にだけ入る**（`data/adventure/growth.ts` と store の `growBySubtopic`）。ぼうけんで野生のAと戦えば問題はAの分野なので、手持ちのAが育つ。ほかの手持ちには入らない（2026-10-24 先生と決めた。前は2割）。
  単元アプリの正解では けいけんちは入らない（上限＝かけら だけが上がる）。
  れんしゅう・ふくしゅう・対戦・テストの正解でも、その問題のモンスターが育つ（App の `setProblemLogHook`）。1日に満額は同じモンスターで20問まで、そのあとは4分の1。まちがえても減らない。
- **レベルの上限は単元の「かけら」で上がる**（kit の `sanmonShards`：単元アプリのテスト8割の日・実力の階段、アプリが無い単元は SANMON の練習）。上限 = 20 + 5×かけら（60まで）。
  上限では けいけんちを次のレベルの手前までためる。学級ポータルで名乗っていない（おためし）ときは上限なし。今までに上がったレベルは下げない。
- 強さ（`monsters.ts` の baseHp・baseAtk）は難しい単元ほど少しだけ強い（1.5倍ほど）。おもにレベルで決まる。
- **苦手ボーナス**（`growth.ts` の `WEAK_BONUS` ＝1.5）：きのうまでに まちがえて ふくしゅうリストに入った項目（`isWeakSubtopic`）を正解すると、
  けいけんち（れんしゅう・ふくしゅう・対戦・テスト・ぼうけん）と MP（ぼうけんで たおしたとき・れんしゅうの結果）が1.5倍。
  きょう まちがえたばかりの項目は数えない（わざと まちがえてから正解する、を防ぐ）。れんしゅうは はじめた時点で判定する。
- **レベルの上がり方（`monsters.ts` の `expToNext`）：Lv20 までは そのまま、Lv20→21 からは必要な けいけんちが3倍**（やりこみ。2026-10-24）。
  目安（その分野の正解）：Lv5→20 約135問・Lv20→40 約1,240問・Lv40→60 約2,040問。

## バトルのごほうび・アイテム・ガチャ（2026-10-24〜）

- **けいけんちとMPは「正解したこと」にだけ出す。** 問題を使いきっても勝ちにしない（相手がにげる＝`escape`）。
  正解したぶんは、にげても・負けても・使いきっても入る（`BattleScreen` の `growPendingCorrects`）。正解0問なら0。
  以前は使いきると勝ち扱い＋正解0でも1問ぶん足していたので、「わからない」連打で野生・トレーナー戦に勝てた。
- 自分の子がたおれて交代したら、その問題の状態（`showAnswer` など）を全部リセットして次の問題へ（そのままだと入力できなくなる）。
- アイテムは `data/adventure/adventureTypes.ts` の `ITEMS`。バトルでは「ボール」「どうぐ」のボタンから選ぶ。
  ヒントのしおり・ふくしゅうのおまもり・まぜこぜの巻物は、ふくしゅうモード・ミックスれんしゅうの正解でもらう（1日の上限あり）。
- **ガチャ（サンスウカプセル）のきまりは `data/adventure/gacha.ts`。ぼうけんの ショップ（`ShopScreen`）の中からだけ回せる。**
  コインは学習の成果（その日はじめての正解・はじめての熟達・はじめてのバッジ）だけ。MPは1回300で1日3回まで。
  確率はすべて画面に出す・10回で天井・シールを集めきってもごほうびなし（コンプガチャにしない）・お金では回せない。
  中身を変えたら、重みの合計を100のままにする（画面の％がそのまま重み）。道具60％・シール40％。
- **シール＝図鑑のモンスター全部**（ふつう・進化した すがた・単元ボス・伝説/幻）。めずらしいほど出にくい（30％・7％・2％・1％）。
  シール帳では 絵と「生態」（図鑑の説明）だけが見られる。シールでモンスターは手に入らない。前の形のシール（⭐など）は、同じ枚数のふつうのシールにかえた（`migrateOldStickers`）。
- メインメニューの「アイテム」から、効き目のなかった商品（ストリークシールド・テーマ・ヒントトークン）は外した。買っていた子には1回だけMPを返す。

## モンスター対戦・クラス対戦（パーティ3匹か5匹・HPあり、2026-10〜）

- **ぼうけんでつかまえたモンスターでパーティを3匹か5匹くむ**（`components/MonsterDuelSetup.tsx`）。伝説・幻は分野が無いので入れない。
  たりないときは **さいしょの3体を「かりた なかま」（Lv5）として借りられる**（`data/adventure/starters.ts`。CPU 戦だけ・育たない・クラス対戦には出せない）。
  あいては `cpuParty` が こちらと同じ単元・同じくらいのレベルで くむ。おためし（学級コードなし）でも CPU 戦・スピードデュエルは遊べる（記録は送らない）。
- 毎ターン2人に同じ問題（場に出ている2匹の分野を交互に。奇数ターンは部屋を作った側）。**正解すれば2人とも攻撃**（速い方が少しだけ強い）。HPが0で次のモンスター、ぜんぶ たおしたら勝ち。
  強さの比の効き目は1.7倍まで。相性は ×1.5／×0.67。ダメージのゆれ・きゅうしょ・**がんばり**（攻撃できないターンが続くと次の正解が強くなる。1ターン +0.7、3ターンまで）。1回で最大HPの7割まで。
  **正解すると まもり**（2人とも正解のターンは、受けるダメージ ×0.85）。まちがい・「わからない」・時間切れは同じあつかい（こうげき・まもりなし、がんばり +1）。
  がんばりの数は「わざと わからない を押してためる」が得にならないようにしてある（1回パス→正解 ×1.7 ＜ 2回正解 1+1）。
- **きまりは `data/partyDuel.ts`（CPU 戦）とサーバの `_pduel_hit`・`_pduel_resolve`（クラス対戦）の2か所にある。数を変えるときは両方を変え、`node scripts/sim-party-duel.mjs`（`npm run check` に入っている）でバランスを確かめる。**
  ねらい：3匹で にがてな子が同じレベルで1割近く勝てる・練習してレベルを上げると ぐっと近づく。
- 画面は `components/duel/PartyDuelBoard.tsx`（CPU 戦 `CpuPartyDuel`・クラス対戦 `ClassDuel` で同じ）。問題の部分は スピードデュエルと同じ `DuelAnswerArea`。問題えらびは `duelProblems.ts`。
- **クラス対戦の HP・強さ・勝ち負け・時間はサーバが決める**（`sanmon_pduel_create / join / answer` と、前からある `sanmon_duel_state / list / leave`）。
  モンスターは個体の uid を送り、**レベルはサーバのセーブ（sanmon_save）から読む**（へやを作る・入る前に `pushSave`）。図鑑の分野・タイプ・もとの強さはサーバの表 `sanmon_monster`。
  **モンスターを足した・強さの式を変えたら `node scripts/export-duel-monsters.mjs` の SQL をサーバで流す。**
- 端末どうしの合図は Realtime Broadcast（中身は「状態が変わった」だけ）＋2秒ごとの読みなおし。相手が30秒いなくなったら残った子の勝ち。
- **時間（2026-10-24 先生と決めた）：さいしょの子が答えるまでは時間せいげんなし。どちらかが答えたら、のこりの子は60秒。** 2人とも答えないときだけ5分で打ち切り。
  画面に「わからない（このターンは パス）」ボタン（`DuelAnswerArea` の `allowPass`。スピードデュエルには出さない）。
  数は `PARTY_DUEL.afterFirstSeconds / capSeconds / guard` と サーバの `_pduel_after_first_seconds / _pduel_cap_seconds / _pduel_guard`（しめきりは `sanmon_pduel_answer` が さいしょの答えで ちぢめる）。
- スタミナは部屋に入ったときにサーバが2人ぶん使う（`_duel_cost()` = 5）。ごほうびは勝ち負けの分＋せいかい1問ごとの MP。順位表は作らない。
- 古い早押しの関数（`sanmon_duel_create / join / answer`）は、古い画面が残っているあいだのために残してある（パーティの部屋には入れないようにしてある）。後で消す。
- **モードの開け閉めは先生が PRISM の SANMON タブで学級ごとに決める**（Supabase `sanmon_mode_settings`、子どもは関数 `sanmon_modes` で読む。一覧と判定は kit の `SANMON_MODES`・`isModeOpen`）。
  閉じたモードはメニューで 🔒。クラス対戦はサーバ（`_duel_check_open`）でも へやを作れない・入れない。きろくは いつも開いている。

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
