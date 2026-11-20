-- スタミナの台帳化：前日までの数を1日1回のこし、きょうの分だけ数える（2026-11-20）。
--
-- なぜ：スタミナの計算（_sanmon_pools_compute）は、その子の1年ぶんの記録を毎回はじめから数えなおしていた。
-- 11月で 1人 0.15〜0.35秒。記録は1年で3倍ほどになり、スタミナ道場（SANMON の中で単元アプリと同じ問題を解く）で
-- さらにふえるので、このままでは また授業中に CPU が足りなくなる。
--
-- どうする：数え方（きまり）は1つも変えない。数え方を「ある時刻から ある時刻まで」を「はじめの状態」から数える形
-- （_sanmon_pools_fold）にし、
--   1) きょうの0時（日本時間）までの結果（スタミナ・町ごとの数・項目ごとの熟達／つづけて正解の数・実力の階段の最高の段）を
--      表 sanmon_pools_snap に1日1回のこす
--   2) ふだんは「のこした状態 ＋ きょうの記録」だけを数える
-- きょうより前の記録が あとから届いた（電波の弱い端末）・消された・直されたときは、のこした状態を「古い」にして、
-- 次の数えなおしで 0時までを数えなおす。数え方に使う表（apps・sanmon_skill_town）が変わったときも同じ。
--
-- 2つに分けても、全部を一度に数えたときと同じ答えになることを、全員ぶん・いくつもの区切りの日で確かめてから切りかえた
-- （このファイルの いちばん下の「たしかめ」）。

-- ============ A) 数え方を「区切って数えられる」形にする（ここまでは まだ使わない） ============

-- スタミナに数える答えの記録（_sanmon_pools_compute の ev と同じ条件）。ts が [p_from, p_until) のものだけ。
-- ek は 同じ時刻の記録の並べ方を決めるため（SANMON は 1回の答えで 同じ時刻の記録を2つ送ることがある。
-- 前は並べ方が決まっておらず、「つづけて5問正解（熟達）」が 数えるたびに変わることがあった）
drop function if exists public._sanmon_ev(uuid, int, bigint, bigint);
create or replace function public._sanmon_ev(p_student_id uuid, p_sy int, p_from bigint, p_until bigint)
returns table (d date, app_id text, skill_id text, ts bigint, pair boolean, ok boolean, unit_pool text, ek text)
language sql stable set search_path = '' as $$
  select le.event_date, le.app_id, le.skill_id, le.ts, le.pair,
         (le.correct and not le.abandoned),
         case when le.app_id = 'sanmon' then le.module_id end,
         le.event_id || '/' || le.device_key
  from public.learning_event le
  where le.student_id = p_student_id and le.school_year = p_sy
    and le.event_date >= (to_timestamp(p_from / 1000.0) at time zone 'Asia/Tokyo')::date  -- 索引を使うため（event_date は ts の日本の日付）
    and le.ts >= p_from and (p_until is null or le.ts < p_until)
    and le.app_id <> 'catwars'  -- CAT-WARS の戦闘の中の答えは数えない（2026-11-16）
    and (
      (le.app_id <> 'sanmon' and (le.ts < (extract(epoch from timestamptz '2026-11-10 23:15:00+09') * 1000)::bigint
                                  or le.app_id in (select a.app_id from public.apps a where a.grade = 4 and a.subject = '算数')))
      -- アプリの無い町（大きい数・折れ線グラフ・角）は、SANMON の れんしゅう・ふくしゅう の正解だけ（2026-11-11 10:50 から）
      or (le.app_id = 'sanmon' and le.ts >= (extract(epoch from timestamptz '2026-11-11 10:50:00+09') * 1000)::bigint
          and le.module_id in ('bignum', 'graph', 'angle')
          and (le.label like 'れんしゅう：%' or le.label like 'ふくしゅう：%'))
    )
$$;
revoke all on function public._sanmon_ev(uuid, int, bigint, bigint) from public, anon, authenticated;

