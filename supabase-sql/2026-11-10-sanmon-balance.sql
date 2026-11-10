-- SANMON のスタミナの釣り合い（2026-11-10 先生と決めた）
--
-- ねらい：子どもは「同じ時間でたくさんもらえる取り組み」に時間を寄せる（マッチング法則）。
--   そこで 1分あたりのスタミナを、練習・本番テスト・実力の階段で だいたい そろえる（どれも 1分に 2〜3 ほど）。
--   同じ日のくり返しは半分（日をあけて学び直すほうが長く残る＝分散学習）。
-- きまり（この時刻＝bal_cut から。前の分は前のきまりのまま）：
--   - 小4算数のアプリ（apps の grade=4・subject='算数'）と SANMON だけ。国語・英語・5〜6年は 0（正解・熟達・階段とも）。
--   - 練習：正解1問 +1（いままでどおり。1つの項目で1日5まで・熟達した項目は半分）。
--   - 本番テスト：ぜんぶ（150点の1枚）で 満点の割合×20。表だけ・裏だけは その大きさぶん（表100点→最大13、裏50点→最大6）。
--     同じテスト（表・裏・ぜんぶは別）の その日1回目は満額、2・3回目は半分、4回目から0。その単元の町へ。
--     SANMON のテストも テストの名前の番号で町を決める。アプリの無い単元（大きい数・折れ線グラフ）とまとめは共通で、その日1回目だけ。
--   - 実力の階段（極限）：その回に突破した段×3 を その単元の町へ。アプリごとに その日1回目は満額・2回目は半分・3回目から0。
--     はじめての段 +3（共通）は いままでどおり。
--   - はじめての熟達 +2（共通）は いままでどおり（小4算数だけ）。

-- テストの「ぜんぶ」の満点（表だけ・裏だけのときも、この大きさで割る）。倍の見方（bai）は表だけで100点の1枚
create or replace function public._sanmon_test_full(p_app text, p_skill text)
returns numeric language sql immutable set search_path to '' as $$
  select case when p_app = 'bai' then 100 else 150 end::numeric
$$;

-- SANMON の本番テストの名前 → 町（アプリの無い単元とまとめは null＝共通）
create or replace function public._sanmon_test_pool(p_set text)
returns text language sql immutable set search_path to '' as $$
  select case split_part(coalesce(p_set, ''), '.', 1)
    when '3' then 'app:hissan' when '4' then 'rounding' when '5' then 'decimal' when '6' then 'fraction'
    else null end
$$;

