/**
 * services/dojo.ts — スタミナ道場（2026-11-20〜。先生と決めたこと）
 *
 * ぼうけんの町の「スタミナ道場」で、その町の単元アプリと **同じ問題・同じ解答画面** を解いて スタミナをためる。
 * 単元アプリへ行かなくても スタミナがたまるようにするため。
 *
 * - 問題と解答画面は apps/<app>/ の写し（バトルと同じもの）。
 * - 記録は **単元アプリで解いたのと同じ記録** として送る（app_id＝その単元アプリ、skill_id＝解答画面が付ける名前）。
 *   熟達（5問れんぞくノーミス）・ふくしゅうの時期（間隔反復）も、単元アプリと同じ数え方で 端末に持ち、
 *   kit の createSyncedStorage で送る（単元アプリと同じ部品）。サーバから見ると「その子の もう1台の端末」。
 *   PRISM・SOL・町の解放・スタミナの数え方は、単元アプリで解いたときと まったく同じになる。
 * - スタミナの数え方は変えない（1日1項目5まで・熟達後は半分・町のスタミナは50まで）。サーバ（_sanmon_pools_fold）が数える。
 *   道場の画面は「きょう その項目で あと いくつ たまるか」をサーバ（sanmon_dojo_today）から読んで見せる。
 * - 名乗っていないとき（おためし・デモ・体験）は使えない（記録を送らない約束）。
 */
import { createSyncedStorage, getStudent, isTrial, fetchMyProgress, type MySkillRow } from 'learning-app-kit/sync';
import { SANMON_UNITS } from 'learning-app-kit/sanmon';
import { CATALOGS } from 'learning-app-kit/catalog';
import { scheduleAfterResult, type ReviewState } from 'learning-app-kit/review';
import type { AppRoundDef } from '../apps/types';
import { PORTAL, isPortalConfigured } from './portal';
import { isDemo } from './saveProfile';

/** 熟達＝5問れんぞくノーミス（単元アプリの progressStore と同じ） */
export const MASTERY_STREAK = 5;
/** 1日に1項目で たまるスタミナの上限（サーバの _sanmon_pools_fold と同じ） */
export const DAILY_SKILL_CAP = 5;
/** 町のスタミナの上限（kit の SANMON_RULES.townCap と同じ） */
export const TOWN_CAP = 50;

/* ---------------- 道場が使えるか ---------------- */

export function dojoAvailable(): boolean {
  return isPortalConfigured && !!getStudent() && !isTrial() && !isDemo();
}

/* ---------------- 町の項目 ---------------- */

export interface DojoItem {
  /** 道場の中での名前（app/レベル） */
  key: string;
  app: string;
  /** registry の アプリの置き場（syousu の一部は 'decimal'） */
  regApp: string;
  round: string;
  level: string;
  /** この項目を解くと付く記録の名前（はじめは見こみ。解いたあとは 実際に付いた名前も足す） */
  skills: string[];
  label: string;
  moduleId: string;
  moduleTitle: string;
}

/**
 * レベルの名前と 記録の名前がちがう項目（アプリの解答画面が 別の名前で記録する）。
 * エラーハンターは「正しいかを見る」と「直す」で 名前が分かれる（単元アプリでも同じ）。
 */
const OVERRIDES: Record<string, Record<string, { skills: string[]; label: string; moduleId: string; moduleTitle: string }>> = {
  gaisu: { 'eh-gaisu': { skills: ['eh-judge', 'eh-fix'], label: 'まちがいを さがせ', moduleId: 'error-hunter', moduleTitle: 'エラーハンター' } },
  hissan: { 'eh-div': { skills: ['eh-judge', 'eh-fix'], label: 'まちがいを さがせ', moduleId: 'error-hunter', moduleTitle: 'エラーハンター' } },
  bai: { 'eh-bai': { skills: ['eh-judge', 'eh-fix'], label: 'まちがいを さがせ', moduleId: 'error-hunter', moduleTitle: 'エラーハンター' } },
  syousu: {
    decompose: { skills: ['decompose-3'], label: '小数を 分解する', moduleId: 'place-value', moduleTitle: '小数のしくみ' },
    error: { skills: ['judge-correct', 'fix-number', 'fix-sign'], label: 'まちがいを さがせ', moduleId: 'place-value', moduleTitle: 'エラーハンター' },
    ...Object.fromEntries(['add-basic', 'add-diff', 'sub-basic', 'sub-diff', 'sub-whole'].map((l) => [l, {
      skills: [`addsub-${l}`, `addsub-build-${l}`, `addsub-master-${l}`], label: '', moduleId: 'decimal-addsub', moduleTitle: '',
    }])),
  },
};

