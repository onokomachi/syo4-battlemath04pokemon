# 学級ポータルとのつながり（名乗り・記録・おためし・デモ・体験版・モードの開け閉め）

> CLAUDE.md から移した（2026-11-14）。文はそのまま。ここを直したら、CLAUDE.md の「必ず守ること」に関係するかも見なおす。

## 学級ポータルの一部として動く（2026-10〜）

- **名乗りは学級コード＋出席番号**（learning-app-kit の JoinGate／子ども用ハブからの `#c=&n=`）。氏名・Googleアカウントは使わない。
- **Firebase は使わない**（`firebase.ts` は常に「未設定」。ログイン・PvP・ランキング・管理画面は動かない）。
  端末内保存のオフラインモード＋学級ポータル、で動く。Firebase の SDK は入れていない（`firebase.ts` と `services/firebaseOff.ts` は名前だけの代わり。サーバとやりとりする関数は呼ばれない。`increment` などの値を作る関数は、古いコードが `db` を確かめる前に呼ぶので投げずに値を返す）。古い PvP・ランキングの画面のコードを消すのは後の片付け。
- **町（ぼうけん・スピードデュエルの単元）の解放とスタミナは `learning-app-kit/sanmon` が決める**（子ども用ハブと同じ関数）。
  ここで独自に判定しない。数（練習7割・テスト8割をちがう日に3回・階段の半分・ひとりで3日、バトル1回スタミナ5）を変えるときは kit を直す。
  ぼうけんの マップでは、とじた町に この4つを1行で出す（`MapScreen` の `unitProgress`＝kit の `sanmonUnits`）。
  れんしゅう・ふくしゅう・本番テストは学習そのものなので、町が開いていなくても使える（スタミナも使わない）。

- 記録は `services/portal.ts` が学級ポータルへ送る（1問ごと→learning_event、本番テスト→test_result、セーブデータ→sanmon_save）。
  skill_id はサブトピック名そのもの（kit のカタログ `sanmon` と同じ）。サブトピックを足したら kit のカタログを作り直す。
- 環境変数: `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`（publishable キーだけ）。
- **おためし（学級コードなし）でもバトルできる**（2026-10-24 先生と決めた）。スタミナは使わない（`useSanmonPortal` の `spendForBattle`）。
  町は 学級と同じ（単元アプリの いらない3町だけ）。**記録はサーバに送らない**（`syncLearningToPortal` は名乗っていないと何もしない。
  kit は名乗っていない端末の記録も送って、あとで名乗ったとき その子に まとめるため）。
  **セーブは学級と別**（`services/saveProfile.ts`：bm_・battleMath・fb_ の中身を、学級コードを入れた・消したときに入れかえて読みなおす。
  index.tsx で いちばん先に読みこむ）。おためしの進み具合は 学級に引きつがない（上限・スタミナの すりぬけ を防ぐ）。
  kit の右下の入口（JoinGate の chip）は出さない（おためしで バトルの「わからない」に重なって押せなかった）。入口は はじめの画面の JoinSettingsRow。
- **デモモード**（2026-10 先生と決めた。アプリ紹介用）：はじめの画面の JoinSettingsRow で 学級コード「0000」・番号「0」→ 先生のパスワード（サーバの `verify_demo`。どれかの学級のパスワード）。
  すべての町が開く（`useSanmonPortal` の units）・記録は送らない（名乗らない）・セーブは3つ目の 'demo'（`saveProfile.ts`）。画面の左上に DEMO。おわるのは はじめの画面の「デモを おわる」。
- **体験版**（2026-11-07。SOL の体験の入口 `#trial` から開いたタブ）：おためしと同じく名乗らない・記録は送らない。モードは PRISM の管理タブの設定（kit の `trialAllows`。`useSanmonPortal` の `modeOpen`）、クラス対戦はいつも閉じる。
  **学級コードが入っている端末で体験のリンクを開くと、遊ばせない**（`saveProfile.ts` の `trialOnClassDevice`：ふつうのタブと localStorage のセーブを取りあって学級のセーブをこわさないため）。
  PRISM の「ログイン必須」を入れると、おためしは使えない（kit の JoinGate が名乗るまで閉じない。デモモードは `allowWithout={isDemo}` で通す）。
- 練習・本番テスト・ふくしゅう・ミックス演習の画面は 緑と金（前は赤と黒だった）。まちがいの ×・赤い枠だけは赤のまま。

## モードの開け閉め・平日モード・番号ごとの停止

- **モードの開け閉めは先生が PRISM の SANMON タブで学級ごとに決める**（Supabase `sanmon_mode_settings`、子どもは関数 `sanmon_modes` で読む。一覧と判定は kit の `SANMON_MODES`・`isModeOpen`）。
  閉じたモードはメニューで 🔒。クラス対戦はサーバ（`_duel_check_open`）でも へやを作れない・入れない。きろくは いつも開いている。
- **平日モード**（2026-10-26 先生と決めた。PRISM で学級ごとにオン）：月〜金（祝日をのぞく）の 開始〜終了（はじめは 8:00〜15:30）は、えらんだゲームのモード（ぼうけん・スピード・モンスター対戦・クラス対戦）が閉じる。
  **判定はサーバの時計**（`_sanmon_effective_modes`。`sanmon_modes` が閉じたモードを false で返す）なので、ここでは `portal.modeOpen` を見るだけ。モードは2分ごとに読みなおす。
  閉じたボタンは押せる形のまま（`aria-disabled`）にして、押すと わけ（「いまは じゅぎょうの じかん。15:30から あそべるよ」＝kit の `modeLockMessage`）を出し、`reportLock` でサーバに残す（PRISM に「押した回数」）。
  通信が切れたときは kit が前に読めた設定で平日モードだけ効かせる（`offlineModes`）。
  **ゲームの中にいるあいだに閉じたら、すぐメニューにもどす**（2026-11-09 先生と決めた。`App.tsx` の `playingModeKey` の effect）：ぼうけん・スピードデュエル・モンスター対戦（CPU）・クラス対戦。
  2分ごと・タブにもどったときのモードの読みなおし（前からある）で気づくので、通信は増えない。れんしゅう・ふくしゅう・本番テストは とちゅうで切らない（メニューで止まる）。
  **番号ごとの停止**（2026-11-09。PRISM の SANMON タブで先生が番号を押す。SQL は class-portal-teacher の `supabase/sql/2026-11-09-sanmon-student-lock.sql`）：サーバの `sanmon_modes` がゲームの4つを false＋`_student_lock: true` で返す。
  ここでは「せんせいと おはなししてね」を出すだけ（`useSanmonPortal` の `studentLocked`。理由は出さない）。メニューにもどすのは上と同じ effect。
  サーバでも、バトルのスタミナ（`sanmon_spend`）がモードを確かめる（reason で見分ける：`speed_duel`→speed、`monster_duel`→monster、ほか→adventure。SQL は `supabase-sql/2026-11-09-sanmon-spend-mode-check.sql`）。ことわられたらモードを読みなおす（`useSanmonPortal` の `spendForBattle`）。
