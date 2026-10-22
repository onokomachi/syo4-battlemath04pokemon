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

export type DuelFormat = 'best_of_3' | 'best_of_5';
export type DuelSide = 'host' | 'guest' | 'draw';

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
}

export interface DuelRoom {
  id: string;
  host_number: number;
  host_monsters: string[];
  format: DuelFormat;
  created_at: string;
}

export interface DuelLobby {
  lobby: string;
  mine: DuelView | null;
  rooms: DuelRoom[];
}

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { supabaseUrl, supabaseKey } = PORTAL;
  if (!supabaseUrl || !supabaseKey) throw new Error('学級ポータルに つながっていません');
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('サーバに つながらないよ。インターネットに つながっているか たしかめてね');
  }
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try { message = (JSON.parse(text) as { message?: string }).message ?? text; } catch { /* そのまま */ }
    throw new Error(message || `HTTP ${res.status}`);
  }
  return JSON.parse(text) as T;
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
 */
export function joinSignal(topic: string, onChange: () => void): { ping: () => void; leave: () => void } {
  const rt = realtime();
  if (!rt) return { ping: () => {}, leave: () => {} };
  const ch: RealtimeChannel = rt.channel(topic, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'changed' }, () => onChange());
  ch.subscribe();
  return {
    ping: () => { void ch.send({ type: 'broadcast', event: 'changed', payload: {} }); },
    leave: () => { void rt.removeChannel(ch); },
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