-- [p_from, p_until) の記録を、はじめの状態 p_init から数える。
-- p_init: {"common":共通, "pools":{町:数}, "m":{"app|skill":熟達した時刻}, "t":{"app|skill":つづけて正解の数}, "tm":{app:階段の最高の段}}
-- 返す: {"common","towns","pools","earned_today"} ＋ p_until があるときは 次に つづけるための "m","t","tm"
create or replace function public._sanmon_pools_fold(p_student_id uuid, p_from bigint, p_until bigint, p_init jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p_cutover constant date := date '2026-10-25';
  town_cut constant bigint := (extract(epoch from timestamptz '2026-11-09 13:39:00+09') * 1000)::bigint;
  town_cap constant numeric := 50;
  test_cut constant bigint := (extract(epoch from timestamptz '2026-11-10 17:30:00+09') * 1000)::bigint;
  bal_cut constant bigint := (extract(epoch from timestamptz '2026-11-10 23:15:00+09') * 1000)::bigint;
  noapp_cut constant bigint := (extract(epoch from timestamptz '2026-11-11 10:50:00+09') * 1000)::bigint;
  today date := (now() at time zone 'Asia/Tokyo')::date;
  sy int := public._school_year((now() at time zone 'Asia/Tokyo')::date);
  from_d date := (to_timestamp(p_from / 1000.0) at time zone 'Asia/Tokyo')::date;
  init jsonb := coalesce(p_init, '{}'::jsonb);
  init_m jsonb := coalesce(init -> 'm', '{}'::jsonb);
  init_t jsonb := coalesce(init -> 't', '{}'::jsonb);
  init_tm jsonb := coalesce(init -> 'tm', '{}'::jsonb);
  common numeric := coalesce((init ->> 'common_raw')::numeric, (init ->> 'common')::numeric, 0);
  pools jsonb := coalesce(init -> 'pools', '{}'::jsonb);
  e_today numeric := 0; r record;
  need numeric; have numeric; k text; towns jsonb := '{}'::jsonb;
  out_m jsonb; out_t jsonb; out_tm jsonb; res jsonb;
begin
  for r in
    with g4 as (select a.app_id from public.apps a where a.grade = 4 and a.subject = '算数'),
    ev as (select * from public._sanmon_ev(p_student_id, sy, p_from, p_until)),
    runs as (
      select ev.*, sum(case when ok then 0 else 1 end) over (partition by app_id, skill_id order by ts, ek rows unbounded preceding) grp
      from ev
    ),
    streak as (
      -- まだ1回もまちがえていない列は、前の日までの「つづけて正解」の数から つづける
      select runs.*, case when ok then row_number() over (partition by app_id, skill_id, grp, ok order by ts, ek)
                               + case when grp = 0 then coalesce((init_t ->> (app_id || '|' || skill_id))::int, 0) else 0 end
                          else 0 end n
      from runs
    ),
    mastery_new as (
      select distinct on (app_id, skill_id) app_id, skill_id, ts m_ts, d m_d
      from streak where n >= 5 and not (init_m ? (app_id || '|' || skill_id)) order by app_id, skill_id, ts, ek
    ),
    mastery as (
      select app_id, skill_id, m_ts from mastery_new
      union all
      select split_part(j.key, '|', 1), substr(j.key, position('|' in j.key) + 1), j.value::bigint from jsonb_each_text(init_m) j
    ),
    earn_old as (
      select (extract(epoch from (d::timestamp at time zone 'Asia/Tokyo')) * 1000)::bigint ts,
             least(30, floor(sum(case when pair then 0.5 else 1 end)))::numeric v, null::text pool
      from ev where ok and d < p_cutover group by d
    ),
    w as (
      select e.d, e.app_id, e.skill_id, e.ts, e.ek, e.unit_pool,
             (case when e.pair then 0.5 else 1 end) * (case when m.m_ts is not null and e.ts > m.m_ts then 0.5 else 1 end) w
      from ev e left join mastery m on m.app_id = e.app_id and m.skill_id = e.skill_id
      where e.ok and e.d >= p_cutover
    ),
    cum as (
      select app_id, skill_id, ts, unit_pool, sum(w) over (partition by d, app_id, skill_id order by ts, ek rows unbounded preceding) c, w from w
    ),
    earn_new as (
      select c.ts, least(5, c.c) - least(5, c.c - c.w) v,
             case when c.ts < town_cut then null else coalesce(c.unit_pool, st.town, public._sanmon_pool(c.app_id, c.skill_id)) end pool
      from cum c left join public.sanmon_skill_town st on st.app_id = c.app_id and st.skill_id = c.skill_id
    ),
    b_mastery as (select m_ts ts, 2::numeric v, null::text pool from mastery_new where m_d >= p_cutover),
    tr_in as (
      select tr.*, le.skill_id le_skill, le.label le_label, le.pair le_pair
      from public.test_result tr
      join public.learning_event le on le.device_key = tr.device_key and le.app_id = tr.app_id and le.event_id = tr.event_id
      where tr.student_id = p_student_id and tr.school_year = sy and tr.total_max > 0
        and tr.taken_date >= from_d and tr.ts >= p_from and (p_until is null or tr.ts < p_until)
    ),
    b_test_old as (
      select min(t.ts) ts, 5::numeric v, null::text pool from (
        select tr.app_id, tr.le_skill skill_id, tr.taken_date d, tr.ts
        from tr_in tr
        where tr.total * 5 >= tr.total_max * 4 and not tr.le_pair and tr.taken_date >= p_cutover and tr.ts < least(test_cut, bal_cut)
      ) t group by t.app_id, t.skill_id, t.d
    ),
    t_rows as (
      select tr.ts, floor(tr.total::numeric * 10 / tr.total_max) v,
             coalesce(st.town, public._sanmon_pool(tr.app_id, tr.le_skill)) pool,
             row_number() over (partition by tr.app_id, tr.le_skill, tr.taken_date order by tr.ts) nth
      from tr_in tr
      left join public.sanmon_skill_town st on st.app_id = tr.app_id and st.skill_id = tr.le_skill
      where not tr.le_pair and tr.ts >= test_cut and tr.ts < bal_cut
    ),
    t2 as (
      select tr.ts, tr.taken_date d, tr.app_id, tr.le_skill skill_id, tr.mode, tr.total, public._sanmon_test_full(tr.app_id, tr.le_skill) full_max,
             case when tr.app_id = 'sanmon' then substring(tr.le_label from '（([^ ）]+)') else tr.le_skill end tkey,
             case when tr.app_id = 'sanmon' then
                    case when tr.ts < noapp_cut and public._sanmon_test_pool(substring(tr.le_label from '（([^ ）]+)')) in ('bignum', 'graph') then null
                         else public._sanmon_test_pool(substring(tr.le_label from '（([^ ）]+)')) end
                  else coalesce(st.town, public._sanmon_pool(tr.app_id, tr.le_skill)) end pool
      from tr_in tr
      left join public.sanmon_skill_town st on st.app_id = tr.app_id and st.skill_id = tr.le_skill
      where not tr.le_pair and tr.ts >= bal_cut
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
             -- 前の日までの最高の段（tm）も ふくめて「それまでの最高」
             greatest(max(floor) over (partition by app_id order by ts rows between unbounded preceding and 1 preceding),
                      (init_tm ->> app_id)::int) prev
      from (select t.*, case when coalesce(t.detail->>'start', '') ~ '^\d+$' then (t.detail->>'start')::int else 0 end start_floor
            from public.trial_result t
            where t.student_id = p_student_id and t.school_year = sy and t.solo_complete
              and t.ts >= p_from and (p_until is null or t.ts < p_until)) x
    ),
    b_trial as (
      select ts, (greatest(0, f - coalesce(prev, 0)) * 3)::numeric v, null::text pool from trial_rows
      where d >= p_cutover and (ts < bal_cut or app_id in (select app_id from g4))
    ),
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
        and s.ts >= p_from and (p_until is null or s.ts < p_until)
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
  for k in select unnest(array['bignum','graph','angle','div1','div2','suihei','decimal','rounding','calcrules','area','decmuldiv','fraction','change','solid','ratio']) loop
    towns := towns || jsonb_build_object(k, floor(coalesce((pools ->> k)::numeric, 0) + coalesce((pools ->> public._sanmon_shared_of(k))::numeric, 0)));
  end loop;
  -- 前の日までの数は 端数（0.5 など）のまま のこす（floor するのは 子どもに見せる数だけ）
  res := jsonb_build_object('common', floor(common), 'towns', towns, 'pools', pools, 'earned_today', floor(e_today));
  if p_until is null then return res; end if;

  -- 次に つづけるための状態：熟達した時刻・つづけて正解の数・階段の最高の段
  with ev as (select * from public._sanmon_ev(p_student_id, sy, p_from, p_until)),
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
    select distinct on (app_id, skill_id) app_id || '|' || skill_id kk, ts m_ts
    from streak where n >= 5 and not (init_m ? (app_id || '|' || skill_id)) order by app_id, skill_id, ts, ek
  ),
  last_run as (
    select app_id || '|' || skill_id kk, max(n) filter (where grp = g) n_last, g
    from (select streak.*, max(grp) over (partition by app_id, skill_id) g from streak) z
    group by app_id, skill_id, g
  )
  select coalesce((select jsonb_object_agg(kk, m_ts) from mastery_new), '{}'::jsonb),
         coalesce((select jsonb_object_agg(kk, coalesce(n_last, 0)) from last_run), '{}'::jsonb)
    into out_m, out_t;
  out_m := init_m || out_m;
  -- つづけて正解の数：この区間に答えがあった項目は 区間の終わりの数（まだ まちがえていなければ 前からの数をふくむ）。熟達した項目は もう要らない
  out_t := init_t || out_t;
  select coalesce(jsonb_object_agg(j.key, j.value), '{}'::jsonb) into out_t
  from jsonb_each(out_t) j where not (out_m ? j.key);
  select init_tm || coalesce(jsonb_object_agg(app_id, greatest(mf, coalesce((init_tm ->> app_id)::int, 0))), '{}'::jsonb) into out_tm
  from (select t.app_id, max(t.floor) mf from public.trial_result t
        where t.student_id = p_student_id and t.school_year = sy and t.solo_complete
          and t.ts >= p_from and t.ts < p_until group by t.app_id) x;
  return res || jsonb_build_object('common_raw', common, 'm', out_m, 't', out_t, 'tm', out_tm);