/** 記録の名前 → その町（サーバの _sanmon_pool と同じ分け方。わり算の筆算は ÷1けた／÷2けた で分かれ、ほかは両方の町） */
function townsOfSkill(app: string, skill: string, moduleId: string): string[] {
  if (app === 'hissan') {
    if (/^hissan-\d-1$/.test(skill)) return ['div1'];
    if (/^hissan-\d-[23]$/.test(skill)) return ['div2'];
    return ['div1', 'div2'];
  }
  if (app === 'syousu') {
    return SANMON_UNITS.filter((u) => u.appId === 'syousu' && (u.modules ?? []).includes(moduleId)).map((u) => u.key);
  }
  return SANMON_UNITS.filter((u) => u.appId === app).map((u) => u.key);
}

let registry: Record<string, Record<string, AppRoundDef>> | null = null;
export async function loadRegistry() {
  registry ??= (await import('../apps/registry')).APP_ROUNDS;
  return registry;
}

const LEARNED_KEY = 'bm_dojo_learned_skills';
/** 解いたときに 実際に付いた記録の名前（項目の key → 名前）。見こみに無い名前でも「きょう あといくつ」を正しく出すため */
function learned(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(LEARNED_KEY) ?? '{}') as Record<string, string[]>; } catch { return {}; }
}
function learn(itemKey: string, skill: string) {
  const all = learned();
  const cur = all[itemKey] ?? [];
  if (cur.includes(skill)) return;
  all[itemKey] = [...cur, skill];
  try { localStorage.setItem(LEARNED_KEY, JSON.stringify(all)); } catch { /* noop */ }
}

/** その町の道場で解ける項目（単元アプリの解答画面の写しがあるもの）。カタログの並び順 */
export async function dojoItems(townKey: string): Promise<DojoItem[]> {
  const reg = await loadRegistry();
  const unit = SANMON_UNITS.find((u) => u.key === townKey);
  if (!unit?.appId) return [];
  const app = unit.appId;
  const cat = CATALOGS[app];
  const skillInfo = new Map<string, { label: string; moduleId: string; moduleTitle: string; order: number }>();
  let order = 0;
  for (const m of cat?.modules ?? []) for (const s of m.skills) skillInfo.set(s.skill_id, { label: s.label, moduleId: m.module_id, moduleTitle: m.title, order: order++ });
  const regApps = app === 'syousu' ? ['syousu', 'decimal'] : [app];
  const learnedAll = learned();
  const items: Array<DojoItem & { order: number }> = [];
  const seen = new Set<string>();
  for (const regApp of regApps) {
    for (const [round, def] of Object.entries(reg[regApp] ?? {})) {
      for (const level of def.levels) {
        const key = `${app}/${level}`;
        if (seen.has(key)) continue;
        const ov = OVERRIDES[app]?.[level];
        const skills = ov ? ov.skills : [level];
        const info = skillInfo.get(skills[0]) ?? skillInfo.get(level);
        const moduleId = ov?.moduleId || info?.moduleId || '';
        if (!townsOfSkill(app, skills[0], moduleId).includes(townKey)) continue;
        // 本番テスト・ボス・実力の階段の記録は 練習の項目にしない
        if (/^(mock|boss|trial)/.test(skills[0])) continue;
        seen.add(key);
        items.push({
          key, app, regApp, round, level,
          skills: [...new Set([...skills, ...(learnedAll[key] ?? [])])],
          label: ov?.label || info?.label || level,
          moduleId,
          moduleTitle: ov?.moduleTitle || info?.moduleTitle || '',
          order: ov && !info ? 9999 : info?.order ?? 9998,
        });
      }
    }
  }
  return items.sort((a, b) => a.order - b.order).map(({ order: _o, ...it }) => it);
}

