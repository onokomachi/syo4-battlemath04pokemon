/**
 * sim-party-duel.mjs — モンスター対戦（パーティ・HPあり）のバランスを、ロボットどうしの対戦で確かめる
 *
 *   node scripts/sim-party-duel.mjs
 *
 * 「じょうず・ふつう・にがて」の3種類のロボット（正解する確率と、答える速さがちがう）を何千回も戦わせ、
 * - 1回の対戦が何ターンで終わるか（3匹で約5分・5匹で約10分のねらい）
 * - にがてな子が じょうずな子に、ときどき勝てるか（3匹・同じレベルで1割近く）
 * - レベル（練習した量）で強くすれば、にがてな子も勝ち越せるか
 * を見る。data/partyDuel.ts の数を変えたら、これを流してから決める。
 * TypeScript のデータは esbuild で束ねて require で読む（scripts/audit-problems.mjs と同じ）。
 */
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'sim-pduel-'));
const out = join(dir, 'bundle.cjs');
buildSync({
  entryPoints: ['data/partyDuel.ts'], bundle: true, format: 'cjs', platform: 'node', outfile: out,
  logLevel: 'silent', define: { 'import.meta.env': '{}' },
});
const require = createRequire(import.meta.url);
const D = require(out);
rmSync(dir, { recursive: true, force: true });

// 再現できる乱数（mulberry32）
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOTS = {
  じょうず: { acc: 0.9, sec: [6, 14] },
  ふつう: { acc: 0.72, sec: [9, 22] },
  にがて: { acc: 0.55, sec: [14, 34] },
};

// 図鑑のモンスター（いろいろな単元・タイプ）
const ids = Array.from({ length: 140 }, (_, i) => `mon-${String(i + 1).padStart(3, '0')}`);

function party(size, level, rand) {
  const p = [];
  while (p.length < size) {
    const id = ids[Math.floor(rand() * ids.length)];
    const m = D.toDuelMon({ uid: `${p.length}`, defId: id, level });
    if (m) p.push(m);
  }
  return { party: p, active: 0, miss: 0 };
}

function answer(bot, rand) {
  const t = bot.sec[0] + rand() * (bot.sec[1] - bot.sec[0]);
  if (t > D.PARTY_DUEL.turnSeconds) return null;
  return { correct: rand() < bot.acc, at: t };
}

function match(size, botH, lvH, botG, lvG, seed) {
  const rand = rng(seed);
  let host = party(size, lvH, rand);
  let guest = party(size, lvG, rand);
  let seconds = 0;
  for (let turn = 1; ; turn++) {
    const ha = answer(botH, rand); const ga = answer(botG, rand);
    seconds += Math.min(D.PARTY_DUEL.turnSeconds, Math.max(ha?.at ?? 99, ga?.at ?? 99)) + 4;
    const r = D.resolveTurn(turn, host, guest, ha, ga, rand);
    host = r.host; guest = r.guest;
    if (r.winner) return { winner: r.winner, turns: turn, seconds };
  }
}

function run(label, size, a, lvA, b, lvB, n = 3000) {
  let winA = 0; let draws = 0; let turns = 0; let secs = 0;
  for (let i = 0; i < n; i++) {
    // 部屋を作る側（奇数ターンの問題）を入れかえて、かたよりを消す
    const swap = i % 2 === 1;
    const r = swap ? match(size, BOTS[b], lvB, BOTS[a], lvA, i + 1) : match(size, BOTS[a], lvA, BOTS[b], lvB, i + 1);
    const aWon = swap ? r.winner === 'guest' : r.winner === 'host';
    if (aWon) winA++;
    if (r.winner === 'draw') draws++;
    turns += r.turns; secs += r.seconds;
  }
  const pct = (x) => `${Math.round((x / n) * 100)}%`;
  console.log(`${label.padEnd(34)} ${a}${lvA !== lvB ? `Lv${lvA}` : ''} の勝ち ${pct(winA).padStart(4)}  引き分け ${pct(draws).padStart(3)}  平均 ${(turns / n).toFixed(1)}ターン・${(secs / n / 60).toFixed(1)}分`);
  return winA / n;
}

console.log('--- 3匹 ---');
run('同じ力・同じレベル', 3, 'ふつう', 20, 'ふつう', 20);
const w1 = run('にがて vs じょうず（同じレベル）', 3, 'にがて', 20, 'じょうず', 20);
run('にがて vs ふつう（同じレベル）', 3, 'にがて', 20, 'ふつう', 20);
const w2 = run('にがて Lv40 vs じょうず Lv20', 3, 'にがて', 40, 'じょうず', 20);
run('ふつう Lv40 vs ふつう Lv15（差の上限）', 3, 'ふつう', 40, 'ふつう', 15);
console.log('--- 5匹 ---');
run('同じ力・同じレベル', 5, 'ふつう', 20, 'ふつう', 20);
const w3 = run('にがて vs じょうず（同じレベル）', 5, 'にがて', 20, 'じょうず', 20);
const w4 = run('にがて Lv40 vs じょうず Lv20', 5, 'にがて', 40, 'じょうず', 20);

// ねらい（2026-10）: にがてな子も3匹なら同じレベルで1割近く勝てる／練習してレベルを上げると勝ち負けがぐっと近づく。
// 5匹は長いぶん力の差が出やすい（同じレベルでは数％）。そのぶん、レベルで追いつける幅を見る
const ok = w1 >= 0.08 && w2 >= w1 + 0.2 && w3 >= 0.03 && w4 >= 0.25;
console.log(ok ? 'OK' : 'NG: data/partyDuel.ts の数を見なおす');
process.exitCode = ok ? 0 : 1;
