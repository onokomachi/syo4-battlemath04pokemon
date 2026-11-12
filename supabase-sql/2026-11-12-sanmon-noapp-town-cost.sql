-- アプリの無い町（大きい数・折れ線グラフ・角）のバトル1回のスタミナを 3 にする（2026-11-12 先生と決めた。前は 5）。
-- アプリのある町は 前と同じ（その町の練習の項目の達成度で 2〜5）。スピード・対戦（町なし）は 5 のまま。
-- 町の key は kit の SANMON_UNITS（appId の無い町）。画面の数え方は utils/townCost.ts。
create or replace function public._sanmon_town_cost(p_student_id uuid, p_town text)
 returns integer
 language sql
 stable security definer
 set search_path to ''
as $function$
  with t as (select app_id, skill_id from public.sanmon_town_skill where town = p_town),
  m as (
    select count(distinct (ss.app_id, ss.skill_id)) n from public.skill_state ss
    join t on t.app_id = ss.app_id and t.skill_id = ss.skill_id
    where ss.student_id = p_student_id and ss.perfect_streak >= 5
  )
  select case
    when p_town in ('bignum', 'graph', 'angle') then 3
    when (select count(*) from t) = 0 then 5
    when (select n from m) * 100 >= (select count(*) from t) * 100 then 2
    when (select n from m) * 100 >= (select count(*) from t) * 75 then 3
    when (select n from m) * 100 >= (select count(*) from t) * 50 then 4
    else 5 end
$function$;
