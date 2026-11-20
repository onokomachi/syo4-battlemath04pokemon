-- スタミナ道場（SANMON のぼうけんの町で、単元アプリと同じ問題を解いて スタミナをためる）のサーバ側（2026-11-20）。
--
-- 道場で解いた答えは、単元アプリで解いたのと同じ記録として送る（app_id＝その単元アプリ、skill_id＝アプリが付ける名前）。
-- SANMON は「その子の もう1台の端末」として skill_state に行ができる（device_key が SANMON のもの）。

-- 1) じぶんの記録（SOL の「きょうの ふくしゅう」が読む）：
--    前は 端末ごとの行の「いちばん早い 次の復習日」を使っていたので、道場で復習しても 単元アプリの端末の 古い予定が のこり、
--    SOL に 同じ問題が 出つづける。復習の予定（box・次の復習日）は「いちばん最近に解いた端末」の行で決める。
create or replace function public.my_skill_state(p_student_id uuid)
returns table(app_id text, skill_id text, attempts integer, corrects integer, perfect_streak integer, box integer, next_due_ts bigint, last_ts bigint)
language sql security definer set search_path = '' as $$
  select s.app_id,
         s.skill_id,
         sum(s.attempts)::int          as attempts,
         sum(s.corrects)::int          as corrects,
         max(s.perfect_streak)::int    as perfect_streak,
         (array_agg(s.box order by s.last_ts desc nulls last, s.next_due_ts asc nulls last))[1]::int            as box,
         (array_agg(s.next_due_ts order by s.last_ts desc nulls last, s.next_due_ts asc nulls last))[1]::bigint as next_due_ts,
         max(s.last_ts)::bigint        as last_ts
  from public.skill_state s
  where p_student_id is not null
    and s.student_id = p_student_id
  group by s.app_id, s.skill_id;
$$;

-- 2) 道場の画面用：その子の きょうの 項目ごとの「スタミナに なった分」（0〜5）と、熟達した項目（ここからは半分）
--    数え方は _sanmon_pools_fold と同じ（5問れんぞく正解で熟達・1日1項目5まで・熟達後は半分）
create or replace function public.sanmon_dojo_today(p_student_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  cut bigint := (extract(epoch from (((now() at time zone 'Asia/Tokyo')::date)::timestamp at time zone 'Asia/Tokyo')) * 1000)::bigint;
  sy int := public._school_year((now() at time zone 'Asia/Tokyo')::date);
  st jsonb; init_m jsonb; init_t jsonb; earned jsonb; mastered jsonb;
begin
  if p_student_id is null or not exists (select 1 from public.students where id = p_student_id) then
    raise exception '未登録の student_id です';
  end if;
  select s.state into st from public.sanmon_pools_snap s
   where s.student_id = p_student_id and s.cut_ms = cut and s.built_ver = s.ver;
  if st is null then
    perform public._sanmon_pools_compute(p_student_id);  -- きょうの0時までの状態を作る
    select s.state into st from public.sanmon_pools_snap s where s.student_id = p_student_id and s.cut_ms = cut;
    if st is null then st := public._sanmon_pools_fold(p_student_id, 0, cut, '{}'); end if;
  end if;
  init_m := coalesce(st -> 'm', '{}'::jsonb);
  init_t := coalesce(st -> 't', '{}'::jsonb);

  with ev as (select * from public._sanmon_ev(p_student_id, sy, cut, null) where app_id <> 'sanmon'),
  runs as (
    select ev.*, sum(case when ok then 0 else 1 end) over (partition by app_id, skill_id order by ts, ek rows unbounded preceding) grp
    from ev
  ),
  streak as (
    select runs.*, case when ok then row_number() over (partition by app_id, skill_id, grp, ok order by ts, ek)
                             + case when grp = 0 then coalesce((init_t ->> (app_id || '|' || skill_id))::int, 0) else 0 end
                        else 0 end n
    from runs
  ),
  mastery_new as (
    select distinct on (app_id, skill_id) app_id, skill_id, ts m_ts
    from streak where n >= 5 and not (init_m ? (app_id || '|' || skill_id)) order by app_id, skill_id, ts, ek
  ),
  mastery as (
    select app_id, skill_id, m_ts from mastery_new
    union all
    select split_part(j.key, '|', 1), substr(j.key, position('|' in j.key) + 1), j.value::bigint from jsonb_each_text(init_m) j
  ),
  w as (
    select e.app_id, e.skill_id,
           (case when e.pair then 0.5 else 1 end) * (case when m.m_ts is not null and e.ts > m.m_ts then 0.5 else 1 end) w
    from ev e left join mastery m on m.app_id = e.app_id and m.skill_id = e.skill_id
    where e.ok
  )
  select coalesce((select jsonb_object_agg(app_id || '|' || skill_id, least(5, s)) from (select app_id, skill_id, sum(w) s from w group by 1, 2) x), '{}'::jsonb),
         coalesce((select jsonb_agg(app_id || '|' || skill_id) from mastery where app_id <> 'sanmon'), '[]'::jsonb)
    into earned, mastered;
  return jsonb_build_object('earned', earned, 'mastered', mastered, 'cap', 5);
end $$;
revoke all on function public.sanmon_dojo_today(uuid) from public;
grant execute on function public.sanmon_dojo_today(uuid) to anon, authenticated, service_role;
