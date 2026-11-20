/**
 * 小数アプリの「ふりかえり」の保存（reflectionStore）の代わり。
 * 本番テストの「できたつもり」チェックの記録だけ使う。SANMON の道場では保存しない（学級ポータルに送るものではない）。
 */
interface CalibrationRecord { ts?: number; skillId: string; predicted: number; actual: number }
const state = { addCalibration: (_r: CalibrationRecord) => {} };
type S = typeof state;
export function useReflectionStore<T>(selector: (s: S) => T): T { return selector(state); }
