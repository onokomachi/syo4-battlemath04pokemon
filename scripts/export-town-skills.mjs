// 町 → 練習の項目の表（サーバの sanmon_town_skill）の行を出す。kit のカタログを変えたら流して、出た行で表を作り直す（supabase-sql/2026-11-11-sanmon-town-cost.sql）
const kit = await import('learning-app-kit/sanmon');
const cat = await import('learning-app-kit/catalog');
const rows = [];
for (const u of kit.SANMON_UNITS) {
  if (!u.appId) continue;
  const c = cat.CATALOGS[u.appId];
  const skills = c.modules.filter(m => !u.modules || u.modules.includes(m.module_id)).flatMap(m => m.skills.map(s => s.skill_id));
  for (const s of skills) rows.push(`('${u.key}','${u.appId}','${s.replace(/'/g, "''")}')`);
  console.error(u.key, u.appId, skills.length);
}
console.log(rows.join(',\n'));
