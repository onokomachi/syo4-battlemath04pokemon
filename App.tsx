/**
 * App.tsx - BattleMath Online v3.0
 *
 * 統合機能:
 *  - Firebase Authentication (Google OAuth + Guest)  [エビデンスA: Firebase公式パターン]
 *  - 3Dアドベンチャー「ナンバーランド」(モンスター収集+算数バトル)
 *  - スピードデュエル / PvP (Firestore リアルタイム) [エビデンスA: Firebase onSnapshot]
 *  - ランキングボード                               [エビデンスA: Firestore query/orderBy]
 *  - 管理画面 (GameMaster)                          [エビデンスB: RBAC管理UI設計]
 *  - DDA (Dynamic Difficulty Adjustment)            [エビデンスB: ゲームAI適応設計]
 */
import React, { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut,
  type User
} from 'firebase/auth';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, increment,
  collection, onSnapshot, query, serverTimestamp,
  runTransaction, where,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import type { GameState, Room, BattleMode, BattleFormat, StudentProfile } from './types';
import {
  CARD_DEFINITIONS, ADMIN_EMAILS,
  DAILY_QUEST_DEFS, getTodayStr,
  SHOP_ITEMS, TITLE_DEFS, THEME_CONFIGS, DEFAULT_SCHOOL_YEAR, getCurrentSchoolYear,
  SCHOOL_NAME, TARGET_GRADE,
} from './constants';
import MainMenu from './components/MainMenu';
import PracticeMode from './components/PracticeMode';
import LevelUpModal from './components/LevelUpModal';
import AdminPasswordModal from './components/AdminPasswordModal';
import GravityBackground from './components/GravityBackground';
import LoginScreen from './components/LoginScreen';
import Matchmaking from './components/Matchmaking';
import GameMaster from './components/GameMaster';
import QuestPanel from './components/QuestPanel';
import BadgeNotification from './components/BadgeNotification';
import LoginBonusModal, { getLoginReward } from './components/LoginBonusModal';
import ClassBattleBoard from './components/ClassBattleBoard';
import { checkAnswer } from './utils/answerChecker';
import { recordProblemLog, type TestBests } from './services/learningLogService';
import { fetchLockedUnits } from './services/unitLockService';
import { fetchAdminEmails } from './services/adminAccessService';
import { getEquippedBackground, setEquippedBackground, badgeRatio, isBackgroundUnlocked, type BackgroundId } from './utils/backgroundUnlock';
import BackgroundFX from './components/BackgroundFX';
import MockTestMode from './components/MockTestMode';
import LearningLogScreen from './components/LearningLogScreen';
import {
  SPEED_DUEL_TIME_LIMIT_SEC, SPEED_DUEL_COUNTDOWN_MS, SPEED_CPU,
  speedCpuAccuracy, SPEED_DUEL_REWARDS,
} from './constants/gameBalance';
import { addIncorrectToSrs, getDueCount } from './services/spacedRepetitionService';
import { recordAttempt, getCategoryWeights } from './services/weaknessAnalysisService';
import WeaknessPanel from './components/WeaknessPanel';
import ItemShop from './components/ItemShop';
import SpeedDuelSetup from './components/SpeedDuelSetup';
import SpeedDuelBoard from './components/SpeedDuelBoard';
import NewYearPrompt from './components/NewYearPrompt';
import ReviewMode from './components/ReviewMode';
import type { BattleType, Problem, SpeedProblem } from './types';
import { shuffleDeck } from './utils/shuffle';
import { useProgressionStore, expForNextLevel, sessionCounters } from './store/progressionStore';
import {
  usePvpConnection, type SavedPvpSession,
  saveActivePvpSession, loadActivePvpSession, clearActivePvpSession, PVP_RESUME_MAX_AGE_MS,
} from './hooks/usePvpConnection';

// 3Dアドベンチャーは three.js を含み重いので、選ばれたときだけ読みこむ
// (練習モードしか使わない児童の初期読み込みを遅くしないため)
const AdventureMode = lazy(() => import('./components/adventure/AdventureMode'));

// 採点は utils/answerChecker.ts に一本化（3Dバトル・スピード対戦・練習モード共通）

// シャッフルは utils/shuffle.ts (Fisher-Yates)、進捗・ゲーミフィケーション状態は
// store/progressionStore.ts (Zustand) に一本化

/** 3Dアドベンチャーの読み込み中に出す画面 */
const AdventureLoading: React.FC = () => (
  <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-sky-300 to-emerald-100">
    <div className="text-6xl animate-bounce">🗺</div>
    <p className="mt-4 text-2xl font-black text-slate-700">ナンバーランドへ しゅっぱつ…</p>
  </div>
);

