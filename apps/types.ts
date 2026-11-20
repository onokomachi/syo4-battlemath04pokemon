import type React from 'react';

/** アプリの解答画面を SANMON に出すときに渡すもの */
export interface AppRoundProps {
  /** 出すレベル（そのアプリの skill_id） */
  level: string;
  /** さいごまで解けたとき（perfect＝一度もまちがえなかった） */
  onResult: (perfect: boolean) => void;
  /** まちがえたとき（SANMON では1回目のまちがいで その問題は×） */
  onMiss: () => void;
}

export interface AppRoundDef {
  /** このラウンドで出すレベル（アプリの skill_id）。出すたびに1つ選ぶ */
  levels: string[];
  Round: React.FC<AppRoundProps>;
  /** 問題だけを作る（検査用: scripts/verify-app-rounds.mjs が すべてのレベルで作れるかを確かめる） */
  make?: (level: string) => unknown;
}

/** 単元アプリの「本番テスト」（スタミナ道場で出す。2026-11-20）。画面はアプリの MockTestModule そのもの */
export interface AppTestDef {
  /** 道場の中の名前（app 内で一意。記録の skill_id とは別） */
  key: string;
  /** 記録の app_id（その単元アプリ） */
  app: string;
  title: string;
  /** 一言の説明（範囲・点数など） */
  desc: string;
  /** この町のテストか（省略＝そのアプリの全部の町）。小数のしくみ／小数のかけ算とわり算のように 1つのアプリに2つのテストがあるとき */
  towns?: string[];
  /** テスト画面。onExit でテストをやめて道場にもどる */
  Module: React.FC<{ onExit: () => void; /** 「れんしゅうする」（結果の画面）。道場では れんしゅうの一覧にもどる */ onPractice?: (id: string) => void }>;
}
