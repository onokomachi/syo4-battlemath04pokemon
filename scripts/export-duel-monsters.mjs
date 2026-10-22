/**
 * export-duel-monsters.mjs — クラス対戦のサーバが使うモンスターの表（sanmon_monster）を作る SQL を書き出す
 *
 *   node scripts/export-duel-monsters.mjs > /tmp/sanmon_monster.sql   （Supabase で流す）
 *   node scripts/export-duel-monsters.mjs --json                        （中身を見る）
 *
 * クラス対戦のHP・強さはサーバが計算する（端末の数字は信用しない）。そのためにサーバが
 * 図鑑の「分野・タイプ・もとのHP・もとのこうげき」を知っている必要がある。
 * モンスターを足した・強さの式（data/adventure/monsters.ts）を変えたときは、これを流してサーバの表を作りなおす。
 * 伝説・幻は分野が無い（問題が出せない）ので入れない（対戦のパーティにも入れられない）。
 */
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'duel-mon-'));
const out = join(dir, 'bundle.cjs');
buildSync({
  stdin: { contents: "export { MONSTER_DEX, BOSS_DEX } from './data/adventure/monsters';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'cjs', platform: 'node', outfile: out, logLevel: 'silent', define: { 'import.meta.env': '{}' },
});
const { MONSTER_DEX, BOSS_DEX } = createRequire(import.meta.url)(out);
rmSync(dir, { recursive: true, force: true });

export const rows = [...MONSTER_DEX, ...BOSS_DEX]
  .filter((m) => m.subtopic)
  .map((m) => ({ def_id: m.id, subtopic: m.subtopic, type: m.type, base_hp: m.baseHp, base_atk: m.baseAtk }));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 1));
} else {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  // 足す・書きかえるだけ（消さない）。図鑑から消したモンスターは、パーティに入れられなくなるだけで害はない
  console.log('insert into public.sanmon_monster (def_id, subtopic, type, base_hp, base_atk) values');
  console.log(rows.map((r) => `  (${q(r.def_id)}, ${q(r.subtopic)}, ${q(r.type)}, ${r.base_hp}, ${r.base_atk})`).join(',\n'));
  console.log('on conflict (def_id) do update set subtopic = excluded.subtopic, type = excluded.type, base_hp = excluded.base_hp, base_atk = excluded.base_atk;');
}
