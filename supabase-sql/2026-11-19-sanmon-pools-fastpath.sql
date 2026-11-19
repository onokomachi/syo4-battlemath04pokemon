-- スタミナ：子どもの画面には「最後に数えた数 − そのあと使った分」をすぐ返し、数えなおしは2分ごとの裏の仕事でする（2026-11-19）。
--
-- なぜ：2026-11-19-sanmon-pools-cache.sql で「変わったときだけ数えなおす」にしたが、授業中は 答えるたびに記録がふえて
-- 毎回 数えなおしになり、データベースの CPU が おそいままでは 3秒（子どもの端末の打ち切り）を こえて 9割が失敗していた。
-- 数えなおしを 子どもの問い合わせの中で しないようにする。
--  - _sanmon_pools：のこした数が 今の記録と同じなら そのまま。ちがっても きょう数えた数があれば、それから「そのあと使った分」を引いて返す
--    （そのあと たまった分は、次の数えなおし（2分ごと）まで 出ない。使いすぎには ならない）。きょう まだ数えていなければ、その場で数える。
--  - sanmon_status：のこした状態（町の判定の材料）が きょうの分なら、スタミナだけ 上の数に入れかえて返す。
--  - refresh_sanmon_status_cache（2分ごと）：記録が変わった子を、さいきん変わった順に 数えなおす（1回40秒まで）。

alter table public.sanmon_pools_cache add column if not exists bumped_at timestamptz;

create or replace function public._sanmon_bump_ver() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.sanmon_pools_cache as pc (student_id, ver, bumped_at)
    select distinct n.student_id, 1, now() from new_rows n where n.student_id is not null
    on conflict (student_id) do update set ver = pc.ver + 1, bumped_at = now();
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    insert into public.sanmon_pools_cache as pc (student_id, ver, bumped_at)
    select distinct o.student_id, 1, now() from old_rows o where o.student_id is not null
    on conflict (student_id) do update set ver = pc.ver + 1, bumped_at = now();
  end if;
  return null;
end $$;

