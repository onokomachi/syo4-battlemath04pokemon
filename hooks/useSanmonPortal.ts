/**
 * hooks/useSanmonPortal.ts — 名乗り・町の解放・スタミナ（学級ポータル）
 *
 * きまり（どの町が開くか・スタミナの数）は learning-app-kit/sanmon に1か所だけある。
 * 子ども用ハブと同じ関数で判定するので、ハブで「開いた」町は SANMON でも必ず開いている。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStudent, subscribeStudent, type StudentIdentity } from 'learning-app-kit/sync';
import {
  fetchSanmonStatus, fetchSanmonModes, sanmonUnits, sanmonShards, spendStamina, isModeOpen, SANMON_RULES,
  type SanmonStatus, type SanmonUnitProgress, type SanmonModes, type SanmonModeKey,
} from 'learning-app-kit/sanmon';
import { MATH_CATEGORIES } from '../constants';
import { PORTAL, isPortalConfigured } from '../services/portal';
import { useLevelCaps } from '../data/adventure/growth';

export interface SanmonPortal {
  student: StudentIdentity | null;
  /** サーバから読めたか（読めないうちは アプリの無い町だけ開く） */
  loaded: boolean;
  stamina: number;
  earnedToday: number;
  units: SanmonUnitProgress[];
  /** まだ開いていない町の単元名（MATH_CATEGORIES の name）。ぼうけん・デュエルで使う */
  lockedUnitNames: Set<string>;
  refresh: () => Promise<void>;
  /** 先生がそのモードを開いているか（PRISM の SANMON タブで学級ごとに決める）。読めないうちは開いている扱い */
  modeOpen: (key: SanmonModeKey) => boolean;
  /** バトル1回ぶんのスタミナを使う。足りなければ false（使わない） */
  spendForBattle: (reason: string) => Promise<{ ok: boolean; message?: string }>;
}

export function useSanmonPortal(): SanmonPortal {
  const [student, setStudent] = useState<StudentIdentity | null>(() => getStudent());
  const [status, setStatus] = useState<SanmonStatus | null>(null);
  const [modes, setModes] = useState<SanmonModes>({});

  useEffect(() => subscribeStudent((s) => setStudent(s)), []);

  const refresh = useCallback(async () => {
    const s = getStudent();
    if (!isPortalConfigured || !s) { setStatus(null); setModes({}); useLevelCaps.getState().setShards(null); return; }
    const [r, m] = await Promise.all([fetchSanmonStatus(PORTAL, s.studentId), fetchSanmonModes(PORTAL, s.studentId)]);
    if (r.ok) {
      setStatus(r.status);
      // モンスターのレベルの上限（単元のかけら）。サーバの記録から決める
      useLevelCaps.getState().setShards(sanmonShards(r.status));
    }
    if (m.ok) setModes(m.modes);
  }, []);

  useEffect(() => { void refresh(); }, [refresh, student?.studentId]);
  // 単元アプリで頑張ってから戻ってきたときに、スタミナと町を読みなおす
  useEffect(() => {
    const onVis = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  const units = useMemo(() => sanmonUnits(status), [status]);
  const lockedUnitNames = useMemo(() => {
    const open = new Set(units.filter((u) => u.open).map((u) => u.name));
    return new Set(MATH_CATEGORIES.map((c) => c.name).filter((n) => !open.has(n)));
  }, [units]);

  const spendForBattle = useCallback(async (reason: string) => {
    const s = getStudent();
    // おためし（学級コードなし）: スタミナを使わずに バトルできる。記録は サーバに送らず、セーブも学級とは別（services/saveProfile.ts）
    if (!isPortalConfigured || !s) return { ok: true };
    const eventId = `battle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const r = await spendStamina(PORTAL, s.studentId, eventId, SANMON_RULES.battleCost, reason);
    if (r.stamina != null) setStatus((st) => (st ? { ...st, stamina: r.stamina! } : st));
    if (r.ok) return { ok: true };
    return { ok: false, message: r.stamina == null ? r.message : `スタミナが たりないよ（いま ${r.stamina}・バトルには ${SANMON_RULES.battleCost}）。単元の アプリで れんしゅうすると たまるよ` };
  }, []);

  return {
    student, loaded: !!status, stamina: status?.stamina ?? 0, earnedToday: status?.earnedToday ?? 0,
    units, lockedUnitNames, refresh, spendForBattle,
    modeOpen: (key: SanmonModeKey) => isModeOpen(modes, key),
  };
}