// ============================
// App Component
// ============================
const App: React.FC = () => {
  // --- Auth ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  // --- Student Profile (学年・組・番号) ---
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(() => {
    try {
      const s = localStorage.getItem('battleMathStudentProfile');
      if (!s) return null;
      const sp = JSON.parse(s);
      // 自校のみの簡易プロファイル: 学校名と学年を固定値にそろえる
      if (sp && (!sp.school || sp.grade !== TARGET_GRADE)) {
        sp.school = SCHOOL_NAME;
        sp.grade = TARGET_GRADE;
        sp.displayLabel = `${TARGET_GRADE}年${sp.classNum}組${sp.number}番`;
      }
      // 既存プロフィールに schoolYear がない場合はデフォルト設定
      if (sp && !sp.schoolYear) {
        sp.schoolYear = DEFAULT_SCHOOL_YEAR;
      }
      localStorage.setItem('battleMathStudentProfile', JSON.stringify(sp));
      return sp;
    } catch { return null; }
  });

  // --- New Year Prompt ---
  const [showNewYearPrompt, setShowNewYearPrompt] = useState(false);
  const newYearCheckedRef = useRef(false);

  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>('login_screen');
  const [gameMode, setGameMode] = useState<BattleMode>('cpu');

  // --- Player Progression & ゲーミフィケーション (Zustand store) ---
  // localStorage 永続化・Firestore 書き込みはストア内で行う
  const {
    mathPoints, playerLevel, playerExp, userLevelStats,
    levelUpInfo, setLevelUpInfo, pendingBadge, setPendingBadge,
    loginStreak, totalWins, totalCorrectAnswers, chainCount, setChainCount,
    earnedBadgeIds, ownedShopItems, equippedTitle, setEquippedTitle,
    equippedTheme, setEquippedTheme, earnedTitleIds, hintTokens,
    tutorialDone, setTutorialDone,
    dailyQuestProgress, dailyQuestDone, weeklyQuestProgress, weeklyQuestDone,
    setUid, earnBadge, handleQuestProgress, checkTitleConditions,
    onCorrectAnswerEvent: recordAnswerOutcome, flushSessionData,
    addBoostedMp, addCpuBattleMp, addExp, claimLoginBonus, handleShopPurchase,
    checkCategoryMasterBadges, recordSolveTime,
    addMathPoints, incrementTotalWins,
  } = useProgressionStore();

  // --- Battle State ---
  const [battleFormat, setBattleFormat] = useState<BattleFormat>('master_duel');

  // --- Speed Duel State ---
  const [battleType, setBattleType] = useState<BattleType>('speed_duel');
  const [speedCategories, setSpeedCategories] = useState<string[]>([]);
  const [speedProblems, setSpeedProblems] = useState<SpeedProblem[]>([]);
  const [speedRound, setSpeedRound] = useState(1);
  const [speedTotalRounds, setSpeedTotalRounds] = useState(5);
  const [speedPlayerScore, setSpeedPlayerScore] = useState(0);
  const [speedOpponentScore, setSpeedOpponentScore] = useState(0);
  const [speedPhase, setSpeedPhase] = useState<'countdown' | 'answering' | 'round_result' | 'match_over'>('countdown');
  const [speedRoundWinner, setSpeedRoundWinner] = useState<'player' | 'opponent' | 'draw' | null>(null);
  const [speedPlayerAnswered, setSpeedPlayerAnswered] = useState(false);
  const [speedOpponentAnswered, setSpeedOpponentAnswered] = useState(false);
  const [speedTimeLeft, setSpeedTimeLeft] = useState(30);
  const [speedGameResult, setSpeedGameResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const speedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speedCpuTimerRef = useRef<NodeJS.Timeout | null>(null);


  // --- PvP State ---
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const unsubscribeRoomRef = useRef<(() => void) | null>(null);
  const isHostRef = useRef(isHost);
  const processedMatchIdRef = useRef<string | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const gameModeRef = useRef<BattleMode>('cpu');
  const gameStateRef = useRef<GameState>(gameState);
  const speedPhaseRef = useRef(speedPhase);
  const battleTypeRef = useRef<BattleType>(battleType);

  // PvP接続レイヤー（ルーム一覧監視・leaveRoom・ハートビート）は hooks/usePvpConnection.ts に分離
  const { rooms, firestoreError, leaveRoom } = usePvpConnection({
    gameState, currentRoomId, user, isHostRef, currentRoomIdRef,
  });

  // --- 単元ロック(先生が管理画面から設定。未学習単元のカードを使えなくする) ---
  const [lockedUnits, setLockedUnits] = useState<Set<string>>(new Set());
  useEffect(() => {
    // 起動時に1回だけ読む(オフライン時はキャッシュ→全開放)
    fetchLockedUnits(db).then(setLockedUnits).catch(() => {});
  }, []);
  // ログインしていない(=おためしプレイ、またはFirebase未設定でのローカルプレイ)
  // ときは、先生の単元ロックを適用しない。ロックは実際のクラスの進度に
  // 合わせる機能なので、クラスに属さないおためしプレイでは全ステージを開放する。
  const EMPTY_LOCKED_UNITS = useMemo(() => new Set<string>(), []);
  const effectiveLockedUnits = user ? lockedUnits : EMPTY_LOCKED_UNITS;

  // --- 追加された管理者(先生が管理画面から追加・削除。固定のADMIN_EMAILSに加算) ---
  const [firestoreAdminEmails, setFirestoreAdminEmails] = useState<string[]>([]);
  useEffect(() => {
    fetchAdminEmails(db).then(setFirestoreAdminEmails).catch(() => {});
  }, []);

  // --- 特別な背景(バッジ獲得率で解放。wari-hissann3 から移植) ---
  const [equippedBackground, setEquippedBackgroundState] = useState<BackgroundId>(() => getEquippedBackground());
  const handleEquipBackground = useCallback((id: BackgroundId) => {
    setEquippedBackground(id);
    setEquippedBackgroundState(id);
  }, []);
  // バッジが減る運用はないが、獲得率を下回る背景を装備していたら外す(整合性ガード)
  useEffect(() => {
    const ratio = badgeRatio(earnedBadgeIds);
    if (!isBackgroundUnlocked(equippedBackground, ratio)) {
      handleEquipBackground('default');
    }
  }, [earnedBadgeIds, equippedBackground, handleEquipBackground]);

  // --- 本番テスト完了時: バッジ判定 + Firestore 同期 ---
  const handleTestFinished = useCallback((bests: TestBests, detail: { omoteScore: number; uraScore: number; total: number }) => {
    void detail;
    if (bests.bestOmote >= 50) earnBadge('test_omote_50');
    if (bests.bestOmote >= 75) earnBadge('test_omote_75');
    if (bests.bestOmote >= 90) earnBadge('test_omote_90');
    if (bests.bestOmote >= 100) earnBadge('test_omote_100');
    if (bests.bestUra >= 25) earnBadge('test_ura_25');
    if (bests.bestUra >= 40) earnBadge('test_ura_40');
    if (bests.bestUra >= 50) earnBadge('test_ura_50');
    if (bests.bestTotal >= 100) earnBadge('test_total_100');
    if (bests.bestTotal >= 140) earnBadge('test_total_140');
    if (bests.bestTotal >= 150) earnBadge('test_total_150');
    if (bests.perfectCounts.omote >= 3) earnBadge('test_omote_perfect_3');
    if (bests.perfectCounts.ura >= 3) earnBadge('test_ura_perfect_3');
    if (bests.perfectCounts.total >= 3) earnBadge('test_total_perfect_3');
    checkTitleConditions();
    // 自己ベストを Firestore の users ドキュメントへ要約同期(端末をまたぐ閲覧用)
    if (user && db) {
      updateDoc(doc(db, 'users', user.uid), {
        bestTestOmote: bests.bestOmote,
        bestTestUra: bests.bestUra,
        bestTestTotal: bests.bestTotal,
        testPerfectCounts: bests.perfectCounts,
      }).catch(() => {});
    }
  }, [earnBadge, checkTitleConditions, user]);

  // --- バトル中の一時 UI State (ストア外) ---
  // パネル表示
  const [showQuestPanel, setShowQuestPanel] = useState(false);
  const [showLoginBonus, setShowLoginBonus] = useState(false);
  const [loginBonusClaimed, setLoginBonusClaimed] = useState(false);
  const [showClassBattle, setShowClassBattle] = useState(false);
  const [showWeaknessPanel, setShowWeaknessPanel] = useState(false);
  const [showItemShop, setShowItemShop] = useState(false);

  // Sync refs
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { speedPhaseRef.current = speedPhase; }, [speedPhase]);
  useEffect(() => { battleTypeRef.current = battleType; }, [battleType]);

  // localStorage 永続化は store/progressionStore.ts の subscribe で実施
  // (studentProfile は各セット箇所で直接書き込み)


  // Splash screen timer (minimum 2 seconds)
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // ============================
  // Firebase Auth
  // ============================
  useEffect(() => {
    if (!auth) { setAuthLoading(false); return; }

    // Handle redirect result (for mobile/popup-blocked environments)
    getRedirectResult(auth).catch((e) => {
      console.warn('Redirect result check:', e);
    });

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setUid(u ? u.uid : null);
      setAuthLoading(false);
      if (u && db) {
        // Sync user data from Firestore → ストアにハイドレート
        const store = useProgressionStore.getState;
        const ref = doc(db, 'users', u.uid);
        try {
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const d = snap.data();
            if (d.mathPoints !== undefined) store().setMathPoints(d.mathPoints);
            if (d.playerLevel !== undefined) store().setPlayerLevel(d.playerLevel);
            if (d.playerExp !== undefined) store().setPlayerExp(d.playerExp);
            // ゲーミフィケーションデータ読み込み
            if (d.earnedBadgeIds) store().setEarnedBadgeIds(new Set(d.earnedBadgeIds));
            if (d.totalCorrectAnswers !== undefined) store().setTotalCorrectAnswers(d.totalCorrectAnswers);
            if (d.totalWins !== undefined) store().setTotalWins(d.totalWins);
            if (d.earnedTitleIds) store().mergeEarnedTitleIds(d.earnedTitleIds);
            // 組・番号情報をFirestoreから復元(自校のみの簡易プロファイル)
            if (d.studentProfile) {
              const sp = d.studentProfile;
              let needsSync = false;
              if (!sp.school || sp.grade !== TARGET_GRADE) {
                sp.school = SCHOOL_NAME;
                sp.grade = TARGET_GRADE;
                sp.displayLabel = `${TARGET_GRADE}年${sp.classNum}組${sp.number}番`;
                needsSync = true;
              }
              if (!sp.schoolYear) {
                sp.schoolYear = DEFAULT_SCHOOL_YEAR;
                needsSync = true;
              }
              if (needsSync) {
                updateDoc(ref, { studentProfile: sp }).catch(() => {});
              }
              setStudentProfile(sp);
              localStorage.setItem('battleMathStudentProfile', JSON.stringify(sp));
            }
            // ログインストリーク計算
            const today = getTodayStr();
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().slice(0, 10);
            const lastLogin: string = d.lastLoginDate || '';
            let newStreak: number = d.loginStreak || 0;
            if (lastLogin !== today) {
              if (lastLogin === yesterdayStr) {
                // 連続ログイン
                newStreak = newStreak + 1;
              } else if (d.hasStreakShield && lastLogin) {
                // ストリークシールド発動
                // streak維持、シールドを消費
                await updateDoc(ref, { loginStreak: newStreak, lastLoginDate: today, hasStreakShield: false }).catch(() => {});
                store().consumeStreakShield();
                store().setLoginStreak(newStreak);
                setLoginBonusClaimed(false);
                setTimeout(() => setShowLoginBonus(true), 800);
                setTimeout(() => store().checkMonthlyChampion(), 2000);
                // シールド使用通知はloginBonusModal側で表示（shieldUsedフラグ不要）
                return;
              } else {
                newStreak = 1;
              }
              await updateDoc(ref, { loginStreak: newStreak, lastLoginDate: today }).catch(() => {});
              // Show login bonus modal automatically on new day
              setLoginBonusClaimed(false);
              setTimeout(() => setShowLoginBonus(true), 800);
            } else {
              // Already logged in today - check if bonus was claimed
              setLoginBonusClaimed(!!d.loginBonusClaimedDate && d.loginBonusClaimedDate === today);
            }
            store().setLoginStreak(newStreak);
            // 月次チャンピオン称号チェック（ログイン時1回のみ）
            setTimeout(() => store().checkMonthlyChampion(), 2000);
          } else {
            // First login: initialize user doc
            await setDoc(ref, {
              uid: u.uid,
              displayName: u.displayName,
              email: u.email,
              photoURL: u.photoURL,
              mathPoints: store().mathPoints,
              playerLevel: store().playerLevel,
              playerExp: store().playerExp,
              totalWins: 0,
              totalMatches: 0,
              earnedBadgeIds: [],
              totalCorrectAnswers: 0,
              totalAnswered: 0,
              loginStreak: 1,
              lastLoginDate: getTodayStr(),
              loginBonusClaimedDate: '',
              studentProfile: studentProfile || null,
              createdAt: serverTimestamp(),
            });
            store().setLoginStreak(1);
            setLoginBonusClaimed(false);
            setTimeout(() => setShowLoginBonus(true), 800);
          }
          // クエスト進捗をlocalStorageから復元
          store().hydrateQuests();
        } catch (e) { console.error('User sync error:', e); }
      }
    });
    return () => unsub();
  }, []);

  const saveUserToFirestore = useCallback(async (updates: Record<string, any>) => {
    if (!user || !db) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
    } catch (e) { console.error('Firestore update error:', e); }
  }, [user]);

  // ============================
  // 正解イベント統合処理 (バッジ・クエスト等はストア側で実施)
  // ここでは正解ヒント表示のみ App 側で扱う
  // ============================
  const onCorrectAnswerEvent = useCallback((isCorrect: boolean, _correctAnswer: string) => {
    recordAnswerOutcome(isCorrect);
  }, [recordAnswerOutcome]);

  // ログインストリークバッジ
  useEffect(() => {
    if (loginStreak >= 3) earnBadge('streak_3');
    if (loginStreak >= 7) earnBadge('streak_7');
    if (loginStreak >= 14) earnBadge('streak_14');
    if (loginStreak >= 30) earnBadge('streak_30');
    // ログインストリーク称号チェック
    checkTitleConditions();
  }, [loginStreak, earnBadge, checkTitleConditions, totalCorrectAnswers, totalWins, playerLevel, earnedBadgeIds]);


  // セッションデータ書き込み (flushSessionData) はストア側に移動

  // ============================
  // Auth Handlers
  // ============================
  const handleLogin = async () => {
    if (!auth || !googleProvider) {
      console.error('Firebase auth not initialized. auth:', !!auth, 'provider:', !!googleProvider);
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.warn('Popup login failed, trying redirect:', e?.code || e);
      // Fallback to redirect for mobile/popup-blocked environments
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error('Redirect login also failed:', redirectError);
        }
      }
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await leaveRoom(currentRoomId, isHost);
      await flushSessionData();
      await signOut(auth);
      setGameState('login_screen');
      cleanupGameSession();
    } catch (e) { console.error('Logout failed:', e); }
  };

  const handleStudentProfileSet = useCallback(async (profile: StudentProfile) => {
    setStudentProfile(profile);
    localStorage.setItem('battleMathStudentProfile', JSON.stringify(profile));
    if (user && db) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          studentProfile: profile,
        });
      } catch (e) { console.error('Student profile sync error:', e); }
    }
  }, [user]);

  // 新年度チェック（studentProfile が初めてセットされた時に1回のみ）
  useEffect(() => {
    if (!studentProfile || newYearCheckedRef.current) return;
    newYearCheckedRef.current = true;

    const currentSchoolYear = getCurrentSchoolYear();
    if ((studentProfile.schoolYear ?? DEFAULT_SCHOOL_YEAR) < currentSchoolYear) {
      const lastSkipped = parseInt(localStorage.getItem('beng_newYearSkippedAt') || '0', 10);
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (!lastSkipped || Date.now() - lastSkipped > threeDaysMs) {
        setShowNewYearPrompt(true);
      }
    }
  }, [studentProfile]);

  // 新年度更新確定ハンドラー
  const handleNewYearConfirm = async (updated: StudentProfile) => {
    setShowNewYearPrompt(false);
    localStorage.removeItem('beng_newYearSkippedAt');
    await handleStudentProfileSet(updated);
  };

  // 新年度スキップハンドラー（3日後に再表示）
  const handleNewYearSkip = () => {
    localStorage.setItem('beng_newYearSkippedAt', String(Date.now()));
    setShowNewYearPrompt(false);
  };

  const handleGuestPlay = () => {
    setGameState('main_menu');
  };

  // ログインボーナス: MP加算・Firestore書き込みはストア、受取済みフラグはApp側UI状態
  const handleClaimLoginBonus = useCallback(() => {
    claimLoginBonus();
    setLoginBonusClaimed(true);
  }, [claimLoginBonus]);

  // 管理画面はADMIN_EMAILS(固定)+管理画面から追加されたメールのGoogleアカウントのみ。
  // 実効的な保護は firestore.rules の isAdmin()（サーバー側）で行われ、ここはUI表示の制御。
  const canAccessGameMaster = !!user?.email
    && (ADMIN_EMAILS.includes(user.email) || firestoreAdminEmails.includes(user.email));
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);

  const handleOpenGameMaster = () => {
    if (canAccessGameMaster) setShowAdminPasswordModal(true);
  };

  // Progression (addExp / addBoostedMp / expForNextLevel) はストア側に移動



  const cleanupGameSession = useCallback((keepConn = false) => {
    if (!keepConn) {
      if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();
      setCurrentRoomId(null);
      setIsHost(false);
      setOpponentDisconnected(false);
      clearActivePvpSession();
    }
    processedMatchIdRef.current = null;
  }, []);


  const listenToRoom = (roomId: string) => {
    if (!db) return;
    if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();
    unsubscribeRoomRef.current = onSnapshot(doc(db, 'rooms', roomId), snap => {
      if (!snap.exists()) {
        // ルームが削除された場合
        setOpponentDisconnected(true);
        return;
      }
      const data = snap.data() as Room;
      const isHostVal = isHostRef.current;

      // 相手の切断検知（lastActiveが60秒以上古い場合）
      // ハートビート30秒に合わせてしきい値を60秒に短縮
      if (data.status === 'playing') {
        const opponentLastActive = isHostVal ? data.guestLastActive : data.hostLastActive;
        if (opponentLastActive) {
          const lastActiveMs = opponentLastActive.toDate ? opponentLastActive.toDate().getTime() : 0;
          const staleThreshold = 60000; // 60秒（ハートビート30秒 × 2回分）
          const autoEndThreshold = 120000; // 120秒で自動終了
          if (lastActiveMs > 0 && Date.now() - lastActiveMs > staleThreshold) {
            setOpponentDisconnected(true);
            // 120秒以上応答がなければ自動的にルームを終了（勝利宣言不要）
            if (Date.now() - lastActiveMs > autoEndThreshold) {
              const roomRef = doc(db!, 'rooms', roomId);
              updateDoc(roomRef, {
                status: 'finished',
                winnerId: isHostVal ? 'host' : 'guest',
              }).catch(() => {});
            }
          } else {
            setOpponentDisconnected(false);
          }
        }
      }

      // ルームが外部要因で finished になった場合（相手離脱・管理者終了等）
      if (data.status === 'finished' && (data.winnerId === 'abandoned' || data.winnerId === 'admin_terminated')) {
        cleanupGameSession();
        setGameState('speed_duel_setup');
        return;
      }

      if (data.status === 'playing' && gameStateRef.current === 'matchmaking') {
        processedMatchIdRef.current = null;

        if (data.battleType === 'speed_duel' && data.speedProblems) {
          // Speed Duel PvP: load problems from room and start
          setBattleType('speed_duel');
          setSpeedProblems(data.speedProblems as SpeedProblem[]);
          setSpeedTotalRounds(data.speedTotalRounds || 5);
          setBattleFormat((data.speedFormat as BattleFormat) || 'best_of_5');
          setSpeedRound(1);
          setSpeedPlayerScore(0);
          setSpeedOpponentScore(0);
          setSpeedPlayerAnswered(false);
          setSpeedOpponentAnswered(false);
          setSpeedRoundWinner(null);
          setSpeedGameResult(null);
          speedRewardGrantedRef.current = false;
          setSpeedPhase('countdown');
          setGameState('speed_duel');
          setTimeout(() => {
            setSpeedPhase('answering');
            setSpeedTimeLeft(SPEED_DUEL_TIME_LIMIT_SEC);
          }, 2000);
        } else {
          // カードバトルは廃止したので、旧形式のルームには参加せず待機画面へ戻す
          cleanupGameSession();
          setGameState('speed_duel_setup');
        }
      }

      // Speed Duel PvP: sync round results from Firestore
      if (gameStateRef.current === 'speed_duel' && data.battleType === 'speed_duel') {
        const myScore = isHostVal ? (data.speedP1Score || 0) : (data.speedP2Score || 0);
        const oppScore = isHostVal ? (data.speedP2Score || 0) : (data.speedP1Score || 0);
        setSpeedPlayerScore(myScore);
        setSpeedOpponentScore(oppScore);

        const oppAnswer = isHostVal ? data.speedP2Answer : data.speedP1Answer;
        if (oppAnswer) setSpeedOpponentAnswered(true);

        // Round resolved by opponent's correct answer
        if (data.speedRoundWinner && speedPhaseRef.current === 'answering') {
          if (speedTimerRef.current) clearInterval(speedTimerRef.current);
          const winner = data.speedRoundWinner;
          if ((winner === 'host' && isHostVal) || (winner === 'guest' && !isHostVal)) {
            setSpeedRoundWinner('player');
          } else {
            setSpeedRoundWinner('opponent');
          }
          setSpeedPhase('round_result');
        }

        // Match finished
        if (data.winnerId && processedMatchIdRef.current !== roomId) {
          processedMatchIdRef.current = roomId;
          const isWinner = (data.winnerId === 'host' && isHostVal) || (data.winnerId === 'guest' && !isHostVal);
          setSpeedGameResult(data.winnerId === 'draw' ? 'draw' : isWinner ? 'win' : 'lose');
          setSpeedPhase('match_over');
          flushSessionData().catch(() => {});
        }
      }

    }, (error) => {
      const msg = error?.message || '';
      if (msg.includes('not found') || msg.includes('404') || error?.code === 'not-found') {
        console.error('[BattleMath] Firestoreデータベースが未作成です');
      } else {
        console.error('[BattleMath] Room listener error:', msg);
      }
    });
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!user || !db) {
      alert('PvP対戦にはログインが必要です');
      return;
    }
    cleanupGameSession(false);
    const uid = user.uid.trim();

    try {
      // ゾンビ部屋防止: 自分がホストの未終了ルームを自動クリーンアップ
      const myHostRoomsSnap = await getDocs(
        query(
          collection(db, 'rooms'),
          where('hostId', '==', uid),
          where('status', 'in', ['waiting', 'playing']),
        )
      );
      const cleanupPromises: Promise<void>[] = [];
      myHostRoomsSnap.forEach(d => {
        if (d.id !== roomId) {
          cleanupPromises.push(
            updateDoc(doc(db, 'rooms', d.id), {
              status: 'finished',
              winnerId: 'abandoned',
            }).catch(() => {})
          );
        }
      });
      // 自分がゲストの未終了ルームも同様にクリーンアップ
      const myGuestRoomsSnap = await getDocs(
        query(
          collection(db, 'rooms'),
          where('guestId', '==', uid),
          where('status', 'in', ['waiting', 'playing']),
        )
      );
      myGuestRoomsSnap.forEach(d => {
        if (d.id !== roomId) {
          cleanupPromises.push(
            updateDoc(doc(db, 'rooms', d.id), {
              status: 'finished',
              winnerId: 'abandoned',
            }).catch(() => {})
          );
        }
      });
      if (cleanupPromises.length > 0) {
        await Promise.all(cleanupPromises);
        console.log(`Cleaned up ${cleanupPromises.length} zombie room(s) for user ${uid}`);
      }
    } catch (cleanupErr) {
      console.warn('Zombie room cleanup failed (non-blocking):', cleanupErr);
    }

    try {
      const roomRef = doc(db, 'rooms', roomId);
      const result = await runTransaction(db, async (tx) => {
        const roomDoc = await tx.get(roomRef);
        const base: Record<string, any> = {
          roomId, status: 'waiting', hostId: uid,
          hostName: user.displayName || 'Player',
          guestId: null, guestName: null,
          createdAt: serverTimestamp(), hostLastActive: serverTimestamp(),
          guestLastActive: null, hostReady: true, guestReady: false,
          round: 1, p1Move: null, p2Move: null,
          // p1Hp/p2Hp は旧カードバトルのフィールド。firestore.rules の必須項目
          // なので、スピード対戦では使わないが 0 で作っておく。
          p1Hp: 0, p2Hp: 0, winnerId: null,
          battleType: 'speed_duel',
        };
        // Speed duel: add categories and problems to room
        if (battleType === 'speed_duel') {
          const total = getSpeedTotalRounds(battleFormat);
          const problems = generateSpeedProblems(speedCategories, total);
          base.speedCategories = speedCategories;
          base.speedFormat = battleFormat;
          base.speedRound = 1;
          base.speedTotalRounds = total;
          base.speedP1Score = 0;
          base.speedP2Score = 0;
          // category/difficulty も保存（undefined不可のためnullに変換）— 相手側の学習記録・DDAに使う
          base.speedProblems = problems.map(p => ({ type: p.type, data: p.data, answer: p.answer, category: p.category ?? null, difficulty: p.difficulty ?? null }));
          base.speedP1Answer = null;
          base.speedP2Answer = null;
          base.speedRoundWinner = null;
          base.speedRoundActive = false;
        }
        if (!roomDoc.exists() || (roomDoc.data() as Room).status === 'finished') {
          tx.set(roomRef, base);
          return 'host';
        }
        const d = roomDoc.data() as Room;
        if ((d.hostId || '').trim() === uid) return 'host';
        if ((d.guestId || '').trim() === uid) return 'guest';
        if (d.status === 'waiting') {
          tx.update(roomRef, {
            status: 'playing', guestId: uid,
            guestName: user.displayName || 'Player',
            guestReady: true, guestLastActive: serverTimestamp()
          });
          return 'guest';
        }
        throw new Error('ROOM_FULL');
      });
      setIsHost(result === 'host');
      setCurrentRoomId(roomId);
      // 再接続用に対戦情報を保存（誤リロード対策）
      saveActivePvpSession({
        roomId,
        isHost: result === 'host',
        battleType: 'speed_duel',
        deckIds: [],
        savedAt: Date.now(),
      });
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg === 'ROOM_FULL') {
        alert('この部屋は満員です。');
      } else if (msg.includes('not found') || msg.includes('404') || e?.code === 'not-found') {
        alert('Firestoreデータベースが未作成です。\nFirebase Console → Firestore Database → 「データベースを作成」を実行してください。');
      } else if (msg.includes('offline') || msg.includes('unavailable')) {
        alert('サーバーに接続できません。インターネット接続を確認してください。');
      } else {
        console.error('Room join error:', e);
        alert(`入室エラー: ${msg || '不明なエラーが発生しました'}`);
      }
    }
  };

  useEffect(() => { if (currentRoomId) listenToRoom(currentRoomId); }, [currentRoomId]);

  const generateSpeedProblems = useCallback((subtopics: string[], count: number): SpeedProblem[] => {
    // Support both subtopic names (granular) and main category names (legacy)
    const subtopicSet = new Set(subtopics);
    const eligible = CARD_DEFINITIONS.filter(c => (subtopicSet.has(c.category) || subtopicSet.has(c.mainCategory)) && !effectiveLockedUnits.has(c.mainCategory));
    const shuffled = shuffleDeck(eligible);
    // 単元・難易度を保持（弱点分析/SRS記録・CPUのDDAに使用）
    return shuffled.slice(0, Math.min(count, shuffled.length))
      .map(c => ({ ...c.problem, category: c.category, difficulty: c.difficulty }));
  }, [effectiveLockedUnits]);

  const getSpeedTotalRounds = useCallback((format: BattleFormat): number => {
    if (format === 'best_of_3') return 3;
    if (format === 'best_of_5') return 5;
    if (format === 'best_of_7') return 7;
    return 10; // master_duel
  }, []);

  const getSpeedRequiredWins = useCallback((format: BattleFormat): number => {
    if (format === 'best_of_3') return 2;
    if (format === 'best_of_5') return 3;
    if (format === 'best_of_7') return 4;
    return 0; // master_duel: most wins after all rounds
  }, []);

  const startSpeedDuel = useCallback((categories: string[], format: BattleFormat, mode: 'cpu' | 'pvp') => {
    setBattleType('speed_duel');
    setSpeedCategories(categories);
    setBattleFormat(format);
    const bmode = mode === 'pvp' ? 'pvp' : 'cpu';
    setGameMode(bmode as any);

    if (bmode === 'pvp') {
      setGameState('matchmaking');
      return;
    }

    // CPU mode: generate problems and start
    const total = getSpeedTotalRounds(format);
    const problems = generateSpeedProblems(categories, total);
    setSpeedProblems(problems);
    setSpeedTotalRounds(total);
    setSpeedRound(1);
    setSpeedPlayerScore(0);
    setSpeedOpponentScore(0);
    setSpeedPlayerAnswered(false);
    setSpeedOpponentAnswered(false);
    setSpeedRoundWinner(null);
    setSpeedGameResult(null);
    speedRewardGrantedRef.current = false;
    setSpeedPhase('countdown');
    setGameState('speed_duel');

    // Countdown then start
    setTimeout(() => {
      setSpeedPhase('answering');
      setSpeedTimeLeft(SPEED_DUEL_TIME_LIMIT_SEC);
    }, 1500);
  }, [generateSpeedProblems, getSpeedTotalRounds]);

  // Speed Duel timer
  useEffect(() => {
    if (gameState !== 'speed_duel' || speedPhase !== 'answering') return;
    speedTimerRef.current = setInterval(() => {
      setSpeedTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - resolve round
          clearInterval(speedTimerRef.current!);
          if (speedCpuTimerRef.current) clearTimeout(speedCpuTimerRef.current);
          setSpeedPhase('round_result');
          if (!speedPlayerAnswered && !speedOpponentAnswered) {
            setSpeedRoundWinner('draw');
          } else if (speedPlayerAnswered && !speedOpponentAnswered) {
            // Player already answered (might be correct or wrong, handled in answer handler)
          } else if (!speedPlayerAnswered && speedOpponentAnswered) {
            // CPU already answered correctly
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (speedTimerRef.current) clearInterval(speedTimerRef.current); };
  }, [gameState, speedPhase, speedRound]);

  // Speed Duel CPU answer — DDA (動的難易度調整)
  // プレイヤー自身の難易度別平均解答時間を基準にCPUの速度・正答率を決める
  // (詳細は constants/gameBalance.ts を参照)
  useEffect(() => {
    if (gameState !== 'speed_duel' || speedPhase !== 'answering' || gameMode !== 'cpu') return;
    const problem = speedProblems[speedRound - 1];
    if (!problem) return;
    const difficulty = problem.difficulty || 3;
    const stats = userLevelStats[difficulty];
    const baseTime = stats && stats.count >= SPEED_CPU.MIN_SAMPLE_COUNT
      ? stats.avgTime
      : difficulty * SPEED_CPU.FALLBACK_MS_PER_DIFFICULTY;
    const jitter = SPEED_CPU.DELAY_JITTER_MIN
      + Math.random() * (SPEED_CPU.DELAY_JITTER_MAX - SPEED_CPU.DELAY_JITTER_MIN);
    const baseDelay = Math.max(SPEED_CPU.MIN_DELAY_MS, Math.min(SPEED_CPU.MAX_DELAY_MS, baseTime * jitter));
    speedCpuTimerRef.current = setTimeout(() => {
      // クロージャのspeedPhaseは古い値のため、refで現在のフェーズを判定する
      if (speedPhaseRef.current !== 'answering') return;
      setSpeedOpponentAnswered(true);
      const cpuCorrect = Math.random() < speedCpuAccuracy(difficulty);
      if (cpuCorrect && !speedPlayerAnswered) {
        // CPU wins this round
        if (speedTimerRef.current) clearInterval(speedTimerRef.current);
        setSpeedRoundWinner('opponent');
        setSpeedOpponentScore(prev => prev + 1);
        setSpeedPhase('round_result');
      }
    }, baseDelay);
    return () => { if (speedCpuTimerRef.current) clearTimeout(speedCpuTimerRef.current); };
  }, [gameState, speedPhase, speedRound, gameMode, speedProblems, userLevelStats]);

  const handleSpeedAnswer = useCallback(async (answer: string) => {
    if (speedPhase !== 'answering' || speedPlayerAnswered) return;
    const problem = speedProblems[speedRound - 1];
    if (!problem) return;

    setSpeedPlayerAnswered(true);

    // Check correctness (カードバトルと同一の採点ロジック)
    const isCorrect = checkAnswer(answer, problem.answer, { multiple: !!(problem.data as any)?.multiple, requireForm: (problem.data as any)?.requireForm });

    // ゲーミフィケーション統合: チェイン・バッジ・クエスト・セッション統計
    recordAnswerOutcome(isCorrect);
    // 学習記録: 弱点分析と間隔反復(SRS)はカードバトル・練習モードと同様に蓄積する
    // （旧形式PvPルームの問題には category が無いためガード）
    if (problem.category) {
      recordAttempt(problem.category, isCorrect);
      if (!isCorrect) {
        addIncorrectToSrs(
          problem.category,
          String((problem.data as any)?.question || '').slice(0, 50),
          problem.answer,
          problem.type
        );
      }
    }
    // がくしゅうのきろく: 1問ログ(きょうやった問題の即時確認用)
    recordProblemLog({
      mode: 'speed',
      subTopic: problem.category || 'スピード対戦',
      question: String((problem.data as any)?.question || ''),
      userAnswer: answer,
      correct: isCorrect,
    });

    if (gameMode === 'pvp' && currentRoomId && db) {
      // PvP: write answer to Firestore, use transaction for atomicity
      const answerField = isHostRef.current ? 'speedP1Answer' : 'speedP2Answer';
      const myRole = isHostRef.current ? 'host' : 'guest';
      try {
        await runTransaction(db, async (tx) => {
          const roomSnap = await tx.get(doc(db, 'rooms', currentRoomId));
          if (!roomSnap.exists()) return;
          const roomData = roomSnap.data() as Room;
          // Already resolved?
          if (roomData.speedRoundWinner) return;
          const update: Record<string, any> = {
            [answerField]: { answer, correct: isCorrect, answeredAt: Date.now() },
          };
          if (isCorrect && !roomData.speedRoundWinner) {
            update.speedRoundWinner = myRole;
            const scoreField = isHostRef.current ? 'speedP1Score' : 'speedP2Score';
            update[scoreField] = (isHostRef.current ? (roomData.speedP1Score || 0) : (roomData.speedP2Score || 0)) + 1;
          }
          tx.update(doc(db, 'rooms', currentRoomId), update);
        });
      } catch (e) {
        console.error('Speed duel PvP answer error:', e);
      }
      // State will be updated by the room listener
      return;
    }

    // CPU mode: resolve locally
    if (isCorrect) {
      if (speedTimerRef.current) clearInterval(speedTimerRef.current);
      if (speedCpuTimerRef.current) clearTimeout(speedCpuTimerRef.current);
      setSpeedRoundWinner('player');
      setSpeedPlayerScore(prev => prev + 1);
      setSpeedPhase('round_result');
    }
    // If wrong, player can't retry - wait for CPU or timeout
  }, [speedPhase, speedPlayerAnswered, speedProblems, speedRound, recordAnswerOutcome, gameMode, currentRoomId, db]);

  const handleSpeedNextRound = useCallback(() => {
    const required = getSpeedRequiredWins(battleFormat);

    // PvP: ルームを終了状態にする（両クライアントが同じ値を書くため冪等）
    const finishPvpMatch = (result: 'win' | 'lose' | 'draw') => {
      if (gameMode !== 'pvp' || !currentRoomId || !db) return;
      const myRole = isHostRef.current ? 'host' : 'guest';
      const oppRole = isHostRef.current ? 'guest' : 'host';
      const winnerId = result === 'draw' ? 'draw' : result === 'win' ? myRole : oppRole;
      updateDoc(doc(db, 'rooms', currentRoomId), { status: 'finished', winnerId }).catch(() => {});
      clearActivePvpSession();
    };

    // Check if match is over (スコアは回答時点で加算済み)
    if (required > 0) {
      // best-of-N: check if either player reached required wins
      if (speedPlayerScore >= required || speedOpponentScore >= required) {
        const result = speedPlayerScore >= required ? 'win' : 'lose';
        setSpeedGameResult(result);
        setSpeedPhase('match_over');
        finishPvpMatch(result);
        return;
      }
    }

    // Check if all rounds played (master_duel or remaining rounds exhausted)
    if (speedRound >= speedTotalRounds) {
      const result = speedPlayerScore > speedOpponentScore ? 'win'
        : speedPlayerScore < speedOpponentScore ? 'lose' : 'draw';
      setSpeedGameResult(result);
      setSpeedPhase('match_over');
      finishPvpMatch(result);
      return;
    }

    // PvP: 前ラウンドの解答・勝者をクリアして次ラウンドへ進める。
    // 重要: これを行わないと speedRoundWinner がルームに残り続け、
    // 2ラウンド目以降の解答トランザクションが常に早期returnして
    // 誰も得点できなくなる（旧実装のバグ）。speedRound の保存は再接続にも使う
    if (gameMode === 'pvp' && currentRoomId && db) {
      updateDoc(doc(db, 'rooms', currentRoomId), {
        speedRound: speedRound + 1,
        speedRoundWinner: null,
        speedP1Answer: null,
        speedP2Answer: null,
      }).catch(() => {});
    }

    // Next round
    setSpeedRound(prev => prev + 1);
    setSpeedPlayerAnswered(false);
    setSpeedOpponentAnswered(false);
    setSpeedRoundWinner(null);
    setSpeedPhase('countdown');
    setTimeout(() => {
      setSpeedPhase('answering');
      setSpeedTimeLeft(SPEED_DUEL_TIME_LIMIT_SEC);
    }, SPEED_DUEL_COUNTDOWN_MS);
  }, [battleFormat, speedPlayerScore, speedOpponentScore, speedRound, speedTotalRounds, getSpeedRequiredWins, gameMode, currentRoomId]);

  // ============================
  // スピード対戦の対戦報酬（マッチ終了時に1回だけ付与）
  // 旧実装ではスピード対戦に報酬がなく、報酬ループから漏れていた
  // ============================
  const speedRewardGrantedRef = useRef(false);
  useEffect(() => {
    if (speedPhase !== 'match_over' || !speedGameResult) return;
    if (speedRewardGrantedRef.current) return;
    speedRewardGrantedRef.current = true;
    const reward = SPEED_DUEL_REWARDS[speedGameResult];
    addExp(reward.exp);
    // CPU戦は1日の獲得上限あり(荒稼ぎ防止)。PvPは対人戦のため上限なし。
    if (reward.mp > 0) { if (gameMode === 'cpu') addCpuBattleMp(reward.mp); else addBoostedMp(reward.mp); }
    if (speedGameResult === 'win') {
      incrementTotalWins();
      saveUserToFirestore({ totalWins: increment(1), totalMatches: increment(1) });
    } else {
      saveUserToFirestore({ totalMatches: increment(1) });
    }
    if (gameMode === 'pvp') handleQuestProgress('pvp_match');
    flushSessionData().catch(() => {});
  }, [speedPhase, speedGameResult, gameMode, addExp, addBoostedMp, incrementTotalWins, saveUserToFirestore, handleQuestProgress, flushSessionData]);

  // ============================
  // PvP再接続
  // 誤リロード後、保存済みセッションのルームがまだ進行中なら復帰を提案する
  // ============================
  const [resumeCandidate, setResumeCandidate] = useState<SavedPvpSession | null>(null);
  const resumeCheckedRef = useRef(false);

  useEffect(() => {
    if (!user || !db || resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;
    const saved = loadActivePvpSession();
    if (!saved) return;
    if (Date.now() - saved.savedAt > PVP_RESUME_MAX_AGE_MS) {
      clearActivePvpSession();
      return;
    }
    getDoc(doc(db, 'rooms', saved.roomId)).then(snap => {
      if (!snap.exists()) { clearActivePvpSession(); return; }
      const room = snap.data() as Room;
      const isParticipant = room.hostId === user.uid || room.guestId === user.uid;
      if (room.status !== 'playing' || !isParticipant) { clearActivePvpSession(); return; }
      setResumeCandidate(saved);
    }).catch(() => {});
  }, [user]);

  const performResume = useCallback(async (saved: SavedPvpSession) => {
    setResumeCandidate(null);
    if (!db) return;
    try {
      const snap = await getDoc(doc(db, 'rooms', saved.roomId));
      if (!snap.exists()) { clearActivePvpSession(); return; }
      const room = snap.data() as Room;
      if (room.status !== 'playing') { clearActivePvpSession(); return; }

      // isHostRef は startGame/リスナーが即座に参照するため、stateより先にrefを更新する
      isHostRef.current = saved.isHost;
      setIsHost(saved.isHost);
      setGameMode('pvp');
      processedMatchIdRef.current = null;

      if (room.battleType === 'speed_duel' && room.speedProblems) {
        setBattleType('speed_duel');
        setSpeedProblems(room.speedProblems as SpeedProblem[]);
        setSpeedTotalRounds(room.speedTotalRounds || 5);
        setBattleFormat((room.speedFormat as BattleFormat) || 'best_of_5');
        setSpeedRound(room.speedRound || 1);
        setSpeedPlayerScore(saved.isHost ? (room.speedP1Score || 0) : (room.speedP2Score || 0));
        setSpeedOpponentScore(saved.isHost ? (room.speedP2Score || 0) : (room.speedP1Score || 0));
        setSpeedPlayerAnswered(!!(saved.isHost ? room.speedP1Answer : room.speedP2Answer));
        setSpeedOpponentAnswered(!!(saved.isHost ? room.speedP2Answer : room.speedP1Answer));
        setSpeedGameResult(null);
        speedRewardGrantedRef.current = false;
        if (room.speedRoundWinner) {
          const mine = room.speedRoundWinner !== 'draw'
            && ((room.speedRoundWinner === 'host') === saved.isHost);
          setSpeedRoundWinner(room.speedRoundWinner === 'draw' ? 'draw' : mine ? 'player' : 'opponent');
          setSpeedPhase('round_result');
        } else {
          setSpeedRoundWinner(null);
          setSpeedPhase('answering');
          setSpeedTimeLeft(SPEED_DUEL_TIME_LIMIT_SEC);
        }
        setCurrentRoomId(saved.roomId);
        setGameState('speed_duel');
      } else {
        // カードバトルは廃止したため、旧形式のセッションは復帰させず破棄する
        clearActivePvpSession();
      }
    } catch (e) {
      console.error('PvP resume error:', e);
      clearActivePvpSession();
    }
  }, []);

  const dismissResume = useCallback(async (saved: SavedPvpSession) => {
    setResumeCandidate(null);
    // 破棄 = 投了扱い（相手の勝利でルームを終了）
    await leaveRoom(saved.roomId, saved.isHost);
  }, [leaveRoom]);

  // ============================
  // Render
  // ============================
  if (authLoading || showSplash) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-950">
        <div className="text-center animate-[fadeIn_1.5s_ease-in-out]">
          <p className="text-lg text-gray-400 font-mono tracking-[0.3em] opacity-80">
            presented by
          </p>
          <p className="text-2xl text-white font-bold font-mono tracking-[0.2em] mt-2">
            onokomachi
          </p>
        </div>
        <style>{`
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  const renderContent = () => {
    switch (gameState) {
      case 'login_screen':
        return (
          <LoginScreen
            currentUser={user}
            onLogin={handleLogin}
            onGuestPlay={handleGuestPlay}
            onLogout={handleLogout}
            onOpenGameMaster={handleOpenGameMaster}
            mathPoints={mathPoints}
            playerLevel={playerLevel}
            studentProfile={studentProfile}
            onStudentProfileSet={handleStudentProfileSet}
          />
        );

      case 'main_menu':
        return (
          <MainMenu
            onSelectMode={mode => setGameState(mode)}
            playerLevel={playerLevel}
            playerExp={playerExp}
            expForNextLevel={expForNextLevel(playerLevel)}
            user={user}
            mathPoints={mathPoints}
            onLogout={handleLogout}
            loginStreak={loginStreak}
            onOpenQuests={() => setShowQuestPanel(true)}
            onOpenLoginBonus={() => setShowLoginBonus(true)}
            canAccessGameMaster={canAccessGameMaster}
            onOpenGameMaster={handleOpenGameMaster}
            dailyQuestDefs={DAILY_QUEST_DEFS}
            dailyQuestProgress={dailyQuestProgress}
            dailyQuestDone={dailyQuestDone}
            onOpenClassBattle={() => setShowClassBattle(true)}
            hasStudentProfile={!!studentProfile}
            srsReviewCount={getDueCount()}
            onOpenWeakness={() => setShowWeaknessPanel(true)}
            onOpenItemShop={() => setShowItemShop(true)}
            equippedTitleName={equippedTitle ? (TITLE_DEFS.find(t => t.id === equippedTitle)?.name || SHOP_ITEMS.find(i => i.id === equippedTitle)?.name || null) : null}
          />
        );

      case 'adventure':
        return (
          <Suspense fallback={<AdventureLoading />}>
          <AdventureMode
            onExit={() => setGameState('main_menu')}
            lockedUnits={effectiveLockedUnits}
            mathPoints={mathPoints}
            onAddMathPoints={n => addMathPoints(n)}
            onSpendMathPoints={n => {
              if (mathPoints < n) return false;
              addMathPoints(-n);
              return true;
            }}
            defaultName={studentProfile?.displayLabel}
            uid={user?.uid ?? null}
          />
          </Suspense>
        );

      case 'practice_mode':
        return (
          <PracticeMode
            onSessionComplete={pts => { addMathPoints(pts); setGameState('main_menu'); }}
            db={db}
            user={user}
            studentProfile={studentProfile}
            lockedUnits={effectiveLockedUnits}
          />
        );

      case 'review_mode':
        return (
          <ReviewMode
            onExit={pts => { if (pts > 0) addMathPoints(pts); setGameState('main_menu'); }}
          />
        );

      case 'mock_test':
        return (
          <MockTestMode
            onExit={() => setGameState('main_menu')}
            onTestFinished={handleTestFinished}
          />
        );

      case 'learning_log':
        return (
          <LearningLogScreen
            onExit={() => setGameState('main_menu')}
            equippedBackground={equippedBackground}
            onEquipBackground={handleEquipBackground}
          />
        );

      case 'matchmaking':
        return (
          <Matchmaking
            rooms={rooms}
            onJoinRoom={handleJoinRoom}
            onCancel={async () => {
              await leaveRoom(currentRoomId, isHost);
              cleanupGameSession();
              setGameState('speed_duel_setup');
            }}
            currentRoomId={currentRoomId}
            user={user}
            connectionError={firestoreError}
            battleType={battleType}
          />
        );

      case 'speed_duel_setup':
        return (
          <SpeedDuelSetup
            onStart={(categories, format, mode) => {
              setBattleType('speed_duel');
              startSpeedDuel(categories, format, mode);
            }}
            onBack={() => setGameState('main_menu')}
            isLoggedIn={!!user}
            lockedUnits={effectiveLockedUnits}
          />
        );

      case 'speed_duel':
        return (
          <SpeedDuelBoard
            problem={speedProblems[speedRound - 1] || null}
            playerScore={speedPlayerScore}
            opponentScore={speedOpponentScore}
            round={speedRound}
            totalRounds={speedTotalRounds}
            format={battleFormat}
            phase={speedPhase}
            onAnswer={handleSpeedAnswer}
            onNextRound={handleSpeedNextRound}
            onExit={() => {
              if (speedTimerRef.current) clearInterval(speedTimerRef.current);
              if (speedCpuTimerRef.current) clearTimeout(speedCpuTimerRef.current);
              setGameState('main_menu');
            }}
            roundWinner={speedRoundWinner}
            playerName={user?.displayName || 'あなた'}
            opponentName={gameMode === 'cpu' ? 'CPU' : '相手'}
            isPlayerAnswered={speedPlayerAnswered}
            isOpponentAnswered={speedOpponentAnswered}
            timeLeft={speedTimeLeft}
            gameResult={speedGameResult}
          />
        );

      case 'gamemaster':
        return db ? (
          <GameMaster db={db} onClose={() => setGameState('login_screen')} />
        ) : (
          <div className="text-center text-red-400 p-12">Firebase接続エラー</div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="w-screen h-screen relative flex flex-col items-center justify-center font-sans">
      <GravityBackground />
      <BackgroundFX background={equippedBackground} />
      <div className="relative z-10 w-full h-full">
        {renderContent()}
        {levelUpInfo && <LevelUpModal {...levelUpInfo} onClose={() => setLevelUpInfo(null)} />}
        {showAdminPasswordModal && (
          <AdminPasswordModal
            onSuccess={() => { setShowAdminPasswordModal(false); setGameState('gamemaster'); }}
            onCancel={() => setShowAdminPasswordModal(false)}
          />
        )}
        {showQuestPanel && (
          <QuestPanel
            loginStreak={loginStreak}
            dailyProgress={dailyQuestProgress}
            dailyCompleted={Object.fromEntries([...dailyQuestDone].map(id => [id, true]))}
            weeklyProgress={weeklyQuestProgress}
            weeklyCompleted={Object.fromEntries([...weeklyQuestDone].map(id => [id, true]))}
            onClose={() => setShowQuestPanel(false)}
          />
        )}
        {pendingBadge && (
          <BadgeNotification
            badge={pendingBadge}
            onDismiss={() => setPendingBadge(null)}
          />
        )}
        {showLoginBonus && (
          <LoginBonusModal
            loginStreak={loginStreak}
            todayReward={getLoginReward(loginStreak)}
            alreadyClaimed={loginBonusClaimed}
            onClaim={handleClaimLoginBonus}
            onClose={() => setShowLoginBonus(false)}
          />
        )}
        {showClassBattle && db && (
          <ClassBattleBoard
            db={db}
            onClose={() => setShowClassBattle(false)}
            currentSchool={studentProfile?.school}
          />
        )}
        {showWeaknessPanel && (
          <WeaknessPanel onClose={() => setShowWeaknessPanel(false)} />
        )}
        {showItemShop && (
          <ItemShop
            mathPoints={mathPoints}
            ownedItems={ownedShopItems}
            earnedTitleIds={earnedTitleIds}
            equippedTitle={equippedTitle}
            equippedTheme={equippedTheme}
            hintTokens={hintTokens}
            onPurchase={handleShopPurchase}
            onEquipTitle={setEquippedTitle}
            onEquipTheme={setEquippedTheme}
            onClose={() => setShowItemShop(false)}
          />
        )}
        {/* PvP再接続プロンプト */}
        {resumeCandidate && (gameState === 'main_menu' || gameState === 'login_screen') && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="max-w-sm w-full bg-slate-900 border border-red-700/50 rounded-2xl p-6 text-center">
              <p className="text-3xl mb-3">🔌</p>
              <h2 className="text-lg font-bold text-white mb-2">進行中の対戦があります</h2>
              <p className="text-xs text-gray-400 mb-6">
                スピード対戦の途中で切断されました。再接続しますか？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => performResume(resumeCandidate)}
                  className="flex-1 btn-tactical py-3 rounded-xl font-bold"
                >
                  再接続する
                </button>
                <button
                  onClick={() => dismissResume(resumeCandidate)}
                  className="flex-1 border border-gray-600 text-gray-400 hover:text-white py-3 rounded-xl font-bold transition-colors"
                >
                  破棄（投了）
                </button>
              </div>
            </div>
          </div>
        )}
        {showNewYearPrompt && studentProfile && (
          <NewYearPrompt
            profile={studentProfile}
            currentSchoolYear={getCurrentSchoolYear()}
            onConfirm={handleNewYearConfirm}
            onSkip={handleNewYearSkip}
          />
        )}
      </div>
    </main>
  );
};

export default App;
