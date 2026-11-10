/**
 * hooks/useSanmonPortal.ts — 名乗り・町の解放・スタミナ（学級ポータル）
 *
 * きまり（どの町が開くか・スタミナの数）は learning-app-kit/sanmon に1か所だけある。
 * 子ども用ハブと同じ関数で判定するので、ハブで「開いた」町は SANMON でも必ず開いている。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStudent, subscribeStudent, isTrial, trialAllows, type StudentIdentity } from 'learning-app-kit/sync';
import { usePortalConfig } from 'learning-app-kit/react';
import {
  fetchSanmonStatus, fetchSanmonModes, staminaForTown, sanmonUnits, sanmonShards, spendStamina, isModeOpen, SANMON_RULES,
  modeLockMessage, isSchoolHoursLocked, reportLockHit,
  type SanmonStatus, type SanmonUnitProgress, type SanmonModes, type SanmonModeKey,
} from 'learning-app-kit/sanmon';
import { MATH_CATEGORIES } from '../constants';
import { PORTAL, isPortalConfigured } from '../services/portal';
import { useLevelCaps } from '../data/adventure/growth';
import { isDemo } from '../services/saveProfile';

export interface SanmonPortal {
  student: StudentIdentity | null;
  /** サーバから読めたか（読めないうちは アプリの無い町だけ開く） */
  loaded: boolean;
  /** 共通スタミナ（どこでも使える。がんばりボーナスでたまる） */
  stamina: number;
  /** 町のスタミナ（町の key → その町で使える分。その単元アプリの正解でたまる。2026-11-09〜） */
  towns: Record<string, number>;
  /** その町で使えるスタミナ（町・共通・合計）。町の key は kit の SANMON_UNITS の key */
  staminaIn: (townKey: string | null) => { town: number; common: number; total: number };
  earnedToday: number;
  units: SanmonUnitProgress[];
  /** まだ開いていない町の単元名（MATH_CATEGORIES の name）。ぼうけん・デュエルで使う */
  lockedUnitNames: Set<string>;
  refresh: () => Promise<void>;
  /** 先生がそのモードを開いているか（PRISM の SANMON タブで学級ごとに決める）。読めないうちは開いている扱い */
  modeOpen: (key: SanmonModeKey) => boolean;
  /** 閉じているモードを押したときの文（開いていれば null）。平日モード（授業の時間）なら「◯◯から あそべるよ」 */
  modeLock: (key: SanmonModeKey) => string | null;
  /** メニューのボタンに出す短い文（開いていれば null） */
  modeLockShort: (key: SanmonModeKey) => string | null;
  /** 平日モードで閉じているモードを押したことをサーバに残す（先生の PRISM に「押した回数」として出る） */
  reportLock: (key: SanmonModeKey) => void;
  /** バトル1回ぶんのスタミナを使う。足りなければ false（使わない） */
  spendForBattle: (reason: string) => Promise<{ ok: boolean; message?: string }>;
}

/**
 * 先生が PRISM の SANMON タブで、この子の番号だけゲームを止めているか（2026-11-09。サーバの sanmon_modes が _student_lock を付ける）。
 * 理由は出さない（友だちに見られても分からないように）。止まるのはゲームだけで、れんしゅう・ふくしゅう・テストはできる。
 */
const STUDENT_LOCK_MESSAGE = 'せんせいと おはなししてね';
const studentLocked = (modes: SanmonModes, key: SanmonModeKey) =>
  !isModeOpen(modes, key) && (modes as SanmonModes & { _student_lock?: boolean })._student_lock === true;

