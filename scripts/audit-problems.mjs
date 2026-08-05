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
 *  ⑤ ヒントに答えがそのまま書かれている(型D、docs/PROBLEM_QA.md 参照)
 *
 * ■ ①・⑤について — なぜ「数字だけ特別扱い」なのか
 *
 * 素朴に text.includes(ans) と書くと、誤検出が大量に出て使いものにならない。
 * 「150 ÷ 3 = 50」のような文には "150" があり、その中に答えの "50" が含まれるからだ。
 * そこで答えが純粋な数字のときだけ、前後が数字でないこと((?<!\d)…(?!\d))を
 * 条件に足して「独立した数として出てくるときだけ」拾うようにしている(leaksAnswer)。
 *
 * ■ ①について、検出されても「バグではない」もの(=直してはいけないもの)
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
 *
 * ■ ⑤について — ヒントは「注目点」を書く。答えは書かない(型D)
 *
 * ヒントが計算の道すじを示すのはよいが、最後に最終的な答えの値まで
 * 書いてしまうと、子どもが最後の計算をせずに写すだけになってしまう。
 * こちらは①の「答えが問題文に書かれている」ほど誤検出のバリエーションが
 * 無いため(大小くらべ・分類のような正常系がヒントには出てこない)、
 * ①のような追加の目視分類はしていない。ただし比較・分類まわりの一部の
 * ヒントは、答えを「方法の説明」として妥当に含むことがあるので、
 * ここで検出されたものも最終的には人が目を通すこと。
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

/**
 * 答え(ans)が text の中に「独立した値」として出てくるかを判定する。
 * 数字の答えは前後が数字でないときだけ拾う(150の中の50を誤検出しないため)。
 * ①(問題文)・⑤(ヒント)の両方で使う共通ロジック。
 */
const leaksAnswer = (text, ans) => {
  if (!text || !ans) return false;
  const isNumeric = /^-?\d+(\.\d+)?$/.test(ans);
  const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = isNumeric ? new RegExp(`(?<!\\d)${escaped}(?!\\d)`) : new RegExp(escaped);
  return re.test(text);
};

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
    if (ans.length >= 2 && leaksAnswer(q, ans)) {
      findings.push({ ref, type: '答えが問題文に書かれている', detail: `Q="${q.slice(0, 80)}" A="${ans}"` });
    }

    // ⑤ 答え文字列がヒントにそのまま出てくる(型D)
    //
    // ①と違い ans.length>=2 の足切りはしない。ヒントは「計算の結果を
    // 述べる」場面がほとんどなので、1桁の答え(例: 8−3=5)を最後に
    // 書いてしまうのも同じバグだから。1桁の答えが問題文に偶然混ざる
    // ノイズ(①でこの足切りを入れた理由)は、ヒントには基本的に出ない。
    if (d.hint) {
      const hintText = Array.isArray(d.hint) ? d.hint.join(' / ') : String(d.hint);
      if (leaksAnswer(hintText, ans)) {
        findings.push({ ref, type: 'ヒントに答えが書かれている', detail: `hint="${hintText.slice(0, 100)}" A="${ans}"` });
      }
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

// 「答えが選択肢に無い」「重複」「空」は文句なしのバグなので分けて出す。
// 「問題文に書かれている」「ヒントに書かれている」は要目視(①のとおり
// 大小くらべ等の正常系がまじるため)なので、どちらもhardBugsには含めない。
const hardBugs = findings.filter(f => f.type !== '答えが問題文に書かれている' && f.type !== 'ヒントに答えが書かれている');
const leaks = findings.filter(f => f.type === '答えが問題文に書かれている');
const hintLeaks = findings.filter(f => f.type === 'ヒントに答えが書かれている');

console.log(`総問題数: ${total}`);
console.log(`確実なバグ: ${hardBugs.length}件`);
console.log(`答えが問題文に出ている(要目視): ${leaks.length}件`);
console.log(`ヒントに答えが出ている(要目視): ${hintLeaks.length}件`);

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

const hintBySubtopic = {};
for (const f of hintLeaks) {
  const st = f.ref.split(' #')[0];
  hintBySubtopic[st] = (hintBySubtopic[st] || 0) + 1;
}
console.log('\nヒントに答えが出ている件数(単元別):');
for (const [st, n] of Object.entries(hintBySubtopic).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(3)}  ${st}`);
}

const jsonAt = process.argv.indexOf('--json');
if (jsonAt >= 0 && process.argv[jsonAt + 1]) {
  writeFileSync(process.argv[jsonAt + 1], JSON.stringify(findings, null, 2));
  console.log(`\n全件を ${process.argv[jsonAt + 1]} に書き出した`);
}

process.exit(hardBugs.length > 0 ? 1 : 0);
