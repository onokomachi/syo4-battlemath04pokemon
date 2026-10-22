/**
 * services/portal.ts — 学級ポータル（Supabase gakkyu-portal）とのつなぎ
 *
 * SANMON は学級ポータルの一部として動く（2026-10〜。それまでは Firebase）。
 * - 名乗り … 学級コード＋出席番号（learning-app-kit の JoinGate／ハブからの #c=&n=）。氏名は扱わない
 * - 町の解放・スタミナ … learning-app-kit/sanmon（子ども用ハブと同じきまり）。計算はサーバがする
 * - 学習の記録 … 1問ごとの記録と本番テストを learning_event / test_result へ（app_id 'sanmon'）。
 *   PRISM でほかの単元アプリと同じように見られる。SANMON の正解はスタミナには数えない
 * - セーブデータ … 図鑑・バッジ・ぼうけんの進み具合を sanmon_save へ（端末をまたいで続きから）
 */
import { flushEvents, getStudent, type LogLike } from 'learning-app-kit/sync';
import { saveSanmonSave, loadSanmonSave, SANMON_APP_ID } from 'learning-app-kit/sanmon';
import { MATH_CATEGORIES, UNIT_KEYS } from '../constants';
import { getProblemLogs, getTestRecords } from './learningLogService';

const env = ((import.meta as { env?: Record<string, string | undefined> }).env) ?? {};

export const PORTAL = {
  supabaseUrl: env.VITE_SUPABASE_URL,
  supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
};
export const isPortalConfigured = !!(PORTAL.supabaseUrl && PORTAL.supabaseKey);

const PUSH = { appId: SANMON_APP_ID, ...PORTAL };

/** サブトピック名 → 町の記号（module_id） */
const UNIT_OF: Record<string, string> = Object.fromEntries(
  MATH_CATEGORIES.flatMap((c) => c.groups.flatMap((g) => g.subtopics.map((t) => [t, UNIT_KEYS[c.name] ?? 'other']))),
);

/** 問題文の {} マークアップなどを落として、人が読める見出しにする */
const plainLabel = (q: string) => q.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);

function toLogs(): LogLike[] {
  const logs: LogLike[] = getProblemLogs().map((l) => ({
    id: l.id,
    ts: l.ts,
    skillId: l.subTopic,
    moduleId: UNIT_OF[l.subTopic] ?? 'other',
    correct: l.correct,
    label: `${l.mode === 'battle' ? 'バトル' : l.mode === 'speed' ? 'デュエル' : l.mode === 'review' ? 'ふくしゅう' : 'れんしゅう'}：${plainLabel(l.question)}`,
  }));
  for (const t of getTestRecords()) {
    logs.push({
      id: `test-${t.id}`.slice(0, 64),
      ts: t.ts,
      skillId: 'mock-test',
      moduleId: 'mock-test',
      correct: t.total === t.totalMax,
      label: `本番テスト（${t.setName ?? ''} ${t.mode}）${t.total}/${t.totalMax}点`,
      detail: {
        mode: t.mode, omoteScore: t.omoteScore, omoteMax: t.omoteMax, uraScore: t.uraScore, uraMax: t.uraMax,
        total: t.total, totalMax: t.totalMax,
        steps: t.steps.map((s) => ({ daimon: s.daimon, title: s.title, points: s.points, earned: s.earned, correct: s.correct })),
      },
    });
  }
  return logs.sort((a, b) => a.ts - b.ts);
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** まだ送っていない記録を送る（少しまとめてから）。失敗しても次の機会に送り直す */
export function syncLearningToPortal(wait = 2000): void {
  if (!isPortalConfigured) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void flushEvents(PUSH, toLogs()); }, wait);
}

/* ---------------- セーブデータ ---------------- */

/**
 * 端末をまたいで引きつぐ localStorage のキー（図鑑・バッジ・ぼうけん・習熟度・テスト）。
 * 1問ごとのログ（直近500件）はサーバの learning_event にあるので入れない（大きいため）。
 */
const SAVE_KEY_PATTERNS = [/^bm_/, /^battleMath/, /^fb_/];
const EXCLUDE = new Set(['fb_problem_logs_v1', 'battleMathStudentProfile', 'fb_unit_locks_cache', 'fb_admin_emails_cache', 'bm_active_pvp_session']);
const SAVED_AT = 'sanmon_portal_saved_at';

function collectSave(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || EXCLUDE.has(k) || k === SAVED_AT) continue;
    if (SAVE_KEY_PATTERNS.some((re) => re.test(k))) out[k] = localStorage.getItem(k) ?? '';
  }
  return out;
}

let lastSent = '';
/** セーブデータをサーバへ。中身が変わっていなければ送らない */
export async function pushSave(): Promise<void> {
  const s = getStudent();
  if (!isPortalConfigured || !s) return;
  const data = collectSave();
  const body = JSON.stringify(data);
  if (body === lastSent) return;
  const savedAt = Date.now();
  if (await saveSanmonSave(PORTAL, s.studentId, { savedAt, keys: data })) {
    lastSent = body;
    try { localStorage.setItem(SAVED_AT, String(savedAt)); } catch { /* noop */ }
  }
}

/**
 * サーバのセーブデータが この端末より新しければ取りこむ（取りこんだら true。画面を読みなおす）。
 * 別の端末で遊んだ続きを、この端末でも遊べるようにする。
 */
export async function pullSaveIfNewer(): Promise<boolean> {
  const s = getStudent();
  if (!isPortalConfigured || !s) return false;
  const r = await loadSanmonSave(PORTAL, s.studentId);
  if (!r.ok || !r.data) return false;
  const remote = r.data as { savedAt?: number; keys?: Record<string, string> };
  const localAt = Number(localStorage.getItem(SAVED_AT) ?? 0);
  if (!remote.keys || !remote.savedAt || remote.savedAt <= localAt) return false;
  try {
    for (const [k, v] of Object.entries(remote.keys)) localStorage.setItem(k, v);
    localStorage.setItem(SAVED_AT, String(remote.savedAt));
  } catch { return false; }
  return true;
}
