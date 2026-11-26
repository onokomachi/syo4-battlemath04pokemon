#!/usr/bin/env node
/**
 * 体験・おためしの台帳（services/trialLedgerCore.ts）の数え方の検査。
 *   node scripts/check-trial-ledger.mjs
 *
 * 数（20・3・5・50・1日5・半分）は kit の SANMON_TRIAL_RULES から読む（ここに数を書かない）。
 * 見るもの：町の解放・最初の 20（1回だけ）・たまり方・バトルで使う・日がかわる・こわれた台帳・
 * SANMON の すべてのサブトピックが kit のカタログで町に結びつくこと。
 */
import esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const bundle = (entry, name) => {
  const out = path.join(os.tmpdir(), `sanmon-${name}-${process.pid}.cjs`);
  esbuild.buildSync({
    ...(entry.startsWith('export ') ? { stdin: { contents: entry, resolveDir: root } } : { entryPoints: [path.join(root, entry)] }), bundle: true, format: 'cjs', platform: 'node', outfile: out,
    logLevel: 'error', define: { 'import.meta.env': '{}' }, loader: { '.png': 'empty', '.css': 'empty' },
  });
  try { return req(out); } finally { fs.rmSync(out, { force: true }); }
};

const core = bundle('services/trialLedgerCore.ts', 'trial-core');
const kit = bundle("export * from 'learning-app-kit/sanmon';", 'trial-kit');
const { MATH_CATEGORIES } = bundle('constants.ts', 'constants');
const R = kit.SANMON_TRIAL_RULES;

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log(`✗ ${msg}`); fails++; } };
const D1 = '2026-11-26';
const D2 = '2026-11-27';

// ---- 1. SANMON のサブトピックは すべて kit のカタログで町に結びつく ----
const subtopics = MATH_CATEGORIES.flatMap((c) => c.groups.flatMap((g) => g.subtopics));
const noTown = subtopics.filter((s) => !kit.sanmonTownOfSubtopic(s));
ok(noTown.length === 0, `町に結びつかないサブトピック ${noTown.length}こ（kit のカタログ sanmon に無い）: ${noTown.slice(0, 5).join('、')}`);
const byTown = new Map();
for (const s of subtopics) { const t = kit.sanmonTownOfSubtopic(s); if (t) byTown.set(t, [...(byTown.get(t) ?? []), s]); }

// ---- 2. はじめの台帳：アプリの無い町だけ開いて 20 ----
const fresh = core.emptyLedger(D1);
const units0 = core.ledgerUnits(fresh);
for (const u of units0) {
  if (!u.appId) { ok(u.open && fresh.towns[u.key] === R.startStamina, `アプリの無い町 ${u.key} は はじめから開いて ${R.startStamina}`); }
  else { ok(!u.open && fresh.towns[u.key] === undefined, `アプリのある町 ${u.key} は はじめは閉じて スタミナなし`); }
}
const noApp = units0.filter((u) => !u.appId).map((u) => u.key);
ok(noApp.length >= 1, 'アプリの無い町が ある');

