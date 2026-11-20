/**
 * 単元アプリの解答画面を「そのアプリの分だけ」読みこむ入口（2026-11-20）。
 *
 * 前は apps/registry.ts が 10アプリぶんを一度に読みこんでいた（圧縮して約280KB・読みこむと約1MBのプログラム）。
 * 弱い回線・端末では、道場を開くのも、はじめてアプリの問題が出るのも、これの待ちになっていた。
 * ここでは アプリごとに 別のかたまりにして、使うアプリのぶんだけ読みこむ（町に入ったときに先読みもする。services/appRounds.ts）。
 *
 * キーは registry.ts と同じ（小数の たし算・ひき算は 'decimal'）。scripts/verify-app-rounds.mjs が registry.ts と同じ一覧か確かめる。
 */
import type { AppRoundDef, AppTestDef } from './types';

export type AppRounds = Record<string, AppRoundDef>;

export const APP_ROUND_LOADERS: Record<string, () => Promise<AppRounds>> = {
  karakuri: () => import('./karakuri/sanmon').then((m) => m.KARAKURI_ROUNDS),
  menseki4: () => import('./menseki4/sanmon').then((m) => m.MENSEKI4_ROUNDS),
  kawari: () => import('./kawari/sanmon').then((m) => m.KAWARI_ROUNDS),
  rippoutai: () => import('./rippoutai/sanmon').then((m) => m.RIPPOUTAI_ROUNDS),
  syousu: () => import('./syousu/sanmon').then((m) => m.SYOUSU_ROUNDS),
  decimal: () => import('./syousu/sanmon').then((m) => m.DECIMAL_ROUNDS),
  bunsuu4: () => import('./bunsuu4/sanmon').then((m) => m.BUNSUU4_ROUNDS),
  suihei: () => import('./suihei/sanmon').then((m) => m.SUIHEI_ROUNDS),
  gaisu: () => import('./gaisu/sanmon').then((m) => m.GAISU_ROUNDS),
  hissan: () => import('./hissan/sanmon').then((m) => m.HISSAN_ROUNDS),
  bai: () => import('./bai/sanmon').then((m) => m.BAI_ROUNDS),
};

/** 本番テスト（スタミナ道場）。アプリごと別のかたまり（れんしゅう・バトルの解答画面を重くしないため） */
export const APP_TEST_LOADERS: Record<string, () => Promise<AppTestDef[]>> = {
  gaisu: () => import('./gaisu/sanmonTest').then((m) => m.GAISU_TESTS),
  bai: () => import('./bai/sanmonTest').then((m) => m.BAI_TESTS),
  hissan: () => import('./hissan/sanmonTest').then((m) => m.HISSAN_TESTS),
  karakuri: () => import('./karakuri/sanmonTest').then((m) => m.KARAKURI_TESTS),
  kawari: () => import('./kawari/sanmonTest').then((m) => m.KAWARI_TESTS),
  menseki4: () => import('./menseki4/sanmonTest').then((m) => m.MENSEKI4_TESTS),
  rippoutai: () => import('./rippoutai/sanmonTest').then((m) => m.RIPPOUTAI_TESTS),
  suihei: () => import('./suihei/sanmonTest').then((m) => m.SUIHEI_TESTS),
  bunsuu4: () => import('./bunsuu4/sanmonTest').then((m) => m.BUNSUU4_TESTS),
  syousu: () => import('./syousu/sanmonTest').then((m) => m.SYOUSU_TESTS),
};
