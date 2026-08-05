/**
 * audit-problems.mjs — 全問題(3,341問)を機械的に監査する。
 *
 *   node scripts/audit-problems.mjs
 *   node scripts/audit-problems.mjs --json out.json
 *
 * 問題を足したり書きかえたりしたら、これを流してから コミットする。
 * テストプレイで人間が見つけるより先に、機械で見つけられるものは機械で見つける。
 *
 * チェック項目:
 *  ① 答えが問題文にそのまま書かれている(いちばん多いバグ)
 *  ② 選択式(options)なのに答えが選択肢に無い
 *  ③ 選択肢に重複がある
 *  ④ 問題文や答えが空
 *
 * ■ ①について — なぜ「数字だけ特別扱い」なのか
 *
 * 素朴に q.includes(ans) と書くと、誤検出が 400件以上出て使いものにならない。
 * 「150 ÷ 3 = 50」の問題文には "150" があり、その中に答えの "50" が含まれるからだ。
 * そこで答えが純粋な数字のときだけ、前後が数字でないこと((?<!\d)…(?!\d))を
 * 条件に足して「独立した数として出てくるときだけ」拾うようにしている。
 *
 * ■ 検出されても「バグではない」もの(=直してはいけないもの)
 *
 * 出力の大半は、問題の形式上あたりまえに答えが問題文へ出るものになる。
 * 以下は正常なので、直さずに読みとばすこと:
 *
 *   - 大小くらべ  「12と15では どちらが 大きいですか」→ 答 15
 *   - 分類問題    「1/2, 5/3, 2 1/4 のうち 仮分数は どれですか」→ 答 5/3
 *   - はい/いいえ 「…と いえますか」→ 答「いえる」
 *   - 小数の位     「0.35 の 小数第一位の 数字は」→ 答 3
 *
 * ほんとうのバグは「聞かれている値そのものが、問題文に答えとして書いてある」もの。
 * 過去に見つかった実例は docs/PROBLEM_QA.md にまとめてある。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const bundle = path.join(root, 'node_modules', '.cache', 'audit-problems.cjs');
mkdirSync(path.dirname(bundle), { recursive: true });

// 問題データはTypeScriptなので、いちどCommonJSへ束ねてから読みこむ。
// (format:'cjs' で出したものは import() では読めない。createRequire を使うこと)
esbuild.buildSync({
  entryPoints: [path.join(root, 'data', 'index.ts')],
  bundle: true, format: 'cjs', platform: 'node',
  outfile: bundle, logLevel: 'warning',
});
const require = createRequire(import.meta.url);
const { ALL_PROBLEM_SETS } = require(bundle);

const findings = [];
let total = 0;

for (const [subtopic, problems] of Object.entries(ALL_PROBLEM_SETS)) {
  problems.forEach((p, i) => {
    total++;
    const d = p.data || {};
    const q = String(d.question ?? '');
    const ans = String(p.answer ?? '');
    const ref = `${subtopic} #${i + 1}`;

    if (!q.trim()) findings.push({ ref, type: '問題文が空', detail: '' });
    if (!ans.trim()) findings.push({ ref, type: '答えが空', detail: q.slice(0, 60) });

    // ① 答え文字列が問題文にそのまま出てくる(数字は独立した数のときだけ)
    const isNumeric = /^-?\d+(\.\d+)?$/.test(ans);
    const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = isNumeric ? new RegExp(`(?<!\\d)${escaped}(?!\\d)`) : new RegExp(escaped);
    if (ans.length >= 2 && re.test(q)) {
      findings.push({ ref, type: '答えが問題文に書かれている', detail: `Q="${q.slice(0, 80)}" A="${ans}"` });
    }

    // ②③ 選択式の整合性
    if (Array.isArray(d.options) && d.options.length) {
      const opts = d.options.map(String);
      const hit = d.multiple
        ? ans.split(',').map(s => s.trim()).every(a => opts.includes(a))
        : opts.includes(ans);
      if (!hit) findings.push({ ref, type: '答えが選択肢に無い', detail: `A="${ans}" opts=${JSON.stringify(opts)}` });
      if (opts.length !== new Set(opts).size) {
        findings.push({ ref, type: '選択肢が重複', detail: JSON.stringify(opts) });
      }
    }
  });
}

// 「答えが選択肢に無い」「重複」「空」は文句なしのバグなので分けて出す
const hardBugs = findings.filter(f => f.type !== '答えが問題文に書かれている');
const leaks = findings.filter(f => f.type === '答えが問題文に書かれている');

console.log(`総問題数: ${total}`);
console.log(`確実なバグ: ${hardBugs.length}件`);
console.log(`答えが問題文に出ている(要目視): ${leaks.length}件`);

for (const f of hardBugs) console.log(`  ✗ [${f.type}] ${f.ref}: ${f.detail}`);

const bySubtopic = {};
for (const f of leaks) {
  const st = f.ref.split(' #')[0];
  bySubtopic[st] = (bySubtopic[st] || 0) + 1;
}
console.log('\n答えが問題文に出ている件数(単元別):');
for (const [st, n] of Object.entries(bySubtopic).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(3)}  ${st}`);
}

const jsonAt = process.argv.indexOf('--json');
if (jsonAt >= 0 && process.argv[jsonAt + 1]) {
  writeFileSync(process.argv[jsonAt + 1], JSON.stringify(findings, null, 2));
  console.log(`\n全件を ${process.argv[jsonAt + 1]} に書き出した`);
}

process.exit(hardBugs.length > 0 ? 1 : 0);