export function useSanmonPortal(): SanmonPortal {
  const [student, setStudent] = useState<StudentIdentity | null>(() => getStudent());
  const [status, setStatus] = useState<SanmonStatus | null>(null);
  const [modes, setModes] = useState<SanmonModes>({});

  useEffect(() => subscribeStudent((s) => setStudent(s)), []);
  // 体験版（SOL の体験の入口から開いたとき）：モードは PRISM の管理タブの設定で決まる。クラス対戦は学級が要るので いつも閉じる
  const portalCfg = usePortalConfig();
  const trial = isTrial();
  const trialOpen = (key: SanmonModeKey) => key !== 'class_duel' && trialAllows(key, portalCfg);

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
  // 平日モード（授業の時間）は時刻で開け閉めが変わるので、開いているあいだは2分ごとにモードだけ読みなおす（サーバの時計で決まる）
  useEffect(() => {
    if (!isPortalConfigured || !student) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      void fetchSanmonModes(PORTAL, student.studentId).then((m) => { if (m.ok) setModes(m.modes); });
    }, 120_000);
    return () => clearInterval(t);
  }, [student]);
  // 単元アプリで頑張ってから戻ってきたときに、スタミナと町を読みなおす
  useEffect(() => {
    const onVis = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  // デモモード（アプリ紹介用）は すべての町を開く（記録は送らない・セーブは端末だけ。services/saveProfile.ts）
  const units = useMemo(() => {
    const u = sanmonUnits(status);
    return isDemo() ? u.map((x) => ({ ...x, open: true })) : u;
  }, [status]);
  const lockedUnitNames = useMemo(() => {
    const open = new Set(units.filter((u) => u.open).map((u) => u.name));
    return new Set(MATH_CATEGORIES.map((c) => c.name).filter((n) => !open.has(n)));
  }, [units]);

  const spendForBattle = useCallback(async (reason: string) => {
    const s = getStudent();
    // おためし（学級コードなし）: スタミナを使わずに バトルできる。記録は サーバに送らず、セーブも学級とは別（services/saveProfile.ts）
    if (!isPortalConfigured || !s) return { ok: true };
    const eventId = `battle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // ぼうけんの町のバトルは reason が「wild@div1」のように町つき。サーバが 町 → 共通 の順に使う（2026-11-09）
    const base = reason.split('@')[0];
    const townKey = reason.includes('@') ? reason.split('@')[1] : null;
    const r = await spendStamina(PORTAL, s.studentId, eventId, SANMON_RULES.battleCost, reason);
    if (r.stamina != null) setStatus((st) => (st ? { ...st, stamina: r.stamina! } : st));
    // 町のスタミナも変わるので読みなおす（バトルを始めるときだけ。1回 数十ms）
    if (r.ok) { void refresh(); return { ok: true }; }
    // サーバがことわった（そのモードが閉じている＝授業の時間・先生が閉じた）ときは、モードを読みなおす。
    // 閉じていれば App がメニューにもどす（2026-11-09）。sanmon_spend は reason でモードを見分ける
    if (r.stamina == null) {
      const m = await fetchSanmonModes(PORTAL, s.studentId);
      if (m.ok) {
        setModes(m.modes);
        const key: SanmonModeKey = base === 'speed_duel' ? 'speed' : base === 'monster_duel' ? 'monster' : 'adventure';
        const lock = studentLocked(m.modes, key) ? STUDENT_LOCK_MESSAGE : modeLockMessage(m.modes, key);
        if (lock) return { ok: false, message: lock };
      }
    }
    if (r.stamina == null) return { ok: false, message: r.message };
    if (townKey) {
      const t = status?.towns?.[townKey] ?? 0;
      return { ok: false, message: `スタミナが たりないよ（この町 ${t}・共通 ${r.stamina}。バトルには ${SANMON_RULES.battleCost}）。この町の 単元アプリで れんしゅう・本番テスト・実力の階段を すると、この町の スタミナが たまるよ` };
    }
    return { ok: false, message: `スタミナが たりないよ（共通 ${r.stamina}・バトルには ${SANMON_RULES.battleCost}）。実力の階段の はじめての段・はじめての熟達で 共通スタミナが たまるよ` };
  }, [refresh, status]);

  return {
    student, loaded: !!status, stamina: status?.stamina ?? 0, earnedToday: status?.earnedToday ?? 0,
    towns: status?.towns ?? {}, staminaIn: (townKey: string | null) => staminaForTown(status, townKey),
    units, lockedUnitNames, refresh, spendForBattle,
    modeOpen: (key: SanmonModeKey) => (trial ? trialOpen(key) : isModeOpen(modes, key)),
    modeLock: (key: SanmonModeKey) => (trial ? (trialOpen(key) ? null : 'たいけんばんでは つかえないよ')
      : studentLocked(modes, key) ? STUDENT_LOCK_MESSAGE : modeLockMessage(modes, key)),
    modeLockShort: (key: SanmonModeKey) => trial ? (trialOpen(key) ? null : '🔒 たいけんばんでは つかえないよ') : isModeOpen(modes, key) ? null
      : studentLocked(modes, key) ? `🔒 ${STUDENT_LOCK_MESSAGE}`
      : isSchoolHoursLocked(modes, key) ? `🔒 じゅぎょうの じかん（${modes._school_hours!.end}から）` : '🔒 先生が まだ ひらいていないよ',
    reportLock: (key: SanmonModeKey) => {
      const s = getStudent();
      if (s && isSchoolHoursLocked(modes, key)) void reportLockHit(PORTAL, s.studentId, key);
    },
  };
}
