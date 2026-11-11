-- わり算の筆算の2つの町（div1・div2）の項目に、筆算シミュレーターの5項目を足す（2026-11-11 先生と決めた）。
-- kit 0.34.1 のカタログ hissan に足したのと同じ。バトルのスタミナの達成度（_sanmon_town_cost）がこの表を読む。
-- 2つの町は同じ項目のまま（同じ条件で開く）。何回流しても同じ。
insert into public.sanmon_town_skill (town, app_id, skill_id)
select t.town, 'hissan', s.skill_id
from (values ('div1'), ('div2')) as t(town)
cross join unnest(array['hissan-2-1','hissan-3-1','hissan-2-2','hissan-3-2','hissan-3-3']) as s(skill_id)
where not exists (
  select 1 from public.sanmon_town_skill x where x.town = t.town and x.skill_id = s.skill_id
);