create or replace function public._sanmon_pools(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  p_cutover constant date := date '2026-10-25';
  town_cut constant bigint := (extract(epoch from timestamptz '2026-11-09 13:39:00+09') * 1000)::bigint;
  town_cap constant numeric := 50;
  test_cut constant bigint := (extract(epoch from timestamptz '2026-11-10 17:30:00+09') * 1000)::bigint;
  bal_cut constant bigint := (extract(epoch from timestamptz '2026-11-10 23:15:00+09') * 1000)::bigint;
  today date := (now() at time zone 'Asia/Tokyo')::date;
  sy int := public._school_year((now() at time zone 'Asia/Tokyo')::date);
  common numeric := 0; e_today numeric := 0; pools jsonb := '{}'::jsonb; r record;
  need numeric; have numeric; k text; towns jsonb := '{}'::jsonb;
begin
  for r in
    with g4 as (select a.app_id from public.apps a where a.grade = 4 and a.subject = '算数'),
    ev as (
      select le.event_date d, le.app_id, le.skill_id, le.ts, le.pair,
             (le.correct and not le.abandoned) ok
      from public.learning_event le
      where le.student_id = p_student_id and le.app_id <> 'sanmon' and le.school_year = sy
        and (le.ts < bal_cut or le.app_id in (select app_id from g4))
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
    b_mastery as (select m_ts ts, 2::numeric v, null::text pool from mastery where m_d >= p_cutover),  -- ev がもう小4算数だけ（bal_cut から）
    -- 本番テスト：前（test_cut まで）は 8割で +5・共通（1テスト1日1回）
    b_test_old as (
      select min(t.ts) ts, 5::numeric v, null::text pool from (
        select tr.app_id, le.skill_id, tr.taken_date d, tr.ts
        from public.test_result tr
        join public.learning_event le on le.device_key = tr.device_key and le.app_id = tr.app_id and le.event_id = tr.event_id
        where tr.student_id = p_student_id and tr.school_year = sy and tr.total_max > 0
          and tr.total * 5 >= tr.total_max * 4 and not le.pair and tr.taken_date >= p_cutover and tr.ts < least(test_cut, bal_cut)
      ) t group by t.app_id, t.skill_id, t.d
    ),
    -- 本番テスト：test_cut から は 点数の割合×10（切り捨て）を、そのテストの単元の町へ（町の無いテストは共通）。
    -- 受けるたびに。ただし同じテストは1日3回まで。DUO（1台をふたり）は数えない
    -- 本番テスト（test_cut〜bal_cut）：点数の割合×10・同じテスト1日3回まで
    t_rows as (
      select tr.ts, floor(tr.total::numeric * 10 / tr.total_max) v,
             coalesce(st.town, public._sanmon_pool(tr.app_id, le.skill_id)) pool,
             row_number() over (partition by tr.app_id, le.skill_id, tr.taken_date order by tr.ts) nth
      from public.test_result tr
      join public.learning_event le on le.device_key = tr.device_key and le.app_id = tr.app_id and le.event_id = tr.event_id
      left join public.sanmon_skill_town st on st.app_id = tr.app_id and st.skill_id = le.skill_id
      where tr.student_id = p_student_id and tr.school_year = sy and tr.total_max > 0
        and not le.pair and tr.ts >= test_cut and tr.ts < bal_cut
    ),
    -- 本番テスト（bal_cut〜）：テストの大きさに合わせる（ぜんぶ＝満点の100％で 20。表だけ・裏だけは その分の大きさ）。
    -- 同じテスト（アプリ×テスト×表/裏/ぜんぶ）の その日1回目は 満額、2・3回目は 半分、4回目から 0。
    -- たまるのは その単元の町（SANMON のテストは テストの名前の番号で町を決める）。町の無いテストは 共通で、その日1回目だけ。
    -- 小4算数のアプリと SANMON だけ。DUO は 0
    t2 as (
      select tr.ts, tr.taken_date d, tr.app_id, le.skill_id, tr.mode, tr.total, public._sanmon_test_full(tr.app_id, le.skill_id) full_max,
             case when tr.app_id = 'sanmon' then substring(le.label from '（([^ ）]+)') else le.skill_id end tkey,
             case when tr.app_id = 'sanmon' then public._sanmon_test_pool(substring(le.label from '（([^ ）]+)'))
                  else coalesce(st.town, public._sanmon_pool(tr.app_id, le.skill_id)) end pool
      from public.test_result tr
      join public.learning_event le on le.device_key = tr.device_key and le.app_id = tr.app_id and le.event_id = tr.event_id
      left join public.sanmon_skill_town st on st.app_id = tr.app_id and st.skill_id = le.skill_id
      where tr.student_id = p_student_id and tr.school_year = sy and tr.total_max > 0
        and not le.pair and tr.ts >= bal_cut
        and (tr.app_id = 'sanmon' or tr.app_id in (select app_id from g4))
    ),
    t2n as (
      select t2.*, row_number() over (partition by app_id, tkey, mode, d order by ts) nth from t2
    ),
    b_test as (
      select ts, v, pool from b_test_old
      union all select ts, v, pool from t_rows where nth <= 3 and v > 0
      union all select ts,
             case when nth = 1 then floor(total::numeric * 20 / full_max)
                  when nth <= 3 and pool is not null then floor(total::numeric * 10 / full_max) else 0 end v, pool
      from t2n where nth <= 3
    ),
    trial_rows as (
      select app_id, taken_date d, ts, floor f, mode, start_floor,
             max(floor) over (partition by app_id order by ts rows between unbounded preceding and 1 preceding) prev
      from (select t.*, case when coalesce(t.detail->>'start', '') ~ '^\d+$' then (t.detail->>'start')::int else 0 end start_floor
            from public.trial_result t
            where t.student_id = p_student_id and t.school_year = sy and t.solo_complete) x
    ),
    -- はじめての段 +3（共通）。bal_cut からは 小4算数のアプリだけ
    b_trial as (
      select ts, (greatest(0, f - coalesce(prev, 0)) * 3)::numeric v, null::text pool from trial_rows
      where d >= p_cutover and (ts < bal_cut or app_id in (select app_id from g4))
    ),
    -- 実力の階段の1回（極限・bal_cut から・小4算数）：その回に突破した段 ×3 を その単元の町へ。
    -- アプリごとに その日1回目は 満額、2回目は 半分、3回目から 0
    b_climb as (
      select ts, (greatest(0, f - start_floor) * case when nth = 1 then 3 else 1.5 end)::numeric v, public._sanmon_pool(app_id, '') pool
      from (select tr2.*, row_number() over (partition by app_id, d order by ts) nth from trial_rows tr2
            where tr2.mode = '極限' and tr2.ts >= bal_cut and tr2.app_id in (select app_id from g4)) z
      where nth <= 2
    ),
    spend as (
      select s.ts, -s.amount::numeric v,
             case when s.ts >= town_cut and position('@' in s.reason) > 0 then split_part(s.reason, '@', 2) end pool
      from public.sanmon_spend s
      where s.student_id = p_student_id and s.school_year = sy
    ),
    allx as (
      select ts, v, pool from earn_old union all select ts, v, pool from earn_new where v > 0
      union all select ts, v, pool from b_mastery union all select ts, v, pool from b_test
      union all select ts, v, pool from b_trial where v > 0 union all select ts, v, pool from b_climb where v > 0
      union all select ts, v, pool from spend
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
