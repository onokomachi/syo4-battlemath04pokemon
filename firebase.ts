/**
 * 2026-10 から SANMON は学級ポータル（Supabase）の一部として動く（services/portal.ts）。
 * 名乗りは学級コード＋出席番号、記録は学級ポータルへ送る。Firebase（Googleログイン・PvP・ランキング・管理画面）は使わない。
 *
 * Firebase の SDK は読み込まない（起動を軽くするため）。古いコードが参照する名前だけを、常に「未設定」の値で残す。
 * 古いコードは `db` / `auth` が null なら何もしない。古いコードを消すのは このあとの片付け。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const isFirebaseConfigured: boolean = false;

export const app: any = null;
export const auth: any = null;
export const db: any = null;
export const storage: any = null;
export const googleProvider: any = null;
export const analytics: any = null;
export const firestoreReady = false;
export const checkFirestoreConnection = async (): Promise<boolean> => false;