/* ---------------- サーバ：きょうの分・ふくしゅう ---------------- */

export interface DojoToday {
  /** "app|skill" → きょう スタミナに なった分（0〜5） */
  earned: Record<string, number>;
  /** 熟達した項目（"app|skill"。ここからは半分） */
  mastered: Set<string>;
}

export async function fetchDojoToday(): Promise<DojoToday | null> {
  const s = getStudent();
  if (!s || !PORTAL.supabaseUrl || !PORTAL.supabaseKey) return null;
  try {
    const res = await fetch(`${PORTAL.supabaseUrl}/rest/v1/rpc/sanmon_dojo_today`, {
      method: 'POST',
      headers: { apikey: PORTAL.supabaseKey, Authorization: `Bearer ${PORTAL.supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_student_id: s.studentId }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { earned?: Record<string, number>; mastered?: string[] };
    return { earned: j.earned ?? {}, mastered: new Set(j.mastered ?? []) };
  } catch {
    return null;
  }
}

/** じぶんの記録（端末をまとめたもの）。ふくしゅうの時期と、道場で つづきから数えるために読む */
export async function fetchMyRows(): Promise<MySkillRow[] | null> {
  const s = getStudent();
  if (!s) return null;
  const r = await fetchMyProgress(PORTAL, s.studentId);
  return r.ok ? r.rows : null;
}

/** その項目で きょう あと いくつ たまるか（項目に名前が いくつかあるときは、いちばん たまる名前で） */
export function remainingToday(item: DojoItem, today: DojoToday | null, local: Record<string, number>): number {
  let best = 0;
  for (const sk of item.skills) {
    const k = `${item.app}|${sk}`;
    const got = (today?.earned[k] ?? 0) + (local[k] ?? 0);
    best = Math.max(best, DAILY_SKILL_CAP - got);
  }
  return Math.max(0, best);
}

export function isMasteredItem(item: DojoItem, today: DojoToday | null): boolean {
  return item.skills.some((sk) => today?.mastered.has(`${item.app}|${sk}`));
}

/* ---------------- 端末の記録（単元アプリの progressStore と同じ数え方） ---------------- */

interface Mastery { attempts: number; corrects: number; perfectStreak?: number }
interface Log {
  id: string; ts: number; moduleId: string; skillId: string; label: string; correct: boolean;
  mistakes?: number; abandoned?: boolean; missType?: string; missAnswer?: string; detail?: unknown;
}
interface DojoState { logs: Log[]; mastery: Record<string, Mastery>; review: Record<string, ReviewState> }

const stateKey = (app: string) => `bm_dojo_${app}`;
const storages = new Map<string, ReturnType<typeof createSyncedStorage>>();
function storageOf(app: string) {
  let s = storages.get(app);
  if (!s) {
    s = createSyncedStorage({ appId: app, supabaseUrl: PORTAL.supabaseUrl, supabaseKey: PORTAL.supabaseKey });
    storages.set(app, s);
  }
  return s;
}

function readState(app: string): DojoState {
  const raw = storageOf(app).getItem(stateKey(app));
  try {
    const st = (JSON.parse(typeof raw === 'string' ? raw : '') as { state?: DojoState }).state;
    if (st) return { logs: st.logs ?? [], mastery: st.mastery ?? {}, review: st.review ?? {} };
  } catch { /* 初めて */ }
  return { logs: [], mastery: {}, review: {} };
}

function writeState(app: string, st: DojoState) {
  // zustand の persist と同じ形（kit の parseSyncable が state を読む）
  void storageOf(app).setItem(stateKey(app), JSON.stringify({ state: st, version: 0 }));
}

/** サーバの記録（ほかの端末＝単元アプリでの つづけて正解・ふくしゅうの予定）。道場で はじめて解く項目は ここから つづける */
const seeds = new Map<string, MySkillRow>();
export function setSeeds(rows: readonly MySkillRow[]) {
  for (const r of rows) seeds.set(`${r.app_id}|${r.skill_id}`, r);
}

/**
 * 解答画面が作った記録を受け取る（apps/_shims/progressStore の setDojoSink から）。
 * 単元アプリの progressStore.recordResult と同じ数え方：
 *  - とちゅうでやめた記録は のこすだけ（熟達・ふくしゅうは動かさない）
 *  - ノーミスで +1（5まで）、まちがいがあれば 0
 *  - ふくしゅうの予定は 本番テスト・ボス戦では動かさない
 */
export function recordDojo(app: string, itemKey: string, rec: Omit<Log, 'id' | 'ts'>): void {
  if (!dojoAvailable()) return;
  learn(itemKey, rec.skillId);
  const st = readState(app);
  const entry: Log = { ...rec, id: crypto.randomUUID(), ts: Date.now() };
  st.logs = [entry, ...st.logs].slice(0, 200);
  if (!rec.abandoned) {
    const seed = seeds.get(`${app}|${rec.skillId}`);
    const prev = st.mastery[rec.skillId] ?? { attempts: 0, corrects: 0, perfectStreak: Math.min(seed?.perfect_streak ?? 0, MASTERY_STREAK) };
    st.mastery[rec.skillId] = {
      attempts: prev.attempts + 1,
      corrects: prev.corrects + (rec.correct ? 1 : 0),
      perfectStreak: rec.correct ? Math.min((prev.perfectStreak ?? 0) + 1, MASTERY_STREAK) : 0,
    };
    if (rec.moduleId !== 'mock-test' && rec.moduleId !== 'boss-battle') {
      const prevReview = st.review[rec.skillId]
        ?? (seed && seed.box != null && seed.next_due_ts != null
          ? { box: seed.box, lastTs: seed.last_ts ?? 0, nextDueTs: seed.next_due_ts }
          : undefined);
      st.review[rec.skillId] = scheduleAfterResult(prevReview, rec.correct);
    }
  }
  writeState(app, st);
}

/** つづけてノーミスの数（0〜1。アプリの足場の出し分けに使う） */
export function dojoMasteryStreak(app: string, skillId: string): number {
  const m = readState(app).mastery[skillId];
  const n = m ? (m.perfectStreak ?? 0) : Math.min(seeds.get(`${app}|${skillId}`)?.perfect_streak ?? 0, MASTERY_STREAK);
  return Math.min(n / MASTERY_STREAK, 1);
}

export function dojoTodaySkillCount(app: string, skillId: string): number {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return readState(app).logs.filter((l) => l.ts >= start.getTime() && l.correct && l.skillId === skillId).length;
}

/**
 * ふくしゅうの時期が来ている項目（サーバの記録＝単元アプリでも道場でも、いちばん最近の予定）。
 * 道場で解いた分は 端末の予定を優先する（サーバに届くまで 数秒かかるため）。
 */
export function dueItems(items: readonly DojoItem[], rows: readonly MySkillRow[], now = Date.now()): DojoItem[] {
  const out: Array<{ it: DojoItem; due: number }> = [];
  for (const it of items) {
    let due = Infinity;
    const local = readState(it.app);
    for (const sk of it.skills) {
      const loc = local.review[sk];
      const row = rows.find((r) => r.app_id === it.app && r.skill_id === sk);
      const latest = loc && (!row?.last_ts || loc.lastTs >= row.last_ts) ? loc.nextDueTs : row?.next_due_ts ?? null;
      if (latest != null && latest <= now) due = Math.min(due, latest);
    }
    if (due !== Infinity) out.push({ it, due });
  }
  return out.sort((a, b) => a.due - b.due).map((x) => x.it);
}
