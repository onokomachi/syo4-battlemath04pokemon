/**
 * services/trialLedger.ts — 体験・おためしの台帳（端末の中だけ。サーバには 一切 送らない）
 *
 * 数え方は services/trialLedgerCore.ts（純粋な関数）。ここは 保存（localStorage の1つのキー）・いま使う場面かの判定・画面への知らせ。
 *
 * **ここは送信の経路に のせない**：kit の createSyncedStorage・flushEvents・サーバの関数（rpc）を 呼ばない・読みこまない。
 * 台帳の キーは `bm_` ではじまるので、services/saveProfile.ts の入れかえで 'trial' のセーブの中にだけ入る
 * （学級・デモのセーブとは まざらない）。services/portal.ts の collectSave（学級のセーブの送信）からも のぞいてある。
 */
import { getStudent } from 'learning-app-kit/sync';
import { activeProfile, isDemo } from './saveProfile';
import {
  parseLedger, applyPracticeAnswer, applyDojoAnswer, spendBattle, ledgerUnits, dojoTodayOf, lackMessage, earnedTodayTotal,
  type TrialLedger,
} from './trialLedgerCore';
import { SANMON_UNITS, SANMON_TRIAL_RULES } from 'learning-app-kit/sanmon';

/** 台帳の保存キー（bm_ ではじまる＝'trial' のセーブに入る。services/portal.ts の EXCLUDE にも書いてある） */
export const TRIAL_LEDGER_KEY = 'bm_trial_ledger_v1';

/**
 * 台帳を使う場面か：学級コードで名乗っていない（おためし・体験）・デモでない・'trial' のセーブを使っている。
 * 学級コードが入った端末の体験タブは遊べない作り（saveProfile.ts の trialOnClassDevice）なので、セーブが 'class' のままのときは使わない。
 */
export function trialLedgerActive(): boolean {
  try { return !getStudent() && !isDemo() && activeProfile() === 'trial'; } catch { return false; }
}

/** 保存できないとき（容量いっぱい・保存を止めた端末）の、このタブの中だけの控え */
let memory: string | null = null;

function readRaw(): string | null {
  try { return localStorage.getItem(TRIAL_LEDGER_KEY) ?? memory; } catch { return memory; }
}
function writeLedger(l: TrialLedger): void {
  const raw = JSON.stringify(l);
  memory = raw;
  try { localStorage.setItem(TRIAL_LEDGER_KEY, raw); } catch { /* このタブの中だけで続ける */ }
}

/** いまの台帳（日がかわっていたら「きょう」を 0 に・開いた町に 最初の 20 を渡して 保存する） */
export function getTrialLedger(): TrialLedger {
  const { ledger, changed } = parseLedger(readRaw());
  if (changed && trialLedgerActive()) writeLedger(ledger);
  return ledger;
}

/* ---- 画面への知らせ（台帳が変わったら useSanmonPortal が読みなおす） ---- */
const listeners = new Set<() => void>();
export function subscribeTrialLedger(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function notify() { for (const fn of [...listeners]) { try { fn(); } catch { /* noop */ } } }

/** 町の key → 町の名前 */
export const townNameOf = (key: string): string => SANMON_UNITS.find((u) => u.key === key)?.name ?? key;

/**
 * SANMON の れんしゅう・ふくしゅうで 1問 答えたとき。バトル・デュエル・本番テストの答えは 数えない。
 * 台帳を使う場面でなければ 何もしない（学級の子は ここで すぐ 返る）。新しく開いた町の名前を返す。
 */
export function recordTrialAnswer(mode: string, subTopic: string, correct: boolean): { opened: string[] } | null {
  if (mode !== 'practice' && mode !== 'review') return null;
  if (!trialLedgerActive()) return null;
  try {
    const l = getTrialLedger();
    const r = applyPracticeAnswer(l, { subTopic, correct });
    if (!r.changed) return null;
    writeLedger(l);
    notify();
    return { opened: r.opened.map(townNameOf) };
  } catch { return null; }
}

/** スタミナ道場で 1問 正解したとき（ノーミス）。増えた数を返す */
export function recordTrialDojo(app: string, skill: string, townKey: string, streakReached: boolean): number {
  if (!trialLedgerActive()) return 0;
  try {
    const l = getTrialLedger();
    const r = applyDojoAnswer(l, { app, skill, townKey, streakReached });
    if (!r.changed) return 0;
    writeLedger(l);
    notify();
    return r.gain;
  } catch { return 0; }
}

/** バトル1回ぶんを 町のスタミナから 使う。reason は「wild@div1」のように 町つき */
export function spendTrialBattle(townKey: string): { ok: boolean; message?: string } {
  try {
    const l = getTrialLedger();
    const r = spendBattle(l, townKey);
    if (!r.ok) return { ok: false, message: lackMessage(r.left, !!SANMON_UNITS.find((u) => u.key === townKey)?.appId) };
    writeLedger(l);
    notify();
    return { ok: true };
  } catch { return { ok: true }; }
}

/** 道場の「きょうの分・熟達」 */
export function trialDojoToday() {
  return dojoTodayOf(getTrialLedger());
}

export { ledgerUnits, earnedTodayTotal, SANMON_TRIAL_RULES };
export type { TrialLedger };
