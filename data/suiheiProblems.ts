/**
 * data/suiheiProblems.ts — 垂直・平行と四角形（2026-10 に足した単元）。
 * 問題は すべて 単元アプリ（syo4-suityoku-heikotosikakkei）と同じ画面で出す（apps/suihei/）。
 */
import type { Problem } from '../types';
import { appRound } from './appRounds';

export const suiheiProblems: Record<string, Problem[]> = {
  '垂直・平行を見つけよう': appRound('suihei', 'relation', '垂直・平行を見つけよう'),
  '三角じょうぎで作図': appRound('suihei', 'draw', '三角じょうぎで作図'),
  'まちの中の垂直・平行': appRound('suihei', 'life', 'まちの中の垂直・平行'),
  '四角形の名前': appRound('suihei', 'name', '四角形の名前'),
  '四角形のせいしつ': appRound('suihei', 'property', '四角形のせいしつ'),
  '対角線のひみつ': appRound('suihei', 'diagonal', '対角線のひみつ'),
  'しきつめ': appRound('suihei', 'tiling', 'しきつめ'),
  '垂直・平行のまちがい探し': appRound('suihei', 'error', '垂直・平行のまちがい探し'),
};
