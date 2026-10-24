/**
 * saveProfile.ts — 学級コードを入れているとき（学級）と、入れていないとき（おためし）で セーブを分ける。
 *
 * 2026-10-24 先生と決めた:
 *   ・おためしでも バトルできる。記録は データベースに 残らない。
 *   ・おためしで遊んだ進み具合（つかまえたモンスター・レベル・MP・1問ごとの記録）は、学級コードを入れても引きつがない
 *     （おためしは レベルの上限も スタミナも ないので、引きつぐと クラス対戦で不公平になる）。
 *
 * しくみ: セーブの中身（bm_・battleMath・fb_ で はじまる localStorage）を、いま使っていない側の分だけ
 * ひとつにまとめて しまっておく（sanmon_profile_class / sanmon_profile_trial）。学級コードを入れた・消したら入れかえて、
 * 画面を読みなおす。1問ごとの記録（fb_problem_logs_v1）も入れかわるので、おためしの記録が あとで学級の記録として送られることはない。
 *
 * ストア（zustand）は読みこんだ時点で localStorage を読むので、index.tsx で いちばん先に読みこむこと。
 */
import { getStudent, subscribeStudent } from 'learning-app-kit/sync';

export type SaveProfile = 'class' | 'trial';

const ACTIVE_KEY = 'sanmon_active_profile';
const stashKey = (p: SaveProfile) => `sanmon_profile_${p}`;
/** 入れかえる中身（services/portal.ts の セーブの対象と同じ＋1問ごとの記録・送った時刻） */
const isProfileKey = (k: string) => /^bm_|^battleMath|^fb_/.test(k) || k === 'sanmon_portal_saved_at';

export const profileFor = (hasStudent: boolean): SaveProfile => (hasStudent ? 'class' : 'trial');

export function activeProfile(): SaveProfile {
  try { return localStorage.getItem(ACTIVE_KEY) === 'trial' ? 'trial' : 'class'; } catch { return 'class'; }
}

/**
 * want の セーブを使う形にする。入れかえたら true。
 * はじめて動くとき（ACTIVE_KEY が無い）は、いま端末にある中身を want のものとみなして、何も動かさない。
 * しまう途中で書けなかったら（容量いっぱい など）、何も消さずに やめる（記録を なくさないため）。
 */
export function ensureProfile(want: SaveProfile): boolean {
  try {
    const cur = localStorage.getItem(ACTIVE_KEY);
    if (cur === null) { localStorage.setItem(ACTIVE_KEY, want); return false; }
    if (cur === want) return false;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isProfileKey(k)) keys.push(k);
    }
    const mine: Record<string, string> = {};
    for (const k of keys) mine[k] = localStorage.getItem(k) ?? '';
    localStorage.setItem(stashKey(cur as SaveProfile), JSON.stringify(mine));
    for (const k of keys) localStorage.removeItem(k);
    const raw = localStorage.getItem(stashKey(want));
    if (raw) {
      const other = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(other)) localStorage.setItem(k, v);
      localStorage.removeItem(stashKey(want));
    }
    localStorage.setItem(ACTIVE_KEY, want);
    return true;
  } catch {
    return false;
  }
}

/** おためし中か（学級コードが入っていない） */
export const isTrial = (): boolean => !getStudent();

// 読みこんだ時点で、いまの名乗りに合わせる（ストアが localStorage を読む前）
ensureProfile(profileFor(!!getStudent()));

// 学級コードを入れた・消したら、セーブを入れかえて 読みなおす（別の端末の続きは App が サーバから取りこむ）
subscribeStudent((s) => {
  if (ensureProfile(profileFor(!!s))) window.location.reload();
});
