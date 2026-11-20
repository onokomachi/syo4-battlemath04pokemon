// このファイルは単元アプリ syo4-syousu-v2 の src/lib/moduleOfSkill.ts の写し（scripts/sync-app-sources.mjs）。手で直さない。
/**
 * 記録の名前（skillId）から モジュールを決める。
 * ストア（progressStore）から切り出してある——ストアは保存先（ブラウザ・Supabase）を読みこむので、
 * 問題の自動チェック（scripts/verify-muldiv.ts を node で動かす）からは読めないため。
 */
export type ModuleId =
  | 'decimal-addsub'
  | 'decimal-muldiv'
  | 'error-hunter'
  | 'number-line'
  | 'place-value'
  | 'word-problem'
  | 'mock-test';

/** skillId のプレフィックスから所属モジュールを判定（累計カウンタの移行・まちがいマップ集計用） */
export function skillToModuleId(skillId: string): ModuleId | null {
  if (skillId === 'mock-test' || skillId.startsWith('mock-')) return 'mock-test';
  if (skillId.startsWith('addsub-')) return 'decimal-addsub';
  if (skillId.startsWith('mul-') || skillId.startsWith('div-') || skillId.startsWith('muldiv-')) return 'decimal-muldiv';
  if (skillId.startsWith('compare-') || skillId.startsWith('line-') || skillId.startsWith('lineread-') || skillId.startsWith('order-')) return 'number-line';
  if (skillId.startsWith('compose-') || skillId.startsWith('collect-') || skillId.startsWith('scale-') || skillId.startsWith('unit-') || skillId.startsWith('placeid-') || skillId.startsWith('decompose-')) return 'place-value';
  if (skillId.startsWith('wp-') || skillId.startsWith('word-')) return 'word-problem';
  if (skillId.startsWith('judge-') || skillId.startsWith('fix-') || skillId.startsWith('eh-') || skillId.startsWith('error-')) return 'error-hunter';
  return null;
}
