/**
 * services/trialLedgerCore.ts — 体験・おためしの「台帳」の数え方（純粋な関数だけ。保存・画面は trialLedger.ts）
 *
 * 学級コードで名乗っていない子（おためし・体験版）は、記録をサーバに送らない。
 * 町の解放とスタミナは、この台帳で **端末の中だけ** で数える（2026-11-26 先生と決めた）。
 * きまりの数と判定は kit（learning-app-kit/sanmon の SANMON_TRIAL_RULES・sanmonTrialUnits・sanmonTrialEarn・sanmonTownOfSubtopic）にある。
 * ここで数を書かない。
 *
 * - 町の解放：SANMON の「れんしゅう・ふくしゅう」で、その町のサブトピックを 5れんぞくノーミス（熟達）にした数。バトル・デュエル・本番テストの答えは数えない。
 * - 町のスタミナ：町が開いたとき（アプリの無い町は 台帳を作ったとき）に 20（1回だけ）。バトル1回 3。
 *   たまるのは SANMON の れんしゅう・ふくしゅうと、その町の スタミナ道場の正解（1項目1日5まで・熟達後は半分・50まで）。
 * - 学級コードの子（getStudent あり）には 一切つかわない。
 */
import {
  SANMON_TRIAL_RULES as R, sanmonTrialUnits, sanmonTrialEarn, sanmonTownOfSubtopic,
  type SanmonUnitProgress,
} from 'learning-app-kit/sanmon';

export interface TrialLedger {
  v: 1;
  /** 熟達したサブトピック（SANMON の れんしゅう・ふくしゅうで 5れんぞくノーミス。いちど熟達したら もどらない） */
  mastered: string[];
  /** 5れんぞくの とちゅう（サブトピック → つづけて正解の数。まちがえたら 0） */
  streak: Record<string, number>;
  /** 町のスタミナ（町の key → 数。スタミナを渡した町だけ） */
  towns: Record<string, number>;
  /** 最初の 20 を 渡した町 */
  granted: string[];
  /** 「きょう」（端末の日付 YYYY-MM-DD）。日がかわったら earned を 0 にもどす */
  day: string;
  /** きょう たまった数（項目 → 数）。SANMON のサブトピックは `s|サブトピック`、道場は `d|app|skill` */
  earned: Record<string, number>;
  /** 道場で熟達した項目（`app|skill`） */
  dojoMastered: string[];
}

