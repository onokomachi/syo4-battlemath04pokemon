/**
 * 単元アプリの progressStore の代わり。
 * ふだん（れんしゅう・バトルなど）は、記録は SANMON の learningLogService が取る（サブトピック単位）。アプリの記録は作らない。
 *
 * スタミナ道場（2026-11-20〜）のときだけ、道場が「受け取り口」（setDojoSink）をつなぐ。
 * アプリの解答画面が作った記録（項目の名前・まちがえた回数・とちゅうでやめた印）を そのまま受け取り、
 * 単元アプリで解いたのと同じ記録として送る（services/dojo.ts）。熟達の数も道場の記録から返す
 * （アプリによっては、熟達した項目では足場を出さないため）。
 */
export interface DojoSink {
  recordResult: (r: unknown) => void;
  getMasteryStreak: (skillId: string) => number;
  getTodaySkillCount: (skillId: string) => number;
}

let sink: DojoSink | null = null;
/** 道場の画面が開いているあいだだけ つなぐ */
export function setDojoSink(s: DojoSink): void { sink = s; }
/** はずす（自分が つないだ受け取り口のときだけ。開きなおしで つないだ新しい口を はずさない） */
export function clearDojoSink(s: DojoSink): void { if (sink === s) sink = null; }

const state = {
  recordResult: (r: unknown) => { sink?.recordResult(r); },
  getMasteryStreak: (skillId: string) => sink?.getMasteryStreak(skillId) ?? 0,
  getTodaySkillCount: (skillId: string) => sink?.getTodaySkillCount(skillId) ?? 0,
  mastery: {} as Record<string, unknown>,
};
type S = typeof state;
export function useProgressStore<T>(selector: (s: S) => T): T { return selector(state); }
useProgressStore.getState = () => state;

/** アプリによっては skill_id → モジュールの対応も progressStore から読む（記録の見出し用。SANMON では使わない） */
export function skillToModuleId(_skillId: string): string | null { return null; }
export type ModuleId = string;
