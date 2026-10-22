/**
 * data/appRounds.ts — 単元アプリの解答画面を出す問題（type: 'guided' / guidedKind: 'app-round'）。
 *
 * 問題そのものは出すたびに アプリの作り方で作る（apps/<app>/）。ここでは「どの画面を出すか」だけを並べる。
 * 練習・バトル・スピードデュエルの出題は配列から選ぶので、同じものを数個ならべておく（中身は毎回ちがう）。
 */
import type { Problem } from '../types';

export const APP_ROUND_ANSWER = '（アプリの画面で判定）';

export const appRound = (app: string, round: string, question: string, copies = 6): Problem[] =>
  Array.from({ length: copies }, () => ({
    type: 'guided',
    data: { guidedKind: 'app-round', app, round, question },
    answer: APP_ROUND_ANSWER,
  }));
