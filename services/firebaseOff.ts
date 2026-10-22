/**
 * Firebase を使わなくなった（2026-10〜 学級ポータルへ移行）ので、SDK を読み込まずに済むようにする代わりの部品。
 *
 * 古いログイン・PvP・ランキング・管理画面のコードは `db` / `auth` が null のときは何もしないように書いてあり、
 * ここの「サーバとやりとりする関数」が実際に呼ばれることはない。呼ばれたら、前提がくずれたということなので知らせる（投げる）。
 *
 * ただし `increment` `arrayUnion` `serverTimestamp` は「書きこむ値を作るだけ」の関数で、古いコードは
 * `db` を確かめる前にこれで値を作っている（経験値・バッジ・称号・セッションのまとめ など）。
 * これらが投げると、ふつうに遊んでいるだけで画面が落ちる（クラス対戦のテストで実際に起きた）ので、使われない値を返す。
 * 古いコードそのものを消すのは、このあとの片付け。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const off = (name: string) => (..._args: any[]): any => {
  throw new Error(`Firebase は使っていません（${name} が呼ばれた）`);
};

export type User = { uid: string; email: string | null; displayName: string | null; photoURL: string | null };
export type Firestore = any;

// firebase/auth
export const onAuthStateChanged = off('onAuthStateChanged');
export const signInWithPopup = off('signInWithPopup');
export const signInWithRedirect = off('signInWithRedirect');
export const getRedirectResult = off('getRedirectResult');
export const signOut = off('signOut');

// firebase/firestore
export const doc = off('doc');
export const collection = off('collection');
export const query = off('query');
export const where = off('where');
export const orderBy = off('orderBy');
export const limit = off('limit');
export const getDoc = off('getDoc');
export const getDocs = off('getDocs');
export const setDoc = off('setDoc');
export const updateDoc = off('updateDoc');
export const deleteDoc = off('deleteDoc');
export const onSnapshot = off('onSnapshot');
export const runTransaction = off('runTransaction');
// 値を作るだけの関数（投げない。返した値は db が null なので どこにも書かれない）
export const increment = (n: number): any => ({ __firebaseOff: 'increment', n });
export const arrayUnion = (...items: any[]): any => ({ __firebaseOff: 'arrayUnion', items });
export const serverTimestamp = (): any => ({ __firebaseOff: 'serverTimestamp' });