/** 端末の日付（YYYY-MM-DD・ローカル時刻） */
export function localDay(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 町を開いた分（アプリの無い町ははじめから）に 最初の 20 を渡す。新しく渡した町の key を返す */
function grantOpened(l: TrialLedger): string[] {
  const opened: string[] = [];
  for (const u of sanmonTrialUnits(l.mastered)) {
    if (u.open && !l.granted.includes(u.key)) {
      l.granted.push(u.key);
      l.towns[u.key] = R.startStamina;
      opened.push(u.key);
    }
  }
  return opened;
}

/** 日がかわっていたら、項目ごとの「きょう」を 0 にもどす */
function rollDay(l: TrialLedger, today: string): void {
  if (l.day !== today) { l.day = today; l.earned = {}; }
}

/** 台帳を作る（アプリの無い町は このとき 20 を もらう） */
export function emptyLedger(today: string = localDay()): TrialLedger {
  const l: TrialLedger = { v: 1, mastered: [], streak: {}, towns: {}, granted: [], day: today, earned: {}, dojoMastered: [] };
  grantOpened(l);
  return l;
}

const isNumRecord = (x: unknown): x is Record<string, number> =>
  !!x && typeof x === 'object' && !Array.isArray(x) && Object.values(x as object).every((v) => typeof v === 'number' && Number.isFinite(v));
const isStrArray = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string');

/**
 * 保存された文字から台帳を読む。こわれていたら 新しく作る。
 * 日がかわっていたら 「きょう」を 0 にもどし、開いた町に 20 を 渡しそびれていれば 渡す（保存が必要なら changed）。
 */
export function parseLedger(raw: string | null, today: string = localDay()): { ledger: TrialLedger; changed: boolean } {
  let l: TrialLedger | null = null;
  if (raw) {
    try {
      const j = JSON.parse(raw) as Partial<TrialLedger>;
      if (j && j.v === 1 && isStrArray(j.mastered) && isNumRecord(j.streak) && isNumRecord(j.towns) && isStrArray(j.granted)
        && typeof j.day === 'string' && isNumRecord(j.earned) && isStrArray(j.dojoMastered)) {
        l = { v: 1, mastered: [...j.mastered], streak: { ...j.streak }, towns: { ...j.towns }, granted: [...j.granted], day: j.day, earned: { ...j.earned }, dojoMastered: [...j.dojoMastered] };
      }
    } catch { /* こわれた台帳は 作りなおす */ }
  }
  if (!l) return { ledger: emptyLedger(today), changed: true };
  const before = JSON.stringify(l);
  rollDay(l, today);
  grantOpened(l);
  return { ledger: l, changed: JSON.stringify(l) !== before };
}

/** いまの町の「あと どれだけ」（kit の判定。アプリの無い町は はじめから開く） */
export function ledgerUnits(l: TrialLedger): SanmonUnitProgress[] {
  return sanmonTrialUnits(l.mastered);
}

/** きょう たまった数の ごうけい */
export function earnedTodayTotal(l: TrialLedger): number {
  return Object.values(l.earned).reduce((a, b) => a + b, 0);
}

export interface AnswerResult {
  /** 台帳が変わったか */
  changed: boolean;
  /** この答えで 新しく開いた町の key（最初の 20 を もらった） */
  opened: string[];
  /** この答えで 増えた町のスタミナ */
  gain: number;
}

const NOTHING: AnswerResult = { changed: false, opened: [], gain: 0 };

/**
 * SANMON の れんしゅう・ふくしゅうで 1問 答えたとき（mode が practice・review のものだけを呼ぶ）。
 * サブトピックが カタログに無ければ 何もしない。l を直接 書きかえる。
 *  - 5れんぞくノーミスで 熟達（まちがえたら 0）。熟達した数で 町が開く。
 *  - 正解のとき、その町が すでに開いていれば 町のスタミナが たまる（開いた答え自身では たまらない＝ちょうど 20 になる）。
 *    熟達ずみの項目は半分、1項目1日5まで、町は 50まで（kit の sanmonTrialEarn）。
 */
export function applyPracticeAnswer(l: TrialLedger, a: { subTopic: string; correct: boolean }, today: string = localDay()): AnswerResult {
  const town = sanmonTownOfSubtopic(a.subTopic);
  if (!town) return NOTHING;
  rollDay(l, today);
  const wasMastered = l.mastered.includes(a.subTopic);
  const wasOpen = l.granted.includes(town);
  l.streak[a.subTopic] = a.correct ? Math.min((l.streak[a.subTopic] ?? 0) + 1, R.masteryStreak) : 0;
  if (!wasMastered && l.streak[a.subTopic] >= R.masteryStreak) l.mastered.push(a.subTopic);
  const opened = grantOpened(l);
  let gain = 0;
  if (a.correct && wasOpen) {
    const key = `s|${a.subTopic}`;
    const e = sanmonTrialEarn({ earnedToday: l.earned[key] ?? 0, mastered: wasMastered, stamina: l.towns[town] ?? 0 });
    gain = e.gain;
    if (gain > 0) { l.earned[key] = e.earnedToday; l.towns[town] = e.stamina; }
  }
  return { changed: true, opened, gain };
}

/**
 * その町の スタミナ道場で 1問 正解したとき（ノーミスの正解だけを呼ぶ）。
 * 道場の項目（単元アプリの記録の名前）ごとに 1日5まで・熟達後は半分。町が開いていなければ 何もしない。
 * mastered は「いま、その項目は 5れんぞくに 届いたか」（道場の記録の数え方で出す）。
 */
export function applyDojoAnswer(l: TrialLedger, a: { app: string; skill: string; townKey: string; streakReached: boolean }, today: string = localDay()): AnswerResult {
  rollDay(l, today);
  const item = `${a.app}|${a.skill}`;
  const wasMastered = l.dojoMastered.includes(item);
  if (!wasMastered && a.streakReached) l.dojoMastered.push(item);
  if (!l.granted.includes(a.townKey)) return { changed: !wasMastered && a.streakReached, opened: [], gain: 0 };
  const key = `d|${item}`;
  const e = sanmonTrialEarn({ earnedToday: l.earned[key] ?? 0, mastered: wasMastered, stamina: l.towns[a.townKey] ?? 0 });
  if (e.gain > 0) { l.earned[key] = e.earnedToday; l.towns[a.townKey] = e.stamina; }
  return { changed: true, opened: [], gain: e.gain };
}

/** バトル1回ぶんを 町のスタミナから 使う。足りなければ ok=false（使わない） */
export function spendBattle(l: TrialLedger, townKey: string): { ok: boolean; left: number } {
  const have = l.towns[townKey] ?? 0;
  if (have < R.battleCost) return { ok: false, left: have };
  l.towns[townKey] = have - R.battleCost;
  return { ok: true, left: l.towns[townKey] };
}

/** 道場の「きょうの分・熟達」（サーバの sanmon_dojo_today と同じ形。キーは "app|skill"） */
export function dojoTodayOf(l: TrialLedger): { earned: Record<string, number>; mastered: Set<string> } {
  const earned: Record<string, number> = {};
  for (const [k, v] of Object.entries(l.earned)) if (k.startsWith('d|')) earned[k.slice(2)] = v;
  return { earned, mastered: new Set(l.dojoMastered) };
}

/** バトルの スタミナが たりないときの文（アプリの無い町は 道場が無いので「れんしゅう・ふくしゅうで」） */
export function lackMessage(town: number, hasDojo: boolean): string {
  return `スタミナが たりないよ（この町 ${Math.floor(town)}。バトルには ${R.battleCost}）。${hasDojo ? 'この町の スタミナ道場 や れんしゅう・ふくしゅうで' : 'れんしゅう・ふくしゅうで'} 問題に 正解すると たまるよ`;
}