// ---- 3. 町の解放：3項目を 5れんぞくノーミス ----
const appTown = units0.find((u) => u.appId && (byTown.get(u.key)?.length ?? 0) >= R.unlockMastered);
ok(!!appTown, 'サブトピックが 3つ以上の アプリのある町が ある');
const key = appTown.key;
const subs = byTown.get(key);
const L = core.emptyLedger(D1);
// まず 1つめを 4れんぞく→まちがい（熟達にならず 0 にもどる）
for (let i = 0; i < R.masteryStreak - 1; i++) core.applyPracticeAnswer(L, { subTopic: subs[0], correct: true }, D1);
core.applyPracticeAnswer(L, { subTopic: subs[0], correct: false }, D1);
ok(L.streak[subs[0]] === 0 && !L.mastered.includes(subs[0]), 'まちがえたら つづけて正解が 0 にもどる');
ok(L.towns[key] === undefined, '開く前の町には スタミナが ない（正解しても たまらない）');
// 3項目を熟達
let opened = [];
let lastGain = -1;
for (let k = 0; k < R.unlockMastered; k++) {
  for (let i = 0; i < R.masteryStreak; i++) {
    const r = core.applyPracticeAnswer(L, { subTopic: subs[k], correct: true }, D1);
    opened = opened.concat(r.opened);
    lastGain = r.gain;
    if (k < R.unlockMastered - 1) ok(!core.ledgerUnits(L).find((u) => u.key === key).open, `${k + 1}項目めまでは 町は ひらかない`);
  }
}
ok(opened.length === 1 && opened[0] === key, `3項目めの5問めで その町だけが ひらく（opened=${opened.join(',')}）`);
ok(L.towns[key] === R.startStamina, `ひらいたとき ちょうど ${R.startStamina}（ひらいた答え自身では たまらない。いま ${L.towns[key]}）`);
ok(lastGain === 0, 'ひらいた答えの gain は 0');
// もういちど解いても 20 は 二度もらえない
for (let i = 0; i < 3; i++) core.applyPracticeAnswer(L, { subTopic: subs[0], correct: false }, D1);
ok(L.granted.filter((g) => g === key).length === 1, '最初の 20 は 1回だけ');

// ---- 4. たまり方：開いた町で 正解 +1・1項目1日5まで・熟達ずみは半分 ----
const fresh2 = (() => {
  const l = core.emptyLedger(D1);
  l.mastered = [...subs.slice(0, R.unlockMastered)];
  l.granted.push(key); l.towns[key] = R.startStamina;
  return l;
})();
const extra = subs.length > R.unlockMastered ? subs[R.unlockMastered] : null;
if (extra) {
  const before = fresh2.towns[key];
  let total = 0;
  for (let i = 0; i < R.perSkillDaily + 3; i++) total += core.applyPracticeAnswer(fresh2, { subTopic: extra, correct: true }, D1).gain;
  // 熟達していない項目: 1日 perSkillDaily まで。5問めで熟達するが、そのときは まだ 熟達前の数え方
  ok(total === R.perSkillDaily, `1項目で 1日 ${R.perSkillDaily} まで（たまった ${total}）`);
  ok(fresh2.towns[key] === before + R.perSkillDaily, '町のスタミナに 入る');
  // 日がかわったら また たまる。熟達した項目は半分
  const next = core.applyPracticeAnswer(fresh2, { subTopic: extra, correct: true }, D2);
  ok(next.gain === R.masteredFactor, `熟達した項目は ${R.masteredFactor}（${next.gain}）`);
  ok(fresh2.day === D2, '日がかわる');
}
// まちがいでは たまらない
const wrong = core.applyPracticeAnswer(fresh2, { subTopic: subs[0], correct: false }, D2);
ok(wrong.gain === 0, 'まちがいでは たまらない');

// ---- 5. 町の上限 ----
const cap = core.emptyLedger(D1);
cap.mastered = [...subs.slice(0, R.unlockMastered)]; cap.granted.push(key); cap.towns[key] = R.townCap - 0.5;
const c1 = core.applyPracticeAnswer(cap, { subTopic: subs[0], correct: true }, D1);
ok(cap.towns[key] === R.townCap && c1.gain === R.masteredFactor, `町は ${R.townCap} まで（熟達ずみ 0.5 だけ入る）`);
const c2 = core.applyPracticeAnswer(cap, { subTopic: subs[1], correct: true }, D1);
ok(c2.gain === 0 && cap.towns[key] === R.townCap, '上限を こえない');

