/**
 * services/duel.ts — クラス対戦（同じ学級の2人が、つかまえたモンスターの問題で早押し）
 *
 * 勝ち負けはサーバ（Supabase の sanmon_duel_* 関数）が決める。端末は「答えた・正しかった」を送るだけ。
 * 端末どうしの合図は Realtime Broadcast（公開チャンネル。部屋の名前はサーバが作る推測できない文字列）で、
 * 中身は「状態が変わった」だけ。受けた側はサーバから読みなおす。合図が届かない回線でも動くように、数秒ごとにも読む。
 *
 * 名乗りは学級ポータルのほかの関数と同じく student_id（learning-app-kit の getStudent）。
 */
import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';
import { PORTAL } from './portal';
import type { ElementId } from '../data/adventure/elements';

export type DuelFormat = 'best_of_3' | 'best_of_5' | 'party_3' | 'party_5';
export type DuelSide = 'host' | 'guest' | 'draw';

/** パーティの1匹（サーバの _pduel_party と同じ形。HP・強さはサーバが計算する） */
export interface ServerDuelMon {
  uid: string;
  defId: string;
  level: number;
  subtopic: string;
  type: ElementId;
  maxHp: number;
  hp: number;
  power: number;
}

export interface DuelHit { damage: number; crit: boolean; type: number; grit: number }

/** 前のターンの結果（自分から見た形） */
export interface DuelLastTurn {
  turn: number;
  my_hit: DuelHit | null;
  opp_hit: DuelHit | null;
  my_ko: boolean;
  opp_ko: boolean;
  my_correct: boolean | null;
  opp_correct: boolean | null;
  my_defid: string | null;
  opp_defid: string | null;
}

/** サーバが返す「自分から見た」対戦の状態（_duel_view と同じ形） */
export interface DuelView {
  id: string;
  topic: string;
  status: 'waiting' | 'playing' | 'finished';
  format: DuelFormat;
  role: 'host' | 'guest';
  opp_number: number | null;
  my_monsters: string[];
  opp_monsters: string[] | null;
  round: number;
  total_rounds: number;
  need_wins: number;
  round_subtopic: string | null;
  round_start: string | null;
  round_deadline: string | null;
  my_answered: boolean;
  opp_answered: boolean;
  history: DuelSide[];
  my_score: number;
  opp_score: number;
  my_correct: number;
  winner: DuelSide | null;
  end_reason: 'score' | 'left' | 'cancel' | null;
  server_now: string;
  /** パーティの対戦（3か5）。古い早押しの対戦は null */
  party_size: number | null;
  my_party: ServerDuelMon[] | null;
  opp_party: ServerDuelMon[] | null;
  my_active: number;
  opp_active: number;
  my_miss: number;
  last_turn: DuelLastTurn | null;
}

export interface DuelRoom {
  id: string;
  host_number: number;
  host_monsters: string[];
  format: DuelFormat;
  created_at: string;
  party_size: number | null;
  host_party: { defId: string; level: number }[] | null;
}

export interface DuelLobby {
  lobby: string;
  mine: DuelView | null;
  rooms: DuelRoom[];
}

/** 通信の失敗（つながらない・時間切れ）。サーバが「だめ」と返したもの（スタミナ・へやが しまった など）とは分ける */
export class NetworkError extends Error {}

/** 1回の問い合わせの 時間の上限（遅い Wi‑Fi でも 返事を待ちつづけて 止まって見えないように。2026-11-19） */
const RPC_TIMEOUT_MS = 8000;

async function rpc<T>(fn: string, body: Record<string, unknown>, timeoutMs = RPC_TIMEOUT_MS): Promise<T> {
  const { supabaseUrl, supabaseKey } = PORTAL;
  if (!supabaseUrl || !supabaseKey) throw new Error('学級ポータルに つながっていません');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    text = await res.text();
  } catch {
    throw new NetworkError(ctrl.signal.aborted
      ? 'つうしんに じかんが かかっているよ。もういちど ためしてね'
      : 'サーバに つながらないよ。インターネットに つながっているか たしかめてね');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let message = text;
    try { message = (JSON.parse(text) as { message?: string }).message ?? text; } catch { /* そのまま */ }
    // サーバが いそがしい（5xx）ときも 通信の失敗と同じく もう一度 ためせる
    if (res.status >= 500) throw new NetworkError(message || `HTTP ${res.status}`);
    throw new Error(message || `HTTP ${res.status}`);
  }
  return JSON.parse(text) as T;
}

