-- スタミナを「起きた順」に数える（2026-11-09 バグ直し）
--
-- 症状：SOL から単元アプリで問題を解いても、SANMON のスタミナがたまらない（その日に一度 0 まで使った子）。
-- 原因：前の _sanmon_stamina は 1日ぶんをまとめて「その日にたまった分を足して100で切る → その日に使った分を引く」としていた。
--   朝に100あって、昼に100使い、そのあと30問解くと：100+30 → 100で切る → −100 ＝ 0。使ったあとに解いたぶんが消えていた。
-- 直し：たまる・使うを時刻の順に並べて、1つずつ「足して100で切る／引く」。たまり方のきまり（項目ごとに1日5まで・熟達後は半分・
--   ボーナス）は変えない。項目ごとの「1日5まで」は、その日のその項目の累計で順に数える。2026-10-25 より前は前のきまり（1日30まで）をその日の0時に足す。
-- スタミナは小数で数え、切り捨てて返す（前は1日の合計を切り捨てていた）。

create or replace function public._sanmon_stamina(p_student_id uuid)
returns table (stamina integer, earned_today integer)
language plpgsql stable security definer set search_path to '' as $function$
declare
  p_cutover constant date := date '2026-10-25';
  today date := (now() at time zone 'Asia/Tokyo')::date;
  sy int := public._school_year((now() at time zone 'Asia/Tokyo')::date);
  bal numeric := 0; e_today numeric := 0; r record;
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
    -- 前のきまり（2026-10-25 より前）：その日の0時に、1日30まで
    earn_old as (
      select (extract(epoch from (d::timestamp at time zone 'Asia/Tokyo')) * 1000)::bigint ts,
             least(30, floor(sum(case when pair then 0.5 else 1 end)))::numeric v
      from ev where ok and d < p_cutover group by d
    ),
    -- 今のきまり：正解1問ずつ。その日・その項目の累計が5をこえたぶんは0
    w as (
      select e.d, e.app_id, e.skill_id, e.ts,
             (case when e.pair then 0.5 else 1 end) * (case when m.m_ts is not null and e.ts > m.m_ts then 0.5 else 1 end) w
      from ev e left join mastery m on m.app_id = e.app_id and m.skill_id = e.skill_id
      where e.ok and e.d >= p_cutover
    ),
    cum as (
      select ts, sum(w) over (partition by d, app_id, skill_id order by ts rows unbounded preceding) c, w from w
    ),
    earn_new as (select ts, least(5, c) - least(5, c - w) v from cum),
    b_mastery as (select m_ts ts, 2::numeric v from mastery where m_d >= p_cutover),
    b_test as (
      select min(t.ts) ts, 5::numeric v from (
        select tr.app_id, le.skill_id, tr.taken_date d, tr.ts
        from public.test_result tr
        join public.learning_event le on le.device_key = tr.device_key and le.app_id = tr.app_id and le.event_id = tr.event_id
        where tr.student_id = p_student_id and tr.school_year = sy and tr.total_max > 0
          and tr.total * 5 >= tr.total_max * 4 and not le.pair and tr.taken_date >= p_cutover
      ) t group by t.app_id, t.skill_id, t.d
    ),
    trial_rows as (
      select taken_date d, ts, floor f,
             max(floor) over (partition by app_id order by ts rows between unbounded preceding and 1 preceding) prev
      from public.trial_result
      where student_id = p_student_id and school_year = sy and solo_complete
    ),
    b_trial as (select ts, (greatest(0, f - coalesce(prev, 0)) * 3)::numeric v from trial_rows where d >= p_cutover),
    spend as (
      select s.ts, -s.amount::numeric v from public.sanmon_spend s
      where s.student_id = p_student_id and s.school_year = sy
    ),
    allx as (
      select ts, v from earn_old union all select ts, v from earn_new where v > 0
      union all select ts, v from b_mastery union all select ts, v from b_test
      union all select ts, v from b_trial where v > 0 union all select ts, v from spend
    )
    -- 同じ時刻なら、たまる方を先に
    select ts, v from allx order by ts, (v < 0)
  loop
    if r.v > 0 then
      bal := least(100, bal + r.v);
      if (to_timestamp(r.ts / 1000.0) at time zone 'Asia/Tokyo')::date = today then e_today := e_today + r.v; end if;
    else
      bal := greatest(0, bal + r.v);
    end if;
  end loop;
  stamina := floor(bal)::int; earned_today := floor(e_today)::int;
  return next;
end $function$;