end $$;
revoke all on function public._sanmon_pools_fold(uuid, bigint, bigint, jsonb) from public, anon, authenticated;

-- ============ B) 前日までの状態を のこして、きょうの分だけ数える ============

create table if not exists public.sanmon_pools_snap (
  student_id uuid primary key,
  cut_ms bigint not null,               -- この時刻（きょうの0時）より前を数えた状態
  state jsonb not null,                 -- _sanmon_pools_fold の返り（common_raw・pools・m・t・tm）
  ver bigint not null default 0,        -- cut_ms より前の記録が 足された・消された・直されたら +1
  built_ver bigint not null default -1, -- state が どの ver までを 数えたか
  computed_at timestamptz not null default now()
);
alter table public.sanmon_pools_snap enable row level security;
revoke all on table public.sanmon_pools_snap from anon, authenticated;

-- 1年ぶんを一度に数える形（たしかめ用。もとの _sanmon_pools_compute と同じ答え。並べ方は ek で決まる）
create or replace function public._sanmon_pools_full(p_student_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public._sanmon_pools_fold(p_student_id, 0, null, '{}'::jsonb)
$$;
revoke all on function public._sanmon_pools_full(uuid) from public, anon, authenticated;

create or replace function public._sanmon_pools_compute(p_student_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  cut bigint := (extract(epoch from (((now() at time zone 'Asia/Tokyo')::date)::timestamp at time zone 'Asia/Tokyo')) * 1000)::bigint;
  s public.sanmon_pools_snap;
  st jsonb; v0 bigint;
begin
  select * into s from public.sanmon_pools_snap where student_id = p_student_id;
  if found and s.cut_ms = cut and s.built_ver = s.ver then
    st := s.state;
  else
    v0 := coalesce(s.ver, 0);
    st := public._sanmon_pools_fold(p_student_id, 0, cut, '{}');
    -- 読むだけの取引（PRISM など）からも呼ばれるので、のこせないときは のこさない
    begin
      insert into public.sanmon_pools_snap as ps (student_id, cut_ms, state, ver, built_ver, computed_at)
      values (p_student_id, cut, st, v0, v0, now())
      on conflict (student_id) do update
        set cut_ms = excluded.cut_ms, state = excluded.state, built_ver = v0, computed_at = now();
    exception when others then
      null;
    end;
  end if;
  return public._sanmon_pools_fold(p_student_id, cut, null, st);
end $$;
revoke all on function public._sanmon_pools_compute(uuid) from public, anon, authenticated;

-- 記録が ふえた・変わったときの しるし：きょうの0時より前の記録なら、のこした状態も 古くする
create or replace function public._sanmon_bump_ver() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.sanmon_pools_cache as pc (student_id, ver, bumped_at)
    select distinct n.student_id, 1, now() from new_rows n where n.student_id is not null
    on conflict (student_id) do update set ver = pc.ver + 1, bumped_at = now();
    if tg_table_name <> 'skill_state' then
      update public.sanmon_pools_snap ps set ver = ps.ver + 1
      from (select n.student_id, min(n.ts) mts from new_rows n where n.student_id is not null group by n.student_id) x
      where ps.student_id = x.student_id and x.mts < ps.cut_ms;
    end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    insert into public.sanmon_pools_cache as pc (student_id, ver, bumped_at)
    select distinct o.student_id, 1, now() from old_rows o where o.student_id is not null
    on conflict (student_id) do update set ver = pc.ver + 1, bumped_at = now();
    if tg_table_name <> 'skill_state' then
      update public.sanmon_pools_snap ps set ver = ps.ver + 1
      from (select o.student_id, min(o.ts) mts from old_rows o where o.student_id is not null group by o.student_id) x
      where ps.student_id = x.student_id and x.mts < ps.cut_ms;
    end if;
  end if;
  return null;
end $$;

-- 数え方に使う表（apps・sanmon_skill_town）が変わったら、全員 数えなおす
create or replace function public._sanmon_bump_all() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.sanmon_pools_cache set done_ver = -1;
  update public.sanmon_pools_snap set ver = ver + 1;
  return null;
end $$;

-- ============ C) たしかめ（切りかえの前に流した。全員 一致すること） ============
-- select count(*) n, count(*) filter (where public._sanmon_pools_full(s.id) - 'pools' = public._sanmon_pools_compute(s.id) - 'pools') same
-- from public.students s;