// ---- 6. バトルで使う ----
const sp = core.emptyLedger(D1);
const nk = noApp[0];
const s1 = core.spendBattle(sp, nk);
ok(s1.ok && sp.towns[nk] === R.startStamina - R.battleCost, `バトル1回で ${R.battleCost}（${R.startStamina}→${sp.towns[nk]}）`);
sp.towns[nk] = R.battleCost - 1;
const s2 = core.spendBattle(sp, nk);
ok(!s2.ok && sp.towns[nk] === R.battleCost - 1, '足りなければ 使わない');
ok(!core.spendBattle(sp, key).ok, 'ひらいていない町（スタミナなし）では バトルできない');
ok(/たりない/.test(core.lackMessage(2, true)) && /道場/.test(core.lackMessage(2, true)) && !/道場/.test(core.lackMessage(2, false)), '足りないときの文（道場の有る町・無い町）');

// ---- 7. バトル・デュエル・テストの答えは 数えない（台帳の入口は practice・review だけ。ここでは 道場と サブトピック外） ----
const unk = core.emptyLedger(D1);
const u1 = core.applyPracticeAnswer(unk, { subTopic: 'スピード対戦', correct: true }, D1);
ok(!u1.changed && JSON.stringify(unk) === JSON.stringify(core.emptyLedger(D1)), 'カタログに無い名前（スピード対戦）は 何もしない');

// ---- 8. 道場 ----
const dj = core.emptyLedger(D1);
dj.granted.push(key); dj.towns[key] = 10;
let dgain = 0;
for (let i = 0; i < R.perSkillDaily + 2; i++) dgain += core.applyDojoAnswer(dj, { app: 'x', skill: 'y', townKey: key, streakReached: false }, D1).gain;
ok(dgain === R.perSkillDaily && dj.towns[key] === 10 + R.perSkillDaily, `道場も 1項目 1日 ${R.perSkillDaily} まで`);
core.applyDojoAnswer(dj, { app: 'x', skill: 'y', townKey: key, streakReached: true }, D1);
ok(dj.dojoMastered.includes('x|y'), '道場で 5れんぞくに 届くと 熟達');
const dj2 = core.applyDojoAnswer(dj, { app: 'x', skill: 'y', townKey: key, streakReached: true }, D2);
ok(dj2.gain === R.masteredFactor, `道場の 熟達した項目は 半分（${dj2.gain}）`);
const dt = core.dojoTodayOf(dj);
ok(dt.mastered.has('x|y') && dt.earned['x|y'] === dj.earned['d|x|y'], '道場の「きょうの分」は app|skill の形');
const dclosed = core.emptyLedger(D1);
ok(core.applyDojoAnswer(dclosed, { app: 'x', skill: 'y', townKey: key, streakReached: false }, D1).gain === 0 && dclosed.towns[key] === undefined, 'ひらいていない町の道場では たまらない');

// ---- 9. 保存した文字から読む ----
const round = core.parseLedger(JSON.stringify(L), D1);
ok(!round.changed && JSON.stringify(round.ledger) === JSON.stringify(L), '書いて 読んで おなじ');
ok(core.parseLedger('{こわれた', D1).changed && core.parseLedger(null, D1).ledger.towns[nk] === R.startStamina, 'こわれた・無い台帳は 作りなおす（アプリの無い町 20）');
ok(core.parseLedger(JSON.stringify({ ...L, towns: { a: 'x' } }), D1).changed, '形の ちがう台帳は 作りなおす');
const rolled = core.parseLedger(JSON.stringify({ ...fresh2, day: D1, earned: { 's|x': 3 } }), D2);
ok(rolled.changed && Object.keys(rolled.ledger.earned).length === 0 && rolled.ledger.towns[key] === fresh2.towns[key], '日がかわると きょうの分だけ 0（スタミナは のこる）');

if (fails) { console.log(`\n✗ 台帳の検査: ${fails} 件の失敗`); process.exit(1); }
console.log(`✓ 台帳の検査 すべて通過（サブトピック ${subtopics.length} こ・町 ${byTown.size}）`);
