-- 本番テストのスタミナを「点数ぶん」に（2026-11-10 先生と決めた）
--
-- きまり：
--   - 本番テストを受けると、点数の割合×10（切り捨て）のスタミナ。100点満点の100点→10、150点満点の105点→7、50点→5。
--   - たまるのは、そのテストの単元の「町のスタミナ」（町ごとに50まで）。町の無いテスト（5〜6年・SANMON の本番テストなど）は共通スタミナ。
--     簡単なテストばかり受けても、その町にしかたまらない（ほかの町では使えない）ようにするため。
--   - 受けるたびにもらえる。ただし同じテストは1日3回まで（4回目からは0）。DUO（1台をふたり）で受けた回は0。
--   - 前の「8割合格で +5（共通）」は、この時刻（2026-11-10 17:30）より前の分だけ そのまま数える。
--   - 実力の階段の新しい段 +3・はじめての熟達 +2 は これまでどおり共通スタミナ。
-- 2026-11-09-sanmon-town-stamina.sql の _sanmon_pools の b_test だけを入れかえた。

create or replace function public._sanmon_pools(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  p_cutover constant date := date '2026-10-25';
  town_cut constant bigint := (extract(epoch from timestamptz '2026-11-09 13:39:00+09') * 1000)::bigint;
  town_cap constant numeric := 50;
  test_cut constant bigint := (extract(epoch from timestamptz '2026-11-10 17:30:00+09') * 1000)::bigint;
  today date := (now() at time zone 'Asia/Tokyo')::date;
  sy int := public._school_year((now() at time zone 'Asia/Tokyo')::date);
  common numeric := 0; e_today numeric := 0; pools jsonb := '{}'::jsonb; r record;
  need numeric; have numeric; k text; towns jsonb := '{}'::jsonb;
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
      select (extract(epoch from (d::timestamp at time zone 'Asia/Tokyo')) * 1000)::bigint ts,
             least(30, floor(sum(case when pair then 0.5 else 1 end)))::numeric v, null::text pool
      from ev where ok and d < p_cutover group by d
    ),
    w as (
      select e.d, e.app_id, e.skill_id, e.ts,
             (case when e.pair then 0.5 else 1 end) * (case when m.m_ts is not null and e.ts > m.m_ts then 0.5 else 1 end) w
      from ev e left join mastery m on m.app_id = e.app_id and m.skill_id = e.skill_id
      where e.ok and e.d >= p_cutover
    ),
    cum as (
      select app_id, skill_id, ts, sum(w) over (partition by d, app_id, skill_id order by ts rows unbounded preceding) c, w from w
    ),
    earn_new as (
      select c.ts, least(5, c.c) - least(5, c.c - c.w) v,
             case when c.ts < town_cut then null else coalesce(st.town, public._sanmon_pool(c.app_id, c.skill_id)) end pool
      from cum c left join public.sanmon_skill_town st on st.app_id = c.app_id and st.skill_id = c.skill_id
    ),
    b_mastery as (select m_ts ts, 2::numeric v, null::text pool from mastery where m_d >= p_cutover),
    -- 本番テスト：前（test_cut まで）は 8割で +5・共通（1テスト1日1回）
    b_test_old as (
      select min(t.ts) ts, 5::numeric v, null::text pool from (
        select tr.app_id, le.skill_id, tr.taken_date d, tr.ts
        from public.test_result tr
        join public.learning_event le on le.device_key = tr.device_key and le.app_id = tr.app_id and le.event_id = tr.event_id
        where tr.student_id = p_student_id and tr.school_year = sy and tr.total_max > 0
          and tr.total * 5 >= tr.total_max * 4 and not le.pair and tr.taken_date >= p_cutover and tr.ts < test_cut
      ) t group by t.app_id, t.skill_id, t.d
    ),
    -- 本番テスト：test_cut から は 点数の割合×10（切り捨て）を、そのテストの単元の町へ（町の無いテストは共通）。
    -- 受けるたびに。ただし同じテストは1日3回まで。DUO（1台をふたり）は数えない
    t_rows as (
      select tr.ts, floor(tr.total::numeric * 10 / tr.total_max) v,
             coalesce(st.town, public._sanmon_pool(tr.app_id, le.skill_id)) pool,
             row_number() over (partition by tr.app_id, le.skill_id, tr.taken_date order by tr.ts) nth
      from public.test_result tr
      join public.learning_event le on le.device_key = tr.device_key and le.app_id = tr.app_id and le.event_id = tr.event_id
      left join public.sanmon_skill_town st on st.app_id = tr.app_id and st.skill_id = le.skill_id
      where tr.student_id = p_student_id and tr.school_year = sy and tr.total_max > 0
        and not le.pair and tr.ts >= test_cut
    ),
    b_test as (
      select ts, v, pool from b_test_old
      union all select ts, v, pool from t_rows where nth <= 3 and v > 0
    ),
    trial_rows as (
      select taken_date d, ts, floor f,
             max(floor) over (partition by app_id order by ts rows between unbounded preceding and 1 preceding) prev
      from public.trial_result
      where student_id = p_student_id and school_year = sy and solo_complete
    ),
    b_trial as (select ts, (greatest(0, f - coalesce(prev, 0)) * 3)::numeric v, null::text pool from trial_rows where d >= p_cutover),
    spend as (
      select s.ts, -s.amount::numeric v,
             case when s.ts >= town_cut and position('@' in s.reason) > 0 then split_part(s.reason, '@', 2) end pool
      from public.sanmon_spend s
      where s.student_id = p_student_id and s.school_year = sy
    ),
    allx as (
      select ts, v, pool from earn_old union all select ts, v, pool from earn_new where v > 0
      union all select ts, v, pool from b_mastery union all select ts, v, pool from b_test
      union all select ts, v, pool from b_trial where v > 0 union all select ts, v, pool from spend
    )
    select ts, v, pool from allx order by ts, (v < 0)
  loop
    if r.v > 0 then
      if r.pool is null then
        common := least(100, common + r.v);
      else
        pools := jsonb_set(pools, array[r.pool], to_jsonb(least(town_cap, coalesce((pools ->> r.pool)::numeric, 0) + r.v)));
      end if;
      if (to_timestamp(r.ts / 1000.0) at time zone 'Asia/Tokyo')::date = today then e_today := e_today + r.v; end if;
    else
      need := -r.v;
      -- 町 → 共有 → 共通 の順に引く
      foreach k in array array_remove(array[r.pool, public._sanmon_shared_of(r.pool)], null) loop
        have := coalesce((pools ->> k)::numeric, 0);
        if have > 0 and need > 0 then
          pools := jsonb_set(pools, array[k], to_jsonb(have - least(have, need)));
          need := need - least(have, need);
        end if;
      end loop;
      common := greatest(0, common - need);
    end if;
  end loop;
  -- 町ごとに「その町で使える分」（自分の町＋共有。共通はふくめない）
  for k in select unnest(array['div1','div2','suihei','decimal','rounding','calcrules','area','decmuldiv','fraction','change','solid','ratio']) loop
    towns := towns || jsonb_build_object(k, floor(coalesce((pools ->> k)::numeric, 0) + coalesce((pools ->> public._sanmon_shared_of(k))::numeric, 0)));
  end loop;
  return jsonb_build_object('common', floor(common), 'towns', towns, 'pools', pools, 'earned_today', floor(e_today));
end $function$;
