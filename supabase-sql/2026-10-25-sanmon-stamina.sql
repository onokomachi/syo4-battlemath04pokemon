-- 学級ポータル（Supabase gakkyu-portal）に 2026-10-24 に流した スタミナの計算（記録用）。
-- 1項目1日5まで・熟達ずみは半分・がんばりボーナス（テスト合格+5・階段の新しい段+3・はじめての熟達+2）・1日の上限なし。
CREATE OR REPLACE FUNCTION public._sanmon_stamina(p_student_id uuid)
 RETURNS TABLE(stamina integer, earned_today integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
-- スタミナ（2026-10-25〜 先生と決めた）:
--   単元アプリの正解1問 +1（ペア 0.5）。ただし 1つの項目で1日5まで。もう熟達した項目（5問れんぞく正解のあと）は 半分。
--   がんばりボーナス：本番テスト8割合格 +5（テスト・日ごと）、実力の階段の新しい段 +3（1段ごと）、はじめての熟達 +2（項目ごと）。
--   1日の上限（前は30）は なし。ためておけるのは100まで。切りかえの日より前は 前のきまり（1日30まで）のまま。
declare
  p_cutover constant date := date '2026-10-25';
  today date := (now() at time zone 'Asia/Tokyo')::date;
  sy int := public._school_year((now() at time zone 'Asia/Tokyo')::date);
  bal numeric := 0; r record; e_today int := 0;
begin
  for r in
    with ev as (
      select le.event_date d, le.app_id, le.skill_id, le.ts, le.pair,
             (le.correct and not le.abandoned) ok
      from public.learning_event le
      where le.student_id = p_student_id and le.app_id <> 'sanmon' and le.school_year = sy
    ),
    runs as (
      select ev.*, sum(case when ok then 0 else 1 end) over (partition by app_id, skill_id order by ts rows unbounded preceding) grp
      from ev
    ),
    streak as (
      select runs.*, case when ok then row_number() over (partition by app_id, skill_id, grp, ok order by ts) else 0 end n
      from runs
    ),
    mastery as (
      select distinct on (app_id, skill_id) app_id, skill_id, ts m_ts, d m_d
      from streak where n >= 5 order by app_id, skill_id, ts
    ),
    earn_old as (
      select d, least(30, floor(sum(case when pair then 0.5 else 1 end)))::numeric e
      from ev where ok and d < p_cutover group by d
    ),
    per_skill as (
      select e.d, e.app_id, e.skill_id,
             least(5, sum((case when e.pair then 0.5 else 1 end) * (case when m.m_ts is not null and e.ts > m.m_ts then 0.5 else 1 end))) w
      from ev e left join mastery m on m.app_id = e.app_id and m.skill_id = e.skill_id
      where e.ok and e.d >= p_cutover
      group by e.d, e.app_id, e.skill_id
    ),
    earn_new as (select d, floor(sum(w))::numeric e from per_skill group by d),
    b_mastery as (select m_d d, count(*) * 2 b from mastery where m_d >= p_cutover group by m_d),
    b_test as (
      select t.d, count(*) * 5 b from (
        select distinct tr.app_id, le.skill_id, tr.taken_date d
        from public.test_result tr
        join public.learning_event le on le.device_key = tr.device_key and le.app_id = tr.app_id and le.event_id = tr.event_id
        where tr.student_id = p_student_id and tr.school_year = sy and tr.total_max > 0
          and tr.total * 5 >= tr.total_max * 4 and not le.pair and tr.taken_date >= p_cutover
      ) t group by t.d
    ),
    trial_rows as (
      select taken_date d, app_id, floor f,
             max(floor) over (partition by app_id order by ts rows between unbounded preceding and 1 preceding) prev
      from public.trial_result
      where student_id = p_student_id and school_year = sy and solo_complete
    ),
    b_trial as (
      select d, sum(greatest(0, f - coalesce(prev, 0))) * 3 b from trial_rows where d >= p_cutover group by d
    ),
    earn as (
      select d, sum(e) e from (
        select d, e from earn_old union all select d, e from earn_new
        union all select d, b from b_mastery union all select d, b from b_test union all select d, b from b_trial
      ) x group by d
    ),
    spend as (
      select s.spend_date d, sum(s.amount)::int sp from public.sanmon_spend s
      where s.student_id = p_student_id and s.school_year = sy group by s.spend_date
    )
    select coalesce(earn.d, spend.d) d, coalesce(earn.e, 0) e, coalesce(spend.sp, 0) sp
    from earn full join spend on earn.d = spend.d order by 1
  loop
    bal := least(100, bal + r.e) - r.sp;
    if bal < 0 then bal := 0; end if;
    if r.d = today then e_today := r.e::int; end if;
  end loop;
  stamina := bal::int; earned_today := e_today;
  return next;
end $function$
;
