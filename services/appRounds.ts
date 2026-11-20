/**
 * services/appRounds.ts — 単元アプリの解答画面を、アプリごとに読みこむ（2026-11-20）。
 * 道場（DojoScreen）とバトル・れんしゅう（AppRoundHost）が使う。くわしくは apps/registryLoaders.ts。
 */
import type { AppRoundDef, AppTestDef } from '../apps/types';

type Rounds = Record<string, AppRoundDef>;
const cache = new Map<string, Promise<Rounds | null>>();
const done = new Map<string, Rounds>();

/** そのアプリの解答画面を読みこむ（いちど読んだら使いまわす）。無いアプリ・読みこめないときは null（読みこめなかったときは次に やりなおせる） */
export function loadAppRounds(app: string): Promise<Rounds | null> {
  let p = cache.get(app);
  if (!p) {
    p = import('../apps/registryLoaders')
      .then((m) => m.APP_ROUND_LOADERS[app]?.() ?? null)
      .then((r) => { if (r) done.set(app, r); return r; })
      .catch(() => { cache.delete(app); return null; });
    cache.set(app, p);
  }
  return p;
}

const testCache = new Map<string, Promise<AppTestDef[]>>();
/** そのアプリの本番テスト（スタミナ道場）を読みこむ。無いアプリ・読みこめないときは空 */
export function loadAppTests(app: string): Promise<AppTestDef[]> {
  let p = testCache.get(app);
  if (!p) {
    p = import('../apps/registryLoaders')
      .then((m) => m.APP_TEST_LOADERS[app]?.() ?? [])
      .catch(() => { testCache.delete(app); return [] as AppTestDef[]; });
    testCache.set(app, p);
  }
  return p;
}

/** もう読みこんであれば、すぐ返す（画面のちらつきを防ぐ） */
export const loadedAppRounds = (app: string): Rounds | null => done.get(app) ?? null;

/** あとで使うので、いま読みこんでおく（失敗しても気にしない） */
export function prefetchAppRounds(apps: readonly string[]): void {
  for (const a of apps) void loadAppRounds(a);
}