-- のこした数から「そのあと使った分」を引く（_sanmon_pools_compute の 使うときの 引き方と同じ：町 → 共通の町 → 共通）
create or replace function public._sanmon_pools_minus_spends(p_pools jsonb, p_student_id uuid, p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  pools jsonb := coalesce(p_pools -> 'pools', '{}'::jsonb);
  common numeric := coalesce((p_pools ->> 'common')::numeric, 0);
  s record; need numeric; have numeric; k text; towns jsonb := '{}'::jsonb;
  since_ms bigint := (extract(epoch from p_since) * 1000)::bigint;
  any_spend boolean := false;
begin
  for s in
    select amount, case when position('@' in reason) > 0 then split_part(reason, '@', 2) end pool
    from public.sanmon_spend
    where student_id = p_student_id and ts >= since_ms
    order by ts
  loop
    any_spend := true;
    need := s.amount;
    foreach k in array array_remove(array[s.pool, public._sanmon_shared_of(s.pool)], null) loop
      have := coalesce((pools ->> k)::numeric, 0);
      if have > 0 and need > 0 then
        pools := jsonb_set(pools, array[k], to_jsonb(have - least(have, need)));
        need := need - least(have, need);
      end if;
    end loop;
    common := greatest(0, common - need);
  end loop;
  if not any_spend then return p_pools; end if;
  for k in select unnest(array['bignum','graph','angle','div1','div2','suihei','decimal','rounding','calcrules','area','decmuldiv','fraction','change','solid','ratio']) loop
    towns := towns || jsonb_build_object(k, floor(coalesce((pools ->> k)::numeric, 0) + coalesce((pools ->> public._sanmon_shared_of(k))::numeric, 0)));
  end loop;
  return p_pools || jsonb_build_object('common', floor(common), 'towns', towns, 'pools', pools);
end $$;
revoke all on function public._sanmon_pools_minus_spends(jsonb, uuid, timestamptz) from public, anon, authenticated;

create or replace function public._sanmon_pools(p_student_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.sanmon_pools_cache;
  v0 bigint;
  res jsonb;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select * into c from public.sanmon_pools_cache where student_id = p_student_id;
  if found and c.pools is not null then
    if c.computed_on = today then
      if c.done_ver = c.ver then return c.pools; end if;
      -- 記録が ふえたが、数えなおしは 裏の仕事（2分ごと）にまかせる
      return public._sanmon_pools_minus_spends(c.pools, p_student_id, c.computed_at);
    end if;
    -- 前の日に数えた数：きょう たまった分は まだ入っていない（earned_today は 0）。裏の仕事が きょうの分を数えるまで これを使う
    return public._sanmon_pools_minus_spends(c.pools, p_student_id, c.computed_at) || jsonb_build_object('earned_today', 0);
  end if;
  v0 := coalesce(c.ver, 0);
  res := public._sanmon_pools_compute(p_student_id);
  begin
    insert into public.sanmon_pools_cache as pc (student_id, pools, computed_on, ver, done_ver, computed_at)
    values (p_student_id, res, today, v0, v0, now() - interval '2 seconds')
    on conflict (student_id) do update
      set pools = excluded.pools, computed_on = excluded.computed_on, done_ver = v0, computed_at = now() - interval '2 seconds';
  exception when others then
    null;
  end;
  return res;
end $$;

-- sanmon_status：のこした状態が きょうの分なら、スタミナだけ 入れかえて返す
do $$ begin
  if not exists (select 1 from pg_proc where proname = '_sanmon_status_compute' and pronamespace = 'public'::regnamespace) then
    alter function public.sanmon_status(uuid) rename to _sanmon_status_compute;
  end if;
end $$;
revoke all on function public._sanmon_status_compute(uuid) from public, anon, authenticated;

create or replace function public.sanmon_status(p_student_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  pl jsonb; st jsonb;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if p_student_id is null or not exists (select 1 from public.students where id = p_student_id) then
    raise exception '未登録の student_id です';
  end if;
  -- 町の判定の材料（熟達・テスト・階段・ねばり）は、のこした状態を使う（裏の仕事が 2分ごとに 新しくする）
  select c.status into st from public.sanmon_status_cache c where c.student_id = p_student_id;
  if st is null then
    return public._sanmon_status_compute(p_student_id);
  end if;
  pl := public._sanmon_pools(p_student_id);
  return st || jsonb_build_object(
    'stamina', (pl ->> 'common')::int,
    'earned_today', (pl ->> 'earned_today')::int,
    'towns', coalesce(pl -> 'towns', '{}'::jsonb));
end $$;
grant execute on function public.sanmon_status(uuid) to anon, authenticated, service_role;

-- 2分ごとの裏の仕事：記録が変わった子を、さいきん変わった順に 数えなおす（1回40秒まで）
create or replace function public.refresh_sanmon_status_cache()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record; n int := 0; v0 bigint; res jsonb; t1 timestamptz;
  today date := (now() at time zone 'Asia/Tokyo')::date;
  t0 timestamptz := clock_timestamp();
begin
  for r in
    select s.id
    from public.students s
    left join public.sanmon_pools_cache pc on pc.student_id = s.id
    left join public.sanmon_status_cache sc on sc.student_id = s.id
    where pc.pools is null or pc.done_ver <> pc.ver or pc.computed_on <> today
       or sc.student_id is null or sc.src_ver is distinct from pc.ver
       or (sc.computed_at at time zone 'Asia/Tokyo')::date <> today
    order by pc.bumped_at desc nulls last, sc.computed_at nulls first
  loop
    exit when clock_timestamp() - t0 > interval '40 seconds';
    begin
      select coalesce(ver, 0) into v0 from public.sanmon_pools_cache where student_id = r.id;
      v0 := coalesce(v0, 0);
      -- 数えはじめる 2秒前を「数えた時刻」にする（そのあと使った分を 引きのがさない。かさなった分は 多めに引くだけ＝使いすぎにならない）
      t1 := clock_timestamp() - interval '2 seconds';
      res := public._sanmon_pools_compute(r.id);
      insert into public.sanmon_pools_cache as pc (student_id, pools, computed_on, ver, done_ver, computed_at)
      values (r.id, res, today, v0, v0, t1)
      on conflict (student_id) do update
        set pools = excluded.pools, computed_on = excluded.computed_on, done_ver = v0, computed_at = t1;
      insert into public.sanmon_status_cache (student_id, status, computed_at, src_ver)
      values (r.id, public._sanmon_status_compute(r.id), clock_timestamp(), v0)
      on conflict (student_id) do update set status = excluded.status, computed_at = excluded.computed_at, src_ver = excluded.src_ver;
      n := n + 1;
    exception when others then
      null;
    end;
  end loop;
  return n;
end $$;

select cron.alter_job(jobid, schedule := '*/2 * * * *') from cron.job where jobname = 'sanmon-status-cache';