/**
 * 通信の失敗のときだけ、少し待って もう一度 送る（サーバが「だめ」と返したときは すぐ やめる）。
 * 同じものを2回送っても よいもの（読みなおし・答え）にだけ使う。
 */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (!(e instanceof NetworkError) || i === tries - 1) break;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw last;
}

export const duelApi = {
  list: (studentId: string) => rpc<DuelLobby>('sanmon_duel_list', { p_student_id: studentId }),
  create: (studentId: string, monsters: string[], subtopics: string[], format: DuelFormat) =>
    rpc<DuelView>('sanmon_duel_create', { p_student_id: studentId, p_monsters: monsters, p_subtopics: subtopics, p_format: format }),
  join: (studentId: string, duelId: string, monsters: string[], subtopics: string[]) =>
    rpc<DuelView>('sanmon_duel_join', { p_student_id: studentId, p_duel_id: duelId, p_monsters: monsters, p_subtopics: subtopics }),
  state: (studentId: string, duelId: string) =>
    rpc<DuelView>('sanmon_duel_state', { p_student_id: studentId, p_duel_id: duelId }),
  answer: (studentId: string, duelId: string, round: number, correct: boolean, ms: number) =>
    rpc<DuelView>('sanmon_duel_answer', { p_student_id: studentId, p_duel_id: duelId, p_round: round, p_correct: correct, p_ms: Math.round(ms) }),
  /** パーティの対戦（2026-10〜）。モンスターは uid でえらび、レベルはサーバのセーブから読む */
  createParty: (studentId: string, uids: string[], size: number) =>
    rpc<DuelView>('sanmon_pduel_create', { p_student_id: studentId, p_uids: uids, p_size: size }),
  joinParty: (studentId: string, duelId: string, uids: string[]) =>
    rpc<DuelView>('sanmon_pduel_join', { p_student_id: studentId, p_duel_id: duelId, p_uids: uids }),
  answerParty: (studentId: string, duelId: string, round: number, correct: boolean, ms: number) =>
    rpc<DuelView>('sanmon_pduel_answer', { p_student_id: studentId, p_duel_id: duelId, p_round: round, p_correct: correct, p_ms: Math.round(ms) }),
  leave: (studentId: string, duelId: string) =>
    rpc<DuelView>('sanmon_duel_leave', { p_student_id: studentId, p_duel_id: duelId }),
};

let client: RealtimeClient | null = null;
function realtime(): RealtimeClient | null {
  const { supabaseUrl, supabaseKey } = PORTAL;
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) {
    client = new RealtimeClient(`${supabaseUrl.replace(/^http/, 'ws')}/realtime/v1`, { params: { apikey: supabaseKey } });
  }
  return client;
}

/**
 * 合図の部屋に入る。onChange は「だれかが状態を変えた」ときに呼ばれる（中身は信用しない。読みなおすきっかけだけ）。
 * 戻り値の ping() で、自分が状態を変えたことを相手に知らせる。leave() で出る。
 * live() は 合図が つながっているか（つながっていれば 読みなおしを 少なくする。2026-11-19）。
 * onReady は つながった ときに 1回 よばれる（つながる前に送った合図は とどかないため）。
 */
export function joinSignal(topic: string, onChange: () => void, onReady?: () => void): { ping: () => void; leave: () => void; live: () => boolean } {
  const rt = realtime();
  if (!rt) return { ping: () => {}, leave: () => {}, live: () => false };
  let ok = false;
  let readyCalled = false;
  const ch: RealtimeChannel = rt.channel(topic, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'changed' }, () => onChange());
  ch.subscribe((status) => {
    ok = status === 'SUBSCRIBED';
    if (ok && onReady && !readyCalled) { readyCalled = true; onReady(); }
  });
  return {
    ping: () => { void ch.send({ type: 'broadcast', event: 'changed', payload: {} }); },
    leave: () => { ok = false; void rt.removeChannel(ch); },
    live: () => ok,
  };
}

/** 端末の時計とサーバの時計のずれ（ms）。サーバの時刻 − 端末の時刻 */
export function clockOffset(view: DuelView, receivedAt: number): number {
  return new Date(view.server_now).getTime() - receivedAt;
}

/**
 * ラウンドの問題を選ぶ。2人が同じ番号を選ぶように、部屋の名前とラウンドから決める
 * （アプリと同じ答え方の問題は、出すたびに数字が変わるので「同じレベル・ちがう数字」になる）。
 * 同じ分野が何回か出るときは、ちがう問題になるように ずらす。
 */
export function pickIndex(topic: string, subtopic: string, occurrence: number, size: number): number {
  if (size <= 0) return 0;
  let h = 2166136261;
  for (const ch of `${topic}|${subtopic}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) + occurrence) % size;
}
